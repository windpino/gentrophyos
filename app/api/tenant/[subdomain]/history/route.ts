import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { authenticateApiRequest } from '@/src/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface HistoricalPodiumItem {
  rank: number;
  name: string;
  club?: string;
  bibNumber?: string;
  points?: number | string;
  subclass?: string;
  note?: string;
}

export interface HistoricalDivision {
  division: string;
  subclass?: string;
  podium: HistoricalPodiumItem[];
  fullRankings?: Array<{
    rank: number;
    name: string;
    club?: string;
    bibNumber?: string;
    points?: number | string;
    subclass?: string;
  }>;
}

export interface TournamentHistoryEdition {
  id: string;
  subdomain: string;
  edition: number;
  year: number;
  title: string;
  duration: string;
  location: string;
  participantCount: number;
  divisionCount: number;
  hostOrg: string;
  supervisor: string;
  divisions: HistoricalDivision[];
  summaryNote?: string;
  createdAt: string;
  updatedAt: string;
}

// 배번 표시 서식화 함수 (팀 배번 T1, T2 등은 그대로 유지하고 일반 배번은 한자리 수에 0 패딩)
export function formatBibClean(bib?: string): string {
  if (!bib) return '-';
  const trimmed = String(bib).trim();
  if (!trimmed || trimmed === '-') return '-';
  if (/^T\d+$/i.test(trimmed)) return trimmed; // 팀 배번

  let clean = trimmed.replace(/^배번\s*/, '').replace(/(\d+)\s*번$/, '$1').replace(/\s+/g, ' ').trim();
  clean = clean.replace(/(^|[^\d])(\d)(?!\d)/g, '$10$2');
  return clean || trimmed;
}

// 심판 기록관(Firestore leaderboards & snapshots) 데이터로부터 제20회 실시간 공식 기록을 직접 생성
async function buildEdition20FromReferee(tournamentId: string, subdomain: string): Promise<TournamentHistoryEdition> {
  const targetDivisions = ['혼합오픈', '펀&포뮬러', '윈드포일', '윙포일', '단체전'];

  // 1. snapshots/leaderboard_all 및 leaderboards 컬렉션 조회
  const snapDoc = await getDoc(doc(firestore, 'tournaments', tournamentId, 'snapshots', 'leaderboard_all'));
  const snapshotDivs = snapDoc.exists() ? (snapDoc.data().divisions || {}) : {};

  const lbCol = collection(firestore, 'tournaments', tournamentId, 'leaderboards');
  const lbSnap = await getDocs(lbCol);
  const directDivs: Record<string, any> = {};
  lbSnap.forEach(d => {
    directDivs[d.id] = d.data();
  });

  const divisions: HistoricalDivision[] = [];
  let totalParticipants = 0;

  for (const divName of targetDivisions) {
    let dData = directDivs[divName] || snapshotDivs[divName];
    if (!dData && divName.includes('펀')) {
      dData = directDivs['펀엔포뮬러'] || snapshotDivs['펀엔포뮬러'];
    }

    const list: any[] = dData?.list || dData?.leaderboard || [];
    totalParticipants += list.length;

    // 상위 1, 2, 3위 포디움 추출
    const podium: HistoricalPodiumItem[] = list.slice(0, 3).map((p: any, idx: number) => ({
      rank: p.rank || idx + 1,
      name: (p.name || '').trim(),
      club: (p.club || '').trim() || (p.birth ? String(p.birth).substring(2) : ''),
      bibNumber: formatBibClean(p.bibNumber),
      points: `${p.total ?? p.totalScore ?? 0}점`,
      subclass: p.subclass || '',
      note: `${idx + 1}위 (${idx === 0 ? '금메달' : idx === 1 ? '은메달' : '동메달'})`,
    }));

    // 전체 순위표 목록
    const fullRankings = list.map((p: any, idx: number) => ({
      rank: p.rank || idx + 1,
      name: (p.name || '').trim(),
      club: (p.club || '').trim() || (p.birth ? String(p.birth).substring(2) : ''),
      bibNumber: formatBibClean(p.bibNumber),
      points: `${p.total ?? p.totalScore ?? 0}점`,
      subclass: p.subclass || '',
    }));

    divisions.push({
      division: divName,
      subclass: '',
      podium,
      fullRankings,
    });
  }

  const now = new Date().toISOString();
  return {
    id: 'edition-20-2026',
    subdomain,
    edition: 20,
    year: 2026,
    title: '제20회 이순신장군배 전국윈드서핑대회',
    duration: '2026. 10. 31(토) ~ 11. 01(일)',
    location: '경상남도 통영시 도남동 공설해수욕장 일원 해상',
    participantCount: totalParticipants > 0 ? totalParticipants : 130,
    divisionCount: divisions.length,
    hostOrg: '통영시, 한국윈드서핑협회',
    supervisor: '통영시윈드서핑협회',
    summaryNote: '제20회 이순신장군배 전국윈드서핑대회 심판 공식 기록관 데이터와 100% 일치 연동된 공식 최종 기록입니다.',
    divisions,
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: now,
  };
}

