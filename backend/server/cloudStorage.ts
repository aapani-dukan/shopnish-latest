// backend/server/cloudStorage.ts

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
// path और fs/promises की अब यहाँ सीधे आवश्यकता नहीं है, लेकिन इसे रखा गया है
import path from 'path';
// import fs from 'fs/promises'; // अगर आप disk storage का उपयोग नहीं कर रहे हैं तो इसकी आवश्यकता नहीं है
import { Readable } from 'stream'; // Buffer को स्ट्रीम में बदलने के लिए

// Firebase Admin SDK को इनिशियलाइज़ करें (यह केवल एक बार होना चाहिए)
// हम यहां पर्यावरण चर का उपयोग करने के लिए कॉन्फ़िगर करेंगे
if (!getApps().length) { // यह सुनिश्चित करता है कि ऐप केवल एक बार इनिशियलाइज़ हो
  try {
    const firebaseConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // \n को सही से हैंडल करें
    };

    // पर्यावरण चर की जांच करें
    if (!firebaseConfig.projectId || !firebaseConfig.clientEmail || !firebaseConfig.privateKey) {
      console.error("❌ Firebase Admin SDK: Missing required environment variables for credentials.");
      // यदि क्रेडेंशियल अनुपलब्ध हैं, तो हमें एक त्रुटि फेंकनी होगी या ऐप को बंद करना होगा
      // ताकि यह अनइनिशियलाइज़्ड SDK के साथ काम करने की कोशिश न करे।
      throw new Error("Firebase Admin SDK credentials are not fully provided in environment variables.");
    }

    initializeApp({
      credential: cert(firebaseConfig),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET, // सुनिश्चित करें कि यह आपके .env में सेट है
    });
    console.log("✅ Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.error("❌ Failed to initialize Firebase Admin SDK:", error);
    // इनिशियलाइज़ेशन फेल होने पर एप्लिकेशन को रोकें, क्योंकि स्टोरेज काम नहीं करेगा
    process.exit(1);
  }
}

// Firebase Admin SDK से स्टोरेज बकेट प्राप्त करें
// यह Google Cloud Storage की `Bucket` क्लास का एक इंस्टेंस लौटाता है
const bucket = getStorage().bucket();

/**
 * एक इमेज बफर को क्लाउड स्टोरेज पर अपलोड करता है।
 *
 * @param buffer अपलोड की जाने वाली इमेज का बफर।
 * @param destinationPath क्लाउड स्टोरेज में फ़ाइल का गंतव्य पथ (उदाहरण: 'categories/sellerId/image.jpg')।
 * @param contentType इमेज का MIME प्रकार (उदाहरण: 'image/jpeg')।
 * @returns अपलोड की गई इमेज का सार्वजनिक URL।
 */
export const uploadImage = async (buffer: Buffer, destinationPath: string, contentType: string): Promise<string> => {
  if (!bucket) {
    throw new Error("Firebase Storage bucket is not initialized.");
  }

  const fileUpload = bucket.file(destinationPath);

  const blobStream = fileUpload.createWriteStream({
    metadata: {
      contentType: contentType,
    },
    resumable: false, // छोटे फ़ाइलों के लिए resumble को false करना बेहतर हो सकता है
  });

  return new Promise((resolve, reject) => {
    blobStream.on('error', (error) => {
      console.error('❌ Error uploading file to Firebase Storage:', error);
      reject(new Error("Failed to upload image to cloud storage."));
    });

    blobStream.on('finish', async () => {
      try {
        // फ़ाइल को सार्वजनिक रूप से पठनीय बनाएं
        await fileUpload.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`;
        resolve(publicUrl);
      } catch (makePublicError) {
        console.error('❌ Error making file public or getting URL:', makePublicError);
        reject(new Error("Failed to get public URL for uploaded image."));
      }
    });

    // Multer से मिले buffer को स्ट्रीम में एंड करें
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null); // स्ट्रीम को समाप्त करें
    bufferStream.pipe(blobStream);
  });
};

/**
 * क्लाउड स्टोरेज से एक फ़ाइल हटाता है।
 *
 * @param destinationPath क्लाउड स्टोरेज में फ़ाइल का पूरा पथ (जैसे 'categories/sellerId/image.jpg')।
 * @returns Promise<void>
 */
export const deleteImage = async (destinationPath: string): Promise<void> => {
  if (!bucket) {
    throw new Error("Firebase Storage bucket is not initialized.");
  }

  try {
    const file = bucket.file(destinationPath);
    await file.delete();
    console.log(`✅ File ${destinationPath} deleted from Firebase Storage.`);
  } catch (error: any) {
    // यदि फ़ाइल मौजूद नहीं है (HTTP 404), तो त्रुटि को चुपचाप हैंडल करें
    if (error.code === 404) {
      console.warn(`⚠️ [deleteImage] File not found in Firebase Storage: ${destinationPath}. Skipping deletion.`);
    } else {
      console.error(`❌ Error deleting file ${destinationPath} from Firebase Storage:`, error);
      throw new Error(`Failed to delete image from cloud storage: ${error.message}`);
    }
  }
};
