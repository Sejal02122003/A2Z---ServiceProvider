package com.a2z.serviceprovider;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

public class NotificationChannelManager {
    public static final String CHANNEL_ID = "new_booking_alerts_v2";
    public static final String CHANNEL_NAME = "Incoming Booking Calls & Siren";
    public static final String CHANNEL_DESC = "Continuous siren and ringtone alert for newly received booking requests.";

    /**
     * Initializes the high-importance notification channel with custom alert.mp3 sound
     * configured as an INCOMING RINGTONE.
     */
    public static void createBookingNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
            if (notificationManager == null) return;

            // 1. Delete previous channel ID (if any) so Android purges stale default sound settings
            try {
                notificationManager.deleteNotificationChannel("new_booking_alerts");
            } catch (Exception ignored) {}

            // 2. Resolve custom alert sound bundled in res/raw/alert.mp3
            Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/raw/alert");

            // 3. Configure audio attributes as USAGE_NOTIFICATION_RINGTONE
            // Routes audio via phone's ringer stream instead of media stream,
            // ensuring it rings out loud even if media volume is muted.
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build();

            // 4. Build Channel with IMPORTANCE_HIGH (pops up on screen + plays sound)
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(CHANNEL_DESC);
            channel.enableLights(true);
            channel.setLightColor(0xFF015F6C);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 800, 400, 800, 400, 800, 400, 1200});
            channel.setSound(soundUri, audioAttributes);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                channel.setAllowBubbles(true);
            }

            notificationManager.createNotificationChannel(channel);
        }
    }
}
