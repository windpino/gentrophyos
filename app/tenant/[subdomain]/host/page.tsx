'use client';

import React, { useState, useEffect, use } from 'react';
import { Award, Check, X, Menu, Upload, Download, Plus, Trash2, ArrowUp, ArrowDown, Users, FileText, Settings, Layers, Calendar, RefreshCw, Save, Search, Eye, ExternalLink, Clock, ShieldAlert, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/src/lib/firebase';

interface GridRow {
  id: string; // 데이터베이스 registration ID 또는 임시 행의 'temp-...' ID
  playerId: string;
  name: string;
  birth: string;
  gender: string;
  phone: string;
  club: string;
  division: string;
  tshirtSize: string;
  vestAgreement: string;
  paymentNoticeAgreement: string;
  liabilityWaiver: string;
  privacyConsent: string;
  mediaConsent: string;
  paymentStatus: 'PENDING' | 'APPROVED';
  status: 'PENDING' | 'APPROVED';
  createdAt?: string;
  rawCreatedAt?: string;
  bibNumber?: string;
  subclass?: string;
  rawFormResponses?: string;

  // 편집 제어 플래그
  isEdited?: boolean;
  isNew?: boolean;
}

interface TieBreakerRule {
  id: string;
  priority: number;
  ruleType: string;
}

const DEFAULT_TIE_BREAKER_RULES: TieBreakerRule[] = [
  { id: 'rule-h2h', priority: 1, ruleType: 'HEAD_TO_HEAD' },
  { id: 'rule-mbf', priority: 2, ruleType: 'MOST_BETTER_FINISHES' },
  { id: 'rule-mrr', priority: 3, ruleType: 'MOST_RECENT_RACE' },
  { id: 'rule-drop', priority: 4, ruleType: 'DISCARD_DROP' },
];

const DEFAULT_FORM_FIELDS = [
  { id: 'name', label: '1. 성명', type: 'text', required: true, placeholder: '실명을 입력해 주세요.' },
  { id: 'birth', label: '2. 생년월일 (8자리) 예) 19450815', type: 'text', required: true, placeholder: '예) 19901024' },
  { id: 'gender', label: '3. 성별', type: 'radio', required: true, options: ['남자', '여자'] },
  { id: 'phone', label: '4. 전화번호 (휴대폰번호)', type: 'text', required: true, placeholder: '예) 01012345678' },
  { id: 'club', label: '5. 소속협회 또는 클럽', type: 'text', required: true, placeholder: '소속 단체명을 입력해 주세요.' },
  { id: 'division', label: '6. 참가종목', type: 'radio', required: true, options: ['윈드포일', '윙포일 (남자부)', '윙포일 (여자부)', '혼합오픈 (남자부)', '혼합오픈 (여자부)', '펀엔포뮬러 (남자부)', '펀엔포뮬러 (여자부)'] },
  { id: 'tshirtSize', label: '7. 티셔츠(기념품)사이즈', type: 'radio', required: true, options: ['S (95)', 'M (100)', 'L (105)', 'XL (110)'] },
  { id: 'vestAgreement', label: '8. 당일 대회본부에 조끼(배번티)를 반드시 수령하셔야 합니다.', type: 'checkbox', required: true, notice: '대회운영본부 수령 필수 (사용 후 반드시 반납바랍니다)', agreeLabel: '네. 확인했습니다.' },
  { id: 'paymentNoticeAgreement', label: '9. 참가비 입금 안내 확인 동의', type: 'checkbox', required: true, notice: '• 참가비: 30,000원\n• 입금계좌: 농협 351-1334-8643-33 (예금주: 통영시요트협회)\n• 참가 신청서에 작성하신 성명(이름)으로 반드시 입금해 주시기 바랍니다.\n• 입금 완료 순서(입금순)로 선착순 130명 참가 확정 처리됩니다.\n• 참가 확정 및 선수등록 승인 안내는 대회 공식 홈페이지에서 확인하실 수 있습니다.', agreeLabel: '네. 확인했습니다.' },
  { id: 'liabilityWaiver', label: '10. 면책 동의서 서약에 동의합니다.', type: 'textarea', required: true, textareaContent: '본인은 제20회 이순신장군배 전국윈드서핑대회 참가 활동 중 본인의 부주의로 인해 발생할 수 있는 사고, 즉 개인적 부상, 재산상 피해, 의학적인 사고 등 대회기간 중 발생한 사고에 대한 책임은 본인의 자의적인 참가에 의한 본인의 책임이며, 본 대회를 주관하는 관계자 및 기관에 대한 면책은 물론 책임전가를 하지 않을 것을 서약합니다.', agreeLabel: '네. 동의합니다.' },
  { id: 'privacyConsent', label: '11. 개인정보 수집에 동의합니다.', type: 'textarea', required: true, textareaContent: '• 정보수집 및 이용기관 : 통영시요트협회\n• 수집 정보 : 성명, 생년월일, 전화번호, 이메일, 소속 단체\n• 수집 목적 : 참가자 관리 및 보험가입, 대회 공지 전송 등\n• 보존 기간 : 대회 정산 이후 즉시 폐기합니다.', agreeLabel: '네. 동의합니다.' },
  { id: 'mediaConsent', label: '12. 초상권 및 저작권 사용 동의', type: 'textarea', required: true, textareaContent: '• 정보수집 및 이용기관 : 통영시요트협회\n• 수집 목적 : 대회 홍보, 결과 보도, 미디어 자료 활용 등\n• 활용 대상 : 대회 사진, 동영상 등 촬영물\n• 보존 기간 : 통영시요트협회 아카이브 보관용으로 영구 보존 및 활용에 동의합니다.', agreeLabel: '네. 동의합니다.' }
];

const DIVISION_OPTIONS = [
  '윈드포일',
  '윙포일 (남자부)',
  '윙포일 (여자부)',
  '혼합오픈 (남자부)',
  '혼합오픈 (여자부)',
  '펀엔포뮬러 (남자부)',
  '펀엔포뮬러 (여자부)'
];

const TSHIRT_OPTIONS = [
  'S (95)',
  'M (100)',
  'L (105)',
  'XL (110)'
];

const normalizeTshirtSize = (size?: string): string => {
  if (!size) return 'M (100)';
  const s = String(size).trim();
  if (TSHIRT_OPTIONS.includes(s)) return s;
  if (s === '95' || s.toUpperCase() === 'S') return 'S (95)';
  if (s === '100' || s.toUpperCase() === 'M') return 'M (100)';
  if (s === '105' || s.toUpperCase() === 'L') return 'L (105)';
  if (s === '110' || s.toUpperCase() === 'XL') return 'XL (110)';
  return s;
};

const normalizeDivision = (div?: string, gender?: string): string => {
  if (!div) return '윈드포일';
  const d = String(div).trim();
  if (d.includes('윈드포일')) return '윈드포일';
  if (DIVISION_OPTIONS.includes(d)) return d;
  
  const isFemale = d.includes('여자') || gender === '여자';
  const suffix = isFemale ? ' (여자부)' : ' (남자부)';
  if (d.includes('윙포일')) return `윙포일${suffix}`;
  if (d.includes('혼합오픈')) return `혼합오픈${suffix}`;
  if (d.includes('펀엔포뮬러') || d.includes('펀&포뮬러')) return `펀엔포뮬러${suffix}`;
  return d;
};

export default function HostDashboardPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = use(params);

  // 비밀번호 인증 게이트 추가
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // 기본 정보
  const [tenant, setTenant] = useState<any>(null);
  const [activeTournament, setActiveTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'applicants' | 'brackets' | 'tie-breaker' | 'notice'>('applicants');
  const [bracketPublishing, setBracketPublishing] = useState(false);
  const [selectedBracketDivision, setSelectedBracketDivision] = useState<string>('전체');
  const [bracketStatusFilter, setBracketStatusFilter] = useState<'all' | 'approved'>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [filterSortCategory, setFilterSortCategory] = useState<string>('all');
  const [subFilterValue, setSubFilterValue] = useState<string>('all');
  const [sortField, setSortField] = useState<'name' | 'bibNumber' | 'birth' | 'createdAt' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleHeaderSort = (field: 'name' | 'bibNumber' | 'birth' | 'createdAt') => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 로컬 스토리지에서 사이드바 열림/닫힘 상태 복원
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gentrophy_host_sidebar');
      if (saved !== null) {
        setIsSidebarOpen(saved === 'true');
      }
    }
  }, []);

  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 960) {
      setIsMobileMenuOpen((prev) => !prev);
    } else {
      setIsSidebarOpen((prev) => {
        const next = !prev;
        if (typeof window !== 'undefined') {
          localStorage.setItem('gentrophy_host_sidebar', String(next));
        }
        return next;
      });
    }
  };

  // 스프레드시트 그리드 상태 관리
  const [gridData, setGridData] = useState<GridRow[]>([]);
  const [rawRegistrations, setRawRegistrations] = useState<any[]>([]); // 원본 상세 데이터 바인딩용
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<'all' | 'name' | 'phone' | 'club' | 'division'>('all'); // 카테고리별 검색
  const [selectedReg, setSelectedReg] = useState<GridRow | null>(null); // 신청서 보기 팝업용
  const [deleteTarget, setDeleteTarget] = useState<GridRow | null>(null); // 참가자 삭제 확인 모달
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 온라인 참가 신청 접수 기간 및 권한 설정 상태
  const [regStartDate, setRegStartDate] = useState('2026-09-29T09:00');
  const [regEndDate, setRegEndDate] = useState('2026-10-18T18:00');
  const [regMode, setRegMode] = useState<'AUTO' | 'FORCE_ENABLED' | 'DISABLED'>('AUTO');
  const [regEnabled, setRegEnabled] = useState(true);
  const [regNotice, setRegNotice] = useState('');
  const [regPeriodSaving, setRegPeriodSaving] = useState(false);

  // 동점자 룰(월드세일링 RRS 부록 A8 표준 4단계) 및 DNS/DNF 벌점 규칙
  const [rules, setRules] = useState<TieBreakerRule[]>(DEFAULT_TIE_BREAKER_RULES);
  const [dnsDnfRule, setDnsDnfRule] = useState<'FINISHER_PLUS_ONE' | 'REGISTERED_PLUS_ONE'>('FINISHER_PLUS_ONE');
  const [dnsDnfSaving, setDnsDnfSaving] = useState(false);

  const [authChecking, setAuthChecking] = useState(true);

  // Dual-channel 인증 토큰 헤더 헬퍼
  const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('gentrophy_auth_token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-auth-token'] = token;
    }
    return headers;
  };

  // 세션 확인 (이미 로그인된 경우 자동 인증)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('gentrophy_auth_token') : null;
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch('/api/auth/verify?role=admin', { 
          cache: 'no-store',
          headers
        });
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('세션 확인 실패:', err);
      } finally {
        setAuthChecking(false);
      }
    };
    checkSession();
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput, role: 'admin', subdomain }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.token && typeof window !== 'undefined') {
          localStorage.setItem('gentrophy_auth_token', data.token);
        }
        setIsAuthenticated(true);
        setAuthError('');
        setPasswordInput('');
      } else {
        setAuthError(data.message || '올바르지 않은 비밀번호입니다. 다시 입력해 주세요.');
        setPasswordInput('');
      }
    } catch {
      setAuthError('서버 연결 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gentrophy_auth_token');
      }
      await fetch('/api/auth/verify', { method: 'DELETE' });
      setIsAuthenticated(false);
      setPasswordInput('');
    } catch (err) {
      console.error('로그아웃 오류:', err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [subdomain]);

  const fetchInitialData = async () => {
    try {
      const tenantRes = await fetch(`/api/tenant/${subdomain}?_t=${Date.now()}`, { cache: 'no-store' });
      const tenantData = await tenantRes.json();
      if (tenantData.tenant) {
        setTenant(tenantData.tenant);
        if (tenantData.tenant.overviewConfig) {
          const cfg = tenantData.tenant.overviewConfig;
          if (cfg.registrationStartDate) setRegStartDate(cfg.registrationStartDate);
          if (cfg.registrationEndDate) setRegEndDate(cfg.registrationEndDate);
          if (cfg.registrationMode) {
            setRegMode(cfg.registrationMode);
          } else if (cfg.registrationEnabled === false) {
            setRegMode('DISABLED');
          } else if (cfg.registrationEnabled === 'FORCE_ENABLED') {
            setRegMode('FORCE_ENABLED');
          } else {
            setRegMode('AUTO');
          }
          if (cfg.registrationEnabled !== undefined) setRegEnabled(cfg.registrationEnabled !== false);
          if (cfg.registrationNotice !== undefined) setRegNotice(cfg.registrationNotice);
          if (cfg.dnsDnfScoringRule === 'FINISHER_PLUS_ONE' || cfg.dnsDnfScoringRule === 'REGISTERED_PLUS_ONE') {
            setDnsDnfRule(cfg.dnsDnfScoringRule);
            if (typeof window !== 'undefined') {
              localStorage.setItem(`gentrophy_dns_dnf_rule_${subdomain}`, cfg.dnsDnfScoringRule);
            }
          } else if (typeof window !== 'undefined') {
            const savedRule = localStorage.getItem(`gentrophy_dns_dnf_rule_${subdomain}`);
            if (savedRule === 'FINISHER_PLUS_ONE' || savedRule === 'REGISTERED_PLUS_ONE') {
              setDnsDnfRule(savedRule);
            }
          }
        }
        const ongoing = tenantData.tenant.tournaments.find((t: any) => t.status === 'ONGOING');
        if (ongoing) {
          setActiveTournament(ongoing);
          await loadSectionData(ongoing.id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDnsDnfRule = async (nextRule: 'FINISHER_PLUS_ONE' | 'REGISTERED_PLUS_ONE') => {
    setDnsDnfRule(nextRule);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`gentrophy_dns_dnf_rule_${subdomain}`, nextRule);
    }
    setDnsDnfSaving(true);
    try {
      const currentConfig = tenant?.overviewConfig || {};
      const updatedConfig = {
        ...currentConfig,
        dnsDnfScoringRule: nextRule,
      };
      const res = await fetch(`/api/tenant/${subdomain}/overview`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ overviewConfig: updatedConfig }),
      });
      if (res.ok) {
        await fetchInitialData();
      }
    } catch (e) {
      console.error('DNS/DNF 규칙 저장 실패:', e);
    } finally {
      setDnsDnfSaving(false);
    }
  };

  const handleSaveRegistrationPeriod = async () => {
    setRegPeriodSaving(true);
    try {
      const currentConfig = tenant?.overviewConfig || {};
      const updatedConfig = {
        ...currentConfig,
        duration: '2026. 10. 31(토) ~ 11. 01(일) (1박 2일)',
        registrationStartDate: '2026-09-29T09:00',
        registrationEndDate: '2026-10-18T18:00',
        deadlineDate: '2026년 10월 18일(일) 18:00 (130명 한도 조기마감)',
        scale: '130명 한도 (선착순 조기마감)',
        location: '경상남도 통영시 도남동 수륙해수욕장 일원',
        registrationMode: regMode,
        registrationEnabled: regMode !== 'DISABLED',
        registrationNotice: regNotice,
      };
      const res = await fetch(`/api/tenant/${subdomain}/overview`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ overviewConfig: updatedConfig }),
      });
      if (res.ok) {
        alert('온라인 접수 운영 상태가 성공적으로 저장되었습니다!');
        await fetchInitialData();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || '저장에 실패했습니다.');
      }
    } catch {
      alert('오류가 발생했습니다.');
    } finally {
      setRegPeriodSaving(false);
    }
  };

  // 생년월일(YYYYMMDD 또는 YYMMDD)을 비교 가능한 8자리 숫자(YYYYMMDD)로 변환 (숫자가 클수록 나이가 젊음 = 청년부)
  const parseBirthComparable = (birthStr?: string): number => {
    if (!birthStr) return 0;
    const digits = String(birthStr).trim().replace(/[^0-9]/g, '');
    if (digits.length === 8) return parseInt(digits, 10) || 0;
    if (digits.length === 6) {
      const yy = parseInt(digits.substring(0, 2), 10);
      const prefix = yy <= 26 ? '20' : '19';
      return parseInt(`${prefix}${digits}`, 10) || 0;
    }
    if (digits.length === 4) return parseInt(`${digits}0101`, 10) || 0;
    return parseInt(digits, 10) || 0;
  };

  const getRootDivisionName = (div?: string): string => {
    const d = div || '윈드포일';
    if (d.includes('윈드포일')) return '윈드포일';
    if (d.includes('윙포일')) return '윙포일';
    if (d.includes('혼합오픈')) return '혼합오픈';
    if (d.includes('펀엔포뮬러') || d.includes('펀&포뮬러')) return '펀&포뮬러';
    return d;
  };

  // 혼합오픈 및 펀&포뮬러 종목(남자부) 참가자를 생년월일 기준 1/3 균등분할하여 청년부·중년부·장년부로 계산 (참가확정 전 신청자도 포함)
  const computeAgeSplitSubclasses = (rows: GridRow[]): Record<string, '청년부' | '중년부' | '장년부'> => {
    const result: Record<string, '청년부' | '중년부' | '장년부'> = {};
    const targetDivisions = ['혼합오픈', '펀&포뮬러'];

    targetDivisions.forEach((targetDiv) => {
      const groupPlayers = rows.filter((r) => {
        const rootDiv = getRootDivisionName(r.division);
        const isMale = !r.gender || r.gender.includes('남자') || (!r.gender.includes('여자') && !String(r.division).includes('여자'));
        return rootDiv === targetDiv && isMale;
      });

      if (groupPlayers.length === 0) return;

      // 출생연월일 내림차순 정렬 (최근 출생 = 가장 젊은 선수 = 청년부 우선)
      const sorted = [...groupPlayers].sort((a, b) => {
        const birthA = parseBirthComparable(a.birth);
        const birthB = parseBirthComparable(b.birth);
        if (birthA !== birthB) {
          if (birthA === 0) return 1;
          if (birthB === 0) return -1;
          return birthB - birthA;
        }
        return (a.name || '').localeCompare(b.name || '', 'ko');
      });

      const total = sorted.length;
      const youthLimit = Math.ceil(total / 3);
      const middleLimit = Math.ceil((2 * total) / 3);

      sorted.forEach((p, idx) => {
        if (idx < youthLimit) {
          result[p.id] = '청년부';
        } else if (idx < middleLimit) {
          result[p.id] = '중년부';
        } else {
          result[p.id] = '장년부';
        }
      });
    });

    return result;
  };

  const handleAutoAssignAgeSubclasses = () => {
    const targetPool = bracketStatusFilter === 'approved'
      ? gridData.filter(r => r.status === 'APPROVED')
      : gridData;
    const ageMap = computeAgeSplitSubclasses(targetPool);
    const targetIds = Object.keys(ageMap);
    if (targetIds.length === 0) {
      alert('혼합오픈 또는 펀&포뮬러 종목에 등록된 남자부 선수가 없습니다.');
      return;
    }

    setGridData((prev) =>
      prev.map((row) => {
        const assigned = ageMap[row.id];
        if (assigned && row.subclass !== assigned) {
          return {
            ...row,
            subclass: assigned,
            isEdited: true,
          };
        }
        return row;
      })
    );
    alert(`✅ 혼합오픈 및 펀&포뮬러 참가자(${targetIds.length}명)에 대해 생년월일 기준 1/3 균등분할(청년부·중년부·장년부) 편성이 적용되었습니다.\n상단 [조/배번 변경사항 임시저장] 또는 [대진표 확정 및 홈페이지 공개]를 누르면 최종 저장됩니다.`);
  };

  const handleToggleBracketsPublish = async (publish: boolean) => {
    if (!tenant) return;
    const confirmMsg = publish
      ? '대진표 및 조 편성표를 최종 확정하여 대회 공식 홈페이지에 공개하시겠습니까?\n(혼합오픈·펀&포뮬러 생년월일 기준 청년부/중년부/장년부 구분이 함께 저장되며, 참가 신청서 원본 데이터는 안전하게 유지됩니다.)'
      : '홈페이지에 공개된 대진표 및 조 편성표를 비공개(확정 대기) 상태로 전환하시겠습니까?';
    if (!confirm(confirmMsg)) return;

    setBracketPublishing(true);
    try {
      // 혼합오픈 & 펀&포뮬러 생년월일 1/3 균등분할(청년부/중년부/장년부) 자동 반영 + 수정된 행 함께 저장
      const ageMap = computeAgeSplitSubclasses(gridData);
      const effectiveGrid = gridData.map((row) => {
        const autoSubclass = ageMap[row.id];
        const currentSub = row.subclass || '통합부';
        if (autoSubclass && !row.isEdited && (currentSub === '통합부' || currentSub === '청년부' || currentSub === '중년부' || currentSub === '장년부')) {
          if (currentSub !== autoSubclass) {
            return { ...row, subclass: autoSubclass, isEdited: true };
          }
        }
        return row;
      });

      const updatedList = effectiveGrid.filter((row) => row.isEdited && !row.isNew);
      if (updatedList.length > 0 && activeTournament) {
        const bulkRes = await fetch(`/api/tenant/${subdomain}/registrations/bulk-update`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            tournamentId: activeTournament.id,
            updatedList,
            insertedList: [],
            deletedIds: [],
          }),
        });
        if (!bulkRes.ok) {
          throw new Error('조 편성 변경사항 저장 중 오류가 발생했습니다.');
        }
      }

      const currentConfig = tenant?.overviewConfig || {};
      const updatedConfig = {
        ...currentConfig,
        bracketsPublished: publish,
        bracketsPublishedAt: publish ? new Date().toISOString() : (currentConfig.bracketsPublishedAt || null),
      };

      const res = await fetch(`/api/tenant/${subdomain}/overview`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ overviewConfig: updatedConfig }),
      });

      if (res.ok) {
        alert(publish
          ? '✅ 대진표 및 조 편성표(청년부·중년부·장년부 편성 포함)가 확정되어 홈페이지에 공식 공개되었습니다!'
          : '🔒 대진표 및 조 편성표가 홈페이지에서 비공개(준비중) 상태로 전환되었습니다.');
        await fetchInitialData();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || '상태 변경에 실패했습니다.');
      }
    } catch (e: any) {
      alert(e.message || '오류가 발생했습니다.');
    } finally {
      setBracketPublishing(false);
    }
  };

  const loadSectionData = async (tId: string) => {
    try {
      // Fetch registrations and rules-detail in parallel!
      const [regRes, ruleRes] = await Promise.all([
        fetch(`/api/tenant/${subdomain}/registrations?tournamentId=${tId}&_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/tenant/${subdomain}/rules-detail?tournamentId=${tId}&_t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      const [regData, ruleData] = await Promise.all([
        regRes.json(),
        ruleRes.json(),
      ]);

      setRawRegistrations(regData.registrations || []);
      
      const parsedRows: GridRow[] = (regData.registrations || []).map((r: any) => {
        let birth = '';
        let gender = '남자';
        let phone = '';
        let club = '미소속';
        let division = '윈드포일';
        let tshirtSize = 'M (100)';
        let subclass = '통합부';
        let vestAgreement = '';
        let paymentNoticeAgreement = '';
        let liabilityWaiver = '';
        let privacyConsent = '';
        let mediaConsent = '';

        try {
          if (r.formResponses) {
            const extra = typeof r.formResponses === 'string' ? JSON.parse(r.formResponses) : r.formResponses;
            birth = extra.birth || extra.birthDate || '';
            gender = extra.gender || '남자';
            // formResponses에 phone이 있으면 우선 사용
            phone = extra.phone || '';
            club = extra.club || '미소속';
            division = normalizeDivision(extra.division, gender);
            tshirtSize = normalizeTshirtSize(extra.tshirtSize);
            subclass = extra.subclass || extra.class || extra.category || extra.subDivision || '통합부';
            vestAgreement = extra.vestAgreement || '';
            paymentNoticeAgreement = extra.paymentNoticeAgreement || '';
            liabilityWaiver = extra.liabilityWaiver || '';
            privacyConsent = extra.privacyConsent || '';
            mediaConsent = extra.mediaConsent || '';
          }
        } catch (e) {
          // 기본값 사용
        }
        // player 서브객체에서 phone 보완 (formResponses에 없는 경우)
        if (!phone) phone = r.player?.phone || '';

        return {
          id: r.id,
          playerId: r.playerId,
          name: r.player.name,
          birth,
          gender,
          phone,
          club,
          division,
          tshirtSize,
          subclass,
          rawFormResponses: typeof r.formResponses === 'string' ? r.formResponses : JSON.stringify(r.formResponses || {}),
          vestAgreement,
          paymentNoticeAgreement,
          liabilityWaiver,
          privacyConsent,
          mediaConsent,
          paymentStatus: r.paymentStatus,
          status: r.status,
          createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('ko-KR') : '',
          rawCreatedAt: r.createdAt || '',
          bibNumber: r.bibNumber || '',
        };
      });

      setGridData(parsedRows);

      const validRuleTypes = new Set(['HEAD_TO_HEAD', 'MOST_BETTER_FINISHES', 'MOST_RECENT_RACE', 'DISCARD_DROP']);
      const fetchedRules: TieBreakerRule[] = Array.isArray(ruleData.rules) ? ruleData.rules : [];
      const isSailingRules =
        fetchedRules.length === 4 &&
        fetchedRules.every((r) => validRuleTypes.has(r.ruleType));
      const resolvedRules = isSailingRules ? fetchedRules : DEFAULT_TIE_BREAKER_RULES;
      setRules(resolvedRules);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`gentrophy_tie_breaker_rules_${subdomain}`, JSON.stringify(resolvedRules));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 엑셀 그리드 셀 수정 핸들러
  const handleCellChange = (rowId: string, field: keyof GridRow, value: any) => {
    setGridData(
      gridData.map((row) => {
        if (row.id === rowId) {
          const updated: GridRow = {
            ...row,
            [field]: value,
            isEdited: true, // 변경점 추적
          };
          if (field === 'gender' && row.division) {
            updated.division = normalizeDivision(row.division, value);
          }
          return updated;
        }
        return row;
      })
    );
  };

  // 엑셀식 새 행 삽입 (대량 등록용)
  const handleAddNewRow = () => {
    const now = new Date();
    const newRow: GridRow = {
      id: `temp-${Date.now()}`,
      playerId: '',
      name: '',
      birth: '',
      gender: '남자',
      phone: '',
      club: '',
      division: '윈드포일',
      tshirtSize: 'M (100)',
      vestAgreement: '네. 확인했습니다.',
      paymentNoticeAgreement: '네. 확인했습니다.',
      liabilityWaiver: '네. 동의합니다.',
      privacyConsent: '네. 동의합니다.',
      mediaConsent: '네. 동의합니다.',
      paymentStatus: 'APPROVED',
      status: 'APPROVED',
      isNew: true, // 신규 추가 행 추적
      createdAt: now.toLocaleString('ko-KR'),
      rawCreatedAt: now.toISOString(),
    };
    setGridData([newRow, ...gridData]);
  };

  // 참가자 행 삭제 실행 (확인 후 실제 DB 삭제)
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setIsDeleting(true);

    try {
      setGridData((prev) => prev.filter((row) => row.id !== target.id));

      if (!target.id.startsWith('temp-')) {
        if (!activeTournament) return;
        const res = await fetch(`/api/tenant/${subdomain}/registrations/bulk-update`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            tournamentId: activeTournament.id,
            updatedList: [],
            insertedList: [],
            deletedIds: [target.id],
          }),
        });

        if (res.ok) {
          alert(`'${target.name || '선택한 참가자'}' 님의 정보가 성공적으로 데이터베이스에서 삭제되었습니다.`);
          setDeletedIds((prev) => prev.filter((id) => id !== target.id));
          await loadSectionData(activeTournament.id);
        } else {
          const data = await res.json();
          alert(data.error || '삭제 실패');
        }
      }
    } catch (e: any) {
      alert('삭제 중 오류가 발생했습니다: ' + e.message);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // 행 삭제 요청 (확인 모달 열기)
  const handleDeleteRow = (rowId: string) => {
    const target = gridData.find((row) => row.id === rowId);
    if (target) {
      setDeleteTarget(target);
    } else {
      if (!confirm('정말 선택한 참가자를 목록에서 지우시겠습니까?')) return;
      setGridData((prev) => prev.filter((row) => row.id !== rowId));
    }
  };

  // 엑셀 그리드 일괄 저장 (벌크 업데이트)
  const handleSaveAllChanges = async () => {
    if (!activeTournament) return;

    let effectiveGrid = gridData;
    if (activeSection === 'brackets') {
      const targetPool = bracketStatusFilter === 'approved'
        ? gridData.filter(r => r.status === 'APPROVED')
        : gridData;
      const ageMap = computeAgeSplitSubclasses(targetPool);
      effectiveGrid = gridData.map((row) => {
        const autoSubclass = ageMap[row.id];
        const currentSub = row.subclass || '통합부';
        if (autoSubclass && !row.isEdited && (currentSub === '통합부' || currentSub === '청년부' || currentSub === '중년부' || currentSub === '장년부')) {
          if (currentSub !== autoSubclass) {
            return { ...row, subclass: autoSubclass, isEdited: true };
          }
        }
        return row;
      });
    }

    const updatedList = effectiveGrid.filter((row) => row.isEdited && !row.isNew);
    const insertedList = effectiveGrid.filter((row) => row.isNew && row.name.trim());

    if (updatedList.length === 0 && insertedList.length === 0 && deletedIds.length === 0) {
      alert('저장할 변경 사항이 없습니다.');
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch(`/api/tenant/${subdomain}/registrations/bulk-update`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tournamentId: activeTournament.id,
          updatedList,
          insertedList,
          deletedIds,
        }),
      });

      if (res.ok) {
        alert('모든 스프레드시트 변경 사항이 성공적으로 저장 및 일괄 처리되었습니다!');
        setDeletedIds([]);
        await loadSectionData(activeTournament.id);
      } else {
        const data = await res.json();
        alert(data.error || '저장 실패');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 동점자 룰 우선순위 제어 (월드세일링 RRS 부록 A8 기준)
  const persistTieBreakerRules = async (updatedRules: TieBreakerRule[]) => {
    setRules(updatedRules);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`gentrophy_tie_breaker_rules_${subdomain}`, JSON.stringify(updatedRules));
    }
    if (!activeTournament) return;
    try {
      await fetch(`/api/tenant/${subdomain}/rules-detail`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tournamentId: activeTournament.id,
          rulesList: updatedRules,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleMoveRule = async (index: number, direction: 'up' | 'down') => {
    const newRules = [...rules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newRules.length) return;

    const temp = newRules[index];
    newRules[index] = newRules[targetIndex];
    newRules[targetIndex] = temp;

    const updatedRules = newRules.map((rule, idx) => ({
      ...rule,
      priority: idx + 1,
    }));

    await persistTieBreakerRules(updatedRules);
  };

  const handleResetDefaultRules = async () => {
    await persistTieBreakerRules(DEFAULT_TIE_BREAKER_RULES);
    alert('✅ 월드세일링 RRS(부록 A8) 국제 표준 동점자 우선순위(1. 상대 전적 → 2. 상위 성적 횟수 비교 → 3. 가장 최근 레이스 성적 비교 → 4. 최하위 성적 제외 후 재산정)로 설정되었습니다.');
  };

  // 실시간 검색 및 필터링 기능 (이름/전화번호 통합 검색 및 카테고리 필터링/정렬)
  const filteredGridData = (() => {
    let result = [...gridData];

    // 1. 검색어 필터링
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter((row) => {
        const cleanPhone = row.phone.replace(/[^0-9]/g, '');
        const cleanQuery = query.replace(/[^0-9]/g, '');

        if (searchCategory === 'name') {
          return row.name.toLowerCase().includes(query);
        }
        if (searchCategory === 'phone') {
          return cleanPhone.includes(cleanQuery);
        }
        if (searchCategory === 'club') {
          return row.club.toLowerCase().includes(query);
        }
        if (searchCategory === 'division') {
          return row.division.toLowerCase().includes(query);
        }

        // 전체(all) 통합 검색: 이름, 전화번호(포맷제거), 소속, 종목 매칭
        return (
          row.name.toLowerCase().includes(query) ||
          cleanPhone.includes(cleanQuery) ||
          row.club.toLowerCase().includes(query) ||
          row.division.toLowerCase().includes(query)
        );
      });
    }

    // 2. 카테고리별 필터링
    if (filterSortCategory === 'paid') {
      result = result.filter((row) => row.paymentStatus === 'APPROVED');
    } else if (filterSortCategory === 'unpaid') {
      result = result.filter((row) => row.paymentStatus === 'PENDING');
    } else if (filterSortCategory === 'gender_group' && subFilterValue !== 'all') {
      result = result.filter((row) => row.gender === subFilterValue);
    } else if (filterSortCategory === 'club_group' && subFilterValue !== 'all') {
      result = result.filter((row) => row.club === subFilterValue);
    } else if (filterSortCategory === 'division_group' && subFilterValue !== 'all') {
      result = result.filter((row) => row.division === subFilterValue);
    } else if (filterSortCategory === 'tshirt_group' && subFilterValue !== 'all') {
      result = result.filter((row) => row.tshirtSize === subFilterValue);
    }

    // 3. 정렬 처리
    if (sortField) {
      result.sort((a, b) => {
        if (sortField === 'name') {
          const valA = (a.name || '').trim();
          const valB = (b.name || '').trim();
          if (!valA && !valB) return 0;
          if (!valA) return 1;
          if (!valB) return -1;
          const cmp = valA.localeCompare(valB, 'ko', { numeric: true });
          return sortOrder === 'asc' ? cmp : -cmp;
        }
        if (sortField === 'bibNumber') {
          const valA = (a.bibNumber || '').trim();
          const valB = (b.bibNumber || '').trim();
          if (!valA && !valB) return 0;
          if (!valA) return 1;
          if (!valB) return -1;
          const cmp = valA.localeCompare(valB, 'ko', { numeric: true });
          return sortOrder === 'asc' ? cmp : -cmp;
        }
        if (sortField === 'birth') {
          const valA = (a.birth || '').trim();
          const valB = (b.birth || '').trim();
          if (!valA && !valB) return 0;
          if (!valA) return 1;
          if (!valB) return -1;
          const cmp = valA.localeCompare(valB, 'ko', { numeric: true });
          return sortOrder === 'asc' ? cmp : -cmp;
        }
        if (sortField === 'createdAt') {
          const timeA = a.rawCreatedAt ? new Date(a.rawCreatedAt).getTime() : 0;
          const timeB = b.rawCreatedAt ? new Date(b.rawCreatedAt).getTime() : 0;
          if (!timeA && !timeB) {
            const strA = (a.createdAt || '').trim();
            const strB = (b.createdAt || '').trim();
            if (!strA && !strB) return 0;
            if (!strA) return 1;
            if (!strB) return -1;
            const cmp = strA.localeCompare(strB, 'ko', { numeric: true });
            return sortOrder === 'asc' ? cmp : -cmp;
          }
          if (!timeA) return 1;
          if (!timeB) return -1;
          return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        }
        return 0;
      });
    } else if (filterSortCategory === 'birth_asc') {
      // 생년월일은 문자열이므로 오름차순 정렬 (비어있으면 뒤로 보냄)
      result.sort((a, b) => {
        if (!a.birth) return 1;
        if (!b.birth) return -1;
        return a.birth.localeCompare(b.birth);
      });
    } else if (filterSortCategory === 'gender_group') {
      result.sort((a, b) => (a.gender || '').localeCompare(b.gender || ''));
    } else if (filterSortCategory === 'club_group') {
      result.sort((a, b) => (a.club || '').localeCompare(b.club || ''));
    } else if (filterSortCategory === 'division_group') {
      result.sort((a, b) => (a.division || '').localeCompare(b.division || ''));
    } else if (filterSortCategory === 'tshirt_group') {
      result.sort((a, b) => (a.tshirtSize || '').localeCompare(b.tshirtSize || ''));
    }

    return result;
  })();

  // 2) 인증 후 데이터 로딩 중: null 반환으로 깜빡임 방지
  if (isAuthenticated && !tenant) {
    return null;
  }

  const themeStyles = {
    '--theme-primary': (tenant?.primaryColor) || '#1f6f8b',
    '--theme-primary-hover': '#154e62',
    '--theme-primary-rgb': '31, 111, 139',
    '--theme-gold': '#c5a880',
  } as React.CSSProperties;

  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <RefreshCw className="animate-spin" size={36} style={{ color: '#c5a880' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top right, #0f172a 0%, #020617 100%)',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '20px'
      }}>
        <div style={{
          background: 'rgba(30, 41, 59, 0.45)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '45px 40px',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #c5a880 0%, #b39366 100%)',
            borderRadius: '16px',
            marginBottom: '24px',
            boxShadow: '0 8px 20px -6px rgba(197, 168, 128, 0.5)'
          }}>
            <Settings size={28} color="#1e293b" />
          </div>
          
          <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: 'white', marginBottom: '8px', letterSpacing: '-0.5px' }}>
            주최자 ERP 보안 게이트
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '32px', lineHeight: '1.5' }}>
            {tenant?.name || '대회 관리 시스템'}<br />
            주최자 권한 인증을 진행합니다.
          </p>

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ position: 'relative', textAlign: 'left' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#c5a880', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                비밀번호 입력
              </label>
              <input
                type="password"
                placeholder="비밀번호 6자리를 입력하세요"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  color: 'white',
                  fontSize: '1rem',
                  outline: 'none',
                  textAlign: 'center',
                  letterSpacing: '0.25em',
                  transition: 'border-color 0.2s'
                }}
                autoFocus
              />
            </div>

            {authError && (
              <p style={{ color: '#f87171', fontSize: '0.8rem', fontWeight: '600', margin: '4px 0 0 0' }}>
                ⚠️ {authError}
              </p>
            )}

            <button
              type="submit"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #c5a880 0%, #b39366 100%)',
                color: '#0f172a',
                border: 'none',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '0.95rem',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'transform 0.1s, opacity 0.2s',
                marginTop: '10px',
                boxShadow: '0 4px 12px rgba(197, 168, 128, 0.2)'
              }}
            >
              대시보드 잠금 해제
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={themeStyles} className={`grid-dashboard ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      
      {/* 0. 모바일 전용 헤더 & 드로어 메뉴 */}
      <div className="mobile-dashboard-header">
        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(true)}
          style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
        >
          <Menu size={24} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={18} style={{ color: 'var(--theme-gold)' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: '800', color: 'white', margin: 0, fontFamily: 'var(--font-title)' }}>
            Wind <span style={{ color: 'var(--theme-gold)' }}>ERP</span>
          </h2>
        </div>
        <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--theme-gold)' }}>
          {activeSection === 'applicants' ? '참가자' : 
           activeSection === 'brackets' ? '대진/조편성' :
           activeSection === 'tie-breaker' ? '룰설정' : '공시서'}
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Settings size={22} style={{ color: 'var(--theme-gold)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white', fontFamily: 'var(--font-title)', margin: 0 }}>
                  Wind <span style={{ color: 'var(--theme-gold)' }}>ERP</span>
                </h2>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { id: 'applicants', label: '참가자관리', icon: Users },
                { id: 'brackets', label: '대진표 및 조 편성표', icon: Layers },
                { id: 'tie-breaker', label: '동점자 순위 규칙 설정', icon: Award },
                { id: 'notice', label: '개최공시서 업로드', icon: Upload },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id as any);
                      setIsMobileMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 18px',
                      background: active ? 'rgba(255,255,255,0.06)' : 'none',
                      color: active ? 'var(--theme-primary)' : 'var(--text-muted)',
                      border: 'none',
                      borderLeft: active ? `4px solid var(--theme-primary)` : '4px solid transparent',
                      borderRadius: '0 8px 8px 0',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '0.95rem',
                      transition: 'var(--transition-smooth)',
                    }}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 'auto', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>대회 기관:</span>
              <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{tenant.name}</span>
            </div>
          </div>
        </div>
      )}

      {/* 1. 사이드바 */}
      <aside
        style={{
          background: 'rgba(2, 6, 23, 0.95)',
          borderRight: isSidebarOpen ? '1px solid var(--border-color)' : 'none',
          padding: '30px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={22} style={{ color: 'var(--theme-gold)' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white', fontFamily: 'var(--font-title)', margin: 0 }}>
              Wind <span style={{ color: 'var(--theme-gold)' }}>ERP</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            title="사이드바 메뉴 닫기"
            aria-label="사이드바 메뉴 닫기"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Menu size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { id: 'applicants', label: '참가자관리', icon: Users },
            { id: 'brackets', label: '대진표 및 조 편성표', icon: Layers },
            { id: 'tie-breaker', label: '동점자 순위 규칙 설정', icon: Award },
            { id: 'notice', label: '개최공시서 업로드', icon: Upload },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 18px',
                  background: active ? 'rgba(255,255,255,0.06)' : 'none',
                  color: active ? 'var(--theme-primary)' : 'var(--text-muted)',
                  border: 'none',
                  borderLeft: active ? `4px solid var(--theme-primary)` : '4px solid transparent',
                  borderRadius: '0 8px 8px 0',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  transition: 'var(--transition-smooth)',
                }}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 'auto', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>대회 기관:</span>
          <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{tenant.name}</span>
        </div>
      </aside>

      {/* 2. 대시보드 메인 */}
      <main style={{ padding: '40px', overflowY: 'auto' }}>
        
        <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={toggleSidebar}
              title={isSidebarOpen ? "사이드바 메뉴 닫기" : "사이드바 메뉴 열기"}
              aria-label={isSidebarOpen ? "사이드바 메뉴 닫기" : "사이드바 메뉴 열기"}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '9px 12px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.88rem',
                fontWeight: '600',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.borderColor = 'var(--theme-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }}
            >
              <Menu size={20} style={{ color: 'var(--theme-gold)' }} />
              <span className="hide-on-mobile" style={{ color: 'var(--text-main)' }}>
                {isSidebarOpen ? '메뉴 닫기' : '메뉴 열기'}
              </span>
            </button>
            <div>
              <h1 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.9rem)', fontWeight: '800', margin: 0, marginBottom: '4px' }}>
                {activeSection === 'applicants' ? '참가자관리' : 
                 activeSection === 'brackets' ? '대진표 및 조 편성표' :
                 activeSection === 'tie-breaker' ? 'Tie-breaker 가중치 제어기' : '개최공시서 업로드'}
              </h1>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>{activeTournament.title}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleLogout}
              style={{
                fontSize: '0.85rem',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              로그아웃
            </button>
            <a
              href={typeof window !== 'undefined' && window.location.pathname.startsWith('/tenant/') ? `/tenant/${subdomain}` : '/'}
              className="btn-secondary"
              style={{ fontSize: '0.9rem', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px', background: 'white' }}
            >
              <ExternalLink size={16} /> 대회 홈페이지 가기
            </a>
            <a
              href={`/api/tenant/${subdomain}/registrations/export?tournamentId=${activeTournament.id}`}
              className="btn-secondary"
              style={{ fontSize: '0.9rem', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={16} /> 엑셀 내보내기 (Export)
            </a>
          </div>
        </header>

        {/* SECTION A: 참가자 엑셀 스프레드시트 관리 */}
        {activeSection === 'applicants' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* 그리드 상단 툴바 (검색, 행추가, 일괄저장) */}
            <div className="dashboard-toolbar" style={{ gap: '16px' }}>
              
              {/* 실시간 필터링 검색 바 + 카테고리 셀렉터 */}
              <div className="dashboard-search-container" style={{ gap: '10px', flexWrap: 'wrap' }}>
                <select
                  value={searchCategory}
                  onChange={(e) => {
                    setSearchCategory(e.target.value as any);
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'white',
                    color: 'var(--text-main)',
                    fontWeight: '700',
                    outline: 'none',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <option value="all">전체 (통합 검색)</option>
                  <option value="name">성명 검색</option>
                  <option value="phone">전화번호 검색</option>
                  <option value="club">소속 클럽 검색</option>
                  <option value="division">참가 종목 검색</option>
                </select>
 
                <div className="search-input-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 16px', width: '300px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <Search size={18} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder={
                      searchCategory === 'name' ? '성명 검색어 입력...' :
                      searchCategory === 'phone' ? '전화번호 검색어 입력...' :
                      searchCategory === 'club' ? '클럽명 검색어 입력...' :
                      searchCategory === 'division' ? '종목 검색어 입력...' :
                      '검색어를 입력하세요...'
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--text-main)',
                      outline: 'none',
                      width: '100%',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                {/* 카테고리별 필터 및 정렬 선택기 */}
                <select
                  value={filterSortCategory}
                  onChange={(e) => {
                    setFilterSortCategory(e.target.value);
                    setSubFilterValue('all');
                    setSortField(null);
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'white',
                    color: 'var(--theme-primary)',
                    fontWeight: '700',
                    outline: 'none',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <option value="all">전체 필터/정렬</option>
                  <option value="birth_asc">생년월일순 정렬</option>
                  <option value="gender_group">성별순 (정렬/필터)</option>
                  <option value="club_group">소속협회순 (정렬/필터)</option>
                  <option value="division_group">참가종목순 (정렬/필터)</option>
                  <option value="tshirt_group">티셔츠 사이즈별 (정렬/필터)</option>
                  <option value="paid">결제 완료자 보기</option>
                  <option value="unpaid">미결제자 보기</option>
                </select>

                {/* 2차 상세 필터 선택기 */}
                {['gender_group', 'club_group', 'division_group', 'tshirt_group'].includes(filterSortCategory) && (
                  <select
                    value={subFilterValue}
                    onChange={(e) => setSubFilterValue(e.target.value)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      border: '1px solid var(--theme-primary)',
                      background: 'var(--theme-primary)',
                      color: 'white',
                      fontWeight: '700',
                      outline: 'none',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                  >
                    <option value="all" style={{ background: 'white', color: 'black' }}>전체 보기</option>
                    {filterSortCategory === 'gender_group' && (
                      <>
                        <option value="남자" style={{ background: 'white', color: 'black' }}>남자</option>
                        <option value="여자" style={{ background: 'white', color: 'black' }}>여자</option>
                      </>
                    )}
                    {filterSortCategory === 'club_group' && (
                      Array.from(new Set(gridData.map(r => r.club).filter(Boolean))).map(club => (
                        <option key={club} value={club} style={{ background: 'white', color: 'black' }}>{club}</option>
                      ))
                    )}
                    {filterSortCategory === 'division_group' && (
                      Array.from(new Set(gridData.map(r => r.division).filter(Boolean))).map(div => (
                        <option key={div} value={div} style={{ background: 'white', color: 'black' }}>{div}</option>
                      ))
                    )}
                    {filterSortCategory === 'tshirt_group' && (
                      Array.from(new Set(gridData.map(r => r.tshirtSize).filter(Boolean))).map(size => (
                        <option key={size} value={size} style={{ background: 'white', color: 'black' }}>{size}</option>
                      ))
                    )}
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn-secondary"
                  onClick={handleAddNewRow}
                  style={{ fontSize: '0.9rem', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} /> 행 추가 (Row Insert)
                </button>
                
                <button
                  className="btn-primary"
                  onClick={handleSaveAllChanges}
                  disabled={isSaving}
                  style={{ fontSize: '0.9rem', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={16} /> {isSaving ? '일괄 저장 중...' : '변경 사항 일괄 저장'}
                </button>
              </div>
            </div>

            {/* 스프레드시트 형태의 그리드 테이블 */}
            <div className="glass-panel" style={{ padding: '8px', background: 'white' }}>
              <div className="premium-table-container" style={{ overflowX: 'auto', width: '100%', display: 'block' }}>
                <table className="premium-table" style={{ minWidth: '1200px', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '60px', textAlign: 'center' }}>순번</th>
                      <th style={{ width: '65px', textAlign: 'center' }}>상태</th>
                      <th
                        onClick={() => handleHeaderSort('name')}
                        style={{ minWidth: '90px', cursor: 'pointer', userSelect: 'none' }}
                        title="클릭하여 성명순 정렬"
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: sortField === 'name' ? 'var(--theme-primary)' : undefined }}>
                          성명
                          {sortField === 'name' ? (
                            sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                          ) : (
                            <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>↕</span>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleHeaderSort('bibNumber')}
                        style={{ minWidth: '90px', cursor: 'pointer', userSelect: 'none' }}
                        title="클릭하여 배번티번호순 정렬"
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: sortField === 'bibNumber' ? 'var(--theme-primary)' : undefined }}>
                          배번티번호
                          {sortField === 'bibNumber' ? (
                            sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                          ) : (
                            <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>↕</span>
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleHeaderSort('birth')}
                        style={{ minWidth: '110px', cursor: 'pointer', userSelect: 'none' }}
                        title="클릭하여 생년월일순 정렬"
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: sortField === 'birth' ? 'var(--theme-primary)' : undefined }}>
                          생년월일
                          {sortField === 'birth' ? (
                            sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                          ) : (
                            <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>↕</span>
                          )}
                        </div>
                      </th>
                      <th style={{ minWidth: '70px' }}>성별</th>
                      <th style={{ minWidth: '130px' }}>전화번호</th>
                      <th style={{ minWidth: '130px' }}>소속협회 / 클럽</th>
                      <th style={{ minWidth: '110px' }}>참가종목</th>
                      <th style={{ minWidth: '100px' }}>티셔츠 사이즈</th>
                      <th style={{ minWidth: '90px', textAlign: 'center', fontSize: '0.8rem' }}>8.조끼수령</th>
                      <th style={{ minWidth: '90px', textAlign: 'center', fontSize: '0.8rem' }}>9.입금안내</th>
                      <th style={{ minWidth: '80px', textAlign: 'center', fontSize: '0.8rem' }}>10.면책동의</th>
                      <th style={{ minWidth: '80px', textAlign: 'center', fontSize: '0.8rem' }}>11.개인정보</th>
                      <th style={{ minWidth: '80px', textAlign: 'center', fontSize: '0.8rem' }}>12.초상권</th>
                      <th style={{ minWidth: '80px' }}>결제 여부</th>
                      <th style={{ minWidth: '90px', textAlign: 'center' }} title="체크 시 참가 확정되어 ERP 조 편성 및 심판 시뮬레이션 대상에 포함됩니다 (홈페이지에는 즉시 공개되지 않음)">참가확정</th>
                      <th
                        onClick={() => handleHeaderSort('createdAt')}
                        style={{ minWidth: '150px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                        title="클릭하여 신청일시순 정렬"
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: sortField === 'createdAt' ? 'var(--theme-primary)' : undefined }}>
                          신청일시
                          {sortField === 'createdAt' ? (
                            sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                          ) : (
                            <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>↕</span>
                          )}
                        </div>
                      </th>
                      <th style={{ width: '90px', textAlign: 'center' }}>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGridData.map((row, idx) => (
                      <tr key={row.id}>
                        {/* 순번 */}
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: '700', fontSize: '0.9rem' }}>
                          {idx + 1}
                        </td>
                        {/* 편집 상태 인디케이터 */}
                        <td style={{ textAlign: 'center' }}>
                          {row.isNew ? (
                            <span style={{ color: '#10B981', fontSize: '0.75rem', fontWeight: 'bold' }}>NEW</span>
                          ) : row.isEdited ? (
                            <span style={{ color: '#F59E0B', fontSize: '0.75rem', fontWeight: 'bold' }}>EDIT</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>
                          )}
                        </td>

                        {/* 성명 */}
                        <td style={{ padding: '8px 16px' }}>
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleCellChange(row.id, 'name', e.target.value)}
                            style={{
                              width: '100%',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-main)',
                              outline: 'none',
                              fontSize: '0.95rem',
                              fontWeight: '600'
                            }}
                            placeholder="성명 기입"
                          />
                        </td>

                        {/* 배번티번호 */}
                        <td style={{ padding: '8px 16px' }}>
                          <input
                            type="text"
                            value={row.bibNumber || ''}
                            onChange={(e) => handleCellChange(row.id, 'bibNumber', e.target.value)}
                            style={{
                              width: '100%',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-main)',
                              outline: 'none',
                              fontSize: '0.95rem',
                              fontWeight: '600'
                            }}
                            placeholder="배번 기입"
                          />
                        </td>

                        {/* 생년월일 */}
                        <td style={{ padding: '8px 16px' }}>
                          <input
                            type="text"
                            value={row.birth}
                            onChange={(e) => handleCellChange(row.id, 'birth', e.target.value)}
                            style={{
                              width: '100%',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-main)',
                              outline: 'none',
                              fontSize: '0.95rem'
                            }}
                            placeholder="예) 19901024"
                          />
                        </td>

                        {/* 성별 */}
                        <td style={{ padding: '8px' }}>
                          <select
                            value={row.gender}
                            onChange={(e) => handleCellChange(row.id, 'gender', e.target.value)}
                            style={{
                              width: '100%',
                              background: 'white',
                              border: 'none',
                              color: 'var(--text-main)',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="남자">남자</option>
                            <option value="여자">여자</option>
                          </select>
                        </td>

                        {/* 전화번호 */}
                        <td style={{ padding: '8px 16px' }}>
                          <input
                            type="text"
                            value={row.phone}
                            onChange={(e) => handleCellChange(row.id, 'phone', e.target.value)}
                            style={{
                              width: '100%',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-main)',
                              outline: 'none',
                              fontSize: '0.95rem'
                            }}
                            placeholder="010XXXXXXXX"
                          />
                        </td>

                        {/* 소속 */}
                        <td style={{ padding: '8px 16px' }}>
                          <input
                            type="text"
                            value={row.club}
                            onChange={(e) => handleCellChange(row.id, 'club', e.target.value)}
                            style={{
                              width: '100%',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-main)',
                              outline: 'none',
                              fontSize: '0.95rem'
                            }}
                            placeholder="클럽명 기입"
                          />
                        </td>

                        {/* 참가종목 */}
                        <td style={{ padding: '8px' }}>
                          <select
                            value={row.division}
                            onChange={(e) => handleCellChange(row.id, 'division', e.target.value)}
                            style={{
                              width: '100%',
                              background: 'white',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '4px 6px',
                              color: 'var(--text-main)',
                              outline: 'none',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              fontWeight: '600'
                            }}
                          >
                            {!DIVISION_OPTIONS.includes(row.division) && row.division && (
                              <option value={row.division}>{row.division}</option>
                            )}
                            {DIVISION_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </td>

                        {/* 티셔츠 사이즈 */}
                        <td style={{ padding: '8px' }}>
                          <select
                            value={row.tshirtSize}
                            onChange={(e) => handleCellChange(row.id, 'tshirtSize', e.target.value)}
                            style={{
                              width: '100%',
                              background: 'white',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '4px 6px',
                              color: 'var(--text-main)',
                              outline: 'none',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              fontWeight: '600'
                            }}
                          >
                            {!TSHIRT_OPTIONS.includes(row.tshirtSize) && row.tshirtSize && (
                              <option value={row.tshirtSize}>{row.tshirtSize}</option>
                            )}
                            {TSHIRT_OPTIONS.map((size) => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                          </select>
                        </td>

                        {/* 8. 조끼수령 동의 */}
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <span style={{ fontSize: '0.82rem', color: row.vestAgreement ? '#10B981' : '#EF4444', fontWeight: '600' }}>
                            {row.vestAgreement || '미동의'}
                          </span>
                        </td>

                        {/* 9. 입금안내 동의 */}
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <span style={{ fontSize: '0.82rem', color: row.paymentNoticeAgreement ? '#10B981' : '#EF4444', fontWeight: '600' }}>
                            {row.paymentNoticeAgreement || '미동의'}
                          </span>
                        </td>

                        {/* 10. 면책 동의 */}
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <span style={{ fontSize: '0.82rem', color: row.liabilityWaiver ? '#10B981' : '#EF4444', fontWeight: '600' }}>
                            {row.liabilityWaiver ? '✓' : '✗'}
                          </span>
                        </td>

                        {/* 11. 개인정보 동의 */}
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <span style={{ fontSize: '0.82rem', color: row.privacyConsent ? '#10B981' : '#EF4444', fontWeight: '600' }}>
                            {row.privacyConsent ? '✓' : '✗'}
                          </span>
                        </td>

                        {/* 12. 초상권 동의 */}
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <span style={{ fontSize: '0.82rem', color: row.mediaConsent ? '#10B981' : '#EF4444', fontWeight: '600' }}>
                            {row.mediaConsent ? '✓' : '✗'}
                          </span>
                        </td>

                        {/* 결제 상태 */}
                        <td style={{ padding: '8px' }}>
                          <select
                            value={row.paymentStatus}
                            onChange={(e) => handleCellChange(row.id, 'paymentStatus', e.target.value)}
                            style={{
                              width: '100%',
                              background: 'white',
                              border: 'none',
                              color: row.paymentStatus === 'APPROVED' ? '#10B981' : '#EF4444',
                              fontWeight: '600',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="PENDING" style={{ color: '#EF4444' }}>미결제</option>
                            <option value="APPROVED" style={{ color: '#10B981' }}>결제완료</option>
                          </select>
                        </td>

                        {/* 참가확정 체크박스 (홈페이지에는 즉시 노출되지 않으며 ERP 조편성 및 심판 시뮬레이션에 반영됨) */}
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <input
                            type="checkbox"
                            checked={row.status === 'APPROVED'}
                            onChange={(e) => handleCellChange(row.id, 'status', e.target.checked ? 'APPROVED' : 'PENDING')}
                            title="참가확정 체크 (홈페이지에는 공개되지 않으며 대진표 조편성 및 심판 시뮬레이션에만 사용됩니다)"
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                              accentColor: 'var(--theme-primary)',
                              verticalAlign: 'middle'
                            }}
                          />
                        </td>

                        {/* 신청일시 */}
                        <td style={{ padding: '8px 16px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {row.createdAt || '-'}
                        </td>

                        {/* 작업 (상세보기 및 삭제) */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              className="btn-secondary"
                              onClick={() => setSelectedReg(row)}
                              style={{
                                padding: '6px',
                                borderRadius: '8px',
                                color: 'var(--theme-primary)',
                                borderColor: 'rgba(31, 111, 139, 0.1)',
                                background: 'none'
                              }}
                              title="신청서 원본 상세 보기"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              className="btn-secondary"
                              onClick={() => handleDeleteRow(row.id)}
                              style={{
                                padding: '6px',
                                borderRadius: '8px',
                                color: '#EF4444',
                                borderColor: 'rgba(239, 68, 68, 0.1)',
                                background: 'none'
                              }}
                              title="삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECTION A-2: 대진표 및 조 편성표 관리 (원본 신청서 보호 & 홈페이지 확정 공개 제어) */}
        {activeSection === 'brackets' && (() => {
          const isPublished = !!tenant?.overviewConfig?.bracketsPublished;
          const publishedAt = tenant?.overviewConfig?.bracketsPublishedAt;
          const allValidList = gridData;
          const approvedList = gridData.filter(r => r.status === 'APPROVED');
          const pendingList = gridData.filter(r => r.status !== 'APPROVED');
          const targetBracketList = bracketStatusFilter === 'approved' ? approvedList : allValidList;

          const formatMaskedBirth = (birthStr?: string): string => {
            if (!birthStr) return '-';
            const clean = String(birthStr).trim().replace(/[^0-9]/g, '');
            if (clean.length === 8) return `${clean.substring(0, 4)}.${clean.substring(4, 6)}.**`;
            if (clean.length === 6) return `${clean.substring(0, 2)}.${clean.substring(2, 4)}.**`;
            return birthStr;
          };

          // 혼합오픈 & 펀&포뮬러 남자부 생년월일 기준 1/3 균등분할(청년부·중년부·장년부) 자동 매핑 (참가확정 전 신청자 포함)
          const ageSubclassMap = computeAgeSplitSubclasses(targetBracketList);

          const parsedPlayers = targetBracketList.map(r => {
            const rootDivision = getRootDivisionName(r.division);

            let genderGroup = r.gender || '남자';
            if (!genderGroup.includes('부')) genderGroup = `${genderGroup}부`;

            const rawSub = r.subclass || '통합부';
            const autoSub = ageSubclassMap[r.id];
            // 수동으로 별도 조(A조, 1조 등)를 지정하지 않은 경우 생년월일 1/3 균등분할(청년부/중년부/장년부) 자동 적용
            const effectiveSubclass =
              autoSub && (!r.isEdited ? (rawSub === '통합부' || rawSub === '청년부' || rawSub === '중년부' || rawSub === '장년부') : rawSub === '통합부')
                ? autoSub
                : rawSub;

            return {
              ...r,
              rootDivision,
              genderGroup,
              subclass: effectiveSubclass,
              isAutoAgeSplit: !!autoSub && (effectiveSubclass === '청년부' || effectiveSubclass === '중년부' || effectiveSubclass === '장년부'),
            };
          });

          const filteredForView = selectedBracketDivision === '전체'
            ? parsedPlayers
            : parsedPlayers.filter(p => p.rootDivision === selectedBracketDivision);

          const grouped: Record<string, Record<string, Record<string, typeof parsedPlayers>>> = {};
          filteredForView.forEach(p => {
            if (!grouped[p.rootDivision]) grouped[p.rootDivision] = {};
            if (!grouped[p.rootDivision][p.genderGroup]) grouped[p.rootDivision][p.genderGroup] = {};
            if (!grouped[p.rootDivision][p.genderGroup][p.subclass]) grouped[p.rootDivision][p.genderGroup][p.subclass] = [];
            grouped[p.rootDivision][p.genderGroup][p.subclass].push(p);
          });

          const divisionOrder = ['윈드포일', '윙포일', '혼합오픈', '펀&포뮬러'];
          const subclassOrder = ['청년부', '중년부', '장년부', '통합부', 'A조', 'B조', 'C조', 'D조', '1조', '2조', '3조', '4조', '마스터즈'];

          const sortedDivisions = Object.keys(grouped).sort((a, b) => {
            const idxA = divisionOrder.indexOf(a);
            const idxB = divisionOrder.indexOf(b);
            if (idxA === -1 && idxB === -1) return a.localeCompare(b);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });

          const hasUnsavedBracketEdits = gridData.some(r => r.isEdited && !r.isNew);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
              {/* 1. 상단 확정 및 홈페이지 공개 제어 배너 */}
              <div
                className="glass-panel"
                style={{
                  background: 'white',
                  padding: '24px 28px',
                  borderTop: isPublished ? '4px solid #10b981' : '4px solid #f59e0b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '20px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '0.82rem',
                        fontWeight: '800',
                        background: isPublished ? '#ecfdf5' : '#fffbeb',
                        color: isPublished ? '#059669' : '#d97706',
                        border: isPublished ? '1px solid #a7f3d0' : '1px solid #fde68a'
                      }}
                    >
                      {isPublished ? <CheckCircle2 size={15} /> : <Clock size={15} />}
                      {isPublished ? '홈페이지 공개 중 (확정 완료)' : '홈페이지 비공개 (시뮬레이션 전용 / 운영진 확정 대기)'}
                    </span>
                    {publishedAt && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                        마지막 확정 일시: {new Date(publishedAt).toLocaleString('ko-KR')}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)', margin: '4px 0 0 0' }}>
                    대진표 및 조 편성표 관리 (참가확정 전 사전 조편성 가능)
                  </h3>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                    • <strong>참가확정 전(입금 대기 포함) 상태에서도</strong> 전체 신청자(총 <strong>{allValidList.length}명</strong>: 확정 {approvedList.length}명 / 확정전 {pendingList.length}명)를 대상으로 대진표 및 조 편성이 가능합니다.<br />
                    • <strong>혼합오픈 · 펀&amp;포뮬러(남자부)</strong>는 참가자 <strong>생년월일 기준 1/3 균등분할(청년부 · 중년부 · 장년부)</strong>이 자동 적용됩니다.<br />
                    • 조 편성 확인 후 우측 <strong>[조/배번 변경사항 임시저장]</strong>으로 사전 저장하거나, <strong>[대진표 확정 및 홈페이지 공개]</strong> 버튼으로 홈페이지에 공개할 수 있습니다.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleAutoAssignAgeSubclasses}
                    type="button"
                    style={{
                      padding: '12px 16px',
                      fontSize: '0.86rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '10px',
                      border: '1px solid #c4b5fd',
                      background: '#f5f3ff',
                      color: '#6d28d9',
                      cursor: 'pointer'
                    }}
                    title="혼합오픈 및 펀&포뮬러 남자부 참가자를 생년월일 1/3 균등분할 기준으로 청년부·중년부·장년부로 재편성합니다."
                  >
                    🎂 생년월일(1/3) 청년·중년·장년부 재편성
                  </button>

                  <button
                    onClick={handleSaveAllChanges}
                    disabled={isSaving}
                    className="btn-secondary"
                    style={{
                      padding: '12px 18px',
                      fontSize: '0.9rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderColor: hasUnsavedBracketEdits ? 'var(--theme-primary)' : 'var(--border-color)',
                      color: hasUnsavedBracketEdits ? 'var(--theme-primary)' : 'var(--text-main)',
                      background: hasUnsavedBracketEdits ? '#f0f9ff' : '#ffffff'
                    }}
                  >
                    <Save size={16} />
                    {isSaving ? '저장 중...' : '조/배번 변경사항 임시저장'}
                  </button>

                  {isPublished ? (
                    <>
                      <button
                        onClick={() => handleToggleBracketsPublish(true)}
                        disabled={bracketPublishing}
                        className="btn-primary"
                        style={{
                          padding: '12px 20px',
                          fontSize: '0.9rem',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: '#059669'
                        }}
                      >
                        <CheckCircle2 size={16} />
                        {bracketPublishing ? '처리 중...' : '변경사항 재확정 및 업데이트'}
                      </button>
                      <button
                        onClick={() => handleToggleBracketsPublish(false)}
                        disabled={bracketPublishing}
                        style={{
                          padding: '12px 18px',
                          fontSize: '0.88rem',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#fff1f2',
                          color: '#e11d48',
                          border: '1px solid #fecdd3',
                          borderRadius: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        홈페이지 비공개로 전환
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleToggleBracketsPublish(true)}
                      disabled={bracketPublishing}
                      className="btn-primary"
                      style={{
                        padding: '14px 24px',
                        fontSize: '0.95rem',
                        fontWeight: '900',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        boxShadow: '0 6px 16px rgba(2, 132, 199, 0.25)'
                      }}
                    >
                      <CheckCircle2 size={18} />
                      {bracketPublishing ? '확정 처리 중...' : '대진표 확정 및 홈페이지 공개'}
                    </button>
                  )}
                </div>
              </div>

              {/* 2. 종목별 필터 및 대상자(참가확정 전 포함 / 확정자만) 토글 바 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
                  {['전체', '윈드포일', '윙포일', '혼합오픈', '펀&포뮬러'].map(divTab => {
                    const active = selectedBracketDivision === divTab;
                    const count = divTab === '전체'
                      ? parsedPlayers.length
                      : parsedPlayers.filter(p => p.rootDivision === divTab).length;
                    return (
                      <button
                        key={divTab}
                        onClick={() => setSelectedBracketDivision(divTab)}
                        style={{
                          padding: '10px 18px',
                          borderRadius: '24px',
                          background: active ? 'var(--theme-primary)' : '#ffffff',
                          border: active ? 'none' : '1px solid var(--border-color)',
                          color: active ? '#ffffff' : 'var(--text-main)',
                          fontSize: '0.88rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                        }}
                      >
                        <span>{divTab}</span>
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          background: active ? 'rgba(255,255,255,0.22)' : '#f1f5f9',
                          color: active ? 'white' : 'var(--text-muted)'
                        }}>
                          {count}명
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 대상 범위 선택: 전체 신청자(참가확정 전 포함) vs 참가확정자만 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <button
                      type="button"
                      onClick={() => setBracketStatusFilter('all')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '0.82rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        background: bracketStatusFilter === 'all' ? '#ffffff' : 'transparent',
                        color: bracketStatusFilter === 'all' ? 'var(--theme-primary)' : '#64748b',
                        boxShadow: bracketStatusFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                      }}
                    >
                      전체 신청자 ({allValidList.length}명 · 확정전 포함)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBracketStatusFilter('approved')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '0.82rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        background: bracketStatusFilter === 'approved' ? '#ffffff' : 'transparent',
                        color: bracketStatusFilter === 'approved' ? '#059669' : '#64748b',
                        boxShadow: bracketStatusFilter === 'approved' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                      }}
                    >
                      참가확정자만 ({approvedList.length}명)
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. 대진표 및 조 편성표 미리보기 & 조 배정 카드 뷰 */}
              {targetBracketList.length === 0 ? (
                <div className="glass-panel" style={{ background: 'white', padding: '60px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 8px 0' }}>
                    {bracketStatusFilter === 'approved'
                      ? `현재 [참가확정] 체크된 참가 선수가 없습니다. (전체 신청자: ${allValidList.length}명)`
                      : '현재 등록된 참가 신청자가 없습니다.'}
                  </p>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0 0 18px 0' }}>
                    {bracketStatusFilter === 'approved'
                      ? '참가확정 전이라도 [전체 신청자 (확정전 포함)] 보기로 전환하면 즉시 대진표 조 편성이 가능합니다.'
                      : '[참가자관리] 메뉴에서 선수를 추가하거나 참가 신청이 접수되면 이곳에서 조 편성을 진행할 수 있습니다.'}
                  </p>
                  {bracketStatusFilter === 'approved' && allValidList.length > 0 ? (
                    <button
                      onClick={() => setBracketStatusFilter('all')}
                      className="btn-primary"
                      style={{ padding: '10px 20px', fontSize: '0.88rem' }}
                    >
                      참가확정 전 신청자 포함하여 조편성하기 ({allValidList.length}명)
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveSection('applicants')}
                      className="btn-primary"
                      style={{ padding: '10px 20px', fontSize: '0.88rem' }}
                    >
                      참가자관리 메뉴로 이동
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                  {sortedDivisions.map(rootDiv => {
                    const genderGroup = grouped[rootDiv] || {};
                    const isAgeSplitDiv = rootDiv === '혼합오픈' || rootDiv === '펀&포뮬러';
                    return (
                      <div key={rootDiv} className="glass-panel" style={{ background: 'white', padding: '28px', borderTop: '4px solid var(--theme-primary)', borderRadius: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '22px', borderBottom: '2px solid var(--theme-primary)', paddingBottom: '10px' }}>
                          <h3 style={{ fontSize: '1.35rem', fontWeight: '900', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.5rem' }}>⛵</span> {rootDiv} 대진 및 조 편성표
                          </h3>
                          {isAgeSplitDiv && (
                            <span style={{
                              fontSize: '0.78rem',
                              fontWeight: '800',
                              color: '#6d28d9',
                              background: '#f5f3ff',
                              border: '1px solid #ddd6fe',
                              padding: '4px 12px',
                              borderRadius: '999px'
                            }}>
                              🎂 남자부: 생년월일 기준 참가 연령 1/3 균등분할 (청년부 · 중년부 · 장년부)
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
                          {['남자부', '여자부'].map(gender => {
                            const subclasses = genderGroup[gender] || {};
                            const sortedSubclassKeys = Object.keys(subclasses).sort((a, b) => {
                              const idxA = subclassOrder.indexOf(a);
                              const idxB = subclassOrder.indexOf(b);
                              if (idxA === -1 && idxB === -1) return a.localeCompare(b, 'ko');
                              if (idxA === -1) return 1;
                              if (idxB === -1) return -1;
                              return idxA - idxB;
                            });
                            if (sortedSubclassKeys.length === 0) return null;

                            return (
                              <div key={gender} style={{ background: '#f8fafc', padding: '22px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                                <h4 style={{ fontSize: '1.08rem', fontWeight: '800', color: 'var(--theme-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  👤 {gender}
                                </h4>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
                                  {sortedSubclassKeys.map(subclass => {
                                    const rawList = subclasses[subclass] || [];
                                    const list = [...rawList].sort((a, b) => {
                                      const birthA = parseBirthComparable(a.birth);
                                      const birthB = parseBirthComparable(b.birth);
                                      if (birthA !== birthB) {
                                        if (birthA === 0) return 1;
                                        if (birthB === 0) return -1;
                                        return birthB - birthA;
                                      }
                                      return (a.name || '').localeCompare(b.name || '', 'ko');
                                    });
                                    const badgeColor =
                                      subclass === '청년부' ? '#0284c7' :
                                      subclass === '중년부' ? '#7c3aed' :
                                      subclass === '장년부' ? '#b45309' :
                                      'var(--theme-primary)';

                                    return (
                                      <div key={subclass} style={{ background: 'white', border: '1px solid var(--border-color)', borderTop: `3px solid ${badgeColor}`, borderRadius: '12px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                        <h5 style={{ fontSize: '0.95rem', fontWeight: '850', color: 'var(--text-main)', margin: '0 0 12px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>🏷️ {subclass}</span>
                                            {(subclass === '청년부' || subclass === '중년부' || subclass === '장년부') && (
                                              <span style={{ fontSize: '0.72rem', color: badgeColor, fontWeight: '700' }}>
                                                ({subclass === '청년부' ? '연령 1/3 청년' : subclass === '중년부' ? '연령 1/3 중년' : '연령 1/3 장년'})
                                              </span>
                                            )}
                                          </span>
                                          <span style={{ fontSize: '0.75rem', background: badgeColor, color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>{list.length}명</span>
                                        </h5>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          {list.map((player, pIdx) => {
                                            const isApproved = player.status === 'APPROVED';
                                            return (
                                              <div
                                                key={player.id}
                                                style={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'space-between',
                                                  flexWrap: 'wrap',
                                                  gap: '8px 10px',
                                                  padding: '10px 12px',
                                                  background: '#ffffff',
                                                  borderRadius: '10px',
                                                  fontSize: '0.86rem',
                                                  border: '1px solid #e2e8f0'
                                                }}
                                              >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                                                  <span style={{ color: '#94a3b8', fontWeight: '800', fontSize: '0.8rem', minWidth: '16px' }}>
                                                    {pIdx + 1}
                                                  </span>
                                                  <span style={{ fontWeight: '900', color: '#0f172a', fontSize: '0.95rem' }}>
                                                    {player.name}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleCellChange(player.id, 'status', isApproved ? 'PENDING' : 'APPROVED')}
                                                    title="클릭하여 참가확정/확정전 상태를 전환할 수 있습니다"
                                                    style={{
                                                      fontSize: '0.7rem',
                                                      fontWeight: '800',
                                                      padding: '2px 6px',
                                                      borderRadius: '5px',
                                                      cursor: 'pointer',
                                                      background: isApproved ? '#ecfdf5' : '#fffbeb',
                                                      color: isApproved ? '#059669' : '#d97706',
                                                      border: isApproved ? '1px solid #a7f3d0' : '1px solid #fde68a'
                                                    }}
                                                  >
                                                    {isApproved ? '확정' : '확정전'}
                                                  </button>
                                                  <span style={{
                                                    fontSize: '0.75rem',
                                                    color: '#334155',
                                                    background: '#f1f5f9',
                                                    padding: '2px 7px',
                                                    borderRadius: '6px',
                                                    fontWeight: '700',
                                                    border: '1px solid #e2e8f0'
                                                  }}>
                                                    {player.club || '미소속'}
                                                  </span>
                                                  <span style={{
                                                    fontSize: '0.75rem',
                                                    color: '#64748b',
                                                    fontWeight: '600'
                                                  }}>
                                                    {formatMaskedBirth(player.birth)}
                                                  </span>
                                                </div>

                                                {/* 우측: 조 편성 변경 및 배번티 번호 표시/수정 */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <select
                                                    value={player.subclass || '통합부'}
                                                    onChange={(e) => handleCellChange(player.id, 'subclass', e.target.value)}
                                                    title="조 편성 변경"
                                                    style={{
                                                      fontSize: '0.78rem',
                                                      fontWeight: '700',
                                                      padding: '4px 6px',
                                                      borderRadius: '6px',
                                                      border: '1px solid #cbd5e1',
                                                      background: '#f8fafc',
                                                      color: '#334155',
                                                      cursor: 'pointer'
                                                    }}
                                                  >
                                                    {['청년부', '중년부', '장년부', '통합부', 'A조', 'B조', 'C조', 'D조', '1조', '2조', '3조', '4조', '마스터즈'].map(opt => (
                                                      <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                  </select>
                                                  <span style={{
                                                    fontWeight: '900',
                                                    color: '#0284c7',
                                                    background: '#f0f9ff',
                                                    border: '1px solid #bae6fd',
                                                    padding: '3px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8rem',
                                                    whiteSpace: 'nowrap'
                                                  }}>
                                                    배번 {player.bibNumber || '-'}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* SECTION B: 동점자 및 채점 규칙 제어 */}
        {activeSection === 'tie-breaker' && (
          <div style={{ maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* DNS / DNF 채점 벌점 규칙 설정 */}
            <div className="glass-panel" style={{ borderTop: '4px solid var(--theme-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0 }}>⚖️ DNS (출발하지 않음) · DNF (완주하지 못함) 점수 규정 설정</h3>
                {dnsDnfSaving && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--theme-primary)', fontWeight: '700' }}>저장 중...</span>
                )}
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '18px', fontSize: '0.9rem', lineHeight: '1.6' }}>
                심판단 순위 확정란(채점)에서 <strong>등수 입력이 없는 선수는 모두 DNS(출발하지 않음)로 간주</strong>되며, 선택한 규칙에 따라 DNS·DNF 벌점이 총점에 합산됩니다.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                <div
                  onClick={() => handleSaveDnsDnfRule('FINISHER_PLUS_ONE')}
                  style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: dnsDnfRule === 'FINISHER_PLUS_ONE' ? '2px solid var(--theme-primary)' : '1px solid var(--border-color)',
                    background: dnsDnfRule === 'FINISHER_PLUS_ONE' ? 'rgba(2, 132, 199, 0.06)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '900', fontSize: '1rem', color: dnsDnfRule === 'FINISHER_PLUS_ONE' ? 'var(--theme-primary)' : 'var(--text-main)' }}>
                      ① 표준 분리 산정 (DNS: 등록인원+1 / DNF: 완주자+1)
                    </span>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      background: dnsDnfRule === 'FINISHER_PLUS_ONE' ? 'var(--theme-primary)' : '#e2e8f0',
                      color: dnsDnfRule === 'FINISHER_PLUS_ONE' ? 'white' : '#64748b'
                    }}>
                      {dnsDnfRule === 'FINISHER_PLUS_ONE' ? '적용중' : '선택'}
                    </span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    <li><strong>DNS (미출발 · 등수 미입력):</strong> 출전 등록 전체 인원 수 + 1점 <br /><span style={{ color: '#0369a1' }}>(40명 기준 → 41점 부여)</span></li>
                    <li><strong>DNF (완주 실패):</strong> 해당 레이스 실제 결승선 통과(완주) 선수 수 + 1점 <br /><span style={{ color: '#0369a1' }}>(40명 출발 중 35명 완주 시 → 36점 부여)</span></li>
                  </ul>
                </div>

                <div
                  onClick={() => handleSaveDnsDnfRule('REGISTERED_PLUS_ONE')}
                  style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    border: dnsDnfRule === 'REGISTERED_PLUS_ONE' ? '2px solid #7c3aed' : '1px solid var(--border-color)',
                    background: dnsDnfRule === 'REGISTERED_PLUS_ONE' ? 'rgba(124, 58, 237, 0.06)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '900', fontSize: '1rem', color: dnsDnfRule === 'REGISTERED_PLUS_ONE' ? '#7c3aed' : 'var(--text-main)' }}>
                      ② 통합 산정 (DNS · DNF 모두 참가신청자 + 1점)
                    </span>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      background: dnsDnfRule === 'REGISTERED_PLUS_ONE' ? '#7c3aed' : '#e2e8f0',
                      color: dnsDnfRule === 'REGISTERED_PLUS_ONE' ? 'white' : '#64748b'
                    }}>
                      {dnsDnfRule === 'REGISTERED_PLUS_ONE' ? '적용중' : '선택'}
                    </span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    <li><strong>DNS (미출발 · 등수 미입력):</strong> 참가신청자(전체 등록 인원) 수 + 1점 <br /><span style={{ color: '#6d28d9' }}>(40명 기준 → 41점 부여)</span></li>
                    <li><strong>DNF (완주 실패):</strong> 완주자 수와 관계없이 참가신청자 수 + 1점 동일 적용 <br /><span style={{ color: '#6d28d9' }}>(40명 기준 → 41점 부여)</span></li>
                  </ul>
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.84rem', color: '#475569', lineHeight: '1.5' }}>
                💡 <strong>자동 연동 안내:</strong> 이곳에서 선택한 DNS·DNF 점수 규정은 <strong>심판단 순위 확정란(채점 화면)</strong>과 <strong>실시간 리더보드</strong>에 즉시 연동됩니다.
              </div>
            </div>

            {/* 동점자 타이브레이커 우선순위 (월드세일링 RRS 부록 A8 국제 규칙 기준) */}
            <div className="glass-panel" style={{ borderTop: '4px solid #0284c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0 }}>
                  ⛵ 동점자(Tie-breaker) 발생 시 국제 규칙 기준 우선순위 산출법
                </h3>
                <button
                  type="button"
                  onClick={handleResetDefaultRules}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd',
                    background: '#f0f9ff',
                    color: '#0369a1',
                    fontSize: '0.82rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={14} /> 월드세일링 RRS 표준 순서로 초기화
                </button>
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem', lineHeight: '1.6' }}>
                총점이 동점인 선수들이 발생했을 때, <strong>월드세일링 RRS(부록 A8 등)에 명시된 표준 동점자 처리 규정</strong>에 따라 아래 우선순위 순서로 순위를 가립니다. 우측 위/아래 버튼으로 우선순위를 즉시 조정할 수 있습니다.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rules.map((rule, idx) => {
                  let ruleKorean = '';
                  let ruleDesc = '';
                  switch (rule.ruleType) {
                    case 'HEAD_TO_HEAD':
                      ruleKorean = '상대 전적 (Head-to-Head / 동점자 간의 레이스 비교)';
                      ruleDesc = '동점인 선수들끼리 직접 맞붙었던 레이스(들)에서 더 좋은 순위를 기록한 선수를 상위에 둡니다.';
                      break;
                    case 'MOST_BETTER_FINISHES':
                      ruleKorean = '상위 성적 횟수 비교 (Most Better Finishes)';
                      ruleDesc = '다중 레이스 시리즈에서 1위 횟수, 2위 횟수, 3위 횟수 순으로 차례대로 비교하여 더 좋은 성적을 많이 거둔 선수를 우선시합니다.';
                      break;
                    case 'MOST_RECENT_RACE':
                      ruleKorean = '가장 최근 레이스 성적 비교';
                      ruleDesc = '마지막 레이스(혹은 가장 최근에 치른 레이스)에서 더 앞선 순위를 기록한 선수를 상위에 랭크시킵니다.';
                      break;
                    case 'DISCARD_DROP':
                      ruleKorean = '최하위 성적 제외 후 재산정 (Discard / Drop)';
                      ruleDesc = '대회 규정에 따라 성적이 가장 안 좋은 레이스 점수를 제외(Drop)한 뒤의 총점으로 다시 비교하여 순위를 결정합니다.';
                      break;
                    default:
                      ruleKorean = rule.ruleType;
                      ruleDesc = '정렬 규칙';
                  }

                  return (
                    <div
                      key={rule.id || idx}
                      style={{
                        padding: '20px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ flex: 1, marginRight: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <span style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--theme-primary)',
                            color: 'white',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.82rem',
                            fontWeight: '800',
                            flexShrink: 0
                          }}>
                            {idx + 1}
                          </span>
                          <h4 style={{ fontWeight: '800', margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>{ruleKorean}</h4>
                        </div>
                        <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: '4px 0 0 36px', lineHeight: '1.5' }}>{ruleDesc}</p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px', opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                          onClick={() => idx !== 0 && handleMoveRule(idx, 'up')}
                          disabled={idx === 0}
                          title="우선순위 위로 이동"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px', opacity: idx === rules.length - 1 ? 0.3 : 1, cursor: idx === rules.length - 1 ? 'not-allowed' : 'pointer' }}
                          onClick={() => idx !== rules.length - 1 && handleMoveRule(idx, 'down')}
                          disabled={idx === rules.length - 1}
                          title="우선순위 아래로 이동"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SECTION C: 개최공시서 업로드 */}
        {activeSection === 'notice' && (
          <NoticeEditor tenant={tenant} subdomain={subdomain} onSaveSuccess={fetchInitialData} />
        )}

      </main>

      {/* 2.5. 참가자 삭제 확인 대화상자 (모달) */}
      {deleteTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            maxWidth: '460px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)'
          }}>
            <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: '#fee2e2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#1e293b' }}>
                  참가자 삭제 확인
                </h3>
                <p style={{ margin: '8px 0 0', fontSize: '0.92rem', color: '#64748b', lineHeight: '1.5' }}>
                  정말 <strong style={{ color: '#0f172a' }}>'{deleteTarget.name || '미등록 참가자'}'</strong> 님의 참가 신청 정보를 삭제하시겠습니까?
                </p>
              </div>
            </div>

            <div style={{ margin: '0 24px 18px', padding: '14px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.86rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '8px', color: '#475569' }}>
                <span style={{ fontWeight: '700', color: '#64748b' }}>참가종목:</span>
                <span style={{ fontWeight: '600', color: 'var(--theme-primary)' }}>{deleteTarget.division || '-'}</span>
                
                <span style={{ fontWeight: '700', color: '#64748b' }}>소속클럽:</span>
                <span style={{ fontWeight: '600' }}>{deleteTarget.club || '-'}</span>
                
                <span style={{ fontWeight: '700', color: '#64748b' }}>생년월일:</span>
                <span>{deleteTarget.birth || '-'}</span>
                
                <span style={{ fontWeight: '700', color: '#64748b' }}>연락처:</span>
                <span>{deleteTarget.phone || '-'}</span>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', color: '#dc2626', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} />
                <span>삭제 시 데이터베이스에서 영구히 삭제되며 복구할 수 없습니다.</span>
              </div>
            </div>

            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: 'white',
                  color: '#475569',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: isDeleting ? 'not-allowed' : 'pointer'
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#ef4444',
                  color: 'white',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isDeleting ? <RefreshCw className="animate-spin" size={15} /> : <Trash2 size={15} />}
                {isDeleting ? '삭제 중...' : '삭제 확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 참가 신청서 원본 복제형 상세 뷰 모달 (12단계 네이버 폼 정보 정밀 복사) */}
      {selectedReg && (() => {
        // rawRegistrations에서 원본 response 찾기
        const rawReg = rawRegistrations.find(r => r.id === selectedReg.id);
        let email = 'info@gentrophy.com';
        let birthDate = '19900815'; // 기본 목데이터
        let parsedResponses: Record<string, any> = {};

        if (rawReg && rawReg.formResponses) {
          try {
            parsedResponses = JSON.parse(rawReg.formResponses);
            email = parsedResponses.email || 'info@gentrophy.com';
            birthDate = parsedResponses.birth || parsedResponses.birthDate || '19900815';
          } catch(e) {
            // 파싱오류 시 기본 데이터 유지
          }
        }

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '700px',
              background: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              overflow: 'hidden',
              color: 'var(--text-main)'
            }}>
              {/* 모달 헤더 */}
              <div style={{
                padding: '24px 30px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <FileText style={{ color: 'var(--theme-primary)' }} size={20} />
                    대회 참가 신청서 상세 정보
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                    선수가 제출한 12단계 참가 신청서의 실제 약관 동의 및 인적 사항 정보입니다.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedReg(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* 모달 콘텐츠 */}
              <div style={{ padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
                
                {/* 1 ~ 8단계 인적사항 및 기본 응답 */}
                <div className="grid-responsive-2" style={{ gap: '20px' }}>
                  
                  {/* 성명 */}
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>1. 참가자 성명</span>
                    <p style={{ fontSize: '1.05rem', fontWeight: '700', marginTop: '4px', marginBottom: 0, color: 'var(--text-main)' }}>{selectedReg.name}</p>
                  </div>

                  {/* 생년월일 */}
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>2. 생년월일 (8자리)</span>
                    <p style={{ fontSize: '1.05rem', fontWeight: '700', marginTop: '4px', marginBottom: 0, color: 'var(--text-main)' }}>{birthDate}</p>
                  </div>

                  {/* 연락처 */}
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>3. 연락처 (전화번호)</span>
                    <p style={{ fontSize: '1.05rem', fontWeight: '700', marginTop: '4px', marginBottom: 0, color: 'var(--text-main)' }}>{selectedReg.phone || '미입력'}</p>
                  </div>

                  {/* 성별 */}
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>4. 성별</span>
                    <p style={{ fontSize: '1.05rem', fontWeight: '700', marginTop: '4px', marginBottom: 0, color: 'var(--text-main)' }}>{selectedReg.gender}</p>
                  </div>

                  {/* 소속 */}
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>5. 소속협회 또는 클럽</span>
                    <p style={{ fontSize: '1.05rem', fontWeight: '700', marginTop: '4px', marginBottom: 0, color: 'var(--text-main)' }}>{selectedReg.club || '미소속'}</p>
                  </div>

                  {/* 이메일 */}
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>6. 이메일 주소</span>
                    <p style={{ fontSize: '1.05rem', fontWeight: '700', marginTop: '4px', marginBottom: 0, color: 'var(--text-main)' }}>{email}</p>
                  </div>

                  {/* 참가종목 */}
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>7. 참가 부문 / 종목</span>
                    <p style={{ fontSize: '1.05rem', fontWeight: '700', marginTop: '4px', marginBottom: 0, color: 'var(--theme-primary)' }}>{selectedReg.division}</p>
                  </div>

                  {/* 티셔츠 사이즈 */}
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>8. 티셔츠 사이즈</span>
                    <p style={{ fontSize: '1.05rem', fontWeight: '700', marginTop: '4px', marginBottom: 0, color: 'var(--text-main)' }}>{selectedReg.tshirtSize}</p>
                  </div>

                </div>

                <div style={{ borderTop: '1px dashed var(--border-color)', margin: '10px 0' }} />

                {/* 질문 항목 및 응답 리스트 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {DEFAULT_FORM_FIELDS.map((field: any) => {
                    // 기본 필수 인적사항은 이미 위 그리드 영역에서 표시했으므로 생략
                    if (['name', 'birth', 'gender', 'phone', 'club', 'division', 'tshirtSize'].includes(field.id)) {
                      return null;
                    }
                    const answer = parsedResponses[field.id];
                    return (
                      <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>{field.label}</span>
                        {field.textareaContent && (
                          <div style={{
                            padding: '10px 14px',
                            background: '#f8fafc',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            maxHeight: '60px',
                            overflowY: 'auto'
                          }}>
                            {field.textareaContent}
                          </div>
                        )}
                        {field.notice && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                            {field.notice}
                          </p>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                          {field.type === 'checkbox' || field.type === 'textarea' ? (
                            <>
                              <input type="checkbox" checked={!!answer} readOnly style={{ accentColor: 'var(--theme-primary)' }} />
                              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: answer ? '#10B981' : '#EF4444' }}>
                                {answer ? `${answer} (완료)` : '미동의/미확인'}
                              </span>
                            </>
                          ) : (
                            <p style={{ fontSize: '0.95rem', fontWeight: '600', margin: 0, color: 'var(--theme-primary)' }}>
                              {answer || '미입력'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* 모달 푸터 */}
              <div style={{
                padding: '20px 30px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedReg;
                    setSelectedReg(null);
                    setDeleteTarget(target);
                  }}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    background: '#fee2e2',
                    color: '#dc2626',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Trash2 size={15} /> 이 참가자 삭제
                </button>
                <button
                  onClick={() => setSelectedReg(null)}
                  className="btn-primary"
                  style={{ padding: '10px 24px', fontSize: '0.9rem' }}
                >
                  확인 및 닫기
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

interface NoticeEditorProps {
  tenant: any;
  subdomain: string;
  onSaveSuccess: () => void;
}

function NoticeEditor({ tenant, subdomain, onSaveSuccess }: NoticeEditorProps) {
  const [noticeHwpData, setNoticeHwpData] = useState<string>(
    tenant?.overviewConfig?.noticeHwpData || '/files/2026년20회통영대회_개최공시서.hwp'
  );
  const [noticeHwpName, setNoticeHwpName] = useState<string>(
    tenant?.overviewConfig?.noticeHwpName || '2026년20회통영대회_개최공시서.hwp'
  );
  const [noticePdfData, setNoticePdfData] = useState<string>(
    tenant?.overviewConfig?.noticePdfData || '/files/2026년20회통영대회_개최공시서.pdf'
  );
  const [noticePdfName, setNoticePdfName] = useState<string>(
    tenant?.overviewConfig?.noticePdfName || '2026년20회통영대회_개최공시서.pdf'
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<{ hwp: boolean; pdf: boolean }>({ hwp: false, pdf: false });

  useEffect(() => {
    if (tenant?.overviewConfig) {
      setNoticeHwpData(tenant.overviewConfig.noticeHwpData || '/files/2026년20회통영대회_개최공시서.hwp');
      setNoticeHwpName(tenant.overviewConfig.noticeHwpName || '2026년20회통영대회_개최공시서.hwp');
      setNoticePdfData(tenant.overviewConfig.noticePdfData || '/files/2026년20회통영대회_개최공시서.pdf');
      setNoticePdfName(tenant.overviewConfig.noticePdfName || '2026년20회통영대회_개최공시서.pdf');
    }
  }, [tenant]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'hwp' | 'pdf') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert(`데이터베이스 통합 저장을 위해, 개최공시서 파일 크기는 1MB 이하여야 합니다. (현재 크기: ${(file.size / 1024 / 1024).toFixed(2)}MB)\n파일 용량을 압축하여 다시 선택해주세요.`);
      return;
    }

    setUploading(prev => ({ ...prev, [type]: true }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch(`/api/tenant/${subdomain}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '업로드 실패');
      }

      if (type === 'hwp') {
        setNoticeHwpData(data.downloadURL);
        setNoticeHwpName(data.fileName);
      } else {
        setNoticePdfData(data.downloadURL);
        setNoticePdfName(data.fileName);
      }
      alert(`${type === 'hwp' ? '한글' : 'PDF'} 파일이 정상적으로 등록되었습니다. 페이지 하단의 '저장하기' 버튼을 눌러야 최종 반영됩니다.`);
    } catch (error: any) {
      console.error('File upload error:', error);
      alert(`파일 업로드 실패: ${error.message}`);
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentConfig = tenant?.overviewConfig || {};
      const token = typeof window !== 'undefined' ? localStorage.getItem('gentrophy_auth_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-auth-token'] = token;
      }
      const res = await fetch(`/api/tenant/${subdomain}/overview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          overviewConfig: {
            ...currentConfig,
            noticeHwpData,
            noticeHwpName,
            noticePdfData,
            noticePdfName
          }
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('개최공시서 파일이 성공적으로 업로드 및 저장되었습니다!');
        await onSaveSuccess();
      } else {
        alert(data.error || '저장 실패');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '1000px' }} className="animate-fade-in">
      <div className="glass-panel" style={{ background: 'white', padding: '30px' }}>
        <div className="dashboard-toolbar" style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'black' }}>개최공시서 파일 업로드</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>홈페이지 개최공시서 메뉴에 제공될 한글(.hwp) 및 PDF(.pdf) 파일을 등록합니다. (개별 파일 최대 800KB 제한)</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '0.9rem' }}
          >
            {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
            개최공시서 저장하기
          </button>
        </div>
        <div className="grid-responsive-2" style={{ gap: '20px' }}>
            {/* 한글 파일 업로드 */}
            <div style={{ padding: '20px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-main)' }}>한글 파일 (.hwp)</span>
                {noticeHwpData ? (
                  <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '20px', fontWeight: '700' }}>등록됨</span>
                ) : (
                  <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '20px', fontWeight: '700' }}>미등록</span>
                )}
              </div>

              {noticeHwpData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} style={{ color: '#0284c7' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                      {noticeHwpName || '개최공시서.hwp'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNoticeHwpData('');
                      setNoticeHwpName('');
                    }}
                    style={{ padding: '8px 12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Trash2 size={14} /> 파일 삭제
                  </button>
                </div>
              ) : (
                uploading.hwp ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <RefreshCw className="animate-spin" size={16} /> 파일 업로드 중...
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept=".hwp"
                      onChange={(e) => handleFileChange(e, 'hwp')}
                      style={{ display: 'none' }}
                      id="hwp-file-upload"
                    />
                    <label
                      htmlFor="hwp-file-upload"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', background: 'var(--theme-primary)', color: 'white', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700', border: 'none', textAlign: 'center' }}
                    >
                      <Upload size={14} /> 한글 파일 선택
                    </label>
                  </div>
                )
              )}
            </div>

            {/* PDF 파일 업로드 */}
            <div style={{ padding: '20px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-main)' }}>PDF 파일 (.pdf)</span>
                {noticePdfData ? (
                  <span style={{ fontSize: '0.75rem', background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '20px', fontWeight: '700' }}>등록됨</span>
                ) : (
                  <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '20px', fontWeight: '700' }}>미등록</span>
                )}
              </div>

              {noticePdfData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} style={{ color: '#dc2626' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                      {noticePdfName || '개최공시서.pdf'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNoticePdfData('');
                      setNoticePdfName('');
                    }}
                    style={{ padding: '8px 12px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Trash2 size={14} /> 파일 삭제
                  </button>
                </div>
              ) : (
                uploading.pdf ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <RefreshCw className="animate-spin" size={16} /> 파일 업로드 중...
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, 'pdf')}
                      style={{ display: 'none' }}
                      id="pdf-file-upload"
                    />
                    <label
                      htmlFor="pdf-file-upload"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', background: 'var(--theme-primary)', color: 'white', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700', border: 'none', textAlign: 'center' }}
                    >
                      <Upload size={14} /> PDF 파일 선택
                    </label>
                  </div>
                )
              )}
            </div>
          </div>
      </div>
    </div>
  );
}
