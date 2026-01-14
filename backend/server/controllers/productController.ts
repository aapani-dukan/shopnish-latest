import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import {
  products,
  categories as productCategories,
  sellersPgTable,
  approvalStatusEnum,
} from '../../shared/backend/schema';
import { eq, like, inArray, and, desc, asc, sql } from 'drizzle-orm';
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

// =========================================================================
// Controller Functions
// =========================================================================

export const createProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🚀 [API] Received request to create a new product.");
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized: Seller user not authenticated." });

  try {
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
    if (!sellerProfile) return res.status(404).json({ message: "Seller profile not found." });

    const productData = req.body;
    if (req.file) {
  try {
    // 1. File path se asli data (Buffer) read karein
    const fileBuffer = fs.readFileSync(req.file.path);
    
    // 2. Buffer bhejein, path nahi (mimetype ke saath)
    productData.image = await uploadImage(
      fileBuffer,            // Pehla argument Buffer hai
      req.file.originalname, // Dusra argument FileName
      req.file.mimetype      // Teesra argument ContentType
    );
    
    // 3. Upload ke baad temporary file delete karna na bhoolein (Good Practice)
    fs.unlinkSync(req.file.path); 
    
  } catch (uploadError: any) {
    console.error("❌ Image upload failed:", uploadError);
    return res.status(500).json({ message: "Image upload failed." });
  }
}

    const validationErrors = validateProductInput(productData);
    if (validationErrors.length > 0) return res.status(400).json({ message: "Validation failed.", errors: validationErrors });

    const [newProduct] = await db.insert(products).values({
      name: productData.name,
      description: productData.description || null,
      price: productData.price,
      stock: productData.stock,
      categoryId: Number(productData.categoryId),
      originalPrice: productData.originalPrice ? Number(productData.originalPrice) : null, // ADDED
  brand: productData.brand || null, // ADDED
  
  
      sellerId: sellerProfile.id,
      image: productData.image || null,
      unit: productData.unit || 'unit',
      minOrderQty: productData.minOrderQty || 1,
      maxOrderQty: productData.maxOrderQty || null,
      approvalStatus: 'pending',
      isActive: productData.isActive ?? true,
      nameHindi: productData.nameHindi || null,
      descriptionHindi: productData.descriptionHindi || null,
      
    
      deliveryScope: productData.deliveryScope || 'NATIONAL',
      productDeliveryRadiusKM: productData.productDeliveryRadiusKM || null,
      productDeliveryPincodes: productData.productDeliveryPincodes || null,
      estimatedDeliveryTime: productData.estimatedDeliveryTime || '2-3 business days',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.status(201).json({ message: "Product created successfully. Awaiting admin approval.", product: newProduct });
  } catch (error) { next(error); }
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
  try {
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId!));
    const sellerProducts = await db.query.products.findMany({
      where: eq(products.sellerId, sellerProfile.id),
      with: { category: true },
      orderBy: [desc(products.createdAt)],
    });
    res.status(200).json({ message: "Seller products fetched.", products: sellerProducts.map(p => formatProductWithOffers(p)) });
  } catch (error) { next(error); }
};

export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId, search, customerPincode, customerLat, customerLng, lat, lng, pincode, minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 10 } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const effectivePincode = (pincode?.toString() || customerPincode?.toString() || "").trim();
    const effectiveLat = parseFloat(lat?.toString() || customerLat?.toString() || "");
    const effectiveLng = parseFloat(lng?.toString() || customerLng?.toString() || "");

    console.log("📍 Customer Location Data:", { effectivePincode, effectiveLat, effectiveLng });

    if (!effectivePincode || isNaN(effectiveLat) || isNaN(effectiveLng)) {
      return res.status(400).json({ message: "Customer location is required for filtering." });
    }

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
            const distance = await
            calculateDistanceKm(sLat, sLon, effectiveLat, effectiveLng);
            if (distance !== null && distance <= sRad) deliverableSellerIds.push(seller.id);
          })());
        }
      } else {
        if ((seller.deliveryPincodes as string[])?.includes(effectivePincode)) deliverableSellerIds.push(seller.id);
      }
    }
    await Promise.all(distanceCheckPromises);

    if (deliverableSellerIds.length === 0) return res.json({ products: [], total: 0 });

    const whereClauses = [
      inArray(products.sellerId, deliverableSellerIds),
      eq(products.approvalStatus, approvalStatusEnum.enumValues[1]),
      eq(products.isActive, true)
    ];
    if (search) whereClauses.push(like(products.name, `%${search}%`));
    if (categoryId) whereClauses.push(eq(products.categoryId, Number(categoryId)));
    if (minPrice) whereClauses.push(sql`${products.price} >= ${Number(minPrice)}`);
    if (maxPrice) whereClauses.push(sql`${products.price} <= ${Number(maxPrice)}`);

    const orderBy = [];
    if (sortBy === 'price') orderBy.push(sortOrder === 'asc' ? asc(products.price) : desc(products.price));
    else if (sortBy === 'name') orderBy.push(sortOrder === 'asc' ? asc(products.name) : desc(products.name));
    else orderBy.push(sortOrder === 'asc' ? asc(products.createdAt) : desc(products.createdAt));

    const [totalCount] = await db.select({ count: sql<number>`count(*)` }).from(products).where(and(...whereClauses));
    // getAllProducts function ke andar 'productList' wala part replace karein:
const productList = await db.query.products.findMany({
  where: and(...whereClauses),
  with: { 
    category: true, 
    seller: { 
      columns: {
        id: true,
        businessName: true,
        latitude: true,
        longitude: true,
        deliveryRadius: true,
        isDistanceBasedDelivery: true, // MISSING FIELD 1
        deliveryPincodes: true,        // MISSING FIELD 2
      },
      with: { user: true } 
    } 
  },
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
  } catch (error) { next(error); }
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