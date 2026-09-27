import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 공식 불변 대회 일정 및 정보
const OFFICIAL_DURATION = '2026. 10. 31(토) ~ 11. 01(일) (1박 2일)';
const OFFICIAL_DEADLINE = '2026년 10월 18일(일) 18:00 (130명 한도 조기마감)';
const OFFICIAL_REG_START = '2026-09-28T09:00';
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

    const tenantRef = doc(firestore, 'tenants', subdomain);
    const tenantDoc = await getDoc(tenantRef);
    if (!tenantDoc.exists()) {
      return NextResponse.json({ error: '대회 채널을 찾을 수 없습니다.' }, { status: 404 });
    }

    const tenantData = tenantDoc.data();

    // 대회 일정 및 정보 정규화 (대회 기간 10/31~11/01, 접수 기간 9/28~10/18 130명 한도 조기마감 고정)
    const sanitizedOverviewConfig = {
      ...(tenantData.overviewConfig || {}),
      duration: OFFICIAL_DURATION,
      deadlineDate: OFFICIAL_DEADLINE,
      registrationStartDate: OFFICIAL_REG_START,
      registrationEndDate: OFFICIAL_REG_END,
      scale: OFFICIAL_SCALE,
      location: OFFICIAL_LOCATION,
    };

    // 만약 DB에 기존 레거시 날짜/정보가 남아있다면 Firestore에 즉시 영구 정제 업데이트
    if (
      !tenantData.overviewConfig ||
      tenantData.overviewConfig.duration !== OFFICIAL_DURATION ||
      tenantData.overviewConfig.registrationStartDate !== OFFICIAL_REG_START ||
      tenantData.overviewConfig.registrationEndDate !== OFFICIAL_REG_END ||
      tenantData.overviewConfig.deadlineDate !== OFFICIAL_DEADLINE ||
      tenantData.overviewConfig.scale !== OFFICIAL_SCALE ||
      tenantData.overviewConfig.location !== OFFICIAL_LOCATION
    ) {
      setDoc(tenantRef, { overviewConfig: sanitizedOverviewConfig }, { merge: true }).catch(() => {});
    }

    const tournamentsQuery = query(
      collection(firestore, 'tournaments'),
      where('tenantId', '==', tenantData.id)
    );
    const tournamentsSnap = await getDocs(tournamentsQuery);
    const tournaments = tournamentsSnap.docs.map(docSnap => {
      const data = docSnap.data();
      const isOngoing = data.status === 'ONGOING';
      return {
        ...data,
        startDate: isOngoing ? new Date(OFFICIAL_START_DATE) : new Date(data.startDate),
        endDate: isOngoing ? new Date(OFFICIAL_END_DATE) : new Date(data.endDate),
        createdAt: new Date(data.createdAt),
      };
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const tenant = {
      ...tenantData,
      createdAt: new Date(tenantData.createdAt),
      overviewConfig: sanitizedOverviewConfig,
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
