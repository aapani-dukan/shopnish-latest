// server/cloudStorage.ts

import { Storage } from '@google-cloud/storage'; // 'storage' से 'Storage' को इंपोर्ट करें
import path from 'path';
import fs from 'fs/promises';

// google cloud storage को firebase admin sdk से कॉन्फ़िगर करें
const gcsStorage = new Storage({ // वेरिएबल का नाम `storage` से `gcsStorage` में बदला गया ताकि क्लास `Storage` के साथ टकराव न हो
  projectId: process.env.FIREBASE_PROJECT_ID, // env वेरिएबल के नाम को ठीक करें
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL, // env वेरिएबल के नाम को ठीक करें
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // env वेरिएबल के नाम को ठीक करें
  },
});

const bucket = gcsStorage.bucket("aapani-dukan"); // ✅ यहाँ अपने बकेट का नाम डालें

export const uploadImage = async (filePath: string, originalName: string): Promise<string> => { // फंक्शन का नाम और पैरामीटर के नाम camelCase में
  const destination = `uploads/${Date.now()}_${path.basename(originalName)}`; // `Date.now()` और `path.basename` का सही उपयोग

  try {
    const [file] = await bucket.upload(filePath, {
      destination,
      metadata: {
        contentType: 'image/jpeg' // ✅ अपनी इमेज के कंटेंट टाइप को सेट करें (camelCase)
      },
      public: true, // फाइल को पब्लिक एक्सेसिबल बनाएं
    });

    // फ़ाइल को पब्लिक करें और URL प्राप्त करें
    // getPublicUrl मेथड का उपयोग करें जो Google Cloud Storage SDK में है
    const publicUrl = file.publicUrl(); // यह Google Cloud Storage SDK से आता है

    // लोकल फ़ाइल को हटा दें
    await fs.unlink(filePath);

    return publicUrl;
  } catch (error) {
    console.error("❌ Error uploading file to GCS:", error);
    throw new Error("Failed to upload image to cloud storage.");
  }
};

/**
 * क्लाउड स्टोरेज से एक फ़ाइल हटाता है।
 * @param fileUrl फाइल का पूरा URL (जो `uploadImage` द्वारा लौटाया गया था)
 */
export const deleteImage = async (fileUrl: string): Promise<void> => {
  try {
    // URL से फ़ाइल नाम निकालें
    const urlParts = fileUrl.split('/');
    const fileName = urlParts.slice(4).join('/'); // `https://storage.googleapis.com/{bucket_name}/` के बाद का हिस्सा

    if (!fileName) {
      console.warn(`⚠️ [deleteImage] Invalid file URL provided: ${fileUrl}. Cannot extract file name.`);
      return; // या त्रुटि फेंकें
    }

    const file = bucket.file(fileName);
    await file.delete();
    console.log(`✅ File ${fileName} deleted from GCS.`);
  } catch (error: any) {
    // यदि फ़ाइल मौजूद नहीं है, तो त्रुटि को चुपचाप हैंडल करें
    if (error.code === 404) {
      console.warn(`⚠️ [deleteImage] File not found in GCS: ${fileUrl}. Skipping deletion.`);
    } else {
      console.error(`❌ Error deleting file ${fileUrl} from GCS:`, error);
      throw new Error(`Failed to delete image from cloud storage: ${error.message}`);
    }
  }
};
