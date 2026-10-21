import { useState, useEffect } from 'react'
import { Users, FileText, CheckCircle, Clock, XCircle, Loader2, IndianRupee, AlertCircle, Download } from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { getDashboardStats, getReportsData } from '../../api/adminReportsApi.js'
import { format, subDays } from 'date-fns'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'

export function AdminReportsPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [reportType, setReportType] = useState('bookings') // 'users', 'bookings', 'revenue'
  const [dateRange, setDateRange] = useState({
    startDate: '2020-01-01',
    endDate: new Date().toISOString().split('T')[0]
  })

  const [reportsData, setReportsData] = useState({ rows: [], chartData: [], pagination: {} })
  const [loadingReports, setLoadingReports] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    loadReportsData()
  }, [reportType, dateRange.startDate, dateRange.endDate, page])

  const loadStats = async () => {
    try {
      setLoading(true)
      const res = await getDashboardStats()
      setStats(res.stats)
      setError('')
    } catch (err) {
      setError('Failed to load dashboard statistics')
    } finally {
      setLoading(false)
    }
  }

  const loadReportsData = async () => {
    try {
      setLoadingReports(true)
      const res = await getReportsData({
        type: reportType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        page,
        limit: 10
      })
      setReportsData(res.data || { rows: [], chartData: [], pagination: {} })
    } catch (err) {
      console.error('Failed to load detailed reports', err)
      setReportsData({ rows: [], chartData: [], pagination: {} })
    } finally {
      setLoadingReports(false)
    }
  }

  const handleExportCSV = () => {
    if (!reportsData.rows || reportsData.rows.length === 0) return;
    
    // Convert to CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = Object.keys(reportsData.rows[0]).filter(key => typeof reportsData.rows[0][key] !== 'object');
    csvContent += headers.join(",") + "\n";

    reportsData.rows.forEach(row => {
      const rowData = headers.map(header => {
        let val = row[header];
        if (typeof val === 'string') {
          val = val.replace(/"/g, '""');
          return `"${val}"`;
        }
        return val;
      });
      csvContent += rowData.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `report_${reportType}_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-brand" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        <p>{error}</p>
        <button onClick={loadStats} className="mt-4 px-4 py-2 bg-brand text-white rounded-lg">Retry</button>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports & Analytics</h1>
        <p className="text-gray-500 mt-1">Platform overview and key performance metrics</p>
      </div>

      {/* Top Revenue & Users Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassPanel className="p-6 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">₹{stats?.finance?.totalRevenue?.toLocaleString() || 0}</p>
        </GlassPanel>

        <GlassPanel className="p-6 border-l-4 border-l-brand">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
            <div className="p-2 bg-blue-50 rounded-lg text-brand">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.users?.total || 0}</p>
        </GlassPanel>

        <GlassPanel className="p-6 border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Total Bookings</h3>
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.bookings?.total || 0}</p>
        </GlassPanel>

        <GlassPanel className="p-6 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-500">Open Complaints</h3>
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.complaints?.open || 0}</p>
          <p className="text-xs text-gray-400 mt-2">Out of {stats?.complaints?.total || 0} total</p>
        </GlassPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Booking Status Breakdown */}
        <GlassPanel className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Booking Status Breakdown</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-medium text-gray-700">Completed</span>
              </div>
              <span className="text-lg font-semibold">{stats?.bookings?.completed || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-orange-500" />
                <span className="font-medium text-gray-700">Pending</span>
              </div>
              <span className="text-lg font-semibold">{stats?.bookings?.pending || 0}</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-brand" />
                <span className="font-medium text-gray-700">Accepted (Active)</span>
              </div>
              <span className="text-lg font-semibold">{stats?.bookings?.accepted || 0}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-500" />
                <span className="font-medium text-gray-700">Cancelled</span>
              </div>
              <span className="text-lg font-semibold">{stats?.bookings?.cancelled || 0}</span>
            </div>
          </div>
        </GlassPanel>

        {/* Users Breakdown */}
        <GlassPanel className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">User Distribution</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <p className="text-sm text-gray-500 mb-1">Customers</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.users?.customer || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <p className="text-sm text-gray-500 mb-1">Service Providers</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.users?.labour || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <p className="text-sm text-gray-500 mb-1">Contractors</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.users?.contractor || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <p className="text-sm text-gray-500 mb-1">Admins</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.users?.admin || 0}</p>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Total Registered Accounts</span>
              <span className="font-semibold text-gray-900">{stats?.users?.total || 0}</span>
            </div>
            {/* Visual Bar representation of Customer vs Service Provider */}
            <div className="w-full h-2 bg-gray-200 rounded-full mt-3 overflow-hidden flex">
              <div 
                className="h-full bg-brand-primary" 
                style={{ width: `${(stats?.users?.customer / Math.max(1, stats?.users?.total)) * 100}%` }}
                title="Customers"
              ></div>
              <div 
                className="h-full bg-orange-500" 
                style={{ width: `${(stats?.users?.labour / Math.max(1, stats?.users?.total)) * 100}%` }}
                title="Service Providers"
              ></div>
              <div 
                className="h-full bg-green-500 flex-1"
                title="Others"
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-primary"></span> Customers</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Service Providers</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> B2B</span>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* Detailed Reports Section */}
      <div className="mt-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-bold text-gray-900">Detailed Reports</h2>
          
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={reportType}
              onChange={(e) => { setReportType(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm"
            >
              <option value="bookings">Bookings</option>
              <option value="revenue">Revenue</option>
              <option value="users">Users</option>
            </select>
            
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => { setDateRange(prev => ({ ...prev, startDate: e.target.value })); setPage(1); }}
              className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm"
            />
            <span className="text-gray-500 text-sm">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => { setDateRange(prev => ({ ...prev, endDate: e.target.value })); setPage(1); }}
              className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm"
            />

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand/90 transition"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Charts */}
        <GlassPanel className="p-6 h-[400px]">
          {loadingReports ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {reportType === 'revenue' ? (
                <BarChart data={reportsData.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" fill="#3b82f6" name="Revenue (₹)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={reportsData.chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" name={reportType === 'users' ? 'New Users' : 'Bookings'} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </GlassPanel>
        
        {/* Detailed Data Table */}
        <GlassPanel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-6 py-4 font-medium">Date</th>
                  {reportType === 'users' && <th className="px-6 py-4 font-medium">Phone / Role</th>}
                  {reportType === 'bookings' && <th className="px-6 py-4 font-medium">Status</th>}
                  {reportType === 'revenue' && <th className="px-6 py-4 font-medium">Amount</th>}
                  {reportType === 'revenue' && <th className="px-6 py-4 font-medium">Status</th>}
                  <th className="px-6 py-4 font-medium text-right">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportsData.rows?.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">{format(new Date(row.createdAt), 'dd MMM yyyy')}</td>
                    {reportType === 'users' && (
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{row.phone}</div>
                        <div className="text-xs uppercase">{row.role === 'labour' ? 'Service Provider' : row.role}</div>
                      </td>
                    )}
                    {reportType === 'bookings' && (
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          row.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          row.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    )}
                    {reportType === 'revenue' && (
                      <td className="px-6 py-4 font-medium text-gray-900">₹{row.amount}</td>
                    )}
                    {reportType === 'revenue' && (
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          row.status === 'CAPTURED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right text-gray-400 font-mono text-xs">{row._id}</td>
                  </tr>
                ))}
                {(!reportsData.rows || reportsData.rows.length === 0) && !loadingReports && (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">No data found for the selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {reportsData.pagination?.pages > 1 && (
             <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
               <span className="text-sm text-gray-500">
                 Page {reportsData.pagination.page} of {reportsData.pagination.pages}
               </span>
               <div className="flex gap-2">
                 <button 
                   disabled={page === 1}
                   onClick={() => setPage(p => p - 1)}
                   className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
                 >Previous</button>
                 <button 
                   disabled={page === reportsData.pagination.pages}
                   onClick={() => setPage(p => p + 1)}
                   className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
                 >Next</button>
               </div>
             </div>
          )}
        </GlassPanel>
      </div>

    </div>
  )
}
