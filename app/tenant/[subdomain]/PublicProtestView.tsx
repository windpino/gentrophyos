'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Scale,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  X,
  ShieldCheck,
  RefreshCw,
  Award,
  ArrowRight,
  Flame,
  Check,
  RotateCcw
} from 'lucide-react';

interface PublicProtestViewProps {
  subdomain: string;
  defaultDivision?: string;
  tenant?: any;
  leaderboards?: Record<string, any[]>;
  leaderboardRounds?: Record<string, any[]>;
  tournamentId?: string;
}

interface DivisionConfig {
  name: string;
  defaultCount: number;
  unit: string;
  defaultRounds: string;
  latestRound: string;
  classes: string;
  defaultLeader: string;
  color: string;
  bg: string;
  border: string;
  initialOffsetMinutes: number; // 데모/초기 시연용 성적 공개 후 경과 시간(분)
}

const DIVISION_CONFIGS: DivisionConfig[] = [
  {
    name: '혼합오픈',
    defaultCount: 64,
    unit: '명',
    defaultRounds: '3R 완료',
    latestRound: '3R',
    classes: '청년부(17) · 중년부(17) · 장년부(17) · 여자부(13)',
    defaultLeader: '1위 조병구 (6점) · 2위 김현수 (6점) · 3위 이명헌 (8점)',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    initialOffsetMinutes: 12, // 12분 전 공개 -> 48분 남음
  },
  {
    name: '펀&포뮬러',
    defaultCount: 38,
    unit: '명',
    defaultRounds: '1R 완료',
    latestRound: '1R',
    classes: '청년부(10) · 중년부(10) · 장년부(10) · 여자부(8)',
    defaultLeader: '1위 박두섭 (1점) · 2위 신지현 (2점) · 3위 이후상 (3점)',
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
    initialOffsetMinutes: 24, // 24분 전 공개 -> 36분 남음
  },
  {
    name: '윙포일',
    defaultCount: 17,
    unit: '명',
    defaultRounds: '1R 완료',
    latestRound: '1R',
    classes: '남자부(9) · 여자부(8)',
    defaultLeader: '1위 김선근 (1점) · 2위 옥덕필 (2점) · 3위 유재원 (3점)',
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
    initialOffsetMinutes: 35, // 35분 전 공개 -> 25분 남음
  },
  {
    name: '윈드포일',
    defaultCount: 11,
    unit: '명',
    defaultRounds: '1R 완료',
    latestRound: '1R',
    classes: '남녀 통합 오픈부(11)',
    defaultLeader: '1위 강민호 (1점) · 2위 현인성 (2점) · 3위 김재창 (3점)',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    initialOffsetMinutes: 44, // 44분 전 공개 -> 16분 남음
  },
  {
    name: '단체전',
    defaultCount: 6,
    unit: '개팀',
    defaultRounds: '1R 완료',
    latestRound: '1R',
    classes: '시·도 및 클럽대항전(6)',
    defaultLeader: '1위 통영윈드서핑협회 · 2위 거제한화오션윈드서핑클럽 · 3위 가천대',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    initialOffsetMinutes: 51, // 51분 전 공개 -> 9분 남음
  },
];

