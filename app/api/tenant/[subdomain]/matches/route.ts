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
        where('status', '==', 'ONGOING'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const activeTournamentSnap = await getDocs(activeTournamentQuery);
      if (!activeTournamentSnap.empty) {
        queryTournamentId = activeTournamentSnap.docs[0].id;
      }
    }

    if (!queryTournamentId) {
      return NextResponse.json({ matches: [] });
    }

    const matchesQuery = query(
      collection(firestore, 'matches'),
      where('tournamentId', '==', queryTournamentId),
      orderBy('createdAt', 'asc')
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

    return NextResponse.json({ matches });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
