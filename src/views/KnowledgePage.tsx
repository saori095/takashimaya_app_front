'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Sparkles, Trash2, ToggleLeft, ToggleRight, BookOpen, User as UserIcon,
  Users, Search, ChevronRight, ChevronDown, CheckCircle, Wand2, Layers,
  Inbox, X, Send, RefreshCw, MessageSquare, Edit3, Star, GraduationCap, Award, Tag,
} from 'lucide-react';

// 実行時に現在のページ origin から API base を導出する。
// localhost ↔ 127.0.0.1 のように別サイト扱いになる場合の SameSite=Lax Cookie 喪失を防ぐ目的。
const API = process.env.NEXT_PUBLIC_API_BASE
  ?? (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000');

type User = { id: number; role: string; displayName: string };

// ============================================================================
// 型定義
// ============================================================================

type KnowledgeItem = {
  id: number;
  category: string;
  title: string;
  content: string;
  priority: number;
  visibility: 'shared' | 'personal';
  isActive: boolean;
  ownedByConciergeId?: number | null;
  ownerName?: string | null;
};

type Product = {
  id: number;
  name: string;
  category?: string;
  brand?: string;
  imageUrl?: string;
  price: number;
};

// AI 下書き生成 (POST /products/{id}/metadata/generate) のレスポンス
type GeneratedMetadata = {
  id: number;                  // metadata id (PATCH や approve に使う)
  productId: number;
  sensoryComment: string | null;
  experienceComment: string | null;
  confidenceScore?: number | null;
  attemptNo?: number | null;
  approvalStatus?: string;
};

// 承認キュー項目 (GET /admin/approval-queue)
type MetadataQueueItem = {
  queueId: number;
  metaId: number;
  priority: number;
  queueStatus: string;
  approvalStatus: string;
  attemptNo: number;
  sensoryComment: string | null;
  experienceComment: string | null;
  confidenceScore?: number | null;
  productId: number;
  productName: string;
  imageUrl?: string;
  brand?: string;
  category?: string;
  price: number;
  submitterName?: string;
  submitterRole?: string;
  submitterAvatar?: string;
  queuedAt: string;
};

const KNOWLEDGE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'noshi_rule',     label: 'のしルール' },
  { value: 'scene_rule',     label: 'シーンルール' },
  { value: 'category_rule',  label: 'カテゴリルール' },
  { value: 'ng_item',        label: 'NG事項' },
  { value: 'priority_brand', label: '優先ブランド' },
  { value: 'general',        label: '一般' },
];
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  KNOWLEDGE_CATEGORIES.map(c => [c.value, c.label])
);

type TopTab = 'studio' | 'productList' | 'list' | 'queue';

// 承認済み商品コメント（学び合いビュー用）
type ProductKnowledgeItem = {
  metaId: number;
  sensoryComment: string | null;
  experienceComment: string | null;
  confidenceScore: number | null;
  attemptNo: number | null;
  approvalStatus: string;
  approvedAt: string | null;
  updatedAt: string | null;
  productId: number;
  productName: string;
  imageUrl?: string;
  brand?: string;
  category?: string;
  price: number;
  creatorName?: string;
  creatorRole?: string;        // concierge_junior | concierge_senior | admin
  creatorAvatar?: string;
  creatorYears?: number;
  creatorAge?: string;
  creatorViewpoint?: string;   // sensory | experience | both
  approverName?: string;
  approverRole?: string;
  approverAvatar?: string;
  approverYears?: number;
};

// 役職（ランク）でタグ付け: concierge_senior=シニア / concierge_junior=ジュニア
// 年数ではなく役職フラグを使うのは、年数で世代を決めつけないため。
const rankBadge = (role?: string): { label: string; tone: 'senior' | 'junior' | 'other' } => {
  if (role === 'concierge_senior') return { label: 'シニア', tone: 'senior' };
  if (role === 'concierge_junior') return { label: 'ジュニア', tone: 'junior' };
  return { label: '管理者', tone: 'other' };
};

// ============================================================================
// メイン: 3タブ構成
// ============================================================================

