/** @type {import("next").NextConfig} */
// シークレットに合わせて名前を統一、または両方見るようにします
const API_PROXY_TARGET = process.env.NEXT_PUBLIC_API_BASE || process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000';

const path = require('path');

module.exports = {
  output: 'standalone',
  turbopack: {
    root: path.join(__dirname),
  },

  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_PROXY_TARGET}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_PROXY_TARGET}/uploads/:path*` },
    ];
  },
};

