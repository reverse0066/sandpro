/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, FileText, CheckCircle2, AlertCircle, PlusCircle } from 'lucide-react';
import { mockInvoices } from '../data';
import { Invoice, Receipt } from '../types';

interface InvoiceSearchProps {
  onGenerateReceipt: (receipt: Receipt) => void;
}

export default function InvoiceSearch({ onGenerateReceipt }: InvoiceSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(() => {
    let allInvoices: Invoice[] = [...mockInvoices];
    try {
      const savedHistory = localStorage.getItem('receipt_history');
      if (savedHistory) {
        const receipts: Receipt[] = JSON.parse(savedHistory);
        receipts.forEach(r => {
          if (!allInvoices.some(inv => inv.invoiceNo === r.invoiceNo)) {
            allInvoices.push({
              id: r.id,
              invoiceNo: r.invoiceNo,
              date: r.date,
              customerName: r.customerName,
              customerNo: '186',
              vatNo: '314093276600003',
              totalAmount: r.amount / 1.15,
              totalVat: r.amount - (r.amount / 1.15),
              totalWithVat: r.amount,
              status: 'pending'
            });
          }
        });
      }
    } catch (e) {}
    return allInvoices[0] || null;
  });
  const [isSearching, setIsSearching] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Manual invoice form state
  const [manualInvoiceNo, setManualInvoiceNo] = useState('INV-' + Math.floor(1000 + Math.random() * 9000));
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualAmount, setManualAmount] = useState('1150');

  const getAllInvoices = (): Invoice[] => {
    let allInvoices: Invoice[] = [...mockInvoices];
    try {
      const savedHistory = localStorage.getItem('receipt_history');
      if (savedHistory) {
        const receipts: Receipt[] = JSON.parse(savedHistory);
        receipts.forEach(r => {
          if (!allInvoices.some(inv => inv.invoiceNo === r.invoiceNo)) {
            allInvoices.push({
              id: r.id,
              invoiceNo: r.invoiceNo,
              date: r.date,
              customerName: r.customerName,
              customerNo: '186',
              vatNo: '314093276600003',
              totalAmount: r.amount / 1.15,
              totalVat: r.amount - (r.amount / 1.15),
              totalWithVat: r.amount,
              status: 'pending'
            });
          }
        });
      }
    } catch (e) {}
    return allInvoices;
  };

  const handleSearch = (overrideTerm?: string) => {
    const term = (overrideTerm !== undefined ? overrideTerm : searchTerm).trim().toLowerCase();
    
    setIsSearching(true);
    setTimeout(() => {
      const allInvoices = getAllInvoices();
      if (!term) {
        // If empty search, select the first default invoice or show error/prompt
        if (allInvoices.length > 0) {
          setSelectedInvoice(allInvoices[0]);
        }
        setIsSearching(false);
        return;
      }

      const found = allInvoices.find(inv => 
        inv.invoiceNo.toLowerCase().includes(term) || 
        inv.customerName.toLowerCase().includes(term)
      );

      setSelectedInvoice(found || null);
      setIsSearching(false);
    }, 200);
  };

  const handleSelectQuick = (invNo: string) => {
    setSearchTerm(invNo);
    handleSearch(invNo);
  };

  const handleCreateManualInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCustomerName.trim() || !manualAmount) return;

    const amt = parseFloat(manualAmount) || 1150;
    const newInv: Invoice = {
      id: 'inv-manual-' + Date.now(),
      invoiceNo: manualInvoiceNo.trim() || 'INV-' + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toISOString().split('T')[0],
      customerName: manualCustomerName.trim(),
      customerNo: '186',
      vatNo: '314093276600003',
      totalAmount: amt / 1.15,
      totalVat: amt - (amt / 1.15),
      totalWithVat: amt,
      status: 'pending'
    };

    setSelectedInvoice(newInv);
    setShowManualModal(false);
  };

  const [formData, setFormData] = useState({
    receiptNo: (Math.floor(Math.random() * 1000) + 2000).toString(),
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'نقداً' as Receipt['paymentMethod'],
    referenceNo: '',
    notes: 'سند قبض لفاتورة مبيعات',
  });

  React.useEffect(() => {
    if (selectedInvoice) {
      setFormData(prev => ({
        ...prev,
        date: selectedInvoice.date ? selectedInvoice.date.replace(/\//g, '-') : new Date().toISOString().split('T')[0],
        notes: `سند قبض آلي للفاتورة رقم ${selectedInvoice.invoiceNo}`
      }));
    }
  }, [selectedInvoice]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const receiptDate = (formData.date || selectedInvoice.date || new Date().toISOString().split('T')[0]).replace(/-/g, '/');

    const newReceipt: Receipt = {
      id: 'rcpt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
      receiptNo: formData.receiptNo,
      date: receiptDate,
      invoiceNo: selectedInvoice.invoiceNo,
      customerName: selectedInvoice.customerName,
      amount: selectedInvoice.totalWithVat,
      paymentMethod: formData.paymentMethod,
      referenceNo: formData.referenceNo,
      receivedFrom: selectedInvoice.customerName,
      notes: formData.notes,
      matchStatus: 'matched',
      invoiceTotalWithVat: selectedInvoice.totalWithVat
    };

    onGenerateReceipt(newReceipt);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Search Bar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-bold text-slate-800">بحث برقم الفاتورة أو اسم العميل</label>
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-colors"
          >
            <PlusCircle size={15} />
            <span>إدخال فاتورة يدوياً</span>
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="مثال: 1913 أو اسم العميل"
              className="block w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-slate-900 font-bold"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={isSearching}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-colors disabled:opacity-50 shadow-md shadow-blue-500/20 active:scale-95"
          >
            {isSearching ? 'جاري البحث...' : 'بحث'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 font-medium">فواتير سريعة للاختبار:</span>
          {['1913', '1984', '2091'].map(invNo => (
            <button
              key={invNo}
              type="button"
              onClick={() => handleSelectQuick(invNo)}
              className="px-3 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-bold rounded-lg transition-colors border border-slate-200/80"
            >
              فاتورة #{invNo}
            </button>
          ))}
        </div>
      </div>

      {/* Manual Invoice Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleCreateManualInvoice} className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">إنشاء / إدخال فاتورة يدوية جديدة</h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">رقم الفاتورة</label>
              <input
                type="text"
                required
                value={manualInvoiceNo}
                onChange={e => setManualInvoiceNo(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">اسم العميل</label>
              <input
                type="text"
                required
                placeholder="مثال: شركة الأفق للتقنية"
                value={manualCustomerName}
                onChange={e => setManualCustomerName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">إجمالي المبلغ (شامل الضريبة ر.س)</label>
              <input
                type="number"
                required
                value={manualAmount}
                onChange={e => setManualAmount(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white font-black text-xs rounded-xl shadow-md"
              >
                اعتماد الفاتورة ومتابعة السند
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedInvoice ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Invoice Summary */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 text-blue-600">
              <FileText size={24} />
              <h2 className="text-lg font-bold">تفاصيل الفاتورة</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">رقم الفاتورة</p>
                <p className="font-bold text-slate-900">{selectedInvoice.invoiceNo}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">تاريخ الفاتورة</p>
                <p className="font-bold text-slate-900">{selectedInvoice.date}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl col-span-2">
                <p className="text-xs text-slate-500 mb-1">اسم العميل</p>
                <p className="font-bold text-slate-900">{selectedInvoice.customerName}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl col-span-2">
                <p className="text-xs text-blue-600 mb-1">إجمالي المبلغ المستحق (شامل الضريبة)</p>
                <p className="text-2xl font-black text-blue-900">
                  {selectedInvoice.totalWithVat.toLocaleString('ar-SA')} ر.س
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold">
              <CheckCircle2 size={16} />
              الفاتورة جاهزة لإصدار سند القبض
            </div>
          </div>

          {/* Receipt Form */}
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
            <h2 className="text-lg font-bold text-slate-900 mb-4">إنشاء سند قبض جديد</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">رقم السند</label>
                <input
                  type="text"
                  required
                  value={formData.receiptNo}
                  onChange={e => setFormData({...formData, receiptNo: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">تاريخ السند</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">طريقة الدفع</label>
              <div className="grid grid-cols-3 gap-2">
                {(['نقداً', 'شيك', 'تحويل بنكي'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setFormData({...formData, paymentMethod: method})}
                    className={`py-2 px-3 text-sm rounded-lg border transition-all font-bold ${
                      formData.paymentMethod === method
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">رقم المرجع / الشيك (اختياري)</label>
              <input
                type="text"
                value={formData.referenceNo}
                onChange={e => setFormData({...formData, referenceNo: e.target.value})}
                placeholder="مثال: 0098234"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">ملاحظات السند</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none font-bold"
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-95"
            >
              إصدار سند القبض
            </button>
          </form>
        </div>
      ) : searchTerm && !isSearching ? (
        <div className="bg-orange-50 border border-orange-100 p-8 rounded-2xl text-center space-y-3 animate-in zoom-in duration-300">
          <AlertCircle className="mx-auto h-12 w-12 text-orange-400" />
          <h3 className="text-lg font-bold text-orange-900">لم يتم العثور على الفاتورة</h3>
          <p className="text-orange-700 text-xs">تأكد من رقم الفاتورة المدخل أو استخدم زر "إدخال فاتورة يدوياً" أعلاه.</p>
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="px-5 py-2.5 bg-orange-600 text-white font-bold text-xs rounded-xl shadow-md"
          >
            إدخال الفاتورة يدوياً الآن
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-200 p-12 rounded-2xl text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-sm text-slate-300">
            <FileText size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-slate-700 font-bold">ابدأ بالبحث عن فاتورة أو اختر من الفواتير السريعة</h3>
            <p className="text-slate-400 text-sm">أدخل رقم الفاتورة في خانة البحث أعلاه أو اضغط على الفواتير السريعة لعرض التفاصيل</p>
          </div>
        </div>
      )}
    </div>
  );
}

