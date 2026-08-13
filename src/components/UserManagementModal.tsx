import React, { useState } from 'react';
import { User } from '../types';
import { Shield, Key, UserPlus, Trash2, Edit3, Check, X, Lock, Unlock, UserCheck, ShieldCheck, AlertCircle } from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onSaveUsers: (users: User[]) => void;
  currentUser: User;
  onSwitchUser: (user: User) => void;
}

export default function UserManagementModal({
  isOpen,
  onClose,
  users,
  onSaveUsers,
  currentUser,
  onSwitchUser
}: UserManagementModalProps) {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<'admin' | 'accountant' | 'viewer'>('accountant');
  const [permissions, setPermissions] = useState({
    createReceipt: true,
    editSettings: false,
    viewReports: true,
    deleteReceipt: false
  });

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setIsAddingNew(true);
    setEditingUser(null);
    setName('');
    setUsername('');
    setPin('');
    setRole('accountant');
    setPermissions({
      createReceipt: true,
      editSettings: false,
      viewReports: true,
      deleteReceipt: false
    });
    setErrorMsg('');
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setIsAddingNew(false);
    setName(user.name);
    setUsername(user.username);
    setPin(user.pin);
    setRole(user.role);
    setPermissions({ ...user.permissions });
    setErrorMsg('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !pin.trim()) {
      setErrorMsg('الرجاء تعبئة جميع الحقول المطلوبة (الاسم، اسم المستخدم، رمز الدخول)');
      return;
    }

    const roleLabel = role === 'admin' ? 'مدير النظام' : role === 'accountant' ? 'محاسب معتمد' : 'مستخدم استعلام';

    if (isAddingNew) {
      if (users.some(u => u.username === username.trim())) {
        setErrorMsg('اسم المستخدم مستخدم مسبقاً، يرجى اختيار اسم آخر');
        return;
      }
      const newUser: User = {
        id: 'usr_' + Date.now(),
        name: name.trim(),
        username: username.trim(),
        pin: pin.trim(),
        role,
        roleLabel,
        permissions,
        isActive: true,
        lastLogin: 'الآن'
      };
      onSaveUsers([...users, newUser]);
    } else if (editingUser) {
      const updated = users.map(u => {
        if (u.id === editingUser.id) {
          return {
            ...u,
            name: name.trim(),
            username: username.trim(),
            pin: pin.trim(),
            role,
            roleLabel,
            permissions
          };
        }
        return u;
      });
      onSaveUsers(updated);
    }

    setIsAddingNew(false);
    setEditingUser(null);
    setErrorMsg('');
  };

  const handleDeleteClick = (user: User) => {
    if (users.length <= 1) {
      setErrorMsg('لا يمكن حذف المستخدم الوحيد في النظام');
      return;
    }
    if (currentUser.id === user.id) {
      setErrorMsg('لا يمكنك حذف المستخدم الحالي الذي تسجل به الدخول');
      return;
    }
    setUserToDelete(user);
    setErrorMsg('');
  };

  const confirmDelete = () => {
    if (userToDelete) {
      onSaveUsers(users.filter(u => u.id !== userToDelete.id));
      setUserToDelete(null);
    }
  };

  const toggleActive = (id: string) => {
    const updated = users.map(u => {
      if (u.id === id) {
        return { ...u, isActive: !u.isActive };
      }
      return u;
    });
    onSaveUsers(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <ShieldCheck size={24} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">إدارة المستخدمين وصلاحيات الدخول</h2>
              <p className="text-xs text-slate-300">تحكم بالصلاحيات والأمان وكلمات المرور لكل محاسب وموظف</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Header & Add Button */}
          {!isAddingNew && !editingUser && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <div>
                <p className="font-black text-slate-900 text-sm">قائمة حسابات المستخدمين النشطة</p>
                <p className="text-xs text-slate-500">إجمالي المستخدمين: {users.length} مستخدمين</p>
              </div>
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-2xl shadow-md shadow-blue-500/20 transition-all active:scale-95"
              >
                <UserPlus size={16} />
                <span>إضافة مستخدم جديد</span>
              </button>
            </div>
          )}

          {/* Add / Edit Form */}
          {(isAddingNew || editingUser) && (
            <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-blue-200 shadow-xl space-y-5 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-900 text-sm">
                  {isAddingNew ? 'إضافة مستخدم جديد للنظام' : `تعديل صلاحيات المستخدم: ${editingUser?.name}`}
                </h3>
                <button
                  type="button"
                  onClick={() => { setIsAddingNew(false); setEditingUser(null); setErrorMsg(''); }}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">الاسم الكامل</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: وليد محمد"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">اسم المستخدم (للدخول)</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: walid"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">كلمة السر / رمز الدخول (PIN)</label>
                  <input
                    type="text"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="مثال: 1234 أو كلمة سر قوية"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">الدور الوظيفي</label>
                  <select
                    value={role}
                    onChange={(e: any) => setRole(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="admin">مدير النظام (صلاحيات كاملة)</option>
                    <option value="accountant">محاسب معتمد (إصدار السندات والتقارير)</option>
                    <option value="viewer">مستخدم استعلام (مشاهدة فقط)</option>
                  </select>
                </div>
              </div>

              {/* Permissions checkboxes */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-black text-slate-800 mb-3">تخصيص الصلاحيات الدقيقة:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2.5 p-3 bg-slate-50 hover:bg-blue-50/50 rounded-2xl cursor-pointer border border-slate-200/60">
                    <input
                      type="checkbox"
                      checked={permissions.createReceipt}
                      onChange={(e) => setPermissions({ ...permissions, createReceipt: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded-md"
                    />
                    <span className="text-xs font-bold text-slate-800">إصدار السندات</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 bg-slate-50 hover:bg-blue-50/50 rounded-2xl cursor-pointer border border-slate-200/60">
                    <input
                      type="checkbox"
                      checked={permissions.viewReports}
                      onChange={(e) => setPermissions({ ...permissions, viewReports: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded-md"
                    />
                    <span className="text-xs font-bold text-slate-800">عرض التقارير</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 bg-slate-50 hover:bg-blue-50/50 rounded-2xl cursor-pointer border border-slate-200/60">
                    <input
                      type="checkbox"
                      checked={permissions.deleteReceipt}
                      onChange={(e) => setPermissions({ ...permissions, deleteReceipt: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded-md"
                    />
                    <span className="text-xs font-bold text-slate-800">حذف / إلغاء السندات</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 bg-slate-50 hover:bg-blue-50/50 rounded-2xl cursor-pointer border border-slate-200/60">
                    <input
                      type="checkbox"
                      checked={permissions.editSettings}
                      onChange={(e) => setPermissions({ ...permissions, editSettings: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded-md"
                    />
                    <span className="text-xs font-bold text-slate-800">إعدادات المنشأة</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setIsAddingNew(false); setEditingUser(null); }}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md"
                >
                  حفظ البيانات
                </button>
              </div>
            </form>
          )}

          {/* Users List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((user) => {
              const isCurrent = currentUser.id === user.id;
              return (
                <div
                  key={user.id}
                  className={`bg-white p-5 rounded-3xl border transition-all ${
                    isCurrent ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-lg' : 'border-slate-200/80 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-md ${
                        user.role === 'admin' ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white' : 'bg-gradient-to-tr from-blue-600 to-blue-700 text-white'
                      }`}>
                        {user.name.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900 text-sm">{user.name}</h4>
                          {isCurrent && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-black text-[10px] rounded-full">المستخدم الحالي</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">@{user.username} • <span className="font-bold text-slate-600">{user.roleLabel}</span></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(user)}
                        className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-colors"
                        title="تعديل"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(user)}
                        className="p-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-xl transition-colors"
                        title="حذف"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Key size={13} className="text-slate-400" />
                      <span>رمز الدخول: <strong className="text-slate-900">{user.pin}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`}></span>
                      <span className={user.isActive ? 'text-emerald-700 font-bold' : 'text-red-600'}>
                        {user.isActive ? 'الحساب نشط' : 'الحساب موقوف'}
                      </span>
                    </div>
                  </div>

                  {/* Permissions tags */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {user.permissions.createReceipt && <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md">إصدار السندات</span>}
                    {user.permissions.viewReports && <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md">التقارير</span>}
                    {user.permissions.deleteReceipt && <span className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold rounded-md">حذف السندات</span>}
                    {user.permissions.editSettings && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-md">الإعدادات</span>}
                  </div>

                  {!isCurrent && user.isActive && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => onSwitchUser(user)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition-colors"
                      >
                        <UserCheck size={14} />
                        <span>تبديل الحساب لهذا المستخدم</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Delete Confirmation Modal Overlay */}
        {userToDelete && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm">تأكيد حذف المستخدم</h4>
                <p className="text-xs text-slate-500 mt-1">هل أنت متأكد من حذف المستخدم <strong className="text-slate-800">{userToDelete.name}</strong> نهائياً؟</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  نعم، حذف
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-4 bg-white border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>نظام حماية البيانات وصلاحيات الوصول المتقدمة</span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
