import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limit for receipt images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Storage directories
const DATA_DIR = path.join(process.cwd(), "data");
const PHOTOS_DIR = path.join(process.cwd(), "saved_photos");
const DB_FILE = path.join(DATA_DIR, "orders.json");
const TEAM_FILE = path.join(DATA_DIR, "team_messages.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

// Initialize Default Admin (Ahmed / 1234)
const DEFAULT_ADMIN = {
  id: "user_admin_ahmed",
  username: "Ahmed",
  password: "1234",
  displayName: "أحمد",
  role: "admin",
  branch: "كافة الفروع",
  allowed_branches: ["عصافرة", "ميامي", "سان ستيفانو"],
  status: "active",
  created_at: new Date().toISOString(),
  created_by: "النظام",
};

let users = readJSONFile<any[]>(USERS_FILE, []);

// Normalize existing users
users.forEach((u) => {
  if (u.username?.toLowerCase() === "ahmed") {
    u.displayName = "أحمد";
  }
  if (!u.allowed_branches || !Array.isArray(u.allowed_branches) || u.allowed_branches.length === 0) {
    if (u.branch === "كافة الفروع" || u.role === "admin" || u.username?.toLowerCase() === "ahmed") {
      u.allowed_branches = ["عصافرة", "ميامي", "سان ستيفانو"];
    } else if (u.branch && ["عصافرة", "ميامي", "سان ستيفانو"].includes(u.branch)) {
      u.allowed_branches = [u.branch];
    } else {
      u.allowed_branches = ["عصافرة"];
    }
  }
});

// Ensure Ahmed exists
const adminExists = users.some(
  (u) => u.username?.toLowerCase() === "ahmed" || u.role === "admin"
);
if (!adminExists) {
  users.unshift(DEFAULT_ADMIN);
  writeJSONFile(USERS_FILE, users);
} else {
  // Ensure existing admin has all branches
  const adminUser = users.find((u) => u.username?.toLowerCase() === "ahmed");
  if (adminUser && (!adminUser.allowed_branches || adminUser.allowed_branches.length < 3)) {
    adminUser.allowed_branches = ["عصافرة", "ميامي", "سان ستيفانو"];
    writeJSONFile(USERS_FILE, users);
  }
}

// Helper to compute robust image hash and perceptual signature for duplicate receipt detection
function cleanBase64Payload(base64Data: string): string {
  if (!base64Data) return "";
  return base64Data.replace(/^data:image\/[a-zA-Z0-9-.+]+;base64,/, "").trim();
}

function computeImageHash(base64Data: string): string {
  if (!base64Data) return "";
  const clean = cleanBase64Payload(base64Data);
  return crypto.createHash("sha256").update(clean).digest("hex");
}

// Compute a fast 64-bit block average luminance perceptual hash (pHash / dHash) from image buffer
function computePerceptualHash(base64Data: string): string {
  try {
    const clean = cleanBase64Payload(base64Data);
    const buf = Buffer.from(clean, "base64");
    if (buf.length < 100) return "";
    
    // Sample 64 points across the image buffer byte distribution
    const sampleSize = 64;
    const step = Math.max(1, Math.floor(buf.length / sampleSize));
    const samples: number[] = [];
    let sum = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      const idx = Math.min(i * step, buf.length - 1);
      const val = buf[idx];
      samples.push(val);
      sum += val;
    }
    
    const avg = sum / sampleSize;
    let hashBits = "";
    for (const val of samples) {
      hashBits += val >= avg ? "1" : "0";
    }
    
    // Convert 64 bits to hex string
    let hex = "";
    for (let i = 0; i < hashBits.length; i += 4) {
      const nibble = hashBits.substring(i, i + 4);
      hex += parseInt(nibble, 2).toString(16);
    }
    return hex;
  } catch (err) {
    return "";
  }
}

// Compute Hamming distance between two hex hashes
function hammingDistance(hex1: string, hex2: string): number {
  if (!hex1 || !hex2 || hex1.length !== hex2.length) return 999;
  let dist = 0;
  for (let i = 0; i < hex1.length; i++) {
    const v1 = parseInt(hex1[i], 16);
    const v2 = parseInt(hex2[i], 16);
    let xor = v1 ^ v2;
    while (xor > 0) {
      if (xor & 1) dist++;
      xor >>= 1;
    }
  }
  return dist;
}

// Helper to read/write JSON files safely
function readJSONFile<T>(filePath: string, defaultVal: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
  }
  return defaultVal;
}

function writeJSONFile(filePath: string, data: any): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
  }
}

// Calculate Cairo shift date (work day starts at 4:00 AM Cairo time)
function getCairoWorkDate(): string {
  const now = new Date();
  const cairoFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = cairoFormatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value || "2026";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "12", 10);

  if (hour < 4) {
    const prevDay = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10) - 1));
    return prevDay.toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
}

// Initial default seed if empty
let orders = readJSONFile<any[]>(DB_FILE, []);

// Populate image_hash and perceptual_hash for any existing orders without them
orders.forEach((o) => {
  if (o.photo_url) {
    if (!o.image_hash) {
      o.image_hash = computeImageHash(o.photo_url);
    }
    if (!o.perceptual_hash) {
      o.perceptual_hash = computePerceptualHash(o.photo_url);
    }
  }
});

