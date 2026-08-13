import React, { useState } from 'react';
import { User } from '../types';
import { Lock, Key, X, AlertCircle, Cloud, Loader2 } from 'lucide-react';
import { signInWithGooglePopup } from '../firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onLogin: (user: User) => void;
  isRequired?: boolean;
  onGoogleLoginSuccess?: (firebaseUser: any) => void;
  isSyncing?: boolean;
}

export default function LoginModal({ isOpen, onClose, users, onLogin, isRequired = false, onGoogleLoginSuccess, isSyncing = false }: LoginModalProps) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.id === selectedUserId);
    if (!user) {
      setError('الرجاء اختيار مستخدم');
      return;
    }
    if (user.pin !== pin.trim()) {
      setError('رمز الدخول (PIN) غير صحيح');
      return;
    }
    setError('');
    sessionStorage.setItem('app_authenticated', 'true');
    onLogin(user);
    setPin('');
    onClose();
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      setError('');
      const firebaseUser = await signInWithGooglePopup();
      sessionStorage.setItem('app_authenticated', 'true');
      if (onGoogleLoginSuccess) {
        onGoogleLoginSuccess(firebaseUser);
      }
      // Log in as an admin/accountant user in the local session matched to Google name
      const googleUser: User = {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email || 'مستخدم Google',
        username: firebaseUser.email?.split('@')[0] || 'google_user',
        pin: '0000',
        role: 'admin',
        roleLabel: 'مدير (سحابي)',
        permissions: { createReceipt: true, editSettings: true, viewReports: true, deleteReceipt: true },
        isActive: true
      };
      onLogin(googleUser);
      onClose();
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      setError('تعذر تسجيل الدخول باستخدام Google. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden p-8 relative">
        {!isRequired && (
          <button
            onClick={onClose}
            className="absolute top-6 left-6 w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        )}

        <div className="text-center space-y-3 mb-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30">
            <Lock size={28} className="text-amber-300" />
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            بوابة الدخول الآمنة
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            اختر المستخدم وأدخل رمز الدخول (PIN) أو سجل باستخدام Google للمزامنة السحابية
          </p>
          <div className="inline-block bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl text-[11px] text-blue-700 font-bold">
            💡 رمز الدخول الافتراضي: 1234 للمدير | 5678 للمحاسب | 0000 للاستعلام
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">اختر المستخدم</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={isSyncing}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.roleLabel}) - @{u.username}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">رمز الدخول (PIN)</label>
            <div className="relative">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                disabled={isSyncing}
                placeholder={isSyncing ? "جاري المزامنة..." : "أدخل رمز الدخول السرّي"}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 tracking-widest text-center disabled:opacity-50"
                autoFocus
              />
              <Key size={16} className="absolute left-4 top-3.5 text-slate-400" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSyncing}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-black text-xs rounded-2xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {isSyncing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>جاري المزامنة مع السحابة...</span>
              </>
            ) : (
              <span>دخول آمن (محلي)</span>
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white text-slate-400 font-bold">أو الدخول السحابي</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="w-full py-3.5 bg-white border-2 border-slate-200 hover:border-blue-500 text-slate-800 hover:text-blue-600 font-black text-xs rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2.5 active:scale-95 disabled:opacity-50"
        >
          {isGoogleLoading ? (
            <Loader2 size={16} className="animate-spin text-blue-600" />
          ) : (
            <Cloud size={16} className="text-blue-600" />
          )}
          <span>تسجيل الدخول باستخدام Google (المزامنة السحابية Firebase)</span>
        </button>
      </div>
    </div>
  );
}
