import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, subdomain, primaryColor, rulesSummary } = body;

    if (!name || !subdomain) {
      return NextResponse.json({ error: '대회 이름과 도메인 주소는 필수입니다.' }, { status: 400 });
    }

    // 영문 소문자 및 하이픈만 서브도메인으로 허용하는 정규식 체크
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json(
        { error: '서브도메인은 영문 소문자, 숫자, 하이픈(-)만 포함할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 중복 체크
    const existing = await db.tenant.findUnique({
      where: { subdomain },
    });

    if (existing) {
      return NextResponse.json({ error: '이미 사용 중인 서브도메인 주소입니다.' }, { status: 400 });
    }

    // 트랜잭션으로 테넌트, 대회, 기본 신청서 폼 및 정렬 규칙 생성
    const result = await db.$transaction(async (tx) => {
      // 1. 테넌트 생성
      const tenant = await tx.tenant.create({
        data: {
          name,
          subdomain,
          primaryColor: primaryColor || '#4F46E5',
          rulesSummary: rulesSummary || '새롭게 개설된 대회 채널입니다. 대회 요강을 추가해 주세요.',
        },
      });

      // 2. 기본 호스트 계정 발급 (데모 목적의 자동 가입)
      const hostEmail = `host@${subdomain}.com`;
      await tx.user.create({
        data: {
          email: hostEmail,
          passwordHash: 'host123', // 기본 임시비밀번호
          name: `${name} 관리자`,
          role: 'HOST_ADMIN',
          tenantId: tenant.id,
        },
      });

      // 3. 심판 계정 자동 발급
      const refEmail = `referee@${subdomain}.com`;
      await tx.user.create({
        data: {
          email: refEmail,
          passwordHash: 'ref123',
          name: `${name} 공식심판 A`,
          role: 'REFEREE',
          tenantId: tenant.id,
        },
      });

      // 4. 최초 대회 자동 프로비저닝 (ONGOING)
      const tournament = await tx.tournament.create({
        data: {
          tenantId: tenant.id,
          title: `제1회 ${name} 리그`,
          status: 'ONGOING',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 뒤
        },
      });

      // 5. 기본 참가 폼 빌더 세팅 (이름, 연락처, 이메일은 기본 수집하며, 커스텀 필드 2개 세팅)
      const defaultFields = [
        { name: 'division', label: '참가 부문', type: 'select', options: ['A조', 'B조', 'C조'], required: true },
        { name: 'tshirtSize', label: '티셔츠 사이즈', type: 'select', options: ['S', 'M', 'L', 'XL'], required: true },
      ];
      await tx.registrationForm.create({
        data: {
          tournamentId: tournament.id,
          fields: JSON.stringify(defaultFields),
        },
      });

      // 6. 기본 동점자 처리 규칙 생성 (우선순위 1~4)
      const defaultRules = [
        { priority: 1, ruleType: 'HEAD_TO_HEAD' },
        { priority: 2, ruleType: 'SCORE_DIFF' },
        { priority: 3, ruleType: 'TOTAL_SCORES' },
        { priority: 4, ruleType: 'AGE_ORDER' },
      ];
      for (const r of defaultRules) {
        await tx.tieBreakerRule.create({
          data: {
            tournamentId: tournament.id,
            priority: r.priority,
            ruleType: r.ruleType,
          },
        });
      }

      return { tenant, hostEmail, refEmail };
    });

    return NextResponse.json({
      success: true,
      subdomain: result.tenant.subdomain,
      hostEmail: result.hostEmail,
      refereeEmail: result.refEmail,
    });
  } catch (error: any) {
    console.error('테넌트 프로비저닝 실패:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
