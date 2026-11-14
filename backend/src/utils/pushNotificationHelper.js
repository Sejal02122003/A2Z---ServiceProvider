import { getFirebaseAdmin } from '../config/firebase.js';
import { User } from '../models/User.js';

// Server-side dispatch idempotency cache (suppress duplicate push events within 12 seconds)
const dispatchIdempotencyCache = new Map();
const IDEMPOTENCY_WINDOW_MS = 25000;

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

    // Collect and segregate tokens
    const rawWebTokens = Array.isArray(user.fcmTokens) ? user.fcmTokens : [];
    const rawMobileTokens = (includeMobile && Array.isArray(user.fcmTokenMobile)) ? user.fcmTokenMobile : [];
    const mobileTokens = [...new Set(rawMobileTokens)];
    const webTokens = [...new Set(rawWebTokens.filter((t) => !mobileTokens.includes(t)))];
    const totalTokenCount = webTokens.length + mobileTokens.length;

    if (totalTokenCount === 0) {
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
    const channelId = isBookingOffer ? 'new_booking_alerts_v2' : 'high_importance_channel';

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

    const admin = getFirebaseAdmin();
    if (!admin || !admin.messaging) {
      throw new Error('Firebase Admin not configured properly');
    }

    let totalSuccessCount = 0;
    let totalFailureCount = 0;
    const invalidTokens = [];

    // Common shared data payload (strings only for FCM)
    const baseDataPayload = {
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
      sound: isBookingOffer ? 'alert' : 'default',
      channelId: channelId,
      channel_id: channelId,
      priority: 'high',
      click_action: targetUrl,
      link: targetUrl,
      callType: isBookingOffer ? 'INCOMING_BOOKING_CALL' : 'NOTIFICATION',
      isBookingAlert: String(isBookingOffer),
      ringtone: isBookingOffer ? 'alert' : 'default',
      continuousRinging: isBookingOffer ? 'true' : 'false',
      flagInsistent: isBookingOffer ? 'true' : 'false',
    };

    // 1. Dispatch to Web Tokens (PWA / Browser)
    if (webTokens.length > 0) {
      const webMessage = {
        notification: {
          title: finalTitle,
          body: finalBody,
        },
        data: baseDataPayload,
        webpush: {
          headers: {
            Urgency: 'high',
          },
          notification: {
            title: finalTitle,
            body: finalBody,
            icon: payload.icon || '/logo.png',
            badge: '/logo.png',
            tag: bookingId ? `booking-${bookingId}` : (payload.tag || (isBookingOffer ? 'new_booking_alerts_v2' : 'a2z-push')),
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
        tokens: webTokens,
      };

      if (payload.icon) {
        webMessage.notification.imageUrl = payload.icon;
      }

      try {
        const webResp = await admin.messaging().sendEachForMulticast(webMessage);
        totalSuccessCount += webResp.successCount;
        totalFailureCount += webResp.failureCount;

        if (webResp.failureCount > 0 && Array.isArray(webResp.responses)) {
          webResp.responses.forEach((resp, index) => {
            if (!resp.success) {
              const errCode = String(resp.error?.code || '');
              const errMsg = String(resp.error?.message || '');
              if (
                errCode.includes('unregistered') ||
                errCode.includes('invalid') ||
                errMsg.includes('401') ||
                errMsg.includes('403') ||
                errMsg.includes('404') ||
                errMsg.toLowerCase().includes('not found')
              ) {
                invalidTokens.push(webTokens[index]);
              }
            }
          });
        }
      } catch (err) {
        console.warn(`[FCM Web] Multicast error:`, err.message);
        totalFailureCount += webTokens.length;
      }
    }

    // 2. Dispatch to Mobile Tokens (Android Native / APK)
    if (mobileTokens.length > 0) {
      // Configure Android notification payload safely so notifications are never dropped by Android OS
      const androidNotificationConfig = {
        title: finalTitle,
        body: finalBody,
        priority: 'max',
        visibility: 'public',
        clickAction: targetUrl,
        defaultVibrateTimings: true,
      };

      if (isBookingOffer) {
        androidNotificationConfig.sound = 'alert';
        androidNotificationConfig.defaultSound = false;
      } else {
        androidNotificationConfig.sound = 'default';
        androidNotificationConfig.defaultSound = true;
      }

      // Use valid Android channel new_booking_alerts_v2 so notifications are never dropped by Android OS
      androidNotificationConfig.channelId = payload.channelId || 'new_booking_alerts_v2';

      const mobileMessage = {
        notification: {
          title: finalTitle,
          body: finalBody,
        },
        data: baseDataPayload,
        android: {
          priority: 'high',
          ttl: 86400 * 1000, // 24 hours TTL so sleeping/locked phones receive it without timeout drop
          notification: androidNotificationConfig,
        },
        tokens: mobileTokens,
      };

      if (payload.icon) {
        mobileMessage.notification.imageUrl = payload.icon;
      }

      try {
        const mobResp = await admin.messaging().sendEachForMulticast(mobileMessage);
        totalSuccessCount += mobResp.successCount;
        totalFailureCount += mobResp.failureCount;

        if (mobResp.failureCount > 0 && Array.isArray(mobResp.responses)) {
          mobResp.responses.forEach((resp, index) => {
            if (!resp.success) {
              const errCode = String(resp.error?.code || '');
              const errMsg = String(resp.error?.message || '');
              if (
                errCode.includes('unregistered') ||
                errCode.includes('invalid') ||
                errMsg.includes('401') ||
                errMsg.includes('403') ||
                errMsg.includes('404') ||
                errMsg.toLowerCase().includes('not found')
              ) {
                invalidTokens.push(mobileTokens[index]);
              }
            }
          });
        }
      } catch (err) {
        console.warn(`[FCM Mobile] Multicast error:`, err.message);
        totalFailureCount += mobileTokens.length;
      }
    }

    console.log(`[FLOW: PUSH_DISPATCH_RESULT] user=${userId} | Success=${totalSuccessCount}, Failed=${totalFailureCount} (Web=${webTokens.length}, Mobile=${mobileTokens.length}) | Title="${finalTitle}"`);

    // Prune confirmed dead / unregistered tokens from MongoDB so they never block future deliveries
    let invalidTokensCleaned = 0;
    if (invalidTokens.length > 0) {
      invalidTokensCleaned = invalidTokens.length;
      console.log(`[FCM] Deactivating ${invalidTokensCleaned} unregistered/invalid FCM token(s) for user ${userId}`);
      await User.findByIdAndUpdate(userId, {
        $pull: {
          fcmTokens: { $in: invalidTokens },
          fcmTokenMobile: { $in: invalidTokens },
        },
      }).catch((err) => console.warn(`[FCM] Error pruning invalid tokens:`, err.message));
    }

    return {
      success: totalSuccessCount > 0,
      totalTokens: totalTokenCount,
      successCount: totalSuccessCount,
      failureCount: totalFailureCount,
      invalidTokensCleaned,
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

/**
 * Dispatches push notification and creates in-app notification for ALL system administrators
 */
export async function sendNotificationToAdmins(payload) {
  try {
    const admins = await User.find({ role: 'admin' }, '_id fullName email fcmTokens fcmTokenMobile');
    if (!admins || admins.length === 0) {
      console.log('[FLOW: FCM_ADMIN_DISPATCH] No admin users found in database');
      return { success: false, reason: 'NO_ADMINS_FOUND' };
    }

    console.log(`[FLOW: FCM_ADMIN_DISPATCH] Dispatching push notification to ${admins.length} admin account(s): "${payload.title}"`);
    
    // Save InAppNotification for each admin so it renders in the Admin notifications dropdown
    try {
      const { InAppNotification } = await import('../models/InAppNotification.js');
      const inAppPromises = admins.map(admin => {
        return InAppNotification.create({
          userId: admin._id,
          title: payload.title || 'Admin Alert',
          body: payload.body || '',
          type: payload.data?.type || 'ADMIN_ALERT',
          bookingId: payload.data?.bookingId || undefined,
          deliveryStatus: 'SENT',
          metadata: {
            ...payload.data,
            link: payload.link || '/admin/bookings',
          }
        }).catch(err => console.warn('[FLOW: InAppNotification Admin Save Warning]', err.message));
      });
      await Promise.allSettled(inAppPromises);
    } catch (inAppErr) {
      console.warn('[FLOW: InAppNotification Admin Import/Save Warning]', inAppErr.message);
    }

    const dispatchPromises = admins.map(admin =>
      sendNotificationToUser(admin._id, {
        ...payload,
        link: payload.link || '/admin/bookings',
      })
    );

    const results = await Promise.allSettled(dispatchPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;

    console.log(`[FLOW: FCM_ADMIN_DISPATCH] Successfully dispatched push to ${successCount}/${admins.length} admin account(s)`);
    return {
      success: successCount > 0,
      totalAdmins: admins.length,
      successCount,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }),
    };
  } catch (err) {
    console.error('[FLOW: FCM_ADMIN_DISPATCH_ERROR]', err);
    return { success: false, error: err.message || String(err) };
  }
}


