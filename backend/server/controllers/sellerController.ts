import { Request, Response, NextFunction } from 'express';
import { db } from '../db'; 
import { sellersPgTable, stores, subOrders, products, orders } from '../../shared/backend/schema'; 
import { eq, and, gte, sql, desc, isNull, not, lte,or } from 'drizzle-orm';
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
  businessPhone: z.string().regex(/^\d{10}$/, "Invalid Phone Number").optional(),
  isSelfDeliveryBySeller: z.boolean().optional(), // 🔥 New: Self Delivery Toggle
  isOpen: z.boolean().optional(), // 🔥 New: Store Status Toggle
  gstNumber: z.string().max(15).optional().nullable(),
  bankAccountNumber: z.string().regex(/^\d{9,18}$/).optional().nullable(),
  ifscCode: z.string().regex(/^[a-zA-Z]{4}0[a-zA-Z0-9]{6}$/).optional().nullable(),
  deliveryRadius: z.number().int().min(1).max(100).optional().nullable(),
  latitude: z.union([z.number(), z.string()]).optional().nullable(),
  longitude: z.union([z.number(), z.string()]).optional().nullable(),
});

// 1️⃣ Get Seller Dashboard Stats (Confirmed High-Class Logic)
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user?.sellerId;
    if (!sellerId) return res.status(401).json({ message: "Seller ID not found." });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // A. Today's Delivered Sales (Asli Kamai)
   
// 1. Today's Delivered Sales (Ab dono cases handle honge)
const salesResult = await db.select({
    totalSales: sql<number>`sum(${subOrders.total})`.mapWith(Number)
})
.from(subOrders)
.where(and(
    eq(subOrders.sellerId, sellerId),
    // ✅ "delivered" ki jagah inArray use karke dono statuses check karein
    or(
        eq(subOrders.status, 'delivered_by_seller'),
        eq(subOrders.status, 'delivered_by_delivery_boy')
    ),
    gte(subOrders.createdAt, today)
));
    // B. Pending Orders Count
    const pendingCount = await db.select({ count: sql<number>`count(*)` })
        .from(subOrders)
        .where(and(eq(subOrders.sellerId, sellerId), eq(subOrders.status, 'pending')));

    // C. Low Stock Items (Threshold = 5)
    const lowStockResult = await db.select({ count: sql<number>`count(*)` })
        .from(products)
        .where(and(
            eq(products.sellerId, sellerId), 
            lte(products.stock, 5), 
            isNull(products.deletedAt)
        ));

    // D. Recent Orders (Latest 5)
    const recentOrders = await db.query.subOrders.findMany({
        where: eq(subOrders.sellerId, sellerId),
        orderBy: [desc(subOrders.createdAt)],
        limit: 5,
        with: {
            masterOrder: { with: { customer: true } }
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
        recentOrders: recentOrders.map(o => ({
            id: o.id,
            orderNumber: o.subOrderNumber,
            customerName: (o as any).masterOrder?.customer?.firstName || 'Customer',
            totalAmount: o.total,
            status: o.status
        }))
    });
});

// 2️⃣ Toggle Seller Status (Online/Offline) & Self Delivery
export const toggleSellerStatus = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user?.sellerId;
    const { isOpen, isSelfDeliveryBySeller } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (isOpen !== undefined) updateData.isOpen = isOpen;
    if (isSelfDeliveryBySeller !== undefined) updateData.isSelfDeliveryBySeller = isSelfDeliveryBySeller;

    const [updated] = await db.update(sellersPgTable)
        .set(updateData)
        .where(eq(sellersPgTable.id, sellerId))
        .returning();

    return res.status(200).json({ 
        success: true, 
        message: "Status updated successfully", 
        data: updated 
    });
});

// 3️⃣ Get Seller Profile
export const getMySellerProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const seller = await db.query.sellersPgTable.findFirst({
        where: eq(sellersPgTable.userId, userId),
    });
    if (!seller) return res.status(404).json({ message: 'Seller profile not found.' });
    return res.status(200).json({ success: true, data: seller });
});

// 4️⃣ Update Seller Profile (With Store Sync)
export const updateMySellerProfile = asyncHandler(async (req: Request, res: Response) => {
    const sellerIdParam = parseInt(req.params.id, 10);
    const userId = (req as any).user?.id;

    const validation = sellerUpdateSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ errors: validation.error.flatten().fieldErrors });

    const updateData = validation.data;
    const finalUpdateData: any = {
        ...updateData,
        updatedAt: new Date(),
        latitude: updateData.latitude ? String(updateData.latitude) : undefined,
        longitude: updateData.longitude ? String(updateData.longitude) : undefined,
    };

    // Clean undefined
    Object.keys(finalUpdateData).forEach(key => finalUpdateData[key] === undefined && delete finalUpdateData[key]);

    await db.transaction(async (tx) => {
        await tx.update(sellersPgTable).set(finalUpdateData).where(eq(sellersPgTable.id, sellerIdParam));
        
        // Sync with Store table
        const storeUpdateData: any = {
            storeName: updateData.businessName,
            address: updateData.businessAddress,
            city: updateData.city,
            pincode: updateData.pincode,
            latitude: finalUpdateData.latitude,
            longitude: finalUpdateData.longitude,
            updatedAt: new Date(),
        };
        Object.keys(storeUpdateData).forEach(key => storeUpdateData[key] === undefined && delete storeUpdateData[key]);
        
        if (Object.keys(storeUpdateData).length > 1) {
            await tx.update(stores).set(storeUpdateData).where(eq(stores.sellerId, sellerIdParam));
        }
    });

    return res.status(200).json({ success: true, message: "Profile and Store updated." });
});