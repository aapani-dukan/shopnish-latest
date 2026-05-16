import { Expo } from 'expo-server-sdk';

let expo = new Expo();
export const sendNotification = async (
  targetToken: string, 
  title: string, 
  body: string, 
  data: any = {}
) => {
  if (!Expo.isExpoPushToken(targetToken)) {
    console.error(`❌ [Notification] Invalid Token: ${targetToken}`);
    return;
  }

  // 2. Message Object (Killed state ki bimari ka 100% ilaaj)
  let messages: any[] = [{
      to: targetToken,
      title: title,        // 👈 Root title zaroori hai
      body: body,          // 👈 Root body zaroori hai
      data: data,
      priority: 'high',    // 👈 Expo server ko bolta hai turant bhejo
      sound: 'default',    // 👈 iOS/Expo ki compatibility ke liye
      badge: 1,

      // 🚨 ANDROID SYSTEM KO FORCE KARNE KE LIYE SAHI FORMAT 🚨
      android: {
        channelId: 'orders_siren_v10', // Mobile app wale ID se bilkul same
        priority: 'max',               // 'high' se bhi upar 'max' taaki OS block na kare
        sound: 'siren.mp3',             // System ko pata chale konsi file bajani hai
        vibrate: [0, 250, 250, 250],   // Vibration notification ko alert mein badalta hai
      },
  }];

  try {
    let chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
    console.log("🔔 [Notification] Siren signal sent to Expo!");
  } catch (error) {
    console.error("❌ [Notification] Error sending message:", error);
  }
};