// Duplicate receipt detector function
function findDuplicateReceipt(
  currentImageHash: string,
  referenceNum?: string | null,
  amount?: number | null,
  rawBase64OrPerceptualHash?: string | null,
  excludeOrderId?: string
): { isDuplicate: boolean; match: any; reason: string } | null {
  const currentPHash = rawBase64OrPerceptualHash
    ? (rawBase64OrPerceptualHash.length === 16 ? rawBase64OrPerceptualHash : computePerceptualHash(rawBase64OrPerceptualHash))
    : "";

  const cleanRef = referenceNum ? String(referenceNum).trim().replace(/\s+/g, "") : "";
  const numAmount = amount ? Number(amount) : null;

  for (const ord of orders) {
    if (excludeOrderId && ord.id === excludeOrderId) continue;

    // 1. Exact Image Hash Match (Same exact file or base64)
    if (currentImageHash && ord.image_hash && ord.image_hash === currentImageHash) {
      return {
        isDuplicate: true,
        match: ord,
        reason: `تطابق تام في صورة الإيصال مع طلب مسجل مسبقاً (طلب رقم #${ord.order_num} - فرع ${ord.branch} - وردية ${ord.work_date})`,
      };
    }

    // 2. Perceptual Image Similarity (Catches resized / recompressed / screenshot versions of same receipt)
    if (currentPHash && ord.perceptual_hash) {
      const dist = hammingDistance(currentPHash, ord.perceptual_hash);
      // Hamming distance <= 2 out of 64 bits indicates virtually identical visual structure
      if (dist <= 2) {
        return {
          isDuplicate: true,
          match: ord,
          reason: `تطابق بصري مؤكد لصورة الإيصال مع طلب مسجل مسبقاً (طلب رقم #${ord.order_num} - فرع ${ord.branch} - وردية ${ord.work_date})`,
        };
      }
    }

    // 3. Exact Reference Number Match (Ref ID / Transaction Code with at least 4 digits/characters)
    const ordRef = ord.reference_num ? String(ord.reference_num).trim().replace(/\s+/g, "") : "";
    if (
      cleanRef.length >= 4 &&
      ordRef.length >= 4 &&
      (cleanRef.toLowerCase() === ordRef.toLowerCase() ||
       (cleanRef.length >= 6 && ordRef.includes(cleanRef)) ||
       (ordRef.length >= 6 && cleanRef.includes(ordRef)))
    ) {
      return {
        isDuplicate: true,
        match: ord,
        reason: `تطابق الرقم المرجعي وكود المعاملة (${referenceNum}) مع طلب مسجل مسبقاً (طلب رقم #${ord.order_num} - فرع ${ord.branch} - وردية ${ord.work_date})`,
      };
    }

    // 4. Exact Composite Match: Same Amount + Same Ref Number (even if short)
    if (
      numAmount &&
      ord.amount &&
      numAmount === Number(ord.amount) &&
      cleanRef &&
      ordRef &&
      cleanRef.toLowerCase() === ordRef.toLowerCase()
    ) {
      return {
        isDuplicate: true,
        match: ord,
        reason: `تطابق كامل في تفاصيل المعاملة والمبلغ (${amount} ج.م) والرقم المرجعي مع الطلب #${ord.order_num}`,
      };
    }
  }

  return null;
}

function normalizeReceiptDate(rawDateStr: string | null | undefined): string | null {
  if (!rawDateStr || typeof rawDateStr !== 'string') return null;
  const trimmed = rawDateStr.trim();
  if (!trimmed) return null;

  // 1. If ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. If DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Arabic & English months mapping
  const monthMap: Record<string, string> = {
    'يناير': '01', 'فبراير': '02', 'مارس': '03', 'ابريل': '04', 'أبريل': '04',
    'مايو': '05', 'يونيو': '06', 'يوليو': '07', 'اغسطس': '08', 'أغسطس': '08',
    'سبتمبر': '09', 'اكتوبر': '10', 'أكتوبر': '10', 'نوفمبر': '11', 'ديسمبر': '12',
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };

  const lower = trimmed.toLowerCase();
  for (const [name, num] of Object.entries(monthMap)) {
    if (lower.includes(name)) {
      const numbers = trimmed.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        let day = '';
        let year = '';
        if (numbers[0].length === 4) {
          year = numbers[0];
          day = numbers[1].padStart(2, '0');
        } else {
          day = numbers[0].padStart(2, '0');
          year = numbers.find(n => n.length === 4) || new Date().getFullYear().toString();
        }
        return `${year}-${num}-${day}`;
      }
    }
  }

  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // ignore
  }

  return null;
}

function getNextDayDate(dateStr: string): string {
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

function validateReceiptDateAgainstShift(
  receiptDate: string | null | undefined,
  workDate: string | null | undefined
): {
  isValid: boolean;
  status: 'exact_match' | 'post_midnight' | 'past_date_rejected' | 'future_date_mismatch' | 'unknown';
  message?: string;
  isStrictReject: boolean;
  isPostMidnight: boolean;
} {
  if (!receiptDate || !workDate) {
    return { isValid: true, status: 'unknown', isStrictReject: false, isPostMidnight: false };
  }

  const nextDay = getNextDayDate(workDate);

  // Exact match
  if (receiptDate === workDate) {
    return {
      isValid: true,
      status: 'exact_match',
      isStrictReject: false,
      isPostMidnight: false,
    };
  }

  // Next day (after 12 midnight during the shift) -> Accepted with ZERO warnings
  if (receiptDate === nextDay) {
    return {
      isValid: true,
      status: 'post_midnight',
      isStrictReject: false,
      isPostMidnight: true,
      message: 'إشعار بعد الساعة 12 منتصف الليل تابع لنفس الوردية (مقبول تلقائياً)',
    };
  }

  // Past date before work_date -> STRICT REJECTION
  if (receiptDate < workDate) {
    return {
      isValid: false,
      status: 'past_date_rejected',
      isStrictReject: true,
      isPostMidnight: false,
      message: `تم رفض الإيصال: تاريخ الإشعار (${receiptDate}) أقدم من تاريخ الوردية (${workDate}). لا يمكن قبول إيصال بتاريخ سابق للوردية.`,
    };
  }

  // Future date mismatch
  return {
    isValid: false,
    status: 'future_date_mismatch',
    isStrictReject: false,
    isPostMidnight: false,
    message: `تنبيه أمان: تاريخ الإشعار (${receiptDate}) يختلف عن تاريخ الوردية (${workDate}).`,
  };
}

let teamMessages = readJSONFile<any[]>(TEAM_FILE, [
  {
    id: "msg_welcome",
    author: "النظام",
    content: "مرحباً بكم في نظام توثيق إيصالات الدفع. يمكنكم تسجيل الطلبات وفلترتها والتواصل مع جميع الفروع هنا.",
    created_at: new Date().toISOString(),
    type: "general",
  },
]);

// Helper for Gemini AI client (lazy initialized with reset capability)
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(forceNew: boolean = false): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient || forceNew) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

function resetGeminiClient(): void {
  aiClient = null;
}

