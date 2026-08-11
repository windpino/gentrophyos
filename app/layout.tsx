import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GenTrophyOS | B2B 대회 관리 SaaS ERP',
  description: '독자적인 서브도메인 기반의 대회 홈페이지 생성 및 경기/대회 실시간 집계 ERP 플랫폼',
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
