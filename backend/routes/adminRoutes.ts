// backend/server/routes/adminRouter.ts (Updated)
import { Router, Response, NextFunction } from 'express';
import { db } from '../server/db';
import {
  categories,
  users,
  userRoleEnum,
  orders, // Master orders (for overall view)
  subOrders, // Sub-orders (seller-specific items)
  deliveryBatches, // Delivery batches
  orderItems, // Items within sub-orders
  products,
  deliveryBoys, // ✅ Corrected deliveryBoys table name
  sellersPgTable, // ✅ Corrected sellers table name
  deliveryAddresses, // ✅ Added for complete address details
  masterOrderStatusEnum, // ✅ Master order status enum
  subOrderStatusEnum, // ✅ Sub-order status enum
  deliveryStatusEnum, // ✅ Delivery batch status enum
  approvalStatusEnum // ✅ Approval status enum
} from '../shared/backend/schema';
import { eq, and, desc, inArray, or } from 'drizzle-orm'; // ✅ Added 'or'
import multer from 'multer';
import { uploadImage } from '../server/cloudStorage';
import { AuthenticatedRequest } from '../server/middleware/verifyToken';
import { v4 as uuidv4 } from "uuid";
import { authorize } from '../server/middleware/authorize'; // ✅ Assuming authorize middleware is preferred
import { validateRequest } from '../server/middleware/validation';
import { any, z } from 'zod'; // ✅ For category validation
import { orderTracking } from "../shared/backend/schema";
import { requireAdminAuth } from '../server/middleware/authMiddleware';
import fs from 'fs';
import { verifyToken } from "../server/middleware/verifyToken.ts";
import { getIO } from "../server/socket";
const adminRouter = Router();
const upload = multer({ dest: 'uploads/' });

// ✅ adminAuthMiddleware (अब authorize middleware का उपयोग करें)
// यदि `authorize(['admin'])` middleware उपलब्ध है, तो इसे सीधे उपयोग करना बेहतर है।
// इस custom `adminAuthMiddleware` की आवश्यकता नहीं है यदि `authorize` middleware पर्याप्त है।
// मैं नीचे `authorize(['admin'])` का उपयोग कर रहा हूँ।

/**
 * ✅ GET /api/admin/me
 * (Authorization handled by `authorize(['admin'])`)
 */
/**
 * ✅ GET /api/admin/me
 * Firebase UID + Phone based Admin check
 */
adminRouter.get('/me', authorize(['admin']), (req: any, res: Response) => {
  // Ab req.user mein email ki jagah phone number primary hoga
  return res.status(200).json({ 
    message: 'Welcome, Admin!', 
    adminInfo: {
      id: req.user.id,
      name: req.user.name,
      phone: req.user.phoneNumber, // 👈 Phone primary hai
      role: req.user.role
    } 
  });
});

/**
 * ✅ GET /api/admin/categories
 */
