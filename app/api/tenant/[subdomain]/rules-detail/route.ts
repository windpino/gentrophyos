import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');

    const tenant = await db.tenant.findUnique({
      where: { subdomain },
    });

    if (!tenant) {
      return NextResponse.json({ error: '채널을 찾을 수 없습니다.' }, { status: 404 });
    }

    let queryTournamentId = tournamentId;
    if (!queryTournamentId) {
      const activeTournament = await db.tournament.findFirst({
        where: { tenantId: tenant.id, status: 'ONGOING' },
        orderBy: { createdAt: 'desc' },
      });
      queryTournamentId = activeTournament?.id || null;
    }

    if (!queryTournamentId) {
      return NextResponse.json({ rules: [], formId: null });
    }

    const rules = await db.tieBreakerRule.findMany({
      where: { tournamentId: queryTournamentId },
      orderBy: { priority: 'asc' },
    });

    const form = await db.registrationForm.findUnique({
      where: { tournamentId: queryTournamentId },
    });

    return NextResponse.json({ rules, formId: form?.id || null });
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
    const { tournamentId, rulesList } = body; // rulesList: Array<{ id, priority, ruleType }>

    if (!tournamentId || !rulesList || !Array.isArray(rulesList)) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    // 트랜잭션을 통한 일괄 업데이트
    await db.$transaction(async (tx) => {
      // 기존 규칙 전체 삭제
      await tx.tieBreakerRule.deleteMany({
        where: { tournamentId },
      });

      // 새로운 순서대로 재생성
      for (const r of rulesList) {
        await tx.tieBreakerRule.create({
          data: {
            tournamentId,
            priority: r.priority,
            ruleType: r.ruleType,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('룰 업데이트 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
