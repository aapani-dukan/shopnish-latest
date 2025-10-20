// backend/routes/productRoutes.ts
import { Router, Request, Response, NextFunction } from 'express'; // ✅ NextFunction जोड़ा
import { db } from '../server/db.ts'; // ✅ पाथ सही करें यदि यह 'backend/db.ts' है
import {
  products,
  productCategories, // ✅ 'categories' की जगह 'productCategories' का उपयोग करें जैसा कि स्कीमा में होगा
  sellersPgTable,
  approvalStatusEnum, // ✅ approvalStatusEnum इम्पोर्ट करें
  users, // यदि आवश्यक हो
} from '../shared/backend/schema.ts'; // ✅ पाथ सही करें
import { eq, like, inArray, and, desc, asc, sql } from 'drizzle-orm'; // ✅ desc, asc, sql इम्पोर्ट करें
import { calculateDistanceKm } from '../services/locationService.ts'; // ✅ पाथ सही करें

// ✅ Auth Middleware इम्पोर्ट करें
import { AuthenticatedRequest, verifyToken, isSeller, isAdmin } from '../server/middleware/authMiddleware.ts';

const router = Router();

// =========================================================================
// Helper Functions (Validation)
// =========================================================================

/**
 * Helper function for input validation.
 */
function validateProductInput(data: any, isUpdate: boolean = false) {
  const errors: string[] = [];

  if (!isUpdate || data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length < 3) {
      errors.push("Product name must be a string of at least 3 characters.");
    }
  }
  if (!isUpdate || data.description !== undefined) {
    if (typeof data.description !== 'string' || data.description.trim().length < 10) {
      errors.push("Product description must be a string of at least 10 characters.");
    }
  }
  if (!isUpdate || data.price !== undefined) {
    if (typeof data.price !== 'number' || data.price <= 0) {
      errors.push("Price must be a positive number.");
    }
  }
  if (!isUpdate || data.stock !== undefined) {
    if (typeof data.stock !== 'number' || data.stock < 0) {
      errors.push("Stock must be a non-negative number.");
    }
  }
  if (!isUpdate || data.categoryId !== undefined) {
    if (typeof data.categoryId !== 'number' || data.categoryId <= 0) {
      errors.push("Category ID must be a positive number.");
    }
  }
  if (!isUpdate || data.image !== undefined) {
    if (typeof data.image !== 'string' || !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(data.image)) {
      errors.push("Image must be a valid URL.");
    }
  }
  if (data.unit !== undefined && typeof data.unit !== 'string' || data.unit.trim().length === 0) {
    errors.push("Unit is required and must be a non-empty string.");
  }
  if (data.minOrderQty !== undefined && (typeof data.minOrderQty !== 'number' || data.minOrderQty < 1)) {
    errors.push("Minimum order quantity must be a positive number.");
  }
  if (data.maxOrderQty !== undefined && (typeof data.maxOrderQty !== 'number' || data.maxOrderQty < (data.minOrderQty || 1))) {
    errors.push("Maximum order quantity must be greater than or equal to minimum order quantity.");
  }

  return errors;
}

// =========================================================================
// Seller-specific Product Management Routes (requires seller authentication)
// =========================================================================