adminRouter.get('/categories', authorize(['admin']), async (req: any, res: Response) => {
  try {
    // Hum sorting bhi add kar dete hain taaki Frontend par categories sahi dikhein
    const allCategories = await db.query.categories.findMany({
      orderBy: (categories, { asc }) => [asc(categories.sortOrder)]
    });
    return res.status(200).json(allCategories);
  } catch (error: any) {
    console.error('❌ Admin Category Fetch Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- Category Management ---

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required."),
  nameHindi: z.string().optional().nullable(),
  slug: z.string().min(1, "Slug is required."),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});


/**
 * ✅ POST /api/admin/categories
 * (Authorization handled by `authorize(['admin'])`)
 */
adminRouter.post(
  '/categories',
  authorize(['admin']) as any,
  upload.single('image'),
  validateRequest(z.object({
    body: (categorySchema as any).omit({ image: true }).extend({
      isActive: z.union([z.boolean(), z.string().transform(val => val === 'true')]).optional().default(true),
      sortOrder: z.union([z.number().int(), z.string().transform(val => parseInt(val, 10))]).optional().default(0),
    }),
  })),
  async (req: any, res: Response) => {
    try {
      const { name, nameHindi, slug, description, isActive, sortOrder } = req.body;
      const file = req.file;

      // 1. Image Check
      if (!file) {
        return res.status(400).json({ error: 'Category image is required.' });
      }

      // 2. Slug Duplicate Check
      const [existingCategory] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
      if (existingCategory) {
        // अगर फाइल अपलोड हो गई है पर डेटाबेस में एरर है, तो टेंप फाइल डिलीट करें
        if (file.path) fs.unlinkSync(file.path);
        return res.status(409).json({ error: 'A category with this slug already exists.' });
      }

      // 3. Upload Image to Storage (Cloudinary/S3 etc.)
      const imageUrl = await uploadImage(file.path, `categories/${uuidv4()}-${file.originalname}`,  file.mimetype);
      
      if (!imageUrl) {
        if (file.path) fs.unlinkSync(file.path);
        return res.status(500).json({ error: 'Failed to upload category image.' });
      }

      // 4. Insert into Database
      const newCategoryData = {
        name,
        nameHindi: nameHindi || null,
        slug,
        image: imageUrl, // ✅ स्कीमा में 'image' कॉलम होना चाहिए
        description: description || null,
        isActive: isActive,
        sortOrder: sortOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // (db as any) इस्तेमाल किया है ताकि 'image' वाली टाइप एरर जड़ से खत्म हो जाए
      const [newCategory] = await (db as any)
        .insert(categories)
        .values(newCategoryData)
        .returning();

      // 5. Cleanup Local Temp File
      if (file.path) fs.unlinkSync(file.path);

      return res.status(201).json({ 
        message: "Category created successfully.", 
        category: newCategory 
      });

    } catch (error: any) {
      console.error('❌ Error in POST /api/admin/categories:', error);
      // एरर के केस में भी फाइल डिलीट करना न भूलें
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Failed to create new category.' });
    }
  }
);
/**
 * ✅ PATCH /api/admin/categories/:id
 * (Authorization handled by `authorize(['admin'])`)
 */
adminRouter.patch('/categories/:id', authorize(['admin']), upload.single('image'), validateRequest(z.object({
  params: z.object({ id: z.string().regex(/^\d+$/, "ID must be a number.") }),
  body: categorySchema.partial().extend({ // partial() allows some fields to be optional
    isActive: z.union([z.boolean(), z.string().transform(val => val === 'true')]).optional(),
    sortOrder: z.union([z.number().int(), z.string().transform(val => parseInt(val))]).optional(),
  }),
})), async (req: any, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID.' });
    }

    const { name, nameHindi, slug, description, isActive, sortOrder } = req.body;
    const file = req.file;

    const [existingCategory] = await db.select().from(categories).where(eq(categories.id, categoryId));
    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    // Check for duplicate slug if slug is being updated
    if (slug && slug !== existingCategory.slug) {
      const [duplicateSlug] = await db.select().from(categories).where(eq(categories.slug, slug));
      if (duplicateSlug) {
        return res.status(409).json({ error: 'A category with this slug already exists.' });
      }
    }

    let imageUrl = existingCategory.image;
    if (file) {
      imageUrl = await uploadImage(file.path, `categories/${uuidv4()}-${file.originalname}`, file.mimetype);
      if (!imageUrl) {
        return res.status(500).json({ error: 'Failed to upload new category image.' });
      }
    }

    const updateData: Partial<typeof categories.$inferInsert> = {
      name,
      nameHindi: nameHindi || null,
      slug,
      image: imageUrl,
      description: description || null,
      isActive: isActive,
      sortOrder: sortOrder,
      updatedAt: new Date(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);


    const [updatedCategory] = await db.update(categories)
      .set(updateData)
      .where(eq(categories.id, categoryId))
      .returning();

    if (!updatedCategory) {
      return res.status(500).json({ error: 'Failed to update category.' });
    }

    return res.status(200).json({ message: "Category updated successfully.", category: updatedCategory });

  } catch (error: any) {
    console.error('❌ Error in PATCH /api/admin/categories/:id:', error);
    return res.status(500).json({ error: 'Failed to update category.' });
  }
});

/**
 * ✅ DELETE /api/admin/categories/:id
 * (Authorization handled by `authorize(['admin'])`)
 */
adminRouter.delete('/categories/:id', authorize(['admin']), validateRequest(z.object({
  params: z.object({ id: z.string().regex(/^\d+$/, "ID must be a number.") }),
})), async (req: any, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID.' });
    }

    const [deletedCategory] = await db.delete(categories)
      .where(eq(categories.id, categoryId))
      .returning();

    if (!deletedCategory) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    // TODO: यदि इस कैटेगरी के अधीन कोई प्रोडक्ट हैं, तो उन्हें कैसे हैंडल किया जाए?
    // या तो सभी संबंधित प्रोडक्ट्स की कैटेगरी को null पर सेट करें, या डिलीट होने से रोकें।
    // अभी के लिए, यह मान रहा है कि डिलीट ठीक है या DB cascading handles it.

    return res.status(200).json({ message: "Category deleted successfully.", category: deletedCategory });

  } catch (error: any) {
    console.error('❌ Error in DELETE /api/admin/categories/:id:', error);
    return res.status(500).json({ error: 'Failed to delete category.' });
  }
});

