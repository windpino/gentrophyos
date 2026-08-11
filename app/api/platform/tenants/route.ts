import { NextResponse } from 'next/server';
import { db } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tenants = await db.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ tenants });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
