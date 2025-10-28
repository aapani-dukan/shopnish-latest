// backend/server/controllers/sellerController.ts
import { Express, Router, Response, NextFunction } from 'express';
import { db } from '../../server/db.js';
import {
  sellersPgTable,
  users,
  userRoleEnum,
  approvalStatusEnum,
  categories,
  products,
  // orders, // ✅ अब master orders की बजाय subOrders पर काम करेंगे
  // orderItems, // ✅ अब orderItems सीधे subOrders से जुड़े हैं
  // orderStatusEnum, // ✅ अब masterOrderStatusEnum और subOrderStatusEnum का उपयोग करेंगे
  subOrders, // ✅ subOrders इम्पोर्ट करें
  subOrderStatusEnum, // ✅ subOrderStatusEnum इम्पोर्ट करें
  orders, // ✅ Master Orders इम्पोर्ट करें (मास्टर स्टेटस अपडेट के लिए)
  masterOrderStatusEnum, // ✅ Master Order Status इम्पोर्ट करें
  orderTracking, // ✅ orderTracking इम्पोर्ट करें
  deliveryBatches, // ✅ deliveryBatches इम्पोर्ट करें
  deliveryStatusEnum, // ✅ deliveryStatusEnum इम्पोर्ट करें
  // insertSellerSchema,
  updateSellerSchema
} from '../../shared/backend/schema';
import { requireSellerAuth } from '../../server/middleware/authMiddleware';
import { AuthenticatedRequest, verifyToken } from '../../server/middleware/verifyToken';
import { eq, desc, and, ne, exists, inArray, sql } from 'drizzle-orm'; // ✅ inArray इम्पोर्ट करें
import multer from 'multer';
import { uploadImage, deleteImage } from '../../server/cloudStorage';
import { v4 as uuidv4 } from "uuid";
import { getIO } from "../../server/socket"; // ✅ Ts फ़ाइल है, इसे .ts के साथ इम्पोर्ट करें

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
      businessType,
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
        deliveryRadius: null,
        isDistanceBasedDelivery: false,
        latitude: null,
        longitude: null,
        deliveryPincodes: [],
        businessType,
        approvalStatus: approvalStatusEnum.enumValues[0],
      })
      .returning();

    const [updatedUser] = await db
      .update(users)
      .set({
        role: userRoleEnum.enumValues[1],
        approvalStatus: approvalStatusEnum.enumValues[0],
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

// ✅ GET /api/sellers/orders (अब यह सब-ऑर्डर्स को फेच करेगा)
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

    // ✅ मास्टर ऑर्डर की बजाय सब-ऑर्डर फेच करें
    const sellerSubOrders = await db.query.subOrders.findMany({
      where: eq(subOrders.sellerId, sellerId),
      with: {
        masterOrder: { // मास्टर ऑर्डर की जानकारी
          with: {
            customer: {
              columns: { id: true, firstName: true, lastName: true, email: true, phone: true }
            },
            deliveryAddress: true, // ग्राहक का डिलीवरी पता
          }
        },
        orderItems: { // इस सब-ऑर्डर के आइटम्स
          with: {
            product: {
              columns: { id: true, name: true, price: true, image: true, description: true, unit: true }
            }
          }
        },
        deliveryBatch: { // यदि यह डिलीवरी बैच से जुड़ा है
          with: {
            deliveryBoy: {
              columns: { id: true, name: true, phone: true }
            }
          }
        }
      },
      orderBy: desc(subOrders.createdAt),
    });

    // ✅ JSON स्ट्रिंग को पार्स करें
    const formattedSubOrders = sellerSubOrders.map(subOrder => {
      let parsedDeliveryAddress = {};
      try {
        if (subOrder.masterOrder?.deliveryAddress) {
          parsedDeliveryAddress = JSON.parse(subOrder.masterOrder.deliveryAddress as string);
        }
      } catch (e) {
        console.warn(`Failed to parse deliveryAddress JSON for sub-order ${subOrder.id}:`, e);
      }

      return {
        ...subOrder,
        masterOrder: {
          ...subOrder.masterOrder,
          deliveryAddress: parsedDeliveryAddress,
        }
      };
    });

    return res.status(200).json(formattedSubOrders);
  } catch (error: any) {
    console.error("❌ Error in GET /api/sellers/orders:", error);
    return res.status(500).json({ error: "Failed to fetch seller orders." });
  }
});


