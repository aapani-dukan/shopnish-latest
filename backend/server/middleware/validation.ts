// server/middleware/validation.ts

import { Request, Response, NextFunction } from 'express';
import { validationResult, checkSchema, Schema } from 'express-validator';

/**
 * मिडलवेयर जो दिए गए स्कीमा के आधार पर रिक्वेस्ट डेटा को वैलिडेट करता है।
 * वैलिडेशन नियमों को परिभाषित करने के लिए express-validator का उपयोग करता है।
 *
 * रूट में उपयोग का उदाहरण:
 * router.post(
 * '/users',
 * validateRequest(userCreationSchema),
 * userController.createUser
 * );
 */
export const validateRequest = (schema: Schema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // स्कीमा में परिभाषित वैलिडेशन चेक को अप्लाई करें
    // Promise.all का उपयोग करें ताकि सभी वैलिडेशन चेक समानांतर में चल सकें
    await Promise.all(
      Object.values(schema).map((validationChain) =>
        validationChain.run(req)
      )
    );

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };
};

// --- उदाहरण स्कीमा (तुम इन्हें विशिष्ट रूट्स के लिए परिभाषित करोगे) ---

// उदाहरण: नया उपयोगकर्ता बनाने के लिए स्कीमा
// ध्यान दें: इस स्कीमा को तुम अपनी आवश्यकतानुसार अपडेट कर सकते हो।
export const createUserSchema: Schema = {
  email: {
    isEmail: {
      errorMessage: 'Invalid email address',
    },
    normalizeEmail: true,
  },
  password: {
    isLength: {
      options: { min: 6 },
      errorMessage: 'Password must be at least 6 characters long',
    },
  },
  role: {
    // यहाँ userRoleEnum से मान्य भूमिकाएं होनी चाहिए
    isIn: {
      options: [['CUSTOMER', 'SELLER', 'ADMIN', 'DELIVERY_BOY']], // userRoleEnum.enumValues का उपयोग करें
      errorMessage: 'Invalid user role',
    },
  },
  // अन्य फ़ील्ड्स जैसे नाम, फ़ोन, आदि
};

// उदाहरण: प्लेटफ़ॉर्म सेटिंग्स को अपडेट करने के लिए स्कीमा
export const updatePlatformSettingsSchema: Schema = {
  defaultDeliveryRadiusKm: {
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Delivery radius must be a non-negative number.',
    },
    toFloat: true,
  },
  baseDeliveryCharge: {
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Base delivery charge must be a non-negative number.',
    },
    toFloat: true,
  },
  chargePerKm: {
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Charge per km must be a non-negative number.',
    },
    toFloat: true,
  },
  freeDeliveryMinOrderValue: {
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Free delivery minimum order value must be a non-negative number.',
    },
    toFloat: true,
  },
};

// उदाहरण: विक्रेता सेटिंग्स को अपडेट करने के लिए स्कीमा
export const updateVendorSettingsSchema: Schema = {
  deliveryRadiusKm: {
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Delivery radius must be a non-negative number.',
    },
    toFloat: true,
  },
  deliveryPincodes: {
    optional: true,
    isArray: {
      errorMessage: 'Delivery pincodes must be an array of strings.',
    },
    // कस्टम सैनिटाइज़र यह सुनिश्चित करने के लिए कि पिनकोड स्ट्रिंग हैं
    customSanitizer: {
      options: (value) => {
        if (!Array.isArray(value)) return value;
        return value.map((p: any) => String(p).trim());
      },
    },
  },
  baseDeliveryCharge: {
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Base delivery charge must be a non-negative number.',
    },
    toFloat: true,
  },
  chargePerKm: {
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Charge per km must be a non-negative number.',
    },
    toFloat: true,
  },
};

// उदाहरण: उत्पाद सेटिंग्स को अपडेट करने के लिए स्कीमा
export const updateProductSettingsSchema: Schema = {
  deliveryPincodes: {
    optional: true,
    isArray: {
      errorMessage: 'Delivery pincodes must be an array of strings.',
    },
    customSanitizer: {
      options: (value) => {
        if (!Array.isArray(value)) return value;
        return value.map((p: any) => String(p).trim());
      },
    },
  },
};
