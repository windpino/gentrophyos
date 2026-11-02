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

// GET: 이의제기 목록 조회 및 항의 시한(1시간) 메타데이터 반환
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const auth = authenticateApiRequest(req, ['admin', 'referee']);
    const isPrivileged = auth.authorized;

    // 테넌트 설정 조회 (점수 공개 시각 및 1시간 카운트다운 정보)
    const tenantRef = doc(firestore, 'tenants', subdomain);
    const tenantSnap = await getDoc(tenantRef);
    const tenantData = tenantSnap.exists() ? tenantSnap.data() : {};
    const overviewConfig = tenantData.overviewConfig || {};
    const isPublished = Boolean(overviewConfig.leaderboardPublished || overviewConfig.bracketsPublished);
    const publishedAt = overviewConfig.leaderboardPublishedAt || overviewConfig.bracketsPublishedAt || tenantData.updatedAt || null;

    // 1. 일반 사용자(선수/관람객) 요청인 경우:
    // 내역 목록은 심판진에게만 직통 전달되므로 공개하지 않고 빈 배열과 타이머 메타데이터만 반환
    if (!isPrivileged) {
      return NextResponse.json({
        protests: [],
        isPrivileged: false,
        timeLimit: {
          isPublished,
          publishedAt,
          timeLimitMinutes: 60,
        },
        message: '이의제기 접수 내역은 공정한 심의를 위해 심판진에게만 비공개로 전달됩니다.'
      });
    }

    // 2. 심판/관리자 인증 요청인 경우:
    // 심판진의 원활한 심의 처리를 위해 전체 이의제기 목록 반환
    const q = query(
      collection(firestore, 'protests'),
      where('subdomain', '==', subdomain)
    );

    const snapshot = await getDocs(q);
    const protestList = snapshot.docs.map((d) => {
      const data = d.data() as ProtestItem;
      const { id: _itemDocId, passwordHash, ...rest } = data;
      return {
        id: d.id,
        ...rest,
      };
    });

    // 최신 등록순 정렬
    protestList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      protests: protestList,
      isPrivileged: true,
      timeLimit: {
        isPublished,
        publishedAt,
        timeLimitMinutes: 60,
      }
    });
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

    const receiptNumber = `PR-2026-${id.slice(-6).toUpperCase()}`;

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
      isSecret: true, // 심판진 직통 비공개 전달 보장
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
    return NextResponse.json({
      success: true,
      protest: safeItem,
      receiptNumber,
      message: '이의제기가 심판진에게 비공개로 즉시 전달되었습니다.'
    }, { status: 201 });
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
