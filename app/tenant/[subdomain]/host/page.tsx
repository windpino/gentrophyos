'use client';

import React, { useState, useEffect, use } from 'react';
import { Award, Check, X, Upload, Download, Plus, Trash2, ArrowUp, ArrowDown, Users, FileText, Settings, Layers, Calendar, RefreshCw, Save, Search, Eye, ExternalLink } from 'lucide-react';

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

  // 편집 제어 플래그
  isEdited?: boolean;
  isNew?: boolean;
}

interface TieBreakerRule {
  id: string;
  priority: number;
  ruleType: string;
}

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
  const [activeSection, setActiveSection] = useState<'applicants' | 'tie-breaker' | 'overview' | 'notice' | 'form-builder'>('applicants');

  // 동적 신청서 폼 양식 (폼빌더) 상태
  const [formFields, setFormFields] = useState<any[]>([]);
  const [formConfigLoading, setFormConfigLoading] = useState(false);
  const [formConfigSaving, setFormConfigSaving] = useState(false);

  // 스프레드시트 그리드 상태 관리
  const [gridData, setGridData] = useState<GridRow[]>([]);
  const [rawRegistrations, setRawRegistrations] = useState<any[]>([]); // 원본 상세 데이터 바인딩용
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<'all' | 'name' | 'phone' | 'club' | 'division'>('all'); // 카테고리별 검색
  const [selectedReg, setSelectedReg] = useState<GridRow | null>(null); // 신청서 보기 팝업용
  const [isSaving, setIsSaving] = useState(false);

  // 동점자 룰
  const [rules, setRules] = useState<TieBreakerRule[]>([]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      if (res.ok) {
        setIsAuthenticated(true);
        setAuthError('');
      } else {
        const data = await res.json();
        setAuthError(data.message || '올바르지 않은 비밀번호입니다. 다시 입력해 주세요.');
        setPasswordInput('');
      }
    } catch {
      setAuthError('서버 연결 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [subdomain]);

  const fetchInitialData = async () => {
    try {
      const tenantRes = await fetch(`/api/tenant/${subdomain}`);
      const tenantData = await tenantRes.json();
      if (tenantData.tenant) {
        setTenant(tenantData.tenant);
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

  const loadSectionData = async (tId: string) => {
    try {
      // 1. 참가 신청서 데이터 로드 및 윈드서핑 그리드 변환
      const regRes = await fetch(`/api/tenant/${subdomain}/registrations?tournamentId=${tId}`);
      const regData = await regRes.json();
      setRawRegistrations(regData.registrations || []);
      
      const parsedRows: GridRow[] = (regData.registrations || []).map((r: any) => {
        let birth = '';
        let gender = '남자';
        let phone = '';
        let club = '미소속';
        let division = '윈드포일 (남자부)';
        let tshirtSize = 'L (105)';
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
            division = extra.division || '윈드포일 (남자부)';
            tshirtSize = extra.tshirtSize || 'L (105)';
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
        };
      });

      setGridData(parsedRows);

      // 2. 동점자 룰 로드
      const ruleRes = await fetch(`/api/tenant/${subdomain}/rules-detail?tournamentId=${tId}`);
      const ruleData = await ruleRes.json();
      setRules(ruleData.rules || []);

      // 3. 신청서 폼 양식 로드
      await fetchFormConfigs();
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFormConfigs = async () => {
    setFormConfigLoading(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/form-configs`);
      const data = await res.json();
      if (data.fields) {
        setFormFields(data.fields);
      }
    } catch (err) {
      console.error('폼 설정 조회 실패:', err);
    } finally {
      setFormConfigLoading(false);
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
      division: '윈드포일 (남자부)',
      tshirtSize: 'L (105)',
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
  const handleDeleteRow = (rowId: string) => {
    if (!confirm('정말 선택한 참가자를 목록에서 지우시겠습니까?')) return;
    setGridData(gridData.filter((row) => row.id !== rowId));
    if (!rowId.startsWith('temp-')) {
      setDeletedIds([...deletedIds, rowId]);
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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

  // 실시간 검색 기능 필터링 (카테고리별 정밀 검색)
  const filteredGridData = gridData.filter((row) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    if (searchCategory === 'name') {
      return row.name.toLowerCase().includes(query);
    }
    if (searchCategory === 'phone') {
      return row.phone.includes(query);
    }
    if (searchCategory === 'club') {
      return row.club.toLowerCase().includes(query);
    }
    if (searchCategory === 'division') {
      return row.division.toLowerCase().includes(query);
    }

    // 전체(all) 통합 검색
    return (
      row.name.toLowerCase().includes(query) ||
      row.phone.includes(query) ||
      row.club.toLowerCase().includes(query) ||
      row.division.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-main)' }}>
        <RefreshCw className="animate-spin" size={48} style={{ color: 'var(--theme-primary)' }} />
      </div>
    );
  }

  if (!tenant || !activeTournament) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', color: '#EF4444' }}>관리 대상 채널이 존재하지 않습니다.</h2>
      </div>
    );
  }

  const themeStyles = {
    '--theme-primary': tenant.primaryColor || '#1f6f8b',
    '--theme-primary-hover': '#154e62',
    '--theme-primary-rgb': '31, 111, 139',
    '--theme-gold': '#c5a880',
  } as React.CSSProperties;

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
            {tenant.name}<br />
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
            { id: 'form-builder', label: '참가신청서 양식 설정', icon: Settings },
            { id: 'tie-breaker', label: '동점자 순위 규칙 설정', icon: Award },
            { id: 'overview', label: '대회 요강 내용 편집', icon: FileText },
            { id: 'notice', label: '개최공시서(NOR) 편집', icon: Layers },
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
               activeSection === 'form-builder' ? '참가신청서 양식 설정 (폼빌더)' :
               activeSection === 'tie-breaker' ? 'Tie-breaker 가중치 제어기' : 
               activeSection === 'overview' ? '대회 요강 내용 편집기' : '개최공시서(NOR) 편집기'}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>{activeTournament.title}</p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              
              {/* 실시간 필터링 검색 바 + 카테고리 셀렉터 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select
                  value={searchCategory}
                  onChange={(e) => {
                    setSearchCategory(e.target.value as any);
                    setSearchQuery(''); // 카테고리 전환 시 검색어 초기화
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 16px', width: '300px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
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
                      <th style={{ minWidth: '80px' }}>승인 상태</th>
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
                            <option value="윈드포일 (남자부)">윈드포일 (남자부)</option>
                            <option value="윙포일 (남자부)">윙포일 (남자부)</option>
                            <option value="혼합오픈 (남자부)">혼합오픈 (남자부)</option>
                            <option value="펀엔포뮬러 (남자부)">펀엔포뮬러 (남자부)</option>
                            <option value="윈드포일 (여자부)">윈드포일 (여자부)</option>
                            <option value="윙포일 (여자부)">윙포일 (여자부)</option>
                            <option value="혼합오픈 (여자부)">혼합오픈 (여자부)</option>
                            <option value="펀엔포뮬러 (여자부)">펀엔포뮬러 (여자부)</option>
                            <option value="윈드포일">윈드포일 (기존)</option>
                            <option value="윙포일">윙포일 (기존)</option>
                            <option value="혼합오픈">혼합오픈 (기존)</option>
                            <option value="펀엔포뮬러">펀엔포뮬러 (기존)</option>
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
                            <option value="S (95)">S (95)</option>
                            <option value="M (100)">M (100)</option>
                            <option value="L (105)">L (105)</option>
                            <option value="XL (110)">XL (110)</option>
                            <option value="남자 S (95)">남자 S (95)</option>
                            <option value="남자 M (100)">남자 M (100)</option>
                            <option value="남자 L (105)">남자 L (105)</option>
                            <option value="남자 XL (110)">남자 XL (110)</option>
                            <option value="남자 XXL (115)">남자 XXL (115)</option>
                            <option value="여자 S (85)">여자 S (85)</option>
                            <option value="여자 M (90)">여자 M (90)</option>
                            <option value="여자 L (95)">여자 L (95)</option>
                            <option value="여자 XL (100)">여자 XL (100)</option>
                            <option value="여자 XXL (105)">여자 XXL (105)</option>
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

                        {/* 참가 승인 상태 */}
                        <td style={{ padding: '8px' }}>
                          <select
                            value={row.status}
                            onChange={(e) => handleCellChange(row.id, 'status', e.target.value)}
                            style={{
                              width: '100%',
                              background: 'white',
                              border: 'none',
                              color: row.status === 'APPROVED' ? '#10B981' : '#F59E0B',
                              fontWeight: '600',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="PENDING" style={{ color: '#F59E0B' }}>대기상태</option>
                            <option value="APPROVED" style={{ color: '#10B981' }}>승인완료</option>
                          </select>
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

        {/* SECTION C: 대회 요강 내용 편집 */}
        {activeSection === 'overview' && (
          <OverviewEditor tenant={tenant} subdomain={subdomain} onSaveSuccess={fetchInitialData} />
        )}

        {/* SECTION D: 개최공시서 내용 편집 */}
        {activeSection === 'notice' && (
          <NoticeEditor tenant={tenant} subdomain={subdomain} onSaveSuccess={fetchInitialData} />
        )}

        {/* SECTION E: 참가신청서 양식 설정 (폼빌더) */}
        {activeSection === 'form-builder' && (
          <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px' }}>신청서 질문 양식 구성 (폼빌더)</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                참가자가 제출할 양식의 질문과 동의서 내용을 자유롭게 설계할 수 있습니다.<br />
                <span style={{ color: '#EF4444', fontWeight: '600' }}>⚠️ 주의:</span> <strong>name (성명), birth (생년월일), gender (성별), phone (전화번호), club (소속), division (참가종목), tshirtSize (티셔츠 사이즈)</strong> 필드는 시스템 참가자 리스트와 직결되는 핵심 질문이므로 필드코드를 임의로 변경하지 않도록 유의해주세요.
              </p>
            </div>

            {formConfigLoading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}><RefreshCw className="animate-spin" size={24} /> 로딩 중...</div>
            ) : (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  {formFields.map((field, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--theme-primary)' }}>Q{idx + 1}.</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (idx === 0) return;
                              const newFields = [...formFields];
                              const temp = newFields[idx];
                              newFields[idx] = newFields[idx - 1];
                              newFields[idx - 1] = temp;
                              setFormFields(newFields);
                            }}
                            disabled={idx === 0}
                            style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (idx === formFields.length - 1) return;
                              const newFields = [...formFields];
                              const temp = newFields[idx];
                              newFields[idx] = newFields[idx + 1];
                              newFields[idx + 1] = temp;
                              setFormFields(newFields);
                            }}
                            disabled={idx === formFields.length - 1}
                            style={{ padding: '4px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: idx === formFields.length - 1 ? 'not-allowed' : 'pointer' }}
                          >
                            <ArrowDown size={16} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!!field.required}
                              onChange={(e) => {
                                const newFields = [...formFields];
                                newFields[idx].required = e.target.checked;
                                setFormFields(newFields);
                              }}
                            />
                            <span>필수 입력</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('이 질문을 삭제하시겠습니까?')) {
                                const newFields = formFields.filter((_, i) => i !== idx);
                                setFormFields(newFields);
                              }
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: 'rgba(239, 68, 68, 0.1)', color: '#F87171', border: '1px solid #EF4444', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            <Trash2 size={12} /> 삭제
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>필드코드 (영문 ID)</label>
                          <input
                            type="text"
                            value={field.id || ''}
                            onChange={(e) => {
                              const newFields = [...formFields];
                              newFields[idx].id = e.target.value;
                              setFormFields(newFields);
                            }}
                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}
                            placeholder="예: name, phone 등"
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>질문 항목 이름 (라벨)</label>
                          <input
                            type="text"
                            value={field.label || ''}
                            onChange={(e) => {
                              const newFields = [...formFields];
                              newFields[idx].label = e.target.value;
                              setFormFields(newFields);
                            }}
                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}
                            placeholder="예: 1. 성명"
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>입력 양식 타입 (유형)</label>
                          <select
                            value={field.type || 'text'}
                            onChange={(e) => {
                              const newFields = [...formFields];
                              newFields[idx].type = e.target.value;
                              setFormFields(newFields);
                            }}
                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'black' }}
                          >
                            <option value="text">Text (한줄 입력)</option>
                            <option value="radio">Radio (점선택)</option>
                            <option value="checkbox">Checkbox (동의 체크박스)</option>
                            <option value="textarea">Textarea (여러줄 설명/동의문구)</option>
                          </select>
                        </div>
                      </div>

                      {/* 타입별 상세 설정 */}
                      {field.type === 'text' && (
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>플레이스홀더 (Placeholder)</label>
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => {
                              const newFields = [...formFields];
                              newFields[idx].placeholder = e.target.value;
                              setFormFields(newFields);
                            }}
                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}
                            placeholder="입력창 힌트 문구"
                          />
                        </div>
                      )}

                      {field.type === 'radio' && (
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>선택 항목 옵션 목록 (쉼표로 구분)</label>
                          <input
                            type="text"
                            value={field.options ? field.options.join(', ') : ''}
                            onChange={(e) => {
                              const newFields = [...formFields];
                              newFields[idx].options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                              setFormFields(newFields);
                            }}
                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}
                            placeholder="예: 남자, 여자 또는 S (95), M (100), L (105)"
                          />
                        </div>
                      )}

                      {field.type === 'checkbox' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>부가 안내/설명 문구 (선택)</label>
                            <input
                              type="text"
                              value={field.notice || ''}
                              onChange={(e) => {
                                const newFields = [...formFields];
                                newFields[idx].notice = e.target.value;
                                setFormFields(newFields);
                              }}
                              style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}
                              placeholder="체크박스 위 설명 문구"
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>체크 동의 라벨 (예: 네. 확인했습니다.)</label>
                            <input
                              type="text"
                              value={field.agreeLabel || ''}
                              onChange={(e) => {
                                const newFields = [...formFields];
                                newFields[idx].agreeLabel = e.target.value;
                                setFormFields(newFields);
                              }}
                              style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}
                              placeholder="동의 버튼 라벨 문구"
                            />
                          </div>
                        </div>
                      )}

                      {field.type === 'textarea' && (
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>약관 및 면책 동의 원문 내용</label>
                          <textarea
                            value={field.textareaContent || ''}
                            onChange={(e) => {
                              const newFields = [...formFields];
                              newFields[idx].textareaContent = e.target.value;
                              setFormFields(newFields);
                            }}
                            rows={3}
                            style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white', fontFamily: 'inherit', resize: 'vertical' }}
                            placeholder="참가자에게 동의를 구하는 상세 텍스트 정보 입력"
                          />
                          <div style={{ marginTop: '8px' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>체크 동의 라벨 (예: 네. 동의합니다.)</label>
                            <input
                              type="text"
                              value={field.agreeLabel || ''}
                              onChange={(e) => {
                                const newFields = [...formFields];
                                newFields[idx].agreeLabel = e.target.value;
                                setFormFields(newFields);
                              }}
                              style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'white' }}
                              placeholder="동의 버튼 라벨 문구"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const newFields = [...formFields, {
                        id: `custom_${Date.now().toString().slice(-4)}`,
                        label: '새 질문 항목',
                        type: 'text',
                        required: false,
                        placeholder: ''
                      }];
                      setFormFields(newFields);
                    }}
                    className="btn-secondary"
                    style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    <Plus size={16} /> 새 질문 추가
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const ids = formFields.map(f => f.id);
                      const hasDuplicates = ids.some((val, i) => ids.indexOf(val) !== i);
                      if (hasDuplicates) {
                        alert('동일한 필드코드(영문 ID)가 존재합니다. 질문간의 코드는 고유해야 합니다.');
                        return;
                      }

                      setFormConfigSaving(true);
                      try {
                        const res = await fetch(`/api/tenant/${subdomain}/form-configs`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fields: formFields }),
                        });
                        if (res.ok) {
                          alert('참가신청서 양식이 성공적으로 저장되었습니다!');
                          await fetchFormConfigs();
                        } else {
                          const errData = await res.json();
                          alert(`저장 실패: ${errData.error || '알 수 없는 오류'}`);
                        }
                      } catch (err: any) {
                        alert(`저장 중 오류 발생: ${err.message}`);
                      } finally {
                        setFormConfigSaving(false);
                      }
                    }}
                    className="btn-primary"
                    disabled={formConfigSaving}
                    style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px', cursor: 'pointer', background: 'var(--theme-primary)', border: 'none', color: 'white', fontWeight: '700' }}
                  >
                    <Save size={16} /> {formConfigSaving ? '저장 중...' : '폼 양식 설정 저장'}
                  </button>
                </div>
              </div>
            )}
          </div>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  
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
                  {formFields.map((field) => {
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

interface OverviewEditorProps {
  tenant: any;
  subdomain: string;
  onSaveSuccess: () => void;
}

function OverviewEditor({ tenant, subdomain, onSaveSuccess }: OverviewEditorProps) {
  // 기본 Fallback 데이터들 (2026년 이순신배)
  const defaultOverview = {
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
    itineraryDay2: '09:00 - 12:00 : 2일차 경기\n12:00 - 13:00 : 중식\n13:00 - 18:00 : 2일차 경기 및 시상식\n18:00 - : 폐회식 및 해산'
  };

  const initialConfig = {
    ...defaultOverview,
    ...(tenant.overviewConfig || {})
  };

  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);

  const handleChange = (field: string, value: string) => {
    setConfig((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/overview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overviewConfig: config })
      });
      const data = await res.json();
      if (res.ok) {
        alert('대회 요강 내용이 성공적으로 업데이트되어 전체 페이지에 반영되었습니다!');
        onSaveSuccess();
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>대회 요강 폼 편집기</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>수정된 요강 내용은 메인 홈페이지의 요강 및 캘린더 일정표에 실시간 적용됩니다.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '0.9rem' }}
          >
            {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
            대회 요강 저장하기
          </button>
        </div>

        {/* 폼 그리드 구성 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1. 기본 개요 세션 */}
          <div>
            <h4 style={{ color: 'var(--theme-primary)', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              1. 대회 기본 개요 명세
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>대회명</label>
                <input type="text" className="form-input" value={config.title} onChange={e => handleChange('title', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>대회 기간</label>
                <input type="text" className="form-input" value={config.duration} onChange={e => handleChange('duration', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>대회 장소</label>
                <input type="text" className="form-input" value={config.location} onChange={e => handleChange('location', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>참가규모</label>
                <input type="text" className="form-input" value={config.scale} onChange={e => handleChange('scale', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>주최</label>
                <input type="text" className="form-input" value={config.host} onChange={e => handleChange('host', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>주관</label>
                <input type="text" className="form-input" value={config.sponsor} onChange={e => handleChange('sponsor', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>후원</label>
                <input type="text" className="form-input" value={config.supporter} onChange={e => handleChange('supporter', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>임시사무실</label>
                <input type="text" className="form-input" value={config.office} onChange={e => handleChange('office', e.target.value)} />
              </div>
            </div>
          </div>

          {/* 2. 일정표 세션 */}
          <div>
            <h4 style={{ color: 'var(--theme-primary)', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              2. 공식 일자별 타임라인 (줄바꿈 단위 기입)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>1일차 일정 정보</label>
                <textarea
                  style={{ minHeight: '150px', lineHeight: '1.6', fontSize: '0.9rem', width: '100%', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  value={config.itineraryDay1}
                  onChange={e => handleChange('itineraryDay1', e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>2일차 일정 정보</label>
                <textarea
                  style={{ minHeight: '150px', lineHeight: '1.6', fontSize: '0.9rem', width: '100%', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                  value={config.itineraryDay2}
                  onChange={e => handleChange('itineraryDay2', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 3. 접수 및 계좌 세션 */}
          <div>
            <h4 style={{ color: 'var(--theme-primary)', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              3. 참가비 수납 및 마감 기일
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>은행명</label>
                <input type="text" className="form-input" value={config.bankName} onChange={e => handleChange('bankName', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>계좌번호</label>
                <input type="text" className="form-input" value={config.accountNo} onChange={e => handleChange('accountNo', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>예금주</label>
                <input type="text" className="form-input" value={config.accountHolder} onChange={e => handleChange('accountHolder', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>개인전 참가비</label>
                <input type="text" className="form-input" value={config.entryFeeIndividual} onChange={e => handleChange('entryFeeIndividual', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>단체전 참가비</label>
                <input type="text" className="form-input" value={config.entryFeeGroup} onChange={e => handleChange('entryFeeGroup', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>접수 마감일</label>
                <input type="text" className="form-input" value={config.deadlineDate} onChange={e => handleChange('deadlineDate', e.target.value)} />
              </div>
            </div>
          </div>

          {/* 4. 안전 및 규칙 정보 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h4 style={{ color: 'var(--theme-primary)', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>
              4. 경기 규칙 및 안전 수칙 (줄바꿈 단위 기입)
            </h4>
            <textarea
              style={{ minHeight: '120px', lineHeight: '1.6', fontSize: '0.9rem', width: '100%', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}
              value={config.rulesNote}
              onChange={e => handleChange('rulesNote', e.target.value)}
            />
          </div>

        </div>
      </div>
    </div>
  );
}

interface NoticeEditorProps {
  tenant: any;
  subdomain: string;
  onSaveSuccess: () => void;
}

function NoticeEditor({ tenant, subdomain, onSaveSuccess }: NoticeEditorProps) {
  const defaultNoticeText = `제20회 미추홀구청장배 전국핀수영대회 개최공시서

제1조 (대회 개요)
1.1 대 회 명 : 제20회 미추홀구청장배 전국핀수영대회
1.2 주 최 : 인천광역시 미추홀구
1.3 주 관 : 인천광역시핀수영협회, 미추홀구체육회
1.4 기 간 : 2026년 9월 12일(토) ~ 13일(일) (2일간)
1.5 장 소 : 문학박태환수영장 (인천광역시 미추홀구 경원대로 526)
1.6 참가인원 : 300명

제2조 (대회 일정)
- 9. 12(토)
  • 10:00 ~ 12:00 : 선수단 현장등록 및 웜업 (문학박태환수영장)
  • 12:00 ~ 13:00 : 중식
  • 13:00 ~ 13:30 : 개회식 (수영장 특설무대)
  • 13:30 ~ 18:00 : 1일차 경기 (문학박태환수영장)
- 9. 13(일)
  • 09:00 ~ 12:00 : 2일차 경기 (문학박태환수영장)
  • 12:00 ~ 13:00 : 중식
  • 13:00 ~ 18:00 : 2일차 경기 및 시상식 (문학박태환수영장)
  • 18:00 ~ : 폐회식 및 해산 (수영장 특설무대)
※ 기상 악화 및 수영장 사정에 따라 경기 시간은 변경될 수 있으며, 세부 일정은 상황에 따라 조정 및 변경될 수 있음.

제3조 (경기 종목 및 참가 자격)
- 일반부 : 대학/일반
- 청소년부 : 고등부, 중등부, 초등부
- 마스터즈 : 마스터즈 1부, 마스터즈 2부, 마스터즈 3부
  ※ 1부 (만 20~29세), 2부 (만 30~39세), 3부 (만 40세 이상)
- 엘리트 : 등록선수 (학생/일반)
- 단체전 : 각 클럽/동호회팀별 릴레이
※ 참가 신청 시 소속 클럽 명확히 작성 필수.
※ 단체전은 남녀 혼성 계영 4x50m 및 4x100m로 진행함.
※ 모든 나이는 2026년 9월 12일을 기준으로 함.

제4조 (참가 신청)
4.1 신청기간 : 2026년 8월 24일(월) 까지
4.2 신청방법 : 홈페이지를 통한 온라인 참가신청서 접수
※ 참가인원은 선착순으로 300명이 충족되면 참가접수기한이 조기에 마감될 수 있다.
※ 참가비가 납부되어야 정식 등록이 완료되며 기한 내 미납 시 참가가 자동 취소됩니다.
4.3 참가비 : 개인전 1종목당 20,000원, 단체전 팀당 50,000원
※ 1인 최대 2종목까지 신청 가능 (단체전 제외).
※ 참가비 입금 시 반드시 '소속_대표자명' 또는 '선수명'으로 입금.
※ 신청기간 이후에는 취소 및 참가비 환불이 불가합니다.

제5조 (시상)
- 개인전 (전 클래스) : 1위: 상장 및 메달, 2위: 상장 및 메달, 3위: 상장 및 메달
- 단체전 (각 클래스별 릴레이) : 1위: 상패 및 메달, 2위: 상패 및 메달, 3위: 상패 및 메달
- 종합시상 (종합) : 종합 우승: 우승기 및 트로피, 종합 준우승: 트로피, 종합 3위: 트로피
※ 각 클래스별 참가자가 3명 미만일 경우 시상만 하고 메달 수여는 제외될 수 있습니다.
※ 종합시상은 각 종목별 점수를 합산하여 산출함 (1위 9점, 2위 7점, 3위 6점, 4위 5점, 5위 4점, 6위 3점, 7위 2점, 8위 1점. 단체전은 배점 2배).

제6조 (제출)
6.1 온라인 참가신청 시 서약서 동의 및 서명 제출
6.2 참가 선수 전원 단체 보험 가입 필수 (소속 동호회/클럽 개별 가입 권장)
6.3 주민등록초본 또는 학생증 사본 (본인 확인용)
6.4 경기 당일 신분증 (주민등록증, 운전면허증 등) 지참 필수

제7조 (경기규칙 및 안전수칙)
7.1 본 대회는 대한수중핀수영협회(KUA) 및 세계수중연맹(CMAS) 핀수영 경기 규칙을 적용합니다.
7.2 안전을 위해 경기 중 안전요원의 통제에 적극 협조해야 하며, 이를 위반 시 퇴장 조치될 수 있습니다.
7.3 준비운동을 철저히 하고 경기 전 심신상태를 점검해 사고를 예방해야 합니다.

제8조 (보험)
8.1 대회 주최측은 대회 참가자를 위한 스포츠안전재단 주최자배상책임공제에 가입합니다.
8.2 참가 선수는 개인 실손의료보험 가입을 적극 권장하며, 경기 중 발생하는 부상에 대해 주최측은 응급조치 외 책임을 지지 않습니다.
8.3 장비 파손 및 분실에 대한 책임은 선수 본인에게 있습니다.

제9조 (항의)
9.1 항의는 각 종목 경기 종료 후 30분 이내에 서면으로 제출해야 합니다.
9.2 이의신청 시 이의신청비 50,000원을 동봉해야 하며, 기각 시 반환하지 않고 협회 기금으로 귀속됩니다.
9.3 심판위원회의 판정이 최종 결정이며, 추가 이의제기는 불가합니다.

제10조 (장비)
10.1 대회 공인 장비(핀, 스노클, 수영복 등) 규정을 준수해야 합니다.
10.2 승인되지 않은 비공인 장비 사용 시 실격 처리될 수 있습니다.
※ 필수 장비 누락 시 경기 참가가 제한될 수 있습니다.

제11조 (기타)
11.1 대회 참가자 전원에게 기념 티셔츠 및 참가 기념품을 제공합니다.
11.2 수영장 내 취사 행위는 절대 금지되며, 쓰레기는 지정된 장소에 분리배출 해야 합니다.
11.3 기타 문의 사항은 인천광역시 핀수영협회 사무국(032-888-2940)으로 문의 바랍니다.

제12조 (오시는길)
문학박태환수영장 (인천광역시 미추홀구 경원대로 526)
※ 위치 및 주차 안내: 수영장 내 지하/지상 주차장 이용 가능하며 당일 참가 선수는 주차료 면제 또는 할인이 제공될 수 있습니다.`;

  const [noticeText, setNoticeText] = useState(
    tenant?.overviewConfig?.noticeText || defaultNoticeText
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenant?.overviewConfig?.noticeText) {
      setNoticeText(tenant.overviewConfig.noticeText);
    }
  }, [tenant]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentConfig = tenant?.overviewConfig || {};
      const res = await fetch(`/api/tenant/${subdomain}/overview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overviewConfig: {
            ...currentConfig,
            noticeText: noticeText
          }
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('개최공시서 내용이 성공적으로 업데이트되어 홈페이지에 반영되었습니다!');
        onSaveSuccess();
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>개최공시서(NOR) 자유 편집기</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>여기에 입력된 텍스트는 메인 홈페이지의 개최공시서 탭 화면에 실시간으로 반영됩니다.</p>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: '700' }}>개최공시서 본문</label>
          <textarea
            style={{
              minHeight: '600px',
              lineHeight: '1.8',
              fontSize: '0.95rem',
              width: '100%',
              padding: '20px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontFamily: 'monospace',
              background: '#f8fafc'
            }}
            value={noticeText}
            onChange={e => setNoticeText(e.target.value)}
            placeholder="개최공시서 내용을 입력하세요..."
          />
        </div>
      </div>
    </div>
  );
}