export default function PublicProtestView({
  subdomain,
  defaultDivision = '혼합오픈',
  tenant,
  leaderboards = {},
  leaderboardRounds = {},
  tournamentId = '3d3e2f2a-7329-420e-974c-cb3aa4be3b26',
}: PublicProtestViewProps) {
  const formRef = useRef<HTMLDivElement>(null);

  // 실시간 시계 (1초마다 갱신)
  const [nowTime, setNowTime] = useState<number>(Date.now());
  const [fetchedLeaderboards, setFetchedLeaderboards] = useState<Record<string, any>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 종목별 성적 공개 시작 타임스탬프 (ms)
  const [divisionStartTimes, setDivisionStartTimes] = useState<Record<string, number>>({});

  // 폼 입력 상태
  const [applicantName, setApplicantName] = useState('');
  const [bibNumber, setBibNumber] = useState('');
  const [division, setDivision] = useState(defaultDivision);
  const [subclass, setSubclass] = useState('청년부');
  const [club, setClub] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [protestType, setProtestType] = useState<'SCORING' | 'RULE' | 'EQUIPMENT' | 'OTHER'>('SCORING');
  const [targetRound, setTargetRound] = useState('1R');
  const [respondent, setRespondent] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [content, setContent] = useState('');

  // 접수 완료 영수증 모달 상태
  const [receiptData, setReceiptData] = useState<{
    receiptNumber: string;
    applicantName: string;
    bibNumber: string;
    division: string;
    subclass: string;
    targetRound: string;
    protestType: string;
    submittedAt: string;
  } | null>(null);

  // 1초마다 시계 갱신
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 서버 전체 리더보드 데이터 보조 로드
  const fetchAllLeaderboards = async () => {
    try {
      const res = await fetch(`/api/tenant/${subdomain}/leaderboard?tournamentId=${tournamentId}&all=true&_t=${Date.now()}`);
      const data = await res.json();
      if (data.leaderboards) {
        setFetchedLeaderboards(data.leaderboards);
      }
    } catch (e) {
      console.error('리더보드 조회 오류:', e);
    }
  };

  useEffect(() => {
    fetchAllLeaderboards();
  }, [subdomain, tournamentId]);

  // 종목별 60분 카운트다운 시작 시각 초기화
  useEffect(() => {
    const initialTimes: Record<string, number> = {};
    const baseNow = Date.now();

    DIVISION_CONFIGS.forEach((cfg) => {
      const key = `gentrophy_protest_start_${subdomain}_${cfg.name}`;
      const saved = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
      if (saved) {
        initialTimes[cfg.name] = parseInt(saved, 10);
      } else {
        // 기본 경과 시간(분) 적용하여 실감 나는 라이브 카운트다운 초기화
        const startTime = baseNow - cfg.initialOffsetMinutes * 60 * 1000;
        initialTimes[cfg.name] = startTime;
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, String(startTime));
        }
      }
    });

    setDivisionStartTimes(initialTimes);
  }, [subdomain]);

  // 특정 종목의 60분 타이머 재시작 (테스트 및 심판 연장용)
  const handleResetTimer = (divName: string) => {
    const newStart = Date.now();
    setDivisionStartTimes((prev) => ({
      ...prev,
      [divName]: newStart,
    }));
    if (typeof window !== 'undefined') {
      localStorage.setItem(`gentrophy_protest_start_${subdomain}_${divName}`, String(newStart));
    }
  };

  // 종목별 참여 리스트 조회
  const getDivisionList = (cardName: string): any[] => {
    if (leaderboards && leaderboards[cardName] && leaderboards[cardName].length > 0) {
      return leaderboards[cardName];
    }
    if (fetchedLeaderboards && fetchedLeaderboards[cardName]?.list) {
      return fetchedLeaderboards[cardName].list;
    }
    if (cardName.includes('펀')) {
      const alt = cardName.includes('&')
        ? cardName.replace('펀&포뮬러', '펀엔포뮬러')
        : cardName.replace('펀엔포뮬러', '펀&포뮬러');
      if (leaderboards && leaderboards[alt]) return leaderboards[alt];
      if (fetchedLeaderboards && fetchedLeaderboards[alt]?.list) return fetchedLeaderboards[alt].list;
    }
    return [];
  };

  // 종목별 완료 라운드 및 최신 라운드 판별
  const getRoundInfo = (divName: string, list: any[], defaultRounds: string, defaultLatest: string) => {
    if (!list || list.length === 0) {
      return { rounds: defaultRounds, latestRound: defaultLatest, count: divName === '혼합오픈' ? 3 : 1 };
    }
    const conductedKeys = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'].filter((rKey) =>
      list.some((p) => p[rKey] !== null && p[rKey] !== undefined && p[rKey] !== '')
    );
    const count = conductedKeys.length;
    if (count === 0) {
      return { rounds: defaultRounds, latestRound: defaultLatest, count: 1 };
    }
    const lastKey = conductedKeys[conductedKeys.length - 1];
    const roundNum = lastKey.replace('r', '');
    return {
      rounds: `${count}R 완료`,
      latestRound: `${roundNum}R`,
      count,
    };
  };

  // 종목별 실시간 포디움 1~3위 산출
  const getLeaderPodium = (divName: string, list: any[], defaultLeader: string) => {
    if (!list || list.length === 0) return defaultLeader;

    const scoredPlayers = list.filter((p) => {
      const hasRoundScore = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'].some(
        (rk) => p[rk] !== null && p[rk] !== undefined && p[rk] !== ''
      );
      return hasRoundScore || (p.rank && p.rank !== '-');
    });

    if (scoredPlayers.length === 0) return defaultLeader;

    const sorted = [...scoredPlayers].sort((a, b) => {
      const rA = parseInt(String(a.rank || '').replace(/[^0-9]/g, ''), 10);
      const rB = parseInt(String(b.rank || '').replace(/[^0-9]/g, ''), 10);
      if (!isNaN(rA) && !isNaN(rB)) return rA - rB;
      if (!isNaN(rA)) return -1;
      if (!isNaN(rB)) return 1;
      const tA = Number(a.total) || 999;
      const tB = Number(b.total) || 999;
      return tA - tB;
    });

    const top3 = sorted.slice(0, 3);
    if (top3.length === 0) return defaultLeader;

    if (divName === '단체전') {
      return top3
        .map((p, idx) => `${idx + 1}위 ${p.teamName || p.name || `팀 ${idx + 1}`}`)
        .join(' · ');
    }

    return top3
      .map((p, idx) => `${idx + 1}위 ${p.name} (${p.total ?? 0}점)`)
      .join(' · ');
  };

  // 5대 종목별 실시간 현황 및 개별 60분 카운트다운 산출
  const divisionCards = useMemo(() => {
    return DIVISION_CONFIGS.map((cfg) => {
      const list = getDivisionList(cfg.name);
      const roundInfo = getRoundInfo(cfg.name, list, cfg.defaultRounds, cfg.latestRound);
      const leader = getLeaderPodium(cfg.name, list, cfg.defaultLeader);
      const count = cfg.name === '단체전' ? (list.length || 6) : (list.length || cfg.defaultCount);

      const startTime = divisionStartTimes[cfg.name] || (nowTime - cfg.initialOffsetMinutes * 60 * 1000);
      const expiryTime = startTime + 60 * 60 * 1000;
      const remainingSec = Math.max(0, Math.floor((expiryTime - nowTime) / 1000));
      const isExpired = remainingSec <= 0;
      const percent = Math.max(0, Math.min(100, (remainingSec / 3600) * 100));

      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      const formattedClock = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      const startDate = new Date(startTime);
      const expiryDate = new Date(expiryTime);

      return {
        ...cfg,
        count,
        rounds: roundInfo.rounds,
        latestRound: roundInfo.latestRound,
        leader,
        startTime,
        expiryTime,
        startDate,
        expiryDate,
        remainingSec,
        isExpired,
        percent,
        formattedClock,
        mins,
        secs,
      };
    });
  }, [leaderboards, fetchedLeaderboards, divisionStartTimes, nowTime]);

  // 특정 종목의 [이의제기 접수하기] 버튼 클릭 시 해당 종목 및 라운드 사전 선택 후 폼 오픈
  const handleOpenFormForDivision = (divCard: typeof divisionCards[0]) => {
    if (divCard.isExpired) {
      alert(`[접수 마감] ${divCard.name} 종목은 월드세일링 RRS 61.3 규정(60분)에 따른 항의 마감 시한이 종료되었습니다.`);
      return;
    }
    setDivision(divCard.name);
    setTargetRound(divCard.latestRound);
    setIsFormOpen(true);

    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // 현재 폼에서 선택된 종목의 카운트다운 상태
  const currentSelectedDivisionCard = useMemo(() => {
    return divisionCards.find((c) => c.name === division) || divisionCards[0];
  }, [divisionCards, division]);

  // 날짜/시각 포맷터
  const formatTimeOnly = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '-';
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  // 신규 이의제기 접수 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !bibNumber.trim() || !content.trim()) {
      alert('신청 선수 성명, 배번, 상세 사유는 필수 입력 사항입니다.');
      return;
    }

    if (currentSelectedDivisionCard.isExpired) {
      alert(`[접수 불가] 선택하신 ${division} 종목은 60분 항의 마감 시한이 종료되어 추가 접수가 불가합니다.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/protests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantName,
          bibNumber,
          division,
          subclass,
          club,
          phone,
          password,
          isSecret: true,
          protestType,
          targetRound,
          respondent,
          incidentTime,
          content,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        const receiptNo = result.receiptNumber || `PR-2026-${Date.now().toString().slice(-4)}`;
        setReceiptData({
          receiptNumber: receiptNo,
          applicantName,
          bibNumber,
          division,
          subclass,
          targetRound,
          protestType,
          submittedAt: new Date().toLocaleString('ko-KR'),
        });
        setIsFormOpen(false);
        // 폼 초기화
        setContent('');
        setPassword('');
        setRespondent('');
        setIncidentTime('');
      } else {
        alert(`접수 실패: ${result.error || '오류가 발생했습니다.'}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`제출 중 오류: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getProtestTypeLabel = (type: string) => {
    switch (type) {
      case 'SCORING':
        return '득점/기록 오기 정정 (Scoring Inquiry)';
      case 'RULE':
        return '경기 규칙(RRS) 위반 항의 (Protest)';
      case 'EQUIPMENT':
        return '장비/계측 자격 이의 (Measurement)';
      default:
        return '대회 운영 기타 문의';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>

      {/* ── [1] 상단 헤더 배너 ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '18px',
          padding: '24px 26px',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '3px 10px', borderRadius: '16px', fontSize: '0.76rem', color: '#fbbf24', fontWeight: '800', marginBottom: '6px' }}>
              <Scale size={13} /> 대회 심판위원회 (Jury / Protest Committee) 직통
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>
              ⚖️ 종목별 실시간 항의 시한 및 이의제기 접수 (Protest Time Limit)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: '4px 0 0 0', lineHeight: '1.5' }}>
              월드 세일링 경기 규칙(World Sailing RRS 61.3)에 의거하여, <strong>각 종목별 잠정 성적표 개시(게시) 시점으로부터 60분간</strong> 공식 이의제기 버튼이 활성화되며 심판진에게 비공개로 직통 접수됩니다.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                fetchAllLeaderboards();
                // 5개 종목 전체 60분 시한 동시 동기화
                const baseNow = Date.now();
                DIVISION_CONFIGS.forEach((c) => {
                  const key = `gentrophy_protest_start_${subdomain}_${c.name}`;
                  localStorage.removeItem(key);
                });
                window.location.reload();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 14px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} />
              전체 시한 동기화
            </button>
          </div>
        </div>

        {/* 안내 바 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem', color: '#cbd5e1' }}>
          <div>
            <span>⏱️ 항의 접수 시한 원칙: </span>
            <strong style={{ color: '#fbbf24' }}>종목별 경기 완주 및 성적 개시 후 60분 이내 (RRS 61.3)</strong>
          </div>
          <div>
            <span>🔒 비공개 처리 원칙: </span>
            <strong style={{ color: '#38bdf8' }}>접수 내역은 다른 선수에게 비공개되며 심판위원회에만 즉시 전달</strong>
          </div>
        </div>
      </div>

      {/* ── [2] 핵심: 현재 완주/완료된 5대 종목별 실시간 카운트다운 현황판 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h4 style={{ fontSize: '1.12rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>
              ⛵ 현재 완주 및 완료된 종목별 항의 유효 시간 (개시 후 60분 카운트다운)
            </h4>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              각 종목 카드의 [이의제기 접수하기] 버튼을 누르면 해당 종목과 완료 라운드가 자동 선택되어 즉시 접수할 수 있습니다.
            </p>
          </div>
          <span style={{ fontSize: '0.76rem', fontWeight: '800', color: '#059669', background: '#dcfce7', padding: '4px 10px', borderRadius: '6px' }}>
            심판진 실시간 전송 대기 중
          </span>
        </div>

        {/* 5대 종목 반응형 카드 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '14px' }}>
          {divisionCards.map((div) => {
            const isUrgent = !div.isExpired && div.mins < 15;
            const isCritical = !div.isExpired && div.mins < 5;

            return (
              <div
                key={div.name}
                style={{
                  background: div.bg,
                  border: `2px solid ${div.border}`,
                  borderRadius: '16px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  position: 'relative',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* 카드 상단: 종목명, 인원, 완주 라운드 뱃지 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ fontSize: '1.15rem', fontWeight: '900', margin: 0, color: '#0f172a' }}>
                        {div.name}
                      </h4>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: div.color, background: 'rgba(255,255,255,0.85)', padding: '2px 8px', borderRadius: '12px' }}>
                        {div.count}{div.unit}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                      {div.classes}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.76rem', fontWeight: '900', padding: '3px 10px', borderRadius: '6px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                    {div.rounds}
                  </span>
                </div>

                {/* 현재 1~3위 선두 주자 */}
                <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)', fontSize: '0.8rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>
                    공식 포디움 선두 (1~3위)
                  </span>
                  <strong style={{ color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {div.leader}
                  </strong>
                </div>

                {/* 핵심: 개별 종목 60분 카운트다운 타이머 박스 */}
                <div
                  style={{
                    background: div.isExpired ? '#f8fafc' : '#ffffff',
                    border: `1.5px solid ${div.isExpired ? '#e2e8f0' : isCritical ? '#fca5a5' : isUrgent ? '#fed7aa' : '#cbd5e1'}`,
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {!div.isExpired ? (
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isCritical ? '#ef4444' : isUrgent ? '#f59e0b' : '#22c55e', display: 'inline-block', boxShadow: `0 0 6px ${isCritical ? '#ef4444' : '#22c55e'}` }} />
                      ) : (
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
                      )}
                      <span style={{ fontSize: '0.78rem', fontWeight: '800', color: div.isExpired ? '#64748b' : isCritical ? '#b91c1c' : isUrgent ? '#c2410c' : '#15803d' }}>
                        {!div.isExpired ? (isCritical ? '⚠️ 마감 임박 (5분 미만)' : isUrgent ? '마감 임박 (15분 미만)' : '항의 접수 유효 시간') : '공식 접수 마감됨'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: '900', fontFamily: 'monospace', color: div.isExpired ? '#94a3b8' : isCritical ? '#dc2626' : isUrgent ? '#d97706' : '#0f172a', letterSpacing: '0.5px' }}>
                        {div.formattedClock}
                      </span>
                      <button
                        type="button"
                        title="60분 시한 재시작 (테스트용)"
                        onClick={() => handleResetTimer(div.name)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          marginLeft: '2px',
                        }}
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>
                  </div>

                  {/* 60분 게이지 바 */}
                  <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${div.percent}%`,
                        background: div.isExpired
                          ? '#cbd5e1'
                          : isCritical
                          ? '#ef4444'
                          : isUrgent
                          ? '#f59e0b'
                          : div.color,
                        transition: 'width 1s linear',
                      }}
                    />
                  </div>

                  {/* 개시 시각 및 마감 시각 표기 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                    <span>개시: <strong>{formatTimeOnly(div.startDate)}</strong></span>
                    <span>마감: <strong style={{ color: div.isExpired ? '#94a3b8' : '#2563eb' }}>{formatTimeOnly(div.expiryDate)}</strong></span>
                  </div>
                </div>

                {/* 핵심 상호연결: 시간 내에는 활성화 / 시간 초과 시 비활성화되는 이의제기 접수 버튼 */}
                {!div.isExpired ? (
                  <button
                    type="button"
                    onClick={() => handleOpenFormForDivision(div)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '100%',
                      padding: '10px 14px',
                      background: div.color,
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '800',
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      boxShadow: `0 3px 10px ${div.color}40`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>✍️ {div.name} 이의제기 접수 ({div.formattedClock} 남음)</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '100%',
                      padding: '10px 14px',
                      background: '#e2e8f0',
                      color: '#94a3b8',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '800',
                      fontSize: '0.84rem',
                      cursor: 'not-allowed',
                    }}
                  >
                    <Clock size={14} />
                    <span>🚫 {div.name} 항의 시한 마감 (60분 경과)</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── [3] 접수 완료 확인 영수증 카드 ── */}
      {receiptData && (
        <div
          style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
            border: '2px solid #059669',
            borderRadius: '16px',
            padding: '24px 26px',
            boxShadow: '0 8px 24px rgba(5, 150, 105, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#047857' }}>
              <CheckCircle2 size={24} />
              <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '900' }}>
                공식 이의제기가 심판위원회에 안전하게 접수되었습니다!
              </h4>
            </div>
            <button
              onClick={() => setReceiptData(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#065f46' }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #a7f3d0', padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.84rem' }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem' }}>접수 번호</span>
              <strong style={{ color: '#047857', fontSize: '1rem' }}>{receiptData.receiptNumber}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem' }}>신청 선수</span>
              <strong>{receiptData.applicantName} (배번 {receiptData.bibNumber})</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem' }}>종목 / 부문</span>
              <strong>{receiptData.division} ({receiptData.subclass})</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem' }}>대상 라운드 / 유형</span>
              <strong>{receiptData.targetRound} · {getProtestTypeLabel(receiptData.protestType)}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem' }}>접수 일시</span>
              <span style={{ color: '#334155' }}>{receiptData.submittedAt}</span>
            </div>
          </div>

          <div style={{ background: '#d1fae5', padding: '12px 14px', borderRadius: '8px', fontSize: '0.82rem', color: '#065f46', lineHeight: '1.5' }}>
            <strong>🔒 심판진 직통 비공개 전달 안내:</strong>
            <br />
            제출하신 이의제기 내역은 다른 선수에게 공개되지 않으며, 공정한 심의를 위해 <strong>오직 심판위원회(Jury)에만 비공개로 즉시 전달</strong>되었습니다. 심판진이 계측 기록지 및 비디오를 대조한 후 순위표에 공식 반영 조치합니다.
          </div>

          <button
            type="button"
            onClick={() => setReceiptData(null)}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: '#059669',
              color: 'white',
              fontWeight: '800',
              fontSize: '0.86rem',
              cursor: 'pointer',
              alignSelf: 'flex-end',
            }}
          >
            확인 완료
          </button>
        </div>
      )}

      {/* ── [4] 신규 이의제기 접수 폼 (선택된 종목과 완벽히 상호 연결됨) ── */}
      {isFormOpen && (
        <div ref={formRef} id="protest-form-section">
          <form
            onSubmit={handleSubmit}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '2px solid #f59e0b',
              padding: '24px 26px',
              boxShadow: '0 8px 24px rgba(245, 158, 11, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* 폼 상단: 선택된 종목 및 남은 시한 안내 바 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #fed7aa', paddingBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#9a3412' }}>
                    ✍️ [{division}] 공식 이의제기 및 득점 확인서 접수
                  </h4>
                  {!currentSelectedDivisionCard.isExpired ? (
                    <span style={{ fontSize: '0.78rem', fontWeight: '900', padding: '2px 8px', borderRadius: '12px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                      ⏱️ 항의 시한: {currentSelectedDivisionCard.formattedClock} 남음
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', fontWeight: '900', padding: '2px 8px', borderRadius: '12px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
                      🚫 항의 시한 마감됨 (접수 불가)
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.78rem', color: '#c2410c', display: 'block', marginTop: '2px' }}>
                  * 본 접수 내역은 다른 선수에게 일체 공개되지 않으며 심판위원회에만 즉시 비공개 직통 전달됩니다.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9a3412' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* 마감 경고 배너 (선택 종목이 마감되었을 경우) */}
            {currentSelectedDivisionCard.isExpired && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', color: '#991b1b', fontSize: '0.84rem' }}>
                <strong>⚠️ {division} 종목은 60분 항의 마감 시한이 종료되었습니다.</strong>
                <div style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                  월드세일링 RRS 61.3 규정에 따라 추가 이의제기 접수가 마감되었으므로 상단에서 진행 중인 다른 종목을 선택해 주세요.
                </div>
              </div>
            )}

            {/* 1행: 종목, 세부 클라스, 대상 라운드 선택 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: '#fffbeb', padding: '14px', borderRadius: '12px', border: '1px solid #fde68a' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#92400e', marginBottom: '4px' }}>
                  출전 종목 선택 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={division}
                  onChange={(e) => {
                    const nextDiv = e.target.value;
                    setDivision(nextDiv);
                    const found = divisionCards.find((c) => c.name === nextDiv);
                    if (found) {
                      setTargetRound(found.latestRound);
                    }
                  }}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #f59e0b', borderRadius: '8px', fontSize: '0.88rem', background: 'white', fontWeight: '800' }}
                >
                  {divisionCards.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.rounds} - {c.isExpired ? '마감됨' : `${c.formattedClock} 남음`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#92400e', marginBottom: '4px' }}>
                  대상 라운드 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={targetRound}
                  onChange={(e) => setTargetRound(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', background: 'white' }}
                >
                  <option value="1R">제1라운드 (1R)</option>
                  <option value="2R">제2라운드 (2R)</option>
                  <option value="3R">제3라운드 (3R)</option>
                  <option value="4R">제4라운드 (4R)</option>
                  <option value="5R">제5라운드 (5R)</option>
                  <option value="종합">대회 전체 종합 순위</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#92400e', marginBottom: '4px' }}>
                  세부 부문 (클라스)
                </label>
                <select
                  value={subclass}
                  onChange={(e) => setSubclass(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', background: 'white' }}
                >
                  <option value="청년부">청년부</option>
                  <option value="중년부">중년부</option>
                  <option value="장년부">장년부</option>
                  <option value="여자부">여자부</option>
                  <option value="통합부">통합부 / 오픈</option>
                  <option value="단체전">단체전</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#92400e', marginBottom: '4px' }}>
                  이의 유형 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={protestType}
                  onChange={(e) => setProtestType(e.target.value as any)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', background: 'white' }}
                >
                  <option value="SCORING">득점/기록 오기 정정 (Scoring Inquiry)</option>
                  <option value="RULE">경기 규칙(RRS) 위반 항의 (Protest)</option>
                  <option value="EQUIPMENT">장비/계측 자격 이의 (Measurement)</option>
                  <option value="OTHER">대회 운영 기타 문의</option>
                </select>
              </div>
            </div>

            {/* 2행: 선수 인적사항 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                  신청 선수 성명 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 홍길동"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                  배번 (Bib Number) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 24"
                  value={bibNumber}
                  onChange={(e) => setBibNumber(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                  소속 클럽 / 팀
                </label>
                <input
                  type="text"
                  placeholder="예: 통영윈드서핑협회"
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                  비상 연락처 (심판진 확인용)
                </label>
                <input
                  type="tel"
                  placeholder="010-0000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
                />
              </div>
            </div>

            {/* 3행: 상대 배번, 발생 시각, 비밀번호 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                  상대 선수 배번 (규칙 항의 시)
                </label>
                <input
                  type="text"
                  placeholder="상대 배번 (선택)"
                  value={respondent}
                  onChange={(e) => setRespondent(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                  사건 발생 시각 / 수역
                </label>
                <input
                  type="text"
                  placeholder="예: 14시 20분경 제1마크 앞"
                  value={incidentTime}
                  onChange={(e) => setIncidentTime(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                  본인 확인 비밀번호 (4자리)
                </label>
                <input
                  type="password"
                  maxLength={8}
                  placeholder="숫자 4자리"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
                />
              </div>
            </div>

            {/* 4행: 구체적인 정황 서술 */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                구체적인 사유 및 정황 진술 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                rows={4}
                required
                placeholder="예: 해당 라운드 결승선 통과 시 8위로 정상 완주하였으나 순위표에 DNS로 표기되어 있습니다. 당시 앞선 7위(연두 16번) 바로 뒤에 통과하였으므로 계측 기록지 및 비디오 확인 후 정정 부탁드립니다."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', lineHeight: '1.5' }}
              />
            </div>

            {/* 폼 하단 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                style={{ padding: '10px 18px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#475569', fontWeight: '700', cursor: 'pointer' }}
              >
                취소
              </button>

              <button
                type="submit"
                disabled={submitting || currentSelectedDivisionCard.isExpired}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 24px',
                  background: currentSelectedDivisionCard.isExpired
                    ? '#cbd5e1'
                    : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  cursor: submitting || currentSelectedDivisionCard.isExpired ? 'not-allowed' : 'pointer',
                  boxShadow: currentSelectedDivisionCard.isExpired ? 'none' : '0 2px 10px rgba(245, 158, 11, 0.4)',
                }}
              >
                <Send size={15} />
                <span>
                  {submitting
                    ? '심판진 전송 중...'
                    : currentSelectedDivisionCard.isExpired
                    ? `[접수 마감] ${division} 시한 종료`
                    : `[${division}] 심판진 직통 비공개 접수`}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── [5] 공식 규정 및 접수 안내 가이드 카드 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ background: '#eff6ff', color: '#2563eb', padding: '6px', borderRadius: '8px' }}>
              <Clock size={16} />
            </div>
            <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>종목별 60분 개별 마감 원칙</strong>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: '1.5' }}>
            월드세일링 경기규칙(World Sailing RRS 61.3)에 의거하여 각 종목/레이스의 잠정 성적표 개시 시점으로부터 <strong>정확히 60분 이내</strong>에 접수된 건에 한하여 심판위원회의 공식 심의가 진행됩니다.
          </p>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ background: '#ecfdf5', color: '#059669', padding: '6px', borderRadius: '8px' }}>
              <ShieldCheck size={16} />
            </div>
            <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>심판진 100% 비공개 직통 접수</strong>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: '1.5' }}>
            선수 간 불필요한 마찰을 방지하고 공정한 판정을 보장하기 위해, 제출된 이의제기 내역은 <strong>외부에 일체 공개되지 않으며 오직 심판위원회(Jury)에만 안전하게 전달</strong>됩니다.
          </p>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ background: '#fff7ed', color: '#ea580c', padding: '6px', borderRadius: '8px' }}>
              <Award size={16} />
            </div>
            <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>신속한 기록지 대조 및 정정</strong>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: '1.5' }}>
            완주 등수 누락, DNS/DNF 착오 표기, 스타트/마크 라운딩 규칙 위반 사항에 대해 계측 기록지 및 비디오를 즉각 대조 심의하여 공식 순위표에 반영 조치합니다.
          </p>
        </div>
      </div>

    </div>
  );
}
