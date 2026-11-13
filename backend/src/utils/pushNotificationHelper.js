import { getFirebaseAdmin } from '../config/firebase.js';
import { User } from '../models/User.js';

// Server-side dispatch idempotency cache (suppress duplicate push events within 12 seconds)
const dispatchIdempotencyCache = new Map();
const IDEMPOTENCY_WINDOW_MS = 12000;

function cleanupIdempotencyCache() {
  const now = Date.now();
  for (const [key, timestamp] of dispatchIdempotencyCache.entries()) {
    if (now - timestamp > IDEMPOTENCY_WINDOW_MS) {
      dispatchIdempotencyCache.delete(key);
    }
  }
}
setInterval(cleanupIdempotencyCache, 30000).unref();

export async function sendNotificationToUser(userId, payload, includeMobile = true) {
  try {
    // Sanitize data payload (FCM multicast data requires all values to be strings)
    const stringifiedData = {};
    if (payload.data && typeof payload.data === 'object') {
      for (const [key, value] of Object.entries(payload.data)) {
        if (value !== undefined && value !== null) {
          stringifiedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
      }
    }

    const rawType = (stringifiedData.type || payload.type || '').toUpperCase();
    const isBookingOffer =
      rawType === 'NEW_BOOKING' ||
      rawType === 'BOOKING_RECEIVED' ||
      rawType === 'NEW_BROADCAST_JOB' ||
      rawType === 'BOOKING_REBROADCASTING' ||
      payload.isBookingOffer === true;

    const notifType = stringifiedData.type || (isBookingOffer ? 'NEW_BOOKING' : 'NOTIFICATION');
    const bookingId = stringifiedData.bookingId || '';
    const eventId =
      stringifiedData.eventId ||
      stringifiedData.notificationId ||
      `evt_${bookingId || Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Server-side Idempotency Check for Booking Offers (instant duplicate suppression)
    if (isBookingOffer && bookingId) {
      const idempotencyKey = `${userId}_${bookingId}_${notifType}`;
      const lastSent = dispatchIdempotencyCache.get(idempotencyKey);
      const now = Date.now();
      if (lastSent && now - lastSent < IDEMPOTENCY_WINDOW_MS) {
        console.log(`[FCM Idempotency] Suppressed duplicate push notification for booking ${bookingId} to user ${userId}`);
        return {
          success: true,
          idempotentDuplicate: true,
          totalTokens: 0,
          successCount: 1,
          failureCount: 0,
          eventId,
        };
      }
      dispatchIdempotencyCache.set(idempotencyKey, now);
    }

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
      console.log(`[FCM] No registered device tokens found for user ${userId}`);
      return {
        success: false,
        noTokens: true,
        totalTokens: 0,
        successCount: 0,
        failureCount: 0,
        message: 'No registered device tokens',
      };
    }

    const timestampStr = stringifiedData.timestamp || stringifiedData.createdAt || String(Date.now());
    const channelId = isBookingOffer ? 'new_booking_alerts' : 'high_importance_channel';

    const defaultTitle = isBookingOffer ? 'New Booking Received! ⚡' : 'A2Z Service Hub';
    const defaultBody = isBookingOffer
      ? 'You have received a new booking. Open the app to view details.'
      : 'You have a new update';
    const finalTitle = payload.title || stringifiedData.title || defaultTitle;
    const finalBody = payload.body || stringifiedData.body || defaultBody;

    const targetUrl =
      payload.link ||
      stringifiedData.link ||
      (isBookingOffer
        ? `/serviceprovider?incoming_booking=${bookingId}`
        : (bookingId ? `/booking-details/${bookingId}` : '/'));

    // Prepare message with webpush & android configs for system-level notifications
    const message = {
      notification: {
        title: finalTitle,
        body: finalBody,
      },
      data: {
        ...stringifiedData,
        title: finalTitle,
        body: finalBody,
        type: notifType,
        bookingId: bookingId,
        serviceProviderId: isBookingOffer ? String(userId) : (stringifiedData.serviceProviderId || ''),
        providerId: isBookingOffer ? String(userId) : (stringifiedData.providerId || ''),
        eventId: eventId,
        notificationId: eventId,
        createdAt: timestampStr,
        timestamp: timestampStr,
        sound: isBookingOffer ? '/alert.mp3' : 'default',
        channelId: channelId,
        channel_id: channelId,
        priority: 'high',
        click_action: targetUrl,
        link: targetUrl,
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          title: finalTitle,
          body: finalBody,
          icon: payload.icon || '/logo.png',
          badge: '/logo.png',
          tag: bookingId ? `booking-${bookingId}` : (payload.tag || channelId),
          renotify: true,
          requireInteraction: isBookingOffer,
          silent: false,
          sound: isBookingOffer ? '/alert.mp3' : undefined,
          vibrate: isBookingOffer ? [500, 200, 500, 200, 500, 200, 800] : [200, 100, 200],
          actions: isBookingOffer
            ? [
                { action: 'open_booking', title: '⚡ View & Accept Job' },
                { action: 'dismiss', title: 'Dismiss' },
              ]
            : [],
        },
        fcmOptions: {
          link: targetUrl,
        },
      },
      android: {
        priority: 'high',
        notification: {
          title: finalTitle,
          body: finalBody,
          channelId: channelId,
          sound: isBookingOffer ? 'alert' : 'default',
          defaultSound: !isBookingOffer,
          defaultVibrateTimings: true,
          priority: 'max',
          visibility: 'public',
          clickAction: targetUrl,
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
          const errCode = String(resp.error?.code || '');
          const errMsg = String(resp.error?.message || '');
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered' ||
            errCode === 'messaging/invalid-argument' ||
            errCode === 'messaging/third-party-auth-error' ||
            errCode.toLowerCase().includes('unregistered') ||
            errCode.toLowerCase().includes('permission-denied') ||
            errCode.toLowerCase().includes('third-party') ||
            errMsg.includes('401') ||
            errMsg.includes('403') ||
            errMsg.includes('404') ||
            errMsg.toLowerCase().includes('unregistered') ||
            errMsg.toLowerCase().includes('not found')
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

