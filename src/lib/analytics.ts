import { app } from './firebase';
import { getAnalytics, isSupported, logEvent as fbLogEvent, Analytics } from 'firebase/analytics';

let analyticsInstance: Analytics | null = null;
let initPromise: Promise<Analytics | null> | null = null;

/**
 * 브라우저 환경에서만 Firebase Analytics를 안전하게 비동기 초기화합니다.
 * SSR 환경(서버 컴포넌트, 정적 빌드)에서 발생하는 에러를 원천 차단합니다.
 */
export async function getAnalyticsInstance(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  if (analyticsInstance) return analyticsInstance;
  
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const supported = await isSupported();
        if (supported) {
          analyticsInstance = getAnalytics(app);
          return analyticsInstance;
        }
      } catch (err) {
        console.warn('[Analytics] isSupported check failed:', err);
      }
      return null;
    })();
  }
  return initPromise;
}

/**
 * 사용자 행동(이벤트)을 Firebase Analytics에 기록합니다.
 * 로컬 개발 환경 및 브라우저 미지원 환경에서도 크래시 없이 안전하게 동작합니다.
 */
export async function logAnalyticsEvent(eventName: string, eventParams?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  try {
    const analytics = await getAnalyticsInstance();
    if (analytics) {
      fbLogEvent(analytics, eventName, eventParams);
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 [Analytics Event] ${eventName}:`, eventParams);
      }
    }
  } catch (err) {
    console.debug(`[Analytics Log Error] ${eventName}:`, err);
  }
}
