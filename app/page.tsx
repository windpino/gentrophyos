'use client';

import React, { useState, useEffect } from 'react';
import { Award, Layers, PlusCircle, CheckCircle2, ChevronRight, Settings, Users, ShieldAlert } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  primaryColor: string;
  rulesSummary: string | null;
  createdAt: string;
}

export default function PlatformMainPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // 폼 상태
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366F1');
  const [rulesSummary, setRulesSummary] = useState('');
  const [createdInfo, setCreatedInfo] = useState<{
    subdomain: string;
    hostEmail: string;
    refereeEmail: string;
  } | null>(null);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 로컬 호스트 포트 감지용
  const [port, setPort] = useState('3000');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPort(window.location.port || '3000');
    }
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      // API 대신 직접 데이터를 가져오거나 간단한 플랫폼 테넌트 조회 API 제작 가능
      // 여기서는 클라이언트 수준에서 /api/tenant 목록을 가져오기 어려우므로 
      // 간단히 DB에서 전체 테넌트를 긁어오는 통합 엔드포인트를 호출
      const res = await fetch('/api/platform/tenants');
      const data = await res.json();
      if (data.tenants) {
        setTenants(data.tenants);
      }
    } catch (e) {
      console.error('테넌트 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setCreatedInfo(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/platform/tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subdomain, primaryColor, rulesSummary }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '생성 실패');
      }

      setSuccessMsg(`대회 채널 '${name}'이 성공적으로 생성되었습니다!`);
      setCreatedInfo({
        subdomain: data.subdomain,
        hostEmail: data.hostEmail,
        refereeEmail: data.refereeEmail,
      });

      // 폼 리셋
      setName('');
      setSubdomain('');
      setRulesSummary('');

      // 리스트 갱신
      fetchTenants();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      {/* 플랫폼 헤더 */}
      <header style={{ textAlign: 'center', marginBottom: '60px' }} className="animate-fade-in">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Layers size={40} style={{ color: 'var(--theme-primary)' }} />
          <h1 style={{ fontSize: '3rem', fontWeight: '800' }} className="gradient-text">
            GenTrophyOS
          </h1>
        </div>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>
          B2B 구독형 경기 및 대회 관리 ERP. 클릭 한 번으로 독자적인 도메인과 실시간 순위 산출 엔진을 탑재한 사이트를 발급받으세요.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '40px' }}>
        
        {/* 왼쪽: 신규 생성 시뮬레이터 (Host Auto-provisioning) */}
        <section className="glass-panel animate-fade-in" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <PlusCircle style={{ color: 'var(--theme-primary)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>1분만에 대회 홈페이지 생성</h2>
          </div>

          <form onSubmit={handleCreateTenant}>
            <div className="form-group">
              <label className="form-label">대회 채널명</label>
              <input
                type="text"
                className="form-input"
                placeholder="예: 전국 수영 마스터즈 대회"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">희망 서브도메인 주소</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="swim-masters"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                  required
                  style={{ flex: 1 }}
                />
                <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>.localhost:{port}</span>
              </div>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                영문 소문자, 숫자, 하이픈(-)만 가능합니다.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">대회 고유 메인 테마 컬러</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{
                    border: 'none',
                    width: '50px',
                    height: '40px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: 'none',
                  }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ maxWidth: '120px' }}
                />
                <div
                  style={{
                    flex: 1,
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: primaryColor,
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">대회 요강 요약</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="참가 자격, 상금, 운영 방식 등을 간략히 입력하세요."
                value={rulesSummary}
                onChange={(e) => setRulesSummary(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            {errorMsg && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #EF4444',
                color: '#F87171',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ShieldAlert size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #10B981',
                color: '#34D399',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={18} />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? '대회 개설 및 프로비저닝 중...' : '대회 홈페이지 즉시 개설'}
            </button>
          </form>

          {/* 생성 완료 후 발급된 계정 정보 노출 */}
          {createdInfo && (
            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px dashed var(--border-color)',
              fontSize: '0.9rem'
            }}>
              <h4 style={{ color: 'var(--text-main)', marginBottom: '12px', fontWeight: '600' }}>발급된 주최자/심판 테스트 계정</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>주최자(Host Admin):</span>
                  <code style={{ color: 'var(--text-highlight)' }}>{createdInfo.hostEmail} / host123</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>공식 심판(Referee):</span>
                  <code style={{ color: 'var(--text-highlight)' }}>{createdInfo.refereeEmail} / ref123</code>
                </div>
              </div>
              <a
                href={`http://${createdInfo.subdomain}.localhost:${port}`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: '16px', padding: '8px' }}
              >
                생성된 사이트로 즉시 이동 <ChevronRight size={16} />
              </a>
            </div>
          )}
        </section>

        {/* 오른쪽: 활성화된 대회 채널 (Active SaaS Sites) */}
        <section className="glass-panel animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <Award style={{ color: 'var(--theme-primary)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>활성화된 대회 서비스 채널</h2>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>대회 채널 목록을 불러오는 중...</p>
          ) : tenants.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>현재 개설된 대회 채널이 없습니다. 첫 대회를 생성해 보세요!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {tenants.map((tenant) => {
                const tenantUrl = `http://${tenant.subdomain}.localhost:${port}`;
                return (
                  <div
                    key={tenant.id}
                    className="glass-panel glass-panel-hover"
                    style={{
                      padding: '20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderColor: `rgba(${parseInt(tenant.primaryColor.slice(1, 3), 16) || 99}, ${parseInt(tenant.primaryColor.slice(3, 5), 16) || 102}, ${parseInt(tenant.primaryColor.slice(5, 7), 16) || 241}, 0.2)`
                    }}
                  >
                    <div style={{ flex: 1, marginRight: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: tenant.primaryColor,
                            display: 'inline-block'
                          }}
                        />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>{tenant.name}</h3>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        {tenant.rulesSummary || '대회 요강 미등록'}
                      </p>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-highlight)', fontWeight: '600' }}>
                        {tenant.subdomain}.localhost:{port}
                      </span>
                    </div>

                    <a
                      href={tenantUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                    >
                      이동 <ChevronRight size={16} />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <footer style={{ marginTop: '80px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        <p>© 2026 GenTrophyOS. All rights reserved.</p>
      </footer>
    </div>
  );
}
