import { Router, Response, NextFunction } from 'express';
import { db } from '../../server/db';
import {
  sellersPgTable,
  users,
  userRoleEnum,
  approvalStatusEnum,
  categories,
  products,
  orders,
  orderItems,
  orderStatusEnum,
  // insertSellerSchema, // अगर इसकी अब आवश्यकता नहीं है तो हटा सकते हैं
  updateSellerSchema // इसका उपयोग हम मौजूदा PUT /me में कर रहे हैं
} from '../../shared/backend/schema';
import { requireSellerAuth } from '../../server/middleware/authMiddleware';
import { AuthenticatedRequest, verifyToken } from '../../server/middleware/verifyToken';
import { eq, desc, and, exists } from 'drizzle-orm';
import multer from 'multer';
import { uploadImage } from '../../server/cloudStorage';
import { v4 as uuidv4 } from "uuid";
import { getIO } from "../../server/socket.ts"; // ✅ Socket.IO instance

const sellerRouter = Router();
const upload = multer({ dest: 'uploads/' });

// ✅ POST /api/sellers/apply
sellerRouter.post("/apply", verifyToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const userId = req.user?.id;

    if (!firebaseUid || !userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      businessName,
      businessAddress,
      businessPhone,
      description,
      city,
      pincode,
      gstNumber,
      bankAccountNumber,
      ifscCode,
      // deliveryRadius, // इसे यहाँ से हटा दिया गया है क्योंकि यह apply के बजाय delivery-preferences में सेट होगा
      businessType,
      // यहाँ isDistanceBasedDelivery, latitude, longitude, deliveryPincodes नहीं जोड़ेंगे
    } = req.body;

    if (!businessName || !businessPhone || !city || !pincode || !businessAddress || !businessType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const [existing] = await db
      .select()
      .from(sellersPgTable)
      .where(eq(sellersPgTable.userId, userId));

    if (existing) {
      return res.status(400).json({
        message: "Application already submitted.",
        status: existing.approvalStatus,
      });
    }

    const newSeller = await db
      .insert(sellersPgTable)
      .values({
        userId,
        businessName,
        businessAddress,
        businessPhone,
        description: description || null,
        city,
        pincode,
        gstNumber: gstNumber || null,
        bankAccountNumber: bankAccountNumber || null,
        ifscCode: ifscCode || null,
        // deliveryRadius को यहाँ null रहने दें, यह delivery-preferences में सेट होगा
        deliveryRadius: null, 
        // isDistanceBasedDelivery को default(false) रहने दें
        isDistanceBasedDelivery: false, 
        // latitude, longitude, deliveryPincodes को null/डिफ़ॉल्ट रहने दें
        latitude: null,
        longitude: null,
        deliveryPincodes: [], 
        businessType,
        approvalStatus: approvalStatusEnum.enumValues[0], // pending
        // applicationDate: new Date(), // applicationDate स्कीमा में नहीं है
      })
      .returning();

    const [updatedUser] = await db
      .update(users)
      .set({
        role: userRoleEnum.enumValues[1], // seller
        approvalStatus: approvalStatusEnum.enumValues[0], // pending
      })
      .where(eq(users.id, userId))
      .returning();

    return res.status(201).json({
      message: "Application submitted.",
      seller: newSeller[0],
      user: {
        firebaseUid: updatedUser.firebaseUid,
        role: updatedUser.role,
        email: updatedUser.email,
        // name: updatedUser.name, // users स्कीमा में name फ़ील्ड नहीं है, firstName/lastName का उपयोग करें
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
      },
    });
  } catch (error: any) {
    console.error("❌ Error in POST /api/sellers/apply:", error);
    next(error);
  }
});

// ✅ GET /api/sellers/me
sellerRouter.get('/me', requireSellerAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing user data.' });
    }

    const [sellerProfile] = await db
      .select()
      .from(sellersPgTable)
      .where(eq(sellersPgTable.userId, userId));

    if (!sellerProfile) {
      return res.status(404).json({ error: 'Seller profile not found.' });
    }

    return res.status(200).json(sellerProfile);
  } catch (error: any) {
    console.error('❌ Error in GET /api/sellers/me:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ✅ GET /api/sellers/orders
sellerRouter.get("/orders", requireSellerAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    const [sellerProfile] = await db
      .select()
      .from(sellersPgTable)
      .where(eq(sellersPgTable.userId, userId));

    if (!sellerProfile) {
      return res.status(404).json({ error: "Seller profile not found." });
    }
    const sellerId = sellerProfile.id;

    const sellerOrders = await db.query.orders.findMany({
      where: exists(
        db.select().from(orderItems).where(
          and(
            eq(orderItems.sellerId, sellerId),
            eq(orderItems.orderId, orders.id)
          )
        )
      ),
      with: {
        customer: true,
        deliveryBoy: {
          columns: {
            id: true,
            name: true,
            phone: true,
          }
        },
        items: {
          where: eq(orderItems.sellerId, sellerId),
          with: {
            product: {
              columns: {
                id: true,
                name: true,
                price: true,
                image: true,
                description: true,
              }
            }
          },
        },
      },
      orderBy: desc(orders.createdAt),
    });
    return res.status(200).json(sellerOrders);
  } catch (error: any) {
    console.error("❌ Error in GET /api/sellers/orders:", error);
    return res.status(500).json({ error: "Failed to fetch seller orders." });
  }
});