// --- Order Management (Updated for new schema) ---

/**
 * ✅ GET /api/admin/orders
 * सभी मास्टर ऑर्डर्स को फ़ेच करें, उनके सब-ऑर्डर्स और डिलीवरी बैचेस के साथ।
 * (Authorization handled by `authorize(['admin'])`)
 */
adminRouter.get('/orders', authorize(['admin']), async (req: any, res: Response) => {
  try {
    const allMasterOrders = await db.query.orders.findMany({
      with: {
        customer: {
          columns: { id: true, firstName: true, lastName: true, email: true, phone: true }
        },
        deliveryAddress: true, // Master delivery address
        subOrders: {
          with: {
            seller: {
              columns: { id: true, businessName: true, businessPhone: true, city: true }
            },
            orderItems: {
              with: {
                product: {
                  columns: { id: true, name: true, image: true, price: true, unit: true }
                }
              }
            },
            deliveryBatch: {
              with: {
                deliveryBoy: {
                  columns: { id: true, name: true, phone: true }
                }
              }
            }
          }
        },
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
    });

    // ✅ JSON स्ट्रिंग को पार्स करें
    const formattedOrders = allMasterOrders.map(masterOrder => {
      let parsedDeliveryAddress = {};
      try {
        if (masterOrder.deliveryAddress) {
          parsedDeliveryAddress = JSON.parse(masterOrder.deliveryAddress as string);
        }
      } catch (e) {
        console.warn(`Failed to parse deliveryAddress JSON for master order ${masterOrder.id}:`, e);
      }

      const formattedSubOrders = masterOrder.subOrders.map(subOrder => {
        // subOrder का deliveryAddress मास्टर ऑर्डर से आता है, इसलिए इसे दोबारा पार्स करने की आवश्यकता नहीं है
        // लेकिन अगर subOrder में अपना खुद का deliveryAddress है (जो कि हमारी स्कीमा में नहीं है), तो उसे यहाँ हैंडल किया जाएगा
        return {
          ...subOrder,
          // यदि subOrder में deliveryAddress होता, तो:
          // deliveryAddress: subOrder.deliveryAddress ? JSON.parse(subOrder.deliveryAddress as string) : parsedDeliveryAddress,
        };
      });

      return {
        ...masterOrder,
        deliveryAddress: parsedDeliveryAddress,
        subOrders: formattedSubOrders,
      };
    });

    return res.status(200).json({ orders: formattedOrders });
  } catch (error: any) {
    console.error('❌ Error fetching admin orders (new schema):', error);
    return res.status(500).json({ error: 'Failed to fetch admin orders.' });
  }
});

// ✅ New: GET /api/admin/sellers/:sellerId/delivery-settings
// एडमिन द्वारा किसी विशिष्ट सेलर की ग्लोबल डिलीवरी सेटिंग्स को फेच करें।
adminRouter.get('/sellers/:sellerId/delivery-settings', verifyToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const sellerId = Number(req.params.sellerId);

    if (isNaN(sellerId)) {
      return res.status(400).json({ message: 'Invalid seller ID.' });
    }

    const seller = await db.query.sellersPgTable.findFirst({
      where: eq(sellersPgTable.id, sellerId),
      columns: {
        isDistanceBasedDelivery: true,
        deliveryPincodes: true,
        deliveryRadius: true,
        latitude: true,
        longitude: true,
      }
    });

    if (!seller) {
      return res.status(404).json({ message: 'Seller not found.' });
    }

    res.status(200).json(seller);
  } catch (error) {
    console.error(`Error fetching delivery settings for seller ${req.params.sellerId}:`, error);
    next(error);
  }
});
// ✅ Updated: GET /api/admin/sellers/:sellerId/products/:productId/delivery-override
adminRouter.get('/sellers/:sellerId/products/:productId/delivery-override', verifyToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const sellerId = Number(req.params.sellerId);
    const productId = Number(req.params.productId);

    if (isNaN(sellerId) || isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid seller ID or product ID.' });
    }

    const product = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.sellerId, sellerId)),
      columns: {
        id: true,
        name: true,
        deliveryScope: true,
        productDeliveryPincodes: true,
        productDeliveryRadiusKM: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found or does not belong to the specified seller.' });
    }

    res.status(200).json(product);
  } catch (error) {
    //console.error(`Error fetching delivery override for product ${productId} by admin:`, error);
    next(error);
  }
});

