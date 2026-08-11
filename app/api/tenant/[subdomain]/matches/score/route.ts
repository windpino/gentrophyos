import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { eventEmitter, EVENTS } from '@/src/lib/events';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const body = await req.json();
    const { matchId, p1Id, p2Id, p1Score, p2Score, isCompleted } = body;

    if (!matchId || p1Id === undefined || p2Id === undefined) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    const matchStatus = isCompleted ? 'COMPLETED' : 'ONGOING';
    
    const matchRef = doc(firestore, 'matches', matchId);
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) {
      return NextResponse.json({ error: '경기를 찾을 수 없습니다.' }, { status: 404 });
    }
    const matchData = matchSnap.data();

    const updatedParticipants = (matchData.participants || []).map((p: any) => {
      if (p.playerId === p1Id) {
        return {
          ...p,
          score: p1Score,
          isWinner: isCompleted ? p1Score > p2Score : false,
        };
      } else if (p.playerId === p2Id) {
        return {
          ...p,
          score: p2Score,
          isWinner: isCompleted ? p2Score > p1Score : false,
        };
      }
      return p;
    });

    await updateDoc(matchRef, {
      status: matchStatus,
      participants: updatedParticipants,
      updatedAt: new Date().toISOString(),
    });

    if (isCompleted) {
      const recalculateStats = async (playerId: string) => {
        const completedMatchesQuery = query(
          collection(firestore, 'matches'),
          where('status', '==', 'COMPLETED')
        );
        const completedMatchesSnap = await getDocs(completedMatchesQuery);
        
        let totalMatches = 0;
        let wins = 0;
        let losses = 0;
        let draws = 0;

        completedMatchesSnap.docs.forEach(docSnap => {
          const m = docSnap.data();
          const p = (m.participants || []).find((part: any) => part.playerId === playerId);
          if (p) {
            totalMatches++;
            if (p.isWinner) wins++;
            else losses++;
          }
        });

        const statsRef = doc(firestore, 'playerStats', playerId);
        await setDoc(statsRef, {
          playerId,
          totalMatches,
          wins,
          losses,
          draws,
        });
      };

      await recalculateStats(p1Id);
      await recalculateStats(p2Id);
    }

    eventEmitter.emit(EVENTS.SCORE_UPDATED, {
      subdomain,
      matchId,
      p1Score,
      p2Score,
      isCompleted,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('점수 입력 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
