import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Search, 
  Send, 
  Building2, 
  Calendar, 
  Wallet, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Hash, 
  Sparkles, 
  ExternalLink,
  ShieldAlert,
  Radio
} from 'lucide-react';
import { Branch, Order, TeamMessage } from '../types';
import { BRANCHES } from '../data/constants';
import { subscribeToTeamMessages, saveTeamMessageToFirestore } from '../firestoreService';

interface TeamBoardViewProps {
  onSelectOrder: (order: Order) => void;
}

export const TeamBoardView: React.FC<TeamBoardViewProps> = ({ onSelectOrder }) => {
  // Order Inquiry State
  const [inquiryNum, setInquiryNum] = useState('');
  const [isSearchingOrder, setIsSearchingOrder] = useState(false);
  const [inquiryResult, setInquiryResult] = useState<{
    found: boolean;
    count: number;
    matches: Order[];
  } | null>(null);

  // Message Board State
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [authorName, setAuthorName] = useState('موظف الفرع');
  const [selectedBranch, setSelectedBranch] = useState<Branch>('عصافرة');
  const [msgContent, setMsgContent] = useState('');
  const [isPostingMsg, setIsPostingMsg] = useState(false);

  useEffect(() => {
    // Realtime Firestore synchronization for team messages
    const unsubscribe = subscribeToTeamMessages(
      (firestoreMessages) => {
        if (firestoreMessages && firestoreMessages.length > 0) {
          setMessages(firestoreMessages);
        } else {
          fetchMessages();
        }
      },
      () => {
        fetchMessages();
      }
    );

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/team/messages');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  };

  const handleSearchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryNum.trim()) return;

    setIsSearchingOrder(true);
    try {
      const res = await fetch(`/api/team/inquire?order_num=${encodeURIComponent(inquiryNum.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setInquiryResult(data);
      }
    } catch (err) {
      console.error('Inquire error:', err);
    } finally {
      setIsSearchingOrder(false);
    }
  };

  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgContent.trim()) return;

    setIsPostingMsg(true);
    const newMsg: TeamMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      author: authorName.trim() || 'فرد من الفريق',
      branch: selectedBranch,
      content: msgContent.trim(),
      created_at: new Date().toISOString(),
      type: 'general',
    };

    try {
      // Optimistic local update
      setMessages((prev) => [newMsg, ...prev]);
      setMsgContent('');

      // Post to Server API & Firestore simultaneously
      await Promise.allSettled([
        fetch('/api/team/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMsg),
        }),
        saveTeamMessageToFirestore(newMsg),
      ]);
    } catch (err) {
      console.error('Post message error:', err);
    } finally {
      setIsPostingMsg(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 font-['Cairo'] w-full max-w-full overflow-x-hidden">
      
      {/* 1. Fast Order Inquirer Card */}
      <div className="bg-white p-3.5 sm:p-6 rounded-2xl border border-stone-200/90 shadow-sm space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2.5 sm:gap-3 pb-3 border-b border-stone-100">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center font-black shadow-sm shrink-0">
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h3 className="font-black text-stone-950 text-sm sm:text-lg">
              الاستعلام والتدقيق الفوري بين كافة الفروع
            </h3>
            <p className="text-[11px] sm:text-xs text-stone-500 font-medium">
              التحقق اللحظي هل تم توثيق رقم طلب معين بأي فرع آخر وكم عدد دفعاته المسجلة
            </p>
          </div>
        </div>

        <form onSubmit={handleSearchOrder} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Hash className="w-4 h-4 text-stone-400 absolute right-3.5 top-3 sm:top-3.5" />
            <input
              type="text"
              value={inquiryNum}
              onChange={(e) => setInquiryNum(e.target.value.replace(/\D/g, ''))}
              placeholder="اكتب رقم الطلب للاستعلام (مثال: 45012)..."
              className="w-full bg-stone-50 border border-stone-300 rounded-xl pr-10 pl-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-700"
            />
          </div>

          <button
            type="submit"
            disabled={isSearchingOrder || !inquiryNum.trim()}
            className="w-full sm:w-auto bg-stone-900 hover:bg-stone-800 active:scale-95 text-amber-300 font-black text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-sm border border-stone-700 transition"
          >
            {isSearchingOrder ? 'جاري الفحص...' : 'فحص ومطابقة'}
          </button>
        </form>

        {/* Inquiry Result Display */}
        {inquiryResult && (
          <div className="mt-4 p-3.5 sm:p-4 rounded-xl border border-stone-200 bg-stone-50/70 animate-in fade-in transition">
            {inquiryResult.found ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-900 text-xs sm:text-sm font-black">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
                  <span>
                    الطلب #{inquiryResult.matches[0]?.order_num} مسجل بالفعل في النظام ({inquiryResult.count} دفعة):
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  {inquiryResult.matches.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => onSelectOrder(m)}
                      className="p-3 bg-white border border-stone-200/90 rounded-xl hover:border-red-700 hover:shadow-xs transition cursor-pointer flex items-center justify-between"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2 font-black text-stone-950">
                          <span>فرع {m.branch}</span>
                          <span className="bg-amber-100 text-amber-950 font-black px-2 py-0.2 rounded text-[10px] border border-amber-300">
                            الدفعة #{m.payment_seq}
                          </span>
                        </div>
                        <div className="text-stone-600 font-medium text-[11px] sm:text-xs">
                          {m.wallet} • <span className="font-mono">{m.work_date}</span>
                        </div>
                      </div>

                      <ExternalLink className="w-4 h-4 text-red-800 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-stone-700 text-xs sm:text-sm font-medium">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-stone-400 shrink-0" />
                <span>
                  الطلب <strong className="font-mono-num font-bold text-stone-950">#{inquiryNum}</strong> غير مسجل بأي فرع حتى الآن.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Team Messages & Broadcast Board */}
      <div className="bg-white p-3.5 sm:p-6 rounded-2xl border border-stone-200/90 shadow-sm space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-900 text-amber-300 flex items-center justify-center font-black shadow-sm shrink-0">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-black text-stone-950 text-sm sm:text-lg">
                شبكة التواصل والتعميمات الداخلية بين الفروع
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-500 font-medium">
                إرسال تنبيهات وتوجيهات تشغيلية تظهر لجميع موظفي ومشرفي الفروع لحظياً
              </p>
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            مباشر (LIVE)
          </span>
        </div>

        {/* Post Message Form */}
        <form onSubmit={handlePostMessage} className="space-y-3 bg-stone-50 p-3 sm:p-4 rounded-xl border border-stone-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <div>
              <label className="block text-xs font-black text-stone-700 mb-1">
                اسم المحرر / الموظف:
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="اسم الموظف أو المشرف..."
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-700"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-stone-700 mb-1">
                الفرع المصدر:
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value as Branch)}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-700"
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    فرع {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-stone-700 mb-1">
              نص التنبيه أو الملاحظة التشغيلية:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={msgContent}
                onChange={(e) => setMsgContent(e.target.value)}
                placeholder="اكتب التنبيه ليتم بثه على الفور لكافة الفروع..."
                className="w-full sm:flex-1 bg-white border border-stone-300 rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-700"
              />
              <button
                type="submit"
                disabled={isPostingMsg || !msgContent.trim()}
                className="w-full sm:w-auto bg-red-800 hover:bg-red-900 active:scale-95 text-white px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-red-950/20 transition shrink-0"
              >
                <Send className="w-4 h-4 text-amber-300" />
                <span>إرسال وتعميم</span>
              </button>
            </div>
          </div>
        </form>

        {/* Message Feed List */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-black text-stone-400 tracking-wider">
            أحدث الرسائل والتعميمات الواردة:
          </h4>

          <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="p-3 sm:p-3.5 bg-stone-50 border border-stone-200/90 rounded-xl space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-stone-950">{msg.author}</span>
                    {msg.branch && (
                      <span className="bg-stone-200 text-stone-800 border border-stone-300 text-[10px] font-black px-2 py-0.2 rounded-md">
                        فرع {msg.branch}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-stone-500 dir-ltr">
                    {new Date(msg.created_at).toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-stone-800 text-xs sm:text-sm font-medium leading-relaxed">{msg.content}</p>
              </div>
            ))}

            {messages.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-6">
                لا توجد تعميمات سابقة مسجلة.
              </p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
