'use client';

import React, { useState, useEffect, use } from 'react';
import { CheckCircle2, User, RefreshCw, AlertTriangle, ListOrdered } from 'lucide-react';

export default function RefereeMobilePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);

  // 1. 상태 정의
  const [tenant, setTenant] = useState<any>(null);
  const [activeTournament, setActiveTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 참가자 목록 및 종목 선택
  const [rawRegistrations, setRawRegistrations] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [activeDivisionTab, setActiveDivisionTab] = useState<string>('윈드포일');

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
      const tenantRes = await fetch(`/api/tenant/${subdomain}`);
      const tenantData = await tenantRes.json();
      if (tenantData.tenant) {
        setTenant(tenantData.tenant);
        const ongoing = tenantData.tenant.tournaments.find((t: any) => t.status === 'ONGOING');
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
            let division = '윈드포일';
            try {
              if (r.formResponses) {
                const extra = JSON.parse(r.formResponses);
                birth = extra.birth || '';
                division = extra.division || '윈드포일';
              }
            } catch (e) {}

            return {
              id: r.id,
              name: r.player.name,
              birth,
              division,
              bibNumber: r.bibNumber || '',
              r1: null,
              r2: null,
              r3: null,
              r4: null,
              r5: null,
              r6: null,
              total: 0,
              rank: '-'
            };
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
        const mapped = baseRegistrations.map((player) => {
          const savedRow = data.leaderboard.find((lItem: any) => lItem.name === player.name);
          if (savedRow) {
            return {
              ...player,
              bibNumber: savedRow.bibNumber || player.bibNumber,
              r1: savedRow.r1 !== undefined && savedRow.r1 !== null ? Number(savedRow.r1) : null,
              r2: savedRow.r2 !== undefined && savedRow.r2 !== null ? Number(savedRow.r2) : null,
              r3: savedRow.r3 !== undefined && savedRow.r3 !== null ? Number(savedRow.r3) : null,
              r4: savedRow.r4 !== undefined && savedRow.r4 !== null ? Number(savedRow.r4) : null,
              r5: savedRow.r5 !== undefined && savedRow.r5 !== null ? Number(savedRow.r5) : null,
              r6: savedRow.r6 !== undefined && savedRow.r6 !== null ? Number(savedRow.r6) : null,
              total: savedRow.total !== undefined ? Number(savedRow.total) : 0,
              rank: savedRow.rank || '-'
            };
          }
          return player;
        });
        // Sort mapped list by rank if rank is a number
        mapped.sort((a, b) => {
          if (a.rank === '-' && b.rank !== '-') return 1;
          if (a.rank !== '-' && b.rank === '-') return -1;
          if (a.rank === '-' && b.rank === '-') return 0;
          return Number(a.rank) - Number(b.rank);
        });
        setParticipants(mapped);
      } else {
        setParticipants(baseRegistrations);
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
    } else {
      setParticipants([]);
    }
  }, [activeDivisionTab, rawRegistrations, activeTournament]);

  const calculateTotal = (row: any) => {
    const rounds = [row.r1, row.r2, row.r3, row.r4, row.r5, row.r6];
    const validScores = rounds.filter((r): r is number => r !== null && !isNaN(r));
    if (validScores.length === 0) return 0;
    
    const sum = validScores.reduce((acc, curr) => acc + curr, 0);
    if (validScores.length >= 4) {
      const maxVal = Math.max(...validScores);
      return sum - maxVal; // 가장 높은 점수(가장 성적이 나쁜 라운드) 제외
    }
    return sum;
  };

  const handleScoreInput = (id: string, roundKey: 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6', valString: string) => {
    const val = valString === '' ? null : Number(valString);
    setParticipants(prev =>
      prev.map(p => {
        if (p.id === id) {
          const updated = { ...p, [roundKey]: val };
          updated.total = calculateTotal(updated);
          return updated;
        }
        return p;
      })
    );
  };

  const handleSortRankings = () => {
    const sorted = [...participants].sort((a, b) => {
      const aHasScores = [a.r1, a.r2, a.r3, a.r4, a.r5, a.r6].some(r => r !== null);
      const bHasScores = [b.r1, b.r2, b.r3, b.r4, b.r5, b.r6].some(r => r !== null);
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
    alert('순위 정렬 및 자동 순위 부여가 완료되었습니다! "순위 최종 확정" 버튼을 눌러 실시간 리더보드에 반영해주세요.');
  };

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
          <h1 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white', marginBottom: '6px' }}>심판 입력기</h1>
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
      </div>
    );
  }

  const themeStyles = {
    '--theme-primary': tenant.primaryColor,
    '--theme-primary-hover': tenant.primaryColor + 'cc',
    '--theme-primary-rgb': '99, 102, 241',
  } as React.CSSProperties;

  return (
    <div style={themeStyles} className="animate-fade-in">
      {/* 심판 전용 헤더 */}
      <header
        style={{
          background: 'rgba(0,0,0,0.5)',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <User size={24} style={{ color: 'var(--theme-primary)' }} />
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: '800' }}>심판 모바일 제어기 (Referee UI)</h1>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tenant.name}</span>
        </div>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'white', color: 'black', padding: '20px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>실시간 순위 입력 및 확정</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeDivisionTab} 종목</span>
          </div>

          {/* 종목 선택 Pill Bar */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
            {['윈드포일', '윙포일', '혼합오픈', '펀엔포뮬러'].map((div) => {
              const active = activeDivisionTab === div;
              return (
                <button
                  key={div}
                  onClick={() => setActiveDivisionTab(div)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: active ? 'none' : '1px solid var(--border-color)',
                    background: active ? 'var(--theme-primary)' : '#f1f5f9',
                    color: active ? '#ffffff' : 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {div}
                </button>
              );
            })}
          </div>

          {/* 액션 버튼 */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSortRankings}
              className="btn-secondary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer' }}
            >
              <ListOrdered size={16} /> 순위 자동 정렬
            </button>
            <button
              onClick={handleConfirmLeaderboard}
              disabled={submitting}
              className="btn-primary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer' }}
            >
              <CheckCircle2 size={16} /> 순위 최종 확정
            </button>
          </div>

          {/* 테이블 */}
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '8px', width: '45px', textAlign: 'center' }}>순위</th>
                  <th style={{ padding: '8px', minWidth: '80px', textAlign: 'left' }}>이름</th>
                  <th style={{ padding: '8px', width: '60px', textAlign: 'center' }}>배번</th>
                  <th style={{ padding: '8px', width: '70px', textAlign: 'center' }}>생년월일</th>
                  {['1R', '2R', '3R', '4R', '5R', '6R'].map(r => (
                    <th key={r} style={{ padding: '4px', width: '50px', textAlign: 'center' }}>{r}</th>
                  ))}
                  <th style={{ padding: '8px', width: '60px', textAlign: 'center', color: 'var(--theme-primary)' }}>총점</th>
                </tr>
              </thead>
              <tbody>
                {participants.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      해당 종목에 승인된 신청자가 없거나 데이터를 불러올 수 없습니다.
                    </td>
                  </tr>
                ) : (
                  participants.map((p, idx) => {
                    const rounds = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'] as const;
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {/* 순위 */}
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                          {p.rank}
                        </td>
                        {/* 이름 */}
                        <td style={{ padding: '8px', fontWeight: '800' }}>
                          {p.name}
                        </td>
                        {/* 배번 */}
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <input
                            type="text"
                            value={p.bibNumber || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setParticipants(prev => prev.map(item => item.id === p.id ? { ...item, bibNumber: val } : item));
                            }}
                            placeholder="배번"
                            style={{ width: '45px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', fontSize: '0.8rem' }}
                          />
                        </td>
                        {/* 생년월일 */}
                        <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {p.birth ? p.birth.substring(2) : '-'}
                        </td>
                        {/* 라운드 스코어들 */}
                        {rounds.map((rKey, rIdx) => (
                          <td key={rIdx} style={{ padding: '4px', textAlign: 'center' }}>
                            <input
                              type="number"
                              min="1"
                              value={p[rKey] === null ? '' : p[rKey]}
                              onChange={(e) => handleScoreInput(p.id, rKey, e.target.value)}
                              placeholder="-"
                              style={{ width: '40px', padding: '6px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', fontSize: '0.85rem', fontWeight: '600' }}
                            />
                          </td>
                        ))}
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

          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            <p style={{ margin: 0, fontWeight: '700', color: '#e11d48' }}>💡 채점 가이드라인 (Sailing Low-Point System):</p>
            <p style={{ margin: '4px 0 0 0' }}>1. 라운드 입력란에 각 선수의 피니시 순위(1, 2, 3...)를 정수로 입력하세요.</p>
            <p style={{ margin: '4px 0 0 0' }}>2. 4경기 이상 입력 시, 가장 성적이 나쁜 경기(가장 큰 숫자) 1개가 총점 계산에서 자동으로 제외됩니다.</p>
            <p style={{ margin: '2px 0 0 0' }}>3. 입력 후 [순위 자동 정렬] 버튼을 누르면 총점 오름차순으로 정렬되며 공식 순위가 재부여됩니다.</p>
            <p style={{ margin: '2px 0 0 0' }}>4. 마지막으로 [순위 최종 확정] 버튼을 눌러야 메인 전광판 리더보드에 전체 공개됩니다.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
