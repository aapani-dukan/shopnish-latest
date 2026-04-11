import { Request, Response, NextFunction } from 'express';
import { validationResult, checkSchema, Schema } from 'express-validator';
import { z, ZodError, ZodType } from 'zod';

// ✅ Zod Type Validation helper
export const validateRequest = (schema: Schema | ZodType<any>) => {
  if (schema instanceof z.ZodType) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
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
            param: err.path.length > 1 ? err.path.slice(1).join('.') : err.path[0],
            location: err.path[0], 
          }));
          return res.status(400).json({ success: false, errors: formattedErrors });
        }
        return res.status(500).json({ message: "Internal validation error." });
      }
    };
  } else {
    const expressValidatorSchema = schema as Schema;
    const validationChecks = checkSchema(expressValidatorSchema);
    return async (req: Request, res: Response, next: NextFunction) => {
      for (const validation of validationChecks) {
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
// ✅ Mobile-First Schemas
// =================================================================

export const createUserSchema: Schema = {
  // Phone ab primary hai, isliye iska validation zaroori hai
  phone: {
    notEmpty: { errorMessage: 'Phone number is required for OTP login' },
    isString: { errorMessage: 'Phone number must be a string' },
    // Regex for Indian Phone numbers (optional but good)
    matches: {
      options: [/^\+?[1-9]\d{1,14}$/], 
      errorMessage: 'Invalid phone number format'
    }
  },
  // Firebase UID zaroori hai authentication ke liye
  firebaseUid: {
    notEmpty: { errorMessage: 'Firebase UID is required' },
    isString: true
  },
  // Email optional hai, validation tabhi chale jab email provide kiya ho
  email: {
    optional: { options: { nullable: true, checkFalsy: true } },
    isEmail: { errorMessage: 'Invalid email address' },
    normalizeEmail: true,
  },
  // Roles ko humne lowercase mein sync kar diya hai
  role: {
    isIn: {
      options: [['customer', 'seller', 'admin', 'delivery-boy']],
      errorMessage: 'Invalid user role',
    },
  },
};

// --- Platform & Vendor Settings (Same logic as before, but cleaned) ---

export const updatePlatformSettingsSchema: Schema = {
  baseDeliveryCharge: {
    optional: true,
    isFloat: { options: { min: 0 }, errorMessage: 'Must be a non-negative number.' },
    toFloat: true,
  },
  platformCommissionRate: { // 👈 Ye add kiya (Wallet logic ke liye)
    optional: true,
    isFloat: { options: { min: 0, max: 100 }, errorMessage: 'Commission must be 0-100%' },
    toFloat: true,
  }
};

// Baaki settings schemas (Vendor/Product) waise hi rakhein jaise pehle the, 
// bas dhyan dein ki phone numbers hamesha string format mein validate hon.