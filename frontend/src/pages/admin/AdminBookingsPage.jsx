import React, { useState } from 'react'
import { ClipboardList, Trash2, Edit2, CheckCircle, XCircle, Eye, Calendar } from 'lucide-react'

import { AdminLabourDetailsModal } from './components/AdminLabourDetailsModal.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { PipelineTimeline } from '../../components/shared/PipelineTimeline.jsx'
import { calculateCompletedBookingBill } from '../../lib/completedBillingHelper.js'
import {
  useGetAdminRequestsQuery,
  useLazyGetAdminRequestByIdQuery,
  usePatchRequestStatusMutation,
  useDeleteAdminRequestMutation,
} from '../../store/api/workforceApi.js'
import {
  useGetAdminBookingsQuery,
  usePatchAdminBookingStatusMutation,
  useDeleteAdminBookingMutation
} from '../../store/api/adminBookingApi.js'

const REQUEST_STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'allocating', label: 'Allocating' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const BOOKING_STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CREATED', label: 'Created' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'STARTED', label: 'Started' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
]

const getStatusBadgeStyle = (status) => {
  switch (status?.toUpperCase()) {
    case 'CREATED': return 'bg-slate-100 text-slate-700'
    case 'BROADCASTING': return 'bg-amber-100 text-amber-700'
    case 'ACCEPTED': return 'bg-teal-100 text-teal-700'
    case 'ASSIGNED': return 'bg-indigo-100 text-indigo-700'
    case 'EN_ROUTE': return 'bg-blue-100 text-blue-700'
    case 'STARTED': return 'bg-purple-100 text-purple-700'
    case 'COMPLETED': return 'bg-emerald-100 text-emerald-800'
    case 'CANCELLED': return 'bg-rose-50 text-rose-600'
    case 'FAILED': return 'bg-red-100 text-red-700'
    case 'REFUNDED': return 'bg-zinc-100 text-zinc-700'
    // Fallbacks for contractor requests
    case 'pending_review': return 'bg-amber-100 text-amber-700'
    case 'confirmed': return 'bg-blue-100 text-blue-700'
    case 'allocating': return 'bg-blue-100 text-blue-700'
    case 'in_progress': return 'bg-purple-100 text-purple-700'
    case 'rejected': return 'bg-rose-100 text-rose-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}

function ContractorRequestsTab() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data, isLoading, isError, refetch } = useGetAdminRequestsQuery(
    statusFilter ? { status: statusFilter } : undefined,
  )
  const [patchStatus, { isLoading: patching }] = usePatchRequestStatusMutation()
  const [deleteRequest] = useDeleteAdminRequestMutation()
  const requests = data?.requests ?? []

  const [expandedRows, setExpandedRows] = useState({})
  const [selectedLabour, setSelectedLabour] = useState(null)
  const [selectedViewRequest, setSelectedViewRequest] = useState(null)

  const [fetchRequest] = useLazyGetAdminRequestByIdQuery()

  const handleViewDetails = async (r) => {
    // Optimistically open the modal with current data
    setSelectedViewRequest(r)
    try {
      const res = await fetchRequest(r._id).unwrap()
      if (res?.request) {
        setSelectedViewRequest(res.request)
      }
    } catch (err) {
      console.error('Failed to fetch request details:', err)
    }
  }

  const handleStatus = async (id, status) => {
    try {
      await patchStatus({ id, status }).unwrap()
    } catch {
      /* handle later */
    }
  }

  const handleDeleteRequest = async (id) => {
    if (window.confirm('Are you sure you want to permanently delete this contractor request?')) {
      try {
        await deleteRequest(id).unwrap()
        refetch()
      } catch (err) {
        console.error('Failed to delete request:', err)
        alert('Failed to delete request.')
      }
    }
  }

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-6 mt-6">
      <div className="flex flex-wrap gap-2">
        {REQUEST_STATUS_FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${
              statusFilter === f.value
                ? 'bg-brand text-white ring-brand'
                : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand/30'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <GlassPanel className="p-6">
          <p className="text-sm text-slate-500">Loading requests…</p>
        </GlassPanel>
      ) : null}

      {isError ? (
        <GlassPanel className="border-rose-200 p-6">
          <p className="text-sm font-semibold text-rose-800">Failed to load requests.</p>
        </GlassPanel>
      ) : null}

      {!isLoading && !isError && requests.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-slate-700">No requests in this filter.</p>
        </GlassPanel>
      ) : null}

      {!isLoading && !isError && requests.length > 0 ? (
        <>
          {/* DESKTOP VIEW: TABLE */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap min-w-[800px]">
              <thead className="bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-200">
                <tr>
                  <th className="p-5">Request ID & Status</th>
                  <th className="p-5">Contractor Info</th>
                  <th className="p-5">Vendor Details</th>
                  <th className="p-5">Assigned Crew</th>
                  <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => {
                  const assignments = r.assignments || []
                  const hasAssignments = assignments.length > 0
                  const requestedCrew = r.preferredCrewIds || []
                  const hasRequestedCrew = requestedCrew.length > 0
                  const isExpanded = expandedRows[r._id]

                  const assignedVendor = r.preferredVendorId || (assignments.length > 0 ? assignments[0].vendorId : null);

                  return (
                    <React.Fragment key={r._id}>
                      <tr className="group hover:bg-slate-50/50 transition-colors duration-200">
                        <td className="p-5 align-top">
                          <p className="font-extrabold text-slate-900 group-hover:text-brand transition-colors">{r.reference}</p>
                          <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeStyle(r.status)}`}>
                            {r.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 align-top">
                          <p className="font-semibold text-slate-800">
                            {r.clientId?.contractorProfile?.companyName || r.clientId?.fullName || 'Client'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {r.clientId?.phone}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(r.startDate).toLocaleDateString()} 
                            {r.endDate && ` - ${new Date(r.endDate).toLocaleDateString()}`}
                          </p>
                        </td>
                        <td className="p-4 align-top">
                          {assignedVendor ? (
                            <div>
                              <p className="font-semibold text-slate-800">
                                {assignedVendor.contractorProfile?.businessName || assignedVendor.fullName}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">{assignedVendor.phone}</p>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span> Unassigned Vendor
                            </span>
                          )}
                        </td>
                        <td className="p-4 align-top">
                          {(hasAssignments || hasRequestedCrew) ? (
                            <button 
                              onClick={() => toggleRow(r._id)}
                              className="text-brand font-bold text-xs hover:underline flex items-center gap-1"
                            >
                              {hasAssignments ? `${assignments.length} Worker${assignments.length > 1 ? 's' : ''}` : 'View Requested Crew'}
                              <span className="text-[10px] ml-1">{isExpanded ? '▼' : '▶'}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span> No Crew Yet
                            </span>
                          )}
                        </td>
                        <td className="p-5 align-top text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewDetails(r)}
                              className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:border-brand/40 hover:bg-brand/5 hover:text-brand transition shadow-sm"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => handleDeleteRequest(r._id)}
                              className="flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-600 hover:border-rose-300 hover:bg-rose-100 transition shadow-sm"
                              title="Delete permanently"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expandable Crew Row */}
                      {isExpanded && (hasAssignments || hasRequestedCrew) && (
                        <tr className="bg-slate-50/30">
                          <td colSpan={5} className="p-6 border-l-4 border-brand/40 shadow-inner">
                            
                            <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">Crew Details</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {hasRequestedCrew ? (
                                requestedCrew.map(c => {
                                  const vendorFee = c.services?.[0]?.price || 0;
                                  const adminFee = c.services?.[0]?.adminPrice || c.adminPrice || 0;
                                  return (
                                    <div 
                                      key={c._id}
                                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"
                                    >
                                      <p className="text-sm font-extrabold text-slate-900">{c.fullName || 'Worker'}</p>
                                      <p className="text-[11px] font-medium text-slate-500 mt-1">{c.phone || 'No phone number'}</p>
                                      <p className="text-xs font-bold text-brand mt-1 bg-brand/5 inline-block px-2 py-0.5 rounded-md">{c.services?.[0]?.name || c.serviceName || c.category || 'Specialist Labour'}</p>
                                      <div className="mt-3 flex justify-between items-center border-t border-slate-50 pt-3">
                                        <div className="flex flex-col gap-1 text-[11px]">
                                          <span className="font-semibold text-slate-600">Vendor Price: <span className="font-bold text-slate-800">₹{vendorFee.toLocaleString('en-IN')}</span></span>
                                          <span className="font-semibold text-slate-600">Price Diff: <span className="font-bold text-blue-600">₹{(adminFee > vendorFee ? adminFee - vendorFee : 0).toLocaleString('en-IN')}</span></span>
                                          <span className="font-semibold text-slate-600">Total Admin Price: <span className="font-bold text-brand">₹{adminFee.toLocaleString('en-IN')}</span></span>
                                        </div>
                                        <span className="text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-md uppercase tracking-wider">Client Chosen</span>
                                      </div>
                                    </div>
                                  )
                                })
                              ) : (
                                assignments.map(a => {
                                  const vendorFee = a.labourId?.services?.[0]?.price || 0;
                                  const adminFee = a.labourId?.services?.[0]?.adminPrice || 0;
                                  return (
                                    <div 
                                      key={a._id}
                                      onClick={() => setSelectedLabour({ assignment: a, request: r })}
                                      className="bg-white p-4 rounded-xl border border-slate-200 hover:border-brand/40 hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300 group/card"
                                    >
                                      <p className="text-sm font-extrabold text-slate-900 group-hover/card:text-brand transition-colors">{a.labourId?.fullName || 'Pending Linking'}</p>
                                      <p className="text-[11px] font-medium text-slate-500 mt-1">{a.labourId?.phone || 'Awaiting vendor to assign worker'}</p>
                                      <p className="text-xs font-bold text-brand mt-1 bg-brand/5 inline-block px-2 py-0.5 rounded-md">{a.labourId?.services?.[0]?.name || a.labourId?.category || 'Worker'}</p>
                                      <div className="mt-3 flex justify-between items-end border-t border-slate-50 pt-3">
                                        <div className="flex flex-col gap-1 text-[11px]">
                                          <span className="font-semibold text-slate-600">Vendor Price: <span className="font-bold text-slate-800">₹{vendorFee.toLocaleString('en-IN')}</span></span>
                                          <span className="font-semibold text-slate-600">Price Diff: <span className="font-bold text-blue-600">₹{(adminFee > vendorFee ? adminFee - vendorFee : 0).toLocaleString('en-IN')}</span></span>
                                          <span className="font-semibold text-slate-600">Total Admin Price: <span className="font-bold text-brand">₹{adminFee.toLocaleString('en-IN')}</span></span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                          <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase tracking-wider">{a.status?.replace('_', ' ')}</span>
                                          <span className="text-brand text-[10px] font-bold group-hover/card:underline">View Details &rarr;</span>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE VIEW: CARDS */}
          <ul className="lg:hidden space-y-4">
            {requests.map((r) => {
              const assignments = r.assignments || []
              const hasAssignments = assignments.length > 0
              const requestedCrew = r.preferredCrewIds || []
              const hasRequestedCrew = requestedCrew.length > 0
              const isExpanded = expandedRows[r._id]

              const assignedVendor = r.preferredVendorId || (assignments.length > 0 ? assignments[0].vendorId : null);

              return (
                <li key={r._id}>
                  <GlassPanel className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      
                      {/* ID & Status */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <p className="font-extrabold text-slate-900 text-lg">{r.reference}</p>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeStyle(r.status)}`}>
                            {r.status?.replace('_', ' ')}
                          </span>
                        </div>
                        
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {/* Contractor Info */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Contractor Info</p>
                            <p className="font-semibold text-slate-800">
                              {r.clientId?.contractorProfile?.companyName || r.clientId?.fullName || 'Client'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {r.clientId?.phone}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(r.startDate).toLocaleDateString()} 
                              {r.endDate && ` - ${new Date(r.endDate).toLocaleDateString()}`}
                            </p>
                          </div>
                          
                          {/* Vendor Details */}
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Vendor Details</p>
                            {assignedVendor ? (
                              <div>
                                <p className="font-semibold text-slate-800">
                                  {assignedVendor.contractorProfile?.businessName || assignedVendor.fullName}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">{assignedVendor.phone}</p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span> Unassigned
                              </span>
                            )}
                          </div>

                          {/* Assigned Crew Toggle */}
                          <div className="sm:col-span-2 md:col-span-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Crew</p>
                            {(hasAssignments || hasRequestedCrew) ? (
                              <button 
                                onClick={() => toggleRow(r._id)}
                                className="text-brand font-bold text-sm hover:underline flex items-center gap-1"
                              >
                                {hasAssignments ? `${assignments.length} Worker${assignments.length > 1 ? 's' : ''}` : 'View Requested Crew'}
                                <span className="text-xs ml-1">{isExpanded ? '▼' : '▶'}</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span> No Crew Yet
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100 mt-4 lg:mt-0">
                        <button
                          type="button"
                          onClick={() => setSelectedViewRequest(r)}
                          className="flex flex-1 lg:flex-none items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-600 hover:border-brand/40 hover:bg-brand/5 hover:text-brand transition shadow-sm"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(r._id)}
                          className="flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-600 hover:border-rose-300 hover:bg-rose-100 transition shadow-sm"
                          title="Delete permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Crew Section */}
                    {isExpanded && (hasAssignments || hasRequestedCrew) && (
                      <div className="mt-6 pt-5 border-t border-slate-100">
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">Crew Details</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {hasRequestedCrew ? (
                            requestedCrew.map(c => {
                              const vendorFee = c.services?.[0]?.price || 0;
                              const adminFee = c.services?.[0]?.adminPrice || c.adminPrice || 0;
                              return (
                                <div 
                                  key={c._id}
                                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm"
                                >
                                  <p className="text-sm font-extrabold text-slate-900">{c.fullName || 'Worker'}</p>
                                  <p className="text-[11px] font-medium text-slate-500 mt-1">{c.phone || 'No phone number'}</p>
                                  <p className="text-xs font-bold text-brand mt-1 bg-brand/5 inline-block px-2 py-0.5 rounded-md">{c.services?.[0]?.name || c.serviceName || c.category || 'Specialist Labour'}</p>
                                  <div className="mt-3 flex justify-between items-center border-t border-slate-200/60 pt-3">
                                    <div className="flex flex-col gap-1 text-[11px]">
                                      <span className="font-semibold text-slate-600">Vendor Price: <span className="font-bold text-slate-800">₹{vendorFee.toLocaleString('en-IN')}</span></span>
                                      <span className="font-semibold text-slate-600">Price Diff: <span className="font-bold text-blue-600">₹{(adminFee > vendorFee ? adminFee - vendorFee : 0).toLocaleString('en-IN')}</span></span>
                                      <span className="font-semibold text-slate-600">Total Admin Price: <span className="font-bold text-brand">₹{adminFee.toLocaleString('en-IN')}</span></span>
                                    </div>
                                    <span className="text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-md uppercase tracking-wider">Client Chosen</span>
                                  </div>
                                </div>
                              )
                            })
                          ) : (
                            assignments.map(a => {
                              const vendorFee = a.labourId?.services?.[0]?.price || 0;
                              const adminFee = a.labourId?.services?.[0]?.adminPrice || 0;
                              return (
                                <div 
                                  key={a._id}
                                  onClick={() => setSelectedLabour({ assignment: a, request: r })}
                                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-brand/40 hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all duration-300 group/card"
                                >
                                  <p className="text-sm font-extrabold text-slate-900 group-hover/card:text-brand transition-colors">{a.labourId?.fullName || 'Pending Linking'}</p>
                                  <p className="text-[11px] font-medium text-slate-500 mt-1">{a.labourId?.phone || 'Awaiting vendor to assign worker'}</p>
                                  <p className="text-xs font-bold text-brand mt-1 bg-brand/5 inline-block px-2 py-0.5 rounded-md">{a.labourId?.services?.[0]?.name || a.labourId?.category || 'Worker'}</p>
                                  <div className="mt-3 flex justify-between items-end border-t border-slate-200/60 pt-3">
                                    <div className="flex flex-col gap-1 text-[11px]">
                                      <span className="font-semibold text-slate-600">Vendor Price: <span className="font-bold text-slate-800">₹{vendorFee.toLocaleString('en-IN')}</span></span>
                                      <span className="font-semibold text-slate-600">Price Diff: <span className="font-bold text-blue-600">₹{(adminFee > vendorFee ? adminFee - vendorFee : 0).toLocaleString('en-IN')}</span></span>
                                      <span className="font-semibold text-slate-600">Total Admin Price: <span className="font-bold text-brand">₹{adminFee.toLocaleString('en-IN')}</span></span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md uppercase tracking-wider">{a.status?.replace('_', ' ')}</span>
                                      <span className="text-brand text-[10px] font-bold group-hover/card:underline">View Details &rarr;</span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </GlassPanel>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}



      <AdminLabourDetailsModal 
        data={selectedLabour} 
        onClose={() => setSelectedLabour(null)} 
      />
    </div>
  )
}

function BookingDetailsModal({ booking, onClose }) {
  if (!booking) return null

  const completedBill = calculateCompletedBookingBill(booking)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-4 border-slate-100">
          <h2 className="text-lg font-extrabold text-slate-900">Booking Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-600 transition">
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2 sm:col-span-1">
              <p className="text-slate-500 text-xs">Service</p>
              {booking.contractorInfo?.services?.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {booking.contractorInfo.services.map((s, idx) => (
                    <span key={idx} className="font-semibold text-[11px] bg-slate-100 px-2 py-0.5 rounded-md">
                      {s.serviceId?.name || s.serviceName || 'Unknown'} (x{s.quantity || 1})
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-semibold">{booking.serviceId?.name || 'N/A'}</p>
              )}
            </div>
            <div>
              <p className="text-slate-500 text-xs">Category</p>
              <p className="font-semibold">{booking.subcategoryId?.categoryId?.name || booking.categoryId?.name || booking.subcategoryId?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Zone</p>
              <p className="font-semibold">{booking.zoneName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Status</p>
              <p className="font-bold text-brand">{booking.status}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Payment Method</p>
              <p className="font-semibold">{booking.paymentMethod}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Booking Time</p>
              <p className="font-semibold">{booking.createdAt ? new Date(booking.createdAt).toLocaleString() : 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Duration</p>
              <p className="font-semibold">
                {booking.hours === 0.5
                  ? '30 Minutes'
                  : booking.hours
                  ? `${booking.hours} ${booking.hours === 1 ? 'Hour' : 'Hours'}`
                  : `${booking.durationDays || ''} ${booking.durationKind || ''}`.trim() || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Scheduled At</p>
              <p className="font-semibold">{booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString() : 'N/A'}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-slate-500 text-xs mb-1">User Information</p>
            <p className="font-semibold">{booking.userId?.fullName}</p>
            <p className="text-slate-600">{booking.userId?.phone}</p>
            <p className="text-slate-600 mt-1 text-xs">{booking.address?.locationText}</p>
          </div>

          {booking.assignments && booking.assignments.length > 0 ? (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-slate-500 text-xs mb-2">Assigned Labour Crew</p>
              <div className="grid grid-cols-1 gap-4">
                {(() => {
                  return booking.assignments.map((a, idx) => {
                    // Use stored labourShare from assignment if available (set at acceptance time)
                    // Fall back to proportional calculation for old bookings without stored share
                    let share = 0;
                    if (a.labourShare && a.labourShare > 0) {
                      share = a.labourShare;
                    } else if (booking.contractorInfo?.services?.length > 0) {
                      // Derive from the matched service in contractorInfo
                      const aServiceId = String(a.serviceId?._id || a.serviceId || '');
                      const matchedSvc = booking.contractorInfo.services.find(s => String(s.serviceId?._id || s.serviceId) === aServiceId);
                      if (matchedSvc && matchedSvc.price) {
                        const hours = booking.duration || booking.hours || 1;
                        share = Math.round(matchedSvc.price * hours * 0.90);
                      } else {
                        share = booking.laborShare / booking.assignments.length;
                      }
                    } else {
                      share = booking.laborShare / booking.assignments.length;
                    }
                    // Service name resolution priority:
                    // 1. Stored snapshot (a.serviceName) — set for new bookings at acceptance time
                    // 2. Populated a.serviceId.name — set by API populate('assignments.serviceId','name')
                    // 3. Match from contractorInfo (fallback for very old data without serviceId)
                    const assignedServiceName =
                      a.serviceName ||
                      a.serviceId?.name ||
                      (() => {
                        const aServiceId = String(a.serviceId?._id || a.serviceId || '');
                        if (!aServiceId) return 'N/A';
                        const matched = booking.contractorInfo?.services?.find(
                          s => String(s.serviceId?._id || s.serviceId) === aServiceId
                        );
                        return matched?.serviceId?.name || 'N/A';
                      })()


                    return (
                      <div key={a._id || idx} className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-sm text-slate-900">{a.labourId?.fullName || 'Pending Linking'}</p>
                            <p className="text-xs text-slate-600">{a.labourId?.phone || 'Awaiting Worker'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Service: <span className="font-semibold text-slate-700">{assignedServiceName}</span>
                              {a.pricePerHour > 0 && <span className="ml-1 text-slate-400">· ₹{a.pricePerHour}/hr</span>}
                            </p>
                            <p className="text-xs font-semibold text-brand mt-1 uppercase">{a.status}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Labour Share</p>
                            <p className="font-bold text-sm text-brand">₹{share.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-slate-500">Start OTP:</span> <span className="font-mono font-semibold">{a.startOtp || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">End OTP:</span> <span className="font-mono font-semibold">{a.completionOtp || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Start Time:</span> <span className="font-semibold">{a.startedAt ? new Date(a.startedAt).toLocaleString() : 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">End Time:</span> <span className="font-semibold">{a.completedAt ? new Date(a.completedAt).toLocaleString() : 'N/A'}</span>
                          </div>
                        </div>
                        {(a.startWorkImage || a.endWorkImage) && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {a.startWorkImage && (
                               <div>
                                 <p className="text-slate-500 text-[10px] mb-1">Start Image</p>
                                 <img src={a.startWorkImage} alt="Start Work" className="w-full h-16 object-cover rounded shadow-sm border border-slate-200" />
                               </div>
                            )}
                            {a.endWorkImage && (
                               <div>
                                 <p className="text-slate-500 text-[10px] mb-1">End Image</p>
                                 <img src={a.endWorkImage} alt="End Work" className="w-full h-16 object-cover rounded shadow-sm border border-slate-200" />
                               </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          ) : booking.laborId && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-slate-500 text-xs mb-1">Assigned Labour</p>
              <p className="font-semibold">{booking.laborId?.fullName}</p>
              <p className="text-slate-600">{booking.laborId?.phone}</p>
              {booking.laborId?.savedAddress?.text && (
                <p className="text-slate-600 mt-1 text-xs">Location: {booking.laborId.savedAddress.text}</p>
              )}
            </div>
          )}

          {(!booking.assignments || booking.assignments.length === 0) && (
            <>
              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-xs">Start OTP</p>
                  <p className="font-mono font-semibold">{booking.startOtp || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Completion OTP</p>
                  <p className="font-mono font-semibold">{booking.completionOtp || 'N/A'}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-xs mb-2">Start Work Image</p>
                  {booking.startWorkImage ? (
                    <img src={booking.startWorkImage} alt="Start Work" className="w-full h-auto rounded-lg shadow-sm border border-slate-200" />
                  ) : (
                    <div className="w-full h-24 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs italic">
                      Not uploaded
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-2">End Work Image</p>
                  {booking.endWorkImage ? (
                    <img src={booking.endWorkImage} alt="End Work" className="w-full h-auto rounded-lg shadow-sm border border-slate-200" />
                  ) : (
                    <div className="w-full h-24 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs italic">
                      Not uploaded
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="border-t border-slate-100 pt-4 bg-slate-50 p-3 rounded-lg">
            <p className="font-extrabold text-sm mb-2">Financial Breakdown</p>
            {completedBill.isContractorBooking && completedBill.deductedBasePrice > 0 ? (
              <div className="mb-2 rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
                <span className="font-bold">Adjusted for Completed Work:</span> {completedBill.totalCompletedLabours} of {completedBill.totalRequestedLabours} labours completed. Unfulfilled service amount (-₹{completedBill.deductedBasePrice}) deducted.
              </div>
            ) : null}
            <div className="flex justify-between text-xs text-slate-600 py-1">
              <span>Base Price:</span>
              <span className="font-semibold text-slate-900">
                ₹{completedBill.completedBasePrice}
                {completedBill.isContractorBooking && completedBill.deductedBasePrice > 0 && (
                  <span className="text-[11px] text-slate-400 line-through ml-1.5">₹{completedBill.originalBasePrice}</span>
                )}
              </span>
            </div>
            {completedBill.isContractorBooking && completedBill.deductedBasePrice > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 py-1 font-medium">
                <span>Deductions (Unfulfilled / Pending):</span>
                <span>-₹{completedBill.deductedBasePrice}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-600 py-1">
              <span>Platform Fee:</span>
              <span className="font-semibold text-slate-900">₹{completedBill.completedPlatformFee}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600 py-1">
              <span>Taxes:</span>
              <span className="font-semibold text-slate-900">₹{completedBill.completedTaxes}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-900 py-1 font-bold border-t border-slate-200 mt-1 pt-2">
              <span>Total Amount:</span>
              <span className="text-base text-brand font-extrabold">₹{completedBill.completedTotalAmount}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600 py-1 mt-2">
              <span>Commission (Admin):</span>
              <span className="font-semibold text-brand">
                ₹{completedBill.isContractorBooking ? Math.round(completedBill.completedBasePrice * 0.10) : booking.commissionAmount}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-600 py-1">
              <span>Labour Share:</span>
              <span className="font-semibold text-green-600">
                ₹{completedBill.isContractorBooking ? Math.round(completedBill.completedBasePrice * 0.90) : booking.laborShare}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BookingsListTab({ type }) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data, isLoading, isError, refetch } = useGetAdminBookingsQuery({ status: statusFilter, type },
  )
  const [deleteAdminBooking] = useDeleteAdminBookingMutation()

  const bookings = data?.bookings ?? []

  const confirmDelete = async () => {
    if (!deleteConfirmId) return
    setIsDeleting(true)
    try {
      await deleteAdminBooking(deleteConfirmId).unwrap()
      refetch()
    } catch (err) {
      console.error('Failed to delete booking:', err)
      alert('Failed to delete booking.')
    } finally {
      setIsDeleting(false)
      setDeleteConfirmId(null)
    }
  }

  return (
    <div className="space-y-6 mt-6">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {BOOKING_STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${
                statusFilter === f.value
                  ? 'bg-brand text-white ring-brand'
                  : 'bg-white text-slate-600 ring-slate-200 hover:ring-brand/30'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <GlassPanel className="p-6">
          <p className="text-sm text-slate-500">Loading bookings…</p>
        </GlassPanel>
      ) : null}

      {isError ? (
        <GlassPanel className="border-rose-200 p-6">
          <p className="text-sm font-semibold text-rose-800">Failed to load bookings.</p>
        </GlassPanel>
      ) : null}

      {!isLoading && !isError && bookings.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-slate-700">No bookings in this filter.</p>
        </GlassPanel>
      ) : null}

      <ul className="space-y-4">
        {bookings.map((b) => {
          return (
          <li key={b._id}>
            <GlassPanel className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  {b.contractorInfo?.services?.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {b.contractorInfo.services.map((s, idx) => (
                        <span key={idx} className="text-[11px] font-bold text-brand bg-brand/5 px-2 py-0.5 rounded-md">
                          {s.serviceId?.name || s.serviceName || 'Unknown'} (x{s.quantity || 1})
                        </span>
                      ))}
                      <span className="text-sm font-black text-slate-900 ml-1">({b.type})</span>
                    </div>
                  ) : (
                    <p className="text-sm font-black text-slate-900 truncate">{b.serviceId?.name || 'Service'} ({b.type})</p>
                  )}
                  <p className="text-xs text-slate-500 truncate">
                    User: {b.userId?.fullName || 'Unknown'} · {b.userId?.phone}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    Location: {b.address?.locationText || 'No location'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Date: {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                  <div className="pt-2 flex flex-wrap gap-1.5 items-center">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeStyle(b.status)}`}>
                      {b.status?.replace(/_/g, ' ')}
                    </span>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      b.paymentStatus === 'PAID'
                        ? 'bg-emerald-100 text-emerald-700'
                        : b.paymentStatus === 'REFUNDED'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {b.paymentStatus === 'PAID' ? '✓ Paid' : b.paymentStatus === 'REFUNDED' ? 'Refunded' : '⚠ Payment Pending'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:shrink-0 mt-2 sm:mt-0">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(b._id)}
                    className="flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:border-rose-300 hover:bg-rose-100 transition shadow-sm"
                    title="Delete permanently"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBooking(b)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-bold text-brand hover:border-brand/30 hover:bg-brand/5 transition"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </GlassPanel>
          </li>
          )
        })}
      </ul>

      {selectedBooking && (
        <BookingDetailsModal 
          booking={selectedBooking} 
          onClose={() => setSelectedBooking(null)} 
        />
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-900/5">
            <h3 className="text-lg font-bold text-slate-900">Confirm Deletion</h3>
            <p className="mt-2 text-sm text-slate-500">
              Are you sure you want to permanently delete this booking? This action cannot be undone.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={isDeleting}
                className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 focus:ring-2 focus:ring-rose-500/30 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminBookingsPage() {
  const [activeTab, setActiveTab] = useState('customer')

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 md:px-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Bookings & requests</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage individual bookings and contractor workforce requests.
        </p>
      </div>

      <div className="flex items-center space-x-4 border-b border-slate-200">
        <button
          className={`pb-2 text-sm font-bold border-b-2 transition ${
            activeTab === 'customer'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          onClick={() => setActiveTab('customer')}
        >
          Individual Bookings
        </button>
        <button
          className={`pb-2 text-sm font-bold border-b-2 transition ${
            activeTab === 'contractor'
              ? 'border-brand text-brand'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          onClick={() => setActiveTab('contractor')}
        >
          Contractor Bookings
        </button>
      </div>

      {activeTab === 'contractor' && <BookingsListTab type="contractor" />}
      {activeTab === 'customer' && <BookingsListTab type="individual" />}
    </div>
  )
}
