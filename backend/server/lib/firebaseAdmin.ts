import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

console.log("--- Firebase ENV VARs Check ---");
console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID);
console.log("FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL);
console.log("FIREBASE_PRIVATE_KEY present:", !!process.env.FIREBASE_PRIVATE_KEY);
if (process.env.FIREBASE_PRIVATE_KEY) {
    console.log("FIREBASE_PRIVATE_KEY length:", process.env.FIREBASE_PRIVATE_KEY.length);
    console.log("FIREBASE_PRIVATE_KEY start:", process.env.FIREBASE_PRIVATE_KEY.substring(0, 30));
    console.log("FIREBASE_PRIVATE_KEY end:", process.env.FIREBASE_PRIVATE_KEY.substring(process.env.FIREBASE_PRIVATE_KEY.length - 30));
}
console.log("-------------------------------");

const firebaseApps = getApps();
let app;
if (!firebaseApps.length) {
  // ✅ यहां अतिरिक्त लॉग्स जोड़ें
  console.log("Initializing Firebase Admin SDK...");
  console.log("Project ID being used:", process.env.FIREBASE_PROJECT_ID);
  console.log("Client Email being used:", process.env.FIREBASE_CLIENT_EMAIL);

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error("❌ ERROR: Missing Firebase environment variables.");
    process.exit(1);
  }

  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: privateKey,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

  app = initializeApp({
    credential: cert(serviceAccount as any),
    storageBucket: `${serviceAccount.projectId}.appspot.com`,
  });
  console.log('✅ Firebase Admin SDK initialized successfully.');
} else {
  app = firebaseApps[0];
  console.log('✅ Firebase Admin SDK already initialized.');
}

export const authAdmin = getAuth(app);
export const storageAdmin = getStorage(app);
