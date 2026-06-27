import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import {
  products,
  productVariants,
  products as sellerProducts, 
  masterProducts,
  categories as productCategories,
  sellersPgTable,
  categorySubcategories,
  subcategories,
  productSubcategories,
  approvalStatusEnum,
} from '../../shared/backend/schema';
import { eq,ilike, like, inArray, and, desc, asc, sql, or,SQL, isNull,isNotNull,notExists,exists } from 'drizzle-orm';
import { calculateDistanceKm } from '../../services/locationService';
import { AuthenticatedRequest } from '../middleware/verifyToken';
import { deleteImage, uploadImage } from '../cloudStorage';
import { formatProductWithOffers } from '../../shared/productHelpers';
import fs from 'fs';
import {ProductService} from '../../services/productService'

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

  // 🎯 फिक्स: अब टॉप लेवल price/stock के बजाय वैरिएंट्स एरे को वैलिडेट करेंगे भाई!
  if (data.variants !== undefined) {
    if (!Array.isArray(data.variants) || data.variants.length === 0) {
      errors.push("Variants must be a non-empty array भाई।");
    } else {
      data.variants.forEach((v: any, index: number) => {
        // वैरिएंट प्राइस चेक
        if (v.price !== undefined) {
          const priceNum = Number(v.price);
          if (isNaN(priceNum) || priceNum <= 0) {
            errors.push(`Variant [${index}] price must be a positive number.`);
          } else {
            v.price = priceNum;
          }
        } else if (!isUpdate) {
          errors.push(`Price is required for variant [${index}].`);
        }

        // वैरिएंट स्टॉक चेक
        if (v.stock !== undefined) {
          const stockNum = Number(v.stock);
          if (isNaN(stockNum) || stockNum < 0) {
            errors.push(`Variant [${index}] stock must be a non-negative number.`);
          } else {
            v.stock = stockNum;
          }
        } else if (!isUpdate) {
          errors.push(`Stock is required for variant [${index}].`);
        }

        // वैरिएंट क्वांटिटी वैल्यू चेक (e.g. 250, 1, 5)
        if (!isUpdate && (v.quantityValue === undefined || String(v.quantityValue).trim().length === 0)) {
          errors.push(`Quantity value is required for variant [${index}].`);
        }
      });
    }
  } else if (!isUpdate) {
    errors.push("Product variants array is required بھائی।");
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

  // Localization & Brand Support
  if (data.nameHindi !== undefined && typeof data.nameHindi !== 'string') errors.push("Product Hindi name must be a string.");
  if (data.descriptionHindi !== undefined && typeof data.descriptionHindi !== 'string') errors.push("Product Hindi description must be a string.");
  if (data.brand !== undefined && typeof data.brand !== 'string') errors.push("Brand must be a string.");

  // Delivery Radius & Pincode Logic
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

  // Order Limit Logic
  if (data.minOrderQty !== undefined) {
    const minNum = Number(data.minOrderQty);
    if (isNaN(minNum) || minNum < 1) errors.push("Minimum order quantity must be a positive number.");
    else data.minOrderQty = minNum;
  }

  if (data.maxOrderQty !== undefined) {
    const maxNum = Number(data.maxOrderQty);
    if (isNaN(maxNum) || maxNum < (data.minOrderQty || 1)) errors.push(`Maximum order quantity must be >= minimum order quantity.`);
    else data.maxOrderQty = maxNum;
  }

  return errors;
}

