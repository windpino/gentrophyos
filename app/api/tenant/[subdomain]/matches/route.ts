import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');

    const tenantDoc = await getDoc(doc(firestore, 'tenants', subdomain));
    if (!tenantDoc.exists()) {
      return NextResponse.json({ error: '채널을 찾을 수 없습니다.' }, { status: 404 });
    }
    const tenant = tenantDoc.data();

    let queryTournamentId = tournamentId;
    if (!queryTournamentId) {
      const activeTournamentQuery = query(
        collection(firestore, 'tournaments'),
        where('tenantId', '==', tenant.id),
        where('status', '==', 'ONGOING')
      );
      const activeTournamentSnap = await getDocs(activeTournamentQuery);
      if (!activeTournamentSnap.empty) {
        const activeTours = activeTournamentSnap.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            createdAt: new Date(data.createdAt),
          };
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (activeTours.length > 0) {
          queryTournamentId = activeTours[0].id;
        }
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

    return NextResponse.json({ matches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
