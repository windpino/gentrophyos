import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;

    const tenantDoc = await getDoc(doc(firestore, 'tenants', subdomain));
    if (!tenantDoc.exists()) {
      return NextResponse.json({ error: '대회 채널을 찾을 수 없습니다.' }, { status: 404 });
    }

    const tenantData = tenantDoc.data();

    const tournamentsQuery = query(
      collection(firestore, 'tournaments'),
      where('tenantId', '==', tenantData.id)
    );
    const tournamentsSnap = await getDocs(tournamentsQuery);
    const tournaments = tournamentsSnap.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        createdAt: new Date(data.createdAt),
      };
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const tenant = {
      ...tenantData,
      createdAt: new Date(tenantData.createdAt),
      overviewConfig: tenantData.overviewConfig || null,
      tournaments,
    };

    return NextResponse.json({ tenant }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
