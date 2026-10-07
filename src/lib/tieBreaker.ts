export interface MatchResult {
  homePlayerId: string;
  awayPlayerId: string;
  homeScore: number;
  awayScore: number;
  winnerId: string | null; // null 이면 무승부
}

export type TieBreakerRuleType =
  | 'HEAD_TO_HEAD'
  | 'MOST_BETTER_FINISHES'
  | 'MOST_RECENT_RACE'
  | 'DISCARD_DROP'
  | 'SCORE_DIFF'
  | 'TOTAL_SCORES'
  | 'AGE_ORDER';

export interface TieBreakerRuleInput {
  id?: string;
  priority: number;
  ruleType: TieBreakerRuleType;
}

export const DEFAULT_SAILING_TIE_BREAKER_RULES: TieBreakerRuleInput[] = [
  { id: 'rule-h2h', priority: 1, ruleType: 'HEAD_TO_HEAD' },
  { id: 'rule-mbf', priority: 2, ruleType: 'MOST_BETTER_FINISHES' },
  { id: 'rule-mrr', priority: 3, ruleType: 'MOST_RECENT_RACE' },
  { id: 'rule-drop', priority: 4, ruleType: 'DISCARD_DROP' },
];

export interface PlayerRankInput {
  playerId: string;
  name: string;
  birthDate: string; // "YYYY-MM-DD" 포맷
  points: number;    // 기본 승점 또는 총점
  wins: number;
  losses: number;
  draws: number;
  scoreDiff: number;  // 득실차
  totalScores: number; // 다득점
  raceScores?: number[]; // 라운드별 레이스 점수 배열 (1R, 2R, ... 순서, 낮을수록 상위)
}

/**
 * 다중 레이스 시리즈(윈드서핑/세일링) 두 선수의 레이스 기록 기반 타이브레이커 평가
 * (낮은 점수가 더 좋은 성적: 1위 = 1점, 2위 = 2점 ...)
 */
export function evaluateSailingRule(
  ruleType: TieBreakerRuleType,
  scoresA: number[],
  scoresB: number[]
): number {
  const len = Math.min(scoresA.length, scoresB.length);
  if (len === 0) return 0;

  switch (ruleType) {
    case 'HEAD_TO_HEAD': {
      // 1. 상대 전적 (Head-to-Head / 동점자 간의 레이스 비교)
      // 동점인 선수들끼리 직접 맞붙었던 레이스(들)에서 더 좋은 순위(낮은 점수)를 기록한 횟수 비교
      let aBetterCount = 0;
      let bBetterCount = 0;
      for (let i = 0; i < len; i++) {
        if (scoresA[i] < scoresB[i]) aBetterCount++;
        else if (scoresB[i] < scoresA[i]) bBetterCount++;
      }
      if (aBetterCount !== bBetterCount) {
        return bBetterCount - aBetterCount; // 더 많이 이긴 쪽이 상위 (-1이면 A 상위)
      }
      return 0;
    }

    case 'MOST_BETTER_FINISHES': {
      // 2. 상위 성적 횟수 비교 (Most Better Finishes)
      // 1위 횟수, 2위 횟수, 3위 횟수 순(= 오름차순 정렬된 성적 배열)으로 차례대로 비교하여 더 좋은 성적을 거둔 선수 우선
      const sortedA = [...scoresA].sort((x, y) => x - y);
      const sortedB = [...scoresB].sort((x, y) => x - y);
      for (let i = 0; i < Math.min(sortedA.length, sortedB.length); i++) {
        if (sortedA[i] !== sortedB[i]) {
          return sortedA[i] - sortedB[i]; // 더 낮은 점수(상위 등수)를 먼저/많이 기록한 선수가 상위
        }
      }
      return 0;
    }

    case 'MOST_RECENT_RACE': {
      // 3. 가장 최근 레이스 성적 비교 (Most Recent Race)
      // 마지막 레이스(가장 최근에 치른 레이스)부터 역순으로 비교하여 더 앞선 순위를 기록한 선수를 상위에 랭크
      for (let i = len - 1; i >= 0; i--) {
        if (scoresA[i] !== scoresB[i]) {
          return scoresA[i] - scoresB[i];
        }
      }
      return 0;
    }

    case 'DISCARD_DROP': {
      // 4. 최하위 성적 제외 후 재산정 (Discard / Drop)
      // 성적이 가장 안 좋은 레이스 점수(최댓값)를 제외(Drop)한 뒤의 총점으로 다시 비교
      if (scoresA.length >= 2 && scoresB.length >= 2) {
        const sumA = scoresA.reduce((acc, v) => acc + v, 0);
        const sumB = scoresB.reduce((acc, v) => acc + v, 0);
        const maxA = Math.max(...scoresA);
        const maxB = Math.max(...scoresB);
        const dropOneA = sumA - maxA;
        const dropOneB = sumB - maxB;
        if (dropOneA !== dropOneB) {
          return dropOneA - dropOneB;
        }
        // 이미 1개 제외 총점이 같고 레이스가 3개 이상이면 차순위 최하위 성적까지 제외한 총점으로 재비교
        if (scoresA.length >= 3 && scoresB.length >= 3) {
          const sortedDescA = [...scoresA].sort((x, y) => y - x);
          const sortedDescB = [...scoresB].sort((x, y) => y - x);
          const dropTwoA = sumA - sortedDescA[0] - sortedDescA[1];
          const dropTwoB = sumB - sortedDescB[0] - sortedDescB[1];
          if (dropTwoA !== dropTwoB) {
            return dropTwoA - dropTwoB;
          }
        }
      }
      return 0;
    }

    default:
      return 0;
  }
}

