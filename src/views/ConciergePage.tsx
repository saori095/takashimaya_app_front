'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save, Camera, Eye, Award, User, UserX, Upload, X,
  CheckCircle, CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react';

// 実行時に現在のページ origin から API base を導出する。
// localhost ↔ 127.0.0.1 のように別サイト扱いになる場合の SameSite=Lax Cookie 喪失を防ぐ目的。
const API = process.env.NEXT_PUBLIC_API_BASE
  ?? (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000');

type User = { id: number; role: string; displayName: string };

type Profile = {
  displayName: string;
  anonymousLabel: string;
  bio: string;
  avatarUrl: string | null;
  yearsExperience: number;
  ageGroup: string;
  expertiseViewpoint: string;
  specialties: string[];
};

type ApprovalItem = {
  queueId: number;
  priority: number;
  metaId: number;
  approvalStatus: string;
  sensoryComment: string | null;
  experienceComment: string | null;
  confidenceScore: number | null;
  attemptNo: number;
  productId: number;
  productName: string;
  imageUrl?: string | null;
  brand?: string | null;
  category?: string | null;
  price: number;
  submittedBy?: number | null;
  submitterName?: string | null;
  submitterRole?: string | null;
  submitterAvatar?: string | null;
};

const ROLE_BADGE: Record<string, string> = {
  admin:            'bg-rose-50 text-rose-700 border-rose-200',
  concierge_senior: 'bg-amber-50 text-amber-700 border-amber-200',
  concierge_junior: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const ROLE_SHORT: Record<string, string> = {
  admin:            '管理者',
  concierge_senior: 'シニア',
  concierge_junior: 'ジュニア',
};

type RejectionCategory = {
  id: number;
  code: string;
  label: string;
  promptHint: string;
};

type HistoryItem = {
  id: number;
  productId: number;
  productName?: string | null;
  metaId: number;
  action: string;
  approverName?: string | null;
  approverRole?: string | null;
  rejectionLabel?: string | null;
  notes?: string | null;
  createdAt: string;
};

const SPECIALTY_OPTIONS = [
  '和菓子', '洋菓子', '食品全般', 'ファッション',
  '雑貨', 'お中元', 'お歳暮', '慶事', '弔事', 'ビジネスギフト',
];

const ANON_PRESETS = [
  '贈答の専門家（匿名）', 'ギフトアドバイザー（匿名）',
  '贈り物コンシェルジュ（匿名）', '高島屋専門スタッフ（匿名）',
];

const VIEWPOINT_OPTIONS = [
  { value: 'sensory',    label: '感性の専門家',   desc: '目利き・素材・産地の感性視点を承認' },
  { value: 'experience', label: '経験知の専門家',  desc: '販売実績・成功事例の経験知視点を承認' },
  { value: 'both',       label: '両視点',          desc: '両方の視点を承認可能' },
];

type Tab = 'profile' | 'queue' | 'history';

export default function ConciergePage({ me }: { me: User }) {
  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<Profile>({
    displayName: '',
    anonymousLabel: '贈答の専門家（匿名）',
    bio: '',
    avatarUrl: null,
    yearsExperience: 0,
    ageGroup: '30代',
    expertiseViewpoint: 'both',
    specialties: [],
  });
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 承認キュー / 履歴タブ用ステート
  const [queue, setQueue] = useState<ApprovalItem[]>([]);
  const [rejectionCats, setRejectionCats] = useState<RejectionCategory[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [openQueueId, setOpenQueueId] = useState<number | null>(null);
  const [rejectCatId, setRejectCatId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    // me 切替時に前ユーザーの残骸を消してから fetch
    setPreviewSrc(null);
    fetch(`${API}/concierge/profile`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (!data || !data.id) {
          // concierge_profile が無いユーザー(admin等) → 空のまま表示
          setProfile(p => ({ ...p, displayName: me.displayName || '', avatarUrl: null }));
          return;
        }
        const sp = typeof data.specialties === 'string'
          ? (() => { try { return JSON.parse(data.specialties); } catch { return []; } })()
          : (data.specialties || []);
        setProfile({
          displayName: data.displayName || '',
          anonymousLabel: data.anonymousLabel || '贈答の専門家（匿名）',
          bio: data.bio || '',
          avatarUrl: data.avatarUrl || null,
          yearsExperience: data.yearsExperience || 0,
          ageGroup: data.ageGroup || '30代',
          expertiseViewpoint: data.expertiseViewpoint || 'both',
          specialties: sp,
        });
        if (data.avatarUrl) setPreviewSrc(data.avatarUrl);
      })
      .catch(err => console.error('concierge/profile fetch failed', err));
    return () => { cancelled = true; };
  }, [me.id, me.displayName]);

  useEffect(() => {
    // 配列を期待する API。401 や 403 が返ると {detail: "..."} になり .map() で落ちるため、
    // Array.isArray でガードして空配列にフォールバック
    const safeArr = <T,>(setter: (v: T[]) => void) => (data: unknown) =>
      setter(Array.isArray(data) ? (data as T[]) : []);
    if (tab === 'queue') {
      fetch(`${API}/admin/approval-queue`).then(r => r.json()).then(safeArr(setQueue)).catch(() => setQueue([]));
      fetch(`${API}/admin/rejection-categories`).then(r => r.json()).then(safeArr(setRejectionCats)).catch(() => setRejectionCats([]));
    }
    if (tab === 'history') {
      fetch(`${API}/admin/approval-history`).then(r => r.json()).then(safeArr(setHistory)).catch(() => setHistory([]));
    }
  }, [tab]);

  const approveMeta = async (metaId: number) => {
    await fetch(`${API}/metadata/${metaId}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    setOpenQueueId(null);
    fetch(`${API}/admin/approval-queue`).then(r => r.json()).then(setQueue);
  };
  const rejectMeta = async (metaId: number) => {
    const cat = rejectionCats.find(c => c.id === rejectCatId);
    const reason = rejectNote || (cat ? cat.label : '却下');
    await fetch(`${API}/metadata/${metaId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, rejectionCategoryId: rejectCatId }),
    });
    setOpenQueueId(null);
    setRejectCatId(null);
    setRejectNote('');
    fetch(`${API}/admin/approval-queue`).then(r => r.json()).then(setQueue);
  };

  const set = (k: keyof Profile, v: any) => setProfile(prev => ({ ...prev, [k]: v }));

  const toggleSpecialty = (s: string) =>
    set('specialties', profile.specialties.includes(s)
      ? profile.specialties.filter(x => x !== s)
      : [...profile.specialties, s]);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const objectUrl = URL.createObjectURL(file);
    setPreviewSrc(objectUrl);
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`${API}/upload`, { method: 'POST', body: fd });
      const { url } = await r.json();
      set('avatarUrl', url);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) uploadFile(f);
  }, [uploadFile]);

  const removeAvatar = () => {
    setPreviewSrc(null);
    set('avatarUrl', null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const save = async () => {
    setSaving(true);
    await fetch(`${API}/concierge/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const roleLabel = profile.yearsExperience >= 10 ? 'Senior Concierge'
    : profile.yearsExperience >= 5 ? 'Concierge' : 'Junior Concierge';

  const pendingCount = queue.length;
  const TABS: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'プロフィール' },
    { key: 'queue',   label: pendingCount > 0 ? `承認キュー (${pendingCount})` : '承認キュー' },
    { key: 'history', label: '承認履歴' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-12">
      <div className="mb-4">
        <p className="text-[11px] tracking-[0.3em] text-stone-500 font-medium">CONCIERGE</p>
        <h1 className="text-xl font-bold text-stone-900">コンシェルジュ業務</h1>
        <p className="text-xs text-stone-500 mt-1">プロフィール編集・AI生成コメントの承認・履歴確認を行います。</p>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-5 border-b border-stone-200 overflow-x-auto">
        {TABS.map(t => (
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

      {/* ── 承認キュータブ ───────────────────────────────────────────── */}
      {tab === 'queue' && (
        <div className="space-y-3 max-w-2xl">
          <p className="text-xs text-stone-500">
            AIが生成した「感性視点・経験知視点」のコメントを確認し、承認または却下してください。
            承認すると以後のチャット提案で使用されます。
          </p>
          {queue.length === 0 && (
            <div className="py-16 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-stone-200" />
              <p className="text-sm text-stone-400">承認待ちはありません</p>
            </div>
          )}
          {queue.map(a => {
            const open = openQueueId === a.queueId;
            const conf = a.confidenceScore ?? 0;
            const confColor = conf >= 75 ? 'text-emerald-600' : conf >= 60 ? 'text-amber-600' : 'text-red-600';
            return (
              <div key={a.queueId} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => { setOpenQueueId(open ? null : a.queueId); setRejectCatId(null); setRejectNote(''); }}
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
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${ROLE_BADGE[a.submitterRole || ''] || 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                          {ROLE_SHORT[a.submitterRole || ''] || ''} {a.submitterName} 提出
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

      {/* ── 承認履歴タブ ─────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-2 max-w-2xl">
          {history.length === 0 && (
            <div className="py-16 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-stone-200" />
              <p className="text-sm text-stone-400">承認履歴はまだありません</p>
            </div>
          )}
          {history.map(h => (
            <div key={h.id} className="bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                h.action === 'approved'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : h.action === 'rejected'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-stone-50 text-stone-600 border border-stone-200'
              }`}>
                {h.action === 'approved' ? '承認' : h.action === 'rejected' ? '却下' : h.action}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 truncate">{h.productName ?? `#${h.productId}`}</p>
                <p className="text-[11px] text-stone-400 truncate">
                  {h.approverName ?? '—'} · {h.approverRole ?? ''}
                  {h.rejectionLabel && <span className="text-red-500"> · {h.rejectionLabel}</span>}
                </p>
              </div>
              <span className="text-[10px] text-stone-400 flex-shrink-0">{h.createdAt.slice(0, 16)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── プロフィール編集タブ ─────────────────────────────────────── */}
      {tab === 'profile' && (
      <div className="max-w-2xl">

      {/* ── プレビューカード ─────────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden mb-4 shadow-sm">
        <div className="relative bg-stone-100 flex items-center justify-center" style={{ minHeight: '280px', maxHeight: '420px' }}>
          {previewSrc ? (
            <img src={previewSrc} alt={profile.displayName || 'プロフィール'} className="w-full h-auto max-h-[420px] object-contain" />
          ) : (
            <div className="w-full h-[280px] flex items-center justify-center bg-gradient-to-br from-amber-50 to-rose-50">
              <User className="w-20 h-20 text-stone-300" />
            </div>
          )}
          {/* CERTIFIED badge */}
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm border border-stone-200 p-2.5 w-32">
            <div className="flex items-center gap-1 text-rose-700 text-[9px] font-bold mb-1">
              <span className="w-3 h-3 text-rose-700">✓</span> CERTIFIED
            </div>
            <div className="border-t border-stone-200 pt-1.5">
              <p className="text-2xl font-bold text-stone-900 leading-none">
                {profile.yearsExperience || '—'}
                <span className="text-xs ml-0.5 font-normal text-stone-500">年</span>
              </p>
              <p className="text-[8px] text-stone-500 tracking-wider mt-0.5">YEARS OF SERVICE</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="text-[10px] tracking-widest text-stone-500 font-semibold">{roleLabel.toUpperCase()}</p>
          <h2 className="text-xl font-bold text-stone-900">{profile.displayName || '（表示名未設定）'}</h2>
          {profile.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {profile.specialties.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                  <Award className="w-3 h-3" />{s}
                </span>
              ))}
            </div>
          )}
          {profile.bio && (
            <p className="text-xs leading-relaxed text-stone-600 mt-3 line-clamp-3">「{profile.bio}」</p>
          )}
        </div>
      </div>

      <p className="text-[10px] tracking-[0.25em] text-stone-500 font-semibold mb-2 mt-6">EDIT</p>

      <div className="space-y-3">
        {/* ── プロフィール画像 ───────────────────────────────────────── */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs tracking-widest text-stone-500 font-semibold flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> PROFILE IMAGE
            </p>
          </div>
          <div className="px-4 pb-4">
            <div className="flex items-start gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-stone-200 bg-stone-100 flex items-center justify-center">
                  {previewSrc
                    ? <img src={previewSrc} alt="プロフィール画像" className="w-full h-full object-cover" />
                    : <User className="w-10 h-10 text-stone-300" />}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                      <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {previewSrc && !uploading && (
                  <button
                    onClick={removeAvatar}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 min-h-[96px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all select-none ${
                  isDragging
                    ? 'border-amber-500 bg-amber-50 scale-[1.02]'
                    : 'border-stone-300 hover:border-amber-400 hover:bg-stone-50'
                }`}
              >
                <Upload className={`w-6 h-6 ${isDragging ? 'text-amber-600' : 'text-stone-400'}`} />
                <p className="text-sm font-medium text-stone-700 text-center leading-snug">
                  {isDragging ? 'ここにドロップ' : 'ドラッグ＆ドロップ'}
                </p>
                <p className="text-xs text-stone-500">またはクリックして選択</p>
                <p className="text-xs text-stone-400">JPEG・PNG・WebP（最大5MB）</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
            </div>
          </div>
        </div>

        {/* ── 表示名 ───────────────────────────────────────────────── */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs tracking-widest text-stone-500 font-semibold flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> DISPLAY NAME
            </p>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">表示名（個人帰属時）</label>
              <input
                value={profile.displayName}
                onChange={e => set('displayName', e.target.value)}
                placeholder="例: 田中 花子"
                className="w-full h-9 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
              <p className="text-xs text-stone-500 mt-1">「個人帰属」で承認した際にお客様に表示される名前です</p>
            </div>
            <div>
              <label className="text-xs text-stone-500 mb-1 block">経験年数</label>
              <input
                type="number"
                value={profile.yearsExperience}
                onChange={e => set('yearsExperience', parseInt(e.target.value) || 0)}
                min={0} max={50}
                className="w-24 h-9 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
              <p className="text-xs text-stone-500 mt-1">プロフィール画面の「YEARS OF SERVICE」バッジに反映されます</p>
            </div>
          </div>
        </div>

        {/* ── 匿名ラベル ────────────────────────────────────────────── */}
        <div className="bg-white border border-purple-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <p className="text-sm font-semibold text-purple-700 flex items-center gap-2">
              <UserX className="w-4 h-4" /> 役割帰属（匿名）時のラベル
            </p>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <div>
              <label className="text-xs text-stone-500 mb-1 block">匿名ラベル</label>
              <input
                value={profile.anonymousLabel}
                onChange={e => set('anonymousLabel', e.target.value)}
                placeholder="例: 贈答の専門家（匿名）"
                className="w-full h-9 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              />
              <p className="text-xs text-stone-500 mt-1">個人を特定できない表現を使用してください</p>
            </div>
            {/* 匿名プレビュー */}
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
              <p className="text-xs font-medium text-purple-700 mb-1">プレビュー</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center overflow-hidden">
                  {previewSrc
                    ? <img src={previewSrc} alt="" className="w-full h-full object-cover opacity-50 grayscale" />
                    : <UserX className="w-4 h-4 text-purple-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-800">{profile.anonymousLabel || '贈答の専門家（匿名）'}</p>
                  <p className="text-xs text-purple-600">高島屋コンシェルジュ</p>
                </div>
              </div>
            </div>
            {/* プリセット */}
            <div>
              <p className="text-xs font-medium text-stone-500 mb-2">推奨ラベル例</p>
              <div className="flex flex-wrap gap-1.5">
                {ANON_PRESETS.map(label => (
                  <button
                    key={label}
                    onClick={() => set('anonymousLabel', label)}
                    className="text-xs h-7 px-3 border border-stone-200 text-stone-600 hover:border-stone-400 rounded-lg transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 承認視点 ──────────────────────────────────────────────── */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <p className="text-sm font-semibold text-stone-800">承認視点（コメント分業）</p>
          </div>
          <div className="px-4 pb-4">
            <p className="text-xs text-stone-500 mb-3">AI生成された2視点コメントのうち、ご自身が承認できる視点を選択してください。</p>
            <div className="grid grid-cols-3 gap-2">
              {VIEWPOINT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => set('expertiseViewpoint', opt.value)}
                  className={`text-left p-2.5 rounded-lg border-2 transition-all ${
                    profile.expertiseViewpoint === opt.value
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-stone-200 bg-white hover:border-amber-300'
                  }`}
                >
                  <p className={`text-xs font-semibold mb-0.5 ${profile.expertiseViewpoint === opt.value ? 'text-amber-700' : 'text-stone-700'}`}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] leading-tight text-stone-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 専門分野 ──────────────────────────────────────────────── */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <p className="text-sm font-semibold text-stone-800">専門分野</p>
          </div>
          <div className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSpecialty(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    profile.specialties.includes(s)
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-amber-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 自己紹介 ──────────────────────────────────────────────── */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-1">
            <p className="text-sm font-semibold text-stone-800">自己紹介</p>
          </div>
          <div className="px-4 pb-4">
            <textarea
              value={profile.bio}
              onChange={e => set('bio', e.target.value)}
              placeholder="贈答に関する専門知識や経験をご記入ください（500文字以内）"
              maxLength={500}
              rows={4}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white resize-none"
            />
            <p className="text-xs text-stone-400 mt-1 text-right">{profile.bio.length}/500</p>
          </div>
        </div>

        {/* ── 保存ボタン ──────────────────────────────────────────────── */}
        <button
          onClick={save}
          disabled={saving || !profile.displayName.trim() || uploading}
          className={`w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-amber-700 hover:bg-amber-800 disabled:bg-stone-200 disabled:text-stone-400 text-white'
          }`}
        >
          {saving
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Save className="w-4 h-4" />}
          {saved ? 'プロフィールを保存しました' : 'プロフィールを保存'}
        </button>
      </div>
      </div>
      )}
    </div>
  );
}
