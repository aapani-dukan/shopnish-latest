// backend/routes/productRoutes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../server/db';
import {
  products,
  categories, // ✅ 'categories' की जगह 'productCategories' का उपयोग करें जैसा कि स्कीमा में होगा
  sellersPgTable,
  productCategories,
  approvalStatusEnum, // ✅ approvalStatusEnum इम्पोर्ट करें
  users, // यदि आवश्यक हो
} from '../shared/backend/schema.ts'; // ✅ पाथ सही करें
import { eq, like, inArray, and, desc, asc, sql } from 'drizzle-orm'; // ✅ desc, asc, sql इम्पोर्ट करें
import { calculateDistanceKm } from '../services/locationService.ts'; // ✅ पाथ सही करें
import { AuthenticatedRequest, verifyToken } from '../server/middleware/verifyToken';
import { requireAuth, requireSellerAuth, requireAdminAuth } from '../server/middleware/authMiddleware';
import { calculateDistanceKm } from '../services/locationService';

import { deleteImage, uploadImage } from '../server/cloudStorage'; // यदि आप इमेज अपलोड/डिलीट कर रहे हैं

const router = Router();
const upload = multer({ dest: 'uploads/' });

// =========================================================================
// Helper Functions (Validation)
// =====================================================================
function validateProductInput(data: any, isUpdate: boolean = false) {
  const errors: string[] = [];

  // Product Name
  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length < 3) {
      errors.push("Product name must be a string of at least 3 characters.");
    }
  } else if (!isUpdate) {
    errors.push("Product name is required.");
  }

  // Product Description
  if (data.description !== undefined) {
    if (typeof data.description !== 'string' || (data.description.trim().length > 0 && data.description.trim().length < 10)) {
      errors.push("Product description must be empty or a string of at least 10 characters.");
    }
  }

  // Price
  if (data.price !== undefined) {
    const priceNum = Number(data.price); // सुरक्षित रूप से नंबर में बदलें
    if (isNaN(priceNum) || priceNum <= 0) {
      errors.push("Price must be a positive number.");
    } else {
      data.price = priceNum; // सुनिश्चित करें कि यह अपडेटेड डेटा में नंबर के रूप में है
    }
  } else if (!isUpdate) {
    errors.push("Price is required.");
  }

  // Stock
  if (data.stock !== undefined) {
    const stockNum = Number(data.stock); // सुरक्षित रूप से नंबर में बदलें
    if (isNaN(stockNum) || stockNum < 0) {
      errors.push("Stock must be a non-negative number.");
    } else {
      data.stock = stockNum; // सुनिश्चित करें कि यह अपडेटेड डेटा में नंबर के रूप में है
    }
  } else if (!isUpdate) {
    errors.push("Stock is required.");
  }

  // Category ID
  if (data.categoryId !== undefined) {
    const categoryIdNum = Number(data.categoryId); // सुरक्षित रूप से नंबर में बदलें
    if (isNaN(categoryIdNum) || categoryIdNum <= 0) {
      errors.push("Category ID must be a positive number.");
    } else {
      data.categoryId = categoryIdNum; // सुनिश्चित करें कि यह अपडेटेड डेटा में नंबर के रूप में है
    }
  } else if (!isUpdate) {
    errors.push("Category ID is required.");
  }

  // Image (main) - URL validation
  if (data.image !== undefined) {
    if (typeof data.image !== 'string' || !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(data.image)) {
      errors.push("Image must be a valid URL.");
    }
  } else if (!isUpdate) {
    errors.push("Main product image is required.");
  }

  // Images (array) - URL validation
  if (data.images !== undefined) {
    if (!Array.isArray(data.images) || data.images.some((img: any) => typeof img !== 'string' || !/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(img))) {
      errors.push("Additional images must be an array of valid URLs.");
    }
  }

  // Unit
  if (data.unit !== undefined) {
    if (typeof data.unit !== 'string' || data.unit.trim().length === 0) {
      errors.push("Unit is required and must be a non-empty string.");
    }
  } else if (!isUpdate) {
    errors.push("Unit is required.");
  }

  // Minimum Order Quantity
  if (data.minOrderQty !== undefined) {
    const minOrderQtyNum = Number(data.minOrderQty); // सुरक्षित रूप से नंबर में बदलें
    if (isNaN(minOrderQtyNum) || minOrderQtyNum < 1) {
      errors.push("Minimum order quantity must be a positive number.");
    } else {
      data.minOrderQty = minOrderQtyNum;
    }
  } else if (!isUpdate) {
    errors.push("Minimum order quantity is required.");
  }

  // Maximum Order Quantity
  if (data.maxOrderQty !== undefined) {
    const maxOrderQtyNum = Number(data.maxOrderQty); // सुरक्षित रूप से नंबर में बदलें
    if (isNaN(maxOrderQtyNum) || maxOrderQtyNum < (data.minOrderQty || 1)) {
      errors.push(`Maximum order quantity must be a number greater than or equal to minimum order quantity (${data.minOrderQty || 1}).`);
    } else {
      data.maxOrderQty = maxOrderQtyNum;
    }
  } else if (!isUpdate) {
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
      const radiusNum = Number(data.productDeliveryRadiusKM); // सुरक्षित रूप से नंबर में बदलें
      if (isNaN(radiusNum) || radiusNum <= 0) {
        errors.push("Product delivery radius (KM) must be a positive number for LOCAL scope.");
      } else {
        data.productDeliveryRadiusKM = radiusNum;
      }
    } else if (!isUpdate) {
      errors.push("Product delivery radius (KM) is required for LOCAL scope.");
    }
  } else if (data.deliveryScope === 'CITY' || data.deliveryScope === 'STATE') {
    if (data.productDeliveryPincodes !== undefined) {
      if (!Array.isArray(data.productDeliveryPincodes) || data.productDeliveryPincodes.length === 0 || data.productDeliveryPincodes.some((p: any) => typeof p !== 'string' || p.length !== 6 || !/^\d+$/.test(p))) {
        errors.push("Product delivery pincodes must be a non-empty array of valid 6-digit strings for CITY/STATE scope.");
      }
    } else if (!isUpdate) {
      errors.push("Product delivery pincodes are required for CITY/STATE scope.");
    }
  }

  // Estimated Delivery Time
  if (data.estimatedDeliveryTime !== undefined) {
    if (typeof data.estimatedDeliveryTime !== 'string' || data.estimatedDeliveryTime.trim().length === 0) {
      errors.push("Estimated delivery time must be a non-empty string.");
    }
  } else if (!isUpdate) {
    errors.push("Estimated delivery time is required.");
  }

  // Store ID (यदि प्रोडक्ट बनाते समय स्टोर ID की आवश्यकता है)
  if (data.storeId !== undefined) {
    const storeIdNum = Number(data.storeId); // सुरक्षित रूप से नंबर में बदलें
    if (isNaN(storeIdNum) || storeIdNum <= 0) {
      errors.push("Store ID must be a positive number.");
    } else {
      data.storeId = storeIdNum;
    }
  } else if (!isUpdate) {
    // errors.push("Store ID is required."); // यदि प्रत्येक प्रोडक्ट को एक स्टोर से लिंक करना अनिवार्य है
  }

  // Optional fields that don't need strict validation beyond type
  if (data.nameHindi !== undefined && typeof data.nameHindi !== 'string') errors.push("Product Hindi name must be a string.");
  if (data.descriptionHindi !== undefined && typeof data.descriptionHindi !== 'string') errors.push("Product Hindi description must be a string.");
  if (data.originalPrice !== undefined) {
    const originalPriceNum = Number(data.originalPrice);
    if (isNaN(originalPriceNum) || originalPriceNum <= 0) errors.push("Original price must be a positive number.");
    else data.originalPrice = originalPriceNum;
  }
  if (data.brand !== undefined && typeof data.brand !== 'string') errors.push("Brand must be a string.");


  return errors;
}

