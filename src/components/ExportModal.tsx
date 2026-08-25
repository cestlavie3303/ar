import React, { useState } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  FileCheck2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Order, AppUser } from '../types';
import { getCairoWorkDate, formatArabicDate, getUserAllowedBranches, validateReceiptDateAgainstShift } from '../data/constants';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  currentUser?: AppUser | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  orders,
  currentUser,
}) => {
  if (!isOpen) return null;

  const today = getCairoWorkDate();
  const allowedBranches = getUserAllowedBranches(currentUser);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.username?.toLowerCase() === 'ahmed';

  const [exportMode, setExportMode] = useState<'today' | 'custom' | 'all'>('today');
  const [customDate, setCustomDate] = useState<string>(today);
  const [isExporting, setIsExporting] = useState(false);

  const getFilteredOrders = () => {
    let scoped = orders;
    if (!isAdmin) {
      scoped = orders.filter((o) => allowedBranches.includes(o.branch));
    }

    if (exportMode === 'today') {
      return scoped.filter((o) => o.work_date === today);
    }
    if (exportMode === 'custom') {
      return scoped.filter((o) => o.work_date === customDate);
    }
    return scoped;
  };

  const handleExport = () => {
    setIsExporting(true);
    try {
      const targetOrders = getFilteredOrders();

      if (targetOrders.length === 0) {
        alert('لا توجد طلبات متطابقة مع النطاق المحدد للتصدير.');
        setIsExporting(false);
        return;
      }

      // Prepare Excel rows in Arabic
      const rows = targetOrders.map((o) => {
        let dateStatus = 'غير مفحوص';
        if (o.receipt_date && o.work_date) {
          const dateVal = validateReceiptDateAgainstShift(o.receipt_date, o.work_date);
          if (dateVal.status === 'exact_match') {
            dateStatus = 'مطابق للوردية ✓';
          } else if (dateVal.status === 'post_midnight') {
            dateStatus = 'بعد منتصف الليل (مقبول ضمن الوردية) ✓';
          } else if (dateVal.status === 'past_date_rejected') {
            dateStatus = `تحذير: إيصال سابق للوردية (${o.receipt_date} < ${o.work_date}) ⚠️`;
          } else if (dateVal.status === 'future_date_mismatch') {
            dateStatus = `تنبيه: فرق تاريخ (${o.receipt_date} ≠ ${o.work_date}) ⚠️`;
          }
        }

        return {
          'رقم الطلب': o.order_num,
          'الفرع': o.branch,
          'نوع المحفظة': o.wallet,
          'تاريخ الوردية': o.work_date,
          'تاريخ الإيصال الفعلي': o.receipt_date ? `${o.receipt_date} ${o.receipt_time || ''}`.trim() : 'غير مسجل',
          'حالة مطابقة التاريخ': dateStatus,
          'رقم الدفعة': o.payment_seq,
          'المبلغ (ج.م)': o.amount || '',
          'الرقم المرجعي / كود العملية': o.reference_num || '',
          'الموظف المسجل': o.user_name || '',
          'ملاحظات': o.notes || '',
          'وقت التسجيل بالنظام': new Date(o.created_at).toLocaleString('ar-EG'),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Set column widths
      worksheet['!cols'] = [
        { wch: 15 }, // رقم الطلب
        { wch: 15 }, // الفرع
        { wch: 22 }, // المحفظة
        { wch: 15 }, // تاريخ الوردية
        { wch: 20 }, // تاريخ الإيصال الفعلي
        { wch: 30 }, // حالة مطابقة التاريخ
        { wch: 12 }, // رقم الدفعة
        { wch: 15 }, // المبلغ
        { wch: 25 }, // الرقم المرجعي
        { wch: 18 }, // الموظف
        { wch: 30 }, // ملاحظات
        { wch: 25 }, // وقت التسجيل
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'توثيق الطلبات');

      const fileName =
        exportMode === 'today'
          ? `طلبات_وردية_${today}.xlsx`
          : exportMode === 'custom'
          ? `طلبات_وردية_${customDate}.xlsx`
          : `كافة_الطلبات_الموثقة_${today}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      onClose();
    } catch (err) {
      console.error('Export error:', err);
      alert('حدث خطأ أثناء إنشاء ملف الإكسيل.');
    } finally {
      setIsExporting(false);
    }
  };

  const previewCount = getFilteredOrders().length;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in font-['Cairo']">
      <div 
        className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-200 bg-stone-900 text-white">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-800 text-emerald-200 flex items-center justify-center font-black shadow-inner shrink-0">
              <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-stone-100 text-sm sm:text-base truncate">
                تصدير السجل المحاسبي (.XLSX)
              </h3>
              <p className="text-[10px] sm:text-[11px] text-stone-400 font-bold truncate">توليد ملف إكسيل معتمد للجرد المالي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4">
          <p className="text-xs text-stone-600 font-medium">
            حدد النطاق الزمني للطلبات والإيصالات المراد تصديرها:
          </p>

          <div className="space-y-2 sm:space-y-2.5">
            {/* Today */}
            <label className={`flex items-center justify-between p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border cursor-pointer transition ${
              exportMode === 'today'
                ? 'bg-stone-900 border-stone-800 text-white font-black shadow-sm'
                : 'bg-stone-50 border-stone-200 text-stone-800 font-bold hover:bg-stone-100'
            }`}>
              <div className="flex items-center gap-2 sm:gap-2.5">
                <input
                  type="radio"
                  name="exportMode"
                  checked={exportMode === 'today'}
                  onChange={() => setExportMode('today')}
                  className="text-red-700 focus:ring-red-700"
                />
                <span className="text-xs sm:text-sm">وردية اليوم ({today})</span>
              </div>
              <span className={`text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-md font-mono-num font-bold ${
                exportMode === 'today' ? 'bg-amber-400 text-stone-950' : 'bg-white text-stone-800 border border-stone-300'
              }`}>
                {orders.filter((o) => o.work_date === today).length} طلب
              </span>
            </label>

            {/* Custom Date */}
            <label className={`flex flex-col p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border cursor-pointer transition ${
              exportMode === 'custom'
                ? 'bg-stone-900 border-stone-800 text-white font-black shadow-sm'
                : 'bg-stone-50 border-stone-200 text-stone-800 font-bold hover:bg-stone-100'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <input
                    type="radio"
                    name="exportMode"
                    checked={exportMode === 'custom'}
                    onChange={() => setExportMode('custom')}
                    className="text-red-700 focus:ring-red-700"
                  />
                  <span className="text-xs sm:text-sm">تاريخ وردية مخصص</span>
                </div>
              </div>

              {exportMode === 'custom' && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="bg-stone-800 border border-stone-700 text-white rounded-xl px-3 py-2 text-xs font-mono font-bold w-full"
                />
              )}
            </label>

            {/* All */}
            <label className={`flex items-center justify-between p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border cursor-pointer transition ${
              exportMode === 'all'
                ? 'bg-stone-900 border-stone-800 text-white font-black shadow-sm'
                : 'bg-stone-50 border-stone-200 text-stone-800 font-bold hover:bg-stone-100'
            }`}>
              <div className="flex items-center gap-2 sm:gap-2.5">
                <input
                  type="radio"
                  name="exportMode"
                  checked={exportMode === 'all'}
                  onChange={() => setExportMode('all')}
                  className="text-red-700 focus:ring-red-700"
                />
                <span className="text-xs sm:text-sm">كافة السجلات التراكمية (الكل)</span>
              </div>
              <span className={`text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-md font-mono-num font-bold ${
                exportMode === 'all' ? 'bg-amber-400 text-stone-950' : 'bg-white text-stone-800 border border-stone-300'
              }`}>
                {orders.length} طلب
              </span>
            </label>
          </div>

          <div className="bg-stone-50 p-3 sm:p-3.5 rounded-xl border border-stone-200 text-xs text-stone-700 flex items-center justify-between font-bold">
            <span>الطلبات المجهزة للتقرير:</span>
            <strong className="text-emerald-700 font-mono-num font-black text-xs sm:text-sm bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {previewCount} طلب مسجل
            </strong>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-stone-50 border-t border-stone-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto text-center px-4 py-2 text-xs font-black text-stone-600 hover:text-stone-900 rounded-xl"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || previewCount === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-red-800 to-rose-900 hover:from-red-700 hover:to-rose-800 active:scale-95 text-white text-xs sm:text-sm font-black px-6 py-2.5 rounded-xl shadow-md border border-amber-400/20 transition"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>توليد وتنزيل الإكسيل</span>
          </button>
        </div>
      </div>
    </div>
  );
};
