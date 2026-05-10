'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Send, ChevronDown, Gift, Sparkles, BookOpen,
  MapPin, Award, Star, History, X, Clock,
  FileText, Calendar, ArrowRight, Headset, ThumbsUp,
} from 'lucide-react';
import GiftCardPage from './GiftCardPage';
import AppointmentPage from './AppointmentPage';

// 実行時に現在のページ origin から API base を導出する。
// localhost ↔ 127.0.0.1 のように別サイト扱いになる場合の SameSite=Lax Cookie 喪失を防ぐ目的。
const API = process.env.NEXT_PUBLIC_API_BASE
  ?? (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000');

type User = { id: number; name: string; role: string; displayName: string };

type Product = {
  id: number;
  name: string;
  description?: string;
  price: number;
  category?: string;
  brand?: string;
  imageUrl?: string;
};

type SuggestedProduct = {
  product: Product;
  sensoryComment?: string;
  experienceComment?: string;
  trustScore?: number;
  ageGroupFit?: string;
  occasionFit?: string;
  recommendReason?: string;
};

type Concierge = {
  id: number;
  displayName: string;
  anonymousLabel: string;
  avatarUrl?: string;
  yearsExperience?: number;
  ageGroup?: string;
  specialties?: string | string[];
  bio?: string;
  floorInfo?: string;
  schedule?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isProposal?: boolean;
  suggestedProducts?: SuggestedProduct[];
  sensoryConcierge?: Concierge | null;
  veteranConcierge?: Concierge | null;
};

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'いらっしゃいませ。高島屋AIコンシェルジュでございます。\n\n大切な方への贈り物選びをお手伝いいたします。まず、どのような場面での贈り物をお考えでしょうか？（例：お中元、誕生日プレゼント、結婚祝い、お礼など）',
};

// AI が文脈から動的生成するため初期値のみ。会話開始後は /chat/hints が更新する。
const DEFAULT_HINTS = ['お中元を探しています', '上司への御礼に', '3,000円〜5,000円で', '食品アレルギーがあります'];

type FloorInfo = {
  store?: string;
  floor?: string;
  section?: string;
  description?: string;
  pinX?: number;
  pinY?: number;
};

type ScheduleEntry = { dayOfWeek: string; available: boolean; startTime?: string | null; endTime?: string | null };

function parseJsonField<T>(v: string | T | null | undefined, fallback: T): T {
  if (!v) return fallback;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return v as T;
}

