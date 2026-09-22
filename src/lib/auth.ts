import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const AUTH_SECRET = process.env.AUTH_SECRET || 'gentrophy_secure_session_secret_key_2026_!@#$';
const SESSION_COOKIE_NAME = 'gentrophy_auth_session';

// Rate Limiting (Brute Force Protection)
// IP별 연속 실패 횟수 및 락다운 시간 관리 (메모리 기반)
interface RateLimitRecord {
  failures: number;
  lockedUntil: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

export function checkRateLimit(ip: string): { isLocked: boolean; remainingSeconds: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record) return { isLocked: false, remainingSeconds: 0 };

  if (record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }

  // 락다운 기간이 지났으면 리셋
  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    rateLimitMap.delete(ip);
  }

  return { isLocked: false, remainingSeconds: 0 };
}

export function recordAuthAttempt(ip: string, success: boolean): void {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { failures: 0, lockedUntil: 0 };

  if (success) {
    rateLimitMap.delete(ip);
  } else {
    record.failures += 1;
    if (record.failures >= 5) {
      // 5회 이상 실패 시 5분(300초) 락다운
      record.lockedUntil = now + 5 * 60 * 1000;
    }
    rateLimitMap.set(ip, record);
  }
}

// 비밀번호 검증
export function verifyPassword(password: string, role: 'admin' | 'referee' = 'admin'): boolean {
  if (!password || typeof password !== 'string') return false;
  const inputPwd = password.trim();

  const hostAdminPassword = (process.env.ADMIN_PASSWORD || process.env.HOST_PASSWORD || '781818').trim();
  const refereePassword = (process.env.REFEREE_PASSWORD || '181878').trim();

  // 최고 관리자/주최자 비밀번호는 admin 및 referee 모두 인증 가능
  if (inputPwd === hostAdminPassword) {
    return true;
  }

  // 심판 비밀번호는 referee 역할일 때 인증 허용
  if (role === 'referee' && inputPwd === refereePassword) {
    return true;
  }

  return false;
}

// HMAC-SHA256 세션 토큰 생성 및 검증
interface SessionPayload {
  role: 'admin' | 'referee';
  subdomain?: string;
  exp: number; // Unix timestamp (ms)
}

export function createSessionToken(role: 'admin' | 'referee', subdomain?: string): string {
  const payload: SessionPayload = {
    role,
    subdomain: subdomain || '',
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7일 유효
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadStr)
    .digest('base64url');

  return `${payloadStr}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadStr, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadStr)
    .digest('base64url');

  // Timing-safe comparison
  try {
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    if (!isMatch) return null;

    const payload: SessionPayload = JSON.parse(
      Buffer.from(payloadStr, 'base64url').toString('utf-8')
    );

    if (Date.now() > payload.exp) {
      return null; // 만료됨
    }

    return payload;
  } catch {
    return null;
  }
}

// NextRequest에서 세션 추출 (쿠키, Authorization 헤더, x-auth-token 헤더 모두 지원)
export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  let token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    token = req.headers.get('x-auth-token') || undefined;
  }

  if (!token) return null;
  return verifySessionToken(token);
}

// API 라우트 권한 검증 헬퍼
export function authenticateApiRequest(
  req: NextRequest,
  allowedRoles: Array<'admin' | 'referee'> = ['admin']
): { authorized: boolean; payload?: SessionPayload; errorResponse?: NextResponse } {
  const session = getSessionFromRequest(req);

  if (!session) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: '로그인이 필요합니다. 인증 세션이 없거나 만료되었습니다.' },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(session.role)) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { error: '해당 작업을 수행할 권한이 없습니다.' },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, payload: session };
}

export { SESSION_COOKIE_NAME };
