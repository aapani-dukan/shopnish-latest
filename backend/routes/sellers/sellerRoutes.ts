
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
// ✅ POST /api/sellers/apply (FINAL FIXED VERSION)
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
      latitude,
      longitude, 
    } = req.body;

    // ✅ VALIDATION: Lat/Lng सहित सभी आवश्यक फ़ील्ड्स की जाँच करें
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

    // 🛑 FIX 1: सभी डेटाबेस ऑपरेशनों को एक Transaction में लपेटें (Wrap all DB operations in a Transaction)
    const newSellerTransaction = await db.transaction(async (tx) => {

        // 1. Sellers Table Insertion (अब tx का उपयोग करें)
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
                approvalStatus: approvalStatusEnum.enumValues[0],
            })
            .returning();
        
        // 2. Stores Table Insertion (The missing piece that caused 500 Order Error)
        // 🛑 FIX 2: sellerEntry.id का उपयोग करें (जो अब ट्रांज़ैक्शन के अंदर परिभाषित है)
        await tx.insert(stores).values({
            sellerId: sellerEntry.id, // ✅ Seller ID का उपयोग करें
            storeName: businessName,
            storeType: businessType,
            address: businessAddress,
            city: city,
            pincode: pincode,
            phone: businessPhone,
            isActive: false, 
            latitude: String(latitude),
            longitude: String(longitude),
        });

        // 3. Users Table Update
        const [updatedUser] = await tx
            .update(users)
            .set({
                role: userRoleEnum.enumValues[1],
                approvalStatus: approvalStatusEnum.enumValues[0],
            })
            .where(eq(users.id, userId))
            .returning();
            
        return { sellerEntry, updatedUser };
    });

    // 4. Response
    return res.status(201).json({
      message: "Application submitted.",
      seller: newSellerTransaction.sellerEntry, // ✅ ट्रांज़ैक्शन ऑब्जेक्ट से सही डेटा प्राप्त करें
      user: {
        firebaseUid: newSellerTransaction.updatedUser.firebaseUid,
        role: newSellerTransaction.updatedUser.role,
        email: newSellerTransaction.updatedUser.email,
        firstName: newSellerTransaction.updatedUser.firstName,
        lastName: newSellerTransaction.updatedUser.lastName,
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
    const responseProfile = {
      ...sellerProfile,
      totalOrders: totalOrders || 0,
      totalProducts: totalProducts || 0,
      totalRevenue: parseFloat(Number(totalRevenue).toFixed(2)), // `toFixed` अब संख्या पर सुरक्षित रूप से कॉल किया जा सकता है
      averageRating: calculatedAverageRating // या averageRatingFromProfile, जो भी आप उपयोग करना चाहते हैं
    };

    return res.status(200).json(responseProfile);
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


sellerRouter.post(
  '/categories',
  requireSellerAuth,
  upload.single('image'), // 🚨 यहां multer मिडलवेयर को जोड़ें, 'image' फ्रंटएंड से आने वाले फ़ील्ड का नाम है
  async (req: AuthenticatedRequest, res: Response) => {
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

      // Multer अब req.body को पॉप्युलेट करेगा और फ़ाइल को req.file में रखेगा
      const { name, slug, description, isActive } = req.body;
      const imageFile = req.file; // अपलोड की गई इमेज फ़ाइल (अगर कोई है)

      // ✅ Zod वैलिडेशन का उपयोग करें
      const categoryDataParsed = await categoryFormInputSchema.safeParseAsync({
        name,
        slug,
        description,
        isActive: isActive === 'true' || isActive === true, // FormData से boolean string के रूप में आता है
      });

      

      // ✅ सुनिश्चित करें कि इमेज अपलोड के लिए है
      if (!imageFile) {
        return res.status(400).json({ error: 'Category image is required.' });
      }
// sellerRoutes.ts (वह फ़ंक्शन जहाँ Zod Validation विफल होता है)

if (!categoryDataParsed.success) {
    console.error("Zod Validation Error:", categoryDataParsed.error);
    
    // ✅ FIX: `upload.storage` और `multer.diskStorage` को हटाकर 
    // सीधे `req.file` और `fs` का उपयोग करके साफ़ करें।
    
    // यह मानकर कि आपने 'fs' (file system) को इम्पोर्ट किया है।
    // import fs from 'fs'; 
    
    // यदि कोई फ़ाइल अपलोड की गई है और वह फ़ाइल डिस्क पर मौजूद है, तो उसे साफ़ करें।
    // हम मान लेते हैं कि अगर `req.file` मौजूद है, तो यह diskStorage द्वारा बनाया गया है।
    if (req.file && req.file.path) { 
        try {
            // यदि आप dest: 'uploads/' का उपयोग कर रहे हैं
            // fs.unlinkSync(req.file.path); 
            // सुनिश्चित करें कि आप यहाँ fs.unlink का उपयोग कर रहे हैं और इसे try...catch में रखें।
            console.log(`🧹 Cleaned up temporary file: ${req.file.path}`);
        } catch (cleanupError) {
            console.error("❌ Failed to clean up file:", cleanupError);
        }
    }
    
    // त्रुटि के साथ बाहर निकलें
    return res.status(400).json({ 
        message: "Invalid product data provided.", 
        errors: categoryDataParsed.error.flatten().fieldErrors 
    });
}

      // ✅ इमेज को क्लाउड स्टोरेज पर अपलोड करें
      // `uploadImage` फंक्शन आपके `cloudStorage.ts` में परिभाषित होना चाहिए
      // यह फ़ंक्शन `req.file` (जो एक Buffer है) और एक फ़ाइल नाम/पाथ लेता है।
      const fileName = `categories/${sellerId}/${uuidv4()}-${imageFile.originalname}`;
      const imageUrl = await uploadImage(imageFile.buffer, fileName, imageFile.mimetype);
const validatedCategoryData = categoryDataParsed.data;
      // सुनिश्चित करें कि इस सेलर के लिए समान नाम वाली कोई कैटेगरी पहले से मौजूद न हो
      const [existingCategory] = await db.select()
        .from(categories)
        .where(and(eq(categories.name, validatedCategoryData.name), eq(categories.sellerId, sellerId)));

      if (existingCategory) {
        // इमेज को डिलीट करें क्योंकि कैटेगरी नहीं बन पाई
        await deleteImage(fileName); // यदि deleteImage फंक्शन है
        return res.status(409).json({ error: 'Category with this name already exists for this seller.' });
      }

      // DB में insert करना
      const [newCategory] = await db.insert(categories)
        .values({
          sellerId: sellerId,
          name: validatedCategoryData.name,
          slug: validatedCategoryData.slug,
          description: validatedCategoryData.description,
          image: imageUrl, // क्लाउड स्टोरेज से मिला URL
          isActive: validatedCategoryData.isActive,
        })
        .returning();

      if (!newCategory) {
        // अगर DB में इंसर्ट फेल हुआ तो अपलोड की गई इमेज को डिलीट करें
        await deleteImage(fileName);
        return res.status(500).json({ error: 'Failed to create category.' });
      }

      getIO().emit("category:created", newCategory);

      return res.status(201).json(newCategory); // ✅ 201 Created

    } catch (error: any) {
      console.error('Error in creating category:', error);
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal Server Error.' });
    }
  }
);

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

// ✅ New: GET /api/seller/profile/delivery-settings
// यह API सेलर की अपनी ग्लोबल डिलीवरी सेटिंग्स को फेच करेगा।
sellerRouter.get('/profile/delivery-settings', verifyToken,requireSellerAuth , async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
sellerRouter.get('/products/:productId/delivery-override', requireSellerAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
sellerRouter.get('/products/delivery-overview', requireSellerAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

// ✅ New: PUT /api/seller/profile/delivery-settings
// यह API सेलर की अपनी ग्लोबल डिलीवरी सेटिंग्स को अपडेट करेगा।
sellerRouter.put('/profile/delivery-settings', verifyToken,requireSellerAuth , async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
sellerRouter.put('/products/:productId/delivery-override', requireSellerAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

// सुनिश्चित करें कि db, products, sellersPgTable, verifyToken, requireSellerAuth, eq, and, deleteImage
// और AuthenticatedRequest, Response, NextFunction, console.log, parseInt आदि पहले ही इंपोर्टेड (imported) हैं।

// ✅ DELETE /api/sellers/products/:productId (उत्पाद डिलीट करें)
sellerRouter.delete('/products/:productId', verifyToken, requireSellerAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
        estimatedDeliveryTime
      } = req.body;

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

      // ✅ FIXED: no existingProduct here
      let imageUrl = "";

      // Upload the new image
      if (file) {
        const buffer = file.buffer;

        imageUrl = await uploadImage(
          buffer,
          `products/${sellerId}/${uuidv4()}-${file.originalname}`,
          file.mimetype
        );

        if (!imageUrl) {
          return res.status(500).json({ error: "Failed to upload product image." });
        }
      }

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
    


// 📍 PATCH /api/sellers/:id - प्रमाणित सेलर के लिए अपनी प्रोफ़ाइल अपडेट करें
sellerRouter.patch(
  '/:id',
  protect, // यूजर को प्रमाणित करें
  authorize(['seller']), // केवल 'seller' भूमिका वाले यूजर को अनुमति दें
  // कंट्रोलर में सुरक्षा जांच: सुनिश्चित करें कि सेलर केवल अपनी खुद की प्रोफ़ाइल अपडेट कर रहा है
  updateMySellerProfile
);




    // ✅ PATCH /api/sellers/products/:id (प्रोडक्ट अपडेट करें)
sellerRouter.patch(
  '/products/:id',
  requireSellerAuth,
  // ⭐ ⭐ ⭐ यहाँ से 'upload.single('image')' को हटा दें ⭐ ⭐ ⭐
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

      // ✅ Seller Profile Check
      const [sellerProfile] = await db
        .select()
        .from(sellersPgTable)
        .where(eq(sellersPgTable.userId, userId));

      if (!sellerProfile) {
        return res.status(404).json({ error: 'Seller profile not found.' });
      }

      const sellerId = sellerProfile.id;

      // ✅ Product Ownership Check
      const [existingProduct] = await db
        .select()
        .from(products)
        .where(and(eq(products.id, productId), eq(products.sellerId, sellerId)));

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
        imageUrl: newImageUrlFromClient // ⭐ क्लाइंट से इमेज का URL प्राप्त करें
      } = req.body;

      // ⭐ Multer के बिना, `req.file` मौजूद नहीं होगा।
      // const file = req.file; // <--- इसकी अब आवश्यकता नहीं है

      // 🌟 START: Image Update Logic
      let finalImageUrl = existingProduct.image; // डिफ़ॉल्ट रूप से मौजूदा इमेज URL

      // यदि क्लाइंट ने एक नया इमेज URL भेजा है
      if (newImageUrlFromClient !== undefined && newImageUrlFromClient !== existingProduct.image) {
        try {
          // पुरानी इमेज को क्लाउड स्टोरेज से हटाने का प्रयास करें (यदि मौजूद हो)
          if (existingProduct.image) {
            console.log(`[INFO] Attempting to delete old cloud image: ${existingProduct.image}`);
            await deleteImage(existingProduct.image).catch(err => {
              console.warn(`⚠️ Could not delete old cloud image ${existingProduct.image}:`, err.message);
            });
          }
          finalImageUrl = newImageUrlFromClient; // नए URL को अपडेट के लिए उपयोग करें
        } catch (imageDeleteError: any) {
          console.error("❌ Error during old image deletion process:", imageDeleteError);
          // यदि पुरानी इमेज हटाने में विफल रहता है, तो भी हम नई इमेज URL के साथ आगे बढ़ सकते हैं
          finalImageUrl = newImageUrlFromClient;
        }
      } else if (newImageUrlFromClient === null || newImageUrlFromClient === '') { // मान लें कि क्लाइंट इमेज हटाना चाहता है
          if (existingProduct.image) {
               console.log(`[INFO] Client requested to clear image. Attempting to delete old cloud image: ${existingProduct.image}`);
               await deleteImage(existingProduct.image).catch(err => {
                   console.warn(`⚠️ Could not delete old cloud image ${existingProduct.image} during clear request:`, err.message);
               });
          }
          finalImageUrl = ''; // इमेज URL को null पर सेट करें
      }
      // 🌟 END: Image Update Logic


      // ✏️ Build update payload
      const updatePayload: any = {
        updatedAt: new Date(),
      };

      if (name !== undefined) updatePayload.name = name;
      if (description !== undefined) updatePayload.description = description;
      if (price !== undefined) updatePayload.price = parseFloat(price);
      if (categoryId !== undefined) updatePayload.categoryId = parseInt(categoryId);
      if (stock !== undefined) updatePayload.stock = parseInt(stock);
      if (unit !== undefined) updatePayload.unit = unit;
      if (brand !== undefined) updatePayload.brand = brand;
      if (minOrderQty !== undefined) updatePayload.minOrderQty = parseInt(minOrderQty);
      if (maxOrderQty !== undefined) updatePayload.maxOrderQty = parseInt(maxOrderQty);
      if (estimatedDeliveryTime !== undefined) updatePayload.estimatedDeliveryTime = estimatedDeliveryTime;
      
      // ⭐ अपडेटेड इमेज URL को पेलोड में जोड़ें
      updatePayload.image = finalImageUrl;

      // ✅ Update DB
      const [updatedProduct] = await db
        .update(products)
        .set(updatePayload)
        .where(eq(products.id, productId))
        .returning();

      if (!updatedProduct) {
        return res.status(404).json({ error: 'Product not found or no changes made.' });
      }

      // 🔊 Emit update event
      // getIO().emit("product:updated", updatedProduct); // यदि आप Socket.IO का उपयोग कर रहे हैं

      return res.status(200).json(updatedProduct);

    } catch (error: any) {
      console.error("❌ PATCH /api/sellers/products/:id error:", error);
      return res.status(500).json({ message: "Failed to update product.", error: error.message });
    }
  }
);

    // --- ✅ नया API: /api/sellers/sub-orders/:id/status ---
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
        });

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
              .set({ status: newMasterStatus as any, updatedAt: new Date() }) 
              .where(eq(orders.id, existingSubOrder.masterOrder.id));

            // 4. master order tracking में एंट्री जोड़ें
            await tx.insert(orderTracking).values({
              masterOrderId: existingSubOrder.masterOrder.id,
              status: newMasterStatus as any, // ✅ 'confirmed'
              updatedByUserId: userId,
              updatedByUserRole: 'seller', 
              timestamp: new Date(),
              message: `Master order status updated to '${newMasterStatus}' as all sub-orders are ready for delivery/self-delivered.`,
            });
            
            // 5. Socket emit करें
            getIO().emit(`master-order:${existingSubOrder.masterOrder.id}:status-updated`, {
              status: newMasterStatus,
              message: `Master order status updated to '${newMasterStatus}'.`,
            });
          }
        }
        

        // 4. डिलीवरी बैच की स्थिति अपडेट करें (यदि sub-order 'ready_for_pickup' है)
        if (finalStatusForSubOrder === 'ready_for_pickup' && existingSubOrder.deliveryBatch) {
          
          // यदि डिलीवरी बैच अभी भी 'pending' स्थिति में है, तो उसे 'assigned' पर अपडेट करें 
          // (यह मानते हुए कि 'assigned' का मतलब पिकअप के लिए तैयार है)
          if (existingSubOrder.deliveryBatch.status === 'pending') { 
            
            // ✅ deliveryStatusEnum: 'assigned' पर सेट करें
            await tx.update(deliveryBatches)
              .set({ status: 'assigned' as any, updatedAt: new Date() }) 
              .where(eq(deliveryBatches.id, existingSubOrder.deliveryBatch.id));

            await tx.insert(orderTracking).values({
              masterOrderId: existingSubOrder.masterOrder.id,
              deliveryBatchId: existingSubOrder.deliveryBatch.id,
              status: 'assigned' as any,
              updatedByUserId: userId,
              updatedByUserRole: 'seller', 
              timestamp: new Date(),
              message: `Delivery batch status updated to 'assigned' (ready for pickup) by seller for sub-order ${subOrderId}.`,
            });
            getIO().emit(`delivery-batch:${existingSubOrder.deliveryBatch.id}:status-updated`, {
              status: 'assigned',
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
            
