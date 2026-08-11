import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { sortPlayersByRules, assignRanks, PlayerRankInput, MatchResult } from '@/src/lib/tieBreaker';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const { searchParams } = new URL(req.url);
    const tournamentIdParam = searchParams.get('tournamentId');

    const tenantDoc = await getDoc(doc(firestore, 'tenants', subdomain));
    if (!tenantDoc.exists()) {
      return NextResponse.json({ error: '해당 대회를 찾을 수 없습니다.' }, { status: 404 });
    }
    const tenant = tenantDoc.data();

    let tournament: any = null;
    if (tournamentIdParam) {
      const tourDoc = await getDoc(doc(firestore, 'tournaments', tournamentIdParam));
      if (tourDoc.exists()) {
        tournament = { id: tourDoc.id, ...tourDoc.data() };
      }
    } else {
      const activeTourQuery = query(
        collection(firestore, 'tournaments'),
        where('tenantId', '==', tenant.id),
        where('status', '==', 'ONGOING')
      );
      const activeTourSnap = await getDocs(activeTourQuery);
      if (!activeTourSnap.empty) {
        const activeTours = activeTourSnap.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: new Date(data.createdAt),
          };
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (activeTours.length > 0) {
          tournament = activeTours[0];
        }
      }
    }

    if (!tournament) {
      return NextResponse.json({ leaderboard: [] });
    }

    // 3. 동점자 룰 가져오기
    const rulesQuery = query(
      collection(firestore, `tournaments/${tournament.id}/tieBreakerRules`)
    );
    const rulesSnap = await getDocs(rulesQuery);
    const rules = rulesSnap.docs.map(docSnap => docSnap.data()).sort((a: any, b: any) => a.priority - b.priority);

    const divisionParam = searchParams.get('division');

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
    });
  } catch (error: any) {
    console.error('리더보드 집계 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