// ─── フロアマップモーダル ─────────────────────────────────────────────
function FloorMapModal({ concierge, onClose }: { concierge: Concierge; onClose: () => void }) {
  const floor = parseJsonField<FloorInfo>(concierge.floorInfo, {});
  const schedule = parseJsonField<ScheduleEntry[]>(concierge.schedule, []);
  const px = Math.max(2, Math.min(98, floor.pinX ?? 50));
  const py = Math.max(2, Math.min(98, floor.pinY ?? 50));
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <p className="text-sm font-semibold text-stone-800 truncate">{concierge.displayName} の売り場</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          {/* 売り場テキスト */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-stone-50 rounded-lg p-2.5">
              <p className="text-[10px] text-stone-400 mb-0.5">店舗</p>
              <p className="text-stone-800 font-medium">{floor.store || '—'}</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-2.5">
              <p className="text-[10px] text-stone-400 mb-0.5">フロア</p>
              <p className="text-stone-800 font-medium">{floor.floor || '—'}</p>
            </div>
            <div className="col-span-2 bg-stone-50 rounded-lg p-2.5">
              <p className="text-[10px] text-stone-400 mb-0.5">売り場</p>
              <p className="text-stone-800 font-medium">{floor.section || '—'}</p>
              {floor.description && <p className="text-stone-500 mt-1 leading-relaxed">{floor.description}</p>}
            </div>
          </div>

          {/* 売り場マップ: 高島屋 日本橋店のフロア画像にピンとアバターを重ねる */}
          <div className="relative rounded-xl border border-stone-200 bg-stone-100 overflow-hidden">
            <img
              src="/contents_drawing/floormap_with_pins.png"
              alt="高島屋 日本橋店 フロアマップ"
              className="w-full block"
            />
            {/* ピン: 該当コンシェルジュの売り場位置 */}
            <div
              className="absolute flex flex-col items-center"
              style={{ left: `${px}%`, top: `${py}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div className="w-9 h-9 rounded-full border-4 border-amber-400 shadow-lg overflow-hidden ring-2 ring-white animate-pulse bg-white">
                {concierge.avatarUrl ? (
                  <img src={concierge.avatarUrl} alt={concierge.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-700 text-xs font-bold">
                    {concierge.displayName.slice(0, 2)}
                  </div>
                )}
              </div>
              {floor.floor && (
                <div className="mt-1 bg-amber-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow whitespace-nowrap">
                  {floor.floor}
                </div>
              )}
            </div>
            <p className="absolute bottom-2 right-2 text-[9px] text-stone-500 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded tracking-wider">FLOOR MAP</p>
          </div>

          {/* スケジュール */}
          {schedule.length > 0 && (
            <div className="bg-stone-50 rounded-lg p-2.5">
              <p className="text-[10px] text-stone-400 mb-1.5 flex items-center gap-1"><Clock className="w-3 h-3" />勤務スケジュール</p>
              <div className="grid grid-cols-7 gap-1">
                {schedule.map((s, i) => (
                  <div
                    key={i}
                    className={`text-center py-1 rounded text-[10px] ${
                      s.available ? 'bg-white border border-amber-200 text-amber-700' : 'bg-stone-100 text-stone-300'
                    }`}
                    title={s.available ? `${s.startTime ?? ''}〜${s.endTime ?? ''}` : '休み'}
                  >
                    <div className="font-semibold">{s.dayOfWeek}</div>
                    <div className="text-[9px] mt-0.5">{s.available ? `${(s.startTime ?? '').slice(0, 5)}` : '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── 吹き出しコンポーネント ───────────────────────────────────────────
function SpeechBubble({
  side, comment, label, icon, colorClass, borderClass, labelBgClass,
}: {
  side: 'left' | 'right';
  comment: string;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  borderClass: string;
  labelBgClass: string;
}) {
  return (
    <div className={`relative rounded-2xl px-4 py-3 text-xs text-stone-700 leading-relaxed shadow-sm border ${borderClass} ${colorClass} ${
      side === 'left' ? 'rounded-tl-sm' : 'rounded-tr-sm'
    }`}>
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 ${labelBgClass}`}>
        {icon}{label}
      </span>
      <p className="leading-relaxed">{comment}</p>
      {side === 'left' ? (
        <div className="absolute -top-2 left-3 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-rose-200" />
      ) : (
        <div className="absolute -top-2 right-3 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-blue-200" />
      )}
    </div>
  );
}

// ─── 商品2視点カード ──────────────────────────────────────────────────
function ProductDualVoiceCard({
  item, sensoryConcierge, veteranConcierge, index,
}: {
  item: SuggestedProduct;
  sensoryConcierge?: Concierge | null;
  veteranConcierge?: Concierge | null;
  index: number;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const p = item.product;
  const price = typeof p.price === 'number' ? p.price : parseFloat(String(p.price)) || 0;

  const sensorySpecialties: string[] = (() => {
    try { return JSON.parse(sensoryConcierge?.specialties as string ?? '[]'); } catch { return []; }
  })();
  const veteranSpecialties: string[] = (() => {
    try { return JSON.parse(veteranConcierge?.specialties as string ?? '[]'); } catch { return []; }
  })();

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Accordion header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-20 h-20 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {p.imageUrl
            ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
            : <Gift className="w-8 h-8 text-stone-400" />}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-bold text-sm text-stone-800 leading-tight truncate">{p.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {p.brand && <span className="text-[10px] text-stone-400">{p.brand}</span>}
            {p.category && <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">{p.category}</span>}
          </div>
          <p className="text-sm font-bold text-amber-700 mt-0.5">¥{price.toLocaleString()}</p>
        </div>
        <div className="flex items-start gap-1.5 flex-shrink-0 max-w-[45%]">
          {item.recommendReason && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-2xl font-medium leading-snug whitespace-normal break-words">
              {item.recommendReason}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform mt-1 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Accordion body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-stone-100 pt-3">
          {/* 感性コンシェルジュ（左） */}
          {sensoryConcierge && item.sensoryComment && (
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="w-16 h-16 rounded-full border-2 border-rose-300 overflow-hidden flex items-center justify-center bg-rose-100">
                  {sensoryConcierge.avatarUrl
                    ? <img src={sensoryConcierge.avatarUrl} alt={sensoryConcierge.displayName} className="w-full h-full object-cover" />
                    : <span className="text-base font-bold text-rose-700">{sensoryConcierge.displayName.slice(0, 2)}</span>}
                </div>
                <span className="text-[9px] text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">感性</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-stone-600 font-medium">{sensoryConcierge.displayName}</span>
                  {sensoryConcierge.ageGroup && (
                    <span className="text-[9px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full">{sensoryConcierge.ageGroup}</span>
                  )}
                  {sensoryConcierge.yearsExperience != null && (
                    <span className="text-[9px] text-stone-400">経験{sensoryConcierge.yearsExperience}年</span>
                  )}
                </div>
                {/* おすすめポイント見出し（コンシェルジュの推薦であることを明示） */}
                <div className="flex items-center gap-1 mb-1">
                  <ThumbsUp className="w-3 h-3 text-rose-600" />
                  <span className="text-[10px] font-bold text-rose-700">{sensoryConcierge.displayName} のおすすめポイント（感性視点）</span>
                </div>
                <SpeechBubble
                  side="left"
                  comment={item.sensoryComment}
                  label="感性の視点"
                  icon={<Sparkles className="w-2.5 h-2.5" />}
                  colorClass="bg-rose-50"
                  borderClass="border-rose-200"
                  labelBgClass="bg-rose-100 text-rose-700"
                />
                {sensorySpecialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {sensorySpecialties.slice(0, 2).map((s, i) => (
                      <span key={i} className="text-[9px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 区切り */}
          {sensoryConcierge && veteranConcierge && item.sensoryComment && item.experienceComment && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-[10px] text-stone-400 font-medium">2つの視点</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>
          )}

          {/* シニアコンシェルジュ（右） */}
          {veteranConcierge && item.experienceComment && (
            <div className="flex items-start gap-3 flex-row-reverse">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="w-16 h-16 rounded-full border-2 border-blue-300 overflow-hidden flex items-center justify-center bg-blue-100">
                  {veteranConcierge.avatarUrl
                    ? <img src={veteranConcierge.avatarUrl} alt={veteranConcierge.displayName} className="w-full h-full object-cover" />
                    : <span className="text-base font-bold text-blue-700">{veteranConcierge.displayName.slice(0, 2)}</span>}
                </div>
                <span className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">経験知</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 justify-end">
                  {veteranConcierge.yearsExperience != null && (
                    <span className="text-[9px] text-stone-400">経験{veteranConcierge.yearsExperience}年</span>
                  )}
                  {veteranConcierge.ageGroup && (
                    <span className="text-[9px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full">{veteranConcierge.ageGroup}</span>
                  )}
                  <span className="text-[10px] text-stone-600 font-medium">{veteranConcierge.displayName}</span>
                </div>
                {/* おすすめポイント見出し（コンシェルジュの推薦であることを明示） */}
                <div className="flex items-center gap-1 mb-1 justify-end">
                  <span className="text-[10px] font-bold text-blue-700">{veteranConcierge.displayName} のおすすめポイント（経験知視点）</span>
                  <ThumbsUp className="w-3 h-3 text-blue-600" />
                </div>
                <SpeechBubble
                  side="right"
                  comment={item.experienceComment}
                  label="経験知の視点"
                  icon={<BookOpen className="w-2.5 h-2.5" />}
                  colorClass="bg-blue-50"
                  borderClass="border-blue-200"
                  labelBgClass="bg-blue-100 text-blue-700"
                />
                {veteranSpecialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 justify-end">
                    {veteranSpecialties.slice(0, 2).map((s, i) => (
                      <span key={i} className="text-[9px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── 提案末尾フローバー（次のステップへの導線） ────────────────────────
// 訴求軸②「AIチャット → 和紙カード → 来店予約」の橋渡し。
// 商品提案カード3枚の直下に1本だけ出す（クリックで Drawer を開く）。
function ProposalFlowBar({
  onPickCard, onPickAppointment,
}: {
  onPickCard: () => void;
  onPickAppointment: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-rose-50 p-4 shadow-sm">
      <p className="text-xs font-bold text-stone-800 mb-2.5 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
        次のステップにお進みください
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        <button
          onClick={onPickCard}
          className="flex items-center justify-between gap-2 px-4 py-3 bg-white border border-amber-200 hover:border-amber-400 hover:shadow-md rounded-xl transition-all text-left group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-amber-700" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-800 truncate">和紙カードを書く</p>
              <p className="text-[11px] text-stone-500 truncate">贈り物に添えるメッセージを AI と一緒に</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-amber-700 flex-shrink-0" />
        </button>
        <button
          onClick={onPickAppointment}
          className="flex items-center justify-between gap-2 px-4 py-3 bg-white border border-rose-200 hover:border-rose-400 hover:shadow-md rounded-xl transition-all text-left group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-rose-700" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-800 truncate">店頭で受け取る (来店予約)</p>
              <p className="text-[11px] text-stone-500 truncate">担当コンシェルジュと直接ご相談</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-rose-700 flex-shrink-0" />
        </button>
      </div>
    </div>
  );
}

// ─── Drawer（チャット内で和紙カード/来店予約を呼び出す）─────────────────
function ChatDrawer({
  open, title, onClose, children,
}: {
  open: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="ml-auto bg-stone-50 w-full sm:w-[640px] max-w-full h-full overflow-y-auto shadow-xl flex flex-col relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-stone-800">{title}</p>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─── 提案後のコンシェルジュCTA ────────────────────────────────────────
function MeetConciergeCTA({
  sensoryConcierge, veteranConcierge, onShowMap,
}: {
  sensoryConcierge?: Concierge | null;
  veteranConcierge?: Concierge | null;
  onShowMap: (c: Concierge) => void;
}) {
  if (!sensoryConcierge && !veteranConcierge) return null;
  const cards: { c: Concierge; tone: 'rose' | 'blue'; label: string }[] = [];
  if (sensoryConcierge) cards.push({ c: sensoryConcierge, tone: 'rose', label: '感性の視点' });
  if (veteranConcierge) cards.push({ c: veteranConcierge, tone: 'blue', label: '経験知の視点' });
  return (
    <div className="mt-4 rounded-2xl overflow-hidden border border-amber-300 shadow-md">
      <div className="bg-gradient-to-r from-amber-800 to-stone-800 px-4 py-3 text-white">
        <p className="font-bold text-sm flex items-center gap-2">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          ご紹介したコンシェルジュ
        </p>
        <p className="text-xs text-amber-200 mt-0.5">店舗内の売り場をマップでご確認いただけます。</p>
      </div>
      <div className="bg-white p-3 grid grid-cols-2 gap-3">
        {cards.map(({ c, tone, label }) => (
          <div key={c.id} className="rounded-xl border-2 border-stone-200 bg-stone-50 p-3 text-center flex flex-col items-center">
            <div className={`w-12 h-12 rounded-full border-2 overflow-hidden flex items-center justify-center mx-auto mb-2 ${
              tone === 'rose' ? 'border-rose-200 bg-rose-100' : 'border-blue-200 bg-blue-100'
            }`}>
              {c.avatarUrl
                ? <img src={c.avatarUrl} alt={c.displayName} className="w-full h-full object-cover" />
                : <span className={`text-sm font-bold ${tone === 'rose' ? 'text-rose-700' : 'text-blue-700'}`}>{c.displayName.slice(0, 2)}</span>}
            </div>
            <p className="text-xs font-bold text-stone-800 leading-tight">{c.displayName}</p>
            <p className={`text-[10px] mt-0.5 font-medium ${tone === 'rose' ? 'text-rose-600' : 'text-blue-600'}`}>{label}</p>
            {c.yearsExperience != null && (
              <p className="text-[9px] text-stone-400 mt-0.5">経験{c.yearsExperience}年</p>
            )}
            <button
              onClick={() => onShowMap(c)}
              className="mt-2 inline-flex items-center gap-1 text-[10px] border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-full px-2 py-0.5 transition-colors"
            >
              <MapPin className="w-3 h-3" />売り場マップ
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── メイン ─────────────────────────────────────────────────────────────
export default function ChatPage({ me }: { me: User }) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [proposalConcierges, setProposalConcierges] = useState<{
    sensory: Concierge | null;
    veteran: Concierge | null;
  } | null>(null);
  const [mapConcierge, setMapConcierge] = useState<Concierge | null>(null);
  // 提案末尾フローバーから開く Drawer（'gift' | 'appointment' | null）
  const [drawer, setDrawer] = useState<'gift' | 'appointment' | null>(null);
  // AI 動的生成ヒント（会話 + ナレッジから生成）
  const [hints, setHints] = useState<string[]>(DEFAULT_HINTS);
  const [hintsLoading, setHintsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { startSession(); }, [me.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startSession = async () => {
    setMessages([INITIAL_MESSAGE]);
    setInput('');
    setProposalConcierges(null);
    setHints(DEFAULT_HINTS);
    const r = await fetch(`${API}/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: me.id }),
    });
    const { sessionToken: tok } = await r.json();
    setSessionToken(tok);
  };

  // 会話文脈 + ナレッジを LLM に渡して、お客様の次の一言候補を取得
  const refreshHints = async (token: string) => {
    setHintsLoading(true);
    try {
      const r = await fetch(`${API}/chat/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: token }),
      });
      const data = await r.json();
      if (Array.isArray(data?.hints) && data.hints.length > 0) {
        setHints(data.hints);
      }
    } catch {
      // 失敗時は前のヒントを維持
    } finally {
      setHintsLoading(false);
    }
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || !sessionToken || loading) return;
    setInput('');
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', content: msg }]);
    setLoading(true);
    try {
      const r = await fetch(`${API}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, message: msg }),
      });
      const data = await r.json();
      const sc = data.sensoryConcierge ?? null;
      const vc = data.veteranConcierge ?? null;
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.message || '申し訳ありません、応答の取得に失敗しました。',
        isProposal: data.isProposal,
        suggestedProducts: data.suggestedProducts || [],
        sensoryConcierge: sc,
        veteranConcierge: vc,
      }]);
      if (data.isProposal) setProposalConcierges({ sensory: sc, veteran: vc });
      // AI 応答が返ったら、新しい文脈でヒント候補を更新（待たずに非同期実行）
      void refreshHints(sessionToken);
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: '通信エラーが発生しました。もう一度お試しください。',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="mb-4 flex items-start justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-stone-800 flex items-center gap-2">
              <Headset className="w-5 h-5 text-amber-700" />
              AIコンシェルジュ チャット
            </h1>
          </div>
          <button
            onClick={startSession}
            title="相談を最初からやり直す"
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 border border-stone-200 hover:border-stone-400 rounded-lg px-2.5 py-1.5 transition-colors flex-shrink-0"
          >
            <History className="w-3.5 h-3.5" />
            新しい相談
          </button>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto space-y-5 pb-2">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex flex-col items-center mr-2 flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-sm">
                    <Headset className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[8px] text-stone-500 mt-0.5 whitespace-nowrap">AIコンシェルジュ</span>
                </div>
              )}
              <div className={`max-w-[90%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-stone-800 text-white rounded-tr-sm'
                    : 'bg-white border border-stone-200 text-stone-800 rounded-tl-sm shadow-sm'
                }`}>
                  {msg.content}
                </div>

                {/* 商品提案 */}
                {msg.role === 'assistant' && (msg.suggestedProducts ?? []).length > 0 && (
                  <div className="mt-3 space-y-4">
                    <p className="text-xs text-stone-500 font-medium flex items-center gap-1 px-1">
                      <Award className="w-3 h-3 text-amber-600" />
                      おすすめ商品 {msg.suggestedProducts!.length}件 — 2人のコンシェルジュがそれぞれの視点でご提案します
                    </p>
                    {msg.suggestedProducts!.map((sp, i) => (
                      <ProductDualVoiceCard
                        key={sp.product.id}
                        item={sp}
                        index={i}
                        sensoryConcierge={msg.sensoryConcierge}
                        veteranConcierge={msg.veteranConcierge}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="flex flex-col items-center mr-2 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-sm">
                  <Headset className="w-4 h-4 text-white" />
                </div>
                <span className="text-[8px] text-stone-500 mt-0.5 whitespace-nowrap">AIコンシェルジュ</span>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <span className="inline-flex gap-1">
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}

          {/* 提案後CTA */}
          {proposalConcierges && (
            <MeetConciergeCTA
              sensoryConcierge={proposalConcierges.sensory}
              veteranConcierge={proposalConcierges.veteran}
              onShowMap={setMapConcierge}
            />
          )}

          {/* 提案末尾フローバー: 和紙カード / 来店予約への橋渡し（訴求軸②） */}
          {proposalConcierges && (
            <ProposalFlowBar
              onPickCard={() => setDrawer('gift')}
              onPickAppointment={() => setDrawer('appointment')}
            />
          )}
          <div ref={bottomRef} />
        </div>

        {/* フロアマップモーダル */}
        {mapConcierge && (
          <FloorMapModal concierge={mapConcierge} onClose={() => setMapConcierge(null)} />
        )}

        {/* 和紙カード / 来店予約の Drawer */}
        <ChatDrawer
          open={drawer === 'gift'}
          title="和紙メッセージカードを作成"
          onClose={() => setDrawer(null)}
        >
          <GiftCardPage />
        </ChatDrawer>
        <ChatDrawer
          open={drawer === 'appointment'}
          title="店頭で受け取る (来店予約)"
          onClose={() => setDrawer(null)}
        >
          <AppointmentPage me={me} />
        </ChatDrawer>

        {/* Hint chips: AI が会話 + ナレッジから動的生成 */}
        <div className="flex-shrink-0 mt-3 mb-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3 h-3 text-amber-600" />
            <p className="text-[10px] text-stone-500 font-medium tracking-wider">
              AI が会話の流れから次の一言を提案
            </p>
            {hintsLoading && (
              <span className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {hints.map(hint => (
              <button
                key={hint}
                onClick={() => send(hint)}
                disabled={loading}
                className="text-xs h-7 px-3 border border-amber-200 bg-amber-50/50 text-stone-700 hover:bg-amber-50 hover:border-amber-300 disabled:opacity-50 rounded-full transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 bg-white border border-stone-200 rounded-2xl px-4 py-3 shadow-sm">
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="メッセージを入力してください…（Enterで送信）"
              disabled={loading || !sessionToken}
              rows={2}
              className="flex-1 resize-none text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none bg-transparent"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim() || !sessionToken}
              className="bg-amber-700 hover:bg-amber-800 disabled:bg-stone-200 text-white rounded-xl p-2.5 transition-colors flex-shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        {/* Store CTA */}
        <button
          onClick={() => setDrawer('appointment')}
          className="flex-shrink-0 mt-3 p-4 border border-stone-200 hover:border-amber-300 rounded-xl bg-white flex items-center gap-3 transition-colors text-left"
        >
          <MapPin className="w-5 h-5 text-amber-700 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-800">コンシェルジュに直接ご相談</p>
            <p className="text-xs text-stone-500">高島屋各店のコンシェルジュが店頭でお待ちしております</p>
          </div>
          <span className="text-xs border border-amber-700 text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 whitespace-nowrap">
            来店予約
          </span>
        </button>
      </div>
    </div>
  );
}
