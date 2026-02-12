import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import {
  products,
  masterProducts,
  categories as productCategories,
  sellersPgTable,
  approvalStatusEnum,
} from '../../shared/backend/schema';
import { eq,ilike, like, inArray, and, desc, asc, sql, or,SQL } from 'drizzle-orm';
import { calculateDistanceKm } from '../../services/locationService';
import { AuthenticatedRequest } from '../middleware/verifyToken';
import { deleteImage, uploadImage } from '../cloudStorage';
import { formatProductWithOffers } from '../../shared/productHelpers';
import fs from 'fs';
// =========================================================================
// Helper Functions (Validation) - 100% Exact as per your original file
// =========================================================================
export function validateProductInput(data: any, isUpdate: boolean = false) {
  const errors: string[] = [];

  // Name Validation
  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length < 3) {
      errors.push("Product name must be a string of at least 3 characters.");
    }
  } else if (!isUpdate) {
    errors.push("Product name is required.");
  }

  // Description Validation
  if (data.description !== undefined) {
    if (typeof data.description !== 'string' || (data.description.trim().length > 0 && data.description.trim().length < 10)) {
      errors.push("Product description must be empty or a string of at least 10 characters.");
    }
  }

  // Price Validation
  if (data.price !== undefined) {
    const priceNum = Number(data.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      errors.push("Price must be a positive number.");
    } else {
      data.price = priceNum;
    }
  } else if (!isUpdate) {
    errors.push("Price is required.");
  }

  // Stock Validation
  if (data.stock !== undefined) {
    const stockNum = Number(data.stock);
    if (isNaN(stockNum) || stockNum < 0) {
      errors.push("Stock must be a non-negative number.");
    } else {
      data.stock = stockNum;
    }
  } else if (!isUpdate) {
    errors.push("Stock is required.");
  }

  // Image Logic
  if (data.image !== undefined) {
    if (typeof data.image !== "string" || !/^https?:\/\/.+/i.test(data.image)) {
      errors.push("Image must be a valid URL.");
    }
  } else if (!isUpdate) {
    errors.push("Main product image is required.");
  }

  // Additional Images Array Validation
  if (data.images !== undefined) {
    if (!Array.isArray(data.images) || data.images.some((img: any) => typeof img !== "string" || !/^https?:\/\/.+/i.test(img))) {
      errors.push("Additional images must be an array of valid URLs.");
    }
  }
// 1. ADD HINDI & BRAND VALIDATION (Hindi support ke liye)
  if (data.nameHindi !== undefined && typeof data.nameHindi !== 'string') errors.push("Product Hindi name must be a string.");
  if (data.descriptionHindi !== undefined && typeof data.descriptionHindi !== 'string') errors.push("Product Hindi description must be a string.");
  if (data.brand !== undefined && typeof data.brand !== 'string') errors.push("Brand must be a string.");

  
  // Delivery Radius & Pincode Logic (Very Important for Shopnish)
  // 3. Delivery Radius & Pincode Logic (Cleaned - No Duplicates)
  if (data.deliveryScope === 'LOCAL') {
    if (data.productDeliveryRadiusKM !== undefined) {
      const radiusNum = Number(data.productDeliveryRadiusKM);
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
      if (!Array.isArray(data.productDeliveryPincodes) || 
          data.productDeliveryPincodes.length === 0 || 
          data.productDeliveryPincodes.some((p: any) => typeof p !== 'string' || p.length !== 6 || !/^\d+$/.test(p))) {
        errors.push("Product delivery pincodes must be a non-empty array of valid 6-digit strings.");
      }
    } else if (!isUpdate) {
      errors.push("Product delivery pincodes are required for CITY/STATE scope.");
    }
  }

  // Unit & Qty
  if (data.unit !== undefined) {
    if (typeof data.unit !== 'string' || data.unit.trim().length === 0) errors.push("Unit is required.");
  } else if (!isUpdate) errors.push("Unit is required.");

  if (data.minOrderQty !== undefined) {
    const minNum = Number(data.minOrderQty);
    if (isNaN(minNum) || minNum < 1) errors.push("Minimum order quantity must be a positive number.");
    else data.minOrderQty = minNum;
  } else if (!isUpdate) errors.push("Minimum order quantity is required.");

  if (data.maxOrderQty !== undefined) {
    const maxNum = Number(data.maxOrderQty);
    if (isNaN(maxNum) || maxNum < (data.minOrderQty || 1)) errors.push(`Maximum order quantity must be >= minimum order quantity.`);
    else data.maxOrderQty = maxNum;
  } else if (!isUpdate) errors.push("Maximum order quantity is required.");

  return errors;
}
// backend/controllers/productController.ts