// ✅ GET /api/sellers/products
sellerRouter.get('/products', requireSellerAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
    if (!sellerProfile) {
      return res.status(404).json({ error: 'Seller profile not found.' });
    }
    const sellerId = sellerProfile.id;

    const sellerProducts = await db.query.products.findMany({
      where: eq(products.sellerId, sellerId),
      with: {
        category: true,
      },
      orderBy: desc(products.createdAt),
    });

    return res.status(200).json(sellerProducts);
  } catch (error: any) {
    console.error('❌ Error in GET /api/sellers/products:', error);
    return res.status(500).json({ error: 'Failed to fetch seller products.' });
  }
});

// ✅ GET /api/sellers/categories (तुम्हारी schema में categories.sellerId नहीं है, यह यहाँ एक संभावित एरर है)
sellerRouter.get('/categories', requireSellerAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
    if (!sellerProfile) {
      return res.status(404).json({ error: 'Seller profile not found.' });
    }
    const sellerId = sellerProfile.id; // sellerId का उपयोग करें, यदि categories में sellerId है

    // ध्यान दें: तुम्हारी 'categories' स्कीमा में 'sellerId' कॉलम नहीं है।
    // यह क्वेरी एरर देगी अगर तुम इसे ऐसे चलाते हो।
    // यदि तुम सेलर द्वारा बनाई गई कैटेगरी चाहते हो, तो तुम्हें 'categories' टेबल में 'sellerId' जोड़ना होगा।
    const sellerCategories = await db.query.categories.findMany({
      // where: eq(categories.sellerId, sellerId), // यह लाइन एरर देगी यदि categories.sellerId मौजूद नहीं है
      orderBy: desc(categories.id), // createdAt की जगह id का उपयोग करें, क्योंकि createdAt नहीं है
    });

    return res.status(200).json(sellerCategories);
  } catch (error: any) {
    console.error('❌ Error in GET /api/sellers/categories:', error);
    return res.status(500).json({ error: 'Failed to fetch seller categories.' });
  }
});

// ✅ POST /api/sellers/products (नया प्रोडक्ट बनाएं)
sellerRouter.post(
  '/products',
  requireSellerAuth,
  upload.single('image'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const firebaseUid = req.user?.firebaseUid;
      const userId = req.user?.id;
      if (!firebaseUid || !userId) {
        return res.status(401).json({ error: 'Unauthorized: User not authenticated.' });
      }

      const [sellerProfile] = await db
        .select()
        .from(sellersPgTable)
        .where(eq(sellersPgTable.userId, userId));

      if (!sellerProfile) {
        return res.status(404).json({ error: 'Seller profile not found. Please complete your seller registration.' });
      }
      const sellerId = sellerProfile.id;

      const { name, description, price, categoryId, stock, unit, brand, minOrderQty, maxOrderQty, estimatedDeliveryTime } = req.body;
      const file = req.file;

      if (!name || !price || !categoryId || !stock || !file) {
        return res.status(400).json({ error: 'Missing required fields or image.' });
      }

      const parsedCategoryId = parseInt(categoryId as string);
      const parsedStock = parseInt(stock as string);
      const parsedPrice = parseFloat(price as string);
      const parsedMinOrderQty = minOrderQty ? parseInt(minOrderQty as string) : undefined;
      const parsedMaxOrderQty = maxOrderQty ? parseInt(maxOrderQty as string) : undefined;

      if (isNaN(parsedCategoryId) || isNaN(parsedStock) || isNaN(parsedPrice)) {
        return res.status(400).json({ error: 'Invalid data provided for categoryId, price, or stock.' });
      }

      const imageUrl = await uploadImage(file.path, file.originalname);

      const newProduct = await db
        .insert(products)
        .values({
          name,
          description,
          price: parsedPrice,
          categoryId: parsedCategoryId,
          stock: parsedStock,
          image: imageUrl,
          sellerId,
          unit: unit || 'piece', // डिफ़ॉल्ट मान
          brand: brand || null,
          minOrderQty: parsedMinOrderQty,
          maxOrderQty: parsedMaxOrderQty,
          estimatedDeliveryTime: estimatedDeliveryTime || '1-2 hours', // डिफ़ॉल्ट मान
          approvalStatus: approvalStatusEnum.enumValues[0], // नया प्रोडक्ट लंबित स्थिति में शुरू होगा
        })
        .returning();

      // ✅ Socket event emit
      getIO().emit("product:created", newProduct[0]);

      return res.status(201).json(newProduct[0]);
    } catch (error: any) {
      console.error('❌ Error in POST /api/sellers/products:', error);
      return res.status(500).json({ error: 'Failed to create product.' });
    }
  }
);

