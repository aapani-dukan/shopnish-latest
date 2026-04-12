import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users } from '../../shared/backend/schema';
import { eq, and } from 'drizzle-orm';
import { comparePassword } from '../util/authUtils'; 
import { verifyToken } from '../middleware/verifyToken'; // Hamara OTP wala middleware

const apiAuthLoginRouter = Router();

// ✅ Admin Password Verification (Only for Web)
// Isme hum verifyToken use karenge taaki pata chale banda OTP se login hai
apiAuthLoginRouter.post("/admin-verify-password", verifyToken as any, async (req: any, res: Response) => {
    try {
        const { password } = req.body;
        const { firebaseUid, phoneNumber } = req.user; // verifyToken se aaya hua data

        if (!password) {
            return res.status(400).json({ error: "Password is required." });
        }

        // 1. Database se Admin ko dhoondo (UID aur Phone dono se check)
        const [adminUser] = await db
            .select()
            .from(users)
            .where(
                and(
                    eq(users.firebaseUid, firebaseUid),
                    eq(users.isAdmin, true) // ✅ SQL manually true kiya hona chahiye
                )
            )
            .limit(1);

        // 2. Security Check: Agar user nahi mila ya isAdmin true nahi hai
        if (!adminUser) {
            console.warn(`🚨 Unauthorized Admin Attempt from Phone: ${phoneNumber}`);
            return res.status(403).json({ error: "Access denied: Not an administrator." });
        }

        // 3. Password Check (Bcrypt comparison)
        const isPasswordCorrect = await comparePassword(password, adminUser.password ?? '');

        if (!isPasswordCorrect) {
            return res.status(401).json({ error: "Invalid admin password." });
        }

        // ✅ Success: Ab hum session mein ya response mein ek flag bhej sakte hain
        // Frontend iske baad Admin Dashboard ko unlock kar dega
        return res.status(200).json({
            message: "Admin identity verified.",
            adminVerified: true,
            user: {
                ...adminUser,
                role: 'admin'
            }
        });

    } catch (error: any) {
        console.error("❌ Admin verify error:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
});

export default apiAuthLoginRouter;