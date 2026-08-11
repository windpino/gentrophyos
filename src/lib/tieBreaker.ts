export interface PlayerRankInput {
  playerId: string;
  name: string;
  birthDate: string; // "YYYY-MM-DD" 포맷
  points: number;    // 기본 승점 (예: 승 3, 무 1, 패 0)
  wins: number;
  losses: number;
  draws: number;
  scoreDiff: number;  // 득실차
  totalScores: number; // 다득점
}

export interface MatchResult {
  homePlayerId: string;
  awayPlayerId: string;
  homeScore: number;
  awayScore: number;
  winnerId: string | null; // null 이면 무승부
}

export interface TieBreakerRuleInput {
  priority: number;
  ruleType: 'HEAD_TO_HEAD' | 'SCORE_DIFF' | 'TOTAL_SCORES' | 'AGE_ORDER';
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

