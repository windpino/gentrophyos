'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, MapPin, Users, Award, Sparkles, Download } from 'lucide-react';
import { TournamentHistoryEdition } from '@/app/api/tenant/[subdomain]/history/route';

interface PublicHistoryArchiveViewProps {
  subdomain: string;
}

export default function PublicHistoryArchiveView({ subdomain }: PublicHistoryArchiveViewProps) {
  const [editions, setEditions] = useState<TournamentHistoryEdition[]>([]);
  const [selectedEditionId, setSelectedEditionId] = useState<string>('');
  const [selectedDivisionTab, setSelectedDivisionTab] = useState<string>('혼합오픈');
  const [selectedSubclassTab, setSelectedSubclassTab] = useState<string>('전체 종합');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tenant/${subdomain}/history?_t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        if (data.editions && data.editions.length > 0) {
          setEditions(data.editions);
          setSelectedEditionId(data.editions[0].id);
          if (data.editions[0].divisions && data.editions[0].divisions.length > 0) {
            setSelectedDivisionTab(data.editions[0].divisions[0].division);
            setSelectedSubclassTab(data.editions[0].divisions[0].subclass || '전체 종합');
          }
        }
      } catch (e) {
        console.error('역대 기록 조회 실패:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [subdomain]);

  const activeEdition = editions.find(e => e.id === selectedEditionId) || editions[0];

  // 사용 가능한 대분류 종목 목록
  const availableDivisions: string[] = activeEdition?.divisions
    ? Array.from(new Set(activeEdition.divisions.map(d => d.division)))
    : [];

  const currentMainDivision = availableDivisions.includes(selectedDivisionTab)
    ? selectedDivisionTab
    : (availableDivisions[0] || '혼합오픈');

  // 현재 대분류에 속한 세부 클라스/부문 목록
  const currentSubclassItems = activeEdition?.divisions
    ? activeEdition.divisions.filter(d => d.division === currentMainDivision)
    : [];

  // 현재 선택된 세부 종목 데이터
  const activeDivData = currentSubclassItems.find(
    d => d.subclass === selectedSubclassTab
  ) || currentSubclassItems[0] || activeEdition?.divisions?.[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }} className="animate-fade-in">
      
      {/* 헤더 배너 */}
      <div
        className="glass-panel"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.98) 100%)',
          padding: '32px 28px',
          borderRadius: '20px',
          color: 'white',
          textAlign: 'center',
          borderTop: '4px solid var(--theme-gold, #f59e0b)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', color: '#fbbf24', fontWeight: '800' }}>
          <Sparkles size={14} /> 이순신장군배 공식 명예의 전당 (Hall of Fame)
        </div>
        <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>
          🏆 역대 기록관 (회별 · 년도별 최종 순위)
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: 0, maxWidth: '640px', lineHeight: '1.6' }}>
          이순신장군배 전국윈드서핑대회의 자랑스러운 역대 챔피언과 공식 입상자들의 영광스러운 기록을 확인하실 수 있습니다.
        </p>
      </div>

      {/* 회차 및 연도 선택 탭 */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {editions.map((ed) => {
          const isSelected = ed.id === activeEdition?.id;
          return (
            <button
              key={ed.id}
              onClick={() => {
                setSelectedEditionId(ed.id);
                if (ed.divisions && ed.divisions.length > 0) {
                  setSelectedDivisionTab(ed.divisions[0].division);
                  setSelectedSubclassTab(ed.divisions[0].subclass || '전체 종합');
                }
              }}
              style={{
                padding: '12px 22px',
                borderRadius: '12px',
                border: isSelected ? '2px solid var(--theme-primary, #1f6f8b)' : '1px solid #e2e8f0',
                background: isSelected ? 'white' : '#f8fafc',
                color: isSelected ? 'var(--theme-primary, #1f6f8b)' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '2px',
                minWidth: '140px',
                boxShadow: isSelected ? '0 4px 12px rgba(31, 111, 139, 0.15)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: '800', color: isSelected ? 'var(--theme-primary)' : '#94a3b8' }}>
                  {ed.year}년
                </span>
                {ed.edition === 20 && (
                  <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: '800' }}>
                    심판기록관 실시간 연동
                  </span>
                )}
              </div>
              <strong style={{ fontSize: '1rem', fontWeight: '900', color: isSelected ? '#0f172a' : '#475569' }}>
                제{ed.edition}회 대회
              </strong>
            </button>
          );
        })}
      </div>

      {/* 선택된 대회 개요 */}
      {activeEdition && (
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: '800', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                제{activeEdition.edition}회 공식 성적
              </span>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{activeEdition.year}년도 개최</span>
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: '900', margin: '2px 0 6px 0', color: '#0f172a' }}>
              {activeEdition.title}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.84rem', color: '#64748b' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={15} style={{ color: '#94a3b8' }} /> {activeEdition.duration || '-'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MapPin size={15} style={{ color: '#94a3b8' }} /> {activeEdition.location || '-'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Users size={15} style={{ color: '#94a3b8' }} /> {activeEdition.participantCount || 0}명 출전
              </span>
            </div>
          </div>

          {activeEdition.summaryNote && (
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', fontSize: '0.84rem', color: '#334155', lineHeight: '1.6' }}>
              {activeEdition.summaryNote}
            </div>
          )}
        </div>
      )}

      {/* 종목별 포디움 셀렉터 탭 (1단계: 대분류 종목 / 2단계: 세부 클라스 및 남녀 구분) */}
      {availableDivisions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 1단계: 대분류 종목 탭 */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
            {availableDivisions.map((divName) => {
              const isTabActive = currentMainDivision === divName;
              const mainDivAllItem = activeEdition.divisions.find(d => d.division === divName && d.subclass === '전체 종합')
                || activeEdition.divisions.find(d => d.division === divName);
              const count = mainDivAllItem?.count || 0;

              return (
                <button
                  key={divName}
                  onClick={() => {
                    setSelectedDivisionTab(divName);
                    const subItems = activeEdition.divisions.filter(d => d.division === divName);
                    if (subItems.length > 0) {
                      setSelectedSubclassTab(subItems[0].subclass || '전체 종합');
                    }
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '12px',
                    border: isTabActive ? '2px solid var(--theme-primary, #1f6f8b)' : '1px solid #cbd5e1',
                    background: isTabActive ? 'rgba(31, 111, 139, 0.08)' : '#ffffff',
                    color: isTabActive ? 'var(--theme-primary, #1f6f8b)' : '#475569',
                    fontWeight: isTabActive ? '900' : '700',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: isTabActive ? '0 2px 8px rgba(31,111,139,0.12)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{divName}</span>
                  {count > 0 && (
                    <span
                      style={{
                        fontSize: '0.74rem',
                        padding: '1px 7px',
                        borderRadius: '12px',
                        background: isTabActive ? 'var(--theme-primary, #1f6f8b)' : '#f1f5f9',
                        color: isTabActive ? '#ffffff' : '#64748b',
                        fontWeight: '800',
                      }}
                    >
                      {divName === '단체전' ? `${count}팀` : `${count}명`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 2단계: 세부 클라스 및 남녀 구분 필터 (청년부, 중년부, 장년부, 여자부 등) */}
          {currentSubclassItems.length > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                background: '#f8fafc',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748b', marginRight: '4px' }}>
                부문 / 클라스 구분:
              </span>
              {currentSubclassItems.map((subItem) => {
                const isSubActive = activeDivData?.subclass === subItem.subclass;
                return (
                  <button
                    key={subItem.subclass || '전체'}
                    onClick={() => setSelectedSubclassTab(subItem.subclass || '전체 종합')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: isSubActive ? '1.5px solid var(--theme-primary, #1f6f8b)' : '1px solid #cbd5e1',
                      background: isSubActive ? 'var(--theme-primary, #1f6f8b)' : '#ffffff',
                      color: isSubActive ? '#ffffff' : '#334155',
                      fontSize: '0.8rem',
                      fontWeight: isSubActive ? '800' : '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{subItem.subclass}</span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        opacity: isSubActive ? 0.9 : 0.65,
                      }}
                    >
                      ({subItem.count}{subItem.division === '단체전' ? '팀' : '명'})
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 포디움 카드 3인 (1위, 2위, 3위) */}
      {activeDivData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎖️</span>
              <span>{activeDivData.title || `${activeDivData.division} (${activeDivData.subclass})`}</span>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>
                (총 {activeDivData.count}{activeDivData.division === '단체전' ? '팀' : '명'})
              </span>
            </h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {activeDivData.podium?.map((podium) => {
              const styles = [
                { title: '우승 (챔피언)', icon: '🥇', bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
                { title: '준우승 (2위)', icon: '🥈', bg: '#f8fafc', border: '#e2e8f0', text: '#475569' },
                { title: '3위 (동메달)', icon: '🥉', bg: '#fff7ed', border: '#ffedd5', text: '#ea580c' },
              ];
              const s = styles[podium.rank - 1] || styles[0];

              return (
                <div
                  key={podium.rank}
                  style={{
                    background: s.bg,
                    border: `2px solid ${s.border}`,
                    borderRadius: '16px',
                    padding: '22px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ fontSize: '2.8rem' }}>{s.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: '800', color: s.text, background: 'rgba(255,255,255,0.8)', padding: '2px 8px', borderRadius: '4px' }}>
                        {s.title}
                      </span>
                      {podium.subclass && (
                        <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          {podium.subclass}
                        </span>
                      )}
                    </div>
                    <h4 style={{ fontSize: '1.3rem', fontWeight: '900', margin: '4px 0 2px 0', color: '#0f172a' }}>
                      {podium.name || '미등록'}
                    </h4>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      {podium.club ? `소속: ${podium.club}` : '개인 출전'}
                      {podium.bibNumber && podium.bibNumber !== '-' ? ` · 배번: #${podium.bibNumber}` : ''}
                    </div>
                  </div>
                  {podium.points && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>기록</span>
                      <strong style={{ fontSize: '1.2rem', color: s.text }}>{podium.points}</strong>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 전체 순위표 (있는 경우) */}
          {activeDivData.fullRankings && activeDivData.fullRankings.length > 0 && (
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '800', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📋 {activeDivData.title || `${activeDivData.division} (${activeDivData.subclass})`} 공식 순위표</span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>총 {activeDivData.fullRankings.length}{activeDivData.division === '단체전' ? '팀' : '명'}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '10px', textAlign: 'center', width: '60px' }}>순위</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>선수명</th>
                      <th style={{ padding: '10px', textAlign: 'center', width: '100px' }}>부문/클라스</th>
                      <th style={{ padding: '10px', textAlign: 'center', width: '110px' }}>배번</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>소속 / 출신</th>
                      <th style={{ padding: '10px', textAlign: 'center', width: '90px' }}>총점</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDivData.fullRankings.map((p, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx < 3 ? 'rgba(254, 243, 199, 0.15)' : 'transparent' }}>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '800', color: idx === 0 ? '#b45309' : idx === 1 ? '#475569' : idx === 2 ? '#ea580c' : '#64748b' }}>
                          {p.rank <= 3 ? (p.rank === 1 ? '🥇 1등' : p.rank === 2 ? '🥈 2등' : '🥉 3등') : `${p.rank}등`}
                        </td>
                        <td style={{ padding: '8px', fontWeight: '800', color: '#0f172a' }}>{p.name}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontWeight: '700' }}>
                            {p.subclass || activeDivData.subclass}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#0284c7', fontWeight: '700' }}>{p.bibNumber || '-'}</td>
                        <td style={{ padding: '8px', color: '#64748b' }}>{p.club || '-'}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: '800', color: 'var(--theme-primary, #1f6f8b)' }}>{p.points || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
