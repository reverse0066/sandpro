/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileType, CheckCircle2, Loader2, AlertCircle, AlertTriangle, Trash2, Sparkles, ArrowRight, Zap, X } from 'lucide-react';
import { Invoice } from '../types';
import { parseAmountNumber } from '../utils/numberUtils';

interface InvoiceUploaderProps {
  onInvoicesExtracted: (invoices: Invoice[]) => void;
}

interface FileItem {
  id: string;
  file: File;
  status: 'idle' | 'processing' | 'done' | 'error';
  errorMsg?: string;
  invoices?: Invoice[];
}

export default function InvoiceUploader({ onInvoicesExtracted }: InvoiceUploaderProps) {
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [isMasterProcessing, setIsMasterProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [quotaErrorMsg, setQuotaErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to read file as base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res.includes(',') ? res.split(',')[1] : res);
      };
      reader.onerror = () => reject(new Error('فشل في قراءة ملف: ' + file.name));
      reader.readAsDataURL(file);
    });
  };

  // Process a single file through the API
  const extractInvoiceData = async (fileItem: FileItem): Promise<Invoice[] | null> => {
    try {
      const base64Data = await readFileAsBase64(fileItem.file);
      
      const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: fileItem.file.type,
          fileName: fileItem.file.name
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `خطأ في المعالجة (${response.status})`);
      }

      const data = await response.json();
      const rawResults = Array.isArray(data) ? data : [data];

      return rawResults.map((inv: any, idx: number) => {
        const parsedTotalWithVat = parseAmountNumber(inv.totalWithVat);
        const parsedTotalAmount = parseAmountNumber(inv.totalAmount);

        const finalTotalWithVat = parsedTotalWithVat > 0 
          ? parsedTotalWithVat 
          : (parsedTotalAmount > 0 ? parsedTotalAmount * 1.15 : 0);

        const finalTotalAmount = parsedTotalAmount > 0 
          ? parsedTotalAmount 
          : (finalTotalWithVat / 1.15);

        const finalTotalVat = finalTotalWithVat - finalTotalAmount;

        return {
          id: `inv-${Date.now()}-${fileItem.id}-${idx}`,
          invoiceNo: String(inv.invoiceNo || `INV-${Math.floor(Math.random() * 9000) + 1000}`).trim(),
          date: inv.date || new Date().toISOString().split('T')[0],
          customerName: String(inv.customerName || 'عميل نقدي').trim(),
          customerNo: '186',
          vatNo: String(inv.vatNo || '300000000000003').trim(),
          totalAmount: finalTotalAmount,
          totalVat: finalTotalVat,
          totalWithVat: finalTotalWithVat,
          status: 'pending' as const
        };
      });
    } catch (error: any) {
      console.error('Extraction error for file:', fileItem.file.name, error);
      throw error;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files) as File[];
      const newFiles: FileItem[] = selectedFiles.map(file => ({
        id: Math.random().toString(36).substring(2, 11),
        file,
        status: 'idle'
      }));
      setFileList(prev => [...prev, ...newFiles]);
      e.target.value = '';
    }
  };

  const removeFile = (id: string) => {
    setFileList(prev => prev.filter(f => f.id !== id));
  };

  const clearAllFiles = () => {
    setFileList([]);
  };

  // The main function requested by the user
  const handleProcessAll = async () => {
    if (fileList.length === 0 || isMasterProcessing) return;
    
    setIsMasterProcessing(true);
    setProgress({ current: 0, total: fileList.length });

    const results: Invoice[] = [];
    const filesToProcess = [...fileList];

    try {
      // Process one by one for maximum reliability and to avoid rate limits
      for (let i = 0; i < filesToProcess.length; i++) {
        const item = filesToProcess[i];
        
        if (item.status === 'done' && item.invoices) {
          results.push(...item.invoices);
          setProgress(prev => ({ ...prev, current: i + 1 }));
          continue;
        }

        // Update UI to show processing
        setFileList(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing', errorMsg: undefined } : f));
        
        try {
          const base64Data = await readFileAsBase64(item.file);
          let response: Response | null = null;
          let attempts = 0;
          const maxAttempts = 3;

          while (attempts < maxAttempts) {
            attempts++;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000); // 300s (5 minutes) timeout

            try {
              response = await fetch('/api/extract-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileData: base64Data,
                  mimeType: item.file.type,
                  fileName: item.file.name
                }),
                signal: controller.signal
              });

              clearTimeout(timeoutId);

              if (response.ok) {
                break;
              }

              if ((response.status === 503 || response.status === 429) && attempts < maxAttempts) {
                console.log(`[InvoiceUploader] Got status ${response.status}, retrying attempt ${attempts + 1}/${maxAttempts} in 2.5s...`);
                setFileList(prev => prev.map(f => f.id === item.id ? { 
                  ...f, 
                  status: 'processing', 
                  errorMsg: `النموذج قيد الضغط المؤقت (503)... إعادة محاولة تلقائية (${attempts}/${maxAttempts})` 
                } : f));
                await new Promise(res => setTimeout(res, 2500));
                continue;
              }

              const errData = await response.json().catch(() => ({}));
              let rawErr = errData.error || `خطأ الخادم (${response.status})`;
              if (typeof rawErr === 'object') {
                rawErr = JSON.stringify(rawErr);
              }
              throw new Error(rawErr);
            } catch (fetchErr: any) {
              clearTimeout(timeoutId);
              if (attempts < maxAttempts && (fetchErr.message?.includes('503') || fetchErr.message?.includes('high demand'))) {
                await new Promise(res => setTimeout(res, 2500));
                continue;
              }
              throw fetchErr;
            }
          }

          if (!response || !response.ok) {
            throw new Error('فشلت معالجة الفاتورة من الخادم بعد عدة محاولات.');
          }

          const data = await response.json();
          const rawResults = Array.isArray(data) ? data : [data];

          const extractedInvoices = rawResults.map((inv: any, idx: number) => {
            const parsedTotalWithVat = parseAmountNumber(inv.totalWithVat);
            const parsedTotalAmount = parseAmountNumber(inv.totalAmount);

            const finalTotalWithVat = parsedTotalWithVat > 0 
              ? parsedTotalWithVat 
              : (parsedTotalAmount > 0 ? parsedTotalAmount * 1.15 : 0);

            const finalTotalAmount = parsedTotalAmount > 0 
              ? parsedTotalAmount 
              : (finalTotalWithVat / 1.15);

            const finalTotalVat = finalTotalWithVat - finalTotalAmount;

            return {
              id: `inv-${Date.now()}-${item.id}-${idx}`,
              invoiceNo: String(inv.invoiceNo || `INV-${Math.floor(Math.random() * 9000) + 1000}`).trim(),
              date: inv.date || new Date().toISOString().split('T')[0],
              customerName: String(inv.customerName || 'عميل نقدي').trim(),
              customerNo: '186',
              vatNo: String(inv.vatNo || '300000000000003').trim(),
              totalAmount: finalTotalAmount,
              totalVat: finalTotalVat,
              totalWithVat: finalTotalWithVat,
              status: 'pending' as const
            };
          });

          results.push(...extractedInvoices);
          setFileList(prev => prev.map(f => f.id === item.id ? { ...f, status: 'done', invoices: extractedInvoices } : f));
        } catch (err: any) {
          const errMsg = (err.name === 'AbortError' || err.message?.includes('aborted')) ? 'انتهت مهلة المعالجة (5 دقائق)' : (err.message || 'فشل الاستخراج');
          console.error(`Error processing file ${item.file.name}:`, err);
          if (errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('حصة') || errMsg.includes('رصيد')) {
            setQuotaErrorMsg('تنبيه: تعذر معالجة المستند بسبب تجاوز حد الاستخدام المسموح به أو نفاد رصيد الذكاء الاصطناعي (Quota Limit Reached / 429). يرجى التحقق من حالة الرصيد في صفحة الإعدادات.');
          }
          setFileList(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', errorMsg: errMsg } : f));
        }
        
        setProgress(prev => ({ ...prev, current: i + 1 }));
      }

      if (results.length > 0) {
        onInvoicesExtracted(results);
      } else {
        alert('لم يتم استخراج أي بيانات صالحة. يرجى التأكد من جودة الملفات المرفوعة.');
      }
    } catch (err: any) {
      console.error('Master extraction process error:', err);
      if (err.message?.includes('429') || err.message?.includes('Quota') || err.message?.includes('حصة') || err.message?.includes('رصيد')) {
        setQuotaErrorMsg('تنبيه: تعذر معالجة المستند بسبب تجاوز حد الاستخدام المسموح به أو نفاد رصيد الذكاء الاصطناعي (Quota Limit Reached / 429).');
      }
      alert(`حدث خطأ أثناء المعالجة: ${err.message}`);
    } finally {
      setIsMasterProcessing(false);
    }
  };

  const handleDemo = () => {
    onInvoicesExtracted([{
      id: `demo-${Date.now()}`,
      invoiceNo: `INV-${Math.floor(Math.random() * 9000) + 1000}`,
      date: new Date().toISOString().split('T')[0],
      customerName: 'شركة تجريبية للأنظمة المتكاملة',
      customerNo: '186',
      vatNo: '300123456700003',
      totalAmount: 1500,
      totalVat: 225,
      totalWithVat: 1725,
      status: 'pending'
    }]);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {quotaErrorMsg && (
        <div className="p-5 bg-rose-50 border-2 border-rose-200 rounded-2xl text-rose-900 shadow-md animate-in fade-in slide-in-from-top-2 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={24} />
            <div className="space-y-1">
              <h4 className="font-black text-sm text-rose-950">تنبيه: تعذر المعالجة بسبب نفاد رصيد/حصة الذكاء الاصطناعي</h4>
              <p className="text-xs text-rose-800 leading-relaxed">{quotaErrorMsg}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-rose-200/60">
            <span className="text-[11px] text-rose-700">يمكنك فحص حالة الرصيد والحجم المتاح في صفحة الإعدادات.</span>
            <button
              type="button"
              onClick={() => setQuotaErrorMsg(null)}
              className="mr-auto px-3 py-1 bg-rose-200 hover:bg-rose-300 text-rose-900 font-bold text-xs rounded-lg transition-all cursor-pointer"
            >
              إغلاق التنبيه
            </button>
          </div>
        </div>
      )}
      {/* Upload Area */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files) as File[];
            const newFiles: FileItem[] = droppedFiles.map(file => ({
              id: Math.random().toString(36).substring(2, 11),
              file,
              status: 'idle'
            }));
            setFileList(prev => [...prev, ...newFiles]);
          }
        }}
        className="border-2 border-dashed border-blue-200 hover:border-blue-500 rounded-[2.5rem] p-12 bg-gradient-to-b from-blue-50/50 to-white flex flex-col items-center justify-center text-center cursor-pointer transition-all shadow-sm hover:shadow-lg group relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Upload size={120} />
        </div>

        <div className="w-20 h-20 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/30 group-hover:scale-105 transition-transform duration-300">
          <Upload size={36} />
        </div>

        <h3 className="text-2xl font-black text-slate-900 mb-2">اسحب وأفلت الفواتير هنا</h3>
        <p className="text-slate-500 max-w-md text-sm mb-8">
          يدعم صور الفواتير (PNG, JPG) وملفات PDF. يتم استخراج البيانات والضرائب ومبالغ السندات آلياً بدقة عالية.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 relative z-10" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg transition-all flex items-center gap-3 active:scale-95"
          >
            <Upload size={20} />
            <span>اختيار الملفات</span>
          </button>

          <button
            type="button"
            onClick={handleDemo}
            className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all flex items-center gap-3 active:scale-95"
          >
            <Sparkles size={22} className="text-amber-500" />
            <span>تجربة فاتورة تجريبية</span>
          </button>
        </div>

        <input 
          type="file" 
          multiple 
          hidden 
          ref={fileInputRef} 
          onChange={handleFileSelect}
          accept="image/*,.pdf"
        />
      </div>

      {/* Selected Files List (The Preview List) */}
      {fileList.length > 0 && (
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-6 duration-700">
          {isMasterProcessing && (
            <div className="px-8 py-4 bg-blue-600/10 border-b border-blue-100 flex items-center gap-4">
              <Loader2 size={20} className="text-blue-600 animate-spin" />
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-500" 
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <span className="text-xs font-black text-blue-700">
                جاري المعالجة... ({progress.current}/{progress.total})
              </span>
            </div>
          )}

          <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex flex-wrap justify-between items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                <FileType size={28} />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-900">قائمة الملفات المختارة</h4>
                <p className="text-slate-500 text-sm font-bold mt-0.5">
                  {fileList.length} ملفات جاهزة للمعالجة الآلية
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={clearAllFiles}
                disabled={isMasterProcessing}
                className="flex items-center gap-2 px-5 py-3 text-red-500 hover:bg-red-50 rounded-2xl font-black transition-all disabled:opacity-30"
              >
                <Trash2 size={20} />
                <span>مسح الكل</span>
              </button>

              <button
                type="button"
                onClick={handleProcessAll}
                disabled={isMasterProcessing}
                className="px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black rounded-[1.5rem] shadow-2xl shadow-blue-500/40 transition-all flex items-center gap-4 active:scale-95 disabled:opacity-50"
              >
                {isMasterProcessing ? (
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    <span>جاري المعالجة ({progress.current}/{progress.total})</span>
                  </>
                ) : (
                  <>
                    <Zap size={24} className="text-amber-300 fill-amber-300" />
                    <span className="text-xl">تأكيد ومعالجة كافة الفواتير</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto custom-scrollbar">
            {fileList.map((item) => (
              <div key={item.id} className="p-6 flex flex-wrap items-center justify-between gap-6 hover:bg-blue-50/30 transition-colors">
                <div className="flex items-center gap-5">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                    item.status === 'done' ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 
                    item.status === 'error' ? 'bg-red-100 text-red-600' : 
                    item.status === 'processing' ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {item.status === 'done' ? <CheckCircle2 size={32} /> : <FileType size={32} />}
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900 max-w-[300px] truncate">{item.file.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-400 font-bold">{(item.file.size / 1024).toFixed(1)} KB</span>
                      <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                      {item.status === 'idle' && <span className="text-xs text-slate-400 font-black">انتظار المعالجة</span>}
                      {item.status === 'processing' && <span className="text-xs text-blue-600 font-black">جاري الاستخراج...</span>}
                      {item.status === 'done' && <span className="text-xs text-emerald-600 font-black">تم الاستخراج</span>}
                      {item.status === 'error' && <span className="text-xs text-red-500 font-black">فشل الاستخراج</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {item.status === 'done' && item.invoices && (
                    <div className="text-left bg-emerald-50 px-5 py-3 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] text-emerald-600 font-black uppercase tracking-wider">البيانات المستخرجة</p>
                      <p className="text-sm font-black text-slate-800">
                        {item.invoices[0].totalWithVat.toLocaleString('ar-SA')} ر.س | {item.invoices[0].customerName}
                      </p>
                    </div>
                  )}

                  {item.status === 'error' && item.errorMsg && (
                    <div className="max-w-[200px] text-right">
                      <p className="text-[10px] text-red-500 font-black uppercase tracking-wider">خطأ في المعالجة</p>
                      <p className="text-xs text-red-600 font-bold truncate" title={item.errorMsg}>{item.errorMsg}</p>
                    </div>
                  )}

                  <button 
                    type="button"
                    disabled={isMasterProcessing}
                    onClick={() => removeFile(item.id)}
                    className="p-4 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all disabled:opacity-20"
                  >
                    <Trash2 size={24} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