export const searchMasterProducts = async (req: any, res: any) => {
  const { q, categoryId } = req.query;

  try {
    const conditions: SQL[] = [];

    // 1. अगर कैटेगरी आईडी भेजी गई है, तो उसे फिल्टर में जोड़ें
    if (categoryId && categoryId !== 'all' && categoryId !== ' ') {
      conditions.push(eq(masterProducts.categoryId, Number(categoryId)));
    }

    // 2. अगर सर्च टर्म (q) भेजा गया है और 2 अक्षर से बड़ा है
    if (q && q.length >= 2) {
      conditions.push(
        or(
          ilike(masterProducts.name, `%${q}%`),
          ilike(masterProducts.brand, `%${q}%`)
        ) as SQL
      );
    }

    // 3. अगर न कैटेगरी है न सर्च, तो खाली लिस्ट भेजें
    if (conditions.length === 0) {
      return res.json([]);
    }

    const results = await db
      .select()
      .from(masterProducts)
      .where(and(...conditions)) // category AND (name OR brand)
      .limit(50); // बल्क मोड है इसलिए लिमिट थोड़ी बढ़ा दी है

    res.json(results);
  } catch (error) {
    console.error("Master search error:", error);
    res.status(500).json({ message: "खोजने में समस्या आई" });
  }
};

// 2. बल्क अपलोड के लिए (जो हमने पहले डिस्कस किया था)
export const bulkUploadProducts = async (req: any, res: any) => {
  try {
    const productsData = req.body;
    if (!Array.isArray(productsData)) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    await db.insert(masterProducts).values(productsData).onConflictDoUpdate({
      target: masterProducts.masterSku,
      set: {
        name: sql`excluded.name`,
        image: sql`excluded.image`,
        // बाकी फ़ील्ड्स जो अपडेट करनी हों
      },
    });

    res.json({ message: "Bulk products uploaded successfully" });
  } catch (error) {
    console.error("Bulk upload error:", error);
    res.status(500).json({ error: "Failed to upload bulk products" });
  }
};
// =========================================================================
// Controller Functions
// =========================================================================

export const createProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🚀 [API] Creating Product - Hybrid Mode (Master/Manual)");
  
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized: Seller not authenticated." });

  try {
    // 1. सेलर प्रोफाइल चेक करना
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
    if (!sellerProfile) return res.status(404).json({ message: "Seller profile not found." });

    const productData = req.body;

    // 2. इमेज हैंडलिंग (पुरानी Multer/File logic हटा दी क्योंकि अब Cloudinary URL सीधा body में आ रहा है)
    // अगर फिर भी कोई फाइल आती है (बैकअप के लिए), तो आप पुरानी लॉजिक रख सकते हैं, 
    // लेकिन अब 'productData.image' सीधा Frontend से मिलेगा।

    // 3. डेटाबेस में इंसर्ट (Hybrid Fields के साथ)
    const [newProduct] = await db.insert(products).values({
      // --- Hybrid Fields ---
      masterProductId: productData.masterProductId ? Number(productData.masterProductId) : null,
      
      // --- Basic Info ---
      name: productData.name,
      description: productData.description || null,
      price: String(productData.price),
      stock: Number(productData.stock),
      categoryId: productData.categoryId ? Number(productData.categoryId) : null,
      image: productData.image || null, // Cloudinary URL यहाँ आएगा
      
      // --- Advanced Info (जो आपने दी थी) ---
      originalPrice: productData.originalPrice ? String(productData.originalPrice) : null,
      brand: productData.brand || null,
      sellerId: sellerProfile.id,
      unit: productData.unit || 'unit',
      minOrderQty: Number(productData.minOrderQty) || 1,
      maxOrderQty: productData.maxOrderQty ? Number(productData.maxOrderQty) : null,
      approvalStatus: 'pending',
      isActive: productData.isActive ?? true,
      
      // --- Localization ---
      nameHindi: productData.nameHindi || null,
      descriptionHindi: productData.descriptionHindi || null,
      
      // --- Shipping & Delivery ---
      deliveryScope: productData.deliveryScope || 'NATIONAL',
      productDeliveryRadiusKM: productData.productDeliveryRadiusKM ? Number(productData.productDeliveryRadiusKM) : null,
      productDeliveryPincodes: productData.productDeliveryPincodes || null,
      estimatedDeliveryTime: productData.estimatedDeliveryTime || '2-3 business days',
      
      createdAt: new Date(),
      updatedAt: new Date(),
    }as any).returning();

    console.log("✅ Product Created Successfully:", newProduct.id);
    res.status(201).json({ 
      message: "Product created successfully. Awaiting admin approval.", 
      product: newProduct 
    });

  } catch (error) { 
    console.error("❌ Create Product Error:", error);
    next(error); 
  }
};
    
