'use client';

import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Award,
  Download,
  Printer,
  History,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Users
} from 'lucide-react';
import { formatBibShortDisplay } from '../referee/page';

interface HostFinalResultsViewProps {
  activeTournament: any;
  subdomain: string;
  onNavigateHistory?: () => void;
}

export default function HostFinalResultsView({
  activeTournament,
  subdomain,
  onNavigateHistory,
}: HostFinalResultsViewProps) {
  const [activeDivision, setActiveDivision] = useState<string>('혼합오픈');
  const [selectedSubclass, setSelectedSubclass] = useState<string>('all');
  const [allLeaderboards, setAllLeaderboards] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState(false);

  // 리더보드 데이터 전체 불러오기
  const fetchAllLeaderboards = async () => {
    if (!activeTournament?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tenant/${subdomain}/leaderboard?tournamentId=${activeTournament.id}&all=true&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (data.leaderboards) {
        setAllLeaderboards(data.leaderboards);
      }
    } catch (e) {
      console.error('리더보드 조회 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllLeaderboards();
  }, [activeTournament?.id, subdomain]);

  const divisionList = ['혼합오픈', '펀&포뮬러', '윈드포일', '윙포일', '단체전'];

  // 현재 선택된 종목의 데이터
  const currentDivData = allLeaderboards[activeDivision] ||
    (activeDivision.includes('펀') ? (allLeaderboards['펀&포뮬러'] || allLeaderboards['펀엔포뮬러']) : null) || { list: [], rounds: [] };

  const rawList: any[] = currentDivData.list || [];
  const rounds: any[] = currentDivData.rounds || [
    { key: 'r1', label: '1라운드', short: '1R' },
    { key: 'r2', label: '2라운드', short: '2R' },
    { key: 'r3', label: '3라운드', short: '3R' },
  ];

  // 클래스 목록
  const availableSubclasses = ['청년부', '중년부', '장년부', '여자부'];

  // 필터링 적용된 목록
  const filteredList = rawList.filter((p: any) => {
    if (selectedSubclass !== 'all' && p.subclass && p.subclass !== selectedSubclass) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchBib = (p.bibNumber || '').toLowerCase().includes(q);
      const matchClub = (p.club || '').toLowerCase().includes(q);
      if (!matchName && !matchBib && !matchClub) return false;
    }
    return true;
  });

  // 상위 1, 2, 3위 (포디움)
  const podiumTop3 = filteredList.slice(0, 3);

  // 엑셀(CSV) 다운로드
  const handleExportCsv = () => {
    if (filteredList.length === 0) {
      alert('내보낼 순위 데이터가 없습니다.');
      return;
    }

    const headers = ['순위', '클라스', '이름', '배번', '소속/생년월일', ...rounds.map(r => r.short), '총점'];
    const rows = filteredList.map((p, idx) => {
      const rank = p.rank || idx + 1;
      const roundScores = rounds.map(r => p[r.key] !== null && p[r.key] !== undefined ? `${p[r.key]}점` : '-');
      return [
        `${rank}등`,
        p.subclass || '일반',
        p.name || '',
        p.bibNumber ? formatBibShortDisplay(p.bibNumber) : '',
        p.birth ? String(p.birth).substring(2) : (p.club || ''),
        ...roundScores,
        `${p.totalScore ?? 0}점`
      ];
    });

    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTournament?.title || '대회'}_${activeDivision}_공식최종순위.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 공식 순위표 인쇄
  const handlePrint = () => {
    window.print();
  };

  // 현재 대회 공식 성적을 "역대 기록관"으로 영구 보관/누적 등록
  const handleArchiveToHistory = async () => {
    if (!confirm('현재 확정된 모든 종목의 최종 순위와 포디움을 [역대 기록관]에 제20회(2026년) 공식 기록으로 영구 누적/보관하시겠습니까?')) {
      return;
    }

    setArchiving(true);
    setArchiveSuccess(false);

    try {
      // 각 종목별 1~3위 포디움 및 순위 추출
      const historyDivisions = divisionList.map(divName => {
        const dData = allLeaderboards[divName] ||
          (divName.includes('펀') ? (allLeaderboards['펀&포뮬러'] || allLeaderboards['펀엔포뮬러']) : null) || { list: [] };
        const list: any[] = dData.list || [];
        const podium = list.slice(0, 3).map((p, idx) => ({
          rank: idx + 1,
          name: p.name || '미정',
          club: p.club || '',
          bibNumber: p.bibNumber ? formatBibShortDisplay(p.bibNumber) : '',
          points: `${p.totalScore ?? 0}점`,
          subclass: p.subclass || '',
          note: `${idx + 1}위 (${idx === 0 ? '금메달' : idx === 1 ? '은메달' : '동메달'})`,
        }));

        const fullRankings = list.map((p, idx) => ({
          rank: p.rank || idx + 1,
          name: p.name,
          club: p.club || '',
          bibNumber: p.bibNumber ? formatBibShortDisplay(p.bibNumber) : '',
          points: `${p.totalScore ?? 0}점`,
          subclass: p.subclass || '',
        }));

        return {
          division: divName,
          podium,
          fullRankings,
        };
      });

      const payload = {
        id: 'edition-20-2026',
        edition: 20,
        year: 2026,
        title: activeTournament?.title || '제20회 이순신장군배 전국윈드서핑대회',
        duration: '2026. 10. 31(토) ~ 11. 01(일)',
        location: '경상남도 통영시 도남동 공설해수욕장 일원 해상',
        participantCount: 130,
        divisionCount: divisionList.length,
        hostOrg: '통영시, 한국윈드서핑협회',
        supervisor: '통영시윈드서핑협회',
        summaryNote: '제20회 공식 순위 및 포디움이 심판 리더보드로부터 최종 확정되어 영구 보관되었습니다.',
        divisions: historyDivisions,
      };

      const token = typeof window !== 'undefined' ? localStorage.getItem('gentrophy_auth_token') : null;
      const res = await fetch(`/api/tenant/${subdomain}/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setArchiveSuccess(true);
        alert('🎉 현재 대회의 최종 성적이 [역대 기록관]에 성공적으로 영구 보관 및 누적되었습니다!');
        if (onNavigateHistory) {
          onNavigateHistory();
        }
      } else {
        const err = await res.json();
        alert(`역대 기록관 등록 실패: ${err.error || '권한 오류'}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`오류 발생: ${e.message}`);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 상단 컨트롤 바 */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '20px 24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: '900', margin: '0 0 4px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={24} style={{ color: '#d97706' }} />
            공식 최종 성적 결과 (Leaderboard)
          </h2>
          <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b' }}>
            {activeTournament?.title} · 각 종목별 확정된 공식 순위표 및 포디움 입상자 현황
          </p>
        </div>

        {/* 액션 버튼 그룹 */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={fetchAllLeaderboards}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: '700',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>

          <button
            onClick={handleExportCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: '700',
              color: '#1d4ed8',
              cursor: 'pointer',
            }}
          >
            <Download size={15} />
            엑셀 다운로드
          </button>

          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: '700',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <Printer size={15} />
            순위표 인쇄
          </button>

          <button
            onClick={handleArchiveToHistory}
            disabled={archiving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: '800',
              color: '#ffffff',
              cursor: archiving ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)',
            }}
          >
            <History size={15} />
            {archiving ? '보관 등록 중...' : '역대 기록관에 누적 보관'}
          </button>
        </div>
      </div>

      {/* 종목 탭 셀렉터 */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {divisionList.map((divName) => {
          const isActive = activeDivision === divName;
          const divData = allLeaderboards[divName] ||
            (divName.includes('펀') ? (allLeaderboards['펀&포뮬러'] || allLeaderboards['펀엔포뮬러']) : null);
          const count = divData?.list?.length || 0;

          return (
            <button
              key={divName}
              onClick={() => {
                setActiveDivision(divName);
                setSelectedSubclass('all');
              }}
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                border: isActive ? '2px solid var(--theme-primary, #2563eb)' : '1px solid #e2e8f0',
                background: isActive ? '#eff6ff' : '#ffffff',
                color: isActive ? 'var(--theme-primary, #2563eb)' : '#475569',
                fontWeight: isActive ? '900' : '700',
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              <span>{divName}</span>
              <span
                style={{
                  fontSize: '0.74rem',
                  padding: '2px 7px',
                  borderRadius: '12px',
                  background: isActive ? '#2563eb' : '#f1f5f9',
                  color: isActive ? '#ffffff' : '#64748b',
                  fontWeight: '800',
                }}
              >
                {count}명
              </span>
            </button>
          );
        })}
      </div>

      {/* 클래스 필터 & 검색 필터 */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '14px 20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.84rem', fontWeight: '800', color: '#64748b' }}>클라스 필터:</span>
          <button
            onClick={() => setSelectedSubclass('all')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: '700',
              border: selectedSubclass === 'all' ? '1px solid #2563eb' : '1px solid #e2e8f0',
              background: selectedSubclass === 'all' ? '#2563eb' : '#f8fafc',
              color: selectedSubclass === 'all' ? '#ffffff' : '#475569',
              cursor: 'pointer',
            }}
          >
            전체 종합
          </button>
          {availableSubclasses.map((sc) => (
            <button
              key={sc}
              onClick={() => setSelectedSubclass(sc)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '700',
                border: selectedSubclass === sc ? '1px solid #2563eb' : '1px solid #e2e8f0',
                background: selectedSubclass === sc ? '#2563eb' : '#f8fafc',
                color: selectedSubclass === sc ? '#ffffff' : '#475569',
                cursor: 'pointer',
              }}
            >
              {sc}
            </button>
          ))}
        </div>

        {/* 선수 검색 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Search size={16} style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="선수명 / 배번 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '7px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.84rem',
              width: '180px',
            }}
          />
        </div>
      </div>

      {/* 3대 입상자 포디움 (Gold, Silver, Bronze) */}
      {podiumTop3.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {podiumTop3.map((player, idx) => {
            const medals = [
              { label: '우승 (1위)', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '🥇' },
              { label: '준우승 (2위)', color: '#475569', bg: '#f8fafc', border: '#e2e8f0', icon: '🥈' },
              { label: '3위 (동메달)', color: '#ea580c', bg: '#fff7ed', border: '#ffedd5', icon: '🥉' },
            ];
            const m = medals[idx];

            return (
              <div
                key={player.id || idx}
                style={{
                  background: m.bg,
                  border: `2px solid ${m.border}`,
                  borderRadius: '16px',
                  padding: '20px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ fontSize: '2.5rem' }}>{m.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: '800', color: m.color, background: 'rgba(255,255,255,0.7)', padding: '2px 6px', borderRadius: '4px' }}>
                      {m.label}
                    </span>
                    {player.subclass && (
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>
                        {player.subclass}
                      </span>
                    )}
                  </div>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: '900', margin: '2px 0 4px 0', color: '#0f172a' }}>
                    {player.name}
                  </h4>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>배번: <strong>{player.bibNumber ? formatBibShortDisplay(player.bibNumber) : '-'}</strong></span>
                    <span>·</span>
                    <span>소속: <strong>{player.club || '개인'}</strong></span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>총점</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: '900', color: m.color }}>
                    {player.totalScore ?? 0}점
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 공식 순위표 테이블 */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.03)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, color: '#1e293b' }}>
            {activeDivision} 공식 순위표 ({filteredList.length}명)
          </h4>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            * 세일링 Low-Point 시스템 적용 (점수가 낮을수록 상위)
          </span>
        </div>

        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px 8px', width: '60px', textAlign: 'center' }}>순위</th>
                <th style={{ padding: '12px 8px', width: '80px', textAlign: 'center' }}>클라스</th>
                <th style={{ padding: '12px 10px', minWidth: '100px', textAlign: 'left' }}>이름</th>
                <th style={{ padding: '12px 8px', width: '100px', textAlign: 'center' }}>배번</th>
                <th style={{ padding: '12px 10px', minWidth: '110px', textAlign: 'left' }}>소속 / 생년월일</th>
                {rounds.map(r => (
                  <th key={r.key} style={{ padding: '12px 8px', width: '65px', textAlign: 'center', color: '#1e293b' }}>
                    {r.short}
                  </th>
                ))}
                <th style={{ padding: '12px 10px', width: '80px', textAlign: 'center', color: '#2563eb', fontWeight: '900' }}>총점</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6 + rounds.length} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    {loading ? '순위 데이터를 불러오는 중입니다...' : '해당 조건에 해당하는 순위 데이터가 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredList.map((p, idx) => {
                  const rank = p.rank || idx + 1;
                  const isTop3 = rank <= 3;

                  return (
                    <tr
                      key={p.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: rank === 1 ? '#fffdf5' : rank === 2 ? '#fafafa' : rank === 3 ? '#fffaf5' : '#ffffff',
                      }}
                    >
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '900', color: rank === 1 ? '#d97706' : rank === 2 ? '#475569' : rank === 3 ? '#ea580c' : '#0f172a' }}>
                        {isTop3 ? (rank === 1 ? '🥇 1등' : rank === 2 ? '🥈 2등' : '🥉 3등') : `${rank}등`}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', fontWeight: '700' }}>
                          {p.subclass || '일반'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 10px', fontWeight: '800', color: '#0f172a' }}>
                        {p.name}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', color: '#0284c7' }}>
                        {p.bibNumber ? formatBibShortDisplay(p.bibNumber) : '-'}
                      </td>
                      <td style={{ padding: '10px 10px', color: '#64748b', fontSize: '0.82rem' }}>
                        {p.club || (p.birth ? String(p.birth).substring(2) : '-')}
                      </td>
                      {rounds.map(r => {
                        const val = p[r.key];
                        return (
                          <td key={r.key} style={{ padding: '10px 8px', textAlign: 'center', color: '#334155', fontWeight: '700' }}>
                            {val !== null && val !== undefined ? `${val}점` : '-'}
                          </td>
                        );
                      })}
                      <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: '900', color: '#2563eb', fontSize: '0.94rem' }}>
                        {p.totalScore ?? 0}점
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
