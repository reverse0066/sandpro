/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Search, Trash2, Eye, Calendar, User, FileText, ChevronLeft, Share2, Archive, Loader2, Edit3, Check, X, Printer, Download } from 'lucide-react';
import { Receipt, OrganizationSettings, User as UserType } from '../types';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { safeHtml2canvas } from '../utils/html2canvasFix';
import { PrintErrorBoundary } from './PrintErrorBoundary';
import { ModernTemplate, LuxuryTemplate, MinimalTemplate, DaftraTemplate, ProfessionalTemplate } from './ReceiptTemplates';

interface ReceiptHistoryProps {
  history: Receipt[];
  settings: OrganizationSettings;
  currentUser?: UserType;
  onViewReceipt: (receipt: Receipt) => void;
  onDeleteReceipt: (id: string) => void;
  onDeleteAll: () => void;
  onUpdateReceipt: (receipt: Receipt) => void;
  onClose: () => void;
}

export default function ReceiptHistory({ 
  history, 
  settings, 
  currentUser, 
  onViewReceipt, 
  onDeleteReceipt, 
  onDeleteAll,
  onUpdateReceipt, 
  onClose 
}: ReceiptHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const exportRef = useRef<HTMLDivElement>(null);
  const [currentExportReceipt, setCurrentExportReceipt] = useState<Receipt | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [editFormData, setEditFormData] = useState<Receipt | null>(null);
  const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null);
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);

  const filteredHistory = history.filter(r => {
    if (!r) return false;
    const customer = (r.customerName || '').toLowerCase();
    const receiptNo = (r.receiptNo || '').toLowerCase();
    const invoiceNo = (r.invoiceNo || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return customer.includes(term) || receiptNo.includes(term) || invoiceNo.includes(term);
  });

  const handleDelete = (receipt: Receipt) => {
    if (currentUser && currentUser.permissions && !currentUser.permissions.deleteReceipt) {
      alert('عذراً، ليس لديك صلاحية حذف السندات.');
      return;
    }
    setReceiptToDelete(receipt);
  };

  const confirmDelete = () => {
    if (receiptToDelete) {
      const identifier = receiptToDelete.id || receiptToDelete.receiptNo || receiptToDelete.invoiceNo;
      if (identifier) {
        onDeleteReceipt(identifier);
      }
      setReceiptToDelete(null);
    }
  };

  const handleClearAll = () => {
    if (currentUser && currentUser.permissions && !currentUser.permissions.deleteReceipt) {
      alert('عذراً، ليس لديك صلاحية حذف السندات.');
      return;
    }
    setIsDeleteAllConfirmOpen(true);
  };

  const confirmDeleteAll = () => {
    onDeleteAll();
    setIsDeleteAllConfirmOpen(false);
  };

  const handleExportAllAsZip = async () => {
    if (history.length === 0) return;
    setIsExporting(true);
    setExportProgress(0);
    const zip = new JSZip();

    try {
      await document.fonts.ready;
      
      for (let i = 0; i < history.length; i++) {
        try {
          const receipt = history[i];
          setCurrentExportReceipt(receipt);
          setExportProgress(Math.round(((i + 1) / history.length) * 100));

          // Wait for state update and render
          await new Promise(resolve => setTimeout(resolve, 400));

          if (exportRef.current) {
            const canvas = await safeHtml2canvas(exportRef.current, {
              scale: 2.0,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff',
              onclone: (clonedDoc) => {
                const el = clonedDoc.body.querySelector('.receipt-container');
                if (el instanceof HTMLElement) {
                  el.setAttribute('dir', 'rtl');
                  el.style.fontFamily = "'Cairo', sans-serif";
                  
                  // Ensure stable layout for capture
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
              compress: true
            });
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            
            const pdfBlob = pdf.output('blob');
            zip.file(`receipt-${receipt.receiptNo || i + 1}.pdf`, pdfBlob);
          }
        } catch (itemErr) {
          console.error('Error exporting ZIP item:', itemErr);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `receipts-archive-${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
    } catch (error) {
      console.error('Error creating ZIP:', error);
      alert('حدث خطأ أثناء تصدير الملفات. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setCurrentExportReceipt(null);
    }
  };

  const renderCurrentTemplate = () => {
    if (!currentExportReceipt) return null;
    const props = { receipt: currentExportReceipt, settings };
    switch (settings.preferredTemplate) {
      case 'modern': return <ModernTemplate {...props} />;
      case 'luxury': return <LuxuryTemplate {...props} />;
      case 'minimal': return <MinimalTemplate {...props} />;
      case 'daftra': return <DaftraTemplate {...props} />;
      case 'professional': return <ProfessionalTemplate {...props} />;
      default: return <ModernTemplate {...props} />;
    }
  };

  const handleShare = async (receipt: Receipt) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `سند قبض رقم ${receipt.receiptNo}`,
          text: `تفاصيل السند:\nرقم السند: ${receipt.receiptNo}\nالعميل: ${receipt.customerName}\nالمبلغ: ${receipt.amount.toLocaleString('ar-SA')} ر.س`,
          url: window.location.href,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    } else {
      // Fallback: Copy to clipboard
      const text = `سند قبض رقم ${receipt.receiptNo}\nالعميل: ${receipt.customerName}\nالمبلغ: ${receipt.amount.toLocaleString('ar-SA')} ر.س`;
      navigator.clipboard.writeText(text);
      alert('تم نسخ تفاصيل السند للمشاركة');
    }
  };

  const handleDirectPrint = async (receipt: Receipt) => {
    setCurrentExportReceipt(receipt);
    await new Promise(resolve => setTimeout(resolve, 300));
    window.print();
    setCurrentExportReceipt(null);
  };

  const handleExportSinglePDF = async (receipt: Receipt) => {
    setIsExporting(true);
    setExportProgress(10);
    
    try {
      setCurrentExportReceipt(receipt);
      // Wait for fonts and for React to render the template in the hidden div
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 500));

      if (exportRef.current) {
        setExportProgress(40);
        const canvas = await safeHtml2canvas(exportRef.current, {
          scale: 2.0,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            const el = clonedDoc.body.querySelector('.receipt-container') as HTMLElement;
            if (el) {
              el.setAttribute('dir', 'rtl');
              el.style.width = '210mm';
              el.style.minHeight = '297mm';
              el.style.padding = '20mm';
              el.style.margin = '0';
              el.style.backgroundColor = '#ffffff';
              
              // Force stability
              const all = el.querySelectorAll('*');
              all.forEach(n => {
                if (n instanceof HTMLElement) {
                  n.style.transition = 'none';
                  n.style.animation = 'none';
                }
              });
            }
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (!canvas || canvas.width === 0) {
          throw new Error('Canvas generation failed');
        }

        setExportProgress(80);
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: 'a4',
          compress: true
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        
        pdf.save(`receipt-${receipt.receiptNo || 'export'}.pdf`);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('حدث خطأ أثناء تصدير ملف PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setCurrentExportReceipt(null);
    }
  };

  const startEditing = (receipt: Receipt) => {
    setEditingReceipt(receipt);
    setEditFormData({ ...receipt });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editFormData) {
      onUpdateReceipt(editFormData);
      setEditingReceipt(null);
      setEditFormData(null);
    }
  };

  const handleExportAsCsv = () => {
    if (history.length === 0) return;
    const headers = ['رقم السند', 'التاريخ', 'رقم الفاتورة', 'اسم العميل', 'المبلغ الإجمالي (ر.س)', 'طريقة الدفع', 'البيان'];
    const rows = history.map(r => [
      r.receiptNo,
      r.date,
      r.invoiceNo,
      `"${(r.customerName || '').replace(/"/g, '""')}"`,
      r.amount,
      r.paymentMethod,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `receipts-financial-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAsPdfReport = () => {
    if (history.length === 0) return;
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(settings.name || 'تقرير السندات المالية', 105, 20, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`, 105, 28, { align: 'center' });

      const tableColumn = ['رقم السند', 'التاريخ', 'رقم الفاتورة', 'اسم العميل', 'المبلغ (ر.س)', 'طريقة الدفع'];
      const tableRows = history.map(r => [
        r.receiptNo || '-',
        r.date || '-',
        r.invoiceNo || '-',
        r.customerName || '-',
        String(r.amount || 0),
        r.paymentMethod || '-'
      ]);

      (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        styles: { fontSize: 9, halign: 'right' },
        headStyles: { fillColor: [37, 99, 235], halign: 'right' },
      });

      doc.save(`receipts-report-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error exporting PDF report:', err);
      alert('حدث خطأ أثناء تصدير تقرير الـ PDF.');
    }
  };

  const totalAmountSum = history.reduce((acc, r) => acc + (r.amount || 0), 0);
  const totalVatSum = totalAmountSum * 0.15;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-900">سجل السندات والتقارير المالية</h2>
          <p className="text-slate-500 text-sm">عرض وإدارة كافة السندات الصادرة وتصدير التقارير المحاسبية</p>
        </div>
        
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
              <button 
                onClick={handleExportAsCsv}
                disabled={history.length === 0}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-sm hover:bg-emerald-700 transition-all disabled:opacity-50"
                title="تصدير ملف Excel / CSV"
              >
                <span>📊 تصدير Excel</span>
              </button>
              <button 
                onClick={handleExportAsPdfReport}
                disabled={history.length === 0}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50"
                title="تصدير تقرير السندات PDF"
              >
                <span>📄 تقرير PDF</span>
              </button>
              <button 
                onClick={handleExportAllAsZip}
                disabled={isExporting || history.length === 0}
                className="flex items-center gap-2 px-3 py-2 text-slate-600 rounded-lg font-bold text-xs hover:text-slate-900 transition-all disabled:opacity-50"
              >
                <Archive size={14} />
                ZIP
              </button>
              
              {history.length > 0 && (
                <button 
                  onClick={handleClearAll}
                  className="flex items-center gap-2 px-3 py-2 text-red-500 rounded-lg font-bold text-xs hover:bg-red-50 transition-all"
                  title="مسح كافة السجلات"
                >
                  <Trash2 size={14} />
                  مسح السجل
                </button>
              )}
            </div>
            
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="بحث باسم العميل..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-48 transition-all text-sm"
              />
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
              title="إغلاق"
            >
              <ChevronLeft size={24} />
            </button>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5 rounded-2xl shadow-sm">
            <p className="text-blue-100 text-xs font-bold mb-1">إجمالي المبالغ المحصلة</p>
            <h3 className="text-2xl font-black">{totalAmountSum.toLocaleString('ar-SA')} <span className="text-sm font-normal">ر.س</span></h3>
          </div>
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-5 rounded-2xl shadow-sm">
            <p className="text-emerald-100 text-xs font-bold mb-1">إجمالي ضريبة القيمة المضافة (15% تقديرية)</p>
            <h3 className="text-2xl font-black">{totalVatSum.toLocaleString('ar-SA')} <span className="text-sm font-normal">ر.س</span></h3>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-bold mb-1">إجمالي السندات المصدرة</p>
              <h3 className="text-2xl font-black text-slate-900">{history.length} <span className="text-sm font-normal text-slate-500">سند</span></h3>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-bold">
              📑
            </div>
          </div>
        </div>

        {/* Hidden Container for PDF Export */}
        <div className="fixed -left-[9999px] top-0 pointer-events-none z-[99999] bg-white">
          <div ref={exportRef} className="bg-white w-[210mm] receipt-container">
            <PrintErrorBoundary>
              <div className="p-10">
                {renderCurrentTemplate()}
              </div>
            </PrintErrorBoundary>
          </div>
        </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredHistory.length > 0 ? (
          filteredHistory.map((receipt) => {
            if (!receipt) return null;
            const safeReceiptNo = String(receipt.receiptNo || '00');
            const safeInvoiceNo = String(receipt.invoiceNo || '---');
            const safeCustomer = String(receipt.customerName || 'عميل غير معروف');
            const safeDate = String(receipt.date || '');
            const safeAmount = Number(receipt.amount || 0);

            return (
              <div 
                key={receipt.id}
                className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-lg">
                    {safeReceiptNo.slice(-2)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">سند رقم: {safeReceiptNo}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">#{safeInvoiceNo}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span className="flex items-center gap-1"><User size={14} /> {safeCustomer}</span>
                      <span className="flex items-center gap-1"><Calendar size={14} /> {safeDate}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-8 border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">المبلغ</p>
                    <p className="text-xl font-black text-emerald-600">{safeAmount.toLocaleString('ar-SA')} ر.س</p>
                  </div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleExportSinglePDF(receipt)}
                    disabled={isExporting}
                    className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-50"
                    title="تحميل PDF"
                  >
                    {isExporting && currentExportReceipt?.id === receipt.id ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Download size={20} />
                    )}
                  </button>
                  <button 
                    onClick={() => handleDirectPrint(receipt)}
                    className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                    title="طباعة مباشرة"
                  >
                    <Printer size={20} />
                  </button>
                  <button 
                    onClick={() => handleShare(receipt)}
                    className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                    title="مشاركة"
                  >
                    <Share2 size={20} />
                  </button>
                  <button 
                    onClick={() => startEditing(receipt)}
                    className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title="تعديل"
                  >
                    <Edit3 size={20} />
                  </button>
                  <button 
                    onClick={() => onViewReceipt(receipt)}
                    className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title="عرض وتصدير"
                  >
                    <Eye size={20} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleDelete(receipt)}
                    className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                    title="حذف من السجل"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
            );
          })
        ) : (
          <div className="bg-white rounded-[2rem] p-20 border-2 border-dashed border-slate-100 flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
              <FileText size={40} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">لا توجد سندات محفوظة</h3>
              <p className="text-slate-500">ابدأ بإصدار سندات جديدة لتظهر هنا في السجل</p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingReceipt && editFormData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900">تعديل السند</h3>
                <p className="text-slate-500 text-sm">تعديل بيانات السند رقم {editingReceipt.receiptNo}</p>
              </div>
              <button 
                onClick={() => setEditingReceipt(null)}
                className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-900 transition-all shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">اسم العميل</label>
                  <input 
                    type="text"
                    value={editFormData.customerName}
                    onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">المبلغ</label>
                    <input 
                      type="number"
                      value={editFormData.amount}
                      onChange={(e) => setEditFormData({ ...editFormData, amount: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">طريقة الدفع</label>
                    <select 
                      value={editFormData.paymentMethod}
                      onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option value="نقداً">نقداً</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                      <option value="شيك">شيك</option>
                      <option value="شبكة">شبكة</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">ملاحظات</label>
                  <textarea 
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Check size={20} />
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingReceipt(null)}
                  className="px-8 py-4 bg-white text-slate-600 border border-slate-200 font-bold rounded-2xl hover:bg-slate-50 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Single Receipt Confirmation Modal */}
      {receiptToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
              ⚠️
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900">تأكيد حذف السند</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                هل أنت متأكد من رغبتك في حذف السند رقم <span className="font-bold text-slate-900">{receiptToDelete.receiptNo}</span> للعميل <span className="font-bold text-slate-900">{receiptToDelete.customerName}</span> نهائياً من قاعدة البيانات المحلية؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-200 hover:bg-red-700 transition-all active:scale-95"
              >
                نعم، حذف نهائي
              </button>
              <button
                type="button"
                onClick={() => setReceiptToDelete(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Records Confirmation Modal */}
      {isDeleteAllConfirmOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
              🗑️
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900">تأكيد مسح كافة السجلات</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                تحذير: سيتم حذف جميع السندات والأرشيف المالي المحفوظ محلياً نهائياً. لا يمكن التراجع عن هذه الخطوة.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={confirmDeleteAll}
                className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-200 hover:bg-red-700 transition-all active:scale-95"
              >
                نعم، مسح الكل
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteAllConfirmOpen(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
