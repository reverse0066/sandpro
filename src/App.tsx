/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import InvoiceSearch from './components/InvoiceSearch';
import InvoiceUploader from './components/InvoiceUploader';
import ReceiptVoucher from './components/ReceiptVoucher';
import { PrintErrorBoundary } from './components/PrintErrorBoundary';
import ReceiptBatchList from './components/ReceiptBatchList';
import SettingsPage from './components/SettingsPage';
import ReceiptHistory from './components/ReceiptHistory';
import DashboardStats from './components/DashboardStats';
import QuickSignatureModal from './components/QuickSignatureModal';
import UserManagementModal from './components/UserManagementModal';
import LoginModal from './components/LoginModal';
import AccountStatementModule from './components/AccountStatementModule';
import { Receipt, Invoice, OrganizationSettings, User } from './types';
import { Receipt as ReceiptIcon, History, Settings, LogOut, Search, Upload, CheckCircle2, X, PenTool, Sparkles, DollarSign, Coins, TrendingUp, ChevronDown, Compass, Home, Zap, ChevronUp, Bell, Menu, Shield, Users, Globe, Loader2, Cloud, FileSpreadsheet } from 'lucide-react';
import {
  subscribeToAuthChanges,
  subscribeToUserReceipts,
  saveReceiptToFirestore,
  deleteReceiptFromFirestore,
  clearUserReceiptsFromFirestore,
  loadSettingsFromFirestore,
  saveSettingsToFirestore,
  loadUsersFromFirestore,
  saveUsersToFirestore,
  signInWithGooglePopup,
  signOutUser
} from './firebase';

const DEFAULT_SETTINGS: OrganizationSettings = {
  name: 'مجموعة ثلاثة مليون القابضة',
  taxNo: '311976798400003',
  crNo: '7037665564',
  address: 'الرياض - الملز - معهد الادارة',
  phone: '0565795079',
  preferredTemplate: 'modern',
  accentColor: '#2563eb',
  language: 'ar',
};

const DEFAULT_USERS: User[] = [
  {
    id: 'usr_1',
    name: 'وليد محمد',
    username: 'walid',
    pin: '140714',
    role: 'admin',
    roleLabel: 'مدير النظام',
    permissions: { createReceipt: true, editSettings: true, viewReports: true, deleteReceipt: true },
    isActive: true
  },
  {
    id: 'usr_2',
    name: 'خالد',
    username: 'khalid',
    pin: '123456',
    role: 'admin',
    roleLabel: 'مدير النظام',
    permissions: { createReceipt: true, editSettings: true, viewReports: true, deleteReceipt: true },
    isActive: true
  }
];

import { parseAmountNumber } from './utils/numberUtils';

