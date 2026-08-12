import { NextRequest, NextResponse } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';

// 기본 12단계 참가신청서 폼 양식 데이터
const DEFAULT_FIELDS = [
  { id: 'name', label: '1. 성명', type: 'text', required: true, placeholder: '실명을 입력해 주세요.' },
  { id: 'birth', label: '2. 생년월일 (8자리) 예) 19450815', type: 'text', required: true, placeholder: '예) 19901024' },
  { id: 'gender', label: '3. 성별', type: 'radio', required: true, options: ['남자', '여자'] },
  { id: 'phone', label: '4. 전화번호 (휴대폰번호)', type: 'text', required: true, placeholder: '예) 01012345678' },
  { id: 'club', label: '5. 소속협회 또는 클럽', type: 'text', required: true, placeholder: '소속 단체명을 입력해 주세요.' },
  { id: 'division', label: '6. 참가종목', type: 'radio', required: true, options: ['윈드포일 (남자부)', '윈드포일 (여자부)', '윙포일 (남자부)', '윙포일 (여자부)', '혼합오픈 (남자부)', '혼합오픈 (여자부)', '펀엔포뮬러 (남자부)', '펀엔포뮬러 (여자부)'] },
  { id: 'tshirtSize', label: '7. 티셔츠(기념품)사이즈', type: 'radio', required: true, options: ['S (95)', 'M (100)', 'L (105)', 'XL (110)'] },
  { id: 'vestAgreement', label: '8. 당일 대회본부에 조끼(배번티)를 반드시 수령하셔야 합니다.', type: 'checkbox', required: true, notice: '대회운영본부 수령 필수 (사용 후 반드시 반납바랍니다)', agreeLabel: '네. 확인했습니다.' },
  { id: 'paymentNoticeAgreement', label: '9. 참가비 입금 안내 확인 동의', type: 'checkbox', required: true, notice: '선착순 선수등록 처리 후 130명 마감 시 계좌는 개별 문자 통지합니다.', agreeLabel: '네. 확인했습니다.' },
  { id: 'liabilityWaiver', label: '10. 면책 동의서 서약에 동의합니다.', type: 'textarea', required: true, textareaContent: '본인은 제20회 이순신장군배 전국윈드서핑대회 참가 활동 중 본인의 부주의로 인해 발생할 수 있는 사고, 즉 개인적 부상, 재산상 피해, 의학적인 사고 등 대회기간 중 발생한 사고에 대한 책임은 본인의 자의적인 참가에 의한 본인의 책임이며, 본 대회를 주관하는 관계자 및 기관에 대한 면책은 물론 책임전가를 하지 않을 것을 서약합니다.', agreeLabel: '네. 동의합니다.' },
  { id: 'privacyConsent', label: '11. 개인정보 수집에 동의합니다.', type: 'textarea', required: true, textareaContent: '• 정보수집 및 이용기관 : 통영시요트협회\n• 수집 정보 : 성명, 생년월일, 전화번호, 이메일, 소속 단체\n• 수집 목적 : 참가자 관리 및 보험가입, 대회 공지 전송 등\n• 보존 기간 : 대회 정산 이후 즉시 폐기합니다.', agreeLabel: '네. 동의합니다.' },
  { id: 'mediaConsent', label: '12. 초상권 및 저작권 사용 동의', type: 'textarea', required: true, textareaContent: '• 정보수집 및 이용기관 : 통영시요트협회\n• 수집 목적 : 대회 홍보, 결과 보도, 미디어 자료 활용 등\n• 활용 대상 : 대회 사진, 동영상 등 촬영물\n• 보존 기간 : 통영시요트협회 아카이브 보관용으로 영구 보존 및 활용에 동의합니다.', agreeLabel: '네. 동의합니다.' }
];

async function getActiveTournamentId(subdomain: string) {
  const tenantDoc = await getDoc(doc(firestore, 'tenants', subdomain));
  if (!tenantDoc.exists()) return null;
  const tenant = tenantDoc.data();

  const activeQuery = query(
    collection(firestore, 'tournaments'),
    where('tenantId', '==', tenant.id),
    where('status', '==', 'ONGOING')
  );
  const snap = await getDocs(activeQuery);
  if (snap.empty) return null;
  
  const activeTours = snap.docs.map(docSnap => ({
    id: docSnap.id,
    createdAt: new Date(docSnap.data().createdAt)
  })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return activeTours[0].id;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const tournamentId = await getActiveTournamentId(subdomain);

    if (!tournamentId) {
      return NextResponse.json({ fields: DEFAULT_FIELDS });
    }

    const configDoc = await getDoc(doc(firestore, `tournaments/${tournamentId}/formConfigs`, 'default'));
    if (!configDoc.exists()) {
      return NextResponse.json({ fields: DEFAULT_FIELDS });
    }

    const data = configDoc.data();
    const fields = data.fields ? JSON.parse(data.fields) : DEFAULT_FIELDS;

    return NextResponse.json({ fields });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const body = await req.json();
    const { fields } = body;

    const tournamentId = await getActiveTournamentId(subdomain);
    if (!tournamentId) {
      return NextResponse.json({ error: '활성화된 대회가 없어 폼 설정을 저장할 수 없습니다.' }, { status: 400 });
    }

    await setDoc(doc(firestore, `tournaments/${tournamentId}/formConfigs`, 'default'), {
      fields: JSON.stringify(fields),
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
