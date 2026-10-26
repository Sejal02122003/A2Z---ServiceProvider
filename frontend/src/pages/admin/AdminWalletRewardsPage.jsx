import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wallet,
  Settings,
  Download,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  Save,
  PlusCircle,
  MinusCircle,
  Percent,
  Gift,
  Sparkles,
  IndianRupee,
  RefreshCw,
  Clock
} from 'lucide-react';
import { walletsApi } from '../../api/walletsApi';

export default function AdminWalletRewardsPage() {
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Settings State
  const [settings, setSettings] = useState({
    enabled: true,
    welcomeBonusEnabled: true,
    welcomeBonusAmount: 1000,
    walletDiscountPercentage: 20,
    minimumBookingAmount: 0,
    serviceCreditEnabled: true,
    serviceCreditPercentage: 15,
    serviceCreditMaxAmount: 0,
    serviceCreditMinBookingAmount: 0,
    serviceCreditApplicablePaymentMethods: ['ONLINE', 'CASH'],
    serviceCreditVersion: 1,
    auditLog: [],
    updatedAt: null,
    updatedBy: null,
  });

  // Modal State for "Edit Config"
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  // Users State (Ledger)
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'customer' | 'labour'
  const [balanceFilter, setBalanceFilter] = useState('ALL'); // 'ALL' | 'HAS_BALANCE' | 'ZERO_BALANCE'
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  // Selected User Detail / Adjustment Modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistoryLoading, setUserHistoryLoading] = useState(false);
  const [userWalletData, setUserWalletData] = useState(null);

  // Manual Adjustment State
  const [adjustAction, setAdjustAction] = useState('CREDIT'); // 'CREDIT' | 'DEBIT'
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Form edit temporary states
  const [editForm, setEditForm] = useState({
    enabled: true,
    walletDiscountPercentage: 20,
    minimumBookingAmount: 0,
    welcomeBonusEnabled: true,
    welcomeBonusAmount: 1000,
    serviceCreditEnabled: true,
    serviceCreditPercentage: 15,
  });

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await walletsApi.getAdminWalletSettings();
      if (res.success && res.data) {
        const s = res.data.settings || res.data;
        const normalized = {
          enabled: s.enabled !== undefined ? s.enabled : true,
          welcomeBonusEnabled: s.welcomeBonusEnabled !== undefined ? s.welcomeBonusEnabled : true,
          welcomeBonusAmount: s.welcomeBonusAmount ?? 1000,
          walletDiscountPercentage: s.walletDiscountPercentage ?? 20,
          minimumBookingAmount: s.minimumBookingAmount ?? 0,
          serviceCreditEnabled: s.serviceCreditEnabled !== undefined ? s.serviceCreditEnabled : true,
          serviceCreditPercentage: s.serviceCreditPercentage ?? 15,
          serviceCreditMaxAmount: s.serviceCreditMaxAmount ?? 0,
          serviceCreditMinBookingAmount: s.serviceCreditMinBookingAmount ?? 0,
          serviceCreditApplicablePaymentMethods: s.serviceCreditApplicablePaymentMethods || ['ONLINE', 'CASH'],
          serviceCreditVersion: s.serviceCreditVersion ?? 1,
          auditLog: Array.isArray(s.auditLog) ? s.auditLog : [],
          updatedAt: s.updatedAt,
          updatedBy: s.updatedBy,
        };
        setSettings(normalized);
        setEditForm({
          enabled: normalized.enabled,
          walletDiscountPercentage: normalized.walletDiscountPercentage,
          minimumBookingAmount: normalized.minimumBookingAmount,
          welcomeBonusEnabled: normalized.welcomeBonusEnabled,
          welcomeBonusAmount: normalized.welcomeBonusAmount,
          serviceCreditEnabled: normalized.serviceCreditEnabled,
          serviceCreditPercentage: normalized.serviceCreditPercentage,
        });
      }
    } catch (err) {
      console.error('Failed to load wallet settings:', err);
      setErrorMsg(err.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Users
  const fetchUsers = useCallback(async (page = 1, query = '', role = 'all') => {
    try {
      setUsersLoading(true);
      const res = await walletsApi.getAdminUserWallets({
        page,
        limit: itemsPerPage,
        search: query,
        role: role !== 'all' ? role : undefined,
      });
      if (res.success && res.data) {
        setUsers(res.data.users || []);
        setCurrentPage(res.data.pagination?.page || 1);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalCount(res.data.pagination?.total || (res.data.users || []).length);
      }
    } catch (err) {
      console.error('Failed to load user wallets:', err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchUsers(currentPage, searchTerm, roleFilter);
  }, [currentPage, roleFilter, fetchUsers]);

  // Handle Search Input
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers(1, searchTerm, roleFilter);
  };

  // Filtered users by balance filter
  const filteredUsers = useMemo(() => {
    if (balanceFilter === 'HAS_BALANCE') {
      return users.filter((u) => Number(u.balance) > 0);
    }
    if (balanceFilter === 'ZERO_BALANCE') {
      return users.filter((u) => !u.balance || Number(u.balance) <= 0);
    }
    return users;
  }, [users, balanceFilter]);

  // Aggregate Metrics for Top Cards
  const metrics = useMemo(() => {
    let totalBalance = 0;
    let totalCredits = 0;
    users.forEach((u) => {
      totalBalance += Number(u.balance) || 0;
      totalCredits += Number(u.totalCredits) || 0;
    });
    return {
      totalBalance,
      totalCredits,
      walletPercentage: settings.walletDiscountPercentage,
      welcomeBonus: settings.welcomeBonusAmount,
      totalUsers: totalCount || users.length,
    };
  }, [users, settings, totalCount]);

  // Save Settings from Modal
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSuccessMsg('');
    setErrorMsg('');

    const discountVal = Number(editForm.walletDiscountPercentage);
    if (isNaN(discountVal) || discountVal < 0 || discountVal > 100) {
      alert('Wallet deduction percentage must be between 0% and 100%');
      setSavingSettings(false);
      return;
    }

    const bonusVal = Number(editForm.welcomeBonusAmount);
    if (isNaN(bonusVal) || !Number.isInteger(bonusVal) || bonusVal < 500 || bonusVal > 1500) {
      alert('Welcome bonus amount must be an integer between ₹500 and ₹1,500');
      setSavingSettings(false);
      return;
    }

    const minBookingVal = Number(editForm.minimumBookingAmount);
    if (isNaN(minBookingVal) || minBookingVal < 0) {
      alert('Minimum booking amount must be a positive number');
      setSavingSettings(false);
      return;
    }

    try {
      const res = await walletsApi.updateAdminWalletSettings({
        enabled: Boolean(editForm.enabled),
        walletDiscountPercentage: discountVal,
        minimumBookingAmount: minBookingVal,
        welcomeBonusEnabled: Boolean(editForm.welcomeBonusEnabled),
        welcomeBonusAmount: bonusVal,
        serviceCreditEnabled: Boolean(editForm.serviceCreditEnabled),
        serviceCreditPercentage: Number(editForm.serviceCreditPercentage) || 15,
        serviceCreditMaxAmount: Number(settings.serviceCreditMaxAmount) || 0,
        serviceCreditMinBookingAmount: Number(settings.serviceCreditMinBookingAmount) || 0,
        serviceCreditApplicablePaymentMethods: settings.serviceCreditApplicablePaymentMethods,
      });

      if (res.success) {
        const updated = res.data?.settings || res.data;
        setSettings((prev) => ({
          ...prev,
          enabled: updated.enabled !== undefined ? updated.enabled : editForm.enabled,
          walletDiscountPercentage: updated.walletDiscountPercentage ?? discountVal,
          minimumBookingAmount: updated.minimumBookingAmount ?? minBookingVal,
          welcomeBonusEnabled: updated.welcomeBonusEnabled !== undefined ? updated.welcomeBonusEnabled : editForm.welcomeBonusEnabled,
          welcomeBonusAmount: updated.welcomeBonusAmount ?? bonusVal,
          serviceCreditEnabled: updated.serviceCreditEnabled !== undefined ? updated.serviceCreditEnabled : editForm.serviceCreditEnabled,
          serviceCreditPercentage: updated.serviceCreditPercentage ?? editForm.serviceCreditPercentage,
          updatedAt: updated.updatedAt || new Date().toISOString(),
        }));
        setIsEditingSettings(false);
        setSuccessMsg('Wallet deduction & rewards configuration successfully updated!');
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed to update wallet settings:', err);
      alert(err.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Inspect User
  const handleInspectUser = async (user) => {
    setSelectedUser(user);
    setUserHistoryLoading(true);
    setAdjustAmount('');
    setAdjustReason('');
    try {
      const res = await walletsApi.getAdminUserWalletDetails(user.userId || user._id);
      if (res.success) {
        setUserWalletData(res.data);
      }
    } catch (err) {
      console.error('Failed to load user wallet details:', err);
    } finally {
      setUserHistoryLoading(false);
    }
  };

  // Submit Manual Adjustment
  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    const targetUserId = selectedUser?.userId || selectedUser?._id;
    if (!targetUserId || !adjustAmount || Number(adjustAmount) <= 0) return;
    setAdjustSubmitting(true);

    try {
      const res = await walletsApi.adjustAdminUserWallet(targetUserId, {
        action: adjustAction,
        amount: Number(adjustAmount),
        reason: adjustReason || 'Admin Manual Adjustment',
      });

      if (res.success) {
        const refreshed = await walletsApi.getAdminUserWalletDetails(targetUserId);
        if (refreshed.success) {
          setUserWalletData(refreshed.data);
        }
        fetchUsers(currentPage, searchTerm, roleFilter);
        setAdjustAmount('');
        setAdjustReason('');
        setSuccessMsg(`Successfully applied ${adjustAction === 'CREDIT' ? 'credit' : 'debit'} of ₹${adjustAmount}`);
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      alert(err.message || 'Failed to adjust user wallet');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredUsers.length === 0) return;

    const headers = ['User ID', 'Customer Name', 'Phone', 'Role', 'Wallet Balance', 'Welcome Credit', 'Lifetime Credits', 'Lifetime Debits', 'Registered Date'];
    const rows = filteredUsers.map((u) => [
      u.userId || u._id,
      u.userName || u.fullName || 'N/A',
      u.userPhone || u.phone || 'N/A',
      u.role || 'customer',
      u.balance || 0,
      u.welcomeBonusCredited ? 'Credited' : 'Pending',
      u.totalCredits || 0,
      u.totalDebits || 0,
      u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `wallet_rewards_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 relative max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Toast Notification */}
      {successMsg && (
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-sm font-semibold shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Section matching screenshot */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            Wallet & Rewards Ledger
            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
              {settings.walletDiscountPercentage}%
            </span>
          </h1>
          <p className="text-sm text-slate-500">Analytics and history of customer wallets and reward deductions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditForm({
                enabled: settings.enabled,
                walletDiscountPercentage: settings.walletDiscountPercentage,
                minimumBookingAmount: settings.minimumBookingAmount,
                welcomeBonusEnabled: settings.welcomeBonusEnabled,
                welcomeBonusAmount: settings.welcomeBonusAmount,
                serviceCreditEnabled: settings.serviceCreditEnabled,
                serviceCreditPercentage: settings.serviceCreditPercentage,
              });
              setIsEditingSettings(true);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-xs transition hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" /> Edit Config
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredUsers.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards matching screenshot */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: ALL-TIME WALLET BALANCE (or Revenue theme) */}
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-800/70">MAX WALLET USAGE LIMIT</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-700">
              {loading ? '...' : `${settings.walletDiscountPercentage}%`}
            </span>
          </div>
        </div>

        {/* Card 2: THIS MONTH / ACTIVE BONUS */}
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-800/70">WELCOME BONUS PER USER</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-700">
              ₹{loading ? '...' : Number(settings.welcomeBonusAmount || 1000).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Card 3: FILTERED TOTAL / TOTAL USERS */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">TOTAL REGISTERED WALLETS</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {loading ? '...' : totalCount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls Bar matching screenshot */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
          >
            <option value="all">All Roles</option>
            <option value="customer">Customers</option>
            <option value="labour">Service Providers</option>
          </select>

          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
          >
            <option value="ALL">All Balances</option>
            <option value="HAS_BALANCE">Has Balance (&gt; ₹0)</option>
            <option value="ZERO_BALANCE">Zero Balance (₹0)</option>
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search ID, customer, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-4 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-200"
          />
        </form>
      </div>

      {/* Transactions / Wallets Ledger Card matching screenshot */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-slate-900">Transactions Ledger</h3>
          <span className="text-xs font-semibold text-slate-500">Click a row for details</span>
        </div>

        <div className="p-0 overflow-x-auto">
          {usersLoading ? (
            <div className="p-12 text-center text-sm font-medium text-slate-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span>Loading ledger data...</span>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">User ID & Date</th>
                  <th className="px-6 py-3 font-semibold">Customer</th>
                  <th className="px-6 py-3 font-semibold">Role</th>
                  <th className="px-6 py-3 font-semibold">Welcome Credit</th>
                  <th className="px-6 py-3 font-semibold text-right">Available Balance</th>
                  <th className="px-6 py-3 font-semibold text-right">Total Credits</th>
                  <th className="px-6 py-3 font-semibold text-right">Total Debits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((item) => {
                    const uid = String(item.userId || item._id || '');
                    const shortId = uid ? `#${uid.slice(-6)}` : '#—';
                    const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A';
                    const name = item.userName || item.fullName || 'Unnamed User';
                    const phone = item.userPhone || item.phone || '';

                    return (
                      <tr
                        key={uid}
                        onClick={() => handleInspectUser(item)}
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{shortId}</p>
                          <p className="text-xs text-slate-400">{dateStr}</p>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">
                          <div>
                            <span className="font-bold text-slate-900">{name}</span>
                            {phone && <span className="block text-xs text-slate-400">{phone}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 capitalize">
                            {item.role || 'customer'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {item.welcomeBonusCredited ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Credited
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-bold text-slate-900">₹{(Number(item.balance) || 0).toLocaleString('en-IN')}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-bold text-blue-600">+ ₹{(Number(item.totalCredits) || 0).toLocaleString('en-IN')}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-bold text-rose-600">- ₹{(Number(item.totalDebits) || 0).toLocaleString('en-IN')}</p>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-medium">
                      No matching wallet records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls matching screenshot */}
        {!usersLoading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-semibold text-slate-700">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of{' '}
              <span className="font-semibold text-slate-700">{totalCount}</span> entries
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* EDIT CONFIG MODAL (Matching PlatformFeePage theme)                       */}
      {/* ========================================================================= */}
      {isEditingSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Settings className="h-4 w-4 text-blue-600" /> Wallet & Rewards Config
              </h3>
              <button
                onClick={() => setIsEditingSettings(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* 1. Master Wallet Toggle */}
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">Master Wallet Engine</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, enabled: true }))}
                    className={`rounded-xl border p-3 text-sm font-bold transition ${
                      editForm.enabled ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Active / Enabled
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, enabled: false }))}
                    className={`rounded-xl border p-3 text-sm font-bold transition ${
                      !editForm.enabled ? 'border-rose-600 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Paused / Disabled
                  </button>
                </div>
              </div>

              {/* 2. Dynamic Deduction Percentage */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-bold text-slate-700">Max Wallet Deduction (%)</label>
                  <span className="text-xs font-bold text-blue-600">{editForm.walletDiscountPercentage}% max</span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={editForm.walletDiscountPercentage}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, walletDiscountPercentage: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 font-mono font-bold"
                  placeholder="20"
                />
                <div className="flex gap-1.5 mt-2">
                  {[0, 10, 15, 20, 25, 30, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, walletDiscountPercentage: preset }))}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                        Number(editForm.walletDiscountPercentage) === preset
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Minimum Booking Amount */}
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">Minimum Booking Amount for Wallet (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editForm.minimumBookingAmount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, minimumBookingAmount: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 font-mono"
                  placeholder="0"
                />
                <p className="text-[11px] text-slate-400 mt-1">Orders below this bill amount cannot use wallet funds (0 = no minimum).</p>
              </div>

              {/* 4. Welcome Bonus */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-bold text-slate-700">Welcome Bonus Credit (₹)</label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.welcomeBonusEnabled}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, welcomeBonusEnabled: e.target.checked }))}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    Enabled
                  </label>
                </div>
                <input
                  type="number"
                  min="500"
                  max="1500"
                  step="1"
                  value={editForm.welcomeBonusAmount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, welcomeBonusAmount: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 font-mono"
                  placeholder="1000"
                />
                <div className="flex gap-1.5 mt-2">
                  {[500, 750, 1000, 1250, 1500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditForm((prev) => ({ ...prev, welcomeBonusAmount: preset }))}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                        Number(editForm.welcomeBonusAmount) === preset
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      ₹{preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4 flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditingSettings(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" /> {savingSettings ? 'Saving...' : 'Save Config'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILS & MANUAL ADJUSTMENT MODAL (Matching PlatformFeePage theme)       */}
      {/* ========================================================================= */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <div>
                <h3 className="font-bold text-slate-900">
                  {selectedUser.userName || selectedUser.fullName || 'User Wallet Details'}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedUser.userPhone || selectedUser.phone || selectedUser.userId || selectedUser._id}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserWalletData(null);
                }}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Financial Summary Box */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-center">
                  <span className="text-[10px] font-bold text-blue-800/70 uppercase tracking-wider block">Balance</span>
                  <span className="text-xl font-black text-blue-700 mt-1 block">
                    ₹{(userWalletData?.wallet?.balance ?? selectedUser.balance ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Credited</span>
                  <span className="text-xl font-black text-emerald-600 mt-1 block">
                    +₹{(userWalletData?.totalCredits ?? selectedUser.totalCredits ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Debited</span>
                  <span className="text-xl font-black text-rose-600 mt-1 block">
                    -₹{(userWalletData?.totalDebits ?? selectedUser.totalDebits ?? 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Manual Adjustment Form */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Post Manual Adjustment
                </span>
                <form onSubmit={handleAdjustmentSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Action</label>
                      <div className="flex gap-1.5 p-1 bg-white rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setAdjustAction('CREDIT')}
                          className={`flex-1 py-1 text-xs font-bold rounded transition ${
                            adjustAction === 'CREDIT' ? 'bg-blue-600 text-white' : 'text-slate-600'
                          }`}
                        >
                          Credit (+)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustAction('DEBIT')}
                          className={`flex-1 py-1 text-xs font-bold rounded transition ${
                            adjustAction === 'DEBIT' ? 'bg-rose-600 text-white' : 'text-slate-600'
                          }`}
                        >
                          Debit (-)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 200"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold outline-none focus:border-blue-600"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Reason</label>
                      <input
                        type="text"
                        placeholder="e.g. Promotional refund"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={adjustSubmitting || !adjustAmount}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      {adjustSubmitting ? 'Posting...' : 'Apply Adjustment'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Transactions Ledger in Modal */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                  Transaction History
                </span>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Context</th>
                        <th className="px-4 py-2.5">Description</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                        <th className="px-4 py-2.5 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {userHistoryLoading ? (
                        <tr>
                          <td colSpan="5" className="p-4 text-center text-slate-400">Loading...</td>
                        </tr>
                      ) : !userWalletData?.transactions || userWalletData.transactions.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-4 text-center text-slate-400">No transactions recorded.</td>
                        </tr>
                      ) : (
                        userWalletData.transactions.map((tx) => (
                          <tr key={tx._id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-slate-400">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700">
                                {tx.context || tx.type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-700 truncate max-w-xs">{tx.description || tx.reason || '—'}</td>
                            <td className={`px-4 py-2.5 text-right font-bold ${tx.type === 'CREDIT' ? 'text-blue-600' : 'text-rose-600'}`}>
                              {tx.type === 'CREDIT' ? '+' : '-'} ₹{Number(tx.amount).toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                              ₹{tx.balanceAfter !== undefined ? Number(tx.balanceAfter).toLocaleString('en-IN') : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4">
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserWalletData(null);
                }}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
