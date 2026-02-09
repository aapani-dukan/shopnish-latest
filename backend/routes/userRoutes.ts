import { Router, Request, Response } from 'express';
import { db } from '../server/db';
import { users } from '../shared/backend/schema';
import { eq } from 'drizzle-orm';
import { authAdmin } from '../server/lib/firebaseAdmin';

const userLoginRouter = Router();

userLoginRouter.post("/login", async (req: Request, res: Response) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ error: "ID Token is required." });
    }

    try {
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const firebaseUid = decodedToken.uid;
        
        const email = decodedToken.email || null; 
        const phone = decodedToken.phone_number || null; 
        const name = decodedToken.name || ""; 

        // 1️⃣ DB में user search
        let user = await db.query.users.findFirst({
            where: eq(users.firebaseUid, firebaseUid),
            with: { sellerProfile: true }, // Seller App के लिए ज़रूरी
        });

        // 2️⃣ अगर user नहीं है → नया बनाओ
        if (!user) {
            console.log("🆕 Creating new user with UID:", firebaseUid);
            const nameParts = name.split(' ');
            const firstName = nameParts[0] || 'User';
            const lastName = nameParts.slice(1).join(' ') || ''; 

            const [newUser] = await db.insert(users).values({
                firebaseUid,
                email: email || "", 
                phone: phone || "", 
                firstName: firstName || "User",
                lastName: lastName || "",
                // ✅ नए सिस्टम के डिफ़ॉल्ट्स
                isCustomer: true,
                isSeller: false,
                isDelivery: false,
                isAdmin: false,
                sellerApprovalStatus: "N/A", 
                deliveryApprovalStatus: "N/A",
                role: "customer", // पुरानी ऐप्स की खुशी के लिए
                password: '', 
                address: '',
                city: '',
                pincode: '',
            }).returning();

            user = newUser as any;
        }

        // 3️⃣ 🔥 MAGIC LOGIC: Virtual Role Mapping (For Compatibility)
        // यह हिस्सा पुरानी ऐप्स और वेबसाइट को वही 'role' देगा जो वो ढूंढ रहे हैं
        // 1️⃣ पहले चेक करें कि यूजर मिला भी है या नहीं
if (!user) {
    return res.status(404).json({ error: "User not found" });
}

// 1️⃣ पक्का करें कि यूजर मौजूद है (TypeScript Error Fix)
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // 2️⃣ Virtual Role Mapping (Compatibility Logic)
        const userWithRole = {
            ...user,
            role: user.isAdmin ? 'admin' : 
                  user.isSeller ? 'seller' : 
                  user.isDelivery ? 'delivery-boy' : 'customer'
        };

        // 3️⃣ Session Cookie Logic (जवाब भेजने से पहले कुकी सेट करें)
        const expiresIn = 60 * 60 * 24 * 5 * 1000;
        const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });

        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie('__session', sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
        });

        // 4️⃣ फाइनल रिस्पॉन्स (सिर्फ एक बार)
        console.log(`✅ User Logged In: ${userWithRole.firstName} as ${userWithRole.role}`);

        return res.status(200).json({
            message: "उपयोगकर्ता लॉगिन सफल",
            user: userWithRole, 
        });
    } catch (error: any) {
        console.error("❌ उपयोगकर्ता लॉगिन त्रुटि:", error);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: "ID Token expired. Please re-authenticate." });
        }
        return res.status(401).json({ error: "Invalid token or login error." });
    }
});

export default userLoginRouter;