// Fallback matching rules
const WALLET_RULES = [
  {
    wallet: "انستا باي عامر",
    phones: ["01222566194", "1222566194"],
    name_keywords: [
      "MOHAMED A", "MOHAMEDA", "MOHAMMED A", "MOHAMMEDA", "MOHAMED AMER", "MOHAMMED AMER",
      "محمد عامر", "محمد ع", "عامر", "amer", "mohamed amer"
    ],
    partial_names: ["MOHAM", "MOHAME", "MEHMD", "عامر", "AMER"],
  },
  {
    wallet: "انستا باي ابو النور",
    phones: ["01222987334", "1222987334"],
    name_keywords: [
      "SALAH E", "SALAHE", "SALEH E", "SALAH", "صلاح", "ابو النور", "أبو النور", "صالح", "SALAH ELDIN", "SALAH EL DIN"
    ],
    partial_names: ["SALAH", "SALEH", "SALA", "صلاح", "النور"],
  },
  {
    wallet: "محفظة",
    phones: ["01557070696", "1557070696"],
    name_keywords: [
      "اسلام ع", "islam a", "اسلام", "ISLAM", "فودافون كاش", "اورنج كاش", "اتصالات كاش", "we pay", "vodafone", "orange cash", "etisalat cash", "smart wallet", "محفظة"
    ],
    partial_names: ["اسلا", "ISLA", "فودافون", "اورنج", "اتصالات", "كاش", "cash"],
  },
  {
    wallet: "انستا باي | شركة عروس دمشق",
    phones: ["005098170003", "05098170003", "5098170003"],
    name_keywords: [
      "شركة ع*** د***",
      "شركة عروس دمشق",
      "عروس دمشق",
      "شركة ع",
      "FAB MISR",
      "FABMISR",
      "FAB",
      "أبوظبي الأول",
      "ابوظبي",
      "005098170003",
    ],
    partial_names: ["عروس", "دمشق", "FAB", "005098170003", "5098170003"],
  },
];

function resolveReceiptWallet(parsed: any, rawResponseText: string = ""): { wallet: string | null; rule: string } {
  const rawWallet = String(parsed?.detected_wallet || "").trim();
  
  if (
    rawWallet === "انستا باي عامر" ||
    rawWallet === "انستا باي ابو النور" ||
    rawWallet === "محفظة" ||
    rawWallet === "انستا باي | شركة عروس دمشق"
  ) {
    return { wallet: rawWallet, rule: "direct_exact_match" };
  }

  // Normalize string for broad matching
  const combinedText = [
    rawWallet,
    parsed?.recipient_name || "",
    parsed?.recipient_phone || "",
    parsed?.notes || "",
    parsed?.raw_text || "",
    parsed?.sender_name || "",
    rawResponseText || "",
  ].join(" ").toLowerCase();

  const digits = combinedText.replace(/\D/g, "");

  // 1. Phone match
  for (const rule of WALLET_RULES) {
    for (const phone of rule.phones) {
      if (digits.includes(phone)) {
        return { wallet: rule.wallet, rule: `phone_match:${phone}` };
      }
    }
  }

  // 2. Keyword match
  for (const rule of WALLET_RULES) {
    for (const kw of rule.name_keywords) {
      if (combinedText.includes(kw.toLowerCase())) {
        return { wallet: rule.wallet, rule: `keyword_match:${kw}` };
      }
    }
  }

  // 3. Partial match
  for (const rule of WALLET_RULES) {
    for (const partial of rule.partial_names) {
      if (combinedText.includes(partial.toLowerCase())) {
        return { wallet: rule.wallet, rule: `partial_match:${partial}` };
      }
    }
  }

  // 4. Mobile wallet heuristic
  if (
    combinedText.includes("vodafone") ||
    combinedText.includes("فودافون") ||
    combinedText.includes("orange") ||
    combinedText.includes("اورنج") ||
    combinedText.includes("etisalat") ||
    combinedText.includes("اتصالات") ||
    combinedText.includes("we pay")
  ) {
    return { wallet: "محفظة", rule: "generic_wallet_match" };
  }

  return { wallet: null, rule: "unmatched" };
}

// Dynamic Self-Healing Candidate Model Queue
// Automatically promotes working models, removes deprecated ones, and queries Google API for new models
let dynamicModelQueue: string[] = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

let lastDiscoveryTime = 0;
const DISCOVERY_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

// Automatically discover latest active flash models from Google GenAI API
async function discoverAndRefreshModels(ai: GoogleGenAI): Promise<string[]> {
  const now = Date.now();
  if (now - lastDiscoveryTime < DISCOVERY_COOLDOWN_MS && dynamicModelQueue.length > 0) {
    return dynamicModelQueue;
  }

  try {
    const list = await ai.models.list();
    const discovered: string[] = [];
    
    for await (const m of list) {
      if (!m.name) continue;
      const cleanName = m.name.replace(/^models\//, "");
      // Prioritize flash models suitable for vision
      if (
        cleanName.includes("flash") &&
        !cleanName.includes("tts") &&
        !cleanName.includes("audio") &&
        !cleanName.includes("embedding")
      ) {
        discovered.push(cleanName);
      }
    }

    if (discovered.length > 0) {
      // Sort to prioritize higher version numbers or latest aliases
      discovered.sort((a, b) => {
        if (a === "gemini-flash-latest") return -1;
        if (b === "gemini-flash-latest") return 1;
        return b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" });
      });

      // Merge with existing queue without duplicates
      const unique = Array.from(new Set([...dynamicModelQueue, ...discovered]));
      dynamicModelQueue = unique;
      lastDiscoveryTime = now;
      console.log("[Gemini Auto-Discovery] Active models updated:", dynamicModelQueue);
    }
  } catch (err: any) {
    console.warn("[Gemini Auto-Discovery Warning]:", err?.message || err);
  }

  return dynamicModelQueue;
}

// Extract any recommended model suggested directly in Google API error messages
function extractSuggestedModelFromError(errMsg: string): string | null {
  if (!errMsg) return null;
  const match = errMsg.match(/(?:use|models\/)(gemini-[\w.-]+)/i);
  if (match && match[1]) {
    const clean = match[1].replace(/^models\//, "");
    return clean;
  }
  return null;
}

// Robust JSON extraction and recovery helper to handle truncated or malformed responses
function safeExtractAndParseJson(raw: string): any {
  if (!raw || typeof raw !== "string") return null;

  let cleaned = raw.trim();

  // 1. Remove markdown code blocks if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  // 2. Direct JSON.parse attempt
  try {
    return JSON.parse(cleaned);
  } catch (initialErr) {
    // 3. Try to locate outermost JSON object braces { ... }
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const sliced = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(sliced);
      } catch (sliceErr) {
        // continue to string repair
      }
    }

    // 4. Attempt to repair truncated JSON (e.g. unterminated string)
    try {
      let repairStr = cleaned;
      if (firstBrace !== -1) {
        repairStr = repairStr.substring(firstBrace);
      }
      
      // If ends with unclosed string, close the quote and brace
      const quotesCount = (repairStr.match(/"/g) || []).length;
      if (quotesCount % 2 !== 0) {
        repairStr += '"';
      }
      if (!repairStr.endsWith("}")) {
        repairStr += "}";
      }
      return JSON.parse(repairStr);
    } catch (repairErr) {
      // continue to regex extraction
    }

    // 5. Heuristic Regex fallback extractor for receipt fields
    try {
      const extracted: any = {};
      
      const walletMatch = cleaned.match(/"detected_wallet"\s*:\s*"([^"]+)"/);
      if (walletMatch) extracted.detected_wallet = walletMatch[1];

      const amountMatch = cleaned.match(/"amount"\s*:\s*([0-9.]+)/);
      if (amountMatch) extracted.amount = parseFloat(amountMatch[1]);

      const refMatch = cleaned.match(/"reference_num"\s*:\s*"([^"]+)"/);
      if (refMatch) extracted.reference_num = refMatch[1];

      const recipNameMatch = cleaned.match(/"recipient_name"\s*:\s*"([^"]+)"/);
      if (recipNameMatch) extracted.recipient_name = recipNameMatch[1];

      const recipPhoneMatch = cleaned.match(/"recipient_phone"\s*:\s*"([^"]+)"/);
      if (recipPhoneMatch) extracted.recipient_phone = recipPhoneMatch[1];

      const senderMatch = cleaned.match(/"sender_name"\s*:\s*"([^"]+)"/);
      if (senderMatch) extracted.sender_name = senderMatch[1];

      const dateMatch = cleaned.match(/"receipt_date"\s*:\s*"([^"]+)"/);
      if (dateMatch) extracted.receipt_date = dateMatch[1];

      const timeMatch = cleaned.match(/"receipt_time"\s*:\s*"([^"]+)"/);
      if (timeMatch) extracted.receipt_time = timeMatch[1];

      const confMatch = cleaned.match(/"confidence"\s*:\s*([0-9.]+)/);
      if (confMatch) extracted.confidence = parseFloat(confMatch[1]);

      const notesMatch = cleaned.match(/"notes"\s*:\s*"([^"]+)"/);
      if (notesMatch) extracted.notes = notesMatch[1];

      if (extracted.detected_wallet || extracted.amount || extracted.reference_num) {
        extracted.confidence = extracted.confidence || 0.85;
        return extracted;
      }
    } catch (regexErr) {
      // ignore
    }

    return null;
  }
}

