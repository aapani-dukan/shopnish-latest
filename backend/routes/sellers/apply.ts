// routes/sellers/apply.ts
import { Router, Response, NextFunction } from "express";
import { db } from "../../server/db.ts";
import { sellersPgTable, users, approvalStatusEnum, userRoleEnum } from "../../shared/backend/schema.ts";
import { verifyToken } from "../../server/middleware/verifyToken.ts";
import { eq } from "drizzle-orm";

const router = Router();

// ✅ ट्रिक: यहाँ 'req' को 'any' दें ताकि Express का Overload इसे स्वीकार कर ले
router.post("/apply", verifyToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    // यहाँ हमने 'req.user' को 'any' के जरिए एक्सेस किया, कोई एरर नहीं आएगी
    const firebaseUid = req.user?.firebaseUid; 
    
    if (!firebaseUid) {
      return res.status(401).json({ message: "Unauthorized: Firebase UID missing" });
    }

    const {
      businessName,
      businessAddress,
      businessPhone,
      description,
      city,
      pincode,
      gstNumber,
      bankAccountNumber,
      ifscCode,
      deliveryRadius,
      businessType,
    } = req.body;

    // 1. Validation
    if (!businessName || !businessPhone || !city || !pincode || !businessAddress || !businessType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // 2. Database User Check
    const [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
    if (!dbUser) return res.status(404).json({ message: "User not found." });

    // 3. Duplicate Application Check
    const [existing] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, dbUser.id)).limit(1);
    if (existing) {
      return res.status(400).json({
        message: "Application already submitted.",
        status: existing.approvalStatus,
      });
    }

    // 4. Create Seller Record
    const [newSeller] = await db.insert(sellersPgTable).values({
      userId: dbUser.id,
      businessName,
      businessAddress,
      businessPhone,
      description: description || null,
      city,
      pincode,
      gstNumber: gstNumber || null,
      bankAccountNumber: bankAccountNumber || null,
      ifscCode: ifscCode || null,
      deliveryRadius: deliveryRadius ? parseInt(String(deliveryRadius)) : 5,
      businessType,
      approvalStatus: approvalStatusEnum.enumValues[0],
    }).returning();

    // 5. Update User Role & Status
    const [updatedUser] = await db.update(users)
      .set({
        role: userRoleEnum.enumValues[1], // 'seller'
        approvalStatus: approvalStatusEnum.enumValues[0], // 'pending'
      })
      .where(eq(users.id, dbUser.id))
      .returning();

    // 6. Response
    return res.status(201).json({
      message: "Application submitted successfully!",
      seller: newSeller,
      user: {
        firebaseUid: updatedUser.firebaseUid,
        role: updatedUser.role,
        email: updatedUser.email,
        name: `${updatedUser.firstName || ""} ${updatedUser.lastName || ""}`.trim(),
      },
    });

  } catch (error) {
    console.error("❌ Error in apply.ts:", error);
    next(error);
  }
});

export default router;