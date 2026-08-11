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
      return new Response('채널을 찾을 수 없습니다.', { status: 404 });
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
      return new Response('활성화된 대회가 없습니다.', { status: 400 });
    }

    const registrations = await db.registration.findMany({
      where: {
        tournamentId: queryTournamentId,
      },
      include: {
        player: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // CSV 파일 헤더 구성
    let csvContent = '선수 고유코드,이름,이메일,연락처,결제 상태,승인 상태,신청일\n';

    registrations.forEach((r) => {
      const p = r.player;
      const row = [
        p.uniqueCode,
        p.name,
        p.email || '',
        p.phone || '',
        r.paymentStatus,
        r.status,
        r.createdAt.toISOString().split('T')[0],
      ].join(',');
      csvContent += row + '\n';
    });

    // 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 적용
    const BOM = '\uFEFF';
    const csvBuffer = Buffer.from(BOM + csvContent, 'utf-8');

    return new Response(csvBuffer, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=participants_${subdomain}.csv`,
      },
    });
  } catch (error: any) {
    return new Response(error.message, { status: 500 });
  }
}
