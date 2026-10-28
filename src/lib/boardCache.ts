// 공지사항 및 Q&A 인메모리 캐시 모듈 (Firestore 반복 조회 지연 완전 제거)
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60초 캐시 (신규 작성/수정/삭제 시 즉시 무효화)

const announcementsCache = new Map<string, CacheEntry<any[]>>();
const qnaAdminCache = new Map<string, CacheEntry<any[]>>();
const qnaPublicCache = new Map<string, CacheEntry<any[]>>();

// ── 공지사항 캐시 ──
export function getCachedAnnouncements(subdomain: string): any[] | null {
  const entry = announcementsCache.get(subdomain);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    announcementsCache.delete(subdomain);
    return null;
  }
  return entry.data;
}

export function setCachedAnnouncements(subdomain: string, data: any[]) {
  announcementsCache.set(subdomain, { data, cachedAt: Date.now() });
}

export function invalidateAnnouncementsCache(subdomain: string) {
  announcementsCache.delete(subdomain);
}

// ── Q&A 캐시 ──
export function getCachedQnaList(subdomain: string, isAdmin: boolean): any[] | null {
  const cacheMap = isAdmin ? qnaAdminCache : qnaPublicCache;
  const entry = cacheMap.get(subdomain);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cacheMap.delete(subdomain);
    return null;
  }
  return entry.data;
}

export function setCachedQnaList(subdomain: string, isAdmin: boolean, data: any[]) {
  const cacheMap = isAdmin ? qnaAdminCache : qnaPublicCache;
  cacheMap.set(subdomain, { data, cachedAt: Date.now() });
}

export function invalidateQnaCache(subdomain: string) {
  qnaAdminCache.delete(subdomain);
  qnaPublicCache.delete(subdomain);
}