// POST /api/products - Create a new product (Seller)
router.post('/', verifyToken, isSeller, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🚀 [API] Received request to create a new product.");
  const sellerId = req.user?.id; // Assuming req.user.id is the seller's user ID

  if (!sellerId) {
    return res.status(401).json({ message: "Unauthorized: Seller not authenticated." });
  }

  const productData = req.body;
  const validationErrors = validateProductInput(productData);

  if (validationErrors.length > 0) {
    return res.status(400).json({ message: "Validation failed.", errors: validationErrors });
  }

  try {
    // ✅ सुनिश्चित करें कि categoryId मान्य है
    const [category] = await db.select().from(productCategories).where(eq(productCategories.id, productData.categoryId));
    if (!category) {
      return res.status(400).json({ message: "Invalid category ID provided." });
    }

    const [newProduct] = await db.insert(products).values({
      name: productData.name,
      description: productData.description,
      price: productData.price,
      stock: productData.stock,
      categoryId: productData.categoryId,
      sellerId: sellerId, // प्रोडक्ट को सेलर से जोड़ें
      image: productData.image, // URL को सीधे सहेजें
      unit: productData.unit || 'unit', // e.g., 'kg', 'liter, 'piece'
      minOrderQty: productData.minOrderQty || 1,
      maxOrderQty: productData.maxOrderQty || null,
      approvalStatus: approvalStatusEnum.enumValues[0], // 'pending' या 'awaiting_approval'
      isActive: productData.isActive ?? true, // Seller इसे active या inactive कर सकता है
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.status(201).json({
      message: "Product created successfully. Awaiting admin approval.",
      product: newProduct,
    });
  } catch (error) {
    console.error("❌ Error creating product:", error);
    next(error);
  }
});

// PUT /api/products/:productId - Update an existing product (Seller)
router.put('/:productId', verifyToken, isSeller, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log(`🔄 [API] Received request to update product ${req.params.productId}.`);
  const sellerId = req.user?.id;
  const productId = Number(req.params.productId);

  if (!sellerId) {
    return res.status(401).json({ message: "Unauthorized: Seller not authenticated." });
  }
  if (isNaN(productId)) {
    return res.status(400).json({ message: "Invalid product ID." });
  }

  const updateData = req.body;
  const validationErrors = validateProductInput(updateData, true); // isUpdate = true

  if (validationErrors.length > 0) {
    return res.status(400).json({ message: "Validation failed.", errors: validationErrors });
  }

  try {
    // ✅ सुनिश्चित करें कि सेलर इस प्रोडक्ट का मालिक है
    const [existingProduct] = await db.select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.sellerId, sellerId)));

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found or not owned by this seller." });
    }

    // ✅ केवल अनुमत फ़ील्ड्स को अपडेट करें
    const allowedUpdates: Partial<typeof products.$inferInsert> = {};
    if (updateData.name !== undefined) allowedUpdates.name = updateData.name;
    if (updateData.description !== undefined) allowedUpdates.description = updateData.description;
    if (updateData.price !== undefined) allowedUpdates.price = updateData.price;
    if (updateData.stock !== undefined) allowedUpdates.stock = updateData.stock;
    if (updateData.categoryId !== undefined) {
        // ✅ categoryId का भी वैलिडेट करें
        const [category] = await db.select().from(productCategories).where(eq(productCategories.id, updateData.categoryId));
        if (!category) {
            return res.status(400).json({ message: "Invalid category ID provided for update." });
        }
        allowedUpdates.categoryId = updateData.categoryId;
    }
    if (updateData.image !== undefined) allowedUpdates.image = updateData.image;
    if (updateData.unit !== undefined) allowedUpdates.unit = updateData.unit;
    if (updateData.minOrderQty !== undefined) allowedUpdates.minOrderQty = updateData.minOrderQty;
    if (updateData.maxOrderQty !== undefined) allowedUpdates.maxOrderQty = updateData.maxOrderQty;
    if (updateData.isActive !== undefined) allowedUpdates.isActive = updateData.isActive;
    
    // यदि product का approvalStatus 'rejected' है और सेलर इसे अपडेट करता है, तो इसे फिर से 'pending' पर सेट करें
    // ताकि एडमिन इसे फिर से रिव्यू कर सके।
    if (existingProduct.approvalStatus === approvalStatusEnum.enumValues[2] /* 'rejected' */) {
        allowedUpdates.approvalStatus = approvalStatusEnum.enumValues[0]; // 'pending'
    }

    allowedUpdates.updatedAt = new Date(); // अपडेट टाइमस्टैंप

    const [updatedProduct] = await db.update(products)
      .set(allowedUpdates)
      .where(eq(products.id, productId))
      .returning();

    res.status(200).json({
      message: "Product updated successfully.",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("❌ Error updating product:", error);
    next(error);
  }
});

// DELETE /api/products/:productId - Delete a product (Seller)
router.delete('/:productId', verifyToken, isSeller, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log(`🗑️ [API] Received request to delete product ${req.params.productId}.`);
  const sellerId = req.user?.id;
  const productId = Number(req.params.productId);

  if (!sellerId) {
    return res.status(401).json({ message: "Unauthorized: Seller not authenticated." });
  }
  if (isNaN(productId)) {
    return res.status(400).json({ message: "Invalid product ID." });
  }

  try {
    // ✅ सुनिश्चित करें कि सेलर इस प्रोडक्ट का मालिक है
    const [deletedProduct] = await db.delete(products)
      .where(and(eq(products.id, productId), eq(products.sellerId, sellerId)))
      .returning();

    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found or not owned by this seller." });
    }

    res.status(200).json({
      message: "Product deleted successfully.",
      product: deletedProduct,
    });
  } catch (error) {
    console.error("❌ Error deleting product:", error);
    next(error);
  }
});

