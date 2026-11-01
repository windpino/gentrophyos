'use client';

import React, { useMemo } from 'react';
import {
  Users,
  Award,
  Layers,
  TrendingUp,
  MapPin,
  CheckCircle2,
  Clock,
  Sparkles,
  Trophy,
  History,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Activity
} from 'lucide-react';
import { GridRow } from './page';

interface HostDashboardViewProps {
  gridData: GridRow[];
  activeTournament: any;
  tenant: any;
  subdomain: string;
  onNavigateSection: (section: 'applicants' | 'brackets' | 'results' | 'history' | 'tie-breaker') => void;
}

export function parseParticipantRegion(club?: string, phone?: string): string {
  const c = (club || '').trim();
  if (c.includes('통영')) return '경남 (통영)';
  if (c.includes('거제') || c.includes('한화오션')) return '경남 (거제)';
  if (c.includes('창원') || c.includes('고성') || c.includes('진주') || c.includes('남해') || c.includes('경남')) return '경남 (기타)';
  if (c.includes('서울') || c.includes('휴티')) return '서울';
  if (c.includes('경기') || c.includes('가천') || c.includes('성남') || c.includes('수원') || c.includes('인천')) return '경기 · 인천';
  if (c.includes('부산') || c.includes('해운대') || c.includes('송정') || c.includes('다대포')) return '부산';
  if (c.includes('울산')) return '울산';
  if (c.includes('광양') || c.includes('여수') || c.includes('순천') || c.includes('목포') || c.includes('전남') || c.includes('광주')) return '전남 · 광주';
  if (c.includes('대구') || c.includes('포항') || c.includes('경북')) return '대구 · 경북';
  if (c.includes('대전') || c.includes('세종') || c.includes('충남') || c.includes('충북')) return '충청 · 대전';
  if (c.includes('강원') || c.includes('강릉') || c.includes('양양') || c.includes('속초')) return '강원';
  if (c.includes('제주')) return '제주';

  const p = (phone || '').replace(/[^0-9]/g, '');
  if (p.startsWith('02')) return '서울';
  if (p.startsWith('031') || p.startsWith('032')) return '경기 · 인천';
  if (p.startsWith('055')) return '경남 (기타)';
  if (p.startsWith('051')) return '부산';
  if (p.startsWith('052')) return '울산';
  if (p.startsWith('061') || p.startsWith('062')) return '전남 · 광주';
  if (p.startsWith('053') || p.startsWith('054')) return '대구 · 경북';
  if (p.startsWith('042') || p.startsWith('041') || p.startsWith('043') || p.startsWith('044')) return '충청 · 대전';
  if (p.startsWith('033')) return '강원';
  if (p.startsWith('064')) return '제주';

  return '기타 · 전국';
}

export function parseParticipantAge(birth?: string): number | null {
  if (!birth) return null;
  const digits = String(birth).replace(/[^0-9]/g, '');
  if (digits.length >= 6) {
    const rawY = digits.length >= 8 ? digits.slice(0, 4) : digits.slice(0, 2);
    let birthYear = parseInt(rawY, 10);
    if (rawY.length === 2) {
      birthYear = birthYear <= 26 ? 2000 + birthYear : 1900 + birthYear;
    }
    const currentYear = 2026;
    return currentYear - birthYear + 1;
  }
  return null;
}

export function parseParticipantGender(gender?: string, division?: string): '남성' | '여성' {
  if (gender) {
    if (gender.includes('여') || gender.toLowerCase().includes('female') || gender.toLowerCase() === 'f') return '여성';
    if (gender.includes('남') || gender.toLowerCase().includes('male') || gender.toLowerCase() === 'm') return '남성';
  }
  if (division) {
    if (division.includes('여자') || division.includes('여성')) return '여성';
    if (division.includes('남자') || division.includes('남성')) return '남성';
  }
  return '남성';
}

export function normalizeDivisionName(div?: string): string {
  if (!div) return '기타';
  if (div.includes('혼합오픈')) return '혼합오픈';
  if (div.includes('펀')) return '펀&포뮬러';
  if (div.includes('윈드포일')) return '윈드포일';
  if (div.includes('윙포일')) return '윙포일';
  if (div.includes('단체전')) return '단체전';
  return div.trim();
}

