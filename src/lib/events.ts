import { EventEmitter } from 'events';

const globalForEmitter = globalThis as unknown as {
  emitter: EventEmitter | undefined;
};

// Next.js hot reload 시 여러 Emitter 인스턴스가 중복 생성되는 현상 방지
export const eventEmitter = globalForEmitter.emitter ?? new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEmitter.emitter = eventEmitter;
}

// 이벤트 명칭 정의
export const EVENTS = {
  SCORE_UPDATED: 'SCORE_UPDATED',
  TIEBREAKER_UPDATED: 'TIEBREAKER_UPDATED',
};
