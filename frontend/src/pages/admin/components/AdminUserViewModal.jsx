import { useEffect, useState } from 'react'
import { X, Loader2, User, Phone, Mail, Building2, MapPin, Briefcase, FileCheck, IndianRupee } from 'lucide-react'
import { fetchAdminUserById } from '../../../api/adminUsersApi.js'
import { WelcomeKitCard } from '../../../components/admin/welcomeKit/WelcomeKitCard.jsx'

export function AdminUserViewModal({ userId, onClose }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchAdminUserById(userId)
      .then(data => {
        if (!cancelled) {
          setUser(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Failed to load user details')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/80 px-6 py-4 backdrop-blur-md">
          <h2 className="text-lg font-bold text-slate-800">User Details</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-brand">
              <Loader2 className="size-8 animate-spin" />
              <p className="mt-4 text-sm font-medium text-slate-500">Loading user data...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-600">
              {error}
            </div>
          ) : !user ? (
            <div className="text-center text-slate-500 py-12">User not found</div>
          ) : (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="flex items-start gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 ring-4 ring-slate-50">
                  {user.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt="Profile" className="size-full rounded-full object-cover" />
                  ) : (
                    <User className="size-8" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">{user.fullName}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Phone className="size-4" /> {user.phone}</span>
                    {user.email && <span className="flex items-center gap-1"><Mail className="size-4" /> {user.email}</span>}
                    <span className="inline-flex items-center rounded-md bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand uppercase tracking-wider">
                      {user.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contractor Profile */}
              {user.role === 'contractor' && user.contractorProfile && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                  <h4 className="flex items-center gap-2 font-bold text-slate-700">
                    <Building2 className="size-5 text-brand" /> Business Profile
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Business Name</p>
                      <p className="font-medium text-slate-700">{user.contractorProfile.businessName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">KYC Status</p>
                      <p className={`font-bold ${user.contractorProfile.verificationStatus === 'approved' ? 'text-blue-600' : 'text-amber-600'}`}>
                        {user.contractorProfile.verificationStatus?.toUpperCase()}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Address</p>
                      <p className="font-medium text-slate-700">{user.contractorProfile.businessAddress || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Labour Profile */}
              {user.role === 'labour' && user.labourProfile && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                  <h4 className="flex items-center gap-2 font-bold text-slate-700">
                    <Briefcase className="size-5 text-brand" /> Labour Profile
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">KYC Status</p>
                      <p className={`font-bold ${user.labourProfile.kycStatus === 'verified' ? 'text-blue-600' : 'text-amber-600'}`}>
                        {user.labourProfile.kycStatus?.toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Availability</p>
                      <p className="font-medium text-slate-700 capitalize">{user.labourProfile.availabilityStatus}</p>
                    </div>
                    
                    {user.labourProfile.categoryIds?.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Categories</p>
                        <div className="flex flex-wrap gap-2">
                          {user.labourProfile.categoryIds.map(c => (
                            <span key={c._id} className="rounded-lg bg-white border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                              {c.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {user.role === 'labour' && (
                <WelcomeKitCard
                  user={user}
                  onUpdate={(updatedKit) => setUser({ ...user, welcomeKit: updatedKit })}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
