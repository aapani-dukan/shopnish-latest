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
import { z } from 'zod'; // ✅ For category validation
import { orderTracking } from "../shared/backend/schema";
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
adminRouter.get('/me', authorize(['admin']), (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({ message: 'Welcome, Admin!', user: req.user });
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
 * ✅ GET /api/admin/categories
 * (Authorization handled by `authorize(['admin'])`)
 */
adminRouter.get('/categories', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allCategories = await db.query.categories.findMany();
    return res.status(200).json(allCategories);
  } catch (error: any) {
    console.error('❌ Error fetching categories:', error);
    return res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

/**
 * ✅ POST /api/admin/categories
 * (Authorization handled by `authorize(['admin'])`)
 */
adminRouter.post('/categories', authorize(['admin']), upload.single('image'), validateRequest(z.object({
  body: categorySchema.omit({ image: true }).extend({
    isActive: z.union([z.boolean(), z.string().transform(val => val === 'true')]).optional().default(true),
    sortOrder: z.union([z.number().int(), z.string().transform(val => parseInt(val))]).optional().default(0),
  }),
})), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, nameHindi, slug, description, isActive, sortOrder } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Category image is required.' });
    }

    const [existingCategory] = await db.select().from(categories).where(eq(categories.slug, slug));
    if (existingCategory) {
      return res.status(409).json({ error: 'A category with this slug already exists.' });
    }

    const imageUrl = await uploadImage(file.path, `categories/${uuidv4()}-${file.originalname}`); // ✅ Better image path
    if (!imageUrl) {
      return res.status(500).json({ error: 'Failed to upload category image.' });
    }

    const newCategoryData = {
      name,
      nameHindi: nameHindi || null,
      slug,
      image: imageUrl,
      description: description || null,
      isActive: isActive,
      sortOrder: sortOrder,
    };

    const newCategory = await db.insert(categories).values(newCategoryData).returning();

    return res.status(201).json({ message: "Category created successfully.", category: newCategory[0] });

  } catch (error: any) {
    console.error('❌ Error in POST /api/admin/categories:', error);
    return res.status(500).json({ error: 'Failed to create new category.' });
  }
});

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
})), async (req: AuthenticatedRequest, res: Response) => {
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
      imageUrl = await uploadImage(file.path, `categories/${uuidv4()}-${file.originalname}`);
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
})), async (req: AuthenticatedRequest, res: Response) => {
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
adminRouter.get('/orders', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
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

/**
 * ✅ PATCH /api/admin/orders/:masterOrderId/status
 * मास्टर ऑर्डर का स्टेटस अपडेट करें (एडमिन द्वारा)
 * (Authorization handled by `authorize(['admin'])`)
 */
adminRouter.patch(
  '/orders/:masterOrderId/status',
  authorize(['admin']),
  validateRequest(z.object({
    params: z.object({ masterOrderId: z.string().regex(/^\d+$/, "Master Order ID must be a number.") }),
    body: z.object({
      status: z.nativeEnum(masterOrderStatusEnum),
      reason: z.string().optional(), // कैंसिलेशन जैसे स्टेटस के लिए
    }),
  })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const masterOrderId = parseInt(req.params.masterOrderId);
      const { status: newStatus, reason } = req.body;
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }

      const [existingMasterOrder] = await db.query.orders.findFirst({
        where: eq(orders.id, masterOrderId),
        with: { subOrders: { columns: { id: true, sellerId: true, deliveryBatchId: true } } }
      });

      if (!existingMasterOrder) {
        return res.status(404).json({ error: 'Master Order not found.' });
      }

      await db.transaction(async (tx) => {
        // 1. मास्टर ऑर्डर का स्टेटस अपडेट करें
        const [updatedMasterOrder] = await tx.update(orders)
          .set({ status: newStatus, updatedAt: new Date() })
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
        });

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
            await tx.insert(orderTracking).values({
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
                await tx.insert(orderTracking).values({
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
            getIO().emit(`delivery-boy:${existingMasterOrder.subOrders[0]?.deliveryBatch?.deliveryBoyId || ''}:batch-update`, {
              deliveryBatchId: subOrder.deliveryBatchId,
              masterOrderId: masterOrderId,
              status: newStatus === masterOrderStatusEnum.enumValues[4] ? deliveryStatusEnum.enumValues[5] : deliveryStatusEnum.enumValues[4], // Simplified
            });
          }
        }

        return res.status(200).json({
          message: `Master Order ${masterOrderId} status updated to ${newStatus} successfully.`,
          order: updatedMasterOrder[0],
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
adminRouter.get('/users', authorize(['admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allUsers = await db.query.users.findMany({
      with: {
        customer: true,
        seller: { columns: { id: true, businessName: true, approvalStatus: true } }, // Limited seller fields
        deliveryBoy: { columns: { id: true, name: true, approvalStatus: true } }, // Limited delivery boy fields
      },
      orderBy: (u, { desc }) => [desc(u.createdAt)],
    });

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
})), async (req: AuthenticatedRequest, res: Response) => {
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
    });

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
    role: z.nativeEnum(userRoleEnum).optional(),
    approvalStatus: z.nativeEnum(approvalStatusEnum).optional(),
    // Add any other user fields admin can update
  }).partial(),
});

adminRouter.patch('/users/:userId', authorize(['admin']), validateRequest(updateUserSchema), async (req: AuthenticatedRequest, res: Response) => {
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
        await db.update(deliveryBoysPgTable)
          .set({ approvalStatus: updateData.approvalStatus || approvalStatusEnum.enumValues[1] }) // Default to approved if not specified
          .where(eq(deliveryBoysPgTable.userId, userId));
      }
      // यदि भूमिका 'customer' में बदल गई है, तो सुनिश्चित करें कि सेलर/डिलीवरी बॉय प्रोफाइल का स्टेटस 'rejected' हो
      if (updateData.role === userRoleEnum.enumValues[3] /* 'customer' */) {
          await db.update(sellersPgTable)
              .set({ approvalStatus: approvalStatusEnum.enumValues[2] /* 'rejected' */ })
              .where(eq(sellersPgTable.userId, userId));
          await db.update(deliveryBoysPgTable)
              .set({ approvalStatus: approvalStatusEnum.enumValues[2] /* 'rejected' */ })
              .where(eq(deliveryBoysPgTable.userId, userId));
      }
    }


    return res.status(200).json({ message: "User updated successfully.", user: updatedUser[0] });

  } catch (error: any) {
    console.error(`❌ Error updating user ${req.params.userId}:`, error);
    return res.status(500).json({ error: 'Failed to update user.' });
  }
});

// Export router
export default adminRouter;
