
import { Express, Router, Response, NextFunction } from 'express';
import { db } from '../../server/db.js';
import {
  sellersPgTable,
  users,
  deliveryBoys,
  userRoleEnum,
  approvalStatusEnum,
  categories,
  products,
  productVariants,
  stores,
  subOrders, 
  subOrderStatusEnum, 
  orders, 
  masterOrderStatusEnum, 
  orderTracking, 
  deliveryBatches, 
  deliveryStatusEnum, 
  // insertSellerSchema,
  updateSellerSchema
} from '../../shared/backend/schema';
import { requireSellerAuth } from '../../server/middleware/authMiddleware';
import { AuthenticatedRequest, verifyToken } from '../../server/middleware/verifyToken';
import {or, eq, desc, and, ne, exists, inArray, sql,count, sum, avg } from 'drizzle-orm'; // ✅ inArray इम्पोर्ट करें
import multer from 'multer';
import { uploadImage, deleteImage } from '../../server/cloudStorage';
import { v4 as uuidv4 } from "uuid";
import { getIO } from "../../server/socket"; // ✅ Ts फ़ाइल है, इसे .ts के साथ इम्पोर्ट करें
import { getMySellerProfile, updateMySellerProfile } from '../../server/controllers/sellerController'; // 👈 यहाँ नया कंट्रोलर इम्पोर्ट करें
import { authorize, protect } from '../../server/middleware/authorize'; // आपके ऑथेंटिकेशन मिडलवेयर
import { categoryFormInputSchema } from '../../shared/backend/zod-schemas';
import { z } from 'zod';
import { ZodError } from 'zod';
import { sendNotification } from '../../services/notificationService';
import * as fs from 'fs/promises'; 
import * as fsSync from 'fs'; 
import path from 'path';
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


