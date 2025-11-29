import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";

export async function uploadProductImage(file) {
  const fileName = `${Date.now()}.jpg`;
  const storageRef = ref(storage, `products/${fileName}`);

  // Upload
  await uploadBytes(storageRef, file);

  // Correct Download URL
  const downloadURL = await getDownloadURL(storageRef);

  return downloadURL;   // यही Database में save करो
}
