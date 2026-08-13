/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Save, Building2, Hash, MapPin, Phone, Image as ImageIcon, CheckCircle2, Eye, PenTool, Sparkles, Printer, Cpu, Activity, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { OrganizationSettings, Receipt } from '../types';
import { ModernTemplate, ProfessionalTemplate, ClassicTemplate, LuxuryTemplate, MinimalTemplate, DaftraTemplate } from './ReceiptTemplates';
import QuickSignatureModal from './QuickSignatureModal';

interface SettingsPageProps {
  settings: OrganizationSettings;
  onSave: (settings: OrganizationSettings) => void;
}

const DUMMY_RECEIPT: Receipt = {
  id: 'preview',
  receiptNo: '1234',
  date: new Date().toLocaleDateString('en-GB').replace(/\//g, '/'),
  invoiceNo: 'INV-789',
  customerName: 'شركة العميل التجريبية',
  amount: 2500,
  paymentMethod: 'نقداً',
  receivedFrom: 'شركة العميل التجريبية',
  notes: 'سداد دفعة مقدمة مقابل خدمات برمجية'
};

export default function SettingsPage({ settings, onSave }: SettingsPageProps) {
  const [formData, setFormData] = useState<OrganizationSettings>(settings);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isQuickSigOpen, setIsQuickSigOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<{
    status: 'ok' | 'quota_exceeded' | 'high_demand' | 'missing_key' | 'server_offline' | 'network_error' | 'error' | 'idle';
    isQuotaAvailable?: boolean;
    message?: string;
    diagnostic?: string;
    checkedAt?: string;
  }>({ status: 'idle' });
  const [isCheckingAi, setIsCheckingAi] = useState(false);
  const [showDeploymentHelp, setShowDeploymentHelp] = useState(false);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleCheckAiStatus = async () => {
    setIsCheckingAi(true);
    try {
      const res = await fetch('/api/check-ai-status');
      
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok && res.status === 404) {
        setAiStatus({
          status: 'server_offline',
          isQuotaAvailable: false,
          message: 'خادم المعالجة الخلفي غير متصل (خطأ 404 Not Found).',
          diagnostic: 'تم رفع واجهة التطبيق فقط كصفحات ثابتة (Static Web Files) دون تشغيل خادم Node.js الخلفي المسؤول عن استخراج الفواتير والاتصال بالذكاء الاصطناعي.',
          checkedAt: new Date().toISOString()
        });
        return;
      }

      if (contentType.includes('application/json')) {
        const data = await res.json();
        setAiStatus({
          ...data,
          checkedAt: data.checkedAt || new Date().toISOString()
        });
      } else {
        // Returned HTML (e.g. 404/502 default page from Nginx/Apache/Static Host)
        setAiStatus({
          status: 'server_offline',
          isQuotaAvailable: false,
          message: 'المسار البرمجي (/api/check-ai-status) لم يرجع استجابة خادم Node.js.',
          diagnostic: 'تأكد من تشغيل الخادم الخلفي (npm start) وتوجيه مسارات /api/* إلى الخادم في موقعك الخارجي.',
          checkedAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error('Error checking AI status:', err);
      setAiStatus({
        status: 'network_error',
        isQuotaAvailable: false,
        message: 'تعذر الاتصال بخادم التطبيق لفحص الرصيد.',
        diagnostic: 'فشل الاتصال بالخادم عبر الشبكة (Failed to fetch). تأكد من تشغيل خادم التطبيق (Node.js) وسلامة إعدادات النطاق / المنفذ.',
        checkedAt: new Date().toISOString()
      });
    } finally {
      setIsCheckingAi(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        alert('حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        alert('حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, signature: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStampChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        alert('حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, stamp: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const renderPreview = () => {
    const props = { 
      receipt: DUMMY_RECEIPT, 
      settings: formData,
      signature: formData.signature,
      stamp: formData.stamp
    };
    switch (formData.preferredTemplate) {
      case 'modern':
        return <ModernTemplate {...props} />;
      case 'professional':
        return <ProfessionalTemplate {...props} />;
      case 'luxury':
        return <LuxuryTemplate {...props} />;
      case 'minimal':
        return <MinimalTemplate {...props} />;
      case 'daftra':
        return <DaftraTemplate {...props} />;
      case 'classic':
      default:
        return <ClassicTemplate {...props} />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Settings Form */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden h-fit">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50">
            <h2 className="text-2xl font-black text-slate-900">إعدادات المنشأة</h2>
            <p className="text-slate-500 mt-1">هذه البيانات ستظهر في ترويسة جميع السندات المطبوعة</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {/* AI Status & Quota Checker Widget */}
            <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl text-white shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                    <Cpu size={22} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      فحص رصيد وحالة الذكاء الاصطناعي (AI Status)
                      <span className="text-[10px] bg-blue-500/30 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-400/30">
                        مباشر
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">تحقق من توفر رصيد حزمة معالجة واستخراج الفواتير الكبيرة</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCheckAiStatus}
                  disabled={isCheckingAi}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-blue-900/50 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={14} className={isCheckingAi ? 'animate-spin' : ''} />
                  <span>{isCheckingAi ? 'جاري الفحص...' : 'فحص الرصيد والحالة'}</span>
                </button>
              </div>

              {aiStatus.status !== 'idle' && (
                <div className={`p-4 rounded-xl border text-xs leading-relaxed transition-all ${
                  aiStatus.status === 'ok'
                    ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                    : aiStatus.status === 'quota_exceeded'
                    ? 'bg-rose-950/80 border-rose-500/60 text-rose-100 font-bold'
                    : aiStatus.status === 'high_demand'
                    ? 'bg-amber-950/70 border-amber-500/50 text-amber-100'
                    : aiStatus.status === 'missing_key' || aiStatus.status === 'server_offline' || aiStatus.status === 'network_error'
                    ? 'bg-amber-950/80 border-amber-500/60 text-amber-100'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}>
                  <div className="flex items-start gap-3">
                    {aiStatus.status === 'ok' && <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />}
                    {aiStatus.status === 'quota_exceeded' && <AlertTriangle size={20} className="text-rose-400 shrink-0 mt-0.5 animate-pulse" />}
                    {aiStatus.status === 'high_demand' && <Zap size={20} className="text-amber-400 shrink-0 mt-0.5" />}
                    {(aiStatus.status === 'missing_key' || aiStatus.status === 'server_offline' || aiStatus.status === 'network_error' || aiStatus.status === 'error') && (
                      <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1.5 w-full">
                      <div className="font-bold text-sm">{aiStatus.message}</div>
                      
                      {aiStatus.diagnostic && (
                        <div className="text-[11px] text-slate-300 font-normal bg-black/30 p-2.5 rounded-lg border border-white/10 mt-1">
                          {aiStatus.diagnostic}
                        </div>
                      )}

                      {aiStatus.status === 'quota_exceeded' && (
                        <div className="text-[11px] text-rose-300 font-normal mt-1 pt-1 border-t border-rose-800/50">
                          السبب: تجاوز الحد الأقصى المسموح للطلبات أو نفاد الرصيد المتاح لحساب الـ API.
                        </div>
                      )}

                      {(aiStatus.status === 'server_offline' || aiStatus.status === 'missing_key' || aiStatus.status === 'network_error') && (
                        <div className="pt-2 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => setShowDeploymentHelp(!showDeploymentHelp)}
                            className="text-[11px] text-blue-300 underline hover:text-blue-200 cursor-pointer font-bold"
                          >
                            {showDeploymentHelp ? 'إخفاء تعليمات الاستضافة الخارجية' : '💡 كيف تقوم بتشغيل التطبيق على موقعك الخارجي بشكل صحيح؟'}
                          </button>

                          {showDeploymentHelp && (
                            <div className="mt-2 p-3 bg-slate-950/80 rounded-xl border border-slate-700 text-slate-300 text-[11px] space-y-2 leading-relaxed font-normal">
                              <p className="font-bold text-white">الخطوات اللازمة عند رفع التطبيق على خادم خارجي:</p>
                              <ol className="list-decimal list-inside space-y-1 text-slate-300 pr-1">
                                <li>
                                  <strong className="text-white">تشغيل خادم Node.js:</strong> هذا التطبيق يحتاج لخادم Node.js لتنفيذ مهام الذكاء الاصطناعي وحماية المفاتيح. شغّل الأمر: <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">npm run build && npm start</code>
                                </li>
                                <li>
                                  <strong className="text-white">إضافة مفتاح الـ API:</strong> تأكد من ضبط متغير البيئة <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">GEMINI_API_KEY</code> في لوحة تحكم الاستضافة (Environment Variables).
                                </li>
                                <li>
                                  <strong className="text-white">الاستضافات المدعومة:</strong> منصات مثل Google Cloud Run أو Render أو Railway أو VPS أو Docker (وليس الاستضافات الثابتة فقط مثل GitHub Pages).
                                </li>
                              </ol>
                            </div>
                          )}
                        </div>
                      )}

                      {aiStatus.checkedAt && (
                        <div className="text-[10px] opacity-75 mt-1">
                          آخر فحص: {new Date(aiStatus.checkedAt).toLocaleTimeString('ar-SA')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Assets Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Logo Section */}
              <div className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-400 shadow-sm">
                    {formData.logo ? (
                      <img src={formData.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon size={24} className="text-slate-300" />
                    )}
                  </div>
                  <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                    <span className="text-white text-[10px] font-bold">تغيير</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                  </label>
                </div>
                <div className="text-center">
                  <h3 className="text-xs font-bold text-slate-800">شعار المنشأة</h3>
                </div>
              </div>

              {/* Signature Section */}
              <div className="flex flex-col items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 relative">
                <div className="relative group w-full flex justify-center">
                  <div className="w-20 h-20 rounded-xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-400 shadow-sm">
                    {formData.signature ? (
                      <img src={formData.signature} alt="Signature" className="w-full h-full object-contain p-2" />
                    ) : (
                      <PenTool size={24} className="text-slate-300" />
                    )}
                  </div>
                  <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                    <span className="text-white text-[10px] font-bold">تغيير الصورة</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleSignatureChange} />
                  </label>
                </div>
                <div className="text-center w-full space-y-1.5">
                  <h3 className="text-xs font-bold text-slate-800">توقيع المستلم</h3>
                  <button
                    type="button"
                    onClick={() => setIsQuickSigOpen(true)}
                    className="w-full py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={12} />
                    اختيار / رسم توقيع مسبق
                  </button>
                </div>
              </div>

              {/* Stamp Section */}
              <div className="flex flex-col items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-400 shadow-sm">
                    {formData.stamp ? (
                      <img src={formData.stamp} alt="Stamp" className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon size={24} className="text-slate-300" />
                    )}
                  </div>
                  <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                    <span className="text-white text-[10px] font-bold">تغيير</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleStampChange} />
                  </label>
                </div>
                <div className="text-center">
                  <h3 className="text-xs font-bold text-slate-800">ختم المنشأة</h3>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 block">لون السند الأساسي (Brand Color)</label>
              <div className="flex flex-wrap gap-3">
                {[
                  '#0f172a', '#2563eb', '#0284c7', '#0891b2', '#059669', '#16a34a', '#84cc16', 
                  '#eab308', '#d97706', '#ea580c', '#dc2626', '#e11d48', '#c026d3', '#9333ea', '#4f46e5'
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, accentColor: color })}
                    className={`w-10 h-10 rounded-full border-4 transition-all transform hover:scale-110 active:scale-95 ${
                      formData.accentColor === color ? 'border-white ring-2 ring-blue-500 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <div className="flex items-center gap-2 mr-2">
                  <input
                    type="color"
                    value={formData.accentColor}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="w-10 h-10 rounded-full border-none p-0 cursor-pointer overflow-hidden"
                  />
                  <span className="text-xs font-bold text-slate-500">لون مخصص</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Printer size={16} className="text-blue-600" />
                  قالب تصميم السندات المطبوعة (Receipt Print Template)
                </label>
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                  6 قوالب احترافية
                </span>
              </div>
              <p className="text-xs text-slate-500">اختر القالب المفضل الذي سيتم اعتماده افتراضياً عند طباعة السندات وتصدير ملفات الـ PDF:</p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { id: 'classic', label: 'كلاسيكي مؤطر', desc: 'إطار متين وتنسيق رسمي كلاسيكي', tag: 'تقليدي' },
                  { id: 'modern', label: 'عصري حديث', desc: 'ألوان متناسقة وتقسيم مرن', tag: 'الأكثر استخداماً' },
                  { id: 'professional', label: 'رسمي شركات', desc: 'مخصص للمؤسسات الكبرى', tag: 'احترافي' },
                  { id: 'minimal', label: 'مبسط وسريع', desc: 'تركيز عالي ونظيف على البيانات', tag: 'سريع' },
                  { id: 'luxury', label: 'ملكي فاخر', desc: 'لمسات ذهبية وتنسيق راقي جداً', tag: 'VIP' },
                  { id: 'daftra', label: 'دفاتر محاسبية', desc: 'نمط الدفاتر التجارية المعقولة', tag: 'تلقائي' },
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, preferredTemplate: tpl.id as any })}
                    className={`relative p-4 rounded-2xl border-2 transition-all text-right flex flex-col justify-between min-h-[96px] ${
                      formData.preferredTemplate === tpl.id
                        ? 'border-blue-600 bg-blue-50/60 shadow-md shadow-blue-100 ring-2 ring-blue-500/20'
                        : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-sm font-black text-slate-900">{tpl.label}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                          formData.preferredTemplate === tpl.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {tpl.tag}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block leading-snug">{tpl.desc}</span>
                    </div>
                    {formData.preferredTemplate === tpl.id && (
                      <div className="mt-2 flex items-center gap-1 text-blue-600 text-[11px] font-bold">
                        <CheckCircle2 size={14} />
                        <span>محدد كنموذج طباعة</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 block">لغة النظام والسندات المطبوعة / System & Print Language</label>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'ar', label: 'العربية (Arabic)', desc: 'اللغة الأساسية' },
                  { id: 'en', label: 'English (الإنجليزية)', desc: 'International Service' },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, language: lang.id as any })}
                    className={`relative p-4 rounded-2xl border-2 transition-all text-right ${
                      (formData.language || 'ar') === lang.id
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm shadow-blue-100'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-black">{lang.label}</span>
                      <span className="text-[10px] text-slate-400">{lang.desc}</span>
                    </div>
                    {(formData.language || 'ar') === lang.id && (
                      <div className="absolute top-2 left-2 text-blue-500">
                        <CheckCircle2 size={16} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Building2 size={16} className="text-blue-500" />
                  اسم المنشأة
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="أدخل اسم الشركة"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Hash size={16} className="text-blue-500" />
                  الرقم الضريبي
                </label>
                <input
                  type="text"
                  required
                  value={formData.taxNo}
                  onChange={e => setFormData({ ...formData, taxNo: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="3119XXXXXXXXXXX"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Hash size={16} className="text-blue-500" />
                  السجل التجاري
                </label>
                <input
                  type="text"
                  required
                  value={formData.crNo}
                  onChange={e => setFormData({ ...formData, crNo: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="703766XXXX"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Phone size={16} className="text-blue-500" />
                  رقم الجوال
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="05XXXXXXXX"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <MapPin size={16} className="text-blue-500" />
                  العنوان
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="المدينة، الحي، اسم الشارع"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
              {showSuccess && (
                <div className="flex items-center gap-2 text-emerald-600 animate-in fade-in slide-in-from-right-4">
                  <CheckCircle2 size={20} />
                  <span className="font-bold">تم الحفظ بنجاح</span>
                </div>
              )}
              <button
                type="submit"
                className="mr-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 hover:shadow-xl transition-all transform active:scale-95 flex items-center gap-2"
              >
                <Save size={18} />
                حفظ الإعدادات
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Eye size={20} className="text-blue-500" />
              معاينة فورية للقالب
            </h3>
            <span className="text-xs text-slate-400">سيتم تطبيق هذا التصميم على جميع السندات</span>
          </div>
          
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform scale-[0.7] md:scale-[0.8] lg:scale-[0.85] origin-top shadow-blue-900/5 min-h-[800px]">
             {renderPreview()}
          </div>
        </div>
      </div>

      <QuickSignatureModal
        settings={formData}
        isOpen={isQuickSigOpen}
        onClose={() => setIsQuickSigOpen(false)}
        onSave={(updated) => {
          setFormData(updated);
          onSave(updated);
        }}
      />
    </div>
  );
}
