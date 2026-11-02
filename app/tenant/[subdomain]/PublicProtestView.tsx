'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  X,
  ShieldCheck,
  ShieldAlert,
  Lock,
  FileText,
  RefreshCw,
  Award
} from 'lucide-react';

interface PublicProtestViewProps {
  subdomain: string;
  defaultDivision?: string;
  tenant?: any;
}

export default function PublicProtestView({ subdomain, defaultDivision = '혼합오픈', tenant }: PublicProtestViewProps) {
  // ── [1] 항의 마감 시한(점수 공개 후 1시간) 타이머 상태 ──
  const [timeLimitInfo, setTimeLimitInfo] = useState<{
    isPublished: boolean;
    publishedAt: string | null;
    timeLimitMinutes: number;
  }>({
    isPublished: true,
    publishedAt: null,
    timeLimitMinutes: 60,
  });

  const [loadingTime, setLoadingTime] = useState(true);
  const [nowTime, setNowTime] = useState<number>(Date.now());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  // 1초마다 실시간 시계 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 서버에서 항의 시한 및 점수 공개 시점 확인
  const fetchTimeLimit = async () => {
    setLoadingTime(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/protests?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.timeLimit) {
        setTimeLimitInfo(data.timeLimit);
      }
    } catch (e) {
      console.error('항의 시한 조회 실패:', e);
    } finally {
      setLoadingTime(false);
    }
  };

  useEffect(() => {
    fetchTimeLimit();
  }, [subdomain]);

  // 점수 공개 시점 및 60분 카운트다운 실시간 계산
  const { publishedDate, expiryDate, remainingSeconds, isPublished, isExpired, percentRemaining } = useMemo(() => {
    const pubIso =
      timeLimitInfo.publishedAt ||
      tenant?.overviewConfig?.leaderboardPublishedAt ||
      tenant?.overviewConfig?.bracketsPublishedAt;

    const isPub =
      timeLimitInfo.isPublished ||
      Boolean(tenant?.overviewConfig?.leaderboardPublished || tenant?.overviewConfig?.bracketsPublished);

    if (!isPub) {
      return {
        publishedDate: null,
        expiryDate: null,
        remainingSeconds: 0,
        isPublished: false,
        isExpired: false,
        percentRemaining: 100,
      };
    }

    // 공개 일시 파싱 (만약 공개 일시가 아직 기록되지 않았다면 현재 세션 기준 60분 보장)
    let pTime: number;
    if (pubIso) {
      pTime = new Date(pubIso).getTime();
    } else {
      const cached = typeof window !== 'undefined' ? localStorage.getItem(`gentrophy_protest_start_${subdomain}`) : null;
      if (cached) {
        pTime = parseInt(cached, 10);
      } else {
        pTime = Date.now();
        if (typeof window !== 'undefined') {
          localStorage.setItem(`gentrophy_protest_start_${subdomain}`, String(pTime));
        }
      }
    }

    const expTime = pTime + 60 * 60 * 1000; // 60분 (1시간) 후 마감
    const diffSec = Math.max(0, Math.floor((expTime - nowTime) / 1000));
    const expired = diffSec <= 0;
    const pct = Math.max(0, Math.min(100, (diffSec / 3600) * 100));

    return {
      publishedDate: new Date(pTime),
      expiryDate: new Date(expTime),
      remainingSeconds: diffSec,
      isPublished: true,
      isExpired: expired,
      percentRemaining: pct,
    };
  }, [timeLimitInfo, tenant, nowTime, subdomain]);

  // 시:분:초 포맷팅
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  // 날짜 포맷팅 함수
  const formatDateTime = (date: Date | null) => {
    if (!date || isNaN(date.getTime())) return '-';
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${m}월 ${d}일 ${hh}:${mm}:${ss}`;
  };

  // 신규 이의제기 접수 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !bibNumber.trim() || !content.trim()) {
      alert('성명, 배번, 상세 사유는 필수 입력 사항입니다.');
      return;
    }

    if (isExpired) {
      alert('공식 이의제기 접수 시한(60분)이 마감되었습니다.');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', margin: '0 auto', width: '100%' }}>

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
              ⚖️ 공식 이의제기 및 득점 확인 (Protest Time Limit)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: '4px 0 0 0', lineHeight: '1.5' }}>
              월드 세일링 경기 규칙(World Sailing RRS 61)에 의거하여, 성적표 게시 후 <strong>1시간(60분)</strong> 동안 이의제기 및 득점 확인서를 비공개로 접수합니다.
            </p>
          </div>

          <button
            onClick={fetchTimeLimit}
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
            <RefreshCw size={13} className={loadingTime ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {/* ── [2] 핵심: 1시간 카운트다운 전광판 (시간이 지나가는 화면) ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: '18px',
          border: isExpired ? '2px solid #ef4444' : '2px solid #3b82f6',
          padding: '28px 24px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '18px',
        }}
      >
        {/* 상단 진행 상태 뱃지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isPublished ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '20px', background: '#f1f5f9', color: '#475569', fontSize: '0.82rem', fontWeight: '800' }}>
              <Clock size={14} /> 잠정 성적표 공개 대기 중 (공개 시 60분 카운트다운 시작)
            </span>
          ) : !isExpired ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '20px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: '0.84rem', fontWeight: '800' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
              공식 이의제기 접수 진행 중 (남은 시간: {formattedMinutes}분 {formattedSeconds}초)
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '20px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.84rem', fontWeight: '800' }}>
              <AlertCircle size={14} /> 공식 이의제기 접수 마감 (규정 60분 경과)
            </span>
          )}
        </div>

        {/* 대형 디지털 카운트다운 타이머 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* 시간 */}
          <div style={{ background: '#0f172a', color: '#ffffff', borderRadius: '14px', padding: '16px 20px', minWidth: '92px', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '1px', lineHeight: '1' }}>
              {formattedHours}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', marginTop: '6px' }}>시간</div>
          </div>

          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a' }}>:</span>

          {/* 분 */}
          <div style={{ background: '#0f172a', color: isExpired ? '#f87171' : '#38bdf8', borderRadius: '14px', padding: '16px 20px', minWidth: '92px', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '1px', lineHeight: '1' }}>
              {formattedMinutes}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', marginTop: '6px' }}>분</div>
          </div>

          <span style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a' }}>:</span>

          {/* 초 */}
          <div style={{ background: '#0f172a', color: isExpired ? '#f87171' : '#fbbf24', borderRadius: '14px', padding: '16px 20px', minWidth: '92px', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '1px', lineHeight: '1' }}>
              {formattedSeconds}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', marginTop: '6px' }}>초</div>
          </div>
        </div>

        {/* 60분 시간 진행률 바 (Progress Bar) */}
        <div style={{ width: '100%', maxWidth: '640px', background: '#e2e8f0', borderRadius: '10px', height: '10px', overflow: 'hidden', position: 'relative' }}>
          <div
            style={{
              height: '100%',
              width: `${percentRemaining}%`,
              background: isExpired
                ? '#94a3b8'
                : percentRemaining > 25
                ? 'linear-gradient(90deg, #10b981 0%, #0284c7 100%)'
                : 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)',
              transition: 'width 1s linear',
            }}
          />
        </div>

        {/* 상세 메타 일시 안내 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
          <div>
            <span>📢 성적표 최초 공개: </span>
            <strong style={{ color: '#0f172a' }}>{formatDateTime(publishedDate)}</strong>
          </div>
          <div>
            <span>⏰ 항의 접수 마감 시한: </span>
            <strong style={{ color: isExpired ? '#dc2626' : '#2563eb' }}>{formatDateTime(expiryDate)}</strong>
          </div>
          <div>
            <span>📜 규정: </span>
            <strong style={{ color: '#475569' }}>월드세일링 RRS 61.3 (60분 원칙)</strong>
          </div>
        </div>

        {/* 접수 버튼 또는 마감 안내 */}
        {!isExpired && isPublished ? (
          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '13px 32px',
              borderRadius: '12px',
              background: isFormOpen ? '#475569' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              fontSize: '0.96rem',
              fontWeight: '900',
              border: 'none',
              cursor: 'pointer',
              boxShadow: isFormOpen ? 'none' : '0 4px 14px rgba(245, 158, 11, 0.35)',
              marginTop: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            {isFormOpen ? <X size={18} /> : <Scale size={18} />}
            <span>{isFormOpen ? '접수창 닫기' : '✍️ 공식 이의제기 / 득점 확인 접수하기 (심판진 직통)'}</span>
          </button>
        ) : isExpired ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px 22px', color: '#991b1b', fontSize: '0.86rem' }}>
            <strong>🚫 공식 항의 접수 시한이 마감되었습니다.</strong>
            <div style={{ fontSize: '0.78rem', color: '#7f1d1d', marginTop: '3px' }}>
              월드세일링 경기규칙(World Sailing RRS 61.3)에 따른 성적 공개 후 60분이 경과하여 추가 접수가 불가합니다.
            </div>
          </div>
        ) : null}
      </div>

      {/* ── [3] 접수 완료 안내 영수증 모달 ── */}
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

      {/* ── [4] 신규 이의제기 접수 폼 (열림 상태일 때) ── */}
      {isFormOpen && (
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fed7aa', paddingBottom: '12px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '900', color: '#9a3412' }}>
                ✍️ 공식 이의제기 및 득점 확인서 접수 (심판진 직통)
              </h4>
              <span style={{ fontSize: '0.78rem', color: '#c2410c' }}>
                * 본 접수 내역은 다른 선수에게 공개되지 않으며 심판위원회에만 즉시 비공개 전달됩니다.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9a3412' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* 1행: 신청자 정보 */}
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
                onChange={e => setApplicantName(e.target.value)}
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
                onChange={e => setBibNumber(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                출전 종목 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={division}
                onChange={e => setDivision(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', background: 'white' }}
              >
                <option value="혼합오픈">혼합오픈</option>
                <option value="펀&포뮬러">펀&포뮬러</option>
                <option value="윙포일">윙포일</option>
                <option value="윈드포일">윈드포일</option>
                <option value="단체전">단체전</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                세부 부문 (클라스)
              </label>
              <select
                value={subclass}
                onChange={e => setSubclass(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', background: 'white' }}
              >
                <option value="청년부">청년부</option>
                <option value="중년부">중년부</option>
                <option value="장년부">장년부</option>
                <option value="여자부">여자부</option>
                <option value="통합부">통합부/오픈</option>
              </select>
            </div>
          </div>

          {/* 2행: 소속, 연락처, 비밀번호 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                소속 클럽 / 시·도
              </label>
              <input
                type="text"
                placeholder="예: 통영윈드서핑협회"
                value={club}
                onChange={e => setClub(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                연락처 (심판진 확인용)
              </label>
              <input
                type="tel"
                placeholder="010-0000-0000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                본인 확인용 비밀번호 (4자리)
              </label>
              <input
                type="password"
                maxLength={8}
                placeholder="숫자 4자리"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>
          </div>

          {/* 3행: 이의 유형 및 대상 라운드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                이의 유형 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={protestType}
                onChange={e => setProtestType(e.target.value as any)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', background: 'white' }}
              >
                <option value="SCORING">득점/기록 오기 정정 (Scoring Inquiry)</option>
                <option value="RULE">경기 규칙(RRS) 위반 항의 (Protest)</option>
                <option value="EQUIPMENT">장비/계측 자격 이의 (Measurement)</option>
                <option value="OTHER">대회 운영 기타 문의</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                대상 라운드 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={targetRound}
                onChange={e => setTargetRound(e.target.value)}
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
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                상대 선수 배번 (규칙 항의 시)
              </label>
              <input
                type="text"
                placeholder="상대 배번 (선택)"
                value={respondent}
                onChange={e => setRespondent(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>
          </div>

          {/* 4행: 사유 및 경위 서술 */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
              구체적인 사유 및 정황 진술 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              rows={4}
              required
              placeholder="예: 1라운드 결승선 통과 시 8위로 정상 완주하였으나 순위표에 DNS로 표기되어 있습니다. 당시 바로 앞 7위(연두 16번) 직후 통과하였으니 계측원 기록지 및 비디오 확인 후 정정 부탁드립니다."
              value={content}
              onChange={e => setContent(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', lineHeight: '1.5' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              style={{ padding: '10px 18px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#475569', fontWeight: '700', cursor: 'pointer' }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '800',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              <Send size={15} />
              {submitting ? '심판진 전송 중...' : '심판진 직통 비공개 접수'}
            </button>
          </div>
        </form>
      )}

      {/* ── [5] 공식 규정 및 접수 안내 가이드 카드 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ background: '#eff6ff', color: '#2563eb', padding: '6px', borderRadius: '8px' }}>
              <Clock size={16} />
            </div>
            <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>60분 접수 마감 원칙</strong>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: '1.5' }}>
            월드세일링 경기규칙(World Sailing RRS 61.3)에 의거하여 성적표 최초 게시 시점으로부터 <strong>정확히 60분 이내</strong>에 접수된 건에 한하여 심판위원회의 공식 심의가 진행됩니다.
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
            선수 간 불필요한 마찰을 방지하고 공정한 판정을 보장하기 위해, 제출된 이의제기 내역은 <strong>외부에 공개되지 않으며 오직 심판위원회에만 즉시 전달</strong>됩니다.
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
