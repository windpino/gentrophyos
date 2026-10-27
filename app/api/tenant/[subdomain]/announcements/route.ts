import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { authenticateApiRequest } from '@/src/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 공지사항 목록 조회 (방문자 & 관리자 공용)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;

    const q = query(
      collection(firestore, 'announcements'),
      where('subdomain', '==', subdomain)
    );

    const snapshot = await getDocs(q);
    const announcements = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as any[];

    // 상단 고정(isPinned) 우선 정렬 후, 최신 작성순(createdAt DESC)
    announcements.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({ announcements });
  } catch (error: any) {
    console.error('Error fetching announcements:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 새 공지사항 작성 (주최자 ERP 관리자 전용)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const auth = authenticateApiRequest(req, ['admin']);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { subdomain } = await params;
    const body = await req.json();
    const { title, content, author, category, isPopup, isPinned } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: '공지사항 제목을 입력해 주세요.' }, { status: 400 });
    }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: '공지사항 내용을 입력해 주세요.' }, { status: 400 });
    }

    const newDocRef = doc(collection(firestore, 'announcements'));
    const now = new Date().toISOString();

    const newAnnouncement = {
      id: newDocRef.id,
      subdomain,
      tenantId: subdomain,
      title: title.trim(),
      content: content.trim(),
      author: (author || '대회운영본부').trim(),
      category: category || '일반공지',
      isPopup: Boolean(isPopup),
      isPinned: Boolean(isPinned),
      views: 0,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(newDocRef, newAnnouncement);

    return NextResponse.json({ success: true, announcement: newAnnouncement });
  } catch (error: any) {
    console.error('Error creating announcement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