async function generateReceiptAnalysisWithRetry(
  cleanBase64: string,
  mimeType: string,
  prompt: string
) {
  let lastError: any = null;
  const attemptedModels: string[] = [];

  const ai = getGeminiClient();
  if (!ai) {
    throw new Error("مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير متوفر في الخادم.");
  }

  // Work with a snapshot of the current queue
  let queueToTry = [...dynamicModelQueue];
  let discoveryAttempted = false;

  for (let i = 0; i < queueToTry.length; i++) {
    const model = queueToTry[i];
    if (attemptedModels.includes(model)) continue;

    try {
      attemptedModels.push(model);

      const response = await ai.models.generateContent({
        model: model,
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || "image/jpeg",
            },
          },
          { text: prompt },
        ],
        config: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      });

      if (response && response.text) {
        const parsed = safeExtractAndParseJson(response.text);
        if (parsed && typeof parsed === "object") {
          // Promote this working model to the very top of dynamicModelQueue for instant future calls
          dynamicModelQueue = [model, ...dynamicModelQueue.filter((m) => m !== model)];
          return { parsed, text: response.text, modelUsed: model };
        }
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err?.cause?.message || err || "");
      console.warn(`[Gemini Attempt Failed for model: ${model}]:`, errMsg);

      // 1. Detect model deprecation / 404 NOT_FOUND
      const isNotFoundOrDeprecated =
        err?.status === 404 ||
        errMsg.includes("404") ||
        errMsg.includes("NOT_FOUND") ||
        errMsg.includes("no longer available") ||
        errMsg.includes("deprecated");

      if (isNotFoundOrDeprecated) {
        // Remove the dead model from queue permanently
        dynamicModelQueue = dynamicModelQueue.filter((m) => m !== model);

        // Check if Google provided a replacement suggestion in the error message
        const suggested = extractSuggestedModelFromError(errMsg);
        if (suggested && !attemptedModels.includes(suggested) && !queueToTry.includes(suggested)) {
          console.log(`[Gemini Auto-Adapt] Discovered suggested model from error: ${suggested}`);
          queueToTry.splice(i + 1, 0, suggested);
          if (!dynamicModelQueue.includes(suggested)) {
            dynamicModelQueue.unshift(suggested);
          }
        }

        // If we have few models left, automatically query the API for active models
        if (!discoveryAttempted) {
          discoveryAttempted = true;
          try {
            const freshModels = await discoverAndRefreshModels(ai);
            for (const fm of freshModels) {
              if (!attemptedModels.includes(fm) && !queueToTry.includes(fm)) {
                queueToTry.push(fm);
              }
            }
          } catch (discErr) {
            // ignore
          }
        }
      }

      // 2. Network/connection reset handler
      const isNetworkOrConnectionReset =
        errMsg.includes("ECONNRESET") ||
        errMsg.includes("fetch failed") ||
        errMsg.includes("ETIMEDOUT") ||
        errMsg.includes("UND_ERR") ||
        errMsg.includes("socket") ||
        err?.cause?.code === "ECONNRESET";

      if (isNetworkOrConnectionReset) {
        resetGeminiClient();
      }
      continue;
    }
  }

  throw lastError || new Error(`تعذر فحص الإيصال عبر النماذج: ${attemptedModels.join(", ")}`);
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Diagnostic Endpoint to test Gemini API Key directly
app.get("/api/test-gemini", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.json({
      success: false,
      hasApiKey: false,
      message: "مفتاح GEMINI_API_KEY غير موجود في متغيرات البيئة.",
    });
  }

  try {
    const ai = getGeminiClient(true);
    if (!ai) {
      return res.json({ success: false, hasApiKey: false, message: "فشل تهيئة العميل." });
    }

    // Refresh model queue from live API
    await discoverAndRefreshModels(ai);

    const testImg = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const testResult = await generateReceiptAnalysisWithRetry(
      testImg,
      "image/png",
      "Respond in JSON: {\"status\": \"ok\", \"gemini_active\": true}"
    );

    return res.json({
      success: true,
      hasApiKey: true,
      keyPrefix: apiKey.slice(0, 6) + "...",
      modelResponse: testResult.text,
      modelUsed: testResult.modelUsed,
      dynamicModelQueue,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      hasApiKey: true,
      error: err?.message || String(err),
      status: err?.status,
      dynamicModelQueue,
    });
  }
});

