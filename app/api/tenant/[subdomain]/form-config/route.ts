import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const body = await req.json();
    const { tournamentId, fields } = body; // fields: FormField[]

    if (!tournamentId || !fields || !Array.isArray(fields)) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    const tenant = await db.tenant.findUnique({
      where: { subdomain },
    });

    if (!tenant) {
      return NextResponse.json({ error: '채널을 찾을 수 없습니다.' }, { status: 404 });
    }

    // JSON String 형태로 데이터 갱신/생성
    const updatedForm = await db.registrationForm.upsert({
      where: { tournamentId },
      create: {
        tournamentId,
        fields: JSON.stringify(fields),
      },
      update: {
        fields: JSON.stringify(fields),
      },
    });

    return NextResponse.json({ success: true, form: updatedForm });
  } catch (error: any) {
    console.error('폼 설정 업데이트 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
