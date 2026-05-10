'use client';

import { useState, useEffect, useMemo } from 'react';
import { Gift, Search, Sparkles, X, FileText, ShoppingBag, Minus, Plus } from 'lucide-react';

// 実行時に現在のページ origin から API base を導出する。
// localhost ↔ 127.0.0.1 のように別サイト扱いになる場合の SameSite=Lax Cookie 喪失を防ぐ目的。
const API = process.env.NEXT_PUBLIC_API_BASE
  ?? (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000');

export type CatalogProduct = {
  id: number;
  name: string;
  description?: string;
  price: number;
  category?: string;
  brand?: string;
  imageUrl?: string;
  stockStatus?: string;
  seasonTag?: string;
};

const SEASON_LABELS: Record<string, string> = {
  ochugen: 'お中元', oseibo: 'お歳暮', all_year: '通年',
  spring: '春', summer: '夏', autumn: '秋', winter: '冬',
};

export default function ProductCatalogPage({
  onAskAI,
  onPurchase,
}: {
  onAskAI?: (productName: string) => void;
  onPurchase?: (product: CatalogProduct) => void;
}) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [seasonTag, setSeasonTag] = useState('all');
  // 商品詳細モーダル: クリックされた商品を開く。null で閉じる
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  // 数量セレクタ (デモ表示用)。モーダルを開くたびに 1 にリセット
  const [qty, setQty] = useState(1);

  useEffect(() => {
    fetch(`${API}/products`).then(r => r.json()).then(d => { setProducts(d); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return products.filter(p => {
      const searchMatch   = kw === '' || p.name.toLowerCase().includes(kw) || (p.brand ?? '').toLowerCase().includes(kw);
      const categoryMatch = category === 'all' || p.category === category;
      const seasonMatch   = seasonTag === 'all' || p.seasonTag === seasonTag;
      return searchMatch && categoryMatch && seasonMatch;
    });
  }, [products, search, category, seasonTag]);

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[])), [products]);

  return (
    <div className="min-h-full" style={{ backgroundColor: 'var(--color-brand-cream)' }}>
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Noto Serif JP, serif', color: 'var(--color-brand-ink)' }}>
            贈答品カタログ
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-brand-muted)' }}>
            高島屋厳選の贈答品をご覧いただけます
          </p>
        </div>

        {/* フィルター */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="商品名・ブランドで検索"
              className="w-full h-10 pl-9 pr-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            />
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="h-10 sm:w-40 px-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          >
            <option value="all">すべてのカテゴリ</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={seasonTag}
            onChange={e => setSeasonTag(e.target.value)}
            className="h-10 sm:w-40 px-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          >
            <option value="all">すべてのシーズン</option>
            <option value="all_year">通年</option>
            <option value="spring">春</option>
            <option value="summer">夏</option>
            <option value="autumn">秋</option>
            <option value="winter">冬</option>
            <option value="ochugen">お中元</option>
            <option value="oseibo">お歳暮</option>
          </select>
        </div>

        {/* 一覧 */}
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>該当する商品が見つかりませんでした</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(p => (
              <div key={p.id} className="relative group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:shadow-md transition-all flex flex-col">
                {/* 画像 + 本体 (ここをクリックすると詳細モーダルが開く) */}
                <button
                  type="button"
                  onClick={() => { setSelected(p); setQty(1); }}
                  className="text-left flex flex-col flex-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-inset"
                >
                  <div className="aspect-square bg-stone-100 overflow-hidden">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Gift className="w-12 h-12 text-stone-300" /></div>}
                  </div>

                  <div className="p-3 flex-1 flex flex-col">
                    {p.seasonTag && (
                      <span className="text-[10px] mb-1.5 px-2 py-0.5 rounded-full font-medium border self-start"
                            style={{
                              backgroundColor: 'color-mix(in oklch, var(--color-brand) 5%, transparent)',
                              borderColor: 'color-mix(in oklch, var(--color-brand) 20%, transparent)',
                              color: 'var(--color-brand)',
                            }}>
                        {SEASON_LABELS[p.seasonTag] ?? p.seasonTag}
                      </span>
                    )}
                    <h3 className="font-medium text-sm leading-snug line-clamp-2 mb-1 text-stone-800">{p.name}</h3>
                    {p.brand && <p className="text-xs text-stone-500">{p.brand}</p>}
                    <div className="flex items-center justify-between mt-auto pt-3">
                      <span className="font-semibold text-sm text-stone-900">¥{Number(p.price).toLocaleString()}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        p.stockStatus === 'in_stock'
                          ? 'text-green-700 border-green-200 bg-green-50'
                          : p.stockStatus === 'low_stock'
                            ? 'text-amber-700 border-amber-200 bg-amber-50'
                            : 'text-red-700 border-red-200 bg-red-50'
                      }`}>
                        {p.stockStatus === 'in_stock' ? '在庫あり' : p.stockStatus === 'low_stock' ? '残りわずか' : '在庫なし'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* AIに相談（パルスリング付き） — カードクリックと干渉しないよう絶対配置のまま */}
                {onAskAI && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAskAI(p.name); }}
                    className="absolute top-2 right-2 z-10 group/ai"
                    title="この商品についてAIコンシェルジュに相談する"
                  >
                    <span className="absolute inset-0 rounded-full bg-amber-400/40 animate-ping" aria-hidden="true" />
                    <span className="relative flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-rose-500 text-white shadow-lg shadow-amber-500/50 ring-2 ring-white/80 group-hover/ai:scale-110 transition-transform">
                      <Sparkles className="w-3.5 h-3.5 drop-shadow" />
                      <span className="text-[10px] font-bold tracking-wide">AIに相談</span>
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 商品詳細モーダル ─────────────────────────────────────────
          カタログクリックで開く。「贈り物カードを作る」で GiftCardPage へ商品付きで遷移。
          AIに相談 (onAskAI) も併設して、相談導線と購入導線の両方を提供する。 */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <div className="aspect-square bg-stone-100 max-h-72 overflow-hidden">
                {selected.imageUrl
                  ? <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Gift className="w-16 h-16 text-stone-300" /></div>}
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="閉じる"
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center text-stone-500 hover:text-stone-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {selected.brand && <span className="text-xs text-stone-500">{selected.brand}</span>}
                {selected.seasonTag && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                        style={{
                          backgroundColor: 'color-mix(in oklch, var(--color-brand) 5%, transparent)',
                          borderColor: 'color-mix(in oklch, var(--color-brand) 20%, transparent)',
                          color: 'var(--color-brand)',
                        }}>
                    {SEASON_LABELS[selected.seasonTag] ?? selected.seasonTag}
                  </span>
                )}
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border font-medium ${
                  selected.stockStatus === 'in_stock'
                    ? 'text-green-700 border-green-200 bg-green-50'
                    : selected.stockStatus === 'low_stock'
                      ? 'text-amber-700 border-amber-200 bg-amber-50'
                      : 'text-red-700 border-red-200 bg-red-50'
                }`}>
                  {selected.stockStatus === 'in_stock' ? '在庫あり' : selected.stockStatus === 'low_stock' ? '残りわずか' : '在庫なし'}
                </span>
              </div>

              <h2 className="text-lg font-bold text-stone-900 leading-snug mb-2"
                  style={{ fontFamily: 'Noto Serif JP, serif' }}>
                {selected.name}
              </h2>
              <p className="text-2xl font-bold text-stone-900 mb-4">
                ¥{Number(selected.price).toLocaleString()}
                <span className="text-xs text-stone-400 font-normal ml-1">(税込)</span>
              </p>

              {selected.description && (
                <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap mb-4">
                  {selected.description}
                </p>
              )}

              {/* 数量セレクタ + 購入ボタン (デモ表示)。
                  実購入機能は持たないので onClick は no-op。「デモ表示」と明記して誤解を防ぐ */}
              {selected.stockStatus !== 'out_of_stock' && (
                <div className="border-t border-stone-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-stone-700">数量</span>
                    <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setQty(q => Math.max(1, q - 1))}
                        disabled={qty <= 1}
                        aria-label="数量を減らす"
                        className="w-9 h-9 flex items-center justify-center text-stone-600 hover:bg-stone-50 disabled:text-stone-300 disabled:hover:bg-transparent transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center text-sm font-semibold text-stone-800 select-none">{qty}</span>
                      <button
                        onClick={() => setQty(q => Math.min(99, q + 1))}
                        disabled={qty >= 99}
                        aria-label="数量を増やす"
                        className="w-9 h-9 flex items-center justify-center text-stone-600 hover:bg-stone-50 disabled:text-stone-300 disabled:hover:bg-transparent transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-stone-500 mb-3">
                    <span>小計</span>
                    <span className="font-semibold text-stone-800">
                      ¥{(Number(selected.price) * qty).toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { /* デモ表示: 何もしない */ }}
                    className="relative w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors hover:brightness-90"
                    style={{ backgroundColor: 'var(--color-brand)', color: 'var(--color-brand-fg)' }}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    購入する
                    <span className="absolute top-1 right-2 text-[9px] tracking-wider bg-white/20 border border-white/40 px-1.5 py-0.5 rounded text-white">DEMO</span>
                  </button>
                  <p className="text-[10px] text-stone-400 text-center mt-1.5">
                    ※ デモ表示のため、このボタンは動作しません
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-stone-100 p-4 flex flex-col sm:flex-row gap-2">
              {onAskAI && (
                <button
                  onClick={() => { onAskAI(selected.name); setSelected(null); }}
                  className="flex-1 h-11 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  AIに相談する
                </button>
              )}
              {onPurchase && (
                <button
                  onClick={() => {
                    if (selected.stockStatus === 'out_of_stock') return;
                    onPurchase(selected);
                    setSelected(null);
                  }}
                  disabled={selected.stockStatus === 'out_of_stock'}
                  className="flex-1 h-11 bg-amber-700 hover:bg-amber-800 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  この商品で贈り物カードを作る
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
