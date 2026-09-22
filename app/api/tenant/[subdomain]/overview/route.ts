import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { authenticateApiRequest } from '@/src/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const auth = authenticateApiRequest(req, ['admin']);
    if (!auth.authorized) {
      return auth.errorResponse!;
    }

    const { subdomain } = await params;
    const body = await req.json();
    const { overviewConfig } = body;

    if (!overviewConfig) {
      return NextResponse.json({ error: '수정할 대회요강 데이터가 없습니다.' }, { status: 400 });
    }

    const tenantRef = doc(firestore, 'tenants', subdomain);
    const tenantSnap = await getDoc(tenantRef);

    if (!tenantSnap.exists()) {
      return NextResponse.json({ error: '존재하지 않는 대회 채널입니다.' }, { status: 404 });
    }

    const existingData = tenantSnap.data();
    const existingConfig = existingData.overviewConfig || {};

    // Firestore 테넌트 문서의 overviewConfig 필드를 병합하여 저장
    const sanitizedOverview = {
      ...existingConfig,
      ...overviewConfig,
      duration: '2026. 10. 31(토) ~ 11. 01(일) (1박 2일)',
      deadlineDate: overviewConfig.deadlineDate || existingConfig.deadlineDate || '2026년 10월 23일(금) 18:00',
      registrationStartDate: overviewConfig.registrationStartDate || existingConfig.registrationStartDate || '2026-08-10T09:00',
      registrationEndDate: overviewConfig.registrationEndDate || existingConfig.registrationEndDate || '2026-10-23T18:00',
      location: overviewConfig.location || existingConfig.location || '경상남도 통영시 도남항 특설경기장 및 트라이애슬론 광장 일원',
    };

    await setDoc(tenantRef, {
      overviewConfig: sanitizedOverview,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ success: true, message: '대회 요강이 성공적으로 저장되었습니다!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
