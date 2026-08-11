import { db as prisma } from '../src/lib/db';
import { db as firestore } from '../src/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

async function main() {
  console.log('Firebase 데이터 시딩 시작...');

  const tenants = await prisma.tenant.findMany({
    include: {
      tournaments: true,
    }
  });

  for (const t of tenants) {
    const tenantRef = doc(firestore, 'tenants', t.subdomain);
    await setDoc(tenantRef, {
      id: t.id,
      name: t.name,
      subdomain: t.subdomain,
      logoUrl: t.logoUrl ?? null,
      primaryColor: t.primaryColor,
      rulesSummary: t.rulesSummary ?? null,
      createdAt: t.createdAt.toISOString(),
    });
    console.log(`Tenant ${t.subdomain} 시딩 완료`);

    for (const tour of t.tournaments) {
      const tourRef = doc(firestore, 'tournaments', tour.id);
      await setDoc(tourRef, {
        id: tour.id,
        tenantId: t.id,
        title: tour.title,
        status: tour.status,
        startDate: tour.startDate.toISOString(),
        endDate: tour.endDate.toISOString(),
        createdAt: tour.createdAt.toISOString(),
      });
      console.log(`Tournament ${tour.title} (ID: ${tour.id}) 시딩 완료`);

      const rules = await prisma.tieBreakerRule.findMany({
        where: { tournamentId: tour.id }
      });
      for (const rule of rules) {
        const ruleRef = doc(firestore, `tournaments/${tour.id}/tieBreakerRules`, rule.id);
        await setDoc(ruleRef, {
          id: rule.id,
          tournamentId: rule.tournamentId,
          ruleType: rule.ruleType,
          priority: rule.priority,
        });
      }
      console.log(`Tournament ${tour.title}의 동점자 룰 시딩 완료`);

      const forms = await prisma.registrationForm.findMany({
        where: { tournamentId: tour.id }
      });
      for (const form of forms) {
        const formRef = doc(firestore, `tournaments/${tour.id}/formConfigs`, form.id);
        await setDoc(formRef, {
          id: form.id,
          tournamentId: form.tournamentId,
          fields: form.fields,
          createdAt: form.createdAt.toISOString(),
        });
      }

      const regs = await prisma.registration.findMany({
        where: { tournamentId: tour.id },
        include: { player: true }
      });
      for (const reg of regs) {
        const regRef = doc(firestore, 'registrations', reg.id);
        await setDoc(regRef, {
          id: reg.id,
          tournamentId: reg.tournamentId,
          playerId: reg.playerId,
          status: reg.status,
          formResponses: reg.formResponses,
          createdAt: reg.createdAt.toISOString(),
          player: {
            id: reg.player.id,
            name: reg.player.name,
            createdAt: reg.player.createdAt.toISOString(),
          }
        });
      }
      console.log(`Tournament ${tour.title}의 신청자 내역 시딩 완료`);

      const matches = await prisma.match.findMany({
        where: { tournamentId: tour.id },
        include: {
          participants: {
            include: {
              player: {
                include: {
                  registrations: true
                }
              }
            }
          }
        }
      });
      for (const m of matches as any[]) {
        const matchRef = doc(firestore, 'matches', m.id);
        await setDoc(matchRef, {
          id: m.id,
          tournamentId: m.tournamentId,
          round: m.round ?? 1,
          matchType: m.matchType ?? '본선',
          status: m.status ?? 'SCHEDULED',
          createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
          participants: (m.participants || []).map((p: any) => ({
            id: p.id ?? '',
            matchId: p.matchId ?? '',
            playerId: p.playerId ?? '',
            score: p.score ?? 0,
            isWinner: p.isWinner ?? null,
            details: p.details ?? null,
            player: p.player ? {
              id: p.player.id ?? '',
              name: p.player.name ?? '',
              createdAt: p.player.createdAt ? p.player.createdAt.toISOString() : new Date().toISOString(),
              registrations: (p.player.registrations || []).map((r: any) => ({
                id: r.id ?? '',
                tournamentId: r.tournamentId ?? '',
                status: r.status ?? 'PENDING',
                formResponses: r.formResponses ?? null,
              }))
            } : null
          }))
        });
      }
      console.log(`Tournament ${tour.title}의 매치 대진표 시딩 완료`);
    }
  }

  console.log('Firebase 모든 데이터 시딩 완료!');
}

main()
  .catch(err => {
    console.error('시딩 중 심각한 오류 발생:', err);
    process.exit(1);
  });
