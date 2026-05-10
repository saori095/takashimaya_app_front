/** @type {import("next").NextConfig} */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000';

module.exports = {
  output: 'standalone',

  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_PROXY_TARGET}/:path*` },
      { source: '/uploads/:path*', destination: `${API_PROXY_TARGET}/uploads/:path*` },
    ];
  },
};
