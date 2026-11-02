import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, setDoc } from 'firebase/firestore';
import { sortPlayersByRules, assignRanks, PlayerRankInput, MatchResult } from '@/src/lib/tieBreaker';
import { getCachedTenantFull, invalidateTenantCache } from '@/src/lib/tenantCache';
import {
  getMemoryLeaderboard,
  setMemoryLeaderboard,
  getConsolidatedLeaderboardSnapshot,
  saveLeaderboardDivisionSnapshot
} from '@/src/lib/dataSnapshot';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const { searchParams } = new URL(req.url);
    const tournamentIdParam = searchParams.get('tournamentId');

    const cached = await getCachedTenantFull(subdomain);
    if (!cached) {
      return NextResponse.json({ error: '해당 대회를 찾을 수 없습니다.' }, { status: 404 });
    }

    let tournament: any = null;
    if (tournamentIdParam) {
      tournament = cached.tournaments.find((t: any) => t.id === tournamentIdParam);
      if (!tournament) {
        const tourDoc = await getDoc(doc(firestore, 'tournaments', tournamentIdParam));
        if (tourDoc.exists()) {
          tournament = { id: tourDoc.id, ...tourDoc.data() };
        }
      }
    } else {
      tournament = cached.tournaments.find((t: any) => t.status === 'ONGOING') || cached.tournaments[0] || null;
    }

    if (!tournament) {
      return NextResponse.json({ leaderboard: [] });
    }

    const divisionParam = searchParams.get('division');
    const isAll = searchParams.get('all') === 'true' || !divisionParam;

    // 1. [최적화] 전체 종목 리더보드 일괄 조회 (all=true: 8번 분할 호출 -> 1번 단일 호출 & 0~1 Read)
    if (isAll) {
      const memAll = getMemoryLeaderboard(tournament.id, 'ALL');
      if (memAll) {
        return NextResponse.json({
          tournamentTitle: tournament.title,
          leaderboards: memAll.divisions || {},
          isCustom: true
        }, {
          headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=29' }
        });
      }

      const consolidated = await getConsolidatedLeaderboardSnapshot(tournament.id);
      if (consolidated && consolidated.divisions) {
        return NextResponse.json({
          tournamentTitle: tournament.title,
          leaderboards: consolidated.divisions,
          isCustom: true
        }, {
          headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=29' }
        });
      }
    }

    // 2. 특정 종목 조회 (메모리 -> 스냅샷 -> 개별 문서 순서)
    if (divisionParam) {
      const memDiv = getMemoryLeaderboard(tournament.id, divisionParam);
      if (memDiv) {
        return NextResponse.json({
          tournamentTitle: tournament.title,
          leaderboard: memDiv.list || [],
          rounds: memDiv.rounds || null,
          dnsDnfRule: memDiv.dnsDnfRule || null,
          updatedAt: memDiv.updatedAt || null,
          isConfirmed: memDiv.isConfirmed !== false,
          isCustom: true
        }, {
          headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=29' }
        });
      }

      const consolidated = await getConsolidatedLeaderboardSnapshot(tournament.id);
      let divData = consolidated?.divisions?.[divisionParam];
      if (!divData && consolidated?.divisions && divisionParam.includes('펀')) {
        const altKey = divisionParam.includes('&')
          ? divisionParam.replace(/펀&포뮬러/g, '펀엔포뮬러')
          : divisionParam.replace(/펀엔포뮬러/g, '펀&포뮬러');
        divData = consolidated.divisions[altKey];
      }

      if (divData) {
        setMemoryLeaderboard(tournament.id, divisionParam, divData);
        return NextResponse.json({
          tournamentTitle: tournament.title,
          leaderboard: divData.list || [],
          rounds: divData.rounds || null,
          dnsDnfRule: divData.dnsDnfRule || null,
          updatedAt: divData.updatedAt || null,
          isConfirmed: divData.isConfirmed !== false,
          isCustom: true
        }, {
          headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=29' }
        });
      }

      let savedLeaderboardDoc = await getDoc(
        doc(firestore, `tournaments/${tournament.id}/leaderboards`, divisionParam)
      );
      if (!savedLeaderboardDoc.exists() && divisionParam.includes('펀')) {
        const altKey = divisionParam.includes('&')
          ? divisionParam.replace(/펀&포뮬러/g, '펀엔포뮬러')
          : divisionParam.replace(/펀엔포뮬러/g, '펀&포뮬러');
        savedLeaderboardDoc = await getDoc(
          doc(firestore, `tournaments/${tournament.id}/leaderboards`, altKey)
        );
      }

      if (savedLeaderboardDoc.exists()) {
        const savedData = savedLeaderboardDoc.data();
        setMemoryLeaderboard(tournament.id, divisionParam, savedData);
        return NextResponse.json({
          tournamentTitle: tournament.title,
          leaderboard: savedData.list || [],
          rounds: savedData.rounds || null,
          dnsDnfRule: savedData.dnsDnfRule || null,
          updatedAt: savedData.updatedAt || null,
          isConfirmed: savedData.isConfirmed !== false,
          isCustom: true
        }, {
          headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=29' }
        });
      }
    }

    // 3. 동점자 룰 가져오기
    const rulesQuery = query(
      collection(firestore, `tournaments/${tournament.id}/tieBreakerRules`)
    );
    const rulesSnap = await getDocs(rulesQuery);
    const rules = rulesSnap.docs.map(docSnap => docSnap.data()).sort((a: any, b: any) => a.priority - b.priority);

    // 4. 승인된 참가 선수들 조회
    const regsQuery = query(
      collection(firestore, 'registrations'),
      where('tournamentId', '==', tournament.id),
      where('status', '==', 'APPROVED')
    );
    const regsSnap = await getDocs(regsQuery);
    let registrations: any[] = regsSnap.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: new Date(data.createdAt),
      };
    });

    if (divisionParam) {
      registrations = registrations.filter((r) => {
        try {
          if (r.formResponses) {
            const extra = JSON.parse(r.formResponses);
            return extra.division === divisionParam;
          }
        } catch (e) {}
        return false;
      });
    }

    const players = registrations.map((r: any) => r.player);

    // 5. 완료된 경기 목록 가져오기
    const matchesQuery = query(
      collection(firestore, 'matches'),
      where('tournamentId', '==', tournament.id),
      where('status', '==', 'COMPLETED')
    );
    const matchesSnap = await getDocs(matchesQuery);
    const matches = matchesSnap.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: new Date(data.createdAt),
      };
    });

    // 6. 각 선수별 스탯 실시간 계산 (대회 단위 스탯)
    const playerRankInputs: PlayerRankInput[] = players.map((player: any) => {
      let points = 0;
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let scoreDiff = 0;
      let totalScores = 0;

      const playerMatches = matches.filter((m: any) =>
        (m.participants || []).some((p: any) => p.playerId === player.id)
      );

      playerMatches.forEach((m: any) => {
        const myPart = m.participants.find((p: any) => p.playerId === player.id)!;
        const oppPart = m.participants.find((p: any) => p.playerId !== player.id)!;

        let myPointsWon = 0;
        let myPointsLost = 0;
        try {
          if (myPart.details) {
            const details = typeof myPart.details === 'string' ? JSON.parse(myPart.details) : myPart.details;
            myPointsWon = details.pointsWon || 0;
            myPointsLost = details.pointsLost || 0;
          }
        } catch (e) {
          myPointsWon = myPart.score;
          myPointsLost = oppPart.score;
        }

        totalScores += myPointsWon;
        scoreDiff += (myPointsWon - myPointsLost);

        if (myPart.isWinner) {
          wins++;
          points += 3;
        } else if (myPart.score === oppPart.score) {
          draws++;
          points += 1;
        } else {
          losses++;
        }
      });

      const playerReg: any = registrations.find(r => r.playerId === player.id);
      let birthDateStr = new Date().toISOString().split('T')[0];
      if (playerReg && playerReg.formResponses) {
        try {
          const extra = JSON.parse(playerReg.formResponses);
          if (extra.birthDate) {
            birthDateStr = extra.birthDate;
          }
        } catch (e) {}
      }

      return {
        playerId: player.id,
        name: player.name,
        birthDate: birthDateStr,
        points,
        wins,
        losses,
        draws,
        scoreDiff,
        totalScores,
      };
    });

    // 7. 맞대결 전적 리스트 구축
    const matchResults: MatchResult[] = matches.map((m: any) => {
      const home = m.participants[0];
      const away = m.participants[1];
      const winner = m.participants.find((p: any) => p.isWinner);

      return {
        homePlayerId: home.playerId,
        awayPlayerId: away.playerId,
        homeScore: home.score,
        awayScore: away.score,
        winnerId: winner ? winner.playerId : null,
      };
    });

    const tieBreakers = rules.map((r: any) => ({
      priority: r.priority,
      ruleType: r.ruleType as any,
    }));

    const sortedPlayers = sortPlayersByRules(playerRankInputs, tieBreakers, matchResults);
    const rankedPlayers = assignRanks(sortedPlayers, tieBreakers, matchResults, true, false);

    return NextResponse.json({
      tournamentTitle: tournament.title,
      leaderboard: rankedPlayers,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=29',
      }
    });
  } catch (error: any) {
    console.error('리더보드 집계 오류:', error);
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
    const { tournamentId, division, list, rounds, dnsDnfRule, isReset, togglePublish, isPublished } = body;

    // 1. 홈페이지 공개/비공개 토글 전용 요청 처리
    if (togglePublish) {
      const publishVal = Boolean(isPublished);
      const tenantRef = doc(firestore, 'tenants', subdomain);
      const tenantSnap = await getDoc(tenantRef);
      if (tenantSnap.exists()) {
        const existingData = tenantSnap.data();
        const existingConfig = existingData.overviewConfig || {};
        const nowIso = new Date().toISOString();
        const updatedOverview = {
          ...existingConfig,
          bracketsPublished: publishVal,
          leaderboardPublished: publishVal,
          bracketsPublishedAt: publishVal ? (existingConfig.bracketsPublishedAt || nowIso) : null,
          leaderboardPublishedAt: publishVal ? nowIso : null,
        };
        await setDoc(tenantRef, {
          overviewConfig: updatedOverview,
          updatedAt: nowIso
        }, { merge: true });
        invalidateTenantCache(subdomain);
      }
      return NextResponse.json({ success: true, isPublished: publishVal });
    }

    if (!tournamentId || !division) {
      return NextResponse.json({ error: '대회 ID와 종목은 필수입니다.' }, { status: 400 });
    }

    const leaderboardRef = doc(firestore, `tournaments/${tournamentId}/leaderboards`, division);
    
    // 기존 문서가 있으면 데이터 유지하면서 병합
    const existingSnap = await getDoc(leaderboardRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};

    const updatePayload: any = {
      ...existingData,
      division,
      updatedAt: new Date().toISOString(),
      isConfirmed: isReset ? false : true
    };
    if (list !== undefined) {
      updatePayload.list = list;
    }
    if (rounds !== undefined) {
      updatePayload.rounds = rounds;
    }
    if (dnsDnfRule !== undefined) {
      updatePayload.dnsDnfRule = dnsDnfRule;
    }

    await setDoc(leaderboardRef, updatePayload);

    // 펀 종목일 경우 '펀&포뮬러'와 '펀엔포뮬러' 문서 둘 다 동일하게 업데이트하여 불일치 방지
    if (division.includes('펀')) {
      const altDivision = division.includes('&')
        ? division.replace(/펀&포뮬러/g, '펀엔포뮬러')
        : division.replace(/펀엔포뮬러/g, '펀&포뮬러');
      const altRef = doc(firestore, `tournaments/${tournamentId}/leaderboards`, altDivision);
      await setDoc(altRef, { ...updatePayload, division: altDivision });
    }

    // 통합 스냅샷 문서 및 인메모리 캐시 동시 저장 (방문자 Read 1회로 전체 종목 제공)
    await saveLeaderboardDivisionSnapshot(tournamentId, division, updatePayload);

    // 만약 isPublished가 함께 전달된 경우 overviewConfig도 함께 갱신
    if (isPublished !== undefined) {
      const publishVal = Boolean(isPublished);
      const tenantRef = doc(firestore, 'tenants', subdomain);
      const tenantSnap = await getDoc(tenantRef);
      if (tenantSnap.exists()) {
        const existingData = tenantSnap.data();
        const existingConfig = existingData.overviewConfig || {};
        const nowIso = new Date().toISOString();
        const updatedOverview = {
          ...existingConfig,
          bracketsPublished: publishVal,
          leaderboardPublished: publishVal,
          bracketsPublishedAt: publishVal ? (existingConfig.bracketsPublishedAt || nowIso) : null,
          leaderboardPublishedAt: publishVal ? nowIso : null,
        };
        await setDoc(tenantRef, {
          overviewConfig: updatedOverview,
          updatedAt: nowIso
        }, { merge: true });
        invalidateTenantCache(subdomain);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('리더보드 저장 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
