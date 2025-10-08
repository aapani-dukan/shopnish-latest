// server/roots/apiAuthLogin.ts

import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { users, userRoleEnum } from '../../shared/backend/schema.ts';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { authAdmin } from '../lib/firebaseAdmin.ts';

const apiAuthLoginRouter = Router();

apiAuthLoginRouter.post("/admin-login", async (req: Request, res: Response) => {
    const { password } = req.body;
    const adminPasswordHash = process.env.ADMIN_PASSWORD;

    if (!adminPasswordHash) {
        return res.status(500).json({ error: "Configuration error." });
    }

    if (!password) {
        return res.status(400).json({ error: "Password is required." });
    }

    try {
        const isPasswordCorrect = await bcrypt.compare(password, adminPasswordHash);

        if (!isPasswordCorrect) {
            return res.status(401).json({ error: "Invalid password." });
        }

        const [adminUser] = await db
            .select()
            .from(users)
            .where(eq(users.role, userRoleEnum.enumValues[2]));

        if (!adminUser) {
            return res.status(500).json({ error: "Admin account not configured." });
        }

        // ✅ Custom token create
        const customToken = await authAdmin.createCustomToken(adminUser.firebaseUid);
        console.log("✅ Admin custom token created.");

        // 🔹 यहाँ हम custom token को ID token में exchange नहीं कर सकते server से,
        // तो हम इसे session cookie के तौर पर store कर देंगे
        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 दिन

        res.cookie('__session', customToken, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // dev में false
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        });

        return res.status(200).json({
            message: "Admin login successful.",
            customToken
        });

    } catch (error: any) {
        console.error("❌ Admin login error:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
});

export default apiAuthLoginRouter;