export default function KnowledgePage({ me }: { me: User }) {
  const [tab, setTab] = useState<TopTab>('studio');
  const [queueCount, setQueueCount] = useState(0);

  const refreshQueueCount = () => {
    Promise.all([
      fetch(`${API}/admin/approval-queue`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/admin/tag-approval-queue`).then(r => r.ok ? r.json() : []),
    ])
      .then(([metas, tags]) => {
        const m = Array.isArray(metas) ? metas.length : 0;
        const t = Array.isArray(tags) ? tags.filter((x: { status?: string }) => x.status === 'waiting' || x.status === 'in_review').length : 0;
        setQueueCount(m + t);
      })
      .catch(() => setQueueCount(0));
  };

  useEffect(refreshQueueCount, [tab]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-6">
        <p className="text-[11px] tracking-[0.3em] text-stone-500 font-medium">KNOWLEDGE STUDIO</p>
        <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2 mt-1" style={{ fontFamily: 'Noto Serif JP, serif' }}>
          <BookOpen className="w-6 h-6" style={{ color: 'var(--color-brand)' }} />
          ナレッジ・スタジオ
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          AI が二視点コメントを下書き → 編集 → 承認・公開を 1 画面で。承認時は「修正方向」を指示すれば AI が再生成します。
        </p>
      </div>

      {/* タブ */}
      <div className="flex border-b border-stone-200 mb-6 overflow-x-auto">
        <TabButton current={tab} target="studio"      label="スタジオ"          icon={<Wand2 className="w-3.5 h-3.5" />} onClick={setTab} />
        <TabButton current={tab} target="productList" label="商品ナレッジ一覧"   icon={<MessageSquare className="w-3.5 h-3.5" />} onClick={setTab} />
        <TabButton current={tab} target="list"        label="一般ナレッジ一覧"   icon={<Layers className="w-3.5 h-3.5" />} onClick={setTab} />
        <TabButton current={tab} target="queue"       label="承認待ち"          icon={<Inbox className="w-3.5 h-3.5" />} badge={queueCount} onClick={setTab} />
      </div>

      {tab === 'studio'      && <StudioPanel me={me} onPublishedToQueue={refreshQueueCount} onJumpToQueue={() => setTab('queue')} />}
      {tab === 'productList' && <ProductKnowledgePanel me={me} />}
      {tab === 'list'        && <ListPanel me={me} />}
      {tab === 'queue'       && <QueuePanel me={me} onChange={refreshQueueCount} />}
    </div>
  );
}

function TabButton({
  current, target, label, icon, badge, onClick,
}: {
  current: TopTab; target: TopTab; label: string; icon: React.ReactNode; badge?: number;
  onClick: (t: TopTab) => void;
}) {
  const active = current === target;
  return (
    <button
      onClick={() => onClick(target)}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-amber-600 text-amber-700' : 'border-transparent text-stone-500 hover:text-stone-700'
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-rose-600 text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Studio: 4 ステップウィザード — 商品コメント or 一般ナレッジ
// ============================================================================

type StudioMode = 'product' | 'general' | null;
type ViewpointChoice = 'sensory' | 'experience' | 'both';

// 贈答タグの定数（backend/category_rules.py と一致）
const TAG_SCENES: { key: string; label: string }[] = [
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

const TAG_AUDIENCES: { key: string; label: string }[] = [
  { key: 'young_family', label: '若いご家族' },
  { key: 'elderly',      label: 'ご年配' },
  { key: 'business',     label: 'ビジネス' },
  { key: 'casual',       label: 'カジュアル' },
  { key: 'student',      label: '学生・若手' },
];

const TAG_FLAGS: { key: string; label: string }[] = [
  { key: 'alcohol',                label: 'アルコール含有' },
  { key: 'perishable',             label: '生もの・要冷蔵' },
  { key: 'requires_refrigeration', label: '要冷蔵' },
  { key: 'individually_wrapped',   label: '個包装あり' },
  { key: 'formal_packaging',       label: '桐箱・風呂敷' },
  { key: 'name_engravable',        label: '名入れ・刻印可' },
  { key: 'organic',                label: 'オーガニック・無添加' },
  { key: 'premium_japan_origin',   label: '国産プレミアム' },
  { key: 'long_shelf_life',        label: '賞味期限長め' },
  { key: 'fragrance',              label: '香りもの' },
  { key: 'kids_safe',              label: '子供向け安全配慮' },
];

const SCENE_LEVELS: { value: number; label: string; chip: string }[] = [
  { value: 100, label: '強く推奨', chip: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 80,  label: '推奨',     chip: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 50,  label: '標準',     chip: 'bg-stone-100 text-stone-700 border-stone-300' },
  { value: 0,   label: '不向き',   chip: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: -1,  label: 'NG',       chip: 'bg-rose-100 text-rose-800 border-rose-300' },
];

// 入力値（0-100, -1, あるいは 0-1 の小数）を 5 段階に丸める
function nearestSceneLevel(value: number | undefined | null): number {
  if (value === undefined || value === null) return 50;
  // 0-1 スケールが来た場合は 100 倍する
  let v = value;
  if (v > 0 && v <= 1) v = v * 100;
  if (v < 0) return -1;
  if (v >= 90) return 100;
  if (v >= 70) return 80;
  if (v >= 25) return 50;
  return 0;
}

// AI 推定の戻り値
type SuggestedTags = {
  sceneCompatibility: Record<string, number>;
  audienceCompatibility: Record<string, number>;
  attributeFlags: string[];
  minDeliveryDays?: number | null;
};
type Step = 1 | 2 | 3 | 4;

function StudioPanel({
  me, onPublishedToQueue, onJumpToQueue,
}: {
  me: User;
  onPublishedToQueue: () => void;
  onJumpToQueue: () => void;
}) {
  const [mode, setMode] = useState<StudioMode>(null);
  const [step, setStep] = useState<Step>(1);

  // 商品コメントモード state
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [pickedProduct, setPickedProduct] = useState<Product | null>(null);
  const [viewpoint, setViewpoint] = useState<ViewpointChoice>('both');
  const [generated, setGenerated] = useState<GeneratedMetadata | null>(null);
  const [sensoryDraft, setSensoryDraft] = useState('');
  const [experienceDraft, setExperienceDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 一般ナレッジモード state
  const [generalDraft, setGeneralDraft] = useState({
    category: 'general',
    title: '',
    content: '',
    priority: 5,
    visibility: 'shared' as 'shared' | 'personal',
  });

  // 商品タグモード state
  const [tagPayload, setTagPayload] = useState<SuggestedTags | null>(null);
  const [suggestingTags, setSuggestingTags] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'product') {
      fetch(`${API}/products`).then(r => r.json()).then((d: Product[]) => setProducts(d ?? []));
    }
  }, [mode]);

  const reset = () => {
    setMode(null);
    setStep(1);
    setPickedProduct(null);
    setViewpoint('both');
    setGenerated(null);
    setSensoryDraft('');
    setExperienceDraft('');
    setProductSearch('');
    setGeneralDraft({ category: 'general', title: '', content: '', priority: 5, visibility: 'shared' });
    setTagPayload(null);
    setDoneMessage(null);
    setErrorMsg(null);
  };

  // Step 2 → 3: 商品を選んで AI 下書きを一括生成（コメント + タグ並列）
  const generateDraft = async () => {
    if (!pickedProduct) return;
    setErrorMsg(null);
    setGenerating(true);
    try {
      const [commentRes, tagRes] = await Promise.all([
        fetch(`${API}/products/${pickedProduct.id}/metadata/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ viewpoint }),
        }).then(r => r.json()),
        fetch(`${API}/products/${pickedProduct.id}/tags/suggest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).then(r => r.json()),
      ]);
      if (commentRes.error) {
        setErrorMsg(`コメント生成に失敗しました: ${commentRes.error}`);
        return;
      }
      const meta: GeneratedMetadata = {
        id: commentRes.id,
        productId: commentRes.productId ?? pickedProduct.id,
        sensoryComment: commentRes.sensoryComment ?? null,
        experienceComment: commentRes.experienceComment ?? null,
        confidenceScore: commentRes.confidenceScore,
        attemptNo: commentRes.attemptNo,
        approvalStatus: commentRes.approvalStatus,
      };
      setGenerated(meta);
      setSensoryDraft(meta.sensoryComment ?? '');
      setExperienceDraft(meta.experienceComment ?? '');
      // タグ側はエラーがあっても警告のみ。コメントだけは進める
      if (!tagRes.error) {
        setTagPayload({
          sceneCompatibility:    tagRes.sceneCompatibility    ?? {},
          audienceCompatibility: tagRes.audienceCompatibility ?? {},
          attributeFlags:        tagRes.attributeFlags        ?? [],
          minDeliveryDays:       tagRes.minDeliveryDays       ?? null,
        });
      }
      onPublishedToQueue();
      setStep(3);
    } finally {
      setGenerating(false);
    }
  };

  // 個別再生成: コメントだけ再生成 (修正方向プロンプト付き)
  const regenerateComment = async (feedback: string) => {
    if (!pickedProduct || !generated) return;
    setGenerating(true);
    try {
      const r = await fetch(`${API}/products/${pickedProduct.id}/metadata/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewpoint,
          feedback: feedback || undefined,
          previousSensory: sensoryDraft,
          previousExperience: experienceDraft,
          metaId: generated.id,  // 同じレコードを上書き
        }),
      });
      const data = await r.json();
      if (data.error) {
        alert(`再生成に失敗しました: ${data.error}`);
        return;
      }
      const meta: GeneratedMetadata = {
        id: data.id, productId: data.productId ?? pickedProduct.id,
        sensoryComment: data.sensoryComment ?? null,
        experienceComment: data.experienceComment ?? null,
        confidenceScore: data.confidenceScore,
        attemptNo: data.attemptNo,
        approvalStatus: data.approvalStatus,
      };
      setGenerated(meta);
      setSensoryDraft(meta.sensoryComment ?? '');
      setExperienceDraft(meta.experienceComment ?? '');
    } finally {
      setGenerating(false);
    }
  };

  // 個別再生成: タグだけ再生成 (修正方向プロンプト付き)
  const regenerateTags = async (feedback: string) => {
    if (!pickedProduct) return;
    setSuggestingTags(true);
    try {
      const r = await fetch(`${API}/products/${pickedProduct.id}/tags/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback || undefined }),
      });
      const data = await r.json();
      if (data.error) {
        alert(`タグ再生成に失敗しました: ${data.error}`);
        return;
      }
      setTagPayload({
        sceneCompatibility:    data.sceneCompatibility    ?? {},
        audienceCompatibility: data.audienceCompatibility ?? {},
        attributeFlags:        data.attributeFlags        ?? [],
        minDeliveryDays:       data.minDeliveryDays       ?? null,
      });
    } finally {
      setSuggestingTags(false);
    }
  };

  // Step 3 → 4: 商品ナレッジ (コメント + タグ) を一括で承認待ちキュー入りさせる。
  // - コメント: PATCH /metadata/{id} (キュー入り保証)
  // - タグ: POST /products/{id}/tags/submit-for-approval (gift_tag_approval_queue 投入)
  const submitProductComments = async (payload: { sensory?: string; experience?: string }) => {
    if (!generated || !pickedProduct) return;
    setSubmitting(true);
    try {
      // 1. コメント (metadata) を確定
      const cBody: Record<string, string> = {};
      if (payload.sensory !== undefined)    cBody.sensoryComment    = payload.sensory;
      if (payload.experience !== undefined) cBody.experienceComment = payload.experience;
      const cRes = await fetch(`${API}/metadata/${generated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cBody),
      });
      if (!cRes.ok) {
        const txt = await cRes.text();
        throw new Error(`コメントの送信に失敗しました: ${txt.slice(0, 120)}`);
      }

      // 2. タグ (gift_tag_approval_queue) を投入（タグが揃っている場合のみ）
      let tagSubmitted = false;
      if (tagPayload) {
        const tRes = await fetch(`${API}/products/${pickedProduct.id}/tags/submit-for-approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneCompatibility:    tagPayload.sceneCompatibility,
            audienceCompatibility: tagPayload.audienceCompatibility,
            attributeFlags:        tagPayload.attributeFlags,
            minDeliveryDays:       tagPayload.minDeliveryDays,
            source: 'ai',
          }),
        });
        tagSubmitted = tRes.ok;
      }

      onPublishedToQueue();
      setStep(4);
      setDoneMessage(
        tagSubmitted
          ? 'コメントとタグの両方を承認待ちキューに送信しました。それぞれ承認後に公開されます。'
          : 'コメントを承認待ちキューに送信しました。承認後に公開されます。'
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const publishGeneral = async () => {
    if (!generalDraft.title || !generalDraft.content) return;
    setSubmitting(true);
    try {
      await fetch(`${API}/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generalDraft),
      });
      setStep(4);
      setDoneMessage('一般ナレッジを公開しました。一覧タブで確認できます。');
    } finally {
      setSubmitting(false);
    }
  };

  const StepBar = () => (
    <div className="flex items-center gap-2 mb-6">
      {[1, 2, 3, 4].map(i => {
        const labels = ['対象選択', 'AI下書き', '編集', '承認・公開'];
        const active = step === i;
        const done = step > i;
        return (
          <div key={i} className="flex-1 flex items-center gap-2">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                done ? 'bg-emerald-600 text-white' : active ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-400'
              }`}>
                {done ? <CheckCircle className="w-4 h-4" /> : i}
              </div>
              <p className={`text-[10px] mt-1 font-medium ${active || done ? 'text-stone-700' : 'text-stone-400'}`}>
                {labels[i - 1]}
              </p>
            </div>
            {i < 4 && <div className={`flex-1 h-0.5 ${done ? 'bg-emerald-600' : 'bg-stone-200'}`} />}
          </div>
        );
      })}
    </div>
  );

  if (step === 4 && doneMessage) {
    // 商品ナレッジ送信時のみ「承認待ちタブを開く」CTA を出す（一般ナレッジは即公開のため不要）
    const showQueueCTA = mode === 'product';
    const showTagAdminHint = false;  // 統合フローではコメントもタグも一括送信なので個別案内は不要
    return (
      <div className="bg-white border border-emerald-200 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-stone-800 mb-2" style={{ fontFamily: 'Noto Serif JP, serif' }}>
          完了しました
        </h3>
        <p className="text-sm text-stone-600 mb-2">{doneMessage}</p>
        {showQueueCTA && (
          <p className="text-[11px] text-stone-500 mb-6">
            承認待ちタブで反映状況をご確認いただけます。
          </p>
        )}
        {showTagAdminHint && (
          <p className="text-[11px] text-stone-500 mb-6">
            タグ承認は <strong>業務メニュー → 管理ダッシュボード → タグ承認</strong> から確認・承認できます。
          </p>
        )}
        {!showQueueCTA && !showTagAdminHint && <div className="mb-6" />}
        <div className="flex flex-col sm:flex-row gap-2 items-center justify-center">
          {showQueueCTA && (
            <button
              onClick={onJumpToQueue}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 transition-colors"
            >
              <Inbox className="w-4 h-4" />
              承認待ちタブを開く
            </button>
          )}
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:brightness-90"
            style={{ backgroundColor: 'var(--color-brand)', color: 'var(--color-brand-fg)' }}
          >
            <Wand2 className="w-4 h-4" />
            続けて別のナレッジを作成
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepBar />

      {/* Step 1: 対象選択 */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-stone-600 mb-4">どのナレッジを作成しますか？</p>
          <button
            onClick={() => { setMode('product'); setStep(2); }}
            className="w-full text-left p-5 rounded-2xl border-2 border-stone-200 bg-white hover:border-amber-400 hover:bg-amber-50/40 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-800">商品ナレッジ（二視点コメント + 贈答タグ）</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  二視点コメント（感性 / 経験知）と贈答タグ（シーン適合度・受け手・属性フラグ）を一括で AI 下書き。
                  それぞれ修正方向を指示して個別に再生成可能。
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-400" />
            </div>
          </button>
          <button
            onClick={() => { setMode('general'); setStep(3); }}
            className="w-full text-left p-5 rounded-2xl border-2 border-stone-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/40 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-800">一般ナレッジ（ルール・NG・優先ブランド）</p>
                <p className="text-xs text-stone-500 mt-0.5">のし礼法・シーンルール・NG事項などを直接記入して即公開</p>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-400" />
            </div>
          </button>
        </div>
      )}

      {/* Step 2: 商品選択 → AI 下書き生成 */}
      {step === 2 && mode === 'product' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-stone-600">対象の商品を選択してください</p>
            <button onClick={() => setStep(1)} className="text-xs text-stone-500 hover:text-stone-800">← 戻る</button>
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="商品名・ブランド・カテゴリで検索"
              className="w-full h-10 pl-9 pr-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
            {products
              .filter(p => {
                const kw = productSearch.toLowerCase();
                if (!kw) return true;
                return p.name.toLowerCase().includes(kw)
                  || (p.brand ?? '').toLowerCase().includes(kw)
                  || (p.category ?? '').toLowerCase().includes(kw);
              })
              .map(p => {
                const picked = pickedProduct?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPickedProduct(p)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      picked ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-white hover:border-amber-300'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        : <Sparkles className="w-5 h-5 text-stone-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-stone-500">
                        {p.brand ?? ''}{p.brand && p.category ? ' / ' : ''}{p.category ?? ''}
                      </p>
                      <p className="text-[10px] text-stone-400">¥{p.price.toLocaleString()}</p>
                    </div>
                  </button>
                );
              })}
          </div>
          {errorMsg && (
            <p className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">{errorMsg}</p>
          )}

          {/* 視点選択: どの視点でコメントを登録するか */}
          <div className="mt-5 bg-stone-50 border border-stone-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-600" />
              どの視点で登録しますか？（選んだ視点が編集可能になります）
            </p>
            <p className="text-[10px] text-stone-500 mb-2">
              ※ <strong>感性のみ</strong> / <strong>経験知のみ</strong> を選んだ場合、もう一方の側は
              前回の内容に関わらず空にリセットされます。両視点を残したい時は「両方」を選択してください。
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              {([
                { v: 'sensory'    as const, label: '感性視点',   sub: '受け手の心が動く瞬間を描く', tone: 'rose' },
                { v: 'experience' as const, label: '経験知視点', sub: '失敗しない選び方の根拠',     tone: 'blue' },
                { v: 'both'       as const, label: '両方',       sub: '感性 ＋ 経験知 を同時に登録', tone: 'amber' },
              ]).map(o => {
                const active = viewpoint === o.v;
                return (
                  <button
                    key={o.v}
                    onClick={() => setViewpoint(o.v)}
                    className={`text-left p-3 rounded-lg border-2 transition-all ${
                      active
                        ? o.tone === 'rose'  ? 'border-rose-400 bg-rose-50'
                        : o.tone === 'blue'  ? 'border-blue-400 bg-blue-50'
                        :                      'border-amber-400 bg-amber-50'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${
                      active
                        ? o.tone === 'rose' ? 'text-rose-700' : o.tone === 'blue' ? 'text-blue-700' : 'text-amber-700'
                        : 'text-stone-700'
                    }`}>
                      {active && '● '}{!active && '○ '}{o.label}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5">{o.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={generateDraft}
              disabled={!pickedProduct || generating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:bg-stone-200 disabled:text-stone-400 hover:brightness-90"
              style={(!pickedProduct || generating) ? {} : { backgroundColor: 'var(--color-brand)', color: 'var(--color-brand-fg)' }}
            >
              {generating ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              AI コメント下書きを生成
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 編集 (商品ナレッジ = コメント + タグ) */}
      {step === 3 && mode === 'product' && generated && pickedProduct && (
        <ProductKnowledgeEditor
          product={pickedProduct}
          viewpoint={viewpoint}
          sensoryDraft={sensoryDraft}
          experienceDraft={experienceDraft}
          onSensoryChange={setSensoryDraft}
          onExperienceChange={setExperienceDraft}
          tagPayload={tagPayload}
          onTagChange={setTagPayload}
          confidenceScore={generated.confidenceScore ?? null}
          attemptNo={generated.attemptNo ?? null}
          onBack={() => setStep(2)}
          onRegenerateComment={regenerateComment}
          onRegenerateTags={regenerateTags}
          regeneratingComment={generating}
          regeneratingTags={suggestingTags}
          onSubmit={submitProductComments}
          submitting={submitting}
        />
      )}

      {/* Step 3: 編集 (一般ナレッジ) */}
      {step === 3 && mode === 'general' && (
        <GeneralKnowledgeEditor
          draft={generalDraft}
          onChange={setGeneralDraft}
          me={me}
          onBack={() => setStep(1)}
          onSubmit={publishGeneral}
          submitting={submitting}
        />
      )}
    </div>
  );
}


// ============================================================================
// 商品ナレッジ統合エディタ: コメント + タグ を1画面で編集 + それぞれ AI 再生成
// ============================================================================

function ProductKnowledgeEditor({
  product, viewpoint,
  sensoryDraft, experienceDraft, onSensoryChange, onExperienceChange,
  tagPayload, onTagChange,
  confidenceScore, attemptNo,
  onBack,
  onRegenerateComment, onRegenerateTags,
  regeneratingComment, regeneratingTags,
  onSubmit, submitting,
}: {
  product: Product;
  viewpoint: ViewpointChoice;
  sensoryDraft: string;
  experienceDraft: string;
  onSensoryChange: (v: string) => void;
  onExperienceChange: (v: string) => void;
  tagPayload: SuggestedTags | null;
  onTagChange: (p: SuggestedTags) => void;
  confidenceScore: number | null;
  attemptNo: number | null;
  onBack: () => void;
  onRegenerateComment: (feedback: string) => void;
  onRegenerateTags: (feedback: string) => void;
  regeneratingComment: boolean;
  regeneratingTags: boolean;
  onSubmit: (payload: { sensory?: string; experience?: string }) => void;
  submitting: boolean;
}) {
  // 副視点(非選択側)を任意で有効化するトグル
  const [enableSecondary, setEnableSecondary] = useState(viewpoint === 'both');
  const sensoryActive    = viewpoint === 'sensory'    || viewpoint === 'both' || (viewpoint === 'experience' && enableSecondary);
  const experienceActive = viewpoint === 'experience' || viewpoint === 'both' || (viewpoint === 'sensory'    && enableSecondary);
  const sensoryPrimary    = viewpoint === 'sensory'    || viewpoint === 'both';
  const experiencePrimary = viewpoint === 'experience' || viewpoint === 'both';

  // 個別再生成プロンプト
  const [commentFeedback, setCommentFeedback] = useState('');
  const [tagFeedback, setTagFeedback] = useState('');

  const handleSubmit = () => {
    const payload: { sensory?: string; experience?: string } = {};
    if (sensoryActive)    payload.sensory    = sensoryDraft;
    if (experienceActive) payload.experience = experienceDraft;
    onSubmit(payload);
  };

  const canSubmit =
    (sensoryPrimary    ? sensoryDraft.trim().length    > 0 : true) &&
    (experiencePrimary ? experienceDraft.trim().length > 0 : true) &&
    (sensoryActive    && !sensoryPrimary    ? sensoryDraft.trim().length    > 0 : true) &&
    (experienceActive && !experiencePrimary ? experienceDraft.trim().length > 0 : true);

  // タグ編集ハンドラ
  const setSceneLevel = (sceneKey: string, level: number) => {
    if (!tagPayload) return;
    onTagChange({ ...tagPayload, sceneCompatibility: { ...tagPayload.sceneCompatibility, [sceneKey]: level } });
  };
  const setAudienceLevel = (audKey: string, level: number) => {
    if (!tagPayload) return;
    const next = { ...tagPayload.audienceCompatibility };
    if (level === 0) delete next[audKey]; else next[audKey] = level;
    onTagChange({ ...tagPayload, audienceCompatibility: next });
  };
  const toggleFlag = (flagKey: string) => {
    if (!tagPayload) return;
    const cur = tagPayload.attributeFlags;
    onTagChange({ ...tagPayload, attributeFlags: cur.includes(flagKey) ? cur.filter(f => f !== flagKey) : [...cur, flagKey] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-stone-600">AI 下書きを確認・編集してください（コメント + タグを一括登録）</p>
        <button onClick={onBack} className="text-xs text-stone-500 hover:text-stone-800">← 戻る</button>
      </div>

      {/* 商品サマリー */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-white overflow-hidden flex-shrink-0 flex items-center justify-center">
          {product.imageUrl
            ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            : <Sparkles className="w-5 h-5 text-amber-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-800 truncate">{product.name}</p>
          <p className="text-[11px] text-stone-500">{product.brand} / ¥{product.price.toLocaleString()}</p>
        </div>
        {confidenceScore != null && (
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-stone-500">信頼度</p>
            <p className="text-sm font-bold text-amber-700">{confidenceScore}</p>
            {attemptNo != null && attemptNo > 1 && (
              <p className="text-[10px] text-stone-400">試行 {attemptNo} 回目</p>
            )}
          </div>
        )}
      </div>

      {/* ─── コメントセクション ─────────────────────────────── */}
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-4 mb-5">
        <p className="text-xs font-bold text-amber-800 mb-3 flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          二視点コメント
        </p>

        {sensoryActive && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-600" />
                <p className="text-sm font-semibold text-stone-800">
                  感性視点 <span className="text-xs text-rose-700/80 font-normal">— 受け手の心が動く瞬間を描く</span>
                </p>
              </div>
              {sensoryPrimary && <span className="text-[10px] bg-rose-100 text-rose-700 border border-rose-300 px-2 py-0.5 rounded-full font-medium">主視点</span>}
              {!sensoryPrimary && sensoryActive && <span className="text-[10px] bg-stone-100 text-stone-600 border border-stone-300 px-2 py-0.5 rounded-full font-medium">追加で編集中</span>}
            </div>
            <textarea
              value={sensoryDraft}
              onChange={e => onSensoryChange(e.target.value)}
              rows={5}
              placeholder="瑞々しい感性で、受け手が箱を開けた瞬間の景色を 60〜100 字で描写"
              className="w-full text-sm border border-rose-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none leading-relaxed"
            />
            <p className="text-[10px] text-stone-500 mt-1">{sensoryDraft.length} 字</p>
          </div>
        )}

        {experienceActive && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-700" />
                <p className="text-sm font-semibold text-stone-800">
                  経験知視点 <span className="text-xs text-amber-700/80 font-normal">— 失敗しない選び方の根拠を示す</span>
                </p>
              </div>
              {experiencePrimary && <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-medium">主視点</span>}
              {!experiencePrimary && experienceActive && <span className="text-[10px] bg-stone-100 text-stone-600 border border-stone-300 px-2 py-0.5 rounded-full font-medium">追加で編集中</span>}
            </div>
            <textarea
              value={experienceDraft}
              onChange={e => onExperienceChange(e.target.value)}
              rows={5}
              placeholder="店頭経験から、選定の根拠（実績数字・成功事例・お声）を 60〜100 字で"
              className="w-full text-sm border border-amber-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none leading-relaxed"
            />
            <p className="text-[10px] text-stone-500 mt-1">{experienceDraft.length} 字</p>
          </div>
        )}

        {/* 副視点トグル */}
        {viewpoint !== 'both' && (
          <div className="flex items-center justify-between bg-white border border-stone-200 rounded-xl p-3 mb-3">
            <div className="text-xs">
              <p className="font-semibold text-stone-700">
                もう一方の視点（{viewpoint === 'sensory' ? '経験知' : '感性'}視点）も追加で登録しますか？
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnableSecondary(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${enableSecondary ? 'bg-amber-600' : 'bg-stone-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${enableSecondary ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        )}

        {/* コメント再生成パネル */}
        <RegeneratePanel
          tone="amber"
          label="コメントを AI で再生成"
          placeholder="例: もっと具体的な販売実績の数字を入れる / 弔事でも使える落ち着いたトーンに"
          feedback={commentFeedback}
          onFeedbackChange={setCommentFeedback}
          onRegenerate={() => onRegenerateComment(commentFeedback)}
          regenerating={regeneratingComment}
        />
      </div>

      {/* ─── タグセクション ─────────────────────────────── */}
      {tagPayload && (
        <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/30 p-4 mb-5">
          <p className="text-xs font-bold text-violet-800 mb-3 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            贈答タグ
            {tagPayload.minDeliveryDays != null && (
              <span className="ml-auto text-[10px] text-violet-600">最短納期 {tagPayload.minDeliveryDays} 日</span>
            )}
          </p>

          {/* シーン適合度 */}
          <div className="bg-white border border-stone-200 rounded-xl p-3 mb-3">
            <p className="text-xs font-semibold text-stone-700 mb-2">シーン適合度（13 シーン × 5 段階）</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {TAG_SCENES.map(s => {
                const level = nearestSceneLevel(tagPayload.sceneCompatibility[s.key]);
                return (
                  <div key={s.key} className="bg-stone-50 border border-stone-100 rounded-lg p-2">
                    <p className="text-xs font-medium text-stone-700 mb-1.5">{s.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {SCENE_LEVELS.map(L => (
                        <button
                          key={L.value}
                          onClick={() => setSceneLevel(s.key, L.value)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            level === L.value ? L.chip + ' font-bold' : 'bg-white text-stone-400 border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          {L.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 受け手 */}
          <div className="bg-white border border-stone-200 rounded-xl p-3 mb-3">
            <p className="text-xs font-semibold text-stone-700 mb-2">受け手適合度（0 で削除）</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {TAG_AUDIENCES.map(a => (
                <div key={a.key} className="flex items-center gap-3 bg-stone-50 border border-stone-100 rounded-lg p-2">
                  <span className="text-xs font-medium text-stone-700 w-24 flex-shrink-0">{a.label}</span>
                  <input
                    type="range" min={0} max={100} step={10}
                    value={tagPayload.audienceCompatibility[a.key] ?? 0}
                    onChange={e => setAudienceLevel(a.key, parseInt(e.target.value, 10))}
                    className="flex-1 accent-violet-600"
                  />
                  <span className="text-xs text-stone-500 w-8 text-right">{tagPayload.audienceCompatibility[a.key] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 属性フラグ */}
          <div className="bg-white border border-stone-200 rounded-xl p-3 mb-3">
            <p className="text-xs font-semibold text-stone-700 mb-2">属性フラグ</p>
            <div className="flex flex-wrap gap-2">
              {TAG_FLAGS.map(f => {
                const on = tagPayload.attributeFlags.includes(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleFlag(f.key)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      on ? 'bg-violet-100 text-violet-800 border-violet-300 font-bold' : 'bg-white text-stone-500 border-stone-200 hover:border-violet-300'
                    }`}
                  >
                    {on ? '✓ ' : ''}{f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* タグ再生成パネル */}
          <RegeneratePanel
            tone="violet"
            label="タグを AI で再生成（4 層ロジック）"
            placeholder="例: ビジネスシーンを強める / 弔事適合度を見直す"
            feedback={tagFeedback}
            onFeedbackChange={setTagFeedback}
            onRegenerate={() => onRegenerateTags(tagFeedback)}
            regenerating={regeneratingTags}
          />
        </div>
      )}

      {/* 一括送信 */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:bg-stone-200 disabled:text-stone-400 hover:brightness-90"
          style={(submitting || !canSubmit) ? {} : { backgroundColor: 'var(--color-brand)', color: 'var(--color-brand-fg)' }}
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          コメントとタグを一括で承認待ちに送信
        </button>
      </div>
    </div>
  );
}

// インライン再生成パネル: コメント / タグそれぞれの下に配置
function RegeneratePanel({
  tone, label, placeholder, feedback, onFeedbackChange, onRegenerate, regenerating,
}: {
  tone: 'amber' | 'violet';
  label: string;
  placeholder: string;
  feedback: string;
  onFeedbackChange: (v: string) => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const themed = tone === 'amber'
    ? { btn: 'bg-amber-600 hover:bg-amber-700', border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' }
    : { btn: 'bg-violet-600 hover:bg-violet-700', border: 'border-violet-200', bg: 'bg-violet-50', text: 'text-violet-700' };
  return (
    <div className={`rounded-xl border ${themed.border} ${themed.bg} p-2.5`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between text-xs font-semibold ${themed.text}`}
      >
        <span className="inline-flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          {label}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <textarea
            value={feedback}
            onChange={e => onFeedbackChange(e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="w-full text-xs border border-stone-200 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none leading-relaxed"
          />
          <div className="flex justify-end">
            <button
              onClick={onRegenerate}
              disabled={regenerating}
              className={`text-xs px-3 py-1.5 rounded-lg text-white ${themed.btn} disabled:opacity-50 transition-colors inline-flex items-center gap-1.5`}
            >
              {regenerating ? (
                <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
              {feedback.trim() ? 'この方向で再生成' : 'AI でもう一度生成'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// 一般ナレッジ編集フォーム（直接公開）
function GeneralKnowledgeEditor({
  draft, onChange, me, onBack, onSubmit, submitting,
}: {
  draft: { category: string; title: string; content: string; priority: number; visibility: 'shared' | 'personal' };
  onChange: (d: typeof draft) => void;
  me: User;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-stone-600">ナレッジを直接記入して公開</p>
        <button onClick={onBack} className="text-xs text-stone-500 hover:text-stone-800">← 戻る</button>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-sm">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">カテゴリ</label>
            <select
              value={draft.category}
              onChange={e => onChange({ ...draft, category: e.target.value })}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
            >
              {KNOWLEDGE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">優先度 (1-10)</label>
            <input
              type="number" min={1} max={10}
              value={draft.priority}
              onChange={e => onChange({ ...draft, priority: parseInt(e.target.value) || 5 })}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">公開範囲</label>
            <div className="flex gap-1">
              {(['shared', 'personal'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange({ ...draft, visibility: v })}
                  className={`flex-1 text-xs h-8 rounded-lg border font-medium transition-colors ${
                    draft.visibility === v
                      ? v === 'shared'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-white text-stone-500 border-stone-200'
                  }`}
                >
                  {v === 'shared' ? '共有' : '個人'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">タイトル</label>
          <input
            value={draft.title}
            onChange={e => onChange({ ...draft, title: e.target.value })}
            placeholder="例: お中元のし表書きルール"
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">内容</label>
          <textarea
            value={draft.content}
            onChange={e => onChange({ ...draft, content: e.target.value })}
            rows={5}
            placeholder="コンシェルジュが参照する知識・ルールを記入"
            className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
        </div>
        {draft.visibility === 'personal' && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            個人ナレッジとして登録します。所有者は <strong>{me.displayName}</strong> となり、運用管理者とご本人のみ閲覧できます。
          </p>
        )}
        <div className="flex justify-end">
          <button
            onClick={onSubmit}
            disabled={!draft.title || !draft.content || submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:bg-stone-200 disabled:text-stone-400 hover:brightness-90"
            style={(!draft.title || !draft.content || submitting) ? {} : { backgroundColor: 'var(--color-brand)', color: 'var(--color-brand-fg)' }}
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            公開する
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 商品ナレッジ一覧パネル: 商品単位で「感性/経験知」の登録件数を可視化する学び合いビュー
// ============================================================================

type RegFilter = 'all' | 'sensory' | 'experience' | 'tag' | 'empty';

// 商品にタグが登録されているか
const hasAnyTag = (p: ProductWithKnowledge): boolean =>
  Object.keys(p.sceneCompatibility).length > 0
  || Object.keys(p.audienceCompatibility).length > 0
  || (p.attributeFlags ?? []).length > 0;

// 商品ごとの集計データ
type ProductWithKnowledge = {
  productId: number;
  productName: string;
  imageUrl?: string;
  brand?: string;
  category?: string;
  price: number;
  entries: ProductKnowledgeItem[];
  sensoryCount: number;
  experienceCount: number;
  // 承認済の贈答タグ (上書き運用なので 1 セット)
  sceneCompatibility: Record<string, number>;
  audienceCompatibility: Record<string, number>;
  attributeFlags: string[];
  minDeliveryDays?: number | null;
};

// 一覧の検索ボックス・フィルタ用の最小限の Product 型 (`/products` の戻り値)
type ProductLite = {
  id: number;
  name: string;
  imageUrl?: string;
  brand?: string;
  category?: string;
  price: number;
  sceneCompatibility?: Record<string, number>;
  audienceCompatibility?: Record<string, number>;
  attributeFlags?: string[];
  minDeliveryDays?: number | null;
};

function ProductKnowledgePanel({ me: _me }: { me: User }) {
  const [allProducts, setAllProducts] = useState<ProductLite[]>([]);
  const [entries, setEntries] = useState<ProductKnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RegFilter>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<ProductKnowledgeItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTagTarget, setEditTagTarget] = useState<ProductWithKnowledge | null>(null);
  const [editingTag, setEditingTag] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/products`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/knowledge/products`).then(r => r.ok ? r.json() : []),
    ])
      .then(([prods, ents]: [ProductLite[], ProductKnowledgeItem[]]) => {
        setAllProducts(Array.isArray(prods) ? prods : []);
        setEntries(Array.isArray(ents) ? ents : []);
        setLoading(false);
      })
      .catch(() => {
        setAllProducts([]); setEntries([]); setLoading(false);
      });
  }, []);

  // 商品 → エントリ集約
  const productList: ProductWithKnowledge[] = useMemo(() => {
    const map = new Map<number, ProductWithKnowledge>();
    for (const p of allProducts) {
      map.set(p.id, {
        productId: p.id,
        productName: p.name,
        imageUrl: p.imageUrl,
        brand: p.brand,
        category: p.category,
        price: p.price,
        entries: [],
        sensoryCount: 0,
        experienceCount: 0,
        sceneCompatibility:    p.sceneCompatibility    ?? {},
        audienceCompatibility: p.audienceCompatibility ?? {},
        attributeFlags:        p.attributeFlags        ?? [],
        minDeliveryDays:       p.minDeliveryDays       ?? null,
      });
    }
    for (const e of entries) {
      const pw = map.get(e.productId);
      if (!pw) continue;
      pw.entries.push(e);
      if (e.sensoryComment && e.sensoryComment.trim().length > 0) pw.sensoryCount++;
      if (e.experienceComment && e.experienceComment.trim().length > 0) pw.experienceCount++;
    }
    // 並び順: 未登録 → 件数少 → 多 で「足りないもの」が上に来るように
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.sensoryCount + a.experienceCount;
      const tb = b.sensoryCount + b.experienceCount;
      return ta - tb;
    });
  }, [allProducts, entries]);

  const counts = useMemo(() => ({
    all: productList.length,
    sensory: productList.filter(p => p.sensoryCount > 0).length,
    experience: productList.filter(p => p.experienceCount > 0).length,
    tag: productList.filter(hasAnyTag).length,
    empty: productList.filter(p => p.entries.length === 0 && !hasAnyTag(p)).length,
  }), [productList]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return productList.filter(p => {
      if (filter === 'sensory'    && p.sensoryCount === 0) return false;
      if (filter === 'experience' && p.experienceCount === 0) return false;
      if (filter === 'tag'        && !hasAnyTag(p)) return false;
      if (filter === 'empty'      && (p.entries.length > 0 || hasAnyTag(p))) return false;
      if (!kw) return true;
      return p.productName.toLowerCase().includes(kw)
        || (p.brand ?? '').toLowerCase().includes(kw)
        || (p.category ?? '').toLowerCase().includes(kw)
        || p.entries.some(e =>
            (e.creatorName ?? '').toLowerCase().includes(kw)
            || (e.sensoryComment ?? '').toLowerCase().includes(kw)
            || (e.experienceComment ?? '').toLowerCase().includes(kw)
          );
    });
  }, [productList, search, filter]);

  return (
    <div>
      {/* 学び合いの説明バナー */}
      <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="flex -space-x-1.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-rose-200 border-2 border-white flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-rose-700" />
            </div>
            <div className="w-8 h-8 rounded-full bg-amber-200 border-2 border-white flex items-center justify-center">
              <Award className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-stone-800" style={{ fontFamily: 'Noto Serif JP, serif' }}>
              ジュニアとシニアがナレッジで学び合う
            </p>
            <p className="text-[11px] text-stone-600 leading-relaxed mt-0.5">
              承認済みの商品コメントを商品単位でまとめて表示します。各商品で <strong>感性</strong> と <strong>経験知</strong> がそれぞれ何件登録されているかを把握し、未登録の商品から優先して取り組めます。
            </p>
          </div>
        </div>
      </div>

      {/* フィルタ */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="商品名・ブランド・カテゴリ・コメント内容で検索"
            className="w-full h-10 pl-9 pr-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          />
        </div>
        <div className="inline-flex bg-white border border-stone-200 rounded-xl p-1 flex-wrap">
          {([
            { key: 'all',        label: `全て (${counts.all})` },
            { key: 'sensory',    label: `感性あり (${counts.sensory})` },
            { key: 'experience', label: `経験知あり (${counts.experience})` },
            { key: 'tag',        label: `タグあり (${counts.tag})` },
            { key: 'empty',      label: `未登録 (${counts.empty})` },
          ] as { key: RegFilter; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 h-8 text-xs rounded-lg font-medium transition-colors ${
                filter === t.key ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="w-7 h-7 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-stone-200" />
          <p className="text-sm text-stone-400">該当する商品がありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <ProductKnowledgeCard
              key={p.productId}
              p={p}
              expanded={expandedId === p.productId}
              onToggle={() => setExpandedId(prev => prev === p.productId ? null : p.productId)}
              onEdit={setEditTarget}
              onEditTag={setEditTagTarget}
            />
          ))}
        </div>
      )}

      {/* 商品コメントのインライン編集モーダル */}
      {editTarget && (
        <ProductKnowledgeEditModal
          item={{
            metaId: editTarget.metaId,
            productName: editTarget.productName,
            brand: editTarget.brand,
            price: editTarget.price,
            sensoryComment: editTarget.sensoryComment,
            experienceComment: editTarget.experienceComment,
          }}
          processing={editing}
          onCancel={() => setEditTarget(null)}
          onSubmit={async (sensory, experience) => {
            setEditing(true);
            try {
              await fetch(`${API}/metadata/${editTarget.metaId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sensoryComment: sensory, experienceComment: experience }),
              });
              setEditTarget(null);
              // 再取得
              fetch(`${API}/knowledge/products`)
                .then(r => r.ok ? r.json() : [])
                .then((d: ProductKnowledgeItem[]) => setEntries(Array.isArray(d) ? d : []));
            } finally {
              setEditing(false);
            }
          }}
        />
      )}

      {/* 商品タグのインライン編集モーダル（直接上書き） */}
      {editTagTarget && (
        <TagEditModal
          target={editTagTarget}
          processing={editingTag}
          onCancel={() => setEditTagTarget(null)}
          onSubmit={async (payload) => {
            setEditingTag(true);
            try {
              await fetch(`${API}/products/${editTagTarget.productId}/tags/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              setEditTagTarget(null);
              // /products を再取得（タグは products 列から来る）
              fetch(`${API}/products`)
                .then(r => r.ok ? r.json() : [])
                .then((d: ProductLite[]) => setAllProducts(Array.isArray(d) ? d : []));
            } finally {
              setEditingTag(false);
            }
          }}
        />
      )}
    </div>
  );
}

// 商品タグのインライン編集モーダル: シーン適合度 / 受け手 / フラグ / 最短納期を編集して直接保存
// 汎用ターゲット型: 商品ナレッジ一覧 / 承認待ちキュー どちらの編集にも使える
type TagEditTarget = {
  productName: string;
  brand?: string;
  price: number;
  sceneCompatibility: Record<string, number>;
  audienceCompatibility: Record<string, number>;
  attributeFlags: string[];
  minDeliveryDays?: number | null;
};

function TagEditModal({
  target, processing, onCancel, onSubmit, hint,
}: {
  target: TagEditTarget;
  processing: boolean;
  onCancel: () => void;
  onSubmit: (payload: SuggestedTags) => void;
  hint?: string;  // 保存先の説明（即時反映 / 承認待ち更新 など）
}) {
  const [draft, setDraft] = useState<SuggestedTags>({
    sceneCompatibility:    { ...target.sceneCompatibility },
    audienceCompatibility: { ...target.audienceCompatibility },
    attributeFlags:        [...(target.attributeFlags ?? [])],
    minDeliveryDays:       target.minDeliveryDays ?? null,
  });

  const setSceneLevel = (key: string, level: number) =>
    setDraft(p => ({ ...p, sceneCompatibility: { ...p.sceneCompatibility, [key]: level } }));
  const setAudienceLevel = (key: string, level: number) => {
    setDraft(p => {
      const next = { ...p.audienceCompatibility };
      if (level === 0) delete next[key]; else next[key] = level;
      return { ...p, audienceCompatibility: next };
    });
  };
  const toggleFlag = (key: string) =>
    setDraft(p => ({
      ...p,
      attributeFlags: p.attributeFlags.includes(key)
        ? p.attributeFlags.filter(f => f !== key)
        : [...p.attributeFlags, key],
    }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Edit3 className="w-4 h-4 text-stone-700 flex-shrink-0" />
            <p className="text-sm font-semibold text-stone-800 truncate">贈答タグを編集</p>
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-lg p-3">
            <p className="font-medium text-stone-700 mb-0.5">対象: {target.productName}</p>
            <p className="text-[11px]">{target.brand} / ¥{target.price.toLocaleString()}</p>
          </div>

          {/* シーン */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-violet-800 mb-2">シーン適合度（13 シーン × 5 段階）</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {TAG_SCENES.map(s => {
                const level = nearestSceneLevel(draft.sceneCompatibility[s.key]);
                return (
                  <div key={s.key} className="bg-white border border-stone-100 rounded-lg p-2">
                    <p className="text-xs font-medium text-stone-700 mb-1.5">{s.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {SCENE_LEVELS.map(L => (
                        <button
                          key={L.value}
                          onClick={() => setSceneLevel(s.key, L.value)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            level === L.value ? L.chip + ' font-bold' : 'bg-white text-stone-400 border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          {L.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 受け手 */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-stone-700 mb-2">受け手適合度（0 で削除）</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {TAG_AUDIENCES.map(a => (
                <div key={a.key} className="flex items-center gap-3 bg-white border border-stone-100 rounded-lg p-2">
                  <span className="text-xs font-medium text-stone-700 w-24 flex-shrink-0">{a.label}</span>
                  <input
                    type="range" min={0} max={100} step={10}
                    value={draft.audienceCompatibility[a.key] ?? 0}
                    onChange={e => setAudienceLevel(a.key, parseInt(e.target.value, 10))}
                    className="flex-1 accent-violet-600"
                  />
                  <span className="text-xs text-stone-500 w-8 text-right">{draft.audienceCompatibility[a.key] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* フラグ */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-stone-700 mb-2">属性フラグ</p>
            <div className="flex flex-wrap gap-2">
              {TAG_FLAGS.map(f => {
                const on = draft.attributeFlags.includes(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleFlag(f.key)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      on ? 'bg-violet-100 text-violet-800 border-violet-300 font-bold' : 'bg-white text-stone-500 border-stone-200 hover:border-violet-300'
                    }`}
                  >
                    {on ? '✓ ' : ''}{f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 最短納期 */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 flex items-center gap-3">
            <span className="text-xs font-semibold text-stone-700">最短納期 (日)</span>
            <input
              type="number" min={0}
              value={draft.minDeliveryDays ?? ''}
              onChange={e => setDraft(p => ({ ...p, minDeliveryDays: e.target.value ? parseInt(e.target.value, 10) : null }))}
              placeholder="未設定なら空欄"
              className="w-24 text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          <p className="text-[11px] text-stone-500 bg-stone-50 border border-stone-100 rounded-lg p-2">
            ※ {hint ?? 'タグは商品ごとに 1 セットの上書き運用です。保存すると承認キューを介さず即時に商品マスタへ反映されます。'}
          </p>
        </div>
        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2 flex-shrink-0">
          <button onClick={onCancel} disabled={processing} className="text-xs px-4 py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-white disabled:opacity-50 transition-colors">
            キャンセル
          </button>
          <button
            onClick={() => onSubmit(draft)}
            disabled={processing}
            className="text-xs px-4 py-2 rounded-lg text-white bg-violet-600 hover:bg-violet-700 disabled:bg-stone-300 transition-colors inline-flex items-center gap-1.5"
          >
            {processing ? (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-3 h-3" />
            )}
            保存（即時反映）
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductKnowledgeCard({
  p, expanded, onToggle, onEdit, onEditTag,
}: {
  p: ProductWithKnowledge;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: (e: ProductKnowledgeItem) => void;
  onEditTag?: (p: ProductWithKnowledge) => void;
}) {
  const hasComments = p.entries.length > 0;
  const hasTags =
    Object.keys(p.sceneCompatibility).length > 0
    || Object.keys(p.audienceCompatibility).length > 0
    || (p.attributeFlags ?? []).length > 0;
  const isEmpty = !hasComments && !hasTags;
  return (
    <div className={`rounded-2xl border ${isEmpty ? 'border-stone-200 bg-stone-50/60' : 'border-stone-200 bg-white'} overflow-hidden`}>
      <button
        onClick={isEmpty ? undefined : onToggle}
        disabled={isEmpty}
        className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${
          isEmpty ? 'cursor-default' : 'hover:bg-stone-50'
        }`}
      >
        <div className="w-14 h-14 rounded-lg bg-white border border-stone-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {p.imageUrl
            ? <img src={p.imageUrl} alt={p.productName} className="w-full h-full object-cover" />
            : <Sparkles className="w-5 h-5 text-stone-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${isEmpty ? 'text-stone-500' : 'text-stone-800'}`}>{p.productName}</p>
          <p className="text-[11px] text-stone-500">
            {p.brand}{p.brand && p.category ? ' / ' : ''}{p.category} / ¥{p.price.toLocaleString()}
          </p>
          {/* 件数バッジ */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <CountBadge label="感性" count={p.sensoryCount} tone="rose" />
            <CountBadge label="経験知" count={p.experienceCount} tone="amber" />
            <TagBadge hasTags={hasTags} />
            {isEmpty && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200 font-medium">
                未登録
              </span>
            )}
          </div>
        </div>
        {!isEmpty && (
          <ChevronDown className={`w-4 h-4 text-stone-400 mt-1 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        )}
      </button>

      {expanded && !isEmpty && (
        <div className="border-t border-stone-100 bg-stone-50/50 p-3 space-y-2.5">
          {hasTags && <TagSummaryBlock p={p} onEdit={onEditTag} />}
          {!hasTags && onEditTag && (
            <button
              onClick={() => onEditTag(p)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-violet-200 text-violet-700 bg-violet-50/50 hover:bg-violet-50 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Tag className="w-3.5 h-3.5" />
              贈答タグを登録する
            </button>
          )}
          {p.entries.map(e => <EntryRow key={e.metaId} e={e} onEdit={onEdit} />)}
        </div>
      )}
    </div>
  );
}

// 商品ナレッジ一覧用: タグの登録有無バッジ
function TagBadge({ hasTags }: { hasTags: boolean }) {
  if (hasTags) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-medium inline-flex items-center gap-0.5">
        <Tag className="w-2.5 h-2.5" />
        タグ <strong className="font-bold">登録済</strong>
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-400 border border-stone-200 font-medium inline-flex items-center gap-0.5">
      <Tag className="w-2.5 h-2.5" />
      タグ未登録
    </span>
  );
}

// 商品ナレッジ一覧 展開時: 承認済タグの詳細サマリ
function TagSummaryBlock({ p, onEdit }: { p: ProductWithKnowledge; onEdit?: (p: ProductWithKnowledge) => void }) {
  const sceneLabel = (k: string) => TAG_SCENES.find(s => s.key === k)?.label ?? k;
  const audLabel = (k: string) => TAG_AUDIENCES.find(a => a.key === k)?.label ?? k;
  const flagLabel = (k: string) => TAG_FLAGS.find(f => f.key === k)?.label ?? k;

  const topScenes = Object.entries(p.sceneCompatibility)
    .filter(([, v]) => v >= 70)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const ngScenes = Object.entries(p.sceneCompatibility).filter(([, v]) => v < 0);
  const topAudiences = Object.entries(p.audienceCompatibility)
    .filter(([, v]) => v >= 60)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="bg-white border border-violet-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold text-violet-800 inline-flex items-center gap-1">
          <Tag className="w-3 h-3" />
          贈答タグ <span className="text-stone-500 font-normal">（承認済 / 上書き運用）</span>
        </p>
        {onEdit && (
          <button
            onClick={() => onEdit(p)}
            className="text-[10px] px-2 py-1 rounded-md border border-violet-200 text-violet-700 bg-white hover:bg-violet-50 transition-colors inline-flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            編集
          </button>
        )}
      </div>
      <div className="space-y-1.5 text-xs">
        {topScenes.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-violet-700 font-semibold w-16 flex-shrink-0">推奨</span>
            <div className="flex flex-wrap gap-1">
              {topScenes.map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-stone-700">
                  {sceneLabel(k)} <strong className="text-violet-700">{v}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
        {ngScenes.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-rose-700 font-semibold w-16 flex-shrink-0">NG</span>
            <div className="flex flex-wrap gap-1">
              {ngScenes.map(([k]) => (
                <span key={k} className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                  {sceneLabel(k)}
                </span>
              ))}
            </div>
          </div>
        )}
        {topAudiences.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-stone-600 font-semibold w-16 flex-shrink-0">受け手</span>
            <div className="flex flex-wrap gap-1">
              {topAudiences.map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-700">
                  {audLabel(k)} <strong className="text-stone-600">{v}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
        {(p.attributeFlags ?? []).length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-stone-600 font-semibold w-16 flex-shrink-0">フラグ</span>
            <div className="flex flex-wrap gap-1">
              {p.attributeFlags.map(f => (
                <span key={f} className="px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-600">
                  {flagLabel(f)}
                </span>
              ))}
            </div>
          </div>
        )}
        {p.minDeliveryDays != null && (
          <p className="text-[11px] text-stone-500">最短納期 {p.minDeliveryDays} 日</p>
        )}
      </div>
    </div>
  );
}

function CountBadge({
  label, count, tone,
}: {
  label: string; count: number; tone: 'rose' | 'amber';
}) {
  const empty = count === 0;
  if (empty) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-400 border border-stone-200 font-medium">
        {label} 0 件
      </span>
    );
  }
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
      tone === 'rose'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-amber-50 text-amber-700 border-amber-200'
    }`}>
      {label} <strong className="font-bold">{count}</strong> 件
    </span>
  );
}

// 折りたたみ展開時の個別エントリ行
function EntryRow({ e, onEdit }: { e: ProductKnowledgeItem; onEdit?: (e: ProductKnowledgeItem) => void }) {
  const rank = rankBadge(e.creatorRole);
  const senior = rank.tone === 'senior';
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-3">
      {/* 執筆者 */}
      {e.creatorName && (
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full overflow-hidden bg-stone-100 flex items-center justify-center flex-shrink-0">
            {e.creatorAvatar
              ? <img src={e.creatorAvatar} alt={e.creatorName} className="w-full h-full object-cover" />
              : <span className={`text-[9px] font-bold ${senior ? 'text-amber-700' : 'text-rose-700'}`}>{e.creatorName.slice(0, 2)}</span>}
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
            senior ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {senior
              ? <span className="inline-flex items-center gap-0.5"><Award className="w-2.5 h-2.5" />シニア</span>
              : <span className="inline-flex items-center gap-0.5"><GraduationCap className="w-2.5 h-2.5" />ジュニア</span>}
          </span>
          <span className="text-[11px] text-stone-700 font-medium">{e.creatorName}</span>
          {e.creatorYears != null && <span className="text-[10px] text-stone-400">経験 {e.creatorYears} 年</span>}
        </div>
      )}

      {/* コメント二視点: 登録済の側だけ表示 */}
      {(() => {
        const hasS = !!(e.sensoryComment && e.sensoryComment.trim());
        const hasE = !!(e.experienceComment && e.experienceComment.trim());
        if (!hasS && !hasE) return null;
        const cols = (hasS && hasE) ? 'sm:grid-cols-2' : 'grid-cols-1';
        return (
          <div className={`grid ${cols} gap-2`}>
            {hasS && (
              <div className="rounded-lg p-2 border bg-rose-50 border-rose-200">
                <p className="text-[9px] tracking-widest text-rose-700 font-bold mb-1">SENSORY 感性視点</p>
                <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">{e.sensoryComment}</p>
              </div>
            )}
            {hasE && (
              <div className="rounded-lg p-2 border bg-amber-50 border-amber-200">
                <p className="text-[9px] tracking-widest text-amber-700 font-bold mb-1">EXPERIENCE 経験知視点</p>
                <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">{e.experienceComment}</p>
              </div>
            )}
          </div>
        );
      })()}

      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-stone-100">
        <div className="flex items-center gap-2 text-[10px] text-stone-400">
          {e.confidenceScore != null && <span>信頼度 {e.confidenceScore}</span>}
          {e.attemptNo != null && e.attemptNo > 1 && <span>試行 {e.attemptNo} 回</span>}
          {e.approverName && (
            <span>承認: {e.approverName}{e.approverRole ? `（${rankBadge(e.approverRole).label}）` : ''}</span>
          )}
        </div>
        {onEdit && (
          <button
            onClick={() => onEdit(e)}
            className="text-[10px] px-2 py-1 rounded-md border border-stone-200 text-stone-600 bg-white hover:bg-stone-50 hover:border-amber-300 transition-colors inline-flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            編集
          </button>
        )}
      </div>
    </div>
  );
}

// 商品ナレッジ一覧 / 承認待ちタブ共通: 商品コメント (metadata) のインライン編集モーダル
function ProductKnowledgeEditModal({
  item, processing, onCancel, onSubmit,
}: {
  item: { metaId: number; productName: string; brand?: string; price: number; sensoryComment: string | null; experienceComment: string | null };
  processing: boolean;
  onCancel: () => void;
  onSubmit: (sensory: string, experience: string) => void;
}) {
  const [sensory, setSensory] = useState(item.sensoryComment ?? '');
  const [experience, setExperience] = useState(item.experienceComment ?? '');
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Edit3 className="w-4 h-4 text-stone-700 flex-shrink-0" />
            <p className="text-sm font-semibold text-stone-800 truncate">商品コメントを編集</p>
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-lg p-3">
            <p className="font-medium text-stone-700 mb-0.5">対象: {item.productName}</p>
            <p className="text-[11px]">{item.brand} / ¥{item.price.toLocaleString()}</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-stone-800 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-600" />
              感性視点
            </p>
            <textarea
              value={sensory}
              onChange={e => setSensory(e.target.value)}
              rows={4}
              placeholder="未登録の場合は空のまま"
              className="w-full text-sm border border-rose-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none leading-relaxed"
            />
            <p className="text-[10px] text-stone-500 mt-1">{sensory.length} 字</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-stone-800 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-700" />
              経験知視点
            </p>
            <textarea
              value={experience}
              onChange={e => setExperience(e.target.value)}
              rows={4}
              placeholder="未登録の場合は空のまま"
              className="w-full text-sm border border-amber-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none leading-relaxed"
            />
            <p className="text-[10px] text-stone-500 mt-1">{experience.length} 字</p>
          </div>
          <p className="text-[11px] text-stone-500 bg-stone-50 border border-stone-100 rounded-lg p-2">
            ※ 承認状態（承認済 / 承認待ち）は変えずに本文のみ更新します。承認済の場合はそのまま公開反映、承認待ちの場合はキューに留まります。
          </p>
        </div>
        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2 flex-shrink-0">
          <button onClick={onCancel} disabled={processing} className="text-xs px-4 py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-white disabled:opacity-50 transition-colors">
            キャンセル
          </button>
          <button
            onClick={() => onSubmit(sensory, experience)}
            disabled={processing}
            className="text-xs px-4 py-2 rounded-lg text-white bg-stone-700 hover:bg-stone-800 disabled:bg-stone-300 transition-colors inline-flex items-center gap-1.5"
          >
            {processing ? (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-3 h-3" />
            )}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// 一覧パネル: 既存の一般ナレッジを閲覧・トグル・削除
// ============================================================================

type ListFilter = 'all' | 'shared' | 'personal';

function ListPanel({ me }: { me: User }) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [editTarget, setEditTarget] = useState<KnowledgeItem | null>(null);
  const [editing, setEditing] = useState(false);

  const isAdmin = me.role === 'admin';
  const isConcierge = me.role === 'concierge_senior' || me.role === 'concierge_junior';

  const load = () => {
    setLoading(true);
    fetch(`${API}/knowledge`).then(r => r.json()).then(d => { setItems(d); setLoading(false); });
  };
  useEffect(load, [me.id]);

  const saveEdit = async (id: number, draft: { title: string; content: string; category: string; priority: number; visibility: 'shared' | 'personal' }) => {
    setEditing(true);
    try {
      await fetch(`${API}/knowledge/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      setEditTarget(null);
      load();
    } finally {
      setEditing(false);
    }
  };

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return items.filter(k => {
      if (filter !== 'all' && k.visibility !== filter) return false;
      if (!kw) return true;
      return k.title.toLowerCase().includes(kw)
        || k.content.toLowerCase().includes(kw)
        || (k.ownerName ?? '').toLowerCase().includes(kw);
    });
  }, [items, filter, search]);

  const toggle = async (id: number) => {
    await fetch(`${API}/knowledge/${id}/toggle`, { method: 'PATCH' });
    load();
  };
  const remove = async (id: number) => {
    await fetch(`${API}/knowledge/${id}`, { method: 'DELETE' });
    load();
  };
  const canEdit = (k: KnowledgeItem) =>
    isAdmin || (isConcierge && (k.visibility === 'shared' || k.ownedByConciergeId === me.id));

  const sharedCount = items.filter(k => k.visibility === 'shared').length;
  const personalCount = items.filter(k => k.visibility === 'personal').length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="タイトル・内容・所有者で検索"
            className="w-full h-10 pl-9 pr-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          />
        </div>
        <div className="inline-flex bg-white border border-stone-200 rounded-xl p-1">
          {([
            { key: 'all',      label: `全て (${items.length})` },
            { key: 'shared',   label: `共有 (${sharedCount})` },
            { key: 'personal', label: `個人 (${personalCount})` },
          ] as { key: ListFilter; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 h-8 text-xs rounded-lg font-medium transition-colors ${
                filter === t.key ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="w-7 h-7 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-3 text-stone-200" />
          <p className="text-sm text-stone-400">該当するナレッジはありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(k => {
            const editable = canEdit(k);
            return (
              <div
                key={k.id}
                className={`bg-white border rounded-xl px-4 py-3 flex items-start gap-3 ${
                  k.visibility === 'personal' ? 'border-amber-200' : 'border-stone-200'
                } ${!k.isActive ? 'opacity-50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                      k.visibility === 'shared'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {k.visibility === 'shared'
                        ? <span className="inline-flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />共有</span>
                        : <span className="inline-flex items-center gap-0.5"><UserIcon className="w-2.5 h-2.5" />個人</span>}
                    </span>
                    <span className="text-[10px] bg-stone-50 text-stone-600 border border-stone-200 px-2 py-0.5 rounded-full">
                      {CATEGORY_LABEL[k.category] || k.category}
                    </span>
                    <span className="text-[10px] text-stone-400">優先 {k.priority}</span>
                    {k.ownerName && <span className="text-[10px] text-stone-400">所有: {k.ownerName}</span>}
                  </div>
                  <p className="text-sm font-medium text-stone-800">{k.title}</p>
                  <p className="text-xs text-stone-500 mt-0.5 line-clamp-2 leading-relaxed">{k.content}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {editable && (
                    <>
                      <button
                        onClick={() => setEditTarget(k)}
                        className="p-1.5 text-stone-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        title="編集"
                      >
                        <Edit3 className="w-[15px] h-[15px]" />
                      </button>
                      <button
                        onClick={() => toggle(k.id)}
                        className={`p-1.5 rounded-lg transition-colors ${k.isActive ? 'text-emerald-500 hover:bg-emerald-50' : 'text-stone-300 hover:bg-stone-50'}`}
                        title={k.isActive ? '無効化' : '有効化'}
                      >
                        {k.isActive ? <ToggleRight className="w-[18px] h-[18px]" /> : <ToggleLeft className="w-[18px] h-[18px]" />}
                      </button>
                      <button
                        onClick={() => remove(k.id)}
                        className="p-1.5 text-stone-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-[15px] h-[15px]" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 一般ナレッジのインライン編集モーダル */}
      {editTarget && (
        <GeneralKnowledgeEditModal
          item={editTarget}
          processing={editing}
          onCancel={() => setEditTarget(null)}
          onSubmit={draft => saveEdit(editTarget.id, draft)}
        />
      )}
    </div>
  );
}

// 一般ナレッジのインライン編集モーダル
function GeneralKnowledgeEditModal({
  item, processing, onCancel, onSubmit,
}: {
  item: KnowledgeItem;
  processing: boolean;
  onCancel: () => void;
  onSubmit: (draft: { title: string; content: string; category: string; priority: number; visibility: 'shared' | 'personal' }) => void;
}) {
  const [draft, setDraft] = useState({
    title: item.title,
    content: item.content,
    category: item.category,
    priority: item.priority,
    visibility: item.visibility,
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Edit3 className="w-4 h-4 text-stone-700 flex-shrink-0" />
            <p className="text-sm font-semibold text-stone-800 truncate">一般ナレッジを編集</p>
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">カテゴリ</label>
              <select
                value={draft.category}
                onChange={e => setDraft(p => ({ ...p, category: e.target.value }))}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                {KNOWLEDGE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">優先度 (1-10)</label>
              <input
                type="number" min={1} max={10}
                value={draft.priority}
                onChange={e => setDraft(p => ({ ...p, priority: parseInt(e.target.value) || 5 }))}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">公開範囲</label>
              <div className="flex gap-1">
                {(['shared', 'personal'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDraft(p => ({ ...p, visibility: v }))}
                    className={`flex-1 text-xs h-8 rounded-lg border font-medium transition-colors ${
                      draft.visibility === v
                        ? v === 'shared'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-white text-stone-500 border-stone-200'
                    }`}
                  >
                    {v === 'shared' ? '共有' : '個人'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">タイトル</label>
            <input
              value={draft.title}
              onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">内容</label>
            <textarea
              value={draft.content}
              onChange={e => setDraft(p => ({ ...p, content: e.target.value }))}
              rows={5}
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2 flex-shrink-0">
          <button onClick={onCancel} disabled={processing} className="text-xs px-4 py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-white disabled:opacity-50 transition-colors">
            キャンセル
          </button>
          <button
            onClick={() => onSubmit(draft)}
            disabled={processing || !draft.title.trim() || !draft.content.trim()}
            className="text-xs px-4 py-2 rounded-lg text-white bg-stone-700 hover:bg-stone-800 disabled:bg-stone-300 transition-colors inline-flex items-center gap-1.5"
          >
            {processing ? (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-3 h-3" />
            )}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 承認待ちパネル: 商品コメント承認キュー（メタデータ）
// 承認 / 再生成（修正方向プロンプト指示）の2アクション
// ============================================================================

// 贈答タグ承認キュー (gift_tag_approval_queue) のアイテム型
type TagQueueItem = {
  id: number;
  productId: number;
  productName: string;
  imageUrl?: string;
  brand?: string;
  category?: string;
  payload: {
    sceneCompatibility?: Record<string, number>;
    audienceCompatibility?: Record<string, number>;
    attributeFlags?: string[];
    minDeliveryDays?: number | null;
    shelfLifeDays?: number | null;
  };
  source?: string;        // 'ai' | 'manual'
  status?: string;
  submitterName?: string;
  submittedAt: string;
  notes?: string;
};

type QueueFilter = 'all' | 'comment' | 'tag';

function QueuePanel({ me, onChange }: { me: User; onChange: () => void }) {
  const [items, setItems] = useState<MetadataQueueItem[]>([]);
  const [tagItems, setTagItems] = useState<TagQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<MetadataQueueItem | null>(null);
  const [editTarget, setEditTarget] = useState<MetadataQueueItem | null>(null);
  const [editTagTarget, setEditTagTarget] = useState<TagQueueItem | null>(null);
  const [editingTag, setEditingTag] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  // ジュニア/シニア問わず、コンシェルジュ・管理者なら承認可能
  const canApprove = me.role === 'admin' || me.role === 'concierge_senior' || me.role === 'concierge_junior';

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/admin/approval-queue`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/admin/tag-approval-queue`).then(r => r.ok ? r.json() : []),
    ])
      .then(([metas, tags]: [MetadataQueueItem[], TagQueueItem[]]) => {
        setItems(Array.isArray(metas) ? metas : []);
        setTagItems(Array.isArray(tags) ? tags.filter(t => t.status === 'waiting' || t.status === 'in_review') : []);
        setLoading(false);
      })
      .catch(() => { setItems([]); setTagItems([]); setLoading(false); });
  };
  useEffect(load, []);

  const approveTag = async (item: TagQueueItem) => {
    setProcessingId(-item.id);  // 負数で衝突回避
    try {
      const r = await fetch(`${API}/admin/tag-approval-queue/${item.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        const txt = await r.text();
        alert(`承認に失敗しました: ${txt.slice(0, 120)}`);
        return;
      }
      onChange();
      load();
    } finally {
      setProcessingId(null);
    }
  };
  const rejectTag = async (item: TagQueueItem) => {
    setProcessingId(-item.id);
    try {
      const r = await fetch(`${API}/admin/tag-approval-queue/${item.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        const txt = await r.text();
        alert(`却下に失敗しました: ${txt.slice(0, 120)}`);
        return;
      }
      onChange();
      load();
    } finally {
      setProcessingId(null);
    }
  };

  const approve = async (item: MetadataQueueItem) => {
    setProcessingId(item.queueId);
    try {
      await fetch(`${API}/metadata/${item.metaId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalType: 'role_anonymous' }),
      });
      onChange();
      load();
    } finally {
      setProcessingId(null);
    }
  };

  const saveEdit = async (item: MetadataQueueItem, sensory: string, experience: string) => {
    setProcessingId(item.queueId);
    try {
      await fetch(`${API}/metadata/${item.metaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensoryComment: sensory, experienceComment: experience }),
      });
      setEditTarget(null);
      load();
    } finally {
      setProcessingId(null);
    }
  };

  const regenerate = async (item: MetadataQueueItem, feedback: string) => {
    setProcessingId(item.queueId);
    try {
      const r = await fetch(`${API}/products/${item.productId}/metadata/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback,
          previousSensory: item.sensoryComment,
          previousExperience: item.experienceComment,
          metaId: item.metaId,  // 既存レコードを上書き（蓄積しない）
        }),
      });
      const data = await r.json();
      if (data.error) {
        alert(`再生成に失敗しました: ${data.error}`);
        return;
      }
      setRegenerateTarget(null);
      onChange();
      load();
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="w-7 h-7 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  const isAdmin = me.role === 'admin';
  const isConcierge = me.role === 'concierge_senior' || me.role === 'concierge_junior';
  const totalCount = items.length + tagItems.length;
  const showComments = queueFilter === 'all' || queueFilter === 'comment';
  const showTags     = queueFilter === 'all' || queueFilter === 'tag';

  if (totalCount === 0) {
    return (
      <div className="py-16 text-center">
        <Inbox className="w-12 h-12 mx-auto mb-3 text-stone-200" />
        <p className="text-sm text-stone-400">承認待ちのアイテムはありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!canApprove && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          承認・再生成はコンシェルジュまたは管理者が行えます。
        </p>
      )}
      {/* スコープ表示 */}
      {(isConcierge || isAdmin) && (
        <p className="text-[11px] rounded-lg p-2.5 border text-stone-700 bg-amber-50 border-amber-200">
          <strong>共有レビューキュー:</strong> コメント {items.length} 件 ／ タグ {tagItems.length} 件 を全員でレビューします。
        </p>
      )}

      {/* タイプフィルタ */}
      <div className="inline-flex bg-white border border-stone-200 rounded-xl p-1">
        {([
          { key: 'all',     label: `全て (${totalCount})` },
          { key: 'comment', label: `コメント (${items.length})` },
          { key: 'tag',     label: `タグ (${tagItems.length})` },
        ] as { key: QueueFilter; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setQueueFilter(t.key)}
            className={`px-3 h-8 text-xs rounded-lg font-medium transition-colors ${
              queueFilter === t.key ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* タグエントリ */}
      {showTags && tagItems.map(t => (
        <TagQueueCard
          key={`tag-${t.id}`}
          item={t}
          canApprove={canApprove}
          processing={processingId === -t.id}
          onApprove={() => approveTag(t)}
          onReject={() => rejectTag(t)}
          onEdit={() => setEditTagTarget(t)}
        />
      ))}

      {/* コメントエントリ */}
      {showComments && items.map(item => (
        <div key={item.queueId} className="bg-white border border-stone-200 rounded-2xl p-4">
          {/* 商品サマリー + 提出者 */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-14 h-14 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                : <Sparkles className="w-5 h-5 text-stone-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800 truncate">{item.productName}</p>
              <p className="text-[11px] text-stone-500">
                {item.brand}{item.brand && item.category ? ' / ' : ''}{item.category} / ¥{item.price.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {item.attemptNo > 1 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                    再生成 {item.attemptNo} 回目
                  </span>
                )}
                {item.confidenceScore != null && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                    信頼度 {item.confidenceScore}
                  </span>
                )}
                {item.submitterName && (
                  <span className="text-[10px] text-stone-400" title="最後に AI 下書き生成・再生成を行った人">
                    下書き作成: {item.submitterName}
                  </span>
                )}
                <span className="text-[10px] text-stone-400">{item.queuedAt.split('.')[0]}</span>
              </div>
            </div>
          </div>

          {/* コメント表示: 登録済の視点のみ表示。両方空の場合は「未生成」だけ示す */}
          {(() => {
            const hasS = !!(item.sensoryComment && item.sensoryComment.trim());
            const hasE = !!(item.experienceComment && item.experienceComment.trim());
            if (!hasS && !hasE) {
              return (
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 mb-3 text-center">
                  <span className="text-xs text-stone-400">（コメント未生成）</span>
                </div>
              );
            }
            // 片方だけならフル幅、両方なら2カラム
            const cols = (hasS && hasE) ? 'sm:grid-cols-2' : 'grid-cols-1';
            return (
              <div className={`grid ${cols} gap-2.5 mb-3`}>
                {hasS && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                    <p className="text-[10px] tracking-widest text-rose-700 font-bold mb-1">SENSORY 感性視点</p>
                    <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">{item.sensoryComment}</p>
                  </div>
                )}
                {hasE && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-[10px] tracking-widest text-amber-700 font-bold mb-1">EXPERIENCE 経験知視点</p>
                    <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap">{item.experienceComment}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* アクション: 編集 / 再生成 / 承認 */}
          {canApprove && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setEditTarget(item)}
                disabled={processingId === item.queueId}
                className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
              >
                <Edit3 className="w-3 h-3" />
                手動で編集
              </button>
              <button
                onClick={() => setRegenerateTarget(item)}
                disabled={processingId === item.queueId}
                className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                再生成（修正方向を指示）
              </button>
              <button
                onClick={() => approve(item)}
                disabled={processingId === item.queueId}
                className="text-xs px-3 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
              >
                {processingId === item.queueId ? (
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-3 h-3" />
                )}
                承認して公開
              </button>
            </div>
          )}
        </div>
      ))}

      {/* 再生成モーダル: 修正方向プロンプト */}
      {regenerateTarget && (
        <RegenerateModal
          item={regenerateTarget}
          processing={processingId === regenerateTarget.queueId}
          onCancel={() => setRegenerateTarget(null)}
          onSubmit={fb => regenerate(regenerateTarget, fb)}
        />
      )}

      {/* 手動編集モーダル */}
      {editTarget && (
        <EditCommentModal
          item={editTarget}
          processing={processingId === editTarget.queueId}
          onCancel={() => setEditTarget(null)}
          onSubmit={(s, e) => saveEdit(editTarget, s, e)}
        />
      )}

      {/* タグ承認待ちエントリの編集モーダル: payload を上書き、承認状態は維持 */}
      {editTagTarget && (
        <TagEditModal
          target={{
            productName: editTagTarget.productName,
            brand: editTagTarget.brand,
            price: 0,  // queue にはない
            sceneCompatibility:    editTagTarget.payload.sceneCompatibility    ?? {},
            audienceCompatibility: editTagTarget.payload.audienceCompatibility ?? {},
            attributeFlags:        editTagTarget.payload.attributeFlags        ?? [],
            minDeliveryDays:       editTagTarget.payload.minDeliveryDays       ?? null,
          }}
          processing={editingTag}
          hint="承認待ちキューのタグ内容を更新します。承認すれば商品マスタに反映されます。"
          onCancel={() => setEditTagTarget(null)}
          onSubmit={async (payload) => {
            setEditingTag(true);
            try {
              const r = await fetch(`${API}/admin/tag-approval-queue/${editTagTarget.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              if (!r.ok) {
                const txt = await r.text();
                alert(`タグ編集に失敗しました: ${txt.slice(0, 120)}`);
                return;
              }
              setEditTagTarget(null);
              load();
            } finally {
              setEditingTag(false);
            }
          }}
        />
      )}
    </div>
  );
}

// 承認待ちキュー: 贈答タグエントリの表示カード
function TagQueueCard({
  item, canApprove, processing, onApprove, onReject, onEdit,
}: {
  item: TagQueueItem;
  canApprove: boolean;
  processing: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEdit?: () => void;
}) {
  // payload からトップ表示用の情報を抽出
  const scenes = item.payload.sceneCompatibility ?? {};
  const audiences = item.payload.audienceCompatibility ?? {};
  const flags = item.payload.attributeFlags ?? [];

  // シーン適合度: 高い順 + NG を分けて表示
  const topScenes = Object.entries(scenes)
    .filter(([, v]) => (v as number) >= 70)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 4);
  const ngScenes = Object.entries(scenes).filter(([, v]) => (v as number) < 0);
  const topAudiences = Object.entries(audiences)
    .filter(([, v]) => (v as number) >= 60)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 3);

  const sceneLabel = (k: string) => TAG_SCENES.find(s => s.key === k)?.label ?? k;
  const audLabel = (k: string) => TAG_AUDIENCES.find(a => a.key === k)?.label ?? k;
  const flagLabel = (k: string) => TAG_FLAGS.find(f => f.key === k)?.label ?? k;

  return (
    <div className="bg-white border-2 border-violet-200 rounded-2xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-14 h-14 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {item.imageUrl
            ? <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
            : <Tag className="w-5 h-5 text-violet-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 font-bold">
              <Tag className="w-2.5 h-2.5 inline mr-0.5" />タグ
            </span>
            <p className="text-sm font-semibold text-stone-800 truncate">{item.productName}</p>
          </div>
          <p className="text-[11px] text-stone-500">
            {item.brand}{item.brand && item.category ? ' / ' : ''}{item.category}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {item.source === 'ai' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                AI推定
              </span>
            )}
            {item.submitterName && (
              <span className="text-[10px] text-stone-400">下書き作成: {item.submitterName}</span>
            )}
            <span className="text-[10px] text-stone-400">{item.submittedAt.split('.')[0]}</span>
          </div>
        </div>
      </div>

      {/* タグ概要 */}
      <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 mb-3 space-y-2">
        {topScenes.length > 0 && (
          <div className="flex items-start gap-2 text-xs">
            <span className="text-violet-700 font-semibold w-20 flex-shrink-0">推奨シーン</span>
            <div className="flex flex-wrap gap-1">
              {topScenes.map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 rounded-full bg-white border border-violet-200 text-stone-700">
                  {sceneLabel(k)} <strong className="text-violet-700">{v as number}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
        {ngScenes.length > 0 && (
          <div className="flex items-start gap-2 text-xs">
            <span className="text-rose-700 font-semibold w-20 flex-shrink-0">NGシーン</span>
            <div className="flex flex-wrap gap-1">
              {ngScenes.map(([k]) => (
                <span key={k} className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                  {sceneLabel(k)}
                </span>
              ))}
            </div>
          </div>
        )}
        {topAudiences.length > 0 && (
          <div className="flex items-start gap-2 text-xs">
            <span className="text-stone-600 font-semibold w-20 flex-shrink-0">受け手</span>
            <div className="flex flex-wrap gap-1">
              {topAudiences.map(([k, v]) => (
                <span key={k} className="px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-700">
                  {audLabel(k)} <strong className="text-stone-600">{v as number}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
        {flags.length > 0 && (
          <div className="flex items-start gap-2 text-xs">
            <span className="text-stone-600 font-semibold w-20 flex-shrink-0">フラグ</span>
            <div className="flex flex-wrap gap-1">
              {flags.map(f => (
                <span key={f} className="px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-600">
                  {flagLabel(f)}
                </span>
              ))}
            </div>
          </div>
        )}
        {item.payload.minDeliveryDays != null && (
          <p className="text-[11px] text-stone-500">最短納期 {item.payload.minDeliveryDays} 日</p>
        )}
      </div>

      {/* アクション: 編集 / 却下 / 承認 */}
      {canApprove && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              disabled={processing}
              className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              <Edit3 className="w-3 h-3" />
              手動で編集
            </button>
          )}
          <button
            onClick={onReject}
            disabled={processing}
            className="text-xs px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
          >
            <X className="w-3 h-3" />
            却下
          </button>
          <button
            onClick={onApprove}
            disabled={processing}
            className="text-xs px-3 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
          >
            {processing ? (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-3 h-3" />
            )}
            承認して商品マスタに反映
          </button>
        </div>
      )}
    </div>
  );
}


// 手動でコメントを編集するモーダル（承認前/再生成不要のとき用）
function EditCommentModal({
  item, processing, onCancel, onSubmit,
}: {
  item: MetadataQueueItem;
  processing: boolean;
  onCancel: () => void;
  onSubmit: (sensory: string, experience: string) => void;
}) {
  const [sensory, setSensory] = useState(item.sensoryComment ?? '');
  const [experience, setExperience] = useState(item.experienceComment ?? '');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Edit3 className="w-4 h-4 text-stone-700 flex-shrink-0" />
            <p className="text-sm font-semibold text-stone-800 truncate">コメントを手動で編集</p>
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-lg p-3">
            <p className="font-medium text-stone-700 mb-0.5">対象: {item.productName}</p>
            <p className="text-[11px]">{item.brand} / ¥{item.price.toLocaleString()}</p>
          </div>

          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-600" />
              <p className="text-xs font-semibold text-stone-800">感性視点</p>
            </div>
            <textarea
              value={sensory}
              onChange={e => setSensory(e.target.value)}
              rows={4}
              placeholder="受け手が箱を開けた瞬間の景色を 60〜100 字で"
              className="w-full text-sm border border-rose-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none leading-relaxed"
            />
            <p className="text-[10px] text-stone-500 mt-1">{sensory.length} 字</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-700" />
              <p className="text-xs font-semibold text-stone-800">経験知視点</p>
            </div>
            <textarea
              value={experience}
              onChange={e => setExperience(e.target.value)}
              rows={4}
              placeholder="販売実績・成功事例・お声を 60〜100 字で"
              className="w-full text-sm border border-amber-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none leading-relaxed"
            />
            <p className="text-[10px] text-stone-500 mt-1">{experience.length} 字</p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2 flex-shrink-0">
          <button
            onClick={onCancel}
            disabled={processing}
            className="text-xs px-4 py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-white disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => onSubmit(sensory, experience)}
            disabled={processing || !sensory.trim() || !experience.trim()}
            className="text-xs px-4 py-2 rounded-lg text-white bg-stone-700 hover:bg-stone-800 disabled:bg-stone-300 transition-colors inline-flex items-center gap-1.5"
          >
            {processing ? (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-3 h-3" />
            )}
            保存（承認待ちを更新）
          </button>
        </div>
      </div>
    </div>
  );
}

// 修正方向プロンプト入力モーダル
function RegenerateModal({
  item, processing, onCancel, onSubmit,
}: {
  item: MetadataQueueItem;
  processing: boolean;
  onCancel: () => void;
  onSubmit: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const HINTS = [
    'もっと具体的な販売実績の数字を入れてください',
    '弔事でも使える落ち着いたトーンに変更',
    '若い世代に響くように、感性視点をより瑞々しく',
    '受け手が手に取る瞬間の所作・佇まいの描写を強める',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3" onClick={onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2 min-w-0">
            <RefreshCw className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <p className="text-sm font-semibold text-stone-800 truncate">AI に修正方向を指示して再生成</p>
          </div>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-lg p-3">
            <p className="font-medium text-stone-700 mb-1">対象: {item.productName}</p>
            <p className="text-[11px]">現在試行 {item.attemptNo} 回目 / 信頼度 {item.confidenceScore ?? '-'}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              修正方向（AI への指示文）
            </label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={4}
              placeholder="例: もっと具体的な販売実績の数字を入れてください / 弔事でも使える落ち着いたトーンに変更 など"
              className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none leading-relaxed"
            />
          </div>

          <div>
            <p className="text-[11px] text-stone-500 mb-1.5">よく使う指示:</p>
            <div className="flex flex-wrap gap-1.5">
              {HINTS.map(h => (
                <button
                  key={h}
                  onClick={() => setFeedback(prev => prev ? `${prev}\n${h}` : h)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                >
                  + {h}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={processing}
            className="text-xs px-4 py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-white disabled:opacity-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => onSubmit(feedback.trim())}
            disabled={processing || !feedback.trim()}
            className="text-xs px-4 py-2 rounded-lg text-white bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 transition-colors inline-flex items-center gap-1.5"
          >
            {processing ? (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Wand2 className="w-3 h-3" />
            )}
            この方向で再生成
          </button>
        </div>
      </div>
    </div>
  );
}
