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
        
        // ✅ Badlav: Email aur Phone dono ko handle karein
        const email = decodedToken.email || null; 
        const phone = decodedToken.phone_number || null; // 👈 Phone OTP ke liye zaroori
        const name = decodedToken.name || ""; 

        // 1️⃣ DB में user search
        let user = await db.query.users.findFirst({
            where: eq(users.firebaseUid, firebaseUid),
            with: { sellerProfile: true },
        });

        // 2️⃣ अगर user नहीं है → नया बनाओ (Zomato-style Auto Registration)
        if (!user) {
            console.log("🆕 Creating new user with UID:", firebaseUid);
            const nameParts = name.split(' ');
            const firstName = nameParts[0] || 'User'; // Default name agar name khali ho
            const lastName = nameParts.slice(1).join(' ') || ''; 
const [newUser] = await db.insert(users).values({
    firebaseUid,
    // ✅ Agar email null hai, toh ye empty string ("") bhejega. 
    // Isse Database ka 'NOT NULL' constraint break nahi hoga.
    email: email || "", 
    phone: phone || "", // Phone number save hoga
    firstName: firstName || "User",
    lastName: lastName || "",
    role: "customer",
    password: '', 
    address: '',
    city: '',
    pincode: '',
    
}).returning();

console.log("✅ नया उपयोगकर्ता (Phone/Email) डेटाबेस में जोड़ा गया। ID:", newUser.id);
user = newUser as any;
        }

        // 3️⃣ Session Cookie Logic (Aapka purana logic ekdum sahi hai)
        const expiresIn = 60 * 60 * 24 * 5 * 1000;
        const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });

        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie('__session', sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
        });

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