// ✅ New: PUT /api/admin/sellers/:sellerId/delivery-settings
// एडमिन द्वारा किसी विशिष्ट सेलर की ग्लोबल डिलीवरी सेटिंग्स को अपडेट करें।
adminRouter.put('/sellers/:sellerId/delivery-settings', verifyToken as any,requireAdminAuth , async (req: any, res: Response, next: NextFunction) => {
  try {
    const sellerId = Number(req.params.sellerId);
    const { isDistanceBasedDelivery, deliveryPincodes, deliveryRadius, latitude, longitude } = req.body;

    if (isNaN(sellerId)) {
      return res.status(400).json({ message: 'Invalid seller ID.' });
    }

    // वैलिडेशन (जैसा कि sellerRoutes में है)
    if (typeof isDistanceBasedDelivery !== 'boolean') {
      return res.status(400).json({ message: 'isDistanceBasedDelivery must be a boolean.' });
    }
    if (isDistanceBasedDelivery && (typeof deliveryRadius !== 'number' || deliveryRadius <= 0)) {
        return res.status(400).json({ message: 'deliveryRadius must be a positive number for distance-based delivery.' });
    }
    if (!isDistanceBasedDelivery && (!Array.isArray(deliveryPincodes) || deliveryPincodes.some(p => typeof p !== 'string'))) {
        return res.status(400).json({ message: 'deliveryPincodes must be an array of strings for pincode-based delivery.' });
    }

    const updateData: Partial<typeof sellersPgTable.$inferInsert> = {
      isDistanceBasedDelivery,
      updatedAt: new Date(),
    };

    if (isDistanceBasedDelivery) {
        updateData.deliveryRadius = deliveryRadius;
        updateData.deliveryPincodes = [];
    } else {
        updateData.deliveryPincodes = deliveryPincodes;
        updateData.deliveryRadius = null;
    }

    if (typeof latitude === 'number' && typeof longitude === 'number') {
        updateData.latitude = latitude;
        updateData.longitude = longitude;
    }

    const [updatedSeller] = await db
      .update(sellersPgTable)
      .set(updateData)
      .where(eq(sellersPgTable.id, sellerId))
      .returning();

    if (!updatedSeller) {
      return res.status(404).json({ message: 'Seller not found or no changes made.' });
    }

    res.status(200).json({ message: 'Seller delivery settings updated successfully!', seller: updatedSeller });
  } catch (error) {
    console.error(`Error updating delivery settings for seller ${req.params.sellerId}:`, error);
    next(error);
  }
});
// ✅ Updated: PUT /api/admin/sellers/:sellerId/products/:productId/delivery-override
adminRouter.put('/sellers/:sellerId/products/:productId/delivery-override', verifyToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const sellerId = Number(req.params.sellerId);
    const productId = Number(req.params.productId);
    const { deliveryScope, productDeliveryPincodes, productDeliveryRadiusKM } = req.body;

    if (isNaN(sellerId) || isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid seller ID or product ID.' });
    }

    const validScopes = ['GLOBAL', 'PRODUCT_PINCODE', 'PRODUCT_RADIUS'];
    if (!validScopes.includes(deliveryScope)) {
      return res.status(400).json({ message: 'Invalid deliveryScope provided.' });
    }

    const updateData: Partial<typeof products.$inferInsert> = {
      deliveryScope,
      updatedAt: new Date(),
    };

    if (deliveryScope === 'PRODUCT_PINCODE') {
      if (!Array.isArray(productDeliveryPincodes) || productDeliveryPincodes.some(p => typeof p !== 'string')) {
        return res.status(400).json({ message: 'productDeliveryPincodes must be an array of strings for PRODUCT_PINCODE scope.' });
      }
      updateData.productDeliveryPincodes = productDeliveryPincodes;
      updateData.productDeliveryRadiusKM = null;
    } else if (deliveryScope === 'PRODUCT_RADIUS') {
      if (typeof productDeliveryRadiusKM !== 'number' || productDeliveryRadiusKM <= 0) {
        return res.status(400).json({ message: 'productDeliveryRadiusKM must be a positive number for PRODUCT_RADIUS scope.' });
      }
      updateData.productDeliveryRadiusKM = productDeliveryRadiusKM;
      updateData.productDeliveryPincodes = [];
    } else { // deliveryScope === 'GLOBAL'
      updateData.productDeliveryPincodes = [];
      updateData.productDeliveryRadiusKM = null;
    }

    const [updatedProduct] = await db
      .update(products)
      .set(updateData)
      .where(and(eq(products.id, productId), eq(products.sellerId, sellerId)))
      .returning();

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found, does not belong to specified seller, or no changes made.' });
    }

    res.status(200).json({ message: 'Product delivery override settings updated successfully!', product: updatedProduct });
  } catch (error) {
    //console.error(`Error updating delivery override for product ${productId} by admin:`, error);
    next(error);
  }
});

