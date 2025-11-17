// backend/routes/productRoutes.ts
import { Router, Request, Response, NextFunction } from 'express'; // ✅ NextFunction जोड़ा
import { db } from '../server/db.ts'; // ✅ पाथ सही करें यदि यह 'backend/db.ts' है
import {
  products,
  categories, // ✅ 'categories' की जगह 'productCategories' का उपयोग करें जैसा कि स्कीमा में होगा
  sellersPgTable,
  approvalStatusEnum, // ✅ approvalStatusEnum इम्पोर्ट करें
  users, // यदि आवश्यक हो
} from '../shared/backend/schema.ts'; // ✅ पाथ सही करें
import { eq, like, inArray, and, desc, asc, sql } from 'drizzle-orm'; // ✅ desc, asc, sql इम्पोर्ट करें
import { calculateDistanceKm } from '../services/locationService.ts'; // ✅ पाथ सही करें

import { AuthenticatedRequest, verifyToken } from '../server/middleware/verifyToken';


import { requireAuth, requireSellerAuth, requireAdminAuth } from '../server/middleware/authMiddleware';


const router = Router();

// =========================================================================
// Helper Functions (Validation)
// =====================================================================
function validateProductInput(data: any, isUpdate: boolean = false) {
  const errors: string[] = [];

  // Product Name
  if (data.name !== undefined) { // अगर undefined नहीं है, तो चेक करें (चाहे update हो या create)
    if (typeof data.name !== 'string' || data.name.trim().length < 3) {
      errors.push("Product name must be a string of at least 3 characters.");
    }
  } else if (!isUpdate) { // केवल create करते समय name की आवश्यकता होती है
    errors.push("Product name is required.");
  }

  // Product Description (अगर स्कीमा में optional है, तो इसे थोड़ा ढीला कर सकते हो)
  if (data.description !== undefined) {
    if (typeof data.description !== 'string' || (data.description.trim().length > 0 && data.description.trim().length < 10)) {
        errors.push("Product description must be empty or a string of at least 10 characters.");
    }
  }
  // Optional: अगर description optional है और खाली स्ट्रिंग भी accept करते हो, तो ऊपर वाले 'else if (!isUpdate)' को हटा दो।
  // यदि description अनिवार्य है, तो 'else if (!isUpdate)' जोड़ो।

  // Price
  if (data.price !== undefined) {
    if (typeof data.price !== 'number' || data.price <= 0) {
      errors.push("Price must be a positive number.");
    }
  } else if (!isUpdate) {
    errors.push("Price is required.");
  }

  // Stock
  if (data.stock !== undefined) {
    if (typeof data.stock !== 'number' || data.stock < 0) {
      errors.push("Stock must be a non-negative number.");
    }
  } else if (!isUpdate) {
    errors.push("Stock is required.");
  }

  // Category ID
  if (data.categoryId !== undefined) {
    if (typeof data.categoryId !== 'number' || data.categoryId <= 0) {
      errors.push("Category ID must be a positive number.");
    }
  } else if (!isUpdate) {
    errors.push("Category ID is required.");
  }

  // Image (main)
  if (data.image !== undefined) {
    if (typeof data.image !== 'string' || !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(data.image)) { // ✅ .svg भी जोड़ा
      errors.push("Image must be a valid URL.");
    }
  } else if (!isUpdate) {
    errors.push("Main product image is required.");
  }
  
  // Images (array)
  if (data.images !== undefined) {
    if (!Array.isArray(data.images) || data.images.some((img: any) => typeof img !== 'string' || !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(img))) { // ✅ .svg भी जोड़ा
      errors.push("Additional images must be an array of valid URLs.");
    }
  }
  // images को create करते समय optional रखते हैं, इसलिए 'else if (!isUpdate)' नहीं जोड़ा

  // Unit
  if (data.unit !== undefined) {
    if (typeof data.unit !== 'string' || data.unit.trim().length === 0) {
      errors.push("Unit is required and must be a non-empty string.");
    }
  } else if (!isUpdate) { // स्कीमा में default है, लेकिन client-side validation के लिए अच्छा है
    errors.push("Unit is required.");
  }

  // Minimum Order Quantity
  if (data.minOrderQty !== undefined) {
    if (typeof data.minOrderQty !== 'number' || data.minOrderQty < 1) {
      errors.push("Minimum order quantity must be a positive number.");
    }
  } else if (!isUpdate) { // स्कीमा में default है, लेकिन client-side validation के लिए अच्छा है
      errors.push("Minimum order quantity is required.");
  }

  // Maximum Order Quantity
  if (data.maxOrderQty !== undefined) {
    if (typeof data.maxOrderQty !== 'number' || data.maxOrderQty < (data.minOrderQty || 1)) { // ✅ minOrderQty यहाँ पहले से मान्य माना गया है
      errors.push(`Maximum order quantity must be a number greater than or equal to minimum order quantity (${data.minOrderQty || 1}).`);
    }
  } else if (!isUpdate) { // स्कीमा में default है, लेकिन client-side validation के लिए अच्छा है
      errors.push("Maximum order quantity is required.");
  }
  
  // Delivery Scope
  if (data.deliveryScope !== undefined) {
    const validScopes = ['LOCAL', 'CITY', 'STATE', 'NATIONAL'];
    if (typeof data.deliveryScope !== 'string' || !validScopes.includes(data.deliveryScope)) {
      errors.push("Invalid delivery scope. Must be one of: " + validScopes.join(', '));
    }
  } else if (!isUpdate) {
      errors.push("Delivery scope is required.");
  }

  // Conditional delivery fields based on deliveryScope
  if (data.deliveryScope === 'LOCAL') {
    if (data.productDeliveryRadiusKM !== undefined) {
      if (typeof data.productDeliveryRadiusKM !== 'number' || data.productDeliveryRadiusKM <= 0) {
        errors.push("Product delivery radius (KM) must be a positive number for LOCAL scope.");
      }
    } else if (!isUpdate) {
        errors.push("Product delivery radius (KM) is required for LOCAL scope.");
    }
    // LOCAL scope के लिए pincodes की आवश्यकता नहीं है
  } else if (data.deliveryScope === 'CITY' || data.deliveryScope === 'STATE') {
    if (data.productDeliveryPincodes !== undefined) {
      if (!Array.isArray(data.productDeliveryPincodes) || data.productDeliveryPincodes.length === 0 || data.productDeliveryPincodes.some((p: any) => typeof p !== 'string' || p.length !== 6 || !/^\d+$/.test(p))) { // ✅ 6-digit number check
        errors.push("Product delivery pincodes must be a non-empty array of valid 6-digit strings for CITY/STATE scope.");
      }
    } else if (!isUpdate) {
        errors.push("Product delivery pincodes are required for CITY/STATE scope.");
    }
    // CITY/STATE scope के लिए radius की आवश्यकता नहीं है
  }
  // NATIONAL scope के लिए कोई विशेष डिलीवरी फ़ील्ड नहीं

  // Estimated Delivery Time
  if (data.estimatedDeliveryTime !== undefined) {
    if (typeof data.estimatedDeliveryTime !== 'string' || data.estimatedDeliveryTime.trim().length === 0) {
      errors.push("Estimated delivery time must be a non-empty string.");
    }
  } else if (!isUpdate) { // स्कीमा में default है, लेकिन client-side validation के लिए अच्छा है
      errors.push("Estimated delivery time is required.");
  }

  // Store ID (यदि प्रोडक्ट बनाते समय स्टोर ID की आवश्यकता है)
  if (data.storeId !== undefined) {
      if (typeof data.storeId !== 'number' || data.storeId <= 0) {
          errors.push("Store ID must be a positive number.");
      }
  } else if (!isUpdate) {
      errors.push("Store ID is required."); // यदि प्रत्येक प्रोडक्ट को एक स्टोर से लिंक करना अनिवार्य है
  }

  // Optional fields that don't need strict validation beyond type
  // nameHindi, descriptionHindi, originalPrice, brand
  if (data.nameHindi !== undefined && typeof data.nameHindi !== 'string') errors.push("Product Hindi name must be a string.");
  if (data.descriptionHindi !== undefined && typeof data.descriptionHindi !== 'string') errors.push("Product Hindi description must be a string.");
  if (data.originalPrice !== undefined && (typeof data.originalPrice !== 'number' || data.originalPrice <= 0)) errors.push("Original price must be a positive number.");
  if (data.brand !== undefined && typeof data.brand !== 'string') errors.push("Brand must be a string.");


  return errors;
}

