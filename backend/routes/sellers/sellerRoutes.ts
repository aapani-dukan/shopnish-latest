
import { Express, Router, Response, NextFunction } from 'express';
import { db } from '../../server/db.js';
import {
  sellersPgTable,
  users,
  userRoleEnum,
  approvalStatusEnum,
  categories,
  products,
  stores,
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
import { eq, desc, and, ne, exists, inArray, sql,count, sum, avg } from 'drizzle-orm'; // ✅ inArray इम्पोर्ट करें
import multer from 'multer';
import { uploadImage, deleteImage } from '../../server/cloudStorage';
import { v4 as uuidv4 } from "uuid";
import { getIO } from "../../server/socket"; // ✅ Ts फ़ाइल है, इसे .ts के साथ इम्पोर्ट करें
import { getMySellerProfile, updateMySellerProfile } from '../../server/controllers/sellerController'; // 👈 यहाँ नया कंट्रोलर इम्पोर्ट करें
import { authorize, protect } from '../../server/middleware/authorize'; // आपके ऑथेंटिकेशन मिडलवेयर
import { categoryFormInputSchema } from '../../shared/backend/zod-schemas';
import * as fs from 'fs/promises'; 
import * as fsSync from 'fs'; 
const sellerRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(), // ✅ MemoryStorage का उपयोग करें
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB फ़ाइल साइज़ लिमिट
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!')as any, false);
    }
  }
});


// ✅ POST /api/sellers/apply
// ✅ POST /api/sellers/apply (MULTI-ROLE & ERROR-FREE VERSION)
sellerRouter.post("/apply", verifyToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const userId = req.user?.id;

    if (!firebaseUid || !userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      businessName, businessAddress, businessPhone, description,
      city, pincode, gstNumber, bankAccountNumber, ifscCode,
      businessType, latitude, longitude, 
    } = req.body;

    // ✅ VALIDATION
    if (!businessName || !businessPhone || !city || !pincode || !businessAddress || !businessType || !latitude || !longitude) {
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

    // 🛑 FIX: Transaction result को एक अलग 'result' वेरिएबल में स्टोर करें
    const result: any = await db.transaction(async (tx) => {

        // 1. Sellers Table Insertion
        const [sellerEntry] = await tx
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
                latitude: String(latitude), 
                longitude: String(longitude),
                deliveryPincodes: [],
                businessType,
            } as any)
            .returning();
        
        // 2. Stores Table Insertion
        await tx.insert(stores).values({
            sellerId: sellerEntry.id,
            storeName: businessName,
            storeType: businessType,
            address: businessAddress,
            city: city,
            pincode: pincode,
            phone: businessPhone,
            isActive: false, 
            latitude: String(latitude),
            longitude: String(longitude),
        } as any);

        // 3. Users Table Update (Multi-Role Logic)
        const [updatedUser] = await tx
            .update(users)
            .set({
                // role: 'customer', // कस्टमर ही रहने दें
                isSeller: false,   // अभी अप्रूव नहीं हुआ है
                sellerApprovalStatus: 'pending', 
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId))
            .returning();
            
        return { sellerEntry, updatedUser };
    });

    // 4. Final Response using the 'result' variable
    return res.status(201).json({
      message: "Application submitted successfully.",
      seller: result.sellerEntry, 
      user: {
        firebaseUid: result.updatedUser.firebaseUid,
        isSeller: result.updatedUser.isSeller,
        sellerApprovalStatus: result.updatedUser.sellerApprovalStatus,
        email: result.updatedUser.email,
        firstName: result.updatedUser.firstName,
        lastName: result.updatedUser.lastName,
      },
    });
  } catch (error: any) {
    console.error("❌ Error in POST /api/sellers/apply:", error);
    next(error);
  }
});
// ✅ GET /api/sellers/me

sellerRouter.get('/me', requireSellerAuth, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing user data.' });
    }

    // 1. सेलर प्रोफाइल प्राप्त करें
    const [sellerProfile] = await db
      .select()
      .from(sellersPgTable) // sellersPgTable के बजाय 'sellers'
      .where(eq(sellersPgTable.userId, userId)); // sellersPgTable.userId के बजाय 'sellers.userId'

    if (!sellerProfile) {
      return res.status(404).json({ error: 'Seller profile not found.' });
    }

    // 2. मेट्रिक्स की गणना करें
    const sellerId = sellerProfile.id; // सेलर की ID प्राप्त करें

    // कुल ऑर्डर की गणना (subOrders से, क्योंकि sellerId यहीं है)
    const [{ totalOrders }] = await db
      .select({ totalOrders: count(subOrders.id) })
      .from(subOrders)
      .where(eq(subOrders.sellerId, sellerId));

    // कुल उत्पादों की गणना (products से, क्योंकि sellerId यहीं है)
    const [{ totalProducts }] = await db
      .select({ totalProducts: count(products.id) })
      .from(products)
      .where(eq(products.sellerId, sellerId));

    // कुल राजस्व की गणना (subOrders से, क्योंकि sellerId यहीं है)
    // subOrders.total कॉलम का उपयोग करें
    const [{ totalRevenueResult }] = await db // 'totalRevenue' नाम दें ताकि स्पष्ट हो
      .select({ totalRevenueResult: sql<number>`sum(${subOrders.total}::numeric)` }) // ✅ subOrders.total का उपयोग करें
      .from(subOrders)
      .where(
        // ऑर्डर्स को फिल्टर करें जिनके लिए आप राजस्व गिनना चाहते हैं (उदाहरण के लिए, केवल 'completed' सब-ऑर्डर)
        // यदि आप सभी ऑर्डर के total को जोड़ना चाहते हैं, तो 'and' को हटा दें
        // and(
        eq(subOrders.sellerId, sellerId)
        //   inArray(subOrders.status, ['completed', 'shipped']) // उदाहरण के लिए, यदि आवश्यक हो तो इसे अनकमेंट करें
        // )
      );

    const totalRevenue = totalRevenueResult || 0; // यदि sum null लौटाता है तो 0
