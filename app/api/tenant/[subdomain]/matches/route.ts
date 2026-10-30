import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getCachedTenantFull } from '@/src/lib/tenantCache';
import { getOrBuildMatchesSnapshot } from '@/src/lib/dataSnapshot';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');

    const cached = await getCachedTenantFull(subdomain);
    if (!cached) {
      return NextResponse.json({ error: '채널을 찾을 수 없습니다.' }, { status: 404 });
    }

    let queryTournamentId = tournamentId;
    if (!queryTournamentId) {
      const ongoing = cached.tournaments.find((t: any) => t.status === 'ONGOING');
      if (ongoing) {
        queryTournamentId = ongoing.id;
      }
    }

    if (!queryTournamentId) {
      return NextResponse.json({ matches: [] });
    }

    // [최적화] 대진표 & 경기결과 스냅샷 및 인메모리 캐시 (0~1 Read)
    const matches = await getOrBuildMatchesSnapshot(queryTournamentId, async () => {
      const matchesQuery = query(
        collection(firestore, 'matches'),
        where('tournamentId', '==', queryTournamentId)
      );
      const matchesSnap = await getDocs(matchesQuery);
      return matchesSnap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          ...data,
          id: docSnap.id,
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date(data.createdAt || Date.now()).toISOString(),
        };
      }).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    return NextResponse.json({ matches }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
