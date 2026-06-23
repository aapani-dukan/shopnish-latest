// Yeh logic decide karega ki kaunsa URL use karna hai
const isTesting = window.location.hostname.includes("testing");

export const API_BASE_URL = isTesting 
  ? "https://api.shopnish.com/api-testing" // Testing ke liye Nginx proxy
  : "https://api.shopnish.com";           // Production ke liye

export const SOCKET_URL = isTesting 
  ? "https://api.shopnish.com/api-testing" 
  : "https://api.shopnish.com";