// ✅ POST /api/sellers/categories (नई कैटेगरी बनाएं)
sellerRouter.post('/categories', requireSellerAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
    if (!sellerProfile) {
      return res.status(404).json({ error: 'Seller profile not found. Complete seller registration.' });
    }
    const sellerId = sellerProfile.id;

    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    // सुनिश्चित करें कि इस सेलर के लिए समान नाम वाली कोई कैटेगरी पहले से मौजूद न हो
    const [existingCategory] = await db.select()
      .from(categories)
      .where(and(eq(categories.name, name), eq(categories.sellerId, sellerId))); // ✅ sellerId के साथ चेक करें

    if (existingCategory) {
      return res.status(409).json({ error: 'Category with this name already exists for this seller.' });
    }



    return res.status(200).json({ message: 'Validation successful. Ready to create category.' });

      } catch (error) {
          console.error('Error in creating category:', error);
              return res.status(500).json({ error: 'Internal Server Error.' });
                }
                });


    sellerRouter.post("/add-category", async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { name, description } = req.body;
        const sellerId = req.user.id; // logged-in seller का id

        // Category object तैयार करना
        const newCategoryData = {
          name,
          slug: name.toLowerCase().replace(/\s+/g, "-"), // simple slug
          description: description || null,
          sellerId: sellerId, // number assign directly
        };

        // DB में insert करना
        const [newCategory] = await db.insert(categories)
          .values(newCategoryData)
          .returning();

        // Socket event emit करना (अगर real-time चाहिए)
        getIO().emit("category:created", newCategory);

        return res.status(201).json(newCategory);

      } catch (error: any) {
        console.error('❌ Error in adding category:', error);
        return res.status(500).json({ error: "Something went wrong" });
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
        const sellerId = sellerProfile.id;

        // ✅ अब categories टेबल में sellerId है, इसलिए हम इसे फ़िल्टर कर सकते हैं
        const sellerCategories = await db.query.categories.findMany({
          where: eq(categories.sellerId, sellerId),
          orderBy: desc(categories.id),
        });

        return res.status(200).json(sellerCategories);
      } catch (error: any) {
        console.error('❌ Error in GET /api/sellers/categories:', error);
        return res.status(500).json({ error: 'Failed to fetch seller categories.' });
      }
    });


    // ✅ PUT /api/sellers/categories/:id (कैटेगरी अपडेट करें)
    sellerRouter.put('/categories/:id', requireSellerAuth, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user?.id;
        const categoryId = parseInt(req.params.id);

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized.' });
        }
        if (isNaN(categoryId)) {
          return res.status(400).json({ error: 'Invalid category ID.' });
        }

        const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
        if (!sellerProfile) {
          return res.status(404).json({ error: 'Seller profile not found.' });
        }
        const sellerId = sellerProfile.id;

        const { name, description } = req.body;

        if (!name && !description) {
          return res.status(400).json({ error: 'No update data provided.' });
        }

        // सुनिश्चित करें कि कैटेगरी सेलर की है
        const [existingCategory] = await db.select()
          .from(categories)
          .where(and(eq(categories.id, categoryId), eq(categories.sellerId, sellerId))); // ✅ sellerId के साथ चेक करें

        if (!existingCategory) {
          return res.status(403).json({ error: 'Not authorized to update this category.' });
        }

        // यदि नाम अपडेट हो रहा है, तो डुप्लिकेट नाम जांचें
        if (name && name !== existingCategory.name) {
          const [duplicateCategory] = await db.select()
            .from(categories)
            .where(and(eq(categories.name, name), eq(categories.sellerId, sellerId), eq(categories.id, categoryId))); // ✅ sellerId के साथ चेक करें

          if (duplicateCategory) {
            return res.status(409).json({ error: 'Category with this name already exists for this seller.' });
          }
        }

        const [updatedCategory] = await db.update(categories)
          .set({
            name: name || existingCategory.name,
            description: description !== undefined ? description : existingCategory.description,
            updatedAt: new Date(),
          })
          .where(eq(categories.id, categoryId))
          .returning();

        if (!updatedCategory) {
          return res.status(404).json({ error: 'Category not found or no changes made.' });
        }

        getIO().emit("category:updated", updatedCategory);

        return res.status(200).json(updatedCategory);
      } catch (error: any) {
        console.error('❌ Error in PUT /api/sellers/categories/:id:', error);
        return res.status(500).json({ error: 'Failed to update category.' });
      }
    });

    // ✅ DELETE /api/sellers/categories/:id (कैटेगरी डिलीट करें)
    sellerRouter.delete('/categories/:id', requireSellerAuth, async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user?.id;
        const categoryId = parseInt(req.params.id);

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized.' });
        }
        if (isNaN(categoryId)) {
          return res.status(400).json({ error: 'Invalid category ID.' });
        }

        const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
        if (!sellerProfile) {
          return res.status(404).json({ error: 'Seller profile not found.' });
        }
        const sellerId = sellerProfile.id;

        // सुनिश्चित करें कि कैटेगरी सेलर की है
        const [existingCategory] = await db.select()
          .from(categories)
          .where(and(eq(categories.id, categoryId), eq(categories.sellerId, sellerId))); // ✅ sellerId के साथ चेक करें

        if (!existingCategory) {
          return res.status(403).json({ error: 'Not authorized to delete this category.' });
        }

        // चेक करें कि क्या इस कैटेगरी में कोई प्रोडक्ट है
        const [hasProducts] = await db.select({ id: products.id })
          .from(products)
          .where(eq(products.categoryId, categoryId));

        if (hasProducts) {
          return res.status(400).json({ error: 'Cannot delete category: products are associated with it.' });
        }

        const [deletedCategory] = await db.delete(categories)
          .where(eq(categories.id, categoryId))
          .returning();

        if (!deletedCategory) {
          return res.status(404).json({ error: 'Category not found or failed to delete.' });
        }

        getIO().emit("category:deleted", deletedCategory.id);

        return res.status(200).json({ message: 'Category deleted successfully.', category: deletedCategory });
      } catch (error: any) {
        console.error('❌ Error in DELETE /api/sellers/categories/:id:', error);
        return res.status(500).json({ error: 'Failed to delete category.' });
      }
    });


    // ✅ POST /api/sellers/products (नया प्रोडक्ट बनाएं) (यह पहले से मौजूद है, यहाँ सिर्फ संदर्भ के लिए)
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
              unit: unit || 'piece',
              brand: brand || null,
              minOrderQty: parsedMinOrderQty,
              maxOrderQty: parsedMaxOrderQty,
              estimatedDeliveryTime: estimatedDeliveryTime || '1-2 hours',
              approvalStatus: approvalStatusEnum.enumValues[0],
            })
            .returning();

          getIO().emit("product:created", newProduct[0]);

          return res.status(201).json(newProduct[0]);
        } catch (error: any) {
          console.error('❌ Error in POST /api/sellers/products:', error);
          return res.status(500).json({ error: 'Failed to create product.' });
        }
      }
    );

    // ✅ PATCH /api/sellers/products/:id (प्रोडक्ट अपडेट करें)
    sellerRouter.patch(
      '/products/:id',
      requireSellerAuth,
      upload.single('image'),
      async (req: AuthenticatedRequest, res: Response) => {
        try {
          const userId = req.user?.id;
          const productId = parseInt(req.params.id);

          if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated.' });
          }
          if (isNaN(productId)) {
            return res.status(400).json({ error: 'Invalid product ID.' });
          }

          const [sellerProfile] = await db
            .select()
            .from(sellersPgTable)
            .where(eq(sellersPgTable.userId, userId));

          if (!sellerProfile) {
            return res.status(404).json({ error: 'Seller profile not found.' });
          }
          const sellerId = sellerProfile.id;

          // सुनिश्चित करें कि प्रोडक्ट सेलर का है
          const [existingProduct] = await db.select()
            .from(products)
            .where(and(eq(products.id, productId), eq(products.sellerId, sellerId)));

          if (!existingProduct) {
            return res.status(403).json({ error: 'Not authorized to update this product.' });
          }

          const { name, description, price, categoryId, stock, unit, brand, minOrderQty, maxOrderQty, estimatedDeliveryTime } = req.body;
          const file = req.file;

          let imageUrl = existingProduct.image;
          if (file) {
            // ✅ पुरानी इमेज को क्लाउड स्टोरेज से हटाने पर विचार करें
            if (existingProduct.image) {
              console.log(`[INFO] Attempting to delete old image: ${existingProduct.image}`);
              await deleteImage(existingProduct.image);
            }
            imageUrl = await uploadImage(file.path, file.originalname);
          }

          const updatePayload: any = {
            updatedAt: new Date(),
          };

          if (name !== undefined) updatePayload.name = name;
          if (description !== undefined) updatePayload.description = description;
          if (price !== undefined) updatePayload.price = parseFloat(price as string);
          if (categoryId !== undefined) updatePayload.categoryId = parseInt(categoryId as string);
          if (stock !== undefined) updatePayload.stock = parseInt(stock as string);
          if (unit !== undefined) updatePayload.unit = unit;
          if (brand !== undefined) updatePayload.brand = brand;
          if (minOrderQty !== undefined) updatePayload.minOrderQty = parseInt(minOrderQty as string);
          if (maxOrderQty !== undefined) updatePayload.maxOrderQty = parseInt(maxOrderQty as string);
          if (estimatedDeliveryTime !== undefined) updatePayload.estimatedDeliveryTime = estimatedDeliveryTime;
          if (imageUrl !== undefined) updatePayload.image = imageUrl;


          const [updatedProduct] = await db
            .update(products)
            .set(updatePayload)
            .where(eq(products.id, productId))
            .returning();

          if (!updatedProduct) {
            return res.status(404).json({ error: 'Product not found or no changes made.' });
          }

          getIO().emit("product:updated", updatedProduct);

          return res.status(200).json(updatedProduct);

        } catch (error: any) {
          console.error("❌ PUT /api/sellers/delivery-preferences error:", error);
          res.status(500).json({ message: "Failed to update delivery preferences.", error: error.message });
        }
      });

    // --- ✅ नया API: /api/sellers/sub-orders/:id/status ---
    sellerRouter.patch(
      '/sub-orders/:id/status',
      requireSellerAuth,
      async (req: AuthenticatedRequest, res: Response) => {
        try {
          const userId = req.user?.id;
          const subOrderId = parseInt(req.params.id);
          const { status: newStatus } = req.body; // नया स्टेटस रिक्वेस्ट बॉडी से मिलेगा

          if (!userId) {
            return res.status(401).json({ error: 'Unauthorized.' });
          }
          if (isNaN(subOrderId)) {
            return res.status(400).json({ error: 'Invalid sub-order ID.' });
          }
          if (!newStatus || !Object.values(subOrderStatusEnum.enumValues).includes(newStatus)) {
            return res.status(400).json({ error: 'Invalid or missing status provided.' });
          }

          // सेलर प्रोफाइल प्राप्त करें
          const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
          if (!sellerProfile) {
            return res.status(404).json({ error: 'Seller profile not found.' });
          }
          const sellerId = sellerProfile.id;

          // सुनिश्चित करें कि यह सब-ऑर्डर इस सेलर का है
          const existingSubOrder = await db.query.subOrders.findFirst({
            where: and(
              eq(subOrders.id, subOrderId),
              eq(subOrders.sellerId, sellerId)
            ),
            with: {
              masterOrder: {
                columns: { id: true, customerId: true }
              },
              deliveryBatch: {
                columns: { id: true, status: true, deliveryBoyId: true }
              }
            }
          });

          if (!existingSubOrder) {
            return res.status(403).json({ error: 'Not authorized to update this sub-order or sub-order not found.' });
          }

          // स्थिति अपडेट करने से पहले कुछ वैलिडेशन
          // उदा. 'ready_for_pickup' तभी हो सकता है जब 'accepted' या 'preparing' हो।
          const currentStatus = existingSubOrder.status;
          const validStatusTransitions: { [key: string]: string[] } = {
            'pending': ['accepted', 'rejected'],
            'accepted': ['preparing', 'rejected'],
            'preparing': ['ready_for_pickup'],
            // 'ready_for_pickup' के बाद डिलीवरी बॉय द्वारा अपडेट किया जाएगा
            // 'rejected', 'delivered_by_seller', 'delivered_by_delivery_boy', 'cancelled' टर्मिनल स्टेटस हैं सेलर के लिए
          };

          if (!validStatusTransitions[currentStatus]?.includes(newStatus) && newStatus !== currentStatus) {
            return res.status(400).json({ error: `Invalid status transition from '${currentStatus}' to '${newStatus}'.` });
          }

          // यदि सेलर 'ready_for_pickup' पर सेट कर रहा है और सेल्फ-डिलीवरी है, तो इसे सीधे 'delivered_by_seller' पर भी सेट कर सकते हैं (तुम्हारे बिज़नेस लॉजिक पर निर्भर करता है)
          let finalStatusForSubOrder = newStatus;
          if (newStatus === subOrderStatusEnum.enumValues[3] /* ready_for_pickup */ && existingSubOrder.isSelfDeliveryBySeller) {
            finalStatusForSubOrder = subOrderStatusEnum.enumValues[5] /* delivered_by_seller */;
          }


          // ट्रांजेक्शन का उपयोग करें क्योंकि हम कई टेबल्स को अपडेट कर रहे हैं
          await db.transaction(async (tx) => {
            // 1. सब-ऑर्डर की स्थिति अपडेट करें
            const [updatedSubOrder] = await tx.update(subOrders)
              .set({
                status: finalStatusForSubOrder,
                updatedAt: new Date(),
              })
              .where(eq(subOrders.id, subOrderId))
              .returning();

            if (!updatedSubOrder) {
              throw new Error('Failed to update sub-order status.');
            }

            // 2. orderTracking में एक नई एंट्री जोड़ें
            await tx.insert(orderTracking).values({
              masterOrderId: existingSubOrder.masterOrderId,
              subOrderId,
              status: finalStatusForSubOrder,
              updatedBy: userId, // सेलर का यूजर ID
              updatedByRole: userRoleEnum.enumValues[1], // 'seller'
              timestamp: new Date(),
              message: `Sub-order status updated to '${finalStatusForSubOrder}' by seller.`,
            });

            // 3. मास्टर ऑर्डर की स्थिति अपडेट करने के लिए जाँच करें (यदि आवश्यक हो)
            // मास्टर ऑर्डर की स्थिति तभी अपडेट होगी जब उसके सभी सब-ऑर्डर किसी विशिष्ट स्टेज पर पहुँच जाएं।
            const relatedSubOrders = await tx.query.subOrders.findMany({
              where: eq(subOrders.masterOrderId, existingSubOrder.masterOrder.id),
              columns: {
                id: true,
                status: true,
                isSelfDeliveryBySeller: true,
              },
              with: {
                deliveryBatch: {
                  columns: {
                    status: true
                  }
                }
              }
            });

            // सभी सब-ऑर्डर 'ready_for_pickup' या 'delivered_by_seller' या 'delivered_by_delivery_boy' हैं?
            const allSubOrdersReadyForDeliveryOrSelfDelivered = relatedSubOrders.every(so =>
              so.status === subOrderStatusEnum.enumValues[3] || // ready_for_pickup
              so.status === subOrderStatusEnum.enumValues[5] || // delivered_by_seller
                so.status === subOrderStatusEnum.enumValues[6]      
                );

            // यदि सभी sub-orders 'ready_for_pickup' या 'delivered_by_seller' हैं,
            // और मास्टर ऑर्डर अभी भी 'pending' या 'accepted' है, तो उसे 'processing' पर अपडेट करें।
            // या यदि सभी 'ready_for_pickup' हो गए हैं और नॉन-सेल्फ डिलीवरी हैं, तो डिलीवरी बैच को भी अपडेट करें।
            if (allSubOrdersReadyForDeliveryOrSelfDelivered) {
              const [currentMasterOrder] = await tx.select().from(orders).where(eq(orders.id, existingSubOrder.masterOrder.id));
              if (currentMasterOrder && currentMasterOrder.status !== masterOrderStatusEnum.enumValues[2] /* processing */) {
                await tx.update(orders)
                  .set({ status: masterOrderStatusEnum.enumValues[2], updatedAt: new Date().toISOString() }) // 'processing'
                  .where(eq(orders.id, existingSubOrder.masterOrder.id));

                // master order tracking में भी एंट्री जोड़ें
                await tx.insert(orderTracking).values({
                  masterOrderId: existingSubOrder.masterOrder.id,
                  status: masterOrderStatusEnum.enumValues[2],
                  updatedBy: userId,
                  updatedByRole: userRoleEnum.enumValues[1],
                  timestamp: new Date(),
                  message: `Master order status updated to 'processing' as all sub-orders are ready for delivery/self-delivered.`,
                });
                getIO().emit(`master-order:${existingSubOrder.masterOrder.id}:status-updated`, {
                  status: masterOrderStatusEnum.enumValues[2],
                  message: `Master order status updated to 'processing'.`,
                });
              }
            }

            // यदि सब-ऑर्डर 'ready_for_pickup' पर अपडेट होता है
            if (finalStatusForSubOrder === subOrderStatusEnum.enumValues[3] /* ready_for_pickup */ && existingSubOrder.deliveryBatch) {
              // संबंधित डिलीवरी बैच की स्थिति को 'pending' से 'ready_for_pickup' पर अपडेट करें
              // यह इंगित करता है कि डिलीवरी बॉय अब इसे पिक कर सकता है।
              if (existingSubOrder.deliveryBatch.status === deliveryStatusEnum.enumValues[0] /* pending */) {
                await tx.update(deliveryBatches)
                  .set({ status: deliveryStatusEnum.enumValues[1], updatedAt: new Date() }) // 'ready_for_pickup'
                  .where(eq(deliveryBatches.id, existingSubOrder.deliveryBatch.id));

                await tx.insert(orderTracking).values({
                  masterOrderId: existingSubOrder.masterOrder.id,
                  deliveryBatchId: existingSubOrder.deliveryBatch.id,
                  status: deliveryStatusEnum.enumValues[1],
                  updatedBy: userId,
                  updatedByRole: userRoleEnum.enumValues[1],
                  timestamp: new Date(),
                  message: `Delivery batch status updated to 'ready_for_pickup' by seller for sub-order ${subOrderId}.`,
                });
                getIO().emit(`delivery-batch:${existingSubOrder.deliveryBatch.id}:status-updated`, {
                  status: deliveryStatusEnum.enumValues[1],
                  message: `Delivery batch ready for pickup.`,
                });
                // डिलीवरी बॉय को सूचित करें कि उसका बैच तैयार है
                if (existingSubOrder.deliveryBatch.deliveryBoyId) {
                  getIO().emit(`delivery-boy:${existingSubOrder.deliveryBatch.deliveryBoyId}:new-pickup-alert`, {
                    deliveryBatchId: existingSubOrder.deliveryBatch.id,
                    masterOrderId: existingSubOrder.masterOrder.id,
                    message: "A new delivery batch is ready for pickup!",
                  });
                }
              }
            }

            // Socket.io: कस्टमर को रियल-टाइम अपडेट भेजें
            getIO().emit(`user:${existingSubOrder.masterOrder.customerId}:order-update`, {
              subOrderId: subOrderId,
              status: finalStatusForSubOrder,
              masterOrderId: existingSubOrder.masterOrder.id,
              message: `Your order from ${sellerProfile.businessName} is now '${finalStatusForSubOrder}'.`,
            });
            // सेलर को भी अपडेट भेजें
            getIO().emit(`seller:${sellerId}:order-update`, {
              subOrderId: subOrderId,
              status: finalStatusForSubOrder,
              masterOrderId: existingSubOrder.masterOrder.id,
            });

            return res.status(200).json({
              message: 'Sub-order status updated successfully.',
              subOrder: updatedSubOrder,
              masterOrderId: existingSubOrder.masterOrder.id,
            });
          });

        } catch (error: any) {
          console.error('❌ Error in PATCH /api/sellers/sub-orders/:id/status:', error);
          // next(error); // केंद्रीय त्रुटि हैंडलिंग के लिए
          return res.status(500).json({ error: error.message || 'Failed to update sub-order status.' });
        }
      }
    );


    export default sellerRouter;
