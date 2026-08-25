import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Hash, 
  Calendar, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw,
  DollarSign,
  FileCheck,
  Ban,
  Clock,
  Receipt
} from 'lucide-react';
import { Branch, WalletType, Order, AppUser } from '../types';
import { BRANCHES, WALLETS, getCairoWorkDate, getUserAllowedBranches, validateReceiptDateAgainstShift } from '../data/constants';
import { ImageScanner } from './ImageScanner';
import { BrandLogo } from './BrandLogo';

interface NewOrderViewProps {
  onOrderCreated: (order: Order) => void;
  onNavigateToList: () => void;
  currentUser?: AppUser | null;
}

const BRANCH_META: Record<Branch, { code: string; label: string }> = {
  'عصافرة': { code: '', label: '' },
  'ميامي': { code: '', label: '' },
  'سان ستيفانو': { code: '', label: '' },
};

export const NewOrderView: React.FC<NewOrderViewProps> = ({
  onOrderCreated,
  onNavigateToList,
  currentUser,
}) => {
  const defaultDate = getCairoWorkDate();
  const allowedBranches = getUserAllowedBranches(currentUser);

  // Default to the first allowed branch or existing
  const [branch, setBranch] = useState<Branch>(allowedBranches[0] || 'عصافرة');

  useEffect(() => {
    if (!allowedBranches.includes(branch)) {
      setBranch(allowedBranches[0] || 'عصافرة');
    }
  }, [currentUser]);
  const [orderNum, setOrderNum] = useState<string>('');
  const [workDate, setWorkDate] = useState<string>(defaultDate);
  const [isCustomDate, setIsCustomDate] = useState<boolean>(false);
  const [wallet, setWallet] = useState<WalletType | ''>('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [referenceNum, setReferenceNum] = useState<string>('');
  const [receiptDate, setReceiptDate] = useState<string | null>(null);
  const [receiptTime, setReceiptTime] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');

  const [existingPaymentsCount, setExistingPaymentsCount] = useState<number>(0);
  const [isDuplicate, setIsDuplicate] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-check if order already has payments today
  useEffect(() => {
    if (!orderNum.trim()) {
      setExistingPaymentsCount(0);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/orders/check-seq?order_num=${encodeURIComponent(orderNum.trim())}&work_date=${encodeURIComponent(workDate)}&branch=${encodeURIComponent(branch)}`);
        if (res.ok) {
          const data = await res.json();
          setExistingPaymentsCount(data.existing_count || 0);
        }
      } catch (e) {
        console.error('Sequence check error:', e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [orderNum, workDate, branch]);

  const handleOrderNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setOrderNum(val);
    if (errorMsg) setErrorMsg(null);
  };

  const handlePhotoSelected = (dataUrl: string) => {
    setPhotoDataUrl(dataUrl);
    setIsDuplicate(false);
    setReceiptDate(null);
    setReceiptTime(null);
    if (errorMsg) setErrorMsg(null);
  };

  const handleAnalysisComplete = (result: any) => {
    if (result.detected_wallet) {
      setWallet(result.detected_wallet);
    }
    if (result.amount && !amount) {
      setAmount(String(result.amount));
    }
    if (result.reference_num && !referenceNum) {
      setReferenceNum(result.reference_num);
    }
    if (result.receipt_date) {
      setReceiptDate(result.receipt_date);
    }
    if (result.receipt_time) {
      setReceiptTime(result.receipt_time);
    }
    if (result.is_duplicate) {
      setIsDuplicate(true);
      setErrorMsg(result.notes || 'تحذير: تم اكتشاف إيصال مكرر مسجل مسبقاً في النظام!');
    }
  };

  const resetForm = () => {
    setOrderNum('');
    setPhotoDataUrl(null);
    setAmount('');
    setReferenceNum('');
    setReceiptDate(null);
    setReceiptTime(null);
    setNotes('');
    setIsDuplicate(false);
    setErrorMsg(null);
    setExistingPaymentsCount(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isFutureReservation = workDate > defaultDate;

    if (!isFutureReservation && !orderNum.trim()) {
      setErrorMsg('يرجى إدخال رقم الطلب.');
      return;
    }
    if (!photoDataUrl) {
      setErrorMsg('يرجى التقاط أو رفع صورة إيصال التحويل.');
      return;
    }
    if (!wallet) {
      setErrorMsg('يرجى اختيار نوع المحفظة المستخدمة للتحويل.');
      return;
    }
    if (isDuplicate) {
      setErrorMsg('لا يمكن حفظ هذا الطلب لأن صورة الإيصال مكررة.');
      return;
    }

    const dateVal = validateReceiptDateAgainstShift(receiptDate, workDate);
    if (dateVal.isStrictReject) {
      setErrorMsg(dateVal.message || 'لا يمكن حفظ الطلب: تاريخ الإشعار سابق لتاريخ الوردية.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      const payload = {
        branch,
        order_num: orderNum.trim() || undefined,
        work_date: workDate,
        wallet,
        photo_url: photoDataUrl,
        receipt_photo_url: photoDataUrl,
        receipt_date: receiptDate || undefined,
        receipt_time: receiptTime || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        reference_num: referenceNum.trim() || undefined,
        notes: notes.trim() || undefined,
        user_name: currentUser?.displayName || currentUser?.username || 'موظف',
        is_reservation: isFutureReservation,
        payment_shift_date: defaultDate,
        reservation_status: isFutureReservation ? 'pending' : undefined,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.is_duplicate) {
          setIsDuplicate(true);
        }
        throw new Error(data?.error || 'فشل حفظ الطلب');
      }

      onOrderCreated(data.order);
      setSaveSuccessMsg(data.message || 'تم توثيق وحفظ الطلب بنجاح في السحابة!');
      resetForm();
    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ الطلب.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-5 font-['Cairo'] w-full max-w-full overflow-x-hidden">
      
      {/* Mobile-Only Top Centered Brand Identity */}
      <div className="flex sm:hidden flex-col items-center justify-center py-2 space-y-1.5 text-center">
        <BrandLogo size="md" />
        <h1 className="text-base font-black text-stone-900 tracking-tight">
          مطاعم عروس دمشق
        </h1>
      </div>

      {/* Desktop Executive Workstation Header Banner (Hidden on Mobile) */}
      <div className="hidden sm:flex bg-white rounded-2xl border border-stone-200/90 shadow-sm p-4 sm:p-6 flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-red-800 via-rose-900 to-amber-600" />
        
        <div>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center font-bold text-xs sm:text-sm shadow-inner shrink-0">
              <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </span>
            <h2 className="text-lg sm:text-2xl font-black text-stone-900 tracking-tight">
              محطة توثيق الإيصالات والطلبات
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 font-medium">
            توثيق المعاملات المالية المباشرة والتحقق الفوري من إيصالات الدفع الذكية
          </p>
        </div>

        {/* Shift Date Switcher */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-stone-100 p-1 sm:p-1.5 rounded-xl border border-stone-200 text-xs font-bold w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={() => {
              setIsCustomDate(false);
              setWorkDate(defaultDate);
            }}
            className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg transition-all text-center ${
              !isCustomDate
                ? 'bg-stone-900 text-amber-300 shadow-sm border border-stone-800 font-extrabold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            وردية اليوم ({defaultDate})
          </button>
          <button
            type="button"
            onClick={() => setIsCustomDate(true)}
            className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg transition-all text-center ${
              isCustomDate
                ? 'bg-stone-900 text-amber-300 shadow-sm border border-stone-800 font-extrabold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            وردية سابقة
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessMsg && (
        <div className="bg-emerald-900 text-white p-3.5 sm:p-4 rounded-2xl border border-emerald-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md shadow-emerald-950/20 animate-in fade-in">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500 text-stone-950 flex items-center justify-center shrink-0 font-bold">
              <FileCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h4 className="font-black text-xs sm:text-sm text-emerald-100">{saveSuccessMsg}</h4>
              <p className="text-[11px] sm:text-xs text-emerald-300 mt-0.5">
                تم تثبيت الإيصال في السحابة ومزامنته مع كافة الفروع والحسابات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onNavigateToList}
              className="flex-1 sm:flex-initial bg-white hover:bg-stone-100 text-emerald-950 text-xs font-black px-3.5 py-2 rounded-xl shadow-sm transition text-center"
            >
              فتح سجل الطلبات
            </button>
            <button
              type="button"
              onClick={() => setSaveSuccessMsg(null)}
              className="text-xs text-emerald-200 hover:text-white font-bold px-2 py-1"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" autoComplete="off">
        
        {/* Step 1: Branch Selection */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200/90 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs sm:text-sm font-black text-stone-900">
              <Building2 className="w-4 h-4 text-red-800" />
              <span>1. فرع التسجيل:</span>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {allowedBranches.map((b) => {
              const isSelected = branch === b;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBranch(b)}
                  className={`py-2 sm:py-2.5 px-2 rounded-xl border text-center transition-all flex items-center justify-center ${
                    isSelected
                      ? 'bg-stone-900 border-red-800 text-white shadow-sm ring-1 ring-red-700/40 font-black'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200/80 font-bold'
                  }`}
                >
                  <span className="text-xs sm:text-sm truncate">
                    {b}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Order Number & Shift Date Ledger Input */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200/90 shadow-sm space-y-3">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            
            {/* Order Number Field */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-[11px] sm:text-sm font-black text-stone-900 truncate">
                  <Hash className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-800 shrink-0" />
                  <span>2. رقم الطلب {workDate > defaultDate ? '(اختياري للحجز):' : ':'}</span>
                </label>
                {existingPaymentsCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-black text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-300 shrink-0">
                    <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600" />
                    <span>{existingPaymentsCount} دفعة</span>
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  id="order-num-input"
                  name="order_number_field"
                  type="text"
                  inputMode="numeric"
                  pattern={workDate > defaultDate ? undefined : "[0-9]*"}
                  value={orderNum}
                  onChange={handleOrderNumChange}
                  placeholder=""
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  className="w-full text-sm sm:text-lg font-black font-mono-num bg-stone-50/80 border border-stone-300 rounded-xl px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-stone-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-red-700 transition shadow-inner h-[40px] sm:h-[46px]"
                  required={workDate <= defaultDate}
                />
              </div>

              {/* Multi-payment notice */}
              {existingPaymentsCount > 0 && (
                <div className="p-1.5 sm:p-2 bg-amber-50 border border-amber-300 rounded-xl text-[10px] sm:text-xs text-amber-950 flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0 mt-0.5" />
                  <div className="leading-tight">
                    <strong className="text-amber-900 font-black">متعدد: </strong>
                    الطلب #{orderNum} مسجل (دفعة #{existingPaymentsCount + 1}).
                  </div>
                </div>
              )}
            </div>

            {/* Work Date Field */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-[11px] sm:text-sm font-black text-stone-900 truncate">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-800 shrink-0" />
                  <span>تاريخ الوردية:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomDate(!isCustomDate)}
                  className="text-[10px] sm:text-[11px] font-bold text-red-800 hover:text-red-950 underline shrink-0"
                >
                  {isCustomDate ? 'تثبيت' : 'تغيير'}
                </button>
              </div>

              {isCustomDate ? (
                <div className="space-y-1">
                  <input
                    type="date"
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-2 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm font-mono font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700 shadow-inner h-[40px] sm:h-[46px]"
                  />
                  {workDate > defaultDate && (
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                      <span>حجز قادم: سيتم تسجيل الدفع في وردية اليوم وإدراج الطلب في الحجوزات</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-stone-50/80 border border-stone-300 rounded-xl px-2.5 sm:px-3.5 py-2 sm:py-2.5 flex items-center justify-between shadow-inner h-[40px] sm:h-[46px]">
                  <span className="font-black font-mono-num text-stone-900 text-xs sm:text-base dir-ltr">{workDate}</span>
                  <span className="text-[9px] sm:text-[11px] text-red-800 font-black bg-red-50 border border-red-200 px-1.5 sm:px-2 py-0.5 rounded-md">
                    نشطة
                  </span>
                </div>
              )}

              {/* Shift Date Status & Alerts */}
              {receiptDate && (() => {
                const dateVal = validateReceiptDateAgainstShift(receiptDate, workDate);
                if (dateVal.status === 'past_date_rejected') {
                  return (
                    <div className="p-1.5 sm:p-2 bg-rose-50 border border-rose-300 rounded-xl text-[10px] sm:text-xs space-y-0.5 animate-in fade-in">
                      <div className="flex items-center gap-1 text-rose-950 font-black text-[10px] sm:text-[11px]">
                        <Ban className="w-3 h-3 text-rose-700 shrink-0" />
                        <span>سابق ({receiptDate})</span>
                      </div>
                    </div>
                  );
                }
                if (dateVal.status === 'future_date_mismatch') {
                  return (
                    <div className="p-1.5 sm:p-2 bg-amber-50 border border-amber-300 rounded-xl text-[10px] sm:text-xs animate-in fade-in">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-amber-950 text-[10px] sm:text-[11px] truncate">
                          الإيصال ({receiptDate})
                        </span>
                        <button
                          type="button"
                          onClick={() => setWorkDate(receiptDate)}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-0.5 px-1.5 rounded transition text-[9px] sm:text-[10px] shrink-0"
                        >
                          مطابقة
                        </button>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

          </div>
        </div>

        {/* Step 3: Receipt Image */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <label className="flex items-center gap-2 text-sm font-black text-stone-900">
              <Sparkles className="w-4 h-4 text-red-800" />
              <span>3. صورة الإيصال:</span>
            </label>
          </div>

          <ImageScanner
            photoDataUrl={photoDataUrl}
            onPhotoSelected={handlePhotoSelected}
            onAnalysisComplete={handleAnalysisComplete}
            selectedWallet={wallet}
            onSelectWallet={setWallet}
            workDate={workDate}
            onUpdateWorkDate={(newDate) => setWorkDate(newDate)}
          />
        </div>

        {/* Financial Details Card (Shown only after photo selection) */}
        {photoDataUrl && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/90 shadow-sm space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-black text-stone-700 mb-1.5">
                  المبلغ المقيد بالإيصال:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder=""
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-4 py-2.5 text-base font-black font-mono-num text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700"
                  />
                  <DollarSign className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-stone-700 mb-1.5">
                ملاحظات وتفاصيل إضافية:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder=""
                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-4 py-2.5 text-sm text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700"
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl text-xs font-bold text-rose-950 flex items-center gap-3 shadow-sm">
            {isDuplicate ? (
              <Ban className="w-5 h-5 text-rose-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
            )}
            <div className="flex-1">
              <span className="font-black text-sm block">{errorMsg}</span>
              {isDuplicate && (
                <p className="text-[11px] font-medium text-rose-800 mt-1">
                  النظام يمنع تكرار الإيصالات لضمان عدم ازدواجية التحصيلات المحاسبية بين الفروع.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Submit Action Bar */}
        {(() => {
          const dateVal = validateReceiptDateAgainstShift(receiptDate, workDate);
          const isDateRejected = dateVal.isStrictReject;

          return (
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center justify-center gap-2 text-stone-600 hover:text-stone-950 text-xs sm:text-sm font-bold px-4 py-2.5 sm:py-3 rounded-xl hover:bg-stone-200/70 transition w-full sm:w-auto"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة تعيين الحقول</span>
              </button>

              <button
                id="submit-order-btn"
                type="submit"
                disabled={isSaving || !orderNum.trim() || !photoDataUrl || !wallet || isDuplicate || isDateRejected}
                className={`flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3.5 rounded-xl text-sm sm:text-base font-black text-white shadow-lg transition-all w-full sm:w-auto ${
                  isDuplicate || isDateRejected
                    ? 'bg-rose-700 hover:bg-rose-800 cursor-not-allowed opacity-90'
                    : isSaving || !orderNum.trim() || !photoDataUrl || !wallet
                    ? 'bg-stone-400 cursor-not-allowed opacity-70'
                    : 'bg-gradient-to-r from-red-800 via-rose-900 to-red-950 hover:from-red-700 hover:to-rose-800 active:scale-95 shadow-red-950/40 border border-amber-400/30'
                }`}
              >
                {isSaving ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>جاري الحفظ والتسجيل السحابي...</span>
                  </>
                ) : isDuplicate ? (
                  <>
                    <Ban className="w-5 h-5" />
                    <span>🚫 الإيصال مكرر - محظور الحفظ</span>
                  </>
                ) : isDateRejected ? (
                  <>
                    <Ban className="w-5 h-5" />
                    <span>🚫 تاريخ الإيصال سابق للوردية - محظور</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 text-amber-300" />
                    <span>
                      اعتماد وحفظ الطلب {existingPaymentsCount > 0 ? `(الدفعة #${existingPaymentsCount + 1})` : ''}
                    </span>
                  </>
                )}
              </button>
            </div>
          );
        })()}

      </form>
    </div>
  );
};