const sellerProfileWithRating = sellerProfile as unknown as { rating: number | null, [key: string]: any };

    // औसत रेटिंग की गणना
    // विकल्प 1: यदि sellerProfile में सीधे रेटिंग है (आपका वर्तमान कार्यान्वयन)
    const averageRatingFromProfile = sellerProfileWithRating.rating || 0;

    // विकल्प 2: यदि आप सभी उत्पादों की औसत रेटिंग की गणना करना चाहते हैं
    // (यह कोड अनकमेंट करें यदि आप इसे उपयोग करना चाहते हैं और products.rating कॉलम मौजूद है)
    let calculatedAverageRating = averageRatingFromProfile; // Default to profile rating

    // const [{ avgProductRatingResult }] = await db
    //   .select({ avgProductRatingResult: sql<number>`avg(${products.rating}::numeric)` })
    //   .from(products)
    //   .where(eq(products.sellerId, sellerId));

    // if (avgProductRatingResult !== null && avgProductRatingResult !== undefined) {
    //   calculatedAverageRating = parseFloat(avgProductRatingResult.toFixed(1));
    // }

    // 3. सेलर प्रोफाइल में मेट्रिक्स जोड़ें
    // 3. Response के अंत में यूजर का करंट स्टेटस भी भेजें
const responseProfile = {
  ...sellerProfile,
  totalOrders: totalOrders || 0,
  totalProducts: totalProducts || 0,
  totalRevenue: parseFloat(Number(totalRevenue).toFixed(2)),
  averageRating: calculatedAverageRating,
  // ✅ एडिशनल: फ्रंटएंड को बताने के लिए कि यह सेलर मोड में है
  isSellerActive: true 
};
    return res.status(200).json(responseProfile);
  } catch (error: any) {
    console.error('❌ Error in GET /api/sellers/me:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ✅ GET /api/sellers/orders (अब यह सब-ऑर्डर्स को फेच करेगा)
sellerRouter.get("/orders", requireSellerAuth, async (req: any, res: Response) => {
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


// ✅ POST /api/sellers/categories (Clean & Multi-role compatible)
sellerRouter.post(
  '/categories',
  requireSellerAuth, // यह मिडलवेयर अब isSeller: true चेक करता है
  upload.single('image'),
  async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
      
      if (!sellerProfile) {
        return res.status(404).json({ error: 'Seller profile not found.' });
      }
      const sellerId = sellerProfile.id;

      const { name, slug, description, isActive } = req.body;
      const imageFile = req.file;

      const categoryDataParsed = await categoryFormInputSchema.safeParseAsync({
        name,
        slug,
        description,
        isActive: isActive === 'true' || isActive === true,
      });

      // ✅ Validation Error Handling (No FS cleanup needed for MemoryStorage)
      if (!categoryDataParsed.success) {
        return res.status(400).json({ 
            message: "Invalid category data.", 
            errors: categoryDataParsed.error.flatten().fieldErrors 
        });
      }

      if (!imageFile) {
        return res.status(400).json({ error: 'Category image is required.' });
      }

      const fileName = `categories/${sellerId}/${uuidv4()}-${imageFile.originalname}`;
      const imageUrl = await uploadImage(imageFile.buffer, fileName, imageFile.mimetype);
      const validatedCategoryData = categoryDataParsed.data;

      // Duplicate Check
      const [existingCategory] = await db.select()
        .from(categories)
        .where(and(eq(categories.name, validatedCategoryData.name), eq(categories.sellerId, sellerId)));

      if (existingCategory) {
        await deleteImage(fileName);
        return res.status(409).json({ error: 'Category already exists.' });
      }

      const [newCategory] = await db.insert(categories)
        .values({
          sellerId: sellerId,
          name: validatedCategoryData.name,
          slug: validatedCategoryData.slug,
          description: validatedCategoryData.description,
          image: imageUrl,
          isActive: validatedCategoryData.isActive,
        })
        .returning();

      getIO().emit("category:created", newCategory);
      return res.status(201).json(newCategory);

    } catch (error: any) {
      console.error('Error in creating category:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error.' });
    }
  }
);
    // ✅ GET /api/sellers/products
    sellerRouter.get('/products', requireSellerAuth, async (req: any, res: Response) => {
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

// ✅ New: GET /api/seller/profile/delivery-settings
// यह API सेलर की अपनी ग्लोबल डिलीवरी सेटिंग्स को फेच करेगा।
sellerRouter.get('/profile/delivery-settings', verifyToken as any,requireSellerAuth , async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id; // req.user से authenticated user ID प्राप्त करें

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID not found.' });
    }

    const seller = await db.query.sellersPgTable.findFirst({
      where: eq(sellersPgTable.userId, userId),
      columns: {
        isDistanceBasedDelivery: true,
        deliveryPincodes: true,
        deliveryRadius: true,
        latitude: true,  // अक्षांश और देशांतर भी महत्वपूर्ण हैं
        longitude: true, // क्योंकि ये दूरी-आधारित डिलीवरी के लिए आवश्यक हैं
      }
    });

    if (!seller) {
      return res.status(404).json({ message: 'Seller profile not found.' });
    }

    res.status(200).json(seller);
  } catch (error) {
    console.error("Error fetching seller delivery settings:", error);
    next(error);
  }
});