// backend/controllers/productController.ts

export const bulkCreateProducts = async (req: any, res: Response) => {
  try {
    const { products: productsList } = req.body;
    const userId = req.user?.id; // यह आपकी User ID (34) है

    if (!Array.isArray(productsList) || productsList.length === 0) {
      return res.status(400).json({ error: "कोई उत्पाद नहीं मिला।" });
    }

    // 1. User ID का इस्तेमाल करके Sellers टेबल से असली Seller ID (10) निकालें
    const sellerData = await db
      .select()
      .from(sellersPgTable)
      .where(eq(sellersPgTable.userId, userId))
      .limit(1);

    // अगर सेलर प्रोफाइल नहीं मिलता
    if (!sellerData.length) {
      return res.status(404).json({ error: "सेलर प्रोफाइल नहीं मिला। कृपया पहले सेलर रजिस्टर करें।" });
    }

    const realSellerId = sellerData[0].id; // यहाँ अब 10 आ जाएगा ✅

    // 2. पेलोड तैयार करें (असली Seller ID के साथ)
    const productsToInsert: any[] = productsList.map((p: any) => ({
      sellerId: realSellerId, // अब यहाँ 10 जाएगा, जिससे Foreign Key Error नहीं आएगा
      masterProductId: p.masterProductId,
      name: p.name,
      image: p.image,
      categoryId: p.categoryId,
      price: p.price.toString(), // Decimal के लिए string में बदलना सुरक्षित है
      stock: p.stock,
      isActive: true,
      approvalStatus: 'approved' as const, // Type safety के लिए
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await db.insert(products).values(productsToInsert);
    res.status(201).json({ message: `${productsList.length} products added successfully!` });
  } catch (error) {
    console.error("Bulk Insert Error:", error);
    res.status(500).json({ error: "Bulk upload failed" });
  }
};
export const updateProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log(`🔄 [API] Received request to update product ${req.params.productId}.`);
  const userId = req.user?.id;
  const productId = Number(req.params.productId);
  try {
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId!));
    if (!sellerProfile) return res.status(404).json({ message: "Seller profile not found." });

    // backend/server/controllers/productController.ts -> updateProduct method
const updateData = req.body;
if (req.file) {
  try {
    // 1. Purani image delete karne ka logic (Jo aapki original file mein tha)
    const [existingProductForImageCheck] = await db.select({ image: products.image })
      .from(products)
      .where(eq(products.id, productId));
      
    if (existingProductForImageCheck?.image) {
      console.log(`[INFO] Attempting to delete old image: ${existingProductForImageCheck.image}`);
      await deleteImage(existingProductForImageCheck.image);
    }

    // 2. Nayi image ko Buffer mein convert karein
    const fileBuffer = fs.readFileSync(req.file.path);

    // 3. uploadImage ko 3 arguments dein: Buffer, Name, aur ContentType (mimetype)
    updateData.image = await uploadImage(
      fileBuffer,            // Pehla argument: Buffer
      req.file.originalname, // Dusra argument: FileName
      req.file.mimetype      // Teesra argument: ContentType (Line 198 ka fix)
    );

    // 4. Temporary file ko delete karein
    fs.unlinkSync(req.file.path);

  } catch (uploadError: any) {
    console.error("❌ Image upload failed during update:", uploadError);
    return res.status(500).json({ message: "Image upload failed.", error: uploadError.message });
  }
}

    const validationErrors = validateProductInput(updateData, true);
    if (validationErrors.length > 0) return res.status(400).json({ message: "Validation failed.", errors: validationErrors });

    const [updatedProduct] = await db.update(products).set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(products.id, productId), eq(products.sellerId, sellerProfile.id)))
      .returning();

    res.status(200).json({ message: "Product updated successfully.", product: updatedProduct });
  } catch (error) { next(error); }
};

