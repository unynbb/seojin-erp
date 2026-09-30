'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { Building2, Users, Package, AlertTriangle, Search, Clock, Plus, RefreshCw } from 'lucide-react';

// 1. Supabase 클라이언트 단일 인스턴스화 (GoTrue 경고 방지)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LINE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function ERPDashboard() {
  const [siteResources, setSiteResources] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [newSite, setNewSite] = useState({
    site: '',
    manager: '',
    workers: 0,
    status: '정상',
  });
  const [editingSite, setEditingSite] = useState<any>(null);

  // 🔄 데이터 로드
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. 현장 목록 조회
      const { data: sitesData, error: sitesError } = await supabase.from('sites').select('*').order('id', { ascending: true });
      if (sitesError) throw sitesError;
      
      const realSites = sitesData || [];
      setSiteResources(realSites);

      // 2. 월별 통계 조회
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('monthly_stats')
        .select('*')
        .order('id', { ascending: true });

      if (monthlyError) throw monthlyError;

      if (monthlyData && monthlyData.length > 0) {
        // 중복 없는 월 목록 추출
        const uniqueMonths = Array.from(new Set(monthlyData.map((d) => d.month_name))).filter(Boolean);

        const formattedData = uniqueMonths.map((m) => {
          const monthObj: Record<string, any> = { month: String(m) };
          const currentMonthRows = monthlyData.filter((d) => d.month_name === m);

          currentMonthRows.forEach((row) => {
            if (row.site_name) {
              const siteName = String(row.site_name).trim(); 
              monthObj[siteName] = Number(row.progress_rate) || 0;
              monthObj[`${siteName}_usage`] = Number(row.material_usage) || 0;
            }
          });

          return monthObj;
        });

        console.log('🔍 [디버깅] 가공된 차트 데이터:', formattedData);
        setChartData(formattedData);
      } else {
        setChartData([]);
      }
    } catch (err) {
      console.error('데이터 수신 에러:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchData();
  }, []);

  // 현장 이름 목록 (공백 제거)
  const siteNames = useMemo(() => {
    const names = siteResources.map((s) => s.site ? String(s.site).trim() : '').filter(Boolean);
    console.log('🔍 [디버깅] 추출된 현장 이름 목록(Line/Bar dataKey 기준):', names);
    return names;
  }, [siteResources]);

  // 현장 상태 변경
  const handleStatusChange = async (id: number, newStatus: string) => {
    const { error } = await supabase.from('sites').update({ status: newStatus }).eq('id', id);

    if (error) {
      alert('상태 변경에 실패했습니다.');
    } else {
      setSiteResources((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
    }
  };

  // 신규 현장 추가
  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSite.site || !newSite.manager) {
      alert('현장명과 책임자 이름을 입력해주세요.');
      return;
    }

    const { data, error } = await supabase.from('sites').insert([newSite]).select();

    if (error) {
      alert('현장 추가에 실패했습니다.');
    } else if (data) {
      setSiteResources((prev) => [...prev, data[0]]);
      setIsModalOpen(false);
      setNewSite({ site: '', manager: '', workers: 0, status: '정상' });
      alert('새 현장이 성공적으로 등록되었습니다.');
      fetchData();
    }
  };

  // 현장 삭제
  const handleDeleteSite = async (id: number, siteName: string) => {
    if (!confirm(`'${siteName}' 현장을 삭제하시겠습니까?`)) return;

    const { error } = await supabase.from('sites').delete().eq('id', id);

    if (error) {
      alert('현장 삭제에 실패했습니다.');
    } else {
      setSiteResources((prev) => prev.filter((item) => item.id !== id));
      alert('현장이 삭제되었습니다.');
      fetchData();
    }
  };

  // 수정 모달
  const handleOpenEditModal = (siteData: any) => {
    setEditingSite(siteData);
    setIsEditModalOpen(true);
  };

  const handleUpdateSite = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('sites')
      .update({
        site: editingSite.site,
        manager: editingSite.manager,
        workers: editingSite.workers,
        status: editingSite.status,
      })
      .eq('id', editingSite.id);

    if (error) {
      alert('현장 수정에 실패했습니다.');
    } else {
      setSiteResources((prev) =>
        prev.map((item) => (item.id === editingSite.id ? editingSite : item))
      );
      setIsEditModalOpen(false);
      alert('현장 정보가 수정되었습니다.');
    }
  };

  // 필터링
  const filteredData = useMemo(() => {
    return siteResources.filter((item) => {
      const matchesSearch =
        item.site?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.manager?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === '전체' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [siteResources, searchTerm, statusFilter]);

  const totalWorkers = useMemo(() => {
    return siteResources.reduce((acc, cur) => acc + (Number(cur.workers) || 0), 0);
  }, [siteResources]);

  const avgMaterialStock = useMemo(() => {
    if (!siteResources.length) return '0';
    const total = siteResources.reduce((acc, cur) => acc + (Number(cur.material_stock) || 0), 0);
    return (total / siteResources.length).toFixed(1);
  }, [siteResources]);

  const issueCount = useMemo(() => {
    return siteResources.filter((item) => item.status && item.status !== '정상').length;
  }, [siteResources]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-800">
      {/* 헤더 */}
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">서진CNS 건설 ERP 관리 시스템</h1>
          <p className="mt-1 text-sm text-slate-500">실시간 현장 인력, 자재 및 공정률 현황 대시보드</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm border border-slate-200">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-slate-600">실시간 동기화</span>
          </div>
        </div>
      </header>

      {/* KPI 카드 목록 */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm border border-slate-200/80">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">운영 중인 현장</p>
            <p className="text-2xl font-bold text-slate-900">{siteResources.length}개소</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm border border-slate-200/80">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">금일 투입 인원</p>
            <p className="text-2xl font-bold text-slate-900">{totalWorkers}명</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm border border-slate-200/80">
          <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">평균 자재 준비율</p>
            <p className="text-2xl font-bold text-slate-900">{avgMaterialStock}%</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm border border-slate-200/80">
          <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">이슈 발생 현장</p>
            <p className="text-2xl font-bold text-rose-600">{issueCount}개소</p>
          </div>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="mb-8 flex flex-col gap-6">
        {/* 공정 진척도 차트 */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200/80">
          <h2 className="mb-4 text-base font-bold text-slate-800">월별 현장별 공정 진척도 (%)</h2>
          <div style={{ width: '100%', height: '300px', minHeight: '300px' }}>
            {isMounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} fontSize={12} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                  {siteNames.map((site, index) => (
                    <Line
                      key={site}
                      type="monotone"
                      dataKey={site}
                      name={site}
                      stroke={LINE_COLORS[index % LINE_COLORS.length]}
                      strokeWidth={3}
                      dot={{ r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                {loading ? '차트 데이터를 불러오는 중입니다...' : '차트에 표시할 데이터가 없거나 매핑할 현장이 없습니다.'}
              </div>
            )}
          </div>
        </div>

        {/* 자재 소모량 차트 */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200/80">
          <h2 className="mb-4 text-base font-bold text-slate-800">월별 현장별 자재 소모량</h2>
          <div style={{ width: '100%', height: '300px', minHeight: '300px' }}>
            {isMounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                  {siteNames.map((site, index) => (
                    <Bar
                      key={site}
                      dataKey={`${site}_usage`}
                      name={`${site}`}
                      fill={LINE_COLORS[index % LINE_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                {loading ? '차트 데이터를 불러오는 중입니다...' : '차트에 표시할 데이터가 없거나 매핑할 현장이 없습니다.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 테이블 영역 */}
      <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200/80">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-800">현장 관리 목록</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="현장명 / 책임자 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="전체">전체 상태</option>
              <option value="정상">🟢 정상</option>
              <option value="자재부족">🔴 자재부족</option>
              <option value="인력지연">🟡 인력지연</option>
            </select>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> 현장 추가
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">데이터를 불러오는 중입니다...</div>
          ) : filteredData.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">조회된 현장 데이터가 없습니다.</div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-center">현장명</th>
                  <th className="px-4 py-3 text-center">책임자</th>
                  <th className="px-4 py-3 text-center">투입 인원</th>
                  <th className="px-4 py-3 text-center">상태</th>
                  <th className="px-4 py-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 text-center font-semibold text-slate-900">{row.site}</td>
                    <td className="px-4 py-3.5 text-center text-slate-600">{row.manager}</td>
                    <td className="px-4 py-3.5 text-center font-medium text-slate-800">{row.workers}명</td>
                    <td className="px-4 py-3.5 text-center">
                      <select
                        value={row.status || '정상'}
                        onChange={(e) => handleStatusChange(row.id, e.target.value)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold border cursor-pointer focus:outline-none ${
                          row.status === '정상'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : row.status === '자재부족'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <option value="정상">🟢 정상</option>
                        <option value="자재부족">🔴 자재부족</option>
                        <option value="인력지연">🟡 인력지연</option>
                      </select>
                    </td>
                    <td className="px-4 py-3.5 flex justify-center gap-2">
                      <button
                        onClick={() => handleOpenEditModal(row)}
                        className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm transition-colors"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteSite(row.id, row.site)}
                        className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-rose-600 border border-rose-200 hover:bg-rose-50 shadow-sm transition-colors"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 등록 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-slate-900">🏗️ 신규 현장 등록</h3>
            <form onSubmit={handleAddSite} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">현장명</label>
                <input
                  type="text"
                  required
                  placeholder="예: 청주 강서동 현장"
                  value={newSite.site}
                  onChange={(e) => setNewSite({ ...newSite, site: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">현장 책임자</label>
                <input
                  type="text"
                  required
                  placeholder="예: 홍길동"
                  value={newSite.manager}
                  onChange={(e) => setNewSite({ ...newSite, manager: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">투입 인원 (명)</label>
                <input
                  type="number"
                  min="0"
                  value={newSite.workers}
                  onChange={(e) => setNewSite({ ...newSite, workers: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">초기 상태</label>
                <select
                  value={newSite.status}
                  onChange={(e) => setNewSite({ ...newSite, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="정상">🟢 정상</option>
                  <option value="자재부족">🔴 자재부족</option>
                  <option value="인력지연">🟡 인력지연</option>
                </select>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {isEditModalOpen && editingSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-slate-900">현장 정보 수정</h3>
            <form onSubmit={handleUpdateSite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">현장명</label>
                <input
                  type="text"
                  value={editingSite.site}
                  onChange={(e) => setEditingSite({ ...editingSite, site: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">책임자</label>
                <input
                  type="text"
                  value={editingSite.manager}
                  onChange={(e) => setEditingSite({ ...editingSite, manager: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">투입 인원 (명)</label>
                <input
                  type="number"
                  value={editingSite.workers}
                  onChange={(e) => setEditingSite({ ...editingSite, workers: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">상태</label>
                <select
                  value={editingSite.status}
                  onChange={(e) => setEditingSite({ ...editingSite, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="정상">🟢 정상</option>
                  <option value="자재부족">🔴 자재부족</option>
                  <option value="인력지연">🟡 인력지연</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  수정 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}