// ✅ Updated: GET /api/seller/products/:productId/delivery-override
sellerRouter.get('/products/:productId/delivery-override', requireSellerAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id; // req.user से authenticated user ID प्राप्त करें
    const productId = Number(req.params.productId);

    if (!userId) { // requireSellerAuth इसे पहले ही संभाल लेगा, लेकिन यह एक अतिरिक्त जाँच है
      return res.status(401).json({ message: 'Unauthorized: User ID not found after authentication.' });
    }
    if (isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid product ID.' });
    }

    const seller = await db.query.sellersPgTable.findFirst({
      where: eq(sellersPgTable.userId, userId),
      columns: { id: true },
    });

    if (!seller) {
      return res.status(404).json({ message: 'Seller profile not found for authenticated user.' });
    }

    const product = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.sellerId, seller.id)),
      columns: {
        id: true,
        name: true,
        deliveryScope: true,
        productDeliveryPincodes: true,
        productDeliveryRadiusKM: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found or does not belong to this seller.' });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error(`Error fetching delivery override for product ${req.params.productId}:`, error);
    next(error);
  }
});
// backend/routes/sellerRoutes.ts में जोड़ें

// ✅ New: GET /api/seller/products/delivery-overview
sellerRouter.get('/products/delivery-overview', requireSellerAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const seller = await db.query.sellersPgTable.findFirst({
      where: eq(sellersPgTable.userId, userId),
      columns: { id: true },
    });

    if (!seller) {
      return res.status(404).json({ message: 'Seller profile not found.' });
    }

    const productsOverview = await db.query.products.findMany({
      where: eq(products.sellerId, seller.id),
      columns: {
        id: true,
        name: true,
        deliveryScope: true,
        productDeliveryPincodes: true,
        productDeliveryRadiusKM: true,
      },
    });

    res.status(200).json(productsOverview);
  } catch (error) {
    console.error("Error fetching seller products for delivery overview:", error);
    next(error);
  }
});

    // ✅ GET /api/sellers/categories (तुम्हारी schema में categories.sellerId नहीं है, यह यहाँ एक संभावित एरर है)
    sellerRouter.get('/categories', requireSellerAuth, async (req: any, res: Response) => {
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
    sellerRouter.put('/categories/:id', requireSellerAuth, async (req: any, res: Response) => {
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

// ✅ New: PUT /api/seller/profile/delivery-settings
// यह API सेलर की अपनी ग्लोबल डिलीवरी सेटिंग्स को अपडेट करेगा।
sellerRouter.put('/profile/delivery-settings', verifyToken as any,requireSellerAuth , async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id; // req.user से authenticated user ID प्राप्त करें
    const { isDistanceBasedDelivery, deliveryPincodes, deliveryRadius, latitude, longitude } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User ID not found.' });
    }

    // सुनिश्चित करें कि डेटा वैलिड है (एक बेसिक वैलिडेशन)
    if (typeof isDistanceBasedDelivery !== 'boolean') {
      return res.status(400).json({ message: 'isDistanceBasedDelivery must be a boolean.' });
    }
    if (isDistanceBasedDelivery && (typeof deliveryRadius !== 'number' || deliveryRadius <= 0)) {
        return res.status(400).json({ message: 'deliveryRadius must be a positive number for distance-based delivery.' });
    }
    if (!isDistanceBasedDelivery && (!Array.isArray(deliveryPincodes) || deliveryPincodes.some(p => typeof p !== 'string'))) {
        return res.status(400).json({ message: 'deliveryPincodes must be an array of strings for pincode-based delivery.' });
    }

    // अपडेट ऑब्जेक्ट तैयार करें
    const updateData: Partial<typeof sellersPgTable.$inferInsert> = {
      isDistanceBasedDelivery,
      updatedAt: new Date(),
    };

    if (isDistanceBasedDelivery) {
        updateData.deliveryRadius = deliveryRadius;
        // जब रेडियस बेस्ड हो, तो pincodes को null या खाली सेट करें
        updateData.deliveryPincodes = [];
    } else {
        updateData.deliveryPincodes = deliveryPincodes;
        // जब pincode बेस्ड हो, तो radius को null सेट करें
        updateData.deliveryRadius = null;
    }

    // latitude और longitude को अपडेट करें यदि वे दिए गए हैं
    // ध्यान दें: latitude/longitude आमतौर पर सेलर के पते से ऑटो-जेनरेट होते हैं,
    // लेकिन अगर फ्रंटएंड से इन्हें अपडेट करने की अनुमति है तो यहां शामिल करें।
    // सुरक्षा कारणों से, इन्हें केवल तभी अपडेट करना चाहिए जब यह एक स्पष्ट कार्रवाई हो।
    // यहाँ मैं मान रहा हूँ कि आप इसे अपडेट करना चाहते हैं:
    if (typeof latitude === 'number' && typeof longitude === 'number') {
        updateData.latitude = latitude;
        updateData.longitude = longitude;
    }


    const [updatedSeller] = await db
      .update(sellersPgTable)
      .set(updateData)
      .where(eq(sellersPgTable.userId, userId))
      .returning(); // अपडेट किया गया रिकॉर्ड वापस करें

    if (!updatedSeller) {
      return res.status(404).json({ message: 'Seller profile not found or no changes made.' });
    }

    res.status(200).json({ message: 'Seller delivery settings updated successfully!', seller: updatedSeller });
  } catch (error) {
    console.error("Error updating seller delivery settings:", error);
    next(error);
  }
});
// ✅ Updated: PUT /api/seller/products/:productId/delivery-override
sellerRouter.put('/products/:productId/delivery-override', requireSellerAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const productId = Number(req.params.productId);
    const { deliveryScope, productDeliveryPincodes, productDeliveryRadiusKM } = req.body;

    if (!userId) { // requireSellerAuth इसे पहले ही संभाल लेगा, लेकिन यह एक अतिरिक्त जाँच है
      return res.status(401).json({ message: 'Unauthorized: User ID not found after authentication.' });
    }
    if (isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid product ID.' });
    }

    const seller = await db.query.sellersPgTable.findFirst({
      where: eq(sellersPgTable.userId, userId),
      columns: { id: true },
    });

    if (!seller) {
      return res.status(404).json({ message: 'Seller profile not found for authenticated user.' });
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
      .where(and(eq(products.id, productId), eq(products.sellerId, seller.id)))
      .returning();

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found, does not belong to seller, or no changes made.' });
    }

    res.status(200).json({ message: 'Product delivery override settings updated successfully!', product: updatedProduct });
  } catch (error) {
    console.error(`Error updating delivery override for product ${req.params.productId}:`, error);
    next(error);
  }
});

    // ✅ DELETE /api/sellers/categories/:id (कैटेगरी डिलीट करें)
    sellerRouter.delete('/categories/:id', requireSellerAuth, async (req: any, res: Response) => {
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

// सुनिश्चित करें कि db, products, sellersPgTable, verifyToken, requireSellerAuth, eq, and, deleteImage
// और AuthenticatedRequest, Response, NextFunction, console.log, parseInt आदि पहले ही इंपोर्टेड (imported) हैं।

// ✅ DELETE /api/sellers/products/:productId (उत्पाद डिलीट करें)
sellerRouter.delete('/products/:productId', verifyToken as any, requireSellerAuth, async (req: any, res: Response, next: NextFunction) => {
  console.log(`🗑️ [API] Received seller request to delete product ${req.params.productId}.`);
  const userId = req.user?.id; // Authenticated user ID

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: Seller user not authenticated." });
  }

  // Input Validation
  const productId = parseInt(req.params.productId);
  if (isNaN(productId) || productId <= 0) {
    return res.status(400).json({ message: "Invalid product ID." });
  }

  try {
    // 1. Seller ID प्राप्त करें
    // Note: यह प्रोफाइल सुनिश्चित करता है कि यूजर वास्तव में एक पंजीकृत Seller है
    const [sellerProfile] = await db.select().from(sellersPgTable).where(eq(sellersPgTable.userId, userId));
    if (!sellerProfile) {
      return res.status(404).json({ message: "Seller profile not found for the authenticated user." });
    }
    const sellerId = sellerProfile.id;

    // 2. सुनिश्चित करें कि सेलर इस प्रोडक्ट का मालिक है और इमेज URL प्राप्त करें
    const [existingProduct] = await db.select({ image: products.image }).from(products).where(and(eq(products.id, productId), eq(products.sellerId, sellerId)));
    if (!existingProduct) {
      // 404 दिया जाता है ताकि हमलावर को यह न पता चले कि प्रोडक्ट मौजूद है लेकिन उनका नहीं है।
      return res.status(404).json({ message: "Product not found or not owned by this seller." }); 
    }

    // 3. इमेज को क्लाउड स्टोरेज से हटा दें (यदि मौजूद हो)
    if (existingProduct.image) {
      console.log(`[INFO] Attempting to delete product image: ${existingProduct.image}`);
      // सुनिश्चित करें कि deleteImage फंक्शन सही ढंग से इंपोर्ट किया गया है
      await deleteImage(existingProduct.image); 
    }

    // 4. डेटाबेस से प्रोडक्ट हटाएँ
    const [deletedProduct] = await db.delete(products)
      .where(and(eq(products.id, productId), eq(products.sellerId, sellerId)))
      .returning();

    if (!deletedProduct) {
      return res.status(404).json({ message: "Product deletion failed or product was not found." });
    }

    res.status(200).json({
      message: "Product deleted successfully.",
      product: deletedProduct,
    });
  } catch (error) {
    console.error("❌ Error deleting product from seller route:", error);
    next(error); 
  }
});

// ✅ POST /api/sellers/products (नया प्रोडक्ट बनाएं)
// ✅ POST /api/sellers/products (FINAL UPDATED VERSION)
sellerRouter.post(
  '/products',
  requireSellerAuth,
  upload.single('image'),
  async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const firebaseUid = req.user?.firebaseUid;

      if (!firebaseUid || !userId) {
        return res.status(401).json({ error: 'Unauthorized: User not authenticated.' });
      }

      // 1. सेलर प्रोफाइल निकालें (ताकि डिफ़ॉल्ट सेटिंग्स ले सकें)
      const [sellerProfile] = await db
        .select()
        .from(sellersPgTable)
        .where(eq(sellersPgTable.userId, userId));

      if (!sellerProfile) {
        return res.status(404).json({ error: 'Seller profile not found. Please complete registration.' });
      }

      const sellerId = sellerProfile.id;

      // 2. Request Body से डेटा निकालें
      const {
        name,
        description,
        price,
        categoryId,
        stock,
        unit,
        brand,
        minOrderQty,
        maxOrderQty,
        estimatedDeliveryTime // यूजर द्वारा भेजा गया टाइम
      } = req.body;

      const file = req.file;

      // 3. Basic Validation
      if (!name || !price || !categoryId || !stock || !file) {
        return res.status(400).json({ error: 'Missing required fields or image.' });
      }

      // 4. Data Parsing & Safety
      const parsedCategoryId = parseInt(categoryId as string);
      const parsedStock = parseInt(stock as string);
      const parsedPrice = parseFloat(price as string);
      const parsedMinOrderQty = minOrderQty ? parseInt(minOrderQty as string) : 1;
      const parsedMaxOrderQty = maxOrderQty ? parseInt(maxOrderQty as string) : null;

      if (isNaN(parsedCategoryId) || isNaN(parsedStock) || isNaN(parsedPrice)) {
        return res.status(400).json({ error: 'Invalid numbers provided for price, stock, or category.' });
      }

      // 5. 🔥 "High-Class" Delivery Time Logic
      // प्राथमिकता: 1. Product specific time > 2. Seller's global time > 3. Default '1-2 hours'
      const finalDeliveryTime = estimatedDeliveryTime?.trim() || 
                               (sellerProfile as any).estimatedDeliveryTime || 
                               '1-2 hours';

      // 6. Image Upload to Cloud
      let imageUrl = "";
      if (file) {
        const fileName = `products/${sellerId}/${uuidv4()}-${file.originalname}`;
        imageUrl = await uploadImage(file.buffer, fileName, file.mimetype);

        if (!imageUrl) {
          return res.status(500).json({ error: "Cloud upload failed." });
        }
      }

      // 7. Database Insertion
      const [newProduct] = await db
        .insert(products)
        .values({
          name: name.trim(),
          description: description || null,
          price: parsedPrice,
          categoryId: parsedCategoryId,
          stock: parsedStock,
          image: imageUrl,
          sellerId,
          unit: unit || 'piece',
          brand: brand || null,
          minOrderQty: parsedMinOrderQty,
          maxOrderQty: parsedMaxOrderQty as any,
          estimatedDeliveryTime: finalDeliveryTime, // ✅ Updated Dynamic Value
          approvalStatus: approvalStatusEnum.enumValues[0], // 'pending'
          isActive: true, // डिफ़ॉल्ट रूप से एक्टिव
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // 8. Real-time Notification
      getIO().emit("product:created", {
        message: "New product waiting for approval",
        product: newProduct
      });

      return res.status(201).json(newProduct);

    } catch (error: any) {
      console.error('❌ Error in POST /api/sellers/products:', error);
      return res.status(500).json({ error: 'Internal Server Error while creating product.' });
    }
  }
);
// 📍 PATCH /api/sellers/toggle-status - स्टोर को ऑनलाइन/ऑफलाइन करें
// 📍 PATCH /api/sellers/toggle-status
sellerRouter.patch(
  '/toggle-status',
  requireSellerAuth,
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      
      const status = req.body.isOpen !== undefined ? req.body.isOpen : req.body.is_open;
      const isSelfDelivery = req.body.isSelfDeliveryBySeller; // 🆕 Yeh line add karein

      // Check karein ki dono mein se kam se kam ek cheez toh update ho rahi ho
      if (status === undefined && isSelfDelivery === undefined) {
        return res.status(400).json({ success: false, error: "No update data provided." });
      }

      const [sellerProfile] = await db
        .select()
        .from(sellersPgTable)
        .where(eq(sellersPgTable.userId, userId));

      if (!sellerProfile) {
        return res.status(404).json({ success: false, error: "Seller profile not found." });
      }

      // --- Sellers Table Update ---
      const sellerUpdateData: any = { updatedAt: new Date() };
      if (status !== undefined) sellerUpdateData.isOpen = status;
      if (isSelfDelivery !== undefined) sellerUpdateData.isSelfDeliveryBySeller = isSelfDelivery; // 🆕 Yeh line add karein

      await db.update(sellersPgTable)
        .set(sellerUpdateData) // 🆕 UpdateData use karein
        .where(eq(sellersPgTable.id, sellerProfile.id));

      // --- Stores Table Update ---
      if (status !== undefined) {
        await db.update(stores)
          .set({ isActive: status, updatedAt: new Date() })
          .where(eq(stores.sellerId, sellerProfile.id));
      }

      return res.status(200).json({ 
        success: true, 
        message: "Status updated successfully",
        data: { 
          isOpen: status,
          isSelfDeliveryBySeller: isSelfDelivery // 🆕 Response mein bhi bhej dein
        } 
      });
     
    } catch (error) {
      console.error("❌ Toggle Status Error:", error);
      next(error);
    }
  }
);
// 📍 GET /api/sellers/dashboard-stats - डैशबोर्ड का डेटा
sellerRouter.get(
  '/dashboard-stats',
  requireSellerAuth,
  async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;

      // 1. सेलर ढूंढें
      const [seller] = await db
        .select()
        .from(sellersPgTable)
        .where(eq(sellersPgTable.userId, userId));

      if (!seller) {
        return res.status(404).json({ message: "Seller profile not found" });
      }

      // 2. स्टोर से status (isActive) लाएं
      const [store] = await db
        .select()
        .from(stores)
        .where(eq(stores.sellerId, seller.id));

      // 3. अभी के लिए डमी डेटा भेजें (बाद में इसे रियल ऑर्डर्स से बदलेंगे)
     return res.status(200).json({
  id: seller.id,
  businessName: seller.businessName,
  todaySales: 0,
  pendingOrders: 0,
  activeProducts: 0,
  newReviews: 0,
  // store?.isActive ki jagah seller.isOpen use karein (Consistency ke liye)
  isOpen: seller.isOpen ?? false, 
  recentOrders: []
});
    } catch (error) {
      console.error("Dashboard Stats Error:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);
// 📍 PATCH /api/sellers/:id - सेलर प्रोफाइल अपडेट (Multi-Role Logic)
sellerRouter.patch(
  '/:id',
  requireSellerAuth, // ✅ अब यह isSeller: true चेक करेगा, पुराने authorize(['seller']) की ज़रूरत नहीं
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const paramsId = parseInt(req.params.id);

      // 🛑 Security Check: सुनिश्चित करें कि सेलर केवल अपनी खुद की प्रोफ़ाइल अपडेट कर रहा है
      const [sellerProfile] = await db
        .select()
        .from(sellersPgTable)
        .where(eq(sellersPgTable.userId, userId));

      if (!sellerProfile || sellerProfile.id !== paramsId) {
        return res.status(403).json({ error: "Unauthorized: You can only update your own profile." });
      }

      // कंट्रोलर कॉल करें या यहीं अपडेट लॉजिक लिखें
      return updateMySellerProfile(req, res,next);
    } catch (error) {
      console.error("❌ Error in Seller Profile Patch:", error);
      next(error);
    }
  }
);

