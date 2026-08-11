import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';

  // 정적 자원 및 API 요청은 미들웨어 분기에서 제외
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 로컬 개발 서버 및 프로덕션 도메인 판별
  // 예: crypto-cup.localhost:3000 -> subdomain: crypto-cup
  // 예: gentrophy.com -> subdomain: null
  // 예: league.gentrophy.com -> subdomain: league
  let subdomain = '';

  const hostParts = hostname.split(':');
  const domain = hostParts[0]; // 포트 번호 제거

  const parts = domain.split('.');

  // localhost 개발 환경: *.localhost:3000
  if (domain.endsWith('localhost')) {
    if (parts.length > 1 && parts[parts.length - 2] !== 'www') {
      subdomain = parts.slice(0, -1).join('.');
    }
  } else {
    // 프로덕션 도메인: [subdomain].[domain].[tld]
    if (parts.length > 2 && parts[0] !== 'www') {
      subdomain = parts.slice(0, -2).join('.');
    }
  }

  // 예외 서브도메인 처리
  const reservedSubdomains = ['www', 'admin', 'platform'];
  if (subdomain && !reservedSubdomains.includes(subdomain)) {
    // 테넌트 전용 경로로 rewrite 수행
    // 내부적으로 /tenant/[subdomain]/[path] 로 매핑되지만 브라우저 URL은 유지됩니다.
    const path = url.pathname === '/' ? '' : url.pathname;
    return NextResponse.rewrite(
      new URL(`/tenant/${subdomain}${path}${url.search}`, req.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
