import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { User } from './models/User.js'
import { USER_ROLES } from './constants/roles.js'
import { ADMIN_PERMISSION_KEYS, permissionsForAdminLink } from './constants/adminPermissions.js'
import { isStaleSession } from './middleware/auth.js'

const permissionRoom = (key) => `admin-section:${key}`

/** Sections interested in a live admin event that carries no page link */
const EVENT_PERMISSIONS = {
  NEW_BOOKING_ALERT: ['bookings'],
  BOOKING_ACCEPTED_ADMIN: ['bookings'],
  BOOKING_STATUS_UPDATE_ADMIN: ['bookings'],
  WALLET_RECHARGE_REQUEST_SUBMITTED: ['wallet_recharge', 'provider_wallet', 'payments'],
  PROVIDER_PAYMENT_SUBMITTED: ['wallet_recharge', 'provider_wallet', 'payments'],
}

let io

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || process.env.NODE_ENV !== 'production') {
          return callback(null, true)
        }
        const allowed = (process.env.CORS_ORIGIN || '*')
          .split(',')
          .map((o) => o.trim())
        if (allowed.includes('*') || allowed.includes(origin)) {
          return callback(null, true)
        }
        return callback(new Error('CORS origin denied'), false)
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['polling', 'websocket'],
    allowUpgrades: true,
    pingTimeout: 30000,
    pingInterval: 25000,
  })

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token
      if (!token) return next(new Error('Authentication error: Token missing'))

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.sub)
      
      if (!user) return next(new Error('Authentication error: User not found'))
      if (user.role === USER_ROLES.SUB_ADMIN && (!user.isActive || isStaleSession(user, decoded))) {
        return next(new Error('Authentication error: Session expired'))
      }
      
      socket.user = user
      next()
    } catch (error) {
      next(new Error('Authentication error: Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.user._id}, role=${socket.user.role}, name=${socket.user.fullName || socket.user.phone})`)
    
    // Join a room specific to this user ID so we can emit directly to them
    socket.join(socket.user._id.toString())

    // Join workforce vendors room for simulated & real broadcast alerts
    if (socket.user.role === 'labour' || socket.user.role === 'contractor') {
      socket.join('workforce_vendors')
    }

    // Join admins room for instant real-time admin panel alerts
    if (socket.user.role === 'admin') {
      socket.join('admins')
      console.log(`[SOCKET] Admin ${socket.user._id} joined "admins" room`)
    }

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`)
    })

    // Sub-admins only receive alerts for the sections they were given
    if (socket.user.role === USER_ROLES.SUB_ADMIN) {
      for (const key of socket.user.adminPermissions || []) socket.join(permissionRoom(key))
    }

    // Listen for live location updates from labourer
    socket.on('LABOUR_LOCATION_UPDATE', (data) => {
      // data should contain { customerId, bookingId, lat, lng }
      if (data && data.customerId) {
        // Forward it to the customer
        emitToUser(data.customerId, 'LABOUR_LOCATION_UPDATE', data)
      }
    })
  })

  return io
}

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized!')
  }
  return io
}

export const getIO = getIo

export const emitToUser = (userId, eventName, payload) => {
  if (io) {
    const rawId = userId?._id || userId
    const strId = rawId ? rawId.toString() : ''
    if (!strId) return
    const room = io.sockets.adapter.rooms.get(strId)
    const activeSockets = room ? room.size : 0
    console.log(`[SOCKET] emitToUser event="${eventName}" to user=${strId} (active sockets in room: ${activeSockets})`)
    if (activeSockets === 0) {
      console.warn(`[SOCKET] ⚠ event="${eventName}" NOT DELIVERED live: user ${strId} has NO connected socket (app closed / socket not connected / wrong user id)`)
    }
    io.to(strId).emit(eventName, payload)
  }
}

export const emitToAdmins = (eventName, payload) => {
  if (io) {
    const room = io.sockets.adapter.rooms.get('admins')
    const activeSockets = room ? room.size : 0
    console.log(`[FLOW: SOCKET_EMIT_ADMIN] event="${eventName}" (active sockets in "admins" room: ${activeSockets})`)
    const sections = payload?.link
      ? permissionsForAdminLink(payload.link)
      : EVENT_PERMISSIONS[eventName] || []
    // A socket in several target rooms still receives the event once
    io.to(['admins', ...sections.map(permissionRoom)]).emit(eventName, payload)
  }
}

export const disconnectUser = (userId) => {
  io?.in(String(userId)).disconnectSockets(true)
}

export const syncSubAdminRooms = (userId, permissions) => {
  if (!io) return
  const sockets = io.in(String(userId))
  sockets.socketsLeave(ADMIN_PERMISSION_KEYS.map(permissionRoom))
  if (permissions?.length) io.in(String(userId)).socketsJoin(permissions.map(permissionRoom))
}


