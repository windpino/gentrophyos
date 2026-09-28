import { db as firestore } from '@/src/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface CachedTenantPayload {
  tenantData: any;
  tournaments: any[];
  cachedAt: number;
}

interface CachedActiveTournament {
  data: any;
  cachedAt: number;
}

// 24시간 영구 인메모리 캐시 (대회 요강이 불변이므로 일반인 접속 시 Firestore Read 원천 차단)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const tenantCache = new Map<string, CachedTenantPayload>();
const activeTourCache = new Map<string, CachedActiveTournament>();

export async function getCachedTenantFull(subdomain: string) {
  const now = Date.now();
  const cached = tenantCache.get(subdomain);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return { tenantData: cached.tenantData, tournaments: cached.tournaments, fromCache: true };
  }

  const tenantRef = doc(firestore, 'tenants', subdomain);
  const tenantDoc = await getDoc(tenantRef);
  if (!tenantDoc.exists()) {
    return null;
  }

  const tenantData = { id: tenantDoc.id, ...tenantDoc.data() };

  // 대회 목록 쿼리
  const tournamentsQuery = query(
    collection(firestore, 'tournaments'),
    where('tenantId', '==', tenantData.id)
  );
  const tournamentsSnap = await getDocs(tournamentsQuery);
  const tournaments = tournamentsSnap.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  tenantCache.set(subdomain, { tenantData, tournaments, cachedAt: now });
  return { tenantData, tournaments, fromCache: false };
}

export async function getCachedActiveTournament(tenantId: string) {
  const now = Date.now();
  const cached = activeTourCache.get(tenantId);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const activeQuery = query(
    collection(firestore, 'tournaments'),
    where('tenantId', '==', tenantId),
    where('status', '==', 'ONGOING')
  );
  const snap = await getDocs(activeQuery);
  if (snap.empty) {
    activeTourCache.set(tenantId, { data: null, cachedAt: now });
    return null;
  }

  const activeTours = snap.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: new Date((docSnap.data() as any).createdAt),
  })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const activeTour = activeTours[0] || null;
  activeTourCache.set(tenantId, { data: activeTour, cachedAt: now });
  return activeTour;
}

export function invalidateTenantCache(subdomain?: string, tenantId?: string) {
  if (subdomain) {
    tenantCache.delete(subdomain);
  } else {
    tenantCache.clear();
  }
  if (tenantId) {
    activeTourCache.delete(tenantId);
  } else {
    activeTourCache.clear();
  }
}