export const searchMasterProducts = async (req: any, res: any) => {
  const { q, categoryId, subCategoryId } = req.query;
  const sellerId = req.user?.id; // 🔑 करंट लॉगिन सेलर की आईडी निकालना बहुत ज़रूरी है भाई!

  try {
    const conditions: SQL[] = [];

    // 1. अगर कैटेगरी आईडी भेजी गई है, तो उसे फिल्टर में जोड़ें
    if (categoryId && categoryId !== 'all' && categoryId !== ' ' && categoryId !== 'All') {
      conditions.push(eq(masterProducts.categoryId, Number(categoryId)));
    }
// 🎯 SUBCATEGORY FILTER
if (
  subCategoryId &&
  subCategoryId !== 'all' &&
  subCategoryId !== ' '
) {
  console.log("FILTERING SUBCATEGORY =", subCategoryId);

  conditions.push(
    exists(
      db
        .select()
        .from(productSubcategories)
        .where(
          and(
            eq(
              productSubcategories.masterProductId,
              masterProducts.id
            ),
            eq(
              productSubcategories.subCategoryId,
              Number(subCategoryId)
            )
          )
        )
    )
  );
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

    // 3. 🛡️ जादुई फ़िल्टर: केवल वही प्रोडक्ट्स लाओ जो इस दुकानदार ने अपनी दुकान में ADD नहीं किए हैं!
    if (sellerId) {
      conditions.push(
        notExists(
          db
            .select()
            .from(sellerProducts) // आपकी वो टेबल जहाँ वेंडर के खुद के एडेड प्रोडक्ट्स स्टोर होते हैं
            .where(
              and(
                eq(sellerProducts.masterProductId, masterProducts.id), // मास्टर आईडी की मैपिंग
                eq(sellerProducts.sellerId, sellerId) // सिर्फ इसी वेंडर का चेक
              )
            )
        )
      );
    }

    // 4. अगर न कैटेगरी है न सर्च, और कोई कंडीशन नहीं बनी तो खाली लिस्ट भेजें
    // (नोट: अगर आप चाहते हैं कि बिना सर्च के भी कैटेगरी पर क्लिक करते ही सब दिख जाए, तो conditions.length === 0 की जाँच हटा भी सकते हैं)
    if (conditions.length === 0) {
      return res.json([]);
    }

    const results = await db
      .select()
      .from(masterProducts)
      .where(and(...conditions)); // category AND (name OR brand) AND NOT_ALREADY_ADDED
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
  console.log("🚀 [API] Creating Product - Variant Aware Hybrid Mode بھائی");
  
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized: Seller not authenticated." });

  try {
    // 1. सेलर प्रोफाइल चेक करना
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
    if (!sellerProfile) return res.status(404).json({ message: "Seller profile not found." });

    const productData = req.body;
const validationErrors = validateProductInput(productData, false);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: "Validation failed.", errors: validationErrors });
    }
    // 🎯 फिक्स: फ्रंटएंड से वैरिएंट्स का एरे (variants) आना अनिवार्य है भाई!
    // फ्रंटएंड पेलोड का फॉर्मेट ऐसा होना चाहिए: variants: [{ quantityValue: "250", unit: "gm", price: 100, stock: 50, originalPrice: 120 }]
    const variants = productData.variants;
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ message: "At least one product variant (size/price) is required bhai!" });
    }

    // 2. ⚡ पूरा इंसर्शन ट्रांजेक्शन के अंदर सुरक्षित करें ताकि डेटा मिसमैच न हो भाई
    const result = await db.transaction(async (tx) => {
      
      // a) मुख्य प्रोडक्ट को 'products' टेबल में डालें (बिना price और stock के भाई)
      const [newProduct] = await tx.insert(products).values({
        masterProductId: productData.masterProductId ? Number(productData.masterProductId) : null,
        name: productData.name,
        description: productData.description || null,
        categoryId: productData.categoryId ? Number(productData.categoryId) : null,
        image: productData.image || null,
        brand: productData.brand || null,
        sellerId: sellerProfile.id,
        approvalStatus: 'pending',
        isActive: productData.isActive ?? true,
        
        nameHindi: productData.nameHindi || null,
        descriptionHindi: productData.descriptionHindi || null,
        
        deliveryScope: productData.deliveryScope || 'NATIONAL',
        productDeliveryRadiusKM: productData.productDeliveryRadiusKM ? Number(productData.productDeliveryRadiusKM) : null,
        productDeliveryPincodes: productData.productDeliveryPincodes || null,
        estimatedDeliveryTime: productData.estimatedDeliveryTime || '2-3 business days',
        
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any).returning();

      if (!newProduct) throw new Error("Master product creation failed.");

      // b) 🎯 लूप चलाकर सारे वैरिएंट्स को 'productVariants' टेबल में डालें भाई!
      const insertedVariants = [];
      for (const variant of variants) {
        const [insertedVariant] = await tx.insert(productVariants).values({
          productId: newProduct.id, // मुख्य प्रोडक्ट की आईडी बाइंड कर दी भाई
          quantityValue: String(variant.quantityValue), // e.g. "500"
          unit: variant.unit || productData.unit || 'piece', // e.g. "gm"
          price: Number(variant.price), // सेलिंग प्राइस
          originalPrice: variant.originalPrice ? Number(variant.originalPrice) : null, // MRP
          stock: Number(variant.stock ?? 0), // स्टॉक लिमिट
          minOrderQty: Number(variant.minOrderQty) || Number(productData.minOrderQty) || 1,
          maxOrderQty: variant.maxOrderQty ? Number(variant.maxOrderQty) : (productData.maxOrderQty ? Number(productData.maxOrderQty) : null),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any).returning();

        insertedVariants.push(insertedVariant);
      }

      return { product: newProduct, variants: insertedVariants };
    });

    console.log("✅ Product & Variants Created Successfully:", result.product.id);
    return res.status(201).json({ 
      message: "Product and its variants created successfully. Awaiting admin approval.", 
      product: result.product,
      variants: result.variants
    });

  } catch (error: any) { 
    console.error("❌ Create Product Error:", error);
    return res.status(500).json({ message: error?.message || "Failed to create product." });
  }
};
    
// backend/controllers/productController.ts

