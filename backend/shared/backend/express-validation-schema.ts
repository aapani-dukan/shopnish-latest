 //backend/src/shared/backend/express-validation-schemas.ts

import { Schema } from 'express-validator';

export const updateDeliveryAreaExpressSchema: Schema = {
  // areaName के लिए वैलिडेशन नियम
  areaName: {
    optional: { options: { nullable: true } }, // Drizzle में nullable, express-validator में optional
    isString: { errorMessage: 'Area name must be a string' },
    trim: true,
    isLength: {
      options: { min: 1 },
      errorMessage: 'Area name cannot be empty',
    },
  },
  // pincode के लिए वैलिडेशन नियम
  pincode: {
    optional: { options: { nullable: true } },
    isString: { errorMessage: 'Pincode must be a string' },
    matches: {
      options: /^\d{6}$/,
      errorMessage: 'Pincode must be 6 digits',
    },
  },
  // city के लिए वैलिडेशन नियम
  city: {
    optional: { options: { nullable: true } },
    isString: { errorMessage: 'City must be a string' },
    trim: true,
  },
  // deliveryCharge के लिए वैलिडेशन नियम (Drizzle में decimal ($type<number>) है, इसलिए isFloat)
  deliveryCharge: {
    optional: { options: { nullable: true } },
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Delivery charge must be a non-negative number.',
    },
    toFloat: true, // स्ट्रिंग को फ्लोट में बदलें
  },
  // freeDeliveryAbove के लिए वैलिडेशन नियम
  freeDeliveryAbove: {
    optional: { options: { nullable: true } },
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Free delivery above value must be a non-negative number.',
    },
    toFloat: true,
  },
  // isActive के लिए वैलिडेशन नियम
  isActive: {
    optional: { options: { nullable: true } },
    isBoolean: { errorMessage: 'isActive must be a boolean value' },
    toBoolean: true, // स्ट्रिंग को बूलियन में बदलें
  },
  // 'id', 'createdAt', 'updatedAt' जैसे फ़ील्ड्स को यहाँ शामिल न करें
  // क्योंकि वे बॉडी का हिस्सा नहीं होंगे या स्वचालित रूप से जेनरेट होंगे।
};
//deleteDeliveryAreaExpressSchema
export const deleteDeliveryAreaExpressSchema: Schema = {
  id: {
    in: ['params'], // यह बताता है कि 'id' req.params से आ रहा है
    isInt: { errorMessage: 'ID must be an integer' },
    toInt: true, // स्ट्रिंग को पूर्णांक में बदलें
  },
};