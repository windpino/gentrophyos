import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 공식 불변 대회 일정 및 정보
const OFFICIAL_DURATION = '2026. 10. 31(토) ~ 11. 01(일) (1박 2일)';
const OFFICIAL_DEADLINE = '2026년 10월 23일(금) 18:00';
const OFFICIAL_REG_START = '2026-08-10T09:00';
const OFFICIAL_REG_END = '2026-10-23T18:00';
const OFFICIAL_LOCATION = '경상남도 통영시 도남항 특설경기장 및 트라이애슬론 광장 일원';
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

    // 대회 일정 및 정보 정규화 (대회 기간 10/31~11/01 유지, 그 외 ERP에서 수정한 장소/마감일/상세내용 완벽 보존)
    const sanitizedOverviewConfig = {
      ...(tenantData.overviewConfig || {}),
      duration: OFFICIAL_DURATION,
      deadlineDate: tenantData.overviewConfig?.deadlineDate || OFFICIAL_DEADLINE,
      registrationStartDate: tenantData.overviewConfig?.registrationStartDate || OFFICIAL_REG_START,
      registrationEndDate: tenantData.overviewConfig?.registrationEndDate || OFFICIAL_REG_END,
      location: tenantData.overviewConfig?.location || OFFICIAL_LOCATION,
    };

    // 만약 DB에 기존 레거시 날짜가 남아있다면 Firestore에 즉시 영구 정제 업데이트
    if (
      !tenantData.overviewConfig ||
      tenantData.overviewConfig.duration !== OFFICIAL_DURATION ||
      tenantData.overviewConfig.registrationStartDate !== OFFICIAL_REG_START ||
      tenantData.overviewConfig.registrationEndDate !== OFFICIAL_REG_END
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
