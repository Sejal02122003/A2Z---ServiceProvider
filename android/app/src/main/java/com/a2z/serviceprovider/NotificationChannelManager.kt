package com.a2z.serviceprovider

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build

object NotificationChannelManager {
    const val CHANNEL_ID = "new_booking_alerts_v2"
    const val CHANNEL_NAME = "Incoming Booking Calls & Siren"
    const val CHANNEL_DESC = "Continuous siren and ringtone alert for newly received booking requests."

    /**
     * Initializes the high-importance notification channel with custom alert.mp3 sound
     * configured as an INCOMING RINGTONE.
     */
    fun createBookingNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(NotificationManager::class.java) ?: return

            // 1. Delete previous channel ID (if any) so Android purges stale default sound settings
            try {
                notificationManager.deleteNotificationChannel("new_booking_alerts")
            } catch (_: Exception) {}

            // 2. Resolve custom alert sound bundled in res/raw/alert.mp3
            val soundUri = Uri.parse("android.resource://${context.packageName}/raw/alert")

            // 3. Configure audio attributes as USAGE_NOTIFICATION_RINGTONE
            // This routes the audio via the phone's ringer stream instead of media stream,
            // ensuring it rings out loud even if media volume is muted.
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build()

            // 4. Build Channel with IMPORTANCE_HIGH (pops up on screen + plays sound)
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESC
                enableLights(true)
                lightColor = 0xFF015F6C.toInt()
                enableVibration(true)
                // Distinctive siren pulse vibration pattern: [delay, vibrate, pause, vibrate...]
                vibrationPattern = longArrayOf(0, 800, 400, 800, 400, 800, 400, 1200)
                setSound(soundUri, audioAttributes)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    setAllowBubbles(true)
                }
            }

            notificationManager.createNotificationChannel(channel)
        }
    }
}
