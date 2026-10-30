import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface CacheItem<T> {
  data: T;
  cachedAt: number;
}

// ── 캐시 TTL 설정 ──
const REGISTRATIONS_CACHE_TTL_MS = 60 * 1000; // 60초 (신청자 목록 인메모리 캐시)
const LEADERBOARD_CACHE_TTL_MS = 15 * 1000;    // 15초 (실시간 순위표 인메모리 캐시)
const MATCHES_CACHE_TTL_MS = 30 * 1000;        // 30초 (대진표/경기결과 인메모리 캐시)

// ── 서버 프로세스 인메모리 캐시 저장소 ──
const registrationsCache = new Map<string, CacheItem<{ registrations: any[]; formFields: any[]; registeredClubs: string[] }>>();
const leaderboardCache = new Map<string, CacheItem<any>>();
const matchesCache = new Map<string, CacheItem<any[]>>();

// ══════════════════════════════════════════════════════════════
// 1. 참가 신청서(Registrations) 스냅샷 & 캐시 최적화
// ══════════════════════════════════════════════════════════════

export function getMemoryRegistrations(tournamentId: string) {
  const cached = registrationsCache.get(tournamentId);
  if (cached && Date.now() - cached.cachedAt < REGISTRATIONS_CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

export function setMemoryRegistrations(tournamentId: string, data: { registrations: any[]; formFields: any[]; registeredClubs: string[] }) {
  registrationsCache.set(tournamentId, {
    data,
    cachedAt: Date.now()
  });
}

export function invalidateRegistrationsCache(tournamentId: string) {
  registrationsCache.delete(tournamentId);
}

/**
 * 참가신청서 조회 최적화:
 * 1) 서버 인메모리 캐시 확인 (0 Reads)
 * 2) Firestore 통합 스냅샷 문서 확인 (1 Read)
 * 3) 없으면 전체 컬렉션 fallback 조회 후 스냅샷 문서 자동 생성 (초회 1회만 발생)
 */
export async function getOrBuildRegistrationsSnapshot(
  tournamentId: string,
  fallbackQueryBuilder: () => Promise<{ registrations: any[]; formFields: any[]; registeredClubs: string[] }>
): Promise<{ registrations: any[]; formFields: any[]; registeredClubs: string[]; fromSnapshot: boolean }> {
  // 1. 메모리 캐시 히트
  const memoryData = getMemoryRegistrations(tournamentId);
  if (memoryData) {
    return { ...memoryData, fromSnapshot: true };
  }

  // 2. Firestore 단일 스냅샷 문서 확인 (Read 1건으로 130+명 전원 조회)
  const snapshotRef = doc(firestore, 'tournaments', tournamentId, 'snapshots', 'registrations');
  try {
    const snapDoc = await getDoc(snapshotRef);
    if (snapDoc.exists()) {
      const snapData = snapDoc.data() as any;
      if (Array.isArray(snapData.registrations)) {
        const payload = {
          registrations: snapData.registrations,
          formFields: snapData.formFields || [],
          registeredClubs: snapData.registeredClubs || [],
        };
        setMemoryRegistrations(tournamentId, payload);
        return { ...payload, fromSnapshot: true };
      }
    }
  } catch (err) {
    console.warn('[dataSnapshot] Failed to read registrations snapshot:', err);
  }

  // 3. 스냅샷 문서가 없으면 컬렉션에서 빌드 후 스냅샷 문서 저장
  const freshData = await fallbackQueryBuilder();
  setMemoryRegistrations(tournamentId, freshData);

  // 비동기로 스냅샷 문서 저장하여 다음 요청부터는 1개 문서만 읽도록 최적화
  try {
    await setDoc(snapshotRef, {
      tournamentId,
      updatedAt: new Date().toISOString(),
      registrations: freshData.registrations,
      formFields: freshData.formFields,
      registeredClubs: freshData.registeredClubs,
      count: freshData.registrations.length,
    });
  } catch (writeErr) {
    console.error('[dataSnapshot] Failed to write registrations snapshot:', writeErr);
  }

  return { ...freshData, fromSnapshot: false };
}

/**
 * 참가신청 수정/일괄 등록/승인 시 스냅샷 동기화 및 캐시 무효화
 */
export async function updateRegistrationsSnapshot(
  tournamentId: string,
  data: { registrations: any[]; formFields?: any[]; registeredClubs?: string[] }
) {
  invalidateRegistrationsCache(tournamentId);

  const snapshotRef = doc(firestore, 'tournaments', tournamentId, 'snapshots', 'registrations');
  try {
    const existingSnap = await getDoc(snapshotRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : {};

    const payload = {
      ...existingData,
      tournamentId,
      updatedAt: new Date().toISOString(),
      registrations: data.registrations,
      formFields: data.formFields || existingData.formFields || [],
      registeredClubs: data.registeredClubs || existingData.registeredClubs || [],
      count: data.registrations.length,
    };

    await setDoc(snapshotRef, payload);
    setMemoryRegistrations(tournamentId, {
      registrations: payload.registrations,
      formFields: payload.formFields,
      registeredClubs: payload.registeredClubs,
    });
  } catch (err) {
    console.error('[dataSnapshot] Failed to update registrations snapshot:', err);
  }
}

// ══════════════════════════════════════════════════════════════
// 2. 리더보드(Leaderboard) 통합 스냅샷 & 캐시 최적화
// ══════════════════════════════════════════════════════════════

export function getMemoryLeaderboard(tournamentId: string, divisionKey: string = 'ALL') {
  const key = `${tournamentId}_${divisionKey}`;
  const cached = leaderboardCache.get(key);
  if (cached && Date.now() - cached.cachedAt < LEADERBOARD_CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

export function setMemoryLeaderboard(tournamentId: string, divisionKey: string = 'ALL', data: any) {
  const key = `${tournamentId}_${divisionKey}`;
  leaderboardCache.set(key, {
    data,
    cachedAt: Date.now()
  });
}

export function invalidateLeaderboardCache(tournamentId: string) {
  for (const key of Array.from(leaderboardCache.keys())) {
    if (key.startsWith(tournamentId)) {
      leaderboardCache.delete(key);
    }
  }
}

/**
 * 모든 종목의 리더보드를 단 1개의 스냅샷 문서(leaderboards_all)로 일괄 조회
 */
export async function getConsolidatedLeaderboardSnapshot(
  tournamentId: string
): Promise<{ divisions: Record<string, any>; updatedAt?: string } | null> {
  const memory = getMemoryLeaderboard(tournamentId, 'ALL');
  if (memory) return memory;

  const snapshotRef = doc(firestore, 'tournaments', tournamentId, 'snapshots', 'leaderboard_all');
  try {
    const snap = await getDoc(snapshotRef);
    if (snap.exists()) {
      const data = snap.data() as any;
      const result = {
        divisions: data.divisions || {},
        updatedAt: data.updatedAt,
      };
      setMemoryLeaderboard(tournamentId, 'ALL', result);
      return result;
    }
  } catch (err) {
    console.warn('[dataSnapshot] Failed to read consolidated leaderboard:', err);
  }
  return null;
}

/**
 * 특정 종목 순위표 저장 시 개별 문서 및 통합 스냅샷 동시 업데이트
 */
export async function saveLeaderboardDivisionSnapshot(
  tournamentId: string,
  division: string,
  divisionData: { list: any[]; rounds?: any[]; dnsDnfRule?: string }
) {
  invalidateLeaderboardCache(tournamentId);

  // 1. 통합 스냅샷 문서 업데이트 (방문자가 1번의 Read로 모든 종목 순위를 가져가도록 보장)
  const snapshotRef = doc(firestore, 'tournaments', tournamentId, 'snapshots', 'leaderboard_all');
  try {
    const snap = await getDoc(snapshotRef);
    const existing = snap.exists() ? snap.data() : { divisions: {} };
    const divisions = existing.divisions || {};

    divisions[division] = {
      list: divisionData.list,
      rounds: divisionData.rounds || null,
      dnsDnfRule: divisionData.dnsDnfRule || null,
      updatedAt: new Date().toISOString(),
    };

    const payload = {
      tournamentId,
      updatedAt: new Date().toISOString(),
      divisions,
    };

    await setDoc(snapshotRef, payload);
    setMemoryLeaderboard(tournamentId, 'ALL', payload);
    setMemoryLeaderboard(tournamentId, division, divisionData);
  } catch (err) {
    console.error('[dataSnapshot] Failed to save consolidated leaderboard snapshot:', err);
  }
}

// ══════════════════════════════════════════════════════════════
// 3. 대진표 & 경기결과(Matches) 스냅샷 & 캐시 최적화
// ══════════════════════════════════════════════════════════════

export function getMemoryMatches(tournamentId: string) {
  const cached = matchesCache.get(tournamentId);
  if (cached && Date.now() - cached.cachedAt < MATCHES_CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

export function setMemoryMatches(tournamentId: string, matches: any[]) {
  matchesCache.set(tournamentId, {
    data: matches,
    cachedAt: Date.now()
  });
}

export function invalidateMatchesCache(tournamentId: string) {
  matchesCache.delete(tournamentId);
}

export async function getOrBuildMatchesSnapshot(
  tournamentId: string,
  fallbackQueryBuilder: () => Promise<any[]>
): Promise<any[]> {
  const memory = getMemoryMatches(tournamentId);
  if (memory) return memory;

  const snapshotRef = doc(firestore, 'tournaments', tournamentId, 'snapshots', 'matches');
  try {
    const snap = await getDoc(snapshotRef);
    if (snap.exists()) {
      const data = snap.data() as any;
      if (Array.isArray(data.matches)) {
        setMemoryMatches(tournamentId, data.matches);
        return data.matches;
      }
    }
  } catch (err) {
    console.warn('[dataSnapshot] Failed to read matches snapshot:', err);
  }

  const freshMatches = await fallbackQueryBuilder();
  setMemoryMatches(tournamentId, freshMatches);

  try {
    await setDoc(snapshotRef, {
      tournamentId,
      updatedAt: new Date().toISOString(),
      matches: freshMatches,
      count: freshMatches.length,
    });
  } catch (writeErr) {
    console.error('[dataSnapshot] Failed to write matches snapshot:', writeErr);
  }

  return freshMatches;
}

export async function saveMatchesSnapshot(tournamentId: string, matches: any[]) {
  invalidateMatchesCache(tournamentId);

  const snapshotRef = doc(firestore, 'tournaments', tournamentId, 'snapshots', 'matches');
  try {
    await setDoc(snapshotRef, {
      tournamentId,
      updatedAt: new Date().toISOString(),
      matches,
      count: matches.length,
    });
    setMemoryMatches(tournamentId, matches);
  } catch (err) {
    console.error('[dataSnapshot] Failed to save matches snapshot:', err);
  }
}
