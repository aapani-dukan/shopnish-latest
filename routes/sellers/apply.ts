// routes/sellers/apply.ts
import { Router, Response, NextFunction } from "express";
import { db } from "../../server/db.ts";
import { sellersPgTable, users, approvalStatusEnum, userRoleEnum } from "../../shared/backend/schema.ts";
import { verifyToken, AuthenticatedRequest } from "../../server/middleware/verifyToken.ts";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/", verifyToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // ✅ यहाँ req.user?.userId की जगह req.user?.firebaseUid का उपयोग करें
    const firebaseUid = req.user?.firebaseUid; 
    if (!firebaseUid) return res.status(401).json({ message: "Unauthorized" });

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

    if (!businessName || !businessPhone || !city || !pincode || !businessAddress || !businessType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
    if (!dbUser) return res.status(404).json({ message: "User not found." });

    const [existing] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, dbUser.id));
    if (existing) {
      return res.status(400).json({
        message: "Application already submitted.",
        status: existing.approvalStatus,
      });
    }

    const newSeller = await db.insert(sellersPgTable).values({
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
      deliveryRadius: deliveryRadius ? parseInt(String(deliveryRadius)) : null,
      businessType,
      approvalStatus: approvalStatusEnum.enumValues[0],
      applicationDate: new Date(),
    }).returning();

    const [updatedUser] = await db.update(users)
      .set({
        role: userRoleEnum.enumValues[1],
        approvalStatus: approvalStatusEnum.enumValues[0],
      })
      .where(eq(users.id, dbUser.id))
      .returning();

    return res.status(201).json({
      message: "Application submitted.",
      seller: newSeller[0],
      user: {
        // ✅ यहाँ uuid की जगह firebaseUid का उपयोग करें
        firebaseUid: updatedUser.firebaseUid,
        role: updatedUser.role,
        email: updatedUser.email,
        name: updatedUser.name,
      },
    });
  } catch (error) {
    console.error("❌ Error in apply.ts:", error);
    next(error);
  }
});

export default router;