export const deleteProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const productId = Number(req.params.productId);
  const userId = req.user?.id;
  try {
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId!));
    const [existing] = await db.select({ image: products.image }).from(products).where(and(eq(products.id, productId), eq(products.sellerId, sellerProfile.id)));
    if (existing?.image) await deleteImage(existing.image);
    await db.delete(products).where(and(eq(products.id, productId), eq(products.sellerId, sellerProfile.id)));
    res.status(200).json({ message: "Product deleted successfully." });
  } catch (error) { next(error); }
};

export const getSellerProducts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  
  // 1. सुरक्षा: अगर userId ही नहीं है
  if (!userId) return res.status(401).json({ message: "User not authenticated" });

  try {
    // 2. सेलर प्रोफाइल निकालें
    const [sellerProfile] = await db
      .select()
      .from(sellersPgTable)
      .where(eq(sellersPgTable.userId, userId));

    // 3. 🚨 फिक्स: अगर प्रोफाइल नहीं मिली तो एरर रोकें
    if (!sellerProfile) {
      console.log("⚠️ No seller profile found for user:", userId);
      return res.status(200).json({ message: "No profile, no products.", products: [] });
    }

    // 4. अब क्वेरी करें (पक्का करें कि ID नंबर है)
    const sellerProducts = await db.query.products.findMany({
      where: eq(products.sellerId, Number(sellerProfile.id)), // Number() में रैप करना सुरक्षित है
      with: { category: true },
      orderBy: [desc(products.createdAt)],
    });

    // 5. फॉर्मेट करके भेजें
    const formattedProducts = sellerProducts.map(p => formatProductWithOffers(p));
    
    res.status(200).json({ 
      message: "Seller products fetched.", 
      products: formattedProducts 
    });

  } catch (error) { 
    console.error("❌ getSellerProducts Error:", error);
    next(error); 
  }
};

