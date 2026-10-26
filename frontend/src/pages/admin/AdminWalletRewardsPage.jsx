import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Gift,
  Percent,
  IndianRupee,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Settings2,
  Sliders,
  Users,
  Eye,
  PlusCircle,
  MinusCircle,
  X
} from 'lucide-react';
import { walletsApi } from '../../api/walletsApi';

export default function AdminWalletRewardsPage() {
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'users'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    updatedAt: null,
    updatedBy: null,
  });

  // Simulator State
  const [testBill, setTestBill] = useState(1000);
  const [testBalance, setTestBalance] = useState(300);
  const [testServiceAmount, setTestServiceAmount] = useState(1000);

  // Users State
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);

  // Selected User Detail Modal / Adjustment Modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userHistoryLoading, setUserHistoryLoading] = useState(false);
  const [userWalletData, setUserWalletData] = useState(null);

  // Adjust balance form state
  const [adjustAction, setAdjustAction] = useState('CREDIT'); // 'CREDIT' | 'DEBIT'
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Load Settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await walletsApi.getAdminWalletSettings();
      if (res.success && res.data) {
        const s = res.data.settings || res.data;
        setSettings({
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
          updatedAt: s.updatedAt,
          updatedBy: s.updatedBy,
        });
      }
    } catch (err) {
      console.error('Failed to load wallet settings:', err);
      setErrorMsg(err.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Users List
  const fetchUsers = useCallback(async (page = 1, query = '') => {
    try {
      setUsersLoading(true);
      const res = await walletsApi.getAdminUserWallets({ page, limit: 10, search: query });
      if (res.success && res.data) {
        setUsers(res.data.users || []);
        setUsersPage(res.data.pagination?.page || 1);
        setUsersTotalPages(res.data.pagination?.totalPages || 1);
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
    if (activeTab === 'users') {
      fetchUsers(usersPage, searchQuery);
    }
  }, [activeTab, usersPage, fetchUsers]);

  const handleSearch = (e) => {
    e.preventDefault();
    setUsersPage(1);
    fetchUsers(1, searchQuery);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    const bonusVal = Number(settings.welcomeBonusAmount);
    if (isNaN(bonusVal) || !Number.isInteger(bonusVal) || bonusVal < 500 || bonusVal > 1500) {
      setErrorMsg('Welcome bonus amount must be a whole rupee amount between ₹500 and ₹1,500');
      setSaving(false);
      return;
    }

    const creditPct = Number(settings.serviceCreditPercentage);
    if (isNaN(creditPct) || creditPct < 0 || creditPct > 100) {
      setErrorMsg('Service credit percentage must be between 0% and 100%');
      setSaving(false);
      return;
    }

    const discountVal = Number(settings.walletDiscountPercentage);
    if (isNaN(discountVal) || !isFinite(discountVal) || discountVal < 0 || discountVal > 100) {
      setErrorMsg('Maximum wallet deduction percentage must be a valid number between 0% and 100%');
      setSaving(false);
      return;
    }

    const minBookingVal = Number(settings.minimumBookingAmount);
    if (isNaN(minBookingVal) || !isFinite(minBookingVal) || minBookingVal < 0) {
      setErrorMsg('Minimum booking amount must be a non-negative number');
      setSaving(false);
      return;
    }

    try {
      const res = await walletsApi.updateAdminWalletSettings({
        enabled: settings.enabled,
        welcomeBonusEnabled: settings.welcomeBonusEnabled,
        welcomeBonusAmount: bonusVal,
        walletDiscountPercentage: Number(settings.walletDiscountPercentage),
        minimumBookingAmount: Number(settings.minimumBookingAmount),
        serviceCreditEnabled: Boolean(settings.serviceCreditEnabled),
        serviceCreditPercentage: creditPct,
        serviceCreditMaxAmount: Number(settings.serviceCreditMaxAmount) || 0,
        serviceCreditMinBookingAmount: Number(settings.serviceCreditMinBookingAmount) || 0,
        serviceCreditApplicablePaymentMethods: settings.serviceCreditApplicablePaymentMethods,
      });

      if (res.success) {
        const updated = res.data?.settings || res.data;
        setSuccessMsg('Wallet & Service Credit settings updated successfully!');
        setSettings({
          enabled: updated.enabled !== undefined ? updated.enabled : settings.enabled,
          welcomeBonusEnabled: updated.welcomeBonusEnabled !== undefined ? updated.welcomeBonusEnabled : settings.welcomeBonusEnabled,
          welcomeBonusAmount: updated.welcomeBonusAmount ?? bonusVal,
          walletDiscountPercentage: updated.walletDiscountPercentage ?? settings.walletDiscountPercentage,
          minimumBookingAmount: updated.minimumBookingAmount ?? settings.minimumBookingAmount,
          serviceCreditEnabled: updated.serviceCreditEnabled !== undefined ? updated.serviceCreditEnabled : settings.serviceCreditEnabled,
          serviceCreditPercentage: updated.serviceCreditPercentage ?? creditPct,
          serviceCreditMaxAmount: updated.serviceCreditMaxAmount ?? settings.serviceCreditMaxAmount,
          serviceCreditMinBookingAmount: updated.serviceCreditMinBookingAmount ?? settings.serviceCreditMinBookingAmount,
          serviceCreditApplicablePaymentMethods: updated.serviceCreditApplicablePaymentMethods || settings.serviceCreditApplicablePaymentMethods,
          serviceCreditVersion: updated.serviceCreditVersion ?? settings.serviceCreditVersion,
          updatedAt: updated.updatedAt,
          updatedBy: updated.updatedBy,
        });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  // Open User Details & Transactions Modal
  const handleInspectUser = async (userItem) => {
    setSelectedUser(userItem);
    setUserModalOpen(true);
    setUserHistoryLoading(true);
    setAdjustAmount('');
    setAdjustReason('');
    try {
      const res = await walletsApi.getAdminUserWalletDetails(userItem.userId);
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
    if (!selectedUser || !adjustAmount || Number(adjustAmount) <= 0) return;
    setAdjustSubmitting(true);
    setErrorMsg('');

    try {
      const res = await walletsApi.adjustAdminUserWallet(selectedUser.userId, {
        action: adjustAction,
        amount: Number(adjustAmount),
        reason: adjustReason || 'Admin Manual Adjustment'
      });

      if (res.success) {
        // Refresh details modal
        const refreshed = await walletsApi.getAdminUserWalletDetails(selectedUser.userId);
        if (refreshed.success) {
          setUserWalletData(refreshed.data);
        }
        // Refresh table list
        fetchUsers(usersPage, searchQuery);
        setAdjustAmount('');
        setAdjustReason('');
      }
    } catch (err) {
      alert(err.message || 'Failed to adjust user wallet');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Calculate live preview
  const previewMaxDiscount = Math.round((testBill * (Number(settings.walletDiscountPercentage) || 0)) / 100);
  const previewActualDiscount = testBill >= (Number(settings.minimumBookingAmount) || 0)
    ? Math.min(Number(testBalance) || 0, previewMaxDiscount)
    : 0;
  const previewPayable = Math.max(0, testBill - previewActualDiscount);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
          <p className="text-sm font-medium text-slate-500">Loading Wallet & Rewards Configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-primary-600 text-white shadow-md shadow-primary-500/20">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Wallet & Rewards</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage user welcome bonuses, service checkout discount rules, and audit user balances.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 self-start">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'settings'
                ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            System Settings & Rules
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'users'
                ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            User Wallets & Audit
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-800 dark:text-rose-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* TAB 1: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Settings Form */}
          <form onSubmit={handleSaveSettings} className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5 text-primary-500" />
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Master Configuration</h2>
                  </div>
                  <p className="text-xs text-slate-500">Toggle wallet availability and discount algorithms.</p>
                </div>
                {/* Master Switch */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                  <span className="ml-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                    {settings.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>

              {/* Setting A: Welcome Bonus */}
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-amber-200/60 dark:border-amber-900/40">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-amber-500" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Welcome Bonus</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Awarded once per new verified customer account upon registration.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.welcomeBonusEnabled}
                      onChange={(e) => setSettings({ ...settings, welcomeBonusEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    <span className="ml-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      {settings.welcomeBonusEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                {/* Currently Active Banner */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-amber-200/80 dark:border-amber-800/40 text-xs shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${settings.enabled && settings.welcomeBonusEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Currently Active Bonus:
                    </span>
                  </div>
                  <div className="text-sm font-black text-amber-600 dark:text-amber-400">
                    {settings.enabled && settings.welcomeBonusEnabled ? `₹${Number(settings.welcomeBonusAmount || 1000).toLocaleString('en-IN')}` : 'Inactive (Disabled)'}
                  </div>
                </div>

                {/* Amount input & presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Bonus Credit Amount (₹500 - ₹1,500)
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Whole rupees only
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">
                      ₹
                    </div>
                    <input
                      type="number"
                      min="500"
                      max="1500"
                      step="1"
                      value={settings.welcomeBonusAmount}
                      onChange={(e) => setSettings({ ...settings, welcomeBonusAmount: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="1000"
                      required
                    />
                  </div>

                  {/* Preset Quick Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[500, 750, 1000, 1250, 1500].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSettings({ ...settings, welcomeBonusAmount: preset })}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                          Number(settings.welcomeBonusAmount) === preset
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                        }`}
                      >
                        ₹{preset.toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>

                  {/* Real-time validation warning */}
                  {(Number(settings.welcomeBonusAmount) < 500 || Number(settings.welcomeBonusAmount) > 1500 || !Number.isInteger(Number(settings.welcomeBonusAmount))) && (
                    <p className="text-xs font-semibold text-rose-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Amount must be a whole rupee value between ₹500 and ₹1,500.
                    </p>
                  )}
                </div>

                {/* Audit metadata */}
                {(settings.updatedAt || settings.updatedBy) && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-amber-200/50 dark:border-amber-900/30 flex flex-wrap items-center justify-between gap-1">
                    <span>
                      Last Updated: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString('en-IN') : 'Default Config'}
                    </span>
                    {settings.updatedBy && (
                      <span>
                        Updated By: {settings.updatedBy.fullName || settings.updatedBy.email || 'Admin'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Setting B: Automatic Service Completion Credit */}
              <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-indigo-200/60 dark:border-indigo-900/40">
                  <div className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-indigo-500" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Service Completion Wallet Credit</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Automatically credits customer wallet upon successful booking completion & payment verification.
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.serviceCreditEnabled}
                      onChange={(e) => setSettings({ ...settings, serviceCreditEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="ml-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      {settings.serviceCreditEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                {/* Currently Active Banner */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-indigo-200/80 dark:border-indigo-800/40 text-xs shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${settings.enabled && settings.serviceCreditEnabled ? 'bg-indigo-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Active Reward Rate:
                    </span>
                  </div>
                  <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                    {settings.enabled && settings.serviceCreditEnabled ? `${settings.serviceCreditPercentage}% (₹150 on ₹1,000)` : 'Inactive (Disabled)'}
                  </div>
                </div>

                {/* Percentage input & presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Credit Percentage (0% - 100%)
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Default: 15%
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={settings.serviceCreditPercentage}
                      onChange={(e) => setSettings({ ...settings, serviceCreditPercentage: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full pr-8 pl-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="15"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 font-bold">
                      %
                    </div>
                  </div>

                  {/* Preset Quick Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[5, 10, 15, 20, 25].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSettings({ ...settings, serviceCreditPercentage: preset })}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                          Number(settings.serviceCreditPercentage) === preset
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional Settings: Max Amount & Min Booking Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Max Credit Cap (₹, 0 = No Cap)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings.serviceCreditMaxAmount}
                      onChange={(e) => setSettings({ ...settings, serviceCreditMaxAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Min Booking Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings.serviceCreditMinBookingAmount}
                      onChange={(e) => setSettings({ ...settings, serviceCreditMinBookingAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Applicable Payment Methods */}
                <div className="pt-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                    Eligible Payment Methods
                  </label>
                  <div className="flex gap-4">
                    {['ONLINE', 'CASH'].map((method) => {
                      const isChecked = settings.serviceCreditApplicablePaymentMethods?.includes(method);
                      return (
                        <label key={method} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const curr = [...(settings.serviceCreditApplicablePaymentMethods || [])];
                              if (e.target.checked) {
                                if (!curr.includes(method)) curr.push(method);
                              } else {
                                const idx = curr.indexOf(method);
                                if (idx > -1) curr.splice(idx, 1);
                              }
                              setSettings({ ...settings, serviceCreditApplicablePaymentMethods: curr });
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          {method === 'ONLINE' ? '💳 Online Payments' : '💵 Cash on Completion'}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-indigo-200/50 dark:border-indigo-900/30 flex items-center justify-between">
                  <span>Configuration Version: v{settings.serviceCreditVersion || 1}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Idempotent • Safe Rollback</span>
                </div>
              </div>

              {/* Setting C: Max Wallet Discount Percentage */}
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60 dark:border-emerald-900/40">
                  <div className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Wallet Deduction Percentage</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Controls the maximum portion of an eligible order amount payable using customer wallet funds.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Currently Active Banner */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-emerald-200/80 dark:border-emerald-800/40 text-xs shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${settings.enabled && Number(settings.walletDiscountPercentage) > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Currently Active Wallet Deduction Limit:
                    </span>
                  </div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {settings.enabled ? `${settings.walletDiscountPercentage}% max deduction` : 'Inactive (Master Wallet Disabled)'}
                  </div>
                </div>

                {/* Percentage input & presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Max Wallet Deduction (0% - 100%)
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Default: 20%
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={settings.walletDiscountPercentage}
                      onChange={(e) => setSettings({ ...settings, walletDiscountPercentage: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full pr-8 pl-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="20"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 font-bold">
                      %
                    </div>
                  </div>

                  {/* Preset Quick Buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[0, 5, 10, 15, 20, 25, 30, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSettings({ ...settings, walletDiscountPercentage: preset })}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                          Number(settings.walletDiscountPercentage) === preset
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                        }`}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>

                  {/* Real-time validation warning */}
                  {(Number(settings.walletDiscountPercentage) < 0 || Number(settings.walletDiscountPercentage) > 100 || isNaN(Number(settings.walletDiscountPercentage))) && (
                    <p className="text-xs font-semibold text-rose-500 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Percentage must be a valid number between 0% and 100%.
                    </p>
                  )}
                </div>

                {/* Setting D: Minimum Booking Amount */}
                <div className="pt-2 border-t border-emerald-200/50 dark:border-emerald-900/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Minimum Booking Bill for Wallet Usage (₹)
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">
                      0 = No minimum
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">
                      ₹
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={settings.minimumBookingAmount}
                      onChange={(e) => setSettings({ ...settings, minimumBookingAmount: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="0"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    If an order amount is less than this value, wallet funds cannot be applied.
                  </p>
                </div>

                {/* Audit metadata */}
                {(settings.updatedAt || settings.updatedBy) && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-emerald-200/50 dark:border-emerald-900/30 flex flex-wrap items-center justify-between gap-1">
                    <span>
                      Last Updated: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString('en-IN') : 'Default Config'}
                    </span>
                    {settings.updatedBy && (
                      <span>
                        Updated By: {settings.updatedBy.fullName || settings.updatedBy.email || 'Admin'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm transition-all shadow-md shadow-primary-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save Settings
                </button>
              </div>
            </div>
          </form>

          {/* Live Simulator Preview */}
          <div className="lg:col-span-5 space-y-6">
            {/* Simulator 1: Service Completion Credit */}
            <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/50 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Service Completion Credit Simulator</h3>
              </div>
              <p className="text-xs text-indigo-200/80 mb-4">
                Calculate automatic cashback reward credited to customer on job completion.
              </p>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-indigo-300 font-medium block mb-1">Eligible Service Base Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={testServiceAmount}
                    onChange={(e) => setTestServiceAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800/90 border border-indigo-700/50 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400 font-semibold"
                  />
                </div>
              </div>

              {(() => {
                const calcCredit = Math.round((testServiceAmount * (Number(settings.serviceCreditPercentage) || 0)) / 100);
                const cappedCredit = (Number(settings.serviceCreditMaxAmount) > 0)
                  ? Math.min(calcCredit, Number(settings.serviceCreditMaxAmount))
                  : calcCredit;
                const finalCredit = (testServiceAmount >= (Number(settings.serviceCreditMinBookingAmount) || 0) && settings.enabled && settings.serviceCreditEnabled)
                  ? cappedCredit
                  : 0;

                return (
                  <div className="bg-slate-900/80 rounded-xl p-4 space-y-2 text-xs border border-indigo-800/50 font-mono">
                    <div className="flex justify-between text-slate-300">
                      <span>Service Base Amount:</span>
                      <span className="font-semibold text-white">₹{testServiceAmount}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Configured Percentage:</span>
                      <span className="font-semibold text-indigo-300">{settings.serviceCreditPercentage}%</span>
                    </div>
                    <div className="h-px bg-slate-800 my-1" />
                    <div className="flex justify-between text-emerald-400 font-bold text-sm">
                      <span>Customer Wallet Credit:</span>
                      <span>+ ₹{finalCredit}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-3 flex gap-2">
                {[500, 1000, 2000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTestServiceAmount(amt)}
                    className="px-2.5 py-1 text-[11px] rounded bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 border border-indigo-700/50 font-medium"
                  >
                    Test ₹{amt} → ₹{Math.round((amt * (Number(settings.serviceCreditPercentage) || 15)) / 100)}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulator 2: Checkout Discount Simulator */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-primary-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Checkout Discount Simulator</h3>
              </div>
              <p className="text-xs text-slate-400 mb-5">
                Preview how the current settings calculate checkout wallet deductions in real time.
              </p>

              {/* Simulator Inputs */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">Simulated Bill Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={testBill}
                    onChange={(e) => setTestBill(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">User's Wallet Balance (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={testBalance}
                    onChange={(e) => setTestBalance(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-400"
                  />
                </div>
              </div>

              {/* Simulator Breakdown */}
              <div className="bg-slate-800/80 rounded-xl p-4 space-y-2.5 text-xs border border-slate-700/60 font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>Eligible Service Bill:</span>
                  <span className="font-semibold text-white">₹{testBill}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Wallet Balance:</span>
                  <span className="font-semibold text-amber-400">₹{testBalance}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Max Limit ({settings.walletDiscountPercentage}%):</span>
                  <span className="font-semibold text-slate-200">₹{previewMaxDiscount}</span>
                </div>
                <div className="h-px bg-slate-700 my-1" />
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Wallet Discount Applied:</span>
                  <span>- ₹{previewActualDiscount}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-sm pt-1">
                  <span>Final Payable Bill:</span>
                  <span className="text-primary-400">₹{previewPayable}</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-slate-800/40 rounded-lg text-[11px] text-slate-400 leading-relaxed">
                Formula: <span className="text-slate-200">MIN(Balance, Bill × {settings.walletDiscountPercentage}%)</span>
                {settings.minimumBookingAmount > 0 && (
                  <span className="block text-amber-400 mt-1">
                    * Minimum bill required: ₹{settings.minimumBookingAmount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER WALLETS AUDIT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 justify-between items-center">
            <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-96">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search user name, phone, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Search
              </button>
            </form>
            <button
              onClick={() => fetchUsers(usersPage, searchQuery)}
              className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1 self-end"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-right">Available Balance</th>
                    <th className="py-3 px-4 text-center">Welcome Bonus</th>
                    <th className="py-3 px-4 text-right">Total Credits</th>
                    <th className="py-3 px-4 text-right">Total Used</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usersLoading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12 text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                        Loading wallets...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12 text-slate-400">
                        No user wallets found.
                      </td>
                    </tr>
                  ) : (
                    users.map((item) => (
                      <tr key={item.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.userName || 'Unnamed User'}
                          </div>
                          <div className="text-xs text-slate-400">
                            {item.userPhone || item.userEmail || 'No phone'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {item.role || 'CUSTOMER'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                          ₹{item.balance || 0}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {item.welcomeBonusCredited ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Credited
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Pending</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          + ₹{item.totalCredits || 0}
                        </td>
                        <td className="py-3.5 px-4 text-right text-xs font-medium text-rose-600 dark:text-rose-400">
                          - ₹{item.totalDebits || 0}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleInspectUser(item)}
                            className="px-3 py-1.5 bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-900/60 text-primary-600 dark:text-primary-400 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 mx-auto"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Inspect & Adjust
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {usersTotalPages > 1 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">
                  Page {usersPage} of {usersTotalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={usersPage <= 1}
                    onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-200"
                  >
                    Previous
                  </button>
                  <button
                    disabled={usersPage >= usersTotalPages}
                    onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* USER WALLET INSPECTION & ADJUSTMENT MODAL */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {selectedUser?.userName || 'User Wallet'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedUser?.userPhone || selectedUser?.userEmail || selectedUser?.userId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUserModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60">
                  <div className="text-xs text-slate-400 mb-1">Available Balance</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    ₹{userWalletData?.wallet?.balance || selectedUser?.balance || 0}
                  </div>
                </div>
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Total Credited</div>
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    + ₹{userWalletData?.totalCredits || selectedUser?.totalCredits || 0}
                  </div>
                </div>
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-100 dark:border-rose-900/40">
                  <div className="text-xs text-rose-600 dark:text-rose-400 mb-1">Total Debited</div>
                  <div className="text-xl font-bold text-rose-700 dark:text-rose-300">
                    - ₹{userWalletData?.totalDebits || selectedUser?.totalDebits || 0}
                  </div>
                </div>
              </div>

              {/* Manual Adjustment Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary-500" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Manual Wallet Adjustment</h4>
                </div>

                <form onSubmit={handleAdjustmentSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">Action</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAdjustAction('CREDIT')}
                          className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all ${
                            adjustAction === 'CREDIT'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustAction('DEBIT')}
                          className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all ${
                            adjustAction === 'DEBIT'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <MinusCircle className="w-3.5 h-3.5" /> Deduct
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 100"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">Reason / Note</label>
                      <input
                        type="text"
                        placeholder="e.g. Compensation"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={adjustSubmitting || !adjustAmount}
                      className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {adjustSubmitting ? 'Submitting...' : 'Apply Adjustment'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Transactions History Table */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Transaction Audit Log</h4>
                <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 text-slate-400 uppercase">
                      <tr>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5 text-right">Amount</th>
                        <th className="p-2.5 text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {userHistoryLoading ? (
                        <tr>
                          <td colSpan="5" className="text-center py-6 text-slate-400">
                            Loading history...
                          </td>
                        </tr>
                      ) : !userWalletData?.transactions || userWalletData.transactions.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-6 text-slate-400">
                            No transactions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        userWalletData.transactions.map((tx) => (
                          <tr key={tx._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-2.5 text-slate-500 dark:text-slate-400">
                              {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  tx.type === 'CREDIT'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                }`}
                              >
                                {tx.context || tx.type}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-700 dark:text-slate-300 font-medium">
                              {tx.description || tx.reason || 'Wallet update'}
                            </td>
                            <td
                              className={`p-2.5 text-right font-bold ${
                                tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {tx.type === 'CREDIT' ? '+' : '-'} ₹{tx.amount}
                            </td>
                            <td className="p-2.5 text-right font-medium text-slate-900 dark:text-white">
                              ₹{tx.balanceAfter !== undefined ? tx.balanceAfter : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
