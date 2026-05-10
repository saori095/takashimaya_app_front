'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Tag, CheckCircle, XCircle, ChevronDown, Gift, Search } from 'lucide-react';

// 実行時に現在のページ origin から API base を導出する。
// localhost ↔ 127.0.0.1 のように別サイト扱いになる場合の SameSite=Lax Cookie 喪失を防ぐ目的。
const API = process.env.NEXT_PUBLIC_API_BASE
  ?? (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000');

// takashimaya GiftTagEditor.tsx 由来の日本語ラベル辞書
const GIFT_SCENES: { key: string; label: string }[] = [
  { key: 'wedding',       label: '結婚祝い' },
  { key: 'baby',          label: '出産祝い' },
  { key: 'longevity',     label: '長寿祝い' },
  { key: 'promotion',     label: '昇進祝い' },
  { key: 'retirement',    label: '退職祝い' },
  { key: 'housewarming',  label: '新築祝い' },
  { key: 'birthday',      label: '誕生日' },
  { key: 'thanks',        label: '御礼・感謝' },
  { key: 'ochugen',       label: 'お中元' },
  { key: 'oseibo',        label: 'お歳暮' },
  { key: 'condolence',    label: 'お悔やみ' },
  { key: 'funeral_visit', label: '法要・お参り' },
  { key: 'long_distance', label: '遠方贈答' },
];

const SCENE_LEVELS: { value: number; label: string; cls: string }[] = [
  { value: 100, label: '強く推奨', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 80,  label: '推奨',     cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 50,  label: '標準',     cls: 'bg-stone-100 text-stone-700 border-stone-300' },
  { value: 0,   label: '不向き',   cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: -1,  label: 'NG',       cls: 'bg-rose-100 text-rose-800 border-rose-300' },
];

const AUDIENCE_OPTIONS: { key: string; label: string }[] = [
  { key: 'young_family', label: '若いご家族' },
  { key: 'elderly',      label: 'ご年配' },
  { key: 'business',     label: 'ビジネス' },
  { key: 'casual',       label: 'カジュアル' },
  { key: 'student',      label: '学生・若手' },
];

const ATTRIBUTE_FLAG_OPTIONS: { key: string; label: string }[] = [
  { key: 'alcohol',                 label: 'アルコール含有' },
  { key: 'perishable',              label: '生もの・要冷蔵' },
  { key: 'requires_refrigeration',  label: '要冷蔵' },
  { key: 'individually_wrapped',    label: '個包装あり' },
  { key: 'formal_packaging',        label: '桐箱・風呂敷など格式包装' },
  { key: 'name_engravable',         label: '名入れ・刻印可' },
  { key: 'organic',                 label: 'オーガニック・無添加' },
  { key: 'premium_japan_origin',    label: '国産プレミアム' },
  { key: 'long_shelf_life',         label: '賞味期限長め' },
  { key: 'fragrance',               label: '香りもの' },
  { key: 'kids_safe',               label: '子供向け安全配慮' },
];

function nearestSceneLevel(value: number | undefined | null): number {
  if (value === undefined || value === null) return 50;
  if (value < 0) return -1;
  if (value <= 25) return 0;
  if (value <= 60) return 50;
  if (value <= 90) return 80;
  return 100;
}

type Product = {
  id: number;
  name: string;
  price: number;
  category?: string;
  brand?: string;
  imageUrl?: string;
  stockStatus?: string;
  isActive: boolean;
  metaId?: number;
  approvalStatus?: string;
  sensoryComment?: string;
  experienceComment?: string;
  confidenceScore?: number;
};

const STOCK_LABELS: Record<string, string> = {
  in_stock: '在庫あり', low_stock: '残りわずか', out_of_stock: '在庫なし',
};
const STOCK_COLORS: Record<string, string> = {
  in_stock:    'text-green-700 bg-green-50 border border-green-200',
  low_stock:   'text-amber-700 bg-amber-50 border border-amber-200',
  out_of_stock:'text-red-700 bg-red-50 border border-red-200',
};
const APPROVAL_COLORS: Record<string, string> = {
  approved: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  pending:  'text-amber-700 bg-amber-50 border border-amber-200',
  rejected: 'text-red-700 bg-red-50 border border-red-200',
};
const APPROVAL_LABELS: Record<string, string> = {
  approved: '承認済', pending: '審査中', rejected: '却下',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [tagResult, setTagResult] = useState<Record<number, any>>({});
  const [rejectReason, setRejectReason] = useState('');

  const load = () =>
    fetch(`${API}/products`).then(r => r.json()).then(setProducts);

  useEffect(() => { load(); }, []);

  const generateMeta = async (id: number) => {
    setLoadingId(id);
    await fetch(`${API}/products/${id}/metadata/generate`, { method: 'POST' });
    await load();
    setLoadingId(null);
    setOpenId(id);
  };

  const approve = async (metaId: number) => {
    await fetch(`${API}/metadata/${metaId}/approve`, { method: 'POST' });
    await load();
  };

  const reject = async (metaId: number) => {
    const reason = rejectReason.trim() || '品質基準未達';
    await fetch(`${API}/metadata/${metaId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    setRejectReason('');
    await load();
  };

  const suggestTags = async (id: number) => {
    setLoadingId(id);
    const r = await fetch(`${API}/products/${id}/tags/suggest`, { method: 'POST' });
    const data = await r.json();
    setTagResult(prev => ({
      ...prev,
      [id]: {
        sceneCompatibility:    data.sceneCompatibility    || {},
        audienceCompatibility: data.audienceCompatibility || {},
        attributeFlags:        data.attributeFlags        || [],
      },
    }));
    setLoadingId(null);
  };

  const setTagField = (id: number, key: 'sceneCompatibility' | 'audienceCompatibility' | 'attributeFlags', value: any) =>
    setTagResult(prev => ({ ...prev, [id]: { ...prev[id], [key]: value } }));

  const setSceneLevel = (id: number, sceneKey: string, level: number) =>
    setTagField(id, 'sceneCompatibility', { ...(tagResult[id]?.sceneCompatibility || {}), [sceneKey]: level });

  const setAudienceValue = (id: number, audKey: string, value: string) => {
    const next = { ...(tagResult[id]?.audienceCompatibility || {}) };
    if (value === '') delete next[audKey];
    else next[audKey] = parseInt(value, 10) || 0;
    setTagField(id, 'audienceCompatibility', next);
  };

  const toggleFlag = (id: number, flagKey: string) => {
    const cur: string[] = tagResult[id]?.attributeFlags || [];
    setTagField(id, 'attributeFlags', cur.includes(flagKey) ? cur.filter(x => x !== flagKey) : [...cur, flagKey]);
  };

  const submitTagsForApproval = async (id: number) => {
    const tags = tagResult[id];
    if (!tags) return;
    await fetch(`${API}/products/${id}/tags/submit-for-approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneCompatibility:    tags.sceneCompatibility,
        audienceCompatibility: tags.audienceCompatibility,
        attributeFlags:        tags.attributeFlags,
        source: 'ai',
      }),
    });
    setTagResult(prev => { const n = { ...prev }; delete n[id]; return n; });
    await load();
  };

  const cancelTags = (id: number) =>
    setTagResult(prev => { const n = { ...prev }; delete n[id]; return n; });

  const filtered = products.filter(p =>
    search === '' || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">商品管理</h1>
          <p className="text-sm text-stone-500 mt-1">商品のメタデータ生成・承認・タグ管理</p>
        </div>
        <span className="text-sm text-stone-500 border border-stone-200 px-3 py-1 rounded-full">
          {products.length}件
        </span>
      </div>

      {/* 検索 */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="商品名で検索…"
          className="w-full h-10 pl-9 pr-4 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        />
      </div>

      {/* 商品テーブル */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
        {filtered.map((p, idx) => {
          const isOpen = openId === p.id;
          const tags = tagResult[p.id];
          const isLoading = loadingId === p.id;
          return (
            <div key={p.id} className={`${idx > 0 ? 'border-t border-stone-100' : ''} ${!p.approvalStatus ? 'bg-amber-50/40' : ''}`}>
              {/* Product row */}
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="w-16 h-16 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    : <Gift className="w-8 h-8 text-stone-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-800 text-sm truncate" style={{ fontFamily: 'Noto Serif JP, serif' }}>{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {p.brand && <span className="text-xs text-stone-400">{p.brand}</span>}
                    {p.category && <span className="text-xs text-stone-400">{p.category}</span>}
                    <span className="text-xs text-stone-500 font-medium">¥{p.price.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STOCK_COLORS[p.stockStatus || 'in_stock']}`}>
                      {STOCK_LABELS[p.stockStatus || 'in_stock']}
                    </span>
                    {p.approvalStatus && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${APPROVAL_COLORS[p.approvalStatus] || 'bg-stone-100 text-stone-500'}`}>
                        {APPROVAL_LABELS[p.approvalStatus] || p.approvalStatus}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => generateMeta(p.id)}
                    disabled={isLoading}
                    className="flex items-center gap-1 text-xs border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    {isLoading
                      ? <span className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
                      : <Sparkles className="w-3 h-3" />}
                    AI生成
                  </button>
                  <button
                    onClick={() => suggestTags(p.id)}
                    disabled={isLoading}
                    className="flex items-center gap-1 text-xs border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-50 rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    <Tag className="w-3 h-3" />タグ
                  </button>
                  <button
                    onClick={() => setOpenId(isOpen ? null : p.id)}
                    className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {/* 展開: コメント＋承認操作 */}
              {isOpen && (
                <div className="border-t border-stone-100 bg-stone-50 px-4 py-3 space-y-3">
                  {p.sensoryComment ? (
                    <>
                      <div>
                        <p className="text-xs font-semibold text-rose-600 mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />感性コメント
                        </p>
                        <p className="text-xs text-stone-700 bg-rose-50 border border-rose-100 rounded-xl p-3 leading-relaxed">{p.sensoryComment}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-blue-600 mb-1">経験知コメント</p>
                        <p className="text-xs text-stone-700 bg-blue-50 border border-blue-100 rounded-xl p-3 leading-relaxed">{p.experienceComment}</p>
                      </div>
                      {p.confidenceScore != null && (
                        <p className="text-xs text-stone-400">品質スコア: {Math.round(p.confidenceScore)}/100</p>
                      )}
                      {p.approvalStatus === 'pending' && p.metaId && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => approve(p.metaId!)}
                            className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
                          >
                            <CheckCircle className="w-3 h-3" />承認
                          </button>
                          <input
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="却下理由（省略可）"
                            className="flex-1 min-w-[120px] text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                          />
                          <button
                            onClick={() => reject(p.metaId!)}
                            className="flex items-center gap-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
                          >
                            <XCircle className="w-3 h-3" />却下
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-stone-400">コメント未生成。「AI生成」ボタンで生成できます。</p>
                  )}
                </div>
              )}

              {/* 贈答タグ編集（GiftTagEditor 相当） */}
              {tags && (
                <div className="border-t border-rose-100 bg-rose-50/30 px-4 py-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-rose-700" />
                      <p className="text-sm font-semibold text-stone-800">贈答タグ</p>
                      <span className="text-[10px] text-rose-700 border border-rose-300 bg-white px-2 py-0.5 rounded-full font-medium">
                        ProductKnowledge / 非公開
                      </span>
                    </div>
                    <button
                      onClick={() => suggestTags(p.id)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 text-xs border border-amber-300 text-amber-800 hover:bg-amber-100/60 disabled:opacity-50 rounded-lg px-2.5 py-1 transition-colors"
                    >
                      {isLoading
                        ? <span className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
                        : <Sparkles className="w-3 h-3" />}
                      AIで推定
                    </button>
                  </div>

                  <p className="text-[11px] text-stone-600">
                    編集後、「承認キューに送信」で承認待ちになります。承認されたタグのみが商品マスタとAIチャットに反映されます。
                  </p>

                  {/* シーン適合度 */}
                  <div>
                    <p className="text-xs text-stone-700 font-semibold mb-2">シーン適合度</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {GIFT_SCENES.map(s => {
                        const current = nearestSceneLevel(tags.sceneCompatibility?.[s.key]);
                        return (
                          <div key={s.key} className="flex items-center gap-2 p-1.5 rounded bg-white border border-stone-200">
                            <span className="text-xs font-medium w-20 truncate flex-shrink-0">{s.label}</span>
                            <div className="flex gap-1 flex-1 justify-end">
                              {SCENE_LEVELS.map(lv => (
                                <button
                                  key={lv.value}
                                  type="button"
                                  onClick={() => setSceneLevel(p.id, s.key, lv.value)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border transition ${
                                    current === lv.value
                                      ? lv.cls + ' font-bold ring-1 ring-current'
                                      : 'border-stone-200 text-stone-500 bg-white hover:border-stone-400'
                                  }`}
                                >
                                  {lv.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 受け手属性 */}
                  <div>
                    <p className="text-xs text-stone-700 font-semibold mb-2">受け手属性（0-100）</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {AUDIENCE_OPTIONS.map(a => (
                        <div key={a.key} className="flex items-center gap-2 p-1.5 rounded bg-white border border-stone-200">
                          <span className="text-xs w-20 flex-shrink-0">{a.label}</span>
                          <input
                            type="number" min={0} max={100}
                            value={tags.audienceCompatibility?.[a.key] ?? ''}
                            onChange={e => setAudienceValue(p.id, a.key, e.target.value)}
                            placeholder="標準=未入力"
                            className="flex-1 h-7 text-xs border border-stone-200 rounded px-2 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 属性フラグ */}
                  <div>
                    <p className="text-xs text-stone-700 font-semibold mb-2">属性フラグ</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ATTRIBUTE_FLAG_OPTIONS.map(f => {
                        const checked = (tags.attributeFlags || []).includes(f.key);
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => toggleFlag(p.id, f.key)}
                            className={`text-xs px-2 py-1 rounded-full border transition ${
                              checked
                                ? 'bg-amber-100 text-amber-800 border-amber-400 font-medium'
                                : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'
                            }`}
                          >
                            {checked ? '✓ ' : ''}{f.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* アクション */}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => cancelTags(p.id)}
                      className="text-xs text-stone-500 hover:text-stone-800 border border-stone-200 hover:border-stone-400 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => submitTagsForApproval(p.id)}
                      className="flex items-center gap-1.5 text-xs bg-rose-700 hover:bg-rose-800 text-white rounded-lg px-3 py-1.5 font-medium transition-colors"
                    >
                      <Tag className="w-3 h-3" />
                      承認キューに送信
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <Gift className="w-12 h-12 mx-auto mb-3 text-stone-200" />
            <p className="text-sm text-stone-400">商品が見つかりません</p>
          </div>
        )}
      </div>
    </div>
  );
}
