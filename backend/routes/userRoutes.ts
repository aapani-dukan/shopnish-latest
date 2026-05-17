import { Router, Request, Response } from 'express';
import { db } from '../server/db';
import { users } from '../shared/backend/schema';
import { eq } from 'drizzle-orm';
import { authAdmin } from '../server/lib/firebaseAdmin';

const userLoginRouter = Router();

// ==========================================
// 1️⃣ OLD LOGIN ROUTE (Pehle jaisa bilkul same)
// ==========================================
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

        let user = await db.query.users.findFirst({
            where: eq(users.firebaseUid, firebaseUid),
            with: { sellerProfile: true }, 
        });

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
                isCustomer: true,
                isSeller: false,
                isDelivery: false,
                isAdmin: false,
                sellerApprovalStatus: "N/A", 
                deliveryApprovalStatus: "N/A",
                role: "customer", 
                password: '', 
                address: '',
                city: '',
                pincode: '',
            }).returning();

            user = newUser as any;
        }

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const userWithRole = {
            ...user,
            role: user.isAdmin ? 'admin' : 
                  user.isSeller ? 'seller' : 
                  user.isDelivery ? 'delivery-boy' : 'customer'
        };

        const expiresIn = 60 * 60 * 24 * 5 * 1000;
        const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });
        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie('__session', sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
        });

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

// ==========================================
// 2️⃣ 🚨 NEW ROUTE: UPDATE FCM TOKEN LOGIC (The Solution)
// ==========================================
userLoginRouter.post("/update-token", async (req: Request, res: Response) => {
    try {
        const { fcmToken } = req.body;
        
        // Frontend AuthContext mein humare paas Authorization header mein Bearer token aa raha hai
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: "Unauthorized: Missing token" });
        }

        const idToken = authHeader.split('Bearer ')[1];
        
        // Firebase se token verify karke user ki unique Firebase UID nikaalein
        const decodedToken = await authAdmin.verifyIdToken(idToken);
        const firebaseUid = decodedToken.uid;

        if (!fcmToken) {
            return res.status(400).json({ error: "fcmToken is required" });
        }

        // Users table mein camelCase ke hisab se 'fcmToken' field ko update karein
        await db.update(users)
            .set({ fcmToken: fcmToken, updatedAt: new Date() })
            .where(eq(users.firebaseUid, firebaseUid));

        console.log(`💾 [DB Success]: Updated fcmToken for Firebase UID: ${firebaseUid}`);
        
        return res.status(200).json({ message: "Token updated successfully" });
    } catch (error: any) {
        console.error("❌ Error updating FCM token in route:", error);
        return res.status(500).json({ error: "Internal server error while syncing token." });
    }
});

export default userLoginRouter;