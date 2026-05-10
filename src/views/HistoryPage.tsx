'use client';

import { useState, useEffect } from 'react';
import {
  ChevronRight, MessageCircle, Calendar, Gift, ArrowLeft, Sparkles, BookOpen,
} from 'lucide-react';

// 実行時に現在のページ origin から API base を導出する。
// localhost ↔ 127.0.0.1 のように別サイト扱いになる場合の SameSite=Lax Cookie 喪失を防ぐ目的。
const API = process.env.NEXT_PUBLIC_API_BASE
  ?? (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000');

type User = { id: number };

type Session = {
  id: number;
  sessionToken: string;
  occasion?: string;
  budget?: string;
  relation?: string;
  recipientAge?: string;
  status?: string;
  messageCount?: number;
  createdAt: string;
};

type ChatMsg = {
  id: number;
  role: string;
  content: string;
  suggestedProductIds: number[];
  viewpoint?: string;
  createdAt: string;
};

type Product = {
  id: number;
  name: string;
  brand?: string | null;
  category?: string | null;
  price: number;
  imageUrl?: string | null;
};

const OCCASION_LABELS: Record<string, string> = {
  baby: '出産祝い', wedding: '結婚祝い', birthday: '誕生日',
  ochugen: 'お中元', oseibo: 'お歳暮', thanks: 'お礼・感謝',
  condolence: '弔事', promotion: '昇進・就任祝い', housewarming: '引越し・新築祝い',
  retirement: '退職祝い', longevity: '長寿祝い', other: 'その他',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:    { label: '相談中',  color: 'bg-blue-50 text-blue-700 border border-blue-200' },
  completed: { label: '完了',    color: 'bg-green-50 text-green-700 border border-green-200' },
  abandoned: { label: '中断',    color: 'bg-stone-50 text-stone-500 border border-stone-200' },
};

const VIEWPOINT_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  sensory:    { label: '感性',  cls: 'bg-rose-50 text-rose-700 border border-rose-200',     icon: <Sparkles className="w-2.5 h-2.5" /> },
  experience: { label: '経験知', cls: 'bg-blue-50 text-blue-700 border border-blue-200',    icon: <BookOpen className="w-2.5 h-2.5" /> },
  both:       { label: '両視点', cls: 'bg-amber-50 text-amber-700 border border-amber-200', icon: <Sparkles className="w-2.5 h-2.5" /> },
  question:   { label: '質問',   cls: 'bg-stone-50 text-stone-500 border border-stone-200', icon: <MessageCircle className="w-2.5 h-2.5" /> },
};

