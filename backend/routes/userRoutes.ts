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
        const name = decodedToken.name || ""; // Firebase से नाम

        // 1️⃣ DB में user search
        let user = await db.query.users.findFirst({
            where: eq(users.firebaseUid, firebaseUid),
            // sellerProfile के साथ user को fetch करें ताकि लॉगिन के बाद सीधे उपलब्ध हो
            with: { sellerProfile: true },
        });

        // 2️⃣ अगर user नहीं है → नया बनाओ
        if (!user) {
            const nameParts = name.split(' ');
            const firstName = nameParts[0] || '';
            // lastName को उन सभी हिस्सों को जोड़कर बनाएं जो firstName के बाद आते हैं
            const lastName = nameParts.slice(1).join(' ') || ''; 

            const [newUser] = await db.insert(users).values({
                firebaseUid,
                email,
                // स्कीमा में 'name' फ़ील्ड नहीं है, इसलिए इसे हटा दिया गया है
                // name: name, 
                role: "customer", // डिफ़ॉल्ट रूप से ग्राहक भूमिका
                password: '', // Firebase Auth का उपयोग कर रहे हैं, इसलिए पासवर्ड की आवश्यकता नहीं है
                firstName,
                lastName,
                phone: '', // फ़ोन नंबर बाद में अपडेट किया जा सकता है
                address: '', // पता बाद में अपडेट किया जा सकता है
                // बाकी फ़ील्ड्स जैसे city, pincode, whatsappOptIn, welcomeMessageSent, lastActivityAt
                // उनके स्कीमा में परिभाषित डिफ़ॉल्ट मानों का उपयोग करेंगे।
                // address, city, pincode को यहाँ जोड़ने की आवश्यकता नहीं है यदि उनके पास डिफ़ॉल्ट मान हैं।
                // यदि वे NOT NULL हैं और उनके पास डिफ़ॉल्ट नहीं है, तो उन्हें यहाँ प्रदान करें।
                // जैसे: city: decodedToken.city || '', pincode: decodedToken.pincode || '',
                city: '', // स्कीमा में NOT NULL नहीं है, इसलिए खाली स्ट्रिंग या null ठीक है
                pincode: '', // स्कीमा में NOT NULL नहीं है, इसलिए खाली स्ट्रिंग या null ठीक है
            }).returning();

            console.log("✅ नया उपयोगकर्ता डेटाबेस में जोड़ा गया।");
            user = newUser; // नए user को use करना
        }

        // 3️⃣ Session Cookie बनाएँ
        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 दिन (ms में)
        const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });

        // `sameSite` एट्रीब्यूट को `process.env.NODE_ENV` के आधार पर सेट करना
        // 'none' तभी जब secure: true हो
        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie('__session', sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: isProduction, // उत्पादन में HTTPS के लिए 'true'
            sameSite: isProduction ? 'none' : 'lax', // उत्पादन में क्रॉस-साइट कुकीज़ के लिए 'none'
        });

        // 4️⃣ Response
        return res.status(200).json({
            message: "उपयोगकर्ता लॉगिन सफल",
            user,
        });

    } catch (error: any) {
        console.error("❌ उपयोगकर्ता लॉगिन त्रुटि:", error);
        // संभावित Firebase Auth एरर कोड को अधिक विशिष्ट प्रतिक्रियाओं के लिए हैंडल करें
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: "ID Token expired. Please re-authenticate." });
        }
        return res.status(401).json({ error: "Invalid token or login error." });
    }
});

export default userLoginRouter;
