import multer from 'multer';
import path from 'path';
import fs from 'fs';

// सुनिश्चित करें कि 'uploads/' डायरेक्टरी मौजूद है।
// यदि यह रेंडर पर डिप्लॉय किया जा रहा है, तो 'uploads' एक अस्थायी डायरेक्टरी होगी जो हर डिप्लॉयमेंट पर साफ हो जाएगी।
// प्रोडक्शन में, आपको S3 जैसे क्लाउड स्टोरेज का उपयोग करना चाहिए।
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true }); // recursive: true सुनिश्चित करता है कि पैरेंट डायरेक्टरी भी बन जाती हैं
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // 'uploads/' डायरेक्टरी में फाइलें स्टोर करें
  },
  filename: function (req, file, cb) {
    // फाइल के नाम को यूनिक और एक्सटेंशन के साथ रखें
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

export const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit (optional)
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp|svg/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Error: Only images (jpeg, jpg, png, gif, webp, svg) are allowed!"));
  }
});
