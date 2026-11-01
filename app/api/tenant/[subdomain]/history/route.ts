import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
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

// 이순신장군배 전국윈드서핑대회 역대 공식 기록 기본 데이터
const DEFAULT_SEED_EDITIONS: Omit<TournamentHistoryEdition, 'subdomain'>[] = [
  {
    id: 'edition-20-2026',
    edition: 20,
    year: 2026,
    title: '제20회 이순신장군배 전국윈드서핑대회',
    duration: '2026. 10. 31(토) ~ 11. 01(일)',
    location: '경상남도 통영시 도남동 공설해수욕장 일원 해상',
    participantCount: 130,
    divisionCount: 5,
    hostOrg: '통영시, 한국윈드서핑협회',
    supervisor: '통영시윈드서핑협회',
    summaryNote: '20주년 기념 전국 130명 정원 조기 마감 성황리 개최. 혼합오픈·펀&포뮬러·윈드포일·윙포일·단체전 5개 종목 열전.',
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    divisions: [
      {
        division: '혼합오픈',
        podium: [
          { rank: 1, name: '조병구', club: '서울클럽서프', bibNumber: '연두 07', points: '6점', note: '1위 (금메달)' },
          { rank: 2, name: '김현수', club: '통영윈드서핑협회', bibNumber: '연두 20', points: '6점', note: '2위 (은메달)' },
          { rank: 3, name: '이명헌', club: '경기연맹', bibNumber: '연두 16', points: '8점', note: '3위 (동메달)' },
        ]
      },
      {
        division: '펀&포뮬러',
        podium: [
          { rank: 1, name: '박두섭', club: '통영윈드서핑협회', bibNumber: '연두 31', points: '1점', note: '1위 (금메달)' },
          { rank: 2, name: '신지현', club: '창원윈드클럽', bibNumber: '연두 33', points: '2점', note: '2위 (은메달)' },
          { rank: 3, name: '이후상', club: '부산해운대서프', bibNumber: '연두 34', points: '3점', note: '3위 (동메달)' },
        ]
      },
      {
        division: '윈드포일',
        podium: [
          { rank: 1, name: '안기범', club: '서울휴티', bibNumber: '흰색 01', points: '1점', note: '1위 (금메달)' },
          { rank: 2, name: '이정제', club: '고성클럽', bibNumber: '흰색 02', points: '2점', note: '2위 (은메달)' },
          { rank: 3, name: '김쌍기', club: '서울클럽서프', bibNumber: '흰색 03', points: '3점', note: '3위 (동메달)' },
        ]
      },
      {
        division: '윙포일',
        podium: [
          { rank: 1, name: '김진숙', club: '통영윈드서핑협회', bibNumber: '흰색 28', points: '1점', note: '1위 (금메달)' },
          { rank: 2, name: '김현진', club: '부산서핑협회', bibNumber: '흰색 21', points: '2점', note: '2위 (은메달)' },
          { rank: 3, name: '박상우', club: '거제서핑클럽', bibNumber: '흰색 15', points: '3점', note: '3위 (동메달)' },
        ]
      },
      {
        division: '단체전',
        podium: [
          { rank: 1, name: '통영윈드서핑협회', club: '통영윈드서핑협회', bibNumber: 'T1', points: '1점', note: '1위 (우승기/금메달)' },
          { rank: 2, name: '거제한화오션윈드서핑클럽', club: '거제한화오션', bibNumber: 'T2', points: '2점', note: '2위 (은메달)' },
          { rank: 3, name: '가천대', club: '가천대학교', bibNumber: 'T3', points: '3점', note: '3위 (동메달)' },
        ]
      }
    ]
  },
  {
    id: 'edition-19-2025',
    edition: 19,
    year: 2025,
    title: '제19회 이순신장군배 전국윈드서핑대회',
    duration: '2025. 10. 25(토) ~ 10. 26(일)',
    location: '경상남도 통영시 도남항 공설해수욕장 일원',
    participantCount: 124,
    divisionCount: 4,
    hostOrg: '통영시, 한국윈드서핑협회',
    supervisor: '통영시윈드서핑협회',
    summaryNote: '가을 통영 앞바다의 최적 바람 속에서 전국 각지 124명의 선수가 참가하여 치열한 레이스를 펼침.',
    createdAt: '2025-10-26T12:00:00.000Z',
    updatedAt: '2025-10-26T12:00:00.000Z',
    divisions: [
      {
        division: '혼합오픈',
        podium: [
          { rank: 1, name: '김현수', club: '통영윈드서핑협회', points: '4점', note: '1위 (금메달)' },
          { rank: 2, name: '조병구', club: '서울클럽서프', points: '7점', note: '2위 (은메달)' },
          { rank: 3, name: '강민철', club: '거제한화오션', points: '11점', note: '3위 (동메달)' },
        ]
      },
      {
        division: '펀&포뮬러',
        podium: [
          { rank: 1, name: '신지현', club: '창원윈드클럽', points: '2점', note: '1위 (금메달)' },
          { rank: 2, name: '박두섭', club: '통영윈드서핑협회', points: '4점', note: '2위 (은메달)' },
          { rank: 3, name: '송준호', club: '부산연맹', points: '6점', note: '3위 (동메달)' },
        ]
      },
      {
        division: '윈드포일',
        podium: [
          { rank: 1, name: '이정제', club: '고성클럽', points: '3점', note: '1위 (금메달)' },
          { rank: 2, name: '안기범', club: '서울휴티', points: '5점', note: '2위 (은메달)' },
          { rank: 3, name: '최재준', club: '통영윈드서핑협회', points: '9점', note: '3위 (동메달)' },
        ]
      },
      {
        division: '단체전',
        podium: [
          { rank: 1, name: '거제한화오션윈드서핑클럽', club: '거제한화오션', points: '1점', note: '1위 (우승)' },
          { rank: 2, name: '통영윈드서핑협회', club: '통영윈드서핑협회', points: '2점', note: '2위 (준우승)' },
          { rank: 3, name: '서울클럽서프', club: '서울클럽서프', points: '3점', note: '3위 (3위)' },
        ]
      }
    ]
  },
  {
    id: 'edition-18-2024',
    edition: 18,
    year: 2024,
    title: '제18회 이순신장군배 전국윈드서핑대회',
    duration: '2024. 10. 26(토) ~ 10. 27(일)',
    location: '경상남도 통영시 도남관광단지 특설 경기수역',
    participantCount: 118,
    divisionCount: 4,
    hostOrg: '통영시, 한국윈드서핑협회',
    supervisor: '통영시윈드서핑협회',
    summaryNote: '맑은 날씨와 12노트의 쾌적한 풍속 속에 118명의 동호인 및 엘리트 선수들의 화합의 장 마련.',
    createdAt: '2024-10-27T12:00:00.000Z',
    updatedAt: '2024-10-27T12:00:00.000Z',
    divisions: [
      {
        division: '혼합오픈',
        podium: [
          { rank: 1, name: '조병구', club: '서울클럽서프', points: '5점', note: '1위 (금메달)' },
          { rank: 2, name: '김윤호', club: '대구연맹', points: '8점', note: '2위 (은메달)' },
          { rank: 3, name: '임지훈', club: '통영윈드서핑협회', points: '10점', note: '3위 (동메달)' },
        ]
      },
      {
        division: '펀&포뮬러',
        podium: [
          { rank: 1, name: '이후상', club: '부산해운대서프', points: '3점', note: '1위 (금메달)' },
          { rank: 2, name: '정세화', club: '울산클럽', points: '5점', note: '2위 (은메달)' },
          { rank: 3, name: '박두섭', club: '통영윈드서핑협회', points: '6점', note: '3위 (동메달)' },
        ]
      },
      {
        division: '윈드포일',
        podium: [
          { rank: 1, name: '안기범', club: '서울휴티', points: '2점', note: '1위 (금메달)' },
          { rank: 2, name: '김쌍기', club: '서울클럽서프', points: '4점', note: '2위 (은메달)' },
          { rank: 3, name: '이정제', club: '고성클럽', points: '7점', note: '3위 (동메달)' },
        ]
      },
      {
        division: '단체전',
        podium: [
          { rank: 1, name: '통영윈드서핑협회', club: '통영윈드서핑협회', points: '1점', note: '1위 (우승)' },
          { rank: 2, name: '서울클럽서프', club: '서울클럽서프', points: '2점', note: '2위 (준우승)' },
          { rank: 3, name: '가천대학교', club: '가천대학교', points: '3점', note: '3위 (3위)' },
        ]
      }
    ]
  },
  {
    id: 'edition-17-2023',
    edition: 17,
    year: 2023,
    title: '제17회 이순신장군배 전국윈드서핑대회',
    duration: '2023. 10. 28(토) ~ 10. 29(일)',
    location: '경상남도 통영시 도남항 해상',
    participantCount: 105,
    divisionCount: 3,
    hostOrg: '통영시, 한국윈드서핑협회',
    supervisor: '통영시윈드서핑협회',
    summaryNote: '통영 한산대첩의 기상을 기리는 제17회 대회. 105명의 선수가 참가하여 성황리 종료.',
    createdAt: '2023-10-29T12:00:00.000Z',
    updatedAt: '2023-10-29T12:00:00.000Z',
    divisions: [
      {
        division: '혼합오픈',
        podium: [
          { rank: 1, name: '김현수', club: '통영윈드서핑협회', points: '3점', note: '1위 (금메달)' },
          { rank: 2, name: '이명헌', club: '경기연맹', points: '6점', note: '2위 (은메달)' },
          { rank: 3, name: '김태원', club: '부산서핑클럽', points: '9점', note: '3위 (동메달)' },
        ]
      },
      {
        division: '펀&포뮬러',
        podium: [
          { rank: 1, name: '박두섭', club: '통영윈드서핑협회', points: '2점', note: '1위 (금메달)' },
          { rank: 2, name: '신동욱', club: '대구연맹', points: '4점', note: '2위 (은메달)' },
          { rank: 3, name: '정수천', club: '광양윈드', points: '7점', note: '3위 (동메달)' },
        ]
      },
      {
        division: '단체전',
        podium: [
          { rank: 1, name: '통영윈드서핑협회', club: '통영윈드서핑협회', points: '1점', note: '1위 (우승)' },
          { rank: 2, name: '거제한화오션', club: '거제한화오션', points: '2점', note: '2위 (준우승)' },
          { rank: 3, name: '광양서핑동호회', club: '광양서핑동호회', points: '3점', note: '3위 (3위)' },
        ]
      }
    ]
  }
];

// 역대 기록 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;

    const q = query(
      collection(firestore, 'tournament_history'),
      where('subdomain', '==', subdomain)
    );
    const snapshot = await getDocs(q);

    let editions: TournamentHistoryEdition[] = [];
    if (!snapshot.empty) {
      editions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as TournamentHistoryEdition[];
    } else {
      // 초기 기본 시드 데이터 반환 (subdomain 바인딩)
      editions = DEFAULT_SEED_EDITIONS.map(item => ({
        ...item,
        subdomain,
      }));
    }

    // 회차(edition) 및 연도(year) 내림차순 정렬 (최신 대회가 최상단)
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

    if (!edition || !year || !title) {
      return NextResponse.json({ error: '회차, 연도, 대회명은 필수 입력 항목입니다.' }, { status: 400 });
    }

    const docId = body.id || `edition-${edition}-${year}`;
    const now = new Date().toISOString();

    const recordData: TournamentHistoryEdition = {
      id: docId,
      subdomain,
      edition: Number(edition),
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
