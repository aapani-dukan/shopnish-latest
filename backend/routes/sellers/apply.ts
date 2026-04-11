// routes/sellers/apply.ts
import { Router, Response, NextFunction } from "express";
import { db } from "../../server/db.ts";
import { sellersPgTable, users } from "../../shared/backend/schema.ts"; // Enum hata diye kyunki hum string use karenge
import { verifyToken } from "../../server/middleware/verifyToken.ts";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/apply", verifyToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const firebaseUid = req.user?.firebaseUid; 
    const currentUserId = req.user?.id; // verifyToken se humein ye mil jayega
    
    if (!firebaseUid || !currentUserId) {
      return res.status(401).json({ message: "Unauthorized: Please login with Phone" });
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

    // 1. Basic Validation (Phone zaroori hai business ke liye)
    if (!businessName || !businessPhone || !city || !pincode || !businessAddress || !businessType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // 2. Duplicate Application Check (Already Optimized)
    const [existing] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, currentUserId)).limit(1);
    if (existing) {
      return res.status(400).json({
        message: "Bhai, aapne pehle hi apply kar diya hai!",
        status: existing.approvalStatus,
      });
    }

    // 3. Transaction: Seller Table + User Table Update
    const result = await db.transaction(async (tx) => {
      // A. Create Seller Record
      const [newSeller] = await tx.insert(sellersPgTable).values({
        userId: currentUserId,
        firebaseUid: firebaseUid, // 👈 Sync ke liye UID yahan bhi rakhein
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
        approvalStatus: 'pending', // ✅ String based status
      } as any).returning();

      // B. Update User Flags (Single Identity Logic)
      const [updatedUser] = await tx.update(users)
        .set({
          // Note: role ko 'customer' hi rehne de sakte hain ya 'seller' mark kar sakte hain
          // Lekin 'isSeller' ko True tabhi karein jab admin approve kare
          sellerApprovalStatus: 'pending', 
          updatedAt: new Date(),
        })
        .where(eq(users.id, currentUserId))
        .returning();

      return { newSeller, updatedUser };
    });

    // 4. Response (Clean & Google-Free)
    return res.status(201).json({
      message: "Application submitted successfully!",
      seller: result.newSeller,
      user: {
        firebaseUid: result.updatedUser.firebaseUid,
        phone: result.updatedUser.phone, // 👈 Email ki jagah Phone bhejo
        sellerApprovalStatus: result.updatedUser.sellerApprovalStatus,
        name: `${result.updatedUser.firstName || ""} ${result.updatedUser.lastName || ""}`.trim(),
      },
    });

  } catch (error) {
    console.error("❌ Error in seller apply:", error);
    next(error);
  }
});

export default router;