export const bulkCreateProducts = async (req: any, res: Response) => {
  try {
    const { products: productsList } = req.body;
    const userId = req.user?.id;

    if (!Array.isArray(productsList) || productsList.length === 0) {
      return res.status(400).json({ error: "कोई उत्पाद नहीं मिला भाई।" });
    }

    // 1. User ID का इस्तेमाल करके Sellers टेबल से असली Seller ID निकालें
    const sellerData = await db
      .select()
      .from(sellersPgTable)
      .where(eq(sellersPgTable.userId, userId))
      .limit(1);

    if (!sellerData.length) {
      return res.status(404).json({ error: "सेलर प्रोफाइल नहीं मिला। कृपया पहले सेलर रजिस्टर करें।" });
    }

    const realSellerId = sellerData[0].id;

    // 2. ⚡ पूरा बल्क इंसर्शन एक ट्रांजेक्शन में लपेटें भाई
    await db.transaction(async (tx) => {
      for (const p of productsList) {
        // a) मुख्य प्रोडक्ट इन्फो डालें भाई
        const [newProduct] = await tx.insert(products).values({
          sellerId: realSellerId,
          masterProductId: p.masterProductId ? Number(p.masterProductId) : null,
          name: p.name,
          image: p.image || null,
          categoryId: p.categoryId ? Number(p.categoryId) : null,
          isActive: true,
          approvalStatus: 'approved', // एडमिन से डायरेक्ट अप्रूव्ड डेटा के लिए भाई
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any).returning();

        if (!newProduct) throw new Error("Bulk insert failed at master level.");

        // b) 🎯 वैरिएंट्स टेबल में इसका डिफ़ॉल्ट वैरिएंट बनाएँ भाई!
        // अगर फ्रंटएंड पेलोड में 'variants' एरे है तो उसपर लूप चलाएँ, नहीं तो फ्लैट प्राइस/स्टॉक को ही बेस वैरिएंट बना दें भाई
        const variantsToInsert = p.variants && Array.isArray(p.variants) ? p.variants : [{
          quantityValue: p.quantityValue || "1",
          unit: p.unit || "piece",
          price: Number(p.price || 0),
          originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
          stock: Number(p.stock || 0)
        }];

        for (const v of variantsToInsert) {
          await tx.insert(productVariants).values({
            productId: newProduct.id,
            quantityValue: String(v.quantityValue),
            unit: v.unit || 'piece',
            price: Number(v.price),
            originalPrice: v.originalPrice ? Number(v.originalPrice) : null,
            stock: Number(v.stock || 0),
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any);
        }
      }
    });

    return res.status(201).json({ message: `${productsList.length} products and their variants added successfully ভাই!` });
  } catch (error) {
    console.error("Bulk Insert Error:", error);
    return res.status(500).json({ error: "Bulk upload failed" });
  }
};
export const updateProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  const productId = Number(req.params.productId);
  
  try {
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId!));
    if (!sellerProfile) return res.status(404).json({ message: "Seller profile not found." });

    const updateData = req.body;

    // 1. इमेज अपलोड हैंडलर भाई
    if (req.file) {
      try {
        const [existingProductForImageCheck] = await db.select({ image: products.image })
          .from(products)
          .where(eq(products.id, productId));
          
        if (existingProductForImageCheck?.image) {
          console.log(`[INFO] Attempting to delete old image: ${existingProductForImageCheck.image}`);
          await deleteImage(existingProductForImageCheck.image).catch(e => console.error("Old image deletion ignored:", e));
        }

        const fileBuffer = fs.readFileSync(req.file.path);
        updateData.image = await uploadImage(fileBuffer, req.file.originalname, req.file.mimetype);
        fs.unlinkSync(req.file.path);
      } catch (uploadError: any) {
        console.error("❌ Image upload failed during update:", uploadError);
        return res.status(500).json({ message: "Image upload failed.", error: uploadError.message });
      }
    }

    // इनपुट वैलिडेशन भाई
    const validationErrors = validateProductInput(updateData, true);
    if (validationErrors.length > 0) return res.status(400).json({ message: "Validation failed.", errors: validationErrors });

    // 2. वैरिएंट आईडी को साफ़ निकालना भाई
    const variantId = Number(updateData.variantId || req.body.variantId || updateData.id);
    if (!variantId || Number.isNaN(variantId)) {
      return res.status(400).json({ message: "variantId specifies required data to update product variant भाई!" });
    }

    // 3. 🎯 मास्टरस्ट्रोक: मुख्य प्रोडक्ट की फील्ड्स को 'products' टेबल में अलग से अपडेट करो भाई!
    await db.update(products).set({
      name: updateData.name,
      description: updateData.description,
      image: updateData.image,
      categoryId: updateData.categoryId ? Number(updateData.categoryId) : undefined,
      brand: updateData.brand,
      updatedAt: new Date()
    } as any).where(eq(products.id, productId));

    // 4. 🔥 फ़िल्टर इंजन: सिर्फ वही फील्ड्स सर्विस को भेजेंगे जो वैरिएंट टेबल में मौजूद हैं भाई!
    // इससे डेटाबेस का स्कीमा एरर आना बंद हो जाएगा।
    const variantUpdateFields: any = {
      price: updateData.price !== undefined ? Number(updateData.price) : undefined,
      originalPrice: updateData.originalPrice !== undefined ? Number(updateData.originalPrice) : undefined,
      stock: updateData.stock !== undefined ? Number(updateData.stock) : undefined,
      quantityValue: updateData.quantityValue !== undefined ? String(updateData.quantityValue) : undefined,
      unit: updateData.unit || undefined,
      changeReason: updateData.changeReason || undefined // सर्विस इसे इतिहास रिकॉर्ड करने के लिए इस्तेमाल करेगी भाई
    };

    // फालतू undefined चाबियों को साफ़ करना ताकि सेट क्वेरी न फटे भाई
    Object.keys(variantUpdateFields).forEach(key => variantUpdateFields[key] === undefined && delete variantUpdateFields[key]);

    // 5. हाई-क्लास सर्विस को कॉल करो भाई
    const updatedVariant = await ProductService.updateProduct(productId, variantId, sellerProfile.id, variantUpdateFields);

    // 6. लो-स्टॉक व्हाट्सएप और इन-ऐप अलर्ट चेक भाई
    if (updateData.variants && Array.isArray(updateData.variants)) {
      for (const variant of updateData.variants) {
        const vStock = variant.stock;
        const vId = Number(variant.id || variantId);
        if (vStock !== undefined) {
          await ProductService.checkLowStockAndNotify(productId, vId, Number(vStock), sellerProfile.id)
            .catch(err => console.error("Low Stock Alert Error inside Controller:", err));
        }
      }
    } else if (variantUpdateFields.stock !== undefined) {
      await ProductService.checkLowStockAndNotify(productId, variantId, variantUpdateFields.stock, sellerProfile.id)
        .catch(err => console.error("Low Stock Alert Single Error:", err));
    }

    return res.status(200).json({ message: "Product and variant updated successfully भाई।", product: updatedVariant });
  } catch (error) { next(error); }
};
export const deleteProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const productId = Number(req.params.productId);
  const userId = req.user?.id;
  
  try {
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId!));
    
    // Purani file udayein (optional, par soft delete mein log images rehne dete hain audit ke liye)
    // Ab hum delete nahi, soft-delete karenge
    await ProductService.softDelete(productId, sellerProfile.id);
    
    res.status(200).json({ message: "Product moved to bin (Soft Deleted)." });
  } catch (error) { next(error); }
};

