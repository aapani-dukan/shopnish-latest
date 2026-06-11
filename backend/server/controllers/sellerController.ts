import { Request, Response, NextFunction } from 'express';
import { db } from '../db'; 
import { sellersPgTable, stores, subOrders, products,productVariants, orders, categories } from '../../shared/backend/schema'; 
import { eq, and, gte, sql, desc, isNull, not, lte,or,inArray } from 'drizzle-orm';
import { z } from 'zod';

// ✅ प्रोफेशनल Async Handler
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ✅ Validation Schema
const sellerUpdateSchema = z.object({
  businessName: z.string().min(3).max(100).optional(),
  description: z.string().min(10).max(500).optional(),
  businessAddress: z.string().min(10).max(200).optional(),
  city: z.string().min(2).max(50).optional(),
  pincode: z.string().regex(/^\d{6}$/, "Invalid Pincode").optional(),
  deliveryPincodes: z.array(z.string()).optional(),
  businessPhone: z.string().regex(/^\d{10}$/, "Invalid Phone Number").optional(),
  isSelfDeliveryBySeller: z.boolean().optional(), 
  isOpen: z.boolean().optional(), 
  gstNumber: z.string().max(15).optional().nullable(),
  bankAccountNumber: z.string().regex(/^\d{9,18}$/).optional().nullable(),
  ifscCode: z.string().regex(/^[a-zA-Z]{4}0[a-zA-Z0-9]{6}$/).optional().nullable(),
  isDistanceBasedDelivery: z.boolean().optional(),
  deliveryRadius: z.number().int().min(1).max(100).optional().nullable(),
  latitude: z.union([z.number(), z.string()]).optional().nullable(),
  longitude: z.union([z.number(), z.string()]).optional().nullable(),
});

// 1️⃣ Get Seller Dashboard Stats (Confirmed High-Class Logic بھائی)
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user?.sellerId;
    if (!sellerId) return res.status(401).json({ message: "Seller ID not found." });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 🎯 फिक्स 1: डिलीवर्ड के सारे संभावित स्टेटस शामिल किए भाई, ताकि सेलर की 'असली कमाई' एकदम सटीक दिखे!
    const salesResult = await db.select({
        totalSales: sql<number>`sum(${subOrders.total})`.mapWith(Number)
    })
    .from(subOrders)
    .where(and(
        eq(subOrders.sellerId, sellerId),
        inArray(subOrders.status, [ 'delivered_by_seller', 'delivered_by_delivery_boy']),
        gte(subOrders.createdAt, today)
    ));

    // B. Pending Orders Count
    const pendingCount = await db.select({ count: sql<number>`count(*)` })
        .from(subOrders)
        .where(and(eq(subOrders.sellerId, sellerId), eq(subOrders.status, 'pending')));

    // C. Low Stock Items (Threshold = 5)
    const lowStockResult = await db.select({ count: sql<number>`count(distinct ${products.id})` })
        .from(products)
        .where(and(
            eq(products.sellerId, sellerId), 
            isNull(products.deletedAt),
            sql`exists (
              select 1 from ${productVariants} 
              where ${productVariants.productId} = ${products.id} 
              and ${productVariants.stock} <= 5
              and ${productVariants.isActive} = true
            )`
        ));

    // D. Recent Orders (Latest 5)
    const recentOrders = await db.query.subOrders.findMany({
        where: eq(subOrders.sellerId, sellerId),
        orderBy: (subOrders, { desc }) => [desc(subOrders.createdAt)],
        limit: 5,
        with: {
            // 🎯 फिक्स 2: स्कीमा रिलेशंस के हिसाब से मास्टर ऑर्डर के यूजर/कस्टमर टेबल को बाइंड किया भाई
            masterOrder: { with: { user: true, customer: true } }
        }
    });

    const sellerInfo = await db.query.sellersPgTable.findFirst({
        where: eq(sellersPgTable.id, sellerId)
    });

    return res.status(200).json({
        todaySales: salesResult[0]?.totalSales || 0,
        pendingOrders: pendingCount[0]?.count || 0,
        lowStockItems: lowStockResult[0]?.count || 0,
        isOpen: sellerInfo?.isOpen || false,
        isSelfDelivery: sellerInfo?.isSelfDeliveryBySeller || false,
        recentOrders: recentOrders.map(o => {
            const mOrder = (o as any).masterOrder;
            // यूजर या कस्टमर ऑब्जेक्ट में से जो भी अवेलेबल हो, वहाँ से नाम उठाओ भाई
            const customerName = mOrder?.user?.name || mOrder?.customer?.firstName || 'Customer';
            
            return {
                id: o.id,
                orderNumber: o.subOrderNumber,
                customerName: customerName,
                totalAmount: Number(o.total || 0),
                status: o.status
            };
        })
    });
});