// ✅ PATCH /api/sellers/products/:id (प्रोडक्ट अपडेट करें - Updated Logic)
sellerRouter.patch(
  '/products/:id',
  requireSellerAuth,
  async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const productId = parseInt(req.params.id);

      if (!userId || isNaN(productId)) {
        return res.status(400).json({ error: 'Invalid User or Product ID.' });
      }

      // 1. Seller Profile Check (Get internal Seller ID)
      const [sellerProfile] = await db
        .select()
        .from(sellersPgTable)
        .where(eq(sellersPgTable.userId, userId));

      if (!sellerProfile) {
        return res.status(404).json({ error: 'Seller profile not found.' });
      }

      // 2. Product Ownership Check
      const [existingProduct] = await db
        .select()
        .from(products)
        .where(and(eq(products.id, productId), eq(products.sellerId, sellerProfile.id)));

      if (!existingProduct) {
        return res.status(403).json({ error: 'Not authorized to update this product.' });
      }

      const {
        name,
        description,
        price,
        categoryId,
        stock,
        unit,
        brand,
        minOrderQty,
        maxOrderQty,
        estimatedDeliveryTime,
        imageUrl: newImageUrlFromClient 
      } = req.body;

      // 🌟 Image Update & Cleanup Logic (Permanent Storage Management)
      let finalImageUrl = existingProduct.image;

      if (newImageUrlFromClient !== undefined && newImageUrlFromClient !== existingProduct.image) {
        // अगर नई इमेज आई है या इमेज हटाई गई है, तो पुरानी वाली क्लाउड से डिलीट करें
        if (existingProduct.image) {
          console.log(`[CLEANUP] Deleting old image: ${existingProduct.image}`);
          await deleteImage(existingProduct.image).catch(err => 
            console.warn(`⚠️ Cloud delete failed for ${existingProduct.image}:`, err.message)
          );
        }
        finalImageUrl = newImageUrlFromClient; // ये null, empty string या नया URL हो सकता है
      }

      // ✏️ Build Clean Update Payload
      const updatePayload: any = {
        updatedAt: new Date(),
        image: finalImageUrl
      };

      // सिर्फ वही चीजें अपडेट करें जो क्लाइंट ने भेजी हैं
      if (name !== undefined) updatePayload.name = name.trim();
      if (description !== undefined) updatePayload.description = description;
      if (price !== undefined) updatePayload.price = parseFloat(String(price));
      if (categoryId !== undefined) updatePayload.categoryId = parseInt(String(categoryId));
      if (stock !== undefined) updatePayload.stock = parseInt(String(stock));
      if (unit !== undefined) updatePayload.unit = unit;
      if (brand !== undefined) updatePayload.brand = brand;
      if (minOrderQty !== undefined) updatePayload.minOrderQty = parseInt(String(minOrderQty));
      if (maxOrderQty !== undefined) updatePayload.maxOrderQty = maxOrderQty ? parseInt(String(maxOrderQty)) : null;
      if (estimatedDeliveryTime !== undefined) updatePayload.estimatedDeliveryTime = estimatedDeliveryTime;

      // ✅ Update Database
      const [updatedProduct] = await db
        .update(products)
        .set(updatePayload)
        .where(eq(products.id, productId))
        .returning();

      if (!updatedProduct) {
        return res.status(404).json({ error: 'Update failed or no changes detected.' });
      }

      // 🔊 Real-time Sync (Socket.io)
      getIO().emit("product:updated", updatedProduct);

      return res.status(200).json(updatedProduct);

    } catch (error: any) {
      console.error("❌ PATCH Product Error:", error);
      return res.status(500).json({ message: "Internal server error during update." });
    }
  }
);
    // --- ✅ नया API: /api/sellers/sub-orders/:id/status ---
    // --- ✅ नया API: /api/sellers/sub-orders/:id/status ---