// ✅ 1. सेलर के खुद के प्रोडक्ट्स निकालना (वैरिएंट्स के साथ भाई)
export const getSellerProducts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  const showDeleted = req.query.trash === 'true'; 
  
  if (!userId) return res.status(401).json({ message: "Unauthorized: User ID missing" });

  try {
    const [sellerProfile] = await db
      .select()
      .from(sellersPgTable)
      .where(eq(sellersPgTable.userId, userId));

    if (!sellerProfile || isNaN(Number(sellerProfile.id))) {
      console.warn(`⚠️ No valid seller profile for User: ${userId}`);
      return res.status(200).json({ message: "No products found (Profile missing).", products: [] });
    }

    // 🎯 फिक्स: डेटाबेस से केटेगरी और वैरिएंट्स दोनों का डेटा फेच करना भाई
    const sellerProducts = await db.query.products.findMany({
      where: and(
        eq(products.sellerId, Number(sellerProfile.id)),
        showDeleted ? isNotNull(products.deletedAt) : isNull(products.deletedAt)
      ),
      with: { 
        category: true,
        // 🚨 ध्यान दें भाई: अगर आपके स्कीma रिलेशंस में इसका नाम 'productVariants' है, तो यहाँ 'productVariants: true' लिख देना भाई!
        variants: true  
      },
      orderBy: (products, { desc }) => [desc(products.createdAt)],
    });

    // 🎯 जादुई फिक्स (Backward Compatibility Layer): फ्रंटएंड स्क्रीन को क्रैश होने से बचाने का अचूक नुस्खा भाई!
    const formattedProducts = sellerProducts.map((prod: any) => {
      const prodVariants = prod.variants || prod.productVariants || [];
      
      // 1. सबसे पहले वैरिएंट को बेस प्राइस मान लेते हैं भाई
      const baseVariant = prodVariants[0]; 
      
      // 2. इस प्रोडक्ट के सारे वैरिएंट्स का कुल स्टॉक कितना है, वो जोड़ लेते हैं
      const totalStock = prodVariants.reduce((sum: number, v: any) => sum + Number(v.stock || 0), 0);

      return {
        ...prod,
        // फ्रंटएंड की पुरानी स्क्रीन के लिए फॉलबैक डेटा भाई (ताकि ऐप क्रैश न हो)
        price: baseVariant ? String(baseVariant.price) : "0",
        originalPrice: baseVariant ? String(baseVariant.originalPrice || baseVariant.price) : "0",
        stock: totalStock,
        unit: baseVariant ? baseVariant.unit : (prod.unit || 'piece'),
        
        // आपका नया कड़क मल्टी-वैरिएंट डेटा जो अब फ्रंटएंड की नई स्क्रीन यूज़ करेगी भाई
        variants: prodVariants
      };
    });

    return res.status(200).json({ 
      message: showDeleted ? "Trash items fetched." : "Active seller products fetched successfully with variant compatibility بھائی!", 
      products: formattedProducts // ✅ अब एकदम सेफ़ और सुधरा हुआ डेटा जाएगा
    });

  } catch (error) { 
    console.error("❌ getSellerProducts Error:", error);
    next(error); 
  }
};
// ✅ 2. सबसे मुख्य: कस्टमर और सर्च के लिए सारे प्रोडक्ट्स लोड करना (SMART FILTER)
export const getAllProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      categoryId,subCategoryId, sellerId, search, pincode, lat, lng, 
      customerPincode, customerLat, customerLng,
      minPrice, maxPrice, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 10 
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const effectivePincode = (pincode?.toString() || customerPincode?.toString() || "").trim();
    const effectiveLat = parseFloat(lat?.toString() || customerLat?.toString() || "");
    const effectiveLng = parseFloat(lng?.toString() || customerLng?.toString() || "");

    // बेस कंडीशन्स
    const whereClauses: any[] = [
      eq(products.approvalStatus, approvalStatusEnum.enumValues[1]),
      eq(products.isActive, true),
      isNull(products.deletedAt) 
    ];

    // लोकेशन / सेलर फ़िल्टर
    if (sellerId) {
      whereClauses.push(eq(products.sellerId, Number(sellerId)));
    } 
    else {
      if (!effectivePincode || isNaN(effectiveLat) || isNaN(effectiveLng)) {
        return res.status(400).json({ message: "Sahi area ke products dikhane ke liye location zaroori hai भाई।" });
      }

     const allApprovedSellers = await db
  .select({
    id: sellersPgTable.id,
    latitude: sellersPgTable.latitude,
    longitude: sellersPgTable.longitude,
    deliveryRadius: sellersPgTable.deliveryRadius,
    deliveryPincodes: sellersPgTable.deliveryPincodes,
    isDistanceBasedDelivery: sellersPgTable.isDistanceBasedDelivery,
  })
  .from(sellersPgTable)
  .where(eq(sellersPgTable.approvalStatus, "approved"));
     const deliverableSellerIds = new Set<number>();
for (const seller of allApprovedSellers) {

  const sLat = Number(seller.latitude);
  const sLng = Number(seller.longitude);
  const radius = Number(seller.deliveryRadius);

  if (seller.isDistanceBasedDelivery) {

    if (
      !Number.isNaN(sLat) &&
      !Number.isNaN(sLng) &&
      radius > 0
    ) {

      const distance = await calculateDistanceKm(
        sLat,
        sLng,
        effectiveLat,
        effectiveLng
      );

      if (distance !== null && distance <= radius) {
        deliverableSellerIds.add(seller.id);
      }
    }

  } else {

    if (
      seller.deliveryPincodes?.includes(effectivePincode)
    ) {
      deliverableSellerIds.add(seller.id);
    }

  }
}

   if (deliverableSellerIds.size === 0)
      return res.json({ products: [], total: 0 });
     whereClauses.push(
  inArray(products.sellerId, [...deliverableSellerIds])
);
    }

    if (categoryId) whereClauses.push(eq(products.categoryId, Number(categoryId)));
    if (subCategoryId) {

   whereClauses.push(
      eq(masterProducts.subCategoryId, Number(subCategoryId))
   );

}
    if (search) whereClauses.push(ilike(products.name, `%${search}%`));

    // 🎯 डिस्काउंट/प्राइस फ़िल्टर: वैरिएंट टेबल के हिसाब से भाई
    if (minPrice || maxPrice) {
      const min = Number(minPrice || 0);
      const max = Number(maxPrice || 999999);
      
      whereClauses.push(
        sql`exists (
          select 1 from ${productVariants} 
          where ${productVariants.productId} = ${products.id} 
          and ${productVariants.price} >= ${min} 
          and ${productVariants.price} <= ${max}
          and ${productVariants.isActive} = true
        )`
      );
    }

    // सॉर्टिंग लॉजिक
    const orderBy = [];
    if (sortBy === 'name') {
      orderBy.push(sortOrder === 'asc' ? asc(products.name) : desc(products.name));
    } else if (sortBy === 'price') {
      orderBy.push(
        sortOrder === 'asc' 
          ? asc(sql`(select min(${productVariants.price}) from ${productVariants} where ${productVariants.productId} = ${products.id})`)
          : desc(sql`(select min(${productVariants.price}) from ${productVariants} where ${productVariants.productId} = ${products.id})`)
      );
    } else {
      orderBy.push(desc(products.createdAt));
    }

    // 🎯 फिक्स: काउंट क्वेरी को पूरी तरह से सेफ़ रखने के लिए plain sql बिल्डर का उपयोग भाई
    const [totalCountResult] = await db
      .select({ count: sql<number>`count(distinct ${products.id})` })
      .from(products)
      .where(and(...whereClauses));
      
    const totalCount = Number(totalCountResult?.count || 0);
    
    // फाइनल डेटा फैचिंग
    const productList = await db.query.products.findMany({
      where: and(...whereClauses),
      with: { 
       category:{
columns:{
id:true,
name:true
}
},
       seller:{
columns:{
id:true,
businessName:true,
businessAddress:true,
latitude:true,
longitude:true
}
},
masterProduct:{
   with:{
      productSubcategories:{
         columns:{
            subCategoryId:true
         }
      }
   }
},
      variants:{
columns:{
id:true,
price:true,
originalPrice:true,
stock:true,
unit:true,
isActive:true
},
where:eq(productVariants.isActive,true),
orderBy:[asc(productVariants.price)]
},
      },
      orderBy: orderBy,
      limit: limitNum,
      offset: offset,
    });

   // ==================== 🎯 100% सुरक्षित डबल-की सेफ़्टी इंजन (पुरानी + नई दोनों Keys लाइव) ====================
    const formattedProducts = productList.map((prod: any) => {
      const prodVariants = prod.variants || [];
      const cheapestVariant = prodVariants[0]; // Pehla sabse sasta variant bhai
      const totalStock = prodVariants.reduce((sum: number, v: any) => sum + Number(v.stock || 0), 0);

      // Variant se MRP nikalne ka full fallback safety layer
      const variantMrp = cheapestVariant ? (cheapestVariant.mrp || cheapestVariant.originalPrice || cheapestVariant.price) : 0;

      return {
        ...prod,
        price: cheapestVariant ? String(cheapestVariant.price) : "0", // Purani string structure ko touch nahi kiya
        stock: totalStock,
        unit: cheapestVariant ? cheapestVariant.unit : 'piece',
       subCategoryId:
prod.masterProduct?.productSubcategories?.[0]?.subCategoryId ?? null,
        variants: prodVariants,

        // 🌟 जादू 1: 'mrp' key ko naya joda taaki HomeScreen aur CategoryDetailsScreen ka naya discount math chal sake!
        mrp: Number(variantMrp),

        // 🌟 जादू 2: 'originalPrice' key ko jaisa tha waisa hi rakha, taaki purani screens ka kaam bilkul kharab na ho!
        originalPrice: cheapestVariant ? String(cheapestVariant.originalPrice || cheapestVariant.price) : "0"
      };
    });
    // =======================================================================================================
    return res.status(200).json({
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      products: formattedProducts, // ✅ अब एकदम सेफ़ डेटा जाएगा भाई
    });

  } catch (error) { 
    console.error("Fetch Error:", error);
    next(error); 
  }
};
   // ✅ 2. सबसे मुख्य: कस्टमर और सर्च के लिए सारे प्रोडक्ट्स लोड करना (SMART FILTER)
