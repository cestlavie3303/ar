import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Building2, 
  Wallet, 
  Calendar, 
  LayoutGrid, 
  Table as TableIcon, 
  ExternalLink, 
  Clock, 
  FileSpreadsheet,
  AlertCircle,
  Hash,
  Sparkles,
  DollarSign,
  Receipt,
  RotateCcw,
  Layers,
  Images,
  User,
  AlertTriangle
} from 'lucide-react';
import { Branch, Order, WalletType, AppUser, GroupedOrder } from '../types';
import { BRANCHES, WALLETS, getCairoWorkDate, formatArabicDate, getUserAllowedBranches, validateReceiptDateAgainstShift } from '../data/constants';

interface OrdersListViewProps {
  orders: Order[];
  onSelectOrder: (order: Order | GroupedOrder) => void;
  onOpenExport: () => void;
  isLoading: boolean;
  currentUser?: AppUser | null;
}

export const OrdersListView: React.FC<OrdersListViewProps> = ({
  orders,
  onSelectOrder,
  onOpenExport,
  isLoading,
  currentUser,
}) => {
  const todayDate = getCairoWorkDate();
  const allowedBranches = getUserAllowedBranches(currentUser);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.username?.toLowerCase() === 'ahmed';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedWallet, setSelectedWallet] = useState<string>('all');
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'custom' | 'all'>('today');
  const [customDate, setCustomDate] = useState<string>(todayDate);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Group all individual payment orders into unified order records
  const groupedOrders: GroupedOrder[] = useMemo(() => {
    const groupsMap = new Map<string, GroupedOrder>();

    // Sort orders by creation date descending to keep newest at top
    const sorted = [...orders].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    sorted.forEach((order) => {
      const key = `${order.branch}_${order.order_num}_${order.work_date}`;
      const isRes = Boolean(order.is_reservation || (order.payment_shift_date && order.work_date > order.payment_shift_date));

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          group_key: key,
          order_num: order.order_num,
          branch: order.branch,
          work_date: order.work_date,
          total_amount: 0,
          payments: [],
          wallets: [],
          reference_nums: [],
          notes: [],
          created_at: order.created_at,
          user_names: [],
          is_reservation: isRes,
          reservation_status: order.reservation_status,
          payment_shift_date: order.payment_shift_date,
        });
      }

      const group = groupsMap.get(key)!;
      if (isRes) {
        group.is_reservation = true;
        if (order.reservation_status) {
          group.reservation_status = order.reservation_status;
        }
      }
      group.payments.push(order);
      group.total_amount += order.amount || 0;
      if (!group.wallets.includes(order.wallet)) {
        group.wallets.push(order.wallet);
      }
      if (order.reference_num && !group.reference_nums.includes(order.reference_num)) {
        group.reference_nums.push(order.reference_num);
      }
      if (order.notes && !group.notes.includes(order.notes)) {
        group.notes.push(order.notes);
      }
      if (order.user_name && !group.user_names.includes(order.user_name)) {
        group.user_names.push(order.user_name);
      }
    });

    const result: GroupedOrder[] = [];
    groupsMap.forEach((grp) => {
      // Sort payments inside group by payment_seq ascending
      grp.payments.sort((a, b) => (a.payment_seq || 1) - (b.payment_seq || 1));
      result.push(grp);
    });

    return result;
  }, [orders]);

  // Filtered grouped orders computation
  const filteredGroups = useMemo(() => {
    return groupedOrders.filter((g) => {
      // Branch security & assignment restriction
      if (!isAdmin && !allowedBranches.includes(g.branch)) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = g.order_num.toLowerCase().includes(q);
        const matchesRef = g.reference_nums.some((ref) => ref.toLowerCase().includes(q));
        const matchesNotes = g.notes.some((note) => note.toLowerCase().includes(q));
        const matchesUser = g.user_names.some((u) => u.toLowerCase().includes(q));
        const matchesSender = g.payments.some((p) => p.sender_info?.toLowerCase().includes(q));
        if (!matchesNum && !matchesRef && !matchesNotes && !matchesUser && !matchesSender) {
          return false;
        }
      }

      // Branch
      if (selectedBranch !== 'all' && g.branch !== selectedBranch) {
        return false;
      }

      // Wallet
      if (selectedWallet !== 'all' && !g.wallets.includes(selectedWallet as WalletType)) {
        return false;
      }

      // Date
      if (dateFilterMode === 'today') {
        if (g.work_date !== todayDate) return false;
      } else if (dateFilterMode === 'custom') {
        if (g.work_date !== customDate) return false;
      }

      return true;
    });
  }, [groupedOrders, searchQuery, selectedBranch, selectedWallet, dateFilterMode, customDate, todayDate, allowedBranches, isAdmin]);

  // Aggregate stats of filtered
  const totalFilteredAmount = useMemo(() => {
    return filteredGroups.reduce((sum, g) => sum + g.total_amount, 0);
  }, [filteredGroups]);

  const totalFilteredReceiptsCount = useMemo(() => {
    return filteredGroups.reduce((sum, g) => sum + g.payments.length, 0);
  }, [filteredGroups]);

  return (
    <div className="space-y-4 sm:space-y-5 font-['Cairo'] w-full max-w-full overflow-x-hidden">
      
      {/* Executive Control & Filter Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-3.5 sm:p-5 space-y-3 sm:space-y-4">
        
        {/* Top search & view mode switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-3 sm:top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الطلب، الرقم المرجعي، أو الملاحظات..."
              className="w-full bg-stone-50 border border-stone-300 rounded-xl pr-10 pl-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-2 sm:top-2.5 text-xs bg-stone-200 hover:bg-stone-300 px-2 py-0.5 rounded text-stone-700 font-bold"
              >
                مسح
              </button>
            )}
          </div>

          {/* View Toggles & Export */}
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 sm:p-2 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-stone-900 text-amber-300 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="عرض شبكي (بطاقات الطلبات)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 sm:p-2 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-stone-900 text-amber-300 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                title="عرض جدول البيانات المحاسبي"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onOpenExport}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white border border-stone-700 px-3.5 py-2 rounded-xl text-xs font-black shadow-sm transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>تصدير المفلتر</span>
            </button>
          </div>
        </div>

        {/* Filter Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-3 border-t border-stone-100">
          
          {/* Branch Filter */}
          <div>
            <label className="block text-xs font-black text-stone-700 mb-1">
              الفرع:
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700"
            >
              <option value="all">
                {allowedBranches.length === BRANCHES.length ? `كافة الفروع (${groupedOrders.length} طلب)` : `الفروع المصرح بها (${allowedBranches.length})`}
              </option>
              {allowedBranches.map((b) => (
                <option key={b} value={b}>
                  فرع {b} ({groupedOrders.filter((g) => g.branch === b).length} طلب)
                </option>
              ))}
            </select>
          </div>

          {/* Wallet Filter */}
          <div>
            <label className="block text-xs font-black text-stone-700 mb-1">
              محفظة الدفع:
            </label>
            <select
              value={selectedWallet}
              onChange={(e) => setSelectedWallet(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700"
            >
              <option value="all">كافة المحافظ الإلكترونية</option>
              {WALLETS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-xs font-black text-stone-700 mb-1">
              الوردية المحاسبية:
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={dateFilterMode}
                onChange={(e) => setDateFilterMode(e.target.value as any)}
                className="bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700 flex-1"
              >
                <option value="today">وردية اليوم ({todayDate})</option>
                <option value="custom">تاريخ مخصص...</option>
                <option value="all">جميع التواريخ والورديات</option>
              </select>

              {dateFilterMode === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="bg-stone-50 border border-stone-300 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-stone-900 w-32"
                />
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Filter Summary Stats Strip */}
      <div className="bg-stone-900 text-stone-200 px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl border border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-stone-400">إجمالي الطلبات:</span>
          <strong className="font-mono-num font-bold text-amber-300 bg-stone-800 px-2 sm:px-2.5 py-0.5 rounded text-xs">
            {filteredGroups.length} طلب
          </strong>
          {totalFilteredReceiptsCount > filteredGroups.length && (
            <span className="text-amber-200 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 text-[10px] sm:text-[11px] font-bold">
              يحتوي على {totalFilteredReceiptsCount} إيصال دفع
            </span>
          )}
          {selectedBranch !== 'all' && (
            <span className="text-stone-300 text-[11px] sm:text-xs">• فرع: <strong className="text-white">{selectedBranch}</strong></span>
          )}
          {selectedWallet !== 'all' && (
            <span className="text-stone-300 text-[11px] sm:text-xs">• محفظة: <strong className="text-white">{selectedWallet}</strong></span>
          )}
        </div>

        {totalFilteredAmount > 0 && (
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-stone-800 pt-1.5 sm:pt-0">
            <span className="text-stone-400 text-xs">إجمالي المبالغ المسجلة:</span>
            <span className="font-mono-num text-xs sm:text-sm font-black text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800/60">
              {totalFilteredAmount.toLocaleString('en-US')} ج.م
            </span>
          </div>
        )}
      </div>

      {/* Grid View of Orders (Grouped) */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => {
            const hasMultiplePayments = group.payments.length > 1;
            const primaryPayment = group.payments[0];
            const hasDateMismatch = group.payments.some(
              (p) => p.receipt_date && p.work_date && p.receipt_date !== p.work_date
            );

            return (
              <div
                key={group.group_key}
                onClick={() => onSelectOrder(group)}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-red-700 hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between group relative"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-transparent group-hover:bg-red-700 transition-colors" />

                <div>
                  {/* Card Top Banner */}
                  <div className="p-4 border-b border-stone-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base sm:text-lg font-black text-stone-950 font-mono-num">
                        #{group.order_num}
                      </span>
                      {group.is_reservation && (
                        group.reservation_status === 'delivered' ? (
                          <span className="bg-emerald-100 text-emerald-950 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                            حجز تم تسليمه
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                            حجز مسبق
                          </span>
                        )
                      )}
                      {hasMultiplePayments && (
                        <span className="bg-amber-100 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>{group.payments.length} دفعات</span>
                        </span>
                      )}
                      {hasDateMismatch && (
                        <span className="bg-amber-50 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          <span>فرق تاريخ</span>
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-bold bg-stone-100 text-stone-800 px-2.5 py-1 rounded-lg border border-stone-200">
                      {group.branch}
                    </span>
                  </div>

                  {/* Multi-Photo or Single Photo Preview */}
                  {hasMultiplePayments ? (
                    /* Multi-Payment Photo Gallery Preview */
                    <div className="relative aspect-[16/10] bg-stone-950 overflow-hidden flex flex-col justify-between">
                      {/* Split or Main Photo Container */}
                      <div className="relative w-full h-full flex">
                        {group.payments.slice(0, 2).map((p, idx) => (
                          <div 
                            key={p.id || idx} 
                            className={`relative h-full overflow-hidden ${
                              group.payments.length === 2 ? 'w-1/2 border-l border-stone-800 first:border-l-0' : (idx === 0 ? 'w-2/3' : 'w-1/3')
                            }`}
                          >
                            <img
                              src={p.photo_url}
                              alt={`إيصال دفعة ${p.payment_seq}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute top-2 right-2 bg-stone-950/80 text-amber-300 text-[10px] font-black px-1.5 py-0.5 rounded backdrop-blur-xs">
                              دفعة #{p.payment_seq}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Bottom Floating Bar */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-1 flex-wrap">
                          {group.wallets.map((w) => (
                            <span 
                              key={w}
                              className="text-white text-[10px] font-black bg-red-900/90 px-2 py-0.5 rounded border border-red-700/50 shadow-xs"
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                        <span className="text-[10px] font-bold text-amber-300 bg-stone-900/90 px-2 py-0.5 rounded border border-amber-400/40 flex items-center gap-1">
                          <Images className="w-3 h-3" />
                          <span>{group.payments.length} صور إيصالات</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Single Receipt Image Thumbnail */
                    <div className="relative aspect-[16/10] bg-stone-950 overflow-hidden flex items-center justify-center">
                      <img
                        src={primaryPayment.photo_url}
                        alt={`إيصال ${group.order_num}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent flex items-end p-3">
                        <span className="text-white text-xs font-black bg-red-900/95 px-2.5 py-1 rounded-lg border border-red-700/50 shadow-sm">
                          {primaryPayment.wallet}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Details snippet */}
                  <div className="p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-stone-600">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-stone-400" />
                        {group.work_date}
                      </span>
                      {group.total_amount > 0 ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-stone-400">الإجمالي:</span>
                          <span className="font-black text-sm font-mono-num text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {group.total_amount.toLocaleString('en-US')} ج.م
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-stone-400">بدون مبلغ محدد</span>
                      )}
                    </div>

                    {/* Multi-payment Amount Breakdown if exists */}
                    {hasMultiplePayments && (
                      <div className="bg-stone-50 p-2 rounded-xl border border-stone-200/80 space-y-1">
                        <span className="text-[10px] font-black text-stone-500 block">تفصيل مبالغ الدفعات:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {group.payments.map((p) => (
                            <span 
                              key={p.id}
                              className="text-[10px] font-bold bg-white text-stone-800 px-2 py-0.5 rounded border border-stone-300 font-mono-num"
                            >
                              دفعة #{p.payment_seq}: {p.amount ? `${p.amount} ج.م` : '-'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reference numbers list */}
                    {group.reference_nums.length > 0 && (
                      <div className="text-[11px] font-mono text-stone-600 truncate bg-stone-50 p-2 rounded-lg border border-stone-200/70 flex items-center gap-1">
                        <span className="text-stone-400 shrink-0">مرجع:</span>
                        <span className="text-stone-900 font-bold truncate">
                          {group.reference_nums.join(' • ')}
                        </span>
                      </div>
                    )}

                    {/* Notes */}
                    {group.notes.length > 0 && (
                      <p className="text-[11px] text-stone-500 line-clamp-1 italic">
                        "{group.notes.join(' - ')}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer Action */}
                <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs text-red-800 font-bold group-hover:bg-red-50/50 transition">
                  <span>
                    {hasMultiplePayments 
                      ? `استعراض صور الإيصالات (${group.payments.length} إيصالات)` 
                      : 'استعراض الإيصال والمطابقة'}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View of Orders */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-stone-900 text-stone-200 font-black border-b border-stone-800">
              <tr>
                <th className="p-3.5">رقم الطلب</th>
                <th className="p-3.5">الفرع</th>
                <th className="p-3.5">المحافظ المستخدمة</th>
                <th className="p-3.5">تاريخ الوردية</th>
                <th className="p-3.5">عدد الدفعات</th>
                <th className="p-3.5">إجمالي المبلغ</th>
                <th className="p-3.5">الأرقام المرجعية</th>
                <th className="p-3.5 text-center">صور الإيصالات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-800 font-medium">
              {filteredGroups.map((group) => {
                const hasMultiplePayments = group.payments.length > 1;
                const hasDateMismatch = group.payments.some((p) => {
                  if (!p.receipt_date || !p.work_date) return false;
                  return !validateReceiptDateAgainstShift(p.receipt_date, p.work_date).isValid;
                });

                return (
                  <tr
                    key={group.group_key}
                    onClick={() => onSelectOrder(group)}
                    className="hover:bg-stone-50 cursor-pointer transition"
                  >
                    <td className="p-3.5 font-black font-mono-num text-stone-950">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>#{group.order_num}</span>
                        {group.is_reservation && (
                          group.reservation_status === 'delivered' ? (
                            <span className="bg-emerald-100 text-emerald-950 text-[9px] font-black px-1.5 py-0.2 rounded border border-emerald-300">
                              تم التسليم
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-950 text-[9px] font-black px-1.5 py-0.2 rounded border border-amber-300">
                              حجز
                            </span>
                          )
                        )}
                        {hasDateMismatch && (
                          <span title="يوجد اختلاف بين تاريخ الإيصال وتاريخ الوردية" className="text-amber-600">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 font-bold">{group.branch}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {group.wallets.map((w) => (
                          <span 
                            key={w} 
                            className="bg-stone-100 text-stone-900 px-2 py-0.5 rounded-md font-bold text-[11px] border border-stone-300"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono dir-ltr text-right">{group.work_date}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full font-black text-[11px] inline-flex items-center gap-1 ${
                        hasMultiplePayments
                          ? 'bg-amber-100 text-amber-950 border border-amber-300'
                          : 'bg-stone-100 text-stone-700'
                      }`}>
                        {hasMultiplePayments && <Layers className="w-3 h-3" />}
                        <span>{group.payments.length} {hasMultiplePayments ? 'دفعات' : 'دفعة'}</span>
                      </span>
                    </td>
                    <td className="p-3.5 font-black font-mono-num text-emerald-700">
                      {group.total_amount > 0 ? `${group.total_amount.toLocaleString('en-US')} ج.م` : '-'}
                    </td>
                    <td className="p-3.5 font-mono text-stone-600 max-w-[150px] truncate">
                      {group.reference_nums.length > 0 ? group.reference_nums.join(', ') : '-'}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {group.payments.slice(0, 3).map((p, idx) => (
                          <div 
                            key={p.id || idx} 
                            className="w-8 h-8 rounded-lg overflow-hidden border border-stone-300 shadow-xs relative"
                          >
                            <img
                              src={p.photo_url}
                              alt="إيصال"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                        {group.payments.length > 3 && (
                          <span className="text-[10px] font-bold bg-stone-200 text-stone-700 px-1 rounded">
                            +{group.payments.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {filteredGroups.length === 0 && !isLoading && (
        <div className="bg-white p-12 rounded-2xl border border-stone-200/90 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto border border-stone-200">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-stone-900">
            لا توجد طلبات متطابقة مع شروط البحث والفلترة
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            جرب تغيير معايير البحث أو اختيار تاريخ وردية مختلف، أو تسجيل طلب جديد
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedBranch('all');
              setSelectedWallet('all');
              setDateFilterMode('all');
            }}
            className="text-xs text-red-800 hover:text-red-950 font-black underline"
          >
            إعادة تعيين كافة الفلاتر
          </button>
        </div>
      )}
    </div>
  );
};
