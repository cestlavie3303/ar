import { Branch, WalletRule, WalletType, AppUser } from '../types';

export const BRANCHES: Branch[] = ['عصافرة', 'ميامي', 'سان ستيفانو'];

/**
 * Returns the exact list of branches authorized for the current user.
 * - Admin users have access to all branches unless specifically constrained.
 * - Non-admin users are strictly restricted to their designated allowed_branches list.
 */
export function getUserAllowedBranches(user?: AppUser | null): Branch[] {
  if (!user) return BRANCHES;
  const isAdmin = user.role === 'admin' || user.username?.toLowerCase() === 'ahmed';
  
  if (user.allowed_branches && Array.isArray(user.allowed_branches) && user.allowed_branches.length > 0) {
    const valid = user.allowed_branches.filter((b) => BRANCHES.includes(b as Branch));
    if (valid.length > 0) return valid;
  }
  
  if (isAdmin || user.branch === 'كافة الفروع') {
    return BRANCHES;
  }
  
  if (user.branch && BRANCHES.includes(user.branch as Branch)) {
    return [user.branch as Branch];
  }
  
  return ['عصافرة'];
}

export const WALLETS: WalletType[] = [
  'انستا باي عامر',
  'انستا باي ابو النور',
  'محفظة',
  'انستا باي | شركة عروس دمشق',
];

export const WALLET_RULES: WalletRule[] = [
  {
    wallet: 'انستا باي عامر',
    phones: ['01222566194'],
    name_keywords: ['MOHAMED A', 'MOHAMEDA', 'MOHAMMED A', 'MOHAMMEDA', 'محمد عامر', 'محمد ع'],
    partial_names: ['MOHAM', 'MOHAME', 'MEHMD', 'عامر'],
    description: 'حساب انستاباي - محمد عامر (01222566194)',
    accentColor: '#3B82F6', // Blue
  },
  {
    wallet: 'انستا باي ابو النور',
    phones: ['01222987334'],
    name_keywords: ['SALAH E', 'SALAHE', 'SALEH E', 'SALAH', 'صلاح', 'ابو النور', 'صالح'],
    partial_names: ['SALAH', 'SALEH', 'SALA', 'SALA*'],
    description: 'حساب انستاباي - صلاح / ابو النور (01222987334)',
    accentColor: '#8B5CF6', // Purple
  },
  {
    wallet: 'محفظة',
    phones: ['01557070696'],
    name_keywords: ['اسلام ع', 'islam a', 'اسلام', 'ISLAM', 'فودافون كاش', 'اورنج كاش', 'اتصالات كاش', 'we pay'],
    partial_names: ['اسلا', 'ISLA'],
    description: 'محفظة إلكترونية كاش - إسلام (01557070696)',
    accentColor: '#10B981', // Emerald / Green
  },
  {
    wallet: 'انستا باي | شركة عروس دمشق',
    phones: ['005098170003', '05098170003'],
    name_keywords: [
      'شركة ع*** د***',
      'شركة عروس دمشق',
      'عروس دمشق',
      'شركة ع',
      'FAB MISR',
      'FABMISR',
      '005098170003',
    ],
    partial_names: ['عروس', 'دمشق', 'FAB', '005098170003'],
    description: 'حساب انستاباي - شركة عروس دمشق / بنك أبوظبي الأول FAB MISR (005098170003)',
    accentColor: '#F59E0B', // Amber / Orange
  },
];

/**
 * Calculates current work shift date in Cairo timezone (UTC+2).
 * Rule: If current Cairo time is before 06:00 AM, shift belongs to yesterday.
 */
export function getCairoWorkDate(): string {
  const now = new Date();
  // Get UTC time and add 2 hours for Cairo standard time (UTC+2)
  const cairoTime = new Date(now.getTime() + (2 * 60 + now.getTimezoneOffset()) * 60000);
  
  if (cairoTime.getHours() < 6) {
    cairoTime.setDate(cairoTime.getDate() - 1);
  }
  
  const year = cairoTime.getFullYear();
  const month = String(cairoTime.getMonth() + 1).padStart(2, '0');
  const day = String(cairoTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatArabicDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const monthName = months[parseInt(m, 10) - 1] || m;
    return `${parseInt(d, 10)} ${monthName} ${y}`;
  } catch {
    return dateStr;
  }
}

export function normalizeArabicNumerals(str: string): string {
  if (!str) return '';
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (w) => String(arabicNumbers.indexOf(w)));
}

/**
 * Returns the next day date formatted as YYYY-MM-DD.
 */
export function getNextDayDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      return '';
    }
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    dt.setDate(dt.getDate() + 1);
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

export type ReceiptDateStatus = 'exact_match' | 'post_midnight' | 'past_date_rejected' | 'future_date_mismatch' | 'unknown';

export interface ReceiptDateValidation {
  isValid: boolean;
  status: ReceiptDateStatus;
  message?: string;
  isStrictReject: boolean;
  isPostMidnight: boolean;
}

/**
 * Evaluates receipt date against the shift work_date.
 * - Exact match (receiptDate === workDate): VALID, accepted without warning.
 * - Next day (receiptDate === workDate + 1): VALID (post-midnight shift payment), accepted without warning.
 * - Past date (receiptDate < workDate): REJECTED strictly, cannot be accepted.
 * - Future date (receiptDate > workDate + 1): MISMATCH warning.
 */
export function validateReceiptDateAgainstShift(
  receiptDate: string | null | undefined,
  workDate: string
): ReceiptDateValidation {
  if (!receiptDate || !workDate) {
    return { isValid: true, status: 'unknown', isStrictReject: false, isPostMidnight: false };
  }

  const nextDay = getNextDayDate(workDate);

  // Case 1: Exact match on shift day
  if (receiptDate === workDate) {
    return {
      isValid: true,
      status: 'exact_match',
      isStrictReject: false,
      isPostMidnight: false,
    };
  }

  // Case 2: Post-midnight payment on next calendar day during the same shift (e.g. shift 24, payment at 01:00 AM on 25)
  if (receiptDate === nextDay) {
    return {
      isValid: true,
      status: 'post_midnight',
      isStrictReject: false,
      isPostMidnight: true,
      message: 'إشعار بعد الساعة 12 منتصف الليل ضمن نفس الوردية (مقبول تلقائياً)',
    };
  }

  // Case 3: Past date before shift date -> STRICT REJECTION
  if (receiptDate < workDate) {
    return {
      isValid: false,
      status: 'past_date_rejected',
      isStrictReject: true,
      isPostMidnight: false,
      message: `تم رفض الإيصال: تاريخ الإشعار (${receiptDate}) أقدم من تاريخ الوردية (${workDate}). لا يُقبل تسجيل إيصالات سابقة للوردية.`,
    };
  }

  // Case 4: Future date mismatch (> workDate + 1)
  return {
    isValid: false,
    status: 'future_date_mismatch',
    isStrictReject: false,
    isPostMidnight: false,
    message: `تنبيه أمان: تاريخ الإشعار (${receiptDate}) يختلف عن تاريخ وردية العمل (${workDate}).`,
  };
}

