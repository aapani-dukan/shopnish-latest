import { Response } from "express";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { users } from "../../shared/backend/schema";
import { formatPhone } from "../util/phoneFormatter";
export const getCurrentUser = async (
   req: any,
   res: Response
) => {
     try {
        const { firebaseUid, phoneNumber, email, name, isNewUser } = req.user;
    
        // 1. Pehle user dhundo
        let [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
    
        // 2. Agar user nahi hai (Middleware ne isNewUser flag bheja hai)
        if (!user) {
          const nameParts = (name || "User").split(" ");
          const [newUser] = await db.insert(users).values({
            firebaseUid: firebaseUid,
            phone: formatPhone(phoneNumber),
          //console.log(`[AUTH] Auto-registering: ${firebaseUid}`);
            email: email || null,
            firstName: nameParts[0] || "User",
            lastName: nameParts.slice(1).join(" ") || "",
            role: "customer",
            isCustomer: true,
            isActive: true,
            approvalStatus: "approved",
          }).returning();
          
          user = newUser;
        }
    
        // 3. Virtual role calculation
        const virtualRole = user.isAdmin ? 'admin' : 
                            user.isSeller ? 'seller' : 
                            user.isDelivery ? 'delivery-boy' : 'customer';
    
        // ✅ Response mein approval statuses add kiye hain taaki Frontend check kar sake
        res.status(200).json({ 
          ...user, 
          role: virtualRole,
          // Frontend ko ye batane ke liye ki approval pending hai ya nahi
          currentDeliveryStatus: user.deliveryApprovalStatus, // Example: "pending", "approved", "rejected"
          currentSellerStatus: user.sellerApprovalStatus      // Example: "pending", "approved", "rejected"
        });
    
      } catch (error: any) {
        console.error("❌ Profile Sync Error:", error);
        res.status(500).json({ error: "Internal server error." });
      }
};