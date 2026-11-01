'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  Trophy,
  Award,
  Calendar,
  MapPin,
  Users,
  Download,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  X
} from 'lucide-react';
import { TournamentHistoryEdition, HistoricalDivision, HistoricalPodiumItem } from '@/app/api/tenant/[subdomain]/history/route';

interface HostHistoryArchiveViewProps {
  subdomain: string;
}

export default function HostHistoryArchiveView({ subdomain }: HostHistoryArchiveViewProps) {
  const [editions, setEditions] = useState<TournamentHistoryEdition[]>([]);
  const [selectedEditionId, setSelectedEditionId] = useState<string>('');
  const [selectedDivisionTab, setSelectedDivisionTab] = useState<string>('혼합오픈');
  const [loading, setLoading] = useState(true);

  // 모달 상태 (추가 / 편집)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEdition, setEditingEdition] = useState<Partial<TournamentHistoryEdition> | null>(null);
  const [saving, setSaving] = useState(false);

  // 데이터 로드
  const fetchEditions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/history?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.editions && data.editions.length > 0) {
        setEditions(data.editions);
        if (!selectedEditionId || !data.editions.some((e: any) => e.id === selectedEditionId)) {
          setSelectedEditionId(data.editions[0].id);
        }
      }
    } catch (e) {
      console.error('역대 기록 조회 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEditions();
  }, [subdomain]);

  // 현재 선택된 대회 기록
  const activeEdition = editions.find(e => e.id === selectedEditionId) || editions[0];

  // 현재 선택된 종목의 포디움 및 순위
  const activeDivisionData = activeEdition?.divisions?.find(
    d => d.division === selectedDivisionTab || (selectedDivisionTab.includes('펀') && d.division.includes('펀'))
  ) || activeEdition?.divisions?.[0];

  // 새 기록 작성 열기
  const handleOpenNewModal = () => {
    setEditingEdition({
      edition: (editions[0]?.edition || 20) + 1,
      year: new Date().getFullYear(),
      title: `제${(editions[0]?.edition || 20) + 1}회 이순신장군배 전국윈드서핑대회`,
      duration: '',
      location: '경상남도 통영시 도남동 공설해수욕장 일원 해상',
      participantCount: 130,
      divisionCount: 5,
      hostOrg: '통영시, 한국윈드서핑협회',
      supervisor: '통영시윈드서핑협회',
      summaryNote: '',
      divisions: [
        {
          division: '혼합오픈',
          podium: [
            { rank: 1, name: '', club: '', points: '', note: '1위 (금메달)' },
            { rank: 2, name: '', club: '', points: '', note: '2위 (은메달)' },
            { rank: 3, name: '', club: '', points: '', note: '3위 (동메달)' },
          ]
        },
        {
          division: '펀&포뮬러',
          podium: [
            { rank: 1, name: '', club: '', points: '', note: '1위 (금메달)' },
            { rank: 2, name: '', club: '', points: '', note: '2위 (은메달)' },
            { rank: 3, name: '', club: '', points: '', note: '3위 (동메달)' },
          ]
        },
        {
          division: '윈드포일',
          podium: [
            { rank: 1, name: '', club: '', points: '', note: '1위 (금메달)' },
            { rank: 2, name: '', club: '', points: '', note: '2위 (은메달)' },
            { rank: 3, name: '', club: '', points: '', note: '3위 (동메달)' },
          ]
        },
        {
          division: '윙포일',
          podium: [
            { rank: 1, name: '', club: '', points: '', note: '1위 (금메달)' },
            { rank: 2, name: '', club: '', points: '', note: '2위 (은메달)' },
            { rank: 3, name: '', club: '', points: '', note: '3위 (동메달)' },
          ]
        },
        {
          division: '단체전',
          podium: [
            { rank: 1, name: '', club: '', points: '', note: '1위 (우승)' },
            { rank: 2, name: '', club: '', points: '', note: '2위 (준우승)' },
            { rank: 3, name: '', club: '', points: '', note: '3위 (3위)' },
          ]
        }
      ]
    });
    setIsModalOpen(true);
  };

  // 기존 기록 편집 열기
  const handleOpenEditModal = (edition: TournamentHistoryEdition) => {
    setEditingEdition(JSON.parse(JSON.stringify(edition)));
    setIsModalOpen(true);
  };

  // 기록 저장 실행
  const handleSaveEdition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEdition?.title || !editingEdition?.edition || !editingEdition?.year) {
      alert('회차, 연도, 대회명은 필수 입력 항목입니다.');
      return;
    }

    setSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('gentrophy_auth_token') : null;
      const res = await fetch(`/api/tenant/${subdomain}/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(editingEdition),
      });

      if (res.ok) {
        alert('역대 대회 기록이 성공적으로 저장되었습니다.');
        setIsModalOpen(false);
        fetchEditions();
      } else {
        const err = await res.json();
        alert(`저장 실패: ${err.error || '권한 오류'}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`오류 발생: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 기록 삭제 실행
  const handleDeleteEdition = async (editionId: string, title: string) => {
    if (!confirm(`정말로 "${title}" 기록을 삭제하시겠습니까?`)) return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('gentrophy_auth_token') : null;
      const res = await fetch(`/api/tenant/${subdomain}/history?id=${editionId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.ok) {
        alert('기록이 삭제되었습니다.');
        fetchEditions();
      } else {
        alert('삭제 실패');
      }
    } catch (e) {
      console.error(e);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // 전체 역대 기록 엑셀 다운로드
  const handleExportAllHistory = () => {
    if (editions.length === 0) return;

    const headers = ['회차', '개최연도', '대회명', '대회기간', '개최장소', '참가인원', '종목', '순위', '선수명', '소속', '기록/점수'];
    const rows: string[][] = [];

    editions.forEach(ed => {
      ed.divisions?.forEach(div => {
        div.podium?.forEach(p => {
          rows.push([
            `제${ed.edition}회`,
            `${ed.year}년`,
            ed.title,
            ed.duration || '',
            ed.location || '',
            `${ed.participantCount || 0}명`,
            div.division,
            `${p.rank}위`,
            p.name,
            p.club || '',
            String(p.points || '')
          ]);
        });
      });
    });

    const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `이순신장군배_역대기록관_누적순위표.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 상단 헤더 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '16px',
          padding: '24px 28px',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '3px 10px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '20px', fontSize: '0.76rem', fontWeight: '800', color: '#fbbf24', marginBottom: '8px' }}>
            <Sparkles size={13} /> 역대 명예의 전당 (Hall of Fame)
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '900', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
            🏛️ 역대 기록관 (회별 · 년도별 누적 순위 보관소)
          </h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.86rem' }}>
            대회 회차별 최종 우승자 및 종목별 포디움 입상 기록을 영구 보관하고 누적 관리합니다.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportAllHistory}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: '700',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            <Download size={15} />
            역대 전체 엑셀
          </button>

          <button
            onClick={handleOpenNewModal}
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
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)',
            }}
          >
            <Plus size={15} />
            새 회차 기록 추가
          </button>
        </div>
      </div>

      {/* 회차 및 연도 타임라인 탭 셀렉터 */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {editions.map((ed) => {
          const isSelected = ed.id === activeEdition?.id;
          return (
            <button
              key={ed.id}
              onClick={() => {
                setSelectedEditionId(ed.id);
                if (ed.divisions && ed.divisions.length > 0) {
                  setSelectedDivisionTab(ed.divisions[0].division);
                }
              }}
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                border: isSelected ? '2px solid #d97706' : '1px solid #e2e8f0',
                background: isSelected ? '#fffbeb' : '#ffffff',
                color: isSelected ? '#b45309' : '#475569',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '2px',
                minWidth: '150px',
                boxShadow: isSelected ? '0 4px 12px rgba(217, 119, 6, 0.15)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '800', color: isSelected ? '#d97706' : '#94a3b8' }}>
                  {ed.year}년
                </span>
                {ed.edition === 20 && (
                  <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: '800' }}>
                    최신
                  </span>
                )}
              </div>
              <strong style={{ fontSize: '1.05rem', fontWeight: '900', color: isSelected ? '#9a3412' : '#0f172a' }}>
                제{ed.edition}회 대회
              </strong>
            </button>
          );
        })}
      </div>

      {/* 선택된 대회 상세 개요 카드 */}
      {activeEdition && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '22px 26px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                  제{activeEdition.edition}회 공식 기록
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
                  <Users size={15} style={{ color: '#94a3b8' }} /> 총 {activeEdition.participantCount || 0}명 출전
                </span>
              </div>
            </div>

            {/* 수정 / 삭제 버튼 */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => handleOpenEditModal(activeEdition)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '7px 12px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                <Edit3 size={14} /> 편집
              </button>
              <button
                onClick={() => handleDeleteEdition(activeEdition.id, activeEdition.title)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '7px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  color: '#dc2626',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={14} /> 삭제
              </button>
            </div>
          </div>

          {activeEdition.summaryNote && (
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', fontSize: '0.84rem', color: '#334155', lineHeight: '1.5' }}>
              {activeEdition.summaryNote}
            </div>
          )}
        </div>
      )}

      {/* 종목별 포디움 셀렉터 탭 */}
      {activeEdition?.divisions && activeEdition.divisions.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {activeEdition.divisions.map((div) => {
            const isTabActive = activeDivisionData?.division === div.division;
            return (
              <button
                key={div.division}
                onClick={() => setSelectedDivisionTab(div.division)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: isTabActive ? '2px solid var(--theme-primary, #2563eb)' : '1px solid #e2e8f0',
                  background: isTabActive ? '#eff6ff' : '#ffffff',
                  color: isTabActive ? 'var(--theme-primary, #2563eb)' : '#64748b',
                  fontWeight: isTabActive ? '800' : '600',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {div.division} 포디움
              </button>
            );
          })}
        </div>
      )}

      {/* 선택된 종목의 명예의 전당 (Top 3 포디움 카드) */}
      {activeDivisionData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {activeDivisionData.podium?.map((podium) => {
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
                    <span style={{ fontSize: '0.74rem', fontWeight: '800', color: s.text, background: 'rgba(255,255,255,0.8)', padding: '2px 8px', borderRadius: '4px' }}>
                      {s.title}
                    </span>
                    <h4 style={{ fontSize: '1.3rem', fontWeight: '900', margin: '4px 0 2px 0', color: '#0f172a' }}>
                      {podium.name || '미등록'}
                    </h4>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      {podium.club ? `소속: ${podium.club}` : '개인 출전'}
                      {podium.bibNumber ? ` · 배번: #${podium.bibNumber}` : ''}
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

          {/* 하위 순위 전체 목록 테이블 (있는 경우) */}
          {activeDivisionData.fullRankings && activeDivisionData.fullRankings.length > 0 && (
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '800', fontSize: '0.9rem' }}>
                {activeDivisionData.division} 전체 공식 순위
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '10px', textAlign: 'center', width: '60px' }}>순위</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>이름</th>
                    <th style={{ padding: '10px', textAlign: 'center', width: '100px' }}>배번</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>소속</th>
                    <th style={{ padding: '10px', textAlign: 'center', width: '90px' }}>총점</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDivisionData.fullRankings.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: '800' }}>{p.rank}등</td>
                      <td style={{ padding: '8px', fontWeight: '800' }}>{p.name}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#0284c7' }}>{p.bibNumber || '-'}</td>
                      <td style={{ padding: '8px', color: '#64748b' }}>{p.club || '-'}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: '800', color: '#2563eb' }}>{p.points || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 새 회차 추가 / 편집 모달 */}
      {isModalOpen && editingEdition && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '900', margin: 0, color: '#0f172a' }}>
                {editingEdition.id ? '역대 대회 기록 편집' : '새 회차 대회 기록 추가'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdition} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                    회차 (숫자만, 예: 21)
                  </label>
                  <input
                    type="number"
                    value={editingEdition.edition || ''}
                    onChange={(e) => setEditingEdition({ ...editingEdition, edition: Number(e.target.value) })}
                    required
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                    개최 연도 (예: 2027)
                  </label>
                  <input
                    type="number"
                    value={editingEdition.year || ''}
                    onChange={(e) => setEditingEdition({ ...editingEdition, year: Number(e.target.value) })}
                    required
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                  공식 대회명
                </label>
                <input
                  type="text"
                  value={editingEdition.title || ''}
                  onChange={(e) => setEditingEdition({ ...editingEdition, title: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                    대회 일정
                  </label>
                  <input
                    type="text"
                    value={editingEdition.duration || ''}
                    onChange={(e) => setEditingEdition({ ...editingEdition, duration: e.target.value })}
                    placeholder="2026. 10. 31(토) ~ 11. 01(일)"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                    총 출전 선수 수
                  </label>
                  <input
                    type="number"
                    value={editingEdition.participantCount || ''}
                    onChange={(e) => setEditingEdition({ ...editingEdition, participantCount: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                  개최 장소
                </label>
                <input
                  type="text"
                  value={editingEdition.location || ''}
                  onChange={(e) => setEditingEdition({ ...editingEdition, location: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                  대회 요약 / 주요 기록 비고
                </label>
                <textarea
                  rows={3}
                  value={editingEdition.summaryNote || ''}
                  onChange={(e) => setEditingEdition({ ...editingEdition, summaryNote: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '10px 18px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#475569', fontWeight: '700', cursor: 'pointer' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? '저장 중...' : '기록 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
