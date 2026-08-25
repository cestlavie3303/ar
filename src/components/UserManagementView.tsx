import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  UserCheck, 
  Key, 
  Copy, 
  Check, 
  Edit3, 
  Trash2, 
  Lock, 
  Eye, 
  EyeOff, 
  Building, 
  Sparkles, 
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  CheckSquare,
  Square,
  Sliders,
  X
} from 'lucide-react';
import { AppUser, Branch } from '../types';
import { BRANCHES } from '../data/constants';

interface UserManagementViewProps {
  currentUser: AppUser;
}

const BRANCH_CONFIG: Record<Branch, { label: string; code: string; desc: string }> = {
  'عصافرة': { label: 'فرع عصافرة', code: 'AS-01', desc: 'الفرع الرئيسي - شارع 45' },
  'ميامي': { label: 'فرع ميامي', code: 'MI-02', desc: 'فرع الكورنيش - ميامي' },
  'سان ستيفانو': { label: 'فرع سان ستيفانو', code: 'ST-03', desc: 'فرع سان ستيفانو جراند بلازا' },
};

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  
  // Add Form State
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newDisplayName, setNewDisplayName] = useState<string>('');
  const [newAllowedBranches, setNewAllowedBranches] = useState<Branch[]>(['عصافرة']);
  const [newRole, setNewRole] = useState<'worker' | 'admin'>('worker');
  const [showAddPassword, setShowAddPassword] = useState<boolean>(true);
  
  // Edit Form State
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editAllowedBranches, setEditAllowedBranches] = useState<Branch[]>(['عصافرة']);
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [editRole, setEditRole] = useState<'worker' | 'admin'>('worker');
  const [showEditPassword, setShowEditPassword] = useState<boolean>(false);

  // Success / Copy Notification
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const generateRandomPassword = () => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setNewPassword(pin);
  };

  // Toggle branch in Add form
  const toggleNewBranch = (b: Branch) => {
    setNewAllowedBranches((prev) => {
      if (prev.includes(b)) {
        if (prev.length === 1) return prev; // Keep at least one branch selected
        return prev.filter((item) => item !== b);
      } else {
        return [...prev, b];
      }
    });
  };

  // Toggle branch in Edit form
  const toggleEditBranch = (b: Branch) => {
    setEditAllowedBranches((prev) => {
      if (prev.includes(b)) {
        if (prev.length === 1) return prev; // Keep at least one branch selected
        return prev.filter((item) => item !== b);
      } else {
        return [...prev, b];
      }
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newUsername.trim()) {
      setErrorMessage('اسم المستخدم مطلوب');
      return;
    }
    if (!newPassword.trim()) {
      setErrorMessage('كلمة المرور مطلوبة');
      return;
    }
    if (!newDisplayName.trim()) {
      setErrorMessage('اسم الموظف');
      return;
    }
    if (newAllowedBranches.length === 0) {
      setErrorMessage('يجب تخصيص فرع واحد على الأقل للموظف');
      return;
    }

    setIsSubmitting(true);
    try {
      const primaryBranch = newAllowedBranches.length === BRANCHES.length 
        ? 'كافة الفروع' 
        : newAllowedBranches[0];

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          displayName: newDisplayName.trim(),
          branch: primaryBranch,
          allowed_branches: newAllowedBranches,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إضافة المستخدم');
      }

      setActionNotice(`تم إنشاء حساب "${newDisplayName}" وتخصيص ${newAllowedBranches.length === 3 ? 'كافة الفروع' : `${newAllowedBranches.length} فروع (${newAllowedBranches.join('، ')})`} له بنجاح!`);
      setIsAddModalOpen(false);
      
      // Reset form
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
      setNewAllowedBranches(['عصافرة']);
      setNewRole('worker');

      fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء إضافة المستخدم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setErrorMessage(null);

    if (editAllowedBranches.length === 0) {
      setErrorMessage('يجب تخصيص فرع واحد على الأقل للموظف');
      return;
    }

    setIsSubmitting(true);
    try {
      const primaryBranch = editAllowedBranches.length === BRANCHES.length 
        ? 'كافة الفروع' 
        : editAllowedBranches[0];

      const payload: any = {
        displayName: editDisplayName.trim(),
        branch: primaryBranch,
        allowed_branches: editAllowedBranches,
        status: editStatus,
        role: editRole,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحديث بيانات المستخدم');
      }

      setActionNotice(`تم تحديث صلاحيات وفروع حساب "${editDisplayName}" بنجاح.`);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء التحديث');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: AppUser) => {
    if (user.username?.toLowerCase() === 'ahmed') {
      alert('لا يمكن حذف حساب المدير الرئيسي (Ahmed)');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من حذف حساب الموظف "${user.displayName}" (${user.username}) نهائياً؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حذف المستخدم');
      }

      setActionNotice(`تم حذف حساب "${user.displayName}" بنجاح.`);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'تعذر حذف المستخدم');
    }
  };

  const handleToggleStatus = async (user: AppUser) => {
    if (user.username?.toLowerCase() === 'ahmed') {
      alert('لا يمكن تعطيل حساب المدير الرئيسي');
      return;
    }

    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Toggle status error:', err);
    }
  };

  const getUserBranchesList = (user: AppUser): Branch[] => {
    if (user.allowed_branches && user.allowed_branches.length > 0) {
      return user.allowed_branches;
    }
    if (user.branch === 'كافة الفروع') {
      return BRANCHES;
    }
    if (user.branch && BRANCHES.includes(user.branch as Branch)) {
      return [user.branch as Branch];
    }
    return ['عصافرة'];
  };

  const copyCredentials = (user: AppUser) => {
    const branches = getUserBranchesList(user);
    const branchText = branches.length === BRANCHES.length
      ? 'كافة الفروع (عصافرة • ميامي • سان ستيفانو)'
      : branches.join('، ');

    const text = `🏢 *منظومة توثيق إيصالات شركة عروس دمشق*\n👤 *اسم الموظف:* ${user.displayName}\n🔑 *اسم المستخدم:* \`${user.username}\`\n🔒 *كلمة المرور:* \`${user.password || '••••'}\`\n📍 *الفروع المصرح لك بها فقط:* ${branchText}\n\nيرجى تسجيل الدخول والبدء في توثيق إيصالات التحويل للفروع المحددة لك.`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(user.id);
      setTimeout(() => setCopiedId(null), 3000);
    });
  };

  const openEditModal = (user: AppUser) => {
    setEditingUser(user);
    setEditDisplayName(user.displayName);
    setEditPassword(user.password || '');
    setEditAllowedBranches(getUserBranchesList(user));
    setEditStatus(user.status);
    setEditRole(user.role);
    setShowEditPassword(false);
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedBranchFilter === 'all') return matchesSearch;

    const userBranches = getUserBranchesList(u);
    const matchesBranch = userBranches.includes(selectedBranchFilter as Branch);
    return matchesSearch && matchesBranch;
  });

  const totalWorkers = users.filter((u) => u.role === 'worker').length;
  const activeUsers = users.filter((u) => u.status === 'active').length;

  return (
    <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in overflow-x-hidden">
      
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-1 sm:pb-2">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-red-900 text-amber-300 flex items-center justify-center border border-amber-500/30 shadow-sm shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-stone-900">
              إدارة الموظفين
            </h2>
            <p className="text-[11px] sm:text-xs text-stone-500 font-bold">
              تحديد الصلاحيات وتخصيص الفروع لكل موظف
            </p>
          </div>
        </div>

        <button
          id="open-add-user-modal-btn"
          onClick={() => {
            setIsAddModalOpen(true);
            setErrorMessage(null);
            setNewAllowedBranches(['عصافرة']);
            generateRandomPassword();
          }}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-800 to-rose-900 hover:from-red-700 hover:to-rose-800 active:scale-95 text-white font-black px-4 sm:px-5 py-2.5 rounded-xl shadow-md border border-amber-400/30 transition text-xs sm:text-sm whitespace-nowrap w-full sm:w-auto"
        >
          <UserPlus className="w-4 h-4 text-amber-300" />
          <span>إضافة موظف</span>
        </button>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className="bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-emerald-400 hover:text-white text-xs underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-stone-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="البحث باسم الموظف أو اسم المستخدم..."
            className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2 sm:py-2.5 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700 pr-9"
          />
          <Search className="w-4 h-4 text-stone-400 absolute right-3 top-2.5 sm:top-3" />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <span className="text-[11px] sm:text-xs font-bold text-stone-500 whitespace-nowrap">الفرع:</span>
          {['all', 'عصافرة', 'ميامي', 'سان ستيفانو'].map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBranchFilter(b)}
              className={`text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl transition whitespace-nowrap ${
                selectedBranchFilter === b
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {b === 'all' ? 'كافة الفروع' : b}
            </button>
          ))}
          <button
            onClick={fetchUsers}
            className="p-1.5 sm:p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition mr-auto"
            title="تحديث القائمة"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users List Cards / Table */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200 shadow-md overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-red-800" />
            <h3 className="font-black text-stone-900 text-xs sm:text-sm">
              قائمة الموظفين ({filteredUsers.length})
            </h3>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 sm:p-12 text-center text-stone-500 space-y-2">
            <div className="w-8 h-8 border-3 border-red-800 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold">جاري تحميل قائمة الموظفين...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 sm:p-12 text-center space-y-3">
            <Users className="w-10 h-10 sm:w-12 sm:h-12 text-stone-300 mx-auto" />
            <p className="text-xs sm:text-sm font-bold text-stone-600">لا يوجد موظفون مطابقون للبحث</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs font-bold text-red-800 hover:underline"
            >
              + إضافة موظف جديد
            </button>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredUsers.map((user) => {
              const isAdmin = user.role === 'admin' || user.username?.toLowerCase() === 'ahmed';
              const isCopied = copiedId === user.id;
              const userBranches = getUserBranchesList(user);
              const isAllBranches = userBranches.length === BRANCHES.length;

              return (
                <div 
                  key={user.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:bg-stone-50/80 ${
                    user.status === 'inactive' ? 'opacity-60 bg-stone-50' : ''
                  }`}
                >
                  {/* Left: User Identity */}
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${
                      isAdmin 
                        ? 'bg-gradient-to-tr from-amber-600 to-amber-500 text-stone-950 font-black ring-2 ring-amber-400/50' 
                        : 'bg-stone-900 text-stone-100'
                    }`}>
                      {isAdmin ? '👑' : user.displayName.slice(0, 1) || 'م'}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-stone-900 text-sm sm:text-base">
                          {user.displayName}
                        </span>
                        
                        {/* Role Badge */}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isAdmin 
                            ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                            : 'bg-stone-100 text-stone-700 border border-stone-300'
                        }`}>
                          {isAdmin ? 'مدير نظام' : 'موظف'}
                        </span>

                        {/* Status Badge */}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          user.status === 'active' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.status === 'active' ? 'نشط' : 'معطل'}
                        </span>
                      </div>

                      {/* Credentials Display & Assigned Branches */}
                      <div className="flex items-center gap-3 text-xs text-stone-500 font-mono flex-wrap">
                        <div className="flex items-center gap-1 bg-stone-100 px-2.5 py-0.5 rounded-md border border-stone-200">
                          <span className="text-stone-400 font-sans">المستخدم:</span>
                          <strong className="text-stone-900 font-bold">{user.username}</strong>
                        </div>

                        {user.password && (
                          <div className="flex items-center gap-1 bg-amber-50 text-amber-900 px-2.5 py-0.5 rounded-md border border-amber-200">
                            <span className="text-amber-700 font-sans">كلمة المرور:</span>
                            <strong className="font-bold">{user.password}</strong>
                          </div>
                        )}

                        {/* Customized Branches Pill List */}
                        <div className="flex items-center gap-1.5 text-stone-700 font-sans flex-wrap">
                          <Building className="w-3.5 h-3.5 text-red-800 shrink-0" />
                          <span className="font-bold text-[11px] text-stone-500">الفروع:</span>
                          {isAllBranches ? (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-md">
                              كافة الفروع
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              {userBranches.map((b) => (
                                <span
                                  key={b}
                                  className="bg-red-50 text-red-900 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-700" />
                                  <span>{b}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
                    
                    {/* Copy Credentials for WhatsApp */}
                    <button
                      onClick={() => copyCredentials(user)}
                      className={`flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl border transition shadow-xs ${
                        isCopied 
                          ? 'bg-emerald-600 text-white border-emerald-600' 
                          : 'bg-stone-900 hover:bg-stone-800 text-stone-100 border-stone-800'
                      }`}
                      title="نسخ بيانات الدخول"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-amber-300" />
                          <span>نسخ البيانات</span>
                        </>
                      )}
                    </button>

                    {/* Edit User & Branch permissions */}
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-2 text-stone-700 hover:text-stone-950 hover:bg-stone-200/80 rounded-xl border border-stone-300 transition flex items-center gap-1 text-xs font-bold"
                      title="تعديل وتخصيص الفروع"
                    >
                      <Edit3 className="w-4 h-4 text-red-800" />
                      <span className="hidden sm:inline">تعديل</span>
                    </button>

                    {/* Toggle Active Status */}
                    {!isAdmin && (
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border transition ${
                          user.status === 'active'
                            ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300'
                            : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
                        }`}
                        title={user.status === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                      >
                        {user.status === 'active' ? 'تعطيل' : 'تفعيل'}
                      </button>
                    )}

                    {/* Delete User */}
                    {!isAdmin && (
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="p-2 text-rose-700 hover:text-white hover:bg-rose-700 rounded-xl border border-rose-200 transition"
                        title="حذف الحساب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL: ADD NEW WORKER USER & ASSIGN BRANCHES */}
      {/* ---------------------------------------------------- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200 my-8">
            
            {/* Header */}
            <div className="bg-stone-900 text-white px-6 py-4 flex items-center justify-between border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-900 text-amber-300 flex items-center justify-center border border-amber-500/30">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">إضافة موظف</h3>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleCreateUser} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Display Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-700">
                  اسم الموظف *
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="مثال: حسام علي"
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  required
                />
              </div>

              {/* Username */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-700">
                  اسم المستخدم (Username) *
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="مثال: hossam_user"
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  dir="ltr"
                  required
                />
              </div>

              {/* Password with generator */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-700">
                    كلمة المرور *
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] font-bold text-red-800 hover:text-red-900 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>توليد كلمة سر</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showAddPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="كلمة المرور"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700 pr-10"
                    dir="ltr"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    className="absolute left-3 top-2.5 text-stone-400 hover:text-stone-700"
                  >
                    {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* Branch Customization (Multi-select) */}
              {/* ---------------------------------------------------- */}
              <div className="space-y-2 pt-2 border-t border-stone-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-stone-900">
                    الفروع المصرح بها *
                  </label>
                  
                  {/* Quick toggle all */}
                  <button
                    type="button"
                    onClick={() => setNewAllowedBranches(BRANCHES)}
                    className="text-[11px] font-bold text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition"
                  >
                    تحديد كافة الفروع
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {BRANCHES.map((b) => {
                    const isChecked = newAllowedBranches.includes(b);
                    return (
                      <div
                        key={b}
                        onClick={() => toggleNewBranch(b)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          isChecked
                            ? 'bg-red-50/90 border-red-700 text-red-950 font-black shadow-xs ring-1 ring-red-700/30'
                            : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${
                            isChecked ? 'bg-red-800 text-white' : 'border border-stone-300 bg-white'
                          }`}>
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <span className="text-xs font-black">فرع {b}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5 pt-2 border-t border-stone-200">
                <label className="block text-xs font-bold text-stone-700">
                  الصلاحية
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs font-bold ${
                    newRole === 'worker' 
                      ? 'bg-stone-900 border-stone-900 text-white' 
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="newRole" 
                        checked={newRole === 'worker'} 
                        onChange={() => setNewRole('worker')}
                        className="hidden"
                      />
                      <span>موظف</span>
                    </div>
                    {newRole === 'worker' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </label>

                  <label className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs font-bold ${
                    newRole === 'admin' 
                      ? 'bg-amber-900 border-amber-900 text-white' 
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="newRole" 
                        checked={newRole === 'admin'} 
                        onChange={() => setNewRole('admin')}
                        className="hidden"
                      />
                      <span>مدير نظام</span>
                    </div>
                    {newRole === 'admin' && <Check className="w-3.5 h-3.5 text-amber-300" />}
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 rounded-xl"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-gradient-to-r from-red-800 to-rose-900 hover:from-red-700 hover:to-rose-800 text-white text-xs font-black px-6 py-2.5 rounded-xl shadow-md border border-amber-400/30 transition disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4 text-amber-300" />
                  <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ الموظف'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: EDIT USER & CUSTOMIZE BRANCHES */}
      {/* ---------------------------------------------------- */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200 my-8">
            
            {/* Header */}
            <div className="bg-stone-900 text-white px-6 py-4 flex items-center justify-between border-b border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-stone-800 text-amber-300 flex items-center justify-center border border-stone-700">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">تعديل بيانات الموظف</h3>
                  <p className="text-[11px] text-stone-400 font-mono">{editingUser.username}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Display Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-700">
                  اسم الموظف *
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-700">
                  تعديل كلمة المرور (اختياري)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="اتركها فارغة للإبقاء على الحالية"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 font-mono focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700 pr-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute left-3 top-2.5 text-stone-400 hover:text-stone-700"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* Branch Customization (Multi-select) */}
              {/* ---------------------------------------------------- */}
              <div className="space-y-2 pt-2 border-t border-stone-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-stone-900">
                    الفروع المصرح بها *
                  </label>
                  
                  <button
                    type="button"
                    onClick={() => setEditAllowedBranches(BRANCHES)}
                    className="text-[11px] font-bold text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition"
                  >
                    تحديد كافة الفروع
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {BRANCHES.map((b) => {
                    const isChecked = editAllowedBranches.includes(b);
                    return (
                      <div
                        key={b}
                        onClick={() => toggleEditBranch(b)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          isChecked
                            ? 'bg-red-50/90 border-red-700 text-red-950 font-black shadow-xs ring-1 ring-red-700/30'
                            : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${
                            isChecked ? 'bg-red-800 text-white' : 'border border-stone-300 bg-white'
                          }`}>
                            {isChecked && <Check className="w-3.5 h-3.5" />}
                          </div>
                          <span className="text-xs font-black">فرع {b}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5 pt-2 border-t border-stone-200">
                <label className="block text-xs font-bold text-stone-700">
                  حالة الحساب
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditStatus('active')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                      editStatus === 'active'
                        ? 'bg-emerald-700 border-emerald-700 text-white shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    نشط
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditStatus('inactive')}
                    disabled={editingUser.username?.toLowerCase() === 'ahmed'}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition disabled:opacity-40 ${
                      editStatus === 'inactive'
                        ? 'bg-red-800 border-red-800 text-white shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    معطل
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 rounded-xl"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-black px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
