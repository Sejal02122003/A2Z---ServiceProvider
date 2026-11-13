package com.a2z.serviceprovider;

import android.app.Notification;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "A2ZFirebaseMsg";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "FCM Message received from: " + remoteMessage.getFrom());

        Map<String, String> data = remoteMessage.getData();
        String rawType = data.containsKey("type") ? data.get("type").toUpperCase() : "";
        boolean isBookingAlert = "NEW_BOOKING".equals(rawType) ||
                "BOOKING_RECEIVED".equals(rawType) ||
                "NEW_BROADCAST_JOB".equals(rawType) ||
                "BOOKING_REBROADCASTING".equals(rawType) ||
                "true".equalsIgnoreCase(data.get("isBookingAlert")) ||
                "INCOMING_BOOKING_CALL".equalsIgnoreCase(data.get("callType"));

        if (isBookingAlert) {
            handleIncomingBookingCall(remoteMessage);
        } else {
            handleGenericNotification(remoteMessage);
        }
    }

    private void handleIncomingBookingCall(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String bookingId = data.containsKey("bookingId") ? data.get("bookingId") : "";
        String title = data.containsKey("title") ? data.get("title") :
                (remoteMessage.getNotification() != null && remoteMessage.getNotification().getTitle() != null
                        ? remoteMessage.getNotification().getTitle()
                        : "New Booking Received! ⚡");
        String body = data.containsKey("body") ? data.get("body") :
                (remoteMessage.getNotification() != null && remoteMessage.getNotification().getBody() != null
                        ? remoteMessage.getNotification().getBody()
                        : "You have received a new booking. Tap to view and accept.");

        // 1. Ensure high-importance notification channel with alert.mp3 ringtone exists
        NotificationChannelManager.createBookingNotificationChannel(this);

        // 2. Wake up device screen if sleeping
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                        "a2z:incoming_booking_alert"
                );
                wakeLock.acquire(15000L); // 15 seconds wake lock
            }
        } catch (Exception e) {
            Log.w(TAG, "WakeLock acquire warning: " + e.getMessage());
        }

        // 3. Resolve launch intent to open app directly on booking screen
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent != null) {
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launchIntent.putExtra("incoming_booking", bookingId);
            launchIntent.putExtra("bookingId", bookingId);
            launchIntent.putExtra("type", "NEW_BOOKING");
            launchIntent.setData(Uri.parse("a2zservice://booking/" + bookingId));
        }

        int notificationId = !bookingId.isEmpty() ? (bookingId.hashCode() & 0x7FFFFFFF) : 9901;

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent openPendingIntent = PendingIntent.getActivity(
                this,
                notificationId,
                launchIntent,
                pendingFlags
        );

        // 4. Intent to dismiss and silence continuous ringing when user rejects/dismisses
        Intent dismissIntent = new Intent(this, DismissReceiver.class);
        dismissIntent.putExtra("notification_id", notificationId);
        dismissIntent.putExtra("bookingId", bookingId);
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
                this,
                notificationId + 1000,
                dismissIntent,
                pendingFlags
        );

        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/alert");
        int iconRes = getApplicationInfo().icon != 0 ? getApplicationInfo().icon : android.R.drawable.ic_dialog_alert;

        // 5. Build Call-style notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NotificationChannelManager.CHANNEL_ID)
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setOngoing(true) // Keeps notification persistent while ringing
                .setSound(soundUri)
                .setVibrate(new long[]{0, 800, 400, 800, 400, 800, 400, 1200})
                .setContentIntent(openPendingIntent)
                .setFullScreenIntent(openPendingIntent, true) // Incoming call heads-up banner
                .addAction(android.R.drawable.ic_menu_send, "⚡ View & Accept", openPendingIntent)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissPendingIntent);

        Notification notification = builder.build();

        // 6. CRUCIAL: FLAG_INSISTENT makes Android loop the audio file continuously
        // like a real incoming telephone call until the user acts upon it.
        notification.flags |= Notification.FLAG_INSISTENT;

        try {
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
            notificationManager.notify(notificationId, notification);
            Log.d(TAG, "Dispatched continuous ringing booking alert notification id=" + notificationId);
        } catch (SecurityException e) {
            Log.e(TAG, "Notification permission missing (POST_NOTIFICATIONS): " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Error posting notification: " + e.getMessage());
        }
    }

    private void handleGenericNotification(RemoteMessage remoteMessage) {
        String title = remoteMessage.getNotification() != null && remoteMessage.getNotification().getTitle() != null
                ? remoteMessage.getNotification().getTitle()
                : (remoteMessage.getData().get("title") != null ? remoteMessage.getData().get("title") : "A2Z Service Hub");
        String body = remoteMessage.getNotification() != null && remoteMessage.getNotification().getBody() != null
                ? remoteMessage.getNotification().getBody()
                : (remoteMessage.getData().get("body") != null ? remoteMessage.getData().get("body") : "You have a new update.");

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent != null) {
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        }

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                pendingFlags
        );

        int iconRes = getApplicationInfo().icon != 0 ? getApplicationInfo().icon : android.R.drawable.ic_dialog_info;

        Notification notification = new NotificationCompat.Builder(this, "high_importance_channel")
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build();

        try {
            NotificationManagerCompat.from(this).notify((int) System.currentTimeMillis(), notification);
        } catch (Exception e) {
            Log.w(TAG, "Error posting generic notification: " + e.getMessage());
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM Token generated: " + token);
    }
}
