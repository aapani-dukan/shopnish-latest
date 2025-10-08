import { Router, Request, Response } from 'express';
import { db } from '../server/db.ts';
import { users } from '../shared/backend/schema.ts';
import { eq } from 'drizzle-orm';
import { authAdmin } from '../server/lib/firebaseAdmin.ts';

const userLoginRouter = Router();

userLoginRouter.post("/login", async (req: Request, res: Response) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ error: "ID Token is required." });
    }

    try {
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const firebaseUid = decodedToken.uid;
        const email = decodedToken.email;
        const name = decodedToken.name || "";

        // 1️⃣ DB में user search
        let user = await db.query.users.findFirst({
            where: eq(users.firebaseUid, firebaseUid),
            with: { sellerProfile: true },
        });

        // 2️⃣ अगर user नहीं है → नया बनाओ
        if (!user) {
            const nameParts = name.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            const [newUser] = await db.insert(users).values({
                firebaseUid,
                email,
                name,
                role: "customer",
                password: '',
                firstName,
                lastName,
                phone: '',
                address: '',
            }).returning();

            console.log("✅ नया उपयोगकर्ता डेटाबेस में जोड़ा गया।");
            user = newUser; // नए user को use करना
        }

        // 3️⃣ Session Cookie बनाएँ
        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 दिन (ms में)
        const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });

        res.cookie('__session', sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        });

        // 4️⃣ Response
        return res.status(200).json({
            message: "उपयोगकर्ता लॉगिन सफल",
            user,
        });

    } catch (error: any) {
        console.error("❌ उपयोगकर्ता लॉगिन त्रुटि:", error);
        return res.status(401).json({ error: "Invalid token or login error." });
    }
});

export default userLoginRouter;
