import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit, addDoc } from 'firebase/firestore';
import { getCachedTenantFull } from '@/src/lib/tenantCache';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');

    // 캐시된 테넌트 및 대회 정보 활용 (Read 95% 이상 절감)
    const cached = await getCachedTenantFull(subdomain);
    if (!cached) {
      return NextResponse.json({ error: '채널을 찾을 수 없습니다.' }, { status: 404 });
    }
    const tenant = cached.tenantData;

    let queryTournamentId = tournamentId;
    if (!queryTournamentId) {
      const ongoingTour = cached.tournaments.find((t: any) => t.status === 'ONGOING');
      if (ongoingTour) {
        queryTournamentId = ongoingTour.id;
      }
    }

    if (!queryTournamentId) {
      return NextResponse.json({ registrations: [], formFields: [] });
    }

    // 1. 참가 신청 목록 조회 (해당 대회의 신청서만 단일 쿼리)
    const regsQuery = query(
      collection(firestore, 'registrations'),
      where('tournamentId', '==', queryTournamentId)
    );
    const regsSnap = await getDocs(regsQuery);

    // [최적화 핵심] 테넌트 전체 플레이어 전수 조회(all players query)를 완전히 제거하여 대규모 Read 폭탄 차단.
    // registrations 문서에 비정규화된 player 정보를 우선 사용하고, 누락된 경우에만 개별 조회.
    const missingPlayerIds = new Set<string>();
    regsSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.player && data.playerId) {
        missingPlayerIds.add(data.playerId);
      }
    });

    const fallbackPlayersMap = new Map<string, any>();
    if (missingPlayerIds.size > 0) {
      const playerPromises = Array.from(missingPlayerIds).map(async (pid) => {
        try {
          const pSnap = await getDoc(doc(firestore, 'players', pid));
          if (pSnap.exists()) {
            fallbackPlayersMap.set(pid, pSnap.data());
          }
        } catch (e) {}
      });
      await Promise.all(playerPromises);
    }

    const clubSet = new Set<string>();

    const registrations = regsSnap.docs.map(docSnap => {
      const data = docSnap.data();
      const fallbackPlayer = fallbackPlayersMap.get(data.playerId);

      let phoneFromResponses = '';
      try {
        if (data.formResponses) {
          const extra = typeof data.formResponses === 'string' ? JSON.parse(data.formResponses) : data.formResponses;
          phoneFromResponses = extra.phone || '';
          if (extra.club && typeof extra.club === 'string') {
            const trimmed = extra.club.trim();
            if (trimmed && trimmed !== '미소속' && trimmed !== '-') {
              clubSet.add(trimmed);
            }
          }
        }
      } catch (e) {}

      if (data.player?.club) {
        const trimmed = String(data.player.club).trim();
        if (trimmed && trimmed !== '미소속' && trimmed !== '-') {
          clubSet.add(trimmed);
        }
      }

      const phone = phoneFromResponses || data.player?.phone || fallbackPlayer?.phone || '';

      return {
        ...data,
        id: docSnap.id,
        createdAt: new Date(data.createdAt),
        player: {
          ...(data.player || {}),
          id: data.playerId,
          name: data.player?.name || fallbackPlayer?.name || '',
          phone,
        }
      };
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 2. 동적 신청 폼 설정 조회
    const formConfigsQuery = query(
      collection(firestore, `tournaments/${queryTournamentId}/formConfigs`),
      limit(1)
    );
    const formConfigsSnap = await getDocs(formConfigsQuery);
    let formFields = [];
    if (!formConfigsSnap.empty) {
      const formConfig = formConfigsSnap.docs[0].data();
      formFields = formConfig.fields ? JSON.parse(formConfig.fields) : [];
    }

    // 3. 기등록된 소속 협회/클럽명 추천 목록
    const defaultClubs = [
      '통영윈드서핑협회',
      '통영윈드서핑클럽',
      '경남윈드서핑카이트보딩협회',
      '대한윈드서핑카이트보딩협회',
      '부산윈드서핑클럽',
      '거제윈드서핑클럽',
      '창원마산윈드서핑클럽',
      '서울뚝섬윈드서핑클럽',
      '여수윈드서핑클럽',
      '울산윈드서핑클럽',
      '포항윈드서핑클럽',
      '제주윈드서핑클럽'
    ];
    defaultClubs.forEach(c => clubSet.add(c));

    const registeredClubs = Array.from(clubSet);

    return NextResponse.json({ registrations, formFields, registeredClubs }, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=29',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const body = await req.json();
    const { tournamentId, name, email, phone, formResponses } = body;

    if (!tournamentId || !name) {
      return NextResponse.json({ error: '선수 이름과 대회 정보는 필수입니다.' }, { status: 400 });
    }

    const cached = await getCachedTenantFull(subdomain);
    if (!cached) {
      return NextResponse.json({ error: '채널을 찾을 수 없습니다.' }, { status: 404 });
    }
    const tenant = cached.tenantData;

    const overviewConfig = tenant.overviewConfig || {};
    const regMode = overviewConfig.registrationMode || (overviewConfig.registrationEnabled === false ? 'DISABLED' : 'FORCE_ENABLED');
    const startDate = overviewConfig.registrationStartDate ? new Date(overviewConfig.registrationStartDate) : null;
    const endDate = overviewConfig.registrationEndDate ? new Date(overviewConfig.registrationEndDate) : null;
    const now = new Date();

    if (regMode === 'DISABLED' || overviewConfig.registrationEnabled === false) {
      return NextResponse.json({
        error: overviewConfig.registrationNotice || '현재는 대회 주최 측에 의해 참가 신청 접수가 일시 중단되었습니다.'
      }, { status: 400 });
    }

    if (regMode !== 'FORCE_ENABLED') {
      if (startDate && !isNaN(startDate.getTime()) && now < startDate) {
        return NextResponse.json({
          error: `대회 참가 신청 기간 전입니다. (접수 시작: ${overviewConfig.registrationStartDate.replace('T', ' ')})`
        }, { status: 400 });
      }
      if (endDate && !isNaN(endDate.getTime()) && now > endDate) {
        return NextResponse.json({
          error: `대회 참가 신청 접수가 마감되었습니다. (접수 마감: ${overviewConfig.registrationEndDate.replace('T', ' ')})`
        }, { status: 400 });
      }
    }

    // 1. 기존 등록 선수 조회 (limit 1)
    const playerQuery = query(
      collection(firestore, 'players'),
      where('tenantId', '==', tenant.id),
      where('name', '==', name),
      where('phone', '==', phone),
      limit(1)
    );
    const playerSnap = await getDocs(playerQuery);
    let player: any = null;

    if (playerSnap.empty) {
      // [최적화] 이전에는 카운트를 위해 전체 선수를 getDocs로 전수 조회(수백~수천 Read)하던 것을,
      // 타임스탬프와 난수 기반 고유 식별 코드로 즉시 생성하여 불필요한 Firestore Read를 0회로 절감.
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const timeSuffix = Date.now().toString(36).toUpperCase();
      const uniqueCode = `PL-${name.toUpperCase()}-${timeSuffix}-${randomSuffix}`;

      const newPlayerRef = await addDoc(collection(firestore, 'players'), {
        tenantId: tenant.id,
        name,
        email,
        phone,
        uniqueCode,
        createdAt: new Date().toISOString(),
      });

      player = {
        id: newPlayerRef.id,
        tenantId: tenant.id,
        name,
        email,
        phone,
        uniqueCode,
      };

      await addDoc(collection(firestore, 'playerStats'), {
        playerId: newPlayerRef.id,
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      });
    } else {
      const docSnap = playerSnap.docs[0];
      player = {
        id: docSnap.id,
        ...docSnap.data()
      };
    }

    // 2. 중복 신청 방지 (limit 1)
    const existingRegQuery = query(
      collection(firestore, 'registrations'),
      where('tournamentId', '==', tournamentId),
      where('playerId', '==', player.id),
      limit(1)
    );
    const existingRegSnap = await getDocs(existingRegQuery);
    if (!existingRegSnap.empty) {
      return NextResponse.json({ error: '이미 해당 대회에 신청 완료된 선수입니다.' }, { status: 400 });
    }

    // 3. 신청서 접수 (선수 정보를 비정규화하여 저장 -> 차후 조회 시 조인 Read 제로화)
    const newRegRef = await addDoc(collection(firestore, 'registrations'), {
      tournamentId,
      playerId: player.id,
      formResponses: JSON.stringify(formResponses),
      paymentStatus: 'PENDING',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      player: {
        id: player.id,
        name: player.name,
        phone: player.phone || phone || '',
      }
    });

    const registration = {
      id: newRegRef.id,
      tournamentId,
      playerId: player.id,
      formResponses: JSON.stringify(formResponses),
      paymentStatus: 'PENDING',
      status: 'PENDING',
    };

    return NextResponse.json({ success: true, registration, player });
  } catch (error: any) {
    console.error('참가 신청 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
