import React, { useState, useMemo } from 'react';
import { 
  CalendarClock, 
  Search, 
  Building2, 
  Wallet, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  Hash, 
  User, 
  Eye, 
  FileText,
  Calendar,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Branch, Order, WalletType, AppUser, GroupedOrder } from '../types';
import { BRANCHES, getCairoWorkDate, formatArabicDate, getUserAllowedBranches } from '../data/constants';

interface ReservationsViewProps {
  orders: Order[];
  onSelectOrder: (order: Order | GroupedOrder) => void;
  onDeliverReservation: (orderId: string) => Promise<void>;
  currentUser?: AppUser | null;
}

export const ReservationsView: React.FC<ReservationsViewProps> = ({
  orders,
  onSelectOrder,
  onDeliverReservation,
  currentUser,
}) => {
  const todayDate = getCairoWorkDate();
  const allowedBranches = getUserAllowedBranches(currentUser);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.username?.toLowerCase() === 'ahmed';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'upcoming'>('all');
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  // Filter only active reservations that have not been marked delivered yet
  const activeReservations = useMemo(() => {
    return orders.filter((o) => {
      // Must be a reservation and not yet delivered
      const isRes = o.is_reservation || (o.work_date > (o.payment_shift_date || o.created_at?.slice(0, 10) || todayDate));
      const isDelivered = o.reservation_status === 'delivered';
      return isRes && !isDelivered;
    });
  }, [orders, todayDate]);

  // Group multiple payments for the same reservation order if needed
  const filteredReservations = useMemo(() => {
    return activeReservations.filter((o) => {
      // Branch permission
      if (!isAdmin && !allowedBranches.includes(o.branch)) {
        return false;
      }

      // Branch filter
      if (selectedBranch !== 'all' && o.branch !== selectedBranch) {
        return false;
      }

      // Date filter
      if (dateFilter === 'today' && o.work_date !== todayDate) {
        return false;
      }
      if (dateFilter === 'upcoming' && o.work_date <= todayDate) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = String(o.order_num).toLowerCase().includes(q);
        const matchesRef = o.reference_num?.toLowerCase().includes(q);
        const matchesNotes = o.notes?.toLowerCase().includes(q);
        const matchesSender = o.sender_info?.toLowerCase().includes(q);
        const matchesUser = o.user_name?.toLowerCase().includes(q);
        if (!matchesNum && !matchesRef && !matchesNotes && !matchesSender && !matchesUser) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Sort by execution date ascending (soonest first)
      if (a.work_date !== b.work_date) {
        return a.work_date.localeCompare(b.work_date);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [activeReservations, selectedBranch, dateFilter, searchQuery, allowedBranches, isAdmin, todayDate]);

  const handleDeliver = async (orderId: string) => {
    try {
      setDeliveringId(orderId);
      await onDeliverReservation(orderId);
    } catch (err) {
      console.error('Failed to mark reservation delivered:', err);
    } finally {
      setDeliveringId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 font-['Cairo'] w-full max-w-full overflow-x-hidden">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-600 via-red-800 to-rose-900" />
        
        <div>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
              <CalendarClock className="w-4 h-4" />
            </span>
            <h2 className="text-lg sm:text-2xl font-black text-stone-900 tracking-tight">
              أوردرات الحجوزات المدفوعة مسبقاً
            </h2>
            <span className="bg-amber-400 text-stone-950 font-black text-xs px-2.5 py-0.5 rounded-full font-mono">
              {filteredReservations.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 font-medium">
            متابعة الطلبات المجدولة للتنفيذ مع إمكانية تأكيد التسليم المباشر
          </p>
        </div>

        {/* Quick Branch Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full sm:w-auto bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700"
          >
            <option value="all">كافة الفروع</option>
            {allowedBranches.map((b) => (
              <option key={b} value={b}>فرع {b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم الحجز، الرقم المرجعي، الملاحظات..."
            className="w-full bg-stone-50 border border-stone-300 rounded-xl pr-10 pl-4 py-2 text-xs sm:text-sm font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-2 text-xs bg-stone-200 hover:bg-stone-300 px-2 py-0.5 rounded text-stone-700 font-bold"
            >
              مسح
            </button>
          )}
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              dateFilter === 'all'
                ? 'bg-stone-900 text-amber-300 shadow-sm font-extrabold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            الكل ({activeReservations.length})
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              dateFilter === 'today'
                ? 'bg-stone-900 text-amber-300 shadow-sm font-extrabold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            مطلوبة اليوم ({activeReservations.filter((r) => r.work_date === todayDate).length})
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('upcoming')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              dateFilter === 'upcoming'
                ? 'bg-stone-900 text-amber-300 shadow-sm font-extrabold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            مواعيد قادمة ({activeReservations.filter((r) => r.work_date > todayDate).length})
          </button>
        </div>
      </div>

      {/* Reservations Grid */}
      {filteredReservations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200/90 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <CalendarClock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-stone-800">لا توجد حجوزات معلقة</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            كافة الحجوزات تم تسليمها أو لم يتم تسجيل أي أوردرات بتواريخ قادمة بعد
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredReservations.map((order) => {
            const isToday = order.work_date === todayDate;
            const isDelivering = deliveringId === order.id;
            const paymentShift = order.payment_shift_date || order.created_at?.slice(0, 10);

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md ${
                  isToday 
                    ? 'border-amber-400/90 ring-1 ring-amber-300/40 bg-amber-50/10' 
                    : 'border-stone-200/90 hover:border-stone-300'
                }`}
              >
                <div>
                  {/* Top Status Header */}
                  <div className={`px-4 py-2.5 flex items-center justify-between border-b ${
                    isToday ? 'bg-amber-500/15 border-amber-200 text-amber-950' : 'bg-stone-50 border-stone-100 text-stone-800'
                  }`}>
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Building2 className="w-3.5 h-3.5 text-stone-500" />
                      <span>فرع {order.branch}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isToday ? (
                        <span className="bg-amber-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md shadow-xs animate-pulse">
                          مطلوب اليوم
                        </span>
                      ) : (
                        <span className="bg-stone-200 text-stone-800 font-black text-[10px] px-2 py-0.5 rounded-md font-mono">
                          {order.work_date}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3">
                    
                    {/* Order Number & Delivery Date */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-stone-400 block font-bold">رقم الحجز:</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Hash className="w-4 h-4 text-red-800 shrink-0" />
                          <span className="text-xl font-black font-mono-num text-stone-950">
                            {order.order_num}
                          </span>
                        </div>
                      </div>

                      <div className="text-left">
                        <span className="text-[10px] text-stone-400 block font-bold">تاريخ التسليم:</span>
                        <div className="flex items-center gap-1 mt-0.5 text-xs font-black text-stone-900 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-red-800 shrink-0" />
                          <span>{order.work_date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary & Payment Shift */}
                    <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-200/80 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 text-[11px] font-bold">المبلغ المدفوع:</span>
                        <span className="font-black font-mono-num text-stone-950 text-sm">
                          {order.amount ? `${order.amount} EGP` : 'غير محدد'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-stone-200/60 pt-1">
                        <span className="text-stone-500 text-[11px] font-bold">محفظة التحويل:</span>
                        <span className="font-bold text-stone-900 text-[11px] truncate max-w-[150px]">
                          {order.wallet}
                        </span>
                      </div>

                      {paymentShift && (
                        <div className="flex items-center justify-between border-t border-stone-200/60 pt-1 text-[10px] text-stone-500">
                          <span>تاريخ الدفع:</span>
                          <span className="font-mono font-bold text-stone-700">{paymentShift}</span>
                        </div>
                      )}
                    </div>

                    {/* Receipt Image Thumbnail & Click Action */}
                    <div 
                      onClick={() => onSelectOrder(order)}
                      className="relative rounded-xl overflow-hidden border border-stone-200 cursor-pointer group bg-stone-900 h-28 flex items-center justify-center"
                    >
                      <img
                        src={order.photo_url}
                        alt={`إيصال طلب ${order.order_num}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 opacity-90 group-hover:opacity-100"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-stone-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold backdrop-blur-[1px]">
                        <Eye className="w-4 h-4 text-amber-400" />
                        <span>معاينة الإيصال</span>
                      </div>
                    </div>

                    {/* Notes if any */}
                    {order.notes && (
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2 text-xs text-amber-950 flex items-start gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <p className="leading-snug text-[11px] font-medium line-clamp-2">
                          {order.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Delivery Action Button */}
                <div className="p-3 bg-stone-50 border-t border-stone-100">
                  <button
                    type="button"
                    disabled={isDelivering}
                    onClick={() => handleDeliver(order.id)}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black py-2.5 px-4 rounded-xl text-xs sm:text-sm shadow-sm transition active:scale-[0.98] disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>{isDelivering ? 'جاري التسليم...' : 'تم التسليم'}</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
