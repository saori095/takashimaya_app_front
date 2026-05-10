'use client';

import { useState, useEffect } from 'react';
import {
  ShieldCheck, TrendingUp, Gift, Clock, CheckCircle,
  ArrowRight, CheckCircle2, Trash2,
  Layers, FileWarning, Tag, Zap, ChevronDown, ChevronUp, X,
} from 'lucide-react';

// 実行時に現在のページ origin から API base を導出する。
// localhost ↔ 127.0.0.1 のように別サイト扱いになる場合の SameSite=Lax Cookie 喪失を防ぐ目的。
const API = process.env.NEXT_PUBLIC_API_BASE
  ?? (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000');

// 贈答タグ表示用の英語キー → 日本語ラベル変換
const TAG_LABEL: Record<string, string> = {
  // シーン
  baby:       '出産・ベビー',
  wedding:    '結婚・婚礼',
  birthday:   'お誕生日',
  thanks:     'お礼・御礼',
  ochugen:    'お中元',
  oseibo:     'お歳暮',
  business:   'ビジネス',
  condolence: '弔事',
  // 受け手
  parent:      '親',
  grandparent: '祖父母',
  sibling:     '兄弟姉妹',
  friend:      '友人',
  colleague:   '同僚',
  boss:        '上司',
  client:      '取引先',
  // 属性フラグ
  alcohol:           'アルコール',
  fragile:           '割れ物',
  cold_chain:        '冷蔵・冷凍',
  short_shelf_life:  '賞味期限短',
  made_to_order:     '受注生産',
  name_inscription:  '名入れ可',
};
const tagLabel = (k: string) => TAG_LABEL[k] ?? k;

type Stats = {
  totalProducts: number;
  pendingApprovals: number;
  totalSessions: number;
  openAlerts: number;
  totalUsers: number;
  pendingAppointments: number;
  productsByCategory: { category: string; count: number }[];
  metadataByApproval: { status: string; count: number }[];
};

type Alert = {
  id: number;
  sessionToken?: string;
  occasion?: string;
  severity: string;
  category: string;
  ruleLabel: string;
  evidence?: string;
  status: string;
  createdAt: string;
};

type ApprovalItem = {
  queueId: number;
  priority: number;
  queueStatus: string;
  metaId: number;
  approvalStatus: string;
  sensoryComment: string | null;
  experienceComment: string | null;
  confidenceScore: number | null;
  attemptNo: number;
  rejectedReason?: string | null;
  productId: number;
  productName: string;
  imageUrl?: string | null;
  brand?: string | null;
  category?: string | null;
  price: number;
  queuedAt: string;
  submittedBy?: number | null;
  submitterName?: string | null;
  submitterRole?: string | null;
};

const SUBMITTER_BADGE: Record<string, string> = {
  admin:            'bg-rose-50 text-rose-700 border-rose-200',
  concierge_senior: 'bg-amber-50 text-amber-700 border-amber-200',
  concierge_junior: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const SUBMITTER_LABEL: Record<string, string> = {
  admin:            '管理者',
  concierge_senior: 'シニア',
  concierge_junior: 'ジュニア',
};

type RejectionCategory = {
  id: number;
  code: string;
  label: string;
  promptHint: string;
  category?: string | null;
  hitCount: number;
};

type TagApprovalItem = {
  id: number;
  productId: number;
  productName: string;
  imageUrl?: string | null;
  brand?: string | null;
  category?: string | null;
  payload: {
    sceneCompatibility?: Record<string, number>;
    audienceCompatibility?: Record<string, number>;
    attributeFlags?: string[];
    minDeliveryDays?: number | null;
    shelfLifeDays?: number | null;
  };
  source: string;
  status: string;
  action?: string | null;
  submitterName?: string | null;
  submittedAt: string;
  notes?: string | null;
};

type ObsolescenceItem = {
  id: number;
  productId: number;
  productName: string;
  imageUrl?: string | null;
  brand?: string | null;
  category?: string | null;
  seasonTag?: string | null;
  stockStatus?: string | null;
  reason: 'season_ended' | 'out_of_stock' | 'low_sales' | 'manual';
  status: 'pending' | 'approved_drop' | 'rejected_drop';
  notes?: string | null;
  detectedAt: string;
  processedAt?: string | null;
};

const SEVERITY_COLORS: Record<string, string> = {
  high:   'bg-red-50 text-red-700 border border-red-200',
  medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  low:    'bg-stone-50 text-stone-500 border border-stone-200',
};

const REASON_LABELS: Record<string, string> = {
  season_ended:  '季節終了',
  out_of_stock:  '在庫切れ',
  low_sales:     '販売不振',
  manual:        '手動指定',
};

type Tab = 'stats' | 'approval' | 'tagApproval' | 'obsolescence' | 'alerts';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [rejectionCats, setRejectionCats] = useState<RejectionCategory[]>([]);
  const [tagApprovals, setTagApprovals] = useState<TagApprovalItem[]>([]);
  const [obsolescence, setObsolescence] = useState<ObsolescenceItem[]>([]);

  const [openApproval, setOpenApproval] = useState<number | null>(null);
  const [rejectCatId, setRejectCatId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [batching, setBatching] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (tab === 'stats')        loadStats();
    if (tab === 'approval')     { loadApprovals(); loadRejectionCats(); }
    if (tab === 'tagApproval')  loadTagApprovals();
    if (tab === 'obsolescence') loadObsolescence();
    if (tab === 'alerts')       loadAlerts();
  }, [tab]);

  const loadStats        = () => fetch(`${API}/admin/stats`).then(r => r.json()).then(setStats);
  const loadAlerts       = () => fetch(`${API}/admin/alerts`).then(r => r.json()).then(setAlerts);
  const loadApprovals    = () => fetch(`${API}/admin/approval-queue`).then(r => r.json()).then(setApprovals);
  const loadRejectionCats = () => fetch(`${API}/admin/rejection-categories`).then(r => r.json()).then(setRejectionCats);
  const loadTagApprovals = () => fetch(`${API}/admin/tag-approval-queue`).then(r => r.json()).then(setTagApprovals);
  const loadObsolescence = () => fetch(`${API}/admin/obsolescence-queue`).then(r => r.json()).then(setObsolescence);

  const resolveAlert = async (id: number) => {
    await fetch(`${API}/admin/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    loadAlerts();
  };

  // ── Approval actions ────────────────────────────────────────
  const approveMeta = async (metaId: number) => {
    await fetch(`${API}/metadata/${metaId}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    setOpenApproval(null);
    loadApprovals();
  };
  const rejectMeta = async (metaId: number) => {
    const cat = rejectionCats.find(c => c.id === rejectCatId);
    const reason = rejectNote || (cat ? cat.label : '却下');
    await fetch(`${API}/metadata/${metaId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, rejectionCategoryId: rejectCatId }),
    });
    setOpenApproval(null);
    setRejectCatId(null);
    setRejectNote('');
    loadApprovals();
  };
  const batchGenerate = async () => {
    const ids = approvals.map(a => a.productId);
    if (!ids.length) return;
    setBatching(true);
    await fetch(`${API}/admin/metadata/batch-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: ids }),
    });
    setBatching(false);
    loadApprovals();
  };

  // ── Tag approval actions ────────────────────────────────────
  const approveTag = async (id: number) => {
    await fetch(`${API}/admin/tag-approval-queue/${id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    loadTagApprovals();
  };
  const rejectTag = async (id: number) => {
    await fetch(`${API}/admin/tag-approval-queue/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: '管理者が却下' }),
    });
    loadTagApprovals();
  };

  // ── Obsolescence actions ────────────────────────────────────
  const scanObsolescence = async () => {
    setScanning(true);
    await fetch(`${API}/admin/obsolescence-queue/scan`, { method: 'POST' });
    setScanning(false);
    loadObsolescence();
  };
  const processObsolescence = async (id: number, decision: 'approve_drop' | 'reject_drop') => {
    await fetch(`${API}/admin/obsolescence-queue/${id}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    loadObsolescence();
  };

  const openAlertCount    = alerts.filter(a => a.status === 'open').length;
  const pendingApprCount  = approvals.length;
  const pendingTagCount   = tagApprovals.filter(t => t.status === 'waiting' || t.status === 'in_review').length;
  const pendingObsCount   = obsolescence.filter(o => o.status === 'pending').length;

  const SUB_TABS: { key: Tab; label: string }[] = [
    { key: 'stats',        label: 'ダッシュボード' },
    { key: 'approval',     label: pendingApprCount > 0 ? `メタデータ承認 (${pendingApprCount})` : 'メタデータ承認' },
    { key: 'tagApproval',  label: pendingTagCount > 0 ? `タグ承認 (${pendingTagCount})` : 'タグ承認' },
    { key: 'obsolescence', label: pendingObsCount > 0 ? `廃止商品 (${pendingObsCount})` : '廃止商品' },
    { key: 'alerts',       label: openAlertCount > 0 ? `アラート (${openAlertCount})` : 'アラート' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2" style={{ fontFamily: 'Noto Serif JP, serif' }}>
            <TrendingUp className="w-6 h-6 text-amber-700" />
            管理ダッシュボード
          </h1>
          <p className="text-sm text-stone-500 mt-1">承認ワークフロー・廃止商品・ナレッジ・アラートの一元管理</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 border-b border-stone-200 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard ── */}
      {tab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '総商品数',       value: stats?.totalProducts ?? '—',      icon: <Gift className="w-5 h-5" />,        color: 'text-blue-600 bg-blue-50' },
              { label: '承認待ち',       value: stats?.pendingApprovals ?? '—',   icon: <Clock className="w-5 h-5" />,       color: 'text-amber-600 bg-amber-50' },
              { label: 'チャット数',     value: stats?.totalSessions ?? '—',      icon: <CheckCircle className="w-5 h-5" />, color: 'text-green-600 bg-green-50' },
              { label: '未解決アラート', value: stats?.openAlerts ?? '—',         icon: <ShieldCheck className="w-5 h-5" />, color: 'text-red-600 bg-red-50' },
            ].map(item => (
              <div key={item.label} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
                <div className={`w-10 h-10 rounded-full ${item.color} flex items-center justify-center mb-3`}>
                  {item.icon}
                </div>
                <div className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'Noto Serif JP, serif' }}>
                  {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                </div>
                <div className="text-sm text-stone-500">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Category bar chart */}
            {stats && stats.productsByCategory.length > 0 && (
              <CategoryDonut data={stats.productsByCategory} />
            )}

            {/* Approval pie (テキスト+割合表示) */}
            {stats && stats.metadataByApproval.length > 0 && (
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                <p className="text-sm font-medium text-stone-700 mb-4">メタデータ承認状況</p>
                <div className="flex gap-3">
                  {stats.metadataByApproval.map(m => {
                    const total = stats.metadataByApproval.reduce((s, x) => s + x.count, 0);
                    const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
                    const colors: Record<string, string> = {
                      approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                      pending:  'bg-amber-50 text-amber-700 border border-amber-200',
                      rejected: 'bg-red-50 text-red-700 border border-red-200',
                    };
                    const labels: Record<string, string> = { approved: '承認済', pending: '審査中', rejected: '却下' };
                    return (
                      <div key={m.status} className={`flex-1 rounded-xl p-3 text-center ${colors[m.status] || 'bg-stone-50 text-stone-600'}`}>
                        <p className="text-2xl font-bold" style={{ fontFamily: 'Noto Serif JP, serif' }}>{m.count}</p>
                        <p className="text-[10px] mt-1 opacity-70">{pct}%</p>
                        <p className="text-xs mt-0.5">{labels[m.status] || m.status}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-medium text-stone-700 mb-4">業務メニュー</p>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {[
                { key: 'approval'     as Tab, label: 'メタデータ承認',  desc: 'AIコメントの承認・却下', icon: <CheckCircle2 className="w-4 h-4" /> },
                { key: 'tagApproval'  as Tab, label: '贈答タグ承認',    desc: 'シーン適合・属性フラグの確認', icon: <Tag className="w-4 h-4" /> },
                { key: 'obsolescence' as Tab, label: '廃止商品キュー',  desc: '在庫切れ・季節終了の処理', icon: <FileWarning className="w-4 h-4" /> },
                { key: 'alerts'       as Tab, label: 'チャットアラート', desc: '失言検知・トーン違反の確認', icon: <ShieldCheck className="w-4 h-4" /> },
                { key: 'stats'        as Tab, label: '統計ダッシュボード', desc: '商品・承認・チャット概況', icon: <Layers className="w-4 h-4" /> },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => setTab(item.key)}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-stone-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-800">{item.label}</div>
                    <div className="text-xs text-stone-400">{item.desc}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-400" />
                </button>
              ))}
            </div>
          </div>

          {!stats && (
            <div className="flex justify-center py-20">
              <span className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* ── Metadata Approval Queue ── */}
      {tab === 'approval' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-500">
              優先度の高い順に表示しています。承認するとチャットの提案コメントとして使用されます。
            </p>
            <button
              onClick={batchGenerate}
              disabled={batching || approvals.length === 0}
              className="flex items-center gap-1.5 text-xs bg-stone-800 hover:bg-stone-900 disabled:opacity-50 text-white rounded-xl px-3 py-1.5 transition-colors"
            >
              {batching ? (
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              全件再生成
            </button>
          </div>

          {approvals.length === 0 && (
            <div className="py-16 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-stone-200" />
              <p className="text-sm text-stone-400">承認待ちはありません</p>
            </div>
          )}

          {approvals.map(a => {
            const open = openApproval === a.queueId;
            const conf = a.confidenceScore ?? 0;
            const confColor = conf >= 75 ? 'text-emerald-600' : conf >= 60 ? 'text-amber-600' : 'text-red-600';
            return (
              <div key={a.queueId} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => { setOpenApproval(open ? null : a.queueId); setRejectCatId(null); setRejectNote(''); }}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-stone-50 transition-colors text-left"
                >
                  {a.imageUrl ? (
                    <img src={a.imageUrl.startsWith('/uploads/') ? `${API}${a.imageUrl}` : a.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-stone-100" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-stone-100 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">優先 {a.priority}</span>
                      <span className="text-[10px] bg-stone-50 text-stone-500 border border-stone-200 px-1.5 py-0.5 rounded">{a.attemptNo}回目</span>
                      <span className={`text-xs font-medium ${confColor}`}>信頼 {conf}</span>
                      {a.submitterName && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${SUBMITTER_BADGE[a.submitterRole || ''] || 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                          {SUBMITTER_LABEL[a.submitterRole || ''] || ''} {a.submitterName} 提出
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-stone-800 truncate">{a.productName}</p>
                    <p className="text-[11px] text-stone-400 truncate">{a.brand} · ¥{a.price.toLocaleString()} · {a.category}</p>
                  </div>
                  {open ? <ChevronUp className="w-4 h-4 text-stone-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />}
                </button>

                {open && (
                  <div className="px-4 pb-4 border-t border-stone-100 bg-stone-50/50 space-y-3 pt-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg border border-rose-100 p-3">
                        <p className="text-[10px] tracking-wider text-rose-600 font-semibold mb-1">SENSORY ◇ 感性視点</p>
                        <p className="text-xs text-stone-700 whitespace-pre-line leading-relaxed">{a.sensoryComment || '—'}</p>
                      </div>
                      <div className="bg-white rounded-lg border border-blue-100 p-3">
                        <p className="text-[10px] tracking-wider text-blue-600 font-semibold mb-1">EXPERIENCE ◇ 経験知</p>
                        <p className="text-xs text-stone-700 whitespace-pre-line leading-relaxed">{a.experienceComment || '—'}</p>
                      </div>
                    </div>

                    {/* Rejection picker */}
                    <div className="bg-white rounded-lg border border-stone-200 p-3 space-y-2">
                      <p className="text-[11px] text-stone-500 font-medium">却下する場合は理由を選択（任意）</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rejectionCats.map(c => (
                          <button
                            key={c.id}
                            onClick={() => setRejectCatId(rejectCatId === c.id ? null : c.id)}
                            className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                              rejectCatId === c.id
                                ? 'bg-red-100 text-red-700 border-red-300'
                                : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-red-200'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={rejectNote}
                        onChange={e => setRejectNote(e.target.value)}
                        rows={2}
                        placeholder="自由記述コメント（任意）"
                        className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => approveMeta(a.metaId)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />承認する
                      </button>
                      <button
                        onClick={() => rejectMeta(a.metaId)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg py-2 transition-colors"
                      >
                        <X className="w-4 h-4" />却下する
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tag Approval Queue ── */}
      {tab === 'tagApproval' && (
        <div className="space-y-3">
          <p className="text-xs text-stone-500">
            AIまたは担当者が提案した「贈答タグ」（シーン適合度・受け手属性・属性フラグ）の承認を行います。
          </p>

          {tagApprovals.length === 0 && (
            <div className="py-16 text-center">
              <Tag className="w-12 h-12 mx-auto mb-3 text-stone-200" />
              <p className="text-sm text-stone-400">タグ承認待ちはありません</p>
            </div>
          )}

          {tagApprovals.map(t => (
            <div key={t.id} className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                {t.imageUrl ? (
                  <img src={t.imageUrl.startsWith('/uploads/') ? `${API}${t.imageUrl}` : t.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-stone-100" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-stone-100 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{t.productName}</p>
                  <p className="text-[11px] text-stone-400">
                    {t.brand} · {t.source === 'ai' ? 'AI提案' : '手動'} · {t.submitterName ?? '—'} · {t.submittedAt.slice(0, 16)}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  t.status === 'completed'
                    ? t.action === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {t.status === 'completed' ? (t.action === 'approved' ? '承認済' : '却下') : '審査中'}
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-2 mb-3">
                <TagBlock title="シーン" entries={Object.entries(t.payload.sceneCompatibility ?? {})} />
                <TagBlock title="受け手" entries={Object.entries(t.payload.audienceCompatibility ?? {})} />
                <div className="bg-stone-50 rounded-lg p-2">
                  <p className="text-[10px] text-stone-500 mb-1">属性フラグ</p>
                  <div className="flex flex-wrap gap-1">
                    {(t.payload.attributeFlags ?? []).length === 0 && <span className="text-[11px] text-stone-300">—</span>}
                    {(t.payload.attributeFlags ?? []).map(f => (
                      <span key={f} className="text-[10px] bg-white border border-stone-200 text-stone-600 px-1.5 py-0.5 rounded">{tagLabel(f)}</span>
                    ))}
                  </div>
                </div>
              </div>

              {t.status !== 'completed' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveTag(t.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-1.5 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />承認
                  </button>
                  <button
                    onClick={() => rejectTag(t.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg py-1.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />却下
                  </button>
                </div>
              )}
              {t.notes && <p className="text-[11px] text-stone-400 mt-2">メモ: {t.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Obsolescence Queue ── */}
      {tab === 'obsolescence' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-500">
              在庫切れ・季節終了の商品を検出し、廃止判断を行います。承認すると商品マスタからも除外されます。
            </p>
            <button
              onClick={scanObsolescence}
              disabled={scanning}
              className="flex items-center gap-1.5 text-xs bg-stone-800 hover:bg-stone-900 disabled:opacity-50 text-white rounded-xl px-3 py-1.5 transition-colors"
            >
              {scanning ? (
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              スキャン実行
            </button>
          </div>

          {obsolescence.length === 0 && (
            <div className="py-16 text-center">
              <FileWarning className="w-12 h-12 mx-auto mb-3 text-stone-200" />
              <p className="text-sm text-stone-400">廃止候補はありません</p>
            </div>
          )}

          {obsolescence.map(o => (
            <div key={o.id} className={`bg-white border border-stone-200 rounded-xl p-4 ${o.status !== 'pending' ? 'opacity-70' : ''}`}>
              <div className="flex items-start gap-3 mb-3">
                {o.imageUrl ? (
                  <img src={o.imageUrl.startsWith('/uploads/') ? `${API}${o.imageUrl}` : o.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-stone-100" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-stone-100 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{o.productName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">{REASON_LABELS[o.reason] || o.reason}</span>
                    {o.seasonTag && <span className="text-[10px] bg-stone-50 text-stone-500 border border-stone-200 px-1.5 py-0.5 rounded">{o.seasonTag}</span>}
                    {o.stockStatus && <span className="text-[10px] bg-stone-50 text-stone-500 border border-stone-200 px-1.5 py-0.5 rounded">{o.stockStatus}</span>}
                  </div>
                  {o.notes && <p className="text-[11px] text-stone-500 mt-1.5">{o.notes}</p>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  o.status === 'pending'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : o.status === 'approved_drop'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-stone-50 text-stone-500 border border-stone-200'
                }`}>
                  {o.status === 'pending' ? '判断待ち' : o.status === 'approved_drop' ? '廃止' : '却下'}
                </span>
              </div>

              {o.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => processObsolescence(o.id, 'approve_drop')}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg py-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />廃止する
                  </button>
                  <button
                    onClick={() => processObsolescence(o.id, 'reject_drop')}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg py-1.5 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />継続販売
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Alerts ── */}
      {tab === 'alerts' && (
        <div className="space-y-2">
          {alerts.length === 0 && (
            <div className="py-16 text-center">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-stone-200" />
              <p className="text-sm text-stone-400">アラートはありません</p>
            </div>
          )}
          {alerts.map(a => (
            <div
              key={a.id}
              className={`bg-white border rounded-xl px-4 py-3 flex items-start gap-3 ${
                a.status === 'open' ? 'border-stone-200' : 'border-stone-100 opacity-60'
              }`}
            >
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 font-medium ${SEVERITY_COLORS[a.severity] || 'bg-stone-100 text-stone-500'}`}>
                {a.severity}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800">{a.ruleLabel}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {a.category} · {a.occasion ? `${a.occasion} · ` : ''}{a.createdAt.slice(0, 10)}
                </p>
                {a.evidence && <p className="text-xs text-stone-500 mt-1 truncate">{a.evidence}</p>}
              </div>
              {a.status === 'open' && (
                <button
                  onClick={() => resolveAlert(a.id)}
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <CheckCircle className="w-3 h-3" />解決
                </button>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// ── カテゴリ別商品数 ドーナツ円グラフ（純SVG・依存ライブラリなし） ──────
function CategoryDonut({ data }: { data: { category: string; count: number }[] }) {
  const PALETTE = ['#d97706', '#dc2626', '#2563eb', '#059669', '#7c3aed', '#db2777', '#65a30d', '#0891b2'];
  const total = data.reduce((s, x) => s + x.count, 0);
  const cx = 80, cy = 80, r = 56, sw = 22;
  const C = 2 * Math.PI * r;
  let cumulative = 0;
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
      <p className="text-sm font-medium text-stone-700 mb-4">カテゴリ別商品数</p>
      <div className="flex items-center gap-6">
        {/* ドーナツ */}
        <svg width={160} height={160} viewBox="0 0 160 160" className="flex-shrink-0">
          {/* 背景リング */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f5f5f4" strokeWidth={sw} />
          {data.map((d, i) => {
            const portion = total > 0 ? d.count / total : 0;
            const len = portion * C;
            const seg = (
              <circle
                key={d.category || i}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={sw}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-cumulative}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
            cumulative += len;
            return seg;
          })}
          {/* 中央に合計 */}
          <text x={cx} y={cy - 4} textAnchor="middle" className="fill-stone-800" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Noto Serif JP, serif' }}>
            {total}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" className="fill-stone-400" style={{ fontSize: 10 }}>
            商品
          </text>
        </svg>

        {/* 凡例 */}
        <ul className="flex-1 space-y-1.5 min-w-0">
          {data.map((d, i) => {
            const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
            return (
              <li key={d.category || i} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                <span className="flex-1 text-stone-700 truncate">{d.category || '未分類'}</span>
                <span className="text-stone-400 tabular-nums">{pct}%</span>
                <span className="text-stone-500 font-medium tabular-nums w-5 text-right">{d.count}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function TagBlock({ title, entries }: { title: string; entries: [string, number][] }) {
  return (
    <div className="bg-stone-50 rounded-lg p-2">
      <p className="text-[10px] text-stone-500 mb-1">{title}</p>
      <div className="flex flex-wrap gap-1">
        {entries.length === 0 && <span className="text-[11px] text-stone-300">—</span>}
        {entries.map(([k, v]) => (
          <span key={k} className="text-[10px] bg-white border border-stone-200 text-stone-600 px-1.5 py-0.5 rounded">
            {tagLabel(k)} <span className="text-amber-700 font-semibold">{Math.round((v ?? 0) * 100)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
