import './globals.css';
import FetchInit from '../src/lib/FetchInit';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <title>高島屋 AIコンシェルジュ</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {/* window.fetch を上書きして全リクエストに credentials を付与 (Cookie セッション送受信) */}
        <FetchInit />
        {children}
      </body>
    </html>
  );
}
