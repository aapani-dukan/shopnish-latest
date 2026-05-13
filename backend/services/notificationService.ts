import { Expo, ExpoPushMessage } from 'expo-server-sdk';

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

  // 2. Message Object (Ab ye perfect hai background aur killed state ke liye)
let messages: any[] = [{
    to: targetToken,
    title: title,
    body: body,
    data: data,
    priority: 'high', // Root priority
    sound: 'default', // Expo compatibility ke liye
    
    // 🚨 YE BLOCK ADD KARNA SABSE ZAROORI HAI 🚨
    android: {
      channelId: 'orders_siren_v10', // Wahi ID jo mobile app mein hai
      priority: 'high',             // OS ko bolta hai turant jagaao app ko
      sound: 'siren.mp3',           // Background mein isi file ko bajayega
    },

    _displayInForeground: true, 
    badge: 1,
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