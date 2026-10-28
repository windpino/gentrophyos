import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { authenticateApiRequest } from '@/src/lib/auth';
import { invalidateAnnouncementsCache } from '@/src/lib/boardCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 공지사항 수정 (주최자 관리자 전용)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string; id: string }> }
) {
  try {
    const auth = authenticateApiRequest(req, ['admin']);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { subdomain, id } = await params;
    const body = await req.json();
    const { title, content, author, category, isPopup, isPinned } = body;

    const docRef = doc(firestore, 'announcements', id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: '해당 공지사항을 찾을 수 없습니다.' }, { status: 404 });
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = content.trim();
    if (author !== undefined) updateData.author = author.trim();
    if (category !== undefined) updateData.category = category;
    if (isPopup !== undefined) updateData.isPopup = Boolean(isPopup);
    if (isPinned !== undefined) updateData.isPinned = Boolean(isPinned);

    await updateDoc(docRef, updateData);

    // 공지사항 캐시 무효화
    invalidateAnnouncementsCache(subdomain);

    return NextResponse.json({ success: true, message: '공지사항이 성공적으로 수정되었습니다.' });
  } catch (error: any) {
    console.error('Error updating announcement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 공지사항 삭제 (주최자 관리자 전용)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string; id: string }> }
) {
  try {
    const auth = authenticateApiRequest(req, ['admin']);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { subdomain, id } = await params;
    const docRef = doc(firestore, 'announcements', id);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: '해당 공지사항을 찾을 수 없습니다.' }, { status: 404 });
    }

    await deleteDoc(docRef);

    // 공지사항 캐시 무효화
    invalidateAnnouncementsCache(subdomain);

    return NextResponse.json({ success: true, message: '공지사항이 성공적으로 삭제되었습니다.' });
  } catch (error: any) {
    console.error('Error deleting announcement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
