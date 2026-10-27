import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db as firestore } from '@/src/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { authenticateApiRequest } from '@/src/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

function maskName(name: string): string {
  if (!name) return '익명';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${'*'.repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`;
}

// Q&A 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const auth = authenticateApiRequest(req, ['admin']);
    const isAdmin = auth.authorized;

    const q = query(
      collection(firestore, 'qna'),
      where('subdomain', '==', subdomain)
    );

    const snapshot = await getDocs(q);
    const qnaList = snapshot.docs.map((d) => {
      const data = d.data();
      const isSecret = Boolean(data.isSecret);

      if (isAdmin) {
        // 관리자는 비밀번호 해시 제외하고 모든 내용(질문/답변 원문) 열람 가능
        return {
          id: d.id,
          title: data.title,
          content: data.content,
          authorName: data.authorName,
          isSecret,
          status: data.status || (data.answer ? 'ANSWERED' : 'WAITING'),
          answer: data.answer || null,
          answeredAt: data.answeredAt || null,
          answeredBy: data.answeredBy || null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      }

      // 일반 방문자:
      // 비밀글인 경우 본문 마스킹 (작성자 비밀번호 확인 모달을 통해 /verify 엔드포인트로 원문 열람)
      return {
        id: d.id,
        title: data.title,
        content: isSecret ? '🔒 비밀글입니다. 작성자와 관리자만 확인하실 수 있습니다.' : data.content,
        authorName: isSecret ? maskName(data.authorName) : data.authorName,
        isSecret,
        status: data.status || (data.answer ? 'ANSWERED' : 'WAITING'),
        answer: isSecret ? (data.answer ? '🔒 비밀 답변입니다.' : null) : (data.answer || null),
        answeredAt: data.answeredAt || null,
        answeredBy: data.answeredBy || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }) as any[];

    // 최신 등록순 정렬 (createdAt DESC)
    qnaList.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({ qnaList });
  } catch (error: any) {
    console.error('Error fetching Q&A list:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Q&A 질문 작성 (방문자 누구나 이름/비밀번호로 작성)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const body = await req.json();
    const { title, content, authorName, password, isSecret } = body;

    if (!authorName || !authorName.trim()) {
      return NextResponse.json({ error: '작성자 이름을 입력해 주세요.' }, { status: 400 });
    }
    if (!password || password.trim().length < 4) {
      return NextResponse.json({ error: '비밀번호를 4자리 이상 입력해 주세요 (글 수정/삭제 및 비밀글 열람용).' }, { status: 400 });
    }
    if (!title || !title.trim()) {
      return NextResponse.json({ error: '질문 제목을 입력해 주세요.' }, { status: 400 });
    }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: '질문 내용을 입력해 주세요.' }, { status: 400 });
    }

    const newDocRef = doc(collection(firestore, 'qna'));
    const now = new Date().toISOString();

    const newQna = {
      id: newDocRef.id,
      subdomain,
      tenantId: subdomain,
      title: title.trim(),
      content: content.trim(),
      authorName: authorName.trim(),
      passwordHash: hashPassword(password),
      isSecret: Boolean(isSecret),
      status: 'WAITING',
      answer: null,
      answeredAt: null,
      answeredBy: null,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(newDocRef, newQna);

    return NextResponse.json({
      success: true,
      qna: {
        id: newQna.id,
        title: newQna.title,
        authorName: newQna.authorName,
        isSecret: newQna.isSecret,
        status: newQna.status,
        createdAt: newQna.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error creating Q&A:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
