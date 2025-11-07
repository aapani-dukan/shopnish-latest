// backend/server/middleware/validation.ts

import { Request, Response, NextFunction } from 'express';
import { validationResult, checkSchema, Schema } from 'express-validator';
import { ZodSchema, ZodError } from 'zod'; // ✅ Zod से आयात करें

// ✅ validateRequest फ़ंक्शन को संशोधित करें ताकि यह ZodSchema और express-validator Schema दोनों को स्वीकार कर सके
export const validateRequest = (schema: Schema | ZodSchema<any>) => {
  // ZodSchema में 'parse' मेथड होता है। यदि यह मौजूद है, तो यह एक Zod स्कीमा है।
  if ('parse' in schema && typeof schema.parse === 'function') {
    const zodSchema = schema as ZodSchema<any>;

    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Zod द्वारा req.body, req.params, req.query को वैलिडेट करें
        // Zod स्कीमा को पूरे req ऑब्जेक्ट पर लागू करने के लिए, स्कीमा को इस प्रकार बनाना होगा:
        // z.object({
        //   body: z.object(...),
        //   params: z.object(...),
        //   query: z.object(...),
        // })
        zodSchema.parse({
          body: req.body,
          params: req.params,
          query: req.query,
        });
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          // ZodError को express-validator जैसा फॉर्मेट करें
          const formattedErrors = error.errors.map(err => ({
            msg: err.message,
            param: err.path.join('.'), // path को एक स्ट्रिंग के रूप में जॉइन करें
            location: err.path[0], // 'body', 'params', 'query'
          }));
          return res.status(400).json({ errors: formattedErrors });
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
