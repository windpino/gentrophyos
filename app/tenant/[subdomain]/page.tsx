'use client';

import React, { useState, useEffect, use } from 'react';
import { Award, Calendar, Layers, FileText, CheckCircle2, UserPlus, RefreshCw, Archive, Search, Compass, MapPin, Phone } from 'lucide-react';

interface TenantData {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  primaryColor: string;
  rulesSummary: string | null;
  tournaments: Array<{
    id: string;
    title: string;
    status: string;
    startDate: string;
    endDate: string;
  }>;
}

interface LeaderboardItem {
  playerId: string;
  name: string;
  birthDate: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  scoreDiff: number;
  totalScores: number;
  rank: number;
}

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
    player: {
      name: string;
      uniqueCode: string;
    };
  }>;
}

export default function TenantPortalPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);

  // 상태 관리
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'notice' | 'register' | 'leaderboard' | 'archive'>('overview');
  const [activeDivisionTab, setActiveDivisionTab] = useState<string>('윈드포일');
  
  // 대회 선택 (진행중인 대회)
  const [activeTournamentId, setActiveTournamentId] = useState<string>('');
  
  // 리더보드 데이터
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');

  // 대진표 데이터
  const [matches, setMatches] = useState<Match[]>([]);

  // 아카이브 데이터
  const [selectedArchiveId, setSelectedArchiveId] = useState<string>('');
  const [archiveLeaderboard, setArchiveLeaderboard] = useState<LeaderboardItem[]>([]);
  const [archiveMatches, setArchiveMatches] = useState<Match[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // 12단계 신청서 폼 상태
  const [applicantName, setApplicantName] = useState('');
  const [applicantBirth, setApplicantBirth] = useState(''); // 8자리 숫자
  const [applicantGender, setApplicantGender] = useState('남자');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicantClub, setApplicantClub] = useState('');
  const [applicantDivision, setApplicantDivision] = useState('윈드포일');
  const [applicantTshirt, setApplicantTshirt] = useState('L (105)');
  
  // 5가지 체크 동의
  const [vestAgreement, setVestAgreement] = useState(false);
  const [paymentNoticeAgreement, setPaymentNoticeAgreement] = useState(false);
  const [liabilityWaiver, setLiabilityWaiver] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [mediaConsent, setMediaConsent] = useState(false);

  const [regSuccess, setRegSuccess] = useState('');
  const [regError, setRegError] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [uniqueClubs, setUniqueClubs] = useState<string[]>([]);

  // 데이터 로딩
  useEffect(() => {
    fetchTenantInfo();
  }, [subdomain]);

  // SSE 실시간 리더보드 갱신
  useEffect(() => {
    if (!subdomain || activeTab !== 'leaderboard') return;

    setLiveStatus('reconnecting');
    const eventSource = new EventSource(`/api/tenant/${subdomain}/events`);

    eventSource.onopen = () => {
      setLiveStatus('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('실시간 데이터 수신:', data);
        fetchLeaderboard(activeTournamentId);
        fetchMatches(activeTournamentId);
      } catch (e) {
        console.error(e);
      }
    };

    eventSource.onerror = () => {
      setLiveStatus('disconnected');
    };

    return () => {
      eventSource.close();
    };
  }, [subdomain, activeTab, activeTournamentId, activeDivisionTab]);

  // 탭 및 대회 ID 변경시 로드 (activeDivisionTab 의존성 추가)
  useEffect(() => {
    if (activeTournamentId) {
      if (activeTab === 'leaderboard') {
        fetchLeaderboard(activeTournamentId);
        fetchMatches(activeTournamentId);
      } else if (activeTab === 'register') {
        fetchUniqueClubs(activeTournamentId);
      }
    }
  }, [activeTab, activeTournamentId, activeDivisionTab]);

  const fetchUniqueClubs = async (tId: string) => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/registrations?tournamentId=${tId}`);
      const data = await res.json();
      if (data.registrations) {
        const clubs: string[] = [];
        data.registrations.forEach((r: any) => {
          try {
            if (r.formResponses) {
              const extra = JSON.parse(r.formResponses);
              if (extra.club && !clubs.includes(extra.club)) {
                clubs.push(extra.club);
              }
            }
          } catch (e) {}
        });
        setUniqueClubs(clubs);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedArchiveId && activeTab === 'archive') {
      fetchArchiveData(selectedArchiveId);
    }
  }, [selectedArchiveId, activeTab]);

  const fetchTenantInfo = async () => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}`);
      const data = await res.json();
      if (data.tenant) {
        setTenant(data.tenant);
        
        const ongoing = data.tenant.tournaments.find((t: any) => t.status === 'ONGOING');
        if (ongoing) {
          setActiveTournamentId(ongoing.id);
        } else if (data.tenant.tournaments.length > 0) {
          setActiveTournamentId(data.tenant.tournaments[0].id);
        }

        const archived = data.tenant.tournaments.filter((t: any) => t.status === 'ARCHIVED');
        if (archived.length > 0) {
          setSelectedArchiveId(archived[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async (tId: string) => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/leaderboard?tournamentId=${tId}&division=${encodeURIComponent(activeDivisionTab)}`);
      const data = await res.json();
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLeaderboardLoading(false);
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

  const getMatchDivision = (match: Match): string => {
    const p1 = match.participants[0];
    if (p1 && p1.player && (p1.player as any).registrations && (p1.player as any).registrations.length > 0) {
      try {
        const reg = (p1.player as any).registrations[0];
        if (reg.formResponses) {
          const extra = JSON.parse(reg.formResponses);
          return extra.division || '윈드포일';
        }
      } catch (e) {}
    }
    return '윈드포일';
  };

  const filteredMatches = matches.filter((match) => getMatchDivision(match) === activeDivisionTab);

  const fetchArchiveData = async (archivedId: string) => {
    setArchiveLoading(true);
    try {
      const lRes = await fetch(`/api/tenant/${subdomain}/leaderboard?tournamentId=${archivedId}`);
      const lData = await lRes.json();
      
      const mRes = await fetch(`/api/tenant/${subdomain}/matches?tournamentId=${archivedId}`);
      const mData = await mRes.json();

      setArchiveLeaderboard(lData.leaderboard || []);
      setArchiveMatches(mData.matches || []);
    } catch (e) {
      console.error(e);
    } finally {
      setArchiveLoading(false);
    }
  };

  // 12단계 참가 신청서 제출 로직
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegSuccess('');
    setRegError('');

    // 유효성 및 동의여부 검사
    if (!applicantName.trim()) return setRegError('성명을 입력해 주세요.');
    if (!/^\d{8}$/.test(applicantBirth)) return setRegError('생년월일 8자리를 정확히 입력해 주세요. (예: 19950815)');
    if (!applicantPhone.trim()) return setRegError('전화번호를 입력해 주세요.');
    if (!applicantClub.trim()) return setRegError('소속협회 또는 클럽을 기입해 주세요.');
    
    // 필수 동의사항 체크 확인
    if (!vestAgreement) return setRegError('조끼(배번티) 수령 동의는 필수입니다.');
    if (!paymentNoticeAgreement) return setRegError('입금 안내 확인 동의는 필수입니다.');
    if (!liabilityWaiver) return setRegError('면책 동의서 서약 동의는 필수입니다.');
    if (!privacyConsent) return setRegError('개인정보 수집 동의는 필수입니다.');
    if (!mediaConsent) return setRegError('초상권 및 저작권 사용 동의는 필수입니다.');

    setRegSubmitting(true);

    try {
      // 12단계 응답 JSON 구조 조립
      const formResponses = {
        gender: applicantGender,
        club: applicantClub,
        division: applicantDivision,
        tshirtSize: applicantTshirt,
        vestAgreement: '네. 확인했습니다.',
        paymentNoticeAgreement: '네. 확인했습니다.',
        liabilityWaiver: '네. 동의합니다.',
        privacyConsent: '네. 동의합니다.',
        mediaConsent: '네. 동의합니다.',
      };

      const res = await fetch(`/api/tenant/${subdomain}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: activeTournamentId,
          name: applicantName,
          email: `${applicantName.toLowerCase()}@windsurfing.com`, // 간이 생성
          phone: applicantPhone,
          formResponses,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '접수 실패');
      }

      setRegSuccess('참가 신청서가 성공적으로 제출되었습니다! 주최측에서 확인 후 문자로 입금계좌를 안내해 드립니다.');
      
      // 폼 초기화
      setApplicantName('');
      setApplicantBirth('');
      setApplicantPhone('');
      setApplicantClub('');
      setVestAgreement(false);
      setPaymentNoticeAgreement(false);
      setLiabilityWaiver(false);
      setPrivacyConsent(false);
      setMediaConsent(false);
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setRegSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-main)' }}>
        <RefreshCw className="animate-spin" size={48} style={{ color: 'var(--theme-primary)' }} />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', color: '#EF4444' }}>대회 채널을 찾을 수 없습니다.</h2>
      </div>
    );
  }

  const ongoingTournament = tenant.tournaments.find((t) => t.status === 'ONGOING');
  const archivedTournaments = tenant.tournaments.filter((t) => t.status === 'ARCHIVED');

  const themeStyles = {
    '--theme-primary': tenant.primaryColor,
    '--theme-primary-hover': tenant.primaryColor + 'cc',
    '--theme-primary-rgb': '0, 128, 128',
  } as React.CSSProperties;

  return (
    <div style={themeStyles}>
      
      {/* 1. 상단 화이트 브랜드 헤더 (로고 배경 흰색 자연 융합) */}
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '80px',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 40px',
          background: '#ffffff',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 하단 글씨 영역을 Crop하고 순수 거북선-돛 그래픽 엠블럼만 노출하는 컨테이너 */}
          <img
            src="/images/logo.png"
            alt="제20회 이순신장군배 전국윈드서핑대회 로고"
            style={{ height: '56px', width: 'auto', objectFit: 'contain' }}
          />

          {/* 엠블럼 오른쪽에 타이틀 글자 두 줄 배치 */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{
              fontSize: '0.85rem',
              fontWeight: '800',
              color: 'var(--text-main)',
              lineHeight: '1.25',
              fontFamily: 'var(--font-title)',
            }}>
              제20회 이순신장군배
            </span>
            <span style={{
              fontSize: '0.85rem',
              fontWeight: '800',
              color: 'var(--theme-primary)',
              lineHeight: '1.25',
              fontFamily: 'var(--font-title)',
            }}>
              전국윈드서핑대회
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href={`/host`}
            className="btn-secondary"
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              background: '#f8fafc',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
            }}
          >
            주최자 ERP
          </a>
          <a
            href={`/referee`}
            className="btn-primary"
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              background: 'var(--theme-primary)',
              color: 'white',
              boxShadow: 'none',
            }}
          >
            심판 입력기
          </a>
        </div>
      </header>

      {/* 2. 웅장한 거북선 윈드서핑 일러스트 히어로 배너 (사용자 커스텀 배경 이미지 적용) */}
      <section
        style={{
          position: 'relative',
          height: '530px', // 세로 높이 약간 축소
          backgroundImage: "url('/images/windsurfing_hero.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '80px 40px 40px 40px',
          borderBottom: '1px solid var(--border-color)',
        }}
        className="animate-fade-in"
      >
        {/* 어두운 반투명 그라데이션 오버레이 (글씨 가독성 확보) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(180deg, rgba(2, 6, 23, 0.1) 0%, rgba(2, 6, 23, 0.75) 100%)',
            zIndex: 1,
          }}
        />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
          
          {/* 타이틀 위의 서브 뱃지 */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{
              fontSize: '0.95rem',
              fontWeight: '900',
              color: 'var(--theme-gold)',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              display: 'block',
            }}>
              TONGYEONG SEA CHALLENGE 2026
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-title)',
            fontSize: '4rem',
            fontWeight: '900',
            lineHeight: '1.1',
            marginBottom: '20px',
            color: 'white',
            textShadow: '0 4px 16px rgba(0,0,0,0.6)'
          }}>
            제20회 이순신장군배<br />
            <span style={{ color: 'var(--theme-gold)' }}>전국윈드서핑대회</span>
          </h1>
          
          <p style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '1.25rem',
            maxWidth: '650px',
            marginBottom: '32px',
            lineHeight: '1.6',
            textShadow: '0 2px 4px rgba(0,0,0,0.4)'
          }}>
            이순신 장군의 한산도 바다 위, 거북선 엠블럼과 함께 수륙해수욕장에서 화려하게 펼쳐지는 대한민국 윈드서핑 축제.
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => ongoingTournament && setActiveTab('register')}
              className="btn-primary"
              style={{
                padding: '16px 32px',
                fontSize: '1rem',
                textTransform: 'uppercase',
                fontWeight: '800',
                background: 'linear-gradient(135deg, var(--theme-gold) 0%, #b39366 100%)',
                color: '#1b263b',
              }}
            >
              대회 참가 신청서 작성
            </button>
            <button
              onClick={() => ongoingTournament && setActiveTab('leaderboard')}
              className="btn-secondary"
              style={{
                padding: '16px 32px',
                fontSize: '1rem',
                textTransform: 'uppercase',
                fontWeight: '800',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'white',
              }}
            >
              실시간 전광판 리더보드
            </button>
          </div>
        </div>
      </section>

      {/* 3. 아래쪽 내용 (옅은 배경색으로 시각적 대비 확보) */}
      <div style={{ background: '#f1f5f9', borderTop: '1px solid var(--border-color)', padding: '60px 0 100px 0', width: '100%' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px' }}>
          <nav
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '40px',
              paddingTop: '20px',
            }}
          >
          {[
            { id: 'overview', label: '대회 요강', icon: Compass },
            { id: 'notice', label: '개최공시서', icon: FileText, disabled: !ongoingTournament },
            { id: 'register', label: '참가 신청서 제출', icon: UserPlus, disabled: !ongoingTournament },
            { id: 'leaderboard', label: '실시간 리더보드', icon: Award, disabled: !ongoingTournament },
            { id: 'archive', label: '역대 기록실', icon: Archive, disabled: archivedTournaments.length === 0 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id as any)}
                disabled={tab.disabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 24px',
                  border: 'none',
                  background: 'none',
                  color: tab.disabled ? 'rgba(255,255,255,0.2)' : (active ? 'var(--theme-primary)' : 'var(--text-muted)'),
                  borderBottom: active ? `3px solid var(--theme-primary)` : '3px solid transparent',
                  cursor: tab.disabled ? 'not-allowed' : 'pointer',
                  fontWeight: '700',
                  fontSize: '1rem',
                  transition: 'var(--transition-smooth)',
                }}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* 3. 메인 콘텐츠 분기 */}
        <main className="animate-fade-in" style={{ paddingBottom: '100px' }}>
          
          {/* A. 대회 요강 탭 (개최공시서 상세 매핑 및 2026년형 UI 고도화) */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '30px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                
                {/* 대회 개요 카드 */}
                <div className="glass-panel" style={{ padding: '24px 30px', background: 'white' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <Compass style={{ color: 'var(--theme-primary)' }} size={22} /> 대회 개요 명세
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '0.95rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ margin: 0 }}><strong>대회명 :</strong> 제20회 이순신장군배 전국윈드서핑대회</p>
                      <p style={{ margin: 0 }}><strong>기간 :</strong> 2026년 9월 5일(토) ~ 6일(일) (1박 2일)</p>
                      <p style={{ margin: 0 }}><strong>장소 :</strong> 통영시 산양읍 영운리 수륙마을 수륙해수욕장 일원</p>
                      <p style={{ margin: 0 }}><strong>참가규모 :</strong> 선착순 130명 한정 조기마감 가능</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ margin: 0 }}><strong>주최 :</strong> 통영시</p>
                      <p style={{ margin: 0 }}><strong>주관 :</strong> 통영시요트협회</p>
                      <p style={{ margin: 0 }}><strong>후원 :</strong> 통영시체육회, 경상남도요트협회</p>
                      <p style={{ margin: 0 }}><strong>임시사무실 :</strong> 수륙마을 내 윈드서핑대회장</p>
                    </div>
                  </div>
                </div>

                {/* 세부 대회 일정 (타임라인 카드) */}
                <div className="glass-panel" style={{ padding: '24px 30px', background: 'white' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <Calendar style={{ color: 'var(--theme-primary)' }} size={22} /> 공식 대회 일정표
                  </h2>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    {/* 1일차 */}
                    <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontWeight: '800', color: 'var(--theme-primary)', borderBottom: '2px solid var(--theme-primary)', paddingBottom: '8px', marginBottom: '12px', margin: 0 }}>
                        1일차: 9월 5일 (토)
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                        <p style={{ margin: 0 }}><strong>10:00 - 12:00 :</strong> 선수등록확인 및 계측</p>
                        <p style={{ margin: 0 }}><strong>12:00 - 13:00 :</strong> 중식 제공 (대회장)</p>
                        <p style={{ margin: 0 }}><strong>13:00 - 13:30 :</strong> 개회식 (수륙해수욕장 특설무대)</p>
                        <p style={{ margin: 0 }}><strong>14:00 - 18:00 :</strong> 1일차 레이스 (각 종목 코스별)</p>
                        <p style={{ margin: 0 }}><strong>19:00 - :</strong> 환영의 밤 및 경품 추첨 (통영협회 앞마당)</p>
                      </div>
                    </div>
                    {/* 2일차 */}
                    <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontWeight: '800', color: 'var(--theme-gold)', borderBottom: '2px solid var(--theme-gold)', paddingBottom: '8px', marginBottom: '12px', margin: 0 }}>
                        2일차: 9월 6일 (일)
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                        <p style={{ margin: 0 }}><strong>10:00 - 12:00 :</strong> 2일차 레이스 (본선)</p>
                        <p style={{ margin: 0 }}><strong>12:00 - 13:00 :</strong> 중식 제공 (대회장)</p>
                        <p style={{ margin: 0 }}><strong>13:00 - 14:00 :</strong> 2일차 레이스 (단체 클럽 대항전)</p>
                        <p style={{ margin: 0 }}><strong>16:00 - :</strong> 폐회식, 시상식 및 행운권 추첨</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 종목 및 세부 클래스 자격 */}
                <div className="glass-panel" style={{ padding: '24px 30px', background: 'white' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <Layers style={{ color: 'var(--theme-primary)' }} size={22} /> 경기 종목 및 세부 클래스
                  </h2>
                  <div className="premium-table-container">
                    <table className="premium-table" style={{ fontSize: '0.85rem', width: '100%' }}>
                      <thead>
                        <tr>
                          <th>경기 종목</th>
                          <th>참가 클래스 구분</th>
                          <th>참가 자격 및 세부 규칙</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: '700' }}>윈드포일</td>
                          <td>남녀 오픈</td>
                          <td>연령 제한 없음</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: '700' }}>윙포일</td>
                          <td>남자부 / 여자부</td>
                          <td>각 10명 이내 제한 가능</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: '700' }}>혼합 오픈</td>
                          <td>청년부 / 중년부 / 장년부 / 마스터즈부 / 여자부</td>
                          <td>남자부의 경우 참가자 연령의 1/4로 균등 분할 편성</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: '700' }}>펀 & 포뮬러</td>
                          <td>청년부 / 중년부 / 장년부 / 마스터즈부 / 여자부</td>
                          <td>남자부의 경우 참가자 연령의 1/4로 균등 분할 편성</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: '700' }}>단체전</td>
                          <td>시·도 및 클럽대항전 (4인 1팀)</td>
                          <td>등록 선수에 한해 참가 가능 (릴레이식 경기 방식)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px', lineHeight: '1.5' }}>
                    <p style={{ margin: 0 }}>※ 단체전을 제외한 종목별 경기의 중복 출전은 불가합니다.</p>
                    <p style={{ margin: 0 }}>※ 모든 나이 산정 기준일은 <strong>2026년 9월 5일</strong>로 통일하여 계산합니다.</p>
                    <p style={{ margin: 0 }}>※ 각 클래스는 참가선수가 5명 이상 출전 시에만 공식 시상을 진행합니다.</p>
                  </div>
                </div>

                {/* 시상 내역 및 상금 명세 */}
                <div className="glass-panel" style={{ padding: '24px 30px', background: 'white' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <Award style={{ color: 'var(--theme-primary)' }} size={22} /> 공식 시상 및 상금 내역
                  </h2>
                  <div className="premium-table-container">
                    <table className="premium-table" style={{ fontSize: '0.85rem', width: '100%' }}>
                      <thead>
                        <tr>
                          <th>구분</th>
                          <th>대상 종목</th>
                          <th>1위 상금</th>
                          <th>2위 상금</th>
                          <th>3위 상금</th>
                          <th>비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: '700' }}>개인전</td>
                          <td>윈드포일, 윙포일, 혼합 오픈, 펀&포뮬러</td>
                          <td><strong>상장 & 40만 원</strong></td>
                          <td><strong>상장 & 30만 원</strong></td>
                          <td><strong>상장 & 20만 원</strong></td>
                          <td>각 클래스 부문별 지급</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: '700' }}>단체전</td>
                          <td>시·도 및 클럽대항 릴레이</td>
                          <td><strong>상장 & 50만 원</strong></td>
                          <td><strong>상장 & 40만 원</strong></td>
                          <td><strong>상장 & 30만 원</strong></td>
                          <td>4위: 20만, 5위: 10만 원</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* 오른쪽 사이드바 안내영역 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* 접수 및 참가비 계좌 */}
                <div className="glass-panel" style={{ background: 'white' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', margin: 0 }}>
                    참가 접수 & 참가비
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem', marginTop: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '700' }}>접수 마감일</span>
                      <p style={{ fontWeight: '800', color: 'var(--text-main)', marginTop: '4px', fontSize: '1.05rem', margin: 0 }}>
                        2026년 8월 13일 (목) 마감
                      </p>
                      <p style={{ fontSize: '0.8rem', color: '#EF4444', marginTop: '2px', margin: 0 }}>* 선착순 130명 도달 시 조기 마감될 수 있습니다.</p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '700' }}>참가비 정보</span>
                      <p style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '4px', margin: 0 }}>- 개인전: 30,000원 / 1인당</p>
                      <p style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '2px', margin: 0 }}>- 단체전: 50,000원 / 팀당</p>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--theme-primary)', fontWeight: '800', display: 'block', marginBottom: '4px' }}>입금 계좌 안내</span>
                      <p style={{ fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>농협은행 351-0984-6726-83</p>
                      <p style={{ color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>예금주: 임병훈(통영윈드서핑카이트보딩협회)</p>
                    </div>
                  </div>
                </div>

                {/* 세부 규정 및 구명동의 의무화 */}
                <div className="glass-panel" style={{ background: 'white' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', margin: 0 }}>
                    경기 규칙 & 안전 수칙
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem', lineHeight: '1.5', marginTop: '12px' }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px' }}>
                      <span style={{ color: '#EF4444', fontWeight: '800', display: 'block', marginBottom: '4px' }}>⚠️ 안전 장구 착용 의무</span>
                      <p style={{ color: '#EF4444', fontWeight: '700', margin: 0 }}>
                        모든 선수는 경기 중 반드시 공식 구명동의(라이프재킷)를 올바르게 착용해야 합니다. 미착용 시 실격 조치됩니다.
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0 }}><strong>경기 규칙:</strong> IWA(국제윈드서핑협회) 세일링 경기규칙 및 범주지시서를 준수합니다.</p>
                      <p style={{ marginTop: '6px', margin: 0 }}><strong>채점 방식:</strong> Low Point Scoring System을 사용합니다. 최소 1경기를 완료해야 공식 순위가 성립하며, 4경기 이상 완료 시 가장 낮은 1경기를 제외한 나머지 전적으로 순위를 산출합니다.</p>
                    </div>
                  </div>
                </div>

                {/* 문의처 */}
                <div className="glass-panel" style={{ background: 'white' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', margin: 0 }}>
                    문의 및 운영진
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', marginTop: '12px' }}>
                    <p style={{ margin: 0 }}><strong>통영윈드서핑협회 전무이사 :</strong> 임병훈 (010-3648-9838)</p>
                    <p style={{ margin: 0 }}><strong>경기운영위원장 :</strong> 윤혜광</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>* 중식 및 숙박, 환영의 밤 숙소 배정은 선수등록자에 한하여 전면 무상 제공됩니다.</p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* A-2. 공식 개최공시서(Notice of Race) 탭 */}
          {activeTab === 'notice' && ongoingTournament && (
            <div style={{ maxWidth: '850px', margin: '0 auto', background: '#ffffff', color: '#1e293b', padding: '50px 60px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '30px' }} className="animate-fade-in">
              {/* 공문서 헤더 */}
              <div style={{ textAlign: 'center', borderBottom: '3px double #0284c7', paddingBottom: '30px', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#0369a1', letterSpacing: '-0.5px', margin: '0 0 10px 0' }}>개최공시서 (Notice of Race)</h1>
                <p style={{ fontSize: '1.1rem', fontWeight: '700', color: '#475569', margin: '0 0 4px 0' }}>제20회 이순신장군배 전국윈드서핑대회</p>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>통영시 · 통영시요트협회</p>
              </div>

              {/* 공문서 바디 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '35px', lineHeight: '1.7', fontSize: '0.95rem' }}>
                
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0369a1', borderLeft: '4px solid #0284c7', paddingLeft: '10px', marginBottom: '12px', margin: 0 }}>
                    제 1 조 (경기 규칙)
                  </h3>
                  <div style={{ paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ margin: 0 }}>1. 본 대회는 국제윈드서핑협회(IWA) 세일링 경기 규칙 및 본 대회 범주지시서에 의거하여 치러집니다.</p>
                    <p style={{ margin: 0 }}>2. 대회 중 발생한 분쟁은 경기규칙에 따른 항의위원회(Protest Committee)의 심의 및 결정을 최종으로 합니다.</p>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0369a1', borderLeft: '4px solid #0284c7', paddingLeft: '10px', marginBottom: '12px', margin: 0 }}>
                    제 2 조 (참가 종목 및 자격 클래스)
                  </h3>
                  <div style={{ paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0 }}>본 대회의 공식 경기 종목은 다음과 같이 구분하여 시행합니다.</p>
                    <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px', margin: 0 }}>
                      <li><strong>윈드포일 (Wind Foil) :</strong> 남녀오픈 통합 클래스</li>
                      <li><strong>윙포일 (Wing Foil) :</strong> 남자부 및 여자부 클래스 (각 부 10명 제한 가능)</li>
                      <li><strong>혼합오픈 (Mixed Open) :</strong> 청년부, 중년부, 장년부, 마스터즈부, 여자부</li>
                      <li><strong>펀 & 포뮬러 (Fun & Formula) :</strong> 청년부, 중년부, 장년부, 마스터즈부, 여자부</li>
                      <li><strong>단체전 (Club Relay) :</strong> 시·도 및 클럽대항전 (4인 1팀 릴레이식 범주)</li>
                    </ul>
                    <p style={{ color: '#ef4444', fontWeight: '700', margin: 0 }}>※ 단체전을 제외한 개인 종목 간의 중복 출전은 전면 불허합니다.</p>
                    <p style={{ margin: 0 }}>※ 각 클래스의 연령 구분은 참가자의 실제 생년월일을 기준하여 청년/중년/장년/마스터즈부로 균등 1/4 분할하여 편성합니다. (기준일: 2026년 9월 5일)</p>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0369a1', borderLeft: '4px solid #0284c7', paddingLeft: '10px', marginBottom: '12px', margin: 0 }}>
                    제 3 조 (경기 채점 및 성립 조건)
                  </h3>
                  <div style={{ paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ margin: 0 }}>1. 경기 채점은 국제 표준인 Low Point Scoring System(선착순 벌점제)을 적용합니다.</p>
                    <p style={{ margin: 0 }}>2. 최소 1경기가 안전하게 완료되었을 시 본 대회의 공식 순위가 성립됩니다.</p>
                    <p style={{ margin: 0 }}>3. 총 4경기 이상 완료 시, 각 선수의 성적 중 가장 나쁜 1경기 성적(벌점)을 제외(Drop)한 나머지 경기 전적의 합산으로 순위를 정합니다.</p>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0369a1', borderLeft: '4px solid #0284c7', paddingLeft: '10px', marginBottom: '12px', margin: 0 }}>
                    제 4 조 (안전 규정 및 의무 사항)
                  </h3>
                  <div style={{ paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '15px 20px', borderRadius: '8px', color: '#b91c1c' }}>
                      <p style={{ fontWeight: '800', margin: 0 }}>⚠️ 구명동의(라이프재킷) 착용 필수</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                        모든 참가 선수는 해상 레이스 중 반드시 공인된 구명조끼를 바르게 착용해야 합니다. 미착용 혹은 임의 탈착 적발 시 즉각 실격(DSQ) 처리됩니다.
                      </p>
                    </div>
                    <p style={{ margin: 0 }}>1. 모든 출전 선수는 세일에 배정된 배번 배표 조끼를 식별이 가능하도록 착용해야 합니다.</p>
                    <p style={{ margin: 0 }}>2. 해상 기상 악화 시 경기위원장의 지시에 따라 즉시 레이스를 중단하고 전원 육상으로 복귀하여야 합니다.</p>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0369a1', borderLeft: '4px solid #0284c7', paddingLeft: '10px', marginBottom: '12px', margin: 0 }}>
                    제 5 조 (시상 및 상금 지급 세부 조항)
                  </h3>
                  <div style={{ paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0 }}>1. 개인전 각 부문 클래스별로 1위~3위까지 공식 상장 및 상금을 수여합니다.</p>
                    <p style={{ margin: 0 }}>2. <strong>개인전 상금 명세 :</strong> 1위 40만 원, 2위 30만 원, 3위 20만 원</p>
                    <p style={{ margin: 0 }}>3. <strong>단체전 상금 명세 :</strong> 1위 50만 원, 2위 40만 원, 3위 30만 원, 4위 20만 원, 5위 10만 원</p>
                    <p style={{ margin: 0 }}>※ 단, 세부 클래스당 최소 참가 선수가 5명 이상 출전한 부문에 한하여 공식 시상을 진행하며, 5명 미만 시 타 클래스와 통합 또는 시상이 취소될 수 있습니다.</p>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0369a1', borderLeft: '4px solid #0284c7', paddingLeft: '10px', marginBottom: '12px', margin: 0 }}>
                    제 6 조 (책임 한계 및 면책 고시)
                  </h3>
                  <div style={{ paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ margin: 0 }}>1. 본 대회에 참가하는 선수는 전적으로 자기 책임하에 범주에 참여합니다. 주최기관, 주관기관, 후원단체 및 경기 운영 요원은 대회 중 발생한 장비 손상, 인명 사고, 부상 및 사망 등의 물리적/민형사상 손해에 대하여 일체의 책임을 지지 않습니다.</p>
                    <p style={{ margin: 0 }}>2. 선수는 참가 신청서 제출과 동시에 면책 서약서 조항에 전면 동의한 것으로 간주합니다.</p>
                  </div>
                </div>

              </div>

              {/* 공문서 꼬리 */}
              <div style={{ textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '30px', marginTop: '10px', color: '#64748b', fontSize: '0.85rem' }}>
                <p style={{ margin: 0 }}>2026년 8월</p>
                <p style={{ fontSize: '1.1rem', fontWeight: '800', color: '#334155', marginTop: '10px', margin: '10px 0 0 0' }}>통 영 시 요 트 협 회</p>
              </div>
            </div>
          )}

          {/* B. 참가 신청서 제출 탭 (네이버 폼 12단계 완벽 재현) */}
          {activeTab === 'register' && ongoingTournament && (
            <div style={{ maxWidth: '650px', margin: '0 auto' }} className="glass-panel">
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>대회 참가 신청서 작성</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>* 표시가 있는 항목은 필수 작성 항목입니다.</p>
              </div>

              <form onSubmit={handleRegisterSubmit}>
                
                {/* 1. 성명 */}
                <div className="form-group">
                  <label className="form-label">1. 성명 <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="실명을 입력해 주세요."
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    required
                  />
                </div>

                {/* 2. 생년월일 */}
                <div className="form-group">
                  <label className="form-label">2. 생년월일 (8자리) 예) 19450815 <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    maxLength={8}
                    placeholder="숫자만 입력 가능합니다."
                    value={applicantBirth}
                    onChange={(e) => setApplicantBirth(e.target.value.replace(/[^0-9]/g, ''))}
                    required
                  />
                </div>

                {/* 3. 성별 */}
                <div className="form-group">
                  <label className="form-label">3. 성별 <span style={{ color: '#EF4444' }}>*</span></label>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                    {['남자', '여자'].map((g) => (
                      <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="gender_select"
                          value={g}
                          checked={applicantGender === g}
                          onChange={(e) => setApplicantGender(e.target.value)}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <span>{g}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 4. 전화번호 */}
                <div className="form-group">
                  <label className="form-label">4. 전화번호 (휴대폰번호) <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="예) 01012345678"
                    value={applicantPhone}
                    onChange={(e) => setApplicantPhone(e.target.value)}
                    required
                  />
                </div>

                {/* 5. 소속협회 또는 클럽 */}
                <div className="form-group">
                  <label className="form-label">5. 소속협회 또는 클럽 <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="소속 단체명을 입력해 주세요."
                    value={applicantClub}
                    onChange={(e) => setApplicantClub(e.target.value)}
                    list="club-suggestions"
                    required
                  />
                  <datalist id="club-suggestions">
                    {uniqueClubs.map((clubName) => (
                      <option key={clubName} value={clubName} />
                    ))}
                  </datalist>
                </div>

                {/* 6. 참가종목 */}
                <div className="form-group">
                  <label className="form-label">6. 참가종목 <span style={{ color: '#EF4444' }}>*</span></label>
                  <select
                    className="form-input"
                    value={applicantDivision}
                    onChange={(e) => setApplicantDivision(e.target.value)}
                    required
                  >
                    <option value="윈드포일">윈드포일 (남녀오픈)</option>
                    <option value="윙포일">윙포일 (남자부/여자부)</option>
                    <option value="혼합오픈">혼합오픈 (연령대별 편성)</option>
                    <option value="펀엔포뮬러">펀엔포뮬러 (연령대별 편성)</option>
                  </select>
                </div>

                {/* 7. 티셔츠 사이즈 */}
                <div className="form-group">
                  <label className="form-label">7. 티셔츠(기념품)사이즈 <span style={{ color: '#EF4444' }}>*</span></label>
                  <select
                    className="form-input"
                    value={applicantTshirt}
                    onChange={(e) => setApplicantTshirt(e.target.value)}
                    required
                  >
                    <option value="S (95)">S (95)</option>
                    <option value="M (100)">M (100)</option>
                    <option value="L (105)">L (105)</option>
                    <option value="XL (110)">XL (110)</option>
                  </select>
                </div>

                {/* 8. 조끼 배번티 수령 동의 */}
                <div className="form-group" style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <label className="form-label" style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                    8. 당일 대회본부에 조끼(배번티)를 반드시 수령하셔야 합니다. <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    • 대회운영본부 수령 필수 (사용 후 반드시 반납바랍니다)
                  </p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={vestAgreement}
                      onChange={(e) => setVestAgreement(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontWeight: '600' }}>네. 확인했습니다.</span>
                  </label>
                </div>

                {/* 9. 입금안내 확인 동의 */}
                <div className="form-group" style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', marginTop: '16px' }}>
                  <label className="form-label" style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                    9. 참가비 입금 안내 확인 동의 <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    • 선착순 선수등록 처리 후 130명 마감 시 계좌는 개별 문자 통지합니다.
                  </p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={paymentNoticeAgreement}
                      onChange={(e) => setPaymentNoticeAgreement(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontWeight: '600' }}>네. 확인했습니다.</span>
                  </label>
                </div>

                {/* 10. 면책 서약서 동의 */}
                <div className="form-group" style={{ marginTop: '24px' }}>
                  <label className="form-label">10. 면책 동의서 서약에 동의합니다. <span style={{ color: '#EF4444' }}>*</span></label>
                  <div style={{
                    height: '100px',
                    overflowY: 'scroll',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    lineHeight: '1.5',
                    marginBottom: '12px',
                    border: '1px solid var(--border-color)'
                  }}>
                    본인은 제20회 이순신장군배 전국윈드서핑대회 참가 활동 중 본인의 부주의로 인해 발생할 수 있는 사고, 즉 개인적 부상, 재산상 피해, 의학적인 사고 등 대회기간 중 발생한 사고에 대한 책임은 본인의 자의적인 참가에 의한 본인의 책임이며, 본 대회를 주관하는 관계자 및 기관에 대한 면책은 물론 책임전가를 하지 않을 것을 서약합니다.
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={liabilityWaiver}
                      onChange={(e) => setLiabilityWaiver(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontWeight: '600' }}>네. 동의합니다.</span>
                  </label>
                </div>

                {/* 11. 개인정보 동의 */}
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label className="form-label">11. 개인정보 수집에 동의합니다. <span style={{ color: '#EF4444' }}>*</span></label>
                  <div style={{
                    height: '80px',
                    overflowY: 'scroll',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    lineHeight: '1.5',
                    marginBottom: '12px',
                    border: '1px solid var(--border-color)'
                  }}>
                    • 정보수집 및 이용기관 : 통영시요트협회<br />
                    • 수집 정보 : 성명, 생년월일, 전화번호, 이메일, 소속 단체<br />
                    • 수집 목적 : 참가자 관리 및 보험가입, 대회 공지 전송 등<br />
                    • 보존 기간 : 대회 정산 이후 즉시 폐기합니다.
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={privacyConsent}
                      onChange={(e) => setPrivacyConsent(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontWeight: '600' }}>네. 동의합니다.</span>
                  </label>
                </div>

                {/* 12. 초상권 사용 동의 */}
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label className="form-label">12. 초상권 및 저작권 사용 동의 <span style={{ color: '#EF4444' }}>*</span></label>
                  <div style={{
                    height: '80px',
                    overflowY: 'scroll',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    lineHeight: '1.5',
                    marginBottom: '12px',
                    border: '1px solid var(--border-color)'
                  }}>
                    대회 기간 중 촬영된 사진/영상은 다음 목적에 사용될 수 있음에 동의합니다.<br />
                    • 관련 기관의 홈페이지, SNS, 정산보고서, 팜플렛 및 각종 홍보물 제작 게재 등<br />
                    • 수집 및 이용기관 : 통영시요트협회
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={mediaConsent}
                      onChange={(e) => setMediaConsent(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontWeight: '600' }}>네. 동의합니다.</span>
                  </label>
                </div>

                {regError && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#F87171', border: '1px solid #EF4444', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
                    {regError}
                  </div>
                )}

                {regSuccess && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34D399', border: '1px solid #10B981', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
                    {regSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '30px', padding: '16px', fontSize: '1.05rem' }}
                  disabled={regSubmitting}
                >
                  {regSubmitting ? '참가 신청 제출 중...' : '신청서 제출 완료'}
                </button>
              </form>
            </div>
          )}

          {/* C. 실시간 리더보드 탭 */}
          {activeTab === 'leaderboard' && ongoingTournament && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              {/* 윈드서핑 세부 종목별 필터링 탭바 */}
              <div className="glass-panel" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '16px 20px', background: 'white' }}>
                {['윈드포일', '윙포일', '혼합오픈', '펀엔포뮬러'].map((div) => {
                  const active = activeDivisionTab === div;
                  return (
                    <button
                      key={div}
                      onClick={() => setActiveDivisionTab(div)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '20px',
                        border: 'none',
                        background: active ? 'var(--theme-primary)' : 'rgba(0,0,0,0.05)',
                        color: active ? '#ffffff' : 'var(--text-muted)',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      {div}
                    </button>
                  );
                })}
              </div>

              <div className="glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award style={{ color: 'var(--theme-primary)' }} />
                    실시간 윙포일 / 윈드포일 종합 순위표
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: liveStatus === 'connected' ? '#10B981' : (liveStatus === 'reconnecting' ? '#F59E0B' : '#EF4444'),
                        display: 'inline-block'
                      }}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                      {liveStatus === 'connected' ? '실시간 연동중' : '연결 중단'}
                    </span>
                  </div>
                </div>

                {leaderboardLoading ? (
                  <p style={{ color: 'var(--text-muted)' }}>순위 계산 엔진 구동 중...</p>
                ) : leaderboard.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>완료된 경기 기록이 아직 없습니다.</p>
                ) : (
                  <div className="premium-table-container">
                    <table className="premium-table">
                      <thead>
                        <tr>
                          <th>순위</th>
                          <th>성명</th>
                          <th>승점</th>
                          <th>승</th>
                          <th>패</th>
                          <th>득실차</th>
                          <th>총득점</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((row) => (
                          <tr key={row.playerId} className="animate-fade-in">
                            <td style={{ fontWeight: '800', color: row.rank === 1 ? 'var(--text-highlight)' : 'var(--text-main)' }}>
                              {row.rank}위
                            </td>
                            <td style={{ fontWeight: '600' }}>{row.name}</td>
                            <td>{row.points}점</td>
                            <td>{row.wins}승</td>
                            <td>{row.losses}패</td>
                            <td style={{ color: row.scoreDiff > 0 ? '#10B981' : (row.scoreDiff < 0 ? '#EF4444' : 'inherit') }}>
                              {row.scoreDiff > 0 ? `+${row.scoreDiff}` : row.scoreDiff}
                            </td>
                            <td>{row.totalScores}점</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="glass-panel">
                <h2 style={{ fontSize: '1.6rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers style={{ color: 'var(--theme-primary)' }} />
                  실시간 공식 대진표 (Notice of Race 대진)
                </h2>

                {filteredMatches.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>선택하신 종목({activeDivisionTab})의 대진 정보가 아직 없습니다.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {filteredMatches.map((match) => {
                      const p1 = match.participants[0];
                      const p2 = match.participants[1];
                      return (
                        <div
                          key={match.id}
                          className="glass-panel"
                          style={{
                            padding: '16px',
                            background: 'rgba(0,0,0,0.15)',
                            borderColor: match.status === 'ONGOING' ? 'var(--theme-primary)' : 'var(--border-color)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>라운드 {match.round} ({match.matchType})</span>
                            <span style={{
                              color: match.status === 'COMPLETED' ? 'var(--text-muted)' : (match.status === 'ONGOING' ? 'var(--text-highlight)' : '#F59E0B'),
                              fontWeight: '700'
                            }}>
                              {match.status === 'COMPLETED' ? '종료됨' : (match.status === 'ONGOING' ? '진행중' : '대기중')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: p1?.isWinner ? '700' : '400' }}>{p1?.player.name || '미배정'}</span>
                              <span style={{ fontWeight: '700' }}>{match.status !== 'SCHEDULED' && p1 ? p1.score : '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: p2?.isWinner ? '700' : '400' }}>{p2?.player.name || '미배정'}</span>
                              <span style={{ fontWeight: '700' }}>{match.status !== 'SCHEDULED' && p2 ? p2.score : '-'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* D. 아카이브 탭 */}
          {activeTab === 'archive' && archivedTournaments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <Search style={{ color: 'var(--theme-primary)' }} />
                <label className="form-label" style={{ margin: 0, fontWeight: '700' }}>역대 윈드서핑 대회 아카이브:</label>
                <select
                  className="form-input"
                  style={{ maxWidth: '300px' }}
                  value={selectedArchiveId}
                  onChange={(e) => setSelectedArchiveId(e.target.value)}
                >
                  {archivedTournaments.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              {archiveLoading ? (
                <p style={{ color: 'var(--text-muted)' }}>기록실 로드 중...</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px' }}>
                  
                  <div className="glass-panel">
                    <h3 style={{ fontSize: '1.3rem', marginBottom: '20px' }}>당시 최종 순위표</h3>
                    <div className="premium-table-container">
                      <table className="premium-table">
                        <thead>
                          <tr>
                            <th>순위</th>
                            <th>이름</th>
                            <th>승점</th>
                            <th>승</th>
                            <th>패</th>
                          </tr>
                        </thead>
                        <tbody>
                          {archiveLeaderboard.map((row) => (
                            <tr key={row.playerId}>
                              <td style={{ fontWeight: '800' }}>{row.rank}위</td>
                              <td style={{ fontWeight: '600' }}>{row.name}</td>
                              <td>{row.points}점</td>
                              <td>{row.wins}승</td>
                              <td>{row.losses}패</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="glass-panel">
                    <h3 style={{ fontSize: '1.3rem', marginBottom: '20px' }}>당시 전체 경기 전적</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {archiveMatches.map((m) => {
                        const p1 = m.participants[0];
                        const p2 = m.participants[1];
                        return (
                          <div key={m.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                              <span>라운드 {m.round}</span>
                              <span>종료됨</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontWeight: p1?.isWinner ? '700' : '400' }}>{p1?.player.name} ({p1?.score}점)</span>
                              <span style={{ color: 'var(--text-muted)' }}>vs</span>
                              <span style={{ fontWeight: p2?.isWinner ? '700' : '400' }}>({p2?.score}점) {p2?.player.name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

        </main>
      </div>
      </div>
    </div>
  );
}
