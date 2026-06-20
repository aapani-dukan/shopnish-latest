import { Request, Response } from "express";
import { db } from "../db";
import { users } from "../../shared/backend/schema";
import { formatPhone } from "../util/phoneFormatter";
import { authAdmin } from "../lib/firebaseAdmin";
import { eq } from "drizzle-orm";
export const login = async (
  req: Request,
  res: Response
) => {
  try {

    const { idToken } = req.body;

    const decodedToken =
      await authAdmin.verifyIdToken(idToken);

    const {
      uid,
      phone_number,
    } = decodedToken;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, uid));

    if (!user) {

      return res.status(200).json({
        registered: false,
        firebaseUid: uid,
        phone: phone_number,
      });

    }

    return res.status(200).json({
      registered: true,
      user,
    });

  } catch (error) {

    console.error(error);

    return res.status(401).json({
      message: "Auth failed",
    });

  }
};
export const logout = async (
  req: Request,
  res: Response
) => {

  const sessionCookie =
    req.cookies?.__session || "";

  res.clearCookie("__session");

  try {

    if (sessionCookie) {

      const decoded =
        await authAdmin.verifySessionCookie(
          sessionCookie
        );

      await authAdmin.revokeRefreshTokens(
        decoded.sub
      );

    }

    return res.status(200).json({
      message:
        "Logged out successfully!",
    });

  } catch (error: any) {

    console.error(error);

    return res.status(500).json({
      message: "Logout failed.",
    });

  }

};
// ✅ Register User
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { firebaseUid, phone, firstName, lastName } = req.body;

    // 1. Pehle validation check karein
    if (!firebaseUid || !phone) {
      return res.status(400).json({ error: "Firebase UID and Phone are required." });
    }

    // 2. 🚩 Phone Number ko Standard format (+91) mein badlein
    const standardizedPhone = formatPhone(phone);

    // 3. Database mein insert karein (Sirf EK baar)
    const result = await db.insert(users).values({
      firebaseUid,
      phone: standardizedPhone, // ✅ Standardized phone use ho raha hai
      firstName: firstName || "User",
      lastName: lastName || "",
      role: "customer",
      isCustomer: true,
      isActive: true,
      approvalStatus: "approved",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // 4. Result se naya user nikalein (Destructuring error se bachne ke liye)
    const newUser = result[0];

    res.status(201).json(newUser);
  } catch (error: any) {
    console.error("❌ Registration failed:", error);
    res.status(400).json({ error: error.message });
  }
};