// =========================================================================
// Seller-specific Product Management Routes (requires seller authentication)
// =========================================================================

// POST /api/products - Create a new product (Seller)
router.post('/', verifyToken,requireSellerAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
router.put('/:productId', verifyToken,requireSellerAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
router.delete('/:productId', verifyToken,requireSellerAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
router.get('/seller', verifyToken,requireSellerAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
router.get('/admin/pending', verifyToken,requireAdminAuth , async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
router.put('/admin/:productId/approve', verifyToken,requireAdminAuth , async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
router.put('/admin/:productId/reject', verifyToken,requireAdminAuth , async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

// GET /api/products
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  console.log("📄 [API] Received request to get all products for customer view.");

  try {
    const {
      categoryId,
      search,
      customerPincode,
      customerLat,
      customerLng,
      lat,
      lng,
      pincode,
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

    // ✅ Explicit string conversion for all possible fields
    const effectivePincode =
      (pincode?.toString() || customerPincode?.toString() || "").trim();

    // ✅ Safer numeric parsing
    const effectiveLatStr = lat?.toString() || customerLat?.toString() || "";
    const effectiveLngStr = lng?.toString() || customerLng?.toString() || "";

    const effectiveLat = effectiveLatStr ? parseFloat(effectiveLatStr) : NaN;
    const effectiveLng = effectiveLngStr ? parseFloat(effectiveLngStr) : NaN;

    // ✅ Customer location check (after safe parsing)
    if (!effectivePincode || isNaN(effectiveLat) || isNaN(effectiveLng)) {
      console.log("❌ Invalid or missing location parameters:", {
        effectivePincode,
        effectiveLat,
        effectiveLng,
      });
      return res.status(400).json({
        message: "Customer location (pincode, lat, lng) is required for filtering.",
      });
    }

    

    // 1. सभी स्वीकृत सेलर्स को उनकी डिलीवरी प्राथमिकताओं के साथ Fetch करें
    // 1. सभी स्वीकृत सेलर्स को उनकी डिलीवरी प्राथमिकताओं के साथ Fetch करें
const allApprovedSellers = await db
  .select()
  .from(sellersPgTable)
  .where(eq(sellersPgTable.approvalStatus, "approved")); // 🔥 केवल Approved Sellers के प्रोडक्ट दिखाएं

// ✅ हमेशा array initialize रखो
const deliverableSellerIds: number[] = [];
const distanceCheckPromises: Promise<void>[] = [];

for (const seller of allApprovedSellers) {
  if (!seller?.id || !seller?.userId) continue;

  if (seller.isDistanceBasedDelivery) {
    if (
      typeof seller.latitude === "number" &&
      typeof seller.longitude === "number" &&
      !isNaN(effectiveLat) &&
      !isNaN(effectiveLng) &&
      seller.deliveryRadius !== null &&
      seller.deliveryRadius !== undefined
    ) {
      distanceCheckPromises.push(
        (async () => {
          const distance = calculateDistanceKm(
            seller.latitude,
            seller.longitude,
            effectiveLat,
            effectiveLng
          );
          if (distance !== null && distance <= seller.deliveryRadius!) {
            deliverableSellerIds.push(seller.userId);
          }
        })()
      );
    } else {
      console.warn(
        `[ProductRoutes] Seller ${seller.id} chose distance-based delivery but missing or invalid location. Skipping.`
      );
    }
  } else {
    
      const sellerPincodes = seller.deliveryPincodes; 
      if (Array.isArray(sellerPincodes) && sellerPincodes.includes(effectivePincode)) {
        deliverableSellerIds.push(seller.userId);
           } else if (sellerPincodes === null || sellerPincodes === undefined) {
      
    
      console.warn(`[ProductRoutes] Seller ${seller.id} has null/undefined deliveryPincodes.`);
    } else {console.warn(`[ProductRoutes] Seller ${seller.id} deliveryPincodes is not an array:`, sellerPincodes);
    }
  
}

// ✅ सभी distance-check async tasks को पूरा होने दो
await Promise.all(distanceCheckPromises);

// ✅ Extra Safety Check — ताकि filter error दोबारा न आए
if (!Array.isArray(deliverableSellerIds)) {
  console.error("deliverableSellerIds is not an array!", deliverableSellerIds);
  return res.status(500).json({
    message: "Internal error: invalid deliverable seller list",
  });
}

// ✅ यदि कोई भी विक्रेता डिलीवर नहीं कर सकता है, तो खाली सूची लौटाएं
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