export const getCategoryProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
   const {
  categoryId,
  sellerId,

  pincode,
  lat,
  lng,

  customerPincode,
  customerLat,
  customerLng,

  page = 1,

  limit = 9

} = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const effectivePincode = (pincode?.toString() || customerPincode?.toString() || "").trim();
    const effectiveLat = parseFloat(lat?.toString() || customerLat?.toString() || "");
    const effectiveLng = parseFloat(lng?.toString() || customerLng?.toString() || "");
     if (!categoryId) {
      return res.status(400).json({
        message: "categoryId required",
      });
    }
    // बेस कंडीशन्स
    const whereClauses: any[] = [
      eq(products.approvalStatus, approvalStatusEnum.enumValues[1]),
      eq(products.isActive, true),
      isNull(products.deletedAt),
       eq(products.categoryId, Number(categoryId)),
    ];

    // लोकेशन / सेलर फ़िल्टर
    if (sellerId) {
      whereClauses.push(eq(products.sellerId, Number(sellerId)));
    } 
    else {
      if (!effectivePincode || isNaN(effectiveLat) || isNaN(effectiveLng)) {
        return res.status(400).json({ message: "Sahi area ke products dikhane ke liye location zaroori hai भाई।" });
      }

     const allApprovedSellers = await db
  .select({
    id: sellersPgTable.id,
    latitude: sellersPgTable.latitude,
    longitude: sellersPgTable.longitude,
    deliveryRadius: sellersPgTable.deliveryRadius,
    deliveryPincodes: sellersPgTable.deliveryPincodes,
    isDistanceBasedDelivery: sellersPgTable.isDistanceBasedDelivery,

  })
  .from(sellersPgTable)
  .where(eq(sellersPgTable.approvalStatus, "approved"));
     const deliverableSellerIds = new Set<number>();
for (const seller of allApprovedSellers) {

  const sLat = Number(seller.latitude);
  const sLng = Number(seller.longitude);
  const radius = Number(seller.deliveryRadius);

  if (seller.isDistanceBasedDelivery) {

    if (
      !Number.isNaN(sLat) &&
      !Number.isNaN(sLng) &&
      radius > 0
    ) {

      const distance = await calculateDistanceKm(
        sLat,
        sLng,
        effectiveLat,
        effectiveLng
      );

      if (distance !== null && distance <= radius) {
        deliverableSellerIds.add(seller.id);
      }
    }

  } else {

    if (
      seller.deliveryPincodes?.includes(effectivePincode)
    ) {
      deliverableSellerIds.add(seller.id);
    }

  }
}

   if (deliverableSellerIds.size === 0)
      return res.json({ products: [], total: 0 });
     whereClauses.push(
  inArray(products.sellerId, [...deliverableSellerIds])
);
    }
 
