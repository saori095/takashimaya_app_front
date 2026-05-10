'use client';

import { useState, useEffect, useRef } from 'react';
import HomePage from '../src/views/HomePage';
import ChatPage from '../src/views/ChatPage';
import HistoryPage from '../src/views/HistoryPage';
import ProductCatalogPage, { type CatalogProduct } from '../src/views/ProductCatalogPage';
import ProductsPage from '../src/views/ProductsPage';
import KnowledgePage from '../src/views/KnowledgePage';
import ConciergePage from '../src/views/ConciergePage';
import GiftCardPage, { type GiftProduct } from '../src/views/GiftCardPage';
import AppointmentPage from '../src/views/AppointmentPage';
import AdminPage from '../src/views/AdminPage';
import { Gift, LogOut, LogIn, ShieldCheck, Sparkles, ArrowRight, ArrowLeft, X, RefreshCw, ChevronDown, Bell, Home, ShoppingBag, MessageCircle, Briefcase } from 'lucide-react';

// 実行時に現在のページ origin から API base を導出する。
// localhost ↔ 127.0.0.1 のように別サイト扱いになる場合の SameSite=Lax Cookie 喪失を防ぐ目的。
const API = process.env.NEXT_PUBLIC_API_BASE
  ?? (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000');

type User = {
  id: number;
  name: string;
  email?: string;
  role: string;
  displayName: string;
  avatarUrl: string | null;
  yearsExperience?: number;
};

type Tab = 'home' | 'catalog' | 'chat' | 'history' | 'concierge' | 'gift' | 'appointment' | 'products' | 'knowledge' | 'admin';

const ROLE_META: Record<string, { label: string; tone: string; description: string }> = {
  admin: {
    label: '運用管理者',
    tone: 'bg-rose-50 text-rose-700 border border-rose-200',
    description: 'システム全体の管理・コンシェルジュ全権限',
  },
  concierge_senior: {
    label: 'シニアコンシェルジュ',
    tone: 'bg-amber-50 text-amber-700 border border-amber-200',
    description: '承認・ナレッジ編集・コメント帰属',
  },
  concierge_junior: {
    label: 'ジュニアコンシェルジュ',
    tone: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    description: 'AIメタデータ生成・初期承認',
  },
  user: {
    label: '顧客',
    tone: 'bg-stone-100 text-stone-700 border border-stone-300',
    description: 'AIチャット相談・予約・履歴閲覧',
  },
};

const ROLE_COLORS: Record<string, string> = {
  user: 'bg-blue-100 text-blue-800',
  concierge_junior: 'bg-emerald-100 text-emerald-800',
  concierge_senior: 'bg-purple-100 text-purple-800',
  admin: 'bg-red-100 text-red-800',
};

const ROLE_LABELS: Record<string, string> = {
  user: 'お客様',
  concierge_junior: 'ジュニアコンシェルジュ',
  concierge_senior: 'シニアコンシェルジュ',
  admin: '運用管理者',
};


// 訴求軸③「ナレッジ承認のボトルネック解消」を可視化する承認待ちバッジ。
// admin / concierge_* ロールのみ表示、クリックで内訳ポップオーバー、
// 各項目クリックで該当タブにジャンプ。
type BadgeCount = {
  metadata: number;
  giftTags: number;
  obsolescence: number;
  alerts: number;
  total: number;
};

function ApprovalBadge({
  count, onPick,
}: {
  count: BadgeCount | null;
  onPick: (target: 'knowledge' | 'admin') => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  if (!count) return null;
  const total = count.total;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        title={total > 0 ? `承認待ち ${total} 件` : '承認待ち 0 件'}
        className="relative flex items-center justify-center w-9 h-9 rounded-full text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
      >
        <Bell size={16} />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-2.5 border-b border-stone-100 bg-stone-50">
            <p className="text-xs font-semibold text-stone-700">対応が必要な件数</p>
          </div>
          <BadgeRow label="メタデータ承認待ち"  value={count.metadata}     onClick={() => { onPick('knowledge'); setOpen(false); }} />
          <BadgeRow label="贈答タグ承認待ち"     value={count.giftTags}     onClick={() => { onPick('knowledge'); setOpen(false); }} />
          <BadgeRow label="陳腐化キュー"          value={count.obsolescence} onClick={() => { onPick('admin');     setOpen(false); }} />
          <BadgeRow label="チャット失言アラート" value={count.alerts}       onClick={() => { onPick('admin');     setOpen(false); }} />
          {total === 0 && (
            <p className="px-4 py-3 text-[11px] text-stone-400 text-center">対応待ちはありません</p>
          )}
        </div>
      )}
    </div>
  );
}

