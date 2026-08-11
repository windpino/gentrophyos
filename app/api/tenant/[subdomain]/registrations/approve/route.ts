import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const body = await req.json();
    const { registrationId, paymentStatus, status } = body;

    if (!registrationId) {
      return NextResponse.json({ error: '신청 번호가 없습니다.' }, { status: 400 });
    }

    const updated = await db.registration.update({
      where: { id: registrationId },
      data: {
        paymentStatus,
        status,
      },
    });

    return NextResponse.json({ success: true, registration: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