whereClauses.push(
  eq(products.categoryId, Number(categoryId))
);
    

    // 🎯 डिस्काउंट/प्राइस फ़िल्टर: वैरिएंट टेबल के हिसाब से भाई

   

    // 🎯 फिक्स: काउंट क्वेरी को पूरी तरह से सेफ़ रखने के लिए plain sql बिल्डर का उपयोग भाई
    const [totalCountResult] = await db
      .select({ count: sql<number>`count(distinct ${products.id})` })
      .from(products)
      .where(and(...whereClauses));
      
    const totalCount = Number(totalCountResult?.count || 0);
    
    // फाइनल डेटा फैचिंग
    const productList = await db.query.products.findMany({
      where: and(...whereClauses),
      with: { 
       category:{
columns:{
id:true,
name:true
}
},
       seller:{
columns:{
id:true,
businessName:true,
businessAddress:true,
latitude:true,
longitude:true
}
},
masterProduct:{
   with:{
      productSubcategories:{
         columns:{
            subCategoryId:true
         }
      }
   }
},
      variants:{
columns:{
id:true,
price:true,
originalPrice:true,
stock:true,
unit:true,
isActive:true
},
where:eq(productVariants.isActive,true),
orderBy:[asc(productVariants.price)]
},
      },
      orderBy: [
        asc(productVariants.price),
      ]
    });

   // ==================== 🎯 100% सुरक्षित डबल-की सेफ़्टी इंजन (पुरानी + नई दोनों Keys लाइव) ====================
    const formattedProducts = productList.map((prod: any) => {
      const prodVariants = prod.variants || [];
      const variants = prod.variants || [];
      const cheapestVariant = prodVariants[0]; // Pehla sabse sasta variant bhai

      const totalStock = prodVariants.reduce((sum: number, v: any) => sum + Number(v.stock || 0), 0);

      // Variant se MRP nikalne ka full fallback safety layer
      const variantMrp = cheapestVariant ? (cheapestVariant.mrp || cheapestVariant.originalPrice || cheapestVariant.price) : 0;

      return {
        ...prod,
        price: cheapestVariant ? String(cheapestVariant.price) : "0", // Purani string structure ko touch nahi kiya
        stock: totalStock,
        unit: cheapestVariant ? cheapestVariant.unit : 'piece',
       subCategoryId:
prod.masterProduct?.productSubcategories?.[0]?.subCategoryId ?? null,
        variants:
          prod.masterProduct
            ?.productSubcategories?.[0]
            ?.subCategoryId ?? null,

        // 🌟 जादू 1: 'mrp' key ko naya joda taaki HomeScreen aur CategoryDetailsScreen ka naya discount math chal sake!
        mrp: Number(variantMrp),

        // 🌟 जादू 2: 'originalPrice' key ko jaisa tha waisa hi rakha, taaki purani screens ka kaam bilkul kharab na ho!
        originalPrice: cheapestVariant ? String(cheapestVariant.originalPrice || cheapestVariant.price) : "0"
      };
    });
    // =======================================================================================================
    return res.status(200).json({
      page: pageNum,
      limit: limitNum,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      products: formattedProducts, // ✅ अब एकदम सेफ़ डेटा जाएगा भाई
    });

  } catch (error) { 
    console.error("Fetch Error:", error);
    next(error); 
  }
};
// ✅ 3. एडमिन के लिए पेंडिंग प्रोडक्ट्स (वैरिएंट्स के साथ भाई)
export const getPendingProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pending = await db.query.products.findMany({
      where: eq(products.approvalStatus, approvalStatusEnum.enumValues[0]),
      with: { category: true, seller: true, variants: true },
      orderBy: (products, { desc }) => [desc(products.createdAt)],
    });

    // 🎯 फिक्स: एडमिन पैनल पर पेंडिंग प्रोडक्ट्स की लिस्ट देखते समय बेस प्राइस और टोटल स्टॉक दिखे भाई
    const formattedPending = pending.map((prod: any) => {
      const prodVariants = prod.variants || [];
      const baseVariant = prodVariants[0];
      const totalStock = prodVariants.reduce((sum: number, v: any) => sum + Number(v.stock || 0), 0);

      return {
        ...prod,
        price: baseVariant ? String(baseVariant.price) : "0",
        originalPrice: baseVariant ? String(baseVariant.originalPrice || baseVariant.price) : "0",
        stock: totalStock,
        unit: baseVariant ? baseVariant.unit : 'piece',
        variants: prodVariants
      };
    });

    return res.status(200).json(formattedPending);
  } catch (error) { next(error); }
};