export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      categoryId, sellerId, search, pincode, lat, lng, 
      customerPincode, customerLat, customerLng,
      minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 10 
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    // 1. Location Data Extract Karein
    const effectivePincode = (pincode?.toString() || customerPincode?.toString() || "").trim();
    const effectiveLat = parseFloat(lat?.toString() || customerLat?.toString() || "");
    const effectiveLng = parseFloat(lng?.toString() || customerLng?.toString() || "");

    // 2. Base Conditions (Approved & Active)
    const whereClauses = [
      eq(products.approvalStatus, approvalStatusEnum.enumValues[1]),
      eq(products.isActive, true)
    ];

    // 3. ✅ SMART FILTERING LOGIC
    if (sellerId) {
      // CASE A: स्पेसिफिक दुकान के लिए - सीधा ID से फ़िल्टर (लोकेशन बाईपास)
      whereClauses.push(eq(products.sellerId, Number(sellerId)));
    } 
    else {
      // CASE B: कैटेगरी या जनरल सर्च के लिए - लोकेशन अनिवार्य है!
      if (!effectivePincode || isNaN(effectiveLat) || isNaN(effectiveLng)) {
        return res.status(400).json({ message: "Sahi area ke products dikhane ke liye location zaroori hai." });
      }

      // अपने एरिया (Bundi vs Kota) के सेलर्स ढूंढें
      const allApprovedSellers = await db.select().from(sellersPgTable).where(eq(sellersPgTable.approvalStatus, "approved"));
      const deliverableSellerIds: number[] = [];
      const distanceCheckPromises: Promise<void>[] = [];

      for (const seller of allApprovedSellers) {
        const sLat = parseFloat(seller.latitude?.toString() || '');
        const sLon = parseFloat(seller.longitude?.toString() || '');
        const sRad = parseFloat(seller.deliveryRadius?.toString() || '');

        if (seller.isDistanceBasedDelivery) {
          if (!isNaN(sLat) && !isNaN(sLon) && sRad > 0) {
            distanceCheckPromises.push((async () => {
              const distance = await calculateDistanceKm(sLat, sLon, effectiveLat, effectiveLng);
              if (distance !== null && distance <= sRad) deliverableSellerIds.push(seller.id);
            })());
          }
        } else {
          if ((seller.deliveryPincodes as string[])?.includes(effectivePincode)) {
            deliverableSellerIds.push(seller.id);
          }
        }
      }
      await Promise.all(distanceCheckPromises);

      // अगर एरिया में कोई सेलर नहीं है, तो खाली एरे भेजें
      if (deliverableSellerIds.length === 0) return res.json({ products: [], total: 0 });
      
      // सिर्फ उन सेलर्स के प्रोडक्ट दिखाएं जो आपके एरिया में डिलीवरी दे सकते हैं
      whereClauses.push(inArray(products.sellerId, deliverableSellerIds));
    }

    // 4. Extra Filters (जैसे कैटेगरी, सर्च, प्राइस)
    if (categoryId) whereClauses.push(eq(products.categoryId, Number(categoryId)));
    if (search) {
  // ilike का मतलब है "Insensitive Like" - यह H और h में फर्क नहीं करेगा
  whereClauses.push(ilike(products.name, `%${search}%`));
}
    if (minPrice) whereClauses.push(sql`${products.price} >= ${Number(minPrice)}`);
    if (maxPrice) whereClauses.push(sql`${products.price} <= ${Number(maxPrice)}`);

    // 5. Sorting Logic
    const orderBy = [];
    if (sortBy === 'price') orderBy.push(sortOrder === 'asc' ? asc(products.price) : desc(products.price));
    else if (sortBy === 'name') orderBy.push(sortOrder === 'asc' ? asc(products.name) : desc(products.name));
    else orderBy.push(desc(products.createdAt));

    // 6. Execute Queries
    const [totalCount] = await db.select({ count: sql<number>`count(*)` }).from(products).where(and(...whereClauses));
    
    const productList = await db.query.products.findMany({
      where: and(...whereClauses),
      with: { category: true, seller: { with: { user: true } } },
      orderBy: orderBy,
      limit: limitNum,
      offset: offset,
    });

    res.status(200).json({
      page: pageNum,
      limit: limitNum,
      total: totalCount?.count || 0,
      totalPages: Math.ceil((totalCount?.count || 0) / limitNum),
      products: productList.map(p => formatProductWithOffers(p)),
    });

  } catch (error) { 
    console.error("Fetch Error:", error);
    next(error); 
  }
};
export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, Number(req.params.id)), eq(products.isActive, true), eq(products.approvalStatus, approvalStatusEnum.enumValues[1])),
      with: { category: true, seller: { with: { user: true } } }
    });
    if (!product) return res.status(404).json({ message: "Product not found." });
    res.status(200).json(formatProductWithOffers(product));
  } catch (error) { next(error); }
};

export const getPendingProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = await db.query.products.findMany({
      where: eq(products.approvalStatus, approvalStatusEnum.enumValues[0]),
      with: { category: true, seller: true },
      orderBy: [desc(products.createdAt)],
    });
    res.status(200).json(pending);
  } catch (error) { next(error); }
};

export const approveProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [updated] = await db.update(products).set({ approvalStatus: approvalStatusEnum.enumValues[1], updatedAt: new Date() })
      .where(eq(products.id, Number(req.params.productId))).returning();
    res.status(200).json({ message: "Approved", product: updated });
  } catch (error) { next(error); }
};

export const rejectProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [updated] = await db.update(products).set({ approvalStatus: approvalStatusEnum.enumValues[2], rejectionReason: req.body.reason, updatedAt: new Date() })
      .where(eq(products.id, Number(req.params.productId))).returning();
    res.status(200).json({ message: "Rejected", product: updated });
  } catch (error) { next(error); }
};