/**
 * ✅ PATCH /api/admin/orders/:masterOrderId/status
 * मास्टर ऑर्डर का स्टेटस अपडेट करें (एडमिन द्वारा)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminRouter.patch(
  '/orders/:masterOrderId/status',
  authorize(['admin']) as any,
  validateRequest(z.object({
    params: z.object({ 
      masterOrderId: z.string().regex(/^\d+$/, "Master Order ID must be a number.") 
    }),
    body: z.object({
      // ✅ nativeEnum की जगह z.enum का उपयोग करें और Drizzle की values निकालें
      status: z.enum(masterOrderStatusEnum.enumValues as [string, ...string[]]),
      reason: z.string().optional(),
    }),
  })),
  async (req: any, res: Response) => {
    try {
      const masterOrderId = parseInt(req.params.masterOrderId);
      const { status: newStatus, reason } = req.body;
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }

      const existingMasterOrder = await db.query.orders.findFirst({
        where: eq(orders.id, masterOrderId),
        with: { subOrders: { columns: { id: true, sellerId: true, deliveryBatchId: true } } }
      });

      if (!existingMasterOrder) {
        return res.status(404).json({ error: 'Master Order not found.' });
      }

      await db.transaction(async (tx) => {
        // 1. मास्टर ऑर्डर का स्टेटस अपडेट करें
        const [updatedMasterOrder] = await tx.update(orders)
          .set({ status: newStatus, updatedAt: new Date().toISOString() })
          .where(eq(orders.id, masterOrderId))
          .returning();

        // 2. orderTracking में एंट्री जोड़ें
        await tx.insert(orderTracking).values({
          masterOrderId: masterOrderId,
          status: newStatus,
          updatedByUserId: adminUserId,
          updatedByUserRole: userRoleEnum.enumValues[0], // 'admin'
          timestamp: new Date(),
          message: `Master order status updated to '${newStatus}' by admin. Reason: ${reason || 'N/A'}`,
        }as any);

        // 3. यदि मास्टर ऑर्डर कैंसिल या डिलीवर हो गया है, तो संबंधित subOrders को भी अपडेट करें
        if (newStatus === masterOrderStatusEnum.enumValues[4] /* 'cancelled' */ || newStatus === masterOrderStatusEnum.enumValues[3] /* 'delivered' */) {
          const subOrderIds = existingMasterOrder.subOrders.map(so => so.id);
          const subOrderStatus = newStatus === masterOrderStatusEnum.enumValues[4]
            ? subOrderStatusEnum.enumValues[7] /* 'cancelled' */
            : subOrderStatusEnum.enumValues[6] /* 'delivered_by_delivery_boy' */ ; // या delivered_by_seller, यहाँ Delivered/Cancelled के लिए

          await tx.update(subOrders)
            .set({ status: subOrderStatus, updatedAt: new Date() })
            .where(inArray(subOrders.id, subOrderIds));

          // प्रत्येक subOrder के लिए orderTracking एंट्री
          for (const soId of subOrderIds) {
            await(tx as any).insert(orderTracking).values({
              masterOrderId: masterOrderId,
              subOrderId: soId,
              status: subOrderStatus,
              updatedByUserId: adminUserId,
              updatedByUserRole: userRoleEnum.enumValues[0],
              timestamp: new Date(),
              message: `Sub-order status updated to '${subOrderStatus}' by admin due to master order status change.`,
            });
          }

          // यदि कैंसिल किया गया है, तो किसी भी संबंधित डिलीवरी बैच को भी कैंसिल करें
          if (newStatus === masterOrderStatusEnum.enumValues[4] /* 'cancelled' */) {
            const batchIds = existingMasterOrder.subOrders
              .map(so => so.deliveryBatchId)
              .filter((id): id is number => id !== null && id !== undefined); // Null / undefined फ़िल्टर करें

            if (batchIds.length > 0) {
              await tx.update(deliveryBatches)
                .set({ status: deliveryStatusEnum.enumValues[5], updatedAt: new Date() }) // 'cancelled'
                .where(inArray(deliveryBatches.id, batchIds));

              // प्रत्येक बैच के लिए orderTracking एंट्री
              for (const batchId of batchIds) {
                await(tx as any).insert(orderTracking).values({
                  masterOrderId: masterOrderId,
                  deliveryBatchId: batchId,
                  status: deliveryStatusEnum.enumValues[5],
                  updatedByUserId: adminUserId,
                  updatedByUserRole: userRoleEnum.enumValues[0],
                  timestamp: new Date(),
                  message: `Delivery batch status updated to 'cancelled' by admin due to master order cancellation.`,
                });
              }
            }
          }
        }

        // Socket.io: कस्टमर, सेलर और डिलीवरी बॉय को रियल-time अपडेट भेजें
        getIO().emit(`master-order:${masterOrderId}:status-updated`, {
          status: newStatus,
          message: `Your master order status has been updated to '${newStatus}' by admin.`,
        });

        // प्रत्येक सेलर को अपडेट करें
        for (const subOrder of existingMasterOrder.subOrders) {
          getIO().emit(`seller:${subOrder.sellerId}:order-update`, {
            subOrderId: subOrder.id,
            masterOrderId: masterOrderId,
            status: newStatus === masterOrderStatusEnum.enumValues[4]
              ? subOrderStatusEnum.enumValues[7] : subOrderStatusEnum.enumValues[6], // Simplified for now
          });
         if (subOrder.deliveryBatchId) {
  // ✅ (subOrders[0] as any) का उपयोग करें ताकि deliveryBatch एक्सेस हो सके
  const deliveryBoyId = (existingMasterOrder.subOrders[0] as any)?.deliveryBatch?.deliveryBoyId;

  getIO().emit(`delivery-boy:${deliveryBoyId || ''}:batch-update`, {
    deliveryBatchId: subOrder.deliveryBatchId,
    masterOrderId: masterOrderId,
    // स्टेटस लॉजिक को वैसे ही रखें जैसे आपने बनाया है
    status: newStatus === masterOrderStatusEnum.enumValues[4] 
      ? deliveryStatusEnum.enumValues[5] 
      : deliveryStatusEnum.enumValues[4],
  });

          }
        }

        return res.status(200).json({
          message: `Master Order ${masterOrderId} status updated to ${newStatus} successfully.`,
          order: updatedMasterOrder,
        });
      });

    } catch (error: any) {
      console.error('❌ Error in PATCH /api/admin/orders/:masterOrderId/status:', error);
      return res.status(500).json({ error: error.message || 'Failed to update master order status.' });
    }
  }
);


