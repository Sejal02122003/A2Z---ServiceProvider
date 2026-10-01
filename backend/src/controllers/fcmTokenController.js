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

  if (platform === 'web') {
    if (!user.fcmTokens) user.fcmTokens = [];
    if (!user.fcmTokens.includes(token)) {
      user.fcmTokens.push(token);
      if (user.fcmTokens.length > 10) {
        user.fcmTokens = user.fcmTokens.slice(-10);
      }
    }
  } else if (platform === 'mobile') {
    if (!user.fcmTokenMobile) user.fcmTokenMobile = [];
    if (!user.fcmTokenMobile.includes(token)) {
      user.fcmTokenMobile.push(token);
      if (user.fcmTokenMobile.length > 10) {
        user.fcmTokenMobile = user.fcmTokenMobile.slice(-10);
      }
    }
  }

  await user.save();
  return sendSuccess(res, { message: 'FCM token saved' });
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
  await sendNotificationToUser(userId, {
    title: 'Test Notification',
    body: 'This is a test notification from A2Z backend.',
    data: {
      type: 'test',
      link: '/'
    }
  });

  return sendSuccess(res, { message: 'Test notification sent to user devices' });
});