sellerRouter.patch(
  '/sub-orders/:id/status',
  requireSellerAuth,
  async (req: any, res: Response) => {
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

      // ✅ Enum में सीधे स्ट्रिंग मानों की जाँच करें
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

      // --- स्थिति परिवर्तन वैलिडेशन (Transition Logic) ---
      const currentStatus = existingSubOrder.status;
      const validStatusTransitions: { [key: string]: string[] } = {
        'pending': ['accepted', 'rejected'],
        'accepted': ['preparing', 'rejected'],
        'preparing': ['ready_for_pickup'],
        // 'ready_for_pickup' के बाद केवल सिस्टम या डिलीवरी बॉय ही स्थिति बदल सकता है,
        // जब तक कि सेल्फ-डिलीवरी न हो (जिसे हम नीचे संभालेंगे)।
        'ready_for_pickup': existingSubOrder.isSelfDeliveryBySeller ? ['delivered_by_seller'] : [],
        'delivered_by_seller': [],
        'rejected': [],
        'cancelled': [],
         'delivered_by_delivery_boy': [],
        // पुराने या अप्रासंगिक स्टेटस को यहां हैंडल करें यदि वे डेटाबेस में अभी भी हैं
      };

      if (!validStatusTransitions[currentStatus]?.includes(newStatus) && newStatus !== currentStatus) {
        return res.status(400).json({ error: `Invalid status transition from '${currentStatus}' to '${newStatus}'.` });
      }
      
      let finalStatusForSubOrder = newStatus;
      
      // यदि सेलर सेल्फ-डिलीवरी नहीं कर रहा है लेकिन 'delivered_by_seller' भेजने की कोशिश कर रहा है, 
      // तो उसे रोकें (हालांकि क्लाइंट-साइड f low को अब इसे रोकना चाहिए)।
      if (newStatus === 'delivered_by_seller' && !existingSubOrder.isSelfDeliveryBySeller) {
          return res.status(403).json({ error: 'Unauthorized delivery status change.' });
      }

      // --- ट्रांजेक्शन का उपयोग करें ---
      await db.transaction(async (tx) => {
        // 1. सब-ऑर्डर की स्थिति अपडेट करें
        const [updatedSubOrder] = await tx.update(subOrders)
          .set({
            status: finalStatusForSubOrder as any, // 'as any' for pgEnum types
            updatedAt: new Date(),
          })
          .where(eq(subOrders.id, subOrderId))
          .returning();

        if (!updatedSubOrder) {
          throw new Error('Failed to update sub-order status.');
        }

        // 2. orderTracking में एक नई एंट्री जोड़ें
        await tx.insert(orderTracking).values({
          masterOrderId: existingSubOrder.masterOrder.id,
          subOrderId,
          status: finalStatusForSubOrder as any,
          updatedByUserId: userId,
          updatedByUserRole: 'seller', // ✅ स्ट्रिंग का उपयोग करें
          timestamp: new Date(),
          message: `Sub-order status updated to '${finalStatusForSubOrder}' by seller.`,
        }as any);

        // 3. मास्टर ऑर्डर की स्थिति अपडेट करने के लिए जाँच करें
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

        // ✅ जाँचें कि सभी sub-orders डिलीवरी के लिए तैयार (ready_for_pickup) या सेलर द्वारा अंतिम रूप से डिलीवर (delivered_by_seller) हैं
        const allSubOrdersReadyOrFinalizedBySeller = relatedSubOrders.every(so =>
          so.status === 'ready_for_pickup' || 
          so.status === 'delivered_by_seller' ||
          so.status === 'cancelled' ||
          so.status === 'rejected'
          // **नोट:** 'delivered' (डिलीवरी बॉय द्वारा) को यहाँ शामिल न करें, 
          // क्योंकि इस रूट का उद्देश्य केवल सेलर के कार्यों के आधार पर Master Order को 'processing' पर सेट करना है।
        );

        // ... (विक्रेता के सब-ऑर्डर अपडेट के बाद का लॉजिक)

        // 3. मास्टर ऑर्डर की स्थिति अपडेट करने के लिए जाँच करें (जारी...)
        // ... (relatedSubOrders और allSubOrdersReadyOrFinalizedBySeller की गणना यहाँ की जाती है)
        
        if (allSubOrdersReadyOrFinalizedBySeller) {
          const [currentMasterOrder] = await tx.select().from(orders).where(eq(orders.id, existingSubOrder.masterOrder.id));
          
          // --- ✅ लॉजिक अपडेट: ENUM त्रुटि निवारण और टर्मिनल स्टेटस गार्ड ---
          
          // 1. यदि मास्टर ऑर्डर पहले से ही अंतिम (Terminal) स्थिति में है, तो अपडेट न करें।
          //    टर्मिनल स्टेटस: 'fulfilled', 'cancelled', 'failed'
          if (
              currentMasterOrder && 
              currentMasterOrder.status !== 'fulfilled' &&
              currentMasterOrder.status !== 'cancelled' &&
              currentMasterOrder.status !== 'failed'
          ) {
            
            // 2. ENUM सुधार: 'processing' को 'confirmed' से बदलें
            //    ('confirmed' आपके ENUM में विक्रेता द्वारा स्वीकार किए जाने के बाद की अगली सक्रिय स्थिति है)
            const newMasterStatus = 'confirmed'; 
            
            // 3. मास्टर ऑर्डर अपडेट करें
            await tx.update(orders)
              .set({ status: newMasterStatus as any, updatedAt: new Date().toISOString() }) 
              .where(eq(orders.id, existingSubOrder.masterOrder.id));

            // 4. master order tracking में एंट्री जोड़ें
            await tx.insert(orderTracking).values({
              masterOrderId: existingSubOrder.masterOrder.id,
              status: newMasterStatus as any, // ✅ 'confirmed'
              updatedByUserId: userId,
              updatedByUserRole: 'seller', 
              timestamp: new Date(),
              message: `Master order status updated to '${newMasterStatus}' as all sub-orders are ready for delivery/self-delivered.`,
            }as any);
            
            // 5. Socket emit करें
            getIO().emit(`master-order:${existingSubOrder.masterOrder.id}:status-updated`, {
              status: newMasterStatus,
              message: `Master order status updated to '${newMasterStatus}'.`,
            });
          }
        }
        

        // 4. डिलीवरी बैच की स्थिति अपडेट करें (यदि sub-order 'ready_for_pickup' है)

        // विक्रेता के /sub-orders/:id/status रूट के अंदर

// 4. डिलीवरी बैच की स्थिति अपडेट करें (यदि sub-order 'ready_for_pickup' है)
        if (finalStatusForSubOrder === 'ready_for_pickup' && existingSubOrder.deliveryBatch) {
          
          // ✅ सिर्फ़ तभी आगे बढ़ें जब डिलीवरी बैच अभी भी 'pending' स्थिति में हो
          if (existingSubOrder.deliveryBatch.status === 'pending') { 
            
            // 🛑 ध्यान दें: 'assigned' पर अपडेट करने वाले कोड को हटा दिया गया है।
            // बैच का स्टेटस 'pending' ही रहेगा।

            // ✅ ऑर्डर ट्रैकिंग में एंट्री जोड़ें (status: pending का उपयोग करके)
            const currentBatchStatus = existingSubOrder.deliveryBatch.status; // 'pending'
            
            await tx.insert(orderTracking).values({
              masterOrderId: existingSubOrder.masterOrder.id,
              deliveryBatchId: existingSubOrder.deliveryBatch.id,
              status: currentBatchStatus as any, 
              updatedByUserId: userId,
              updatedByUserRole: 'seller', 
              timestamp: new Date(),
              message: `Delivery batch is now Ready for Claiming (Status: Pending) by seller.`, 
            }as any);
            
            // --- ✅ OLD STYLE EMIT, BUT NEW LOGIC ---
            
            // 1. बैच स्टेटस अपडेट को emit करें (पुराने स्टाइल का उपयोग करते हुए)
            getIO().emit(`delivery-batch:${existingSubOrder.deliveryBatch.id}:status-updated`, {
              // ✅ स्टेटस अभी भी 'pending' है, लेकिन यह दर्शाता है कि यह पिकअप के लिए तैयार है
              status: currentBatchStatus, 
              message: `Delivery batch is ready for claiming.`,
            });
            
            // 2. किसी विशिष्ट डिलीवरी बॉय को सूचित न करें, क्योंकि यह NULL है।
            // पुराने IF ब्लॉक को हटा दिया गया है, क्योंकि यह अब असाइन नहीं हुआ है।
            
            // ✅ सभी डिलीवरी बॉय को सूचना भेजें कि एक नया बैच उपलब्ध है (यह सुनिश्चित करता है कि वे इसे अपने 'Available' टैब में देखें)
            getIO().emit(`available-batches:new-batch-ready`, {
                 deliveryBatchId: existingSubOrder.deliveryBatch.id,
                 message: "A new batch is available for claiming!",
            });
            // --- END OF EMIT ---
            
          } 
        }
        
        // 5. Socket.io: कस्टमर और सेलर को रियल-टाइम अपडेट भेजें
        getIO().emit(`user:${existingSubOrder.masterOrder.customerId}:order-update`, {
          subOrderId: subOrderId,
          status: finalStatusForSubOrder,
          masterOrderId: existingSubOrder.masterOrder.id,
          message: `Your order from ${sellerProfile.businessName} is now '${finalStatusForSubOrder}'.`,
        });
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
      return res.status(500).json({ error: error.message || 'Failed to update sub-order status.' });
    }
  }
);


export default sellerRouter;
            
