import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { USER_ROLES } from '../constants/roles.js'
import { ADMIN_PERMISSION_KEYS } from '../constants/adminPermissions.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { disconnectUser, syncSubAdminRooms } from '../socket.js'

const toView = (u) => ({
  _id: u._id,
  fullName: u.fullName,
  email: u.email,
  isActive: u.isActive,
  permissions: u.adminPermissions || [],
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
})

const cleanPermissions = (list) => [...new Set(list)].filter((p) => ADMIN_PERMISSION_KEYS.includes(p))

const findSubAdmin = (id) => User.findOne({ _id: id, role: USER_ROLES.SUB_ADMIN })

const notFound = (res) => sendError(res, { message: 'Sub-admin not found', statusCode: HTTP_STATUS.NOT_FOUND })

const emailTaken = (res) =>
  sendError(res, {
    message: 'This email is already used by another account.',
    statusCode: HTTP_STATUS.CONFLICT,
    code: 'EMAIL_TAKEN',
  })

/**
 * The user model requires a unique 10-digit phone. Sub-admins sign in by email only, so they get a
 * placeholder starting with 0: it can never pass the mobile OTP login / registration validators.
 */
async function createPlaceholderPhone() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const phone = `0${String(crypto.randomInt(0, 1_000_000_000)).padStart(9, '0')}`
    if (!(await User.exists({ phone }))) return phone
  }
  throw new Error('Could not allocate an account id for the sub-admin')
}

export const listSubAdmins = asyncHandler(async (_req, res) => {
  const users = await User.find({ role: USER_ROLES.SUB_ADMIN }).sort({ createdAt: -1 })
  return sendSuccess(res, { data: { subAdmins: users.map(toView) } })
})

export const createSubAdmin = asyncHandler(async (req, res) => {
  const { fullName, password, permissions } = req.body
  const email = String(req.body.email).trim().toLowerCase()

  if (await User.exists({ email })) return emailTaken(res)

  const user = await User.create({
    role: USER_ROLES.SUB_ADMIN,
    fullName: fullName.trim(),
    email,
    phone: await createPlaceholderPhone(),
    passwordHash: await bcrypt.hash(password, 12),
    adminPermissions: cleanPermissions(permissions),
    isActive: true,
  })

  return sendSuccess(res, {
    message: 'Sub-admin created',
    statusCode: HTTP_STATUS.CREATED,
    data: { subAdmin: toView(user) },
  })
})

export const updateSubAdmin = asyncHandler(async (req, res) => {
  const user = await findSubAdmin(req.params.id)
  if (!user) return notFound(res)

  const { fullName, password, permissions, isActive } = req.body

  if (req.body.email !== undefined) {
    const email = String(req.body.email).trim().toLowerCase()
    if (await User.exists({ email, _id: { $ne: user._id } })) return emailTaken(res)
    user.email = email
  }
  if (fullName !== undefined) user.fullName = fullName.trim()
  if (permissions !== undefined) user.adminPermissions = cleanPermissions(permissions)
  if (isActive !== undefined) user.isActive = Boolean(isActive)
  if (password) {
    user.passwordHash = await bcrypt.hash(password, 12)
    user.passwordChangedAt = new Date() // signs out sessions opened with the old password
  }

  await user.save()

  // Apply to live connections as well
  if (!user.isActive || password) disconnectUser(user._id)
  else if (permissions !== undefined) syncSubAdminRooms(user._id, user.adminPermissions)

  return sendSuccess(res, { message: 'Sub-admin updated', data: { subAdmin: toView(user) } })
})

export const deleteSubAdmin = asyncHandler(async (req, res) => {
  const user = await findSubAdmin(req.params.id)
  if (!user) return notFound(res)
  await User.deleteOne({ _id: user._id })
  disconnectUser(user._id)
  return sendSuccess(res, { message: 'Sub-admin deleted' })
})
