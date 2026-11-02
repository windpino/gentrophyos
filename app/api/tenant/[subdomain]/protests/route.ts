import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db as firestore } from '@/src/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { authenticateApiRequest } from '@/src/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface ProtestItem {
  id: string;
  subdomain: string;
  tournamentId?: string;
  applicantName: string;
  bibNumber: string;
  division: string;
  subclass?: string;
  club?: string;
  phone?: string;
  passwordHash?: string;
  isSecret?: boolean;
  protestType: 'SCORING' | 'RULE' | 'EQUIPMENT' | 'OTHER';
  targetRound: string;
  respondent?: string;
  incidentTime?: string;
  content: string;
  evidenceUrl?: string;
  status: 'PENDING' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'RESOLVED';
  officialDecision?: string;
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

function maskName(name: string): string {
  if (!name) return '선수';
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${'*'.repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`;
}

// GET: 이의제기 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const auth = authenticateApiRequest(req, ['admin', 'referee']);
    const isPrivileged = auth.authorized;

    const q = query(
      collection(firestore, 'protests'),
      where('subdomain', '==', subdomain)
    );

    const snapshot = await getDocs(q);
    const protestList = snapshot.docs.map((d) => {
      const data = d.data() as ProtestItem;
      const isSecret = Boolean(data.isSecret);

      if (isPrivileged) {
        // 심판/관리자는 패스워드 해시만 제외하고 모든 상세 정보 확인 가능
        const { id: _itemDocId, passwordHash, ...rest } = data;
        return {
          id: d.id,
          ...rest,
        };
      }

      // 일반 홈페이지 사용자
      if (isSecret) {
        // 비공개 이의제기: 접수 내용(사유/답변)은 공개하고, 접수자 및 대상자(상대 선수) 인적 사항은 가림
        return {
          id: d.id,
          subdomain: data.subdomain,
          applicantName: '익명 (비공개)',
          bibNumber: '비공개',
          division: data.division,
          subclass: data.subclass,
          club: '비공개',
          respondent: data.respondent ? '비공개' : '',
          incidentTime: data.incidentTime || '',
          protestType: data.protestType,
          targetRound: data.targetRound,
          isSecret: true,
          status: data.status || 'PENDING',
          officialDecision: data.officialDecision || null,
          decidedBy: data.decidedBy || null,
          decidedAt: data.decidedAt || null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          content: data.content,
        };
      }

      const { id: _itemDocId2, passwordHash, phone, ...safeData } = data;
      return {
        id: d.id,
        ...safeData,
        applicantName: data.applicantName,
      };
    });

    // 최신 등록순 정렬
    protestList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ protests: protestList });
  } catch (error: any) {
    console.error('이의제기 목록 조회 오류:', error);
    return NextResponse.json({ error: error.message || '조회 실패' }, { status: 500 });
  }
}

// POST: 신규 이의제기 접수 (선수 작성)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const body = await req.json();

    const {
      applicantName,
      bibNumber,
      division,
      subclass,
      club,
      phone,
      password,
      isSecret,
      protestType,
      targetRound,
      respondent,
      incidentTime,
      content,
      evidenceUrl,
      tournamentId,
    } = body;

    if (!applicantName || !bibNumber || !division || !targetRound || !content) {
      return NextResponse.json(
        { error: '이름, 배번, 종목, 대상 라운드, 구체적 사유는 필수 입력 사항입니다.' },
        { status: 400 }
      );
    }

    const id = `protest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newProtest: ProtestItem = {
      id,
      subdomain,
      tournamentId: tournamentId || '3d3e2f2a-7329-420e-974c-cb3aa4be3b26',
      applicantName: String(applicantName).trim(),
      bibNumber: String(bibNumber).trim(),
      division: String(division).trim(),
      subclass: subclass ? String(subclass).trim() : '',
      club: club ? String(club).trim() : '',
      phone: phone ? String(phone).trim() : '',
      passwordHash: password ? hashPassword(password) : '',
      isSecret: Boolean(isSecret),
      protestType: protestType || 'SCORING',
      targetRound: String(targetRound).trim(),
      respondent: respondent ? String(respondent).trim() : '',
      incidentTime: incidentTime ? String(incidentTime).trim() : '',
      content: String(content).trim(),
      evidenceUrl: evidenceUrl ? String(evidenceUrl).trim() : '',
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(firestore, 'protests', id), newProtest);

    const { passwordHash, ...safeItem } = newProtest;
    return NextResponse.json({ success: true, protest: safeItem }, { status: 201 });
  } catch (error: any) {
    console.error('이의제기 등록 실패:', error);
    return NextResponse.json({ error: error.message || '등록 실패' }, { status: 500 });
  }
}

// PATCH: 심판의 이의제기 심의 답변 및 처리 상태 변경 (민원 해결 시스템)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const auth = authenticateApiRequest(req, ['admin', 'referee']);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const body = await req.json();
    const { id, status, officialDecision, decidedBy } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'ID 및 처리 상태는 필수입니다.' }, { status: 400 });
    }

    const protestRef = doc(firestore, 'protests', id);
    const protestSnap = await getDoc(protestRef);

    if (!protestSnap.exists()) {
      return NextResponse.json({ error: '해당 이의제기 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      status,
      updatedAt: now,
    };

    if (officialDecision !== undefined) {
      updatePayload.officialDecision = String(officialDecision).trim();
      updatePayload.decidedAt = now;
      updatePayload.decidedBy = decidedBy ? String(decidedBy).trim() : (auth.payload?.role === 'referee' ? '수석심판관' : '경기위원회');
    }

    await setDoc(protestRef, updatePayload, { merge: true });

    return NextResponse.json({ success: true, id, status, updatedAt: now });
  } catch (error: any) {
    console.error('이의제기 심의 답변 처리 실패:', error);
    return NextResponse.json({ error: error.message || '수정 실패' }, { status: 500 });
  }
}

// DELETE: 이의제기 삭제 (작성자 비밀번호 확인 또는 심판/관리자)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const password = searchParams.get('password');

    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });
    }

    const auth = authenticateApiRequest(req, ['admin', 'referee']);
    const protestRef = doc(firestore, 'protests', id);
    const protestSnap = await getDoc(protestRef);

    if (!protestSnap.exists()) {
      return NextResponse.json({ error: '해당 이의제기가 존재하지 않습니다.' }, { status: 404 });
    }

    const data = protestSnap.data() as ProtestItem;

    if (!auth.authorized) {
      if (!password || !data.passwordHash || hashPassword(password) !== data.passwordHash) {
        return NextResponse.json({ error: '비밀번호가 일치하지 않거나 권한이 없습니다.' }, { status: 403 });
      }
    }

    await deleteDoc(protestRef);
    return NextResponse.json({ success: true, message: '이의제기가 성공적으로 삭제되었습니다.' });
  } catch (error: any) {
    console.error('이의제기 삭제 실패:', error);
    return NextResponse.json({ error: error.message || '삭제 실패' }, { status: 500 });
  }
}
