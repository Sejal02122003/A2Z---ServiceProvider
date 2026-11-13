import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendError, HTTP_STATUS } from '../utils/apiResponse.js'
import { User } from '../models/User.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'

export const saveToken = asyncHandler(async (req, res) => {
  const { token, platform = 'web' } = req.body;
  if (!token) {
    return sendError(res, { message: 'Token is required', statusCode: HTTP_STATUS.BAD_REQUEST, code: 'MISSING_TOKEN' });
  }
  
  const userId = req.user._id;
  const user = await User.findById(userId);
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND });
  }

  if (platform === 'web') {
    if (!user.fcmTokens) user.fcmTokens = [];
    if (!user.fcmTokens.includes(token)) {
      user.fcmTokens.push(token);
    }
    user.fcmTokens = [...new Set(user.fcmTokens)].slice(-10);

    // Disassociate this device token from other users to prevent cross-account alerts
    await User.updateMany(
      { _id: { $ne: userId }, fcmTokens: token },
      { $pull: { fcmTokens: token } }
    ).catch(() => {});
  } else if (platform === 'mobile') {
    if (!user.fcmTokenMobile) user.fcmTokenMobile = [];
    if (!user.fcmTokenMobile.includes(token)) {
      user.fcmTokenMobile.push(token);
    }
    user.fcmTokenMobile = [...new Set(user.fcmTokenMobile)].slice(-10);

    await User.updateMany(
      { _id: { $ne: userId }, fcmTokenMobile: token },
      { $pull: { fcmTokenMobile: token } }
    ).catch(() => {});
  }

  await user.save();
  console.log(`[FCM] Successfully linked ${platform} token to user ${user.phone} (${user.role})`);
  return sendSuccess(res, { message: 'FCM token saved', totalTokens: (platform === 'web' ? user.fcmTokens : user.fcmTokenMobile).length });
});

export const removeToken = asyncHandler(async (req, res) => {
  const { token, platform = 'web' } = req.body;
  if (!token) {
    return sendError(res, { message: 'Token is required', statusCode: HTTP_STATUS.BAD_REQUEST, code: 'MISSING_TOKEN' });
  }

  const userId = req.user._id;
  const user = await User.findById(userId);

  if (platform === 'web' && user.fcmTokens) {
    user.fcmTokens = user.fcmTokens.filter(t => t !== token);
  } else if (platform === 'mobile' && user.fcmTokenMobile) {
    user.fcmTokenMobile = user.fcmTokenMobile.filter(t => t !== token);
  }

  await user.save();
  return sendSuccess(res, { message: 'FCM token removed' });
});

export const testNotification = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  // This will send to all tokens registered for this user
  const result = await sendNotificationToUser(userId, {
    title: 'A2Z Service Hub',
    body: '🔔 Push notification test! Your device is successfully linked to receive alerts outside the app.',
    data: {
      type: 'test',
      link: '/'
    }
  });

  if (!result || !result.success) {
    return sendError(res, {
      message: result?.noTokens
        ? 'No active device tokens found. Please grant notification permission in your browser.'
        : (result?.error || 'Failed to dispatch push notification through FCM'),
      statusCode: HTTP_STATUS.BAD_REQUEST,
      data: result,
    });
  }

  return sendSuccess(res, {
    message: `Test push notification successfully sent (${result.successCount} delivered)`,
    data: result
  });
});
