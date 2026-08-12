import { NextRequest } from 'next/server';
import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    const { searchParams } = new URL(req.url);
    const tournamentId = searchParams.get('tournamentId');

    // 1. 테넌트 조회
    const tenantDoc = await getDoc(doc(firestore, 'tenants', subdomain));
    if (!tenantDoc.exists()) {
      return new Response('채널을 찾을 수 없습니다.', { status: 404 });
    }
    const tenant = tenantDoc.data();

    // 2. 대회 ID 결정
    let queryTournamentId = tournamentId;
    if (!queryTournamentId) {
      const activeTournamentQuery = query(
        collection(firestore, 'tournaments'),
        where('tenantId', '==', tenant.id),
        where('status', '==', 'ONGOING')
      );
      const activeTournamentSnap = await getDocs(activeTournamentQuery);
      if (!activeTournamentSnap.empty) {
        const sorted = activeTournamentSnap.docs
          .map((d) => ({ id: d.id, createdAt: new Date(d.data().createdAt) }))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        queryTournamentId = sorted[0].id;
      }
    }

    if (!queryTournamentId) {
      return new Response('활성화된 대회가 없습니다.', { status: 400 });
    }

    // 3. 참가 신청 목록 조회
    const regsQuery = query(
      collection(firestore, 'registrations'),
      where('tournamentId', '==', queryTournamentId)
    );
    const regsSnap = await getDocs(regsQuery);
    const registrations = regsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // 4. CSV 헤더 구성 (참가신청서 1~12번 순서와 동일)
    const headers = [
      '순번',
      '1.성명',
      '2.생년월일',
      '3.성별',
      '4.전화번호',
      '5.소속협회/클럽',
      '6.참가종목',
      '7.티셔츠사이즈',
      '8.조끼수령동의',
      '9.입금안내확인',
      '10.면책동의',
      '11.개인정보동의',
      '12.초상권동의',
      '결제상태',
      '승인상태',
      '신청일시',
    ];

    let csvContent = headers.join(',') + '\n';

    registrations.forEach((r: any, idx: number) => {
      let birth = '';
      let gender = '';
      let club = '';
      let division = '';
      let tshirtSize = '';
      let vestAgreement = '';
      let paymentNoticeAgreement = '';
      let liabilityWaiver = '';
      let privacyConsent = '';
      let mediaConsent = '';

      try {
        if (r.formResponses) {
          const extra = JSON.parse(r.formResponses);
          birth = extra.birth || '';
          gender = extra.gender || '';
          club = extra.club || '';
          division = extra.division || '';
          tshirtSize = extra.tshirtSize || '';
          vestAgreement = extra.vestAgreement || '';
          paymentNoticeAgreement = extra.paymentNoticeAgreement || '';
          liabilityWaiver = extra.liabilityWaiver || '';
          privacyConsent = extra.privacyConsent || '';
          mediaConsent = extra.mediaConsent || '';
        }
      } catch {
        // 기본값 유지
      }

      const name = r.player?.name || '';
      const phone = r.player?.phone || '';
      const paymentStatus = r.paymentStatus === 'APPROVED' ? '결제완료' : '미결제';
      const status = r.status === 'APPROVED' ? '승인완료' : '대기';
      const createdAt = r.createdAt ? new Date(r.createdAt).toLocaleString('ko-KR') : '';

      // CSV 내 쉼표 포함 값 따옴표 처리
      const escape = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;

      const row = [
        idx + 1,
        escape(name),
        escape(birth),
        escape(gender),
        escape(phone),
        escape(club),
        escape(division),
        escape(tshirtSize),
        escape(vestAgreement),
        escape(paymentNoticeAgreement),
        escape(liabilityWaiver),
        escape(privacyConsent),
        escape(mediaConsent),
        escape(paymentStatus),
        escape(status),
        escape(createdAt),
      ].join(',');

      csvContent += row + '\n';
    });

    // 엑셀 한글 깨짐 방지 UTF-8 BOM
    const BOM = '\uFEFF';
    const csvBuffer = Buffer.from(BOM + csvContent, 'utf-8');

    const now = new Date().toISOString().split('T')[0];
    return new Response(csvBuffer, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="participants_${subdomain}_${now}.csv"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return new Response(message, { status: 500 });
  }
}