// GET /api/products/seller - Get products for the authenticated seller (Seller)
router.get('/seller', verifyToken, isSeller, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("📦 [API] Received request to get seller's products.");
  const sellerId = req.user?.id;

  if (!sellerId) {
    return res.status(401).json({ message: "Unauthorized: Seller not authenticated." });
  }

  try {
    const sellerProducts = await db.query.products.findMany({
      where: eq(products.sellerId, sellerId),
      with: {
        category: true,
      },
      orderBy: [desc(products.createdAt)],
    });

    res.status(200).json({
      message: "Seller products fetched successfully.",
      products: sellerProducts,
    });
  } catch (error) {
    console.error("❌ Error fetching seller products:", error);
    next(error);
  }
});


// =========================================================================
// Admin-specific Product Approval Routes (requires admin authentication)
// =========================================================================

// GET /api/products/admin/pending - Get products awaiting admin approval (Admin)
router.get('/admin/pending', verifyToken, isAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log("📄 [API] Received request to get pending products for admin review.");
    try {
        const pendingProducts = await db.query.products.findMany({
            where: eq(products.approvalStatus, approvalStatusEnum.enumValues[0]), // 'pending'
            with: {
                category: true,
                seller: {
                    columns: {
                        id: true,
                        businessName: true,
                        contactPerson: true,
                        phoneNumber: true,
                    }
                }
            },
            orderBy: [desc(products.createdAt)],
        });
        res.status(200).json(pendingProducts);
    } catch (error) {
        console.error("❌ Error fetching pending products:", error);
        next(error);
    }
});

// PUT /api/products/admin/:productId/approve - Approve a product (Admin)
router.put('/admin/:productId/approve', verifyToken, isAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log(`✅ [API] Received request to approve product ${req.params.productId}.`);
    const productId = Number(req.params.productId);

    if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID." });
    }

    try {
        const [updatedProduct] = await db.update(products)
            .set({ approvalStatus: approvalStatusEnum.enumValues[1], updatedAt: new Date() }) // 'approved'
            .where(eq(products.id, productId))
            .returning();

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.status(200).json({ message: "Product approved successfully.", product: updatedProduct });
    } catch (error) {
        console.error("❌ Error approving product:", error);
        next(error);
    }
});

// PUT /api/products/admin/:productId/reject - Reject a product (Admin)
router.put('/admin/:productId/reject', verifyToken, isAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log(`❌ [API] Received request to reject product ${req.params.productId}.`);
    const productId = Number(req.params.productId);
    const { reason } = req.body; // अस्वीकृति का कारण

    if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID." });
    }

    try {
        const [updatedProduct] = await db.update(products)
            .set({ approvalStatus: approvalStatusEnum.enumValues[2], rejectionReason: reason || null, updatedAt: new Date() }) // 'rejected'
            .where(eq(products.id, productId))
            .returning();

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.status(200).json({ message: "Product rejected successfully.", product: updatedProduct });
    } catch (error) {
        console.error("❌ Error rejecting product:", error);
        next(error);
    }
});


// =========================================================================
// Public Product Listing Routes (no authentication required for viewing)
// =========================================================================

