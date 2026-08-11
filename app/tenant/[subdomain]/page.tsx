'use client';

import React, { useState, useEffect, use } from 'react';
import { useSearchParams } from 'next/navigation';
import { Award, Calendar, Layers, FileText, CheckCircle2, UserPlus, RefreshCw, Archive, Search, Compass, MapPin, Phone } from 'lucide-react';

interface TenantData {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  primaryColor: string;
  rulesSummary: string | null;
  overviewConfig?: any;
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
  const searchParams = useSearchParams();
  const applyMode = searchParams.get('mode') === 'apply';

  // 상태 관리
  const [tenant, setTenant] = useState<TenantData | null>(null);

  // 대회요강 Fallback 및 동적 데이터 셋업
  const overview = {
    title: '제20회 미추홀구청장배 전국핀수영대회',
    duration: '2026. 9. 12(토) ~ 13(일) 2일간',
    location: '문학박태환수영장 (인천광역시 미추홀구 경원대로 526)',
    scale: '300명 (선착순 마감)',
    host: '인천광역시 미추홀구',
    sponsor: '인천광역시핀수영협회, 미추홀구체육회',
    supporter: '인천광역시 미추홀구',
    office: '문학박태환수영장 (인천광역시 미추홀구 경원대로 526)',
    bankName: '선수등록 승인 후 개별 문자 발송 예정',
    accountNo: '계좌번호 등록대기',
    accountHolder: '인천광역시핀수영협회',
    entryFeeIndividual: '개인전 1종목당 20,000원',
    entryFeeGroup: '단체전 팀당 50,000원',
    deadlineDate: '2026년 8월 24일(월)',
    rulesNote: '※ 참가 신청 시 소속 클럽 명확히 작성 필수.\n※ 단체전은 남녀 혼성 계영 4x50m 및 4x100m로 진행함.\n※ 모든 나이는 2026년 9월 12일을 기준으로 합니다.\n※ 1인 최대 2종목까지 신청 가능 (단체전 제외).\n※ 참가인원은 선착순으로 300명이 충족되면 참가접수 기한이 조기에 마감될 수 있습니다.\n※ 참가비가 납부되어야 정식 등록이 완료되며 기한 내 미납 시 참가가 자동 취소됩니다.\n※ 신청기간 이후에는 취소 및 참가비 환불이 불가합니다.',
    itineraryDay1: '10:00 - 12:00 : 선수단 현장등록 및 웜업\n12:00 - 13:00 : 중식\n13:00 - 13:30 : 개회식\n13:30 - 18:00 : 1일차 경기',
    itineraryDay2: '09:00 - 12:00 : 2일차 경기\n12:00 - 13:00 : 중식\n13:00 - 18:00 : 2일차 경기 및 시상식\n18:00 - : 폐회식 및 해산',
    itineraryDay3: '',
    itineraryDay4: '',
    itineraryDay5: '',
    ...(tenant?.overviewConfig || {})
  };
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'notice' | 'intro' | 'live' | 'gallery' | 'archive'>('overview');
  const [activeSubTab, setActiveSubTab] = useState<string>('');
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
    if (!subdomain || activeTab !== 'live') return;

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
      if (activeTab === 'live') {
        fetchLeaderboard(activeTournamentId);
        fetchMatches(activeTournamentId);
      } else {
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

  if (applyMode && ongoingTournament) {
    return (
      <div style={{ ...themeStyles, minHeight: '100vh', backgroundColor: '#ffffff', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* 상단 단독 폼 타이틀 및 브랜딩 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <img
            src="/images/logo_new.png"
            alt="대회 로고"
            style={{ height: '220px', width: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* 단독 폼 카드 */}
        <div style={{ width: '100%', maxWidth: '650px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', padding: '32px' }}>
          
          {/* 헤더 버튼 영역 (홈페이지 바로가기 및 링크 복사) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)' }}>대회 참가 신청서 작성</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>* 표시가 있는 항목은 필수 작성 항목입니다.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + window.location.pathname + '?mode=apply');
                  alert('참가 신청서 단독 링크가 클립보드에 복사되었습니다! 다른 분들께 링크를 공유해 보세요.');
                }}
                className="btn-secondary"
                style={{ padding: '8px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', border: '1px solid var(--border-color)', cursor: 'pointer', borderRadius: '6px' }}
              >
                🔗 링크 복사
              </button>
            </div>
          </div>

          {/* 대회 안내 정보 상단 배치 */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '24px',
            fontSize: '0.85rem',
            lineHeight: '1.7',
            color: 'var(--text-main)'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: '0 0 16px 0', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', color: 'var(--theme-primary)' }}>
              제20회 이순신장군배 전국윈드서핑대회 안내
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '6px' }}>▣ 대회개요</strong>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• <strong>주 최 :</strong> 통영시</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• <strong>주 관 :</strong> 통영시요트협회</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• <strong>후 원 :</strong> 통영시체육회, 경상남도요트협회, 한국윈드서핑협회</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• <strong>대회일정 :</strong> 2026. 9. 12(토) ~ 13(일) 1박2일</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• <strong>장 소 :</strong> 통영시 산양읍 영운리 수륙마을 내 수륙해수욕장</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• <strong>참가인원 :</strong> 130명</p>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '6px' }}>▣ 경기종목</strong>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• <strong>윈드포일 :</strong> 남녀오픈</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• <strong>윙포일 :</strong> 남자부/여자부</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• <strong>혼합오픈 :</strong> 남자청년부/남자중년부/남자장년부/여자부</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• <strong>펀앤포뮬러 :</strong> 남자청년부/남자중년부/남자장년부/여자부</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• <strong>단체전</strong></p>
                <p style={{ margin: '8px 0 0 0', paddingLeft: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  ※ 각 클래스는 생년월일기준으로 편성하며 선수 5명이상 출전 시 시상한다.<br />
                  ※ 단체전을 제외한 종목별 경기의 중복출전은 불가하다.<br />
                  ※ 단체전은 시,도 클럽별 릴레이식 참가선수 4명이 1개 팀으로 하는 경기방식 채택한다.<br />
                  ◉ 모든 나이는 2026년 9월 12일을 기준으로 한다.
                </p>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '6px' }}>▣ 접수방법</strong>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• 2026년 8월 27일(목) 까지 참가신청서를 작성하여 선수등록을 하여야 한다.</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• 단체전은 2026년 9월 13일(일) 경기개시 1시간 전 선수등록하여 시행한다.</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• 참가인원은 선착순으로 130명이 충족되면 참가접수기한이 조기에 마감할 수 있다. (이번대회 신설된 윙포일부분은 남녀각각 10명으로 참가인원을 제한한다.)</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• 참가비 입금계좌는 선수접수등록 후 개별 통지하며 참가비가 입금이 완료되어야 참가자격이 주어진다.</p>
              </div>

              <div>
                <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '6px' }}>▣ 기타&문의사항</strong>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• 통영윈드서핑협회 전무이사 임병훈(010-3648-9838)</p>
                <p style={{ margin: 0, paddingLeft: '8px' }}>• 2026.08.10 11:37 ~ 제한 없음</p>
              </div>
            </div>
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
                placeholder="예) 19901024"
                value={applicantBirth}
                onChange={(e) => setApplicantBirth(e.target.value)}
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
                      name="gender_select_apply"
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
                required
              />
            </div>

            {/* 6. 참가종목 */}
            <div className="form-group">
              <label className="form-label">6. 참가종목 <span style={{ color: '#EF4444' }}>*</span></label>
              <select
                className="form-input"
                value={applicantDivision}
                onChange={(e) => setApplicantDivision(e.target.value)}
                required
                style={{ background: 'white', color: 'var(--text-main)' }}
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
                style={{ background: 'white', color: 'var(--text-main)' }}
              >
                <option value="S (95)">S (95)</option>
                <option value="M (100)">M (100)</option>
                <option value="L (105)">L (105)</option>
                <option value="XL (110)">XL (110)</option>
              </select>
            </div>

            {/* 8. 조끼 배번티 수령 동의 */}
            <div className="form-group" style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', marginTop: '16px' }}>
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

            {/* 11. 개인정보 수집 동의 */}
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
              {regSubmitting ? '참가 신청서 제출 중...' : '참가 신청서 제출'}
            </button>


          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={themeStyles}>
      
      {/* 1. 상단 화이트 브랜드 헤더 (로고 배경 흰색 자연 융합) */}
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '96px',
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
          <img
            src="/images/logo_new.png"
            alt="제20회 이순신장군배 전국윈드서핑대회 로고"
            style={{ height: '80px', width: 'auto', objectFit: 'contain' }}
          />

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

        {/* 탭 네비게이션 메뉴 (상단 GNB 구조화) */}
        <nav
          style={{
            display: 'flex',
            gap: '8px',
            height: '100%',
            alignItems: 'center',
          }}
        >
          {[
            { id: 'overview', label: '📋 대회 요강', defaultSubTab: '', disabled: false },
            { id: 'notice', label: '📢 개최공시서', defaultSubTab: '', disabled: false },
            { id: 'intro', label: '⛵ 대회소개', defaultSubTab: 'intro-greeting', disabled: false },
            { id: 'live', label: '⏱️ 경기운영', defaultSubTab: 'live-leaderboard', disabled: !ongoingTournament },
            { id: 'gallery', label: '📸 미디어 & 갤러리', defaultSubTab: 'gallery-photos', disabled: false },
            { id: 'archive', label: '🏆 역대 기록관', defaultSubTab: 'archive-home', disabled: false },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (!tab.disabled) {
                    setActiveTab(tab.id as any);
                    setActiveSubTab(tab.defaultSubTab);
                  }
                }}
                disabled={tab.disabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 16px',
                  height: '100%',
                  border: 'none',
                  background: 'none',
                  color: tab.disabled ? 'rgba(0,0,0,0.15)' : (active ? 'var(--theme-primary)' : 'var(--text-muted)'),
                  borderBottom: active ? `3px solid var(--theme-primary)` : '3px solid transparent',
                  cursor: tab.disabled ? 'not-allowed' : 'pointer',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  transition: 'var(--transition-smooth)',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href="/host"
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
            href="/referee"
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
          padding: '96px 40px 40px 40px',
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
            background: 'linear-gradient(180deg, rgba(2, 6, 23, 0.05) 0%, rgba(2, 6, 23, 0.45) 100%)',
            zIndex: 1,
          }}
        />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
          
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
              onClick={() => {
                if (ongoingTournament) {
                  window.open(window.location.pathname + '?mode=apply', '_blank');
                }
              }}
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
              참가 신청서 제출
            </button>
            <button
              onClick={() => {
                if (ongoingTournament) {
                  setActiveTab('live');
                  setActiveSubTab('live-leaderboard');
                }
              }}
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
      <div style={{ background: '#f1f5f9', borderTop: '1px solid var(--border-color)', padding: '40px 0 100px 0', width: '100%' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>

          {/* 가로형 서브 탭 네비게이션 Pill Bar */}
          {activeTab !== 'overview' && activeTab !== 'notice' && (
            <div style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '30px',
              padding: '12px 20px',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}>
              {activeTab === 'intro' && [
                { id: 'intro-greeting', label: '인사말 / 조직위원회' },
                { id: 'intro-schedule', label: '대회 개요 및 일정' },
                { id: 'intro-location', label: '대회 장소 및 코스 안내' },
                { id: 'intro-rules', label: '대회 규정 및 요강 (룰)' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: activeSubTab === sub.id ? 'var(--theme-primary)' : '#f1f5f9',
                    color: activeSubTab === sub.id ? '#ffffff' : 'var(--text-muted)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  {sub.label}
                </button>
              ))}

              {activeTab === 'live' && [
                { id: 'live-leaderboard', label: '실시간 리더보드 🟢' },
                { id: 'live-brackets', label: '대진표 및 조 편성표' },
                { id: 'live-notice', label: '공지사항 / 긴급 알림' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: activeSubTab === sub.id ? 'var(--theme-primary)' : '#f1f5f9',
                    color: activeSubTab === sub.id ? '#ffffff' : 'var(--text-muted)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  {sub.label}
                </button>
              ))}

              {activeTab === 'gallery' && [
                { id: 'gallery-photos', label: '포토갤러리' },
                { id: 'gallery-videos', label: '해상 영상 및 쇼츠' },
                { id: 'gallery-press', label: '언론보도 및 스폰서' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: activeSubTab === sub.id ? 'var(--theme-primary)' : '#f1f5f9',
                    color: activeSubTab === sub.id ? '#ffffff' : 'var(--text-muted)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  {sub.label}
                </button>
              ))}

              {activeTab === 'archive' && [
                { id: 'archive-home', label: '아카이브 홈 🌟' },
                { id: 'archive-final-rank', label: '최종 순위 및 역대 기록' },
                { id: 'archive-artifacts', label: '대회 기념물·홍보물 아카이브 📁' }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: activeSubTab === sub.id ? 'var(--theme-primary)' : '#f1f5f9',
                    color: activeSubTab === sub.id ? '#ffffff' : 'var(--text-muted)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

        {/* 3. 메인 콘텐츠 분기 */}
        <main className="animate-fade-in" style={{ paddingBottom: '100px' }}>
          
          {/* NOR. 개최공시서 탭 */}
          {activeTab === 'notice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 공시서 헤더 */}
              <div className="glass-panel" style={{ background: 'white', padding: '28px 32px', borderTop: '4px solid var(--theme-primary)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '900', textAlign: 'center', color: 'var(--text-main)', marginBottom: '4px' }}>
                  {overview.title} 개최공시서
                </h2>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Notice of Race (NOR)</p>
              </div>

              {overview.noticeText ? (
                <div className="glass-panel" style={{ background: 'white', padding: '28px 32px', whiteSpace: 'pre-wrap', lineHeight: '1.8', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  {overview.noticeText}
                </div>
              ) : (
                <>

              {/* 제1조 총칙 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>제1조 (대회 개요)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', lineHeight: '1.7' }}>
                  <p style={{ margin: 0 }}>1.1 대 회 명 : 제20회 미추홀구청장배 전국핀수영대회</p>
                  <p style={{ margin: 0 }}>1.2 주 최 : 인천광역시 미추홀구</p>
                  <p style={{ margin: 0 }}>1.3 주 관 : 인천광역시핀수영협회, 미추홀구체육회</p>
                  <p style={{ margin: 0 }}>1.4 기 간 : 2026년 9월 12일(토) ~ 13일(일) (2일간)</p>
                  <p style={{ margin: 0 }}>1.5 장 소 : 문학박태환수영장 (인천광역시 미추홀구 경원대로 526)</p>
                  <p style={{ margin: 0 }}>1.6 참가인원 : 300명</p>
                </div>
              </div>

              {/* 제2조 일정 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>제2조 (대회 일정)</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>구분</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>시간</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', borderBottom: '2px solid #e2e8f0' }}>일정</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>장소</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { 구분: '9. 12(토)', 시간: '10:00 ~ 12:00', 일정: '선수단 현장등록 및 웜업', 장소: '문학박태환수영장' },
                        { 구분: '9. 12(토)', 시간: '12:00 ~ 13:00', 일정: '중식', 장소: '' },
                        { 구분: '9. 12(토)', 시간: '13:00 ~ 13:30', 일정: '개회식', 장소: '수영장 특설무대' },
                        { 구분: '9. 12(토)', 시간: '13:30 ~ 18:00', 일정: '1일차 경기', 장소: '문학박태환수영장' },
                        { 구분: '9. 13(일)', 시간: '09:00 ~ 12:00', 일정: '2일차 경기', 장소: '문학박태환수영장' },
                        { 구분: '9. 13(일)', 시간: '12:00 ~ 13:00', 일정: '중식', 장소: '' },
                        { 구분: '9. 13(일)', 시간: '13:00 ~ 18:00', 일정: '2일차 경기 및 시상식', 장소: '문학박태환수영장' },
                        { 구분: '9. 13(일)', 시간: '18:00 ~', 일정: '폐회식 및 해산', 장소: '수영장 특설무대' },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: '700', whiteSpace: 'nowrap' }}>{row.구분}</td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{row.시간}</td>
                          <td style={{ padding: '10px 14px' }}>{row.일정}</td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{row.장소}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <p style={{ margin: 0 }}>※ 기상 악화 및 수영장 사정에 따라 경기 시간은 변경될 수 있으며, 세부 일정은 상황에 따라 조정 및 변경될 수 있음.</p>
                </div>
              </div>

              {/* 제3조 경기 종목 및 참가 자격 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>제3조 (경기 종목 및 참가 자격)</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', borderBottom: '2px solid #e2e8f0' }}>구분</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', borderBottom: '2px solid #e2e8f0' }}>클래스</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', borderBottom: '2px solid #e2e8f0' }}>비 고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { 구분: '일반부', 클래스: '대학/일반', 비고: '' },
                        { 구분: '청소년부', 클래스: '고등부, 중등부, 초등부', 비고: '' },
                        { 구분: '마스터즈', 클래스: '마스터즈 1부, 마스터즈 2부, 마스터즈 3부', 비고: '※ 1부 (만 20~29세), 2부 (만 30~39세), 3부 (만 40세 이상)' },
                        { 구분: '엘리트', 클래스: '등록선수 (학생/일반)', 비고: '' },
                        { 구분: '단체전', 클래스: '각 클럽/동호회팀별 릴레이', 비고: '' },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: '700' }}>{row.구분}</td>
                          <td style={{ padding: '10px 14px' }}>{row.클래스}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{row.비고}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <p style={{ margin: 0 }}>※ 참가 신청 시 소속 클럽 명확히 작성 필수.</p>
                  <p style={{ margin: 0 }}>※ 단체전은 남녀 혼성 계영 4x50m 및 4x100m로 진행함.</p>
                  <p style={{ margin: 0 }}>※ 모든 나이는 2026년 9월 12일을 기준으로 함.</p>
                </div>
              </div>

              {/* 제4조 참가 신청 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>제4조 (참가 신청)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', lineHeight: '1.7' }}>
                  <p style={{ margin: 0 }}>4.1 신청기간 : 2026년 8월 24일(월) 까지</p>
                  <p style={{ margin: 0 }}>4.2 신청방법 : 홈페이지를 통한 온라인 참가신청서 접수</p>
                  <p style={{ margin: 0, color: '#EF4444', fontWeight: '700' }}>※ 참가인원은 선착순으로 300명이 충족되면 참가접수기한이 조기에 마감될 수 있다.</p>
                  <p style={{ margin: 0, color: '#EF4444', fontWeight: '700' }}>※ 참가비가 납부되어야 정식 등록이 완료되며 기한 내 미납 시 참가가 자동 취소됩니다.</p>
                  <p style={{ margin: 0 }}>4.3 참가비 : 개인전 1종목당 20,000원, 단체전 팀당 50,000원</p>
                  <p style={{ margin: 0 }}>※ 1인 최대 2종목까지 신청 가능 (단체전 제외).</p>
                  <p style={{ margin: 0 }}>※ 참가비 입금 시 반드시 &apos;소속_대표자명&apos; 또는 &apos;선수명&apos;으로 입금.</p>
                  <p style={{ margin: 0, color: '#EF4444', fontWeight: '700' }}>※ 신청기간 이후에는 취소 및 참가비 환불이 불가합니다.</p>
                </div>
              </div>

              {/* 제5조 시상 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>제5조 (시상)</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', borderBottom: '2px solid #e2e8f0' }}>구분</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', borderBottom: '2px solid #e2e8f0' }}>클래스</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', borderBottom: '2px solid #e2e8f0' }}>시상</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { 구분: '개인전', 클래스: '전 클래스', 시상: '1위: 상장 및 메달, 2위: 상장 및 메달, 3위: 상장 및 메달' },
                        { 구분: '단체전', 클래스: '각 클래스별 릴레이', 시상: '1위: 상패 및 메달, 2위: 상패 및 메달, 3위: 상패 및 메달' },
                        { 구분: '종합시상', 클래스: '종합', 시상: '종합 우승: 우승기 및 트로피, 종합 준우승: 트로피, 종합 3위: 트로피' },
                      ].map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: '700' }}>{row.구분}</td>
                          <td style={{ padding: '10px 14px' }}>{row.클래스}</td>
                          <td style={{ padding: '10px 14px', color: '#b45309', fontWeight: '700' }}>{row.시상}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <p style={{ margin: 0 }}>※ 각 클래스별 참가자가 3명 미만일 경우 시상만 하고 메달 수여는 제외될 수 있습니다.</p>
                  <p style={{ margin: 0 }}>※ 종합시상은 각 종목별 점수를 합산하여 산출함 (1위 9점, 2위 7점, 3위 6점, 4위 5점, 5위 4점, 6위 3점, 7위 2점, 8위 1점. 단체전은 배점 2배).</p>
                </div>
              </div>

              {/* 제6조 제출 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>제6조 (제출)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', lineHeight: '1.7' }}>
                  <p style={{ margin: 0 }}>6.1 온라인 참가신청 시 서약서 동의 및 서명 제출</p>
                  <p style={{ margin: 0 }}>6.2 참가 선수 전원 단체 보험 가입 필수 (소속 동호회/클럽 개별 가입 권장)</p>
                  <p style={{ margin: 0 }}>6.3 주민등록초본 또는 학생증 사본 (본인 확인용)</p>
                  <p style={{ margin: 0 }}>6.4 경기 당일 신분증 (주민등록증, 운전면허증 등) 지참 필수</p>
                </div>
              </div>

              {/* 제7조 경기규칙 및 안전수칙 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>제7조 (경기규칙 및 안전수칙)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', lineHeight: '1.7' }}>
                  <p style={{ margin: 0 }}>7.1 본 대회는 대한수중핀수영협회(KUA) 및 세계수중연맹(CMAS) 핀수영 경기 규칙을 적용합니다.</p>
                  <p style={{ margin: 0 }}>7.2 안전을 위해 경기 중 안전요원의 통제에 적극 협조해야 하며, 이를 위반 시 퇴장 조치될 수 있습니다.</p>
                  <p style={{ margin: 0 }}>7.3 준비운동을 철저히 하고 경기 전 심신상태를 점검해 사고를 예방해야 합니다.</p>
                </div>
              </div>

              {/* 제8조 보험 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>제8조 (보험)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', lineHeight: '1.7' }}>
                  <p style={{ margin: 0 }}>8.1 대회 주최측은 대회 참가자를 위한 스포츠안전재단 주최자배상책임공제에 가입합니다.</p>
                  <p style={{ margin: 0 }}>8.2 참가 선수는 개인 실손의료보험 가입을 적극 권장하며, 경기 중 발생하는 부상에 대해 주최측은 응급조치 외 책임을 지지 않습니다.</p>
                  <p style={{ margin: 0 }}>8.3 장비 파손 및 분실에 대한 책임은 선수 본인에게 있습니다.</p>
                </div>
              </div>

              {/* 제9조 항의 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>제9조 (항의)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', lineHeight: '1.7' }}>
                  <p style={{ margin: 0 }}>9.1 항의는 각 종목 경기 종료 후 30분 이내에 서면으로 제출해야 합니다.</p>
                  <p style={{ margin: 0 }}>9.2 이의신청 시 이의신청비 50,000원을 동봉해야 하며, 기각 시 반환하지 않고 협회 기금으로 귀속됩니다.</p>
                  <p style={{ margin: 0 }}>9.3 심판위원회의 판정이 최종 결정이며, 추가 이의제기는 불가합니다.</p>
                </div>
              </div>

              {/* 제10조 장비 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>제10조 (장비)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', lineHeight: '1.7' }}>
                  <p style={{ margin: 0 }}>10.1 대회 공인 장비(핀, 스노클, 수영복 등) 규정을 준수해야 합니다.</p>
                  <p style={{ margin: 0 }}>10.2 승인되지 않은 비공인 장비 사용 시 실격 처리될 수 있습니다.</p>
                  <p style={{ margin: 0, color: '#EF4444', fontWeight: '700' }}>※ 필수 장비 누락 시 경기 참가가 제한될 수 있습니다.</p>
                </div>
              </div>

              {/* 제11조 기타 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>제11조 (기타)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', lineHeight: '1.7' }}>
                  <p style={{ margin: 0 }}>11.1 대회 참가자 전원에게 기념 티셔츠 및 참가 기념품을 제공합니다.</p>
                  <p style={{ margin: 0 }}>11.2 수영장 내 취사 행위는 절대 금지되며, 쓰레기는 지정된 장소에 분리배출 해야 합니다.</p>
                  <p style={{ margin: 0 }}>11.3 기타 문의 사항은 인천광역시 핀수영협회 사무국(032-888-2940)으로 문의 바랍니다.</p>
                </div>
              </div>

              {/* 면책 동의 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>면책 동의</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', lineHeight: '1.7', background: '#fefce8', padding: '16px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <p style={{ margin: 0 }}>본인은 제20회 미추홀구청장배 전국핀수영대회 참가 활동 중 본인의 부주의로 인해 발생할 수 있는 사고, 즉 개인적 부상, 재산상 피해, 의학적인 사고 등 대회기간 중 발생한 사고에 대한 책임은 본인의 자의적인 참가에 의한 본인의 책임이며, 본 대회를 주관하는 관계자 및 기관에 대한 면책은 물론 책임전가를 하지 않을 것을 서약합니다.</p>
                </div>
              </div>

              {/* 개인정보 수집 동의 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>개인정보 수집 동의</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', lineHeight: '1.7' }}>
                  <p style={{ margin: 0 }}>• 정보수집 및 이용기관 : 인천광역시핀수영협회, 미추홀구체육회</p>
                  <p style={{ margin: 0 }}>• 전화번호, 생년월일</p>
                  <p style={{ margin: 0 }}>• 참가선수 관리 및 보험가입 / 대회 안내문자 및 SNS발송</p>
                  <p style={{ margin: 0 }}>• 대회정산이후 폐기 한다.</p>
                </div>
              </div>

              {/* 초상권 및 저작권 사용동의 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>초상권 및 저작권 사용동의</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', lineHeight: '1.7' }}>
                  <p style={{ margin: 0 }}>대회 기간중 촬영된 사진 / 영상은 다음 목적에 사용될 수 있음에 동의합니다.</p>
                  <p style={{ margin: 0 }}>• 관련 기관의 홈페이지, SNS, 정산보고서, 팜플렛 및 각종 홍보물</p>
                  <p style={{ margin: 0 }}>• 수집 및 이용기관 : 인천광역시핀수영협회, 미추홀구체육회</p>
                </div>
              </div>

              {/* 경기장 위치 이미지 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px', textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '14px' }}>경기장 위치도</h3>
                <img src="/images/map_munhak.jpg" alt="문학박태환수영장 위치도" style={{ maxWidth: '100%', borderRadius: '10px', border: '1px solid var(--border-color)' }} />
                <p style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-muted)', margin: '10px 0 0 0' }}>인천광역시 미추홀구 경원대로 526 문학박태환수영장</p>
              </div>
                </>
              )}
            </div>
          )}

          {/* A. 대회 요강 대메뉴 (Notice of Race 통합 및 세련된 연동) */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '30px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                
                {/* 대회 개요 카드 */}
                <div className="glass-panel" style={{ padding: '24px 30px', background: 'white' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <Compass style={{ color: 'var(--theme-primary)' }} size={22} /> 대회 개요 명세
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '0.95rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ margin: 0 }}><strong>대회명 :</strong> {overview.title}</p>
                      <p style={{ margin: 0 }}><strong>기간 :</strong> {overview.duration}</p>
                      <p style={{ margin: 0 }}><strong>장소 :</strong> {overview.location}</p>
                      <p style={{ margin: 0 }}><strong>참가규모 :</strong> {overview.scale}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ margin: 0 }}><strong>주최 :</strong> {overview.host}</p>
                      <p style={{ margin: 0 }}><strong>주관 :</strong> {overview.sponsor}</p>
                      <p style={{ margin: 0 }}><strong>후원 :</strong> {overview.supporter}</p>
                      <p style={{ margin: 0 }}><strong>임시사무실 :</strong> {overview.office}</p>
                    </div>
                  </div>
                </div>

                {/* 세부 대회 일정 (타임라인 카드) */}
                <div className="glass-panel" style={{ padding: '24px 30px', background: 'white' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <Calendar style={{ color: 'var(--theme-primary)' }} size={22} /> 공식 대회 일정표 (5일간)
                  </h2>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                    {/* 1일차 */}
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontWeight: '800', color: 'var(--theme-primary)', borderBottom: '2px solid var(--theme-primary)', paddingBottom: '8px', marginBottom: '12px', margin: 0 }}>
                        1일차 (9/10)
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                        {overview.itineraryDay1.split('\n').map((line: string, idx: number) => {
                          const splitIdx = line.indexOf(':');
                          if (splitIdx > -1) {
                            const time = line.substring(0, splitIdx).trim();
                            const desc = line.substring(splitIdx + 1).trim();
                            return <p key={idx} style={{ margin: 0 }}><strong>{time} :</strong> {desc}</p>;
                          }
                          return <p key={idx} style={{ margin: 0 }}>{line}</p>;
                        })}
                      </div>
                    </div>
                    {/* 2일차 */}
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontWeight: '800', color: 'var(--theme-primary)', borderBottom: '2px solid var(--theme-primary)', paddingBottom: '8px', marginBottom: '12px', margin: 0 }}>
                        2일차 (9/13)
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                        {overview.itineraryDay2.split('\n').map((line: string, idx: number) => {
                          const splitIdx = line.indexOf(':');
                          if (splitIdx > -1) {
                            const time = line.substring(0, splitIdx).trim();
                            const desc = line.substring(splitIdx + 1).trim();
                            return <p key={idx} style={{ margin: 0 }}><strong>{time} :</strong> {desc}</p>;
                          }
                          return <p key={idx} style={{ margin: 0 }}>{line}</p>;
                        })}
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
                          <th>세부 클래스</th>
                          <th>비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: '800', color: 'var(--theme-primary)' }}>일반부</td>
                          <td>대학/일반</td>
                          <td>-</td>
                        </tr>
                        <tr>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: '800', color: 'var(--theme-primary)' }}>청소년부</td>
                          <td>고등부, 중등부, 초등부</td>
                          <td>-</td>
                        </tr>
                        <tr>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: '800', color: 'var(--theme-primary)' }}>마스터즈</td>
                          <td>마스터즈 1부, 마스터즈 2부, 마스터즈 3부</td>
                          <td>※ 1부 (만 20~29세), 2부 (만 30~39세), 3부 (만 40세 이상)</td>
                        </tr>
                        <tr>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: '800', color: 'var(--theme-primary)' }}>엘리트</td>
                          <td>등록선수 (학생/일반)</td>
                          <td>-</td>
                        </tr>
                        <tr>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: '800', color: 'var(--theme-gold)' }}>단체전 (Relay)</td>
                          <td>각 클럽/동호회팀별 릴레이</td>
                          <td>남녀 혼성 계영 4x50m 및 4x100m로 진행함.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 공식 시상 및 상금 내역 */}
                <div className="glass-panel" style={{ padding: '24px 30px', background: 'white' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                    <Award style={{ color: 'var(--theme-gold)' }} size={22} /> 공식 시상 내역 명세
                  </h2>
                  <div className="premium-table-container">
                    <table className="premium-table" style={{ fontSize: '0.85rem', width: '100%' }}>
                      <thead>
                        <tr>
                          <th>구분</th>
                          <th>클래스</th>
                          <th>시상 및 기준</th>
                          <th>비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: '800' }}>개인전</td>
                          <td style={{ whiteSpace: 'nowrap' }}>전 클래스</td>
                          <td style={{ whiteSpace: 'nowrap' }}><strong>1위: 상장 및 메달<br/>2위: 상장 및 메달<br/>3위: 상장 및 메달</strong></td>
                          <td>각 클래스별 참가자가 3명 미만일 경우 시상만 하고 메달 수여는 제외될 수 있습니다.</td>
                        </tr>
                        <tr>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: '800' }}>단체전</td>
                          <td style={{ whiteSpace: 'nowrap' }}>각 클래스별 릴레이</td>
                          <td style={{ whiteSpace: 'nowrap' }}><strong>1위: 상패 및 메달<br/>2위: 상패 및 메달<br/>3위: 상패 및 메달</strong></td>
                          <td>-</td>
                        </tr>
                        <tr>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: '800', color: 'var(--theme-gold)' }}>종합시상</td>
                          <td style={{ whiteSpace: 'nowrap' }}>종합</td>
                          <td style={{ whiteSpace: 'nowrap' }}><strong>종합 우승: 우승기 및 트로피<br/>종합 준우승: 트로피<br/>종합 3위: 트로피</strong></td>
                          <td>각 종목별 점수를 합산하여 산출함 (1위 9점, 2위 7점, 3위 6점, 4위 5점, 5위 4점, 6위 3점, 7위 2점, 8위 1점. 단체전은 배점 2배).</td>
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
                        {overview.deadlineDate}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: '#EF4444', marginTop: '2px', margin: 0 }}>* 선착순 도달 시 조기 마감될 수 있습니다.</p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '700' }}>참가비 정보</span>
                      <p style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '4px', margin: 0 }}>- 개인전: {overview.entryFeeIndividual}</p>
                      <p style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '2px', margin: 0 }}>- 단체전: {overview.entryFeeGroup}</p>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--theme-primary)', fontWeight: '800', display: 'block', marginBottom: '4px' }}>입금 계좌 안내</span>
                      <p style={{ fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>{overview.bankName} {overview.accountNo}</p>
                      <p style={{ color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>예금주: {overview.accountHolder}</p>
                    </div>
                  </div>
                </div>

                {/* 세부 규정 및 구명동의 의무화 */}
                <div className="glass-panel" style={{ background: 'white' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', margin: 0 }}>
                    경기 규칙 & 안전 수칙
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem', lineHeight: '1.5', marginTop: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {overview.rulesNote.split('\n').map((line: string, idx: number) => (
                        <p key={idx} style={{ margin: 0, fontWeight: line.includes('필수') || line.includes('실격') || line.includes('자동 취소') || line.includes('조기 마감') ? '700' : 'normal', color: line.includes('필수') || line.includes('실격') || line.includes('자동 취소') || line.includes('조기 마감') ? '#EF4444' : 'inherit' }}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 문의처 */}
                <div className="glass-panel" style={{ background: 'white' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', margin: 0 }}>
                    문의 및 운영진
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', marginTop: '12px' }}>
                    <p style={{ margin: 0 }}><strong>인천광역시 핀수영협회 사무국 :</strong> 032-888-2940</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>* 대회 참가자 전원에게 기념 티셔츠 및 참가 기념품을 제공합니다.</p>
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>
      </div>
      </div>
    </div>
  );
}