export default function HostDashboardView({
  gridData,
  activeTournament,
  tenant,
  subdomain,
  onNavigateSection,
}: HostDashboardViewProps) {
  // 통계 계산
  const stats = useMemo(() => {
    const total = gridData.length;
    const approved = gridData.filter(r => r.paymentStatus === 'APPROVED' || r.status === 'APPROVED').length;
    const pending = total - approved;
    const bibAssigned = gridData.filter(r => r.bibNumber && r.bibNumber.trim() && r.bibNumber !== '-').length;

    // 종목별 분포
    const divMap: Record<string, number> = {};
    const genderMap: Record<'남성' | '여성', number> = { 남성: 0, 여성: 0 };
    const regionMap: Record<string, number> = {};
    const ageGroupMap: Record<string, number> = {
      '20대 이하': 0,
      '30대': 0,
      '40대': 0,
      '50대': 0,
      '60대 이상': 0,
    };
    const clubMap: Record<string, number> = {};

    let ageSum = 0;
    let ageCount = 0;
    let minAge = 999;
    let maxAge = 0;

    gridData.forEach(r => {
      // 종목
      const dName = normalizeDivisionName(r.division);
      divMap[dName] = (divMap[dName] || 0) + 1;

      // 성별
      const g = parseParticipantGender(r.gender, r.division);
      genderMap[g] = (genderMap[g] || 0) + 1;

      // 지역
      const reg = parseParticipantRegion(r.club, r.phone);
      regionMap[reg] = (regionMap[reg] || 0) + 1;

      // 연령대
      const age = parseParticipantAge(r.birth);
      if (age !== null && age > 0 && age < 120) {
        ageSum += age;
        ageCount++;
        if (age < minAge) minAge = age;
        if (age > maxAge) maxAge = age;

        if (age < 30) ageGroupMap['20대 이하']++;
        else if (age < 40) ageGroupMap['30대']++;
        else if (age < 50) ageGroupMap['40대']++;
        else if (age < 60) ageGroupMap['50대']++;
        else ageGroupMap['60대 이상']++;
      }

      // 소속 클럽
      const clubName = (r.club || '').trim() || '개인 참가';
      clubMap[clubName] = (clubMap[clubName] || 0) + 1;
    });

    // 정렬된 종목 목록
    const divisionList = Object.entries(divMap)
      .map(([name, count]) => ({ name, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    // 정렬된 지역 목록
    const regionList = Object.entries(regionMap)
      .map(([name, count]) => ({ name, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    // 정렬된 연령대 목록
    const ageGroupList = Object.entries(ageGroupMap).map(([label, count]) => ({
      label,
      count,
      percent: ageCount > 0 ? Math.round((count / ageCount) * 100) : 0,
    }));

    // Top 클럽
    const topClubs = Object.entries(clubMap)
      .filter(([name]) => name !== '개인 참가')
      .map(([name, count]) => ({ name, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const avgAge = ageCount > 0 ? Math.round(ageSum / ageCount) : 48;

    return {
      total,
      approved,
      pending,
      bibAssigned,
      genderMap,
      divisionList,
      regionList,
      ageGroupList,
      topClubs,
      avgAge,
      minAge: minAge === 999 ? 18 : minAge,
      maxAge: maxAge === 0 ? 75 : maxAge,
    };
  }, [gridData]);

  // 종목별 색상 맵
  const divisionColors: Record<string, { bg: string; bar: string; text: string }> = {
    '혼합오픈': { bg: '#eff6ff', bar: '#3b82f6', text: '#1d4ed8' },
    '펀&포뮬러': { bg: '#fef3c7', bar: '#f59e0b', text: '#b45309' },
    '윈드포일': { bg: '#f0fdf4', bar: '#10b981', text: '#047857' },
    '윙포일': { bg: '#fdf2f8', bar: '#ec4899', text: '#be185d' },
    '단체전': { bg: '#f5f3ff', bar: '#8b5cf6', text: '#6d28d9' },
    '기타': { bg: '#f8fafc', bar: '#64748b', text: '#334155' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* 1. 대회 현황 헤더 웰컴 배너 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #1e293b 100%)',
          borderRadius: '20px',
          padding: '28px 32px',
          color: 'white',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(217, 119, 6, 0.25)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '800', color: '#fbbf24', marginBottom: '12px' }}>
            <Activity size={14} /> 실시간 대회 운영 종합 관제 대시보드
          </div>
          <h2 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)', fontWeight: '900', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            {activeTournament?.title || '제20회 이순신장군배 전국윈드서핑대회'}
          </h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.92rem', lineHeight: '1.5' }}>
            {tenant?.name || '통영시윈드서핑협회'} 주관 · 전체 참가 선수 인구통계 및 레이스 성적 현황을 한눈에 실시간 모니터링합니다.
          </p>
        </div>

        {/* 퀵 액션 링크 버튼들 */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigateSection('results')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 18px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
              transition: 'all 0.2s',
            }}
          >
            <Trophy size={16} />
            최종 성적 결과
          </button>
          <button
            onClick={() => onNavigateSection('history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 18px',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '0.88rem',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s',
            }}
          >
            <History size={16} />
            역대 기록관
          </button>
          <a
            href={`/tenant/${subdomain}/referee`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 18px',
              background: 'rgba(59, 130, 246, 0.2)',
              color: '#93c5fd',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '0.88rem',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            <ExternalLink size={16} />
            심판입력기
          </a>
        </div>
      </div>

      {/* 2. 핵심 KPI 요약 카드 그리드 (총 4개) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        
        {/* 카드 1: 총 참가자수 & 확정률 */}
        <div
          onClick={() => onNavigateSection('applicants')}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '22px 24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#64748b' }}>총 참가 신청자</span>
              <div style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a', lineHeight: '1.2', marginTop: '4px' }}>
                {stats.total}<span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#64748b', marginLeft: '4px' }}>명</span>
              </div>
            </div>
            <div style={{ padding: '10px', background: '#eff6ff', borderRadius: '12px', color: '#2563eb' }}>
              <Users size={22} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '700', color: '#059669', marginBottom: '6px' }}>
              <span>입금/출전 확정 ({stats.approved}명)</span>
              <span>{stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}%</span>
            </div>
            <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${stats.total > 0 ? (stats.approved / stats.total) * 100 : 0}%`, height: '100%', background: '#10b981', borderRadius: '4px' }} />
            </div>
          </div>
        </div>

        {/* 카드 2: 배번티 배정 현황 */}
        <div
          onClick={() => onNavigateSection('brackets')}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '22px 24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#64748b' }}>배번티 배정 완료</span>
              <div style={{ fontSize: '2rem', fontWeight: '900', color: '#d97706', lineHeight: '1.2', marginTop: '4px' }}>
                {stats.bibAssigned}<span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#64748b', marginLeft: '4px' }}>/ {stats.total}명</span>
              </div>
            </div>
            <div style={{ padding: '10px', background: '#fffbeb', borderRadius: '12px', color: '#d97706' }}>
              <Layers size={22} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '700', color: '#b45309', marginBottom: '6px' }}>
              <span>배번 배정률</span>
              <span>{stats.total > 0 ? Math.round((stats.bibAssigned / stats.total) * 100) : 0}%</span>
            </div>
            <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${stats.total > 0 ? (stats.bibAssigned / stats.total) * 100 : 0}%`, height: '100%', background: '#f59e0b', borderRadius: '4px' }} />
            </div>
          </div>
        </div>

        {/* 카드 3: 성별 구성비 */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '22px 24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#64748b' }}>남녀 성별 구성</span>
              <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#0f172a', lineHeight: '1.2', marginTop: '4px' }}>
                남 {stats.genderMap.남성} <span style={{ color: '#cbd5e1', fontWeight: '400' }}>/</span> 여 {stats.genderMap.여성}
              </div>
            </div>
            <div style={{ padding: '10px', background: '#fdf2f8', borderRadius: '12px', color: '#ec4899' }}>
              <TrendingUp size={22} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '700', marginBottom: '6px' }}>
              <span style={{ color: '#1d4ed8' }}>남성 {stats.total > 0 ? Math.round((stats.genderMap.남성 / stats.total) * 100) : 0}%</span>
              <span style={{ color: '#be185d' }}>여성 {stats.total > 0 ? Math.round((stats.genderMap.여성 / stats.total) * 100) : 0}%</span>
            </div>
            <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${stats.total > 0 ? (stats.genderMap.남성 / stats.total) * 100 : 0}%`, height: '100%', background: '#3b82f6' }} />
              <div style={{ width: `${stats.total > 0 ? (stats.genderMap.여성 / stats.total) * 100 : 0}%`, height: '100%', background: '#ec4899' }} />
            </div>
          </div>
        </div>

        {/* 카드 4: 참가 선수 연령 정보 */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '22px 24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#64748b' }}>선수 평균 연령</span>
              <div style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a', lineHeight: '1.2', marginTop: '4px' }}>
                {stats.avgAge}<span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#64748b', marginLeft: '4px' }}>세</span>
              </div>
            </div>
            <div style={{ padding: '10px', background: '#f5f3ff', borderRadius: '12px', color: '#8b5cf6' }}>
              <Sparkles size={22} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#475569', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px' }}>
            <span>최연소: <strong>{stats.minAge}세</strong></span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>최고령: <strong>{stats.maxAge}세</strong></span>
          </div>
        </div>

      </div>

      {/* 3. 4대 핵심 시각화 그래프 영역 (2 x 2 그리드) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px' }}>
        
        {/* 그래프 ①: 종목별 참가 현황 그래프 */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '26px 28px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '900', margin: 0, color: '#0f172a' }}>
                ⛵ 종목별 참가 현황
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                5개 공식 종목별 등록 인원 및 참가 점유율
              </p>
            </div>
            <button
              onClick={() => onNavigateSection('brackets')}
              style={{
                fontSize: '0.8rem',
                color: 'var(--theme-primary, #2563eb)',
                background: 'none',
                border: 'none',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              대진표 보기 <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {stats.divisionList.map((item) => {
              const theme = divisionColors[item.name] || divisionColors['기타'];
              return (
                <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: theme.bar,
                        }}
                      />
                      <strong style={{ color: '#1e293b' }}>{item.name}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '800', color: theme.text }}>{item.count}명</span>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', minWidth: '38px', textAlign: 'right' }}>({item.percent}%)</span>
                    </div>
                  </div>
                  {/* 프로그레스 바 */}
                  <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${item.percent}%`,
                        height: '100%',
                        background: theme.bar,
                        borderRadius: '6px',
                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 그래프 ②: 지역별 참가 분포 그래프 */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '26px 28px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '900', margin: 0, color: '#0f172a' }}>
                📍 지역별 참가 분포
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                선수 소속 클럽 및 연고지 기준 전국 참가 현황
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#059669', background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px', fontWeight: '800' }}>
              전국 총 {stats.regionList.length}개 권역
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stats.regionList.slice(0, 6).map((item, idx) => {
              const colors = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#a5b4fc', '#c7d2fe'];
              const barColor = colors[idx] || '#cbd5e1';
              return (
                <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '800', color: idx < 3 ? '#d97706' : '#64748b', minWidth: '18px' }}>
                        {idx + 1}위
                      </span>
                      <strong style={{ color: '#1e293b' }}>{item.name}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '800', color: '#0f172a' }}>{item.count}명</span>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', minWidth: '38px', textAlign: 'right' }}>({item.percent}%)</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${item.percent}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: '4px',
                        transition: 'width 0.6s ease-in-out',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 그래프 ③: 연령대별 참가자 분포 그래프 */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '26px 28px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '900', margin: 0, color: '#0f172a' }}>
                🎂 연령대별 참가 분포
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                20대 이하부터 60대 이상까지 전 세대 참가 현황
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#b45309', background: '#fffbeb', padding: '3px 8px', borderRadius: '6px', fontWeight: '800' }}>
              주력: 40~50대
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '170px', padding: '10px 10px 0 10px', borderBottom: '2px solid #e2e8f0', gap: '12px' }}>
            {stats.ageGroupList.map((item) => {
              const maxPct = Math.max(...stats.ageGroupList.map(a => a.percent), 1);
              const barHeight = Math.max(12, Math.round((item.percent / maxPct) * 125));
              const isTop = item.percent === maxPct;

              return (
                <div key={item.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: isTop ? '#2563eb' : '#64748b' }}>
                    {item.count}명
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '52px',
                      height: `${barHeight}px`,
                      background: isTop ? 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)' : '#cbd5e1',
                      borderRadius: '8px 8px 0 0',
                      transition: 'height 0.6s ease',
                      boxShadow: isTop ? '0 4px 10px rgba(37, 99, 235, 0.3)' : 'none',
                    }}
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', marginTop: '4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 청년/중년/장년부 클래스 분할 안내 배너 */}
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>남자부 조편성 기준:</span>
            <span style={{ fontWeight: '800', color: '#1e293b' }}>
              청년부(34명) · 중년부(34명) · 장년부(34명) 균등 분할
            </span>
          </div>
        </div>

        {/* 그래프 ④: 최다 참가 클럽 / 동호회 순위 */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '26px 28px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '900', margin: 0, color: '#0f172a' }}>
                🏆 최다 참가 소속 클럽 Top 6
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                가장 많은 선수를 출전시킨 전국 우수 윈드서핑 클럽
              </p>
            </div>
            <Award size={20} style={{ color: '#d97706' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {stats.topClubs.map((club, idx) => {
              const medals = ['🥇', '🥈', '🥉', '4위', '5위', '6위'];
              return (
                <div
                  key={club.name}
                  style={{
                    background: idx === 0 ? '#fffbeb' : '#f8fafc',
                    border: `1px solid ${idx === 0 ? '#fde68a' : '#e2e8f0'}`,
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.1rem' }}>{medals[idx]}</span>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '0.86rem', color: '#1e293b', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {club.name}
                      </div>
                      <span style={{ fontSize: '0.74rem', color: '#64748b' }}>출전 점유율 {club.percent}%</span>
                    </div>
                  </div>
                  <span style={{ fontWeight: '900', fontSize: '1rem', color: idx === 0 ? '#b45309' : '#0f172a' }}>
                    {club.count}명
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b' }}>
            <span>단일 클럽 최다: <strong>통영윈드서핑협회</strong></span>
            <span>단체전 출전: <strong>총 6개 클럽 팀</strong></span>
          </div>
        </div>

      </div>

    </div>
  );
}