// 3️⃣ Get Seller Profile
export const updateMySellerProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id, 10);

    const validation = sellerUpdateSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            errors: validation.error.flatten().fieldErrors
        });
    }

    // 🚀 यहाँ है कड़क टाइप लॉजिक फिक्स भाई साहब:
    // हमने TypeScript को साफ़ बता दिया कि updateData में Zod के साथ-साथ ये दोनों फील्ड्स भी आ रहे हैं!
    const updateData = validation.data as typeof validation.data & {
        categoryId?: number | null;
        businessPhone?: string;
    };

    // १. पहले सेलर प्रोफाइल का डेटा साफ़ तैयार करो भाई साहब (बिना किसी हार्डकोडिंग के)
    const finalUpdateData: any = {
        ...updateData,
        updatedAt: new Date(),
        latitude: updateData.latitude ? String(updateData.latitude) : undefined,
        longitude: updateData.longitude ? String(updateData.longitude) : undefined,
    };

    // सिर्फ वही कीज डिलीट करो जो सचमुच undefined हैं
    Object.keys(finalUpdateData).forEach(
        key => finalUpdateData[key] === undefined && delete finalUpdateData[key]
    );

    await db.transaction(async (tx) => {
        // User ID से ओरिजिनल सेलर रिकॉर्ड निकालो
        const seller = await tx.query.sellersPgTable.findFirst({
            where: eq(sellersPgTable.userId, userId),
        });

        if (!seller) {
            throw new Error(`Seller not found for userId ${userId}`);
        }

        // २. Seller table को अपडेट मारो
        await tx
            .update(sellersPgTable)
            .set(finalUpdateData)
            .where(eq(sellersPgTable.id, seller.id));

        // ३. category_id से वास्तविक कैटेगरी नाम (Slug या Name) निकालो भाई
        let dynamicStoreType = "grocery"; 
        const sellerCategoryId = updateData.categoryId || seller.categoryId;

        if (sellerCategoryId) {
            const categoryData = await tx.query.categories.findFirst({
                where: eq(categories.id, sellerCategoryId),
            });
            if (categoryData && categoryData.slug) {
                dynamicStoreType = categoryData.slug.toLowerCase();
            } else if (categoryData && categoryData.name) {
                dynamicStoreType = categoryData.name.toLowerCase();
            }
        }

        // ४. अब स्टोर का डेटा 100% फ्रंटएंड फॉर्म और सेलर रिकॉर्ड से डायनेमिक उठाओ
        const storeUpdateData: any = {
            storeName: updateData.businessName || seller.businessName || "My Shop",
            storeType: dynamicStoreType, 
            
            // फ्रंटएंड फॉर्म से आया हुआ असली फोन नंबर, फॉलबैक में सेलर का पुराना नंबर!
            phone: updateData.businessPhone || seller.businessPhone, 
            
            address: updateData.businessAddress || seller.businessAddress,
            city: updateData.city || seller.city || "Bundi",
            pincode: updateData.pincode || seller.pincode || "323001",
            latitude: finalUpdateData.latitude || seller.latitude || null,
            longitude: finalUpdateData.longitude || seller.longitude || null,
            updatedAt: new Date(),
        };

        // सुरक्षा कवच: अगर फोन नंबर बिल्कुल गायब मिले, तो रोको ताकि NOT-NULL एरर न आए
        if (!storeUpdateData.phone) {
            throw new Error(`Dukan ka phone number mandatory hai! Frontend form me input field lagana zaroori hai bhai साहब।`);
        }

        // 🤖 चेक करो कि क्या stores टेबल में लाला जी की दुकान की रो पहले से है?
        const existingStore = await tx
            .select()
            .from(stores)
            .where(eq(stores.sellerId, seller.id))
            .limit(1);

        if (existingStore.length === 0) {
            // 🆕 अगर एंट्री नहीं है, तो बिल्कुल वास्तविक और शुद्ध डेटा के साथ नई रो ठोक दो!
            await tx.insert(stores).values({
                ...storeUpdateData,
                sellerId: seller.id,
                createdAt: new Date(),
            });
            console.log(`🎉 Stores table me Seller ID ${seller.id} ki dukan darj ho gayi!`);
        } else {
            // 🔄 अगर रो पहले से मौजूद है, तो डेटा चकाचक अपडेट कर दो
            await tx
                .update(stores)
                .set(storeUpdateData)
                .where(eq(stores.sellerId, seller.id));
            console.log(`🔄 Stores table me Seller ID ${seller.id} ka data update ho gaya!`);
        }
    });

    return res.status(200).json({
        success: true,
        message: "Profile and Store updated successfully भाई साहब।"
    });
});