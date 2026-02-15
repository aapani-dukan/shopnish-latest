import { Expo, ExpoPushMessage } from 'expo-server-sdk';

let expo = new Expo();

export const sendNotification = async (
  targetToken: string, 
  title: string, 
  body: string, 
  data: any = {}
) => {
  // 1. Check karein ki token sahi hai ya nahi
  if (!Expo.isExpoPushToken(targetToken)) {
    console.error(`❌ [Notification] Invalid Token: ${targetToken}`);
    return;
  }

  // 2. Message Object (Yahan 'as const' lagana zaroori hai)
  let messages: ExpoPushMessage[] = [{
    to: targetToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
    priority: 'high', // 🔥 Ise humne 'high' rakha hai
    channelId: 'default',
  }];

  try {
    let chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
    console.log("🔔 [Notification] Tring Tring! Message sent successfully.");
  } catch (error) {
    console.error("❌ [Notification] Error sending message:", error);
  }
};