// client/src/lib/api.ts
import axios from "axios";
import { auth } from "./firebase";

const api = axios.create({
  baseURL: "https://shopnish-00ug.onrender.com", // ✅ live backend URL
  withCredentials: true,
});

api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken(true);
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
