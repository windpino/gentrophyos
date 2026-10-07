import { NextRequest, NextResponse } from 'next/server';
import { getCachedTenantFull } from '@/src/lib/tenantCache';

export const dynamic = 'force-dynamic';

// 공식 불변 대회 일정 및 정보
const OFFICIAL_DURATION = '2026. 10. 31(토) ~ 11. 01(일) (1박 2일)';
const OFFICIAL_DEADLINE = '2026년 10월 18일(일) 18:00 (130명 한도 조기마감)';
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

    const defaultDivisionsList = [
      { category: '윈드포일', class: '남녀오픈', note: '-' },
      { category: '윙포일', class: '남자부 / 여자부', note: '연령제한없음' },
      { category: '혼합오픈', class: '청년부, 중년부, 장년부, 여자부', note: '참가 연령의 1/3로 균등분할하여 구성한다. (여자부: 연령제한없음)' },
      { category: '펀&포뮬러', class: '청년부, 중년부, 장년부, 여자부', note: '참가 연령의 1/3로 균등분할하여 구성한다. (여자부: 연령제한없음)' },
      { category: '단체전 (Relay)', class: '1개팀(4명)', note: '등록선수에 한해 참가 가능' },
    ];

    const rawDivisionsList = Array.isArray(tenantData.overviewConfig?.divisionsList) && tenantData.overviewConfig.divisionsList.length > 0
      ? tenantData.overviewConfig.divisionsList.map((item: any) => ({
          ...item,
          class: typeof item.class === 'string' ? item.class.replace(/1\/4/g, '1/3') : item.class,
          note: typeof item.note === 'string' ? item.note.replace(/1\/4/g, '1/3') : item.note,
        }))
      : defaultDivisionsList;

    // 대회 일정 및 정보 정규화
    const sanitizedOverviewConfig = {
      ...(tenantData.overviewConfig || {}),
      divisionsList: rawDivisionsList,
      duration: OFFICIAL_DURATION,
      deadlineDate: OFFICIAL_DEADLINE,
      registrationStartDate: OFFICIAL_REG_START,
      registrationEndDate: OFFICIAL_REG_END,
      scale: OFFICIAL_SCALE,
      location: OFFICIAL_LOCATION,
      registrationMode: 'FORCE_ENABLED',
      registrationEnabled: true,
      noticeHwpData: tenantData.overviewConfig?.noticeHwpData || '/files/2026년20회통영대회_개최공시서.hwp',
      noticeHwpName: tenantData.overviewConfig?.noticeHwpName || '2026년20회통영대회_개최공시서.hwp',
      noticePdfData: tenantData.overviewConfig?.noticePdfData || '/files/2026년20회통영대회_개최공시서.pdf',
      noticePdfName: tenantData.overviewConfig?.noticePdfName || '2026년20회통영대회_개최공시서.pdf',
      contactNote: (tenantData.overviewConfig?.contactNote === '* 대회 참가자 전원에게 기념 티셔츠 및 참가 기념품을 제공합니다.' || !tenantData.overviewConfig?.contactNote)
        ? '* 대회 참가자 전원에게 기념 티셔츠를 제공합니다.'
        : tenantData.overviewConfig.contactNote,
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
