'use client';

import { useState } from 'react';
import { Sparkles, FileText, Check, BookHeart, Send, Gift, X } from 'lucide-react';

// 実行時に現在のページ origin から API base を導出する。
// localhost ↔ 127.0.0.1 のように別サイト扱いになる場合の SameSite=Lax Cookie 喪失を防ぐ目的。
const API = process.env.NEXT_PUBLIC_API_BASE
  ?? (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000');

export type GiftProduct = {
  id: number;
  name: string;
  price: number;
  brand?: string;
  imageUrl?: string;
};

type Tab = 'card' | 'story';

const WASHI_PATTERNS = [
  { id: 'sakura',   label: '桜（春の風情）',   bg: 'bg-rose-50',   border: 'border-rose-200',   accent: 'text-rose-700'   },
  { id: 'asanoha',  label: '麻の葉（伝統文様）', bg: 'bg-amber-50',  border: 'border-amber-200',  accent: 'text-amber-700'  },
  { id: 'seigaiha', label: '青海波（波紋）',    bg: 'bg-sky-50',    border: 'border-sky-200',    accent: 'text-sky-700'    },
  { id: 'shippo',   label: '七宝（円満・調和）', bg: 'bg-violet-50', border: 'border-violet-200', accent: 'text-violet-700' },
];

const OCCASION_LABELS: Record<string, string> = {
  ochugen: '御中元',
  oseibo:  '御歳暮',
  birthday: 'お誕生日おめでとうございます',
  wedding:  'ご結婚おめでとうございます',
  thanks:   '心ばかりのお礼として',
  other:    '',
};

// ─── 和紙カードプレビュー ─────────────────────────────────────────────
function WashiCardPreview({
  pattern, senderName, recipientName, message, occasion,
}: {
  pattern: string; senderName: string; recipientName: string;
  message: string; occasion: string;
}) {
  const p = WASHI_PATTERNS.find(w => w.id === pattern) ?? WASHI_PATTERNS[0];
  const occasionLabel = OCCASION_LABELS[occasion] ?? '';

  return (
    <div className={`rounded-2xl border-2 ${p.border} ${p.bg} p-6 min-h-[280px] flex flex-col relative overflow-hidden`}>
      {/* 装飾的な背景パターン */}
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />

      {/* 上部の飾り罫線 */}
      <div className={`h-0.5 w-full ${p.border} border-t mb-4`} />

      {/* 高島屋ロゴ */}
      <p className={`text-center text-xs font-medium tracking-widest ${p.accent} mb-4`}>
        高 島 屋
      </p>

      {/* 宛名 */}
      {recipientName && (
        <p className="text-center text-base font-bold text-stone-800 mb-2">
          {recipientName} 様
        </p>
      )}

      {/* 用途 */}
      {occasionLabel && (
        <p className={`text-center text-sm font-medium ${p.accent} mb-3 tracking-wider`}>
          {occasionLabel}
        </p>
      )}

      {/* メッセージ本文 */}
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-stone-700 text-center leading-relaxed whitespace-pre-wrap font-serif">
          {message || 'メッセージを入力してください'}
        </p>
      </div>

      {/* 送り主 */}
      {senderName && (
        <p className="text-right text-sm text-stone-600 mt-4">
          {senderName} より
        </p>
      )}

      {/* 下部の飾り罫線 */}
      <div className={`h-0.5 w-full ${p.border} border-t mt-4`} />
    </div>
  );
}

export default function GiftCardPage({
  selectedProduct,
  onClearProduct,
}: {
  selectedProduct?: GiftProduct | null;
  onClearProduct?: () => void;
} = {}) {
  const [tab, setTab] = useState<Tab>('card');
  const [pattern, setPattern] = useState('sakura');
  const [senderName, setSenderName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [occasion, setOccasion] = useState('thanks');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ストーリータブ用 state
  const [relation, setRelation] = useState('');
  const [memory, setMemory] = useState('');
  const [wish, setWish] = useState('');
  const [story, setStory] = useState('');
  const [generatingStory, setGeneratingStory] = useState(false);

  const generateStory = async () => {
    setGeneratingStory(true);
    try {
      const note = [
        relation && `【関係】${relation}`,
        memory && `【思い出】${memory}`,
        wish && `【願い】${wish}`,
        '上記をもとに、贈り物に込めた想いを一篇の物語のように、200〜300字で綴ってください。',
      ].filter(Boolean).join('\n');
      const r = await fetch(`${API}/gift-card/generate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasion, recipientName, senderName, note }),
      });
      const data = await r.json();
      setStory(data.message || '');
    } finally {
      setGeneratingStory(false);
    }
  };

  const sendToCard = () => {
    if (story) setMessage(story);
    setTab('card');
  };

  const generateMessage = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`${API}/gift-card/generate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occasion, recipientName, senderName, note: '' }),
      });
      const data = await r.json();
      setMessage(data.message || '');
    } finally {
      setGenerating(false);
    }
  };

  const saveCard = async () => {
    if (!message.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API}/gift-card/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // カタログから来た場合は商品 ID を紐付ける (gift_cards.product_id)
          productId: selectedProduct?.id,
          occasion, senderName, recipientName,
          messageBody: message, cardStyle: pattern, status: 'finalized',
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-amber-700" />
        <div>
          <h1 className="text-xl font-bold text-stone-800">和紙メッセージカード</h1>
          <p className="text-xs text-stone-500">贈り物に添える和紙カードと、贈り物のストーリーを作成します</p>
        </div>
      </div>

      {/* カタログから商品を選んできた場合のプリセット表示。
          x ボタンで紐付けを解除し、カードのみで保存できる動線を残す。 */}
      {selectedProduct && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl bg-white border border-amber-200 overflow-hidden flex-shrink-0">
            {selectedProduct.imageUrl
              ? <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Gift className="w-8 h-8 text-amber-400" /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] tracking-widest text-amber-700 font-semibold mb-0.5">SELECTED GIFT</p>
            <p className="text-sm font-semibold text-stone-800 truncate">{selectedProduct.name}</p>
            <p className="text-xs text-stone-600">
              {selectedProduct.brand && <span className="mr-2">{selectedProduct.brand}</span>}
              <span className="font-medium">¥{Number(selectedProduct.price).toLocaleString()}</span>
            </p>
          </div>
          {onClearProduct && (
            <button
              onClick={onClearProduct}
              aria-label="商品の紐付けを解除"
              className="w-8 h-8 rounded-full text-amber-700 hover:bg-amber-100 flex items-center justify-center flex-shrink-0"
              title="商品の紐付けを解除"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* タブ */}
      <div className="flex gap-1 border-b border-stone-200">
        {([
          { key: 'card'  as Tab, label: 'カード作成',          icon: <FileText className="w-3.5 h-3.5" /> },
          { key: 'story' as Tab, label: '贈り物のストーリー',  icon: <BookHeart className="w-3.5 h-3.5" /> },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── ストーリータブ ───────────────────────────────────────── */}
      {tab === 'story' && (
        <div className="space-y-5">
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
            <p className="text-sm font-medium text-stone-700">贈り物の背景</p>
            <p className="text-xs text-stone-500 -mt-2">
              贈る相手との関係性、思い出、伝えたい想いを記入すると、AIが「贈り物に込めた物語」を綴ります。
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-stone-600 block">贈る相手との関係</label>
              <input
                value={relation}
                onChange={e => setRelation(e.target.value)}
                placeholder="例：35年来の親友、母の喜寿、父からの結婚祝い"
                className="w-full h-9 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-stone-600 block">共有した思い出・エピソード</label>
              <textarea
                value={memory}
                onChange={e => setMemory(e.target.value)}
                placeholder="例：学生時代に一緒に登った富士山、毎年欠かさず贈り合った和菓子"
                rows={3}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-stone-600 block">この贈り物に込めたい願い</label>
              <textarea
                value={wish}
                onChange={e => setWish(e.target.value)}
                placeholder="例：これからも穏やかに健やかに過ごしてほしい"
                rows={2}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white resize-none"
              />
            </div>

            <button
              onClick={generateStory}
              disabled={generatingStory || (!relation.trim() && !memory.trim() && !wish.trim())}
              className="w-full h-10 bg-amber-700 hover:bg-amber-800 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {generatingStory
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Sparkles className="w-4 h-4" />}
              AIで物語を綴る
            </button>
          </div>

          {/* ストーリープレビュー */}
          <div className="bg-gradient-to-br from-amber-50/60 to-rose-50/40 border border-amber-200 rounded-2xl p-6 shadow-sm">
            <p className="text-[10px] tracking-[0.3em] text-amber-700 font-semibold mb-3 text-center">A GIFT STORY</p>
            <div className="border-t border-b border-amber-200 py-5">
              {story ? (
                <p className="text-sm text-stone-700 leading-loose whitespace-pre-wrap" style={{ fontFamily: 'Noto Serif JP, serif' }}>
                  {story}
                </p>
              ) : (
                <p className="text-sm text-stone-400 text-center">
                  右上の「AIで物語を綴る」を押すと、ここに贈り物のストーリーが表示されます。
                </p>
              )}
            </div>
            {senderName && (
              <p className="text-right text-xs text-stone-500 mt-3">— {senderName} より</p>
            )}
          </div>

          {story && (
            <button
              onClick={sendToCard}
              className="w-full h-10 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />このストーリーをカードに転記する
            </button>
          )}
        </div>
      )}

      {/* ── カード作成タブ ────────────────────────────────────────── */}
      {tab === 'card' && (
      <>

      {/* プレビュー */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-medium text-stone-700 mb-3">プレビュー</p>
        <WashiCardPreview
          pattern={pattern}
          senderName={senderName}
          recipientName={recipientName}
          message={message}
          occasion={occasion}
        />
      </div>

      {/* 和紙パターン選択 */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-medium text-stone-700 mb-3">和紙パターン</p>
        <div className="grid grid-cols-2 gap-2">
          {WASHI_PATTERNS.map(p => (
            <button
              key={p.id}
              onClick={() => setPattern(p.id)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                pattern === p.id
                  ? `${p.border} ${p.bg} ring-2 ring-amber-400`
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <p className={`text-xs font-medium ${pattern === p.id ? p.accent : 'text-stone-600'}`}>
                {p.label}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* カード内容入力 */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
        <p className="text-sm font-medium text-stone-700">カード内容</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-stone-600 block">贈り先のお名前</label>
            <input
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder="山田 太郎"
              className="w-full h-9 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-stone-600 block">送り主のお名前</label>
            <input
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              placeholder="田中 花子"
              className="w-full h-9 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-stone-600 block">贈り物の用途</label>
          <select
            value={occasion}
            onChange={e => setOccasion(e.target.value)}
            className="w-full h-9 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          >
            <option value="ochugen">御中元</option>
            <option value="oseibo">御歳暮</option>
            <option value="birthday">お誕生日</option>
            <option value="wedding">ご結婚祝い</option>
            <option value="thanks">お礼</option>
            <option value="other">その他</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-stone-600">メッセージ</label>
            <button
              onClick={generateMessage}
              disabled={generating}
              className="flex items-center gap-1 h-7 px-3 text-xs border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {generating
                ? <span className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
                : <Sparkles className="w-3 h-3" />}
              AIで生成
            </button>
          </div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="心を込めたメッセージをご記入ください"
            rows={4}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white resize-none"
          />
          <p className="text-xs text-stone-400 text-right">{message.length} / 200文字</p>
        </div>
      </div>

      {/* 保存ボタン */}
      {saved ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
            <Check className="w-4 h-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">和紙カードを保存しました</p>
          </div>
          <button
            onClick={() => setSaved(false)}
            className="w-full h-10 border border-stone-300 text-stone-600 hover:bg-stone-50 rounded-xl text-sm font-medium transition-colors"
          >
            新しいカードを作る
          </button>
        </div>
      ) : (
        <button
          onClick={saveCard}
          disabled={saving || !message.trim()}
          className="w-full h-11 bg-amber-700 hover:bg-amber-800 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {saving
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <FileText className="w-4 h-4" />}
          和紙カードを保存する
        </button>
      )}
      </>
      )}
    </div>
  );
}
