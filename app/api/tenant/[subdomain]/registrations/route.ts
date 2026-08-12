import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, addDoc } from 'firebase/firestore';

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
      return NextResponse.json({ registrations: [], formFields: [] });
    }

    // 1. 참가 신청 목록 조회
    const regsQuery = query(
      collection(firestore, 'registrations'),
      where('tournamentId', '==', queryTournamentId)
    );
    const regsSnap = await getDocs(regsQuery);
    const registrations = regsSnap.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: new Date(data.createdAt),
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

    return NextResponse.json({ registrations, formFields });
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

    const tenantDoc = await getDoc(doc(firestore, 'tenants', subdomain));
    if (!tenantDoc.exists()) {
      return NextResponse.json({ error: '채널을 찾을 수 없습니다.' }, { status: 404 });
    }
    const tenant = tenantDoc.data();

    // 1. 선수 조회
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
      const allPlayersQuery = query(
        collection(firestore, 'players'),
        where('tenantId', '==', tenant.id)
      );
      const allPlayersSnap = await getDocs(allPlayersQuery);
      const count = allPlayersSnap.size;
      const uniqueCode = `PL-${name.toUpperCase()}-${String(count + 1).padStart(3, '0')}`;

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

    // 2. 중복 신청 방지
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

    // 3. 신청서 접수
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