// ✅ POST /api/sellers/apply (Simplified & Clean)
sellerRouter.post("/apply", verifyToken as any, async (req: any, res: Response, next: NextFunction) => {
  try {
    const firebaseUid = req.user?.firebaseUid;
    const currentUserId = req.user?.id; // Ab ye ID hamesha sahi aur synced hogi

    if (!firebaseUid || !currentUserId) return res.status(401).json({ message: "Unauthorized" });

    const {
      businessName, businessAddress, businessPhone, email, 
      city, pincode, gstNumber, businessType, latitude, longitude, description, 
      bankAccountNumber, ifscCode
    } = req.body;

    // --- 🔍 STEP 1: Sirf ye check karo ki kahin ye banda PEHLE SE SELLER toh nahi hai? ---
    const existingSeller = await db.query.sellersPgTable.findFirst({
      where: eq(sellersPgTable.userId, currentUserId)
    });

    if (existingSeller) {
      return res.status(400).json({ message: "Bhai, aapne pehle hi apply kar diya hai!" });
    }

    // --- 🚀 STEP 2: TRANSACTION (Sellers + Stores + User Update) ---
    const result: any = await db.transaction(async (tx) => {

        // 1. Sellers Table mein entry
        const [sellerEntry] = await tx
            .insert(sellersPgTable)
            .values({
                userId: currentUserId,
                firebaseUid: firebaseUid,
                businessName,
                businessAddress,
                businessPhone,
                email: email || null,
                description: description || null,
                city,
                pincode,
                gstNumber: gstNumber || null,
                bankAccountNumber: bankAccountNumber || null,
                ifscCode: ifscCode || null,
                latitude: String(latitude), 
                longitude: String(longitude),
                businessType,
            } as any)
            .returning();
        
        // 2. Store Table mein entry
        await tx.insert(stores).values({
            sellerId: sellerEntry.id,
            storeName: businessName,
            storeType: businessType,
            address: businessAddress,
            city,
            pincode,
            phone: businessPhone,
            isActive: false, // Jab tak admin approve na kare
            latitude: String(latitude),
            longitude: String(longitude),
        } as any);

        // 3. User Table Update (Role update)
        const [updatedUser] = await tx
            .update(users)
            .set({
                // Note: Email aur Phone wahi rakhein jo login ke waqt sync hue the
                // Agar user badalna chahta hai toh yahan update kar sakte hain
                isSeller: true, // Iska request submit ho gaya
                sellerApprovalStatus: 'pending', 
                role: 'seller', // Role ko 'seller' set kar dein, admin approval ke baad bhi yeh role rahega, approvalStatus se pata chalega ki active seller hai ya nahi
                updatedAt: new Date(),
            })
            .where(eq(users.id, currentUserId))
            .returning();
            
        return { sellerEntry, updatedUser };
    });

    return res.status(201).json({
      message: "Application submitted successfully!",
      seller: result.sellerEntry, 
      user: result.updatedUser
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
    
    // Revenue calculation line (Line 130 ke paas):
const [{ totalRevenueResult }] = await db
  .select({ totalRevenueResult: sql<string | number>`sum(${subOrders.total}::numeric)` }) 
  .from(subOrders)
  .where(eq(subOrders.sellerId, sellerId));

const totalRevenue = Number(totalRevenueResult) || 0; // ✅ String to Number safe conversion
const sellerProfileWithRating = sellerProfile as unknown as { rating: number | null, [key: string]: any };

    // औसत रेटिंग की गणना
    // विकल्प 1: यदि sellerProfile में सीधे रेटिंग है (आपका वर्तमान कार्यान्वयन)
    const averageRatingFromProfile = sellerProfileWithRating.rating || 0;

    let calculatedAverageRating = averageRatingFromProfile; 

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

   // ✅ JSON parsing ko safe banayein (Object vs String check)
    const formattedSubOrders = sellerSubOrders.map(subOrder => {
      let rawAddress = subOrder.masterOrder?.deliveryAddress;
      let parsedDeliveryAddress = {};

      try {
        if (rawAddress) {
          if (typeof rawAddress === 'object') {
            parsedDeliveryAddress = rawAddress;
          } 
          else if (typeof rawAddress === 'string') {
            if (rawAddress.startsWith('{') || rawAddress.startsWith('[')) {
              parsedDeliveryAddress = JSON.parse(rawAddress);
            } else {
              console.warn(`Invalid JSON string found in order ${subOrder.id}: ${rawAddress}`);
              parsedDeliveryAddress = { error: "Invalid address format" };
            }
          }
        }
      } catch (e) {
        console.error(`❌ JSON Parse Error (Sub-order ${subOrder.id}):`, e);
        parsedDeliveryAddress = { error: "Parse failed" };
      }

      return {
        ...subOrder,
        masterOrder: {
          ...subOrder.masterOrder,
          deliveryAddress: parsedDeliveryAddress,
        }
      };
    });

    // ✅ Response bhejien
    return res.status(200).json(formattedSubOrders);

  } catch (error: any) { // 👈 Ye wala Catch aapke code mein missing tha
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

      // 1. सेलर प्रोफाइल निकालें
      const [sellerProfile] = await db
        .select()
        .from(sellersPgTable)
        .where(eq(sellersPgTable.userId, userId));

      if (!sellerProfile) {
        return res.status(404).json({ error: 'Seller profile not found. Please complete registration.' });
      }

      const sellerId = sellerProfile.id;

      // 2. Request Body से डेटा निकालें (वैरिएंट्स के साथ भाई)
      const {
        name,
        nameHindi,
        description,
        descriptionHindi,
        categoryId,
        brand,
        estimatedDeliveryTime,
        variants // 🔥 फ्रंटएंड से यह JSON string या Array के रूप में आएगा भाई
      } = req.body;

      const file = req.file;

      // 3. Basic Validation (अब मुख्य प्रोडक्ट के लिए प्राइस और स्टॉक की ज़रूरत यहाँ नहीं है भाई)
      if (!name || !categoryId || !file || !variants) {
        return res.status(400).json({ error: 'Missing required fields, image, or product variants.' });
      }

      // 4. वैरिएंट्स को सेफ़्ली पार्स करें (चूँकि multipart/form-data है, तो यह string में आ सकता है भाई)
      let parsedVariants: any[] = [];
      try {
        parsedVariants = typeof variants === 'string' ? JSON.parse(variants) : variants;
      } catch (e) {
        return res.status(400).json({ error: 'Invalid formats for variants data. Expected a valid array.' });
      }

      if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
        return res.status(400).json({ error: 'At least one product variant is required.' });
      }

      const parsedCategoryId = parseInt(categoryId as string);
      if (isNaN(parsedCategoryId)) {
        return res.status(400).json({ error: 'Invalid category ID.' });
      }

      // 5. Delivery Time Logic
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

      // 🔒 7. डेटाबेस ट्रांजेक्शन: मुख्य प्रोडक्ट और वैरिएंट्स दोनों एक साथ सुरक्षित जाएँगे भाई
      const finalResult = await db.transaction(async (tx) => {
        
        // A. पहले मुख्य प्रोडक्ट इन्सर्ट करो (इसमें प्राइस, स्टॉक, यूनिट नहीं है भाई!)
        const [newProduct] = await tx
          .insert(products)
          .values({
            name: name.trim(),
            nameHindi: nameHindi || null,
            description: description || null,
            descriptionHindi: descriptionHindi || null,
            categoryId: parsedCategoryId,
            image: imageUrl,
            sellerId,
            brand: brand || null,
            estimatedDeliveryTime: finalDeliveryTime,
            approvalStatus: 'pending', // 'pending' डिफ़ॉल्ट
          })
          .returning();

        // B. लूप चलाकर दोनों प्लान्स (प्लान 1: मात्रा/यूनिट + प्लान 2: डिस्काउंट गणित) को प्रोसेस करो भाई
        const variantsToInsert = parsedVariants.map((v: any) => {
          const origPrice = parseFloat(v.originalPrice as string) || 0;
          const discValue = parseFloat(v.discountValue as string) || 0;
          const dType = v.discountType || 'percentage'; // 'percentage' या 'fixed_amount'
          
          let sellingPrice = origPrice;

          // 🎯 प्लान 2: डिस्काउंट टाइप के अनुसार फाइनल प्राइस कैलकुलेशन
          if (dType === 'percentage') {
            sellingPrice = origPrice - (origPrice * discValue / 100);
          } else if (dType === 'fixed_amount') {
            sellingPrice = origPrice - discValue;
          }

          if (sellingPrice < 0) sellingPrice = 0; // सुरक्षा जांच

          // 🎯 प्लान 1: मात्रा और यूनिट मैपिंग
          return {
            productId: newProduct.id,
            quantityValue: String(v.quantityValue), // e.g., "250", "Half", "9"
            unit: v.unit || 'piece',               // e.g., "Gram", "Plate", "Size"
            originalPrice: origPrice,              // MRP
            discountType: dType,
            discountValue: discValue,
            price: sellingPrice,                   // 💰 फाइनल बिकने वाली प्राइस
            stock: parseInt(v.stock as string) || 0,
            minOrderQty: parseInt(v.minOrderQty as string) || 1,
            maxOrderQty: parseInt(v.maxOrderQty as string) || 100,
            sku: v.sku || null,
            offerLabel: v.offerLabel || null,
            isActive: true,
          };
        });

        // C. अब सारे वैरिएंट्स को एक साथ 'product_variants' टेबल में ठोक दो भाई
        await tx.insert(productVariants).values(variantsToInsert);

        return newProduct;
      });

      // 8. Real-time Notification
      getIO().emit("product:created", {
        message: "New variant-based product waiting for approval",
        product: finalResult
      });

      return res.status(201).json({
        success: true,
        message: "Product and all variants created successfully!",
        product: finalResult
      });

    } catch (error: any) {
      console.error('❌ Error in POST /api/sellers/products:', error);
      return res.status(500).json({ error: 'Internal Server Error while creating product structure.' });
    }
  }
);
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

    return res.status(200).json({
  id: seller.id,
  businessName: seller.businessName,
  todaySales: 0,
  pendingOrders: 0,
  activeProducts: 0,
  newReviews: 0,
  isOpen: seller.isOpen ?? false, 
  // 🆕 Yeh line zaroor add karein:
  isSelfDeliveryBySeller: seller.isSelfDeliveryBySeller ?? false, 
  recentOrders: []
});
    } catch (error) {
      console.error("Dashboard Stats Error:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);
// 📍 Naya Route: PATCH /api/sellers/profile/me
sellerRouter.patch(
  '/profile/me', 
  requireSellerAuth, 
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id; // Token se milne wali User ID (35)
      
      // Database se asli Seller Profile nikaalo
      const [sellerProfile] = await db
        .select()
        .from(sellersPgTable)
        .where(eq(sellersPgTable.userId, userId));

      if (!sellerProfile) {
        return res.status(404).json({ error: "Seller profile not found." });
      }
      req.params.id = String(sellerProfile.id); 
      
      // Ab seedha wahi update logic call karein
      return updateMySellerProfile(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);
// 📍 PATCH /api/sellers/:id - सेलर प्रोफाइल अपडेट (Multi-Role Logic)
sellerRouter.patch(
  '/:id',
  requireSellerAuth, 
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const paramsId = parseInt(req.params.id);
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

// ✅ PATCH /api/sellers/products/:id (प्रोडक्ट और वैरिएंट्स दोनों अपडेट करें भाई)
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

      // 1. Seller Profile Check
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
        nameHindi,
        description,
        descriptionHindi,
        categoryId,
        brand,
        estimatedDeliveryTime,
        imageUrl: newImageUrlFromClient,
        variants // 🔥 हमारे दोनों प्लान्स के लिए वैरिएंट्स का नया डेटा आएगा भाई
      } = req.body;

      // 🌟 Image Update & Cleanup Logic
      let finalImageUrl = existingProduct.image;
      if (newImageUrlFromClient !== undefined && newImageUrlFromClient !== existingProduct.image) {
        if (existingProduct.image) {
          console.log(`[CLEANUP] Deleting old image: ${existingProduct.image}`);
          await deleteImage(existingProduct.image).catch(err => 
            console.warn(`⚠️ Cloud delete failed:`, err.message)
          );
        }
        finalImageUrl = newImageUrlFromClient;
      }

      // ✏️ A. मुख्य प्रोडक्ट का पेलोड तैयार करें (इसमें प्राइस/स्टॉक नहीं रहेगा भाई)
      const productUpdatePayload: any = {
        updatedAt: new Date(),
        image: finalImageUrl
      };

      if (name !== undefined) productUpdatePayload.name = name.trim();
      if (nameHindi !== undefined) productUpdatePayload.nameHindi = nameHindi;
      if (description !== undefined) productUpdatePayload.description = description;
      if (descriptionHindi !== undefined) productUpdatePayload.descriptionHindi = descriptionHindi;
      if (categoryId !== undefined) productUpdatePayload.categoryId = parseInt(String(categoryId));
      if (brand !== undefined) productUpdatePayload.brand = brand;
      if (estimatedDeliveryTime !== undefined) productUpdatePayload.estimatedDeliveryTime = estimatedDeliveryTime;

      // 🔒 3. डेटाबेस ट्रांजेक्शन: मुख्य प्रोडक्ट और उसके वैरिएंट्स एक साथ अपडेट होंगे भाई
      const finalUpdatedProduct = await db.transaction(async (tx) => {
        
        // Step 1: मुख्य प्रोडक्ट को अपडेट मारो भाई
        const [updatedProduct] = await tx
          .update(products)
          .set(productUpdatePayload)
          .where(eq(products.id, productId))
          .returning();

        // Step 2: अगर फ्रंटएंड से नए वैरिएंट्स की लिस्ट भेजी गई है, तो पुराने वालों को रीसेट करो भाई
        if (variants && Array.isArray(variants) && variants.length > 0) {
          
          // पहले पुराने सारे वैरिएंट्स को साफ़ कर दो भाई (Clean Slate)
          await tx.delete(productVariants).where(eq(productVariants.productId, productId));

          // अब लूप चलाकर दोनों प्लान्स (मात्रा + डिस्काउंट टाइप) का नया गणित लगाओ
          const variantsToInsert = variants.map((v: any) => {
            const origPrice = parseFloat(v.originalPrice as string) || 0;
            const discValue = parseFloat(v.discountValue as string) || 0;
            const dType = v.discountType || 'percentage'; // 'percentage' या 'fixed_amount'
            
            let sellingPrice = origPrice;

            // 🎯 प्लान 2: डिस्काउंट टाइप का ऑटोमैटिक कैलकुलेशन
            if (dType === 'percentage') {
              sellingPrice = origPrice - (origPrice * discValue / 100);
            } else if (dType === 'fixed_amount') {
              sellingPrice = origPrice - discValue;
            }

            if (sellingPrice < 0) sellingPrice = 0;

            // 🎯 प्लान 1: मात्रा और यूनिट सेटिंग
            return {
              productId: productId,
              quantityValue: String(v.quantityValue), // e.g., "500", "Full"
              unit: v.unit || 'piece',               // e.g., "Gram", "Plate"
              originalPrice: origPrice,              // MRP
              discountType: dType,
              discountValue: discValue,
              price: sellingPrice,                   // 💰 डिस्काउंट के बाद की फाइनल सेलिंग प्राइस
              stock: parseInt(v.stock as string) || 0,
              minOrderQty: parseInt(v.minOrderQty as string) || 1,
              maxOrderQty: parseInt(v.maxOrderQty as string) || 100,
              sku: v.sku || null,
              offerLabel: v.offerLabel || null,
              isActive: true,
            };
          });

          // नए वैरिएंट्स को ठोक दो टेबल में भाई
          await tx.insert(productVariants).values(variantsToInsert);
        }

        return updatedProduct;
      });

      // 🔊 Real-time Sync (Socket.io)
      getIO().emit("product:updated", finalUpdatedProduct);

      return res.status(200).json({
        success: true,
        message: "Product and variants updated successfully!",
        product: finalUpdatedProduct
      });

    } catch (error: any) {
      console.error("❌ PATCH Product Error:", error);
      return res.status(500).json({ message: "Internal server error during update." });
    }
  }
);
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
            columns: { id: true, customerId: true,orderNumber: true, status: true,deliveryAddress: true,customer: true}
          },
          deliveryBatch: {
            columns: { id: true, status: true, deliveryBoyId: true }
          }
        }
      });

      if (!existingSubOrder) {
        return res.status(403).json({ error: 'Not authorized to update this sub-order or sub-order not found.' });
      }

      const currentStatus = existingSubOrder.status;
      const validStatusTransitions: { [key: string]: string[] } = {
        'pending': ['accepted', 'rejected'],
        'accepted': ['preparing', 'ready_for_pickup', 'rejected'],
        'preparing': ['ready_for_pickup','rejected'],
        // 'ready_for_pickup' के बाद केवल सिस्टम या डिलीवरी बॉय ही स्थिति बदल सकता है,
        // जब तक कि सेल्फ-डिलीवरी न हो (जिसे हम नीचे संभालेंगे)।
        'ready_for_pickup': existingSubOrder.isSelfDeliveryBySeller ? ['delivered_by_seller'] : [],
        'delivered_by_seller': [],
        'rejected': [],
        'cancelled': [],
         'delivered_by_delivery_boy': [],
      };

      if (!validStatusTransitions[currentStatus]?.includes(newStatus) && newStatus !== currentStatus) {
        return res.status(400).json({ error: `Invalid status transition from '${currentStatus}' to '${newStatus}'.` });
      }
      
      let finalStatusForSubOrder = newStatus;
      
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
        );
        
        if (allSubOrdersReadyOrFinalizedBySeller) {
          const [currentMasterOrder] = await tx.select().from(orders).where(eq(orders.id, existingSubOrder.masterOrder.id));
          
          if (
              currentMasterOrder && 
              currentMasterOrder.status !== 'fulfilled' &&
              currentMasterOrder.status !== 'cancelled' &&
              currentMasterOrder.status !== 'failed'
          ) {
            
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
        if (finalStatusForSubOrder === 'ready_for_pickup' && existingSubOrder.deliveryBatch) {
          
          if (existingSubOrder.deliveryBatch.status === 'pending') { 
            
            const currentBatchStatus = existingSubOrder.deliveryBatch.status; 
            
            await tx.insert(orderTracking).values({
              masterOrderId: existingSubOrder.masterOrder.id,
              deliveryBatchId: existingSubOrder.deliveryBatch.id,
              status: currentBatchStatus as any, 
              updatedByUserId: userId,
              updatedByUserRole: 'seller', 
              timestamp: new Date(),
              message: `Delivery batch is now Ready for Claiming (Status: Pending) by seller.`, 
            } as any);
            
            // --- ✅ SIREN & BATCH ALERT LOGIC (DELIVERY BOYS) ---
            const io = getIO(); 
            
            const masterOrderObj = existingSubOrder.masterOrder as any;
            
            // 📍 Logs ke mutabik correct address parsing
            const relationAddressObj = masterOrderObj?.deliveryAddress;
            const pickupLocation = relationAddressObj?.address_line1 
                || masterOrderObj?.delivery_address 
                || 'Shop Location';
            const city = relationAddressObj?.city || masterOrderObj?.delivery_city || '';

            // 👤 Logs ke mutabik correct customer name parsing
            const customerObj = masterOrderObj?.customer;
            const firstName = customerObj?.first_name || customerObj?.firstName || '';
            const lastName = customerObj?.last_name || customerObj?.lastName || '';
            let customerName = `${firstName} ${lastName}`.trim();
            if (!customerName) customerName = masterOrderObj?.full_name || 'Customer';

            const batchAlertData = {
                deliveryBatchId: existingSubOrder.deliveryBatch.id,
                batchNumber: `BTCH-${existingSubOrder.deliveryBatch.id}`,
                orderNumber: masterOrderObj?.orderNumber || 'N/A', 
                pickupLocation: pickupLocation, 
                city: city,
                customerName: customerName,
                message: "Naya delivery batch pickup ke liye taiyar hai!",
                status: currentBatchStatus,
            };

            io.emit('new-available-delivery', batchAlertData);

            io.emit(`delivery-batch:${existingSubOrder.deliveryBatch.id}:status-updated`, {
              status: currentBatchStatus, 
              message: `Delivery batch is ready for claiming.`,
            });           

            io.emit(`available-batches:new-batch-ready`, batchAlertData);

            console.log(`🚚 [DELIVERY SIREN]: Broadcasted Socket alerts for Batch ID: ${existingSubOrder.deliveryBatch.id}`);
          
            // 🚨 PUSH NOTIFICATION WITH FORCED SIREN CHANNEL 🚨
            const sellerLat = parseFloat(String(sellerProfile.latitude || '0'));
            const sellerLng = parseFloat(String(sellerProfile.longitude || '0'));

            console.log(`📍 [FILTER] Seller Live Location: (${sellerLat}, ${sellerLng})`);

            // Safe Database call (Bina active transaction block lagaye pure system se load karein)
         // --- 🚨 LIVE BUSINESS FAIL-SAFE SIREN LOGIC 🚨 ---
            console.log(`📍 [FILTER] Seller Live Location: (${sellerLat}, ${sellerLng})`);

            const eligibleDeliveryBoys = await db
              .select({
                id: deliveryBoys.id,
                currentLat: deliveryBoys.currentLat,
                currentLng: deliveryBoys.currentLng,
                fcmToken: users.fcmToken, 
              })
              .from(deliveryBoys)
              .leftJoin(users, eq(deliveryBoys.userId, users.id)); 

            console.log(`🚚 [DELIVERY SIREN]: Location check ke liye total ${eligibleDeliveryBoys.length} delivery boys mile.`);

            const maxRadiusKm = 5; 
            let notificationCount = 0;

            for (const boy of eligibleDeliveryBoys) {
              if (!boy.fcmToken) continue; // Agar FCM token hi nahi hai, toh hi skip karenge

              let isEligible = false;
              let displayDistance = "Nearby";

              // 📍 LAYER 1: Agar live location mil rahi hai, toh 5 KM ka perfect radius check karo
              if (boy.currentLat && boy.currentLng) {
                const boyLat = parseFloat(boy.currentLat);
                const boyLng = parseFloat(boy.currentLng);

                const R = 6371; 
                const dLat = ((boyLat - sellerLat) * Math.PI) / 180;
                const dLng = ((boyLng - sellerLng) * Math.PI) / 180;
                
                const a =
                  Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos((sellerLat * Math.PI) / 180) *
                    Math.cos((boyLat * Math.PI) / 180) *
                    Math.sin(dLng / 2) *
                    Math.sin(dLng / 2);
                
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distance = R * c; 

                if (distance <= maxRadiusKm) {
                  isEligible = true;
                  displayDistance = `${distance.toFixed(1)} KM`;
                }
              } else {
                // 🌆 LAYER 2: APP BAND BACKUP - Agar app band hone se location NULL hai,
                // toh delivery boy ko drop mat karo, use direct notification bhej do!
                isEligible = true; 
                displayDistance = "Active Zone";
              }

              // 🚀 Agar delivery boy eligible hai (ya toh range me hai ya active area me hai)
              if (isEligible) {
                notificationCount++;
                
                sendNotification(
                  boy.fcmToken, 
                  "🚚 Naya Delivery Task Taiyar Hai!", 
                  `Batch ${batchAlertData.batchNumber} pickup karein. (${displayDistance})`, 
                  { 
                    batchId: String(existingSubOrder.deliveryBatch.id),
                    channelId: "delivery_siren_v10", // Mobile app ka strict custom channel
                    sound: "siren" // Background custom ringtone trigger
                  }, 
                  'delivery' 
                ).catch(err => console.error("❌ Delivery Push Error:", err));
              }
            }  

            console.log(`🚀 [DELIVERY SIREN]: Total ${notificationCount} delivery boys ko 5 KM ke andar siren bheja gaya.`);
          } 
        }
        
        // 5. Socket.io: कस्टमर और सेलर को रियल-TIME अपडेट भेजें
        const finalIo = getIO(); 
        finalIo.emit(`user:${existingSubOrder.masterOrder.customerId}:order-update`, {
          subOrderId: subOrderId,
          status: finalStatusForSubOrder,
          masterOrderId: existingSubOrder.masterOrder.id,
          message: `Your order from ${sellerProfile.businessName} is now '${finalStatusForSubOrder}'.`,
        });
        
        finalIo.emit(`seller:${sellerId}:order-update`, {
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
            
// ✅ नया API: /api/sellers/sub-orders/:orderId/details
sellerRouter.get('/sub-orders/:orderId/details', requireSellerAuth, async (req: any, res: Response) => {
  try {
    const { orderId } = req.params;

    const subOrder = await db.query.subOrders.findFirst({
      where: eq(subOrders.id, parseInt(orderId)),
      with: {
        masterOrder: {
          with: {
            customer: {
              columns: { firstName: true, lastName: true, phone: true }
            },
            deliveryAddress: true,
          }
        },
        orderItems: true, // 👈 Sabse zaroori: Items yahan se aayenge
      }
    });

    if (!subOrder) {
      return res.status(404).json({ error: "Sub-order details not found" });
    }

    // ✅ Frontend ki umeed (Mapping) ke mutabiq data format karein
    const formattedData = {
      id: subOrder.id,
      subordernumber: subOrder.subOrderNumber,
      status: subOrder.status,
      createdAt: subOrder.createdAt,
      paymentMethod: subOrder.masterOrder?.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online',
      
      customerName: `${subOrder.masterOrder?.customer?.firstName} ${subOrder.masterOrder?.customer?.lastName || ''}`,
      customerPhone: subOrder.masterOrder?.customer?.phone,
      
      deliveryAddress: subOrder.masterOrder?.deliveryAddress,

      // 🛒 Items ki mapping
      items: subOrder.orderItems.map((item: any) => ({
        productName: item.productName,
        quantity: item.quantity,
        unit: item.productUnit || 'unit',
        itemTotal: item.itemTotal
      })),
      
      total: subOrder.total,
    };

    return res.status(200).json({ subOrder: formattedData });

  } catch (error) {
    console.error("❌ Error fetching sub-order details:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default sellerRouter;
            
