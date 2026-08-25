import React, { useState, useMemo } from 'react';
import { 
  X, 
  RotateCw, 
  Download, 
  Trash2, 
  Building2, 
  Calendar, 
  Wallet, 
  Hash, 
  Clock, 
  Copy, 
  Check, 
  DollarSign, 
  FileCheck,
  Receipt,
  Layers,
  ChevronRight,
  ChevronLeft,
  User,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { Order, GroupedOrder } from '../types';
import { formatArabicDate, validateReceiptDateAgainstShift } from '../data/constants';

interface ReceiptModalProps {
  order: Order | GroupedOrder | null;
  allOrders?: Order[];
  onClose: () => void;
  onDeleteOrder: (id: string) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  order,
  allOrders,
  onClose,
  onDeleteOrder,
}) => {
  if (!order) return null;

  // Resolve all payment receipts for this order
  const payments: Order[] = useMemo(() => {
    if ('payments' in order && Array.isArray((order as GroupedOrder).payments) && (order as GroupedOrder).payments.length > 0) {
      return [...(order as GroupedOrder).payments].sort((a, b) => (a.payment_seq || 1) - (b.payment_seq || 1));
    }
    if (allOrders && allOrders.length > 0) {
      const matching = allOrders.filter(
        (o) => o.branch === order.branch && o.order_num === order.order_num && o.work_date === order.work_date
      );
      if (matching.length > 0) {
        return [...matching].sort((a, b) => (a.payment_seq || 1) - (b.payment_seq || 1));
      }
    }
    return [order as Order];
  }, [order, allOrders]);

  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [rotation, setRotation] = useState(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isConfirmDelete, setIsConfirmDelete] = useState(false);

  // Active payment
  const activePayment: Order = payments[selectedIdx] || payments[0] || (order as Order);

  // Calculate order combined total amount
  const totalOrderAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = activePayment.photo_url;
    link.download = `receipt_${activePayment.work_date}_${activePayment.order_num}_p${activePayment.payment_seq}.jpg`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 overflow-y-auto animate-in fade-in font-['Cairo']">
      <div 
        className="bg-white rounded-2xl sm:rounded-3xl max-w-5xl w-full max-h-[94vh] sm:max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-3.5 py-3 sm:px-6 sm:py-4 border-b border-stone-200 bg-stone-900 text-white">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-red-800 text-amber-300 flex items-center justify-center font-black shadow-inner shrink-0">
              <FileCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                <span className="text-base sm:text-lg font-black font-mono-num text-stone-100 truncate">
                  طلب #{order.order_num}
                </span>
                {payments.length > 1 ? (
                  <span className="bg-amber-400 text-stone-950 text-[10px] sm:text-xs font-black px-2 sm:px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                    <Layers className="w-3 h-3" />
                    <span>{payments.length} دفعات</span>
                  </span>
                ) : (
                  <span className="bg-stone-800 text-stone-300 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border border-stone-700 shrink-0">
                    دفعة واحدة
                  </span>
                )}
              </div>
              <span className="text-[11px] sm:text-xs text-stone-400 font-bold block truncate">
                فرع {order.branch} • وردية {order.work_date}
              </span>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="p-1.5 sm:p-2 text-stone-300 hover:text-white hover:bg-stone-800 rounded-xl transition"
              title="تدوير الصورة 90 درجة"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 sm:p-2 text-stone-300 hover:text-white hover:bg-stone-800 rounded-xl transition"
              title="تحميل نسخة من صورة الإيصال"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Multi-Payment Selector Tab Strip (When more than 1 payment exists) */}
        {payments.length > 1 && (
          <div className="bg-stone-100 px-3.5 py-2 sm:px-6 sm:py-2.5 border-b border-stone-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs font-black text-stone-600 shrink-0 flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 text-red-800" />
              إيصالات الدفعات:
            </span>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1">
              {payments.map((p, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                  <button
                    key={p.id || idx}
                    onClick={() => {
                      setSelectedIdx(idx);
                      setRotation(0);
                      setIsConfirmDelete(false);
                    }}
                    className={`flex items-center gap-1.5 sm:gap-2.5 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      isSelected
                        ? 'bg-red-800 text-white shadow-md ring-2 ring-red-700/30'
                        : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-300'
                    }`}
                  >
                    <span>الدفعة #{p.payment_seq}</span>
                    <span className={`text-[10px] sm:text-[11px] font-black px-1.5 py-0.2 rounded ${
                      isSelected ? 'bg-amber-400 text-stone-950' : 'bg-stone-100 text-stone-800'
                    }`}>
                      {p.amount ? `${p.amount} ج.م` : '-'}
                    </span>
                    <span className={`text-[10px] ${isSelected ? 'text-red-100' : 'text-stone-500'}`}>
                      {p.wallet}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Body: Image & Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 overflow-y-auto flex-1">
          
          {/* Receipt Image Viewer Column */}
          <div className="md:col-span-7 bg-stone-950 flex flex-col items-center justify-between p-2.5 sm:p-4 min-h-[260px] sm:min-h-[360px] max-h-[420px] sm:max-h-[560px] relative overflow-hidden">
            
            {/* Center Image */}
            <div className="flex-1 flex items-center justify-center w-full h-full relative">
              <img
                src={activePayment.photo_url}
                alt={`إيصال ${activePayment.order_num} دفعة ${activePayment.payment_seq}`}
                style={{ transform: `rotate(${rotation}deg)` }}
                className="max-h-[360px] sm:max-h-[480px] w-auto max-w-full object-contain rounded-lg shadow-2xl transition-transform duration-200 border border-stone-800"
              />

              {/* Prev / Next Arrows if multiple payments */}
              {payments.length > 1 && (
                <>
                  <button
                    onClick={() => {
                      setSelectedIdx((prev) => (prev > 0 ? prev - 1 : payments.length - 1));
                      setRotation(0);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-stone-900/80 hover:bg-red-800 text-white transition backdrop-blur-sm border border-stone-700"
                    title="الدفعة السابقة"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedIdx((prev) => (prev < payments.length - 1 ? prev + 1 : 0));
                      setRotation(0);
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-stone-900/80 hover:bg-red-800 text-white transition backdrop-blur-sm border border-stone-700"
                    title="الدفعة التالية"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {/* Image Bottom Overlay Bar */}
            <div className="w-full flex items-center justify-between pt-2 px-2 text-xs text-stone-400">
              <span className="bg-stone-900/90 text-amber-300 font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-stone-800 text-[11px] sm:text-xs">
                إيصال {activePayment.wallet} {payments.length > 1 ? `(دفعة ${activePayment.payment_seq} من ${payments.length})` : ''}
              </span>
              <span className="hidden sm:inline text-[11px] font-mono text-stone-400">
                انقر زر التدوير أو التحميل بالأعلى للتحكم بالصورة
              </span>
            </div>
          </div>

          {/* Metadata & Controls Column */}
          <div className="md:col-span-5 p-4 sm:p-5 space-y-3.5 sm:space-y-4 bg-white flex flex-col justify-between overflow-y-auto">
            
            <div className="space-y-3">
              
              {/* Total Order Summary Box */}
              <div className="bg-stone-900 text-stone-100 p-3.5 rounded-2xl border border-stone-800 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-400 font-bold">إجمالي مبالغ الطلب:</span>
                  <span className="text-base font-black font-mono-num text-emerald-400">
                    {totalOrderAmount > 0 ? `${totalOrderAmount.toLocaleString('en-US')} ج.م` : 'غير محدد'}
                  </span>
                </div>
                {payments.length > 1 && (
                  <div className="text-[11px] text-stone-300 border-t border-stone-800 pt-2 flex items-center justify-between">
                    <span>عدد الدفعات المسجلة:</span>
                    <span className="font-bold text-amber-300 font-mono-num">{payments.length} دفعات</span>
                  </div>
                )}
              </div>

              <h4 className="text-xs font-black uppercase tracking-wider text-stone-400 pb-1 border-b border-stone-100 flex items-center justify-between">
                <span>بيانات الدفعة الحالية (#{activePayment.payment_seq})</span>
                {payments.length > 1 && (
                  <span className="text-red-800 font-mono-num">
                    {selectedIdx + 1} / {payments.length}
                  </span>
                )}
              </h4>

              {/* Transaction Metadata Details */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200/80">
                  <span className="text-stone-500 font-bold flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-red-800" />
                    رقم الطلب:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-stone-950 font-mono-num">
                      #{activePayment.order_num}
                    </span>
                    <button
                      onClick={() => copyToClipboard(activePayment.order_num, 'order_num')}
                      className="text-stone-400 hover:text-red-800"
                      title="نسخ رقم الطلب"
                    >
                      {copiedField === 'order_num' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200/80">
                  <span className="text-stone-500 font-bold flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-red-800" />
                    الفرع:
                  </span>
                  <span className="font-black text-stone-900">{activePayment.branch}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200/80">
                  <span className="text-stone-500 font-bold flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-red-800" />
                    نوع المحفظة:
                  </span>
                  <span className="font-black text-stone-900 bg-stone-200/80 px-2.5 py-0.5 rounded-md border border-stone-300">
                    {activePayment.wallet}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200/80">
                  <span className="text-stone-500 font-bold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-red-800" />
                    تاريخ الوردية:
                  </span>
                  <span className="font-bold text-stone-800 font-mono dir-ltr">
                    {activePayment.work_date} ({formatArabicDate(activePayment.work_date)})
                  </span>
                </div>

                {/* Receipt Extracted Date & Shift Validity Security Check */}
                {activePayment.receipt_date && (() => {
                  const dateVal = validateReceiptDateAgainstShift(activePayment.receipt_date, activePayment.work_date);

                  return (
                    <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                      dateVal.status === 'past_date_rejected'
                        ? 'bg-rose-50 border-rose-300'
                        : dateVal.status === 'future_date_mismatch'
                        ? 'bg-amber-50 border-amber-300'
                        : 'bg-emerald-50/70 border-emerald-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-600 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-stone-500" />
                          تاريخ الإيصال الفعلي:
                        </span>
                        <span className="font-bold font-mono dir-ltr text-stone-900">
                          {activePayment.receipt_date} {activePayment.receipt_time || ''}
                        </span>
                      </div>
                      {dateVal.status === 'past_date_rejected' ? (
                        <div className="flex items-center gap-1.5 text-rose-900 font-bold text-[11px] bg-rose-100/80 p-1.5 rounded-lg border border-rose-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                          <span>تحذير: تاريخ الإيصال أقدم من تاريخ الوردية ({activePayment.work_date})</span>
                        </div>
                      ) : dateVal.status === 'future_date_mismatch' ? (
                        <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px] bg-amber-100/80 p-1.5 rounded-lg border border-amber-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>تنبيه: تاريخ الإيصال يختلف عن تاريخ وردية العمل ({activePayment.work_date})</span>
                        </div>
                      ) : dateVal.status === 'post_midnight' ? (
                        <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>إشعار بعد الساعة 12 منتصف الليل (مقبول تلقائياً ضمن الوردية) ✓</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>تاريخ الإيصال مطابق لتاريخ الوردية ✓</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {activePayment.amount ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-emerald-900 font-bold flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                      مبلغ هذه الدفعة:
                    </span>
                    <span className="font-black text-sm font-mono-num text-emerald-800">
                      {activePayment.amount} ج.م
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200/80">
                    <span className="text-stone-500 font-bold">مبلغ هذه الدفعة:</span>
                    <span className="text-stone-400 font-bold">غير محدد</span>
                  </div>
                )}

                {activePayment.reference_num && (
                  <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200/80">
                    <span className="text-stone-500 font-bold">الرقم المرجعي:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-stone-900 text-[11px] font-bold dir-ltr">
                        {activePayment.reference_num}
                      </span>
                      <button
                        onClick={() => copyToClipboard(activePayment.reference_num!, 'ref')}
                        className="text-stone-400 hover:text-red-800"
                      >
                        {copiedField === 'ref' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                )}

                {activePayment.user_name && (
                  <div className="flex items-center justify-between p-2.5 bg-stone-50 rounded-xl border border-stone-200/80">
                    <span className="text-stone-500 font-bold flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-red-800" />
                      الموظف المسجل:
                    </span>
                    <span className="font-bold text-stone-900">{activePayment.user_name}</span>
                  </div>
                )}

                {activePayment.notes && (
                  <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 text-xs">
                    <span className="text-stone-500 font-bold block mb-0.5">ملاحظات الموظف:</span>
                    <p className="text-stone-900 font-medium">{activePayment.notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1 font-medium">
                  <span>وقت التوثيق:</span>
                  <span className="dir-ltr font-mono">
                    {new Date(activePayment.created_at).toLocaleString('ar-EG')}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions (Delete) */}
            <div className="pt-3 border-t border-stone-100">
              {isConfirmDelete ? (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-2 text-center animate-in fade-in">
                  <p className="text-xs font-black text-rose-900">
                    {payments.length > 1 
                      ? `هل أنت متأكد من حذف إيصال الدفعة #${activePayment.payment_seq} نهائياً؟` 
                      : 'هل أنت متأكد من حذف هذا الطلب نهائياً؟'}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        onDeleteOrder(activePayment.id);
                        if (payments.length <= 1) {
                          onClose();
                        } else {
                          setIsConfirmDelete(false);
                          setSelectedIdx(0);
                        }
                      }}
                      className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-black px-3.5 py-1.5 rounded-lg transition"
                    >
                      نعم، حذف
                    </button>
                    <button
                      onClick={() => setIsConfirmDelete(false)}
                      className="bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-black px-3.5 py-1.5 rounded-lg transition"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmDelete(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-rose-700 hover:text-rose-900 hover:bg-rose-50 text-xs font-black py-2.5 rounded-xl border border-rose-200 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {payments.length > 1 
                      ? `حذف إيصال الدفعة #${activePayment.payment_seq}` 
                      : 'حذف هذا الطلب من السجل'}
                  </span>
                </button>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

