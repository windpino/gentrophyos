import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { authenticateApiRequest } from '@/src/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

// Q&A 수정 및 답변 등록
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string; id: string }> }
) {
  try {
    const auth = authenticateApiRequest(req, ['admin']);
    const isAdmin = auth.authorized;

    const { id } = await params;
    const body = await req.json();
    const { title, content, isSecret, password, answer, answeredBy } = body;

    const docRef = doc(firestore, 'qna', id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: '해당 Q&A 게시글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const data = snap.data();
    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    // 1. 관리자가 답변을 등록/수정하는 경우
    if (isAdmin && answer !== undefined) {
      updateData.answer = answer.trim();
      updateData.answeredBy = (answeredBy || '대회운영본부').trim();
      updateData.answeredAt = new Date().toISOString();
      updateData.status = answer.trim() ? 'ANSWERED' : 'WAITING';
    } 
    // 2. 작성자(또는 관리자)가 질문 내용을 수정하는 경우
    else {
      if (!isAdmin) {
        if (!password || hashPassword(password) !== data.passwordHash) {
          return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
        }
      }

      if (title !== undefined) updateData.title = title.trim();
      if (content !== undefined) updateData.content = content.trim();
      if (isSecret !== undefined) updateData.isSecret = Boolean(isSecret);
    }

    await updateDoc(docRef, updateData);

    return NextResponse.json({ success: true, message: '성공적으로 처리되었습니다.' });
  } catch (error: any) {
    console.error('Error updating Q&A:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Q&A 삭제 (작성자 비밀번호 확인 또는 관리자 권한)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string; id: string }> }
) {
  try {
    const auth = authenticateApiRequest(req, ['admin']);
    const isAdmin = auth.authorized;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { password } = body;

    const docRef = doc(firestore, 'qna', id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: '해당 Q&A 게시글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const data = snap.data();

    if (!isAdmin) {
      if (!password || hashPassword(password) !== data.passwordHash) {
        return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
      }
    }

    await deleteDoc(docRef);

    return NextResponse.json({ success: true, message: 'Q&A 게시글이 성공적으로 삭제되었습니다.' });
  } catch (error: any) {
    console.error('Error deleting Q&A:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
