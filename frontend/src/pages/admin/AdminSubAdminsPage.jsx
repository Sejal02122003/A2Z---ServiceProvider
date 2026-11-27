import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2, Pencil, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react'
import { subAdminsApi } from '../../api/subAdminsApi.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppModal } from '../../components/app-ui/feedback/AppModal.jsx'
import { AppButton } from '../../components/app-ui/buttons/AppButton.jsx'
import { ADMIN_PERMISSION_GROUPS, ADMIN_PERMISSIONS } from '../../config/adminPermissions.js'
import { formatLastLoginDisplay } from '../../lib/formatAdminLastLogin.js'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'
const labelClass = 'text-xs font-bold uppercase tracking-wider text-slate-500'

const EMPTY_FORM = { fullName: '', email: '', password: '', permissions: [] }

const permissionLabel = (key) => ADMIN_PERMISSIONS.find((p) => p.key === key)?.label || key
const errorText = (err) => err?.errors?.[0]?.message || err?.message || 'Something went wrong'

export function AdminSubAdminsPage() {
  const [subAdmins, setSubAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [notice, setNotice] = useState('')

  // null = closed, otherwise { id: string | null }
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await subAdminsApi.list()
      setSubAdmins(res.data?.subAdmins || [])
      setPageError('')
    } catch (err) {
      setPageError(errorText(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openForm = (subAdmin) => {
    setEditing({ id: subAdmin?._id || null })
    setForm(
      subAdmin
        ? { fullName: subAdmin.fullName || '', email: subAdmin.email || '', password: '', permissions: subAdmin.permissions }
        : EMPTY_FORM,
    )
    setFormError('')
    setShowPassword(false)
    setNotice('')
  }

  const togglePermissions = (keys, on) => {
    setForm((prev) => {
      const rest = prev.permissions.filter((k) => !keys.includes(k))
      return { ...prev, permissions: on ? [...rest, ...keys] : rest }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const isNew = !editing.id
    if (form.fullName.trim().length < 2) return setFormError('Enter the sub-admin’s name')
    if (!form.email.trim()) return setFormError('Enter an email address')
    if ((isNew || form.password) && form.password.length < 8) return setFormError('Password must be at least 8 characters')
    if (!form.permissions.length) return setFormError('Select at least one section')

    setSaving(true)
    setFormError('')
    try {
      const payload = { ...form, fullName: form.fullName.trim(), email: form.email.trim() }
      if (!payload.password) delete payload.password
      if (isNew) await subAdminsApi.create(payload)
      else await subAdminsApi.update(editing.id, payload)
      setEditing(null)
      setNotice(
        isNew
          ? `Sub-admin created. Share the email and password with them; they sign in at ${window.location.origin}/admin/login`
          : 'Sub-admin updated',
      )
      await load()
    } catch (err) {
      setFormError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const runRowAction = async (id, action, message) => {
    setBusyId(id)
    setNotice('')
    try {
      await action()
      setNotice(message)
      await load()
    } catch (err) {
      setPageError(errorText(err))
    } finally {
      setBusyId('')
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-lg ring-4 ring-brand/10">
            <UserCog className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Sub-Admins</h1>
            <p className="text-sm text-slate-500">Create staff logins and choose which sections each one can use</p>
          </div>
        </div>
        <AppButton fullWidth={false} variant="primary" onClick={() => openForm(null)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add Sub-Admin
        </AppButton>
      </div>

      {notice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}
      {pageError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{pageError}</p>}

      {subAdmins.length === 0 ? (
        <GlassPanel className="p-10 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-bold text-slate-700">No sub-admins yet</p>
          <p className="mt-1 text-xs text-slate-500">Add one to give a team member access to selected parts of this panel.</p>
        </GlassPanel>
      ) : (
        <div className="space-y-3">
          {subAdmins.map((s) => (
            <GlassPanel key={s._id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-extrabold text-slate-900">{s.fullName}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}
                    >
                      {s.isActive ? 'Active' : 'Blocked'}
                    </span>
                  </div>
                  <p className="mt-0.5 break-all text-sm text-slate-600">{s.email}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Last login: {s.lastLoginAt ? formatLastLoginDisplay(s.lastLoginAt) : 'Never'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.permissions.map((key) => (
                      <span key={key} className="rounded-lg border border-brand/20 bg-brand/5 px-2 py-0.5 text-[11px] font-bold text-brand">
                        {permissionLabel(key)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <AppButton fullWidth={false} variant="secondary" onClick={() => openForm(s)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </AppButton>
                  <AppButton
                    fullWidth={false}
                    variant="secondary"
                    loading={busyId === s._id && !deleting}
                    onClick={() =>
                      runRowAction(
                        s._id,
                        () => subAdminsApi.update(s._id, { isActive: !s.isActive }),
                        s.isActive ? `${s.fullName} is blocked and signed out` : `${s.fullName} can sign in again`,
                      )
                    }
                  >
                    {s.isActive ? 'Block' : 'Unblock'}
                  </AppButton>
                  <button
                    type="button"
                    aria-label={`Delete ${s.fullName}`}
                    onClick={() => setDeleting(s)}
                    className="flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-600 transition hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </GlassPanel>
          ))}
        </div>
      )}

      <AppModal
        open={Boolean(editing)}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? 'Edit Sub-Admin' : 'Add Sub-Admin'}
        description="They can open only the sections you tick here."
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <label className="block">
            <span className={labelClass}>Full name</span>
            <input className={inputClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoComplete="off" />
          </label>
          <label className="block">
            <span className={labelClass}>Login email</span>
            <input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
          </label>
          <label className="block">
            <span className={labelClass}>{editing?.id ? 'New password (leave blank to keep)' : 'Password'}</span>
            <div className="relative">
              <input
                className={`${inputClass} pr-11`}
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 mt-[3px] -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className={labelClass}>
                Access ({form.permissions.length}/{ADMIN_PERMISSIONS.length})
              </span>
              <button
                type="button"
                className="text-xs font-bold text-brand hover:underline"
                onClick={() =>
                  togglePermissions(ADMIN_PERMISSIONS.map((p) => p.key), form.permissions.length < ADMIN_PERMISSIONS.length)
                }
              >
                {form.permissions.length < ADMIN_PERMISSIONS.length ? 'Select all' : 'Clear all'}
              </button>
            </div>
            <div className="mt-2 space-y-4">
              {ADMIN_PERMISSION_GROUPS.map((group) => (
                <fieldset key={group.title}>
                  <legend className="text-[11px] font-black uppercase tracking-wider text-slate-400">{group.title}</legend>
                  <div className="mt-1.5 space-y-1.5">
                    {group.items.map((p) => (
                      <label
                        key={p.key}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-2 transition hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 accent-[#015F6C]"
                          checked={form.permissions.includes(p.key)}
                          onChange={(e) => togglePermissions([p.key], e.target.checked)}
                        />
                        <span>
                          <span className="block text-sm font-bold text-slate-800">{p.label}</span>
                          <span className="block text-xs text-slate-500">{p.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>

          <div className="sticky -bottom-4 -mb-4 space-y-2 bg-white py-3">
            {formError && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{formError}</p>}
            <div className="flex justify-end gap-3">
              <AppButton fullWidth={false} type="button" variant="secondary" disabled={saving} onClick={() => setEditing(null)}>
                Cancel
              </AppButton>
              <AppButton fullWidth={false} type="submit" variant="primary" loading={saving}>
                {editing?.id ? 'Save Changes' : 'Create Sub-Admin'}
              </AppButton>
            </div>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete Sub-Admin"
        description={deleting ? `${deleting.fullName} (${deleting.email}) will lose access permanently.` : ''}
        footer={
          <div className="flex justify-end gap-3">
            <AppButton fullWidth={false} variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </AppButton>
            <AppButton
              fullWidth={false}
              variant="danger"
              loading={busyId === deleting?._id}
              onClick={() => runRowAction(deleting._id, () => subAdminsApi.remove(deleting._id), 'Sub-admin deleted')}
            >
              Delete
            </AppButton>
          </div>
        }
      />
    </div>
  )
}
