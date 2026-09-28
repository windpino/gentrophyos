import { NextRequest, NextResponse } from 'next/server';
import { getCachedTenantFull } from '@/src/lib/tenantCache';

export const dynamic = 'force-dynamic';

// 공식 불변 대회 일정 및 정보
const OFFICIAL_DURATION = '2026. 10. 31(토) ~ 11. 01(일) (1박 2일)';
const OFFICIAL_DEADLINE = '2026년 10월 18일(일) 18:00 (130명 한도 선착순 조기마감)';
const OFFICIAL_REG_START = '2026-09-29T09:00';
const OFFICIAL_REG_END = '2026-10-18T18:00';
const OFFICIAL_SCALE = '130명 한도 (선착순 조기마감)';
const OFFICIAL_LOCATION = '경상남도 통영시 도남동 수륙해수욕장 일원';
const OFFICIAL_START_DATE = '2026-10-31';
const OFFICIAL_END_DATE = '2026-11-01';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;

    // 인메모리 캐시를 통해 Firestore getDoc 및 getDocs 최소화 (Read 95% 이상 절감)
    const cachedResult = await getCachedTenantFull(subdomain);
    if (!cachedResult) {
      return NextResponse.json({ error: '대회 채널을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { tenantData, tournaments: rawTournaments, fromCache } = cachedResult;

    // 대회 일정 및 정보 정규화
    const sanitizedOverviewConfig = {
      ...(tenantData.overviewConfig || {}),
      duration: OFFICIAL_DURATION,
      deadlineDate: OFFICIAL_DEADLINE,
      registrationStartDate: OFFICIAL_REG_START,
      registrationEndDate: OFFICIAL_REG_END,
      scale: OFFICIAL_SCALE,
      location: OFFICIAL_LOCATION,
      registrationMode: 'FORCE_ENABLED',
      registrationEnabled: true,
    };



    const tournaments = rawTournaments.map((data: any) => {
      const isOngoing = data.status === 'ONGOING';
      return {
        ...data,
        startDate: isOngoing ? new Date(OFFICIAL_START_DATE) : new Date(data.startDate),
        endDate: isOngoing ? new Date(OFFICIAL_END_DATE) : new Date(data.endDate),
        createdAt: new Date(data.createdAt),
      };
    }).sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

    const tenant = {
      ...tenantData,
      createdAt: new Date(tenantData.createdAt),
      overviewConfig: sanitizedOverviewConfig,
      tournaments,
    };

    return NextResponse.json({ tenant }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
