import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  FileSpreadsheet, 
  PlusCircle, 
  ListFilter, 
  BarChart3, 
  MessageSquare,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Users,
  LogOut,
  UserCheck,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  ChevronLeft,
  CalendarClock
} from 'lucide-react';
import { getCairoWorkDate, getUserAllowedBranches, BRANCHES } from '../data/constants';
import { AppUser } from '../types';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  activeTab: 'new' | 'reservations' | 'list' | 'team' | 'users';
  setActiveTab: (tab: 'new' | 'reservations' | 'list' | 'team' | 'users') => void;
  onOpenExport: () => void;
  ordersCount: number;
  reservationsCount?: number;
  currentUser: AppUser | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenExport,
  ordersCount,
  reservationsCount = 0,
  currentUser,
  onLogout,
}) => {
  const cairoShiftDate = getCairoWorkDate();
  const [liveTime, setLiveTime] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.username?.toLowerCase() === 'ahmed';
  const userBranches = getUserAllowedBranches(currentUser);
  const branchDisplayLabel = isAdmin 
    ? 'المدير العام (Ahmed)' 
    : userBranches.length === BRANCHES.length 
      ? 'موظف • كافة الفروع' 
      : `موظف • ${userBranches.join(' و ')}`;

  // Clean user display name without descriptions, roles, or parentheses (e.g. "أحمد (المدير العام / أدمن)" -> "أحمد")
  const rawDisplayName = currentUser?.displayName || currentUser?.username || 'مستخدم';
  const cleanDisplayName = rawDisplayName.replace(/\s*\(.*?\)\s*/g, '').trim() || rawDisplayName;

  // Navigation Items Config
  const navItems = [
    {
      id: 'new' as const,
      title: 'تسجيل طلب جديد',
      subtitle: 'مسح الإيصال وتوثيق الدفع الفوري',
      icon: PlusCircle,
      badge: 'AI',
      badgeClass: 'bg-amber-400 text-stone-950',
      show: true,
    },
    {
      id: 'reservations' as const,
      title: 'الحجوزات المسبقة',
      subtitle: 'متابعة وتسليم أوردرات الحجز المسبق',
      icon: CalendarClock,
      badge: reservationsCount > 0 ? `${reservationsCount}` : undefined,
      badgeClass: 'bg-amber-500 text-stone-950 font-black',
      show: true,
    },
    {
      id: 'list' as const,
      title: 'سجل الإيصالات والطلبات',
      subtitle: 'استعراض وبحث وتدقيق السجلات المحاسبية',
      icon: ListFilter,
      badge: ordersCount > 0 ? `${ordersCount}` : undefined,
      badgeClass: 'bg-black/40 text-amber-300 border border-amber-400/30 font-mono',
      show: true,
    },
    {
      id: 'team' as const,
      title: 'لوحة الفروع والاستعلام',
      subtitle: 'الاستعلام الفوري والتعميمات الحية بين الفروع',
      icon: MessageSquare,
      show: true,
    },
    {
      id: 'users' as const,
      title: 'إدارة المستخدمين والصلاحيات',
      subtitle: 'إضافة وتعديل حسابات المشرفين والفروع',
      icon: Users,
      show: isAdmin,
    },
  ];

  const currentNav = navItems.find((item) => item.id === activeTab) || navItems[0];

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(
        now.toLocaleTimeString('ar-EG', {
          timeZone: 'Africa/Cairo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectTab = (tab: 'new' | 'reservations' | 'list' | 'team' | 'users') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-[#141416] text-stone-100 border-b border-stone-800/80 sticky top-0 z-40 shadow-lg font-['Cairo',sans-serif] w-full max-w-full">
      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-18 gap-2">
          
          {/* Brand Identity with Official Logo (Desktop: Logo + Name, Mobile: Clean Brand/Icon or minimal) */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3 shrink min-w-0">
            <BrandLogo size="md" />

            <div className="min-w-0">
              <h1 className="text-sm sm:text-2xl font-black tracking-tight text-white truncate">
                مطاعم عروس دمشق
              </h1>
            </div>
          </div>

          {/* Mobile Right: User Profile (Name ONLY, no icons, no badges) & Menu Button */}
          <div className="flex sm:hidden items-center justify-between w-full">
            {/* User Name Only */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 shadow-sm">
                <span className="text-xs font-black text-stone-100 truncate max-w-[170px]">
                  {cleanDisplayName}
                </span>
                <button
                  onClick={onLogout}
                  className="p-1 text-stone-400 hover:text-rose-400 transition mr-0.5"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : <div />}

            {/* Mobile Menu Toggle Button */}
            <button
              id="mobile-menu-toggle-btn"
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`flex items-center justify-center w-9 h-9 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 border shrink-0 ${
                isMobileMenuOpen 
                  ? 'bg-amber-400 text-stone-950 border-amber-300 ring-2 ring-amber-400/40' 
                  : 'bg-stone-900 hover:bg-stone-800 text-stone-100 border-stone-700/90'
              }`}
              aria-label="القائمة الرئيسية"
              title="القائمة الرئيسية"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-stone-950" />
              ) : (
                <Menu className="w-5 h-5 text-amber-400" />
              )}
            </button>
          </div>

          {/* Desktop Right Action & User Profile Widgets */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            
            {/* Cairo Shift Date Widget (Desktop) */}
            <div className="hidden lg:flex items-center gap-2 bg-stone-900/90 text-stone-200 px-3 py-1.5 rounded-xl border border-stone-700/60 shadow-inner text-xs">
              <Calendar className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <div className="flex flex-col text-right leading-tight">
                <span className="text-[9px] text-stone-400">وردية اليوم:</span>
                <span className="font-bold font-mono text-white dir-ltr">{cairoShiftDate}</span>
              </div>
            </div>

            {/* Current Logged-in User Profile Card (Desktop) */}
            {currentUser && (
              <div className="flex items-center gap-2 bg-stone-900 border border-stone-700/80 rounded-2xl px-3 py-2">
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                  isAdmin 
                    ? 'bg-amber-500 text-stone-950 ring-1 ring-amber-300' 
                    : 'bg-red-800 text-white'
                }`}>
                  {isAdmin ? '👑' : currentUser.displayName.slice(0, 1) || 'ع'}
                </div>

                <div className="flex flex-col text-right leading-none max-w-[140px] min-w-0">
                  <span className="text-xs font-black text-stone-100 truncate">
                    {cleanDisplayName}
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold mt-0.5 truncate">
                    {branchDisplayLabel}
                  </span>
                </div>

                {/* Logout Button */}
                <button
                  onClick={onLogout}
                  className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-stone-800 rounded-lg transition mr-1 shrink-0"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Excel Export Button (Desktop) */}
            <button
              id="header-export-btn"
              onClick={onOpenExport}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 active:scale-95 transition text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-950/40 border border-emerald-500/30 shrink-0"
              title="تصدير كشف الإيصالات بصيغة Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span className="hidden md:inline">تصدير إكسيل</span>
            </button>
          </div>
        </div>

        {/* Desktop Navigation Tabs Bar (Visible on Computer only, hidden on Mobile) */}
        <nav className="hidden sm:flex items-center gap-2 overflow-x-auto py-2.5 no-scrollbar border-t border-stone-800/80">
          <button
            id="nav-tab-new"
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'new'
                ? 'bg-gradient-to-r from-red-800 to-rose-900 text-white shadow-md shadow-red-950/60 border border-red-500/40 ring-1 ring-amber-400/20'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 border border-transparent'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>تسجيل طلب جديد</span>
            <span className="bg-amber-400 text-stone-950 text-[10px] font-black px-1.5 py-0.2 rounded">
              AI
            </span>
          </button>

          <button
            id="nav-tab-reservations"
            onClick={() => setActiveTab('reservations')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'reservations'
                ? 'bg-gradient-to-r from-red-800 to-rose-900 text-white shadow-md shadow-red-950/60 border border-red-500/40 ring-1 ring-amber-400/20'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 border border-transparent'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            <span>الحجوزات</span>
            {reservationsCount > 0 && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'reservations' ? 'bg-amber-400 text-stone-950' : 'bg-amber-500/30 text-amber-300 border border-amber-400/40'
              }`}>
                {reservationsCount}
              </span>
            )}
          </button>

          <button
            id="nav-tab-list"
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'list'
                ? 'bg-gradient-to-r from-red-800 to-rose-900 text-white shadow-md shadow-red-950/60 border border-red-500/40 ring-1 ring-amber-400/20'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 border border-transparent'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>سجل الإيصالات والطلبات</span>
            {ordersCount > 0 && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'list' ? 'bg-black/40 text-amber-300 border border-amber-400/30' : 'bg-stone-800 text-stone-300'
              }`}>
                {ordersCount}
              </span>
            )}
          </button>

          <button
            id="nav-tab-team"
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'team'
                ? 'bg-gradient-to-r from-red-800 to-rose-900 text-white shadow-md shadow-red-950/60 border border-red-500/40 ring-1 ring-amber-400/20'
                : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 border border-transparent'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>لوحة الفروع والاستعلام الموحد</span>
          </button>

          {/* ADMIN ONLY TAB: Users Management */}
          {isAdmin && (
            <button
              id="nav-tab-users"
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
                activeTab === 'users'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-stone-950 shadow-md shadow-amber-950/40 font-black border border-amber-300'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-stone-800/60 border border-amber-500/20'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>إدارة المستخدمين</span>
              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                activeTab === 'users' ? 'bg-stone-950 text-amber-400' : 'bg-amber-400 text-stone-950'
              }`}>
                ADMIN
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* Professional Compact Mobile Menu Modal / Dropdown Sheet (Mobile ONLY) */}
      {isMobileMenuOpen && (
        <div 
          className="sm:hidden fixed inset-0 z-50 top-14 bg-stone-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div 
            className="bg-[#18181b] border-b border-stone-800 shadow-2xl p-3 space-y-2.5 max-h-[calc(100vh-3.5rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Top Shift & User Status in Mobile Drawer */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-900/90 border border-stone-800/90 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div>
                  <span className="text-[9px] text-stone-400 block font-bold">وردية العمل:</span>
                  <span className="font-mono font-bold text-amber-300 text-xs dir-ltr">{cairoShiftDate}</span>
                </div>
              </div>

              {currentUser && (
                <div className="text-left">
                  <span className="text-[9px] text-stone-400 block font-bold">المستخدم:</span>
                  <span className="font-bold text-xs text-stone-200">{cleanDisplayName}</span>
                </div>
              )}
            </div>

            {/* Menu Items List - Compact & Refined */}
            <div className="space-y-1.5">
              {navItems.filter(item => item.show).map((item) => {
                const isSelected = activeTab === item.id;
                const IconComponent = item.icon;

                return (
                  <button
                    key={item.id}
                    id={`mobile-nav-${item.id}`}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-right transition-all border ${
                      isSelected
                        ? 'bg-gradient-to-r from-red-800 to-rose-900 text-white border-red-500/40 shadow-md ring-1 ring-amber-400/20'
                        : 'bg-stone-900/70 hover:bg-stone-800 text-stone-200 border-stone-800/60 active:scale-[0.99]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected 
                          ? 'bg-amber-400 text-stone-950 shadow-xs' 
                          : 'bg-stone-800 text-stone-300'
                      }`}>
                        <IconComponent className="w-4 h-4" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-stone-100'}`}>
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${item.badgeClass || 'bg-stone-800 text-stone-300'}`}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] mt-0.5 truncate ${isSelected ? 'text-rose-200' : 'text-stone-400'}`}>
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <ChevronLeft className={`w-3.5 h-3.5 shrink-0 transition-transform ${isSelected ? 'text-amber-400 -translate-x-0.5' : 'text-stone-500'}`} />
                  </button>
                );
              })}
            </div>

            {/* Compact Close Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full py-2 text-center text-[11px] font-bold text-stone-400 hover:text-white bg-stone-900/40 hover:bg-stone-900 rounded-lg border border-stone-800/50 transition"
              >
                إغلاق القائمة
              </button>
            </div>

          </div>
        </div>
      )}
    </header>
  );
};