// GET /api/products (यह सभी प्रोडक्ट्स को लिस्ट करता है, अब स्थान, फ़िल्टर, सर्च, सॉर्ट, पेजिंग के आधार पर फ़िल्टर किया गया)
router.get('/', async (req: Request, res: Response, next: NextFunction) => { // ✅ NextFunction जोड़ा
  console.log("📄 [API] Received request to get all products for customer view.");
  try {
    const {
      categoryId,
      search,
      customerPincode,
      customerLat,
      customerLng,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    // ग्राहक के स्थान की जानकारी आवश्यक है (यदि तुम स्थान-आधारित फ़िल्टरिंग का उपयोग करना चाहते हो)
    if (!customerPincode || !customerLat || !customerLng) {
      return res.status(400).json({ message: "Customer location (pincode, lat, lng) is required for filtering." });
    }

    const parsedCustomerLat = parseFloat(customerLat as string);
    const parsedCustomerLng = parseFloat(customerLng as string);

    // 1. सभी स्वीकृत सेलर्स को उनकी डिलीवरी प्राथमिकताओं के साथ Fetch करें
    const allApprovedSellers = await db.select()
      .from(sellersPgTable)
      .where(eq(sellersPgTable.isVerified, true)); // ✅ केवल Verified सेलर्स के प्रोडक्ट दिखाएं

    const deliverableSellerIds: number[] = [];
    const distanceCheckPromises: Promise<void>[] = [];

    for (const seller of allApprovedSellers) {
      if (!seller.id) continue;

      if (seller.isDistanceBasedDelivery) {
        // यह विक्रेता दूरी-आधारित डिलीवरी का उपयोग करता है
        if (seller.latitude && seller.longitude && seller.deliveryRadius !== null && seller.deliveryRadius !== undefined) {
          distanceCheckPromises.push((async () => {
            const distance = calculateDistanceKm(
              seller.latitude,
              seller.longitude,
              parsedCustomerLat,
              parsedCustomerLng
            );
            if (distance !== null && distance <= seller.deliveryRadius!) {
              deliverableSellerIds.push(seller.userId); // ✅ विक्रेता का User ID जोड़ें
            }
          })());
        } else {
            console.warn(`[ProductRoutes] Seller ${seller.id} chose distance-based delivery but missing shop location or max distance. Skipping.`);
        }
      } else {
        // यह विक्रेता पिनकोड-आधारित डिलीवरी का उपयोग करता है
        if (seller.deliveryPincodes && JSON.parse(seller.deliveryPincodes as string).includes(customerPincode as string)) { // ✅ JSON.parse for deliveryPincodes
          deliverableSellerIds.push(seller.userId); // ✅ विक्रेता का User ID जोड़ें
        }
      }
    }

    await Promise.all(distanceCheckPromises);

    // यदि कोई भी विक्रेता डिलीवर नहीं कर सकता है, तो खाली सूची लौटाएं
    if (deliverableSellerIds.length === 0) {
      return res.status(200).json({
        page: pageNum,
        limit: limitNum,
        total: 0,
        totalPages: 0,
        products: [],
      });
    }

    const whereClauses = [
      inArray(products.sellerId, deliverableSellerIds), // ✅ नया फ़िल्टर: डिलीवर करने वाले सेलर्स के उत्पाद
      eq(products.approvalStatus, approvalStatusEnum.enumValues[1]), // ✅ केवल स्वीकृत उत्पाद ही दिखाए जाएं
      eq(products.isActive, true), // ✅ केवल सक्रिय उत्पाद
    ];

    if (search) {
      whereClauses.push(like(products.name, `%${search}%`));
    }
    if (categoryId) {
      whereClauses.push(eq(products.categoryId, Number(categoryId)));
    }
    if (minPrice) {
      whereClauses.push(sql`${products.price} >= ${Number(minPrice)}`);
    }
    if (maxPrice) {
      whereClauses.push(sql`${products.price} <= ${Number(maxPrice)}`);
    }

    const orderBy = [];
    if (sortBy === 'price') {
      orderBy.push(sortOrder === 'asc' ? asc(products.price) : desc(products.price));
    } else if (sortBy === 'name') {
      orderBy.push(sortOrder === 'asc' ? asc(products.name) : desc(products.name));
    } else { // Default to createdAt
      orderBy.push(sortOrder === 'asc' ? asc(products.createdAt) : desc(products.createdAt));
    }

    const [totalProductsResult] = await db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...whereClauses));
    const totalProducts = totalProductsResult?.count || 0;

    const productList = await db.query.products.findMany({
      where: and(...whereClauses),
      with: {
        category: true,
        seller: {
          columns: {
            id: true,
            userId: true,
            businessName: true,
          }
        }
      },
      orderBy: orderBy,
      limit: limitNum,
      offset: offset,
    });

    res.status(200).json({
      page: pageNum,
      limit: limitNum,
      total: totalProducts,
      totalPages: Math.ceil(totalProducts / limitNum),
      products: productList,
    });
  } catch (error) {
    console.error("❌ Error fetching all products:", error);
    next(error);
  }
});


// GET /api/products/:id - Get a single product by ID (Public)
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => { // ✅ NextFunction जोड़ा
  console.log(`🔍 [API] Received request to get product ${req.params.id}.`);
  const productId = Number(req.params.id);

  if (isNaN(productId)) {
    return res.status(400).json({ message: "Invalid product ID." });
  }

  try {
    const productDetail = await db.query.products.findFirst({
      where: and(
        eq(products.id, productId),
        eq(products.isActive, true), // ✅ केवल सक्रिय प्रोडक्ट
        eq(products.approvalStatus, approvalStatusEnum.enumValues[1]) // ✅ केवल अनुमोदित प्रोडक्ट
      ),
      with: {
        category: true,
        seller: {
          columns: {
            id: true,
            userId: true,
            businessName: true,
            contactPerson: true,
        phoneNumber: true,
          }
        },
        // TODO: यदि तुम रिव्यूज़ को जोड़ना चाहते हो तो यहाँ 'reviews' भी जोड़ें
      },
    });

    if (!productDetail) {
      return res.status(404).json({ message: "Product not found or not available." });
    }

    res.status(200).json(productDetail);
  } catch (error) {
    console.error("❌ Error fetching product details:", error);
    next(error);
  }
});

// पहले वाले /pending और /approved राउट्स को हटा दिया गया है
// क्योंकि admin/pending और public getAllProducts अब उनकी जगह ले रहे हैं

export default router;
