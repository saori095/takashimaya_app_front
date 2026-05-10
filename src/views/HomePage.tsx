'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Gift, MessageCircle, ShieldCheck, Sparkles, Star, Users,
} from 'lucide-react';

// 実行時に現在のページ origin から API base を導出する。
// localhost ↔ 127.0.0.1 のように別サイト扱いになる場合の SameSite=Lax Cookie 喪失を防ぐ目的。
const API = process.env.NEXT_PUBLIC_API_BASE
  ?? (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000');

type User = {
  id: number;
  name: string;
  role: string;
  displayName: string;
  avatarUrl?: string | null;
} | null;

type Tab = 'home' | 'catalog' | 'chat' | 'history' | 'concierge' | 'gift' | 'appointment' | 'products' | 'admin';

type Concierge = {
  id: number;
  displayName: string;
  avatarUrl?: string | null;
  yearsExperience?: number | null;
  ageGroup?: string | null;
  specialties?: string | string[] | null;
  bio?: string | null;
  role?: string | null;  // concierge_junior | concierge_senior | admin
};

// 役職ベースの判定（年数では区別しない）。
// 役職情報がない古いデータでは years_experience >= 10 をシニア扱いとしてフォールバック。
const isSenior = (c: Concierge): boolean => {
  if (c.role === 'concierge_senior') return true;
  if (c.role === 'concierge_junior') return false;
  return (c.yearsExperience ?? 0) >= 10;
};

const parseSpecialties = (s: Concierge['specialties']): string[] => {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return s.split(/[、,]/).map(t => t.trim()).filter(Boolean);
  }
};

