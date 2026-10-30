import { getFirebaseAdmin } from '../config/firebase.js';
import { User } from '../models/User.js';

export async function sendNotificationToUser(userId, payload, includeMobile = true) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Collect tokens
    let tokens = [];
    if (user.fcmTokens && user.fcmTokens.length > 0) {
      tokens = [...tokens, ...user.fcmTokens];
    }
    if (includeMobile && user.fcmTokenMobile && user.fcmTokenMobile.length > 0) {
      tokens = [...tokens, ...user.fcmTokenMobile];
    }

    // Remove duplicates
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      console.log(`No FCM tokens found for user ${userId}`);
      return {
        success: false,
        noTokens: true,
        totalTokens: 0,
        successCount: 0,
        failureCount: 0,
        message: 'No registered device tokens',
      };
    }

    // Sanitize data payload (FCM multicast data requires all values to be strings)
    const stringifiedData = {};
    if (payload.data && typeof payload.data === 'object') {
      for (const [key, value] of Object.entries(payload.data)) {
        if (value !== undefined && value !== null) {
          stringifiedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
      }
    }

    const linkUrl = payload.link || payload.data?.link || '/';

    // Prepare message with webpush & android configs for system-level notifications
    const message = {
      notification: {
        title: payload.title || 'A2Z Service Hub',
        body: payload.body || '',
      },
      data: stringifiedData,
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          title: payload.title || 'A2Z Service Hub',
          body: payload.body || '',
          icon: payload.icon || '/favicon.ico',
          badge: '/favicon.ico',
          tag: payload.tag || stringifiedData.type || 'a2z-notification',
          renotify: true,
          requireInteraction: false,
        },
        fcmOptions: {
          link: linkUrl,
        },
      },
      android: {
        priority: 'high',
        notification: {
          title: payload.title || 'A2Z Service Hub',
          body: payload.body || '',
          sound: 'default',
          channelId: 'high_importance_channel',
        },
      },
      tokens: uniqueTokens,
    };

    if (payload.icon) {
      message.notification.imageUrl = payload.icon;
    }

    // Send notification
    const admin = getFirebaseAdmin();
    if (!admin || !admin.messaging) {
      throw new Error('Firebase Admin not configured properly');
    }

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM] Sent: ${response.successCount} success, ${response.failureCount} failed for user ${userId}`);

    // Detect and deactivate/clean invalid or expired FCM tokens
    let invalidTokensCleaned = 0;
    if (response.failureCount > 0 && Array.isArray(response.responses)) {
      const invalidTokens = [];
      response.responses.forEach((resp, index) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(uniqueTokens[index]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        invalidTokensCleaned = invalidTokens.length;
        console.log(`[FCM] Deactivating ${invalidTokensCleaned} stale/invalid FCM tokens for user ${userId}`);
        await User.findByIdAndUpdate(userId, {
          $pull: {
            fcmTokens: { $in: invalidTokens },
            fcmTokenMobile: { $in: invalidTokens },
          },
        }).catch((err) => console.warn(`[FCM] Error pruning invalid tokens:`, err.message));
      }
    }

    return {
      success: response.successCount > 0,
      totalTokens: uniqueTokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokensCleaned,
      rawResponse: response,
    };
  } catch (error) {
    console.warn(`[FCM Warning] Failed to send push notification to user ${userId}:`, error.message || error);
    return {
      success: false,
      totalTokens: 0,
      successCount: 0,
      failureCount: 1,
      error: error.message || String(error),
    };
  }
}

