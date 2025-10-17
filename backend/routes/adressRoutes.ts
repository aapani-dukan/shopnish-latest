// backend/routes/addressRoutes.ts
import express from 'express';
// अपने addressController से आवश्यक फ़ंक्शंस को इम्पोर्ट करें
import { 
    processCurrentLocation, 
    addNewAddress, 
    getSavedAddresses, 
    setDefaultAddress,
    
} from '../server/controllers/addressController'; 

// isAuthenticated मिडिलवेयर को इम्पोर्ट करें (यदि यह तुम्हारी auth.ts फ़ाइल में है)
import { isAuthenticated } from '../server/middleware/authMiddleware'; // मान लें यह तुम्हारी auth.ts फ़ाइल का पथ है

const router = express.Router();

// पब्लिक रूट: ग्राहक के वर्तमान स्थान को Geocode और प्रोसेस करने के लिए
router.post('/process-current-location', processCurrentLocation);

// प्रोटेक्टेड रूट्स: इनके लिए उपयोगकर्ता को लॉग इन होना चाहिए
router.get('/user', isAuthenticated, getSavedAddresses); // ग्राहक के सभी सहेजे गए पते प्राप्त करें
router.post('/', isAuthenticated, addNewAddress);        // एक नया पता जोड़ें
router.put('/:addressId/set-default', isAuthenticated, setDefaultAddress); // किसी पते को डिफ़ॉल्ट सेट करें

// यदि तुम भविष्य में जोड़ना चाहते हो:
// router.delete('/:addressId', isAuthenticated, deleteAddress); // एक पता हटाएँ
// router.put('/:addressId', isAuthenticated, updateAddress);    // एक पता अपडेट करें


export default router;
