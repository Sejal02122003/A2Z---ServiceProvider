import { useState, useEffect } from 'react'
import { User, Lock, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { getAdminProfile, updateAdminProfile, changeAdminPassword } from '../../api/adminProfileApi.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'

export function AdminProfilePage() {
  const [profile, setProfile] = useState({ fullName: '', email: '' })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
  const [loading, setLoading] = useState(true)
  
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const res = await getAdminProfile()
      if (res.data?.user) {
        setProfile({
          fullName: res.data.user.fullName || '',
          email: res.data.user.email || ''
        })
      }
    } catch (error) {
      setProfileMsg({ type: 'error', text: 'Failed to load profile' })
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg({ type: '', text: '' })
    try {
      await updateAdminProfile(profile)
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' })
    } catch (error) {
      setProfileMsg({ type: 'error', text: error.response?.data?.message || 'Failed to update profile' })
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordUpdate = async (e) => {
    e.preventDefault()
    
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' })
      return
    }
    
    setPasswordSaving(true)
    setPasswordMsg({ type: '', text: '' })
    try {
      await changeAdminPassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      })
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' })
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      setPasswordMsg({ type: 'error', text: error.response?.data?.message || 'Failed to change password' })
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admin Profile</h1>
        <p className="text-gray-500 mt-1">Manage your personal information and credentials</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Profile Info Section */}
        <GlassPanel className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <User className="w-24 h-24" />
          </div>
          
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-brand-primary" />
            Personal Information
          </h2>
          
          {profileMsg.text && (
            <div className={`p-3 rounded-lg mb-6 text-sm flex items-start gap-2 ${
              profileMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
            }`}>
              {profileMsg.type === 'success' && <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleProfileUpdate} className="space-y-4 relative z-10">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={profile.fullName}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                placeholder="Admin Name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                placeholder="admin@example.com"
              />
            </div>
            
            <div className="pt-2">
              <AppPrimaryButton type="submit" disabled={profileSaving} className="w-full justify-center">
                {profileSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : 'Update Profile'}
              </AppPrimaryButton>
            </div>
          </form>
        </GlassPanel>

        {/* Password Change Section */}
        <GlassPanel className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Lock className="w-24 h-24" />
          </div>
          
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-brand-primary" />
            Change Password
          </h2>
          
          {passwordMsg.text && (
            <div className={`p-3 rounded-lg mb-6 text-sm flex items-start gap-2 ${
              passwordMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
            }`}>
              {passwordMsg.type === 'success' && <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {passwordMsg.text}
            </div>
          )}

          <form onSubmit={handlePasswordUpdate} className="space-y-4 relative z-10">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  required
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  className="w-full px-4 py-2 pr-11 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 transition-colors"
                  aria-label={showPasswords.current ? 'Hide current password' : 'Show current password'}
                >
                  {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  className="w-full px-4 py-2 pr-11 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 transition-colors"
                  aria-label={showPasswords.new ? 'Hide new password' : 'Show new password'}
                >
                  {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 pr-11 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 transition-colors"
                  aria-label={showPasswords.confirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div className="pt-2">
              <AppPrimaryButton type="submit" disabled={passwordSaving} className="w-full justify-center">
                {passwordSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...
                  </>
                ) : 'Change Password'}
              </AppPrimaryButton>
            </div>
          </form>
        </GlassPanel>
      </div>
    </div>
  )
}
