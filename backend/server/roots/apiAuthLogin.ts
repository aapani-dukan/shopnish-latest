// server/roots/apiAuthLogin.ts

import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { users, userRoleEnum } from '../../shared/backend/schema.ts';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { authAdmin } from '../lib/firebaseAdmin.ts';
// ✅ authUtils से comparePassword को इम्पोर्ट करें
import { comparePassword } from '../util/authUtils.ts'; // सुनिश्चित करें कि पाथ सही है

const apiAuthLoginRouter = Router();

apiAuthLoginRouter.post("/admin-login", async (req: Request, res: Response) => {
    const { email, password } = req.body; // ✅ अब email भी body से आएगा
    
    // 1. सुनिश्चित करें कि ईमेल और पासवर्ड दोनों मौजूद हैं
    if (!email || !password) {
        return res.status(400).json({ error: "Email and Password are required." });
    }
    
    // 2. डेटाबेस से एडमिन यूजर को ईमेल द्वारा ढूंढें
    // मान लें कि एडमिन का ईमेल 'admin@shopnish.com' है
    const [adminUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email)) // ✅ यूजर को ईमेल द्वारा खोजें
        .limit(1);

    if (!adminUser) {
        // यदि यूजर इस ईमेल से नहीं मिलता
        return res.status(401).json({ error: "Invalid credentials." });
    }

    // 3. जांचें कि यूजर वास्तव में एक एडमिन है
    // userRoleEnum.enumValues[2] की जगह सीधे user.role === 'admin' का उपयोग करें
    if (adminUser.role !== 'admin') { 
        return res.status(403).json({ error: "Access denied: Not an administrator." });
    }

    // 4. डेटाबेस से मिले हैशेड पासवर्ड से तुलना करें
    // ✅ comparePassword फ़ंक्शन का उपयोग करें जो हमने authUtils में बनाया था
    const isPasswordCorrect = await comparePassword(password, adminUser.password);

    if (!isPasswordCorrect) {
        return res.status(401).json({ error: "Invalid password." });
    }
    
    // यदि adminUser.firebaseUid undefined है, तो यह गड़बड़ कर सकता है।
    // सुनिश्चित करें कि डेटाबेस में adminUser का firebaseUid सही है।
    if (!adminUser.firebaseUid) {
        console.error("❌ Admin user found but firebaseUid is missing in DB for email:", adminUser.email);
        return res.status(500).json({ error: "Admin Firebase UID missing in database." });
    }

    try {
        // ✅ Custom token create (जैसा कि आपका कोड करता है)
        const customToken = await authAdmin.createCustomToken(adminUser.firebaseUid);
        console.log("✅ Admin custom token created.");

        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 दिन

        res.cookie('__session', customToken, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        });

        return res.status(200).json({
            message: "Admin login successful.",
            customToken // तुम इसे क्लाइंट को भेज रहे हो, फिर क्लाइंट को इसे Firebase ID Token में एक्सचेंज करना होगा।
        });

    } catch (error: any) {
        console.error("❌ Admin login error during token creation:", error);
        return res.status(500).json({ error: "Internal server error during token creation." });
    }
});

export default apiAuthLoginRouter;
