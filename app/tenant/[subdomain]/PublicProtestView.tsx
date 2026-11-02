'use client';

import React, { useState, useEffect } from 'react';
import {
  Scale,
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Plus,
  RefreshCw,
  Lock,
  Unlock,
  Send,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  User,
  Tag,
  MessageSquareCheck
} from 'lucide-react';
import { ProtestItem } from '@/app/api/tenant/[subdomain]/protests/route';

interface PublicProtestViewProps {
  subdomain: string;
  defaultDivision?: string;
}

export default function PublicProtestView({ subdomain, defaultDivision = '혼합오픈' }: PublicProtestViewProps) {
  const [protests, setProtests] = useState<ProtestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 폼 입력 상태
  const [applicantName, setApplicantName] = useState('');
  const [bibNumber, setBibNumber] = useState('');
  const [division, setDivision] = useState(defaultDivision);
  const [subclass, setSubclass] = useState('청년부');
  const [club, setClub] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [protestType, setProtestType] = useState<'SCORING' | 'RULE' | 'EQUIPMENT' | 'OTHER'>('SCORING');
  const [targetRound, setTargetRound] = useState('1R');
  const [respondent, setRespondent] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [content, setContent] = useState('');

  const fetchProtests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/protests?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.protests) {
        setProtests(data.protests);
      }
    } catch (e) {
      console.error('이의제기 목록 조회 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProtests();
  }, [subdomain]);

  // 신규 이의제기 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !bibNumber.trim() || !content.trim()) {
      alert('성명, 배번, 상세 사유는 필수 입력 사항입니다.');
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
          isSecret,
          protestType,
          targetRound,
          respondent,
          incidentTime,
          content,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        alert('이의제기가 공식 접수되었습니다.\n심판진의 심의 후 심의 결정문 및 순위 정정 사항이 실시간으로 답변 등록됩니다.');
        setIsFormOpen(false);
        // 폼 초기화
        setContent('');
        setPassword('');
        fetchProtests();
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

  // 상태별 라벨 및 스타일
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { label: '접수 대기', bg: '#fef3c7', color: '#b45309', border: '#fde68a', icon: '🟡' };
      case 'IN_REVIEW':
        return { label: '심판 심의중', bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd', icon: '🔵' };
      case 'ACCEPTED':
        return { label: '인용 (기록수정 완료)', bg: '#dcfce7', color: '#15803d', border: '#86efac', icon: '🟢' };
      case 'REJECTED':
        return { label: '기각 (사유불충분)', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', icon: '🔴' };
      case 'RESOLVED':
        return { label: '답변 완료', bg: '#f3e8ff', color: '#7e22ce', border: '#d8b4fe', icon: '🟣' };
      default:
        return { label: '접수됨', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', icon: '⚪' };
    }
  };

  // 이의 유형 라벨
  const getProtestTypeLabel = (type: string) => {
    switch (type) {
      case 'SCORING':
        return { label: '득점/기록 오기 정정 (Scoring Inquiry)', color: '#2563eb', bg: '#eff6ff' };
      case 'RULE':
        return { label: '경기 규칙(RRS) 위반 항의 (Protest)', color: '#dc2626', bg: '#fef2f2' };
      case 'EQUIPMENT':
        return { label: '장비/자격 이의제기 (Measurement)', color: '#d97706', bg: '#fffbeb' };
      default:
        return { label: '대회 운영 기타 문의', color: '#475569', bg: '#f8fafc' };
    }
  };

  // 필터링된 목록
  const filteredProtests = protests.filter(p => {
    if (filterStatus === 'ALL') return true;
    return p.status === filterStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>

      {/* ── [1] 공식 이의제기 및 득점 확인 규정 안내 배너 ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '16px',
          padding: '24px 26px',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '3px 10px', borderRadius: '16px', fontSize: '0.76rem', color: '#fbbf24', fontWeight: '800', marginBottom: '6px' }}>
              <Scale size={13} /> 공식 심판위원회 (Jury / Protest Committee)
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>
              ⚖️ 공식 이의제기 및 득점 확인 (Protest & Scoring Inquiries)
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: '4px 0 0 0', lineHeight: '1.5' }}>
              월드 세일링 경기 규칙(World Sailing RRS 61) 및 본 대회 요강(NoR)에 의거하여, 성적 오기 정정 및 경기 규칙 위반 항의를 심판진에 공식 접수하고 실시간 심의 결과를 확인하는 민원 해결 창구입니다.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={fetchProtests}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '9px 12px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
            <button
              onClick={() => setIsFormOpen(!isFormOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                background: isFormOpen ? '#475569' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.85rem',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: isFormOpen ? 'none' : '0 2px 8px rgba(217, 119, 6, 0.3)',
              }}
            >
              {isFormOpen ? <X size={15} /> : <Plus size={15} />}
              {isFormOpen ? '작성창 닫기' : '새 이의제기 접수하기'}
            </button>
          </div>
        </div>

        {/* 규정 요약 가이드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginTop: '4px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '2px' }}>⏱️ 항의 마감 시한 (Time Limit)</strong>
            잠정 성적표 게시 후 또는 해당 레이스 결승선 통과 후 <strong>60분 이내</strong> 접수 원칙
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '2px' }}>📋 득점 정정 (Scoring Inquiry)</strong>
            완주 등수 누락, DNS/DNF 착오 표기 시 심판 기록지 및 비디오 대조 후 즉시 정정
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            <strong style={{ color: '#4ade80', display: 'block', marginBottom: '2px' }}>🏛️ 실시간 심의 답변 연동</strong>
            심판위원회가 심의 후 결정 사항을 실시간 답변 등록하여 투명하게 공개 처리
          </div>
        </div>
      </div>

      {/* ── [2] 신규 이의제기 접수 폼 (열림 상태일 때) ── */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '2px solid #f59e0b',
            padding: '24px 28px',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '900', color: '#0f172a' }}>
                ✍️ 공식 이의제기(항의서 / 득점확인서) 작성
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                작성하신 내용은 심판실 심판 모바일 제어기에 즉시 전송되며, 심의 후 결정문이 등록됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* 1행: 신청인 기본 정보 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                선수 성명 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="예: 김현수"
                value={applicantName}
                onChange={e => setApplicantName(e.target.value)}
                required
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                배번 (번호) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="예: 연두 28 / 오렌지 15"
                value={bibNumber}
                onChange={e => setBibNumber(e.target.value)}
                required
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                종목 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={division}
                onChange={e => setDivision(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', background: '#fff' }}
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
                부문 / 클라스
              </label>
              <select
                value={subclass}
                onChange={e => setSubclass(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', background: '#fff' }}
              >
                <option value="청년부">청년부</option>
                <option value="중년부">중년부</option>
                <option value="장년부">장년부</option>
                <option value="여자부">여자부</option>
                <option value="남자부">남자부</option>
                <option value="통합부">통합부</option>
                <option value="클럽 대항전">클럽 대항전</option>
              </select>
            </div>
          </div>

          {/* 2행: 소속, 연락처, 비밀번호 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                소속 클럽 / 단체
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
                연락처 (휴대폰 번호)
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
                비밀번호 (4자리)
              </label>
              <input
                type="password"
                maxLength={8}
                placeholder="조회/수정용 비밀번호"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginTop: '22px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', fontWeight: '700', color: '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isSecret}
                  onChange={e => setIsSecret(e.target.checked)}
                  style={{ width: '17px', height: '17px' }}
                />
                비공개 접수 (접수 내용과 심의 결과만 공개되고, 접수자 및 대상자 정보 가림)
              </label>
            </div>
          </div>

          {/* 3행: 이의제기 규정 유형 및 대상 라운드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                이의제기 분류 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={protestType}
                onChange={e => setProtestType(e.target.value as any)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', background: '#fff' }}
              >
                <option value="SCORING">🎯 득점 및 기록 오기 정정 (Scoring Inquiry)</option>
                <option value="RULE">⛵ 경기 규칙(RRS) 위반 항의 (Protest)</option>
                <option value="EQUIPMENT">📏 장비 규격 및 선수 자격 이의 (Measurement)</option>
                <option value="OTHER">💬 기타 대회 운영 관련 문의</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                대상 라운드 <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={targetRound}
                onChange={e => setTargetRound(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', background: '#fff' }}
              >
                <option value="1R">제1라운드 (1R)</option>
                <option value="2R">제2라운드 (2R)</option>
                <option value="3R">제3라운드 (3R)</option>
                <option value="4R">제4라운드 (4R)</option>
                <option value="5R">제5라운드 (5R)</option>
                <option value="전체">전체 성적 종합</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                피항의자 / 상대 배번 (규칙 항의 시)
              </label>
              <input
                type="text"
                placeholder="예: 상대선수 성명 또는 배번"
                value={respondent}
                onChange={e => setRespondent(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                발생 시각 및 수역 위치
              </label>
              <input
                type="text"
                placeholder="예: 14:15경 1번 마크 회항 부근"
                value={incidentTime}
                onChange={e => setIncidentTime(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem' }}
              />
            </div>
          </div>

          {/* 4행: 구체적 사유 및 경위 진술 */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
              구체적인 사유 및 정황 진술 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              rows={4}
              required
              placeholder="예: 2라운드 경기에서 8위로 정상 완주하였으나 순위표에 DNS(65점)으로 표기되어 있습니다. 당시 7위(연두 16번) 바로 뒤에 결승선을 통과하였으므로 계측원 기록지 및 비디오 확인 후 정정 부탁드립니다."
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
              {submitting ? '접수 처리 중...' : '공식 이의제기 제출'}
            </button>
          </div>
        </form>
      )}

      {/* ── [3] 이의제기 접수 현황 및 필터 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { id: 'ALL', label: `전체 (${protests.length})` },
            { id: 'PENDING', label: `🟡 접수대기 (${protests.filter(p => p.status === 'PENDING').length})` },
            { id: 'IN_REVIEW', label: `🔵 심의중 (${protests.filter(p => p.status === 'IN_REVIEW').length})` },
            { id: 'ACCEPTED', label: `🟢 인용(수정) (${protests.filter(p => p.status === 'ACCEPTED').length})` },
            { id: 'REJECTED', label: `🔴 기각 (${protests.filter(p => p.status === 'REJECTED').length})` },
            { id: 'RESOLVED', label: `🟣 답변완료 (${protests.filter(p => p.status === 'RESOLVED').length})` },
          ].map(tab => {
            const isActive = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  border: isActive ? '1.5px solid var(--theme-primary, #2563eb)' : '1px solid #e2e8f0',
                  background: isActive ? '#eff6ff' : '#ffffff',
                  color: isActive ? 'var(--theme-primary, #2563eb)' : '#64748b',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? '800' : '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          총 {filteredProtests.length}건
        </span>
      </div>

      {/* ── [4] 이의제기 목록 및 심판 답변 카드 ── */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
          이의제기 현황을 불러오는 중입니다...
        </div>
      ) : filteredProtests.length === 0 ? (
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
          <Scale size={40} style={{ color: '#cbd5e1', margin: '0 auto 12px auto' }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: '800', color: '#334155' }}>
            등록된 이의제기 내역이 없습니다.
          </h4>
          <p style={{ margin: 0, fontSize: '0.84rem' }}>
            성적 오기 정정 또는 경기 규칙 항의 사항이 있으신 경우 상단의 <strong>[새 이의제기 접수하기]</strong>를 이용해 주시기 바랍니다.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredProtests.map(item => {
            const statusBadge = getStatusBadge(item.status);
            const typeLabel = getProtestTypeLabel(item.protestType);

            return (
              <div
                key={item.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  padding: '20px 22px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {/* 상단 메타 바 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '0.74rem',
                        fontWeight: '800',
                        background: statusBadge.bg,
                        color: statusBadge.color,
                        border: `1px solid ${statusBadge.border}`,
                      }}
                    >
                      {statusBadge.icon} {statusBadge.label}
                    </span>

                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '0.74rem',
                        fontWeight: '700',
                        background: typeLabel.bg,
                        color: typeLabel.color,
                      }}
                    >
                      {typeLabel.label}
                    </span>

                    <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0f172a', background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                      {item.targetRound}
                    </span>

                    {item.isSecret && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: '#b45309', fontWeight: '800', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                        <Lock size={12} /> 비공개 (접수자·대상자 정보 가림)
                      </span>
                    )}
                  </div>

                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    접수: {new Date(item.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* 신청인 및 종목 요약 (비공개 시 접수자 및 대상자 내역 가림) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.88rem', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px' }}>
                  {item.isSecret ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', color: '#64748b' }}>
                        <Lock size={14} style={{ color: '#ea580c' }} />
                        <span>접수자: 익명 (비공개)</span>
                      </div>
                      <div style={{ color: '#94a3b8', fontWeight: '700' }}>
                        배번: 비공개
                      </div>
                      <div style={{ color: '#64748b' }}>
                        {item.division} {item.subclass ? `(${item.subclass})` : ''}
                      </div>
                      {item.respondent && (
                        <div style={{ color: '#b91c1c', fontWeight: '700', background: '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>
                          대상자(상대): 비공개 (가림)
                        </div>
                      )}
                      {item.incidentTime && (
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                          📍 {item.incidentTime}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', color: '#0f172a' }}>
                        <User size={15} style={{ color: '#64748b' }} />
                        <span>{item.applicantName}</span>
                      </div>
                      <div style={{ color: '#0284c7', fontWeight: '800' }}>
                        #{item.bibNumber}
                      </div>
                      <div style={{ color: '#64748b' }}>
                        {item.division} {item.subclass ? `(${item.subclass})` : ''}
                      </div>
                      {item.club && (
                        <div style={{ color: '#64748b' }}>
                          소속: {item.club}
                        </div>
                      )}
                      {item.respondent && (
                        <div style={{ color: '#dc2626', fontWeight: '700', background: '#fef2f2', padding: '2px 8px', borderRadius: '4px' }}>
                          상대: {item.respondent}
                        </div>
                      )}
                      {item.incidentTime && (
                        <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                          📍 {item.incidentTime}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 내용 본문 (비공개 이의제기도 접수 내용은 공개) */}
                <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {item.isSecret && (
                    <div style={{ fontSize: '0.78rem', color: '#9a3412', background: '#fff7ed', border: '1px solid #ffedd5', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={13} style={{ color: '#ea580c', flexShrink: 0 }} />
                      <span>비공개 이의제기 접수 건입니다. 접수 내용과 심의 결과만 공개되며, 접수자 및 대상자(상대 선수) 인적 사항은 가림 처리되었습니다.</span>
                    </div>
                  )}
                  {item.content}
                </div>

                {/* ── [5] 심판 공식 심의 결정문 및 민원 해결 답변 박스 ── */}
                {item.officialDecision ? (
                  <div
                    style={{
                      background: item.status === 'ACCEPTED'
                        ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                        : item.status === 'REJECTED'
                        ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
                        : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: item.status === 'ACCEPTED'
                        ? '1.5px solid #86efac'
                        : item.status === 'REJECTED'
                        ? '1.5px solid #fca5a5'
                        : '1.5px solid #cbd5e1',
                      borderRadius: '12px',
                      padding: '16px 18px',
                      marginTop: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '900', fontSize: '0.92rem', color: item.status === 'ACCEPTED' ? '#15803d' : item.status === 'REJECTED' ? '#b91c1c' : '#0f172a' }}>
                        <MessageSquareCheck size={18} />
                        <span>🏛️ 심판위원회 공식 심의 결정 및 조치 사항</span>
                      </div>
                      <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                        {item.decidedAt ? new Date(item.decidedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.88rem', color: '#1e293b', lineHeight: '1.6', whiteSpace: 'pre-wrap', fontWeight: '500' }}>
                      {item.officialDecision}
                    </div>

                    <div style={{ marginTop: '8px', textAlign: 'right', fontSize: '0.78rem', fontWeight: '800', color: '#64748b' }}>
                      서명: {item.decidedBy || '수석심판관 / 경기위원장'}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} /> 심판진 검토 및 심의 대기 중입니다. 심의가 완료되는 즉시 조치 사항이 등록됩니다.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
