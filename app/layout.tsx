import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '제20회 이순신장군배 전국윈드서핑대회',
  description: '제20회 이순신장군배 전국윈드서핑대회 공식 플랫폼',
  openGraph: {
    title: '제20회 이순신장군배 전국윈드서핑대회',
    description: '제20회 이순신장군배 전국윈드서핑대회 공식 플랫폼',
    images: [
      {
        url: 'https://gentrophyos.vercel.app/images/logo_new.png',
        width: 800,
        height: 600,
      }
    ]
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}
