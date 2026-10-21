import React from 'react'
import { XCircle, Phone, IndianRupee, MapPin, CheckCircle2 } from 'lucide-react'

export function AdminLabourDetailsModal({ data, onClose }) {
  if (!data) return null

  const { assignment, request } = data
  const labour = assignment.labourId || {}
  const vendor = assignment.vendorId || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5">
          <div>
            <h2 className="text-lg font-black text-slate-900">{labour.fullName || 'Service Provider Details'}</h2>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{assignment.status?.replace('_', ' ')}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <XCircle className="h-6 w-6" />
          </button>
        </div>
        
        <div className="p-5 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Phone className="h-5 w-5 text-brand" />
              <span className="font-semibold">{labour.phone || 'N/A'}</span>
            </div>
            {labour.category?.name && (
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                <span className="font-semibold">{labour.category.name}</span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Assignment Info</h3>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Contractor Client</p>
                <p className="font-semibold text-slate-800 line-clamp-1">{request.clientId?.contractorProfile?.companyName || request.clientId?.fullName}</p>
              </div>
              
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Assigned Vendor</p>
                <p className="font-semibold text-slate-800 line-clamp-1">{vendor.contractorProfile?.businessName || vendor.fullName || 'Direct'}</p>
              </div>

              <div>
                <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Duration</p>
                <p className="font-semibold text-slate-800">
                  {new Date(request.startDate).toLocaleDateString()} 
                  {request.endDate && ` - ${new Date(request.endDate).toLocaleDateString()}`}
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Price / Day</p>
                <p className="font-semibold text-slate-800 flex items-center">
                  <IndianRupee className="w-3 h-3 mr-0.5" />
                  {assignment.dailyRate || request.lines?.[0]?.dailyPrice || 'TBD'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => window.open(`tel:${labour.phone}`)}
              className="flex-1 rounded-xl bg-brand py-2.5 text-center text-sm font-bold text-white shadow-sm hover:bg-brand-dark transition"
            >
              Call Labour
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-center text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
