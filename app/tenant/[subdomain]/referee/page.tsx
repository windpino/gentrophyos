'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import {
  CheckCircle2,
  User,
  RefreshCw,
  AlertTriangle,
  ListOrdered,
  Home,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Trophy,
  RotateCcw,
  Sparkles,
  Search,
  ExternalLink,
  Edit2,
  Medal,
  Flag,
  Plus,
  Trash2,
  AlertCircle,
  Printer
} from 'lucide-react';
import {
  DEFAULT_SAILING_TIE_BREAKER_RULES,
  evaluateSailingRule,
  TieBreakerRuleInput
} from '@/src/lib/tieBreaker';
import { logAnalyticsEvent } from '@/src/lib/analytics';

export interface RoundItem {
  key: string;
  label: string;
  short: string;
}

// DNS / DNF 채점 규칙 타입
// 'FINISHER_PLUS_ONE': DNS(미입력 포함) = 참가신청자 수 + 1점 / DNF = 해당 레이스 완주자 수 + 1점 (예: 40명 등록, 35명 완주 시 DNS=41점, DNF=36점)
// 'REGISTERED_PLUS_ONE': DNS(미입력 포함), DNF 둘 다 참가신청자 수 + 1점 (예: 40명 등록 시 DNS=41점, DNF=41점)
export type DnsDnfScoringRule = 'FINISHER_PLUS_ONE' | 'REGISTERED_PLUS_ONE';

const DEFAULT_ROUNDS: RoundItem[] = [
  { key: 'r1', label: '1라운드 (1R)', short: '1R' },
  { key: 'r2', label: '2라운드 (2R)', short: '2R' },
  { key: 'r3', label: '3라운드 (3R)', short: '3R' },
  { key: 'r4', label: '4라운드 (4R)', short: '4R' },
  { key: 'r5', label: '5라운드 (5R)', short: '5R' },
];

const DEFAULT_TEAM_ROUNDS: RoundItem[] = [
  { key: 'r1', label: '1라운드 (1R)', short: '1R' },
];