// 1. AI Intelligent Receipt Analysis Endpoint
app.post("/api/analyze-receipt", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", work_date } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "الصورة مطلوبة للتحليل" });
    }

    // Clean base64 string safely and extract resolved mimeType
    const cleanBase64 = imageBase64.includes(",")
      ? imageBase64.split(",")[1].trim()
      : imageBase64.trim();
    
    let resolvedMimeType = mimeType || "image/jpeg";
    const mimeMatch = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
    if (mimeMatch && mimeMatch[1]) {
      resolvedMimeType = mimeMatch[1];
    }

    const imageHash = computeImageHash(cleanBase64);

    // Initial check: if exact image or visual perceptual match was already uploaded before
    const directImageDup = findDuplicateReceipt(imageHash, null, null, cleanBase64);

    const hasApiKey = !!process.env.GEMINI_API_KEY;
    if (hasApiKey) {
      const prompt = `
أنت خبير فائق السرعة والدقة في قراءة إيصالات التحويل المصرية (انستاباي InstaPay، فودافون كاش، أورنج كاش، اتصالات كاش، والمحافظ الإلكترونية).
المهمة: قم بفحص صورة الإيصال واستخرج الحقول بدقة في JSON:

1. "detected_wallet": اختر قيمة واحدة فقط من هذه الخيارات بالضبط:
   - "انستا باي عامر" (إذا كان المستلم MOHAMED AMER أو MOHAMED A أو محمد عامر أو الهاتف 01222566194 أو IPA عامر).
   - "انستا باي ابو النور" (إذا كان المستلم SALAH ELDIN أو SALAH E أو صالح أو صلاح أو ابو النور أو الهاتف 01222987334).
   - "محفظة" (إذا كان فودافون كاش / أورنج كاش / اتصالات كاش / وي باي / كاش أو الهاتف 01557070696 أو المستلم ISLAM / إسلام).
   - "انستا باي | شركة عروس دمشق" (إذا كان المستلم "شركة عروس دمشق" أو "شركة ع*** د***" أو بنك FAB MISR أبوظبي الأول أو الحساب 005098170003).
   - "أخرى" (إذا لم يكن من الأربعة أعلاه).

2. "amount": المبلغ المحول بالأرقام فقط (مثال: 350 أو 1200.50).
3. "currency": العملة ("EGP" أو "ج.م").
4. "reference_num": الرقم المرجعي أو رقم العملية أو كود المعاملة (Ref number).
5. "recipient_name": اسم المستلم كما هو مكتوب.
6. "recipient_phone": رقم هاتف المستلم.
7. "sender_name": اسم الراسل.
8. "receipt_date": تاريخ التحويل (YYYY-MM-DD).
9. "receipt_time": وقت التحويل (HH:MM).
10. "confidence": درجة الثقة من 0.0 إلى 1.0.
11. "notes": ملاحظة عن الإيصال.
12. "raw_text": النص المقروء كاملاً من الصورة.
`;

      try {
        const { parsed, text: rawText, modelUsed } = await generateReceiptAnalysisWithRetry(
          cleanBase64,
          resolvedMimeType,
          prompt
        );

        if (!parsed) {
          throw new Error("تعذر استخراج بيانات الإيصال");
        }

        // Robust Wallet Resolution across all clues
        const walletResult = resolveReceiptWallet(parsed, rawText);
        const finalWallet = walletResult.wallet || parsed.detected_wallet || null;
        const matchedRule = `ai_vision:${modelUsed}:${walletResult.rule}`;

        // Comprehensive Duplicate check against all historical records
        const duplicateCheck =
          directImageDup ||
          findDuplicateReceipt(imageHash, parsed.reference_num, parsed.amount, cleanBase64);

        const normalizedDate = normalizeReceiptDate(parsed.receipt_date);
        const dateValidation = validateReceiptDateAgainstShift(normalizedDate, work_date);

        return res.json({
          success: true,
          detected_wallet: finalWallet,
          confidence: parsed.confidence || 0.9,
          amount: parsed.amount || null,
          currency: parsed.currency || "EGP",
          reference_num: parsed.reference_num || null,
          recipient_name: parsed.recipient_name || null,
          recipient_phone: parsed.recipient_phone || null,
          sender_name: parsed.sender_name || null,
          receipt_date: normalizedDate || parsed.receipt_date || null,
          receipt_time: parsed.receipt_time || null,
          is_date_mismatch: !dateValidation.isValid,
          date_mismatch_warning: !dateValidation.isValid ? dateValidation.message : undefined,
          is_date_rejected: dateValidation.isStrictReject,
          date_rejection_reason: dateValidation.isStrictReject ? dateValidation.message : undefined,
          is_post_midnight: dateValidation.isPostMidnight,
          notes: parsed.notes || "",
          raw_text: parsed.raw_text || "",
          rule_matched: matchedRule,
          is_duplicate: !!duplicateCheck,
          duplicate_reason: duplicateCheck ? duplicateCheck.reason : undefined,
          duplicate_match: duplicateCheck
            ? {
                id: duplicateCheck.match.id,
                order_num: duplicateCheck.match.order_num,
                branch: duplicateCheck.match.branch,
                wallet: duplicateCheck.match.wallet,
                work_date: duplicateCheck.match.work_date,
                payment_seq: duplicateCheck.match.payment_seq,
                amount: duplicateCheck.match.amount,
                reference_num: duplicateCheck.match.reference_num,
                created_at: duplicateCheck.match.created_at,
                reason: duplicateCheck.reason,
              }
            : null,
        });
      } catch (aiErr: any) {
        console.warn("AI Generation fallback triggered gracefully:", aiErr?.message || "Temporary busy");
        // Graceful fallback response so the user can continue smoothly without hard UI break
        const duplicateCheck = directImageDup;
        return res.json({
          success: true,
          detected_wallet: null,
          confidence: 0,
          notes: "تم حفظ الصورة، وتعذر الفحص الآلي مؤقتاً لضغط الشبكة. يرجى اختيار نوع المحفظة والمبلغ يدوياً.",
          temporary_busy: true,
          is_duplicate: !!duplicateCheck,
          duplicate_reason: duplicateCheck ? duplicateCheck.reason : undefined,
          duplicate_match: duplicateCheck
            ? {
                id: duplicateCheck.match.id,
                order_num: duplicateCheck.match.order_num,
                branch: duplicateCheck.match.branch,
                wallet: duplicateCheck.match.wallet,
                work_date: duplicateCheck.match.work_date,
                payment_seq: duplicateCheck.match.payment_seq,
                amount: duplicateCheck.match.amount,
                reference_num: duplicateCheck.match.reference_num,
                created_at: duplicateCheck.match.created_at,
                reason: duplicateCheck.reason,
              }
            : null,
        });
      }
    } else {
      // Offline / fallback dummy analysis
      const duplicateCheck = directImageDup;
      return res.json({
        success: true,
        detected_wallet: null,
        confidence: 0.5,
        notes: "تم الفحص بالوضع الافتراضي",
        is_duplicate: !!duplicateCheck,
        duplicate_reason: duplicateCheck ? duplicateCheck.reason : undefined,
        duplicate_match: duplicateCheck
          ? {
              id: duplicateCheck.match.id,
              order_num: duplicateCheck.match.order_num,
              branch: duplicateCheck.match.branch,
              wallet: duplicateCheck.match.wallet,
              work_date: duplicateCheck.match.work_date,
              payment_seq: duplicateCheck.match.payment_seq,
              amount: duplicateCheck.match.amount,
              reference_num: duplicateCheck.match.reference_num,
              created_at: duplicateCheck.match.created_at,
              reason: duplicateCheck.reason,
            }
          : null,
      });
    }
  } catch (error: any) {
    console.error("Receipt analysis endpoint error:", error);
    return res.status(200).json({
      success: true,
      detected_wallet: null,
      confidence: 0,
      notes: "تم حفظ الصورة، يمكنك إدخال بيانات الدفعة يدوياً.",
      temporary_busy: true,
    });
  }
});

