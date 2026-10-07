import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { authenticateApiRequest } from '@/src/lib/auth';
import { DEFAULT_SAILING_TIE_BREAKER_RULES, TieBreakerRuleInput } from '@/src/lib/tieBreaker';
import { invalidateTenantCache } from '@/src/lib/tenantCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SAILING_RULE_TYPES = new Set([
  'HEAD_TO_HEAD',
  'MOST_BETTER_FINISHES',
  'MOST_RECENT_RACE',
  'DISCARD_DROP',
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId') || 'tour-active';

    const tenantRef = doc(firestore, 'tenants', subdomain);
    const tenantSnap = await getDoc(tenantRef);
    const tenantData = tenantSnap.exists() ? tenantSnap.data() : null;

    // 1. overviewConfig.tieBreakerRules 확인
    const configRules: TieBreakerRuleInput[] | undefined = tenantData?.overviewConfig?.tieBreakerRules;
    if (
      Array.isArray(configRules) &&
      configRules.length === 4 &&
      configRules.every((r: any) => SAILING_RULE_TYPES.has(r.ruleType))
    ) {
      const sorted = [...configRules].sort((a, b) => a.priority - b.priority);
      return NextResponse.json({ rules: sorted, formId: null });
    }

    // 2. tournaments/{tournamentId}/tieBreakerRules 서브컬렉션 확인
    const rulesCol = collection(firestore, `tournaments/${tournamentId}/tieBreakerRules`);
    const rulesSnap = await getDocs(rulesCol);
    const storedRules = rulesSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => a.priority - b.priority);

    const hasValidSailingRules =
      storedRules.length === 4 &&
      storedRules.every((r: any) => SAILING_RULE_TYPES.has(r.ruleType));

    const finalRules = hasValidSailingRules
      ? storedRules
      : DEFAULT_SAILING_TIE_BREAKER_RULES;

    return NextResponse.json({ rules: finalRules, formId: null });
  } catch (error: any) {
    // 오류 시에도 국제 표준 RRS 기본 규칙 반환
    return NextResponse.json({ rules: DEFAULT_SAILING_TIE_BREAKER_RULES, formId: null });
  }
}

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
    const { tournamentId = 'tour-active', rulesList } = body;

    if (!rulesList || !Array.isArray(rulesList)) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }

    const normalizedRules: TieBreakerRuleInput[] = rulesList.map((r: any, idx: number) => ({
      id: r.id || `rule-${idx + 1}`,
      priority: idx + 1,
      ruleType: r.ruleType,
    }));

    // 1. 테넌트 overviewConfig.tieBreakerRules 에 저장
    const tenantRef = doc(firestore, 'tenants', subdomain);
    const tenantSnap = await getDoc(tenantRef);
    const existingConfig = tenantSnap.exists() ? (tenantSnap.data().overviewConfig || {}) : {};
    await setDoc(
      tenantRef,
      {
        overviewConfig: {
          ...existingConfig,
          tieBreakerRules: normalizedRules,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 2. tournaments/{tournamentId}/tieBreakerRules 서브컬렉션에도 동기화
    const rulesCol = collection(firestore, `tournaments/${tournamentId}/tieBreakerRules`);
    const existingSnap = await getDocs(rulesCol);
    await Promise.all(existingSnap.docs.map((d) => deleteDoc(d.ref)));
    await Promise.all(
      normalizedRules.map((r) =>
        setDoc(doc(firestore, `tournaments/${tournamentId}/tieBreakerRules`, r.id || `rule-${r.priority}`), r)
      )
    );

    invalidateTenantCache(subdomain);

    return NextResponse.json({ success: true, rules: normalizedRules });
  } catch (error: any) {
    console.error('룰 업데이트 오류:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
