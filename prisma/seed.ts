import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed 시작 (윈드서핑)...');

  // 1. 기존 데이터 정리
  await prisma.tieBreakerRule.deleteMany({});
  await prisma.matchParticipant.deleteMany({});
  await prisma.match.deleteMany({});
  await prisma.playerStats.deleteMany({});
  await prisma.registration.deleteMany({});
  await prisma.registrationForm.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tournament.deleteMany({});
  await prisma.tenant.deleteMany({});

  // 2. 테넌트(Tenant) 생성
  const windTenant = await prisma.tenant.create({
    data: {
      name: '제20회 이순신장군배 전국윈드서핑대회',
      subdomain: 'tongyeong-wind',
      primaryColor: '#008080', // 바다의 청록색 (Teal)
      logoUrl: 'https://images.unsplash.com/photo-1500305060284-be23c72b226e?w=80&h=80&fit=crop&q=80',
      rulesSummary: `■ 대회개요
• 주 최 : 통영시
• 주 관 : 통영시요트협회
• 후 원 : 통영시체육회, 경상남도요트협회, 한국윈드서핑협회
• 대회일정 : 2026. 9. 12(토) ~ 13(일) 1박2일
• 장 소 : 통영시 산양읍 영운리 수륙마을 내 수륙해수욕장
• 참가인원 : 130명

■ 경기종목
• 윈드포일 : 남녀오픈
• 윙포일 : 남자부/여자부
• 혼합오픈 : 남자청년부/남자중년부/남자장년부/여자부
• 펀엔포뮬러 : 남자청년부/남자중년부/남자장년부/여자부
• 단체전
  ※ 각 클래스는 생년월일기준으로 편성하며 선수 5명이상 출전 시 시상한다.
  ※ 단체전을 제외한 종목별 경기의 중복출전은 불가하다.
  ※ 단체전은 시,도 클럽별 릴레이식 참가선수 4명이 1개 팀으로 하는 경기방식 채택한다.
  ※ 모든 나이는 2026년 9월 12일을 기준으로 한다.`,
    },
  });

  console.log('윈드서핑 테넌트 생성 완료');

  // 3. 사용자(Users) 생성
  // 플랫폼 최고 어드민
  await prisma.user.create({
    data: {
      email: 'admin@gentrophy.com',
      passwordHash: 'admin123',
      name: '최고 관리자',
      role: 'PLATFORM_ADMIN',
    },
  });

  // 호스트 관리자 (Tongyeong Windsurfing Association)
  const windHost = await prisma.user.create({
    data: {
      email: 'host@tongyeong.com',
      passwordHash: 'host123',
      name: '통영 요트협회 주최자',
      role: 'HOST_ADMIN',
      tenantId: windTenant.id,
    },
  });

  // 심판 (Referee)
  const windReferee = await prisma.user.create({
    data: {
      email: 'referee@tongyeong.com',
      passwordHash: 'ref123',
      name: '윈드서핑 연맹 공인심판',
      role: 'REFEREE',
      tenantId: windTenant.id,
    },
  });

  console.log('윈드서핑 사용자 생성 완료');

  // 4. 선수(Players) 생성 및 스탯 초기화
  const playersData = [
    { name: '김철수', email: 'chul@wind.com', phone: '010-1234-5678', uniqueCode: 'PL-CHUL-001', birthDate: '19900815' },
    { name: '이영희', email: 'young@wind.com', phone: '010-8765-4321', uniqueCode: 'PL-YOUNG-002', birthDate: '19920512' },
    { name: '박민수', email: 'minsu@wind.com', phone: '010-1111-2222', uniqueCode: 'PL-MINSU-003', birthDate: '19881120' },
  ];

  const players: any[] = [];
  for (const p of playersData) {
    const player = await prisma.player.create({
      data: {
        name: p.name,
        email: p.email,
        phone: p.phone,
        uniqueCode: p.uniqueCode,
        tenantId: windTenant.id,
        createdAt: new Date(
          parseInt(p.birthDate.substring(0, 4)),
          parseInt(p.birthDate.substring(4, 6)) - 1,
          parseInt(p.birthDate.substring(6, 8))
        ) // PlayerStats 비교 시 createdAt을 활용할 수 있도록 생년월일 날짜 지정
      },
    });

    await prisma.playerStats.create({
      data: {
        playerId: player.id,
        totalMatches: 3,
        wins: 1,
        losses: 1,
        draws: 0,
      },
    });
    players.push(player);
  }

  console.log('선수 및 스탯 생성 완료');

  // 5. 대회(Tournaments) 생성
  // 제20회 현재 진행 중인 대회
  const activeTournament = await prisma.tournament.create({
    data: {
      tenantId: windTenant.id,
      title: '제20회 이순신장군배 전국윈드서핑대회 (2026)',
      status: 'ONGOING',
      startDate: new Date('2026-09-12'),
      endDate: new Date('2026-09-13'),
    },
  });

  // 제19회 완료되어 보관된 과거 대회
  const archivedTournament = await prisma.tournament.create({
    data: {
      tenantId: windTenant.id,
      title: '제19회 이순신장군배 전국윈드서핑대회 (2025)',
      status: 'ARCHIVED',
      startDate: new Date('2025-09-10'),
      endDate: new Date('2025-09-11'),
    },
  });

  console.log('윈드서핑 대회 생성 완료');

  // 6. 참가 신청 동적 폼 빌더 (네이버 폼 12단계 재현)
  // 시스템 고정 기본 필드 외에 추가 수집할 9개 문항 정의
  const formFields = [
    { name: 'gender', label: '성별', type: 'select', options: ['남자', '여자'], required: true },
    { name: 'club', label: '소속협회 또는 클럽', type: 'text', required: true },
    {
      name: 'division',
      label: '참가종목',
      type: 'select',
      options: ['윈드포일', '윙포일', '혼합오픈', '펀엔포뮬러'],
      required: true,
    },
    {
      name: 'tshirtSize',
      label: '티셔츠(기념품)사이즈',
      type: 'select',
      options: ['S (95)', 'M (100)', 'L (105)', 'XL (110)'],
      required: true,
    },
    {
      name: 'vestAgreement',
      label: '당일 대회본부에 조끼(배번티)를 반드시 수령하셔야 합니다.',
      type: 'select',
      options: ['네. 확인했습니다.'],
      required: true,
    },
    {
      name: 'paymentNoticeAgreement',
      label: '참가신청서 제출후 선착순 선수등록 및 입금계좌 개별통지 내용을 확인했습니다.',
      type: 'select',
      options: ['네. 확인했습니다.'],
      required: true,
    },
    {
      name: 'liabilityWaiver',
      label: '본인은 참가 활동 중 사고에 대한 모든 책임은 본인에게 있으며 면책 서약에 동의합니다.',
      type: 'select',
      options: ['네. 동의합니다.'],
      required: true,
    },
    {
      name: 'privacyConsent',
      label: '개인정보 수집 및 대회 안내 문자 발송 등에 동의합니다.',
      type: 'select',
      options: ['네. 동의합니다.'],
      required: true,
    },
    {
      name: 'mediaConsent',
      label: '대회 기간 중 촬영된 사진 및 영상 사용(초상권 및 저작권)에 동의합니다.',
      type: 'select',
      options: ['네. 동의합니다.'],
      required: true,
    },
  ];

  await prisma.registrationForm.create({
    data: {
      tournamentId: activeTournament.id,
      fields: JSON.stringify(formFields),
    },
  });

  console.log('참가 신청 12단계 폼 필드 양식 생성 완료');

  // 7. 참가 신청 내역 (Registrations)
  const registrationResponses = [
    {
      gender: '남자',
      club: '통영 세일클럽',
      division: '윈드포일',
      tshirtSize: 'XL (110)',
      vestAgreement: '네. 확인했습니다.',
      paymentNoticeAgreement: '네. 확인했습니다.',
      liabilityWaiver: '네. 동의합니다.',
      privacyConsent: '네. 동의합니다.',
      mediaConsent: '네. 동의합니다.',
    },
    {
      gender: '여자',
      club: '부산 해운대 세일링',
      division: '윙포일',
      tshirtSize: 'L (105)',
      vestAgreement: '네. 확인했습니다.',
      paymentNoticeAgreement: '네. 확인했습니다.',
      liabilityWaiver: '네. 동의합니다.',
      privacyConsent: '네. 동의합니다.',
      mediaConsent: '네. 동의합니다.',
    },
    {
      gender: '남자',
      club: '여수 서핑 동호회',
      division: '혼합오픈',
      tshirtSize: 'M (100)',
      vestAgreement: '네. 확인했습니다.',
      paymentNoticeAgreement: '네. 확인했습니다.',
      liabilityWaiver: '네. 동의합니다.',
      privacyConsent: '네. 동의합니다.',
      mediaConsent: '네. 동의합니다.',
    },
  ];

  for (let i = 0; i < players.length; i++) {
    await prisma.registration.create({
      data: {
        tournamentId: activeTournament.id,
        playerId: players[i].id,
        formResponses: JSON.stringify(registrationResponses[i]),
        paymentStatus: 'APPROVED',
        status: 'APPROVED',
      },
    });
  }

  console.log('참가자 접수 완료 및 승인 완료 데이터 매핑');

  // 8. 동점자 처리 규칙 설정 (TieBreakerRules)
  const rules = [
    { priority: 1, ruleType: 'HEAD_TO_HEAD' },
    { priority: 2, ruleType: 'SCORE_DIFF' },
    { priority: 3, ruleType: 'TOTAL_SCORES' },
    { priority: 4, ruleType: 'AGE_ORDER' },
  ];

  for (const r of rules) {
    await prisma.tieBreakerRule.create({
      data: {
        tournamentId: activeTournament.id,
        priority: r.priority,
        ruleType: r.ruleType,
      },
    });
  }

  console.log('윈드서핑 동점자 규칙 생성 완료');

  // 9. 경기 및 매치 데이터 세팅 (3인 리그전)
  // 경기 1: 김철수 vs 이영희 (김철수 승리, 3:1)
  const match1 = await prisma.match.create({
    data: {
      tournamentId: activeTournament.id,
      round: 1,
      matchType: 'LEAGUE',
      status: 'COMPLETED',
      refereeId: windReferee.id,
      scheduledAt: new Date('2026-09-12T10:00:00Z'),
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      { matchId: match1.id, playerId: players[0].id, score: 3, isWinner: true, details: JSON.stringify({ pointsWon: 30, pointsLost: 18 }) },
      { matchId: match1.id, playerId: players[1].id, score: 1, isWinner: false, details: JSON.stringify({ pointsWon: 18, pointsLost: 30 }) },
    ],
  });

  // 경기 2: 이영희 vs 박민수 (이영희 승리, 3:2)
  const match2 = await prisma.match.create({
    data: {
      tournamentId: activeTournament.id,
      round: 1,
      matchType: 'LEAGUE',
      status: 'COMPLETED',
      refereeId: windReferee.id,
      scheduledAt: new Date('2026-09-12T11:00:00Z'),
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      { matchId: match2.id, playerId: players[1].id, score: 3, isWinner: true, details: JSON.stringify({ pointsWon: 30, pointsLost: 25 }) },
      { matchId: match2.id, playerId: players[2].id, score: 2, isWinner: false, details: JSON.stringify({ pointsWon: 25, pointsLost: 30 }) },
    ],
  });

  // 경기 3: 김철수 vs 박민수 (박민수 승리, 3:2) -> 3명 모두 1승 1패 상황 연출
  const match3 = await prisma.match.create({
    data: {
      tournamentId: activeTournament.id,
      round: 1,
      matchType: 'LEAGUE',
      status: 'COMPLETED',
      refereeId: windReferee.id,
      scheduledAt: new Date('2026-09-12T12:00:00Z'),
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      { matchId: match3.id, playerId: players[0].id, score: 2, isWinner: false, details: JSON.stringify({ pointsWon: 24, pointsLost: 26 }) },
      { matchId: match3.id, playerId: players[2].id, score: 3, isWinner: true, details: JSON.stringify({ pointsWon: 26, pointsLost: 24 }) },
    ],
  });

  // 경기 4: 김철수 vs 이영희 (2차전, 예정됨)
  await prisma.match.create({
    data: {
      tournamentId: activeTournament.id,
      round: 2,
      matchType: 'LEAGUE',
      status: 'SCHEDULED',
      refereeId: windReferee.id,
      scheduledAt: new Date('2026-09-13T10:00:00Z'),
      participants: {
        create: [
          { playerId: players[0].id, score: 0, isWinner: false },
          { playerId: players[1].id, score: 0, isWinner: false },
        ],
      },
    },
  });

  console.log('윈드서핑 경기 데이터 생성 완료');

  // 10. 과거 2025년 대회 아카이브 데이터 세팅
  const oldPlayer1 = await prisma.player.create({
    data: { name: '세일러킴', uniqueCode: 'PL-SAIL-777', tenantId: windTenant.id },
  });
  const oldPlayer2 = await prisma.player.create({
    data: { name: '웨이브박', uniqueCode: 'PL-WAVE-555', tenantId: windTenant.id },
  });

  const oldMatch = await prisma.match.create({
    data: {
      tournamentId: archivedTournament.id,
      round: 1,
      matchType: 'TOURNAMENT',
      status: 'COMPLETED',
      scheduledAt: new Date('2025-09-10T14:00:00Z'),
    },
  });

  await prisma.matchParticipant.createMany({
    data: [
      { matchId: oldMatch.id, playerId: oldPlayer1.id, score: 3, isWinner: true },
      { matchId: oldMatch.id, playerId: oldPlayer2.id, score: 1, isWinner: false },
    ],
  });

  console.log('아카이브 데이터 세팅 완료');
  console.log('Seed 완료 (윈드서핑)!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