// =========================================================================
// Seller-specific Product Management Routes (requires seller authentication)
// =========================================================================

// POST /api/products - Create a new product (Seller)
router.post('/', verifyToken, requireSellerAuth, upload.single('image'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🚀 [API] Received request to create a new product.");
  const userId = req.user?.id; // req.user.id अब यूजर का ID है, जो sellerProfile.userId से मेल खाता है

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: Seller user not authenticated." });
  }

  // सेलर का प्रोफाइल फेच करें ताकि sellerId प्राप्त किया जा सके
  const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
  if (!sellerProfile) {
    return res.status(404).json({ message: "Seller profile not found for the authenticated user." });
  }
  const sellerId = sellerProfile.id; // सही sellerId

  const productData = req.body;

  // यदि multer से फाइल आई है, तो image URL को productData में जोड़ें
  if (req.file) {
    try {
      productData.image = await uploadImage(req.file.path, req.file.originalname);
    } catch (uploadError: any) {
      console.error("❌ Image upload failed:", uploadError);
      return res.status(500).json({ message: "Image upload failed.", error: uploadError.message });
    }
  }

  const validationErrors = validateProductInput(productData);

  if (validationErrors.length > 0) {
    return res.status(400).json({ message: "Validation failed.", errors: validationErrors });
  }

  try {
    const [category] = await db.select().from(productCategories).where(eq(productCategories.id, productData.categoryId));
    if (!category) {
      return res.status(400).json({ message: "Invalid category ID provided." });
    }

    const [newProduct] = await db.insert(products).values({
      name: productData.name,
      description: productData.description || null,
      price: productData.price,
      stock: productData.stock,
      categoryId: productData.categoryId,
      sellerId: sellerId,
      image: productData.image || null, // इमेज URL या null
      unit: productData.unit || 'unit',
      minOrderQty: productData.minOrderQty || 1,
      maxOrderQty: productData.maxOrderQty || null,
      approvalStatus: approvalStatusEnum.enumValues[0], // 'pending'
      isActive: productData.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
      // यहाँ अन्य वैकल्पिक फ़ील्ड भी जोड़ें
      nameHindi: productData.nameHindi || null,
      descriptionHindi: productData.descriptionHindi || null,
      originalPrice: productData.originalPrice || null,
      brand: productData.brand || null,
      deliveryScope: productData.deliveryScope || 'NATIONAL', // Default
      productDeliveryRadiusKM: productData.productDeliveryRadiusKM || null,
      productDeliveryPincodes: productData.productDeliveryPincodes || null,
      estimatedDeliveryTime: productData.estimatedDeliveryTime || '2-3 business days',
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
router.put('/:productId', verifyToken, requireSellerAuth, upload.single('image'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log(`🔄 [API] Received request to update product ${req.params.productId}.`);
  const userId = req.user?.id;
  const productId = Number(req.params.productId);

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: Seller user not authenticated." });
  }
  if (isNaN(productId)) {
    return res.status(400).json({ message: "Invalid product ID." });
  }

  // सेलर का प्रोफाइल फेच करें ताकि sellerId प्राप्त किया जा सके
  const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
  if (!sellerProfile) {
    return res.status(404).json({ message: "Seller profile not found for the authenticated user." });
  }
  const sellerId = sellerProfile.id; // सही sellerId

  const updateData = req.body;

  // यदि multer से फाइल आई है, तो image URL को updateData में जोड़ें
  if (req.file) {
    try {
      // पुरानी इमेज को क्लाउड स्टोरेज से हटाने पर विचार करें
      const [existingProductForImageCheck] = await db.select({ image: products.image }).from(products).where(eq(products.id, productId));
      if (existingProductForImageCheck?.image) {
        console.log(`[INFO] Attempting to delete old image: ${existingProductForImageCheck.image}`);
        await deleteImage(existingProductForImageCheck.image);
      }
      updateData.image = await uploadImage(req.file.path, req.file.originalname);
    } catch (uploadError: any) {
      console.error("❌ Image upload failed:", uploadError);
      return res.status(500).json({ message: "Image upload failed.", error: uploadError.message });
    }
  }

  const validationErrors = validateProductInput(updateData, true); // isUpdate = true

  if (validationErrors.length > 0) {
    return res.status(400).json({ message: "Validation failed.", errors: validationErrors });
  }

  try {
    const [existingProduct] = await db.select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.sellerId, sellerId)));

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found or not owned by this seller." });
    }

    const allowedUpdates: Partial<typeof products.$inferInsert> = {};
    if (updateData.name !== undefined) allowedUpdates.name = updateData.name;
    if (updateData.description !== undefined) allowedUpdates.description = updateData.description;
    if (updateData.price !== undefined) allowedUpdates.price = updateData.price;
    if (updateData.stock !== undefined) allowedUpdates.stock = updateData.stock;
    if (updateData.categoryId !== undefined) {
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
    if (updateData.nameHindi !== undefined) allowedUpdates.nameHindi = updateData.nameHindi;
    if (updateData.descriptionHindi !== undefined) allowedUpdates.descriptionHindi = updateData.descriptionHindi;
    if (updateData.originalPrice !== undefined) allowedUpdates.originalPrice = updateData.originalPrice;
    if (updateData.brand !== undefined) allowedUpdates.brand = updateData.brand;
    if (updateData.deliveryScope !== undefined) allowedUpdates.deliveryScope = updateData.deliveryScope;
    if (updateData.productDeliveryRadiusKM !== undefined) allowedUpdates.productDeliveryRadiusKM = updateData.productDeliveryRadiusKM;
    if (updateData.productDeliveryPincodes !== undefined) allowedUpdates.productDeliveryPincodes = updateData.productDeliveryPincodes;
    if (updateData.estimatedDeliveryTime !== undefined) allowedUpdates.estimatedDeliveryTime = updateData.estimatedDeliveryTime;

    if (existingProduct.approvalStatus === approvalStatusEnum.enumValues[2]) { // 'rejected'
      allowedUpdates.approvalStatus = approvalStatusEnum.enumValues[0]; // 'pending'
    }

    allowedUpdates.updatedAt = new Date();

    const [updatedProduct] = await db.update(products)
      .set(allowedUpdates)
      .where(eq(products.id, productId))
      .returning();

    if (!updatedProduct) {
      return res.status(500).json({ message: "Failed to update product." });
    }

    res.status(200).json({
      message: "Product updated successfully. Awaiting admin approval if previously rejected.",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("❌ Error updating product:", error);
    next(error);
  }
});

// DELETE /api/products/:productId - Delete a product (Seller)
router.delete('/:productId', verifyToken, requireSellerAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log(`🗑️ [API] Received request to delete product ${req.params.productId}.`);
  const userId = req.user?.id; // req.user.id अब यूजर का ID है

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: Seller user not authenticated." });
  }
  if (isNaN(Number(req.params.productId))) {
    return res.status(400).json({ message: "Invalid product ID." });
  }
  const productId = Number(req.params.productId);

  // सेलर का प्रोफाइल फेच करें ताकि sellerId प्राप्त किया जा सके
  const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
  if (!sellerProfile) {
    return res.status(404).json({ message: "Seller profile not found for the authenticated user." });
  }
  const sellerId = sellerProfile.id; // सही sellerId

  try {
    // सुनिश्चित करें कि सेलर इस प्रोडक्ट का मालिक है
    const [existingProduct] = await db.select({ image: products.image }).from(products).where(and(eq(products.id, productId), eq(products.sellerId, sellerId)));
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found or not owned by this seller." });
    }

    // इमेज को क्लाउड स्टोरेज से हटा दें
    if (existingProduct.image) {
      console.log(`[INFO] Attempting to delete product image: ${existingProduct.image}`);
      await deleteImage(existingProduct.image);
    }

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
router.get('/seller', verifyToken, requireSellerAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("📦 [API] Received request to get seller's products.");
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: Seller user not authenticated." });
  }

  // सेलर का प्रोफाइल फेच करें ताकि sellerId प्राप्त किया जा सके
  const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
  if (!sellerProfile) {
    return res.status(404).json({ message: "Seller profile not found for the authenticated user." });
  }
  const sellerId = sellerProfile.id; // सही sellerId


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
router.get('/admin/pending', verifyToken, requireAdminAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
            // contactPerson: true, // स्कीमा में नहीं है
            // phoneNumber: true, // स्कीमा में नहीं है
            userId: true, // यूजर आईडी भी आवश्यक हो सकती है
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
router.put('/admin/:productId/approve', verifyToken, requireAdminAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
router.put('/admin/:productId/reject', verifyToken, requireAdminAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

    const effectivePincode =
      (pincode?.toString() || customerPincode?.toString() || "").trim();

    const effectiveLatStr = lat?.toString() || customerLat?.toString() || "";
    const effectiveLngStr = lng?.toString() || customerLng?.toString() || "";

    const effectiveLat = effectiveLatStr ? parseFloat(effectiveLatStr) : NaN;
    const effectiveLng = effectiveLngStr ? parseFloat(effectiveLngStr) : NaN;

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

    const allApprovedSellers = await db
      .select()
      .from(sellersPgTable)
      .where(eq(sellersPgTable.approvalStatus, "approved"));

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
          seller.deliveryRadius !== undefined &&
          seller.deliveryRadius > 0
        ) {
          distanceCheckPromises.push(
            (async () => {
              const distance = calculateDistanceKm(
                seller.latitude,
                seller.longitude,
                effectiveLat,
                effectiveLng
              );
              if (distance !== null && distance <= seller.deliveryRadius) {
                deliverableSellerIds.push(seller.userId);
              }
            })()
          );
        } else {
          console.warn(
            `[ProductRoutes] Seller ${seller.id} chose distance-based delivery but missing or invalid location/radius. Skipping.`,
            { latitude: seller.latitude, longitude: seller.longitude, deliveryRadius: seller.deliveryRadius }
          );
        }
      } else {
        const sellerPincodes = seller.deliveryPincodes;

        if (Array.isArray(sellerPincodes)) {
          if (sellerPincodes.includes(effectivePincode)) {
            deliverableSellerIds.push(seller.userId);
          }
        } else if (sellerPincodes === null || sellerPincodes === undefined) {
          console.warn(`[ProductRoutes] Seller ${seller.id} has null/undefined deliveryPincodes. Skipping pincode check.`);
        } else {
          console.warn(`[ProductRoutes] Seller ${seller.id} deliveryPincodes is not a valid array or null:`, sellerPincodes);
        }
      }
    }

    await Promise.all(distanceCheckPromises);

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
      inArray(products.sellerId, deliverableSellerIds),
      eq(products.approvalStatus, approvalStatusEnum.enumValues[1]), // 'approved'
      eq(products.isActive, true),
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
    } else {
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
            latitude: true, // ✅ संभावित TypeError फिक्स के लिए
            longitude: true, // ✅ संभावित TypeError फिक्स के लिए
            deliveryRadius: true, // ✅ संभावित TypeError फिक्स के लिए
            // contactPerson: true, // स्कीमा में नहीं है
            // phoneNumber: true, // स्कीमा में नहीं है
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
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
