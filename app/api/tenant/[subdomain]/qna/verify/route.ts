import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { authenticateApiRequest } from '@/src/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

// 비밀글 열람 및 본인 인증 비밀번호 검증
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const auth = authenticateApiRequest(req, ['admin']);
    const isAdmin = auth.authorized;

    const body = await req.json();
    const { id, password } = body;

    if (!id) {
      return NextResponse.json({ error: '게시글 ID가 누락되었습니다.' }, { status: 400 });
    }

    const docRef = doc(firestore, 'qna', id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: '해당 Q&A 게시글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const data = snap.data();

    // 관리자이거나 비밀번호가 일치하는 경우 원본 데이터 반환
    if (!isAdmin) {
      if (!password || hashPassword(password) !== data.passwordHash) {
        return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
      }
    }

    return NextResponse.json({
      success: true,
      qna: {
        id: snap.id,
        title: data.title,
        content: data.content,
        authorName: data.authorName,
        isSecret: Boolean(data.isSecret),
        status: data.status || (data.answer ? 'ANSWERED' : 'WAITING'),
        answer: data.answer || null,
        answeredAt: data.answeredAt || null,
        answeredBy: data.answeredBy || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error verifying Q&A password:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
