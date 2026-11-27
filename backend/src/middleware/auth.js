import fs from 'fs'
import { verifyAccessToken } from '../services/tokenService.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { canSubAdminAccess } from '../constants/adminPermissions.js'

/** True when the token was issued before the admin last reset this account's password */
export function isStaleSession(user, payload) {
  return Boolean(user.passwordChangedAt) && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
}

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    console.log(`[Auth Error] Missing or invalid header. Request URL: ${req.originalUrl}, Header: ${header}`)
    return sendError(res, {
      message: 'Authentication required',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'UNAUTHORIZED',
    })
  }
  const token = header.slice(7)
  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    return sendError(res, {
      message: 'Invalid or expired token',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'INVALID_TOKEN',
    })
  }

  const user = await User.findById(payload.sub)
  if (!user || !user.isActive || isStaleSession(user, payload)) {
    return sendError(res, {
      message: 'User not found or inactive',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'UNAUTHORIZED',
    })
  }

  // Sub-admins: every authenticated request must be covered by a section they were given
  if (user.role === USER_ROLES.SUB_ADMIN && !canSubAdminAccess(user.adminPermissions, req.method, req.originalUrl)) {
    return sendError(res, {
      message: 'You do not have access to this section. Please contact the main admin.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'FORBIDDEN',
    })
  }

  req.user = user
  req.tokenPayload = payload
  next()
})

export const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return next()
  }
  const token = header.slice(7)
  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    return next()
  }

  try {
    const user = await User.findById(payload.sub)
    const allowed =
      user?.role !== USER_ROLES.SUB_ADMIN ||
      (!isStaleSession(user, payload) && canSubAdminAccess(user.adminPermissions, req.method, req.originalUrl))
    if (user && user.isActive && allowed) {
      req.user = user
      req.tokenPayload = payload
    }
  } catch {
    // Silently continue if user lookup fails
  }
  next()
})

export function mainAdminOnly(req, res, next) {
  if (req.user?.role !== USER_ROLES.ADMIN) {
    return sendError(res, {
      message: 'Only the main admin can do this',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'FORBIDDEN',
    })
  }
  next()
}

export function restrictTo(...roles) {
  const lowerRoles = roles.map(r => String(r).toLowerCase())
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, {
        message: 'Authentication required',
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        code: 'UNAUTHORIZED',
      })
    }
    
    try {
      fs.appendFileSync('/tmp/auth.log', `User role: ${req.user.role}, Allowed roles: ${lowerRoles.join(',')}\n`)
    } catch {
      // Safe fallback if /tmp is not available on environment
    }
    // A sub-admin passes admin-only routes here because `protect` already checked their sections
    const role = req.user.role === USER_ROLES.SUB_ADMIN ? USER_ROLES.ADMIN : req.user.role
    if (!lowerRoles.includes(String(role).toLowerCase())) {
      return sendError(res, {
        message: 'You do not have permission for this action',
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: 'FORBIDDEN',
      })
    }
    next()
  }
}
