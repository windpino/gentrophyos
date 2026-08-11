import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const body = await req.json();
    const { tournamentId, playersList } = body; // playersList: Array<{ name, email, phone }>

    if (!tournamentId || !playersList || !Array.isArray(playersList)) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const tenant = await db.tenant.findUnique({
      where: { subdomain },
    });

    if (!tenant) {
      return NextResponse.json({ error: '채널을 찾을 수 없습니다.' }, { status: 404 });
    }

    const createdRegistrations = [];

    // 트랜잭션으로 일괄 처리
    await db.$transaction(async (tx) => {
      let idx = await tx.player.count({ where: { tenantId: tenant.id } });

      for (const row of playersList) {
        if (!row.name) continue;

        // 1. 기존 선수 조회
        let player = await tx.player.findFirst({
          where: {
            tenantId: tenant.id,
            name: row.name,
            phone: row.phone || null,
          },
        });

        if (!player) {
          idx++;
          const uniqueCode = `PL-${row.name.toUpperCase()}-${String(idx).padStart(3, '0')}`;
          player = await tx.player.create({
            data: {
              tenantId: tenant.id,
              name: row.name,
              email: row.email || null,
              phone: row.phone || null,
              uniqueCode,
            },
          });

          await tx.playerStats.create({
            data: {
              playerId: player.id,
              totalMatches: 0,
              wins: 0,
              losses: 0,
              draws: 0,
            },
          });
        }

        // 2. 이미 신청되었는지 확인
        const existingReg = await tx.registration.findFirst({
          where: {
            tournamentId,
            playerId: player.id,
          },
        });

        if (!existingReg) {
          // 일괄 업로드는 수기/기존 접수자이므로 즉시 결제 및 등록 'APPROVED' 상태로 저장
          const reg = await tx.registration.create({
            data: {
              tournamentId,
              playerId: player.id,
              formResponses: JSON.stringify({ note: 'CSV 대량 업로드 등록' }),
              paymentStatus: 'APPROVED',
              status: 'APPROVED',
            },
          });
          createdRegistrations.push(reg);
        }
      }
    });

    return NextResponse.json({ success: true, count: createdRegistrations.length });
  } catch (error: any) {
    console.error('CSV 업로드 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
