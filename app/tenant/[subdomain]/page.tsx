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

  // 동적 참가신청서 양식 및 제출 응답 상태
  const [formFields, setFormFields] = useState<any[]>([]);
  const [formResponses, setFormResponses] = useState<Record<string, any>>({
    gender: '남자',
    division: '윈드포일 (남자부)',
    tshirtSize: 'L (105)'
  });

  const [regSuccess, setRegSuccess] = useState('');
  const [regError, setRegError] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [uniqueClubs, setUniqueClubs] = useState<string[]>([]);

  // 동적 신청서 폼 설정 로드 및 입력 데이터 핸들러
  useEffect(() => {
    if (!subdomain) return;
    const fetchFormConfigs = async () => {
      try {
        const res = await fetch(`/api/tenant/${subdomain}/form-configs`);
        const data = await res.json();
        if (data.fields) {
          setFormFields(data.fields);
          
          // 기본 필드 설정
          const initialResponses: Record<string, any> = {};
          data.fields.forEach((f: any) => {
            if (f.type === 'radio') {
              initialResponses[f.id] = (f.options && f.options.length > 0) ? f.options[0] : '';
            } else if (f.type === 'checkbox' || f.type === 'textarea') {
              initialResponses[f.id] = '';
            } else {
              initialResponses[f.id] = '';
            }
          });
          
          // 필수 기본값 보완
          if (initialResponses.gender === undefined) initialResponses.gender = '남자';
          if (initialResponses.division === undefined) initialResponses.division = '윈드포일 (남자부)';
          if (initialResponses.tshirtSize === undefined) initialResponses.tshirtSize = 'L (105)';

          setFormResponses(initialResponses);
        }
      } catch (err) {
        console.error('신청서 폼 양식 로드 실패:', err);
      }
    };
    fetchFormConfigs();
  }, [subdomain]);

  const handleInputChange = (fieldId: string, value: any) => {
    setFormResponses(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

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

  // 동적 참가 신청서 제출 로직
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegSuccess('');
    setRegError('');

    // 필수 및 유효성 검사
    for (const field of formFields) {
      const val = formResponses[field.id];
      if (field.required && (!val || (typeof val === 'string' && !val.trim()))) {
        return setRegError(`'${field.label.replace(/^\d+\.\s*/, '')}' 항목은 필수입니다.`);
      }
    }

    if (formResponses.birth && !/^\d{8}$/.test(formResponses.birth)) {
      return setRegError('생년월일 8자리를 정확히 입력해 주세요. (예: 19950815)');
    }

    setRegSubmitting(true);

    try {
      const name = formResponses.name || '';
      const phone = formResponses.phone || '';

      const res = await fetch(`/api/tenant/${subdomain}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: activeTournamentId,
          name,
          email: `${name.toLowerCase()}@windsurfing.com`, // 간이 생성
          phone,
          formResponses,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '접수 실패');
      }

      setRegSuccess('참가 신청서가 성공적으로 제출되었습니다! 주최측에서 확인 후 문자로 입금계좌를 안내해 드립니다.');
      
      // 폼 초기화
      const resetResponses: Record<string, any> = {};
      formFields.forEach((f: any) => {
        if (f.type === 'radio') {
          resetResponses[f.id] = (f.options && f.options.length > 0) ? f.options[0] : '';
        } else {
          resetResponses[f.id] = '';
        }
      });
      // 필수 기본값 복구
      resetResponses.gender = '남자';
      resetResponses.division = '윈드포일 (남자부)';
      resetResponses.tshirtSize = 'L (105)';

      setFormResponses(resetResponses);
    } catch (err: any) {
      setRegError(err.message);
    } finally {
      setRegSubmitting(false);
    }
  };

  // 최초 로딩 중: 아무것도 표시하지 않아 깜빡임 방지
  if (loading && !tenant) {
    return null;
  }

  // 로딩 완료 후에도 tenant 없으면 오류 표시
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
      <div style={{ ...themeStyles, minHeight: '100vh', backgroundColor: '#ffffff', padding: 'clamp(16px, 4vw, 40px) clamp(8px, 3vw, 20px)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <title>제20회 이순신장군배 전국윈드서핑대회 참가신청서</title>
        <meta property="og:title" content="제20회 이순신장군배 전국윈드서핑대회 참가신청서" />
        <meta property="og:description" content="제20회 이순신장군배 전국윈드서핑대회 참가 신청서 접수 페이지" />
        <meta name="description" content="제20회 이순신장군배 전국윈드서핑대회 참가 신청서 접수 페이지" />
        <meta property="og:image" content="https://gentrophyos.vercel.app/images/logo_new.png" />
        {/* 상단 단독 폼 타이틀 및 브랜딩 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <img
            src="/images/logo_new.png"
            alt="대회 로고"
            style={{ height: '220px', width: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* 단독 폼 카드 */}
        <div style={{ width: '100%', maxWidth: '650px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', border: '1px solid var(--border-color)', padding: 'clamp(16px, 4vw, 32px) clamp(12px, 4vw, 32px)' }}>
          
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
                  ※ 단체전은 시,도 클럽별 릴레이식 참가선수 4명이 1개 팀으로 하는 경기방식 채택한다.
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
            {formFields.map((field) => {
              if (field.type === 'text') {
                return (
                  <div className="form-group" key={field.id}>
                    <label className="form-label">{field.label} {field.required && <span style={{ color: '#EF4444' }}>*</span>}</label>
                    <input
                      type={field.id === 'phone' ? 'tel' : 'text'}
                      className="form-input"
                      placeholder={field.placeholder || ''}
                      value={formResponses[field.id] || ''}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                      required={field.required}
                    />
                  </div>
                );
              }
              if (field.type === 'radio') {
                return (
                  <div className="form-group" key={field.id}>
                    <label className="form-label">{field.label} {field.required && <span style={{ color: '#EF4444' }}>*</span>}</label>
                    {field.id === 'division' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                        {(formResponses['gender'] === '여자'
                          ? ['윈드포일 (여자부)', '윙포일 (여자부)', '혼합오픈 (여자부)', '펀엔포뮬러 (여자부)']
                          : ['윈드포일 (남자부)', '윙포일 (남자부)', '혼합오픈 (남자부)', '펀엔포뮬러 (남자부)']
                        ).map((divOption) => (
                          <label key={divOption} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}>
                            <input
                              type="radio"
                              name="division_select_apply"
                              value={divOption}
                              checked={formResponses[field.id] === divOption}
                              onChange={(e) => handleInputChange(field.id, e.target.value)}
                              style={{ width: '18px', height: '18px' }}
                            />
                            <span>{divOption}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px' }}>
                        {(field.options || []).map((opt: string) => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}>
                            <input
                              type="radio"
                              name={`radio_${field.id}`}
                              value={opt}
                              checked={formResponses[field.id] === opt}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleInputChange(field.id, val);
                                if (field.id === 'gender') {
                                  if (val === '남자') {
                                    handleInputChange('division', '윈드포일 (남자부)');
                                  } else {
                                    handleInputChange('division', '윈드포일 (여자부)');
                                  }
                                }
                              }}
                              style={{ width: '18px', height: '18px' }}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              if (field.type === 'checkbox') {
                return (
                  <div className="form-group" key={field.id} style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', marginTop: '16px' }}>
                    <label className="form-label" style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                      {field.label} {field.required && <span style={{ color: '#EF4444' }}>*</span>}
                    </label>
                    {field.notice && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                        • {field.notice}
                      </p>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!formResponses[field.id]}
                        onChange={(e) => handleInputChange(field.id, e.target.checked ? (field.agreeLabel || '확인함') : '')}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontWeight: '600' }}>{field.agreeLabel || '네. 확인했습니다.'}</span>
                    </label>
                  </div>
                );
              }
              if (field.type === 'textarea') {
                return (
                  <div className="form-group" key={field.id} style={{ marginTop: '20px' }}>
                    <label className="form-label">
                      {field.label} {field.required && <span style={{ color: '#EF4444' }}>*</span>}
                    </label>
                    {field.textareaContent && (
                      <div style={{
                        height: '100px',
                        overflowY: 'scroll',
                        background: 'rgba(0,0,0,0.03)',
                        padding: '12px',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        lineHeight: '1.5',
                        marginBottom: '12px',
                        border: '1px solid var(--border-color)'
                      }}>
                        {field.textareaContent}
                      </div>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!formResponses[field.id]}
                        onChange={(e) => handleInputChange(field.id, e.target.checked ? (field.agreeLabel || '동의함') : '')}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontWeight: '600' }}>{field.agreeLabel || '네. 동의합니다.'}</span>
                    </label>
                  </div>
                );
              }
              return null;
            })}

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
      <title>제20회 이순신장군배 전국윈드서핑대회</title>
      <meta property="og:title" content="제20회 이순신장군배 전국윈드서핑대회" />
      <meta property="og:description" content="제20회 이순신장군배 전국윈드서핑대회 공식 홈페이지" />
      <meta name="description" content="제20회 이순신장군배 전국윈드서핑대회 공식 홈페이지" />
      <meta property="og:image" content="https://gentrophyos.vercel.app/images/logo_new.png" />
      
      {/* 1. 상단 화이트 브랜드 헤더 */}
      <header className="site-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="/images/logo_new.png"
            alt="제20회 이순신장군배 전국윈드서핑대회 로고"
            style={{ height: '70px', width: 'auto', objectFit: 'contain' }}
          />
          <div className="brand-text" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: '1.25', fontFamily: 'var(--font-title)' }}>
              제20회 이순신장군배
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--theme-primary)', lineHeight: '1.25', fontFamily: 'var(--font-title)' }}>
              전국윈드서핑대회
            </span>
          </div>
        </div>

        {/* 탭 네비게이션 메뉴 (PC 상단 GNB) */}
        <nav className="header-nav">
          {[
            {
              id: 'overview',
              label: '대회 요강',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              ),
              defaultSubTab: '',
              disabled: false
            },
            {
              id: 'intro',
              label: '대회소개',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M2 20h20M12 2v14M12 4l7 7h-7M5 16h14a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2z"></path>
                </svg>
              ),
              defaultSubTab: 'intro-greeting',
              disabled: false
            },
            {
              id: 'live',
              label: '경기운영',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              ),
              defaultSubTab: 'live-leaderboard',
              disabled: !ongoingTournament
            },
            {
              id: 'gallery',
              label: '미디어 & 갤러리',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              ),
              defaultSubTab: 'gallery-photos',
              disabled: false
            },
            {
              id: 'archive',
              label: '역대 기록관',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a7 7 0 0 1 7 7v4.66a5 5 0 0 1-5 4.67h-4a5 5 0 0 1-5-4.67V9a7 7 0 0 1 7-7z"></path>
                </svg>
              ),
              defaultSubTab: 'archive-home',
              disabled: false
            },
            {
              id: 'notice',
              label: '개최공시서',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
              ),
              defaultSubTab: '',
              disabled: false
            },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className="header-nav-btn"
                onClick={() => {
                  if (!tab.disabled) {
                    setActiveTab(tab.id as any);
                    setActiveSubTab(tab.defaultSubTab);
                  }
                }}
                disabled={tab.disabled}
                style={
                  tab.id === 'notice'
                    ? {
                        color: active ? '#ffffff' : 'var(--theme-primary)',
                        background: active ? 'linear-gradient(135deg, var(--theme-primary) 0%, #b39366 100%)' : 'rgba(197, 168, 128, 0.15)',
                        border: '1px dashed rgba(197, 168, 128, 0.6)',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        margin: '6px 4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        height: 'auto',
                        alignSelf: 'center',
                        boxShadow: active ? '0 4px 10px rgba(197, 168, 128, 0.3)' : 'none',
                        transition: 'all 0.2s ease',
                      }
                    : {
                        color: tab.disabled ? 'rgba(0,0,0,0.15)' : (active ? 'var(--theme-primary)' : 'var(--text-muted)'),
                        borderBottom: active ? '3px solid var(--theme-primary)' : '3px solid transparent',
                        cursor: tab.disabled ? 'not-allowed' : 'pointer',
                      }
                }
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="header-actions">
          <a href="/host" className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', background: '#f8fafc', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
            주최자 ERP
          </a>
          <a href="/referee" className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'var(--theme-primary)', color: 'white', boxShadow: 'none' }}>
            심판 입력기
          </a>
        </div>
      </header>

      {/* 2. 히어로 배너 */}
      <section className="hero-section animate-fade-in">
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

          <h1 className="hero-title" style={{
            fontFamily: 'var(--font-title)',
            fontWeight: '900',
            lineHeight: '1.1',
            marginBottom: '20px',
            color: 'white',
            textShadow: '0 4px 16px rgba(0,0,0,0.6)'
          }}>
            제20회 이순신장군배<br />
            <span style={{ color: 'var(--theme-gold)' }}>전국윈드서핑대회</span>
          </h1>
          
          <p className="hero-subtitle" style={{
            color: 'rgba(255, 255, 255, 0.7)',
            maxWidth: '650px',
            marginBottom: '24px',
            lineHeight: '1.6',
            textShadow: '0 2px 4px rgba(0,0,0,0.4)'
          }}>
            이순신 장군의 한산도 바다 위, 거북선 엠블럼과 함께 수륙해수욕장에서 화려하게 펼쳐지는 대한민국 윈드서핑 축제.
          </p>

          <div className="hero-buttons">
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

      {/* 3. 본문 콘텐츠 */}
      <div className="content-wrapper">
        <div className="content-inner">

          {/* 가로형 서브 탭 네비게이션 Pill Bar */}
          {activeTab !== 'overview' && activeTab !== 'notice' && (
            <div className="subtab-bar" style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '24px',
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

          {/* LIVE. 경기운영 / 실시간 리더보드 탭 */}
          {activeTab === 'live' && activeSubTab === 'live-leaderboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 리더보드 헤더 */}
              <div className="glass-panel" style={{ background: 'white', padding: '28px 32px', borderTop: '4px solid var(--theme-primary)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '900', textAlign: 'center', color: 'var(--text-main)', marginBottom: '4px' }}>
                  {overview.title} 실시간 리더보드
                </h2>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Notice of Race (NOR) / 공식 실시간 순위 및 라운드별 경기 결과</p>
              </div>

              {/* 종목 탭바 */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {['윈드포일', '윙포일', '혼합오픈', '펀엔포뮬러'].map((div) => {
                  const active = activeDivisionTab === div;
                  return (
                    <button
                      key={div}
                      onClick={() => setActiveDivisionTab(div)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '24px',
                        background: active ? 'var(--theme-primary)' : '#ffffff',
                        border: active ? 'none' : '1px solid var(--border-color)',
                        color: active ? '#ffffff' : 'var(--text-muted)',
                        fontSize: '0.85rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s ease-in-out',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}
                    >
                      {div}
                    </button>
                  );
                })}
              </div>

              {leaderboardLoading ? (
                <div className="glass-panel" style={{ background: 'white', padding: '60px 0', textAlign: 'center' }}>
                  <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--theme-primary)', margin: '0 auto 12px auto' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>리더보드 집계 정보를 불러오는 중입니다...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="glass-panel" style={{ background: 'white', padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '1rem', fontWeight: '700', margin: '0 0 4px 0' }}>등록된 순위표가 없습니다.</p>
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>심판이 공식 순위를 확정하면 여기에 실시간으로 표시됩니다.</p>
                </div>
              ) : (
                <div className="glass-panel" style={{ background: 'white', padding: '24px 30px' }}>
                  <div className="premium-table-container">
                    <table className="premium-table" style={{ fontSize: '0.9rem', width: '100%', borderCollapse: 'collapse', color: 'black' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ width: '70px', textAlign: 'center', fontWeight: '800' }}>순위</th>
                          <th style={{ minWidth: '90px', fontWeight: '800' }}>성명</th>
                          <th style={{ minWidth: '90px', fontWeight: '800' }}>배번티번호</th>
                          <th style={{ minWidth: '100px', fontWeight: '800' }}>생년월일</th>
                          {['1R', '2R', '3R', '4R', '5R', '6R'].map(r => (
                            <th key={r} style={{ width: '60px', textAlign: 'center', fontWeight: '800' }}>{r}</th>
                          ))}
                          <th style={{ width: '80px', textAlign: 'center', fontWeight: '800', color: 'var(--theme-primary)' }}>총점</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((row: any, rIdx: number) => {
                          const rounds = [row.r1, row.r2, row.r3, row.r4, row.r5, row.r6];
                          const validScores = rounds.filter(val => val !== null && val !== undefined && val !== '' && !isNaN(Number(val)));
                          
                          let discardIdx = -1;
                          if (validScores.length >= 4) {
                            let maxVal = -1;
                            for (let i = 0; i < rounds.length; i++) {
                              const val = rounds[i];
                              if (val !== null && val !== undefined && val !== '' && !isNaN(Number(val))) {
                                const num = Number(val);
                                if (num > maxVal) {
                                  maxVal = num;
                                  discardIdx = i;
                                }
                              }
                            }
                          }

                          return (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ textAlign: 'center', fontWeight: '800' }}>
                                <span style={{
                                  display: 'inline-block',
                                  width: '28px',
                                  height: '28px',
                                  lineHeight: '28px',
                                  borderRadius: '50%',
                                  background: row.rank === 1 ? 'var(--theme-gold)' : row.rank === 2 ? '#cbd5e1' : row.rank === 3 ? '#b45309' : '#f1f5f9',
                                  color: row.rank <= 3 ? 'white' : 'var(--text-main)',
                                  fontSize: '0.85rem'
                                }}>
                                  {row.rank}
                                </span>
                              </td>
                              <td style={{ fontWeight: '800' }}>{row.name}</td>
                              <td>{row.bibNumber || '-'}</td>
                              <td>{row.birth || '-'}</td>
                              {rounds.map((val, idx) => {
                                const isDiscarded = idx === discardIdx;
                                const displayVal = val !== null && val !== undefined && val !== '' ? val : '-';
                                return (
                                  <td key={idx} style={{
                                    textAlign: 'center',
                                    color: isDiscarded ? '#94a3b8' : 'inherit',
                                    textDecoration: isDiscarded ? 'line-through' : 'none',
                                    fontWeight: isDiscarded ? 'normal' : '600'
                                  }}>
                                    {displayVal}
                                    {isDiscarded && <span style={{ fontSize: '0.7rem', display: 'block', textDecoration: 'none', color: '#f43f5e', fontWeight: '800' }}>(제외)</span>}
                                  </td>
                                );
                              })}
                              <td style={{ textAlign: 'center', fontWeight: '900', color: 'var(--theme-primary)', fontSize: '1.05rem' }}>{row.total}점</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <p style={{ margin: '4px 0 0 0' }}>※ Sailing Low-Point 채점 기준: 각 라운드 순위가 점수가 되며(1위=1점, DNF 등은 감점 패널티 부여), 총점이 낮을수록 최종 순위가 높습니다.</p>
                    <p style={{ margin: '2px 0 0 0' }}>※ 경기 수 4회 이상(4R~) 진행 시, 참가자의 성적 중 가장 성적이 낮은 라운드(가장 높은 점수) 1개를 자동 제외하고 합산합니다.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NOR. 개최공시서 탭 - 파일 다운로드 전용 */}
          {activeTab === 'notice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '800px', margin: '0 auto', width: '100%' }} className="animate-fade-in">
              {/* 공시서 헤더 */}
              <div className="glass-panel" style={{ background: 'white', padding: '35px 32px', borderTop: '4px solid var(--theme-primary)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', background: 'rgba(197, 168, 128, 0.1)', border: '1px solid rgba(197, 168, 128, 0.3)', borderRadius: '50%', marginBottom: '10px' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>
                  {overview.title} 개최공시서
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, lineHeight: '1.6', maxWidth: '600px' }}>
                  대회 참가 및 운영에 관한 공식 개최공시서(Notice of Race) 파일 다운로드 페이지입니다.<br />
                  원하시는 파일 형식을 클릭하여 문서를 다운로드 받으실 수 있습니다.
                </p>
              </div>

              {/* 다운로드 버튼 2개 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                
                {/* 한글 파일 다운로드 카드 */}
                {overview.noticeHwpData ? (
                  <a
                    href={overview.noticeHwpData}
                    download={overview.noticeHwpName || `${overview.title || '대회개최공시서'}.hwp`}
                    style={{
                      background: 'white',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      padding: '30px 24px',
                      textDecoration: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '16px',
                      transition: 'all 0.25s ease',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                    }}
                    className="download-card-hwp"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0284c7';
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 20px rgba(2, 132, 199, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
                    }}
                  >
                    <div style={{ width: '64px', height: '64px', background: '#f0f9ff', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 6px 0' }}>한글 파일 (.HWP)</h3>
                      <p style={{ fontSize: '0.8rem', color: '#0284c7', fontWeight: '700', margin: 0 }}>
                        {overview.noticeHwpName || '개최공시서_한글파일.hwp'}
                      </p>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#0284c7', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: '800', marginTop: '10px', width: '100%', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      다운로드 받기
                    </span>
                  </a>
                ) : (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      padding: '30px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '16px',
                      opacity: 0.65
                    }}
                  >
                    <div style={{ width: '64px', height: '64px', background: '#e2e8f0', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#64748b', margin: '0 0 6px 0' }}>한글 파일 (.HWP)</h3>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>등록된 파일이 없습니다</p>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#cbd5e1', color: '#64748b', padding: '10px 20px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: '800', marginTop: '10px', width: '100%', justifyContent: 'center', cursor: 'not-allowed' }}>
                      준비 중
                    </span>
                  </div>
                )}

                {/* PDF 파일 다운로드 카드 */}
                {overview.noticePdfData ? (
                  <a
                    href={overview.noticePdfData}
                    download={overview.noticePdfName || `${overview.title || '대회개최공시서'}.pdf`}
                    style={{
                      background: 'white',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      padding: '30px 24px',
                      textDecoration: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '16px',
                      transition: 'all 0.25s ease',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                    }}
                    className="download-card-pdf"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#ef4444';
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 20px rgba(239, 68, 68, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
                    }}
                  >
                    <div style={{ width: '64px', height: '64px', background: '#fef2f2', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 6px 0' }}>PDF 파일 (.PDF)</h3>
                      <p style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: '700', margin: 0 }}>
                        {overview.noticePdfName || '개최공시서_PDF파일.pdf'}
                      </p>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ef4444', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: '800', marginTop: '10px', width: '100%', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      다운로드 받기
                    </span>
                  </a>
                ) : (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      padding: '30px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '16px',
                      opacity: 0.65
                    }}
                  >
                    <div style={{ width: '64px', height: '64px', background: '#e2e8f0', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#64748b', margin: '0 0 6px 0' }}>PDF 파일 (.PDF)</h3>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>등록된 파일이 없습니다</p>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#cbd5e1', color: '#64748b', padding: '10px 20px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: '800', marginTop: '10px', width: '100%', justifyContent: 'center', cursor: 'not-allowed' }}>
                      준비 중
                    </span>
                  </div>
                )}
                
              </div>

              {/* 하단 주의사항 */}
              <div className="glass-panel" style={{ background: 'white', padding: '24px 28px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                <p style={{ margin: '0 0 6px 0', fontWeight: '800', color: 'var(--text-main)' }}>💡 안내 사항</p>
                <p style={{ margin: 0 }}>• 개최공시서 문서를 열기 위해 한글 뷰어 또는 PDF 리더(Acrobat Reader 등)가 필요할 수 있습니다.</p>
                <p style={{ margin: 0 }}>• 파일이 정상적으로 다운로드되지 않거나 열리지 않을 경우, 주최측(인천광역시 핀수영협회 사무국)으로 문의주시기 바랍니다.</p>
              </div>
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
                    <Calendar style={{ color: 'var(--theme-primary)' }} size={22} /> 공식 대회 일정표 (2일간)
                  </h2>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
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
                        {(overview.divisionsList || [
                          { category: '일반부', class: '대학/일반', note: '-' },
                          { category: '청소년부', class: '고등부, 중등부, 초등부', note: '-' },
                          { category: '마스터즈', class: '마스터즈 1부, 마스터즈 2부, 마스터즈 3부', note: '※ 1부 (만 20~29세), 2부 (만 30~39세), 3부 (만 40세 이상)' },
                          { category: '엘리트', class: '등록선수 (학생/일반)', note: '-' },
                          { category: '단체전 (Relay)', class: '각 클럽/동호회팀별 릴레이', note: '남녀 혼성 계영 4x50m 및 4x100m로 진행함.' }
                        ]).map((row: any, i: number) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: '800', color: row.category?.includes('단체전') ? 'var(--theme-gold)' : 'var(--theme-primary)' }}>{row.category}</td>
                            <td>{row.class}</td>
                            <td>{row.note}</td>
                          </tr>
                        ))}
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
                        {(overview.awardsList || [
                          { type: '개인전', class: '전 클래스', standard: '1위: 상장 및 메달\n2위: 상장 및 메달\n3위: 상장 및 메달', note: '각 클래스별 참가자가 3명 미만일 경우 시상만 하고 메달 수여는 제외될 수 있습니다.' },
                          { type: '단체전', class: '각 클래스별 릴레이', standard: '1위: 상패 및 메달\n2위: 상패 및 메달\n3위: 상패 및 메달', note: '-' },
                          { type: '종합시상', class: '종합', standard: '종합 우승: 우승기 및 트로피\n종합 준우승: 트로피\n종합 3위: 트로피', note: '각 종목별 점수를 합산하여 산출함 (1위 9점, 2위 7점, 3위 6점, 4위 5점, 5위 4점, 6위 3점, 7위 2점, 8위 1점. 단체전은 배점 2배).' }
                        ]).map((row: any, i: number, arr: any[]) => (
                          <tr key={i}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: '800', color: row.type?.includes('종합') ? 'var(--theme-gold)' : 'inherit' }}>{row.type}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{row.class}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <strong>
                                {row.standard ? row.standard.split('\n').map((line: string, lIdx: number) => (
                                  <React.Fragment key={lIdx}>
                                    {line}
                                    {lIdx < row.standard.split('\n').length - 1 && <br />}
                                  </React.Fragment>
                                )) : '-'}
                              </strong>
                            </td>
                            {i === 0 && (
                              <td rowSpan={arr.length} style={{ verticalAlign: 'middle', background: '#f8fafc', fontSize: '0.85rem', color: 'var(--text-muted)', padding: '16px', minWidth: '220px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  {arr
                                    .map(r => r.note)
                                    .filter(note => note && note !== '-' && note.trim() !== '')
                                    .map((note, noteIdx) => (
                                      <p key={noteIdx} style={{ margin: 0, lineHeight: '1.6', color: 'black' }}>
                                        • {note}
                                      </p>
                                    ))}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* 오른쪽 사이드바 안내영역 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* 접수 안내 */}
                <div className="glass-panel" style={{ background: 'white' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', margin: 0 }}>
                    참가 접수
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.9rem', marginTop: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: '700' }}>접수 마감일</span>
                      <p style={{ fontWeight: '800', color: 'var(--text-main)', marginTop: '4px', fontSize: '1.05rem', margin: 0 }}>
                        {overview.deadlineDate}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: '#EF4444', marginTop: '2px', margin: 0 }}>* 130명 도달시 조기 마감될 수 있습니다.</p>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', marginTop: '12px', color: 'black' }}>
                    <p style={{ margin: 0 }}>
                      {overview.contactPhone ? (
                        overview.contactPhone.includes(':') ? (
                          <>
                            <strong>{overview.contactPhone.split(':')[0].trim()} :</strong> {overview.contactPhone.substring(overview.contactPhone.indexOf(':') + 1).trim()}
                          </>
                        ) : (
                          overview.contactPhone
                        )
                      ) : (
                        <>
                          <strong>인천광역시 핀수영협회 사무국 :</strong> 032-888-2940
                        </>
                      )}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                      {overview.contactNote || '* 대회 참가자 전원에게 기념 티셔츠 및 참가 기념품을 제공합니다.'}
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>
      </div>
      </div>

      {/* ── 모바일 전용 하단 탭바 ── */}
      <div className="mobile-tabbar">
        <div className="mobile-tabbar-inner">
          {[
            { id: 'overview', label: '대회요강', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, defaultSubTab: '' },
            { id: 'intro', label: '대회소개', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, defaultSubTab: 'intro-greeting' },
            { id: 'live', label: '경기운영', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, defaultSubTab: 'live-leaderboard', disabled: !ongoingTournament },
            { id: 'gallery', label: '미디어', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>, defaultSubTab: 'gallery-photos' },
            { id: 'archive', label: '역대기록', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a7 7 0 0 1 7 7v4.66a5 5 0 0 1-5 4.67h-4a5 5 0 0 1-5-4.67V9a7 7 0 0 1 7-7z"/></svg>, defaultSubTab: 'archive-home' },
            { id: 'notice', label: '공시서', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>, defaultSubTab: '' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`mobile-tabbar-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => {
                if (!tab.disabled) {
                  setActiveTab(tab.id as any);
                  setActiveSubTab(tab.defaultSubTab);
                }
              }}
              disabled={tab.disabled}
              style={
                tab.id === 'notice'
                  ? {
                      border: '1px dashed rgba(197, 168, 128, 0.4)',
                      borderRadius: '8px',
                      background: activeTab === 'notice' ? 'rgba(197, 168, 128, 0.15)' : 'transparent',
                      color: activeTab === 'notice' ? 'var(--theme-primary)' : 'var(--text-muted)'
                    }
                  : {}
              }
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