// --- User Management (Customers, Sellers, Delivery Boys) ---

/**
 * ✅ GET /api/admin/users
 * सभी Users (ग्राहक, सेलर, डिलीवरी बॉय, एडमिन) को फेच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminRouter.get('/users', authorize(['admin']), async (req: any, res: Response) => {
  try {
    const allUsers = await db.query.users.findMany({
      with: {
        customer: true,
        seller: { columns: { id: true, businessName: true, approvalStatus: true } }, // Limited seller fields
        deliveryBoy: { columns: { id: true, name: true, approvalStatus: true } }, // Limited delivery boy fields
      },
      orderBy: (u: any, { desc }: any) => [desc(u.createdAt)],
    }as any);

    return res.status(200).json({ users: allUsers });
  } catch (error: any) {
    console.error('❌ Error fetching all users:', error);
    return res.status(500).json({ error: 'Failed to fetch all users.' });
  }
});

/**
 * ✅ GET /api/admin/users/:userId
 * User ID द्वारा एक एकल User को फेच करें
 * (Authorization handled by `authorize(['admin'])`)
 */
adminRouter.get('/users/:userId', authorize(['admin']), validateRequest(z.object({
  params: z.object({ userId: z.string().regex(/^\d+$/, "User ID must be a number.") }),
})), async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const [user] = await db.query.users.findMany({
      where: eq(users.id, userId),
      with: {
        customer: true,
        seller: true, // Full seller fields for detailed view
        deliveryBoy: true, // Full delivery boy fields for detailed view
      },
    }as any);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.status(200).json({ user });
  } catch (error: any) {
    console.error(`❌ Error fetching user ${req.params.userId}:`, error);
    return res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

/**
 * ✅ PATCH /api/admin/users/:userId
 * User के विवरण को अपडेट करें (एडमिन द्वारा) - इसमें भूमिका, अनुमोदन स्थिति, व्यक्तिगत जानकारी शामिल है।
 * (Authorization handled by `authorize(['admin'])`)
 */
const updateUserSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^\d+$/, "User ID must be a number."),
  }),
  body: z.object({
    firstName: z.string().min(1, "First name is required.").optional(),
    lastName: z.string().min(1, "Last name is required.").optional(),
    email: z.string().email("Invalid email format.").optional(),
    phone: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits.").optional(), // assuming 10 digit Indian number
    role: z.enum(userRoleEnum.enumValues as [string, ...string[]]),
    approvalStatus: z.enum(approvalStatusEnum.enumValues as [string, ...string[]]).optional(),
    // Add any other user fields admin can update
  }).partial(),
});