export default function HistoryPage({ me }: { me: User }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ session: Session | null; messages: ChatMsg[] }>({ session: null, messages: [] });
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    // 401/403 等で配列以外が返ってきたときに .map() でクラッシュしないよう、Array.isArray でガード
    const safeArr = <T,>(setter: (v: T[]) => void) => (data: unknown) =>
      setter(Array.isArray(data) ? (data as T[]) : []);
    fetch(`${API}/chat/sessions`).then(r => r.json()).then(safeArr(setSessions)).catch(() => setSessions([]));
    fetch(`${API}/products`).then(r => r.json()).then(safeArr(setProducts)).catch(() => setProducts([]));
  }, [me.id]);

  useEffect(() => {
    if (selectedId == null) return;
    setLoadingDetail(true);
    fetch(`${API}/chat/sessions/${selectedId}`).then(r => r.json()).then(d => {
      // エラーレスポンス ({detail:"..."}) でも d.messages が undefined になるので、配列チェックを付ける
      const msgs = Array.isArray(d?.messages) ? d.messages : [];
      const session = d && typeof d === 'object' && 'id' in d ? d : null;
      setDetail({ session, messages: msgs });
      setLoadingDetail(false);
    }).catch(() => {
      setDetail({ session: null, messages: [] });
      setLoadingDetail(false);
    });
  }, [selectedId]);

  const productById = (id: number) => products.find(p => p.id === id);

  // ── 詳細ビュー ───────────────────────────────────────────────
  if (selectedId != null) {
    const s = detail.session;
    const statusInfo = STATUS_LABELS[s?.status || ''] ?? STATUS_LABELS.completed;
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button
          onClick={() => { setSelectedId(null); setDetail({ session: null, messages: [] }); }}
          className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          一覧に戻る
        </button>

        {/* セッションメタ */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-xs text-stone-500">
              {s ? new Date(s.createdAt).toLocaleString('ja-JP', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
              }) : '—'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-auto ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
          <h2 className="text-lg font-bold text-stone-800 mb-2">
            {OCCASION_LABELS[s?.occasion || ''] ?? s?.occasion ?? '相談履歴'}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {s?.budget && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-stone-200 bg-stone-50 text-stone-600">
                予算: {Number(s.budget).toLocaleString()}円
              </span>
            )}
            {s?.relation && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-stone-200 bg-stone-50 text-stone-600">
                {s.relation}
              </span>
            )}
            {s?.recipientAge && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-stone-200 bg-stone-50 text-stone-600">
                {s.recipientAge}
              </span>
            )}
          </div>
        </div>

        {/* メッセージスレッド */}
        {loadingDetail ? (
          <div className="flex justify-center py-12">
            <span className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {detail.messages.map(m => {
              const vp = VIEWPOINT_BADGE[m.viewpoint || 'question'];
              return (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                      <Gift className="w-4 h-4 text-amber-700" />
                    </div>
                  )}
                  <div className="max-w-[88%]">
                    {m.role === 'assistant' && vp && (
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium mb-1 ${vp.cls}`}>
                        {vp.icon}{vp.label}
                      </span>
                    )}
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-stone-800 text-white rounded-tr-sm'
                        : 'bg-white border border-stone-200 text-stone-800 rounded-tl-sm shadow-sm'
                    }`}>
                      {m.content}
                    </div>

                    {/* 提案商品 */}
                    {m.role === 'assistant' && m.suggestedProductIds.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {m.suggestedProductIds.map(pid => {
                          const p = productById(pid);
                          if (!p) return (
                            <div key={pid} className="text-[11px] text-stone-400 px-2">商品 #{pid}（情報取得不可）</div>
                          );
                          return (
                            <div key={pid} className="bg-amber-50/40 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-3">
                              {p.imageUrl ? (
                                <img src={p.imageUrl.startsWith('/uploads/') ? `${API}${p.imageUrl}` : p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-stone-100" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center"><Gift className="w-4 h-4 text-stone-400" /></div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-stone-800 truncate">{p.name}</p>
                                <p className="text-[10px] text-stone-400 truncate">{p.brand} · {p.category}</p>
                              </div>
                              <p className="text-xs font-bold text-amber-700 flex-shrink-0">¥{p.price.toLocaleString()}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-[10px] text-stone-300 mt-1 text-right">
                      {new Date(m.createdAt).toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── 一覧ビュー ─────────────────────────────────────────────
  if (sessions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <MessageCircle size={48} className="mx-auto mb-4 text-stone-200" />
        <h2 className="text-lg font-bold text-stone-800 mb-2">まだ相談履歴がありません</h2>
        <p className="text-sm text-stone-500 mb-4">AIコンシェルジュに贈り物の相談をすると履歴が残ります</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-amber-700" />
          相談履歴
        </h1>
        <p className="text-sm text-stone-500 mt-1">過去のAIコンシェルジュとの相談内容を振り返れます</p>
      </div>

      <p className="text-xs text-stone-400 mb-3">{sessions.length}件の相談履歴</p>

      <div className="space-y-3">
        {sessions.map(s => {
          const statusInfo = STATUS_LABELS[s.status || ''] ?? STATUS_LABELS.completed;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-4 flex items-start gap-3 text-left hover:border-amber-300 hover:shadow-sm transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                  <span className="text-xs text-stone-500">
                    {new Date(s.createdAt).toLocaleString('ja-JP', {
                      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-auto ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {s.occasion && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                      <Gift className="w-3 h-3" />
                      {OCCASION_LABELS[s.occasion] ?? s.occasion}
                    </span>
                  )}
                  {s.budget && (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-stone-200 bg-stone-50 text-stone-600">
                      予算: {Number(s.budget).toLocaleString()}円
                    </span>
                  )}
                  {s.relation && (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-stone-200 bg-stone-50 text-stone-600">
                      {s.relation}
                    </span>
                  )}
                  {s.recipientAge && (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-stone-200 bg-stone-50 text-stone-600">
                      {s.recipientAge}
                    </span>
                  )}
                </div>

                {s.messageCount != null && (
                  <div className="flex items-center gap-1 text-xs text-stone-400">
                    <MessageCircle className="w-3 h-3" />
                    {s.messageCount}件のメッセージ
                  </div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0 mt-1" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
