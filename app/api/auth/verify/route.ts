import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// POST /api/auth/verify
// body: { password: string }
// 비밀번호는 서버 환경변수에서만 읽어서 클라이언트에 절대 노출되지 않음
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const adminPassword = process.env.ADMIN_PASSWORD?.trim();
 
    if (!adminPassword) {
      return NextResponse.json({ success: false, message: '서버 설정 오류' }, { status: 500 });
    }
 
    if (password?.toString().trim() === adminPassword) {
      return NextResponse.json({ success: true });
    } else {
      // 잘못된 비밀번호는 항상 401 + 동일 지연(timing attack 방지)
      return NextResponse.json({ success: false, message: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ success: false, message: '요청 처리 오류' }, { status: 400 });
  }
}
