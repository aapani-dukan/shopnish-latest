 // client/src/utils/uploadImage.ts

// ⭐ 'uploadBytes' के बजाय 'uploadBytesResumable' आयात करें
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";

export async function uploadProductImage(file: File): Promise<string> { // ⭐ 'file' के लिए टाइप जोड़ें
  if (!file) {
    throw new Error("कोई फ़ाइल प्रदान नहीं की गई।");
  }
  if (file.size === 0) {
    throw new Error("चुनी गई फ़ाइल खाली है (0 बाइट्स)। कृपया एक वैध इमेज चुनें।");
  }

  const fileName = `${Date.now()}_${file.name}`; // ⭐ मूल फ़ाइल नाम जोड़ना बेहतर है
  const storageRef = ref(storage, `products/${fileName}`);

  console.log("🛠️ Starting Firebase upload for:", file.name, "Size:", file.size);

  // ⭐ 'uploadBytes' के बजाय 'uploadBytesResumable' का उपयोग करें
  // और इसे एक Promisified तरीके से हैंडल करें
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log(`🛠️ Upload Progress: ${Math.round(progress)}%`);
        // आप यहाँ प्रोग्रेस को UI में अपडेट करने के लिए एक कॉलबैक भी भेज सकते हैं
      },
      (error) => {
        console.error('❌ Firebase upload error:', error);
        reject(error);
      },
      async () => {
        // अपलोड पूरा होने पर डाउनलोड URL प्राप्त करें
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        console.log('✅ Firebase upload successful. Download URL:', downloadURL);
        resolve(downloadURL);
      }
    );
  });
}
