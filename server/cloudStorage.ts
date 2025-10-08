// server/cloudStorage.ts
import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs/promises';

// Google Cloud Storage को Firebase Admin SDK से कॉन्फ़िगर करें
const storage = new Storage({
  projectId: process.env.FIREBASE_PROJECT_ID,
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

const bucket = storage.bucket("aapani-dukan"); // ✅ यहाँ अपने बकेट का नाम डालें

export const uploadImage = async (filePath: string, originalname: string): Promise<string> => {
  const destination = `uploads/${Date.now()}_${path.basename(originalname)}`;

  try {
    const [file] = await bucket.upload(filePath, {
      destination,
      metadata: {
        contentType: 'image/jpeg' // ✅ अपनी इमेज के कंटेंट टाइप को सेट करें
      }
    });

    // फ़ाइल को पब्लिक करें और URL प्राप्त करें
    
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    
    // लोकल फ़ाइल को हटा दें
    await fs.unlink(filePath);
    
    return publicUrl;
  } catch (error) {
    console.error("❌ Error uploading file to GCS:", error);
    throw new Error("Failed to upload image to cloud storage.");
  }
};
