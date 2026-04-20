import axios from "axios";
import { auth } from "./firebase";

const api = axios.create({
  // 🔴 बदलाव यहाँ: सीधे Render URL का उपयोग करने के बजाय
    //    baseURL को खाली छोड़ें या '/' पर सेट करें ताकि यह Vercel प्रॉक्सी का उपयोग करे।
      baseURL: "", 
        // हमने vercel.json में नियम सेट किया है: /api/(.*) -> https://api.shopnish.com/api/$1

          withCredentials: true,
          });

          api.interceptors.request.use(
            async (config) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log("📤 [API.ts] Sending request:", config.url, "with Auth:", config.headers.Authorization);
        } else {
          console.warn("⚠️ [API.ts] No token found for user");
        }
      } catch (err) {
        console.error("❌ [API.ts] Failed to get Firebase token:", err);
      }
    } else {
      console.warn("⚠️ [API.ts] No authenticated user found");
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
