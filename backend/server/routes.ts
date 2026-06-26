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
import { formatPhone } from "./util/phoneFormatter"; // Path check kar lena
import categoryRoutes from "../routes/categoryRoutes";
import authRouter from "../routes/authRoutes";
import homeProductRoutes from "../routes/homeProducts";
const router = Router();

// ✅ Health Check
router.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "API is running" });
});

router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});



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
router.use("/auth", authRouter);
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
router.use(
  "/categories",
  categoryRoutes
);
// ✅ Products
router.use("/products", productsRouter);
router.use("/whatsapp", whatsappRouter);
router.use("/addresses",addressRouter);
// ✅ Delivery Boy
router.use("/delivery", dBoyRouter);
// ✅ Home Layout (Banners, Ads, Unique Sections)
router.use("/layout", layoutRoutes);
router.use("/wallet", walletRoutes); // वॉलेट राउट्स जोड़ें
router.use("/home-products", homeProductRoutes);
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