/**
 * 1대1 승자승(Head-to-head) 전적을 평가합니다.
 */
function evaluateHeadToHead(
  playerAId: string,
  playerBId: string,
  matches: MatchResult[]
): number {
  const directMatches = matches.filter(
    (m) =>
      (m.homePlayerId === playerAId && m.awayPlayerId === playerBId) ||
      (m.homePlayerId === playerBId && m.awayPlayerId === playerAId)
  );

  let aWins = 0;
  let bWins = 0;

  for (const match of directMatches) {
    if (match.winnerId === playerAId) {
      aWins++;
    } else if (match.winnerId === playerBId) {
      bWins++;
    }
  }

  if (aWins > bWins) return -1; // A가 우위
  if (bWins > aWins) return 1;  // B가 우위
  return 0;                     // 동률
}

/**
 * 나이 비교 (연장자 우선)
 * YYYYMMDD 8자리 문자열 또는 일반 날짜 형식 지원
 */
function evaluateAgeOrder(birthDateA: string, birthDateB: string): number {
  const parseBirthDate = (bd: string): number => {
    if (!bd) return 0;
    const clean = bd.replace(/[^0-9]/g, '');
    if (clean.length === 8) {
      const y = parseInt(clean.substring(0, 4), 10);
      const m = parseInt(clean.substring(4, 6), 10) - 1;
      const d = parseInt(clean.substring(6, 8), 10);
      const testDate = new Date(y, m, d);
      return testDate.getTime();
    }
    return new Date(bd).getTime();
  };

  const dateA = parseBirthDate(birthDateA);
  const dateB = parseBirthDate(birthDateB);

  if (isNaN(dateA) || isNaN(dateB)) return 0;

  if (dateA < dateB) return -1; // A가 연장자이므로 우위
  if (dateB < dateA) return 1;  // B가 연장자이므로 우위
  return 0;
}

/**
 * 두 선수를 규칙에 따라 비교하는 공통 함수
 */
export function comparePlayers(
  a: PlayerRankInput,
  b: PlayerRankInput,
  rules: TieBreakerRuleInput[],
  matches: MatchResult[]
): number {
  // 0단계: 기본 승점 비교
  if (a.points !== b.points) {
    return b.points - a.points; // 내림차순
  }

  // 규칙을 우선순위 순으로 정렬
  const sortedRules = [...rules].sort((x, y) => x.priority - y.priority);

  for (const rule of sortedRules) {
    if (a.raceScores && b.raceScores && a.raceScores.length > 0 && b.raceScores.length > 0) {
      const sailingResult = evaluateSailingRule(rule.ruleType, a.raceScores, b.raceScores);
      if (sailingResult !== 0) return sailingResult;
    }

    switch (rule.ruleType) {
      case 'HEAD_TO_HEAD': {
        const h2hResult = evaluateHeadToHead(a.playerId, b.playerId, matches);
        if (h2hResult !== 0) return h2hResult;
        break;
      }
      case 'SCORE_DIFF':
        if (a.scoreDiff !== b.scoreDiff) {
          return b.scoreDiff - a.scoreDiff; // 내림차순
        }
        break;
      case 'TOTAL_SCORES':
        if (a.totalScores !== b.totalScores) {
          return b.totalScores - a.totalScores; // 내림차순
        }
        break;
      case 'AGE_ORDER': {
        const ageResult = evaluateAgeOrder(a.birthDate, b.birthDate);
        if (ageResult !== 0) return ageResult;
        break;
      }
      default:
        break;
    }
  }

  return 0; // 완벽한 동점
}

/**
 * 규칙 기반으로 선수 목록 정렬
 */
export function sortPlayersByRules(
  players: PlayerRankInput[],
  rules: TieBreakerRuleInput[],
  matches: MatchResult[]
): PlayerRankInput[] {
  return [...players].sort((a, b) => comparePlayers(a, b, rules, matches));
}

/**
 * 정렬된 선수 목록에 순위(등수)를 매기는 함수입니다.
 */
export function assignRanks(
  sortedPlayers: PlayerRankInput[],
  rules: TieBreakerRuleInput[],
  matches: MatchResult[],
  allowJointRank: boolean = true,
  useDenseRank: boolean = false
): Array<PlayerRankInput & { rank: number }> {
  const result: Array<PlayerRankInput & { rank: number }> = [];

  if (sortedPlayers.length === 0) return result;

  let currentRank = 1;
  let skippedRanks = 0;

  result.push({ ...sortedPlayers[0], rank: currentRank });

  for (let i = 1; i < sortedPlayers.length; i++) {
    const prev = sortedPlayers[i - 1];
    const curr = sortedPlayers[i];

    // 두 선수가 규칙을 모두 적용해봐도 동점인지 확인
    const isTie = comparePlayers(prev, curr, rules, matches) === 0;

    if (allowJointRank && isTie) {
      skippedRanks++;
      result.push({ ...curr, rank: currentRank });
    } else {
      if (useDenseRank) {
        currentRank++;
      } else {
        currentRank += skippedRanks + 1;
      }
      skippedRanks = 0;
      result.push({ ...curr, rank: currentRank });
    }
  }

  return result;
}

