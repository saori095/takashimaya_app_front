'use client';

import { useEffect } from 'react';

/**
 * window.fetch を一度だけ上書きして、全ての fetch 呼び出しに credentials: 'include' を付与する。
 *
 * Backend が HMAC 署名済み Cookie でセッション管理を行うため、フロント側では fetch ごとに
 * credentials: 'include' を渡さないと Cookie が送受信されない (cross-origin)。
 *
 * 各ファイルで個別に credentials を指定する代わりに、このコンポーネントを root layout に
 * マウントして 1 度だけ window.fetch を差し替える。
 */
export default function FetchInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 既にパッチ済みなら再パッチしない (HMR 対策)
    const w = window as Window & { __fetchPatched?: boolean };
    if (w.__fetchPatched) return;
    w.__fetchPatched = true;

    const orig = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
      // 呼び出し側で credentials を明示している場合はそれを尊重、なければ 'include'
      const merged: RequestInit = init.credentials ? init : { credentials: 'include', ...init };
      return orig(input, merged);
    };
  }, []);
  return null;
}