function BadgeRow({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors text-left"
    >
      <span>{label}</span>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        value > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-stone-400'
      }`}>
        {value}
      </span>
    </button>
  );
}

export default function Page() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [tabHistory, setTabHistory] = useState<Tab[]>([]);
  // カタログから「贈り物カードを作る」で選んだ商品。GiftCardPage にプリセットとして渡す
  const [selectedGiftProduct, setSelectedGiftProduct] = useState<GiftProduct | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loggingInId, setLoggingInId] = useState<number | null>(null);
  // スマホのフッターナビから開くボトムシート: 'more'=その他メニュー, 'staff'=業務メニュー
  const [mobileSheet, setMobileSheet] = useState<'more' | 'staff' | null>(null);
  const [showLogin, setShowLogin] = useState(false); // ログイン画面を全画面表示するか
  const [openMenu, setOpenMenu] = useState<Tab | null>(null); // 開いているドロップダウン
  const [badgeCount, setBadgeCount] = useState<BadgeCount | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  // タブ移動: 履歴に積んでから新しいタブへ
  const navigateTab = (next: Tab) => {
    if (next !== tab) setTabHistory(h => [...h, tab]);
    setTab(next);
  };
  // 戻る: 履歴から1つ取り出して戻る
  const goBack = () => {
    setTabHistory(h => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setTab(prev);
      return h.slice(0, -1);
    });
  };
  const canGoBack = tabHistory.length > 0;

  // クリックアウトでドロップダウンを閉じる
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    fetch(`${API}/users`).then(r => r.json()).then(setAllUsers);
    fetch(`${API}/me`).then(r => r.json()).then(u => { if (u?.id) setMe(u); });
  }, []);

  // 承認バッジ: スタッフロール時のみ取得し、タブ切替/ログイン時に再取得
  useEffect(() => {
    if (!me) { setBadgeCount(null); return; }
    if (!['admin', 'concierge_senior', 'concierge_junior'].includes(me.role)) {
      setBadgeCount(null);
      return;
    }
    fetch(`${API}/approvals/badge-count`)
      .then(r => r.ok ? r.json() : null)
      .then(setBadgeCount)
      .catch(() => setBadgeCount(null));
  }, [me, tab]);

  const login = async (userId: number) => {
    setLoggingInId(userId);
    const r = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const u = await r.json();
    setLoggingInId(null);
    if (u?.id) { setMe(u); setShowLogin(false); setTab('home'); setTabHistory([]); }
  };

  const logout = async () => {
    await fetch(`${API}/logout`, { method: 'POST' });
    const u = await fetch(`${API}/me`).then(r => r.json());
    setMe(u?.id ? u : null);
    setTab('home');
    setTabHistory([]);
  };

  // ── Login screen ────────────────────────────────────────────────────────
  if (showLogin || (!me && tab !== 'home')) {
    // Group users by role
    const grouped: Record<string, User[]> = {};
    allUsers.forEach(u => {
      if (!grouped[u.role]) grouped[u.role] = [];
      grouped[u.role].push(u);
    });

    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-brand-cream)' }}>
        {/* Login header（クリックでホームへ戻れる + 切替時の閉じるボタン） */}
        <header className="sticky top-0 z-50 bg-white border-b border-stone-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-16">
            <button
              onClick={() => { setShowLogin(false); setTab('home'); }}
              className="flex items-center gap-2 group"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center"
                   style={{ backgroundColor: 'var(--color-brand)' }}>
                <Gift size={16} style={{ color: 'var(--color-brand-fg)' }} />
              </div>
              <div className="text-left">
                <div className="text-[9px] text-stone-400 leading-none" style={{ fontFamily: 'Noto Serif JP, serif' }}>TAKASHIMAYA</div>
                <div className="text-xs font-semibold text-stone-800 leading-tight" style={{ fontFamily: 'Noto Serif JP, serif' }}>AIコンシェルジュ</div>
              </div>
            </button>
            {me && (
              <button
                onClick={() => setShowLogin(false)}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 border border-stone-200 hover:border-stone-400 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <X size={13} />
                <span>切替を中止</span>
              </button>
            )}
          </div>
        </header>

        <div className="max-w-3xl mx-auto py-8 px-4">
          {/* Title */}
          <div className="mb-6 text-center">
            <p className="text-[11px] tracking-[0.3em] text-stone-500 font-medium">SIGN IN</p>
            <h1 className="text-2xl font-bold text-stone-900 mt-1">ログイン</h1>
            <p className="text-xs text-stone-500 mt-2">
              タカシマヤカード会員の方は、お持ちの会員情報でログインしてください。
            </p>
          </div>

          {/* Email + Password form (dummy) */}
          <div className="bg-white border border-stone-200 rounded-lg mb-6 p-5">
            <p className="text-[10px] tracking-widest text-stone-500 font-semibold mb-3 flex items-center gap-1.5">
              <ShieldCheck size={12} /> MEMBER LOGIN
            </p>
            <form onSubmit={e => { e.preventDefault(); }} className="space-y-3">
              <div>
                <label className="text-xs text-stone-600 mb-1 block">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@takashimaya.co.jp"
                  className="w-full h-9 border border-stone-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
                />
              </div>
              <div>
                <label className="text-xs text-stone-600 mb-1 block">パスワード</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="********"
                  className="w-full h-9 border border-stone-200 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
                />
              </div>
              <button
                type="submit"
                className="w-full h-9 bg-stone-800 hover:bg-stone-900 text-white text-sm font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogIn size={14} /> ログイン
              </button>
            </form>
            <p className="text-[10px] text-stone-400 text-center mt-2">
              このフォームはデモ環境では機能しません。下のテストユーザーカードからログインしてください。
            </p>
          </div>

          {/* Test users */}
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-stone-800">テストユーザーですぐにログイン</h2>
            <span className="ml-auto text-[10px] text-amber-700 border border-amber-300 bg-amber-50 px-2 py-0.5 rounded-full font-medium">DEMO</span>
          </div>
          <p className="text-xs text-stone-500 mb-3">
            以下のいずれかをクリックすると、その権限でアプリにログインします。
          </p>

          <div className="space-y-4">
            {(['admin', 'concierge_senior', 'concierge_junior', 'user'] as const).map(role => {
              const meta = ROLE_META[role];
              const list = grouped[role] ?? [];
              if (list.length === 0) return null;
              return (
                <div key={role}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${meta.tone}`}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-stone-500">{meta.description}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {list.map(u => {
                      const isLoggingIn = loggingInId === u.id;
                      return (
                        <button
                          key={u.id}
                          onClick={() => login(u.id)}
                          disabled={loggingInId !== null}
                          className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 bg-white text-left transition-all hover:border-amber-400 hover:shadow-sm disabled:opacity-60"
                        >
                          <div className="w-12 h-12 rounded-full bg-stone-100 border border-stone-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {u.avatarUrl
                              ? <img src={u.avatarUrl} alt={u.displayName} className="w-full h-full object-cover" />
                              : <span className="text-base font-bold text-stone-600">{u.displayName.slice(0, 2)}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-stone-800 truncate">{u.displayName}</p>
                            {u.email && <p className="text-[10px] text-stone-500 truncate">{u.email}</p>}
                            {u.yearsExperience != null && (
                              <p className="text-[10px] text-stone-400">経験 {u.yearsExperience} 年</p>
                            )}
                          </div>
                          {isLoggingIn
                            ? <span className="flex-shrink-0 w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                            : <ArrowRight size={16} className="text-stone-300 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-8 text-xs text-stone-500">
            まだ会員でないお客様は{' '}
            <span className="text-amber-700 font-medium underline cursor-pointer">新規会員登録</span>{' '}
            から
          </div>
        </div>
      </div>
    );
  }

  // ── Main app shell（home は !me でも表示可、それ以外はログイン必須） ─────

  // takashimaya AppNav 風のドロップダウン構造。主ナビは「商品カタログ▼」「AIチャット▼」の2系統＋ロール限定の業務メニュー。
  type SubItem = { key: Tab; label: string; roles?: string[] };
  type Group = { key: Tab; label: string; access: 'auth' | 'staff'; items: SubItem[] };
  const NAV_GROUPS: Group[] = [
    {
      key: 'catalog', label: '商品カタログ', access: 'auth',
      items: [
        { key: 'gift',       label: 'ギフトカード' },
      ],
    },
    {
      key: 'chat', label: 'AIチャット', access: 'auth',
      items: [
        { key: 'history',     label: '相談履歴' },
        { key: 'appointment', label: '相談予約' },
      ],
    },
    {
      key: 'admin', label: '業務メニュー', access: 'staff',
      items: [
        { key: 'concierge', label: 'コンシェルジュ業務', roles: ['admin', 'concierge_senior', 'concierge_junior'] },
        { key: 'knowledge', label: 'ナレッジ管理',       roles: ['admin', 'concierge_senior', 'concierge_junior'] },
        { key: 'products',  label: '商品管理',           roles: ['admin', 'concierge_senior', 'concierge_junior'] },
        { key: 'admin',     label: '管理ダッシュボード',  roles: ['admin'] },
      ],
    },
  ];

  const isStaff = !!me && (me.role === 'admin' || me.role === 'concierge_senior' || me.role === 'concierge_junior');
  const visibleGroups = NAV_GROUPS.filter(g =>
    (g.access === 'auth' && !!me) || (g.access === 'staff' && isStaff)
  );

  // staff グループの「親ボタン」は、ロール別に最初にアクセスできるサブを既定先にする
  const groupDefault = (g: Group): Tab => {
    if (g.access !== 'staff') return g.key;
    const first = g.items.find(it => !it.roles || (me && it.roles.includes(me.role)));
    return first ? first.key : g.key;
  };

  const subItems = (g: Group): SubItem[] =>
    g.items.filter(it => !it.roles || (me && it.roles.includes(me.role)));

  // dropdown 開閉
  const isInGroup = (g: Group): boolean => tab === g.key || g.items.some(it => it.key === tab);

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* Header (AppNav style) */}
      <header className="sticky top-0 z-50 bg-white border-b border-stone-200 shadow-sm">
        <div className="flex items-center justify-between h-16 px-4 max-w-screen-xl mx-auto">
          {/* 戻るボタン: タブ移動履歴がある時だけ表示。ロゴ左に置く */}
          <div className="flex items-center gap-2 min-w-0">
            {canGoBack && (
              <button
                onClick={goBack}
                title="前のページに戻る"
                className="flex items-center justify-center w-9 h-9 rounded-full text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors flex-shrink-0"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            {/* Logo (クリックで Home へ) */}
            <button onClick={() => navigateTab('home')} className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: 'var(--color-brand)' }}>
                <Gift size={16} style={{ color: 'var(--color-brand-fg)' }} />
              </div>
              <div className="text-left">
                <div className="text-[9px] text-stone-400 leading-none" style={{ fontFamily: 'Noto Serif JP, serif' }}>TAKASHIMAYA</div>
                <div className="text-xs font-semibold text-stone-800 leading-tight" style={{ fontFamily: 'Noto Serif JP, serif' }}>AIコンシェルジュ</div>
              </div>
            </button>
          </div>

          {/* Desktop nav: 商品カタログ▼ / AIチャット▼ / 業務メニュー▼ */}
          <nav ref={navRef} className="hidden md:flex items-center gap-1">
            {visibleGroups.map(g => {
              const subs = subItems(g);
              const opened = openMenu === g.key;
              const active = isInGroup(g);
              const main = (
                <button
                  onClick={() => { navigateTab(groupDefault(g)); setOpenMenu(null); }}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    active ? 'bg-stone-100 text-stone-900 font-medium' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  {g.label}
                </button>
              );
              return (
                <div key={g.key} className="relative flex items-center">
                  {/* staff グループは「親=ドロップダウントリガー」、それ以外は「親=直接ナビ＋▼」 */}
                  {g.access !== 'staff' && main}
                  {subs.length > 0 && (
                    <button
                      onClick={() => setOpenMenu(opened ? null : g.key)}
                      aria-label={`${g.label} メニュー`}
                      className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition-colors ${
                        opened || active
                          ? 'text-stone-900'
                          : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
                      } ${g.access === 'staff' ? 'pl-3' : ''}`}
                    >
                      {g.access === 'staff' && <span className={active ? 'font-medium' : ''}>{g.label}</span>}
                      <ChevronDown size={14} className={`transition-transform ${opened ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                  {opened && subs.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 min-w-[200px] bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden z-50">
                      {subs.map(s => (
                        <button
                          key={s.key}
                          onClick={() => { navigateTab(s.key); setOpenMenu(null); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            tab === s.key
                              ? 'bg-stone-100 text-stone-900 font-medium'
                              : 'text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User menu / Login button */}
          <div className="flex items-center gap-2">
            {me && isStaff && (
              <ApprovalBadge count={badgeCount} onPick={target => navigateTab(target)} />
            )}
            {me ? (
              <>
                {/* ヘッダーのユーザー表示: アバター + (名前 / ロールタグを縦積み) */}
                <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-stone-50 cursor-default">
                  <div className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {me.avatarUrl
                      ? <img src={me.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[10px] font-bold text-stone-600">{me.displayName.slice(0, 2)}</span>}
                  </div>
                  <div className="flex flex-col items-start min-w-0 leading-tight">
                    <span className="max-w-32 truncate text-sm text-stone-800">{me.displayName}</span>
                    <span className={`mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${ROLE_COLORS[me.role] || 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[me.role] || me.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowLogin(true)}
                  title="別のテストユーザーに切り替える"
                  className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 border border-amber-200 hover:border-amber-400 bg-amber-50/40 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <RefreshCw size={13} />
                  <span className="hidden sm:inline">ユーザー切替</span>
                </button>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 border border-stone-200 hover:border-stone-400 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <LogOut size={13} />
                  <span className="hidden sm:inline">ログアウト</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 transition-colors hover:brightness-90"
                style={{ backgroundColor: 'var(--color-brand)', color: 'var(--color-brand-fg)' }}
              >
                <LogIn size={13} />
                <span>ログイン</span>
              </button>
            )}
            {/* スマホはヘッダーにメニューボタンを置かず、フッターのボトムナビでナビゲート */}
          </div>
        </div>
      </header>

      {/* Page content */}
      {/* overflow-y-auto: 商品ナレッジ一覧など長いコンテンツでもページ下までスクロール可能。
          ChatPage は内部で固定高さ(calc(100vh - 64px))を持つので影響なし。 */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {tab === 'home'        && <HomePage me={me} onNavigate={navigateTab} onRequireLogin={() => setShowLogin(true)} />}
        {me && tab === 'catalog'     && (
          <ProductCatalogPage
            onAskAI={() => navigateTab('chat')}
            onPurchase={(p: CatalogProduct) => {
              // 商品をプリセットして GiftCardPage へ遷移 (この導線がカタログからの「購入」相当)
              setSelectedGiftProduct({
                id: p.id, name: p.name, price: p.price,
                brand: p.brand, imageUrl: p.imageUrl,
              });
              navigateTab('gift');
            }}
          />
        )}
        {me && tab === 'chat'        && <ChatPage key={me.id} me={me} />}
        {me && tab === 'history'     && <HistoryPage key={me.id} me={me} />}
        {me && tab === 'products'    && <ProductsPage />}
        {me && tab === 'knowledge'   && <KnowledgePage key={me.id} me={me} />}
        {me && tab === 'concierge'   && <ConciergePage key={me.id} me={me} />}
        {me && tab === 'gift'        && (
          <GiftCardPage
            selectedProduct={selectedGiftProduct}
            onClearProduct={() => setSelectedGiftProduct(null)}
          />
        )}
        {me && tab === 'appointment' && <AppointmentPage key={me.id} me={me} />}
        {me && tab === 'admin'       && <AdminPage />}
      </main>

      {/* スマホ用フッターナビ (md以上は非表示) */}
      <MobileBottomNav
        tab={tab}
        isStaff={isStaff}
        onPick={t => { navigateTab(t); setMobileSheet(null); }}
        onOpenStaff={() => setMobileSheet('staff')}
        onOpenMore={() => setMobileSheet('more')}
      />

      {/* ボトムシート: その他メニュー / 業務メニュー */}
      {mobileSheet && (
        <MobileSheet
          kind={mobileSheet}
          me={me}
          isStaff={isStaff}
          onClose={() => setMobileSheet(null)}
          onPick={t => { navigateTab(t); setMobileSheet(null); }}
          onLogout={async () => { await logout(); setMobileSheet(null); }}
          onSwitchUser={() => { setMobileSheet(null); setShowLogin(true); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// スマホ用フッターナビ + ボトムシート
// ============================================================================

function MobileBottomNav({
  tab, isStaff, onPick, onOpenStaff, onOpenMore,
}: {
  tab: Tab;
  isStaff: boolean;
  onPick: (t: Tab) => void;
  onOpenStaff: () => void;
  onOpenMore: () => void;
}) {
  const items: { key: string; label: string; icon: React.ReactNode; onClick: () => void; active: boolean }[] = [
    { key: 'home',    label: 'ホーム',    icon: <Home size={18} />,          onClick: () => onPick('home'),     active: tab === 'home' },
    { key: 'catalog', label: 'カタログ',  icon: <ShoppingBag size={18} />,   onClick: () => onPick('catalog'),  active: tab === 'catalog' },
    { key: 'chat',    label: 'チャット',  icon: <MessageCircle size={18} />, onClick: () => onPick('chat'),     active: tab === 'chat' },
  ];
  if (isStaff) {
    items.push({
      key: 'staff', label: '業務', icon: <Briefcase size={18} />,
      onClick: onOpenStaff,
      active: tab === 'concierge' || tab === 'knowledge' || tab === 'products' || tab === 'admin',
    });
  }
  items.push({
    key: 'more', label: 'メニュー', icon: <ChevronDown size={18} className="rotate-180" />,
    onClick: onOpenMore,
    active: false,
  });

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
      <div className="flex items-stretch justify-around h-16 max-w-screen-xl mx-auto">
        {items.map(it => (
          <button
            key={it.key}
            onClick={it.onClick}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              it.active ? 'text-amber-700' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <span className={it.active ? 'text-amber-700' : ''}>{it.icon}</span>
            <span className="text-[10px] font-medium">{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function MobileSheet({
  kind, me, isStaff, onClose, onPick, onLogout, onSwitchUser,
}: {
  kind: 'more' | 'staff';
  me: User | null;
  isStaff: boolean;
  onClose: () => void;
  onPick: (t: Tab) => void;
  onLogout: () => void;
  onSwitchUser: () => void;
}) {
  // 業務メニュー: コンシェルジュ・管理者向け
  const staffItems: { key: Tab; label: string; admin?: boolean }[] = [
    { key: 'concierge', label: 'コンシェルジュ業務' },
    { key: 'knowledge', label: 'ナレッジ管理' },
    { key: 'products',  label: '商品管理' },
    { key: 'admin',     label: '管理ダッシュボード', admin: true },
  ];
  // その他メニュー: ログイン中なら個人系メニュー、未ログインなら案内
  const moreItems: { key: Tab; label: string }[] = me ? [
    { key: 'history',     label: 'チャット履歴' },
    { key: 'appointment', label: '相談予約' },
    { key: 'gift',        label: 'ギフトカード' },
  ] : [];

  return (
    <div className="md:hidden fixed inset-0 z-50 bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-2xl shadow-xl pb-safe"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          <p className="text-sm font-semibold text-stone-800">
            {kind === 'staff' ? '業務メニュー' : 'メニュー'}
          </p>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-2 py-2 max-h-[70vh] overflow-y-auto">
          {kind === 'staff' && (
            <>
              {staffItems
                .filter(it => !it.admin || me?.role === 'admin')
                .map(it => (
                  <button
                    key={it.key}
                    onClick={() => onPick(it.key)}
                    className="w-full text-left px-3 py-3 text-sm text-stone-700 hover:bg-stone-50 rounded-lg flex items-center justify-between"
                  >
                    <span>{it.label}</span>
                    <ArrowRight size={14} className="text-stone-400" />
                  </button>
                ))}
            </>
          )}

          {kind === 'more' && (
            <>
              {moreItems.map(it => (
                <button
                  key={it.key}
                  onClick={() => onPick(it.key)}
                  className="w-full text-left px-3 py-3 text-sm text-stone-700 hover:bg-stone-50 rounded-lg flex items-center justify-between"
                >
                  <span>{it.label}</span>
                  <ArrowRight size={14} className="text-stone-400" />
                </button>
              ))}

              {!me && (
                <p className="px-3 py-4 text-xs text-stone-500 text-center">
                  ログインすると相談履歴やギフトカードなどがご利用いただけます。
                </p>
              )}

              {me && (
                <>
                  <div className="my-2 border-t border-stone-100" />
                  <div className="px-3 py-2 text-[10px] text-stone-400 uppercase tracking-wider">
                    アカウント
                  </div>
                  {isStaff && (
                    <button
                      onClick={onSwitchUser}
                      className="w-full text-left px-3 py-3 text-sm text-amber-700 hover:bg-amber-50 rounded-lg flex items-center gap-2"
                    >
                      <RefreshCw size={14} />
                      ユーザー切替
                    </button>
                  )}
                  {!isStaff && (
                    <button
                      onClick={onSwitchUser}
                      className="w-full text-left px-3 py-3 text-sm text-amber-700 hover:bg-amber-50 rounded-lg flex items-center gap-2"
                    >
                      <RefreshCw size={14} />
                      ユーザー切替
                    </button>
                  )}
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-3 py-3 text-sm text-stone-700 hover:bg-stone-50 rounded-lg flex items-center gap-2"
                  >
                    <LogOut size={14} />
                    ログアウト
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
