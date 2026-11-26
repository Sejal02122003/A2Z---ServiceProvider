import { Complaint } from '../models/Complaint.js'
import { User } from '../models/User.js'
import { InAppNotification } from '../models/InAppNotification.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendError, sendSuccess, HTTP_STATUS } from '../utils/apiResponse.js'

export const getAllComplaints = asyncHandler(async (req, res) => {
  const { status, role, page = 1, limit = 20 } = req.query
  const query = status && status !== 'ALL' ? { status } : {}
  
  if (role && role !== 'ALL') {
    const users = await User.find({ role }).select('_id')
    query.complainantId = { $in: users.map(u => u._id) }
  }

  const skip = (Number(page) - 1) * Number(limit)

  const complaints = await Complaint.find(query)
    .populate('complainantId', 'fullName phone role')
    .populate('complaineeId', 'fullName phone role')
    .populate('bookingId', 'status type locationText')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  const total = await Complaint.countDocuments(query)

  return sendSuccess(res, {
    data: {
      complaints,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    },
  })
})

export const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, adminRemarks } = req.body

  const complaint = await Complaint.findById(id)
  if (!complaint) {
    return sendError(res, { message: 'Complaint not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const previousStatus = complaint.status
  const previousRemarks = complaint.adminRemarks || ''

  if (status) complaint.status = status
  if (adminRemarks !== undefined) complaint.adminRemarks = adminRemarks

  await complaint.save()

  const statusChanged = Boolean(status) && status !== previousStatus
  const remarksChanged =
    adminRemarks !== undefined && String(adminRemarks).trim() !== '' && String(adminRemarks).trim() !== previousRemarks.trim()

  // Tell the person who raised the complaint that admin has responded
  if (statusChanged || remarksChanged) {
    notifyComplainant(complaint, { statusChanged, remarksChanged }).catch((err) =>
      console.warn('[Complaint response notify warning]', err?.message),
    )
  }

  return sendSuccess(res, { message: 'Complaint updated successfully', data: { complaint } })
})

const STATUS_LABELS = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

async function notifyComplainant(complaint, { statusChanged, remarksChanged }) {
  const complainant = await User.findById(complaint.complainantId).select('role')
  if (!complainant) return

  const link = complainant.role === 'labour' ? '/serviceprovider/support' : '/user/support'
  const statusLabel = STATUS_LABELS[complaint.status] || complaint.status
  const subject = complaint.title || 'your complaint'

  const title = remarksChanged ? 'Admin responded to your complaint' : `Your complaint is ${statusLabel.toLowerCase()}`
  let body = remarksChanged
    ? `"${subject}": ${String(complaint.adminRemarks).trim().slice(0, 140)}`
    : `Status of "${subject}" is now ${statusLabel}.`
  if (remarksChanged && statusChanged) body += ` (Status: ${statusLabel})`

  const metadata = {
    link,
    complaintId: String(complaint._id),
    status: complaint.status,
    action: 'COMPLAINT_RESPONSE',
  }

  // 1. Persist so it appears in the notification list
  let record = null
  try {
    record = await InAppNotification.create({
      userId: complaint.complainantId,
      title,
      body,
      type: 'COMPLAINT_RESPONSE',
      deliveryStatus: 'SENT',
      metadata,
    })
  } catch (err) {
    console.warn('[Complaint InAppNotification warning]', err?.message)
  }

  // 2. Live update for an open app (bell badge + list)
  try {
    const { emitToUser } = await import('../socket.js')
    emitToUser(complaint.complainantId, 'NEW_IN_APP_NOTIFICATION', record || { title, body, metadata })
  } catch (err) {
    console.warn('[Complaint socket emit warning]', err?.message)
  }

  // 3. Push notification (app closed / in background)
  try {
    const { sendNotificationToUser } = await import('../utils/pushNotificationHelper.js')
    await sendNotificationToUser(complaint.complainantId, {
      title,
      body,
      link,
      data: {
        type: 'COMPLAINT_RESPONSE',
        complaintId: String(complaint._id),
        status: String(complaint.status),
        link,
      },
    })
  } catch (err) {
    console.warn('[Complaint push warning]', err?.message)
  }
}