// ✅ 4. प्रोडक्ट अप्रूव करना (ट्रांजेक्शन सेफ्टी के साथ भाई)
export const approveProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = Number(req.params.productId);

    const result = await db.transaction(async (tx) => {
      // 1. मुख्य प्रोडक्ट स्टेटस 'approved' करो भाई
      const [updated] = await tx.update(products)
        .set({ approvalStatus: approvalStatusEnum.enumValues[1], updatedAt: new Date() })
        .where(eq(products.id, productId))
        .returning();

      // 2. उसके सारे वैरिएंट्स को भी लाइव (isActive = true) कर दो भाई
      await tx.update(productVariants)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(productVariants.productId, productId));

      return updated;
    });

    return res.status(200).json({ message: "Approved successfully with variants activated bhai!", product: result });
  } catch (error) { next(error); }
};

// ✅ 5. प्रोडक्ट रिजेक्ट करना
export const rejectProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = Number(req.params.productId);

    const result = await db.transaction(async (tx) => {
      // 1. मुख्य प्रोडक्ट रिजेक्ट करो
      const [updated] = await tx.update(products)
        .set({ approvalStatus: approvalStatusEnum.enumValues[2], rejectionReason: req.body.reason, updatedAt: new Date() })
        .where(eq(products.id, productId))
        .returning();

      // 2. वैरिएंट्स को भी डीएक्टिवेट कर दो भाई ताकि सेलर सुधार कर सके
      await tx.update(productVariants)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(productVariants.productId, productId));

      return updated;
    });

    return res.status(200).json({ message: "Rejected", product: result });
  } catch (error) { next(error); }
};