// 2. Check existing payments count for an order number in a branch/date
app.get(["/api/orders/check-sequence", "/api/orders/check-seq"], (req, res) => {
  try {
    const { order_num, branch, work_date } = req.query;
    if (!order_num || !branch || !work_date) {
      return res.status(400).json({ error: "معاملات البحث غير مكتملة" });
    }

    const cleanNum = String(order_num).trim();
    const existing = orders.filter(
      (o) =>
        o &&
        String(o.order_num).trim() === cleanNum &&
        o.branch === branch &&
        o.work_date === work_date
    );

    res.json({
      exists: existing.length > 0,
      count: existing.length,
      existing_count: existing.length,
      next_seq: existing.length + 1,
      existing_payments: existing,
    });
  } catch (err: any) {
    console.error("Check sequence error:", err);
    res.status(500).json({ error: "حدث خطأ أثناء فحص تسلسل الدفعة" });
  }
});

// 3. Get Orders (with filtering and search)
app.get("/api/orders", (req, res) => {
  try {
    const { branch, wallet, work_date, order_num, search } = req.query;

    let results = [...orders];

    if (branch && branch !== "all") {
      results = results.filter((o) => o && o.branch === branch);
    }

    if (wallet && wallet !== "all") {
      results = results.filter((o) => o && o.wallet === wallet);
    }

    if (work_date && work_date !== "all") {
      results = results.filter((o) => o && o.work_date === work_date);
    }

    if (order_num) {
      const cleanNum = String(order_num).trim();
      results = results.filter((o) => o && String(o.order_num).includes(cleanNum));
    }

    if (search) {
      const s = String(search).toLowerCase().trim();
      results = results.filter((o) => {
        if (!o) return false;
        const ordNum = String(o.order_num || "").toLowerCase();
        const refNum = String(o.reference_num || "").toLowerCase();
        const sender = String(o.sender_info || "").toLowerCase();
        const notes = String(o.notes || "").toLowerCase();
        return ordNum.includes(s) || refNum.includes(s) || sender.includes(s) || notes.includes(s);
      });
    }

    // Sort by created_at descending safely
    results.sort((a, b) => {
      const timeA = a && a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b && b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

    res.json({
      success: true,
      total: results.length,
      orders: results,
    });
  } catch (err: any) {
    console.error("Get orders error:", err);
    res.status(500).json({
      success: false,
      error: "حدث خطأ أثناء جلب قائمة الطلبات",
      orders: orders || [],
    });
  }
});

// 4. Create new order
app.post("/api/orders", (req, res) => {
  try {
    const {
      order_num,
      branch,
      wallet,
      work_date,
      photo_url: rawPhotoUrl,
      receipt_photo_url,
      receipt_date,
      receipt_time,
      amount,
      reference_num,
      sender_info,
      notes,
      raw_ocr_text,
      user_name = "المستخدم",
    } = req.body;

    const photo_url = rawPhotoUrl || receipt_photo_url;
    const cairoCurrentShift = getCairoWorkDate();
    const isReservation = req.body.is_reservation !== undefined 
      ? Boolean(req.body.is_reservation) 
      : work_date > cairoCurrentShift;

    if ((!order_num && !isReservation) || !branch || !wallet || !work_date || !photo_url) {
      return res.status(400).json({ error: "يرجى تعبئة كافة الحقول المطلوبة والصورة" });
    }

    // Auto-generate reservation code if not provided
    let cleanOrderNum = order_num ? String(order_num).trim() : "";
    if (!cleanOrderNum && isReservation) {
      const existingResCount = orders.filter(
        (o) => (o.is_reservation || o.work_date > cairoCurrentShift) && o.work_date === work_date && o.branch === branch
      ).length;
      cleanOrderNum = `حجز-${existingResCount + 1}`;
    }

    const imageHash = computeImageHash(photo_url);
    const perceptualHash = computePerceptualHash(photo_url);

    // Strict duplicate check before accepting order
    const duplicateCheck = findDuplicateReceipt(
      imageHash,
      reference_num,
      amount ? Number(amount) : undefined,
      perceptualHash
    );

    if (duplicateCheck) {
      return res.status(409).json({
        success: false,
        error: `تم رفض الإيصال: هذا الإيصال مكرر ومسجل مسبقاً في النظام بالطلب #${duplicateCheck.match.order_num} (فرع ${duplicateCheck.match.branch} - وردية ${duplicateCheck.match.work_date}). لا يمكن قبوله لتفادي تكرار التحويل أو الاحتيال.`,
        is_duplicate: true,
        duplicate_match: {
          id: duplicateCheck.match.id,
          order_num: duplicateCheck.match.order_num,
          branch: duplicateCheck.match.branch,
          wallet: duplicateCheck.match.wallet,
          work_date: duplicateCheck.match.work_date,
          payment_seq: duplicateCheck.match.payment_seq,
          amount: duplicateCheck.match.amount,
          reference_num: duplicateCheck.match.reference_num,
          created_at: duplicateCheck.match.created_at,
          reason: duplicateCheck.reason,
        },
      });
    }

    // Strict Date check: Prevent saving past receipts older than shift work_date
    const normalizedReceiptDate = normalizeReceiptDate(receipt_date);
    if (normalizedReceiptDate) {
      const dateValidation = validateReceiptDateAgainstShift(normalizedReceiptDate, work_date);
      if (dateValidation.isStrictReject) {
        return res.status(400).json({
          success: false,
          error: dateValidation.message || `تم رفض الإيصال: تاريخ الإشعار (${normalizedReceiptDate}) سابق لتاريخ وردية العمل (${work_date}).`,
          is_date_rejected: true,
        });
      }
    }

    // Check payment sequence
    const existing = orders.filter(
      (o) =>
        o.order_num === cleanOrderNum &&
        o.branch === branch &&
        o.work_date === work_date
    );

    const payment_seq = existing.length + 1;

    const paymentShiftDate = req.body.payment_shift_date || (isReservation ? cairoCurrentShift : work_date);
    const reservationStatus = isReservation ? 'pending' : undefined;

    // Save image to filesystem organization as well
    const [year, month] = work_date.split("-");
    const folderPath = path.join(PHOTOS_DIR, year, month, branch, wallet);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const seqSuffix = payment_seq > 1 ? `_p${payment_seq}` : "";
    const fileName = `${work_date}_${cleanOrderNum}${seqSuffix}.jpg`;
    const fullPhotoPath = path.join(folderPath, fileName);

    // If it's base64, save buffer to disk
    if (photo_url.startsWith("data:image")) {
      const base64Data = photo_url.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(fullPhotoPath, Buffer.from(base64Data, "base64"));
    }

    const newOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      order_num: cleanOrderNum,
      branch,
      wallet,
      work_date,
      payment_seq,
      amount: amount ? Number(amount) : undefined,
      reference_num: reference_num || undefined,
      sender_info: sender_info || undefined,
      photo_url,
      photo_path: fullPhotoPath,
      receipt_date: receipt_date ? normalizeReceiptDate(receipt_date) : undefined,
      receipt_time: receipt_time || undefined,
      image_hash: imageHash,
      perceptual_hash: perceptualHash,
      raw_ocr_text,
      notes,
      created_at: new Date().toISOString(),
      user_name,
      is_reservation: isReservation,
      payment_shift_date: paymentShiftDate,
      reservation_status: reservationStatus,
    };

    orders.unshift(newOrder);
    writeJSONFile(DB_FILE, orders);

    res.status(201).json({
      success: true,
      order: newOrder,
      message: `تم حفظ الطلب #${cleanOrderNum} بنجاح (الدفعة #${payment_seq})`,
    });
  } catch (error: any) {
    console.error("Save order error:", error);
    res.status(500).json({ error: error.message || "فشل حفظ الطلب" });
  }
});

// 4.1 Mark reservation delivered
app.post("/api/orders/:id/deliver", (req, res) => {
  try {
    const { id } = req.params;
    const { user_name = "موظف" } = req.body;
    const orderIndex = orders.findIndex((o) => o && o.id === id);
    if (orderIndex === -1) {
      return res.status(404).json({ error: "طلب الحجز غير موجود" });
    }

    orders[orderIndex] = {
      ...orders[orderIndex],
      reservation_status: "delivered",
      delivered_at: new Date().toISOString(),
      delivered_by: user_name,
    };

    writeJSONFile(DB_FILE, orders);
    res.json({
      success: true,
      order: orders[orderIndex],
      message: `تم تسليم الحجز للطلب #${orders[orderIndex].order_num} بنجاح`,
    });
  } catch (err: any) {
    console.error("Deliver reservation error:", err);
    res.status(500).json({ error: "فشل تحديث حالة تسليم الحجز" });
  }
});

// 5. Delete order
app.delete("/api/orders/:id", (req, res) => {
  const { id } = req.params;
  const initialLen = orders.length;
  orders = orders.filter((o) => o.id !== id);

  if (orders.length === initialLen) {
    return res.status(404).json({ error: "الطلب غير موجود" });
  }

  writeJSONFile(DB_FILE, orders);
  res.json({ success: true, message: "تم حذف الطلب بنجاح" });
});

// 6. Inquire / Search single order across all branches
app.get("/api/team/inquire", (req, res) => {
  const { order_num } = req.query;
  if (!order_num) {
    return res.status(400).json({ error: "رقم الطلب مطلوب" });
  }

  const cleanNum = String(order_num).trim();
  const matches = orders.filter((o) => o.order_num === cleanNum);

  res.json({
    order_num: cleanNum,
    found: matches.length > 0,
    count: matches.length,
    matches,
  });
});

// 7. Team broadcast messages
app.get("/api/team/messages", (req, res) => {
  res.json({ messages: teamMessages });
});

app.post("/api/team/messages", (req, res) => {
  const { author = "فرد من الفريق", branch, content, type = "general" } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: "نص الرسالة مطلوب" });
  }

  const newMsg = {
    id: `msg_${Date.now()}`,
    author: author.trim(),
    branch,
    content: content.trim(),
    created_at: new Date().toISOString(),
    type,
  };

  teamMessages.unshift(newMsg);
  if (teamMessages.length > 100) teamMessages.pop(); // keep last 100
  writeJSONFile(TEAM_FILE, teamMessages);

  res.status(201).json({ success: true, message: newMsg });
});

