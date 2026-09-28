import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getCachedTenantFull } from '@/src/lib/tenantCache';

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

    const matchesQuery = query(
      collection(firestore, 'matches'),
      where('tournamentId', '==', queryTournamentId)
    );
    const matchesSnap = await getDocs(matchesQuery);
    const matches = matchesSnap.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: new Date(data.createdAt),
      };
    }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return NextResponse.json({ matches }, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=29',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
