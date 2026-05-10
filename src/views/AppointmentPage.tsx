'use client';

import { useState, useEffect } from 'react';
import { MapPin, Star, Calendar, Clock, User, Award, Check, CheckCircle } from 'lucide-react';

// 実行時に現在のページ origin から API base を導出する。
// localhost ↔ 127.0.0.1 のように別サイト扱いになる場合の SameSite=Lax Cookie 喪失を防ぐ目的。
const API = process.env.NEXT_PUBLIC_API_BASE
  ?? (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : 'http://localhost:8000');

type UserType = { id: number; name: string; displayName: string };

type Concierge = {
  id: number;
  displayName: string;
  avatarUrl?: string | null;
  specialties?: string | string[] | null;
  yearsExperience?: number | null;
};

const STORES = [
  '高島屋 日本橋高島屋',
  '高島屋 新宿高島屋',
  '高島屋 横浜高島屋',
  '高島屋 大阪高島屋',
  '高島屋 京都高島屋',
  '高島屋 名古屋高島屋',
  '高島屋 博多高島屋',
];

const TIME_SLOTS = [
  '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30',
];

function deriveTitle(years: number | null | undefined): { ja: string; tone: string } {
  const y = years ?? 0;
  if (y >= 25) return { ja: '贈答のスペシャリスト', tone: 'text-rose-700 bg-rose-50 border-rose-200' };
  if (y >= 10) return { ja: 'シニアコンシェルジュ',  tone: 'text-amber-700 bg-amber-50 border-amber-200' };
  if (y >= 5)  return { ja: 'コンシェルジュ',        tone: 'text-stone-700 bg-stone-100 border-stone-200' };
  return                 { ja: 'ジュニアコンシェルジュ', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
}

function deriveRating(id: number): { value: number; count: number } {
  const value = 4.5 + ((id * 7) % 5) / 10;
  const count = 80 + ((id * 23) % 200);
  return { value: Math.min(value, 5.0), count };
}

function ConciergeCard({
  concierge, selected, onSelect,
}: {
  concierge: Concierge;
  selected: boolean;
  onSelect: () => void;
}) {
  const specialties = (() => {
    if (Array.isArray(concierge.specialties)) return concierge.specialties as string[];
    try { return JSON.parse(concierge.specialties ?? '[]') as string[]; } catch { return [] as string[]; }
  })();
  const title = deriveTitle(concierge.yearsExperience);
  const rating = deriveRating(concierge.id);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
        selected
          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300'
          : 'border-stone-200 hover:border-amber-300 hover:bg-stone-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-full border-2 border-amber-200 bg-amber-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {concierge.avatarUrl
            ? <img src={concierge.avatarUrl} alt={concierge.displayName} className="w-full h-full object-cover" />
            : <span className="text-lg font-bold text-amber-700">{concierge.displayName.slice(0, 2)}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-stone-800">{concierge.displayName}</p>
            {selected && <Check className="w-4 h-4 text-amber-600" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${title.tone}`}>
              <Award className="w-3 h-3" />{title.ja}
            </span>
            <span className="flex items-center gap-0.5 text-xs">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-stone-800">{rating.value.toFixed(1)}</span>
              <span className="text-[10px] text-stone-500">（{rating.count}件）</span>
            </span>
            {concierge.yearsExperience != null && (
              <span className="text-[10px] text-stone-500">経験 {concierge.yearsExperience} 年</span>
            )}
          </div>
          {specialties.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {specialties.slice(0, 3).map((s: string) => (
                <span key={s} className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AppointmentPage({ me }: { me: UserType }) {
  const [concierges, setConcierges] = useState<Concierge[]>([]);
  const [selectedConciergeId, setSelectedConciergeId] = useState<number | null>(null);
  const [visitorName, setVisitorName] = useState(me.displayName);
  const [visitorContact, setVisitorContact] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [preferredStore, setPreferredStore] = useState(STORES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  useEffect(() => {
    fetch(`${API}/concierges`).then(r => r.json()).then(setConcierges);
  }, []);

  const handleSubmit = async () => {
    if (!visitorName.trim()) { alert('お名前を入力してください'); return; }
    if (!visitorContact.trim()) { alert('ご連絡先を入力してください'); return; }
    if (!preferredDate) { alert('ご希望日を選択してください'); return; }
    if (!preferredTime) { alert('ご希望時間を選択してください'); return; }

    setSubmitting(true);
    try {
      await fetch(`${API}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conciergeProfileId: selectedConciergeId ?? undefined,
          visitorName,
          visitorContact,
          preferredDate,
          preferredTime,
          preferredStore,
        }),
      });
      setIsCompleted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <div className="max-w-lg mx-auto w-full px-4 py-12 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-stone-800 mb-2" style={{ fontFamily: 'Noto Serif JP, serif' }}>
          ご予約を承りました
        </h2>
        <p className="text-sm text-stone-500 mb-6">
          担当コンシェルジュより確認のご連絡をさしあげます。<br />
          当日は高島屋のコンシェルジュカウンターへお越しください。
        </p>

        <div className="w-full text-left mb-6 bg-white border border-stone-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-amber-700" />
            <span className="text-stone-600">日時：</span>
            <span className="font-medium text-stone-800">{preferredDate} {preferredTime}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-amber-700" />
            <span className="text-stone-600">店舗：</span>
            <span className="font-medium text-stone-800">{preferredStore}</span>
          </div>
          {selectedConciergeId && concierges.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-amber-700" />
              <span className="text-stone-600">担当：</span>
              <span className="font-medium text-stone-800">
                {concierges.find(c => c.id === selectedConciergeId)?.displayName ?? 'コンシェルジュ'}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setIsCompleted(false);
            setSelectedConciergeId(null);
            setPreferredDate('');
            setPreferredTime('');
          }}
          className="w-full h-11 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          新しい予約をする
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-800 flex items-center gap-2" style={{ fontFamily: 'Noto Serif JP, serif' }}>
            <MapPin className="w-5 h-5 text-amber-700" />
            コンシェルジュ来店予約
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">高島屋の熟練コンシェルジュが店頭でお迎えします</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* コンシェルジュ指名 */}
        {concierges.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-medium text-stone-700 flex items-center gap-1 mb-3">
              <Star className="w-4 h-4 text-amber-600" />
              担当コンシェルジュをご指名（任意）
            </p>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedConciergeId(null)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm ${
                  selectedConciergeId === null
                    ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300 font-medium text-amber-800'
                    : 'border-stone-200 hover:border-stone-300 text-stone-600'
                }`}
              >
                おまかせ（店舗スタッフが対応）
              </button>
              {concierges.map(c => (
                <ConciergeCard
                  key={c.id}
                  concierge={c}
                  selected={selectedConciergeId === c.id}
                  onSelect={() => setSelectedConciergeId(c.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ご来店情報 */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-medium text-stone-700 flex items-center gap-1 mb-3">
            <Calendar className="w-4 h-4 text-amber-600" />
            ご来店情報
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-stone-600 block">ご希望店舗</label>
              <select
                value={preferredStore}
                onChange={e => setPreferredStore(e.target.value)}
                className="w-full h-9 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                {STORES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-stone-600 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />ご希望日
                </label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={e => setPreferredDate(e.target.value)}
                  min={minDateStr}
                  className="w-full h-9 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-stone-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />ご希望時間
                </label>
                <select
                  value={preferredTime}
                  onChange={e => setPreferredTime(e.target.value)}
                  className="w-full h-9 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                >
                  <option value="">時間を選択</option>
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* お客様情報 */}
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-medium text-stone-700 flex items-center gap-1 mb-3">
            <User className="w-4 h-4 text-amber-600" />
            お客様情報
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-stone-600 block">
                お名前 <span className="text-red-500">*</span>
              </label>
              <input
                value={visitorName}
                onChange={e => setVisitorName(e.target.value)}
                placeholder="山田 太郎"
                className="w-full h-9 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-stone-600 block">
                ご連絡先（電話番号またはメール） <span className="text-red-500">*</span>
              </label>
              <input
                value={visitorContact}
                onChange={e => setVisitorContact(e.target.value)}
                placeholder="090-0000-0000 または example@email.com"
                className="w-full h-9 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-11 bg-amber-700 hover:bg-amber-800 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {submitting
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <MapPin className="w-4 h-4" />}
          来店予約を送信する
        </button>
        <p className="text-[10px] text-stone-400 text-center">
          ご予約はタカシマヤカード会員様向けの無料サービスです
        </p>
      </div>
    </div>
  );
}
