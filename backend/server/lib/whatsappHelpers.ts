import axios from "axios";

// ✅ यहां अपने MSG91 WhatsApp API Key डालें
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_BASE_URL = "https://api.msg91.com/api/v5/whatsapp";

// 🔹 OTP Generator
export function generateOTP(length: number = 6): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

// 🔹 WhatsApp message sender (generic)
export async function sendWhatsAppMessage(phone: string, message: string) {
  try {
    if (!MSG91_AUTH_KEY) {
      console.error("❌ MSG91_AUTH_KEY not set in environment variables.");
      return false;
    }

    const payload = {
      recipient_whatsapp: `91${phone}`, // भारत के लिए prefix 91
      type: "text",
      text: { body: message },
    };

    const headers = {
      authkey: MSG91_AUTH_KEY,
      "Content-Type": "application/json",
    };

    const response = await axios.post(`${MSG91_BASE_URL}/send`, payload, { headers });

    console.log("✅ WhatsApp message sent:", response.data);
    return true;
  } catch (error: any) {
    console.error("❌ WhatsApp message failed:", error.message);
    return false;
  }
}

// 🔹 Specialized message: OTP भेजना
export async function sendWhatsAppOTP(phone: string, otp: string, orderId: number, customerName: string) {
  const message = `नमस्ते ${customerName} 👋  
आपका Shopnish ऑर्डर (ID: ${orderId}) डिलीवरी के लिए तैयार है।  
कृपया यह OTP साझा करें: *${otp}*  
धन्यवाद 🛍️ Shopnish का उपयोग करने के लिए।`;

  return sendWhatsAppMessage(phone, message);
}

// 🔹 Specialized message: Order Delivered
export async function sendOrderDeliveredMessage(phone: string, customerName: string, orderId: number) {
  const message = `🎉 नमस्ते ${customerName},  
आपका ऑर्डर (ID: ${orderId}) सफलतापूर्वक डिलीवर कर दिया गया है!  
हम आशा करते हैं कि आपको आपका प्रोडक्ट पसंद आया होगा 😊  
Shopnish चुनने के लिए धन्यवाद 💚`;

  return sendWhatsAppMessage(phone, message);
}

// 🔹 Specialized message: Welcome on Login
export async function sendWelcomeMessage(phone: string, customerName: string) {
  const message = `नमस्ते ${customerName} 👋  
Shopnish में आपका स्वागत है! 🎉  
यहां आपको हर ज़रूरत की चीज़ — सबसे बेहतर दाम पर — मिलती है 🛍️  
खरीदारी शुरू करें 👉 shopnish.com`;

  return sendWhatsAppMessage(phone, message);
}

// 🔹 Specialized message: Weekly Offers
export async function sendWeeklyOfferMessage(phone: string, customerName: string) {
  const message = `✨ हे ${customerName}!  
Shopnish पर इस हफ्ते के धमाकेदार ऑफ़र मिस न करें 🛒  
सिर्फ़ आपके लिए — नई डील्स हर 7 दिन में 💥  
अभी देखें 👉 shopnish.com/offers`;

  return sendWhatsAppMessage(phone, message);
}
