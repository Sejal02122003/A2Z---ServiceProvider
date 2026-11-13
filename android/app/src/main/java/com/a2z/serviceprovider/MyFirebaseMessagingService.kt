package com.a2z.serviceprovider

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "FCM Message received from: ${remoteMessage.from}")

        val data = remoteMessage.data
        val rawType = (data["type"] ?: "").uppercase()
        val isBookingAlert = rawType == "NEW_BOOKING" ||
                rawType == "BOOKING_RECEIVED" ||
                rawType == "NEW_BROADCAST_JOB" ||
                rawType == "BOOKING_REBROADCASTING" ||
                data["isBookingAlert"] == "true" ||
                data["callType"] == "INCOMING_BOOKING_CALL"

        if (isBookingAlert) {
            handleIncomingBookingCall(remoteMessage)
        } else {
            handleGenericNotification(remoteMessage)
        }
    }

    private fun handleIncomingBookingCall(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data
        val bookingId = data["bookingId"] ?: ""
        val title = data["title"] ?: remoteMessage.notification?.title ?: "New Booking Received! ⚡"
        val body = data["body"] ?: remoteMessage.notification?.body ?: "You have received a new booking. Tap to view and accept."

        // 1. Ensure high-importance notification channel with alert.mp3 ringtone exists
        NotificationChannelManager.createBookingNotificationChannel(this)

        // 2. Wake up device screen if sleeping
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
            val wakeLock = powerManager?.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                "a2z:incoming_booking_alert"
            )
            wakeLock?.acquire(15000L) // 15 seconds wake lock
        } catch (e: Exception) {
            Log.w(TAG, "WakeLock acquire warning: ${e.message}")
        }

        // 3. Resolve launch intent to open app directly on booking screen
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("incoming_booking", bookingId)
            putExtra("bookingId", bookingId)
            putExtra("type", "NEW_BOOKING")
            data = Uri.parse("a2zservice://booking/$bookingId")
        }

        val notificationId = if (bookingId.isNotEmpty()) (bookingId.hashCode() and 0x7FFFFFFF) else 9901

        val openPendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        // 4. Intent to dismiss and silence continuous ringing when user rejects/dismisses
        val dismissIntent = Intent(this, DismissReceiver::class.java).apply {
            putExtra("notification_id", notificationId)
            putExtra("bookingId", bookingId)
        }
        val dismissPendingIntent = PendingIntent.getBroadcast(
            this,
            notificationId + 1000,
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val soundUri = Uri.parse("android.resource://$packageName/raw/alert")

        val iconRes = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_dialog_alert

        // 5. Build Call-style notification
        val builder = NotificationCompat.Builder(this, NotificationChannelManager.CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(true) // Keeps notification persistent while ringing
            .setSound(soundUri)
            .setVibrate(longArrayOf(0, 800, 400, 800, 400, 800, 400, 1200))
            .setContentIntent(openPendingIntent)
            .setFullScreenIntent(openPendingIntent, true) // Incoming call heads-up banner
            .addAction(android.R.drawable.ic_menu_send, "⚡ View & Accept", openPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissPendingIntent)

        val notification = builder.build()

        // 6. CRUCIAL: FLAG_INSISTENT makes Android loop the audio file continuously
        // like a real incoming telephone call until the user acts upon it.
        notification.flags = notification.flags or Notification.FLAG_INSISTENT

        try {
            val notificationManager = NotificationManagerCompat.from(this)
            notificationManager.notify(notificationId, notification)
            Log.d(TAG, "Dispatched continuous ringing booking alert notification id=$notificationId")
        } catch (e: SecurityException) {
            Log.e(TAG, "Notification permission missing (POST_NOTIFICATIONS): ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Error posting notification: ${e.message}")
        }
    }

    private fun handleGenericNotification(remoteMessage: RemoteMessage) {
        val title = remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: "A2Z Service Hub"
        val body = remoteMessage.notification?.body ?: remoteMessage.data["body"] ?: "You have a new update."

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val iconRes = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info

        val notification = NotificationCompat.Builder(this, "high_importance_channel")
            .setSmallIcon(iconRes)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(this).notify(System.currentTimeMillis().toInt(), notification)
        } catch (e: Exception) {
            Log.w(TAG, "Error posting generic notification: ${e.message}")
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM Token generated: $token")
        // Token will be synced by the app on next launch or broadcast
    }

    companion object {
        private const val TAG = "A2ZFirebaseMsg"
    }
}