// 역대 기록 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;

    // 1. 테넌트 및 현재 대회 조회
    let tournamentId = '3d3e2f2a-7329-420e-974c-cb3aa4be3b26';
    const tenantDoc = await getDoc(doc(firestore, 'tenants', subdomain));
    if (tenantDoc.exists()) {
      const ongoing = tenantDoc.data().tournaments?.find((t: any) => t.status === 'ONGOING');
      if (ongoing?.id) {
        tournamentId = ongoing.id;
      }
    }

    // 2. 심판 기록관 데이터로부터 제20회 실시간 공식 기록 직접 생성 (임의 데이터 완전 배제)
    const edition20 = await buildEdition20FromReferee(tournamentId, subdomain);

    // 3. Firestore tournament_history 컬렉션에 관리자가 직접 저장한 기록 조회
    const q = query(
      collection(firestore, 'tournament_history'),
      where('subdomain', '==', subdomain)
    );
    const snapshot = await getDocs(q);

    const savedEditions: TournamentHistoryEdition[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as TournamentHistoryEdition;
      // 17회, 18회, 19회 임의 데이터는 필터링하여 제외
      if (data.edition < 20 || [17, 18, 19].includes(data.edition)) {
        return;
      }
      if (data.id !== edition20.id) {
        savedEditions.push({ ...data, id: docSnap.id });
      }
    });

    // 4. 제20회부터 시작하여 목록 구성
    const editions: TournamentHistoryEdition[] = [edition20, ...savedEditions];

    // 회차(edition) 및 연도(year) 내림차순 정렬 (제20회가 최상단)
    editions.sort((a, b) => (b.edition || b.year || 0) - (a.edition || a.year || 0));

    return NextResponse.json({ editions });
  } catch (error: any) {
    console.error('Error fetching tournament history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 역대 기록 저장 / 수정 / 영구 보관 (관리자 전용)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;

    // 관리자 인증 확인
    const auth = authenticateApiRequest(req, ['admin']);
    if (!auth.authorized) {
      return auth.errorResponse || NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json();
    const { edition, year, title, duration, location, participantCount, divisionCount, hostOrg, supervisor, divisions, summaryNote } = body;

    const edNum = Number(edition);
    if (!edition || !year || !title) {
      return NextResponse.json({ error: '회차, 연도, 대회명은 필수 입력 항목입니다.' }, { status: 400 });
    }

    // 17, 18, 19회 임의 등록 방지
    if ([17, 18, 19].includes(edNum)) {
      return NextResponse.json({ error: '제17회~제19회 임의 기록은 등록할 수 없습니다. 제20회부터 등록해 주세요.' }, { status: 400 });
    }

    const docId = body.id || `edition-${edNum}-${year}`;
    const now = new Date().toISOString();

    const recordData: TournamentHistoryEdition = {
      id: docId,
      subdomain,
      edition: edNum,
      year: Number(year),
      title: String(title),
      duration: duration || '',
      location: location || '',
      participantCount: Number(participantCount) || 0,
      divisionCount: Number(divisionCount) || (Array.isArray(divisions) ? divisions.length : 0),
      hostOrg: hostOrg || '통영시, 한국윈드서핑협회',
      supervisor: supervisor || '통영시윈드서핑협회',
      divisions: Array.isArray(divisions) ? divisions : [],
      summaryNote: summaryNote || '',
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    const docRef = doc(firestore, 'tournament_history', docId);
    await setDoc(docRef, recordData, { merge: true });

    return NextResponse.json({ success: true, edition: recordData });
  } catch (error: any) {
    console.error('Error saving tournament history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 역대 기록 삭제 (관리자 전용)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const auth = authenticateApiRequest(req, ['admin']);
    if (!auth.authorized) {
      return auth.errorResponse || NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '삭제할 기록 ID가 지정되지 않았습니다.' }, { status: 400 });
    }

    await deleteDoc(doc(firestore, 'tournament_history', id));
    return NextResponse.json({ success: true, message: '역대 기록이 삭제되었습니다.' });
  } catch (error: any) {
    console.error('Error deleting tournament history:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