// 顔の見える高島屋: コンシェルジュサムネイルカード（横スクロールスナップ用）
function ConciergeThumbCard({ c }: { c: Concierge }) {
  const senior = isSenior(c);
  const specs = parseSpecialties(c.specialties).slice(0, 2);
  const tone = senior
    ? { ring: 'ring-amber-300', badge: 'bg-amber-50 text-amber-800 border-amber-200', label: 'シニアコンシェルジュ' }
    : { ring: 'ring-rose-300', badge: 'bg-rose-50 text-rose-700 border-rose-200', label: 'ジュニアコンシェルジュ' };
  return (
    <div className="snap-start flex-shrink-0 w-[200px] sm:w-[220px] bg-white rounded-2xl border border-stone-200 shadow-sm p-4 flex flex-col items-center text-center hover:border-amber-300 transition-colors">
      <div className={`w-20 h-20 rounded-full overflow-hidden ring-2 ${tone.ring} ring-offset-2 bg-stone-100 mb-3`}>
        {c.avatarUrl
          ? <img src={c.avatarUrl} alt={c.displayName} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-stone-500 text-base font-bold">{c.displayName.slice(0, 2)}</div>}
      </div>
      <span className={`text-[10px] border px-2 py-0.5 rounded-full font-medium mb-1.5 ${tone.badge}`}>{tone.label}</span>
      <p className="text-sm font-semibold text-stone-900 leading-tight" style={{ fontFamily: 'Noto Serif JP, serif' }}>
        {c.displayName}
      </p>
      <p className="text-[11px] text-stone-500 mt-0.5">
        {c.ageGroup ?? ''}{c.ageGroup && c.yearsExperience != null ? ' / ' : ''}
        {c.yearsExperience != null ? `経験 ${c.yearsExperience} 年` : ''}
      </p>
      {specs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 justify-center">
          {specs.map(s => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 bg-stone-50 text-stone-600 border border-stone-200 rounded-full">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomePage({
  me, onNavigate, onRequireLogin,
}: {
  me: User;
  onNavigate: (tab: Tab) => void;
  onRequireLogin: () => void;
}) {
  const [concierges, setConcierges] = useState<Concierge[]>([]);
  // 自動送り制御: hover/touch 中は一時停止して、ユーザー操作を妨げない
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetch(`${API}/concierges`)
      .then(r => r.ok ? r.json() : [])
      .then((d: Concierge[]) => setConcierges(Array.isArray(d) ? d : []))
      .catch(() => setConcierges([]));
  }, []);

  // コンシェルジュスライダーの自動送り（シームレスループ）。
  // アイテムを2回繰り返して描画し、半分まで進んだら巻き戻すことで継ぎ目を消す。
  // scrollLeft は整数化されるため、サブピクセル速度を累算する方式で動かす。
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || paused || concierges.length === 0) return;
    const SPEED = 0.6;  // px / frame ≈ 36px/sec @ 60fps（ゆっくり）
    let acc = 0;
    let raf = 0;
    const tick = () => {
      if (!el) return;
      acc += SPEED;
      const inc = Math.floor(acc);
      if (inc > 0) {
        acc -= inc;
        const half = el.scrollWidth / 2;
        if (half > 0 && el.scrollLeft + inc >= half) {
          el.scrollLeft = el.scrollLeft + inc - half;
        } else {
          el.scrollLeft += inc;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, concierges.length]);
  const role = me?.role ?? 'user';
  const isConcierge = role === 'concierge_junior' || role === 'concierge_senior';
  const isAdmin = role === 'admin';

  const goOrLogin = (tab: Tab) => () => (me ? onNavigate(tab) : onRequireLogin());

  return (
    <div className="bg-stone-50">
      {/* ── ヒーロー ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 px-4"
               style={{ background: 'linear-gradient(135deg, color-mix(in oklch, var(--color-brand) 5%, transparent), var(--color-brand-cream), color-mix(in oklch, var(--color-brand-gold) 12%, transparent))' }}>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
               style={{ backgroundColor: 'color-mix(in oklch, var(--color-brand) 12%, transparent)', color: 'var(--color-brand)' }}>
            <Sparkles className="w-4 h-4" />
            高島屋 AIコンシェルジュ
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight"
              style={{ fontFamily: 'Noto Serif JP, serif', color: 'var(--color-brand-ink)' }}>
            顔の見える<br className="sm:hidden" />贈り物体験
          </h1>
          <p className="text-lg max-w-2xl mx-auto mb-8 leading-relaxed" style={{ color: 'var(--color-brand-muted)' }}>
            <strong style={{ color: 'var(--color-brand-ink)' }}>ジュニアコンシェルジュの感性</strong> と{' '}
            <strong style={{ color: 'var(--color-brand-ink)' }}>シニアコンシェルジュの経験知</strong> ——
            <br className="hidden md:block" />
            高島屋の店頭で受け継がれてきた2つの知見を AI が橋渡しし、あなたの大切な贈り物選びをサポートします。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={goOrLogin('chat')}
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold transition-colors hover:brightness-90"
              style={{ backgroundColor: 'var(--color-brand)', color: 'var(--color-brand-fg)' }}
            >
              <MessageCircle className="w-5 h-5" />
              AIチャットで相談する
            </button>
            <button
              onClick={goOrLogin('catalog')}
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl border text-sm font-semibold transition-colors bg-white hover:bg-stone-50"
              style={{ borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-ink)' }}
            >
              <Gift className="w-5 h-5" />
              商品カタログを見る
            </button>
          </div>
        </div>

        {/* 装飾円 */}
        <div className="absolute top-10 right-10 w-32 h-32 rounded-full blur-2xl"
             style={{ backgroundColor: 'color-mix(in oklch, var(--color-brand) 8%, transparent)' }} />
        <div className="absolute bottom-10 left-10 w-48 h-48 rounded-full blur-3xl"
             style={{ backgroundColor: 'color-mix(in oklch, var(--color-brand-gold) 14%, transparent)' }} />
      </section>

      {/* ── 顔の見える高島屋 — コンシェルジュ・サムネイル ───────────────────
          訴求軸①「顔の見える高島屋」を最初の0.5秒で伝える。
          DB の concierge_profiles から実物のアバターを横スクロールで表示。 */}
      {concierges.length > 0 && (
        <section className="py-12 px-4 bg-white border-y border-stone-100">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-6">
              <p className="text-[11px] tracking-[0.3em] text-stone-500 font-medium">CONCIERGE</p>
              <h2 className="text-2xl font-bold text-stone-900 mt-1" style={{ fontFamily: 'Noto Serif JP, serif' }}>
                私たちが寄り添います
              </h2>
              <p className="text-sm text-stone-500 mt-2">
                それぞれの経験知と感性で、あなたの贈り物選びをお手伝いします。
              </p>
            </div>
            <div
              ref={scrollerRef}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onTouchStart={() => setPaused(true)}
              onTouchEnd={() => { setTimeout(() => setPaused(false), 2000); }}
              className="flex gap-4 overflow-x-auto pb-3 px-1
                         [&::-webkit-scrollbar]:h-1.5
                         [&::-webkit-scrollbar-thumb]:bg-stone-300
                         [&::-webkit-scrollbar-thumb]:rounded-full"
            >
              {/* シームレスループのため2回描画。半分進んだら scrollLeft を巻き戻す */}
              {concierges.map(c => <ConciergeThumbCard key={`a-${c.id}`} c={c} />)}
              {concierges.map(c => <ConciergeThumbCard key={`b-${c.id}`} c={c} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── 特徴 (2世代のコンシェルジュ) ────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2 text-stone-900"
              style={{ fontFamily: 'Noto Serif JP, serif' }}>
            2世代のコンシェルジュが、ふたつの視点で寄り添います
          </h2>
          <p className="text-stone-500 text-center mb-10 text-sm">
            ジュニアの感性 × シニアの経験知 —— 高島屋の店頭で長年受け継がれてきた贈答文化を、AI が一つの提案にまとめます
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-rose-600" />
                </div>
                <span className="text-[10px] border border-rose-300 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-medium">
                  ジュニアコンシェルジュ中心
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-stone-900"
                  style={{ fontFamily: 'Noto Serif JP, serif' }}>
                感性視点 <span className="text-xs text-rose-700/80 font-normal">— 受け手の心が動く瞬間を描く</span>
              </h3>
              <p className="text-stone-600 text-sm leading-relaxed">
                <strong className="text-stone-900">ジュニアの瑞々しい感性</strong>で、心が動く瞬間を言葉に。
                「贈ってよかった」を直感で感じていただけるご提案をします。
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Star className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-[10px] border border-amber-300 text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                  シニアコンシェルジュ中心
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-stone-900"
                  style={{ fontFamily: 'Noto Serif JP, serif' }}>
                経験知視点 <span className="text-xs text-amber-700/80 font-normal">— 失敗しない選び方の根拠を示す</span>
              </h3>
              <p className="text-stone-600 text-sm leading-relaxed">
                <strong className="text-stone-900">シニアの経験知</strong>で、選定の根拠を冷静に提示。
                「外さない」確信を持っていただけるご提案をします。
              </p>
            </div>
          </div>
          <p className="text-center mt-6 text-sm text-stone-500">
            このアプリは、両世代のコンシェルジュ知見を <strong className="text-stone-900">AI が常に並列で表示</strong> することで、
            あなたが <strong className="text-stone-900">感性で惹かれ、経験知で確信する</strong> 贈り物選びをご提供します。
          </p>
        </div>
      </section>

      {/* ── ステップ ───────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-stone-100/60">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10 text-stone-900"
              style={{ fontFamily: 'Noto Serif JP, serif' }}>
            ご利用の流れ
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '01', icon: <MessageCircle className="w-6 h-6" />, title: 'AIに相談',         desc: 'シーン・予算・関係性をAIコンシェルジュに伝えるだけ。丁寧にヒアリングします。' },
              { step: '02', icon: <Sparkles className="w-6 h-6" />,      title: '2世代の視点で提案', desc: 'ジュニアの感性とシニアの経験知、2つの視点を並べて表示。心で惹かれ、根拠で確信できます。' },
              { step: '03', icon: <Gift className="w-6 h-6" />,          title: '贈り物を選ぶ',     desc: 'のし・シーン適合度・アレルギー情報など詳細メタデータで安心してお選びいただけます。' },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                     style={{ backgroundColor: 'color-mix(in oklch, var(--color-brand) 10%, transparent)' }}>
                  <div style={{ color: 'var(--color-brand)' }}>{item.icon}</div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold"
                        style={{ backgroundColor: 'var(--color-brand)', color: 'var(--color-brand-fg)' }}>
                    {item.step}
                  </span>
                </div>
                <h3 className="font-semibold mb-2 text-stone-900"
                    style={{ fontFamily: 'Noto Serif JP, serif' }}>{item.title}</h3>
                <p className="text-stone-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ロール別クイックアクセス（ログイン済みのみ） ─────────────── */}
      {me && (isConcierge || isAdmin) && (
        <section className="py-12 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-bold mb-6 text-stone-900"
                style={{ fontFamily: 'Noto Serif JP, serif' }}>
              {isConcierge ? 'コンシェルジュメニュー' : '管理者メニュー'}
            </h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {isConcierge && (
                <>
                  <QuickLink onClick={() => onNavigate('concierge')} icon={<ShieldCheck className="w-7 h-7" style={{ color: 'var(--color-brand)' }} />}
                             title="承認キュー" desc="メタデータ承認・差し戻し" />
                  <QuickLink onClick={() => onNavigate('concierge')} icon={<Users className="w-7 h-7" style={{ color: 'var(--color-brand)' }} />}
                             title="プロフィール" desc="匿名ラベル・専門分野設定" />
                </>
              )}
              {isAdmin && (
                <>
                  <QuickLink onClick={() => onNavigate('admin')} icon={<Star className="w-7 h-7" style={{ color: 'var(--color-brand)' }} />}
                             title="ダッシュボード" desc="承認履歴・統計" />
                  <QuickLink onClick={() => onNavigate('products')} icon={<Gift className="w-7 h-7" style={{ color: 'var(--color-brand)' }} />}
                             title="商品マスタ" desc="商品登録・編集・管理" />
                  <QuickLink onClick={() => onNavigate('admin')} icon={<Sparkles className="w-7 h-7" style={{ color: 'var(--color-brand)' }} />}
                             title="贈答ナレッジ管理" desc="ナレッジ一覧・新規登録" />
                  <QuickLink onClick={() => onNavigate('admin')} icon={<ShieldCheck className="w-7 h-7" style={{ color: 'var(--color-brand)' }} />}
                             title="陳腐化管理" desc="ドロップ候補・自動非表示" />
                  <QuickLink onClick={() => onNavigate('admin')} icon={<ShieldCheck className="w-7 h-7 text-rose-700" />}
                             title="AIチャット失言監視" desc="アラート確認・対応" />
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── ログイン誘導（未ログイン） ─────────────────────────────── */}
      {!me && (
        <section className="py-10 px-4">
          <div className="max-w-3xl mx-auto bg-white border border-stone-200 rounded-2xl shadow-sm p-6 text-center">
            <Sparkles className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-brand)' }} />
            <h3 className="text-lg font-bold text-stone-900 mb-1"
                style={{ fontFamily: 'Noto Serif JP, serif' }}>
              ログインして全ての機能をお試しください
            </h3>
            <p className="text-sm text-stone-500 mb-4">
              ログイン画面からテストユーザーをワンクリックで切り替えていただけます。
            </p>
            <button
              onClick={onRequireLogin}
              className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl text-sm font-semibold transition-colors hover:brightness-90"
              style={{ backgroundColor: 'var(--color-brand)', color: 'var(--color-brand-fg)' }}
            >
              ログイン画面を開く
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* ── フッター ───────────────────────────────────────────── */}
      <footer className="border-t border-stone-200 py-8 px-4 mt-8">
        <div className="max-w-5xl mx-auto text-center text-sm text-stone-500">
          <p className="mb-1" style={{ fontFamily: 'Noto Serif JP, serif' }}>株式会社髙島屋</p>
          <p>AIコンシェルジュ プロトタイプ © 2026</p>
        </div>
      </footer>
    </div>
  );
}

function QuickLink({
  icon, title, desc, onClick,
}: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-stone-200 hover:border-amber-300 transition-colors bg-white p-4 flex items-center gap-3 text-left w-full"
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-stone-800">{title}</div>
        <div className="text-xs text-stone-500 truncate">{desc}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-stone-400 flex-shrink-0" />
    </button>
  );
}
