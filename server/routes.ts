import { Router, Request, Response } from "express";
import { db } from "./db.ts";
import {
  users,
  userRoleEnum,
  approvalStatusEnum,
  sellersPgTable,
} from "../shared/backend/schema.ts";
import { AuthenticatedRequest } from "./middleware/verifyToken.ts";
import { requireAuth, requireAdminAuth } from "./middleware/authMiddleware.ts";
import { authAdmin } from "./lib/firebaseAdmin.ts";
import { eq } from "drizzle-orm";

// ✅ Sub-route modules
import apiAuthLoginRouter from "./roots/apiAuthLogin.ts";
import adminApproveProductRoutes from "./roots/admin/approve-product.ts";
import adminRejectProductRoutes from "./roots/admin/reject-product.ts";
import adminProductsRoutes from "./roots/admin/products.ts";
import adminVendorsRoutes from "./roots/admin/vendors.ts";
import adminPasswordRoutes from "./roots/admin/admin-password.ts";
import sellerRouter from "../routes/sellers/sellerRoutes.ts";
import productsRouter from "../routes/productRoutes.ts";
import cartRouter from "../routes/cartRoutes.ts";
import dBoyRouter from "../routes/dBoyRoutes.ts";
import admindBoyRouter from "./roots/admin/admindBoyRoutes.ts";
import orderConfirmationRouter from "../routes/orderConfirmationRouter";
import userLoginRouter from "../routes/userRoutes.ts";
import orderRoutes from "../routes/orderRoutes";
import { verifyToken } from "./middleware/verifyToken";
import { categories } from "../shared/backend/schema.ts";
import adminOrdersRouter from "./roots/admin/adminOrderRoutes";
const router = Router();

// ✅ Health Check
router.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "API is running" });
});

router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ✅ Register User
router.post("/register", async (req: Request, res: Response) => {
  try {
    const userData = req.body;
    if (!userData.firebaseUid || !userData.email) {
      return res.status(400).json({ error: "Firebase UID and email are required." });
    }

    const [newUser] = await db.insert(users).values({
      firebaseUid: userData.firebaseUid,
      email: userData.email,
      name: userData.name || null,
      role: userRoleEnum.enumValues[0],
      approvalStatus: approvalStatusEnum.enumValues[1],
      password: userData.password || "",
      firstName: userData.firstName || "",
      lastName: userData.lastName || "",
      phone: userData.phone || "",
      address: userData.address || "",
      city: userData.city || "",
      pincode: userData.pincode || "",
    }).returning();

    res.status(201).json(newUser);
  } catch (error: any) {
    console.error("User registration failed:", error);
    res.status(400).json({ error: error.message });
  }
});

// ✅ User Profile
router.get(
  "/users/me",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userUuid = req.user?.firebaseUid;
      if (!userUuid) {
        return res.status(401).json({ error: "Not authenticated." });
      }

      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.firebaseUid, userUuid));

      if (!user) {
        return res.status(404).json({ error: "User not found." });
      }

      let sellerInfo;
      if (user.role === "seller") {
        const [record] = await db
          .select({
            id: sellersPgTable.id,
            userId: sellersPgTable.userId,
            businessName: sellersPgTable.businessName,
            approvalStatus: sellersPgTable.approvalStatus,
            rejectionReason: sellersPgTable.rejectionReason,
          })
          .from(sellersPgTable)
          .where(eq(sellersPgTable.userId, user.id));

        if (record) sellerInfo = record;
      }

      res.status(200).json({ ...user, sellerProfile: sellerInfo || null });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Internal error." });
    }
  }
);

