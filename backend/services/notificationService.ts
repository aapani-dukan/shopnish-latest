import { Expo } from 'expo-server-sdk';

let expo = new Expo();

export const sendNotification = async (
  targetToken: string, 
  title: string, 
  body: string, 
  data: any = {},
  appType: 'seller' | 'delivery' = 'seller' // 👈 Default hum 'seller' rakh rahe hain
) => {
  if (!Expo.isExpoPushToken(targetToken)) {
    console.error(`❌ [Notification] Invalid Token: ${targetToken}`);
    return;
  }

  // 👇 App ke hisab se sahi channel ID select hogi (Dono v10 hain)
  const channelId = appType === 'delivery' ? 'delivery_siren_v10' : 'orders_siren_v10';
  const soundName = 'siren'; // Dono apps ke 'raw' folder mein 'siren.mp3' hona chahiye

  // Message Object (FCM V1 compliant format)
  let messages: any[] = [{
      to: targetToken,
      title: title,        
      body: body,          
      data: data,
      priority: 'high',    
      badge: 1,
      
      // ✅ ROOT PAR DYNAMIC CHANNEL ID: Expo server isko read karega
      channelId: channelId, 
      
      // ✅ ROOT PAR SOUND: Bina extension (.mp3) ke rahega
      sound: soundName, 

      // 🚨 ANDROID SPECIFIC CRITICAL SETTINGS 🚨
      android: {
        channelId: channelId, // 👈 Mobile app ke channel se match karega
        priority: 'max',               
        vibrate: [0, 250, 250, 250],   
      },
  }];

  try {
    let chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
    console.log(`🔔 [Notification] Siren signal sent successfully for ${appType} app!`);
  } catch (error) {
    console.error(`❌ [Notification] Error sending message to ${appType}:`, error);
  }
};