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
  bibNumber?: string;

  // 편집 제어 플래그
  isEdited?: boolean;
  isNew?: boolean;
}

interface TieBreakerRule {
  id: string;
  priority: number;
  ruleType: string;
}

const DEFAULT_FORM_FIELDS = [
  { id: 'name', label: '1. 성명', type: 'text', required: true, placeholder: '실명을 입력해 주세요.' },
  { id: 'birth', label: '2. 생년월일 (8자리) 예) 19450815', type: 'text', required: true, placeholder: '예) 19901024' },
  { id: 'gender', label: '3. 성별', type: 'radio', required: true, options: ['남자', '여자'] },
  { id: 'phone', label: '4. 전화번호 (휴대폰번호)', type: 'text', required: true, placeholder: '예) 01012345678' },
  { id: 'club', label: '5. 소속협회 또는 클럽', type: 'text', required: true, placeholder: '소속 단체명을 입력해 주세요.' },
  { id: 'division', label: '6. 참가종목', type: 'radio', required: true, options: ['윈드포일 (남자부)', '윈드포일 (여자부)', '윙포일 (남자부)', '윙포일 (여자부)', '혼합오픈 (남자부)', '혼합오픈 (여자부)', '펀엔포뮬러 (남자부)', '펀엔포뮬러 (여자부)'] },
  { id: 'tshirtSize', label: '7. 티셔츠(기념품)사이즈', type: 'radio', required: true, options: ['S (95)', 'M (100)', 'L (105)', 'XL (110)'] },
  { id: 'vestAgreement', label: '8. 당일 대회본부에 조끼(배번티)를 반드시 수령하셔야 합니다.', type: 'checkbox', required: true, notice: '대회운영본부 수령 필수 (사용 후 반드시 반납바랍니다)', agreeLabel: '네. 확인했습니다.' },
  { id: 'paymentNoticeAgreement', label: '9. 참가비 입금 안내 확인 동의', type: 'checkbox', required: true, notice: '• 입금계좌: 농협 351-1334-8643-33 (예금주: 통영시요트협회)\n• 참가 신청서에 작성하신 성명(이름)으로 반드시 입금해 주시기 바랍니다.\n• 입금 완료 순서(입금순)로 선착순 130명 참가 확정 처리됩니다.\n• 참가 확정 및 선수등록 승인 안내는 대회 공식 홈페이지에서 확인하실 수 있습니다.', agreeLabel: '네. 확인했습니다.' },
  { id: 'liabilityWaiver', label: '10. 면책 동의서 서약에 동의합니다.', type: 'textarea', required: true, textareaContent: '본인은 제20회 이순신장군배 전국윈드서핑대회 참가 활동 중 본인의 부주의로 인해 발생할 수 있는 사고, 즉 개인적 부상, 재산상 피해, 의학적인 사고 등 대회기간 중 발생한 사고에 대한 책임은 본인의 자의적인 참가에 의한 본인의 책임이며, 본 대회를 주관하는 관계자 및 기관에 대한 면책은 물론 책임전가를 하지 않을 것을 서약합니다.', agreeLabel: '네. 동의합니다.' },
  { id: 'privacyConsent', label: '11. 개인정보 수집에 동의합니다.', type: 'textarea', required: true, textareaContent: '• 정보수집 및 이용기관 : 통영시요트협회\n• 수집 정보 : 성명, 생년월일, 전화번호, 이메일, 소속 단체\n• 수집 목적 : 참가자 관리 및 보험가입, 대회 공지 전송 등\n• 보존 기간 : 대회 정산 이후 즉시 폐기합니다.', agreeLabel: '네. 동의합니다.' },
  { id: 'mediaConsent', label: '12. 초상권 및 저작권 사용 동의', type: 'textarea', required: true, textareaContent: '• 정보수집 및 이용기관 : 통영시요트협회\n• 수집 목적 : 대회 홍보, 결과 보도, 미디어 자료 활용 등\n• 활용 대상 : 대회 사진, 동영상 등 촬영물\n• 보존 기간 : 통영시요트협회 아카이브 보관용으로 영구 보존 및 활용에 동의합니다.', agreeLabel: '네. 동의합니다.' }
];

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
  const [activeSection, setActiveSection] = useState<'applicants' | 'tie-breaker' | 'notice'>('applicants');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [filterSortCategory, setFilterSortCategory] = useState<string>('all');
  const [subFilterValue, setSubFilterValue] = useState<string>('all');

  // 스프레드시트 그리드 상태 관리
  const [gridData, setGridData] = useState<GridRow[]>([]);
  const [rawRegistrations, setRawRegistrations] = useState<any[]>([]); // 원본 상세 데이터 바인딩용
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<'all' | 'name' | 'phone' | 'club' | 'division'>('all'); // 카테고리별 검색
  const [selectedReg, setSelectedReg] = useState<GridRow | null>(null); // 신청서 보기 팝업용
  const [isSaving, setIsSaving] = useState(false);

  // 온라인 참가 신청 접수 기간 및 권한 설정 상태
  const [regStartDate, setRegStartDate] = useState('2026-08-10T09:00');
  const [regEndDate, setRegEndDate] = useState('2026-10-23T18:00');
  const [regMode, setRegMode] = useState<'AUTO' | 'FORCE_ENABLED' | 'DISABLED'>('AUTO');
  const [regEnabled, setRegEnabled] = useState(true);
  const [regNotice, setRegNotice] = useState('');
  const [regPeriodSaving, setRegPeriodSaving] = useState(false);

  // 동점자 룰
  const [rules, setRules] = useState<TieBreakerRule[]>([]);

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

  const handleSaveRegistrationPeriod = async () => {
    setRegPeriodSaving(true);
    try {
      const currentConfig = tenant?.overviewConfig || {};
      const updatedConfig = {
        ...currentConfig,
        duration: '2026. 10. 31(토) ~ 11. 01(일) (1박 2일)',
        registrationStartDate: '2026-08-10T09:00',
        registrationEndDate: '2026-10-23T18:00',
        deadlineDate: currentConfig.deadlineDate || '2026년 10월 23일(금) 18:00',
        location: currentConfig.location || '경상남도 통영시 도남항 특설경기장 및 트라이애슬론 광장 일원',
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
        let tshirtSize = '100';
        let vestAgreement = '';
        let paymentNoticeAgreement = '';
        let liabilityWaiver = '';
        let privacyConsent = '';
        let mediaConsent = '';

        try {
          if (r.formResponses) {
            const extra = JSON.parse(r.formResponses);
            birth = extra.birth || '';
            gender = extra.gender || '남자';
            // formResponses에 phone이 있으면 우선 사용
            phone = extra.phone || '';
            club = extra.club || '미소속';
            division = extra.division || '윈드포일';
            tshirtSize = extra.tshirtSize || '100';
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
          vestAgreement,
          paymentNoticeAgreement,
          liabilityWaiver,
          privacyConsent,
          mediaConsent,
          paymentStatus: r.paymentStatus,
          status: r.status,
          createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('ko-KR') : '',
          bibNumber: r.bibNumber || '',
        };
      });

      setGridData(parsedRows);
      setRules(ruleData.rules || []);
    } catch (e) {
      console.error(e);
    }
  };

  // 엑셀 그리드 셀 수정 핸들러
  const handleCellChange = (rowId: string, field: keyof GridRow, value: any) => {
    setGridData(
      gridData.map((row) => {
        if (row.id === rowId) {
          return {
            ...row,
            [field]: value,
            isEdited: true, // 변경점 추적
          };
        }
        return row;
      })
    );
  };

  // 엑셀식 새 행 삽입 (대량 등록용)
  const handleAddNewRow = () => {
    const newRow: GridRow = {
      id: `temp-${Date.now()}`,
      playerId: '',
      name: '',
      birth: '',
      gender: '남자',
      phone: '',
      club: '',
      division: '윈드포일',
      tshirtSize: '100',
      vestAgreement: '네. 확인했습니다.',
      paymentNoticeAgreement: '네. 확인했습니다.',
      liabilityWaiver: '네. 동의합니다.',
      privacyConsent: '네. 동의합니다.',
      mediaConsent: '네. 동의합니다.',
      paymentStatus: 'APPROVED',
      status: 'APPROVED',
      isNew: true, // 신규 추가 행 추적
      createdAt: new Date().toLocaleString('ko-KR'),
    };
    setGridData([newRow, ...gridData]);
  };

  // 행 삭제
  const handleDeleteRow = async (rowId: string) => {
    if (!confirm('정말 선택한 참가자를 목록에서 지우시겠습니까?')) return;
    
    setGridData((prev) => prev.filter((row) => row.id !== rowId));
    
    if (!rowId.startsWith('temp-')) {
      if (!activeTournament) return;
      try {
        const res = await fetch(`/api/tenant/${subdomain}/registrations/bulk-update`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            tournamentId: activeTournament.id,
            updatedList: [],
            insertedList: [],
            deletedIds: [rowId],
          }),
        });

        if (res.ok) {
          alert('참가자가 성공적으로 데이터베이스에서 삭제되었습니다.');
          setDeletedIds((prev) => prev.filter((id) => id !== rowId));
          await loadSectionData(activeTournament.id);
        } else {
          const data = await res.json();
          alert(data.error || '삭제 실패');
        }
      } catch (e: any) {
        alert('삭제 중 오류가 발생했습니다: ' + e.message);
      }
    }
  };

  // 엑셀 그리드 일괄 저장 (벌크 업데이트)
  const handleSaveAllChanges = async () => {
    if (!activeTournament) return;

    const updatedList = gridData.filter((row) => row.isEdited && !row.isNew);
    const insertedList = gridData.filter((row) => row.isNew && row.name.trim());

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

  // 동점자 룰 우선순위 제어
  const handleMoveRule = async (index: number, direction: 'up' | 'down') => {
    if (!activeTournament) return;

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

    try {
      const res = await fetch(`/api/tenant/${subdomain}/rules-detail`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tournamentId: activeTournament.id,
          rulesList: updatedRules,
        }),
      });

      if (res.ok) {
        setRules(updatedRules);
      }
    } catch (e) {
      console.error(e);
    }
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
    if (filterSortCategory === 'birth_asc') {
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
    <div style={themeStyles} className="grid-dashboard">
      
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
          borderRight: '1px solid var(--border-color)',
          padding: '30px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={22} style={{ color: 'var(--theme-gold)' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'white', fontFamily: 'var(--font-title)' }}>
            Wind <span style={{ color: 'var(--theme-gold)' }}>ERP</span>
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { id: 'applicants', label: '참가자관리', icon: Users },
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
        
        <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '8px' }}>
              {activeSection === 'applicants' ? '참가자관리' : 
               activeSection === 'tie-breaker' ? 'Tie-breaker 가중치 제어기' : '개최공시서 업로드'}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>{activeTournament.title}</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
                      <th style={{ minWidth: '90px' }}>성명</th>
                      <th style={{ minWidth: '90px' }}>배번티번호</th>
                      <th style={{ minWidth: '110px' }}>생년월일</th>
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
                      <th style={{ minWidth: '100px', textAlign: 'center' }}>홈페이지 배포</th>
                      <th style={{ minWidth: '150px', textAlign: 'center' }}>신청일시</th>
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
                              border: 'none',
                              color: 'var(--text-main)',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="윈드포일">윈드포일</option>
                            <option value="윙포일">윙포일</option>
                            <option value="혼합오픈">혼합오픈</option>
                            <option value="펀엔포뮬러">펀엔포뮬러</option>
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
                              border: 'none',
                              color: 'var(--text-main)',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="85">85</option>
                            <option value="90">90</option>
                            <option value="95">95</option>
                            <option value="100">100</option>
                            <option value="105">105</option>
                            <option value="110">110</option>
                            <option value="115">115</option>
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

                        {/* 홈페이지 배포 체크박스 */}
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <input
                            type="checkbox"
                            checked={row.status === 'APPROVED'}
                            onChange={(e) => handleCellChange(row.id, 'status', e.target.checked ? 'APPROVED' : 'PENDING')}
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

        {/* SECTION B: 동점자 룰 제어 */}
        {activeSection === 'tie-breaker' && (
          <div style={{ maxWidth: '700px' }} className="glass-panel">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>순위 결정을 위한 규칙 체인 우선순위</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
              승점이 같을 때 적용되는 타이 브레이커 규칙 순서입니다. 위/아래 버튼으로 우선순위를 즉각 조절합니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rules.map((rule, idx) => {
                let ruleKorean = '';
                let ruleDesc = '';
                switch (rule.ruleType) {
                  case 'HEAD_TO_HEAD':
                    ruleKorean = '승자승 원칙 (Head-to-Head)';
                    ruleDesc = '동점인 선수들 간 직접 승패 전적을 평가하여 상위를 결정합니다.';
                    break;
                  case 'SCORE_DIFF':
                    ruleKorean = '세부 점수 득실차 (Score Difference)';
                    ruleDesc = '경기 동안 획득한 세부 스코어의 득실차가 큰 선수를 우대합니다.';
                    break;
                  case 'TOTAL_SCORES':
                    ruleKorean = '다득점 총합 (Total Points Won)';
                    ruleDesc = '모든 매치에서 획득한 세부 포인트의 전체 누적 합산치를 우선합니다.';
                    break;
                  case 'AGE_ORDER':
                    ruleKorean = '연장자 우선 원칙 (Age Order)';
                    ruleDesc = '생년월일(YYYYMMDD)을 파싱하여 나이가 더 많은 선수를 위로 올립니다.';
                    break;
                  default:
                    ruleKorean = rule.ruleType;
                    ruleDesc = '정렬 규칙';
                }

                return (
                  <div
                    key={rule.id}
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
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--theme-primary)',
                          color: 'white',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: '700'
                        }}>
                          {idx + 1}
                        </span>
                        <h4 style={{ fontWeight: '700' }}>{ruleKorean}</h4>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{ruleDesc}</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px', opacity: idx === 0 ? 0.3 : 1, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                        onClick={() => idx !== 0 && handleMoveRule(idx, 'up')}
                        disabled={idx === 0}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px', opacity: idx === rules.length - 1 ? 0.3 : 1, cursor: idx === rules.length - 1 ? 'not-allowed' : 'pointer' }}
                        onClick={() => idx !== rules.length - 1 && handleMoveRule(idx, 'down')}
                        disabled={idx === rules.length - 1}
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION C: 개최공시서 업로드 */}
        {activeSection === 'notice' && (
          <NoticeEditor tenant={tenant} subdomain={subdomain} onSaveSuccess={fetchInitialData} />
        )}

      </main>

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
                justifyContent: 'flex-end',
                background: '#f8fafc'
              }}>
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
    tenant?.overviewConfig?.noticeHwpData || ''
  );
  const [noticeHwpName, setNoticeHwpName] = useState<string>(
    tenant?.overviewConfig?.noticeHwpName || ''
  );
  const [noticePdfData, setNoticePdfData] = useState<string>(
    tenant?.overviewConfig?.noticePdfData || ''
  );
  const [noticePdfName, setNoticePdfName] = useState<string>(
    tenant?.overviewConfig?.noticePdfName || ''
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<{ hwp: boolean; pdf: boolean }>({ hwp: false, pdf: false });

  useEffect(() => {
    if (tenant?.overviewConfig) {
      if (tenant.overviewConfig.noticeHwpData) setNoticeHwpData(tenant.overviewConfig.noticeHwpData);
      if (tenant.overviewConfig.noticeHwpName) setNoticeHwpName(tenant.overviewConfig.noticeHwpName);
      if (tenant.overviewConfig.noticePdfData) setNoticePdfData(tenant.overviewConfig.noticePdfData);
      if (tenant.overviewConfig.noticePdfName) setNoticePdfName(tenant.overviewConfig.noticePdfName);
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