// ✅ PATCH /api/sellers/orders/:orderId/status
sellerRouter.patch("/orders/:orderId/status", requireSellerAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;
    const { newStatus } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    if (!orderId || !newStatus) {
      return res.status(400).json({ error: "Order ID and new status are required." });
    }
    
    // ✅ सत्यापन की जाँच हटा दी गई ताकि कोई भी मान्य स्टेटस अपडेट हो सके
    // const validStatusesForSeller = ['processing', 'ready_for_pickup', 'completed', 'cancelled'];
    // if (!validStatusesForSeller.includes(newStatus)) {
    //   return res.status(400).json({ error: "Invalid status provided." });
    // }

    const parsedOrderId = parseInt(orderId, 10);
    if (isNaN(parsedOrderId)) {
      return res.status(400).json({ error: "Invalid order ID." });
    }

    const orderItemsForSeller = await db
      .select({ sellerId: orderItems.sellerId })
      .from(orderItems)
      .where(eq(orderItems.orderId, parsedOrderId));

    if (orderItemsForSeller.length === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
    if (!sellerProfile) {
        return res.status(404).json({ error: 'Seller profile not found.' });
    }

    const sellerId = sellerProfile.id;
    const isOrderOwnedBySeller = orderItemsForSeller.some(item => item.sellerId === sellerId);

    if (!isOrderOwnedBySeller) {
      return res.status(403).json({ error: "You are not authorized to update this order." });
    }

    const [updatedOrder] = await db
      .update(orders)
      .set({ status: newStatus as typeof orderStatusEnum.enumValues[number] })
      .where(eq(orders.id, parsedOrderId))
      .returning();

    if (!updatedOrder) {
      return res.status(404).json({ error: "Order not found." });
    }

    const fullUpdatedOrder = await db.query.orders.findFirst({
    where: eq(orders.id, parsedOrderId),
    with: {
        customer: true,
        deliveryBoy: {
            columns: {
                id: true,
                name: true,
                phone: true,
            }
        },
        
        items: { columns: { sellerId: true } } 
    }
});
    if (!fullUpdatedOrder) {
        return res.status(404).json({ error: "Order not found after update." });
    }

    // ऑर्डर का सेलर ID ज्ञात करें
    
    const customerId = fullUpdatedOrder.customerId;

    // ✅ Socket event emit - Targeted Messaging
    const io = getIO();

    // 1. सेलर को भेजें: ऑर्डर की पूरी जानकारी
   io.to(`seller:${sellerId}`).emit("order-updated-for-seller", fullUpdatedOrder);

    // 2. एडमिन को भेजें: ऑर्डर की पूरी जानकारी
    io.to('admin').emit("order-updated-for-admin", fullUpdatedOrder);

    // 3. कस्टमर को भेजें: केवल स्टेटस अपडेट
    io.to(`user:${customerId}`).emit("order-status-update", fullUpdatedOrder);


    return res.status(200).json({ message: "Order status updated successfully.", order: fullUpdatedOrder });

    
  } catch (error: any) {
    console.error("❌ Error updating order status:", error);
    return res.status(500).json({ error: "Failed to update order status." });
  }
});


