/** @type {import("next").NextConfig} */
// 同一オリジンプロキシ:
//   ブラウザから見ると全リクエストがフロント (例: http://127.0.0.1:3000) と同一オリジンになるため、
//   localhost/127.0.0.1 不一致やサブドメイン分離による Cookie (SameSite=Lax) の送信失敗が起こらない。
//
//   /api/*     → バックエンド本体
//   /uploads/* → バックエンドが mount している StaticFiles (avatarUrl 等が /uploads/... を直接返すため必要)
//
// プロキシ先は API_PROXY_TARGET で差し替え可 (本番では Container Apps / App Service の内部 URL 等)。
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000';

module.exports = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_PROXY_TARGET}/:path*` },
      { source: '/uploads/:path*', destination: `${API_PROXY_TARGET}/uploads/:path*` },
    ];
  },
};
