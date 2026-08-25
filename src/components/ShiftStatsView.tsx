import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  DollarSign, 
  Hash, 
  Building2, 
  Wallet, 
  Calendar, 
  ArrowUpRight, 
  CheckCircle2,
  TrendingUp,
  CreditCard,
  PieChart,
  ShieldCheck
} from 'lucide-react';
import { Order, ShiftStats, AppUser } from '../types';
import { BRANCHES, WALLETS, getCairoWorkDate, formatArabicDate, getUserAllowedBranches } from '../data/constants';

interface ShiftStatsViewProps {
  orders: Order[];
  currentUser?: AppUser | null;
}

export const ShiftStatsView: React.FC<ShiftStatsViewProps> = ({ orders, currentUser }) => {
  const todayDate = getCairoWorkDate();
  const allowedBranches = getUserAllowedBranches(currentUser);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.username?.toLowerCase() === 'ahmed';

  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Compute live client-side stats immediately from orders prop (scoped to permitted branches if not admin)
  const computedStats = React.useMemo(() => {
    let scopedOrders = orders;
    if (!isAdmin) {
      scopedOrders = orders.filter((o) => allowedBranches.includes(o.branch));
    }

    const filtered = selectedDate === 'all'
      ? scopedOrders
      : scopedOrders.filter((o) => {
          const paymentShift = o.payment_shift_date || (o.is_reservation ? o.created_at?.slice(0, 10) : o.work_date);
          return paymentShift === selectedDate;
        });

    const total_orders = new Set(filtered.map((o) => `${o.branch}_${o.order_num}_${o.work_date}`)).size;
    const total_payments = filtered.length;
    const total_amount = filtered.reduce((sum, o) => sum + (o.amount || 0), 0);

    const by_branch: Record<string, number> = { عصافرة: 0, ميامي: 0, "سان ستيفانو": 0 };
    const by_wallet: Record<string, number> = {
      "انستا باي عامر": 0,
      "انستا باي ابو النور": 0,
      محفظة: 0,
      "انستا باي | شركة عروس دمشق": 0,
    };

    filtered.forEach((o) => {
      if (by_branch[o.branch] !== undefined) by_branch[o.branch]++;
      else by_branch[o.branch] = 1;

      if (by_wallet[o.wallet] !== undefined) by_wallet[o.wallet]++;
      else by_wallet[o.wallet] = 1;
    });

    return {
      work_date: selectedDate,
      total_orders,
      total_payments,
      total_amount,
      by_branch,
      by_wallet,
    };
  }, [orders, selectedDate, allowedBranches, isAdmin]);

  useEffect(() => {
    fetchStats();
  }, [selectedDate]);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const url = selectedDate === 'all' ? '/api/stats' : `/api/stats?work_date=${selectedDate}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      // Fallback already active via computedStats
    } finally {
      setIsLoading(false);
    }
  };

  const activeStats = stats || computedStats;

  return (
    <div className="space-y-5 font-['Cairo']">
      
      {/* Header & Date Controller */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/90 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-red-800 via-rose-900 to-amber-600" />
        
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center font-bold text-sm shadow-inner">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-stone-950 tracking-tight">
              التقرير المالي وإحصائيات الوردية
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 font-medium">
            متابعة إجمالي التحصيلات وتوزيع الإيصالات على الفروع ومحافظ الدفع الإلكتروني
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-stone-50 border border-stone-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700"
          >
            <option value={todayDate}>وردية اليوم ({todayDate})</option>
            <option value="all">كافة الورديات التراكمية</option>
          </select>
        </div>
      </div>

      {/* Main KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Unique Orders Card */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-stone-500">إجمالي الطلبات الفريدة</span>
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-sm">
              <Hash className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono-num text-stone-950">
              {activeStats.total_orders || 0}
            </span>
            <span className="text-xs text-stone-500 font-bold">طلب معتمد</span>
          </div>
        </div>

        {/* Total Payments Count Card */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-stone-500">إجمالي الإيصالات والدفعات</span>
            <div className="w-10 h-10 rounded-xl bg-red-900 text-amber-300 flex items-center justify-center shadow-sm">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono-num text-stone-950">
              {activeStats.total_payments || 0}
            </span>
            <span className="text-xs text-stone-500 font-bold">إيصال موثق</span>
          </div>
        </div>

        {/* Total Amount Monitored Card */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-stone-500">المبلغ المقروء والموثق</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-800 text-emerald-100 flex items-center justify-center shadow-sm">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono-num text-emerald-700">
              {(activeStats.total_amount || 0).toLocaleString('en-US')}
            </span>
            <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
              ج.م مصري
            </span>
          </div>
        </div>

      </div>

      {/* Distribution Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Branch Distribution */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-red-800" />
              <h3 className="font-black text-stone-900 text-sm sm:text-base">
                توزيع الإيصالات حسب الفروع
              </h3>
            </div>
            <span className="text-[11px] font-mono font-bold text-stone-400">BRANCH DISTRIBUTION</span>
          </div>

          <div className="space-y-4">
            {allowedBranches.map((b) => {
              const count = activeStats.by_branch?.[b] || 0;
              const total = activeStats.total_payments || 1;
              const pct = Math.round((count / (total || 1)) * 100);

              return (
                <div key={b} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-stone-800 font-black">{b}</span>
                    <span className="text-stone-500 font-mono-num">
                      <strong className="text-stone-900">{count}</strong> إيصال ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden border border-stone-200/60">
                    <div
                      className="h-full bg-gradient-to-r from-red-800 to-rose-900 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wallet Distribution */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-700" />
              <h3 className="font-black text-stone-900 text-sm sm:text-base">
                توزيع الإيصالات حسب المحافظ
              </h3>
            </div>
            <span className="text-[11px] font-mono font-bold text-stone-400">WALLETS BREAKDOWN</span>
          </div>

          <div className="space-y-4">
            {WALLETS.map((w) => {
              const count = activeStats.by_wallet?.[w] || 0;
              const total = activeStats.total_payments || 1;
              const pct = Math.round((count / (total || 1)) * 100);

              return (
                <div key={w} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-stone-800 font-black">{w}</span>
                    <span className="text-stone-500 font-mono-num">
                      <strong className="text-stone-900">{count}</strong> إيصال ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden border border-stone-200/60">
                    <div
                      className="h-full bg-gradient-to-r from-amber-600 to-red-800 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Security & Audit Summary Bar */}
      <div className="bg-stone-900 text-white p-4 sm:p-5 rounded-2xl border border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-black text-sm text-stone-100">نظام الرقابة المالية والحسابات الموحدة</h4>
            <p className="text-xs text-stone-400 mt-0.5">
              كافة المعاملات مسجلة وموثقة بصور الإشعار البنكي لسهولة الجرد والتدقيق المحاسبي
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
