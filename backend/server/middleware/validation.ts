// backend/server/middleware/validation.ts

import { Request, Response, NextFunction } from 'express';
import { validationResult, checkSchema, Schema } from 'express-validator';
import { z, ZodError, ZodType } from 'zod'; // ZodType का उपयोग करें

// ✅ 'ZodSchema' की जगह 'ZodType' टाइप का इस्तेमाल करें
export const validateRequest = (schema: Schema | ZodType<any>) => {
  
  // चेक करें कि क्या यह Zod स्कीमा है
  if (schema instanceof z.ZodType) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // 🛑 यहाँ गलती थी: 'ZodSchema.parse' की जगह 'schema.parse' होगा
        await schema.parse({
          body: req.body,
          params: req.params,
          query: req.query,
        });
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          const formattedErrors = error.issues.map(err => ({
            msg: err.message,
            // 'body.email' जैसा क्लीन पाथ बनाने के लिए
            param: err.path.length > 1 ? err.path.slice(1).join('.') : err.path[0],
            location: err.path[0], 
          }));

          return res.status(400).json({ 
            success: false, 
            errors: formattedErrors 
          });
        }
        console.error("Zod validation error:", error);
        return res.status(500).json({ message: "Internal server error during validation." });
      }
    };
  } else {
    // यदि यह Zod स्कीमा नहीं है, तो इसे express-validator स्कीमा मानें
    const expressValidatorSchema = schema as Schema;
    const validationChecks = checkSchema(expressValidatorSchema);

    return async (req: Request, res: Response, next: NextFunction) => {
      for (let i = 0; i < validationChecks.length; i++) {
        const validation = validationChecks[i];
        await validation.run(req);
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      next();
    };
  }
};

// =================================================================
// नीचे express-validator स्कीमा परिभाषाएँ हैं।
// आप इन्हें इसी फ़ाइल में रख सकते हैं या अलग फ़ाइलों में ले जा सकते हैं
// और यहाँ आयात कर सकते हैं।
// =================================================================

export const createUserSchema: Schema = {
  // Email ab optional hai (OTP login ke liye)
  email: {
    optional: { options: { nullable: true } },
    isEmail: { errorMessage: 'Invalid email address' },
    normalizeEmail: true,
  },
  // Password bhi optional hai (OTP login mein password nahi hota)
  password: {
    optional: { options: { nullable: true } },
    isLength: {
      options: { min: 6 },
      errorMessage: 'Password must be at least 6 characters long',
    },
  },
  // Phone number add kiya validation ke liye
  phone: {
    optional: true,
    isString: true,
    errorMessage: 'Valid phone number is required',
  },
  role: {
    isIn: {
      options: [['CUSTOMER', 'SELLER', 'ADMIN', 'DELIVERY_BOY']],
      errorMessage: 'Invalid user role',
    },
  },
};

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