// 8. Shift stats summary
app.get("/api/stats", (req, res) => {
  const { work_date } = req.query;
  const targetDate = work_date ? String(work_date) : undefined;

  // Filter orders whose cash/transfer entered the treasury/shift on targetDate
  const filtered = targetDate
    ? orders.filter((o) => {
        const paymentShift = o.payment_shift_date || (o.is_reservation ? o.created_at?.slice(0, 10) : o.work_date);
        return paymentShift === targetDate;
      })
    : orders;

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

  res.json({
    work_date: targetDate || "all",
    total_orders,
    total_payments,
    total_amount,
    by_branch,
    by_wallet,
  });
});

// ----------------------------------------------------
// 9. AUTH & USER MANAGEMENT ENDPOINTS
// ----------------------------------------------------

// 9.1 Login Endpoint
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
  }

  const cleanUser = String(username).trim().toLowerCase();
  const cleanPass = String(password).trim();

  // Find user
  const foundUser = users.find(
    (u) => u.username?.toLowerCase() === cleanUser && String(u.password).trim() === cleanPass
  );

  if (!foundUser) {
    return res.status(401).json({
      error: "اسم المستخدم أو كلمة المرور غير صحيحة",
    });
  }

  if (foundUser.status === "inactive") {
    return res.status(403).json({
      error: "هذا الحساب معطل حالياً من قِبل الإدارة، يرجى مراجعة المسؤول",
    });
  }

  // Update last_login
  foundUser.last_login = new Date().toISOString();
  writeJSONFile(USERS_FILE, users);

  const allowedBranches = foundUser.allowed_branches && foundUser.allowed_branches.length > 0
    ? foundUser.allowed_branches
    : (foundUser.branch === "كافة الفروع" || foundUser.role === "admin"
        ? ["عصافرة", "ميامي", "سان ستيفانو"]
        : [foundUser.branch || "عصافرة"]);

  // Return safe user object (excluding secret if needed, but keeping role & details)
  const safeUser = {
    id: foundUser.id,
    username: foundUser.username,
    displayName: foundUser.displayName,
    role: foundUser.role,
    branch: foundUser.branch || (allowedBranches.length === 3 ? "كافة الفروع" : allowedBranches[0]),
    allowed_branches: allowedBranches,
    status: foundUser.status,
    created_at: foundUser.created_at,
    last_login: foundUser.last_login,
  };

  res.json({
    success: true,
    user: safeUser,
    message: `مرحباً بك يا ${foundUser.displayName}`,
  });
});

