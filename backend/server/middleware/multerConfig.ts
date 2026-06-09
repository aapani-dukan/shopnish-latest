import multer from 'multer';
import path from 'path';

// 🎯 कड़क फिक्स 1: 'diskStorage' हटाकर शुद्ध 'memoryStorage' लॉक कर दिया भाई साहब!
// इससे फ़ाइल सर्वर की हार्डडिस्क पर कचरा जमा नहीं करेगी, सीधे रैम (file.buffer) में कड़क लाइव मिलेगी।
const storage = multer.memoryStorage();

export const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // लिमिट बढ़ाकर 10MB कर दी ताकि भारी AI इमेज भी न अटके भाई
  
  // 🎯 कड़क फिक्स 2: कड़ा फ़ाइल फ़िल्टर जो .heic और अनजान एंड्रॉइड बाइनरी स्ट्रीम को रास्ता देगा!
  fileFilter: (req: any, file: any, cb: any) => {
    // अलाउड एक्सटेंशन्स की सूची भाई साहब
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.heic'];
    
    // अलाउड माइम-टाइप्स की सूची भाई
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
      'image/webp', 'image/svg+xml', 'image/heic', 
      'application/octet-stream' // 👈 एंड्रॉइड की रॉ बाइनरी स्ट्रीम को बायपास करने का जादुई नुस्खा भाई!
    ];

    const fileExt = path.extname(file.originalname).toLowerCase();
    const isExtensionAllowed = allowedExtensions.includes(fileExt) || file.originalname.toLowerCase().endsWith('.heic');
    const isMimeAllowed = allowedMimeTypes.includes(file.mimetype);

    // अगर फ़ाइल का नाम .heic पर खत्म हो रहा है या माइम-टाइप लिस्ट में है, तो चुपचाप आगे जाने दो भाई!
    if (isMimeAllowed || isExtensionAllowed) {
      return cb(null, true); // रास्ता साफ़ है, आगे 'sharp' इंजन इसका बैकग्राउंड साफ़ कर देगा!
    }
    
    cb(new Error("Error: Only images (jpeg, jpg, png, gif, webp, svg, heic) are allowed भाई साहब!"));
  }
});