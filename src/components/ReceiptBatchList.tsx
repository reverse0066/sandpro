/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  FileText, Eye, CheckCircle2, ChevronLeft, Download, Loader2, Edit3, 
  Check, X, AlertTriangle, AlertCircle, RefreshCw, Filter, CheckCheck, 
  ArrowRightLeft, Copy, Sparkles, Layers, ShieldAlert 
} from 'lucide-react';
import { Receipt, OrganizationSettings } from '../types';
import { safeHtml2canvas } from '../utils/html2canvasFix';
import { jsPDF } from 'jspdf';
import ReceiptVoucher from './ReceiptVoucher';
import { PrintErrorBoundary, usePrint } from './PrintErrorBoundary';

interface ReceiptBatchListProps {
  receipts: Receipt[];
  settings: OrganizationSettings;
  onViewReceipt: (receipt: Receipt) => void;
  onUpdateReceipt?: (receipt: Receipt) => void;
  onClose: () => void;
}

export default function ReceiptBatchList({ receipts, settings, onViewReceipt, onUpdateReceipt, onClose }: ReceiptBatchListProps) {
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [editFormData, setEditFormData] = useState<Receipt | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'discrepancies' | 'matched'>('all');
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { setStatus, logEvent } = usePrint();

  // Helper to detect date or amount discrepancy
  const checkDiscrepancy = (r: Receipt) => {
    const invTotal = r.invoiceTotalWithVat ?? r.amount;
    const amountMismatch = Math.abs(r.amount - invTotal) >= 0.01;
    
    let dateMismatch = false;
    if (r.invoiceDate && r.date) {
      const cleanRDate = r.date.replace(/-/g, '/').trim();
      const cleanIDate = r.invoiceDate.replace(/-/g, '/').trim();
      dateMismatch = cleanRDate !== cleanIDate;
    }

    const hasDiscrepancy = amountMismatch || dateMismatch || r.matchStatus === 'mismatched';

    return {
      hasDiscrepancy,
      amountMismatch,
      dateMismatch,
      invTotal,
      invDate: r.invoiceDate || r.date
    };
  };

  const mismatchedReceipts = receipts.filter(r => checkDiscrepancy(r).hasDiscrepancy);
  const matchedReceipts = receipts.filter(r => !checkDiscrepancy(r).hasDiscrepancy);

  const displayedReceipts = filterMode === 'discrepancies' 
    ? mismatchedReceipts 
    : filterMode === 'matched' 
      ? matchedReceipts 
      : receipts;

  const handleStartEdit = (receipt: Receipt) => {
    setEditingReceipt(receipt);
    setEditFormData({ ...receipt });
  };

  const handleOpenSidePanelSync = (receipt: Receipt) => {
    setEditingReceipt(receipt);
    const { invTotal, invDate } = checkDiscrepancy(receipt);
    setEditFormData({
      ...receipt,
      amount: invTotal,
      date: invDate,
      customerName: receipt.customerName || 'عميل نقدي'
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editFormData && onUpdateReceipt) {
      const invTotal = editFormData.invoiceTotalWithVat ?? editFormData.amount;
      const invDate = editFormData.invoiceDate ?? editFormData.date;
      const amountMismatch = Math.abs(editFormData.amount - invTotal) >= 0.01;
      const dateMismatch = editFormData.invoiceDate && editFormData.date !== editFormData.invoiceDate;
      const isMatched = !amountMismatch && !dateMismatch;

      const updated: Receipt = {
        ...editFormData,
        matchStatus: isMatched ? 'matched' : 'mismatched',
        invoiceTotalWithVat: invTotal,
        invoiceDate: invDate
      };
      onUpdateReceipt(updated);
      setEditingReceipt(null);
      setEditFormData(null);
    }
  };

  // Quick action: Update single receipt directly from Invoice data
  const handleSyncFromInvoice = (receipt: Receipt) => {
    if (!onUpdateReceipt) return;
    const { invTotal, invDate } = checkDiscrepancy(receipt);
    const updated: Receipt = {
      ...receipt,
      amount: invTotal,
      date: invDate,
      matchStatus: 'matched'
    };
    onUpdateReceipt(updated);
  };

  // Copy all raw invoice values to edit form
  const handleApplyAllRawInvoiceData = () => {
    if (!editFormData) return;
    const invTotal = editFormData.invoiceTotalWithVat ?? editFormData.amount;
    const invDate = editFormData.invoiceDate ?? editFormData.date;
    setEditFormData({
      ...editFormData,
      amount: invTotal,
      date: invDate
    });
  };

  // Quick action: Sync all mismatched receipts at once
  const handleSyncAllFromInvoices = () => {
    if (!onUpdateReceipt) return;
    mismatchedReceipts.forEach(r => {
      handleSyncFromInvoice(r);
    });
  };

  const handleExportSinglePDF = async (receipt: Receipt) => {
    const index = receipts.findIndex(r => r.id === receipt.id);
    const targetRef = exportRefs.current[index];
    if (!targetRef) return;

    setExportingId(receipt.id);
    setStatus('processing', `جاري تصدير السند رقم ${receipt.receiptNo}...`);
    logEvent('BatchList: Start single export', { receiptNo: receipt.receiptNo });

    try {
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await safeHtml2canvas(targetRef, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const el = clonedDoc.querySelector('.export-container');
          if (el instanceof HTMLElement) {
            el.style.position = 'static';
            el.style.opacity = '1';
            el.style.visibility = 'visible';
            el.style.display = 'block';
            el.style.width = '210mm';
            el.style.minHeight = '297mm';
            el.setAttribute('dir', 'rtl');
            el.style.fontFamily = "'Cairo', Tahoma, sans-serif";
            
            const allElements = el.querySelectorAll('*');
            allElements.forEach(node => {
              if (node instanceof HTMLElement) {
                node.style.transition = 'none';
                node.style.animation = 'none';
              }
            });
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
        precision: 2
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
      pdf.addImage(imgData, 'JPEG', xOffset, 0, finalWidth, finalHeight, undefined, 'FAST');

      const fileName = `Receipt-${receipt.receiptNo || 'voucher'}.pdf`;
      pdf.save(fileName);
      
      setStatus('success', `تم تصدير السند رقم ${receipt.receiptNo} بنجاح`);
      logEvent('BatchList: Single export success', { fileName });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      setStatus('error', 'فشل تصدير السند');
      logEvent('BatchList: Single export failed', { error });
      alert('حدث خطأ أثناء تصدير ملف الـ PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      setExportingId(null);
    }
  };

  const handleExportAllAsPdf = async () => {
    if (receipts.length === 0 || isExportingAll) return;
    
    setIsExportingAll(true);
    setStatus('processing', `جاري تجهيز ${receipts.length} سند للتصدير...`);
    logEvent('BatchList: Start all export', { count: receipts.length });

    try {
      // Use jspdf with standard A4 settings
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Process sequentially with UI updates to prevent freezing
      for (let i = 0; i < receipts.length; i++) {
        const receipt = receipts[i];
        setStatus('processing', `جاري معالجة السند ${i + 1} من ${receipts.length}: ${receipt.receiptNo}`);
        
        // Wait for DOM and animation frame
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 50));

        const targetRef = exportRefs.current[i];
        if (!targetRef) {
          console.warn(`Reference missing for receipt ${receipt.receiptNo}`);
          continue;
        }

        try {
          const canvas = await safeHtml2canvas(targetRef, {
            scale: 2, // Balanced for quality and memory
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          });

          if (!canvas || canvas.width === 0) throw new Error('Canvas generation failed');

          const imgData = canvas.toDataURL('image/jpeg', 0.8);
          if (i > 0) pdf.addPage();

          const canvasRatio = canvas.height / canvas.width;
          let finalWidth = pdfWidth;
          let finalHeight = pdfWidth * canvasRatio;

          if (finalHeight > pdfHeight) {
            finalHeight = pdfHeight;
            finalWidth = finalHeight / canvasRatio;
          }

          const xOffset = (pdfWidth - finalWidth) / 2;
          pdf.addImage(imgData, 'JPEG', xOffset, 0, finalWidth, finalHeight, undefined, 'FAST');
          
          // Cleanup
          canvas.width = 0;
          canvas.height = 0;
        } catch (innerErr: any) {
          console.error(`Failed to export receipt ${receipt.receiptNo}:`, innerErr);
        }
      }

      const fileName = `سندات_مجمعة_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      setStatus('success', `تم تصدير ${receipts.length} سند بنجاح`);
      logEvent('BatchList: All export success');
    } catch (error: any) {
      console.error('Critical export failure:', error);
      setStatus('error', 'فشل تصدير السندات المجمعة');
      alert(`حدث خطأ أثناء التصدير: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setIsExportingAll(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      {/* Hidden container for PDF rendering */}
      <div className="fixed top-0 left-[-9999px] overflow-hidden bg-white" aria-hidden="true" style={{ width: '210mm' }}>
        {receipts.map((receipt, index) => (
          <div 
            key={receipt.id || index}
            ref={el => exportRefs.current[index] = el}
            className="w-[210mm] bg-white export-container" 
            style={{ minHeight: '297mm', padding: '0', margin: '0' }}
          >
            <div className="p-0 bg-white">
              <PrintErrorBoundary>
                <ReceiptVoucher 
                  receipt={receipt} 
                  settings={settings} 
                  onClose={() => {}} 
                  isStatic 
                />
              </PrintErrorBoundary>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">قائمة السندات المستخرجة</h2>
          <p className="text-slate-500 text-sm">تم استخراج {receipts.length} سندات بنجاح من الفواتير المرفوعة</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Discrepancy spot filter buttons */}
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterMode === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Filter size={14} />
            <span>عرض الكل ({receipts.length})</span>
          </button>

          <button
            onClick={() => setFilterMode('discrepancies')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterMode === 'discrepancies'
                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-300'
                : mismatchedReceipts.length > 0
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle size={14} className={mismatchedReceipts.length > 0 ? "text-rose-600 animate-pulse" : ""} />
            <span>تحديد الفروقات ({mismatchedReceipts.length})</span>
          </button>

          <button
            onClick={() => setFilterMode('matched')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterMode === 'matched'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <CheckCheck size={14} />
            <span>المطابقة ({matchedReceipts.length})</span>
          </button>

          {/* Sync All button if there are mismatched receipts */}
          {mismatchedReceipts.length > 0 && onUpdateReceipt && (
            <button
              onClick={handleSyncAllFromInvoices}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 active:scale-95"
              title="تعديل وتحديث كافة الفروقات تلقائياً من بيانات الفواتير"
            >
              <RefreshCw size={14} />
              <span>تحديث الكل من الفواتير</span>
            </button>
          )}

          <button 
            onClick={onClose}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors mr-2 text-sm"
          >
            <ChevronLeft size={20} />
            العودة للرفع
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {displayedReceipts.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-100 space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
            <h3 className="text-lg font-bold text-slate-800">لا توجد عناصر في هذا الفلتر</h3>
            <p className="text-sm text-slate-500">
              {filterMode === 'discrepancies' ? 'جميع السندات متطابقة تماماً مع بيانات الفواتير!' : 'لا توجد سندات لعرضها.'}
            </p>
          </div>
        ) : (
          displayedReceipts.map((receipt) => {
            const { hasDiscrepancy, amountMismatch, dateMismatch, invTotal, invDate } = checkDiscrepancy(receipt);

            return (
              <div 
                key={receipt.id} 
                className={`group p-6 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  hasDiscrepancy 
                    ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-200 shadow-sm hover:border-rose-400' 
                    : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200'
                }`}
              >
                <div className="flex items-start md:items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    hasDiscrepancy ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {hasDiscrepancy ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">سند رقم: {receipt.receiptNo}</span>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-semibold">فاتورة #{receipt.invoiceNo}</span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full font-semibold">التاريخ: {receipt.date}</span>
                      
                      {/* Status badge */}
                      {!hasDiscrepancy ? (
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Check size={12} />
                          مطابق للفاتورة
                        </span>
                      ) : (
                        <span className="text-xs bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
                          <AlertTriangle size={12} />
                          {amountMismatch && dateMismatch ? 'تضارب في التاريخ والمبلغ' : amountMismatch ? 'تضارب في المبلغ' : 'تضارب في التاريخ'}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-500 mt-1">{receipt.customerName}</p>

                    {/* Discrepancy details warning box in light red */}
                    {hasDiscrepancy && (
                      <div className="mt-2 text-xs text-rose-900 bg-rose-100/80 border border-rose-200 px-3 py-2 rounded-xl space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-rose-800">
                          <AlertCircle size={14} className="shrink-0 text-rose-600" />
                          <span>تنبيه وجود فروقات مقارنة ببيانات الفاتورة الأصلية:</span>
                        </div>
                        {amountMismatch && (
                          <div className="mr-5 text-rose-700">
                            • المبلغ في السند: <strong className="text-rose-900">{receipt.amount.toLocaleString('ar-SA')} ر.س</strong> ≠ المبلغ في الفاتورة: <strong className="text-emerald-800">{invTotal.toLocaleString('ar-SA')} ر.س</strong>
                          </div>
                        )}
                        {dateMismatch && (
                          <div className="mr-5 text-rose-700">
                            • التاريخ في السند: <strong className="text-rose-900">{receipt.date}</strong> ≠ التاريخ في الفاتورة: <strong className="text-emerald-800">{invDate}</strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-200/60">
                  <div className="text-right md:text-left">
                    <p className="text-xs text-slate-400">مبلغ السند</p>
                    <p className={`text-lg font-black ${hasDiscrepancy ? 'text-rose-700' : 'text-blue-600'}`}>
                      {receipt.amount.toLocaleString('ar-SA')} ر.س
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Dedicated "تحديث من الفاتورة" Buttons */}
                    {onUpdateReceipt && (
                      <button
                        onClick={() => handleOpenSidePanelSync(receipt)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 ${
                          hasDiscrepancy 
                            ? 'bg-rose-600 hover:bg-rose-700 text-white animate-bounce-subtle' 
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                        title="فتح لوحة المقارنة والتحديث من بيانات الفاتورة الأصلية"
                      >
                        <RefreshCw size={14} className={hasDiscrepancy ? "animate-spin" : ""} />
                        <span>تحديث من الفاتورة</span>
                      </button>
                    )}

                    <button 
                      onClick={() => handleExportSinglePDF(receipt)}
                      disabled={exportingId === receipt.id}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      title="تصدير PDF (مقاس A4)"
                    >
                      {exportingId === receipt.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      <span>تصدير PDF</span>
                    </button>

                    <button 
                      onClick={() => handleStartEdit(receipt)}
                      className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 bg-white"
                      title="تعديل ومقارنة بيانات السند يدوياً"
                    >
                      <Edit3 size={18} />
                    </button>

                    <button 
                      onClick={() => onViewReceipt(receipt)}
                      className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-slate-200 bg-white"
                      title="عرض السند"
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Side Drawer Panel for Detailed Invoice Data vs Receipt Form */}
      {editingReceipt && editFormData && (() => {
        const rawTotal = editingReceipt.invoiceTotalWithVat ?? editingReceipt.amount;
        const rawDate = editingReceipt.invoiceDate ?? editingReceipt.date;
        const rawCustomer = editingReceipt.customerName || 'عميل نقدي';
        const rawInvoiceNo = editingReceipt.invoiceNo || 'بدون رقم';

        const amountMatches = Math.abs(editFormData.amount - rawTotal) < 0.01;
        const dateMatches = editFormData.date === rawDate;
        const customerMatches = editFormData.customerName === rawCustomer;

        return (
          <div className="fixed inset-0 z-[100] flex justify-start bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            {/* Backdrop click listener */}
            <div 
              className="absolute inset-0" 
              onClick={() => { setEditingReceipt(null); setEditFormData(null); }} 
            />

            {/* Side Drawer Content Container */}
            <div className="relative z-10 bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-left duration-300 overflow-hidden">
              
              {/* Drawer Header */}
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-400 flex items-center justify-center shrink-0">
                    <ArrowRightLeft size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      لوحة التحديث والمطابقة التفصيلية
                      <span className="text-xs font-normal px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full">
                        الفاتورة #{rawInvoiceNo}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      مقارنة بيانات الفاتورة الأصلية (Raw Data) بالحقول القابلة للتعديل
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setEditingReceipt(null); setEditFormData(null); }}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
                  title="إغلاق اللوحة"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

                {/* RAW EXTRACTED INVOICE DATA BOX */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-blue-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                        البيانات الخام المستخرجة من الفاتورة (Raw Data)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyAllRawInvoiceData}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                      title="نسخ جميع القيم المستخرجة من الفاتورة إلى حقول السند"
                    >
                      <Copy size={13} />
                      <span>تطبيق كافة بيانات الفاتورة</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/50">
                      <span className="text-slate-400 block mb-1">إجمالي الفاتورة الأصلي (شامل الضريبة):</span>
                      <strong className="text-base font-black text-emerald-400 dir-ltr block">
                        {rawTotal.toLocaleString('ar-SA')} ر.س
                      </strong>
                    </div>

                    <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/50">
                      <span className="text-slate-400 block mb-1">تاريخ الفاتورة الأصلي:</span>
                      <strong className="text-sm font-bold text-blue-300 block">
                        {rawDate}
                      </strong>
                    </div>

                    <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/50">
                      <span className="text-slate-400 block mb-1">رقم الفاتورة:</span>
                      <strong className="text-sm font-bold text-slate-200 block">
                        {rawInvoiceNo}
                      </strong>
                    </div>

                    <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/50">
                      <span className="text-slate-400 block mb-1">اسم العميل الأصلي:</span>
                      <strong className="text-sm font-bold text-slate-200 block truncate" title={rawCustomer}>
                        {rawCustomer}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* DISCREPANCY COMPARISON BADGES */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
                  <span className="text-xs font-bold text-slate-500 block mb-2">حالة المطابقة بين الفاتورة والسند:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      amountMatches 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      <span>مبلغ السند</span>
                      <span className="flex items-center gap-1">
                        {amountMatches ? <Check size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className="text-rose-600" />}
                        {amountMatches ? 'مطابق' : 'تضارب'}
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      dateMatches 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      <span>تاريخ السند</span>
                      <span className="flex items-center gap-1">
                        {dateMatches ? <Check size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className="text-rose-600" />}
                        {dateMatches ? 'مطابق' : 'تضارب'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* EDITABLE RECEIPT FORM FIELDS */}
                <form id="side-drawer-form" onSubmit={handleSaveEdit} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
                  <h4 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between">
                    <span>حقول السند القابلة للتعديل</span>
                    <span className="text-xs text-slate-400 font-normal">يمكن التعديل والتدقيق يدوياً</span>
                  </h4>

                  <div className="space-y-4">
                    {/* Amount Input with Quick Sync Button */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-bold text-slate-700">مبلغ السند (ر.س)</label>
                        {!amountMatches && (
                          <button
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, amount: rawTotal })}
                            className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-md transition-colors flex items-center gap-1"
                          >
                            <RefreshCw size={12} />
                            نسخ مبلغ الفاتورة ({rawTotal.toLocaleString('ar-SA')})
                          </button>
                        )}
                      </div>
                      <input 
                        type="number"
                        step="any"
                        required
                        value={editFormData.amount}
                        onChange={(e) => setEditFormData({ ...editFormData, amount: parseFloat(e.target.value) || 0 })}
                        className={`w-full px-4 py-3 border rounded-xl outline-none font-black text-lg transition-all ${
                          !amountMatches 
                            ? 'bg-rose-50/50 border-rose-300 text-rose-900 focus:ring-2 focus:ring-rose-500' 
                            : 'bg-blue-50/50 border-blue-200 text-blue-900 focus:ring-2 focus:ring-blue-500'
                        }`}
                      />
                    </div>

                    {/* Date Input with Quick Sync Button */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-bold text-slate-700">تاريخ السند</label>
                        {!dateMatches && (
                          <button
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, date: rawDate })}
                            className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-md transition-colors flex items-center gap-1"
                          >
                            <RefreshCw size={12} />
                            نسخ تاريخ الفاتورة ({rawDate})
                          </button>
                        )}
                      </div>
                      <input 
                        type="text"
                        required
                        value={editFormData.date}
                        onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                        className={`w-full px-4 py-3 border rounded-xl outline-none font-bold text-sm transition-all ${
                          !dateMatches 
                            ? 'bg-rose-50/50 border-rose-300 text-rose-900 focus:ring-2 focus:ring-rose-500' 
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500'
                        }`}
                      />
                    </div>

                    {/* Customer Name Input */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-bold text-slate-700">اسم العميل / المشتري</label>
                        {!customerMatches && (
                          <button
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, customerName: rawCustomer })}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md transition-colors"
                          >
                            استخدام الاسم الأصلي
                          </button>
                        )}
                      </div>
                      <input 
                        type="text"
                        required
                        value={editFormData.customerName}
                        onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                      />
                    </div>

                    {/* Invoice No and Payment Method Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">رقم الفاتورة المرتبطة</label>
                        <input 
                          type="text"
                          required
                          value={editFormData.invoiceNo}
                          onChange={(e) => setEditFormData({ ...editFormData, invoiceNo: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">طريقة الدفع</label>
                        <select 
                          value={editFormData.paymentMethod}
                          onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value as any })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                        >
                          <option value="نقداً">نقداً</option>
                          <option value="تحويل بنكي">تحويل بنكي</option>
                          <option value="شيك">شيك</option>
                        </select>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">البيان / ملاحظات السند</label>
                      <textarea 
                        value={editFormData.notes}
                        onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none font-bold text-xs"
                      />
                    </div>
                  </div>
                </form>

              </div>

              {/* Drawer Sticky Footer */}
              <div className="p-5 bg-white border-t border-slate-200 shrink-0 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  form="side-drawer-form"
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  <Check size={18} />
                  <span>اعتماد وحفظ السند المطابق</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleApplyAllRawInvoiceData();
                  }}
                  className="py-3 px-4 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold rounded-xl transition-all text-xs flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={16} />
                  <span>تطبيق كافة قيم الفاتورة</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setEditingReceipt(null); setEditFormData(null); }}
                  className="py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all text-xs"
                >
                  إلغاء
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-3 text-blue-700">
          <FileText size={20} />
          <span className="font-bold">إجمالي الدفعة:</span>
          <span className="text-xl font-black">
            {receipts.reduce((sum, r) => sum + r.amount, 0).toLocaleString('ar-SA')} ر.س
          </span>
        </div>
        <button 
          onClick={handleExportAllAsPdf}
          disabled={isExportingAll}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          {isExportingAll ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
          <span>تصدير كافة السندات (PDF A4)</span>
        </button>
      </div>
    </div>
  );
}
