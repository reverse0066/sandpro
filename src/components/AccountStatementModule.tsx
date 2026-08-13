import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Sparkles, 
  Printer, 
  Download, 
  Calendar, 
  User as UserIcon, 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  ArrowRight, 
  RefreshCw, 
  FileSpreadsheet, 
  ShieldCheck, 
  FileCheck,
  Calculator,
  ChevronDown,
  Info,
  Loader2
} from 'lucide-react';
import { OrganizationSettings, AccountStatement, StatementItem } from '../types';
import { safeHtml2canvas } from '../utils/html2canvasFix';
import { jsPDF } from 'jspdf';

interface AccountStatementModuleProps {
  settings: OrganizationSettings;
  onBack?: () => void;
}

export default function AccountStatementModule({ settings, onBack }: AccountStatementModuleProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Statement State
  const [statement, setStatement] = useState<AccountStatement | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Editing item state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<{
    invoiceNo: string;
    date: string;
    customerName: string;
    description: string;
    debit: number;
    credit: number;
  }>({
    invoiceNo: '',
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    description: '',
    debit: 0,
    credit: 0
  });

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isEditingNetBalance, setIsEditingNetBalance] = useState(false);

  // Manual Net Balance Override Handler
  const handleManualNetBalanceChange = (val: number) => {
    if (!statement) return;
    setStatement({
      ...statement,
      netBalance: val
    });
  };

  // Reset Net Balance to Auto Calculated
  const handleResetNetBalance = () => {
    if (!statement) return;
    const calc = calculateStatement(
      statement.items,
      statement.openingBalance,
      statement.customerName,
      statement.isCustomerConsistent,
      statement.detectedCustomers
    );
    setStatement({
      ...statement,
      netBalance: calc.netBalance
    });
  };

  // Manual Print / Issue Date Handler
  const handleCreatedDateChange = (val: string) => {
    if (!statement) return;
    setStatement({
      ...statement,
      createdDate: val
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const statementPrintRef = useRef<HTMLDivElement>(null);

  // Helper to re-calculate running balance & period dates
  const calculateStatement = (
    items: StatementItem[], 
    opBal: number, 
    cName: string, 
    isConsistent: boolean, 
    detectedCusts: string[]
  ): AccountStatement => {
    // Sort items chronologically (oldest date to newest date)
    const sortedItems = [...items].sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeA - timeB;
    });

    let currentBalance = opBal;
    let totDebit = 0;
    let totCredit = 0;

    const itemsWithRunning = sortedItems.map((item) => {
      const debitVal = Number(item.debit) || 0;
      const creditVal = Number(item.credit) || 0;
      totDebit += debitVal;
      totCredit += creditVal;
      currentBalance = currentBalance + debitVal - creditVal;

      return {
        ...item,
        debit: debitVal,
        credit: creditVal,
        runningBalance: currentBalance
      };
    });

    const startDate = itemsWithRunning.length > 0 ? itemsWithRunning[0].date : new Date().toISOString().split('T')[0];
    const endDate = itemsWithRunning.length > 0 ? itemsWithRunning[itemsWithRunning.length - 1].date : new Date().toISOString().split('T')[0];

    return {
      statementNo: `STMT-${Date.now().toString().slice(-6)}`,
      createdDate: new Date().toISOString().split('T')[0],
      customerName: cName,
      isCustomerConsistent: isConsistent,
      detectedCustomers: detectedCusts,
      startDate,
      endDate,
      openingBalance: opBal,
      items: itemsWithRunning,
      totalDebit: totDebit,
      totalCredit: totCredit,
      netBalance: currentBalance
    };
  };

  // Handle PDF Upload & AI Extraction
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('يرجى اختيار ملف بصيغة PDF مدمج يحتوي على الفواتير.');
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);
    setErrorMsg('');
    setProcessingStep('جاري قراءة ملف الـ PDF وتجهيز البيانات للذكاء الاصطناعي...');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = (e.target?.result as string)?.split(',')[1];
          if (!base64Data) {
            throw new Error('فشل قراءة محتوى الملف');
          }

          let response: Response | null = null;
          let attempts = 0;
          const maxAttempts = 3;

          while (attempts < maxAttempts) {
            attempts++;
            setProcessingStep(`جاري معالجة الفواتير عبر AI Studio واستخراج البيانات بشبكة الرؤية (محاولة ${attempts}/${maxAttempts})...`);

            response = await fetch('/api/analyze-statement-pdf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileData: base64Data,
                mimeType: 'application/pdf',
                fileName: file.name
              })
            });

            if (response.ok) {
              break;
            }

            if ((response.status === 503 || response.status === 429) && attempts < maxAttempts) {
              setProcessingStep(`النموذج قيد الضغط المؤقت (503)... جاري إعادة المحاولة خلال 3 ثوانٍ (${attempts}/${maxAttempts})...`);
              await new Promise(res => setTimeout(res, 3000));
              continue;
            }

            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || `خطأ في معالجة المستند (${response.status})`);
          }

          if (!response || !response.ok) {
            throw new Error('فشلت معالجة كشف الحساب من قبل خادم الذكاء الاصطناعي.');
          }

          setProcessingStep('جاري تنظيم الحركات تسلسلياً وحساب الرصيد التراكمي وتحديد النطاق الزمني...');

          const data = await response.json();
          const rawItems = data.items || [];
          
          const formattedItems: StatementItem[] = rawItems.map((it: any, idx: number) => ({
            id: `item-${Date.now()}-${idx}`,
            invoiceNo: it.invoiceNo || `INV-${idx + 1}`,
            date: it.date || new Date().toISOString().split('T')[0],
            customerName: it.customerName || data.customerName || 'عميل غير محدد',
            description: it.description || `فاتورة مبيعات رقم ${it.invoiceNo || idx + 1}`,
            debit: Number(it.debit) || 0,
            credit: Number(it.credit) || 0,
            vatAmount: Number(it.vatAmount) || 0
          }));

          const primaryCustomer = data.customerName || (formattedItems.length > 0 ? formattedItems[0].customerName : 'عميل غير محدد');
          const isConsistent = data.isCustomerConsistent !== undefined ? data.isCustomerConsistent : true;
          const detectedCusts = data.detectedCustomers || [primaryCustomer];

          const calculated = calculateStatement(formattedItems, openingBalance, primaryCustomer, isConsistent, detectedCusts);
          setStatement(calculated);
        } catch (err: any) {
          console.error('Error analyzing statement PDF:', err);
          setErrorMsg(err.message || 'حدث خطأ أثناء معالجة ملف الـ PDF');
        } finally {
          setIsProcessing(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ غير متوقع عند تحميل الملف');
      setIsProcessing(false);
    }
  };

  // Recalculate if opening balance changes
  const handleOpeningBalanceChange = (newVal: number) => {
    setOpeningBalance(newVal);
    if (statement) {
      const updated = calculateStatement(
        statement.items,
        newVal,
        statement.customerName,
        statement.isCustomerConsistent,
        statement.detectedCustomers
      );
      setStatement(updated);
    }
  };

  // Change primary customer name
  const handleCustomerNameChange = (newName: string) => {
    if (statement) {
      setStatement({
        ...statement,
        customerName: newName
      });
    }
  };

  // Add Item manually
  const handleAddItem = () => {
    if (!statement) return;
    if (!newItem.invoiceNo || !newItem.date) {
      alert('يرجى إدخال رقم المرجع/الفاتورة والتاريخ على الأقل.');
      return;
    }

    const itemToAdd: StatementItem = {
      id: `item-manual-${Date.now()}`,
      invoiceNo: newItem.invoiceNo,
      date: newItem.date,
      customerName: newItem.customerName || statement.customerName,
      description: newItem.description || `فاتورة رقم ${newItem.invoiceNo}`,
      debit: Number(newItem.debit) || 0,
      credit: Number(newItem.credit) || 0
    };

    const newItems = [...statement.items, itemToAdd];
    const updated = calculateStatement(
      newItems,
      statement.openingBalance,
      statement.customerName,
      statement.isCustomerConsistent,
      statement.detectedCustomers
    );
    setStatement(updated);

    setNewItem({
      invoiceNo: '',
      date: new Date().toISOString().split('T')[0],
      customerName: '',
      description: '',
      debit: 0,
      credit: 0
    });
  };

  // Delete Item
  const handleDeleteItem = (id: string) => {
    if (!statement) return;
    const filtered = statement.items.filter((it) => it.id !== id);
    const updated = calculateStatement(
      filtered,
      statement.openingBalance,
      statement.customerName,
      statement.isCustomerConsistent,
      statement.detectedCustomers
    );
    setStatement(updated);
  };

  // Print Statement
  const handlePrint = () => {
    window.print();
  };

  // Download PDF Statement
  const handleDownloadPDF = async () => {
    if (!statementPrintRef.current || !statement) {
      alert('لا يوجد كشف حساب جاهز للتصدير');
      return;
    }
    setIsExportingPDF(true);

    try {
      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 300));

      const targetEl = statementPrintRef.current;

      const canvas = await safeHtml2canvas(targetEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 1024,
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById('printable-statement-area') as HTMLElement;
          if (clonedEl) {
            clonedEl.style.position = 'relative';
            clonedEl.style.left = '0';
            clonedEl.style.top = '0';
            clonedEl.style.display = 'block';
            clonedEl.style.visibility = 'visible';
            clonedEl.style.width = '794px';
            clonedEl.style.margin = '0 auto';
            clonedEl.style.padding = '32px';
            clonedEl.style.backgroundColor = '#ffffff';
            clonedEl.style.direction = 'rtl';
            clonedEl.style.textAlign = 'right';
            clonedEl.style.letterSpacing = '0px';

            const allEl = clonedEl.querySelectorAll('*');
            allEl.forEach((node) => {
              const htmlNode = node as HTMLElement;
              htmlNode.style.letterSpacing = '0px';
              htmlNode.style.fontFamily = "'Cairo', Tahoma, sans-serif";
              htmlNode.style.visibility = 'visible';
            });
          }
        }
      });

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('فشلت معالجة صورة كشف الحساب.');
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const canvasRatio = canvas.height / canvas.width;
      let finalWidth = pdfWidth;
      let finalHeight = pdfWidth * canvasRatio;

      if (finalHeight > pdfHeight) {
        let heightLeft = finalHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, finalWidth, finalHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position = heightLeft - finalHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, finalWidth, finalHeight, undefined, 'FAST');
          heightLeft -= pdfHeight;
        }
      } else {
        pdf.addImage(imgData, 'JPEG', 0, 0, finalWidth, finalHeight, undefined, 'FAST');
      }

      const safeCustomer = (statement.customerName || 'كشف_حساب').replace(/[^\w\u0600-\u06FF]/g, '_');
      const fileName = `كشف_حساب_${safeCustomer}_${statement.statementNo}.pdf`;

      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      alert('حدث خطأ أثناء حفظ ملف الـ PDF. يمكنك استخدام زر الطباعة وحفظ الصفحة كـ PDF.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const filteredItems = statement ? statement.items.filter((it) => 
    it.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    it.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    it.date.includes(searchQuery) ||
    it.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-[2.5rem] p-8 shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold">
              <Sparkles size={14} className="text-amber-400 animate-pulse" />
              <span>وحدة كشف الحساب الذكية مع الذكاء الاصطناعي</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white">كشف الحساب الآلي ومطابقة الفواتير المدمجة</h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              قم برفع ملف PDF مدمج يحتوي على عدة فواتير ليقوم النظام باستخراج البيانات بذكاء، تحديد الفترة الزمنية من أقدم لأحدث فاتورة، مطابقة بيانات العميل، وحساب الرصيد المتراكم وتصديره كملف جاهز للطباعة.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs md:text-sm transition-all flex items-center gap-2 border border-white/10"
              >
                <ArrowRight size={18} />
                <span>رجوع</span>
              </button>
            )}
            {statement && (
              <>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs md:text-sm transition-all flex items-center gap-2 border border-white/10"
                >
                  <Printer size={18} />
                  <span>طباعة</span>
                </button>

                <button
                  onClick={handleDownloadPDF}
                  disabled={isExportingPDF}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs md:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isExportingPDF ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Download size={18} />
                  )}
                  <span>تنزيل كملف PDF</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload Zone & Controls if no statement or to re-upload */}
      {!statement ? (
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-200 shadow-xl text-center space-y-8">
          <div className="max-w-xl mx-auto space-y-4">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner border border-indigo-100">
              <Upload size={36} />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-800">رفع ملف الفواتير المدمج (PDF)</h2>
            <p className="text-slate-500 text-sm">
              اسحب وأفلت ملف PDF المحتوي على مجموعة فواتير، أو اضغط للاختيار من جهازك.
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            className={`border-3 border-dashed rounded-[2rem] p-10 cursor-pointer transition-all max-w-2xl mx-auto flex flex-col items-center justify-center gap-4 ${
              isProcessing
                ? 'border-indigo-400 bg-indigo-50/50 pointer-events-none'
                : 'border-slate-300 hover:border-indigo-500 hover:bg-slate-50/80 bg-white'
            }`}
          >
            {isProcessing ? (
              <div className="space-y-4 py-6">
                <RefreshCw size={40} className="animate-spin text-indigo-600 mx-auto" />
                <div className="space-y-1">
                  <p className="font-bold text-indigo-900 text-lg">{processingStep}</p>
                  <p className="text-slate-500 text-xs">يتم الاستخراج والربط آلياً عبر نماذج AI Studio Multimodal Vision</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 text-indigo-600 font-bold bg-indigo-50 px-5 py-2.5 rounded-2xl border border-indigo-100 text-sm">
                  <FileText size={18} />
                  <span>اختيار ملف PDF للفواتير</span>
                </div>
                <span className="text-xs text-slate-400">يدعم كافة ملفات الـ PDF المدمجة متعددة الصفحات</span>
              </>
            )}
          </div>

          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold flex items-center justify-center gap-3 max-w-xl mx-auto">
              <AlertTriangle size={20} className="text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right pt-6 border-t border-slate-100 max-w-4xl mx-auto">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">قراءة آلية بالذكاء الاصطناعي</h3>
              <p className="text-xs text-slate-500 leading-relaxed">استخراج أرقام الفواتير، التواريخ، المبالغ، والضريبة من ملف PDF واحد بدون إدخال يدوي.</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Calendar size={20} />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">فترة زمنية تلقائية ورصيد متراكم</h3>
              <p className="text-xs text-slate-500 leading-relaxed">تحديد البداية من أقدم فاتورة والنهاية لأحدث فاتورة، مع حساب متتالية الرصيد المتراكم.</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Printer size={20} />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">تصدير وطباعة منسقة جاهزة</h3>
              <p className="text-xs text-slate-500 leading-relaxed">إنشاء جدول كشف حساب منسق يحمل معلومات المنشأة وتفاصيل العميل والتوقيع للطباعة مباشرة.</p>
            </div>
          </div>
        </div>
      ) : (
        /* Main Statement Dashboard & Preview */
        <div className="space-y-8">
          {/* Top Info & Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Customer & Period Box */}
            <div className="lg:col-span-2 bg-white rounded-[2rem] p-6 border border-slate-200 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 block">اسم العميل المعتمد</span>
                    <input
                      type="text"
                      value={statement.customerName}
                      onChange={(e) => handleCustomerNameChange(e.target.value)}
                      className="font-black text-slate-800 text-lg bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 mt-0.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                    />
                  </div>
                </div>

                {/* Consistency Badge */}
                {statement.isCustomerConsistent ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shrink-0">
                    <CheckCircle2 size={16} />
                    <span>عميل مطابق بالكامل</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shrink-0">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <span>تم رصد أسماء عملاء متعددة</span>
                  </div>
                )}
              </div>

              {!statement.isCustomerConsistent && statement.detectedCustomers && statement.detectedCustomers.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/60 text-xs text-amber-900 space-y-1">
                  <span className="font-bold block">العملاء الذين تم رصدهم في المستند:</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {statement.detectedCustomers.map((cust, i) => (
                      <button
                        key={i}
                        onClick={() => handleCustomerNameChange(cust)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-slate-800 font-bold hover:bg-amber-100 transition-all text-xs"
                      >
                        {cust}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Calendar size={14} /> أقدّم تاريخ (من)
                  </span>
                  <span className="font-black text-slate-800 text-xs md:text-sm dir-ltr block text-right">{statement.startDate}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Calendar size={14} /> أحدث تاريخ (إلى)
                  </span>
                  <span className="font-black text-slate-800 text-xs md:text-sm dir-ltr block text-right">{statement.endDate}</span>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1">
                  <span className="text-xs font-bold text-indigo-800 flex items-center gap-1">
                    <Calendar size={14} className="text-indigo-600" /> تاريخ الطباعة / الإصدار
                  </span>
                  <input
                    type="date"
                    value={statement.createdDate}
                    onChange={(e) => handleCreatedDateChange(e.target.value)}
                    className="font-bold text-slate-900 text-xs bg-white border border-indigo-300 rounded-lg px-2 py-0.5 focus:ring-2 focus:ring-indigo-500 outline-none w-full dir-ltr text-right"
                  />
                </div>
              </div>
            </div>

            {/* Balances & Controls Box */}
            <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-md space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 block">الرصيد الافتتاحي (رس)</span>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => handleOpeningBalanceChange(Number(e.target.value) || 0)}
                  className="w-full text-lg font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 space-y-1">
                <span className="text-xs font-bold text-blue-700 block">إجمالي الفواتير (المدين)</span>
                <span className="font-black text-blue-950 text-xl block">
                  {statement.totalDebit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 space-y-1">
                <span className="text-xs font-bold text-emerald-700 block">إجمالي المقبوضات (الدائن)</span>
                <span className="font-black text-emerald-950 text-xl block">
                  {statement.totalCredit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
                </span>
              </div>
            </div>

            {/* Net Final Balance Box */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-[2rem] p-6 shadow-md border border-indigo-900/40 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-indigo-300 block">الرصيد المستحق النهائي (المتراكم)</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingNetBalance(!isEditingNetBalance)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition-all flex items-center gap-1.5"
                  >
                    <Edit3 size={12} />
                    <span>{isEditingNetBalance ? 'إغلاق التعديل' : 'تعديل الرصيد يدوياً'}</span>
                  </button>
                </div>

                {isEditingNetBalance ? (
                  <div className="space-y-2 pt-1">
                    <label className="text-[11px] text-amber-300 font-bold block">أدخل الرصيد النهائي المعدل يدوياً (ر.س):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={statement.netBalance}
                        onChange={(e) => handleManualNetBalanceChange(Number(e.target.value) || 0)}
                        className="w-full text-xl font-black text-amber-400 bg-black/60 border-2 border-amber-400/80 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      <button
                        type="button"
                        onClick={handleResetNetBalance}
                        className="px-3 py-2 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-xl text-indigo-200 whitespace-nowrap transition-all border border-white/10"
                        title="إعادة تعيين للرصيد المحسوب تلقائياً"
                      >
                        تلقائي
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-3xl font-black text-amber-400">
                    {statement.netBalance.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} <span className="text-sm font-bold text-white">ر.س</span>
                  </div>
                )}

                <p className="text-xs text-slate-300 pt-1">
                  {statement.netBalance > 0 ? 'المبلغ مطلوب من العميل' : statement.netBalance < 0 ? 'المبلغ لصالح العميل' : 'الحساب متزن بالملاصة'}
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setStatement(null);
                    setSelectedFile(null);
                  }}
                  className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={14} />
                  <span>رفع ملف آخر</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all border border-white/10"
                  >
                    <Printer size={14} />
                    <span>طباعة</span>
                  </button>

                  <button
                    onClick={handleDownloadPDF}
                    disabled={isExportingPDF}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
                  >
                    {isExportingPDF ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    <span>تنزيل PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Add Manual Transaction & Search Toolbar */}
          <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-md space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Calculator size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">جدول حركات الفواتير المستخرجة ({filteredItems.length})</h3>
                  <p className="text-slate-400 text-xs">مرتبة تسلسلياً بحسب التاريخ مع حساب التراكمي المباشر</p>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative max-w-xs w-full">
                <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث برقم الفاتورة أو البيان..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Quick Add Form */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">رقم الفاتورة/المرجع</label>
                <input
                  type="text"
                  placeholder="INV-100"
                  value={newItem.invoiceNo}
                  onChange={(e) => setNewItem({ ...newItem, invoiceNo: e.target.value })}
                  className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">التاريخ</label>
                <input
                  type="date"
                  value={newItem.date}
                  onChange={(e) => setNewItem({ ...newItem, date: e.target.value })}
                  className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 block mb-1">البيان / الوصف</label>
                <input
                  type="text"
                  placeholder="فاتورة مبيعات أو سند قبض"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">مدين (المبلغ المستحق)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newItem.debit || ''}
                  onChange={(e) => setNewItem({ ...newItem, debit: Number(e.target.value) || 0 })}
                  className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <button
                onClick={handleAddItem}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow"
              >
                <Plus size={16} />
                <span>إضافة حركة</span>
              </button>
            </div>

            {/* Table of Statement Items */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                    <th className="p-3.5 w-12 text-center">#</th>
                    <th className="p-3.5">تاريخ الحركة</th>
                    <th className="p-3.5">رقم الفاتورة المرجعي</th>
                    <th className="p-3.5">البيان والتفاصيل</th>
                    <th className="p-3.5 text-blue-300 text-left">مدين (ر.س)</th>
                    <th className="p-3.5 text-emerald-300 text-left">دائن (ر.س)</th>
                    <th className="p-3.5 text-amber-300 text-left">الرصيد المتراكم</th>
                    <th className="p-3.5 w-16 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50 font-bold text-slate-600">
                    <td className="p-3.5 text-center text-slate-400">-</td>
                    <td className="p-3.5 dir-ltr text-right">{statement.startDate}</td>
                    <td className="p-3.5 text-slate-500">رصيد سابق / افتتاحي</td>
                    <td className="p-3.5 text-slate-500">الرصيد المرحل بداية الفترة</td>
                    <td className="p-3.5 text-left font-mono">{statement.openingBalance > 0 ? statement.openingBalance.toFixed(2) : '-'}</td>
                    <td className="p-3.5 text-left font-mono">{statement.openingBalance < 0 ? Math.abs(statement.openingBalance).toFixed(2) : '-'}</td>
                    <td className="p-3.5 text-left font-mono text-slate-900 font-black">{statement.openingBalance.toFixed(2)}</td>
                    <td className="p-3.5"></td>
                  </tr>

                  {filteredItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-slate-700 dir-ltr text-right">{item.date}</td>
                      <td className="p-3.5 font-black text-indigo-600">
                        <span className="bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                          {item.invoiceNo}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-800 font-medium">{item.description}</td>
                      <td className="p-3.5 text-left font-mono font-bold text-blue-700">
                        {item.debit > 0 ? item.debit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="p-3.5 text-left font-mono font-bold text-emerald-700">
                        {item.credit > 0 ? item.credit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="p-3.5 text-left font-mono font-black text-slate-900 bg-amber-50/30">
                        {(item.runningBalance || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="حذف الحركة"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black text-sm">
                    <td colSpan={4} className="p-4 text-right">الإجمالي النهائي</td>
                    <td className="p-4 text-left font-mono text-blue-300">
                      {statement.totalDebit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-left font-mono text-emerald-300">
                      {statement.totalCredit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-left font-mono text-amber-400 text-base">
                      {statement.netBalance.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Printable Statement Layout (Off-screen on Screen for PDF Export, Shown when Printing) */}
          <div ref={statementPrintRef} id="printable-statement-area" className="receipt-container font-['Cairo'] p-8 bg-white text-slate-900 absolute left-[-9999px] top-0 w-[794px] print:static print:left-0 print:w-full print:block pointer-events-none print:pointer-events-auto" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-6 mb-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-slate-900">{settings.name || 'اسم المنشأة'}</h1>
                <p className="text-xs text-slate-600">{settings.address || 'العنوان'}</p>
                <div className="text-xs text-slate-600 flex gap-4 pt-1">
                  <span>رقم الضريبة: {settings.taxNo || 'غير مدخل'}</span>
                  <span>السجل التجاري: {settings.crNo || 'غير مدخل'}</span>
                </div>
              </div>

              {settings.logo && (
                <img src={settings.logo} alt="Logo" className="max-h-20 max-w-[180px] object-contain" />
              )}
            </div>

            <div className="text-center my-6 space-y-1">
              <h2 className="text-xl font-black text-slate-900 bg-slate-100 py-2 rounded-lg border border-slate-300">
                كشف حساب عميل (Account Statement)
              </h2>
              <p className="text-xs text-slate-500">رقم الكشف: {statement.statementNo} | تاريخ الإصدار: {statement.createdDate}</p>
            </div>

            {/* Statement Customer & Period Info Box */}
            <table className="w-full border-collapse border border-slate-300 rounded-xl mb-6 text-xs bg-slate-50 text-right" style={{ direction: 'rtl' }}>
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="p-3 border-l border-slate-300 w-1/2 align-top text-right">
                    <span className="font-bold text-slate-600">اسم العميل: </span>
                    <strong className="font-black text-slate-900 text-sm">{statement.customerName || 'غير محدد'}</strong>
                  </td>
                  <td className="p-3 w-1/2 align-top text-right">
                    <span className="font-bold text-slate-600">الفترة المالية: </span>
                    <strong className="font-black text-slate-900">من {statement.startDate} إلى {statement.endDate}</strong>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 border-l border-slate-300 w-1/2 align-top text-right">
                    <span className="font-bold text-slate-600">الرصيد الافتتاحي: </span>
                    <strong className="font-black text-slate-900">{statement.openingBalance.toFixed(2)} ر.س</strong>
                  </td>
                  <td className="p-3 w-1/2 align-top text-right">
                    <span className="font-bold text-slate-600">إجمالي عدد الفواتير: </span>
                    <strong className="font-black text-slate-900">{statement.items.length} فاتورة</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Main Print Table */}
            <table className="w-full text-right border-collapse text-xs mb-8">
              <thead>
                <tr className="bg-slate-900 text-white font-bold">
                  <th className="p-2 border border-slate-900 text-center w-10">#</th>
                  <th className="p-2 border border-slate-900">التاريخ</th>
                  <th className="p-2 border border-slate-900">رقم الفاتورة المرجعي</th>
                  <th className="p-2 border border-slate-900">البيان التفصيلي</th>
                  <th className="p-2 border border-slate-900 text-left">مدين (ر.س)</th>
                  <th className="p-2 border border-slate-900 text-left">دائن (ر.س)</th>
                  <th className="p-2 border border-slate-900 text-left">الرصيد المتراكم</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-100 font-bold">
                  <td className="p-2 border border-slate-300 text-center">-</td>
                  <td className="p-2 border border-slate-300">{statement.startDate}</td>
                  <td className="p-2 border border-slate-300">رصيد سابق</td>
                  <td className="p-2 border border-slate-300">الرصيد الافتتاحي المستحق بداية الفترة</td>
                  <td className="p-2 border border-slate-300 text-left font-mono">{statement.openingBalance > 0 ? statement.openingBalance.toFixed(2) : '-'}</td>
                  <td className="p-2 border border-slate-300 text-left font-mono">{statement.openingBalance < 0 ? Math.abs(statement.openingBalance).toFixed(2) : '-'}</td>
                  <td className="p-2 border border-slate-300 text-left font-mono font-black">{statement.openingBalance.toFixed(2)}</td>
                </tr>

                {statement.items.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-200">
                    <td className="p-2 border border-slate-300 text-center font-bold">{index + 1}</td>
                    <td className="p-2 border border-slate-300 font-bold text-right">{item.date}</td>
                    <td className="p-2 border border-slate-300 font-bold text-slate-800">{item.invoiceNo}</td>
                    <td className="p-2 border border-slate-300">{item.description}</td>
                    <td className="p-2 border border-slate-300 text-left font-mono font-bold">
                      {item.debit > 0 ? item.debit.toFixed(2) : '-'}
                    </td>
                    <td className="p-2 border border-slate-300 text-left font-mono font-bold">
                      {item.credit > 0 ? item.credit.toFixed(2) : '-'}
                    </td>
                    <td className="p-2 border border-slate-300 text-left font-mono font-black">
                      {(item.runningBalance || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-black">
                  <td colSpan={4} className="p-2.5 border border-slate-900 text-right">المجموع الكلي</td>
                  <td className="p-2.5 border border-slate-900 text-left font-mono">{statement.totalDebit.toFixed(2)}</td>
                  <td className="p-2.5 border border-slate-900 text-left font-mono">{statement.totalCredit.toFixed(2)}</td>
                  <td className="p-2.5 border border-slate-900 text-left font-mono text-amber-300">{statement.netBalance.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Summary Box & Signatures */}
            <table className="w-full border-collapse pt-6 border-t border-slate-300 text-xs" style={{ direction: 'rtl', textAlign: 'right' }}>
              <tbody>
                <tr>
                  <td className="w-1/2 align-top p-2 space-y-2">
                    <span className="font-bold text-slate-700 block">ملخص كشف الحساب:</span>
                    <p className="text-slate-600 leading-relaxed">
                      الرصيد المستحق النهائي قدره (<strong className="text-slate-900">{statement.netBalance.toFixed(2)} ريال سعودي</strong>).
                      يرجى المطابقة والاعتماد وإشعار الإدارة المالية في حال وجود أي ملاحظات خلال 7 أيام.
                    </p>
                  </td>
                  <td className="w-1/2 align-top p-2">
                    <div className="flex justify-between items-center text-center text-xs space-x-4 dir-rtl">
                      <div className="space-y-6">
                        <span className="font-bold text-slate-700 block">توقيع المحاسب المسؤول</span>
                        <div className="h-10 border-b border-dashed border-slate-400 w-32 mx-auto"></div>
                      </div>

                      <div className="space-y-6">
                        <span className="font-bold text-slate-700 block">ختم واعتماد المنشأة</span>
                        {settings.stamp ? (
                          <img src={settings.stamp} alt="Stamp" className="h-14 object-contain mx-auto" />
                        ) : (
                          <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-300 mx-auto flex items-center justify-center text-[10px] text-slate-400">
                            مكان الختم
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
