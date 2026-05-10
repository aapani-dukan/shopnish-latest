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

  // 2. Message Object (Custom Sound ke liye update)
 let messages: any[] = [{
    to: targetToken,
    sound: 'default', // 👈 'default' rakho, channel sound ko handle karega
    title: title,
    body: body,
    data: data,
    priority: 'high',
    channelId: 'orders_siren_v1', // 👈 Naya Unique ID
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