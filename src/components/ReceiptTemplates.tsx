/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Receipt, OrganizationSettings } from '../types';
import { tafqeet } from '../utils/tafqeet';

export const isValidImageSrc = (src?: string | null): boolean => {
  if (!src || typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (trimmed.length < 10) return false;
  return trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('blob:');
};

interface TemplateProps {
  receipt: Receipt;
  settings: OrganizationSettings & { paperSize?: 'a4' | 'a5' };
  signature?: string;
  stamp?: string;
}

const getFontSizeClass = (type: 'h1' | 'h2' | 'p' | 'text' | 'title', size?: 'small' | 'medium' | 'large') => {
  const isSmall = size === 'small';
  const isLarge = size === 'large';
  
  switch(type) {
    case 'title': return isSmall ? 'text-lg' : isLarge ? 'text-3xl' : 'text-2xl';
    case 'h1': return isSmall ? 'text-base' : isLarge ? 'text-2xl' : 'text-xl';
    case 'h2': return isSmall ? 'text-sm' : isLarge ? 'text-xl' : 'text-lg';
    case 'p': return isSmall ? 'text-[13px]' : isLarge ? 'text-[18px]' : 'text-base';
    case 'text': return isSmall ? 'text-[9px]' : isLarge ? 'text-[12px]' : 'text-[11px]';
    default: return 'text-base';
  }
};

// 1. Classic Corporate Template (رسمي كلاسيكي فاخر)
export const ClassicTemplate = ({ receipt, settings, signature, stamp }: TemplateProps) => {
  const primaryColor = settings.accentColor || '#0f172a';
  const size = settings.fontSize || 'medium';
  const isCompact = settings.isCompact;
  const isA5 = settings.paperSize === 'a5';
  
  const minHeight = isA5 ? (isCompact ? '135mm' : '180mm') : (isCompact ? '200mm' : '270mm');

  return (
    <div 
      className={`font-sans bg-white text-slate-900 receipt-container ${isCompact ? 'p-6' : 'p-10'}`} 
      dir="rtl" 
      style={{ minHeight, fontFamily: "'Cairo', Tahoma, sans-serif", boxSizing: 'border-box' }}
    >
      <div className={`border-4 border-solid rounded-xl p-6 h-full flex flex-col`} style={{ borderColor: '#e2e8f0' }}>
      {/* Header */}
      <div className={`flex justify-between items-start border-b-2 ${isCompact ? 'pb-4 mb-4' : 'pb-8 mb-8'}`} style={{ borderColor: primaryColor }}>
        <div className="flex gap-6 items-center">
          {isValidImageSrc(settings.logo) && (
            <img src={settings.logo} alt="Logo" className={`${isCompact ? 'w-20 h-20' : 'w-28 h-28'} object-contain rounded-xl p-1 border border-slate-200 bg-white overflow-hidden print-logo`} />
          )}
          <div className="space-y-1">
            <h1 className={`${getFontSizeClass('title', size)} font-black tracking-tight text-slate-900`} style={{ color: primaryColor }}>{settings.name}</h1>
            <p className={`${getFontSizeClass('text', size)} font-bold text-slate-500`}>الرقم الضريبي: <span className="font-mono">{settings.taxNo}</span></p>
            <p className={`${getFontSizeClass('text', size)} font-bold text-slate-500`}>سجل تجاري: <span className="font-mono">{settings.crNo}</span></p>
            {settings.address && <p className={`${getFontSizeClass('text', size)} text-slate-400 max-w-xs opacity-80`}>{settings.address}</p>}
          </div>
        </div>
        <div className={`text-center text-white rounded-2xl ${isCompact ? 'px-6 py-2' : 'px-8 py-4'}`} style={{ backgroundColor: primaryColor, color: '#ffffff', position: 'relative', zIndex: 1 }}>
          <span className={`${getFontSizeClass('h1', size)} font-black tracking-wider block`} style={{ color: '#ffffff', position: 'relative', zIndex: 10 }}>سند قبض</span>
          <span className={`${getFontSizeClass('text', size)} font-mono tracking-widest opacity-80 uppercase`} style={{ color: '#ffffff', position: 'relative', zIndex: 10 }}>RECEIPT VOUCHER</span>
        </div>
        <div className={`text-left space-y-1.5 font-mono ${isCompact ? 'text-xs' : 'text-sm'}`}>
          <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 text-right">
            <span className="text-[10px] text-slate-400 block">رقم السند / No.</span>
            <span className={`${isCompact ? 'text-sm' : 'text-base'} font-black text-slate-900`}>#{receipt.receiptNo}</span>
          </div>
          <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 text-right">
            <span className="text-[10px] text-slate-400 block">التاريخ / Date</span>
            <span className="text-[12px] font-bold text-slate-800">{receipt.date}</span>
          </div>
        </div>
      </div>

      {/* Body Content */}
      <div className={`${isCompact ? 'space-y-4' : 'space-y-8'} ${isCompact ? 'my-4' : 'my-10'}`}>
        <div className={`flex items-center gap-4 bg-slate-50 rounded-2xl border border-slate-200 ${isCompact ? 'p-3' : 'p-5'}`}>
          <span className={`${getFontSizeClass('text', size)} font-bold text-slate-500 min-w-[130px]`}>استلمنا من السادة:</span>
          <span className={`${getFontSizeClass('h1', size)} font-black text-slate-900 flex-1 text-justify`} style={{ wordBreak: 'break-word' }}>{receipt.customerName}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`rounded-2xl border border-blue-200 bg-blue-50 ${isCompact ? 'p-4 space-y-2' : 'p-6 space-y-4'}`}>
            <div className="flex justify-between items-center">
              <span className={`${getFontSizeClass('text', size)} font-bold text-blue-800`}>المبلغ وقدره (بالأرقام)</span>
              <span className={`${isCompact ? 'text-xl' : 'text-3xl'} font-black text-blue-950 font-mono`}>
                {receipt.amount.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}
              </span>
            </div>
            <div className={`pt-3 border-t border-blue-200 flex flex-col gap-1`}>
              <span className="text-[10px] font-bold text-slate-500">المبلغ وقدره (حروفاً):</span>
              <div className={`${getFontSizeClass('p', size)} font-black text-blue-900 bg-white px-4 py-2 rounded-xl border border-blue-200 text-justify`} style={{ wordBreak: 'break-word' }}>
                {tafqeet(receipt.amount)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-400">طريقة الدفع</span>
              <span className={`${getFontSizeClass('p', size)} font-bold text-slate-800 mt-1`}>{receipt.paymentMethod}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-400">رقم المرجع / الفاتورة</span>
              <span className={`${getFontSizeClass('p', size)} font-bold text-blue-700 mt-1 font-mono`}>#{receipt.invoiceNo || receipt.referenceNo || '---'}</span>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border border-slate-200 bg-white ${isCompact ? 'p-4' : 'p-6'}`}>
          <span className="text-[10px] font-bold text-slate-400 block mb-2">وذلك مقابل (البيان):</span>
          <p className={`${getFontSizeClass('p', size)} font-semibold text-slate-800 leading-relaxed text-justify`} style={{ wordBreak: 'break-word' }}>{receipt.notes}</p>
        </div>
      </div>

      {/* Signatures & Stamps */}
      <div className={`${isCompact ? 'mt-12 pt-6' : 'mt-24 pt-10'} border-t border-slate-200 grid grid-cols-3 gap-8 text-center`}>
        <div className="space-y-4 relative">
          <div className={`${isCompact ? 'h-12' : 'h-16'} flex items-center justify-center relative`}>
            {isValidImageSrc(signature) && (
              <img src={signature} alt="Signature" className="absolute max-h-full object-contain pointer-events-none" />
            )}
          </div>
          <div className="border-t border-slate-300 pt-2 text-[10px] font-bold text-slate-700">توقيع المستلم</div>
          <p className="text-[8px] font-mono uppercase text-slate-400">Received By</p>
        </div>
        <div className="space-y-4 flex flex-col items-center justify-center">
          <div className={`${isCompact ? 'h-12' : 'h-16'} relative w-full flex items-center justify-center`}>
            {isValidImageSrc(stamp) && (
              <img src={stamp} alt="Stamp" className="absolute max-h-20 object-contain pointer-events-none opacity-85" />
            )}
          </div>
          <div className="border-t border-slate-300 pt-2 text-[10px] font-bold text-slate-700 w-full">ختم المنشأة</div>
          <p className="text-[8px] font-mono uppercase text-slate-400">Official Seal</p>
        </div>
        <div className="space-y-4 relative">
          <div className={`${isCompact ? 'h-12' : 'h-16'} flex items-center justify-center relative`}>
            <span className="text-[10px] font-bold text-slate-400">معتمد</span>
          </div>
          <div className="border-t border-slate-300 pt-2 text-[10px] font-bold text-slate-700">توقيع المدير المالي</div>
          <p className="text-[8px] font-mono uppercase text-slate-400">Manager Signature</p>
        </div>
      </div>

      {/* Footer */}
      <div className={`${isCompact ? 'mt-8 pt-4' : 'mt-16 pt-6'} border-t border-slate-100 flex justify-between text-[9px] font-mono text-slate-400`}>
        <span>{settings.address} | الهاتف: {settings.phone}</span>
        <span>صُدر عبر نظام السندات الذكي</span>
      </div>
      </div>
    </div>
  );
};

// 2. Modern Sleek Template (حديث وعصري)
export const ModernTemplate = ({ receipt, settings, signature, stamp }: TemplateProps) => {
  const accent = settings.accentColor || '#2563eb';
  const size = settings.fontSize || 'medium';
  const isCompact = settings.isCompact;
  const isA5 = settings.paperSize === 'a5';
  
  const minHeight = isA5 ? (isCompact ? '135mm' : '180mm') : (isCompact ? '200mm' : '270mm');

  return (
    <div 
      className={`relative bg-white text-slate-900 receipt-modern receipt-container ${isCompact ? 'p-6' : 'p-8 md:p-12 print:p-6'}`} 
      dir="rtl" 
      style={{ minHeight, width: '100%', fontFamily: "'Cairo', Tahoma, sans-serif", boxSizing: 'border-box' }}
    >
      <div className="h-full flex flex-col">
        {/* Header Section */}
        <div className={`flex justify-between items-start border-b-2 ${isCompact ? 'mb-4 pb-4' : 'mb-8 pb-6'}`} style={{ borderColor: accent }}>
          <div className="flex gap-5 items-center">
            {isValidImageSrc(settings.logo) && (
              <div className={`${isCompact ? 'w-16 h-16 min-w-[64px]' : 'w-24 h-24 min-w-[96px]'} rounded-2xl p-2 border border-slate-200 bg-white flex items-center justify-center overflow-hidden`}>
                <img 
                  src={settings.logo} 
                  alt="Logo" 
                  className="max-w-full max-h-full object-contain print-logo" 
                />
              </div>
            )}
            <div className="space-y-1.5">
              <h1 className={`${getFontSizeClass('title', size)} font-black text-slate-900 leading-tight tracking-tight`}>{settings.name}</h1>
              <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
                <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">الرقم الضريبي: {settings.taxNo}</span>
                <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">س.ت: {settings.crNo}</span>
              </div>
              {settings.address && <p className={`${getFontSizeClass('text', size)} text-slate-400 leading-relaxed max-w-sm`}>{settings.address}</p>}
            </div>
          </div>
          
          <div className="text-left">
            <div className={`inline-block text-white rounded-2xl ${isCompact ? 'px-4 pt-2 pb-3' : 'px-6 pt-4 pb-5'}`} style={{ backgroundColor: '#0f172a', color: '#ffffff', position: 'relative', zIndex: 1 }}>
              <h2 className={`${getFontSizeClass('h1', size)} font-black pb-1`} style={{ lineHeight: '1.6', color: '#ffffff', position: 'relative', zIndex: 10 }}>سند قبض مالي</h2>
              <div className="flex flex-col items-end gap-1" style={{ position: 'relative', zIndex: 10 }}>
                <p className={`${getFontSizeClass('text', size)} font-mono opacity-90 leading-none`} style={{ color: '#ffffff' }}>#{receipt.receiptNo}</p>
                <p className={`${getFontSizeClass('text', size)} font-mono text-blue-400 leading-none`} style={{ color: '#60a5fa' }}>{receipt.date}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className={`${isCompact ? 'space-y-4' : 'space-y-8'} flex-1`}>
          <div className={`${isCompact ? 'space-y-2' : 'space-y-4'}`}>
            <div className={`${isCompact ? 'p-4' : 'p-6'} rounded-3xl bg-slate-50 border border-slate-200 flex items-center justify-between group transition-all`}>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">استلمت من السادة / Received From</span>
                <span className={`${getFontSizeClass('h1', size)} font-black text-slate-900 text-justify`} style={{ wordBreak: 'break-word' }}>{receipt.customerName}</span>
              </div>
              {!isCompact && (
                <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                  👤
                </div>
              )}
            </div>

            <div className={`${isCompact ? 'p-4' : 'p-8'} rounded-3xl bg-white border border-slate-200 flex flex-col items-center justify-center text-center relative overflow-hidden`}>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 relative z-10">المبلغ وقدره كتابةً / Amount in Words</span>
              <p className={`${getFontSizeClass('h2', size)} font-black text-slate-900 relative z-10 leading-relaxed max-w-2xl px-6 text-justify`} style={{ wordBreak: 'break-word' }}>
                {tafqeet(receipt.amount)}
              </p>
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 ${isCompact ? 'gap-4' : 'gap-6'}`}>
            <div className={`${isCompact ? 'p-4' : 'p-8'} rounded-2xl text-white flex flex-col justify-center gap-1 relative overflow-hidden`} style={{ backgroundColor: accent, color: '#ffffff' }}>
              <span className="text-[10px] font-bold opacity-90 uppercase tracking-widest relative z-10" style={{ color: '#ffffff' }}>المبلغ بالأرقام / Amount</span>
              <div className="flex items-baseline gap-2 relative z-10">
                <span className={`${isCompact ? 'text-2xl' : 'text-4xl'} font-black font-mono tracking-tighter`} style={{ color: '#ffffff' }}>
                  {receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-lg font-bold opacity-90" style={{ color: '#ffffff' }}>SAR</span>
              </div>
            </div>

            <div className={`${isCompact ? 'space-y-2' : 'space-y-3'}`}>
              <div className={`${isCompact ? 'p-3' : 'p-5'} rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">طريقة الدفع / Payment</span>
                <span className={`${getFontSizeClass('h2', size)} font-black text-slate-900`}>{receipt.paymentMethod}</span>
              </div>
              <div className={`${isCompact ? 'p-3' : 'p-5'} rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">رقم المرجع / Ref No.</span>
                <span className={`${getFontSizeClass('h2', size)} font-black font-mono`} style={{ color: accent }}>#{receipt.invoiceNo || '---'}</span>
              </div>
            </div>
          </div>

          <div className={`${isCompact ? 'p-4' : 'p-6'} rounded-2xl border border-slate-100 bg-slate-50 relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-1 h-full" style={{ backgroundColor: accent }}></div>
            <span className="text-[10px] font-bold text-slate-400 block mb-2 uppercase tracking-wider">وذلك مقابل (البيان) / Description:</span>
            <p className={`${getFontSizeClass('p', size)} font-bold text-slate-800 leading-relaxed text-justify`} style={{ wordBreak: 'break-word', lineHeight: '1.6' }}>{receipt.notes}</p>
          </div>
        </div>

        {/* Footer / Signatures */}
        <div className={`${isCompact ? 'mt-8 pt-6' : 'mt-16 pt-10'} grid grid-cols-3 gap-10 border-t border-slate-100 text-center relative`}>
          <div className="space-y-4">
            <div className={`${isCompact ? 'h-12' : 'h-20'} flex items-end justify-center relative`}>
              {isValidImageSrc(signature) && (
                <img src={signature} alt="Signature" className="absolute bottom-0 max-h-full object-contain pointer-events-none" style={{ maxWidth: '140px' }} />
              )}
            </div>
            <div className="border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider">توقيع المستلم</div>
          </div>
          
          <div className="space-y-4 flex flex-col items-center justify-center">
            <div className={`${isCompact ? 'h-12' : 'h-20'} relative w-full flex items-center justify-center`}>
              {isValidImageSrc(stamp) && (
                <img src={stamp} alt="Stamp" className="absolute max-h-24 object-contain pointer-events-none opacity-85" style={{ maxWidth: '140px' }} />
              )}
            </div>
            <div className="border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-700 w-full uppercase tracking-wider">ختم المنشأة</div>
          </div>
          
          <div className="space-y-4">
            {!isCompact && <div className="h-20 flex items-center justify-center text-slate-400 font-mono text-sm">Approved</div>}
            <div className="border-t border-slate-200 pt-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider">اعتماد الإدارة</div>
          </div>
        </div>

        {!isCompact && (
          <div className="mt-12 text-center text-[10px] text-slate-400 font-mono">
            تم إنشاء هذا السند إلكترونياً ولا يحتاج إلى توقيع خطي في حال وجود الختم الإلكتروني المعتمد
          </div>
        )}
      </div>
    </div>
  );
};

// 3. Professional Financial Template (مالي احترافي)
export const ProfessionalTemplate = ({ receipt, settings, signature, stamp }: TemplateProps) => {
  const accent = settings.accentColor || '#1e293b';
  const size = settings.fontSize || 'medium';
  const isCompact = settings.isCompact;
  const isA5 = settings.paperSize === 'a5';
  
  const minHeight = isA5 ? (isCompact ? '135mm' : '180mm') : (isCompact ? '200mm' : '270mm');

  return (
    <div className={`${isCompact ? 'p-6' : 'p-10'} relative font-sans bg-white text-slate-900 receipt-container`} dir="rtl" style={{ minHeight, fontFamily: "'Cairo', Tahoma, sans-serif", boxSizing: 'border-box' }}>
      <div className="absolute top-0 right-0 w-2 h-full" style={{ backgroundColor: accent }}></div>

      <div>
        <div className={`flex justify-between items-start border-b border-slate-200 ${isCompact ? 'mb-6 pb-4' : 'mb-12 pb-8'}`}>
          <div className="flex gap-6 items-center">
            {isValidImageSrc(settings.logo) && (
              <img src={settings.logo} alt="Logo" className={`${isCompact ? 'w-20 h-20' : 'w-28 h-28'} object-contain rounded-2xl border p-2 bg-slate-50 print-logo`} />
            )}
            <div className="space-y-1">
              <h1 className={`${getFontSizeClass('h1', size)} font-black text-slate-900`}>{settings.name}</h1>
              <p className={`${getFontSizeClass('text', size)} font-bold text-slate-500`}>الرقم الضريبي: {settings.taxNo} | س.ت: {settings.crNo}</p>
              {settings.address && <p className={`${getFontSizeClass('text', size)} text-slate-400 opacity-80`}>{settings.address}</p>}
            </div>
          </div>
          <div className="text-left font-mono">
            <div className={`${getFontSizeClass('title', size)} font-black text-slate-900 tracking-tight`}>سند قبض</div>
            <div className={`${getFontSizeClass('p', size)} font-bold text-slate-500 mt-1`}>رقم: #{receipt.receiptNo}</div>
            <div className={`${getFontSizeClass('text', size)} text-slate-400`}>التاريخ: {receipt.date}</div>
          </div>
        </div>

        <div className={`${isCompact ? 'space-y-4' : 'space-y-8'}`}>
          <div className={`grid grid-cols-2 ${isCompact ? 'gap-4' : 'gap-6'}`}>
            <div className={`${isCompact ? 'p-4' : 'p-6'} rounded-2xl bg-slate-50 border border-slate-200`}>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">المستلم منه / Customer</span>
              <p className={`${getFontSizeClass('h2', size)} font-black text-slate-900 text-justify pb-1`} style={{ wordBreak: 'break-word', lineHeight: '1.6' }}>{receipt.customerName}</p>
            </div>
            <div className={`${isCompact ? 'p-4' : 'p-6'} rounded-2xl bg-slate-50 border border-slate-200`}>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">طريقة الدفع / Method</span>
              <p className={`${getFontSizeClass('h2', size)} font-black text-slate-900`}>{receipt.paymentMethod}</p>
            </div>
          </div>

          <div className={`${isCompact ? 'p-6' : 'p-8'} rounded-2xl text-white space-y-4`} style={{ backgroundColor: accent, color: '#ffffff' }}>
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-85" style={{ color: '#ffffff' }}>المبلغ الإجمالي / Total Amount</span>
                <h2 className={`${isCompact ? 'text-2xl' : 'text-3xl'} font-black mt-2 font-mono`} style={{ color: '#ffffff' }}>
                  {receipt.amount.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}
                </h2>
              </div>
              <div className="text-left px-4 py-3 rounded-xl font-mono" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }}>
                <span className="text-[10px] block opacity-85" style={{ color: '#ffffff' }}>رقم المرجع</span>
                <span className="text-base font-bold" style={{ color: '#ffffff' }}>#{receipt.invoiceNo || receipt.referenceNo || '---'}</span>
              </div>
            </div>
            <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <span className="text-[10px] font-bold text-amber-200 block mb-1">المبلغ وقدره كتابةً:</span>
              <p className={`${getFontSizeClass('p', size)} font-black text-white px-4 pt-2 pb-3 rounded-xl text-justify`} style={{ wordBreak: 'break-word', backgroundColor: 'rgba(255,255,255,0.2)', lineHeight: '1.6', color: '#ffffff' }}>
                {tafqeet(receipt.amount)}
              </p>
            </div>
          </div>

          <div className={`${isCompact ? 'p-4' : 'p-6'} rounded-2xl border border-slate-200 bg-white`}>
            <span className="text-[10px] font-bold text-slate-400 block mb-2 uppercase">البيان / Notes</span>
            <p className={`${getFontSizeClass('p', size)} font-medium text-slate-800 text-justify pb-1`} style={{ wordBreak: 'break-word', lineHeight: '1.6' }}>{receipt.notes}</p>
          </div>
        </div>

        <div className={`${isCompact ? 'mt-12 pt-6' : 'mt-24 pt-8'} grid grid-cols-3 gap-12 text-center border-t border-slate-200`}>
          <div className="space-y-4">
            <div className={`${isCompact ? 'h-12' : 'h-16'} flex items-center justify-center relative`}>
              {isValidImageSrc(signature) && (
                <img src={signature} alt="Signature" className="absolute max-h-full object-contain pointer-events-none" />
              )}
            </div>
            <div className="border-t border-slate-300 pt-2 text-[10px] font-bold">توقيع المستلم</div>
          </div>
          <div className="space-y-4 flex flex-col items-center justify-center">
            <div className={`${isCompact ? 'h-12' : 'h-16'} relative w-full flex items-center justify-center`}>
              {isValidImageSrc(stamp) && (
                <img src={stamp} alt="Stamp" className="absolute max-h-20 object-contain pointer-events-none opacity-85" />
              )}
            </div>
            <div className="border-t border-slate-300 pt-2 text-[10px] font-bold w-full">ختم المنشأة</div>
          </div>
          <div className="space-y-4">
            <div className={`${isCompact ? 'h-12' : 'h-16'} flex items-center justify-center text-slate-400 font-mono text-[10px]`}>معتمد</div>
            <div className="border-t border-slate-300 pt-2 text-[10px] font-bold">توقيع المدير</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 4. Luxury Royal Gold Template (فاخر ملكي ذهبي)
export const LuxuryTemplate = ({ receipt, settings, signature, stamp }: TemplateProps) => {
  const size = settings.fontSize || 'medium';
  const isCompact = settings.isCompact;
  const isA5 = settings.paperSize === 'a5';
  
  const minHeight = isA5 ? (isCompact ? '135mm' : '180mm') : (isCompact ? '200mm' : '270mm');

  return (
    <div className={`${isCompact ? 'p-8' : 'p-16'} relative font-serif bg-white text-slate-900 receipt-container`} dir="rtl" style={{ minHeight, fontFamily: "'Cairo', Tahoma, sans-serif", boxSizing: 'border-box' }}>
      <div className={`${isCompact ? 'inset-4' : 'inset-8'} absolute border-2 border-amber-300 pointer-events-none rounded-xl`}></div>

      <div className="relative z-10 px-4">
        <div className={`text-center space-y-4 ${isCompact ? 'mb-8' : 'mb-16'}`}>
          {isValidImageSrc(settings.logo) && (
            <img src={settings.logo} alt="Logo" className={`${isCompact ? 'w-24 h-24' : 'w-32 h-32'} mx-auto object-contain print-logo`} />
          )}
          <h1 className={`${getFontSizeClass('title', size)} font-black text-slate-900 tracking-wider`}>{settings.name}</h1>
          <div className="h-0.5 w-40 bg-amber-400 mx-auto"></div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-800">Official Receipt Voucher</p>
        </div>

        <div className={`flex justify-between ${isCompact ? 'mb-8' : 'mb-12'} text-sm font-mono`}>
          <div>
            <span className="text-amber-800 font-bold block text-[10px]">رقم السند</span>
            <span className={`${getFontSizeClass('h2', size)} font-bold`}>#{receipt.receiptNo}</span>
          </div>
          <div className="text-left">
            <span className="text-amber-800 font-bold block text-[10px]">تاريخ الإصدار</span>
            <span className={`${getFontSizeClass('h2', size)} font-bold`}>{receipt.date}</span>
          </div>
        </div>

        <div className={`${isCompact ? 'space-y-6 my-6' : 'space-y-10 my-10'}`}>
          <div className="flex items-baseline gap-6 border-b border-amber-200 pb-4">
            <span className="text-amber-900 font-serif italic text-lg whitespace-nowrap">وصلنا من المكرم / السادة:</span>
            <span className={`${getFontSizeClass('h1', size)} font-black text-slate-900 flex-1 text-center text-justify`} style={{ wordBreak: 'break-word' }}>{receipt.customerName}</span>
          </div>

          <div className={`${isCompact ? 'p-4' : 'p-8'} rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-4`}>
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-800">المبلغ وقدره صريحاً</span>
            <div className={`${isCompact ? 'text-2xl' : 'text-4xl'} font-black text-amber-950 font-mono`}>
              {receipt.amount.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}
            </div>
            <div className="pt-3 border-t border-amber-200">
              <span className="text-[10px] font-bold text-amber-800 block mb-1 font-sans">فقط وقدره كتابةً:</span>
              <p className={`${getFontSizeClass('p', size)} font-black text-amber-950 bg-white px-6 py-2 rounded-xl border border-amber-200 inline-block text-justify`} dir="rtl" style={{ wordBreak: 'break-word' }}>
                {tafqeet(receipt.amount)}
              </p>
            </div>
          </div>

          <div className={`grid grid-cols-2 ${isCompact ? 'gap-4' : 'gap-8'} text-sm font-sans`}>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
              <span className="text-amber-800 text-[10px] block font-bold">طريقة الدفع</span>
              <span className={`${getFontSizeClass('p', size)} font-bold text-slate-900`}>{receipt.paymentMethod}</span>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
              <span className="text-amber-800 text-[10px] block font-bold">رقم الفاتورة / المرجع</span>
              <span className={`${getFontSizeClass('p', size)} font-bold text-slate-900 font-mono`}>#{receipt.invoiceNo || '---'}</span>
            </div>
          </div>

          <div className={`${isCompact ? 'p-4' : 'p-6'} rounded-xl border border-amber-200 bg-white text-center italic`}>
            <span className="text-[10px] text-amber-800 not-italic block mb-1 font-bold">البيان / مقابل:</span>
            <p className={`${getFontSizeClass('p', size)} text-slate-800 not-italic text-justify`} style={{ wordBreak: 'break-word' }}>{receipt.notes}</p>
          </div>
        </div>

        <div className={`${isCompact ? 'mt-12' : 'mt-20'} grid grid-cols-3 gap-12 text-center pt-10 border-t border-amber-200`}>
          <div className="space-y-4 relative">
            <div className={`${isCompact ? 'h-12' : 'h-16'} flex items-center justify-center relative`}>
              {isValidImageSrc(signature) && (
                <img src={signature} alt="Signature" className="absolute max-h-full object-contain pointer-events-none" />
              )}
            </div>
            <div className="border-t border-amber-300 pt-2 text-[10px] font-bold text-amber-900">توقيع المستلم</div>
          </div>
          <div className="space-y-4 flex flex-col items-center justify-center">
            <div className={`${isCompact ? 'h-12' : 'h-16'} relative w-full flex items-center justify-center`}>
              {isValidImageSrc(stamp) && (
                <img src={stamp} alt="Stamp" className="absolute max-h-20 object-contain pointer-events-none opacity-85" />
              )}
            </div>
            <div className="border-t border-amber-300 pt-2 text-[10px] font-bold text-amber-900 w-full">ختم المنشأة</div>
          </div>
          <div className="space-y-4 relative">
            <div className={`${isCompact ? 'h-12' : 'h-16'} flex items-center justify-center text-amber-800 font-mono text-[10px]`}>معتمد</div>
            <div className="border-t border-amber-300 pt-2 text-[10px] font-bold text-amber-900">اعتماد الإدارة</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 5. Minimal Apple-Grade Template (بسيط وعصري فائق النقاء)
export const MinimalTemplate = ({ receipt, settings, signature, stamp }: TemplateProps) => {
  const size = settings.fontSize || 'medium';
  const isCompact = settings.isCompact;
  const isA5 = settings.paperSize === 'a5';
  
  const minHeight = isA5 ? (isCompact ? '135mm' : '180mm') : (isCompact ? '200mm' : '270mm');

  return (
    <div className={`${isCompact ? 'p-6' : 'p-12'} font-sans bg-white text-slate-900 receipt-container`} dir="rtl" style={{ minHeight, fontFamily: "'Cairo', Tahoma, sans-serif", boxSizing: 'border-box' }}>
      <div className={`flex justify-between items-end border-b-2 border-slate-900 ${isCompact ? 'pb-4 mb-8' : 'pb-8 mb-12'}`}>
        <div className="flex items-center gap-6">
          {isValidImageSrc(settings.logo) && (
            <img src={settings.logo} alt="Logo" className={`${isCompact ? 'w-16 h-16' : 'w-24 h-24'} object-contain print-logo`} />
          )}
          <div>
            <h1 className={`${getFontSizeClass('title', size)} font-black text-slate-900`}>{settings.name}</h1>
            <p className="text-[10px] font-mono text-slate-500 mt-1">الرقم الضريبي: {settings.taxNo}</p>
          </div>
        </div>
        <div className="text-left">
          <span className={`${isCompact ? 'text-xl' : 'text-3xl'} font-black tracking-tight text-slate-300 font-mono`}>RECEIPT</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-8 space-y-8">
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block font-bold">Received From / استلمنا من</span>
            <p className={`${getFontSizeClass('h1', size)} font-black text-slate-900 text-justify`} style={{ wordBreak: 'break-word' }}>{receipt.customerName}</p>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 block font-bold">Description / البيان</span>
            <p className={`${getFontSizeClass('p', size)} text-slate-700 leading-relaxed font-medium text-justify`} style={{ wordBreak: 'break-word' }}>{receipt.notes}</p>
          </div>
        </div>
        
        <div className={`col-span-4 ${isCompact ? 'p-6' : 'p-8'} rounded-2xl bg-slate-50 space-y-6 border border-slate-100`}>
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">Amount / المبلغ</span>
            <p className={`${isCompact ? 'text-xl' : 'text-3xl'} font-black text-slate-900 mt-1 font-mono`}>{receipt.amount.toLocaleString('ar-SA')} SAR</p>
            <div className="mt-3 pt-3 border-t border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold block mb-1">المبلغ كتابةً:</span>
              <p className="text-[11px] font-black text-blue-900 bg-white p-3 rounded-xl border border-slate-200 text-justify" dir="rtl" style={{ wordBreak: 'break-word' }}>
                {tafqeet(receipt.amount)}
              </p>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">Date / التاريخ</span>
            <p className={`${getFontSizeClass('p', size)} font-bold text-slate-800 mt-0.5`}>{receipt.date}</p>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">Reference / رقم السند</span>
            <p className={`${getFontSizeClass('p', size)} font-bold font-mono text-slate-800 mt-0.5`}>#{receipt.receiptNo}</p>
          </div>
        </div>
      </div>

      <div className={`${isCompact ? 'mt-16' : 'mt-28'} pt-10 border-t border-slate-100 flex justify-between items-end`}>
         <div className="space-y-3">
           <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">Authorized Signature</span>
           <div className={`relative ${isCompact ? 'h-12' : 'h-16'} w-48`}>
              {isValidImageSrc(signature) && (
                <img src={signature} alt="Signature" className="absolute bottom-0 h-16 object-contain pointer-events-none" />
              )}
           </div>
           <div className="w-48 h-px bg-slate-900"></div>
         </div>
         <div className={`relative ${isCompact ? 'h-16 w-24' : 'h-24 w-32'} flex items-center justify-center`}>
            {isValidImageSrc(stamp) && (
              <img src={stamp} alt="Stamp" className="max-h-full max-w-full object-contain opacity-85" />
            )}
         </div>
         <div className="text-left text-[10px] font-mono text-slate-400 space-y-1">
           <p>{settings.address}</p>
           <p>{settings.phone}</p>
         </div>
      </div>
    </div>
  );
};

// 6. Daftra Cloud Accounting Template (دفترة محاسبي احترافي)
export const DaftraTemplate = ({ receipt, settings, signature, stamp }: TemplateProps) => {
  const accent = settings.accentColor || '#0284c7';
  const size = settings.fontSize || 'medium';
  const isCompact = settings.isCompact;
  const isA5 = settings.paperSize === 'a5';
  
  const minHeight = isA5 ? (isCompact ? '135mm' : '180mm') : (isCompact ? '200mm' : '270mm');

  return (
    <div className={`${isCompact ? 'p-6' : 'p-10'} font-sans bg-white text-slate-900 receipt-container`} dir="rtl" style={{ minHeight, fontFamily: "'Cairo', Tahoma, sans-serif", boxSizing: 'border-box' }}>
      <div className={`flex justify-between items-start border-b-2 ${isCompact ? 'pb-4 mb-4' : 'pb-8 mb-8'}`} style={{ borderColor: accent }}>
        <div className="space-y-1.5">
          <h1 className={`${getFontSizeClass('title', size)} font-black text-slate-900`}>{settings.name}</h1>
          <p className={`${getFontSizeClass('text', size)} font-bold text-slate-500`}>الرقم الضريبي: {settings.taxNo}</p>
          <p className={`${getFontSizeClass('text', size)} font-bold text-slate-500`}>سجل تجاري: {settings.crNo}</p>
        </div>
        {isValidImageSrc(settings.logo) && (
          <img src={settings.logo} alt="Logo" className={`${isCompact ? 'w-20 h-20' : 'w-28 h-28'} object-contain rounded-xl p-1 border border-slate-200 bg-white flex items-center justify-center overflow-hidden print-logo`} />
        )}
      </div>

      <div className={`${isCompact ? 'mb-6' : 'mb-10'} text-center`}>
        <h2 className={`${getFontSizeClass('h1', size)} font-black inline-block px-10 pt-3 pb-5 rounded-2xl text-white`} style={{ backgroundColor: accent, lineHeight: '1.6', color: '#ffffff', position: 'relative', zIndex: 1 }}>
          <span style={{ color: '#ffffff', position: 'relative', zIndex: 10 }}>سند قبض مالي</span>
        </h2>
        <div className={`flex justify-center gap-10 mt-4 ${getFontSizeClass('text', size)} font-bold text-slate-600 font-mono`}>
          <p>رقم السند: <span className="text-slate-900">#{receipt.receiptNo}</span></p>
          <p>التاريخ: <span className="text-slate-900">{receipt.date}</span></p>
        </div>
      </div>

      <div className={`${isCompact ? 'space-y-4' : 'space-y-6'}`}>
        <div className={`flex items-center gap-4 rounded-2xl bg-slate-50 border border-slate-100 ${isCompact ? 'p-3' : 'p-5'}`}>
          <span className={`${getFontSizeClass('text', size)} font-bold text-slate-500 min-w-[120px]`}>استلمنا من السادة:</span>
          <span className={`${getFontSizeClass('h1', size)} font-black text-slate-900 flex-1 text-justify pb-2`} style={{ wordBreak: 'break-word', lineHeight: '1.6' }}>{receipt.customerName}</span>
        </div>

        <div className={`${isCompact ? 'p-4' : 'p-6'} rounded-2xl bg-slate-50 border border-slate-100 space-y-4`}>
          <div className="flex items-center justify-between">
            <span className={`${getFontSizeClass('text', size)} font-bold text-slate-500`}>المبلغ وقدره (بالأرقام):</span>
            <span className={`${isCompact ? 'text-xl' : 'text-2xl'} font-black font-mono`} style={{ color: accent, lineHeight: '1.6' }}>
              {receipt.amount.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}
            </span>
          </div>
          <div className="pt-3 border-t border-slate-200">
            <span className="text-[10px] font-bold text-slate-500 block mb-1">المبلغ وقدره (كتابةً):</span>
            <div className={`${getFontSizeClass('p', size)} font-black text-slate-900 bg-white px-4 pt-3 pb-4 rounded-xl border border-slate-200 text-justify`} style={{ wordBreak: 'break-word', lineHeight: '1.6' }}>
              {tafqeet(receipt.amount)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className={`${isCompact ? 'p-3' : 'p-5'} rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between`}>
            <span className={`${getFontSizeClass('text', size)} font-bold text-slate-500`}>طريقة الدفع:</span>
            <span className={`${getFontSizeClass('p', size)} font-bold text-slate-900`}>{receipt.paymentMethod}</span>
          </div>
          <div className={`${isCompact ? 'p-3' : 'p-5'} rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between`}>
            <span className={`${getFontSizeClass('text', size)} font-bold text-slate-500`}>مقابل فاتورة:</span>
            <span className={`${getFontSizeClass('p', size)} font-bold text-slate-900 font-mono`}>#{receipt.invoiceNo || '---'}</span>
          </div>
        </div>

        <div className={`${isCompact ? 'p-4' : 'p-6'} rounded-2xl bg-slate-50 border border-slate-100`}>
          <span className="text-[10px] font-bold text-slate-400 block mb-1">البيان / ملاحظات:</span>
          <p className={`${getFontSizeClass('p', size)} font-medium text-slate-800 text-justify pb-2`} style={{ wordBreak: 'break-word', lineHeight: '1.6' }}>{receipt.notes}</p>
        </div>
      </div>

      <div className={`${isCompact ? 'mt-12 pt-6' : 'mt-24 pt-8'} grid grid-cols-3 gap-8 text-center border-t border-slate-200`}>
        <div className="space-y-4">
          <div className={`${isCompact ? 'h-12' : 'h-16'} flex items-center justify-center relative`}>
            {isValidImageSrc(signature) && (
              <img src={signature} alt="Signature" className="absolute max-h-full object-contain pointer-events-none" />
            )}
          </div>
          <div className="border-t border-slate-300 pt-2 text-[10px] font-bold text-slate-700">توقيع المستلم</div>
        </div>
        <div className="space-y-4 flex flex-col items-center justify-center">
          <div className={`${isCompact ? 'h-12' : 'h-16'} relative w-full flex items-center justify-center`}>
            {isValidImageSrc(stamp) && (
              <img src={stamp} alt="Stamp" className="absolute max-h-20 object-contain pointer-events-none opacity-85" />
            )}
          </div>
          <div className="border-t border-slate-300 pt-2 text-[10px] font-bold text-slate-700 w-full">ختم المنشأة</div>
        </div>
        <div className="space-y-4">
          <div className={`${isCompact ? 'h-12' : 'h-16'} flex items-center justify-center text-slate-400 font-mono text-[10px]`}>معتمد</div>
          <div className="border-t border-slate-300 pt-2 text-[10px] font-bold text-slate-700">اعتماد المدير</div>
        </div>
      </div>

      <div className={`${isCompact ? 'mt-8 pt-4' : 'mt-16 pt-6'} border-t border-slate-100 flex justify-between text-[10px] text-slate-400 font-mono`}>
        <span>{settings.address} | هاتف: {settings.phone}</span>
        <span>الصفحة 1 من 1</span>
      </div>
    </div>
  );
};

