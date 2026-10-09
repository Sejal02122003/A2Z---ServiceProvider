import React, { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  BellRing,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Play,
  RotateCcw,
  Search,
  Filter,
  Users,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  Info,
  CalendarClock,
  Phone,
  Check,
  AlertCircle,
  ChevronRight,
  X,
} from 'lucide-react'
import { bookingReminderApi } from '../../api/bookingReminderApi.js'

export function AdminBookingRemindersPage() {
  const [activeTab, setActiveTab] = useState('upcoming') // 'upcoming' | 'history' | 'settings'
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [triggeringWorker, setTriggeringWorker] = useState(false)
  const [toast, setToast] = useState({ type: '', message: '' })

  // Dashboard Overview
  const [stats, setStats] = useState(null)

  // Settings State
  const [settings, setSettings] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)

  // Upcoming Queue State
  const [upcomingReminders, setUpcomingReminders] = useState([])
  const [upcomingPage, setUpcomingPage] = useState(1)
  const [upcomingTotalPages, setUpcomingTotalPages] = useState(1)
  const [upcomingTotal, setUpcomingTotal] = useState(0)
  const [upcomingFilterRole, setUpcomingFilterRole] = useState('ALL')
  const [upcomingFilterType, setUpcomingFilterType] = useState('ALL')
  const [upcomingSearch, setUpcomingSearch] = useState('')

  // History State
  const [historyReminders, setHistoryReminders] = useState([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyFilterStatus, setHistoryFilterStatus] = useState('ALL')
  const [historyFilterRole, setHistoryFilterRole] = useState('ALL')
  const [historySearch, setHistorySearch] = useState('')

  // Error Inspection Modal
  const [selectedFailedReminder, setSelectedFailedReminder] = useState(null)
  const [retryingId, setRetryingId] = useState(null)

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast({ type: '', message: '' }), 4000)
  }

  // Load Overview & Settings
  const loadInitialData = useCallback(async () => {
    try {
      const [overviewRes, settingsRes] = await Promise.all([
        bookingReminderApi.getOverview(),
        bookingReminderApi.getSettings(),
      ])
      if (overviewRes?.data?.stats) setStats(overviewRes.data.stats)
      if (settingsRes?.data?.settings) setSettings(settingsRes.data.settings)
    } catch (err) {
      console.error('Failed to load reminder dashboard stats:', err)
      showToast('error', 'Failed to load reminder statistics.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Load Upcoming Queue
  const loadUpcoming = useCallback(async () => {
    try {
      const res = await bookingReminderApi.getUpcomingReminders({
        page: upcomingPage,
        limit: 15,
        recipientRole: upcomingFilterRole,
        reminderType: upcomingFilterType,
        search: upcomingSearch,
      })
      if (res?.data) {
        setUpcomingReminders(res.data.reminders || [])
        setUpcomingTotal(res.data.pagination?.total || 0)
        setUpcomingTotalPages(res.data.pagination?.totalPages || 1)
      }
    } catch (err) {
      console.error('Failed to load upcoming reminders:', err)
    }
  }, [upcomingPage, upcomingFilterRole, upcomingFilterType, upcomingSearch])

  // Load History
  const loadHistory = useCallback(async () => {
    try {
      const res = await bookingReminderApi.getReminderHistory({
        page: historyPage,
        limit: 15,
        status: historyFilterStatus,
        recipientRole: historyFilterRole,
        search: historySearch,
      })
      if (res?.data) {
        setHistoryReminders(res.data.reminders || [])
        setHistoryTotal(res.data.pagination?.total || 0)
        setHistoryTotalPages(res.data.pagination?.totalPages || 1)
      }
    } catch (err) {
      console.error('Failed to load reminder history:', err)
    }
  }, [historyPage, historyFilterStatus, historyFilterRole, historySearch])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  useEffect(() => {
    if (activeTab === 'upcoming') loadUpcoming()
    if (activeTab === 'history') loadHistory()
  }, [activeTab, loadUpcoming, loadHistory])

  const handleRefresh = () => {
    setRefreshing(true)
    loadInitialData()
    if (activeTab === 'upcoming') loadUpcoming()
    if (activeTab === 'history') loadHistory()
  }

  const handleTriggerCycle = async () => {
    setTriggeringWorker(true)
    try {
      const res = await bookingReminderApi.triggerWorkerCycle()
      showToast('success', res.message || 'Worker cycle executed successfully')
      handleRefresh()
    } catch (err) {
      console.error('Worker cycle trigger error:', err)
      showToast('error', 'Failed to trigger worker cycle')
    } finally {
      setTriggeringWorker(false)
    }
  }

  const handleSaveSettings = async (e) => {
    e?.preventDefault()
    if (!settings) return
    setSavingSettings(true)
    try {
      const res = await bookingReminderApi.updateSettings(settings)
      if (res?.data?.settings) setSettings(res.data.settings)
      showToast('success', 'Reminder configuration saved successfully')
      loadInitialData()
    } catch (err) {
      console.error('Failed to update reminder settings:', err)
      showToast('error', 'Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleRetryReminder = async (id) => {
    setRetryingId(id)
    try {
      await bookingReminderApi.retryReminder(id)
      showToast('success', 'Reminder queued and retried immediately')
      setSelectedFailedReminder(null)
      handleRefresh()
    } catch (err) {
      console.error('Retry failed:', err)
      showToast('error', err?.response?.data?.message || 'Retry failed')
    } finally {
      setRetryingId(null)
    }
  }

  const formatIST = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const getTimeRemaining = (scheduledAt) => {
    const diffMs = new Date(scheduledAt) - new Date()
    if (diffMs <= 0) return 'Due now'
    const mins = Math.floor(diffMs / (1000 * 60))
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `in ${days}d ${hours % 24}h`
    if (hours > 0) return `in ${hours}h ${mins % 60}m`
    return `in ${mins} mins`
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading Booking Reminder Alert System...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast.message && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 transition transform animate-in slide-in-from-top-2 ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          )}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 shadow-xl border border-indigo-900/40">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider border border-indigo-500/30">
              <BellRing className="w-3.5 h-3.5" />
              Automated Notification Scheduler
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Booking Date & Time Reminders
            </h1>
            <p className="text-indigo-200 text-sm max-w-2xl">
              Configurable automated push & in-app alerts dispatched 24 hours and 1 hour before scheduled customer appointments to reduce no-shows and keep vendors on schedule.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTriggerCycle}
              disabled={triggeringWorker}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md transition disabled:opacity-50"
            >
              <Play className={`w-4 h-4 ${triggeringWorker ? 'animate-spin' : ''}`} />
              Run Due Batch
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition backdrop-blur-sm border border-white/10"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Sync
            </button>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-8 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-medium text-indigo-300 block mb-1">System State</span>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  settings?.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              <span className="text-lg font-bold text-white">
                {settings?.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-medium text-amber-300 block mb-1">Pending Queue</span>
            <div className="text-xl font-bold text-amber-400">
              {stats?.pendingReminders ?? 0}
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-medium text-emerald-300 block mb-1">Sent Today</span>
            <div className="text-xl font-bold text-emerald-400">
              {stats?.sentToday ?? 0}
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-medium text-rose-300 block mb-1">Failed Attempts</span>
            <div className="text-xl font-bold text-rose-400">
              {stats?.failedTotal ?? 0}
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-medium text-slate-300 block mb-1">Total Lifetime</span>
            <div className="text-xl font-bold text-slate-200">
              {stats?.totalReminders ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition ${
            activeTab === 'upcoming'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          Upcoming Queue ({stats?.pendingReminders ?? 0})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          Reminder History & Logs
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Timing & Settings
        </button>
      </div>

      {/* TAB 1: UPCOMING REMINDERS QUEUE */}
      {activeTab === 'upcoming' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer, service or code..."
                value={upcomingSearch}
                onChange={(e) => {
                  setUpcomingSearch(e.target.value)
                  setUpcomingPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <select
                value={upcomingFilterRole}
                onChange={(e) => {
                  setUpcomingFilterRole(e.target.value)
                  setUpcomingPage(1)
                }}
                className="px-3.5 py-2 rounded-2xl border border-gray-200 text-xs font-semibold bg-gray-50 text-gray-700"
              >
                <option value="ALL">All Roles</option>
                <option value="CUSTOMER">Customer Reminders</option>
                <option value="LABOUR">Labour / Vendor</option>
                <option value="CONTRACTOR">Contractor</option>
              </select>

              <select
                value={upcomingFilterType}
                onChange={(e) => {
                  setUpcomingFilterType(e.target.value)
                  setUpcomingPage(1)
                }}
                className="px-3.5 py-2 rounded-2xl border border-gray-200 text-xs font-semibold bg-gray-50 text-gray-700"
              >
                <option value="ALL">All Intervals</option>
                <option value="24_HOURS">24 Hours Before</option>
                <option value="1_HOUR">1 Hour Before</option>
                <option value="AT_APPOINTMENT">At Appointment</option>
              </select>
            </div>
          </div>

          {/* Table of Upcoming Reminders */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {upcomingReminders.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-gray-800">No Reminders in Queue</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  There are currently no pending reminders waiting to fire. New reminders are scheduled automatically when confirmed bookings are created.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4">Recipient</th>
                      <th className="px-6 py-4">Booking / Service</th>
                      <th className="px-6 py-4">Reminder Type</th>
                      <th className="px-6 py-4">Appointment Time</th>
                      <th className="px-6 py-4">Scheduled Fire</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {upcomingReminders.map((rem) => (
                      <tr key={rem._id} className="hover:bg-gray-50/60 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">
                            {rem.recipientId?.fullName || rem.metadata?.customerName || rem.metadata?.vendorName || 'User'}
                          </div>
                          <span className={`inline-block text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full ${
                            rem.recipientRole === 'CUSTOMER'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {rem.recipientRole}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">
                            {rem.metadata?.serviceName || 'Service Appointment'}
                          </div>
                          <span className="text-xs text-gray-400 font-mono">
                            #{String(rem.bookingId?._id || rem.bookingId).slice(-6).toUpperCase()}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            <Clock className="w-3.5 h-3.5" />
                            {rem.reminderType === '24_HOURS'
                              ? '24 Hours Before'
                              : rem.reminderType === '1_HOUR'
                              ? '1 Hour Before'
                              : 'At Appointment'}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-xs font-semibold text-gray-700">
                          {formatIST(rem.appointmentTime)}
                        </td>

                        <td className="px-6 py-4">
                          <div className="text-xs font-bold text-indigo-950">
                            {formatIST(rem.scheduledAt)}
                          </div>
                          <span className="text-[11px] text-indigo-600 font-semibold">
                            {getTimeRemaining(rem.scheduledAt)}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            {rem.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: HISTORY & LOGS */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* History Filters */}
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search history by recipient, service or error..."
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value)
                  setHistoryPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <select
                value={historyFilterStatus}
                onChange={(e) => {
                  setHistoryFilterStatus(e.target.value)
                  setHistoryPage(1)
                }}
                className="px-3.5 py-2 rounded-2xl border border-gray-200 text-xs font-semibold bg-gray-50 text-gray-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="PENDING">Pending</option>
              </select>

              <select
                value={historyFilterRole}
                onChange={(e) => {
                  setHistoryFilterRole(e.target.value)
                  setHistoryPage(1)
                }}
                className="px-3.5 py-2 rounded-2xl border border-gray-200 text-xs font-semibold bg-gray-50 text-gray-700"
              >
                <option value="ALL">All Roles</option>
                <option value="CUSTOMER">Customer</option>
                <option value="LABOUR">Labour / Vendor</option>
              </select>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {historyReminders.length === 0 ? (
              <div className="p-12 text-center">
                <CalendarClock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-gray-800">No History Records Found</h3>
                <p className="text-xs text-gray-500 mt-1">Processed reminders will appear in this audit log.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4">Recipient</th>
                      <th className="px-6 py-4">Service / Type</th>
                      <th className="px-6 py-4">Appointment</th>
                      <th className="px-6 py-4">Sent / Logged Time</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {historyReminders.map((rem) => (
                      <tr key={rem._id} className="hover:bg-gray-50/60 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">
                            {rem.recipientId?.fullName || rem.metadata?.customerName || rem.metadata?.vendorName || 'Recipient'}
                          </div>
                          <span className="text-xs text-gray-400">{rem.recipientRole}</span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">
                            {rem.metadata?.serviceName || 'Service'}
                          </div>
                          <span className="text-xs text-indigo-600 font-semibold">
                            {rem.reminderType}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-xs font-semibold text-gray-700">
                          {formatIST(rem.appointmentTime)}
                        </td>

                        <td className="px-6 py-4 text-xs text-gray-500">
                          {formatIST(rem.sentAt || rem.updatedAt)}
                        </td>

                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            rem.status === 'SENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rem.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-800'
                              : rem.status === 'CANCELLED'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {rem.status === 'SENT' && <CheckCircle2 className="w-3 h-3" />}
                            {rem.status === 'FAILED' && <AlertTriangle className="w-3 h-3" />}
                            {rem.status}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {rem.status === 'FAILED' ? (
                            <button
                              onClick={() => setSelectedFailedReminder(rem)}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 border border-rose-200 transition"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Inspect & Retry
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400 font-mono">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS & CONFIGURATION */}
      {activeTab === 'settings' && settings && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Master Toggles Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Master Reminder Controls</h3>
              <p className="text-xs text-gray-500">Global activation and recipient controls</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-gray-50/70 cursor-pointer">
                <div>
                  <span className="font-bold text-sm text-gray-900 block">Global Reminders Engine</span>
                  <span className="text-xs text-gray-500">Master switch for all booking alerts</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-gray-50/70 cursor-pointer">
                <div>
                  <span className="font-bold text-sm text-gray-900 block">Customer Alerts</span>
                  <span className="text-xs text-gray-500">Dispatch reminders to customers</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.customerRemindersEnabled}
                  onChange={(e) => setSettings({ ...settings, customerRemindersEnabled: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-gray-50/70 cursor-pointer">
                <div>
                  <span className="font-bold text-sm text-gray-900 block">Vendor / Labour Alerts</span>
                  <span className="text-xs text-gray-500">Dispatch reminders to assigned service partners</span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.vendorRemindersEnabled}
                  onChange={(e) => setSettings({ ...settings, vendorRemindersEnabled: e.target.checked })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Interval Configuration Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 24-Hour Reminder */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="font-bold text-sm text-gray-900">24-Hour Prior Alert</span>
                <input
                  type="checkbox"
                  checked={settings.intervals?.twentyFourHour?.enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      intervals: {
                        ...settings.intervals,
                        twentyFourHour: {
                          ...settings.intervals.twentyFourHour,
                          enabled: e.target.checked,
                        },
                      },
                    })
                  }
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Hours Before Appointment</label>
                  <input
                    type="number"
                    value={settings.intervals?.twentyFourHour?.hoursBefore ?? 24}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        intervals: {
                          ...settings.intervals,
                          twentyFourHour: {
                            ...settings.intervals.twentyFourHour,
                            hoursBefore: Number(e.target.value),
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Title Template</label>
                  <input
                    type="text"
                    value={settings.intervals?.twentyFourHour?.titleTemplate || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        intervals: {
                          ...settings.intervals,
                          twentyFourHour: {
                            ...settings.intervals.twentyFourHour,
                            titleTemplate: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Message Body</label>
                  <textarea
                    rows={3}
                    value={settings.intervals?.twentyFourHour?.bodyTemplate || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        intervals: {
                          ...settings.intervals,
                          twentyFourHour: {
                            ...settings.intervals.twentyFourHour,
                            bodyTemplate: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>

            {/* 1-Hour Reminder */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="font-bold text-sm text-gray-900">1-Hour Prior Alert</span>
                <input
                  type="checkbox"
                  checked={settings.intervals?.oneHour?.enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      intervals: {
                        ...settings.intervals,
                        oneHour: {
                          ...settings.intervals.oneHour,
                          enabled: e.target.checked,
                        },
                      },
                    })
                  }
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Hours Before Appointment</label>
                  <input
                    type="number"
                    value={settings.intervals?.oneHour?.hoursBefore ?? 1}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        intervals: {
                          ...settings.intervals,
                          oneHour: {
                            ...settings.intervals.oneHour,
                            hoursBefore: Number(e.target.value),
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Title Template</label>
                  <input
                    type="text"
                    value={settings.intervals?.oneHour?.titleTemplate || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        intervals: {
                          ...settings.intervals,
                          oneHour: {
                            ...settings.intervals.oneHour,
                            titleTemplate: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Message Body</label>
                  <textarea
                    rows={3}
                    value={settings.intervals?.oneHour?.bodyTemplate || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        intervals: {
                          ...settings.intervals,
                          oneHour: {
                            ...settings.intervals.oneHour,
                            bodyTemplate: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>

            {/* At-Appointment Reminder */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="font-bold text-sm text-gray-900">At-Appointment Time Alert</span>
                <input
                  type="checkbox"
                  checked={settings.intervals?.atAppointment?.enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      intervals: {
                        ...settings.intervals,
                        atAppointment: {
                          ...settings.intervals.atAppointment,
                          enabled: e.target.checked,
                        },
                      },
                    })
                  }
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Timing</label>
                  <span className="text-gray-500 block">Fires exactly at scheduled appointment time (0 hours before)</span>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Title Template</label>
                  <input
                    type="text"
                    value={settings.intervals?.atAppointment?.titleTemplate || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        intervals: {
                          ...settings.intervals,
                          atAppointment: {
                            ...settings.intervals.atAppointment,
                            titleTemplate: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Message Body</label>
                  <textarea
                    rows={3}
                    value={settings.intervals?.atAppointment?.bodyTemplate || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        intervals: {
                          ...settings.intervals,
                          atAppointment: {
                            ...settings.intervals.atAppointment,
                            bodyTemplate: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Worker Tuning Controls */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Worker Tuning Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Batch Size (Jobs/Cycle)</label>
                <input
                  type="number"
                  value={settings.batchSize || 50}
                  onChange={(e) => setSettings({ ...settings, batchSize: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-600 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Lease Duration (Seconds)</label>
                <input
                  type="number"
                  value={settings.leaseDurationSeconds || 120}
                  onChange={(e) => setSettings({ ...settings, leaseDurationSeconds: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-600 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Max Retry Attempts</label>
                <input
                  type="number"
                  value={settings.maxAttempts || 3}
                  onChange={(e) => setSettings({ ...settings, maxAttempts: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-600 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">System Timezone</label>
                <input
                  type="text"
                  disabled
                  value={settings.timeZone || 'Asia/Kolkata'}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 font-semibold cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
            >
              {savingSettings ? 'Saving Configuration...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}

      {/* Error & Retry Inspection Modal */}
      {selectedFailedReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Failed Reminder Inspection</span>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedFailedReminder.metadata?.serviceName || 'Service Appointment'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFailedReminder(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-700">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 space-y-1">
                <span className="font-bold block">Failure Reason:</span>
                <p className="font-mono">{selectedFailedReminder.lastError || 'No error description recorded'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-gray-400 block text-[10px]">Recipient Role</span>
                  <span className="font-bold">{selectedFailedReminder.recipientRole}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Attempts Executed</span>
                  <span className="font-bold">{selectedFailedReminder.attempts} / {selectedFailedReminder.maxAttempts}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Appointment Time</span>
                  <span className="font-bold">{formatIST(selectedFailedReminder.appointmentTime)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Scheduled Time</span>
                  <span className="font-bold">{formatIST(selectedFailedReminder.scheduledAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setSelectedFailedReminder(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-xs text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => handleRetryReminder(selectedFailedReminder._id)}
                disabled={retryingId === selectedFailedReminder._id}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${retryingId ? 'animate-spin' : ''}`} />
                {retryingId ? 'Retrying...' : 'Retry Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminBookingRemindersPage
