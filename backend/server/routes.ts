import { Router, Request, Response } from "express";
import { db } from "./db";
import {
  users,
  userRoleEnum,
  approvalStatusEnum,
  sellersPgTable,
  deliveryBoys,
  orders,
} from "../shared/backend/schema";
import { AuthenticatedRequest } from "./middleware/verifyToken";
import { requireAuth, requireAdminAuth } from "./middleware/authMiddleware";
import { authAdmin } from "./lib/firebaseAdmin";
import { eq,sql,or } from "drizzle-orm";
import { authorize } from "./middleware/authorize";
import { validateRequest } from "./middleware/validation";
// ✅ Sub-route modules
import apiAuthLoginRouter from "./roots/apiAuthLogin";
//import adminApproveProductRoutes from "./roots/admin/approve-product.ts";
//import adminRejectProductRoutes from "./roots/admin/reject-product.ts";
import adminProductsRoutes from "./roots/admin/adminProductsRoutes";
import adminVendorsRoutes from "./roots/admin/vendors";
//import adminPasswordRoutes from "./roots/admin/admin-password.ts";
import sellerRouter from "../routes/sellers/sellerRoutes";
import productsRouter from "../routes/productRoutes";
import cartRouter from "../routes/cartRoutes";
import dBoyRouter from "../routes/dBoyRoutes";
import admindBoyRouter from "./roots/admin/admindBoyRoutes";
import orderConfirmationRouter from "../routes/orderConfirmationRouter";
import userLoginRouter from "../routes/userRoutes";
import orderRoutes from "../routes/orderRoutes";
import { verifyToken } from "./middleware/verifyToken";
import { categories } from "../shared/backend/schema";
import whatsappRouter from '../routes/whatsappRoutes';
import addressRouter from '../routes/addressRoutes';
import adminDiscountsRouter from './roots/admin/adminDiscounts';
//import adminOrdersRouter from "./roots/admin/adminOrderRoutes";
import adminDeliveryAreasRouter from '../routes/adminDeliveryAreasRoutes';
import customerRouter from '../routes/customerRoutes';
import layoutRoutes from '../routes/layoutRoutes'; // Check karein path sahi ho
import { masterProducts } from "../shared/backend/tables";
import adminSettingsRouter from "../routes/adminSettingRoutes";
import walletRoutes from '../routes/walletRoutes';

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
    const { firebaseUid, phone, firstName, lastName } = req.body;

    if (!firebaseUid || !phone) {
      return res.status(400).json({ error: "Firebase UID and Phone are required." });
    }

    const [newUser] = await db.insert(users).values({
      firebaseUid,
      phone,
      firstName: firstName || "User",
      lastName: lastName || "",
      role: "customer", // Default
      isCustomer: true,
      isActive: true,
      approvalStatus: "approved",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.status(201).json(newUser);
  } catch (error: any) {
    console.error("❌ Registration failed:", error);
    res.status(400).json({ error: error.message });
  }
});

router.get("/users/me", verifyToken as any, async (req: any, res: Response) => {
  try {
    const { firebaseUid, phoneNumber, email, name, isNewUser } = req.user;

    // 1. Pehle user dhundo
    let [user] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));

    // 2. Agar user nahi hai (Middleware ne isNewUser flag bheja hai)
    if (!user) {
      console.log(`[AUTH] Auto-registering: ${firebaseUid}`);
      
      const nameParts = (name || "User").split(" ");
      
      const [newUser] = await db.insert(users).values({
        firebaseUid: firebaseUid,
        phone: phoneNumber || null,
        email: email || null,
        firstName: nameParts[0] || "User",
        lastName: nameParts.slice(1).join(" ") || "",
        role: "customer",
        isCustomer: true,
        isActive: true,
        approvalStatus: "approved",
      }).returning();
      
      user = newUser;
    }

    // 3. Virtual role calculation
    const virtualRole = user.isAdmin ? 'admin' : 
                        user.isSeller ? 'seller' : 
                        user.isDelivery ? 'delivery-boy' : 'customer';

    res.status(200).json({ ...user, role: virtualRole });

  } catch (error: any) {
    console.error("❌ Profile Sync Error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get(
  "/:orderId/tracking", // यह URL /api/orders/170/tracking को मैच करेगा
  requireAuth as any, // सुनिश्चित करें कि ग्राहक लॉग इन है
  async (req: any, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { orderId } = authReq.params;
    const customerId = authReq.user?.firebaseUid;

    if (!customerId) {
      return res.status(401).json({ error: "Authentication required." });
    }

    try {
  // 1. Database se order fetch karein
  // Note: Yahan hum [orderData] variable use kar rahe hain taaki 'order' se conflict na ho
  const [orderData] = await db
    .select()
    .from(orders) // Yeh aapke schema se aayi hui table hai
    .where(eq(orders.id, Number(orderId))) // Table name 'orders' yahan fix hai
    .limit(1);

  // Aapne kaha tha variable ka naam 'order' rakhna hai
  // Humne database se aaye data ko 'order' variable mein assign kar diya
  const order = orderData as any; 

  if (!order || order.customerId !== customerId) {
    return res.status(404).json({ error: "Order not found or access denied." });
  }

  // 2. Response bhejye
  res.status(200).json({
    orderId: order.id,
    status: order.status,
    deliveryAddress: order.deliveryAddress,
  });
  
} catch (error) {
  console.error("❌ Tracking fetch failed:", error);
  res.status(500).json({ error: "Internal server error" });
}

});

// 1. ✅ Initial Login: Check if Email exists or needs Phone
// ✅ Simple Login Check (After Firebase Phone OTP)
router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    const { uid, phone_number } = decodedToken;

    // Direct check by UID
    let [user] = await db.select().from(users).where(eq(users.firebaseUid, uid));

    if (!user) {
      return res.status(200).json({ 
        registered: false, 
        firebaseUid: uid, 
        phone: phone_number 
      });
    }

    return res.status(200).json({ registered: true, user });
  } catch (error) {
    res.status(401).json({ message: "Auth failed" });
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
// Bulk Upload API
router.post("/bulk-products", async (req, res) => {
  try {
    const products = req.body; // JSON डेटा जो आप भेजेंगे

    if (!Array.isArray(products)) {
      return res.status(400).json({ 
        error: "Data format galat hai. Hume ek Array chahiye." 
      });
    }

    // Drizzle का इस्तेमाल करके बल्क इंसर्ट (ये SQL से बहुत फ़ास्ट है)
    // ये कोड पुराने को अपडेट करेगा और नए को ऐड करेगा
await db.insert(masterProducts)
  .values(products)
  .onConflictDoUpdate({
    target: masterProducts.masterSku, // अगर SKU मैच कर जाए
    set: { 
      name: sql`EXCLUDED.name`,
      brand: sql`EXCLUDED.brand`,
      unit: sql`EXCLUDED.unit`,
      categoryId: sql`EXCLUDED.category_id`,
      image: sql`EXCLUDED.image`
    }
  });

    return res.status(200).json({ 
      success: true, 
      message: `${products.length} products successfully add ho gaye hain!` 
    });
  } catch (error: any) {
    console.error("Bulk Upload Error:", error);
    // अगर कोई SKU पहले से है, तो ये एरर दिखाएगा
    return res.status(500).json({ error: error.message });
  }
});

// ✅ Routes mapping
router.use("/users", userLoginRouter);
router.use("/auth", apiAuthLoginRouter);
router.use('/customer', customerRouter);
// Seller-specific
router.use("/cart", cartRouter);
router.use("/orders", orderRoutes);
router.use("/order-confirmation", orderConfirmationRouter);
router.use("/sellers", verifyToken as any, sellerRouter);

// ✅ Categories
// ✅ Categories with Related Shops and Products
router.get("/categories", async (req: Request, res: Response) => {
  try {
    // 1. db.query का उपयोग करें जो 'Include' करने की अनुमति देता है
    const categoriesList = await db.query.categories.findMany({
      with: {
        // यहाँ हम दुकानें जोड़ रहे हैं जो इस कैटेगरी से जुड़ी हैं
        shops: true, 
        // यहाँ हम प्रोडक्ट्स जोड़ रहे हैं (होम पेज के लिए सिर्फ 6 काफी हैं)
        products: {
          limit: 6,
        },
      },
    });

    res.status(200).json(categoriesList);
  } catch (error: any) {
    console.error("Error fetching categories with relations:", error);
    res.status(500).json({ error: "Internal error." });
  }
});
// ✅ Products
router.use("/products", productsRouter);
router.use("/whatsapp", whatsappRouter);
router.use("/addresses",addressRouter);
// ✅ Delivery Boy
router.use("/delivery", dBoyRouter);
// ✅ Home Layout (Banners, Ads, Unique Sections)
router.use("/layout", layoutRoutes);
router.use("/wallet", walletRoutes); // वॉलेट राउट्स जोड़ें

// ✅ Admin Routes
router.use("/admin", adminSettingsRouter);
const adminRouter = Router();
adminRouter.use(requireAdminAuth);


adminRouter.use("/products", adminProductsRoutes);

adminRouter.use("/vendors", adminVendorsRoutes);
adminRouter.use("/delivery-boys", admindBoyRouter);
adminRouter.use("/discounts", adminDiscountsRouter);
adminRouter.use("/delivery-areas", adminDeliveryAreasRouter); 
// ✅ AdminRouter को मुख्य राउटर पर मैप करें
router.use("/admin", adminRouter);


export default router;