export function formatBibShortDisplay(bibNumber?: string): string {
  if (!bibNumber) return '-';
  return bibNumber
    .trim()
    .replace(/\s*번\b|\s*번$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatRankDisplay(rank: any, isTeam: boolean = false): string {
  if (rank === null || rank === undefined || rank === '' || rank === '-') return '-';
  const num = Number(rank);
  if (isNaN(num) || num <= 0) return '-';

  if (isTeam) {
    if (num <= 5) return `${num}등`;
    return `${num}`;
  } else {
    if (num <= 3) return `${num}등`;
    return `${num}`;
  }
}

export function parseBirthNum(rawBirth: string): number {
  const digits = String(rawBirth || '').replace(/[^0-9]/g, '');
  if (!digits) return 0;
  if (digits.length >= 8) return parseInt(digits.slice(0, 8), 10) || 0;
  if (digits.length === 6) {
    const yy = parseInt(digits.slice(0, 2), 10);
    const prefix = yy <= 26 ? '20' : '19';
    return parseInt(`${prefix}${digits}`, 10) || 0;
  }
  if (digits.length === 4) return parseInt(`${digits}0101`, 10) || 0;
  return parseInt(digits, 10) || 0;
}

export function isAgeSplitDivision(divName?: string): boolean {
  if (!divName) return false;
  const d = divName.replace(/\s+/g, '');
  return (
    (d.includes('혼합오픈') || d.includes('펀엔포뮬러') || d.includes('펀&포뮬러') || d.includes('포뮬러')) &&
    (d.includes('남자') || !d.includes('여자'))
  );
}

export default function RefereeMobilePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);

  // 1. 기본 상태
  const [tenant, setTenant] = useState<any>(null);
  const [activeTournament, setActiveTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 혼합오픈 (남자부) / 펀엔포뮬러 (남자부) 전용 클라스별 보기 및 인쇄 선택 상태 ('all' | 'overall' | '청년부' | '중년부' | '장년부')
  const [selectedSubclassTab, setSelectedSubclassTab] = useState<string>('all');

  // 라운드 동적 관리 상태
  const [rounds, setRounds] = useState<RoundItem[]>(DEFAULT_ROUNDS);

  // 모드 분리 상태: 'input' (순위 입력란) vs 'confirm' (순위 확정 및 검토란)
  const [activeMode, setActiveMode] = useState<'input' | 'confirm'>('input');

  // DNS / DNF 벌점 산정 규칙 및 월드세일링 RRS 동점자 타이브레이커 우선순위 상태
  const [dnsDnfRule, setDnsDnfRule] = useState<DnsDnfScoringRule>('FINISHER_PLUS_ONE');
  const [tieBreakerRules, setTieBreakerRules] = useState<TieBreakerRuleInput[]>(DEFAULT_SAILING_TIE_BREAKER_RULES);

  // 참가자 목록 및 종목 선택
  const [rawRegistrations, setRawRegistrations] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [activeDivisionTab, setActiveDivisionTab] = useState<string>('윈드포일');
  // 단체전 출전 클럽(팀) 관리 상태
  const [selectedClubToAdd, setSelectedClubToAdd] = useState<string>('');
  const [customTeamNameToAdd, setCustomTeamNameToAdd] = useState<string>('');
  const [formFields, setFormFields] = useState<any[]>([]);

  // 순위 입력란 전용 상태
  const [selectedRound, setSelectedRound] = useState<string>('r1');
  const [currentRankNum, setCurrentRankNum] = useState<number>(1);
  const [bibInput, setBibInput] = useState<string>('');
  const [inputFeedback, setInputFeedback] = useState<{ text: string; isError: boolean } | null>(null);

  // 확정란 셀 선택 상태 (모바일 키패드/DNS/DNF 바용)
  const [activeCell, setActiveCell] = useState<{ id: string; roundKey: string } | null>(null);

  // 인증 게이트
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isRankConfirmed, setIsRankConfirmed] = useState(false);
  const [confirmedTime, setConfirmedTime] = useState<string | null>(null);

  // 시뮬레이션(사전 시연) 모드 및 대상 필터 상태
  // true: 홈페이지 공개/대진표 확정 전에도 서버 반영 없이 안전하게 순위 입력 시연 가능
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(true);
  // true: 아직 ERP에서 승인(APPROVED)되지 않은 접수 대기 참가자까지 모두 포함하여 시뮬레이션
  const [includePendingApplicants, setIncludePendingApplicants] = useState<boolean>(true);

  // 세션 확인 (이미 로그인된 경우 자동 인증)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('gentrophy_referee_token') : null;
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/auth/verify?role=referee', { 
          cache: 'no-store',
          headers
        });
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('심판 세션 확인 실패:', err);
      } finally {
        setAuthChecking(false);
      }
    };
    checkSession();
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput, role: 'referee', subdomain }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.token && typeof window !== 'undefined') {
          localStorage.setItem('gentrophy_referee_token', data.token);
        }
        setIsAuthenticated(true);
        setAuthError('');
        setPasswordInput('');
      } else {
        setAuthError(data.message || '비밀번호가 올바르지 않습니다.');
        setPasswordInput('');
      }
    } catch {
      setAuthError('서버 연결 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gentrophy_referee_token');
      }
      await fetch('/api/auth/verify', { method: 'DELETE' });
      setIsAuthenticated(false);
      setPasswordInput('');
    } catch (err) {
      console.error('로그아웃 오류:', err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [subdomain]);

  const fetchInitialData = async () => {
    try {
      const [tenantRes, formRes] = await Promise.all([
        fetch(`/api/tenant/${subdomain}`),
        fetch(`/api/tenant/${subdomain}/form-configs`)
      ]);
      
      const [tenantData, formData] = await Promise.all([
        tenantRes.json(),
        formRes.json()
      ]);

      if (formData.fields) {
        setFormFields(formData.fields);
      }

      if (tenantData.tenant) {
        setTenant(tenantData.tenant);
        // ERP에서 대진표가 이미 확정 공개된 상태라면 실전 모드를 기본으로, 확정 전이라면 시뮬레이션 모드를 기본으로 설정
        const bracketsPublished = !!tenantData.tenant.overviewConfig?.bracketsPublished;
        setIsSimulationMode(!bracketsPublished);

        const savedRule =
          (typeof window !== 'undefined' ? localStorage.getItem(`gentrophy_dns_dnf_rule_${subdomain}`) : null) ||
          tenantData.tenant.overviewConfig?.dnsDnfScoringRule;
        if (savedRule === 'FINISHER_PLUS_ONE' || savedRule === 'REGISTERED_PLUS_ONE') {
          setDnsDnfRule(savedRule);
        }

        const localTieRulesStr = typeof window !== 'undefined' ? localStorage.getItem(`gentrophy_tie_breaker_rules_${subdomain}`) : null;
        if (localTieRulesStr) {
          try {
            const parsedTieRules = JSON.parse(localTieRulesStr);
            if (Array.isArray(parsedTieRules) && parsedTieRules.length > 0) {
              setTieBreakerRules(parsedTieRules);
            }
          } catch (e) {}
        } else if (Array.isArray(tenantData.tenant.overviewConfig?.tieBreakerRules) && tenantData.tenant.overviewConfig.tieBreakerRules.length > 0) {
          setTieBreakerRules(tenantData.tenant.overviewConfig.tieBreakerRules);
        }

        const ongoing = tenantData.tenant.tournaments?.find((t: any) => t.status === 'ONGOING');
        if (ongoing) {
          setActiveTournament(ongoing);
          await fetchRegistrations(ongoing.id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async (tId: string) => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/registrations?tournamentId=${tId}&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.registrations) {
        // 거절(REJECTED)된 건만 제외하고 모든 신청자(APPROVED + PENDING)를 로드하여 대진표 확정/홈페이지 공개 전에도 시연 가능하도록 구성
        const parsed = data.registrations
          .filter((r: any) => r.status !== 'REJECTED')
          .map((r: any, idx: number) => {
            let birth = '';
            let gender = '남자';
            let club = '미소속';
            let division = '윈드포일';
            let subclass = '통합부';
            try {
              if (r.formResponses) {
                const extra = typeof r.formResponses === 'string' ? JSON.parse(r.formResponses) : r.formResponses;
                birth = extra.birth || extra.birthDate || '';
                gender = extra.gender || '남자';
                club = extra.club || '미소속';
                division = extra.division || '윈드포일';
                subclass = extra.subclass || extra.class || extra.category || extra.subDivision || '통합부';
              }
            } catch (e) {}

            const d = String(division).trim();
            const isFemale = d.includes('여자') || gender === '여자';
            const suffix = isFemale ? ' (여자부)' : ' (남자부)';
            if (d.includes('윈드포일')) {
              division = '윈드포일';
            } else if (!['윙포일 (남자부)', '윙포일 (여자부)', '혼합오픈 (남자부)', '혼합오픈 (여자부)', '펀엔포뮬러 (남자부)', '펀엔포뮬러 (여자부)'].includes(d)) {
              if (d.includes('윙포일')) division = `윙포일${suffix}`;
              else if (d.includes('혼합오픈')) division = `혼합오픈${suffix}`;
              else if (d.includes('펀엔포뮬러') || d.includes('펀&포뮬러')) division = `펀엔포뮬러${suffix}`;
              else division = d;
            } else {
              division = d;
            }

            const baseObj: any = {
              id: r.id,
              name: r.player?.name || '이름없음',
              birth,
              gender,
              club,
              division,
              subclass,
              regStatus: r.status || 'PENDING',
              // 배번이 아직 부여되지 않은 신청자도 시연할 수 있도록 가상 시연 배번 보조 제공 (원본 데이터는 수정하지 않음)
              bibNumber: r.bibNumber || String(idx + 1),
              hasRealBib: !!r.bibNumber,
              total: 0,
              rank: '-'
            };
            DEFAULT_ROUNDS.forEach(rd => {
              baseObj[rd.key] = null;
            });
            return baseObj;
          });

        // 혼합오픈 (남자부) 및 펀엔포뮬러 (남자부) 세부 클라스(청년부·중년부·장년부) 연령 1/3 균등분할 적용
        ['혼합오픈 (남자부)', '펀엔포뮬러 (남자부)'].forEach(targetDiv => {
          const divMalePlayers = parsed.filter((p: any) => p.division === targetDiv);
          const needsAutoSplit = divMalePlayers.length > 0 && divMalePlayers.every((p: any) => !p.subclass || p.subclass === '통합부');
          if (needsAutoSplit) {
            const sortedByBirth = [...divMalePlayers].sort((a: any, b: any) => {
              const bA = parseBirthNum(a.birth);
              const bB = parseBirthNum(b.birth);
              if (bA === 0 && bB === 0) return a.name.localeCompare(b.name, 'ko');
              if (bA === 0) return 1;
              if (bB === 0) return -1;
              if (bB !== bA) return bB - bA;
              return a.name.localeCompare(b.name, 'ko');
            });
            const total = sortedByBirth.length;
            const cut1 = Math.ceil(total / 3);
            const cut2 = Math.ceil((total * 2) / 3);
            sortedByBirth.forEach((p: any, idx: number) => {
              if (idx < cut1) p.subclass = '청년부';
              else if (idx < cut2) p.subclass = '중년부';
              else p.subclass = '장년부';
            });
          }
        });

        setRawRegistrations(parsed);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getRoundsStorageKey = (tId: string, div: string) => `gentrophy_rounds_${subdomain}_${tId}_${div}`;
  const getSimStorageKey = (tId: string, div: string) => `gentrophy_sim_scores_${subdomain}_${tId}_${div}`;
  const getRuleStorageKey = () => `gentrophy_dns_dnf_rule_${subdomain}`;

  // ── [DNS / DNF 및 등수 미입력 채점 핵심 산식] ──
  // 1) 특정 라운드가 진행(최소 1명 이상 기록 입력)되었는지 확인
  const isRoundConducted = (roundKey: string, list: any[]): boolean => {
    return list.some(p => p[roundKey] !== null && p[roundKey] !== undefined && p[roundKey] !== '');
  };

  // 2) 특정 라운드에서 실제로 결승선을 통과한(완주하여 숫자 등수가 부여된) 선수 수
  const getRoundFinishedCount = (roundKey: string, list: any[]): number => {
    return list.filter(p => {
      const val = p[roundKey];
      if (val === null || val === undefined || val === '' || val === 'DNS' || val === 'DNF') return false;
      const num = Number(val);
      return !isNaN(num) && num > 0;
    }).length;
  };

  // 3) 특정 라운드의 DNS 점수 산출 (출전 등록을 마친 전체 선수 인원 수 + 1점)
  const getDnsPenaltyScore = (list: any[]): number => {
    return list.length + 1;
  };

  // 4) 특정 라운드의 DNF 점수 산출
  // - FINISHER_PLUS_ONE: 해당 레이스에서 완주한 선수 수 + 1점 (예: 40명 중 35명 완주 시 36점)
  // - REGISTERED_PLUS_ONE: 출전 등록을 마친 전체 선수 인원 수 + 1점 (예: 40명 기준 41점)
  const getDnfPenaltyScore = (
    roundKey: string,
    list: any[],
    rule: DnsDnfScoringRule = dnsDnfRule
  ): number => {
    if (rule === 'REGISTERED_PLUS_ONE') {
      return list.length + 1;
    }
    const finishedCount = getRoundFinishedCount(roundKey, list);
    return finishedCount > 0 ? finishedCount + 1 : list.length + 1;
  };

  // 5) 개별 선수의 특정 라운드 환산 점수 반환 (등수 입력이 없는 경우 진행된 라운드에서는 모두 DNS로 간주)
  const getRoundScoreValue = (
    rawVal: any,
    roundKey: string,
    list: any[],
    rule: DnsDnfScoringRule = dnsDnfRule
  ): number | null => {
    if (!list || list.length === 0) return null;
    const conducted = isRoundConducted(roundKey, list);

    if (rawVal === null || rawVal === undefined || rawVal === '') {
      if (!conducted) return null;
      return getDnsPenaltyScore(list); // 미입력은 DNS로 간주: 전체 참가자 수 + 1점
    }

    if (rawVal === 'DNS') {
      return getDnsPenaltyScore(list); // 전체 참가자 수 + 1점
    }

    if (rawVal === 'DNF') {
      return getDnfPenaltyScore(roundKey, list, rule); // 규칙에 따라 (완주자 수 + 1점) 또는 (전체 참가자 수 + 1점)
    }

    const num = Number(rawVal);
    if (isNaN(num) || num <= 0) {
      return conducted ? getDnsPenaltyScore(list) : null;
    }
    return num;
  };

  // 6) 점수 및 총점 계산 (Sailing Low-point System)
  const calculateTotal = (
    row: any,
    list: any[],
    activeRoundsList: RoundItem[] = rounds,
    rule: DnsDnfScoringRule = dnsDnfRule
  ) => {
    if (!list || list.length === 0) return 0;
    const validScores = activeRoundsList
      .map(r => getRoundScoreValue(row[r.key], r.key, list, rule))
      .filter((val): val is number => val !== null);

    if (validScores.length === 0) return 0;

    const sum = validScores.reduce((acc, curr) => acc + curr, 0);
    if (validScores.length >= 4) {
      const maxVal = Math.max(...validScores);
      return sum - maxVal; // 가장 높은 점수(가장 성적이 나쁜 라운드 1개) 제외
    }
    return sum;
  };

  // 7) 전체 참가자의 총점을 일괄 재계산 (DNF 완주자 수 변동 및 미입력 DNS 간주 실시간 반영)
  const recalculateAllParticipants = (
    list: any[],
    activeRoundsList: RoundItem[] = rounds,
    rule: DnsDnfScoringRule = dnsDnfRule
  ) => {
    return list.map(p => ({
      ...p,
      total: calculateTotal(p, list, activeRoundsList, rule)
    }));
  };

  // 8) 진행된 라운드에서 등수 미입력(빈칸) 선수를 모두 'DNS'로 일괄 확정 변환
  const applyAutoDnsToConductedRounds = (
    list: any[],
    activeRoundsList: RoundItem[] = rounds,
    rule: DnsDnfScoringRule = dnsDnfRule,
    forceSelectedRoundIfNone: boolean = false
  ) => {
    const conductedKeys = activeRoundsList
      .filter(r => isRoundConducted(r.key, list))
      .map(r => r.key);

    if (conductedKeys.length === 0 && forceSelectedRoundIfNone && selectedRound) {
      conductedKeys.push(selectedRound);
    }

    const filled = list.map(p => {
      const next = { ...p };
      conductedKeys.forEach(rKey => {
        if (next[rKey] === null || next[rKey] === undefined || next[rKey] === '') {
          next[rKey] = 'DNS';
        }
      });
      return next;
    });

    return recalculateAllParticipants(filled, activeRoundsList, rule);
  };

  // 월드세일링 RRS(부록 A8) 기준 동점자 비교 함수
  // 우선순위: 1. 상대 전적 (Head-to-Head) -> 2. 상위 성적 횟수 비교 (Most Better Finishes) -> 3. 가장 최근 레이스 성적 비교 -> 4. 최하위 성적 제외 후 재산정 (Discard / Drop)
  const compareTiedSailingPlayers = (
    a: any,
    b: any,
    fullList: any[],
    roundsList: RoundItem[] = rounds,
    rule: DnsDnfScoringRule = dnsDnfRule
  ) => {
    if (a.total !== b.total) {
      return a.total - b.total;
    }

    const conductedRounds = roundsList.filter(r => isRoundConducted(r.key, fullList));
    const scoresA = conductedRounds
      .map(r => getRoundScoreValue(a[r.key], r.key, fullList, rule))
      .filter((v): v is number => v !== null);
    const scoresB = conductedRounds
      .map(r => getRoundScoreValue(b[r.key], r.key, fullList, rule))
      .filter((v): v is number => v !== null);

    const orderedRules = [...(tieBreakerRules.length > 0 ? tieBreakerRules : DEFAULT_SAILING_TIE_BREAKER_RULES)].sort(
      (x, y) => x.priority - y.priority
    );

    for (const r of orderedRules) {
      const cmp = evaluateSailingRule(r.ruleType, scoresA, scoresB);
      if (cmp !== 0) return cmp;
    }

    const birthA = (a.birth || '').replace(/[^0-9]/g, '');
    const birthB = (b.birth || '').replace(/[^0-9]/g, '');
    if (birthA && birthB && birthA !== birthB) {
      return birthA.localeCompare(birthB);
    }
    return 0;
  };

  // 참가자 목록을 월드세일링 규정에 맞춰 미입력 DNS 자동 반영, 총점 계산, 정렬 및 1, 2, 3... 순위 부여
  const sortAndRankParticipants = (
    list: any[],
    roundsList: RoundItem[] = rounds,
    rule: DnsDnfScoringRule = dnsDnfRule,
    forceSelectedRoundIfNone: boolean = false
  ) => {
    const withAutoDns = applyAutoDnsToConductedRounds(list, roundsList, rule, forceSelectedRoundIfNone);
    const sorted = [...withAutoDns].sort((a, b) => compareTiedSailingPlayers(a, b, withAutoDns, roundsList, rule));
    return sorted.map((p, idx) => ({
      ...p,
      rank: idx + 1
    }));
  };

  // DNS / DNF 채점 규칙 변경 핸들러
  const handleChangeDnsDnfRule = async (newRule: DnsDnfScoringRule) => {
    setDnsDnfRule(newRule);
    if (typeof window !== 'undefined') {
      localStorage.setItem(getRuleStorageKey(), newRule);
    }
    setParticipants(prev => {
      const hasScores = prev.some(p => rounds.some(r => p[r.key] !== null && p[r.key] !== undefined && p[r.key] !== ''));
      const updated = hasScores
        ? sortAndRankParticipants(prev, rounds, newRule, false)
        : recalculateAllParticipants(prev, rounds, newRule);
      if (isSimulationMode && typeof window !== 'undefined' && activeTournament) {
        localStorage.setItem(getSimStorageKey(activeTournament.id, activeDivisionTab), JSON.stringify(updated));
      }
      return updated;
    });
  };

  // 순위 확정란 탭 전환 시 진행된 라운드의 미입력자를 모두 DNS로 자동 간주 및 순위 재정렬/재부여
  const handleEnterConfirmMode = () => {
    setActiveMode('confirm');
    setParticipants(prev => {
      const hasScores = prev.some(p => rounds.some(r => p[r.key] !== null && p[r.key] !== undefined && p[r.key] !== ''));
      if (!hasScores) {
        return applyAutoDnsToConductedRounds(prev, rounds, dnsDnfRule, false);
      }
      const sorted = sortAndRankParticipants(prev, rounds, dnsDnfRule, false);
      if (isSimulationMode && typeof window !== 'undefined' && activeTournament) {
        localStorage.setItem(getSimStorageKey(activeTournament.id, activeDivisionTab), JSON.stringify(sorted));
      }
      return sorted;
    });
  };

  const persistRounds = async (tId: string, div: string, updatedRounds: RoundItem[], currentList?: any[], ruleOverride?: DnsDnfScoringRule) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(getRoundsStorageKey(tId, div), JSON.stringify(updatedRounds));
        if (isSimulationMode && currentList) {
          localStorage.setItem(getSimStorageKey(tId, div), JSON.stringify(currentList));
        }
      }
    } catch (e) {
      console.error('Failed to save rounds to localStorage:', e);
    }

    // 시뮬레이션 모드이거나 ERP에서 홈페이지 공개 확정(bracketsPublished) 전일 때는 서버 DB에 반영하지 않음!
    if (isSimulationMode || !tenant?.overviewConfig?.bracketsPublished) return;

    try {
      await fetch(`/api/tenant/${subdomain}/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tId,
          division: div,
          rounds: updatedRounds,
          list: currentList,
          dnsDnfRule: ruleOverride || dnsDnfRule
        })
      });
    } catch (e) {
      console.error('Failed to sync rounds to server:', e);
    }
  };

  const loadLeaderboardForDivision = async (tId: string, divisionName: string, baseRegistrations: any[]) => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/leaderboard?tournamentId=${tId}&division=${encodeURIComponent(divisionName)}&_t=${Date.now()}`);
      const data = await res.json();

      let activeRule: DnsDnfScoringRule = dnsDnfRule;
      const localRule = typeof window !== 'undefined' ? localStorage.getItem(getRuleStorageKey()) : null;
      if (data.dnsDnfRule === 'FINISHER_PLUS_ONE' || data.dnsDnfRule === 'REGISTERED_PLUS_ONE') {
        activeRule = data.dnsDnfRule;
        setDnsDnfRule(activeRule);
      } else if (localRule === 'FINISHER_PLUS_ONE' || localRule === 'REGISTERED_PLUS_ONE') {
        activeRule = localRule;
        setDnsDnfRule(activeRule);
      }

      // 1. 라운드 결정 우선순위:
      // (1) 서버에 명시적으로 저장된 data.rounds
      // (2) 로컬 스토리지에 캐시된 라운드 목록
      // (3) 저장된 리더보드 데이터에서 발견된 라운드 키들
      // (4) 단체전은 1회(DEFAULT_TEAM_ROUNDS), 개인전은 기본 6개 라운드 (DEFAULT_ROUNDS)
      let activeRounds: RoundItem[] = divisionName === '단체전'
        ? [...DEFAULT_TEAM_ROUNDS]
        : [...DEFAULT_ROUNDS];

      if (data.rounds && Array.isArray(data.rounds) && data.rounds.length > 0) {
        activeRounds = data.rounds;
      } else {
        const localRoundsStr = typeof window !== 'undefined' ? localStorage.getItem(getRoundsStorageKey(tId, divisionName)) : null;
        if (localRoundsStr) {
          try {
            const parsed = JSON.parse(localRoundsStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (divisionName === '단체전') {
                if ((parsed.length === 6 && parsed[5]?.key === 'r6') || parsed.some((r: any) => r.short === '1회')) {
                  activeRounds = [...DEFAULT_TEAM_ROUNDS];
                  localStorage.setItem(getRoundsStorageKey(tId, divisionName), JSON.stringify(activeRounds));
                } else {
                  activeRounds = parsed;
                }
              } else if (parsed.length === 6 && parsed[0]?.key === 'r1' && parsed[5]?.key === 'r6') {
                // 이전 기본값 6개 라운드가 남아있는 경우 기본 1~5개 라운드로 자동 마이그레이션
                activeRounds = [...DEFAULT_ROUNDS];
                localStorage.setItem(getRoundsStorageKey(tId, divisionName), JSON.stringify(activeRounds));
              } else {
                activeRounds = parsed;
              }
            }
          } catch (e) {}
        } else if (data.leaderboard && data.leaderboard.length > 0) {
          const discoveredRoundKeys = new Set<string>();
          data.leaderboard.forEach((item: any) => {
            Object.keys(item).forEach(k => {
              if (/^r\d+$/.test(k)) {
                discoveredRoundKeys.add(k);
              }
            });
          });

          if (discoveredRoundKeys.size > 0) {
            const sortedKeys = Array.from(discoveredRoundKeys).sort((a, b) => {
              const numA = parseInt(a.replace('r', ''), 10);
              const numB = parseInt(b.replace('r', ''), 10);
              return numA - numB;
            });
            activeRounds = sortedKeys.map(k => {
              const num = parseInt(k.replace('r', ''), 10);
              return {
                key: k,
                label: `${num}라운드 (${num}R)`,
                short: `${num}R`
              };
            });
          }
        }
      }

      if (!activeRounds || activeRounds.length === 0) {
        activeRounds = divisionName === '단체전' ? [...DEFAULT_TEAM_ROUNDS] : [...DEFAULT_ROUNDS];
      }
      if (divisionName === '단체전' && !activeRounds.some(r => r.key === 'r1')) {
        activeRounds.unshift({ key: 'r1', label: '1라운드 (1R)', short: '1R' });
      }

      setRounds(activeRounds);

      // 선택된 라운드가 activeRounds에 없으면 첫 라운드로 안전하게 변경
      setSelectedRound(prev => {
        if (activeRounds.some(r => r.key === prev)) return prev;
        return activeRounds[0]?.key || 'r1';
      });

      let sourceList: any[] = [];
      if (isSimulationMode && typeof window !== 'undefined') {
        const simSavedStr = localStorage.getItem(getSimStorageKey(tId, divisionName));
        if (simSavedStr) {
          try {
            const parsedSim = JSON.parse(simSavedStr);
            if (Array.isArray(parsedSim) && parsedSim.length > 0) {
              sourceList = parsedSim;
            }
          } catch (e) {}
        }
      }
      if (sourceList.length === 0 && data.leaderboard && data.leaderboard.length > 0) {
        sourceList = data.leaderboard;
      }

      if (sourceList.length > 0) {
        const parseSavedRoundVal = (val: any) => {
          if (val === undefined || val === null || val === '') return null;
          if (val === 'DNS' || val === 'DNF') return val;
          const num = Number(val);
          return isNaN(num) ? null : num;
        };

        let preliminary: any[] = [];
        if (divisionName === '단체전') {
          preliminary = sourceList.map((team: any, idx: number) => {
            const updated = { ...team };
            if (!updated.id) updated.id = `team_${idx + 1}`;
            if (!updated.name) updated.name = team.club || `팀 ${idx + 1}`;
            if (!updated.club) updated.club = updated.name;
            if (!updated.bibNumber) updated.bibNumber = `T${idx + 1}`;
            activeRounds.forEach(r => {
              updated[r.key] = parseSavedRoundVal(team[r.key]);
            });
            return updated;
          });
        } else {
          preliminary = baseRegistrations.map((player) => {
            const savedRow = sourceList.find((lItem: any) => lItem.id === player.id || lItem.name === player.name);
            const updated: any = { ...player };
            if (savedRow) {
              updated.bibNumber = savedRow.bibNumber || player.bibNumber;
              updated.rank = savedRow.rank || '-';
              if (savedRow.subclass && savedRow.subclass !== '통합부') {
                updated.subclass = savedRow.subclass;
              }
              activeRounds.forEach(r => {
                updated[r.key] = parseSavedRoundVal(savedRow[r.key]);
              });
            } else {
              activeRounds.forEach(r => {
                updated[r.key] = null;
              });
            }
            return updated;
          });
        }

        const hasScores = preliminary.some(p => activeRounds.some(r => p[r.key] !== null && p[r.key] !== undefined && p[r.key] !== ''));
        let mapped = preliminary;
        if (hasScores) {
          mapped = sortAndRankParticipants(preliminary, activeRounds, activeRule, false);
          if (data.isConfirmed !== false || isSimulationMode) {
            setIsRankConfirmed(true);
            if (data.updatedAt) {
              setConfirmedTime(new Date(data.updatedAt).toLocaleString('ko-KR'));
            }
          } else {
            setIsRankConfirmed(false);
            setConfirmedTime(null);
          }
        } else {
          mapped = recalculateAllParticipants(preliminary, activeRounds, activeRule);
          mapped.sort((a, b) => {
            if (a.rank === '-' && b.rank !== '-') return 1;
            if (a.rank !== '-' && b.rank === '-') return -1;
            if (a.rank === '-' && b.rank === '-') return 0;
            return Number(a.rank) - Number(b.rank);
          });
          setIsRankConfirmed(false);
          setConfirmedTime(null);
        }
        setParticipants(mapped);
      } else {
        const initialized = baseRegistrations.map(p => {
          const obj: any = { ...p };
          activeRounds.forEach(r => { obj[r.key] = null; });
          obj.total = 0;
          obj.rank = '-';
          return obj;
        });
        setParticipants(initialized);
      }
    } catch (e) {
      console.error(e);
      setParticipants(baseRegistrations);
    }
  };

  useEffect(() => {
    if (!activeTournament) {
      setParticipants([]);
      return;
    }

    if (activeDivisionTab === '단체전') {
      const teamStorageKey = `gentrophy_${activeTournament.id}_teams_단체전`;
      let defaultTeams: any[] = [];
      if (typeof window !== 'undefined') {
        const savedTeamsStr = localStorage.getItem(teamStorageKey);
        if (savedTeamsStr) {
          try {
            const parsed = JSON.parse(savedTeamsStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const isOldDummyTeams = parsed.length === 4 && parsed.every((t: any, idx: number) =>
                t.id === `team_${idx + 1}` && ['통영윈드서핑클럽', '거제요트클럽', '부산세일링클럽', '창원윈드클럽'].includes(t.name)
              );
              if (!isOldDummyTeams) {
                defaultTeams = parsed;
              } else {
                localStorage.removeItem(teamStorageKey);
                localStorage.removeItem(getSimStorageKey(activeTournament.id, '단체전'));
              }
            }
          } catch (e) {}
        }
      }

      // 단체전 예시 더미 팀 완전 제거: 운영진이 직접 추가한 팀들만 나열
      loadLeaderboardForDivision(activeTournament.id, '단체전', defaultTeams);
      setSelectedSubclassTab('all');
      setCurrentRankNum(1);
      setBibInput('');
      setInputFeedback(null);
      setIsRankConfirmed(false);
      return;
    }

    if (rawRegistrations.length > 0) {
      const filteredBase = rawRegistrations.filter(r => {
        if (!includePendingApplicants && r.regStatus !== 'APPROVED') {
          return false;
        }
        if (activeDivisionTab === '윈드포일') {
          return r.division === '윈드포일' || (r.division && r.division.includes('윈드포일'));
        }
        return r.division === activeDivisionTab;
      });
      loadLeaderboardForDivision(activeTournament.id, activeDivisionTab, filteredBase);
      setSelectedSubclassTab('all');
      setCurrentRankNum(1);
      setBibInput('');
      setInputFeedback(null);
      setIsRankConfirmed(false);
    } else {
      setParticipants([]);
    }
  }, [activeDivisionTab, rawRegistrations, activeTournament, includePendingApplicants, isSimulationMode]);

  // ── [단체전 전용: 출전 팀 추가 및 삭제 핸들러] ──
  const handleAddTeamFromClub = (clubOrTeamName: string) => {
    const trimmed = clubOrTeamName.trim();
    if (!trimmed) return;

    // 이미 같은 이름/클럽의 팀이 몇 개 있는지 확인
    const sameClubCount = participants.filter(p => p.club === trimmed || p.name.startsWith(trimmed)).length;
    const finalTeamName = sameClubCount > 0 ? `${trimmed} ${sameClubCount + 1}팀` : trimmed;
    const nextBib = `T${participants.length + 1}`;
    const newTeam: any = {
      id: `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: finalTeamName,
      club: trimmed,
      bibNumber: nextBib,
      birth: '단체팀',
      division: '단체전',
      total: 0,
      rank: '-'
    };
    rounds.forEach(r => {
      newTeam[r.key] = null;
    });

    const updated = [...participants, newTeam];
    const recalculated = recalculateAllParticipants(updated, rounds, dnsDnfRule);
    setParticipants(recalculated);

    if (activeTournament) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`gentrophy_${activeTournament.id}_teams_단체전`, JSON.stringify(recalculated));
        if (isSimulationMode) {
          localStorage.setItem(getSimStorageKey(activeTournament.id, '단체전'), JSON.stringify(recalculated));
        }
      }
    }

    setInputFeedback({
      text: `✨ [${finalTeamName}] 팀이 출전 목록에 추가되었습니다! (현재 출전: 총 ${updated.length}개 팀)`,
      isError: false
    });
  };

  const handleDeleteTeam = (teamId: string, teamName: string) => {
    if (!window.confirm(`정말 [${teamName}] 팀을 출전 목록에서 제외하시겠습니까?`)) {
      return;
    }

    const updated = participants.filter(p => p.id !== teamId);
    const recalculated = recalculateAllParticipants(updated, rounds, dnsDnfRule);
    setParticipants(recalculated);

    if (activeTournament) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`gentrophy_${activeTournament.id}_teams_단체전`, JSON.stringify(recalculated));
        if (isSimulationMode) {
          localStorage.setItem(getSimStorageKey(activeTournament.id, '단체전'), JSON.stringify(recalculated));
        }
      }
    }

    setInputFeedback({
      text: `🗑️ [${teamName}] 팀이 출전 목록에서 제외되었습니다. (현재 출전: 총 ${updated.length}개 팀)`,
      isError: false
    });
  };

  // ── [순위 및 점수 전체 초기화 핸들러 (확정 공개 이후에도 언제든 초기화 가능)] ──
  const handleResetRankings = async () => {
    if (!activeTournament) return;

    const isConfirmedNotice = isRankConfirmed
      ? `\n\n⚠️ 주의: 현재 [${activeDivisionTab}] 종목은 공식 확정 및 공개된 상태입니다.\n초기화 시 홈페이지 실시간 리더보드의 순위 데이터도 함께 초기화(미입력 상태)로 변경됩니다.`
      : '';

    const confirmMsg =
      `[${activeDivisionTab}] 종목의 모든 입력된 순위와 점수를 초기화하시겠습니까?` +
      isConfirmedNotice +
      `\n\n• 팀/선수 목록은 그대로 유지되며, 라운드 점수와 순위만 1위부터 다시 입력할 수 있도록 초기화됩니다.` +
      `\n• 계속 진행하시려면 [확인]을 눌러주세요.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    const defaultRounds = activeDivisionTab === '단체전' ? [...DEFAULT_TEAM_ROUNDS] : [...DEFAULT_ROUNDS];

    // 1. 로컬스토리지 캐시 초기화
    if (typeof window !== 'undefined') {
      localStorage.removeItem(getSimStorageKey(activeTournament.id, activeDivisionTab));
      localStorage.removeItem(getRoundsStorageKey(activeTournament.id, activeDivisionTab));
    }

    // 2. 참가자(팀) 목록의 라운드 점수와 총점, 순위를 초기 상태로 리셋
    const resetParticipants = participants.map(p => {
      const next: any = { ...p, total: 0, rank: '-' };
      Object.keys(next).forEach(k => {
        if (/^r\d+$/.test(k)) delete next[k];
      });
      defaultRounds.forEach(r => { next[r.key] = null; });
      return next;
    });

    setRounds(defaultRounds);
    setSelectedRound('r1');
    setParticipants(resetParticipants);
    setCurrentRankNum(1);
    setBibInput('');
    setIsRankConfirmed(false);
    setConfirmedTime(null);

    // 3. 실전 모드이거나 홈페이지 공개 상태인 경우 서버 DB(Firestore)에도 초기화 동기화 반영
    if (!isSimulationMode && tenant?.overviewConfig?.bracketsPublished) {
      setSubmitting(true);
      try {
        const res = await fetch(`/api/tenant/${subdomain}/leaderboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tournamentId: activeTournament.id,
            division: activeDivisionTab,
            rounds: defaultRounds,
            list: resetParticipants,
            dnsDnfRule: dnsDnfRule,
            isReset: true
          })
        });
        if (res.ok) {
          logAnalyticsEvent('referee_reset_leaderboard', { division: activeDivisionTab });
          alert(`✅ [${activeDivisionTab}] 순위 및 점수가 성공적으로 초기화되었습니다.\n홈페이지 실시간 리더보드에도 초기화가 즉시 반영되었습니다.`);
        } else {
          const err = await res.json();
          alert(err.error || '서버 초기화 중 오류가 발생했습니다.');
        }
      } catch (e: any) {
        alert('서버 초기화 통신 오류: ' + e.message);
      } finally {
        setSubmitting(false);
      }
    } else {
      logAnalyticsEvent('referee_reset_leaderboard', { division: activeDivisionTab, isSimulation: isSimulationMode });
      alert(`🧹 [${activeDivisionTab}] 점수와 순위가 초기화되었습니다.\n1위부터 새로 순위 입력을 진행하실 수 있습니다.`);
    }

    setInputFeedback({
      text: `🧹 [${activeDivisionTab}] 점수와 순위가 초기화되었습니다. 새로 입력을 시작해 주세요.`,
      isError: false
    });
  };

  // ── [동적 라운드 추가 / 삭제 핸들러] ──
  // 라운드 추가 (+1R) - 선택된 종목에만 적용 및 기억
  const handleAddRound = () => {
    const nextNum = rounds.length + 1;
    const newKey = `r${nextNum}`;
    const newRound: RoundItem = {
      key: newKey,
      label: `${nextNum}라운드 (${nextNum}R)`,
      short: `${nextNum}R`
    };
    const updatedRounds = [...rounds, newRound];
    setRounds(updatedRounds);

    const updatedParticipants = recalculateAllParticipants(
      participants.map(p => ({
        ...p,
        [newKey]: null
      })),
      updatedRounds,
      dnsDnfRule
    );
    setParticipants(updatedParticipants);
    setSelectedRound(newKey);
    setCurrentRankNum(1);
    setInputFeedback({ text: `✨ [${activeDivisionTab}] 종목에 [${newRound.short}] 라운드가 추가되었습니다!`, isError: false });

    if (activeTournament) {
      persistRounds(activeTournament.id, activeDivisionTab, updatedRounds, updatedParticipants);
    }
  };

  // 항상 마지막 라운드만 삭제 가능하도록 설정 (선택된 종목에만 적용 및 기억)
  const handleDeleteRound = () => {
    if (rounds.length <= 1) {
      alert('최소 1개 이상의 라운드가 유지되어야 합니다.');
      return;
    }

    const lastRound = rounds[rounds.length - 1];
    const targetKey = lastRound.key;
    const targetName = lastRound.short;

    const confirmed = window.confirm(
      `정말 [${activeDivisionTab}] 종목의 마지막 라운드 [${targetName}]를 삭제하시겠습니까?\n해당 라운드에 입력된 모든 선수의 순위 및 점수가 영구 삭제됩니다.`
    );
    if (!confirmed) return;

    const updatedRounds = rounds.slice(0, -1);
    setRounds(updatedRounds);

    const strippedList = participants.map(p => {
      const updated = { ...p };
      delete updated[targetKey];
      return updated;
    });
    const updatedParticipants = recalculateAllParticipants(strippedList, updatedRounds, dnsDnfRule);
    setParticipants(updatedParticipants);

    if (selectedRound === targetKey) {
      setSelectedRound(updatedRounds[updatedRounds.length - 1].key);
      setCurrentRankNum(1);
    }
    setInputFeedback({ text: `🗑️ [${activeDivisionTab}] 종목의 마지막 라운드 [${targetName}]가 삭제되었습니다.`, isError: false });

    if (activeTournament) {
      persistRounds(activeTournament.id, activeDivisionTab, updatedRounds, updatedParticipants);
    }
  };

  // 현재 라운드 전체 순위 초기화(전체 삭제)
  const handleResetRoundScores = () => {
    const targetRound = rounds.find(r => r.key === selectedRound);
    const targetName = targetRound ? targetRound.short : selectedRound;

    const confirmed = window.confirm(
      `정말 [${targetName}] 라운드의 모든 순위 입력을 초기화(전체 삭제)하시겠습니까?`
    );
    if (!confirmed) return;

    setParticipants(prev => {
      const resetList = prev.map(p => ({ ...p, [selectedRound]: null }));
      return recalculateAllParticipants(resetList, rounds, dnsDnfRule);
    });
    setCurrentRankNum(1);
    setBibInput('');
    setInputFeedback({ text: `🧹 [${targetName}] 라운드의 모든 순위가 초기화되었습니다.`, isError: false });
  };

  // 개별 셀 점수 직접 입력 핸들러 (확정란 그리드 수정용)
  const handleScoreInput = (id: string, roundKey: string, valString: string) => {
    let raw = valString.trim().toUpperCase();
    // 기존에 DNS 또는 DNF가 적혀있던 셀에 바로 숫자를 타이핑한 경우(예: 'DNS3', '3DNS') 숫자만 추출
    if ((raw.includes('DNS') || raw.includes('DNF')) && /\d+/.test(raw)) {
      raw = raw.replace(/[^0-9]/g, '');
    }

    let val: any = raw;
    if (val === '') {
      val = null;
    } else if (val === 'DNS' || val === 'DNF') {
      // DNS / DNF 유지
    } else {
      const num = Number(val);
      val = isNaN(num) || num <= 0 ? null : num;
    }

    setParticipants(prev => {
      const nextList = prev.map(p => (p.id === id ? { ...p, [roundKey]: val } : p));
      // 완주자 수(DNF 점수 기준)나 라운드 진행 여부가 달라질 수 있으므로 전체 참가자 총점을 일괄 재계산
      return recalculateAllParticipants(nextList, rounds, dnsDnfRule);
    });
  };

  // 확정란 셀 포커스 해제 시: 해당 라운드가 진행된 라운드이고 입력값이 비어있다면 자동으로 'DNS'로 채움
  const handleScoreCellBlur = (id: string, roundKey: string) => {
    setParticipants(prev => {
      if (!isRoundConducted(roundKey, prev)) return prev;
      const target = prev.find(p => p.id === id);
      if (target && (target[roundKey] === null || target[roundKey] === undefined || target[roundKey] === '')) {
        const nextList = prev.map(p => (p.id === id ? { ...p, [roundKey]: 'DNS' } : p));
        return recalculateAllParticipants(nextList, rounds, dnsDnfRule);
      }
      return prev;
    });
  };

  // ── [순위 입력란 전용 로직] ──
  // 특정 선수에게 특정 라운드의 순위(점수) 부여
  const assignRankToPlayer = (playerId: string, roundKey: string, scoreOrRank: number | 'DNS' | 'DNF' | null) => {
    setParticipants(prev => {
      const nextList = prev.map(p => {
        if (p.id === playerId) {
          return { ...p, [roundKey]: scoreOrRank };
        }
        // 만약 다른 선수가 이미 해당 순위 번호를 가지고 있었다면 해제 (중복 방지)
        if (typeof scoreOrRank === 'number' && p[roundKey] === scoreOrRank) {
          return { ...p, [roundKey]: null };
        }
        return p;
      });
      return recalculateAllParticipants(nextList, rounds, dnsDnfRule);
    });
  };

  // 배번(티넘버) 스마트 매칭 도우미 (색상별 1~50번 체계 완벽 호환)
  const isSmartBibMatch = (pBib?: string, pName?: string, query?: string) => {
    if (!query) return false;
    const q = query.trim().toLowerCase();
    if (pName && pName.trim().toLowerCase() === q) return true;
    if (!pBib) return false;

    const b = pBib.trim().toLowerCase();
    if (b === q) return true;

    // 정규화: 공백 제거, '번' 제거, 색상 명칭 단축 통일
    const normalize = (s: string) =>
      s
        .replace(/\s+/g, '')
        .replace(/번$/, '')
        .replace(/^오렌지|^주황|^오/, '주')
        .replace(/^연두/, '연')
        .replace(/^흰색/, '흰');

    const normB = normalize(b);
    const normQ = normalize(q);
    if (normB === normQ) return true;

    // 심판이 숫자만 입력했을 때 매칭 (예: '5' 입력 시 '흰5' 또는 '흰색 5번' 매칭)
    const bDigits = b.replace(/[^0-9]/g, '');
    const qDigits = q.replace(/[^0-9]/g, '');
    if (q === qDigits && bDigits === qDigits && qDigits.length > 0) {
      return true;
    }

    return false;
  };

  // 배번(티넘버)으로 현재 순위 배정 후 다음 순위로 자동 이동
  const handleAssignBibSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanBib = bibInput.trim();
    if (!cleanBib) {
      setInputFeedback({ text: '배번(티넘버) 또는 선수 이름을 입력해주세요.', isError: true });
      return;
    }

    const matched = participants.find(
      p => isSmartBibMatch(p.bibNumber, p.name, cleanBib)
    );

    if (matched) {
      assignRankToPlayer(matched.id, selectedRound, currentRankNum);
      setInputFeedback({
        text: `✅ ${currentRankNum}위에 '${matched.name}' 선수(배번 ${matched.bibNumber || cleanBib})가 등록되었습니다!`,
        isError: false,
      });
      setBibInput('');

      // 다음 순위 칸으로 자동 전진
      if (currentRankNum < participants.length) {
        setCurrentRankNum(prev => prev + 1);
      }
    } else {
      setInputFeedback({
        text: `⚠️ '${cleanBib}'에 일치하는 선수가 없습니다. 등록된 배번인지 확인해주세요.`,
        isError: true,
      });
    }
  };

  // 미배정 선수 칩 터치 시 즉시 현재 순위 배정 후 다음 순위로 전진
  const handleQuickAssignPlayer = (player: any) => {
    assignRankToPlayer(player.id, selectedRound, currentRankNum);
    setInputFeedback({
      text: `✅ ${currentRankNum}위에 '${player.name}' 선수가 등록되었습니다!`,
      isError: false,
    });
    setBibInput('');
    if (currentRankNum < participants.length) {
      setCurrentRankNum(prev => prev + 1);
    }
  };

  // 특정 순위 비우기 (삭제)
  const handleClearCurrentRank = (rankNum: number) => {
    const holder = participants.find(p => p[selectedRound] === rankNum);
    if (holder) {
      assignRankToPlayer(holder.id, selectedRound, null);
      setInputFeedback({ text: `🗑️ ${rankNum}위 '${holder.name}' 선수 배정이 취소(삭제)되었습니다.`, isError: false });
    }
  };

  // 특정 선수 DNS / DNF 처리
  const handleSetPlayerSpecialScore = (playerId: string, code: 'DNS' | 'DNF') => {
    const p = participants.find(item => item.id === playerId);
    if (p) {
      assignRankToPlayer(playerId, selectedRound, code);
      setInputFeedback({ text: `⚠️ '${p.name}' 선수가 ${code}로 처리되었습니다.`, isError: false });
    }
  };

  // 앞/뒤 버튼으로 순위 칸 이동
  const handlePrevRank = () => {
    setCurrentRankNum(prev => Math.max(1, prev - 1));
    setInputFeedback(null);
  };

  const handleNextRank = () => {
    setCurrentRankNum(prev => Math.min(Math.max(1, participants.length), prev + 1));
    setInputFeedback(null);
  };

  // 순위 자동 정렬 (등수 미입력자는 모두 DNS로 간주하여 DNS/DNF 벌점 규정을 합산한 총점 오름차순 정렬 + 월드세일링 RRS 동점자 규정 적용)
  const handleSortRankings = () => {
    // 1. 진행된 모든 라운드에서 등수 미입력(null/'') 선수를 모두 'DNS'로 일괄 확정하고 총점 및 공식 순위 재산정
    const ranked = sortAndRankParticipants(participants, rounds, dnsDnfRule, true);

    setParticipants(ranked);
    if (isSimulationMode && typeof window !== 'undefined' && activeTournament) {
      localStorage.setItem(getSimStorageKey(activeTournament.id, activeDivisionTab), JSON.stringify(ranked));
    }

    const dnsPts = getDnsPenaltyScore(ranked);
    const ruleDesc =
      dnsDnfRule === 'REGISTERED_PLUS_ONE'
        ? `DNS·DNF 모두 참가신청자(${ranked.length}명) + 1점 = ${dnsPts}점`
        : `DNS = 참가신청자(${ranked.length}명) + 1점(${dnsPts}점) / DNF = 라운드별 완주자 수 + 1점`;

    alert(
      (isSimulationMode
        ? '🧪 [시뮬레이션] 미입력자 DNS 자동 처리 및 총점 순위 산정이 완료되었습니다!\n\n'
        : '✅ 미입력자 DNS 자동 처리 및 공식 순위 산정이 완료되었습니다!\n\n') +
      `• 적용 규칙: ${ruleDesc}\n` +
      '• 동점자 처리: 월드세일링 RRS(상대 전적 → 상위 성적 횟수 → 최근 레이스 → 최하위 성적 제외) 우선순위 적용\n' +
      '• 등수 미입력 선수는 모두 DNS로 간주되어 총점에 합산되었습니다.'
    );
  };

  // 최종 리더보드 서버 저장 또는 시뮬레이션 확정
  const handleConfirmLeaderboard = async () => {
    logAnalyticsEvent('referee_confirm_leaderboard', { division: activeDivisionTab, isSimulation: isSimulationMode });

    // 확정 시에도 등수 미입력자는 모두 DNS로 변환 및 총점/순위 재계산 보장
    const sorted = sortAndRankParticipants(participants, rounds, dnsDnfRule, false);

    setParticipants(sorted);

    if (isSimulationMode || !tenant?.overviewConfig?.bracketsPublished) {
      if (typeof window !== 'undefined' && activeTournament) {
        localStorage.setItem(getSimStorageKey(activeTournament.id, activeDivisionTab), JSON.stringify(sorted));
      }
      setIsRankConfirmed(true);
      setConfirmedTime(new Date().toLocaleString('ko-KR') + ' (시뮬레이션 시연)');
      alert(
        '🧪 [시뮬레이션 확정 완료]\n\n' +
        '• 등수 미입력자는 모두 DNS로 간주되어 설정된 DNS/DNF 벌점 규정이 총점에 반영되었습니다.\n' +
        '• 홈페이지 실시간 리더보드 및 대진표, 참가자 원본 데이터에는 전혀 영향을 주지 않고 심판 제어기 내에서만 안전하게 확정 시연되었습니다.\n' +
        '• [공식 순위표 인쇄] 버튼을 눌러 A4 결과 보고서 출력까지 그대로 테스트해 보실 수 있습니다.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: activeTournament.id,
          division: activeDivisionTab,
          rounds: rounds,
          list: sorted,
          dnsDnfRule: dnsDnfRule
        })
      });
      if (res.ok) {
        setIsRankConfirmed(true);
        setConfirmedTime(new Date().toLocaleString('ko-KR'));
        alert('순위가 공식 확정되었으며 홈페이지 실시간 리더보드에 즉시 반영되었습니다!\n\n[공식 순위표 인쇄] 버튼을 눌러 A4 규격 공식 결과표로 인쇄하거나 PDF로 저장하실 수 있습니다.');
      } else {
        const err = await res.json();
        alert(err.error || '저장 실패');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 공식 순위표 인쇄
  const handlePrintRankings = () => {
    // 인쇄 직전 순위 및 DNS 벌점을 최신화하여 화면 및 인쇄 상태 동기화
    const sorted = sortAndRankParticipants(participants, rounds, dnsDnfRule, false);
    setParticipants(sorted);
    if (isSimulationMode && typeof window !== 'undefined' && activeTournament) {
      localStorage.setItem(getSimStorageKey(activeTournament.id, activeDivisionTab), JSON.stringify(sorted));
    }
    logAnalyticsEvent('referee_print_document', { division: activeDivisionTab });
    window.print();
  };

  // 인증 게이트 UI
  if (authChecking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <RefreshCw className="animate-spin" size={36} style={{ color: '#3b82f6' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px', padding: '48px 40px', width: '100%', maxWidth: '380px',
          textAlign: 'center', backdropFilter: 'blur(20px)',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚖️</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white', marginBottom: '6px' }}>심판 모바일 제어기</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginBottom: '28px' }}>
            심판 인증 번호 또는 주최자 비밀번호를 입력해 주세요
          </p>
          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{
                width: '100%', background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
                padding: '14px 16px', color: 'white', fontSize: '1rem',
                outline: 'none', textAlign: 'center', letterSpacing: '0.25em',
                boxSizing: 'border-box',
              }}
              autoFocus
            />
            {authError && (
              <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '0' }}>⚠️ {authError}</p>
            )}
            <button
              type="submit"
              style={{
                width: '100%', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white', border: 'none', borderRadius: '12px',
                padding: '14px', fontSize: '0.95rem', fontWeight: '800',
                cursor: 'pointer', marginTop: '6px',
              }}
            >
              입력기 잠금 해제
            </button>
            <a
              href={typeof window !== 'undefined' && window.location.pathname.startsWith('/tenant/') ? `/tenant/${subdomain}` : '/'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.85rem',
                textDecoration: 'none',
                marginTop: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.2s',
              }}
            >
              <Home size={15} /> 대회 홈페이지로 이동
            </a>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <RefreshCw className="animate-spin" size={48} style={{ color: 'var(--theme-primary)' }} />
      </div>
    );
  }

  if (!tenant || !activeTournament) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', color: '#EF4444' }}>관리 대상 채널 또는 진행 중인 대회가 없습니다.</h2>
        <a
          href={typeof window !== 'undefined' && window.location.pathname.startsWith('/tenant/') ? `/tenant/${subdomain}` : '/'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '20px',
            padding: '10px 18px',
            borderRadius: '8px',
            background: '#3b82f6',
            color: 'white',
            textDecoration: 'none',
            fontWeight: '600'
          }}
        >
          <Home size={16} /> 대회 홈페이지로 이동
        </a>
      </div>
    );
  }

  const themeStyles = {
    '--theme-primary': tenant.primaryColor,
    '--theme-primary-hover': tenant.primaryColor + 'cc',
    '--theme-primary-rgb': '99, 102, 241',
  } as React.CSSProperties;

  // 종목 옵션 목록 추출 (윈드포일은 남녀 구분 없는 단일 종목으로 정규화)
  const normalizeDivName = (name: string) => {
    if (!name) return '';
    const trimmed = name.trim();
    if (trimmed.includes('윈드포일')) return '윈드포일';
    return trimmed;
  };

  const divisionField = formFields.find((f: any) => f.id === 'division');
  const configuredDivisions = (divisionField?.options || []).map(normalizeDivName);
  const registeredDivisions = rawRegistrations.map((r: any) => normalizeDivName(r.division)).filter(Boolean);
  
  const rawUnique = Array.from(new Set([...configuredDivisions, ...registeredDivisions])).filter(Boolean);
  const standardDivisions = [
    '윈드포일',
    '윙포일 (남자부)',
    '윙포일 (여자부)',
    '혼합오픈 (남자부)',
    '혼합오픈 (여자부)',
    '펀엔포뮬러 (남자부)',
    '펀엔포뮬러 (여자부)',
    '단체전'
  ];

  const divisionTabs = standardDivisions.filter(d => rawUnique.includes(d) || rawUnique.length === 0);
  rawUnique.forEach(d => {
    if (!divisionTabs.includes(d)) divisionTabs.push(d);
  });
  if (divisionTabs.length === 0) {
    divisionTabs.push(...standardDivisions);
  }
  if (!divisionTabs.includes('단체전')) {
    divisionTabs.push('단체전');
  }

  // 단체전 출전 클럽 후보군
  const registeredClubsList = Array.from(
    new Set([
      ...rawRegistrations.map((r: any) => r.club?.trim()).filter(Boolean),
      '통영윈드서핑클럽',
      '거제요트클럽',
      '부산세일링클럽',
      '창원윈드클럽',
      '서울세일링협회'
    ])
  ) as string[];

  // 선택된 라운드 기준 참가자 데이터 집계
  const currentRankPlayer = participants.find(p => p[selectedRound] === currentRankNum);
  const matchedTypingPlayer = bibInput.trim()
    ? participants.find(
        p => isSmartBibMatch(p.bibNumber, p.name, bibInput.trim())
      )
    : null;

  const unassignedPlayers = participants.filter(
    p => p[selectedRound] === null || p[selectedRound] === undefined || p[selectedRound] === ''
  );
  const dnsDnfPlayers = participants.filter(
    p => p[selectedRound] === 'DNS' || p[selectedRound] === 'DNF'
  );

  return (
    <div style={themeStyles} className="animate-fade-in">
      {/* ── 심판 전용 헤더 ── */}
      <header
        className="no-print"
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(10px)',
          color: 'white'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'var(--theme-primary)', padding: '6px', borderRadius: '8px', display: 'flex' }}>
            <Trophy size={18} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>심판 모바일 제어기</h1>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>{tenant.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: '700',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            로그아웃
          </button>
          <a
            href={typeof window !== 'undefined' && window.location.pathname.startsWith('/tenant/') ? `/tenant/${subdomain}` : '/'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'white',
              color: '#1e293b',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '700',
              textDecoration: 'none',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            <Home size={15} /> 홈페이지
          </a>
        </div>
      </header>

      <div className="no-print referee-screen-content referee-screen-ui" style={{ maxWidth: '850px', margin: '0 auto', padding: '16px 12px 60px 12px' }}>

        {/* ── [0] 시뮬레이션(사전 시연) 모드 & 실전 모드 전환 제어 배너 ── */}
        <div
          style={{
            background: isSimulationMode
              ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
              : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            border: isSimulationMode ? '2px solid #f59e0b' : '2px solid #10b981',
            borderRadius: '16px',
            padding: '14px 16px',
            marginBottom: '16px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
            color: '#0f172a'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: isSimulationMode ? '#d97706' : '#059669',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: '900',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {isSimulationMode ? '🧪 시뮬레이션(사전 시연) 모드' : '🟢 실전 홈페이지 연동 모드'}
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: isSimulationMode ? '#92400e' : '#065f46' }}>
                {tenant?.overviewConfig?.bracketsPublished
                  ? '(ERP 홈페이지 공개됨)'
                  : '(ERP 홈페이지 비공개 - 시뮬레이션만 가능)'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (isSimulationMode && !tenant?.overviewConfig?.bracketsPublished) {
                    alert(
                      '🔒 현재 운영진 ERP에서 홈페이지 비공개(시뮬레이션 전용) 상태입니다.\n\n' +
                      '• [참가자관리]에서 참가확정 체크를 하더라도 홈페이지 리더보드 및 대진표는 공개되지 않으며 시뮬레이션만 가능합니다.\n' +
                      '• 실제 홈페이지 리더보드에 점수를 공개 반영하려면 운영진 ERP [대진표 및 조 편성표] 메뉴에서 [대진표 확정 및 홈페이지 공개]를 먼저 실행해 주세요.'
                    );
                    return;
                  }
                  setIsSimulationMode(prev => !prev);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: isSimulationMode ? '1px solid #059669' : '1px solid #d97706',
                  background: 'white',
                  color: isSimulationMode ? '#059669' : '#d97706',
                  fontSize: '0.78rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  opacity: isSimulationMode && !tenant?.overviewConfig?.bracketsPublished ? 0.65 : 1
                }}
              >
                {isSimulationMode ? '실전 모드로 전환' : '시뮬레이션 모드로 전환'}
              </button>
              <button
                type="button"
                onClick={handleResetRankings}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #fca5a5',
                  background: '#fef2f2',
                  color: '#dc2626',
                  fontSize: '0.78rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RotateCcw size={12} /> {isSimulationMode ? '시연 점수 초기화' : (isRankConfirmed ? '확정 취소 및 순위 초기화' : '점수/순위 초기화')}
              </button>
            </div>
          </div>

          <p style={{ margin: '8px 0 10px 0', fontSize: '0.79rem', color: isSimulationMode ? '#78350f' : '#065f46', lineHeight: '1.45', fontWeight: '600' }}>
            {isSimulationMode
              ? '• ERP [참가자관리]에서 [참가확정]을 체크해도 홈페이지(리더보드 및 대진표)에는 공개되지 않으며, 이곳에서 1위부터 순위 입력·자동 정렬·A4 결과표 인쇄까지 안전하게 시뮬레이션만 진행할 수 있습니다.'
              : '• 실전 모드입니다. [순위 최종 확정] 시 홈페이지 실시간 리더보드에 즉시 공식 점수가 반영됩니다.'}
          </p>

          {/* 참가자 불러오기 범위 선택 (전체 접수자 포함 시연 vs ERP 참가확정 완료자만) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '8px', borderTop: isSimulationMode ? '1px dashed #fcd34d' : '1px dashed #6ee7b7', fontSize: '0.78rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: '800', color: '#1e293b' }}>
              <input
                type="checkbox"
                checked={includePendingApplicants}
                onChange={(e) => setIncludePendingApplicants(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#d97706', cursor: 'pointer' }}
              />
              <span>참가확정 외 미확정(대기) 신청자까지 모두 포함하여 시연하기 (체크 해제 시 &apos;참가확정&apos; 체크된 인원만 시뮬레이션)</span>
            </label>
            <span style={{ fontWeight: '700', color: '#475569' }}>
              전체 접수: {rawRegistrations.length}명 (참가확정 {rawRegistrations.filter(r => r.regStatus === 'APPROVED').length}명 / 미확정 대기 {rawRegistrations.filter(r => r.regStatus !== 'APPROVED').length}명)
            </span>
          </div>
        </div>
        
        {/* ── [1] 상단 모드 분리 탭 (순위 입력란 vs 순위 확정란) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: '#e2e8f0',
          padding: '4px',
          borderRadius: '14px',
          marginBottom: '16px',
          gap: '4px'
        }}>
          <button
            type="button"
            onClick={() => setActiveMode('input')}
            style={{
              padding: '12px 8px',
              borderRadius: '10px',
              border: 'none',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              background: activeMode === 'input' ? 'white' : 'transparent',
              color: activeMode === 'input' ? '#0f172a' : '#64748b',
              boxShadow: activeMode === 'input' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Flag size={18} color={activeMode === 'input' ? '#3b82f6' : '#64748b'} />
            🏁 1. 순위 입력란
          </button>
          
          <button
            type="button"
            onClick={handleEnterConfirmMode}
            style={{
              padding: '12px 8px',
              borderRadius: '10px',
              border: 'none',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              background: activeMode === 'confirm' ? 'white' : 'transparent',
              color: activeMode === 'confirm' ? '#0f172a' : '#64748b',
              boxShadow: activeMode === 'confirm' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <CheckCircle2 size={18} color={activeMode === 'confirm' ? '#10b981' : '#64748b'} />
            📋 2. 순위 확정란
          </button>
        </div>

        {/* ── [2] 공통 종목(부서) 선택 카테고리 ── */}
        <div className="glass-panel" style={{ background: 'white', color: 'black', padding: '16px', borderRadius: '16px', marginBottom: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🏆 참가 종목(부서) 선택
              </label>
              <span style={{ fontSize: '0.8rem', color: 'var(--theme-primary)', fontWeight: '700' }}>
                {activeDivisionTab === '단체전' ? `출전 팀: ${participants.length}개 팀` : (includePendingApplicants ? `시연 대상 선수: ${participants.length}명 (대기 포함)` : `승인 선수: ${participants.length}명`)}
              </span>
            </div>
            <select
              value={activeDivisionTab}
              onChange={(e) => setActiveDivisionTab(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                background: '#f8fafc',
                color: '#0f172a',
                fontWeight: '800',
                outline: 'none',
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              {divisionTabs.map((div: string) => (
                <option key={div} value={div}>
                  {div}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── 단체전 전용: 각 소속협회/클럽 출전 팀 편성 및 추가 관리 ── */}
        {activeDivisionTab === '단체전' && (
          <div
            className="glass-panel"
            style={{
              background: 'white',
              color: 'black',
              padding: '16px 20px',
              borderRadius: '16px',
              marginBottom: '16px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
              border: '2px solid #3b82f6'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🚩</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: '#1e3a8a' }}>
                    단체전 출전 클럽(팀) 편성 설정
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    각 소속협회/클럽을 선택하거나 직접 입력하여 출전 팀을 추가하세요. (현재 출전: <strong>{participants.length}개 팀</strong>)
                  </span>
                </div>
              </div>
              <div style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '800' }}>
                출전 {participants.length}팀
              </div>
            </div>

            {/* 클럽 선택 및 팀 추가 컨트롤 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              {/* (1) 직접 팀명 입력 추가 (권장) */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1.5px solid #3b82f6' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: '800', color: '#1e3a8a', display: 'block', marginBottom: '6px' }}>
                  ✏️ 직접 출전 팀명 입력하여 추가:
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={customTeamNameToAdd}
                    onChange={(e) => setCustomTeamNameToAdd(e.target.value)}
                    placeholder="팀명 입력 (예: 거제요트클럽, 창원윈드클럽)"
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      background: 'white'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customTeamNameToAdd.trim()) {
                          handleAddTeamFromClub(customTeamNameToAdd.trim());
                          setCustomTeamNameToAdd('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!customTeamNameToAdd.trim()) {
                        alert('팀명을 입력해 주세요.');
                        return;
                      }
                      handleAddTeamFromClub(customTeamNameToAdd.trim());
                      setCustomTeamNameToAdd('');
                    }}
                    style={{
                      background: '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '0.82rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} /> 직접 추가
                  </button>
                </div>
              </div>

              {/* (2) 등록된 소속클럽에서 선택 추가 */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  🏢 등록된 소속협회/클럽에서 팀 추가:
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select
                    value={selectedClubToAdd}
                    onChange={(e) => setSelectedClubToAdd(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      background: 'white',
                      color: '#0f172a'
                    }}
                  >
                    <option value="">-- 출전할 클럽 선택 --</option>
                    {registeredClubsList.map((club: string) => (
                      <option key={club} value={club}>
                        {club}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedClubToAdd) {
                        alert('추가할 클럽을 선택해 주세요.');
                        return;
                      }
                      handleAddTeamFromClub(selectedClubToAdd);
                    }}
                    style={{
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.82rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} /> 팀 추가
                  </button>
                </div>
              </div>
            </div>

            {/* 현재 출전 팀 목록 칩 */}
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '6px' }}>
                📋 현재 편성된 단체전 출전 팀 목록 (총 {participants.length}팀):
              </div>
              {participants.length === 0 ? (
                <div style={{ padding: '14px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                  💡 출전 등록된 단체전 팀이 없습니다. 위 직접 추가란에 팀명을 입력하여 출전 팀을 추가해 주세요.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {participants.map((team, idx) => (
                    <div
                      key={team.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        fontSize: '0.82rem',
                        fontWeight: '800',
                        color: '#0f172a'
                      }}
                    >
                      <span style={{ color: '#2563eb' }}>#{team.bibNumber || `T${idx + 1}`}</span>
                      <span>{team.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteTeam(team.id, team.name)}
                        title="출전 명단에서 제외"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '0 2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            MODE 1: 순위 입력란 (종목 & 라운드 선택 및 1위부터 순서대로 배번 입력 / 수정 / 삭제)
            ═══════════════════════════════════════════════════════════ */}
        {activeMode === 'input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 라운드 선택 및 라운드 추가/삭제 제어기 */}
            <div className="glass-panel" style={{ background: 'white', color: 'black', padding: '16px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🎯 경기 라운드 선택 (총 {rounds.length}개 라운드)
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={handleAddRound}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: '1px solid #93c5fd',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                    }}
                    title="다음 라운드를 추가합니다"
                  >
                    <Plus size={13} /> + 라운드 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRound()}
                    disabled={rounds.length <= 1}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 8px',
                      borderRadius: '8px',
                      border: '1px solid #fecaca',
                      background: rounds.length <= 1 ? '#f1f5f9' : '#fef2f2',
                      color: rounds.length <= 1 ? '#94a3b8' : '#dc2626',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      cursor: rounds.length <= 1 ? 'not-allowed' : 'pointer',
                    }}
                    title="가장 마지막 라운드를 삭제합니다"
                  >
                    <Trash2 size={13} /> - 마지막 라운드({rounds[rounds.length - 1]?.short}) 삭제
                  </button>
                </div>
              </div>

              {/* 라운드 버튼 목록 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(rounds.length, 6)}, 1fr)`,
                gap: '6px',
                overflowX: 'auto',
                paddingBottom: '4px'
              }}>
                {rounds.map(r => {
                  const isSelected = selectedRound === r.key;
                  const filledCount = participants.filter(p => p[r.key] !== null && p[r.key] !== undefined && p[r.key] !== '').length;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => {
                        setSelectedRound(r.key);
                        setCurrentRankNum(1);
                        setInputFeedback(null);
                        setBibInput('');
                      }}
                      style={{
                        padding: '10px 4px',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid var(--theme-primary)' : '1px solid #e2e8f0',
                        background: isSelected ? 'var(--theme-primary)' : '#f8fafc',
                        color: isSelected ? 'white' : '#334155',
                        fontWeight: '800',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'all 0.15s',
                        boxShadow: isSelected ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                        minWidth: '55px'
                      }}
                    >
                      <span>{r.short}</span>
                      <span style={{
                        fontSize: '0.65rem',
                        opacity: isSelected ? 0.9 : 0.6,
                        fontWeight: '600'
                      }}>
                        {filledCount}/{participants.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 라운드 관리 퀵 버튼 바 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  현재 선택: <strong>{rounds.find(r => r.key === selectedRound)?.label || selectedRound}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleResetRoundScores}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#e11d48',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RotateCcw size={12} /> 해당 라운드 순위 전체 초기화
                </button>
              </div>
            </div>

            {/* ── 1등부터 순위별 배번(티넘버) 순서 입력 및 수정/삭제 카드 ── */}
            <div className="glass-panel" style={{
              background: 'white',
              color: 'black',
              padding: '20px',
              borderRadius: '18px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              border: '2px solid #e2e8f0'
            }}>
              {/* 순위 네비게이션 & 앞뒤 이동 버튼 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: '16px'
              }}>
                <button
                  type="button"
                  onClick={handlePrevRank}
                  disabled={currentRankNum <= 1}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: currentRankNum <= 1 ? '#f1f5f9' : '#f8fafc',
                    color: currentRankNum <= 1 ? '#94a3b8' : '#0f172a',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: currentRankNum <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronLeft size={18} /> 이전 ({currentRankNum > 1 ? `${currentRankNum - 1}위` : '없음'})
                </button>

                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: currentRankNum === 1 ? '#fef3c7' : currentRankNum === 2 ? '#f1f5f9' : currentRankNum === 3 ? '#ffedd5' : '#e0e7ff',
                    color: currentRankNum === 1 ? '#b45309' : currentRankNum === 2 ? '#475569' : currentRankNum === 3 ? '#c2410c' : '#4338ca',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    fontWeight: '900',
                    fontSize: '1.2rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    {currentRankNum === 1 ? '🥇 1위' : currentRankNum === 2 ? '🥈 2위' : currentRankNum === 3 ? '🥉 3위' : `🏅 ${currentRankNum}위`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', fontWeight: '600' }}>
                    [{rounds.find(r => r.key === selectedRound)?.short || selectedRound.toUpperCase()}] 피니시 순위 입력/수정
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNextRank}
                  disabled={currentRankNum >= participants.length}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    background: currentRankNum >= participants.length ? '#f1f5f9' : '#f8fafc',
                    color: currentRankNum >= participants.length ? '#94a3b8' : '#0f172a',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: currentRankNum >= participants.length ? 'not-allowed' : 'pointer'
                  }}
                >
                  다음 ({currentRankNum < participants.length ? `${currentRankNum + 1}위` : '끝'}) <ChevronRight size={18} />
                </button>
              </div>

              {/* 현재 순위에 이미 배정된 선수 표시 및 삭제/수정 옵션 */}
              {currentRankPlayer ? (
                <div style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '700' }}>
                      현재 {currentRankNum}위에 배정된 선수 (수정하려면 아래에 새 배번을 입력하거나 삭제하세요)
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#065f46' }}>
                      {currentRankPlayer.name} {currentRankPlayer.bibNumber && `(배번 #${currentRankPlayer.bibNumber})`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClearCurrentRank(currentRankNum)}
                    style={{
                      background: '#fee2e2',
                      color: '#b91c1c',
                      border: '1px solid #fca5a5',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontWeight: '800',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={14} /> {currentRankNum}위 배정 삭제
                  </button>
                </div>
              ) : null}

{activeDivisionTab === '단체전' ? (
                /* ── 단체전: 출전한 팀에서 직접 순위 선택 ── */
                participants.length === 0 ? (
                  <div style={{ padding: '24px', background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: '14px', textAlign: 'center', color: '#475569' }}>
                    <p style={{ margin: '0 0 6px 0', fontWeight: '900', fontSize: '1rem', color: '#1e3a8a' }}>🚩 단체전 출전 팀을 먼저 추가해 주세요</p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>위 [단체전 출전 클럽(팀) 편성 설정]의 직접 추가란에서 출전 팀을 추가하면 순위를 결정할 수 있습니다.</p>
                  </div>
                ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '2px solid #3b82f6' }}>
                    <label style={{ fontSize: '0.95rem', fontWeight: '900', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      🚩 [{rounds.find(r => r.key === selectedRound)?.short || selectedRound.toUpperCase()}] {currentRankNum}위 출전 팀 선택:
                    </label>
                    <select
                      value={currentRankPlayer ? currentRankPlayer.id : ''}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        if (!selectedId) {
                          handleClearCurrentRank(currentRankNum);
                        } else {
                          const selectedTeam = participants.find(p => p.id === selectedId);
                          if (selectedTeam) {
                            handleQuickAssignPlayer(selectedTeam);
                          }
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '2px solid #2563eb',
                        fontSize: '1.05rem',
                        fontWeight: '800',
                        background: 'white',
                        color: '#0f172a',
                        cursor: 'pointer',
                        outline: 'none',
                        boxShadow: '0 2px 6px rgba(37,99,235,0.1)'
                      }}
                    >
                      <option value="">-- {currentRankNum}위에 배정할 출전 팀을 선택하세요 --</option>
                      {participants.map((team) => {
                        const assignedRank = team[selectedRound];
                        const isThisRank = assignedRank === currentRankNum;
                        const isOtherRank = assignedRank && assignedRank !== currentRankNum;
                        return (
                          <option key={team.id} value={team.id}>
                            {team.bibNumber ? `[#${team.bibNumber}] ` : ''}{team.name}
                            {isThisRank ? ` ⭐ (현재 ${currentRankNum}위 배정됨)` : isOtherRank ? ` (${assignedRank}위 배정됨 - 선택 시 변경)` : ' (대기중)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* 원터치 빠른 팀 배정 버튼들 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#475569' }}>
                        ⚡ 출전 팀 원터치 배정 (터치 시 즉시 {currentRankNum}위 등록 후 다음 순위로 이동):
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
                        {unassignedPlayers.length}개 팀 대기중
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {participants.map((team) => {
                        const assignedRank = team[selectedRound];
                        const isCurrent = assignedRank === currentRankNum;
                        const isAssigned = assignedRank !== null && assignedRank !== undefined && assignedRank !== '';
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => handleQuickAssignPlayer(team)}
                            style={{
                              background: isCurrent ? '#2563eb' : isAssigned ? '#f1f5f9' : '#ffffff',
                              color: isCurrent ? 'white' : isAssigned ? '#64748b' : '#0f172a',
                              border: isCurrent ? '2px solid #1d4ed8' : isAssigned ? '1px solid #cbd5e1' : '2px solid #93c5fd',
                              borderRadius: '10px',
                              padding: '10px 14px',
                              fontSize: '0.88rem',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: isCurrent ? '0 2px 8px rgba(37,99,235,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
                              transition: 'all 0.15s'
                            }}
                          >
                            {team.bibNumber && <span style={{ opacity: 0.9 }}>#{team.bibNumber}</span>}
                            <span>{team.name}</span>
                            {isAssigned ? (
                              <span style={{ fontSize: '0.75rem', color: isCurrent ? 'white' : '#64748b', fontWeight: '900' }}>
                                ({assignedRank}위)
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: '900', background: '#eff6ff', padding: '2px 5px', borderRadius: '4px' }}>
                                선택
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 피드백 메시지 */}
                  {inputFeedback && (
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      background: inputFeedback.isError ? '#fef2f2' : '#f0fdf4',
                      color: inputFeedback.isError ? '#dc2626' : '#16a34a',
                      border: `1px solid ${inputFeedback.isError ? '#fecaca' : '#bbf7d0'}`
                    }}>
                      {inputFeedback.text}
                    </div>
                  )}
                </div>
                )
              ) : (
                /* ── 개인전 배번 입력 및 빠른 칩 선택 폼 ── */
                <>
                  <form onSubmit={handleAssignBibSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b' }}>
                        {currentRankPlayer ? `${currentRankNum}위 선수 변경/교체 (새 배번/이름 입력)` : `${currentRankNum}위 선수 배번(티넘버) 입력`}
                      </label>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={bibInput}
                        onChange={(e) => setBibInput(e.target.value)}
                        placeholder="예: 27 또는 선수 이름"
                        style={{
                          flex: 1,
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: '2px solid var(--theme-primary)',
                          fontSize: '1.15rem',
                          fontWeight: '800',
                          outline: 'none',
                          boxSizing: 'border-box',
                          textAlign: 'center'
                        }}
                        autoFocus
                      />
                      <button
                        type="submit"
                        style={{
                          background: 'var(--theme-primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          padding: '0 20px',
                          fontWeight: '800',
                          fontSize: '0.95rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 2px 8px rgba(99,102,241,0.3)'
                        }}
                      >
                        <Check size={18} /> {currentRankPlayer ? `${currentRankNum}위 수정` : `${currentRankNum}위 등록`}
                      </button>
                    </div>

                    {/* 실시간 매칭 프리뷰 */}
                    {matchedTypingPlayer && (
                      <div style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        color: '#1e40af',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span>🏃 매칭: <strong>{matchedTypingPlayer.name}</strong> (배번: #{matchedTypingPlayer.bibNumber || '-'})</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleSetPlayerSpecialScore(matchedTypingPlayer.id, 'DNS')}
                            style={{ padding: '3px 6px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}
                          >
                            DNS 처리
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetPlayerSpecialScore(matchedTypingPlayer.id, 'DNF')}
                            style={{ padding: '3px 6px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}
                          >
                            DNF 처리
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 피드백 메시지 */}
                    {inputFeedback && (
                      <div style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        background: inputFeedback.isError ? '#fef2f2' : '#f0fdf4',
                        color: inputFeedback.isError ? '#dc2626' : '#16a34a',
                        border: `1px solid ${inputFeedback.isError ? '#fecaca' : '#bbf7d0'}`
                      }}>
                        {inputFeedback.text}
                      </div>
                    )}
                  </form>

                  {/* 미배정 선수 빠른 칩 선택 (터치 시 즉시 현재 순위로 배정) */}
                  {unassignedPlayers.length > 0 && (
                    <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569' }}>
                          ⚡ 미입력 선수 빠른 선택 (터치 시 즉시 {currentRankNum}위 배정):
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {unassignedPlayers.length}명 대기중
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '140px', overflowY: 'auto', padding: '2px' }}>
                        {unassignedPlayers.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleQuickAssignPlayer(p)}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              padding: '6px 10px',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              color: '#1e293b',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.1s'
                            }}
                          >
                            {p.bibNumber && <span style={{ color: 'var(--theme-primary)' }}>#{p.bibNumber}</span>}
                            <span>{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── [3] 해당 라운드(selectedRound) 전체 순위 현황표 및 개별 수정/삭제 리스트 ── */}
            <div className="glass-panel" style={{ background: 'white', color: 'black', padding: '20px', borderRadius: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📊 [{rounds.find(r => r.key === selectedRound)?.short || selectedRound.toUpperCase()}] 전체 순위 현황표
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  행을 터치하여 수정하거나 삭제 버튼을 누르세요
                </span>
              </div>

              {participants.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '0.9rem' }}>
                  해당 종목에 등록된 선수가 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Array.from({ length: participants.length }).map((_, idx) => {
                    const rankNum = idx + 1;
                    const assigned = participants.find(p => p[selectedRound] === rankNum);
                    const isCurrentFocus = currentRankNum === rankNum;

                    return (
                      <div
                        key={rankNum}
                        onClick={() => {
                          setCurrentRankNum(rankNum);
                          setBibInput(assigned ? (assigned.bibNumber || assigned.name) : '');
                          setInputFeedback(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: isCurrentFocus ? '2px solid var(--theme-primary)' : '1px solid #e2e8f0',
                          background: isCurrentFocus ? '#f0f5ff' : assigned ? '#ffffff' : '#f8fafc',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            width: '40px',
                            fontWeight: '900',
                            fontSize: '0.95rem',
                            color: rankNum === 1 ? '#d97706' : rankNum === 2 ? '#475569' : rankNum === 3 ? '#ea580c' : '#64748b'
                          }}>
                            {rankNum}위
                          </span>
                          {assigned ? (
                            <div>
                              <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f172a' }}>
                                {assigned.name}
                              </span>
                              {assigned.bibNumber && (
                                <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: 'var(--theme-primary)', fontWeight: '700' }}>
                                  (배번 #{assigned.bibNumber})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                              - 미입력 (터치하여 배정)
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {activeDivisionTab === '단체전' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                              <select
                                value={assigned ? assigned.id : ''}
                                onChange={(e) => {
                                  const targetId = e.target.value;
                                  if (!targetId) {
                                    handleClearCurrentRank(rankNum);
                                  } else {
                                    const targetTeam = participants.find(p => p.id === targetId);
                                    if (targetTeam) {
                                      assignRankToPlayer(targetTeam.id, selectedRound, rankNum);
                                      setInputFeedback({ text: `✅ ${rankNum}위에 '${targetTeam.name}' 팀이 등록되었습니다!`, isError: false });
                                    }
                                  }
                                }}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.82rem',
                                  fontWeight: '800',
                                  background: assigned ? '#eff6ff' : 'white',
                                  color: assigned ? '#1e40af' : '#475569',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="">-- {rankNum}위 팀 선택 --</option>
                                {participants.map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.bibNumber ? `[#${t.bibNumber}] ` : ''}{t.name}
                                  </option>
                                ))}
                              </select>
                              {assigned && (
                                <button
                                  type="button"
                                  onClick={() => handleClearCurrentRank(rankNum)}
                                  title="순위 배정 취소"
                                  style={{
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    border: '1px solid #fca5a5',
                                    borderRadius: '6px',
                                    padding: '5px 8px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ) : (
                            assigned ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentRankNum(rankNum);
                                    setBibInput(assigned.bibNumber || assigned.name);
                                  }}
                                  style={{
                                    background: '#eff6ff',
                                    color: '#2563eb',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px'
                                  }}
                                >
                                  <Edit2 size={12} /> 수정
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearCurrentRank(rankNum);
                                  }}
                                  style={{
                                    background: '#fee2e2',
                                    color: '#ef4444',
                                    border: '1px solid #fca5a5',
                                    borderRadius: '6px',
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px'
                                  }}
                                >
                                  <Trash2 size={12} /> 삭제
                                </button>
                              </>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: isCurrentFocus ? 'var(--theme-primary)' : '#cbd5e1', fontWeight: '700' }}>
                                {isCurrentFocus ? '선택됨' : '입력 대기'}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* DNS / DNF 처리 선수 목록 */}
                  {dnsDnfPlayers.length > 0 && (
                    <div style={{ marginTop: '12px', padding: '12px', background: '#fff1f2', borderRadius: '10px', border: '1px solid #fecdd3' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#be123c' }}>
                          ⚠️ DNS / DNF 선수 명단:
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {dnsDnfPlayers.map(p => (
                          <div key={p.id} style={{ background: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: '1px solid #fecdd3', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{p.name} ({p[selectedRound]})</span>
                            <button
                              type="button"
                              onClick={() => assignRankToPlayer(p.id, selectedRound, null)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                              title="취소"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 하단 확정란 이동 바로가기 */}
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleEnterConfirmMode}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    background: '#0f172a',
                    color: 'white',
                    border: 'none',
                    fontWeight: '800',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(15,23,42,0.15)'
                  }}
                >
                  <CheckCircle2 size={18} color="#10b981" /> 순위 확정란으로 이동하여 전체 검토 및 확정하기 ▶
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            MODE 2: 순위 확정란 (전체 라운드 스프레드시트 검토 및 직접 수정 & 확정)
            ═══════════════════════════════════════════════════════════ */}
        {activeMode === 'confirm' && (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'white', color: 'black', padding: '20px', borderRadius: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '900', margin: 0 }}>전체 순위 검토 및 최종 확정</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  진행된 라운드에서 등수 입력이 없는 선수는 <strong>모두 DNS로 자동 간주</strong>되어 벌점이 총점에 합산됩니다.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setParticipants(prev => {
                      const updated = applyAutoDnsToConductedRounds(prev, rounds, dnsDnfRule, true);
                      if (isSimulationMode && typeof window !== 'undefined' && activeTournament) {
                        localStorage.setItem(getSimStorageKey(activeTournament.id, activeDivisionTab), JSON.stringify(updated));
                      }
                      return updated;
                    });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #fca5a5',
                    background: '#fff1f2',
                    color: '#be123c',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                  title="등수 미입력 칸을 모두 DNS로 일괄 채웁니다"
                >
                  미입력 전체 DNS 적용
                </button>
                <button
                  type="button"
                  onClick={handleAddRound}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #93c5fd',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={14} /> 라운드 추가
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRound()}
                  disabled={rounds.length <= 1}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    background: rounds.length <= 1 ? '#f1f5f9' : '#fef2f2',
                    color: rounds.length <= 1 ? '#94a3b8' : '#dc2626',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    cursor: rounds.length <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Trash2 size={14} /> 마지막 라운드({rounds[rounds.length - 1]?.short}) 삭제
                </button>
              </div>
            </div>

            {/* ── [규칙 설정] DNS / DNF 채점 산정 방식 선택 카드 ── */}
            <div style={{
              background: '#f8fafc',
              border: '2px solid #cbd5e1',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    background: '#0f172a',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: '900',
                    padding: '4px 10px',
                    borderRadius: '20px'
                  }}>
                    ⚖️ DNS · DNF 벌점 규칙 설정
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#334155' }}>
                    현재 부서 등록 선수: <strong>{participants.length}명</strong> (등수 미입력 시 모두 DNS로 간주)
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                {/* 옵션 1: 표준 완주자 기준 (DNS = 참가자+1, DNF = 완주자+1) */}
                <label
                  onClick={() => handleChangeDnsDnfRule('FINISHER_PLUS_ONE')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: dnsDnfRule === 'FINISHER_PLUS_ONE' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: dnsDnfRule === 'FINISHER_PLUS_ONE' ? '#eff6ff' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name="dnsDnfScoringRule"
                      checked={dnsDnfRule === 'FINISHER_PLUS_ONE'}
                      onChange={() => handleChangeDnsDnfRule('FINISHER_PLUS_ONE')}
                      style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '900', fontSize: '0.88rem', color: dnsDnfRule === 'FINISHER_PLUS_ONE' ? '#1e40af' : '#0f172a' }}>
                      규칙 1: DNS (참가신청자+1) / DNF (완주자+1) 구분 산정
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#475569', paddingLeft: '24px', lineHeight: '1.45' }}>
                    • <strong>DNS (미출발·등수 미입력)</strong>: 전체 등록 인원({participants.length}명) + 1점 = <strong style={{ color: '#dc2626' }}>{participants.length + 1}점</strong><br />
                    • <strong>DNF (완주 실패)</strong>: 해당 레이스 결승선 통과(완주) 선수 수 + 1점 <span style={{ color: '#64748b' }}>(예: 40명 중 35명 완주 시 36점)</span>
                  </div>
                </label>

                {/* 옵션 2: DNS, DNF 모두 참가신청자 + 1점 */}
                <label
                  onClick={() => handleChangeDnsDnfRule('REGISTERED_PLUS_ONE')}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: dnsDnfRule === 'REGISTERED_PLUS_ONE' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: dnsDnfRule === 'REGISTERED_PLUS_ONE' ? '#eff6ff' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      name="dnsDnfScoringRule"
                      checked={dnsDnfRule === 'REGISTERED_PLUS_ONE'}
                      onChange={() => handleChangeDnsDnfRule('REGISTERED_PLUS_ONE')}
                      style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '900', fontSize: '0.88rem', color: dnsDnfRule === 'REGISTERED_PLUS_ONE' ? '#1e40af' : '#0f172a' }}>
                      규칙 2: DNS · DNF 둘 다 참가신청자 + 1점 동일 산정
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#475569', paddingLeft: '24px', lineHeight: '1.45' }}>
                    • <strong>DNS (미출발·등수 미입력)</strong>: 전체 등록 인원({participants.length}명) + 1점 = <strong style={{ color: '#dc2626' }}>{participants.length + 1}점</strong><br />
                    • <strong>DNF (완주 실패)</strong>: 전체 등록 인원({participants.length}명) + 1점 = <strong style={{ color: '#d97706' }}>{participants.length + 1}점</strong> <span style={{ color: '#64748b' }}>(예: 40명 기준 모두 41점)</span>
                  </div>
                </label>
              </div>

              {/* 라운드별 실시간 완주자 수 및 DNS/DNF 적용 점수 요약 배지 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
                {rounds.map(r => {
                  const conducted = isRoundConducted(r.key, participants);
                  const finishers = getRoundFinishedCount(r.key, participants);
                  const dnsPts = getDnsPenaltyScore(participants);
                  const dnfPts = getDnfPenaltyScore(r.key, participants, dnsDnfRule);
                  return (
                    <div
                      key={r.key}
                      style={{
                        fontSize: '0.73rem',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        background: conducted ? '#ffffff' : '#f1f5f9',
                        border: conducted ? '1px solid #94a3b8' : '1px solid #e2e8f0',
                        color: conducted ? '#0f172a' : '#94a3b8',
                        fontWeight: '700'
                      }}
                    >
                      <strong>{r.short}</strong>:{' '}
                      {conducted
                        ? `완주 ${finishers}명 · DNS ${dnsPts}점 · DNF ${dnfPts}점`
                        : '미진행'}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 순위 확정 완료 상태 알림 및 빠른 인쇄 배너 */}
            {isRankConfirmed && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '12px 18px',
                borderRadius: '12px',
                color: '#065f46',
                fontSize: '0.9rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={20} color="#10b981" />
                  <span>
                    <strong>[{activeDivisionTab}]</strong> 순위가 공식 확정되었습니다! (확정일시: {confirmedTime})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleResetRankings}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      fontWeight: '800',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw size={15} /> 🧹 순위 확정 취소
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintRankings}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: '#047857',
                      color: 'white',
                      border: 'none',
                      fontWeight: '800',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(4, 120, 87, 0.3)'
                    }}
                  >
                    <Printer size={16} /> 🖨️ 바로 인쇄하기
                  </button>
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSortRankings}
                className="btn-secondary"
                style={{
                  flex: '1 1 140px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '13px',
                  fontSize: '0.92rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  borderRadius: '10px'
                }}
              >
                <ListOrdered size={18} /> 순위 자동 정렬 (총점 산출)
              </button>
              <button
                type="button"
                onClick={handleConfirmLeaderboard}
                disabled={submitting}
                className="btn-primary"
                style={{
                  flex: '1 1 180px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '13px',
                  fontSize: '0.92rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  background: isSimulationMode
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: isSimulationMode
                    ? '0 2px 8px rgba(245,158,11,0.3)'
                    : '0 2px 8px rgba(16,185,129,0.3)'
                }}
              >
                <CheckCircle2 size={18} />
                {isSimulationMode
                  ? (isRankConfirmed ? '🧪 시뮬레이션 재확정 (비공개 시연)' : '🧪 시뮬레이션 확정 테스트 (비공개)')
                  : (isRankConfirmed ? '순위 확정 완료 (재확정)' : '순위 최종 확정 (공개)')}
              </button>
              <button
                type="button"
                onClick={handleResetRankings}
                disabled={submitting}
                style={{
                  flex: '1 1 150px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '13px',
                  fontSize: '0.92rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  border: '1px solid #fca5a5',
                  background: '#fef2f2',
                  color: '#dc2626',
                  transition: 'all 0.2s'
                }}
              >
                <RotateCcw size={18} /> {isRankConfirmed ? '🧹 확정 취소 및 초기화' : '🧹 순위 및 점수 초기화'}
              </button>
              <button
                type="button"
                onClick={handlePrintRankings}
                style={{
                  flex: '1 1 160px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '13px',
                  fontSize: '0.92rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  border: '1px solid #0f172a',
                  background: isRankConfirmed ? '#0f172a' : '#1e293b',
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                <Printer size={18} /> {(() => {
                  if (!isAgeSplitDivision(activeDivisionTab)) return '🖨️ 공식 순위표 인쇄';
                  if (selectedSubclassTab === 'all') return '🖨️ 공식 순위표 인쇄 (전체 + 클라스별 일괄)';
                  if (selectedSubclassTab === 'overall') return '🖨️ 공식 순위표 인쇄 (전체 종합만)';
                  return `🖨️ 공식 순위표 인쇄 (${selectedSubclassTab}만)`;
                })()}
              </button>
            </div>

            {/* 혼합오픈 (남자부) / 펀엔포뮬러 (남자부) 전용 클라스별 보기 및 출력 전환 탭 */}
            {isAgeSplitDivision(activeDivisionTab) && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#1e293b', marginRight: '4px' }}>
                  🏷️ 클라스별 보기 및 인쇄:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSubclassTab('all')}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid ' + (selectedSubclassTab === 'all' ? 'var(--theme-primary)' : '#cbd5e1'),
                    background: selectedSubclassTab === 'all' ? 'var(--theme-primary)' : '#ffffff',
                    color: selectedSubclassTab === 'all' ? '#ffffff' : '#475569',
                    fontWeight: '800',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  📑 전체 종합 + 각 클라스별 전체 일괄 ({participants.length}명)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSubclassTab('overall')}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid ' + (selectedSubclassTab === 'overall' ? 'var(--theme-primary)' : '#cbd5e1'),
                    background: selectedSubclassTab === 'overall' ? 'var(--theme-primary)' : '#ffffff',
                    color: selectedSubclassTab === 'overall' ? '#ffffff' : '#475569',
                    fontWeight: '800',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  📊 전체 종합만
                </button>
                {['청년부', '중년부', '장년부'].map(sc => {
                  const cnt = participants.filter(p => p.subclass === sc).length;
                  const isSel = selectedSubclassTab === sc;
                  return (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setSelectedSubclassTab(sc)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '8px',
                        border: '1px solid ' + (isSel ? '#d97706' : '#cbd5e1'),
                        background: isSel ? '#d97706' : '#ffffff',
                        color: isSel ? '#ffffff' : '#475569',
                        fontWeight: '800',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      🏷️ {sc} ({cnt}명)
                    </button>
                  );
                })}
              </div>
            )}

            {/* 전체 참가자 & 라운드별 점수 스프레드시트 테이블 (직접 수정 가능) */}
            {(() => {
              const isSplit = isAgeSplitDivision(activeDivisionTab);
              let screenParticipants = participants;
              let showClassColumn = false;

              if (isSplit) {
                if (selectedSubclassTab === 'all' || selectedSubclassTab === 'overall') {
                  showClassColumn = true;
                  screenParticipants = participants;
                } else if (['청년부', '중년부', '장년부'].includes(selectedSubclassTab)) {
                  const classMembers = participants.filter(p => p.subclass === selectedSubclassTab);
                  const hasScores = classMembers.some(p => rounds.some(r => p[r.key] !== null && p[r.key] !== undefined && p[r.key] !== ''));
                  screenParticipants = hasScores
                    ? sortAndRankParticipants(classMembers, rounds, dnsDnfRule, false)
                    : classMembers.map((p, idx) => ({ ...p, rank: idx + 1 }));
                }
              }

              return (
                <div style={{ overflowX: 'auto', width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '10px 6px', width: '45px', textAlign: 'center' }}>순위</th>
                        {showClassColumn && (
                          <th style={{ padding: '10px 6px', width: '60px', textAlign: 'center' }}>클라스</th>
                        )}
                        <th style={{ padding: '10px 8px', minWidth: '80px', textAlign: 'left' }}>{activeDivisionTab === '단체전' ? '팀명 (소속)' : '이름'}</th>
                        <th style={{ padding: '10px 6px', width: '60px', textAlign: 'center' }}>{activeDivisionTab === '단체전' ? '팀배번' : '배번'}</th>
                        <th style={{ padding: '10px 6px', width: '70px', textAlign: 'center' }}>{activeDivisionTab === '단체전' ? '소속협회' : '생년월일'}</th>
                        {rounds.map(r => {
                          const conducted = isRoundConducted(r.key, screenParticipants);
                          const finishers = getRoundFinishedCount(r.key, screenParticipants);
                          return (
                            <th key={r.key} style={{ padding: '8px 4px', width: '58px', textAlign: 'center', color: '#1e293b' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span>{r.short}</span>
                                {conducted && (
                                  <span style={{ fontSize: '0.63rem', color: '#64748b', fontWeight: '700' }}>
                                    완주 {finishers}명
                                  </span>
                                )}
                              </div>
                            </th>
                          );
                        })}
                        <th style={{ padding: '10px 6px', width: '65px', textAlign: 'center', color: 'var(--theme-primary)' }}>총점</th>
                      </tr>
                    </thead>
                    <tbody>
                      {screenParticipants.length === 0 ? (
                        <tr>
                          <td colSpan={(showClassColumn ? 6 : 5) + rounds.length} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                            해당 종목에 승인된 신청자가 없거나 데이터를 불러올 수 없습니다.
                          </td>
                        </tr>
                      ) : (
                        screenParticipants.map((p) => {
                          // 4경기 이상 진행 시 제외되는 최악 성적 라운드 인덱스 파악
                          const roundNumericScores = rounds.map(r => getRoundScoreValue(p[r.key], r.key, screenParticipants, dnsDnfRule));
                          const validCount = roundNumericScores.filter(v => v !== null).length;
                          let discardIdx = -1;
                          if (validCount >= 4) {
                            let maxVal = -1;
                            roundNumericScores.forEach((v, idx) => {
                              if (v !== null && v > maxVal) {
                                maxVal = v;
                              }
                            });
                          }

                          return (
                            <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              {/* 순위 */}
                              <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: '900', color: p.rank === 1 ? '#d97706' : p.rank === 2 ? '#475569' : p.rank === 3 ? '#ea580c' : '#0f172a', whiteSpace: 'nowrap' }}>
                                {formatRankDisplay(p.rank, activeDivisionTab === '단체전')}
                              </td>
                              {/* 클라스 뱃지 */}
                              {showClassColumn && (
                                <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: '800',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    background: p.subclass === '청년부' ? '#eff6ff' : p.subclass === '중년부' ? '#ecfdf5' : '#fffbeb',
                                    color: p.subclass === '청년부' ? '#1d4ed8' : p.subclass === '중년부' ? '#047857' : '#b45309',
                                    border: `1px solid ${p.subclass === '청년부' ? '#bfdbfe' : p.subclass === '중년부' ? '#a7f3d0' : '#fde68a'}`
                                  }}>
                                    {p.subclass || '일반'}
                                  </span>
                                </td>
                              )}
                              {/* 이름 */}
                              <td style={{ padding: '8px', fontWeight: '800' }}>
                                {p.name}
                              </td>
                              {/* 배번 (수정 가능) */}
                              <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                <input
                                  type="text"
                                  value={p.bibNumber || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setParticipants(prev => prev.map(item => item.id === p.id ? { ...item, bibNumber: val } : item));
                                  }}
                                  placeholder="배번"
                                  style={{ width: '45px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '700' }}
                                />
                              </td>
                              {/* 생년월일 */}
                              <td style={{ padding: '8px 4px', textAlign: 'center', color: '#64748b' }}>
                                {p.birth ? p.birth.substring(2) : '-'}
                              </td>
                              {/* 라운드 스코어들 (직접 수정 가능, 등수 미입력은 진행된 라운드에서 자동 DNS 간주) */}
                              {rounds.map((rItem, rIdx) => {
                                const rKey = rItem.key;
                                const conducted = isRoundConducted(rKey, screenParticipants);
                                const rawCellVal = p[rKey];
                                const isFocused = activeCell?.id === p.id && activeCell?.roundKey === rKey;
                                // 등수 입력이 없는 경우 진행된 라운드에서는 DNS로 간주하여 표시
                                const effectiveVal =
                                  rawCellVal === null || rawCellVal === undefined || rawCellVal === ''
                                    ? (conducted ? 'DNS' : '')
                                    : rawCellVal;
                                const inputDisplayVal =
                                  isFocused && (rawCellVal === null || rawCellVal === undefined || rawCellVal === '')
                                    ? ''
                                    : effectiveVal;
                                const cellScore = roundNumericScores[rIdx];
                                const isDiscarded = rIdx === discardIdx;

                                return (
                                  <td key={rKey} style={{ padding: '4px', textAlign: 'center', verticalAlign: 'top' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                      <input
                                        type="text"
                                        value={inputDisplayVal}
                                        onChange={(e) => handleScoreInput(p.id, rKey, e.target.value)}
                                        onFocus={(e) => {
                                          setActiveCell({ id: p.id, roundKey: rKey });
                                          e.currentTarget.select();
                                        }}
                                        onBlur={() => handleScoreCellBlur(p.id, rKey)}
                                        placeholder={conducted ? 'DNS' : '-'}
                                        style={{
                                          width: '44px',
                                          padding: '5px 2px',
                                          border: isFocused ? '2px solid var(--theme-primary)' : '1px solid #cbd5e1',
                                          borderRadius: '6px',
                                          textAlign: 'center',
                                          fontSize: '0.82rem',
                                          fontWeight: '800',
                                          textDecoration: isDiscarded ? 'line-through' : 'none',
                                          background:
                                            effectiveVal === 'DNS'
                                              ? '#fee2e2'
                                              : effectiveVal === 'DNF'
                                              ? '#fef3c7'
                                              : 'white',
                                          color:
                                            effectiveVal === 'DNS'
                                              ? '#dc2626'
                                              : effectiveVal === 'DNF'
                                              ? '#b45309'
                                              : '#0f172a'
                                        }}
                                      />
                                      {cellScore !== null && (
                                        <span style={{
                                          fontSize: '0.66rem',
                                          fontWeight: '800',
                                          marginTop: '2px',
                                          color: isDiscarded
                                            ? '#94a3b8'
                                            : effectiveVal === 'DNS'
                                            ? '#dc2626'
                                            : effectiveVal === 'DNF'
                                            ? '#b45309'
                                            : '#64748b'
                                        }}>
                                          {effectiveVal === 'DNS' || effectiveVal === 'DNF'
                                            ? `${cellScore}점${isDiscarded ? '(제외)' : ''}`
                                            : isDiscarded
                                            ? `${cellScore}점(제외)`
                                            : `${cellScore}점`}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              {/* 총점 */}
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: '900', color: 'var(--theme-primary)', fontSize: '0.95rem' }}>
                                {p.total}점
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* 채점 가이드라인 */}
            <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', fontSize: '0.8rem', color: '#475569', lineHeight: '1.65', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: 0, fontWeight: '800', color: '#e11d48' }}>💡 채점 가이드라인 (Sailing Low-Point System):</p>
              <p style={{ margin: '4px 0 0 0' }}>
                1. <strong>등수 미입력자 자동 DNS 간주</strong>: 순위 확정란에서 진행된 라운드에 등수 입력이 없으면 모두 <strong>DNS (출발하지 않음)</strong>로 간주됩니다.
              </p>
              <p style={{ margin: '2px 0 0 0' }}>
                2. <strong>DNS (출발하지 않음)의 점수</strong>: 출전 등록을 마친 전체 선수 인원 수 + 1점 (현재 {participants.length}명 기준 <strong>{participants.length + 1}점</strong> / 40명 기준 41점 부여).
              </p>
              <p style={{ margin: '2px 0 0 0' }}>
                3. <strong>DNF (완주하지 못함)의 점수</strong>:{' '}
                {dnsDnfRule === 'FINISHER_PLUS_ONE'
                  ? `해당 레이스에 실제로 출발하여 결승선을 통과한(완주한) 선수 수 + 1점 (예: 40명 출발 중 35명 완주 시 36점 부여). 상단 규칙 설정에서 '참가신청자 + 1점(${participants.length + 1}점)'으로도 변경 가능합니다.`
                  : `현재 상단 규칙 설정에 따라 DNS와 동일하게 참가신청자 수 + 1점(${participants.length + 1}점)이 부여됩니다. ('완주자 수 + 1점' 규칙으로도 전환 가능)`}
              </p>
              <p style={{ margin: '2px 0 0 0' }}>4. 4경기 이상 진행 시, 가장 성적이 나쁜 경기(가장 큰 숫자 또는 벌점) 1개가 총점에서 자동 제외됩니다.</p>
              <p style={{ margin: '2px 0 0 0' }}>5. <strong>[순위 자동 정렬]</strong>을 누르면 DNS/DNF 점수가 합산된 총점 오름차순(낮은 점수가 상위)으로 순위가 부여되며, <strong>[순위 최종 확정]</strong> 시 리더보드에 반영됩니다.</p>
            </div>

          </div>
        )}

      </div>

      {/* ── 모바일 전용 DNS/DNF 간편 입력 바 (확정란 셀 포커스 시 표시) ── */}
      {activeMode === 'confirm' && activeCell && (
        <div className="no-print" style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#1e293b',
          borderTop: '1px solid #334155',
          padding: '14px 20px',
          display: 'flex',
          gap: '10px',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)'
        }}>
          <div style={{ marginRight: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700' }}>선택된 셀</span>
            <span style={{ fontSize: '0.85rem', color: '#f1f5f9', fontWeight: '800' }}>
              {participants.find(p => p.id === activeCell.id)?.name || ''} ({activeCell.roundKey.toUpperCase()})
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              handleScoreInput(activeCell.id, activeCell.roundKey, 'DNS');
              setActiveCell(null);
            }}
            style={{
              flex: 1,
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 8px',
              fontWeight: '800',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            DNS ({getDnsPenaltyScore(participants)}점)
          </button>
          <button
            type="button"
            onClick={() => {
              handleScoreInput(activeCell.id, activeCell.roundKey, 'DNF');
              setActiveCell(null);
            }}
            style={{
              flex: 1,
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 8px',
              fontWeight: '800',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            DNF ({getDnfPenaltyScore(activeCell.roundKey, participants, dnsDnfRule)}점)
          </button>
          <button
            type="button"
            onClick={() => {
              handleScoreInput(activeCell.id, activeCell.roundKey, '');
              setActiveCell(null);
            }}
            style={{
              background: '#475569',
              color: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 12px',
              fontWeight: '800',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            비우기
          </button>
          <button
            type="button"
            onClick={() => setActiveCell(null)}
            style={{
              background: '#334155',
              color: '#94a3b8',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 12px',
              fontWeight: '800',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            닫기
          </button>
        </div>
      )}

      {/* ── 인쇄 전용 공식 결과 보고서 (화면에서는 숨김, 인쇄 시에만 A4 규격으로 노출) ── */}
      {(() => {
        const isTeam = activeDivisionTab === '단체전';
        const isSplit = isAgeSplitDivision(activeDivisionTab);

        const renderPrintTableSheet = ({
          titleDivision,
          subclassLabel,
          sheetParticipants,
          showClassColumn = false,
          isFirstPage = false,
        }: {
          titleDivision: string;
          subclassLabel?: string;
          sheetParticipants: any[];
          showClassColumn?: boolean;
          isFirstPage?: boolean;
        }) => {
          const hasScores = sheetParticipants.some(p =>
            rounds.some(r => p[r.key] !== null && p[r.key] !== undefined && p[r.key] !== '')
          );
          const rankedList = hasScores
            ? sortAndRankParticipants(sheetParticipants, rounds, dnsDnfRule, false)
            : sheetParticipants.map((p, idx) => ({ ...p, rank: p.rank && p.rank !== '-' ? p.rank : idx + 1 }));

          return (
            <div
              key={subclassLabel || titleDivision}
              className={`official-print-document ${!isFirstPage ? 'print-page-break' : ''}`}
            >
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '14px' }}>
                <h1 style={{ fontSize: '19pt', fontWeight: '900', margin: '0 0 4px 0', letterSpacing: '-0.02em', color: '#000' }}>
                  {activeTournament?.title || '제20회 이순신장군배 전국윈드서핑대회'}
                </h1>
                <h2 style={{ fontSize: '14pt', fontWeight: '800', margin: '0 0 6px 0', color: '#111' }}>
                  [ {titleDivision}{subclassLabel ? ` - ${subclassLabel}` : ''} ] 공식 경기 결과 및 순위표
                </h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5pt', color: '#333', marginTop: '6px' }}>
                  <span>• 대회 기간: {activeTournament?.startDate || '2026. 10. 31'} ~ {activeTournament?.endDate || '11. 01'}</span>
                  <span>• 장소: 경상남도 통영시 도남동 수륙해수욕장 일원</span>
                  <span>• 확정/출력일시: {confirmedTime || new Date().toLocaleString('ko-KR')}</span>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', textAlign: 'center', color: '#000' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderTop: '2px solid #000', borderBottom: '2px solid #000' }}>
                    <th style={{ padding: '6px 2px', width: '42px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>순위</th>
                    {showClassColumn && (
                      <th style={{ padding: '6px 2px', width: '56px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>클라스</th>
                    )}
                    <th style={{ padding: '6px 2px', width: '85px', minWidth: '85px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>배번</th>
                    <th style={{ padding: '6px 2px', width: '60px', minWidth: '55px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>{isTeam ? '팀명 (소속클럽)' : '선수명'}</th>
                    <th style={{ padding: '6px 2px', width: '70px', minWidth: '65px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>{isTeam ? '소속협회' : '생년월일'}</th>
                    <th style={{ padding: '6px 4px', minWidth: '85px', border: '1px solid #cbd5e1' }}>소속협회/클럽</th>
                    {rounds.map(r => (
                      <th key={r.key} style={{ padding: '6px 2px', width: '42px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                        {r.short}
                      </th>
                    ))}
                    <th style={{ padding: '6px 2px', width: '46px', border: '1px solid #cbd5e1', fontWeight: '900', whiteSpace: 'nowrap' }}>총점</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedList.length === 0 ? (
                    <tr>
                      <td colSpan={(showClassColumn ? 7 : 6) + rounds.length} style={{ padding: '24px', border: '1px solid #cbd5e1', color: '#64748b' }}>
                        해당 종목에 출전 선수가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    rankedList.map((p, idx) => {
                      const rankVal = p.rank || idx + 1;
                      const rankText = formatRankDisplay(rankVal, isTeam);
                      const bibDisplay = formatBibShortDisplay(p.bibNumber);
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: '5px 2px', fontWeight: '900', fontSize: '9.5pt', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                            {rankText}
                          </td>
                          {showClassColumn && (
                            <td style={{ padding: '5px 2px', fontSize: '8.5pt', fontWeight: '700', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                              {p.subclass || '일반'}
                            </td>
                          )}
                          <td style={{ padding: '5px 2px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap', fontWeight: '700' }}>
                            {bibDisplay}
                          </td>
                          <td style={{ padding: '5px 2px', fontWeight: '800', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </td>
                          <td style={{ padding: '5px 2px', fontSize: '8.5pt', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                            {p.birth || '-'}
                          </td>
                          <td style={{ padding: '5px 4px', fontSize: '8.5pt', border: '1px solid #cbd5e1' }}>
                            {p.club || '-'}
                          </td>
                          {rounds.map(r => {
                            const conducted = isRoundConducted(r.key, rankedList);
                            const rawVal = p[r.key];
                            const effective =
                              rawVal === null || rawVal === undefined || rawVal === ''
                                ? (conducted ? 'DNS' : '-')
                                : rawVal;
                            return (
                              <td key={r.key} style={{ padding: '5px 2px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                                {effective}
                              </td>
                            );
                          })}
                          <td style={{ padding: '5px 2px', fontWeight: '900', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                            {p.total ?? 0}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* 심판단 서명란 */}
              <div style={{ marginTop: '28px', paddingTop: '14px', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', fontSize: '9.5pt' }}>
                  <p style={{ margin: '0 0 24px 0', fontWeight: '700' }}>기록원 (Scorer)</p>
                  <p style={{ margin: 0, color: '#334155' }}>성명: ________________ (인)</p>
                </div>
                <div style={{ textAlign: 'center', fontSize: '9.5pt' }}>
                  <p style={{ margin: '0 0 24px 0', fontWeight: '700' }}>심판위원장 (Chief Referee)</p>
                  <p style={{ margin: 0, color: '#334155' }}>성명: ________________ (인)</p>
                </div>
                <div style={{ textAlign: 'center', fontSize: '9.5pt' }}>
                  <p style={{ margin: '0 0 24px 0', fontWeight: '700' }}>경기위원장 (Race Committee)</p>
                  <p style={{ margin: 0, color: '#334155' }}>성명: ________________ (인)</p>
                </div>
              </div>
            </div>
          );
        };

        if (!isSplit) {
          return renderPrintTableSheet({
            titleDivision: activeDivisionTab,
            sheetParticipants: participants,
            showClassColumn: false,
            isFirstPage: true
          });
        }

        const subclasses = ['청년부', '중년부', '장년부'];

        if (selectedSubclassTab === 'overall') {
          return renderPrintTableSheet({
            titleDivision: `${activeDivisionTab} (전체 종합)`,
            sheetParticipants: participants,
            showClassColumn: true,
            isFirstPage: true
          });
        }

        if (subclasses.includes(selectedSubclassTab)) {
          const classMembers = participants.filter(p => p.subclass === selectedSubclassTab);
          return renderPrintTableSheet({
            titleDivision: activeDivisionTab,
            subclassLabel: selectedSubclassTab,
            sheetParticipants: classMembers,
            showClassColumn: false,
            isFirstPage: true
          });
        }

        // selectedSubclassTab === 'all' (전체 종합 + 각 클라스별 일괄 인쇄)
        return (
          <>
            {renderPrintTableSheet({
              titleDivision: `${activeDivisionTab} (전체 종합)`,
              sheetParticipants: participants,
              showClassColumn: true,
              isFirstPage: true
            })}
            {subclasses.map(sc => {
              const classMembers = participants.filter(p => p.subclass === sc);
              return renderPrintTableSheet({
                titleDivision: activeDivisionTab,
                subclassLabel: sc,
                sheetParticipants: classMembers,
                showClassColumn: false,
                isFirstPage: false
              });
            })}
          </>
        );
      })()}

    </div>
  );
}
