import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
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

    // Firestore 테넌트 문서의 overviewConfig 필드를 부분 업데이트 또는 병합하여 저장
    await updateDoc(tenantRef, {
      overviewConfig: overviewConfig,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true, message: '대회 요강이 성공적으로 저장되었습니다!' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
