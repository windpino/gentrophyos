import { NextRequest } from 'next/server';
import { eventEmitter, EVENTS } from '@/src/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const responseStream = new ReadableStream({
    start(controller) {
      const onScoreUpdate = (data: any) => {
        // SSE 포맷에 맞춰 데이터 전송
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      eventEmitter.on(EVENTS.SCORE_UPDATED, onScoreUpdate);

      // 클라이언트 연결이 끊겼을 때 감지 및 이벤트 리스너 제거
      req.signal.addEventListener('abort', () => {
        eventEmitter.off(EVENTS.SCORE_UPDATED, onScoreUpdate);
      });
    },
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