// ✅ PUT Update Seller Profile (updates all fields)
sellerRouter.put('/me', requireSellerAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id; // Authed user ID
    if (!userId) {
      return res.status(403).json({ message: "Seller authentication failed." });
    }

    const [sellerProfile] = await db
        .select()
        .from(sellersPgTable)
        .where(eq(sellersPgTable.userId, userId));

    if (!sellerProfile) {
        return res.status(404).json({ message: "Seller profile not found." });
    }
    const sellerId = sellerProfile.id; // विक्रेता का ID

    const updateData = req.body;

    // Zod Validation: क्लाइंट से प्राप्त डेटा को वैलिडेट करें।
    // हम केवल उन फ़ील्ड्स को चुनेंगे जिन्हें क्लाइंट भेज रहा है।
    const validUpdateData = updateSellerSchema.safeParse(updateData); 

    if (!validUpdateData.success) {
      console.error("❌ Seller update validation error:", validUpdateData.error);
      return res.status(400).json({ 
        message: "Invalid data provided for seller profile update.", 
        errors: validUpdateData.error.flatten().fieldErrors 
      });
    }

    // Drizzle Update Query
    const [updatedSeller] = await db
      .update(sellersPgTable)
      .set({
        ...validUpdateData.data,
        updatedAt: new Date(),
      })
      .where(eq(sellersPgTable.id, sellerId))
      .returning();

    if (!updatedSeller) {
      return res.status(404).json({ message: "Seller profile not found or no changes made." });
    }

    // Admin को सूचित करें
    getIO().emit("admin:update", { type: "seller-profile-update", data: updatedSeller });

    return res.status(200).json(updatedSeller);
  } catch (error: any) {
    console.error("❌ PUT /sellers/me error:", error);
    res.status(500).json({ message: "Failed to update seller profile.", error: error.message });
  }
});

// ✅ नया एंडपॉइंट: PUT /api/sellers/delivery-preferences
sellerRouter.put('/delivery-preferences', requireSellerAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id; // ऑथेंटिकेटेड यूजर का ID
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User not authenticated." });
    }

    const [sellerProfile] = await db
      .select()
      .from(sellersPgTable)
      .where(eq(sellersPgTable.userId, userId));

    if (!sellerProfile) {
      return res.status(404).json({ message: "Seller profile not found." });
    }
    const sellerId = sellerProfile.id; // विक्रेता का ID

    const {
      isDistanceBasedDelivery,
      deliveryRadius,        // यदि isDistanceBasedDelivery true है
      latitude,              // यदि isDistanceBasedDelivery true है
      longitude,             // यदि isDistanceBasedDelivery true है
      deliveryPincodes,      // यदि isDistanceBasedDelivery false है
    } = req.body;

    // ----- डेटा वैलिडेशन -----
    if (typeof isDistanceBasedDelivery !== 'boolean') {
      return res.status(400).json({ message: "isDistanceBasedDelivery must be a boolean." });
    }

    if (isDistanceBasedDelivery) {
      // दूरी-आधारित डिलीवरी के लिए आवश्यक फ़ील्ड्स
      if (deliveryRadius === undefined || typeof deliveryRadius !== 'number' || deliveryRadius <= 0) {
        return res.status(400).json({ message: "deliveryRadius (in km) is required and must be a positive number for distance-based delivery." });
      }
      if (latitude === undefined || typeof latitude !== 'number' || longitude === undefined || typeof longitude !== 'number') {
        return res.status(400).json({ message: "Shop latitude and longitude are required for distance-based delivery." });
      }
      // यदि latitude/longitude मान्य संख्याएं नहीं हैं, तो parseInt/parseFloat उन्हें NaN बना देगा।
      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ message: "Invalid latitude or longitude provided." });
      }
    } else {
      // पिनकोड-आधारित डिलीवरी के लिए आवश्यक फ़ील्ड्स
      if (!Array.isArray(deliveryPincodes) || !deliveryPincodes.every(p => typeof p === 'string' && p.length === 6)) {
        return res.status(400).json({ message: "deliveryPincodes must be an array of 6-digit strings for pincode-based delivery." });
      }
    }
    // ----- एंड वैलिडेशन -----

    const [updatedSeller] = await db
      .update(sellersPgTable)
      .set({
        isDistanceBasedDelivery: isDistanceBasedDelivery,
        // जब दूरी-आधारित हो, तो संबंधित फ़ील्ड सेट करें, अन्यथा null
        deliveryRadius: isDistanceBasedDelivery ? deliveryRadius : null,
        latitude: isDistanceBasedDelivery ? latitude : null,
        longitude: isDistanceBasedDelivery ? longitude : null,
        // जब पिनकोड-आधारित हो, तो संबंधित फ़ील्ड सेट करें, अन्यथा खाली array
        deliveryPincodes: isDistanceBasedDelivery ? [] : deliveryPincodes,
        updatedAt: new Date(),
      })
      .where(eq(sellersPgTable.id, sellerId))
      .returning();

    if (!updatedSeller) {
      return res.status(404).json({ message: "Seller profile not found or no changes made." });
    }

    getIO().emit("admin:update", { type: "seller-delivery-preferences-update", data: updatedSeller });

    return res.status(200).json({ message: "Delivery preferences updated successfully.", seller: updatedSeller });

  } catch (error: any) {
    console.error("❌ PUT /api/sellers/delivery-preferences error:", error);
    res.status(500).json({ message: "Failed to update delivery preferences.", error: error.message });
  }
});


export default sellerRouter;