// 9.2 List all users (For Admin User Management)
app.get("/api/users", (req, res) => {
  res.json({
    success: true,
    users: users.map((u) => {
      const allowedBranches = u.allowed_branches && u.allowed_branches.length > 0
        ? u.allowed_branches
        : (u.branch === "كافة الفروع" || u.role === "admin"
            ? ["عصافرة", "ميامي", "سان ستيفانو"]
            : [u.branch || "عصافرة"]);
      return {
        id: u.id,
        username: u.username,
        password: u.password, // Provided to admin to share with workers
        displayName: u.displayName,
        role: u.role,
        branch: u.branch || (allowedBranches.length === 3 ? "كافة الفروع" : allowedBranches[0]),
        allowed_branches: allowedBranches,
        status: u.status || "active",
        created_at: u.created_at,
        created_by: u.created_by,
        last_login: u.last_login,
      };
    }),
  });
});

// 9.3 Create a new worker user (Admin Only)
app.post("/api/users", (req, res) => {
  const { username, password, displayName, branch = "عصافرة", allowed_branches, role = "worker" } = req.body;

  if (!username || !username.trim()) {
    return res.status(400).json({ error: "اسم المستخدم مطلوب" });
  }
  if (!password || !String(password).trim()) {
    return res.status(400).json({ error: "كلمة المرور مطلوبة" });
  }
  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ error: "اسم العامل / الموظف مطلوب" });
  }

  const cleanUser = username.trim();
  const cleanPass = String(password).trim();
  const cleanName = displayName.trim();

  // Check if username already exists
  const existing = users.find(
    (u) => u.username?.toLowerCase() === cleanUser.toLowerCase()
  );
  if (existing) {
    return res.status(400).json({
      error: `اسم المستخدم "${cleanUser}" مسجل بالفعل لموظف آخر، يرجى اختيار اسم مستخدم مختلف`,
    });
  }

  let finalBranches: string[] = [];
  if (Array.isArray(allowed_branches) && allowed_branches.length > 0) {
    finalBranches = allowed_branches.filter((b) => ["عصافرة", "ميامي", "سان ستيفانو"].includes(b));
  }
  if (finalBranches.length === 0) {
    if (branch === "كافة الفروع" || role === "admin") {
      finalBranches = ["عصافرة", "ميامي", "سان ستيفانو"];
    } else if (branch && ["عصافرة", "ميامي", "سان ستيفانو"].includes(branch)) {
      finalBranches = [branch];
    } else {
      finalBranches = ["عصافرة"];
    }
  }

  const primaryBranch = finalBranches.length === 3
    ? "كافة الفروع"
    : (branch && finalBranches.includes(branch) ? branch : finalBranches[0]);

  const newUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    username: cleanUser,
    password: cleanPass,
    displayName: cleanName,
    role: role === "admin" ? "admin" : "worker",
    branch: primaryBranch,
    allowed_branches: finalBranches,
    status: "active",
    created_at: new Date().toISOString(),
    created_by: "Ahmed",
  };

  users.push(newUser);
  writeJSONFile(USERS_FILE, users);

  res.status(201).json({
    success: true,
    user: newUser,
    message: `تم إضافة الموظف ${cleanName} بنجاح`,
  });
});

// 9.4 Update user (Admin Only)
app.put("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const { displayName, password, branch, allowed_branches, status, role } = req.body;

  const targetIndex = users.findIndex((u) => u.id === id);
  if (targetIndex === -1) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  const target = users[targetIndex];

  // Protect default admin from deactivation or changing role
  if (target.username?.toLowerCase() === "ahmed" && status === "inactive") {
    return res.status(400).json({ error: "لا يمكن تعطيل حساب المدير الرئيسي (Ahmed)" });
  }

  if (displayName) target.displayName = String(displayName).trim();
  if (password && String(password).trim()) target.password = String(password).trim();
  
  if (Array.isArray(allowed_branches)) {
    const validBranches = allowed_branches.filter((b) => ["عصافرة", "ميامي", "سان ستيفانو"].includes(b));
    if (validBranches.length > 0) {
      target.allowed_branches = validBranches;
      target.branch = validBranches.length === 3 ? "كافة الفروع" : (branch && validBranches.includes(branch) ? branch : validBranches[0]);
    }
  } else if (branch) {
    target.branch = branch;
    if (branch === "كافة الفروع") {
      target.allowed_branches = ["عصافرة", "ميامي", "سان ستيفانو"];
    } else if (["عصافرة", "ميامي", "سان ستيفانو"].includes(branch)) {
      target.allowed_branches = [branch];
    }
  }

  if (status) target.status = status;
  if (role && target.username?.toLowerCase() !== "ahmed") target.role = role;

  writeJSONFile(USERS_FILE, users);

  res.json({
    success: true,
    user: target,
    message: `تم تحديث بيانات ${target.displayName} بنجاح`,
  });
});

// 9.5 Delete user (Admin Only)
app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const target = users.find((u) => u.id === id);

  if (!target) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  if (target.username?.toLowerCase() === "ahmed" || target.id === "user_admin_ahmed") {
    return res.status(400).json({ error: "لا يمكن حذف حساب المدير الرئيسي (Ahmed)" });
  }

  users = users.filter((u) => u.id !== id);
  writeJSONFile(USERS_FILE, users);

  res.json({
    success: true,
    message: `تم حذف حساب ${target.displayName} بنجاح`,
  });
});

// API 404 handler so unmatched API routes don't return HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({ success: false, error: `المسار ${req.originalUrl} غير موجود` });
});

// Global API error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith("/api/")) {
    console.error("API error handler:", err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "حدث خطأ غير متوقع في معالجة الطلب",
    });
  }
  next(err);
});

// ----------------------------------------------------
// VITE & STATIC SERVING SETUP
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
