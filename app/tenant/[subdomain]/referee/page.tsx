'use client';

import React, { useState, useEffect, use } from 'react';
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
  AlertCircle
} from 'lucide-react';

export interface RoundItem {
  key: string;
  label: string;
  short: string;
}

const DEFAULT_ROUNDS: RoundItem[] = [
  { key: 'r1', label: '1라운드 (1R)', short: '1R' },
  { key: 'r2', label: '2라운드 (2R)', short: '2R' },
  { key: 'r3', label: '3라운드 (3R)', short: '3R' },
  { key: 'r4', label: '4라운드 (4R)', short: '4R' },
  { key: 'r5', label: '5라운드 (5R)', short: '5R' },
  { key: 'r6', label: '6라운드 (6R)', short: '6R' },
];

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

  // 라운드 동적 관리 상태
  const [rounds, setRounds] = useState<RoundItem[]>(DEFAULT_ROUNDS);

  // 모드 분리 상태: 'input' (순위 입력란) vs 'confirm' (순위 확정 및 검토란)
  const [activeMode, setActiveMode] = useState<'input' | 'confirm'>('input');

  // 참가자 목록 및 종목 선택
  const [rawRegistrations, setRawRegistrations] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [activeDivisionTab, setActiveDivisionTab] = useState<string>('윈드포일 (남자부)');
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
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      if (res.ok) {
        setIsAuthenticated(true);
        setAuthError('');
      } else {
        const data = await res.json();
        setAuthError(data.message || '비밀번호가 올바르지 않습니다.');
        setPasswordInput('');
      }
    } catch {
      setAuthError('서버 연결 오류가 발생했습니다. 다시 시도해 주세요.');
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
      const res = await fetch(`/api/tenant/${subdomain}/registrations?tournamentId=${tId}`);
      const data = await res.json();
      if (data.registrations) {
        const parsed = data.registrations
          .filter((r: any) => r.status === 'APPROVED')
          .map((r: any) => {
            let birth = '';
            let division = '윈드포일 (남자부)';
            try {
              if (r.formResponses) {
                const extra = JSON.parse(r.formResponses);
                birth = extra.birth || '';
                division = extra.division || '윈드포일 (남자부)';
              }
            } catch (e) {}

            const baseObj: any = {
              id: r.id,
              name: r.player.name,
              birth,
              division,
              bibNumber: r.bibNumber || '',
              total: 0,
              rank: '-'
            };
            DEFAULT_ROUNDS.forEach(rd => {
              baseObj[rd.key] = null;
            });
            return baseObj;
          });
        setRawRegistrations(parsed);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadLeaderboardForDivision = async (tId: string, divisionName: string, baseRegistrations: any[]) => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/leaderboard?tournamentId=${tId}&division=${encodeURIComponent(divisionName)}`);
      const data = await res.json();
      if (data.leaderboard && data.leaderboard.length > 0) {
        // 1. 저장된 리더보드에서 라운드 키 감지 (r1, r2, ... rN)
        const discoveredRoundKeys = new Set<string>();
        data.leaderboard.forEach((item: any) => {
          Object.keys(item).forEach(k => {
            if (/^r\d+$/.test(k)) {
              discoveredRoundKeys.add(k);
            }
          });
        });

        let activeRounds = [...DEFAULT_ROUNDS];
        if (discoveredRoundKeys.size > 0) {
          const sortedKeys = Array.from(discoveredRoundKeys).sort((a, b) => {
            const numA = parseInt(a.replace('r', ''), 10);
            const numB = parseInt(b.replace('r', ''), 10);
            return numA - numB;
          });
          const maxNum = Math.max(...sortedKeys.map(k => parseInt(k.replace('r', ''), 10)), 6);
          activeRounds = Array.from({ length: maxNum }, (_, idx) => {
            const num = idx + 1;
            return {
              key: `r${num}`,
              label: `${num}라운드 (${num}R)`,
              short: `${num}R`
            };
          });
        }
        setRounds(activeRounds);

        const parseSavedRoundVal = (val: any) => {
          if (val === undefined || val === null || val === '') return null;
          if (val === 'DNS' || val === 'DNF') return val;
          const num = Number(val);
          return isNaN(num) ? null : num;
        };

        const mapped = baseRegistrations.map((player) => {
          const savedRow = data.leaderboard.find((lItem: any) => lItem.name === player.name);
          const updated: any = { ...player };
          if (savedRow) {
            updated.bibNumber = savedRow.bibNumber || player.bibNumber;
            updated.rank = savedRow.rank || '-';
            activeRounds.forEach(r => {
              updated[r.key] = parseSavedRoundVal(savedRow[r.key]);
            });
          } else {
            activeRounds.forEach(r => {
              updated[r.key] = null;
            });
          }
          updated.total = calculateTotal(updated, baseRegistrations.length, activeRounds);
          return updated;
        });

        mapped.sort((a, b) => {
          if (a.rank === '-' && b.rank !== '-') return 1;
          if (a.rank !== '-' && b.rank === '-') return -1;
          if (a.rank === '-' && b.rank === '-') return 0;
          return Number(a.rank) - Number(b.rank);
        });
        setParticipants(mapped);
      } else {
        const initialized = baseRegistrations.map(p => {
          const obj: any = { ...p };
          rounds.forEach(r => { obj[r.key] = null; });
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
    if (activeTournament && rawRegistrations.length > 0) {
      const filteredBase = rawRegistrations.filter(r => r.division === activeDivisionTab);
      loadLeaderboardForDivision(activeTournament.id, activeDivisionTab, filteredBase);
      setCurrentRankNum(1);
      setBibInput('');
      setInputFeedback(null);
    } else {
      setParticipants([]);
    }
  }, [activeDivisionTab, rawRegistrations, activeTournament]);

  // 점수 및 총점 계산 (Sailing Low-point System)
  const calculateTotal = (row: any, totalParticipants: number, activeRoundsList: RoundItem[] = rounds) => {
    const roundValues = activeRoundsList.map(r => row[r.key]);
    const validScores = roundValues.map(r => {
      if (r === null || r === undefined || r === '') return null;
      if (r === 'DNS' || r === 'DNF') return totalParticipants;
      const num = Number(r);
      return isNaN(num) ? null : num;
    }).filter((val): val is number => val !== null);

    if (validScores.length === 0) return 0;
    
    const sum = validScores.reduce((acc, curr) => acc + curr, 0);
    if (validScores.length >= 4) {
      const maxVal = Math.max(...validScores);
      return sum - maxVal; // 가장 높은 점수(가장 성적이 나쁜 라운드 1개) 제외
    }
    return sum;
  };

  // ── [동적 라운드 추가 / 삭제 핸들러] ──
  // 라운드 추가 (+1R)
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

    setParticipants(prev =>
      prev.map(p => ({
        ...p,
        [newKey]: null
      }))
    );
    setSelectedRound(newKey);
    setCurrentRankNum(1);
    setInputFeedback({ text: `✨ [${nextNum}R] 라운드가 추가되었습니다!`, isError: false });
  };

  // 특정 라운드 삭제
  const handleDeleteRound = (roundKeyToDelete?: string) => {
    if (rounds.length <= 1) {
      alert('최소 1개 이상의 라운드가 유지되어야 합니다.');
      return;
    }

    const targetKey = roundKeyToDelete || selectedRound;
    const targetRound = rounds.find(r => r.key === targetKey);
    const targetName = targetRound ? targetRound.short : targetKey;

    const confirmed = window.confirm(
      `정말 [${targetName}] 라운드를 삭제하시겠습니까?\n해당 라운드에 입력된 모든 선수의 순위 및 점수가 영구 삭제됩니다.`
    );
    if (!confirmed) return;

    const updatedRounds = rounds.filter(r => r.key !== targetKey);
    setRounds(updatedRounds);

    setParticipants(prev =>
      prev.map(p => {
        const updated = { ...p };
        delete updated[targetKey];
        updated.total = calculateTotal(updated, prev.length, updatedRounds);
        return updated;
      })
    );

    if (selectedRound === targetKey) {
      setSelectedRound(updatedRounds[updatedRounds.length - 1].key);
      setCurrentRankNum(1);
    }
    setInputFeedback({ text: `🗑️ [${targetName}] 라운드가 삭제되었습니다.`, isError: false });
  };

  // 현재 라운드 전체 순위 초기화(전체 삭제)
  const handleResetRoundScores = () => {
    const targetRound = rounds.find(r => r.key === selectedRound);
    const targetName = targetRound ? targetRound.short : selectedRound;

    const confirmed = window.confirm(
      `정말 [${targetName}] 라운드의 모든 순위 입력을 초기화(전체 삭제)하시겠습니까?`
    );
    if (!confirmed) return;

    setParticipants(prev =>
      prev.map(p => {
        const updated = { ...p, [selectedRound]: null };
        updated.total = calculateTotal(updated, prev.length, rounds);
        return updated;
      })
    );
    setCurrentRankNum(1);
    setBibInput('');
    setInputFeedback({ text: `🧹 [${targetName}] 라운드의 모든 순위가 초기화되었습니다.`, isError: false });
  };

  // 개별 셀 점수 직접 입력 핸들러 (확정란 그리드 수정용)
  const handleScoreInput = (id: string, roundKey: string, valString: string) => {
    let val: any = valString.trim().toUpperCase();
    if (val === '') {
      val = null;
    } else if (val === 'DNS' || val === 'DNF') {
      // DNS / DNF 유지
    } else {
      const num = Number(val);
      val = isNaN(num) || num <= 0 ? null : num;
    }

    setParticipants(prev =>
      prev.map(p => {
        if (p.id === id) {
          const updated = { ...p, [roundKey]: val };
          updated.total = calculateTotal(updated, prev.length, rounds);
          return updated;
        }
        return p;
      })
    );
  };

  // ── [순위 입력란 전용 로직] ──
  // 특정 선수에게 특정 라운드의 순위(점수) 부여
  const assignRankToPlayer = (playerId: string, roundKey: string, scoreOrRank: number | 'DNS' | 'DNF' | null) => {
    setParticipants(prev =>
      prev.map(p => {
        if (p.id === playerId) {
          const updated = { ...p, [roundKey]: scoreOrRank };
          updated.total = calculateTotal(updated, prev.length, rounds);
          return updated;
        }
        // 만약 다른 선수가 이미 해당 순위 번호를 가지고 있었다면 해제 (중복 방지)
        if (typeof scoreOrRank === 'number' && p[roundKey] === scoreOrRank) {
          const updated = { ...p, [roundKey]: null };
          updated.total = calculateTotal(updated, prev.length, rounds);
          return updated;
        }
        return p;
      })
    );
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
      p => (p.bibNumber && p.bibNumber.trim().toLowerCase() === cleanBib.toLowerCase()) ||
           p.name.trim().toLowerCase() === cleanBib.toLowerCase()
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

  // 순위 자동 정렬
  const handleSortRankings = () => {
    const sorted = [...participants].sort((a, b) => {
      const aHasScores = rounds.some(r => a[r.key] !== null && a[r.key] !== undefined && a[r.key] !== '');
      const bHasScores = rounds.some(r => b[r.key] !== null && b[r.key] !== undefined && b[r.key] !== '');
      if (!aHasScores && bHasScores) return 1;
      if (aHasScores && !bHasScores) return -1;
      if (!aHasScores && !bHasScores) return 0;
      
      return a.total - b.total;
    });

    const ranked = sorted.map((p, idx) => ({
      ...p,
      rank: idx + 1
    }));

    setParticipants(ranked);
    alert('순위 정렬 및 공식 순위 부여가 완료되었습니다! "순위 최종 확정" 버튼을 눌러 실시간 리더보드에 반영해주세요.');
  };

  // 최종 리더보드 서버 저장 (확정)
  const handleConfirmLeaderboard = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: activeTournament.id,
          division: activeDivisionTab,
          list: participants
        })
      });
      if (res.ok) {
        alert('순위가 공식 확정되었으며 홈페이지 실시간 리더보드에 즉시 반영되었습니다!');
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

  // 인증 게이트 UI
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
            접근 권한 확인이 필요합니다
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

  // 종목 옵션 목록 추출
  const divisionField = formFields.find((f: any) => f.id === 'division');
  const configuredDivisions = divisionField?.options || [];
  const registeredDivisions = Array.from(new Set(rawRegistrations.map((r: any) => r.division).filter(Boolean))) as string[];
  const divisionTabs = Array.from(new Set([...configuredDivisions, ...registeredDivisions]));
  if (divisionTabs.length === 0) {
    divisionTabs.push(
      '윈드포일 (남자부)',
      '윈드포일 (여자부)',
      '윙포일 (남자부)',
      '윙포일 (여자부)',
      '혼합오픈 (남자부)',
      '혼합오픈 (여자부)',
      '펀엔포뮬러 (남자부)',
      '펀엔포뮬러 (여자부)'
    );
  }

  // 선택된 라운드 기준 참가자 데이터 집계
  const currentRankPlayer = participants.find(p => p[selectedRound] === currentRankNum);
  const matchedTypingPlayer = bibInput.trim()
    ? participants.find(
        p => (p.bibNumber && p.bibNumber.trim().toLowerCase() === bibInput.trim().toLowerCase()) ||
             p.name.trim() === bibInput.trim()
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
      </header>

      <div style={{ maxWidth: '850px', margin: '0 auto', padding: '16px 12px 60px 12px' }}>
        
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
            onClick={() => setActiveMode('confirm')}
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
                승인 선수: {participants.length}명
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
                    onClick={() => handleDeleteRound(selectedRound)}
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
                    title="선택된 현재 라운드를 삭제합니다"
                  >
                    <Trash2 size={13} /> 라운드 삭제
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

              {/* 배번 입력 / 수정 폼 */}
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
                          {assigned ? (
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
                  onClick={() => setActiveMode('confirm')}
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
                  각 라운드 점수를 직접 클릭하여 수정하거나 순위를 정렬 후 확정하세요.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
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
                  <Trash2 size={14} /> 마지막 라운드 삭제
                </button>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleSortRankings}
                className="btn-secondary"
                style={{
                  flex: 1,
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
                <ListOrdered size={18} /> 순위 자동 정렬
              </button>
              <button
                type="button"
                onClick={handleConfirmLeaderboard}
                disabled={submitting}
                className="btn-primary"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '13px',
                  fontSize: '0.92rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                }}
              >
                <CheckCircle2 size={18} /> 순위 최종 확정 (공개)
              </button>
            </div>

            {/* 전체 참가자 & 라운드별 점수 스프레드시트 테이블 (직접 수정 가능) */}
            <div style={{ overflowX: 'auto', width: '100%', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 6px', width: '45px', textAlign: 'center' }}>순위</th>
                    <th style={{ padding: '10px 8px', minWidth: '80px', textAlign: 'left' }}>이름</th>
                    <th style={{ padding: '10px 6px', width: '60px', textAlign: 'center' }}>배번</th>
                    <th style={{ padding: '10px 6px', width: '70px', textAlign: 'center' }}>생년월일</th>
                    {rounds.map(r => (
                      <th key={r.key} style={{ padding: '10px 4px', width: '50px', textAlign: 'center', color: '#1e293b' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span>{r.short}</span>
                        </div>
                      </th>
                    ))}
                    <th style={{ padding: '10px 6px', width: '60px', textAlign: 'center', color: 'var(--theme-primary)' }}>총점</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.length === 0 ? (
                    <tr>
                      <td colSpan={5 + rounds.length} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                        해당 종목에 승인된 신청자가 없거나 데이터를 불러올 수 없습니다.
                      </td>
                    </tr>
                  ) : (
                    participants.map((p) => {
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {/* 순위 */}
                          <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: '900', color: p.rank === 1 ? '#d97706' : '#0f172a' }}>
                            {p.rank}
                          </td>
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
                          {/* 라운드 스코어들 (직접 수정 가능) */}
                          {rounds.map((rItem) => {
                            const rKey = rItem.key;
                            return (
                              <td key={rKey} style={{ padding: '4px', textAlign: 'center' }}>
                                <input
                                  type="text"
                                  value={p[rKey] === null || p[rKey] === undefined ? '' : p[rKey]}
                                  onChange={(e) => handleScoreInput(p.id, rKey, e.target.value)}
                                  onFocus={() => setActiveCell({ id: p.id, roundKey: rKey })}
                                  placeholder="-"
                                  style={{
                                    width: '40px',
                                    padding: '6px 2px',
                                    border: activeCell?.id === p.id && activeCell?.roundKey === rKey ? '2px solid var(--theme-primary)' : '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    textAlign: 'center',
                                    fontSize: '0.85rem',
                                    fontWeight: '800',
                                    background: p[rKey] === 'DNS' || p[rKey] === 'DNF' ? '#fee2e2' : 'white',
                                    color: p[rKey] === 'DNS' || p[rKey] === 'DNF' ? '#dc2626' : '#0f172a'
                                  }}
                                />
                              </td>
                            );
                          })}
                          {/* 총점 */}
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: '900', color: 'var(--theme-primary)' }}>
                            {p.total}점
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 채점 가이드라인 */}
            <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', fontSize: '0.8rem', color: '#475569', lineHeight: '1.6', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: 0, fontWeight: '800', color: '#e11d48' }}>💡 채점 가이드라인 (Sailing Low-Point System):</p>
              <p style={{ margin: '4px 0 0 0' }}>1. 각 라운드 셀에 피니시 순위(1, 2, 3...)를 입력하거나 부정출발/미완주 시 **DNS** 또는 **DNF**를 선택/입력하세요.</p>
              <p style={{ margin: '2px 0 0 0' }}>2. **DNS/DNF**의 경우 해당 부서 전체 참가 선수 인원 수({participants.length}점)가 벌점으로 가산됩니다.</p>
              <p style={{ margin: '2px 0 0 0' }}>3. 4경기 이상 입력 시, 가장 성적이 나쁜 경기(가장 큰 숫자 또는 벌점) 1개가 총점에서 자동 제외됩니다.</p>
              <p style={{ margin: '2px 0 0 0' }}>4. 입력 후 <strong>[순위 자동 정렬]</strong>을 누르면 총점 오름차순으로 정렬되며 공식 순위가 재부여됩니다.</p>
              <p style={{ margin: '2px 0 0 0' }}>5. 마지막으로 <strong>[순위 최종 확정]</strong> 버튼을 눌러야 메인 전광판 및 홈페이지 리더보드에 즉시 반영됩니다.</p>
            </div>

          </div>
        )}

      </div>

      {/* ── 모바일 전용 DNS/DNF 간편 입력 바 (확정란 셀 포커스 시 표시) ── */}
      {activeMode === 'confirm' && activeCell && (
        <div style={{
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
            DNS 입력
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
            DNF 입력
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

    </div>
  );
}
