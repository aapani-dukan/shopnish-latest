// server/roots/apiAuthLogin.ts

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users } from '../../shared/backend/schema';
import { eq } from 'drizzle-orm';
import { authAdmin } from '../lib/firebaseAdmin';
import { comparePassword } from '../util/authUtils'; 

const apiAuthLoginRouter = Router();

apiAuthLoginRouter.post("/admin-login", async (req: Request, res: Response) => {
    const { email, password } = req.body; 
    
    if (!email || !password) {
        return res.status(400).json({ error: "Email and Password are required." });
    }
    
    // 1. ईमेल द्वारा यूजर ढूंढें
    const [adminUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (!adminUser) {
        return res.status(401).json({ error: "Invalid credentials." });
    }

    // 2. 🔥 HIGH-CLASS CHANGE: सीधा isAdmin चेक करें
    // अब 'role' कॉलम पर निर्भर रहने की ज़रूरत नहीं
    if (!adminUser.isAdmin) { 
        return res.status(403).json({ error: "Access denied: Not an administrator." });
    }

    // 3. पासवर्ड चेक करें
    const isPasswordCorrect = await comparePassword(password, adminUser.password ?? '');

    if (!isPasswordCorrect) {
        return res.status(401).json({ error: "Invalid password." });
    }
    
    if (!adminUser.firebaseUid) {
        console.error("❌ Admin firebaseUid missing for:", adminUser.email);
        return res.status(500).json({ error: "Admin account setup incomplete (UID missing)." });
    }

    try {
        const customToken = await authAdmin.createCustomToken(adminUser.firebaseUid);

        const expiresIn = 60 * 60 * 24 * 5 * 1000; 

        res.cookie('__session', customToken, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        });

        // ✅ Response में user का पूरा डेटा भेजें (Virtual Role के साथ ताकि Frontend खुश रहे)
        return res.status(200).json({
            message: "Admin login successful.",
            customToken,
            user: {
                ...adminUser,
                role: 'admin' // पुरानी एडमिन वेबसाइट के डैशबोर्ड को खुश रखने के लिए
            }
        });

    } catch (error: any) {
        console.error("❌ Admin login error:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
});

export default apiAuthLoginRouter;