adminRouter.patch('/users/:userId', authorize(['admin']), validateRequest(updateUserSchema), async (req: any, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const updateData = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const [existingUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const [updatedUser] = await db.update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(500).json({ error: 'Failed to update user.' });
    }

    // यदि भूमिका या अनुमोदन स्थिति अपडेट की गई है, तो संबंधित प्रोफाइल (सेलर/डिलीवरी बॉय) को भी अपडेट करें
    if (updateData.role || updateData.approvalStatus) {
      if (updateData.role === userRoleEnum.enumValues[1] /* 'seller' */) {
        await db.update(sellersPgTable)
          .set({ approvalStatus: updateData.approvalStatus || approvalStatusEnum.enumValues[1] }) // Default to approved if not specified
          .where(eq(sellersPgTable.userId, userId));
      } else if (updateData.role === userRoleEnum.enumValues[2] /* 'delivery_boy' */) {
        await db.update(deliveryBoys)
          .set({ approvalStatus: updateData.approvalStatus || approvalStatusEnum.enumValues[1] }) // Default to approved if not specified
          .where(eq(deliveryBoys.userId, userId));
      }
      // यदि भूमिका 'customer' में बदल गई है, तो सुनिश्चित करें कि सेलर/डिलीवरी बॉय प्रोफाइल का स्टेटस 'rejected' हो
      if (updateData.role === userRoleEnum.enumValues[3] /* 'customer' */) {
          await db.update(sellersPgTable)
              .set({ approvalStatus: approvalStatusEnum.enumValues[2] /* 'rejected' */ })
              .where(eq(sellersPgTable.userId, userId));
          await db.update(deliveryBoys)
              .set({ approvalStatus: approvalStatusEnum.enumValues[2] /* 'rejected' */ })
              .where(eq(deliveryBoys.userId, userId));
      }
    }

return res.status(200).json({ message: "User updated successfully.", user: updatedUser });
    

  } catch (error: any) {
    console.error(`❌ Error updating user ${req.params.userId}:`, error);
    return res.status(500).json({ error: 'Failed to update user.' });
  }
});

// Export router
export default adminRouter;