// ✅ 6. आईडी से सिंगल प्रोडक्ट की पूरी कुंडली निकालना (Details Screen के लिए भाई)
export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = Number(req.params.id);

    if (isNaN(productId)) {
      console.error("❌ Invalid Product ID received:", req.params.id);
      return res.status(400).json({ message: "Invalid product identifier." });
    }

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, productId), 
        eq(products.isActive, true), 
        eq(products.approvalStatus, approvalStatusEnum.enumValues[1])
      ),
      // 🔥 यहाँ रिलेशंस एकदम परफेक्ट लोड हो रहे हैं भाई!
      with: { 
        category: true, 
        seller: { with: { user: true } },
        variants: {
          where: eq(productVariants.isActive, true)
        }
      }
    });

    if (!product) return res.status(404).json({ message: "Product not found." });

    // 🎯 जादुई फिक्स (Backward Compatibility Layer): कस्टमर की सिंगल प्रोडक्ट स्क्रीन पर 
    // सबसे सस्ते वैरिएंट की प्राइस और टोटल स्टॉक फ्लैट लेवल पर चिपका दो भाई, ताकि पुराना यूआई न फटे!
    const prodVariants = (product as any).variants || [];
    const cheapestVariant = prodVariants.length > 0 
      ? [...prodVariants].sort((a, b) => Number(a.price) - Number(b.price))[0] 
      : null;
    const totalStock = prodVariants.reduce((sum: number, v: any) => sum + Number(v.stock || 0), 0);

    const formattedProduct = {
      ...product,
      price: cheapestVariant ? String(cheapestVariant.price) : "0",
      originalPrice: cheapestVariant ? String(cheapestVariant.originalPrice || cheapestVariant.price) : "0",
      stock: totalStock,
      unit: cheapestVariant ? cheapestVariant.unit : 'piece',
      variants: prodVariants // नया आर्किटेक्चर डेटा जो अब कस्टमर की डिटेल स्क्रीन यूज़ करेगी भाई
    };
    
    return res.status(200).json(formattedProduct);

  } catch (error) { 
    console.error("❌ getProductById Error:", error);
    next(error); 
  }
};