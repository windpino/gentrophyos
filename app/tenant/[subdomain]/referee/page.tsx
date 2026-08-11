'use client';

import React, { useState, useEffect, use } from 'react';
import { Play, CheckCircle2, ChevronLeft, Plus, Minus, User, RefreshCw, AlertTriangle } from 'lucide-react';

interface Match {
  id: string;
  round: number;
  matchType: string;
  status: string;
  scheduledAt: string | null;
  participants: Array<{
    playerId: string;
    score: number;
    isWinner: boolean;
    details?: string | null;
    player: {
      name: string;
      uniqueCode: string;
    };
  }>;
}

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

  // 대진 경기 목록
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [activeDivisionTab, setActiveDivisionTab] = useState<string>('윈드포일');

  // 현재 채점 중인 점수판 상태
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  
  // 실시간 세부 지표 모킹 (득실차, 다득점 계산을 돕기 위해)
  // 배드민턴 랠리 스코어(21점 3세트 등)의 총 획득 포인트를 간단히 입력할 수 있는 필드도 동시 탑재
  const [ptsWon1, setPtsWon1] = useState(0);
  const [ptsLost1, setPtsLost1] = useState(0);
  const [ptsWon2, setPtsWon2] = useState(0);
  const [ptsLost2, setPtsLost2] = useState(0);

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
        setAuthError('비밀번호가 올바르지 않습니다.');
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
          await fetchMatches(ongoing.id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async (tId: string) => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/matches?tournamentId=${tId}`);
      const data = await res.json();
      if (data.matches) {
        setMatches(data.matches);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 경기 선택 및 스코어판 초기화
  const handleSelectMatch = (match: Match) => {
    setSelectedMatch(match);
    const p1 = match.participants[0];
    const p2 = match.participants[1];
    
    // 이전 점수 로드
    setScore1(p1 ? p1.score : 0);
    setScore2(p2 ? p2.score : 0);

    // 세부 포인트 로드
    let pw1 = 0, pl1 = 0, pw2 = 0, pl2 = 0;
    try {
      if (p1 && p1.details) {
        const d1 = JSON.parse(p1.details);
        pw1 = d1.pointsWon || 0;
        pl1 = d1.pointsLost || 0;
      }
      if (p2 && p2.details) {
        const d2 = JSON.parse(p2.details);
        pw2 = d2.pointsWon || 0;
        pl2 = d2.pointsLost || 0;
      }
    } catch (e) {
      // 기본값 유지
    }
    
    setPtsWon1(pw1);
    setPtsLost1(pl1);
    setPtsWon2(pw2);
    setPtsLost2(pl2);
  };

  // 실시간 점수 가산/감산 및 API 전송
  const handleScoreChange = async (playerNum: 1 | 2, action: 'inc' | 'dec') => {
    if (!selectedMatch) return;

    let ns1 = score1;
    let ns2 = score2;

    if (playerNum === 1) {
      ns1 = action === 'inc' ? score1 + 1 : Math.max(0, score1 - 1);
      setScore1(ns1);
    } else {
      ns2 = action === 'inc' ? score2 + 1 : Math.max(0, score2 - 1);
      setScore2(ns2);
    }

    // 경기 실시간 데이터 업데이트 ( status: ONGOING )
    // 심판이 매치 도중 점수 올릴 때마다 리더보드에 점수가 누적 갱신되어 전광판처럼 보여야 함
    try {
      const p1 = selectedMatch.participants[0];
      const p2 = selectedMatch.participants[1];

      await fetch(`/api/tenant/${subdomain}/matches/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: selectedMatch.id,
          p1Id: p1.playerId,
          p2Id: p2.playerId,
          p1Score: ns1,
          p2Score: ns2,
          isCompleted: false, // 아직 경기 진행 중인 상태로 데이터 전송
        }),
      });
    } catch (e) {
      console.error('실시간 점수 전송 실패:', e);
    }
  };

  // 경기 종료 처리
  const handleSubmitFinalScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatch) return;

    const p1 = selectedMatch.participants[0];
    const p2 = selectedMatch.participants[1];

    if (!p1 || !p2) {
      alert('참가 선수가 매핑되지 않아 경기 종료가 불가능합니다.');
      return;
    }

    if (score1 === score2) {
      alert('토너먼트/리그 경기이므로 무승부 채점 외 확실한 판정을 권장합니다.');
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/tenant/${subdomain}/matches/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: selectedMatch.id,
          p1Id: p1.playerId,
          p2Id: p2.playerId,
          p1Score: score1,
          p2Score: score2,
          isCompleted: true, // 완벽한 경기 완료 플래그
        }),
      });

      if (res.ok) {
        alert('경기가 종료되었으며, 실시간 리더보드 순위 연산이 즉시 완료되었습니다.');
        setSelectedMatch(null);
        await fetchMatches(activeTournament.id);
      } else {
        const err = await res.json();
        alert(err.error || '제출 실패');
      }
    } catch (err: any) {
      alert(err.message);
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

  // 매치가 속한 종목(Division) 파싱 헬퍼 함수
  const getMatchDivision = (match: Match): string => {
    const p1 = match.participants[0];
    if (p1 && p1.player && (p1.player as any).registrations && (p1.player as any).registrations.length > 0) {
      const reg = (p1.player as any).registrations[0];
      try {
        if (reg.formResponses) {
          const extra = JSON.parse(reg.formResponses);
          return extra.division || '윈드포일';
        }
      } catch (e) {}
    }
    return '윈드포일'; // 기본 매칭
  };

  // 현재 선택된 종목의 대진들만 필터링
  const filteredMatches = matches.filter((match) => {
    return getMatchDivision(match) === activeDivisionTab;
  });

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

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        
        {/* 경기 세부 점수판 모드 */}
        {selectedMatch ? (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* 뒤로가기 */}
            <button
              className="btn-secondary"
              onClick={() => setSelectedMatch(null)}
              style={{ width: 'fit-content', padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <ChevronLeft size={16} /> 경기 목록으로
            </button>

            <div style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-highlight)', fontWeight: '700' }}>
                라운드 {selectedMatch.round} | {selectedMatch.matchType} 경기
              </span>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                실시간 탭하여 입력 시 뷰어 전광판 리더보드에 즉시 연동됩니다.
              </p>
            </div>

            {/* 메인 탭 채점기 (점수가 커야 함) */}
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: '20px' }}>
              
              {/* 선수 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', flex: 1 }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700', minHeight: '50px', display: 'flex', alignItems: 'center' }}>
                  {selectedMatch.participants[0]?.player.name || '미정'}
                </h3>
                
                {/* 점수 전광판 */}
                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '2px solid var(--border-color)',
                  borderRadius: '20px',
                  width: '120px',
                  height: '140px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '4.5rem',
                  fontWeight: '900',
                  fontFamily: 'var(--font-title)',
                  color: 'white',
                  textShadow: '0 0 10px rgba(255,255,255,0.2)',
                }}>
                  {score1}
                </div>

                {/* 컨트롤 버튼 */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    className="btn-secondary"
                    style={{ borderRadius: '50%', width: '50px', height: '50px', padding: 0, justifyContent: 'center' }}
                    onClick={() => handleScoreChange(1, 'dec')}
                  >
                    <Minus size={20} />
                  </button>
                  <button
                    className="btn-primary"
                    style={{ borderRadius: '50%', width: '50px', height: '50px', padding: 0, justifyContent: 'center' }}
                    onClick={() => handleScoreChange(1, 'inc')}
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-muted)' }}>VS</div>

              {/* 선수 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', flex: 1 }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700', minHeight: '50px', display: 'flex', alignItems: 'center' }}>
                  {selectedMatch.participants[1]?.player.name || '미정'}
                </h3>
                
                {/* 점수 전광판 */}
                <div style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '2px solid var(--border-color)',
                  borderRadius: '20px',
                  width: '120px',
                  height: '140px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '4.5rem',
                  fontWeight: '900',
                  fontFamily: 'var(--font-title)',
                  color: 'white',
                  textShadow: '0 0 10px rgba(255,255,255,0.2)',
                }}>
                  {score2}
                </div>

                {/* 컨트롤 버튼 */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    className="btn-secondary"
                    style={{ borderRadius: '50%', width: '50px', height: '50px', padding: 0, justifyContent: 'center' }}
                    onClick={() => handleScoreChange(2, 'dec')}
                  >
                    <Minus size={20} />
                  </button>
                  <button
                    className="btn-primary"
                    style={{ borderRadius: '50%', width: '50px', height: '50px', padding: 0, justifyContent: 'center' }}
                    onClick={() => handleScoreChange(2, 'inc')}
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

            </div>

            {/* 경기 최종 종료 및 스탯 동기화 전송 */}
            <form onSubmit={handleSubmitFinalScore} style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
              <div style={{
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginBottom: '20px',
                fontSize: '0.85rem'
              }}>
                <AlertTriangle size={18} style={{ color: '#F59E0B', flexShrink: 0 }} />
                <p style={{ color: '#F3F4F6' }}>
                  [주의] <strong>최종 종료</strong> 버튼을 누르면 이 매치의 스코어 기록이 승률, 다득점, 득실차에 공식 합산되어 실시간 순위 변동에 완벽히 반영됩니다.
                </p>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '16px' }}
                disabled={submitting}
              >
                <CheckCircle2 size={18} /> 최종 경기 종료 및 공식 제출
              </button>
            </form>

          </div>
        ) : (
          
          /* 경기 대진 리스트 모드 */
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>오늘의 담당 배정 대진 목록</h2>

            {/* 종목별 대진 탭바 */}
            <div style={{
              display: 'flex',
              gap: '6px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '12px',
              overflowX: 'auto',
              width: '100%'
            }}>
              {['윈드포일', '윙포일', '혼합오픈', '펀엔포뮬러'].map((div) => {
                const active = activeDivisionTab === div;
                return (
                  <button
                    key={div}
                    onClick={() => setActiveDivisionTab(div)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: 'none',
                      background: active ? 'var(--theme-primary)' : 'rgba(255,255,255,0.05)',
                      color: active ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {div}
                  </button>
                );
              })}
            </div>

            {filteredMatches.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
                선택하신 종목({activeDivisionTab})에 배정된 대진표가 없습니다.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredMatches.map((match) => {
                  const p1 = match.participants[0];
                  const p2 = match.participants[1];
                  return (
                    <div
                      key={match.id}
                      style={{
                        padding: '16px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderColor: match.status === 'ONGOING' ? 'var(--theme-primary)' : 'var(--border-color)'
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          라운드 {match.round} | {match.matchType}
                        </span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                          <span style={{ fontWeight: '600', fontSize: '1.1rem' }}>{p1?.player.name || '미배정'}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>vs</span>
                          <span style={{ fontWeight: '600', fontSize: '1.1rem' }}>{p2?.player.name || '미정'}</span>
                        </div>

                        {match.status === 'COMPLETED' && (
                          <div style={{ display: 'inline-block', marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-highlight)', fontWeight: '700' }}>
                            스코어: {p1?.score} 대 {p2?.score} (종료됨)
                          </div>
                        )}
                      </div>

                      <button
                        className={match.status === 'COMPLETED' ? 'btn-secondary' : 'btn-primary'}
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        onClick={() => handleSelectMatch(match)}
                      >
                        {match.status === 'COMPLETED' ? '재채점' : '채점하기'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
