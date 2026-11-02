import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

// POST: 비밀 이의제기 원문 열람을 위한 비밀번호 확인
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const body = await req.json();
    const { id, password } = body;

    if (!id || !password) {
      return NextResponse.json({ error: 'ID와 비밀번호를 모두 입력해 주세요.' }, { status: 400 });
    }

    const docRef = doc(firestore, 'protests', id);
    const snap = await getDoc(docRef);

    if (!snap.exists() || snap.data().subdomain !== subdomain) {
      return NextResponse.json({ error: '이의제기 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const data = snap.data();
    if (!data.passwordHash) {
      // 비밀번호가 설정되지 않은 경우 바로 반환
      return NextResponse.json({
        verified: true,
        content: data.content,
        applicantName: data.applicantName,
        phone: data.phone || '',
      });
    }

    const hashed = hashPassword(password);
    if (hashed !== data.passwordHash) {
      return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 403 });
    }

    return NextResponse.json({
      verified: true,
      content: data.content,
      applicantName: data.applicantName,
      phone: data.phone || '',
    });
  } catch (error: any) {
    console.error('비밀번호 검증 오류:', error);
    return NextResponse.json({ error: error.message || '검증 실패' }, { status: 500 });
  }
}
