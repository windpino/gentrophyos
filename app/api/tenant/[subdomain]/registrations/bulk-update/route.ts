import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { writeBatch, doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const body = await req.json();
    const { tournamentId, updatedList, insertedList, deletedIds } = body;

    if (!tournamentId) {
      return NextResponse.json({ error: '대회 고유 정보(Tournament ID)가 누락되었습니다.' }, { status: 400 });
    }

    const tenantDoc = await getDoc(doc(firestore, 'tenants', subdomain));
    if (!tenantDoc.exists()) {
      return NextResponse.json({ error: '해당 채널을 찾을 수 없습니다.' }, { status: 404 });
    }
    const tenant = tenantDoc.data();

    const batch = writeBatch(firestore);

    // 1. 기존 데이터 수정 반영 (updatedList)
    if (updatedList && Array.isArray(updatedList)) {
      for (const row of updatedList) {
        if (!row.id || row.id.startsWith('temp-')) continue;

        const playerRef = doc(firestore, 'players', row.playerId);
        batch.update(playerRef, {
          name: row.name,
          phone: row.phone || null,
        });

        const formResponses = {
          birth: row.birth || '',
          gender: row.gender,
          club: row.club,
          division: row.division,
          tshirtSize: row.tshirtSize,
          vestAgreement: '네. 확인했습니다.',
          paymentNoticeAgreement: '네. 확인했습니다.',
          liabilityWaiver: '네. 동의합니다.',
          privacyConsent: '네. 동의합니다.',
          mediaConsent: '네. 동의합니다.',
        };

        const regRef = doc(firestore, 'registrations', row.id);
        batch.update(regRef, {
          paymentStatus: row.paymentStatus,
          status: row.status,
          formResponses: JSON.stringify(formResponses),
          player: {
            id: row.playerId,
            name: row.name,
            phone: row.phone || null,
          }
        });
      }
    }

    // 2. 신규 빈 행에 입력된 데이터 삽입 처리 (insertedList)
    if (insertedList && Array.isArray(insertedList)) {
      const allPlayersQuery = query(
        collection(firestore, 'players'),
        where('tenantId', '==', tenant.id)
      );
      const allPlayersSnap = await getDocs(allPlayersQuery);
      let count = allPlayersSnap.size;

      for (const row of insertedList) {
        if (!row.name) continue;

        const playerQuery = query(
          collection(firestore, 'players'),
          where('tenantId', '==', tenant.id),
          where('name', '==', row.name),
          where('phone', '==', row.phone || null),
          limit(1)
        );
        const playerSnap = await getDocs(playerQuery);
        let playerId = '';

        if (playerSnap.empty) {
          count++;
          const uniqueCode = `PL-${row.name.toUpperCase()}-${String(count).padStart(3, '0')}`;
          
          const newPlayerRef = doc(collection(firestore, 'players'));
          batch.set(newPlayerRef, {
            tenantId: tenant.id,
            name: row.name,
            phone: row.phone || null,
            uniqueCode,
            createdAt: new Date().toISOString(),
          });
          playerId = newPlayerRef.id;

          const statsRef = doc(collection(firestore, 'playerStats'));
          batch.set(statsRef, {
            playerId: newPlayerRef.id,
            totalMatches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
          });
        } else {
          playerId = playerSnap.docs[0].id;
        }

        const formResponses = {
          birth: row.birth || '',
          gender: row.gender || '남자',
          club: row.club || '미소속',
          division: row.division || '윈드포일',
          tshirtSize: row.tshirtSize || 'L (105)',
          vestAgreement: '네. 확인했습니다.',
          paymentNoticeAgreement: '네. 확인했습니다.',
          liabilityWaiver: '네. 동의합니다.',
          privacyConsent: '네. 동의합니다.',
          mediaConsent: '네. 동의합니다.',
        };

        const newRegRef = doc(collection(firestore, 'registrations'));
        batch.set(newRegRef, {
          tournamentId,
          playerId,
          formResponses: JSON.stringify(formResponses),
          paymentStatus: row.paymentStatus || 'APPROVED',
          status: row.status || 'APPROVED',
          createdAt: new Date().toISOString(),
          player: {
            id: playerId,
            name: row.name,
            phone: row.phone || null,
          }
        });
      }
    }

    // 3. 삭제 처리 (deletedIds)
    if (deletedIds && Array.isArray(deletedIds)) {
      for (const id of deletedIds) {
        if (id.startsWith('temp-')) continue;
        const regRef = doc(firestore, 'registrations', id);
        batch.delete(regRef);
      }
    }

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('벌크 저장 API 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