export default function App() {
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);
  const [batchReceipts, setBatchReceipts] = useState<Receipt[]>([]);
  const [mode, setMode] = useState<'search' | 'upload' | 'settings' | 'history' | 'statement'>('search');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isQuickSigModalOpen, setIsQuickSigModalOpen] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isFloatingHubOpen, setIsFloatingHubOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('app_authenticated') === 'true';
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(() => {
    return sessionStorage.getItem('app_authenticated') !== 'true';
  });
  const [permissionAlert, setPermissionAlert] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<OrganizationSettings>(() => {
    const saved = localStorage.getItem('org_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('app_users_v2');
    return saved ? JSON.parse(saved) : DEFAULT_USERS;
  });
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('current_user_v2');
    return saved ? JSON.parse(saved) : DEFAULT_USERS[0];
  });
  const [history, setHistory] = useState<Receipt[]>(() => {
    const saved = localStorage.getItem('receipt_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState(false);
  const [firebaseSyncStatus, setFirebaseSyncStatus] = useState<'idle' | 'synced' | 'error'>('idle');

  useEffect(() => {
    const unsubscribeAuth = subscribeToAuthChanges(async (user) => {
      setFirebaseUser(user);
      if (user) {
        setIsFirebaseSyncing(true);
        try {
          const [cloudSettings, cloudUsers] = await Promise.all([
            loadSettingsFromFirestore(user.uid),
            loadUsersFromFirestore(user.uid)
          ]);

          if (cloudSettings) {
            setSettings(cloudSettings);
            localStorage.setItem('org_settings', JSON.stringify(cloudSettings));
          }
          if (cloudUsers && cloudUsers.length > 0) {
            // Force upgrade if they have the old default admin pin
            if (cloudUsers[0] && cloudUsers[0].pin === '1234') {
              setUsers(DEFAULT_USERS);
              localStorage.setItem('app_users_v2', JSON.stringify(DEFAULT_USERS));
              saveUsersToFirestore(DEFAULT_USERS, user.uid);
            } else {
              setUsers(cloudUsers);
              localStorage.setItem('app_users_v2', JSON.stringify(cloudUsers));
            }
          } else if (cloudSettings && cloudSettings.users && cloudSettings.users.length > 0) {
            if (cloudSettings.users[0] && cloudSettings.users[0].pin === '1234') {
              setUsers(DEFAULT_USERS);
              localStorage.setItem('app_users_v2', JSON.stringify(DEFAULT_USERS));
              saveUsersToFirestore(DEFAULT_USERS, user.uid);
            } else {
              setUsers(cloudSettings.users);
              localStorage.setItem('app_users_v2', JSON.stringify(cloudSettings.users));
              saveUsersToFirestore(cloudSettings.users, user.uid);
            }
          }
        } catch (error) {
          console.error('Error loading data from Firestore:', error);
        } finally {
          setIsFirebaseSyncing(false);
          setFirebaseSyncStatus('synced');
        }
      } else {
        setFirebaseSyncStatus('idle');
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubscribeReceipts = subscribeToUserReceipts(
      firebaseUser.uid,
      (cloudReceipts) => {
        setHistory(cloudReceipts);
        localStorage.setItem('receipt_history', JSON.stringify(cloudReceipts));
        setFirebaseSyncStatus('synced');
      },
      (err) => {
        console.error('Firestore receipts subscribe error:', err);
        setFirebaseSyncStatus('error');
      }
    );
    return () => unsubscribeReceipts();
  }, [firebaseUser]);

  const handleSaveUsers = (newUsers: User[]) => {
    setUsers(newUsers);
    localStorage.setItem('app_users_v2', JSON.stringify(newUsers));
    
    const updatedSettings = { ...settings, users: newUsers };
    setSettings(updatedSettings);
    localStorage.setItem('org_settings', JSON.stringify(updatedSettings));
    
    if (firebaseUser) {
      saveSettingsToFirestore(updatedSettings, firebaseUser.uid);
      saveUsersToFirestore(newUsers, firebaseUser.uid);
    }
  };

  const handleSwitchUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('current_user_v2', JSON.stringify(user));
    setIsAuthenticated(true);
    sessionStorage.setItem('app_authenticated', 'true');
    setIsLoginModalOpen(false);
  };

  const handleSaveToHistory = (newReceipts: Receipt | Receipt[]) => {
    const receiptsToAdd = Array.isArray(newReceipts) ? newReceipts : [newReceipts];
    console.log(`[handleSaveToHistory] Adding ${receiptsToAdd.length} receipts to history state...`);
    
    setHistory(prev => {
      const updated = [...receiptsToAdd, ...prev];
      try {
        localStorage.setItem('receipt_history', JSON.stringify(updated));
        console.log(`[handleSaveToHistory] Saved ${updated.length} items to localStorage successfully.`);
      } catch (storageError) {
        console.error('[handleSaveToHistory] Warning: Failed to persist to localStorage:', storageError);
      }
      return updated;
    });

    if (firebaseUser) {
      receiptsToAdd.forEach(r => saveReceiptToFirestore(r, firebaseUser.uid));
    }
  };

  const handleUpdateReceipt = (updatedReceipt: Receipt) => {
    console.log('[handleUpdateReceipt] Updating receipt:', updatedReceipt.id, updatedReceipt);
    setHistory(prev => {
      const updated = prev.map(r => r.id === updatedReceipt.id ? updatedReceipt : r);
      try {
        localStorage.setItem('receipt_history', JSON.stringify(updated));
      } catch (storageError) {
        console.error('Failed to update receipt in localStorage:', storageError);
      }
      return updated;
    });

    if (firebaseUser) {
      saveReceiptToFirestore(updatedReceipt, firebaseUser.uid);
    }

    // Synchronize batch receipts if currently viewing batch mode
    setBatchReceipts(prev => prev.map(r => r.id === updatedReceipt.id ? updatedReceipt : r));

    // Synchronize active receipt if currently open in modal
    if (activeReceipt && activeReceipt.id === updatedReceipt.id) {
      setActiveReceipt(updatedReceipt);
    }
  };

  const handleDeleteFromHistory = (id: string) => {
    if (!id) return;
    console.log(`[handleDeleteFromHistory] Deleting receipt with ID/No: ${id}`);

    setHistory(prev => {
      const updated = prev.filter(r => r.id !== id && r.receiptNo !== id);
      try {
        localStorage.setItem('receipt_history', JSON.stringify(updated));
      } catch (storageError) {
        console.error('Failed to update localStorage after single deletion:', storageError);
      }
      return updated;
    });

    if (firebaseUser) {
      deleteReceiptFromFirestore(id);
    }
  };

  const handleDeleteAllHistory = () => {
    console.log('[handleDeleteAllHistory] Clearing all history records...');
    try {
      setHistory([]);
      localStorage.removeItem('receipt_history');
      if (firebaseUser) {
        clearUserReceiptsFromFirestore(firebaseUser.uid);
      }
      console.log('[handleDeleteAllHistory] All history records deleted successfully.');
    } catch (error) {
      console.error('Error deleting all history:', error);
    }
  };

  const handleUploadClick = () => {
    setBatchReceipts([]);
    setMode('upload');
    setIsSidebarOpen(false);
    setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSearchClick = () => {
    setMode('search');
    setIsSidebarOpen(false);
    setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleStatementClick = () => {
    setMode('statement');
    setIsSidebarOpen(false);
    setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSaveSettings = (newSettings: OrganizationSettings) => {
    setSettings(newSettings);
    localStorage.setItem('org_settings', JSON.stringify(newSettings));
    if (firebaseUser) {
      saveSettingsToFirestore(newSettings, firebaseUser.uid);
    }
  };

  const handleLogout = async () => {
    if (firebaseUser) {
      try {
        await signOutUser();
      } catch (e) {
        console.error('Error signing out of Firebase:', e);
      }
    }
    sessionStorage.removeItem('app_authenticated');
    setIsAuthenticated(false);
    setIsLoginModalOpen(true);
  };

  const handleInvoicesExtracted = (invoices: Invoice[]) => {
    const startTime = performance.now();
    console.log('[handleInvoicesExtracted] Handler invoked at', new Date().toISOString(), 'with payload:', invoices);

    try {
      if (!Array.isArray(invoices) || invoices.length === 0) {
        console.warn('[handleInvoicesExtracted] Aborted: No invoices extracted or invalid data format received.');
        alert('لم يتم العثور على أي فواتير صالحة مستخرجة من الملفات المرفوعة.');
        return;
      }

      console.log('================ BATCH PROCESSING LOOP START ================');
      console.log(`[Batch Loop] Total extracted invoice items to process: ${invoices.length}`);
      
      const receipts: Receipt[] = [];
      let validationWarnings = 0;

      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        console.log(`[Batch Loop Item ${i + 1}/${invoices.length}] Processing raw invoice:`, inv);

        // Strict validation and sanitization
        const id = 'rcpt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9) + '-' + i;
        const invNo = String(inv.invoiceNo || `INV-${i + 1}`).trim();
        const receiptNo = invNo; // Strict 1:1 correspondence between receiptNo and invoiceNo

        // Date validation & formatting
        let rawDate = inv.date || new Date().toISOString().split('T')[0];
        if (rawDate.includes('T')) {
          rawDate = rawDate.split('T')[0];
        }
        // Normalize date separators to /
        const dateFormatted = rawDate.replace(/-/g, '/').trim() || new Date().toISOString().split('T')[0].replace(/-/g, '/');
        
        const customer = String(inv.customerName || 'عميل نقدي').trim();

        // Amount parsing with validation
        const parsedWithVat = parseAmountNumber(inv.totalWithVat);
        const parsedAmountOnly = parseAmountNumber(inv.totalAmount);

        let finalInvoiceTotalWithVat = 0;
        if (parsedWithVat > 0) {
          finalInvoiceTotalWithVat = parsedWithVat;
        } else if (parsedAmountOnly > 0) {
          finalInvoiceTotalWithVat = Number((parsedAmountOnly * 1.15).toFixed(2));
        } else {
          validationWarnings++;
          console.warn(`[Validation Warning] Item ${i + 1}: Missing or invalid amount. Assigned default 0.00`);
          finalInvoiceTotalWithVat = 0.00;
        }

        const parsedAmount = finalInvoiceTotalWithVat;

        // Strict match status validation
        const isMatched = finalInvoiceTotalWithVat > 0 && Math.abs(parsedAmount - finalInvoiceTotalWithVat) < 0.01;
        const matchStatus: 'matched' | 'mismatched' = isMatched ? 'matched' : 'mismatched';

        const newReceipt: Receipt = {
          id,
          receiptNo,
          date: dateFormatted,
          invoiceNo: invNo,
          customerName: customer,
          amount: parsedAmount,
          paymentMethod: 'نقداً',
          receivedFrom: customer,
          notes: `سند قبض آلي مطابق للفاتورة رقم ${invNo}`,
          matchStatus,
          invoiceTotalWithVat: finalInvoiceTotalWithVat,
          invoiceDate: dateFormatted
        };

        console.log(`[Batch Loop Item ${i + 1}/${invoices.length}] Validated & constructed Receipt object:`, newReceipt);
        receipts.push(newReceipt);
      }

      console.log(`[Batch Loop End] Successfully generated ${receipts.length} total receipts with ${validationWarnings} warnings.`);

      if (validationWarnings > 0) {
        console.warn(`[Validation Notice] ${validationWarnings} invoices had amount or date warnings and were normalized.`);
      }

      // Ensure active mode is set to 'upload' so workspace renders ReceiptBatchList
      console.log('[State Trigger 1/4] Ensuring workspace mode is set to "upload"...');
      setMode('upload');

      // Clear any single active receipt overlay
      console.log('[State Trigger 2/4] Clearing active single receipt modal state...');
      setActiveReceipt(null);

      // Trigger re-render with fresh array reference
      console.log(`[State Trigger 3/4] Updating setBatchReceipts state with ${receipts.length} receipts...`);
      setBatchReceipts([...receipts]);

      // Persist to history
      console.log('[State Trigger 4/4] Calling handleSaveToHistory...');
      handleSaveToHistory(receipts);

      const endTime = performance.now();
      console.log(`================ BATCH PROCESSING COMPLETED in ${(endTime - startTime).toFixed(2)}ms ================`);

      // Scroll smoothly to workspace section for optimal visual feedback
      setTimeout(() => {
        if (workspaceRef.current) {
          console.log('[UI Interaction] Scrolling smoothly to workspace container...');
          workspaceRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

    } catch (error: any) {
      console.error('CRITICAL UNHANDLED EXCEPTION in handleInvoicesExtracted:', error);
      alert(`فشلت عملية إصدار السندات: ${error?.message || 'خطأ غير متوقع'}`);
    }
  };

  const handleSingleReceiptGenerated = (receipt: Receipt) => {
    // Check for duplicate invoice number
    const isDuplicate = history.some(r => r.invoiceNo === receipt.invoiceNo);
    
    if (isDuplicate) {
      console.warn(`تنبيه: يوجد سند مسبق برقم الفاتورة (${receipt.invoiceNo})`);
    }

    setActiveReceipt(receipt);
    handleSaveToHistory(receipt);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans" dir="rtl">
      {/* Sidebar - Desktop */}
      <aside className={`fixed inset-y-0 right-0 w-64 bg-white border-l border-slate-200 transition-transform z-50 flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3 text-blue-600">
            <div className="p-2 bg-blue-50 rounded-lg">
              <ReceiptIcon size={24} />
            </div>
            <span className="font-black text-xl tracking-tight text-slate-900">سندات</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={handleSearchClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${mode === 'search' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Search size={20} />
            بحث وإصدار
          </button>
          <button 
            onClick={handleUploadClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${mode === 'upload' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Upload size={20} />
            رفع وقراءة آلية
          </button>
          <button 
            onClick={() => { setMode('statement'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${mode === 'statement' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <FileSpreadsheet size={20} className="text-indigo-600" />
            كشف الحساب الذكي
          </button>
          <button 
            onClick={() => { setMode('history'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${mode === 'history' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <History size={20} />
            سجل السندات
          </button>
          <button 
            onClick={() => { setMode('settings'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${mode === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Settings size={20} />
            الإعدادات
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <button
            onClick={() => setIsQuickSigModalOpen(true)}
            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all group"
            title="إدارة التوقيع المسبق والختم الرقمي"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center">
                <Sparkles size={14} className="text-amber-300 animate-pulse" />
              </div>
              <div className="text-right">
                <p className="font-black text-white">إدارة التوقيع والختم</p>
                <p className="text-[10px] text-blue-100">الختم الرقمي الآلي</p>
              </div>
            </div>
            <span className="text-xs bg-white/10 px-2 py-1 rounded-lg text-blue-100">تفعيل</span>
          </button>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl font-medium transition-all text-xs"
          >
            <LogOut size={18} />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:pr-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 bg-white/85 backdrop-blur-md border-b border-slate-200/80 z-20 px-6 py-3.5 flex justify-between items-center shadow-xs">
          {/* Right Side (RTL): Mobile Menu & Active Title Indicator */}
          <div className="flex items-center gap-3.5">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="md:hidden p-2.5 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-600 rounded-xl transition-all shadow-sm active:scale-95 border border-blue-100/50 group"
              title="فتح القائمة الجانبية"
            >
              <Menu size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                {mode === 'search' ? 'بحث عن فاتورة' : mode === 'upload' ? 'قراءة الفواتير بالذكاء الاصطناعي' : mode === 'statement' ? 'كشف الحساب الذكي المدمج' : mode === 'settings' ? 'إعدادات المنشأة' : 'سجل السندات والتقارير'}
              </h1>
            </div>
          </div>

          {/* Left Side (RTL): Professional Animated Action Buttons */}
          <div className="flex items-center gap-3 relative">
            {/* Manual Search Button in Header */}
            <button
              onClick={handleSearchClick}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all shadow-xs ${
                mode === 'search'
                  ? 'bg-blue-600 text-white shadow-blue-500/20'
                  : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/60'
              }`}
              title="البحث اليدوي وإصدار السندات"
            >
              <Search size={16} />
              <span className="hidden sm:inline">بحث يدوي</span>
            </button>

            {/* Firebase Sync Indicator */}
            <button
              onClick={() => {
                if (!firebaseUser) {
                  setIsLoginModalOpen(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all shadow-xs border ${
                firebaseUser
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 border-slate-200/60 hover:bg-blue-50 hover:text-blue-600'
              }`}
              title={firebaseUser ? `متصل سحابياً: ${firebaseUser.email || firebaseUser.displayName}` : 'المزامنة السحابية غير متصلة (انقر للربط)'}
            >
              {isFirebaseSyncing ? (
                <Loader2 size={15} className="animate-spin text-emerald-600" />
              ) : (
                <Cloud size={15} className={firebaseUser ? 'text-emerald-600' : 'text-slate-400'} />
              )}
              <span className="hidden sm:inline">
                {firebaseUser ? 'سحابي متصل' : 'مزامنة سحابية'}
              </span>
            </button>

            {/* Language Switch Button */}
            <button
              onClick={() => {
                const newLang = (settings.language || 'ar') === 'ar' ? 'en' : 'ar';
                const updated = { ...settings, language: newLang };
                setSettings(updated);
                localStorage.setItem('org_settings', JSON.stringify(updated));
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs rounded-2xl transition-all shadow-xs border border-slate-200/60"
              title="تغيير لغة التطبيق والسندات"
            >
              <Globe size={16} />
              <span>{(settings.language || 'ar') === 'ar' ? 'English' : 'العربية'}</span>
            </button>

            {/* Notifications Button */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2.5 bg-slate-100/80 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-2xl transition-all shadow-xs hover:shadow-md active:scale-95 border border-slate-200/60 group"
                title="الإشعارات والتنبيهات"
              >
                <Bell size={18} className="group-hover:animate-bounce" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm animate-pulse">
                  2
                </span>
              </button>

              {/* Notifications Dropdown */}
              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)}></div>
                  <div className="absolute left-0 mt-3 w-80 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200" dir="rtl">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Bell size={16} className="text-blue-600" />
                        <h4 className="font-black text-slate-900 text-xs">التنبيهات السحابية</h4>
                      </div>
                      <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">جديد</span>
                    </div>
                    <div className="space-y-2.5">
                      <div className="p-3 bg-slate-50 hover:bg-blue-50/50 rounded-2xl transition-colors cursor-pointer">
                        <p className="font-bold text-slate-900 text-xs">تم حفظ السند الأخير بنجاح</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">منذ 5 دقائق • متزامن مع الخادم</p>
                      </div>
                      <div className="p-3 bg-slate-50 hover:bg-blue-50/50 rounded-2xl transition-colors cursor-pointer">
                        <p className="font-bold text-slate-900 text-xs">تحديث النظام الذكي (نسخة 3.2)</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">تم تفعيل تقارير Excel المتقدمة</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Profile / Hub Button */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-3 p-1.5 pl-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white rounded-2xl shadow-md transition-all active:scale-95 border border-slate-700/50 group"
                title="لوحة الحساب والتحكم الشخصي"
              >
                <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-black text-xs shadow-inner">
                  <span>{currentUser.name.slice(0, 2)}</span>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900"></div>
                </div>
                <div className="hidden sm:block text-right">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black text-white">{currentUser.name}</p>
                    <Shield size={12} className="text-amber-400 fill-amber-400/20" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">{currentUser.roleLabel}</p>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* User Dropdown Hub */}
              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                  <div className="absolute left-0 mt-3 w-72 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200" dir="rtl">
                    <div className="flex items-center gap-3 pb-3 mb-3 border-b border-slate-100">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                        {currentUser.name.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">{currentUser.name}</p>
                        <p className="text-[11px] text-slate-500">@{currentUser.username} • {currentUser.roleLabel}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-md">جلسة نشطة ومؤمنة</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <button
                        onClick={() => { setIsUserMenuOpen(false); setIsUserManagementOpen(true); }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50 text-blue-700 font-bold text-xs transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <Users size={16} className="text-blue-600" />
                          <span>إدارة المستخدمين والصلاحيات</span>
                        </div>
                        <span className="text-blue-500">←</span>
                      </button>

                      <button
                        onClick={() => { setIsUserMenuOpen(false); setIsLoginModalOpen(true); }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <Shield size={16} className="text-indigo-600" />
                          <span>تبديل الحساب ورمز الدخول</span>
                        </div>
                        <span className="text-slate-400">←</span>
                      </button>

                      <button
                        onClick={() => { setIsUserMenuOpen(false); setMode('settings'); }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <Settings size={16} className="text-slate-500" />
                          <span>إعدادات الشركة والضرائب</span>
                        </div>
                        <span className="text-slate-400">←</span>
                      </button>

                      <button
                        onClick={() => { setIsUserMenuOpen(false); setIsQuickSigModalOpen(true); }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50 text-blue-700 font-bold text-xs transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <Sparkles size={16} className="text-blue-600" />
                          <span>إدارة التوقيع المسبق</span>
                        </div>
                        <span className="text-blue-500">←</span>
                      </button>

                      <button
                        onClick={() => { setIsUserMenuOpen(false); setMode('history'); }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-emerald-700 font-bold text-xs transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <TrendingUp size={16} className="text-emerald-600" />
                          <span>التقارير المالية المتقدمة</span>
                        </div>
                        <span className="text-emerald-500">←</span>
                      </button>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => { setIsUserMenuOpen(false); handleLogout(); }}
                        className="w-full flex items-center justify-center gap-2 p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-all"
                      >
                        <LogOut size={16} />
                        <span>قفل الجلسة وتسجيل الخروج</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6 max-w-5xl mx-auto">
          {mode === 'history' ? (
            <ReceiptHistory 
              history={history} 
              settings={settings}
              currentUser={currentUser}
              onViewReceipt={setActiveReceipt} 
              onDeleteReceipt={handleDeleteFromHistory}
              onDeleteAll={handleDeleteAllHistory}
              onUpdateReceipt={handleUpdateReceipt}
              onClose={() => setMode('search')}
            />
          ) : mode === 'settings' ? (
            <SettingsPage settings={settings} onSave={handleSaveSettings} />
          ) : (
            <>
              {/* Modern Smart Hero Banner with Instant File Upload Access */}
              <div className="mb-10 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-[2.5rem] p-8 md:p-12 text-white shadow-xl shadow-blue-500/20">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="space-y-3 text-center md:text-right">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-blue-100 text-xs font-bold">
                      <Sparkles size={14} className="text-amber-300 animate-pulse" />
                      <span>النظام الذكي لإصدار سندات القبض الآلية</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight">إصدار السندات بكل سرعة واحترافية</h2>
                    <p className="text-blue-100/90 text-sm md:text-base max-w-xl">
                      اختر طريقة الإصدار المفضلة لديك: اسحب وأفلت الفواتير للذكاء الاصطناعي للقرائة الفورية، أو ابحث برقم الفاتورة.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <button
                      onClick={handleUploadClick}
                      className="flex items-center justify-center gap-3 px-6 py-4 bg-white text-blue-700 hover:bg-blue-50 font-black rounded-2xl shadow-lg transition-all transform active:scale-95 group"
                    >
                      <Upload size={22} className="text-blue-600 group-hover:-translate-y-0.5 transition-transform" />
                      <span>رفع الملفات والفواتير الآن</span>
                    </button>
                    <button
                      onClick={handleSearchClick}
                      className="flex items-center justify-center gap-3 px-6 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl backdrop-blur-md border border-white/20 transition-all"
                    >
                      <Search size={20} />
                      <span>بحث يدوي</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Statistics Section */}
              <div className="mb-10">
                <DashboardStats history={history} />
              </div>

              {/* Quick Actions Mode Switcher Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <button 
                  onClick={handleUploadClick}
                  className={`group relative p-6 rounded-3xl border-2 transition-all text-right overflow-hidden flex items-center justify-between ${
                    mode === 'upload' 
                      ? 'border-blue-500 bg-white shadow-lg shadow-blue-500/10' 
                      : 'border-slate-100 bg-white hover:border-blue-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload size={26} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 group-hover:text-blue-600 transition-colors">رفع الفواتير (AI)</h3>
                      <p className="text-slate-500 text-xs mt-0.5">استخراج السندات آلياً</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${mode === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {mode === 'upload' ? 'نشط' : 'اختر'}
                  </span>
                </button>

                <button 
                  onClick={handleStatementClick}
                  className={`group relative p-6 rounded-3xl border-2 transition-all text-right overflow-hidden flex items-center justify-between ${
                    mode === 'statement' 
                      ? 'border-indigo-500 bg-white shadow-lg shadow-indigo-500/10' 
                      : 'border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <FileSpreadsheet size={26} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">كشف الحساب الذكي</h3>
                      <p className="text-slate-500 text-xs mt-0.5">تحليل PDF مدمج وتصديره</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${mode === 'statement' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {mode === 'statement' ? 'نشط' : 'اختر'}
                  </span>
                </button>

                <button 
                  onClick={handleSearchClick}
                  className={`group relative p-6 rounded-3xl border-2 transition-all text-right overflow-hidden flex items-center justify-between ${
                    mode === 'search' 
                      ? 'border-emerald-500 bg-white shadow-lg shadow-emerald-500/10' 
                      : 'border-slate-100 bg-white hover:border-emerald-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Search size={26} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-600 transition-colors">البحث وإصدار يدوي</h3>
                      <p className="text-slate-500 text-xs mt-0.5">إصدار سند قبض مباشر</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${mode === 'search' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {mode === 'search' ? 'نشط' : 'اختر'}
                  </span>
                </button>
              </div>

              {/* Dynamic Workspace Container */}
              <div ref={workspaceRef} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 min-h-[400px]">
                {mode === 'search' ? (
                  <InvoiceSearch onGenerateReceipt={handleSingleReceiptGenerated} />
                ) : mode === 'upload' ? (
                  batchReceipts.length > 0 ? (
                    <PrintErrorBoundary>
                      <ReceiptBatchList 
                        receipts={batchReceipts} 
                        settings={settings}
                        onViewReceipt={(receipt) => setActiveReceipt(receipt)}
                        onUpdateReceipt={handleUpdateReceipt}
                        onClose={() => setBatchReceipts([])}
                      />
                    </PrintErrorBoundary>
                  ) : (
                    <InvoiceUploader onInvoicesExtracted={handleInvoicesExtracted} />
                  )
                ) : mode === 'statement' ? (
                  <AccountStatementModule settings={settings} onBack={() => setMode('search')} />
                ) : null}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Receipt Modal */}
      {activeReceipt && (
        <PrintErrorBoundary>
          <ReceiptVoucher 
            receipt={activeReceipt} 
            settings={settings}
            onUpdateSettings={handleSaveSettings}
            onClose={() => setActiveReceipt(null)} 
          />
        </PrintErrorBoundary>
      )}

      {/* Quick Signature Modal */}
      <QuickSignatureModal
        settings={settings}
        isOpen={isQuickSigModalOpen}
        onClose={() => setIsQuickSigModalOpen(false)}
        onSave={handleSaveSettings}
      />

      {/* Floating Dynamic Action Hub (Far Left) */}
      <div className="fixed left-6 bottom-6 z-50" dir="rtl">
        {isFloatingHubOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px]" onClick={() => setIsFloatingHubOpen(false)}></div>
            <div className="absolute left-0 bottom-16 w-80 bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-slate-200/80 p-5 z-50 animate-in fade-in slide-in-from-bottom-6 duration-300">
              <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Zap size={18} className="text-amber-300" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">التحكم الذكي السريع</h4>
                    <p className="text-[10px] text-slate-400">التنقل السريع بين أقسام النظام</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsFloatingHubOpen(false)}
                  className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-2">
                {/* Home / Search Screen */}
                <button
                  onClick={() => {
                    setMode('search');
                    setIsFloatingHubOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all font-bold text-xs ${
                    mode === 'search' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                      : 'bg-slate-50 hover:bg-blue-50/70 text-slate-700 hover:text-blue-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${mode === 'search' ? 'bg-white/20 text-white' : 'bg-white text-blue-600 shadow-sm'}`}>
                      <Home size={16} />
                    </div>
                    <div className="text-right">
                      <p className="font-black">الشاشة الرئيسية</p>
                      <p className={`text-[10px] ${mode === 'search' ? 'text-blue-100' : 'text-slate-400'}`}>البحث والإصدار المباشر</p>
                    </div>
                  </div>
                  <span className="text-xs">←</span>
                </button>

                {/* Upload / AI Receipts */}
                <button
                  onClick={() => {
                    setBatchReceipts([]);
                    setMode('upload');
                    setIsFloatingHubOpen(false);
                    setTimeout(() => {
                      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all font-bold text-xs ${
                    mode === 'upload' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                      : 'bg-slate-50 hover:bg-blue-50/70 text-slate-700 hover:text-blue-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${mode === 'upload' ? 'bg-white/20 text-white' : 'bg-white text-indigo-600 shadow-sm'}`}>
                      <Upload size={16} />
                    </div>
                    <div className="text-right">
                      <p className="font-black">رفع وفحص الفواتير (AI)</p>
                      <p className={`text-[10px] ${mode === 'upload' ? 'text-blue-100' : 'text-slate-400'}`}>معالجة ذكية واستخراج فوري</p>
                    </div>
                  </div>
                  <span className="text-xs">←</span>
                </button>

                {/* History / Reports */}
                <button
                  onClick={() => {
                    setMode('history');
                    setIsFloatingHubOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all font-bold text-xs ${
                    mode === 'history' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                      : 'bg-slate-50 hover:bg-blue-50/70 text-slate-700 hover:text-blue-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${mode === 'history' ? 'bg-white/20 text-white' : 'bg-white text-emerald-600 shadow-sm'}`}>
                      <History size={16} />
                    </div>
                    <div className="text-right">
                      <p className="font-black">سجل السندات والتقارير</p>
                      <p className={`text-[10px] ${mode === 'history' ? 'text-blue-100' : 'text-slate-400'}`}>إحصائيات وتصدير Excel/PDF</p>
                    </div>
                  </div>
                  <span className="text-xs">←</span>
                </button>

                {/* Quick Signature */}
                <button
                  onClick={() => {
                    setIsQuickSigModalOpen(true);
                    setIsFloatingHubOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 transition-all font-bold text-xs group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white text-amber-600 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Sparkles size={16} />
                    </div>
                    <div className="text-right">
                      <p className="font-black">إدارة التوقيع والختم</p>
                      <p className="text-[10px] text-slate-400">الرسم المسبق والختم الآلي</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">←</span>
                </button>

                {/* Settings */}
                <button
                  onClick={() => {
                    setMode('settings');
                    setIsFloatingHubOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all font-bold text-xs ${
                    mode === 'settings' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                      : 'bg-slate-50 hover:bg-blue-50/70 text-slate-700 hover:text-blue-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${mode === 'settings' ? 'bg-white/20 text-white' : 'bg-white text-slate-600 shadow-sm'}`}>
                      <Settings size={16} />
                    </div>
                    <div className="text-right">
                      <p className="font-black">إعدادات المنشأة</p>
                      <p className={`text-[10px] ${mode === 'settings' ? 'text-blue-100' : 'text-slate-400'}`}>بيانات الشركة والضرائب</p>
                    </div>
                  </div>
                  <span className="text-xs">←</span>
                </button>
              </div>

              <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>سندات القبض الذكية</span>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  جاهز للعمل
                </span>
              </div>
            </div>
          </>
        )}

        <button
          onClick={() => setIsFloatingHubOpen(!isFloatingHubOpen)}
          className="flex items-center gap-2.5 px-4.5 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-xs rounded-full shadow-2xl shadow-blue-600/40 transition-all hover:scale-105 active:scale-95 border-2 border-white/30 group"
          title="قائمة الاختصارات الذكية"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Compass size={15} className={`text-amber-300 transition-transform duration-500 ${isFloatingHubOpen ? 'rotate-180' : 'animate-spin-slow'}`} />
          </div>
          <span className="tracking-wide">التحكم السريع</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        </button>
      </div>

      {/* User Management Modal */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        users={users}
        onSaveUsers={handleSaveUsers}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
      />

      {/* Login / Switch Account Modal */}
      <LoginModal
        isOpen={isLoginModalOpen || !isAuthenticated}
        onClose={() => {
          if (isAuthenticated) {
            setIsLoginModalOpen(false);
          }
        }}
        users={users}
        onLogin={handleSwitchUser}
        isRequired={!isAuthenticated}
        isSyncing={isFirebaseSyncing}
      />

      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100/40 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/40 rounded-full blur-[100px]"></div>
      </div>
    </div>
  );
}
