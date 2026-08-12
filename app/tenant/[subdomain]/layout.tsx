import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  
  const title = '제20회 이순신장군배 전국윈드서핑대회 참가신청서';
  const description = '제20회 이순신장군배 전국윈드서핑대회 참가 신청서 접수 페이지';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: '/images/logo_new.png',
          width: 800,
          height: 600,
        },
      ],
    },
  };
}

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
