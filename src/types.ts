export type Branch = 'عصافرة' | 'ميامي' | 'سان ستيفانو';

export type WalletType =
  | 'انستا باي عامر'
  | 'انستا باي ابو النور'
  | 'محفظة'
  | 'انستا باي | شركة عروس دمشق'
  | 'أخرى';

export interface Order {
  id: string;
  order_num: string;
  branch: Branch;
  wallet: WalletType;
  work_date: string; // YYYY-MM-DD
  payment_seq: number; // 1, 2, 3...
  amount?: number; // Detected or entered amount
  reference_num?: string; // Reference number from receipt
  sender_info?: string; // Sender name/phone if visible
  photo_url: string; // Base64 or image path
  receipt_date?: string; // Actual date found on receipt (YYYY-MM-DD)
  receipt_time?: string; // Actual time found on receipt (HH:MM)
  image_hash?: string; // SHA-256 hash of image to prevent duplicates
  perceptual_hash?: string; // Perceptual fingerprint for visual similarity
  raw_ocr_text?: string;
  notes?: string;
  created_at: string; // ISO date string
  user_name?: string;
  is_reservation?: boolean;
  payment_shift_date?: string;
  reservation_status?: 'pending' | 'delivered';
  delivered_at?: string;
  delivered_by?: string;
}

export interface GroupedOrder {
  group_key: string;
  order_num: string;
  branch: Branch;
  work_date: string;
  total_amount: number;
  payments: Order[];
  wallets: WalletType[];
  reference_nums: string[];
  notes: string[];
  created_at: string;
  user_names: string[];
  is_reservation?: boolean;
  reservation_status?: 'pending' | 'delivered';
  payment_shift_date?: string;
}

export interface WalletRule {
  wallet: WalletType;
  phones: string[];
  name_keywords: string[];
  partial_names: string[];
  description: string;
  accentColor: string;
}

export interface DuplicateMatchInfo {
  id: string;
  order_num: string;
  branch: Branch;
  wallet: WalletType;
  work_date: string;
  payment_seq: number;
  amount?: number;
  reference_num?: string;
  created_at: string;
  reason: string;
}

export interface ReceiptAnalysisResult {
  detected_wallet: WalletType | null;
  confidence: number; // 0 to 1
  amount?: number;
  currency?: string;
  reference_num?: string;
  sender_name?: string;
  recipient_name?: string;
  recipient_phone?: string;
  receipt_date?: string;
  receipt_time?: string;
  raw_text?: string;
  notes?: string;
  rule_matched?: string;
  is_duplicate?: boolean;
  duplicate_reason?: string;
  duplicate_match?: DuplicateMatchInfo | null;
  is_date_mismatch?: boolean;
  date_mismatch_warning?: string;
  is_date_rejected?: boolean;
  date_rejection_reason?: string;
  is_post_midnight?: boolean;
}

export interface TeamMessage {
  id: string;
  author: string;
  branch?: Branch;
  content: string;
  created_at: string;
  type: 'general' | 'alert' | 'inquiry';
}

export type UserRole = 'admin' | 'worker';

export interface ShiftStats {
  work_date: string;
  total_orders: number;
  total_payments: number;
  total_amount: number;
  by_branch: Record<Branch, number>;
  by_wallet: Record<string, number>;
}

export interface AppUser {
  id: string;
  username: string;
  password?: string;
  displayName: string;
  role: UserRole;
  branch?: Branch | 'كافة الفروع';
  allowed_branches?: Branch[];
  status: 'active' | 'inactive';
  created_at: string;
  created_by?: string;
  last_login?: string;
}
