/** @type {import("next").NextConfig} */
// シークレットに合わせて名前を統一、または両方見るようにします
const API_PROXY_TARGET = process.env.NEXT_PUBLIC_API_BASE || process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000';

module.exports = {
  output: 'standalone',

  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_PROXY_TARGET}/api/:path*` }, // 宛先に /api/ を含めるか確認
      { source: '/uploads/:path*', destination: `${API_PROXY_TARGET}/uploads/:path*` },
    ];
  },
};
