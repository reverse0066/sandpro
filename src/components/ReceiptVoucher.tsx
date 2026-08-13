/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Printer, X, Download, Loader2, PenTool, Type, Minimize2, Maximize2, Sparkles, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRef, useState, ChangeEvent, useEffect } from 'react';
import SignaturePad from './SignaturePad';
import { Receipt, OrganizationSettings } from '../types';
import { safeHtml2canvas } from '../utils/html2canvasFix';
import { jsPDF } from 'jspdf';
import { ModernTemplate, LuxuryTemplate, MinimalTemplate, DaftraTemplate, ProfessionalTemplate, ClassicTemplate } from './ReceiptTemplates';
import { usePrint } from './PrintErrorBoundary';

interface ReceiptVoucherProps {
  receipt: Receipt;
  settings: OrganizationSettings;
  onClose: () => void;
  onUpdateSettings?: (settings: OrganizationSettings) => void;
  isStatic?: boolean;
}

export default function ReceiptVoucher({ receipt, settings, onClose, onUpdateSettings, isStatic = false }: ReceiptVoucherProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [signature, setSignature] = useState<string | undefined>(undefined);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<OrganizationSettings['preferredTemplate']>(settings.preferredTemplate || 'modern');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(settings.fontSize || 'medium');
  const [isCompact, setIsCompact] = useState<boolean>(settings.isCompact || false);
  const [exportFormat, setExportFormat] = useState<'a4' | 'a5'>('a4');
  const [receiptDate, setReceiptDate] = useState<string>(receipt.date || new Date().toISOString().split('T')[0]);
  const { setStatus, logEvent } = usePrint();

  useEffect(() => {
    if (settings.preferredTemplate) {
      setSelectedTemplate(settings.preferredTemplate);
    }
  }, [settings.preferredTemplate]);

  const handleTemplateChange = (newTemplate: OrganizationSettings['preferredTemplate']) => {
    setSelectedTemplate(newTemplate);
    if (onUpdateSettings) {
      onUpdateSettings({ ...settings, preferredTemplate: newTemplate });
    }
  };

  // Unified PDF Generation function
  const generatePDFBlob = async (): Promise<{ blob: Blob; fileName: string } | null> => {
    if (!receiptRef.current) return null;

    try {
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 800));

      const WIDTH = exportFormat === 'a4' ? 794 : 559;
      const HEIGHT = exportFormat === 'a4' ? 1123 : 794;

      const canvas = await safeHtml2canvas(receiptRef.current, {
        scale: 1.8,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: WIDTH,
        windowWidth: WIDTH,
        windowHeight: HEIGHT,
        onclone: (clonedDoc) => {
          const el = clonedDoc.body.querySelector('.receipt-container') as HTMLElement;
          if (el) {
            el.style.width = `${WIDTH}px`;
            el.style.minHeight = `${HEIGHT}px`;
            el.style.padding = isCompact ? '10mm' : '15mm';
            el.style.margin = '0 auto';
            el.style.boxSizing = 'border-box';
            el.style.display = 'block';
            el.style.backgroundColor = '#ffffff';
          }
        }
      });

      if (!canvas) throw new Error('Canvas generation failed');

      const imgData = canvas.toDataURL('image/jpeg', 0.90);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: exportFormat,
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const canvasRatio = canvas.height / canvas.width;
      let finalWidth = pdfWidth;
      let finalHeight = pdfWidth * canvasRatio;

      if (finalHeight > pdfHeight) {
        finalHeight = pdfHeight;
        finalWidth = finalHeight / canvasRatio;
      }

      const xOffset = (pdfWidth - finalWidth) / 2;
      const yOffset = (pdfHeight - finalHeight) / 2;
      pdf.addImage(imgData, 'JPEG', xOffset, yOffset, finalWidth, finalHeight, undefined, 'FAST');
      
      const fileName = `Receipt-${receipt.receiptNo || 'voucher'}.pdf`;
      return { blob: pdf.output('blob'), fileName };
    } catch (error) {
      console.error('PDF Blob generation failed:', error);
      return null;
    }
  };

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    setStatus('processing', 'جاري تحضير ملف PDF...');
    try {
      const result = await generatePDFBlob();
      if (result) {
        const url = URL.createObjectURL(result.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.fileName;
        link.click();
        URL.revokeObjectURL(url);
        setStatus('success', 'تم تحميل الملف بنجاح');
      } else {
        setStatus('error', 'فشل تحميل الملف');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    logEvent('Manual print triggered', { receiptNo: receipt.receiptNo, fontSize, isCompact });
    window.print();
  };

  const saveSignature = (signatureData: string) => {
    if (!signatureData) {
      setSignature(undefined);
    } else {
      setSignature(signatureData);
    }
    setShowSignaturePad(false);
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2 ميجابايت');
      return;
    }

    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (onUpdateSettings) {
        onUpdateSettings({ ...settings, logo: base64 });
      }
      setIsUploadingLogo(false);
    };
    reader.onerror = () => {
      alert('حدث خطأ أثناء قراءة الملف');
      setIsUploadingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  const triggerLogoUpload = () => {
    fileInputRef.current?.click();
  };

  const renderTemplate = () => {
    const props = { 
      receipt: { ...receipt, date: receiptDate }, 
      settings: { ...settings, preferredTemplate: selectedTemplate, fontSize, isCompact, paperSize: exportFormat }, 
      signature: signature || settings.signature,
      stamp: settings.stamp
    };
    switch (selectedTemplate) {
      case 'modern':
        return <ModernTemplate {...props} />;
      case 'luxury':
        return <LuxuryTemplate {...props} />;
      case 'minimal':
        return <MinimalTemplate {...props} />;
      case 'daftra':
        return <DaftraTemplate {...props} />;
      case 'professional':
        return <ProfessionalTemplate {...props} />;
      case 'classic':
      default:
        return <ClassicTemplate {...props} />;
    }
  };

  if (isStatic) {
    return (
      <div ref={receiptRef} className="receipt-container">
        {renderTemplate()}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm print:p-0 print:bg-white print:backdrop-blur-none"
      dir="rtl"
    >
      <div className="relative w-full max-w-4xl print:w-full print:max-w-none overflow-y-auto max-h-[90vh] print:max-h-none rounded-3xl" style={{ backgroundColor: '#ffffff', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        {/* Controls - Hidden on Print */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100 p-4 flex flex-col gap-4 print:hidden">
          <div className="flex justify-between items-center">
            <div className="flex gap-2 flex-wrap items-center">
              {/* Template Selector Dropdown */}
              <div className="flex items-center gap-2 p-1 bg-blue-50 border border-blue-100 rounded-xl">
                <span className="text-xs font-black text-blue-800 pr-2">القالب:</span>
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value as OrganizationSettings['preferredTemplate'])}
                  className="px-3 py-1.5 text-xs font-bold text-blue-900 bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
                >
                  <option value="classic">كلاسيكي (مؤطر)</option>
                  <option value="modern">عصري (حديث)</option>
                  <option value="professional">رسمي (شركات)</option>
                  <option value="minimal">مبسط (بيانات)</option>
                  <option value="luxury">ملكي فاخر (ذهبي)</option>
                  <option value="daftra">محاسبي (دفاتر)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setExportFormat('a4')}
                  className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${exportFormat === 'a4' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  A4
                </button>
                <button
                  onClick={() => setExportFormat('a5')}
                  className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${exportFormat === 'a5' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  A5
                </button>
              </div>

              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setFontSize('small')}
                  className={`p-2 rounded-lg transition-all ${fontSize === 'small' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  title="خط صغير"
                >
                  <Type size={14} strokeWidth={3} />
                </button>
                <button
                  onClick={() => setFontSize('medium')}
                  className={`p-2 rounded-lg transition-all ${fontSize === 'medium' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  title="خط متوسط"
                >
                  <Type size={18} strokeWidth={2} />
                </button>
                <button
                  onClick={() => setFontSize('large')}
                  className={`p-2 rounded-lg transition-all ${fontSize === 'large' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  title="خط كبير"
                >
                  <Type size={22} strokeWidth={2} />
                </button>
              </div>

              <button
                onClick={() => setIsCompact(!isCompact)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all ${isCompact ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:text-slate-900'}`}
              >
                {isCompact ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                {isCompact ? 'تنسيق مدمج' : 'تنسيق قياسي'}
              </button>

              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                <Calendar size={14} className="text-slate-500 mr-1" />
                <span className="text-xs font-bold text-slate-600">تاريخ السند:</span>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="px-2 py-1 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={triggerLogoUpload}
                disabled={isUploadingLogo || !onUpdateSettings}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl transition-all ${
                  isUploadingLogo ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                } ${!onUpdateSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="تغيير شعار الشركة"
              >
                {isUploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="text-blue-500" />}
                <span>{settings.logo ? 'تغيير الشعار' : 'إدراج شعار'}</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl bg-slate-50 p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={isExporting}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                title="تصدير ملف PDF عالي الجودة جاهز للطباعة"
              >
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                تصدير PDF
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 px-6 py-2 text-sm font-bold shadow-md transition-all active:scale-95"
              >
                <Printer size={16} />
                طباعة
              </button>
              <button
                onClick={() => setShowSignaturePad(true)}
                className="flex items-center gap-2 rounded-xl bg-amber-100 px-6 py-2 text-sm font-bold text-amber-700 hover:bg-amber-200 transition-all"
              >
                <PenTool size={16} />
                {signature ? 'تعديل التوقيع' : 'إضافة توقيع'}
              </button>
            </div>
          </div>
        </div>

        {/* Signature Pad Modal */}
        <AnimatePresence>
          {showSignaturePad && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="text-lg font-black text-slate-900">رسم التوقيع الإلكتروني</h3>
                  <button 
                    onClick={() => setShowSignaturePad(false)}
                    className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-6">
                  <SignaturePad 
                    onSave={saveSignature} 
                    onClear={() => {}} 
                    onCancel={() => setShowSignaturePad(false)} 
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Receipt Content Container */}
        <div ref={receiptRef} className="print:m-0 receipt-container">
          {renderTemplate()}
        </div>
      </div>
    </motion.div>
  );
}
