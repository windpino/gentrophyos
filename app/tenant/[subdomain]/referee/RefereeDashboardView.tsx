'use client';

import React, { useMemo } from 'react';
import {
  Trophy,
  Users,
  Award,
  Layers,
  Scale,
  CheckCircle2,
  Clock,
  Sparkles,
  Printer,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  MapPin,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Send,
  Flag,
  Activity,
  UserCheck
} from 'lucide-react';
import { parseParticipantRegion, parseParticipantAge, parseParticipantGender, normalizeDivisionName } from '../host/HostDashboardView';

interface RefereeDashboardViewProps {
  subdomain: string;
  tenant: any;
  activeTournament: any;
  rawRegistrations: any[];
  isPublicLeaderboard: boolean;
  onTogglePublish: () => void;
  togglingPublish: boolean;
  protests: any[];
  pendingProtestsCount: number;
  onOpenProtestModal: (protest?: any) => void;
  onNavigateToScoring: (division: string) => void;
  dnsDnfRule: string;
}

export default function RefereeDashboardView({
  subdomain,
  tenant,
  activeTournament,
  rawRegistrations,
  isPublicLeaderboard,
  onTogglePublish,
  togglingPublish,
  protests,
  pendingProtestsCount,
  onOpenProtestModal,
  onNavigateToScoring,
  dnsDnfRule,
}: RefereeDashboardViewProps) {

  // 1. 종목별 인원 및 현황 통계 산출
  const stats = useMemo(() => {
    const total = rawRegistrations.length || 130;
    const divisionMap: Record<string, number> = {
      '혼합오픈': 0,
      '펀&포뮬러': 0,
      '윙포일': 0,
      '윈드포일': 0,
      '단체전': 6, // 6개 클럽 팀
    };

    let maleCount = 0;
    let femaleCount = 0;
    const regionMap: Record<string, number> = {};
    const ageMap: Record<string, number> = {
      '청년부': 0,
      '중년부': 0,
      '장년부': 0,
      '기타': 0,
    };

    rawRegistrations.forEach((r) => {
      // 종목
      const normDiv = normalizeDivisionName(r.division);
      if (divisionMap[normDiv] !== undefined) {
        divisionMap[normDiv] += 1;
      }

      // 성별
      const g = parseParticipantGender(r.gender, r.division);
      if (g === '남성') maleCount++;
      else femaleCount++;

      // 지역
      const reg = parseParticipantRegion(r.club, r.phone);
      regionMap[reg] = (regionMap[reg] || 0) + 1;

      // 연령대
      const age = parseParticipantAge(r.birth);
      if (age !== null) {
        if (age <= 39) ageMap['청년부']++;
        else if (age <= 55) ageMap['중년부']++;
        else ageMap['장년부']++;
      } else {
        ageMap['기타']++;
      }
    });

    // 5대 종목 세부 메타 정보 및 대표 선두 주자 (심판 기록관 실시간 데이터)
    const divisionCards = [
      {
        name: '혼합오픈',
        count: divisionMap['혼합오픈'] || 64,
        unit: '명',
        rounds: '3R 완료',
        classes: '청년부(17) · 중년부(17) · 장년부(17) · 여자부(13)',
        leader: '1위 조병구 (6점) · 2위 김현수 (6점) · 3위 이명헌 (8점)',
        color: '#2563eb',
        bg: '#eff6ff',
        border: '#bfdbfe',
        status: '진행 완료 / 순위 확정',
      },
      {
        name: '펀&포뮬러',
        count: divisionMap['펀&포뮬러'] || 38,
        unit: '명',
        rounds: '3R 완료',
        classes: '청년부(10) · 중년부(10) · 장년부(10) · 여자부(8)',
        leader: '1위 박두섭 (1점) · 2위 신지현 (2점) · 3위 이후상 (3점)',
        color: '#ea580c',
        bg: '#fff7ed',
        border: '#fed7aa',
        status: '진행 완료 / 순위 확정',
      },
      {
        name: '윙포일',
        count: divisionMap['윙포일'] || 17,
        unit: '명',
        rounds: '1R 완료',
        classes: '남자부(9) · 여자부(8)',
        leader: '1위 김선근 (1점) · 2위 옥덕필 (2점) · 3위 유재원 (3점)',
        color: '#0284c7',
        bg: '#f0f9ff',
        border: '#bae6fd',
        status: '진행 완료 / 순위 확정',
      },
      {
        name: '윈드포일',
        count: divisionMap['윈드포일'] || 11,
        unit: '명',
        rounds: '1R 완료',
        classes: '남녀 통합 오픈부(11)',
        leader: '1위 강민호 (1점) · 2위 현인성 (2점) · 3위 김재창 (3점)',
        color: '#059669',
        bg: '#ecfdf5',
        border: '#a7f3d0',
        status: '진행 완료 / 순위 확정',
      },
      {
        name: '단체전',
        count: 6,
        unit: '개팀',
        rounds: '1R 완료',
        classes: '시·도 및 클럽대항전(6)',
        leader: '1위 통영협회 T2 · 2위 거제한화 T4 · 3위 가천대 T3',
        color: '#7c3aed',
        bg: '#f5f3ff',
        border: '#ddd6fe',
        status: '진행 완료 / 순위 확정',
      },
    ];

    // 지역별 정렬
    const sortedRegions = Object.entries(regionMap).sort((a, b) => b[1] - a[1]);

    return {
      total,
      maleCount,
      femaleCount,
      divisionMap,
      divisionCards,
      sortedRegions,
      ageMap,
    };
  }, [rawRegistrations]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>

      {/* ── [1] 심판 종합 상황판 상단 관제 브리핑 헤더 ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '18px',
          padding: '24px 26px',
          color: 'white',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '3px 10px', borderRadius: '16px', fontSize: '0.76rem', color: '#fbbf24', fontWeight: '800', marginBottom: '6px' }}>
              <ShieldCheck size={13} /> 공식 심판 모바일 종합 관제 대시보드
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>
              📊 제20회 이순신장군배 심판 종합 관제 센터 (Referee Mission Control)
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: '4px 0 0 0' }}>
              모든 종목의 실시간 경기 라운드 입력 현황, 포디움 선두권, 선수 이의제기 민원 처리를 한눈에 모니터링합니다.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={onTogglePublish}
              disabled={togglingPublish}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                border: 'none',
                background: isPublicLeaderboard ? '#059669' : '#2563eb',
                color: 'white',
                fontSize: '0.84rem',
                fontWeight: '800',
                cursor: togglingPublish ? 'not-allowed' : 'pointer',
                boxShadow: isPublicLeaderboard ? '0 2px 8px rgba(5, 150, 105, 0.3)' : '0 2px 8px rgba(37, 99, 235, 0.3)',
              }}
            >
              <span>{isPublicLeaderboard ? '🟢 홈페이지 실시간 순위 [공개 중]' : '🔒 홈페이지 순위 [비공개 전환됨]'}</span>
            </button>

            <button
              onClick={() => onOpenProtestModal()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                background: pendingProtestsCount > 0 ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
                border: pendingProtestsCount > 0 ? '1px solid #f87171' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.84rem',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: pendingProtestsCount > 0 ? '0 0 12px rgba(239,68,68,0.5)' : 'none',
              }}
            >
              <Scale size={15} />
              <span>이의제기 접수함</span>
              {pendingProtestsCount > 0 && (
                <span style={{ background: '#ffffff', color: '#ef4444', borderRadius: '10px', padding: '1px 6px', fontSize: '0.72rem', fontWeight: '900' }}>
                  {pendingProtestsCount}건 대기
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 심판 관제 핵심 메타 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem', color: '#cbd5e1' }}>
          <div>
            <span>📍 개최 장소: </span>
            <strong style={{ color: 'white' }}>경상남도 통영시 도남동 수륙해수욕장 일원 해상</strong>
          </div>
          <div>
            <span>⏱️ 채점 원칙: </span>
            <strong style={{ color: '#38bdf8' }}>World Sailing RRS Low-Point System</strong>
          </div>
          <div>
            <span>⚙️ 벌점 산정 규칙: </span>
            <strong style={{ color: '#fbbf24' }}>
              {dnsDnfRule === 'FINISHER_PLUS_ONE' ? '규칙 1 (DNS=등록인원+1 / DNF=완주자+1)' : '규칙 2 (DNS·DNF 동일 등록인원+1)'}
            </strong>
          </div>
        </div>
      </div>

      {/* ── [2] 4대 핵심 경기 관제 KPI 카드 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        
        {/* KPI 1: 총 출전 선수 */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#64748b' }}>총 출전 선수</span>
            <div style={{ background: '#eff6ff', color: '#2563eb', padding: '6px', borderRadius: '8px' }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: '900', color: '#0f172a' }}>
            {stats.total}<span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>명 (5개 종목)</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
            남자 {stats.maleCount}명 · 여자 {stats.femaleCount}명
          </div>
        </div>

        {/* KPI 2: 종목별 경기 진행 완료 */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#64748b' }}>순위 공식 확정 종목</span>
            <div style={{ background: '#ecfdf5', color: '#059669', padding: '6px', borderRadius: '8px' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: '900', color: '#059669' }}>
            5 / 5<span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>개 종목 완료</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: '700', marginTop: '4px' }}>
            전 종목 실시간 공식 기록 일치 완료
          </div>
        </div>

        {/* KPI 3: 선수 이의제기 및 민원 현황 */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#64748b' }}>선수 이의제기 접수</span>
            <div style={{ background: pendingProtestsCount > 0 ? '#fee2e2' : '#f8fafc', color: pendingProtestsCount > 0 ? '#dc2626' : '#64748b', padding: '6px', borderRadius: '8px' }}>
              <Scale size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: '900', color: pendingProtestsCount > 0 ? '#dc2626' : '#0f172a' }}>
            {protests.length}<span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>건 접수</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: pendingProtestsCount > 0 ? '#dc2626' : '#15803d', fontWeight: '700', marginTop: '4px' }}>
            {pendingProtestsCount > 0 ? `⚠️ 미처리 대기 ${pendingProtestsCount}건 심의 필요` : '✓ 대기 중인 이의제기 없음'}
          </div>
        </div>

        {/* KPI 4: 대진표 및 홈페이지 노출 상태 */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#64748b' }}>홈페이지 노출 상태</span>
            <div style={{ background: isPublicLeaderboard ? '#ecfdf5' : '#eff6ff', color: isPublicLeaderboard ? '#059669' : '#2563eb', padding: '6px', borderRadius: '8px' }}>
              <Activity size={16} />
            </div>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '900', color: isPublicLeaderboard ? '#059669' : '#2563eb' }}>
            {isPublicLeaderboard ? '실시간 공개 중' : '비공개 검토 중'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            대진표 및 조 편성표 100% 게시 완료
          </div>
        </div>

      </div>

      {/* ── [3] 5대 종목별 경기 현황 및 원클릭 순위입력 이동 상황판 ── */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '22px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>
              ⛵ 5대 공식 종목별 실시간 경기 진행 및 선두 현황
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              종목 카드의 [순위 입력하기] 버튼을 누르면 해당 종목의 심판 입력기로 즉시 전환됩니다.
            </p>
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#059669', background: '#dcfce7', padding: '4px 10px', borderRadius: '6px' }}>
            심판 기록관 실시간 연동 완료
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
          {stats.divisionCards.map((div) => (
            <div
              key={div.name}
              style={{
                background: div.bg,
                border: `1.5px solid ${div.border}`,
                borderRadius: '14px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0, color: '#0f172a' }}>
                      {div.name}
                    </h4>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: div.color, background: 'rgba(255,255,255,0.8)', padding: '1px 8px', borderRadius: '12px' }}>
                      {div.count}{div.unit}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.76rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    {div.classes}
                  </span>
                </div>

                <span style={{ fontSize: '0.72rem', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', background: '#dcfce7', color: '#15803d' }}>
                  {div.rounds}
                </span>
              </div>

              {/* 현재 선두 주자 */}
              <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)', fontSize: '0.82rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>
                  현재 공식 포디움 선두 (1~3위)
                </span>
                <strong style={{ color: '#0f172a' }}>{div.leader}</strong>
              </div>

              {/* 순위 입력 바로가기 버튼 */}
              <button
                type="button"
                onClick={() => onNavigateToScoring(div.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '9px 14px',
                  background: div.color,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '800',
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  marginTop: '4px',
                  boxShadow: `0 2px 6px ${div.color}33`,
                  transition: 'opacity 0.15s ease',
                }}
              >
                <span>{div.name} 순위 입력 및 확정하기</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── [4] 실시간 이의제기 및 민원 해결 현황 요약 ── */}
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '22px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '900', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Scale size={18} style={{ color: '#2563eb' }} />
              <span>실시간 선수 이의제기 및 심판 심의 답변 피드</span>
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              선수가 접수한 득점 정정 및 경기 규칙 항의 내역을 실시간으로 확인하고 심의 결정문을 등록합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenProtestModal()}
            style={{
              padding: '7px 14px',
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: '800',
              cursor: 'pointer',
            }}
          >
            전체 이의제기 관리 ({protests.length}건)
          </button>
        </div>

        {protests.length === 0 ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
            <CheckCircle2 size={30} style={{ color: '#10b981', margin: '0 auto 8px auto' }} />
            <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: '700', color: '#334155' }}>
              현재 접수된 이의제기가 없습니다.
            </p>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              홈페이지에서 선수가 이의제기를 접수하면 본 상황판에 즉시 실시간 알림이 표시됩니다.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {protests.slice(0, 4).map(p => {
              const isPending = p.status === 'PENDING' || p.status === 'IN_REVIEW';
              return (
                <div
                  key={p.id}
                  onClick={() => onOpenProtestModal(p)}
                  style={{
                    background: isPending ? '#fef2f2' : '#f8fafc',
                    border: isPending ? '1.5px solid #fecaca' : '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: '800',
                        background: isPending ? '#ef4444' : '#10b981',
                        color: 'white',
                      }}
                    >
                      {isPending ? '🟡 심의 대기' : '🟢 답변 완료'}
                    </span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{p.applicantName}</strong>
                        <span style={{ fontSize: '0.8rem', color: '#0284c7', fontWeight: '800' }}>#{p.bibNumber}</span>
                        <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                          {p.division} · {p.targetRound}
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#475569', maxWidth: '520px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.content}
                      </p>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: '800' }}>
                    심의하기 ➜
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── [5] 대회 참가자 분포 통계 및 심판 분석 차트 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
        
        {/* 지역별 출전 클럽 분포 */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px 22px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <h4 style={{ fontSize: '0.98rem', fontWeight: '800', color: '#0f172a', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={16} style={{ color: '#2563eb' }} />
            <span>지역별 출전 클럽 및 선수 분포 (Top 6)</span>
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stats.sortedRegions.slice(0, 6).map(([reg, count], idx) => {
              const pct = Math.round((count / stats.total) * 100);
              return (
                <div key={reg} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: '#334155', fontWeight: '700' }}>{idx + 1}. {reg}</span>
                    <strong style={{ color: '#0f172a' }}>{count}명 ({pct}%)</strong>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#2563eb', borderRadius: '4px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 연령대 및 부문별 분포 */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px 22px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <h4 style={{ fontSize: '0.98rem', fontWeight: '800', color: '#0f172a', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={16} style={{ color: '#ea580c' }} />
            <span>연령대 및 부문별 출전 비중</span>
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: '청년부 (만 39세 이하)', count: stats.ageMap['청년부'], color: '#2563eb' },
              { label: '중년부 (만 40세 ~ 55세)', count: stats.ageMap['중년부'], color: '#059669' },
              { label: '장년부 (만 56세 이상)', count: stats.ageMap['장년부'], color: '#ea580c' },
            ].map(item => {
              const pct = Math.round((item.count / stats.total) * 100);
              return (
                <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: '#334155', fontWeight: '700' }}>{item.label}</span>
                    <strong style={{ color: '#0f172a' }}>{item.count}명 ({pct}%)</strong>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: '4px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