router.get(
  "/:orderId/tracking", // यह URL /api/orders/170/tracking को मैच करेगा
  requireAuth, // सुनिश्चित करें कि ग्राहक लॉग इन है
  async (req: AuthenticatedRequest, res: Response) => {
    const { orderId } = req.params;
    const customerId = req.user?.firebaseUid;

    if (!customerId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    try {
      // 1. डेटाबेस से ऑर्डर और डिलीवरी पता प्राप्त करें
      //    (सुरक्षा के लिए, सुनिश्चित करें कि यह ऑर्डर वास्तव में इसी ग्राहक का है)
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, Number(orderId)))
        .limit(1);

      if (!order || order.customerId !== customerId) {
        return res.status(404).json({ error: "Order not found or access denied." });
      }

      // 2. ट्रैकिंग डेटा वापस भेजें
      res.status(200).json({
        orderId: order.id,
        status: order.status,
        deliveryAddress: order.deliveryAddress, // ग्राहक का पता
        // Note: लाइव लोकेशन इस endpoint से नहीं आती है, वह Socket.IO से आती है।
        // यह endpoint केवल प्रारंभिक डेटा (पता, स्थिति) प्रदान करता है।
      });
      
    } catch (error) {
      console.error("Tracking details fetch failed:", error);
      res.status(500).json({ error: "Failed to fetch tracking details." });
    }
  }
);


// ✅ Initial Login Route: नए उपयोगकर्ताओं के लिए
router.post("/auth/initial-login", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: "Firebase ID token is required." });
    }

    // Firebase टोकन को सत्यापित करें
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    
    // डिकोडेड टोकन से आवश्यक डेटा निकालें
    const userUuid = decodedToken.uid;
    const email = decodedToken.email;
    const fullName = decodedToken.name;

    // यदि नाम मौजूद है, तो उसे firstName और lastName में विभाजित करें
    const [firstName, ...lastNameParts] = fullName ? fullName.split(' ') : ['', ''];
    const lastName = lastNameParts.join(' ');
    
    // डेटाबेस में उपयोगकर्ता की जाँच करें
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, userUuid));

    // यदि उपयोगकर्ता नहीं मिलता, तो नया बनाएँ
    if (!user) {
      console.log("New user detected. Creating profile for Firebase UID:", userUuid);
      
      const [newUser] = await db.insert(users).values({
        firebaseUid: userUuid,
        email: email,
        password: 'GOOGLE_AUTH_USER', 
        firstName: firstName,        
        lastName: lastName,          
        phone: '',                   
        address: '',                 
        city: '',                    
        pincode: '',                  
        role: 'customer',
        approvalStatus: 'approved'
      }).returning();

      user = newUser;
    }
    
    // सफलतापूर्वक बनाए गए/पाए गए उपयोगकर्ता को लौटाएँ
    res.status(200).json({
        user: {
            ...user,
            idToken: idToken // फ्रंटएंड के लिए टोकन जोड़ें
        }
    });

  } catch (error) {
    console.error("❌ Initial login failed:", error);
    res.status(401).json({ message: "Authentication failed. Please try again." });
  }
});


// ✅ Logout
router.post("/auth/logout", async (req, res) => {
  const sessionCookie = req.cookies?.__session || "";
  res.clearCookie("__session");

  try {
    if (sessionCookie) {
      const decoded = await authAdmin
        .verifySessionCookie(sessionCookie);
      await authAdmin.revokeRefreshTokens(decoded.sub);
    }
    res.status(200).json({ message: "Logged out successfully!" });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Logout failed." });
  }
});

// ✅ Routes mapping
router.use("/users", userLoginRouter);
router.use("/auth", apiAuthLoginRouter);

// Seller-specific
router.use("/cart", cartRouter);
router.use("/orders", orderRoutes);
router.use("/order-confirmation", orderConfirmationRouter);
router.use("/sellers", verifyToken, sellerRouter);

// ✅ Categories
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const categoriesList = await db.select().from(categories);
    res.status(200).json(categoriesList);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Internal error." });
  }
});

// ✅ Products
router.use("/products", productsRouter);

// ✅ Delivery Boy
router.use("/delivery", dBoyRouter);


// ✅ Admin Routes
const adminRouter = Router();
adminRouter.use(requireAdminAuth);
adminRouter.use("/products/approve", adminApproveProductRoutes);
adminRouter.use("/products/reject", adminRejectProductRoutes);
adminRouter.use("/products", adminProductsRoutes);
adminRouter.use("/password", adminPasswordRoutes);
adminRouter.use("/vendors", adminVendorsRoutes);
adminRouter.use("/delivery-boys", admindBoyRouter);
adminRouter.use("/orders", adminOrdersRouter);
// ✅ AdminRouter को मुख्य राउटर पर मैप करें
router.use("/admin", adminRouter);


export default router;

