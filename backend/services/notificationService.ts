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

  // Message Object (FCM V1 compliant format)
  let messages: any[] = [{
      to: targetToken,
      title: title,        
      body: body,          
      data: data,
      priority: 'high',    
      badge: 1,
      
      // ✅ ROOT PAR CHANNEL ID: Expo server direct ise read karta hai Android ke liye
      channelId: 'orders_siren_v10', 
      
      // ✅ ROOT PAR SOUND: iOS aur custom channels dono ke liye behtareen kaam karta hai
      sound: 'siren', // 👈 .mp3 hata diya hai, sirf 'siren' rahega

      // 🚨 ANDROID SPECIFIC CRITICAL SETTINGS 🚨
      android: {
        channelId: 'orders_siren_v10', // 👈 Pukka karne ke liye yahan bhi rakha hai
        priority: 'max',               
        vibrate: [0, 250, 250, 250],   
        // Note: FCM V1 ke liye sound hamesha bina extension ke resource name hota hai
      },
  }];

  try {
    let chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
    console.log("🔔 [Notification] Siren signal sent to Expo successfully!");
  } catch (error) {
    console.error("❌ [Notification] Error sending message:", error);
  }
};