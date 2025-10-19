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
  // insertSellerSchema,
  updateSellerSchema
} from '../../shared/backend/schema';
import { requireSellerAuth } from '../../server/middleware/authMiddleware';
import { AuthenticatedRequest, verifyToken } from '../../server/middleware/verifyToken';
import { eq, desc, and, exists } from 'drizzle-orm';
import multer from 'multer';
import { uploadImage, deleteImage } from '../../server/cloudStorage'; // ✅ deleteImage इम्पोर्ट करें
import { v4 as uuidv4 } from "uuid";
import { getIO } from "../../server/socket.ts";

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
    const sellerId = sellerProfile.id;

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

    const [newCategory] = await db.insert(categories).values({
      name,
      description: description || null,
      sellerId: sellerId, // ✅ sellerId असाइन करें
    }).returning();

    getIO().emit("category:created", newCategory);

    return res.status(201).json(newCategory);
  } catch (error: any) {
    console.error('❌ Error in POST /api/sellers/categories:', error);
    return res.status(500).json({ error: 'Failed to create category.' });
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
        .where(and(eq(categories.name, name), eq(categories.sellerId, sellerId), (categories.id, categoryId))); // ✅ sellerId के साथ चेक करें

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
          // ensure 'deleteImage' is imported from your cloud storage service
          // Example: await deleteImage(existingProduct.image);
          console.log(`[INFO] Attempting to delete old image: ${existingProduct.image}`);
          // 'deleteImage' फंक्शन को इम्प्लीमेंट और उपयोग करें
          await deleteImage(existingProduct.image); // <--- Make sure this function exists and works!
        }
        imageUrl = await uploadImage(file.path, file.originalname);
      }

      const updatePayload: any = {
        updatedAt: new Date(),
        // यदि कोई बड़ा बदलाव है (जैसे नाम, विवरण), तो अप्रूवल स्थिति को 'pending' पर सेट करें
        // या इसे admin तय करें कि किन बदलावों पर अप्रूवल चाहिए
        // approvalStatus: approvalStatusEnum.enumValues[0] // 'pending'
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


export default sellerRouter
    
