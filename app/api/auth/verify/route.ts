import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPassword,
  createSessionToken,
  getSessionFromRequest,
  checkRateLimit,
  recordAuthAttempt,
  SESSION_COOKIE_NAME,
} from '@/src/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/auth/verify?role=admin|referee
// 현재 세션 쿠키가 유효한지 확인
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const requiredRole = (searchParams.get('role') as 'admin' | 'referee') || 'admin';

    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // admin 세션은 referee 페이지 접근도 허용
    if (session.role === 'admin' || session.role === requiredRole) {
      return NextResponse.json({ authenticated: true, role: session.role });
    }

    return NextResponse.json({ authenticated: false, message: '권한이 일치하지 않습니다.' }, { status: 403 });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

// POST /api/auth/verify
// body: { password: string, role?: 'admin' | 'referee', subdomain?: string }
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    // 1. 무차별 대입 방어 확인
    const rateLimit = checkRateLimit(ip);
    if (rateLimit.isLocked) {
      return NextResponse.json(
        {
          success: false,
          message: `비밀번호를 5회 이상 잘못 입력하여 잠금 처리되었습니다. ${rateLimit.remainingSeconds}초 후 다시 시도해 주세요.`,
          isLocked: true,
          remainingSeconds: rateLimit.remainingSeconds,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { password, role = 'admin', subdomain } = body;

    const isValid = verifyPassword(password, role as 'admin' | 'referee');

    if (isValid) {
      recordAuthAttempt(ip, true);

      // 보안 서명된 세션 토큰 생성
      const token = createSessionToken(role as 'admin' | 'referee', subdomain);

      const response = NextResponse.json({
        success: true,
        role,
        token,
        message: '인증 성공',
      });

      // HttpOnly, SameSite=Lax 쿠키 발급 (HTTPS 접속 시에만 secure 플래그 활성화)
      const isHttps = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
      response.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7일
      });

      return response;
    } else {
      recordAuthAttempt(ip, false);

      const afterCheck = checkRateLimit(ip);
      const lockMsg = afterCheck.isLocked
        ? ` 5회 연속 실패로 5분간 입력이 제한됩니다.`
        : '';

      return NextResponse.json(
        {
          success: false,
          message: `비밀번호가 올바르지 않습니다.${lockMsg}`,
          isLocked: afterCheck.isLocked,
        },
        { status: 401 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: '요청 처리 중 오류가 발생했습니다.' },
      { status: 400 }
    );
  }
}

// DELETE /api/auth/verify
// 로그아웃 시 세션 쿠키 삭제
export async function DELETE() {
  const response = NextResponse.json({ success: true, message: '로그아웃되었습니다.' });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

