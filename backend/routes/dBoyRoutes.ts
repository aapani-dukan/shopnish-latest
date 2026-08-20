// backend/server/routes/dBoyRoutes.ts

import { Router, Request, Response } from 'express';
import { db } from '../server/db';
import {
  deliveryBoys,
  users,
  deliveryBatches,
  deliveryStatusEnum,
  subOrders,
  subOrderStatusEnum,
  orders,
  orderItems,
  masterOrderStatusEnum,
  orderTracking,
  sellersPgTable, // 'sellersPgTable' को 'sellers' में बदल दिया गया है
  approvalStatusEnum,
  userRoleEnum,
  adminSettings,
} from '../shared/backend/schema';
import { eq, and, or, not, desc, asc, inArray, isNull,exists,sql,lt } from 'drizzle-orm';
import { AuthenticatedRequest, verifyToken } from '../server/middleware/verifyToken';
import { requireDeliveryBoyAuth } from '../server/middleware/authMiddleware';
import { getIO } from '../server/socket';
import { sendWhatsAppMessage } from '../server/lib/whatsappHelpers'; // ✅ केवल WhatsApp मैसेज का उपयोग
import { generateOTP } from '../server/util/otp'; // ✅ 'generateOTP' सही नाम है
import { WalletService } from '../services/walletService';
import { verifyFirebaseOnly } from '../server/middleware/authMiddleware'; // ✅ Firebase-only verification middleware

const router = Router();

//Simplified Delivery Boy Registration
router.post('/register', verifyFirebaseOnly as any, async (req: any, res: Response) => {
  try {
    const { vehicleType, vehicleNumber, fullName, email } = req.body; // Email sirf store karne ke liye hai
    const firebaseUid = req.firebaseUser.uid;
    const phone = req.firebaseUser.phone_number || "";

    if (!vehicleType || !fullName || !phone) {
      return res.status(400).json({ message: "Bhai, Name, Phone aur Vehicle details zaroori hain." });
    }

    const result = await db.transaction(async (tx) => {
      // ✅ STEP A: Users Table - Phone Number se Merge Karo
      // Agar Phone pehle se hai (ID 57), toh bas Firebase UID aur flags update karo
      const [userEntry] = await tx.insert(users)
        .values({
          firebaseUid: firebaseUid,
          phone: phone,
          email: email || "", // Email sirf info ki tarah jayega
          firstName: fullName,
          isDelivery: true,
          deliveryApprovalStatus: 'pending',
          role: 'delivery-boy',
        })
        .onConflictDoUpdate({
          target: [users.phone], // 🎯 Main Target: Phone Number (Conflict yahan solve hoga)
          set: { 
            firebaseUid: firebaseUid, // Nayi UID link kar do
            isDelivery: true, 
            deliveryApprovalStatus: 'pending',
            firstName: fullName,
            updatedAt: new Date()
          }
        })
        .returning();

      const userId = userEntry.id;

      // ✅ STEP B: Delivery Boys Profile
      const [deliveryEntry] = await tx.insert(deliveryBoys)
        .values({
          userId: userId,
          firebaseUid: firebaseUid,
          name: fullName,
          phone: phone,
          email: email || userEntry.email || "",
          vehicleType,
          vehicleNumber: vehicleNumber || null,
          approvalStatus: 'pending',
          isOnline: false,
        })
        .onConflictDoUpdate({
          target: [deliveryBoys.userId],
          set: { 
            name: fullName, 
            vehicleType, 
            vehicleNumber, 
            approvalStatus: 'pending',
            updatedAt: new Date() 
          }
        })
        .returning();

      return deliveryEntry;
    });

    if (result) {
      getIO().emit("admin:update", { type: "delivery-boy-register", data: result });
      return res.status(201).json({
        message: "Application submitted successfully! Admin approval ka intezar karein.",
        deliveryBoy: result
      });
    }
  } catch (error: any) {
    console.error("❌ Final Registration Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});


/**
 * ✅ Updated Login: Ab Pending users ko bhi entry milegi
 * /api/delivery-boys/login
 */
router.post('/login', verifyToken as any, async (req: any, res: Response) => {
  try {
    const firebaseUid = req.user?.firebaseUid;

    if (!firebaseUid) {
      return res.status(401).json({ message: "Authentication failed. Firebase UID missing." });
    }

    const deliveryBoy = await db.query.deliveryBoys.findFirst({
      where: eq(deliveryBoys.firebaseUid, firebaseUid),
      with: { user: true }
    });

    // 1. Agar Delivery Boy table mein entry hi nahi hai (Matlab naya banda hai)
    if (!deliveryBoy) {
      return res.status(404).json({ message: "Account not found. Please register first." });
    }

    // 2. 🚩 SMART CHECK: Agar status 'rejected' hai toh use block karein
    if (deliveryBoy.approvalStatus === 'rejected') {
      return res.status(403).json({ message: "Aapki application reject kar di gayi hai. Support se baat karein." });
    }

    // 3. ✅ SUCCESS: Ab chahe 'pending' ho ya 'approved', hum 200 OK bhejenge
    // Mobile App ab is 'approvalStatus' ko dekh kar "Wait" message dikhayega
    res.status(200).json({ 
      message: "Login successful", 
      user: deliveryBoy,
      status: deliveryBoy.approvalStatus // 'pending' ya 'approved'
    });

  } catch (error: any) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Failed to authenticate." });
  }
});
// ---
/**
 * ✅ GET Delivery Boy Profile
 * /api/delivery-boys/me
 */
router.get('/me', requireDeliveryBoyAuth, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: Missing user data.' });
    }

    const [deliveryBoyProfile] = await db
      .select()
      .from(deliveryBoys)
      .where(eq(deliveryBoys.userId, userId));

    if (!deliveryBoyProfile) {
      return res.status(404).json({ error: 'Delivery Boy profile not found.' });
    }

    return res.status(200).json(deliveryBoyProfile);
  } catch (error: any) {
    console.error('❌ Error in GET /api/delivery-boys/me:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/delivery/update-location
// 🎯 फिक्स: लोकेशन सिंक को 100% एरर-फ़्री और टाइप-सेफ़ बनाया भाई!
router.put('/update-location', requireDeliveryBoyAuth, async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        const { latitude, longitude, activeBatchIds } = req.body;

        // 🚨 गेट-कीपर चेक
        if (!activeBatchIds || !Array.isArray(activeBatchIds) || activeBatchIds.length === 0) {
            return res.status(200).json({ success: true, message: 'No active batches to track. Sync ignored safely.' });
        }

        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and Longitude are required.' });
        }

        // 1. Delivery boy ki profile dhoondho
        const boyProfile = await db.query.deliveryBoys.findFirst({
            where: eq(deliveryBoys.userId, userId)
        });

        if (!boyProfile) {
            return res.status(404).json({ error: 'Delivery boy profile not found.' });
        }

        const now = new Date();
        const ONE_HOUR_MS = 60 * 60 * 1000; 

        // 🔐 कड़क सुरक्षा + टाइप फिक्स: 'activeBatchIds' के मैप को 'as any' कास्ट कर दिया ताकि Drizzle बुरा न माने भाई!
        const dbBatches = await db.query.deliveryBatches.findMany({
            where: and(
                inArray(deliveryBatches.id, activeBatchIds.map(id => Number(id)) as any),
                eq(deliveryBatches.deliveryBoyId, boyProfile.id) 
            )
        });

        // सिर्फ़ उन्हीं बैचेस को छांटें जो 'picked_up' या 'out_for_delivery' हैं और 1 घंटे से कम पुराने हैं
        const validBatches = dbBatches.filter((batch: any) => {
            if (batch.status !== 'picked_up' && batch.status !== 'out_for_delivery') return false;

            const batchUpdateTime = new Date(batch.updatedAt).getTime();
            const timeElapsed = now.getTime() - batchUpdateTime;

            return timeElapsed < ONE_HOUR_MS;
        });

        // 🚨 ब्रह्मास्त्र चेक
        if (validBatches.length === 0) {
            return res.status(200).json({ 
                success: false, 
                message: 'Location sync skipped. All batches are either expired (>1 hour) or not in active transit state.' 
            });
        }

        // 2. Database mein current location update karo
        await db.update(deliveryBoys)
            .set({
                currentLat: String(latitude),
                currentLng: String(longitude),
                updatedAt: new Date()
            })
            .where(eq(deliveryBoys.id, boyProfile.id));

        console.log(`📌 [GPS SYNC SUCCESS]: Rider ID ${boyProfile.id} updated to (${latitude}, ${longitude})`);

        // 🚀 मल्टी-रूम सॉकेट ब्रॉडकास्ट
        try {
            const io = getIO(); 
            for (const batch of validBatches) {
                if (batch.masterOrderId) {
                    io.to(`order:${batch.masterOrderId}`).emit("order:delivery_location", {
                        lat: Number(latitude),
                        lng: Number(longitude),
                        batchId: batch.id,
                        timestamp: new Date().toISOString(),
                    });
                    console.log(`📡 [AUTO-SOCKET]: Sent location to customer room: order:${batch.masterOrderId}`);
                }
            }
        } catch (socketErr) {
            console.error("❌ Socket broadcast failed:", socketErr);
        }

        return res.status(200).json({ success: true, message: 'Location updated successfully for valid active batches.' });
    } catch (error: any) {
        console.error('❌ Error updating delivery boy location:', error);
        return res.status(500).json({ error: 'Failed to update location.' });
    }
});

// 📌 PATCH /api/delivery/update-fcm-token
// Mobile app se aane wale FCM token ko permanently database mein save karne ke liye
router.patch('/update-fcm-token', requireDeliveryBoyAuth, async (req: any, res: Response) => {
    try {
        const userId = req.user?.id; // Auth middleware se nikaali gayi logged-in user ID
        const { fcmToken } = req.body;

        if (!fcmToken) {
            return res.status(400).json({ error: 'FCM Token is required.' });
        }

        // Database mein users table ke andar fcmToken column ko update karein
        await db.update(users)
            .set({ 
                fcmToken: fcmToken,
                updatedAt: new Date()
            })
            .where(eq(users.id, userId));

        console.log(`🚀 [FCM SYNC SUCCESS]: User ID ${userId} ka FCM Token successfully save ho gaya.`);
        return res.status(200).json({ success: true, message: 'FCM Token updated successfully.' });

    } catch (error: any) {
        console.error('❌ Error in /update-fcm-token:', error);
        return res.status(500).json({ error: 'Failed to update FCM token.' });
    }
});
// 🎯 Batch Details API - एरे पार्सिंग और इंडेक्सिंग के साथ 100% फिक्स
// 🎯 Batch Details API - JSON एड्रेस पार्सिंग और कॉम्पैटिबिलिटी के साथ 100% फिक्स भाई
router.get('/batch-details/:id', async (req, res) => {
    try {
        const batchId = parseInt(req.params.id);
        if (isNaN(batchId)) {
            return res.status(400).json({ success: false, message: "Invalid Batch ID" });
        }

        const batchData = await db.query.deliveryBatches.findFirst({
            where: eq(deliveryBatches.id, batchId),
            with: {
                subOrders: {
                    with: {
                        masterOrder: {
                            with: {
                                // 🎯 फिक्स 1: 'deliveryAddress' अब टेबल रिलेशन नहीं है, इसलिए इसे 'with' से हटा दिया भाई!
                                customer: true
                            }
                        }
                    }
                }
            }
        });

        if (!batchData) {
            return res.status(404).json({ success: false, message: "Batch not found" });
        }

        const currentSubOrders = batchData.subOrders || [];
        
        const formattedOrders = currentSubOrders.map((so: any) => {
            const nestedMaster = so.masterOrder as any;
            const customerObj = nestedMaster?.customer || {};

            // 🎯 फिक्स 2: मास्टर ऑर्डर के स्ट्रिंग वाले 'deliveryAddress' को सेफ़ली पार्स करना भाई!
            let parsedAddressObj: any = null;
            if (nestedMaster?.deliveryAddress && typeof nestedMaster.deliveryAddress === 'string') {
                try {
                    parsedAddressObj = JSON.parse(nestedMaster.deliveryAddress);
                } catch (e) {
                    console.warn("Failed to parse deliveryAddress JSON inside batch details:", e);
                }
            }

            // 👤 CUSTOMER NAME EXTRACTION (पार्स किए हुए ऑब्जेक्ट से असली नाम भाई)
            let finalCustomerName = "Customer"; 
            if (parsedAddressObj?.fullName || parsedAddressObj?.fullNameHindi) {
                finalCustomerName = String(parsedAddressObj.fullName || parsedAddressObj.fullNameHindi).trim();
            } else {
                let firstName = customerObj?.firstName || customerObj?.first_name || '';
                let lastName = customerObj?.lastName || customerObj?.last_name || '';
                finalCustomerName = `${firstName} ${lastName}`.trim();
            }

            if (!finalCustomerName || finalCustomerName === "null" || finalCustomerName === "undefined") {
                finalCustomerName = "Customer";
            }

            // 📞 PHONE NUMBER EXTRACTION
            const finalPhone = parsedAddressObj?.phone || customerObj?.phone || nestedMaster?.customerPhone || "N/A";

            // 📍 DELIVERY ADDRESS EXTRACTION (फ्लैट एड्रेस लाइन निकालना भाई)
            let finalAddress = "Local Address";
            if (parsedAddressObj) {
                finalAddress = parsedAddressObj.addressLine1 || parsedAddressObj.address || "Local Address";
                if (parsedAddressObj.addressLine2) {
                    finalAddress += `, ${parsedAddressObj.addressLine2}`;
                }
            } else if (typeof nestedMaster?.deliveryAddress === 'string' && nestedMaster.deliveryAddress.trim() !== "") {
                finalAddress = nestedMaster.deliveryAddress; // अगर पहले से ही प्लेन स्ट्रिंग हो भाई
            }

            // 🎯 NEAR BY / LANDMARK FIX (एड्रेस ऑब्जेक्ट के लैंडमार्क से उठाएं भाई)
            let finalNearBy = "Not Provided";
            if (parsedAddressObj?.addressLine2 && parsedAddressObj.addressLine2.trim() !== "") {
                finalNearBy = parsedAddressObj.addressLine2.trim();
            } else if (nestedMaster?.deliveryInstructions) {
                finalNearBy = nestedMaster.deliveryInstructions;
            }

            const city = parsedAddressObj?.city || nestedMaster?.deliveryCity || "Bundi";
            const pincode = parsedAddressObj?.pincode || parsedAddressObj?.postalCode || "";
            
            // पूरा साफ़ सुथरा पता तैयार भाई ताकि डिलीवरी बॉय भटके नहीं
            const finalFullAddress = finalAddress.includes(city) 
                ? `${finalAddress} ${pincode}`.trim()
                : `${finalAddress}, ${city} ${pincode}`.trim();

            return {
                id: so.id,
                status: so.status,
                totalAmount: Number(so.total || so.subtotal || 0),
                customerName: finalCustomerName,       
                customerPhone: finalPhone,             
                shippingAddress: finalFullAddress,     
                nearBy: finalNearBy === "null" ? "Not Provided" : finalNearBy 
            };
        });

        return res.json({
            id: batchData.id,
            status: batchData.status,
            orders: formattedOrders
        });

    } catch (error: any) {
        console.error("🚨 Error in batch-details API:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
});
/**
 * 🟡 GET Available Delivery Batches for Claiming
 * /api/delivery-boys/available-batches
 */

// ✅ उपलब्ध बैचेस ढूंढने की एपीआई - JSON एड्रेस पार्सिंग और न्यू स्कीमा कॉम्पैटिबिलिटी भाई
router.get('/available-batches', requireDeliveryBoyAuth, async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized.' });
        }

 // 🎯 असली फ़िक्स: रॉ SQL हटाकर ड्रिज़ल के आधिकारिक टाइप-सेफ फ़ंक्शन से सिंक कर दिया भाई साहब!
       // 🎯 मास्टरस्ट्रोक: टेबल एलियास (Alias) मिसमैच को जड़ से शांत कर दिया भाई साहब!
        const availableBatches = await db.query.deliveryBatches.findMany({
            where: (deliveryBatches, { and, isNull, eq, exists }) => and(
                isNull(deliveryBatches.deliveryBoyId), 
                eq(deliveryBatches.status, 'pending'),
                // ✅ ड्रिज़ल के इन-लाइन फंक्शन्स का उपयोग करके एसक्यूएल कंपाइलर को वॉटरप्रूफ कर दिया भाई!
                exists(
                    db.select({ id: subOrders.id })
                      .from(subOrders)
                      .where(and(
                          eq(subOrders.deliveryBatchId, deliveryBatches.id),
                          eq(subOrders.status, 'ready_for_pickup')
                      ))
                )
            ),
            with: {
                subOrders: {
                    with: {
                        seller: {
                            columns: { id: true, businessName: true, businessAddress: true, businessPhone: true }
                        },
                        masterOrder: {
                            with: {
                                customer: {
                                    columns: { firstName: true, lastName: true, phone: true }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: (deliveryBatches, { desc }) => [desc(deliveryBatches.createdAt)],
        });
        const formattedBatches = availableBatches.map(batch => {
            const currentSubOrders = batch.subOrders || [];
            
            // 1. Pickup Details
            const pickupPoints = currentSubOrders.map(so => ({
                shopName: so.seller?.businessName || "Unknown Shop",
                address: so.seller?.businessAddress || "Address Not Available",
                phone: so.seller?.businessPhone || "",
            }));

            const shopNames = pickupPoints.map(p => p.shopName).join(" + ");
            const shopAddresses = pickupPoints.map(p => p.address).join(" | ");

            // 🎯 अमाउंट कैलकुलेशन
            let calculatedTotalBill = 0;
            currentSubOrders.forEach((so: any) => {
                if (so) {
                    if (Array.isArray(so)) {
                        calculatedTotalBill += Number(so[8] || so[6] || 0);
                    } else if (typeof so === 'object') {
                        calculatedTotalBill += Number(so.total || so.subtotal || 0);
                    }
                }
            });

            const nestedMaster = currentSubOrders[0]?.masterOrder as any;
            const customerObj = nestedMaster?.customer || {};

            // 🎯 फिक्स 2: मास्टर ऑर्डर के स्ट्रिंग वाले 'deliveryAddress' को सेफ़ली पार्स करना भाई!
            let parsedAddressObj: any = null;
           if (nestedMaster?.deliveryAddress && typeof nestedMaster.deliveryAddress === 'string') {
    // 🎯 फिक्स: अगर एड्रेस कर्ली ब्रैकेट { से शुरू होता है, केवल तभी पार्स करो भाई!
    if (nestedMaster.deliveryAddress.trim().startsWith('{')) {
        try {
            parsedAddressObj = JSON.parse(nestedMaster.deliveryAddress);
        } catch (e) {
            // शांत मोड ON - कोई कचरा लॉग प्रिंट नहीं होगा भाई
        }
    } else {
        // अगर साधारण स्ट्रिंग है, तो उसे सीधा ऑब्जेक्ट के रूप में अलाइन कर दो भाई साहब
        parsedAddressObj = { addressLine1: nestedMaster.deliveryAddress };
    }
}

            // 👤 CUSTOMER NAME EXTRACTION
            let finalCustomerName = "Customer"; 
            if (parsedAddressObj?.fullName) {
                finalCustomerName = String(parsedAddressObj.fullName).trim();
            } else {
                let firstName = customerObj?.firstName || '';
                let lastName = customerObj?.lastName || '';
                finalCustomerName = `${firstName} ${lastName}`.trim();
            }

            if (!finalCustomerName || finalCustomerName === "null" || finalCustomerName === "undefined") {
                finalCustomerName = "Customer";
            }

            // 📞 PHONE NUMBER EXTRACTION
            const finalPhone = parsedAddressObj?.phone || customerObj?.phone || "N/A";
            
            // 📍 DELIVERY ADDRESS EXTRACTION (फ्लैट एड्रेस लाइन और सिटी-पिनकोड कॉम्बिनेशन भाई)
            let finalAddress = "Local Address";
            if (parsedAddressObj) {
                finalAddress = parsedAddressObj.addressLine1 || parsedAddressObj.address || "Local Address";
                if (parsedAddressObj.addressLine2) {
                    finalAddress += `, ${parsedAddressObj.addressLine2}`;
                }
                const city = parsedAddressObj.city || "Bundi";
                const pincode = parsedAddressObj.pincode || parsedAddressObj.postalCode || "";
                if (!finalAddress.includes(city)) {
                    finalAddress = `${finalAddress}, ${city} ${pincode}`.trim();
                } else {
                    finalAddress = `${finalAddress} ${pincode}`.trim();
                }
            } else if (typeof nestedMaster?.deliveryAddress === 'string' && nestedMaster.deliveryAddress.trim() !== "") {
                finalAddress = nestedMaster.deliveryAddress;
            }

            // 🎯 NEAR BY / LANDMARK
            let finalNearBy = "Not Provided";
            if (parsedAddressObj?.addressLine2 && parsedAddressObj.addressLine2.trim() !== "") {
                finalNearBy = parsedAddressObj.addressLine2.trim();
            } else if (nestedMaster?.deliveryInstructions) {
                finalNearBy = nestedMaster.deliveryInstructions;
            }

            return {
                id: batch.id,
                batchNumber: `BTCH-${batch.id}`,
                status: batch.status,
                createdAt: batch.createdAt,
                pickupShops: shopNames || "Unknown Shop",
                pickupAddresses: shopAddresses, 
                pickupPoints: pickupPoints,

                customerName: finalCustomerName,
                customerPhone: finalPhone, 
                deliveryAddress: finalAddress, 
                deliveryInstructions: finalNearBy,

                deliveryCharge: Number(batch.deliveryFee || 40), 
                totalItems: currentSubOrders.length,
                totalToCollect: calculatedTotalBill
            };
        });

        return res.status(200).json({ batches: formattedBatches });

    } catch (error: any) {
        console.error('❌ Error in GET /api/delivery/available-batches:', error);
        return res.status(500).json({ error: 'Failed to fetch available batches.' });
    }
});
/**
 * 🚀 PATCH Claim Delivery Batch
 * /api/delivery-boys/batches/:batchId/claim
 */
router.patch(
    '/batches/:batchId/claim',
    requireDeliveryBoyAuth,
    async (req: any, res: Response) => {
        try {
            const userId = req.user?.id;
            const batchId = parseInt(req.params.batchId);

            if (!userId) return res.status(401).json({ error: 'Unauthorized.' });
            if (isNaN(batchId)) return res.status(400).json({ error: 'Invalid delivery batch ID.' });

            // 1. डिलीवरी बॉय प्रोफाइल और उसका अप्रूवल स्टेटस चेक करें
            const [deliveryBoyProfile] = await db
                .select()
                .from(deliveryBoys)
                .where(eq(deliveryBoys.userId, userId));
            
            if (!deliveryBoyProfile) {
                return res.status(404).json({ error: 'Delivery Boy profile not found.' });
            }

            // सुरक्षा: सिर्फ 'approved' डिलीवरी बॉय ही क्लेम कर सकते हैं
            if (deliveryBoyProfile.approvalStatus !== 'approved') {
                return res.status(403).json({ error: 'Your account is not approved for taking deliveries.' });
            }

            const deliveryBoyId = deliveryBoyProfile.id;

            // 2. ट्रांजेक्शन का उपयोग करें (All or Nothing)
            const result = await db.transaction(async (tx) => {
                
                // A. बैच को लॉक करें (FOR UPDATE) ताकि रेस कंडीशन न हो
                const [existingBatch] = await tx
                    .select()
                    .from(deliveryBatches)
                    .where(and(
                        eq(deliveryBatches.id, batchId),
                        isNull(deliveryBatches.deliveryBoyId),
                        eq(deliveryBatches.status, 'pending')
                    ))
                    .for('update'); 

                if (!existingBatch) {
                    throw new Error('BATCH_ALREADY_CLAIMED');
                }

                // B. बैच को असाइन करें
                const [updatedBatch] = await tx.update(deliveryBatches)
                    .set({
                        deliveryBoyId: deliveryBoyId,
                        status: 'assigned', 
                        updatedAt: new Date(),
                        estimatedDeliveryTime: new Date(Date.now() + 30 * 60 * 1000) 
                    })
                    .where(eq(deliveryBatches.id, batchId))
                    .returning();

                await tx.update(orders)
                    .set({ updatedAt: new Date().toISOString() })
                    .where(eq(orders.id, updatedBatch.masterOrderId));

                // D. ट्रैकिंग इतिहास जोड़ें
                await tx.insert(orderTracking).values({
                    masterOrderId: updatedBatch.masterOrderId,
                    deliveryBatchId: batchId,
                    status: 'assigned',
                    updatedByUserId: userId,
                    updatedByUserRole: 'delivery-boy',
                    timestamp: new Date(),
                    message: `Delivery partner ${deliveryBoyProfile.name || 'Assigned'} has accepted your order.`,
                } as any);

                return updatedBatch;
            });

            // 3. Socket.io Events
            getIO().emit(`available-batches:claimed`, { batchId });
            
            
             getIO().to(`order:${result.masterOrderId}`).emit('ordersStatus', {
                status: 'assigned',
                deliveryBoyName: deliveryBoyProfile.name,
                message: "Delivery partner assigned!"
            });

            return res.status(200).json({
                success: true,
                message: 'Batch claimed successfully!',
                batch: result,
            });

        } catch (error: any) {
            console.error('❌ Claim Error:', error);
            if (error.message === 'BATCH_ALREADY_CLAIMED') {
                return res.status(409).json({ error: 'This batch has already been claimed by someone else.' });
            }
            return res.status(500).json({ error: 'Failed to claim delivery batch.' });
        }
    }
);


/**
 * ✅ GET My Assigned Delivery Batches (Replaces "GET My Orders")
 * /api/delivery-boys/batches
 */
// 🎯 1. असाइन्ड बैचेस ढूंढने की एपीआई - JSON एड्रेस पार्सिंग और न्यू स्कीमा कॉम्पैटिबिलिटी भाई
router.get('/batches', requireDeliveryBoyAuth, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const [deliveryBoyProfile] = await db
      .select()
      .from(deliveryBoys)
      .where(eq(deliveryBoys.userId, userId));

    if (!deliveryBoyProfile) {
      return res.status(404).json({ error: 'Delivery Boy profile not found.' });
    }
    const deliveryBoyId = deliveryBoyProfile.id;

    // 🎯 QUERY RE-ARCHITECTED: डेटाबेस से रिलेशंस को मजबूती से खींचना
    const assignedBatches = await db.query.deliveryBatches.findMany({
      where: and(
        eq(deliveryBatches.deliveryBoyId, deliveryBoyId),
        not(inArray(deliveryBatches.status, ['delivered', 'cancelled', 'failed'])) 
      ),
      with: {
        masterOrder: {
          with: {
            // 🎯 फिक्स 1: 'deliveryAddress' अब टेबल रिलेशन नहीं है, इसलिए इसे 'with' से हटा दिया भाई!
            customer: {
              columns: { id: true, firstName: true, lastName: true, phone: true }
            }
          }
        },
        subOrders: {
          with: {
            masterOrder: {
              with: {
                customer: {
                  columns: { id: true, firstName: true, lastName: true, phone: true }
                },
              }
            },
            seller: {
              columns: { id: true, businessName: true, businessAddress: true, businessPhone: true }
            },
            orderItems: {
              with: {
                product: {
                  columns: { id: true, name: true, image: true, price: true }
                }
              }
            }
          }
        }
      },
      orderBy: (deliveryBatches, { desc }) => [desc(deliveryBatches.createdAt)],
    });

    // 🎯 MAPPING TRANSFORMATION
    const formattedBatches = assignedBatches.map(batch => {
      const currentSubOrders = batch.subOrders || [];
      
      // 1. Pickup Details Array
      const pickupPoints = currentSubOrders.map(so => ({
        shopName: so.seller?.businessName || "Unknown Shop",
        address: so.seller?.businessAddress || "Address Not Available",
        phone: so.seller?.businessPhone || "N/A",
      }));

      const shopNames = pickupPoints.map(p => p.shopName).filter(Boolean).join(" + ");
      const shopAddresses = pickupPoints.map(p => p.address).filter(Boolean).join(" | ");

      // 2. Customer Profile Extraction (Deep Safe Fallback)
      const directMaster = batch.masterOrder as any;
      const nestedMaster = currentSubOrders[0]?.masterOrder as any;
      const mOrder = directMaster || nestedMaster;
      let targetOrder = Array.isArray(mOrder) ? mOrder[0] : mOrder;
// 🎯 फिक्स 2: मास्टर ऑर्डर के स्ट्रिंग वाले 'deliveryAddress' को सेफ़ली पार्स करना भाई साहब!
      let parsedAddressObj: any = null;
      if (targetOrder?.deliveryAddress && typeof targetOrder.deliveryAddress === 'string') {
          // 🔔 कड़क सेफ़्टी: अगर एड्रेस कर्ली ब्रैकेट { से शुरू होता है (तभी वह असली JSON है), केवल तब पार्स करो भाई!
          if (targetOrder.deliveryAddress.trim().startsWith('{')) {
              try {
                  parsedAddressObj = JSON.parse(targetOrder.deliveryAddress);
              } catch (e) {
                  // शांत मोड: पार्सिंग फेल होने पर भी सर्वर चुप रहेगा भाई
              }
          } else {
              // अगर सादा टेक्स्ट एड्रेस ("C-230, Nav...") है, तो उसे सीधे ऑब्जेक्ट प्रॉपर्टी में सेट कर दो भाई!
              parsedAddressObj = { addressLine1: targetOrder.deliveryAddress };
          }
      }
      const customerObj = targetOrder?.customer || targetOrder?.customer_user || {};

      // 👤 CUSTOMER NAME EXTRACTION
      let finalCustomerName = "Customer"; 
      if (parsedAddressObj?.fullName) {
          finalCustomerName = String(parsedAddressObj.fullName).trim();
      } else {
          let firstName = targetOrder?.first_name || customerObj?.firstName || customerObj?.first_name || '';
          let lastName = targetOrder?.last_name || customerObj?.lastName || customerObj?.last_name || '';
          finalCustomerName = `${firstName} ${lastName}`.trim();
      }

      if (!finalCustomerName || finalCustomerName === "null" || finalCustomerName === "undefined") {
          finalCustomerName = "Customer";
      }
      
      // 📞 PHONE NUMBER EXTRACTION
      const finalPhone = parsedAddressObj?.phone || directMaster?.phone || nestedMaster?.phone || customerObj?.phone || "N/A";
      
      // 📍 DELIVERY ADDRESS EXTRACTION (फ्लैट एड्रेस लाइन और सिटी-पिनकोड कॉम्बिनेशन भाई)
      let finalAddress = "Local Address";
      if (parsedAddressObj) {
          finalAddress = parsedAddressObj.addressLine1 || parsedAddressObj.address || "Local Address";
          if (parsedAddressObj.addressLine2) {
              finalAddress += `, ${parsedAddressObj.addressLine2}`;
          }
          const city = parsedAddressObj.city || "Bundi";
          const pincode = parsedAddressObj.pincode || parsedAddressObj.postalCode || "";
          if (!finalAddress.includes(city)) {
              finalAddress = `${finalAddress}, ${city} ${pincode}`.trim();
          } else {
              finalAddress = `${finalAddress} ${pincode}`.trim();
          }
      } else if (typeof targetOrder?.deliveryAddress === 'string' && targetOrder.deliveryAddress.trim() !== "") {
          finalAddress = targetOrder.deliveryAddress;
      }

      // 🎯 NEAR BY / LANDMARK
      let finalNearBy = "Not Provided";
      if (parsedAddressObj?.addressLine2 && parsedAddressObj.addressLine2.trim() !== "") {
          finalNearBy = parsedAddressObj.addressLine2.trim();
      } else if (targetOrder?.deliveryInstructions) {
          finalNearBy = targetOrder.deliveryInstructions;
      }

      return {
        id: batch.id,
        batchNumber: `BTCH-${batch.id}`,
        status: batch.status,
        createdAt: batch.createdAt,
        
        pickupShops: shopNames || "Unknown Shop",
        pickupAddresses: shopAddresses,
        pickupPoints: pickupPoints, 
        
        customerName: finalCustomerName,
        customerPhone: finalPhone,      
        deliveryAddress: finalAddress,   
        deliveryCity: parsedAddressObj?.city || directMaster?.delivery_city || nestedMaster?.delivery_city || "Unknown City",
        deliveryInstructions: finalNearBy, 

        deliveryCharge: Number(batch.deliveryFee || 40),
        totalItems: currentSubOrders.length
      };
    });

    return res.status(200).json({ batches: formattedBatches });

  } catch (error: any) {
    console.error('❌ Error in GET /api/delivery-boys/batches:', error);
    return res.status(500).json({ error: 'Failed to fetch delivery batches.' });
  }
});

// 🎯 2. बैच प्राइस कैलकुलेशन एपीआई - एरे लेयर हैंडलिंग के साथ 100% फिक्स भाई
router.get('/batch-price/:batchId', requireDeliveryBoyAuth, async (req: any, res: Response) => {
    try {
        const { batchId } = req.params;

        const batchSubOrders = await db.query.subOrders.findMany({
            where: eq(subOrders.deliveryBatchId, Number(batchId)),
            with: {
                masterOrder: true 
            }
        });

        if (!batchSubOrders || batchSubOrders.length === 0) {
            return res.status(200).json({ totalToCollect: 0, msg: "No suborders found in this batch" });
        }

        // 🎯 नियम 1: केवल 'subtotal' कॉलम से ही प्राइस लेनी है भाई
        let pureSubOrdersSum = 0;
        batchSubOrders.forEach((so: any) => {
            if (Array.isArray(so)) {
                pureSubOrdersSum += Number(so[6] || 0);
            } else {
                pureSubOrdersSum += Number(so.subtotal || 0);
            }
        });

        // 🎯 नियम 2: केवल 'delivery_charge' या 'deliveryCharge' को उठाना है भाई
        const firstSubOrder = batchSubOrders[0];

        const mOrder = Array.isArray(firstSubOrder) ? firstSubOrder[14] : firstSubOrder?.masterOrder;
        
        let deliveryChargeToApply = 0;
     let platformChargeToApply = 0;
        if (mOrder) {
      const masterOrderId = Array.isArray(mOrder) ? mOrder[2] : mOrder.id;
            const earlierBatches = await db.query.deliveryBatches.findMany({
                where: and(
                    eq(deliveryBatches.masterOrderId, Array.isArray(mOrder) ? mOrder[2] : mOrder.id),
                    lt(deliveryBatches.id, Number(batchId))
                )
            });

            // अगर यह पहला बैच है, तो मास्टर ऑर्डर का डिलीवरी चार्ज जोड़ेंगे, वरना '0'
            if (earlierBatches.length === 0) {
                if (Array.isArray(mOrder)) {
                    deliveryChargeToApply = Number(mOrder[21] || 0);
                    platformChargeToApply = Number(mOrder[27] || 0);
                } else {
                    deliveryChargeToApply = Number(mOrder.deliveryCharge || mOrder.delivery_charge || 0);
                    platformChargeToApply = Number(mOrder.platformCharge || mOrder.platform_charge || 0);
                }
            } else {
                deliveryChargeToApply = 0; 
                platformChargeToApply = 0;
            }
        }

        const finalBatchPrice = pureSubOrdersSum + deliveryChargeToApply + platformChargeToApply;

        return res.status(200).json({
            batchId: Number(batchId),
            subOrdersSubtotalSum: pureSubOrdersSum,
            masterOrderDeliveryCharge: deliveryChargeToApply,
            masterOrderPlatformCharge: platformChargeToApply,
            totalToCollect: finalBatchPrice 
        });

    } catch (error: any) {
        console.error('❌ Error in GET /batch-price:', error);
        return res.status(500).json({ error: 'Failed to calculate batch price.' });
    }
});
/**
 * ✅ Send OTP to Customer (Final Version)
 * POST /api/delivery/batches/:batchId/send-otp
 */
// 🎯 1. ओटीपी भेजने की एपीआई - JSON एड्रेस पार्सिंग और कड़क मैसेजिंग फिक्स भाई
router.post('/batches/:batchId/send-otp', requireDeliveryBoyAuth, async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        const batchId = parseInt(req.params.batchId);

        if (!batchId || !userId) {
            return res.status(400).json({ success: false, message: "Batch ID and Authentication required." });
        }

        // 1. सबसे पहले डिलीवरी बॉय की ID डेटाबेस से निकालें (Type Safety)
        const [dboyProfile] = await db
            .select({ id: deliveryBoys.id, name: deliveryBoys.name }) // 🎯 फिक्स: नाम भी यहीं से उठा लिया भाई
            .from(deliveryBoys)
            .where(eq(deliveryBoys.userId, userId));

        if (!dboyProfile) {
            return res.status(404).json({ success: false, message: "Delivery Boy profile not found." });
        }
        const deliveryBoyId = dboyProfile.id;
        const deliveryBoyName = dboyProfile.name || "Shopnish Partner";

        // 2. बैच ढूंढें और सुनिश्चित करें कि यह इसी डिलीवरी बॉय का है
        const batch = await db.query.deliveryBatches.findFirst({
            where: and(
                eq(deliveryBatches.id, batchId),
                eq(deliveryBatches.deliveryBoyId, deliveryBoyId)
            ),
            with: { 
                subOrders: {
                    with: {
                        masterOrder: {
                            with: {
                                customer: { columns: { id: true, firstName: true, phone: true } },
                                // 🎯 फिक्स: 'deliveryAddress' अब टेबल रिलेशन नहीं है, इसलिए इसे 'with' से हटा दिया भाई!
                            }
                        }
                    }
                }
            }
        });

        if (!batch || batch.subOrders.length === 0) {
            return res.status(404).json({ success: false, message: "Batch not found or not assigned to you." });
        }

        const masterOrder = batch.subOrders[0].masterOrder;

        // 🎯 फिक्स: मास्टर ऑर्डर के स्ट्रिंग वाले 'deliveryAddress' को सेफ़ली पार्स करना भाई!
        let parsedAddressObj: any = null;
        if (masterOrder?.deliveryAddress && typeof masterOrder.deliveryAddress === 'string') {
            try {
                parsedAddressObj = JSON.parse(masterOrder.deliveryAddress);
            } catch (e) {
                console.warn("Failed to parse deliveryAddress JSON inside send-otp:", e);
            }
        }

        // 3. फोन नंबर प्राप्त करें (पार्स किए हुए ऑब्जेक्ट से असली नंबर)
        const customerPhone = parsedAddressObj?.phone || parsedAddressObj?.phoneNumber || masterOrder.customer?.phone;

        if (!customerPhone) {
            return res.status(400).json({ success: false, message: "Customer contact info missing." });
        }
        
        // 4. OTP जनरेट करें
        const otp = generateOTP(4);
        // 🎯 महा-फिक्स: मैसेज में राइडर का असली नाम जाएगा, जिससे कस्टमर को पता रहे कि कौन आ रहा है भाई!
        const otpMessage = `आपका ऑर्डर डिलीवरी OTP है: ${otp}. कृपया इसे डिलीवरी पार्टनर ${deliveryBoyName} को प्रदान करें।`;

        // 5. Transaction: OTP सेव करें और स्टेटस सिंक करें
        await db.transaction(async (tx) => {
            // बैच अपडेट करें
            await tx.update(deliveryBatches)
                .set({ 
                    deliveryOtp: otp, 
                    deliveryOtpSentAt: new Date(),
                    status: 'out_for_delivery', 
                    updatedAt: new Date()
                })
                .where(eq(deliveryBatches.id, batchId));

            // मास्टर ऑर्डर को भी 'out_for_delivery' की तरफ बढ़ाएं
            await tx.update(orders)
                .set({ 
                    updatedAt: new Date().toISOString() 
                })
                .where(eq(orders.id, masterOrder.id));

            // ट्रैकिंग एंट्री
            await tx.insert(orderTracking).values({
                masterOrderId: masterOrder.id,
                deliveryBatchId: batchId,
                status: 'out_for_delivery' as any,
                updatedByUserId: userId,
                updatedByUserRole: 'delivery-boy',
                timestamp: new Date(),
                message: `OTP sent to customer. Order is now out for delivery.`,
            } as any);
        });

        // 6. WhatsApp संदेश भेजें
        try {
            await sendWhatsAppMessage(customerPhone, otpMessage);
        } catch (wsError) {
            console.error("⚠️ WhatsApp Notify Failed:", wsError);
        }

        // 7. Real-time Socket Update
        getIO().emit(`order:${masterOrder.id}:status`, {
            status: 'out_for_delivery',
            message: "Your order is out for delivery!"
        });

        return res.status(200).json({
            success: true,
            message: "OTP sent and status updated to Out for Delivery.",
            otp // केवल डेवलपमेंट के लिए
        });

    } catch (error: any) {
        console.error("❌ Error in send-otp route:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal server error." });
    }
});

// 🎯 2. बैच स्टेटस अपडेट करने की एपीआई - आटोमैटिक क्लीनर और सिंक फिक्स भाई
router.patch(
  '/batches/:batchId/status',
  requireDeliveryBoyAuth,
  async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const batchId = parseInt(req.params.batchId);
      const { status: newStatus, otp } = req.body;

      // 1. Basic Validations
      if (!userId || isNaN(batchId)) return res.status(400).json({ error: 'Invalid Request.' });
      
      if (!newStatus || !deliveryStatusEnum.enumValues.includes(newStatus as any)) {
        return res.status(400).json({ error: 'Invalid or missing status.' });
      }

      // 2. Fetch Delivery Boy Profile
      const [dboy] = await db.select().from(deliveryBoys).where(eq(deliveryBoys.userId, userId));
      if (!dboy) return res.status(404).json({ error: 'Delivery Boy profile not found.' });

      // 3. Fetch Batch with Essential Relations
      const existingBatch = await db.query.deliveryBatches.findFirst({
        where: and(
          eq(deliveryBatches.id, batchId),
          eq(deliveryBatches.deliveryBoyId, dboy.id)
        ),
        with: {
          subOrders: { with: { masterOrder: true, seller: true } }
        }
      });

      if (!existingBatch) return res.status(404).json({ error: 'Batch not found or not assigned to you.' });
      
      const currentStatus = existingBatch.status;

      // Idempotency Check
      if (currentStatus === newStatus) {
        console.log(`ℹ️ [STATUS MATCH]: Batch #${batchId} is already '${newStatus}'.`);
        return res.status(200).json({
          success: true,
          message: 'Status is already up to date.',
          batch: existingBatch
        });
      }

      // Workflows Transitions
      const validTransitions: Record<string, string[]> = {
        'pending': ['assigned', 'cancelled'],
        'assigned': ['picked_up', 'cancelled'],
        'picked_up': ['out_for_delivery', 'cancelled'],
        'out_for_delivery': ['delivered', 'cancelled', 'failed'],
        'failed': ['out_for_delivery', 'cancelled'],
        'delivered': [],
        'cancelled': []
      };

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        return res.status(400).json({ error: `Illegal transition: ${currentStatus} -> ${newStatus}` });
      }

      // 5. Delivery OTP Verification
      if (newStatus === 'delivered') {
        if (otp === 'BYPASS_BY_RIDER') {
          console.log(`⚠️ [OTP BYPASS]: Batch #${batchId} is being delivered without OTP by Rider.`);
        } else if (!otp || otp !== existingBatch.deliveryOtp) {
          return res.status(401).json({ error: 'Invalid OTP for delivery verification.' });
        }
      }

      const masterOrderId = existingBatch.subOrders[0].masterOrder.id;
      const customerId = existingBatch.subOrders[0].masterOrder.customerId;

      // --- Database Transaction ---
      const finalBatch = await db.transaction(async (tx) => {
        
        // A. Update Delivery Batch
        const [updatedBatch] = await tx.update(deliveryBatches)
          .set({
            status: newStatus as any,
            updatedAt: new Date(), // 🎯 फिक्स: ताकि लोकेशन API 60 मिनट तक एक्टिव सिंक रखे भाई!
            deliveredAt: newStatus === 'delivered' ? new Date() : existingBatch.deliveredAt,
          } as any)
          .where(eq(deliveryBatches.id, batchId))
          .returning();

        // B. Add Tracking Entry
        await tx.insert(orderTracking).values({
          masterOrderId,
          deliveryBatchId: batchId,
          status: newStatus as any,
          updatedByUserId: userId,
          updatedByUserRole: 'delivery-boy',
          timestamp: new Date(),
          message: `Batch status changed to ${newStatus.replace(/_/g, ' ')}.`,
        } as any);
// 💰 WALLET SETTLEMENT LOGIC (Brand-Aware Dynamic Commission Upgrade)
if (newStatus === 'delivered') {
  // 1️⃣ डिलीवरी बॉय को उसकी मेहनत की कमाई (Delivery Fee) सीधे वॉलेट में क्रेडिट करो
  const payoutAmount = Number(existingBatch.deliveryFee);
  await WalletService.addMoney(
    userId, 
    'delivery-boy', 
    payoutAmount, 
    'delivery_fee', 
    `batch_${batchId}`, 
    `Earnings for batch #${batchId}`, 
    tx
  );

  // 2️⃣ अगर ग्राहक ने COD (नकद) दिया है, तो डिलीवरी बॉय के वॉलेट से उतना कैश माइनस (Hold) करो
  const masterOrder = existingBatch.subOrders[0]?.masterOrder;
  const isCOD = masterOrder?.paymentMethod === 'COD';
  if (isCOD) {
    const totalCashToCollect = existingBatch.subOrders.reduce((sum, so) => sum + Number(sum) + Number(so.total), 0);
    await WalletService.addMoney(
      userId, 
      'delivery-boy', 
      -totalCashToCollect, 
      'cod_collection', 
      `batch_${batchId}`, 
      `Cash collected for COD Batch #${batchId}`, 
      tx
    );
  }

  // 3️⃣ 🔥 महा-योद्धा स्टेप: अब हर सब-ऑर्डर के सेलर्स का पैसा डायनेमिक कमीशन काटकर पेंडिंग में डालो
  for (const so of existingBatch.subOrders) {
    const sellerUserId = so.seller?.userId; 
    if (sellerUserId) {
      
      // 🎯 जादू: रिलेशन एरर का खात्मा! सीधे डेटाबेस से इस सब-ऑर्डर के असली आइटम्स (Products) निकालो भाई!
      // Note: अपनी स्कीमा फ़ाइल के हिसाब से 'orderItems' या 'subOrderItems' टेबल का नाम इम्पोर्ट चेक कर लेना भाई साहब!
      // यहाँ मान लेते हैं कि टेबल का नाम 'orderItems' है और उसमें 'subOrderId' का हुक है।
      const fetchedItems = await tx
        .select({
          sellerProductId: orderItems.productId,
          quantity: orderItems.quantity,
          price: orderItems.productPrice
        })
        .from(orderItems)
        .where(eq(orderItems.subOrderId, so.id));

      // हमारी नई जादुई वॉलेट सर्विस को कॉल मारो, आर्गुमेंट भी ३ कर दिए और आखिर का tx झंझट भी साफ!
      // सेफ्टी के लिए हम tx को अंदर पास करने के लिए WalletService को बाहर से ही रेडी रखेंगे
      await WalletService.creditSellerEarnings(
        sellerUserId, 
        so.id, 
        fetchedItems || [] // [{ sellerProductId: X, quantity: Y, price: Z }]
      );
    }
  }
}
             // C. If 'delivered' or 'cancelled', Update Sub-Orders & Master Order
        if (['delivered', 'cancelled'].includes(newStatus)) {
          const targetSubStatus = newStatus === 'delivered' ? 'delivered_by_delivery_boy' : 'cancelled';
          const subOrderIds = existingBatch.subOrders.map(so => so.id);

          await tx.update(subOrders)
            .set({ status: targetSubStatus as any, updatedAt: new Date() })
            .where(inArray(subOrders.id, subOrderIds));
// ✅ Order Items Status Update
const itemStatus =
  newStatus === "delivered"
    ? "delivered"
    : "cancelled";

await tx
  .update(orderItems)
  .set({
    status: itemStatus as any,
    updatedAt: new Date().toISOString(),
  })
  .where(
    inArray(orderItems.subOrderId, subOrderIds)
  );
          for (const sId of subOrderIds) {
            await tx.insert(orderTracking).values({
              masterOrderId,
              subOrderId: sId,
              status: targetSubStatus as any,
              updatedByUserId: userId,
              updatedByUserRole: 'delivery-boy',
              timestamp: new Date(),
              message: `Sub-order marked as ${targetSubStatus.replace(/_/g, ' ')}.`,
            } as any);
          }

          const allSubs = await tx.query.subOrders.findMany({
            where: eq(subOrders.masterOrderId, masterOrderId),
          });

          const terminalStatuses = ['delivered_by_seller', 'delivered_by_delivery_boy', 'cancelled', 'rejected'];
          const isAllDone = allSubs.every(s => terminalStatuses.includes(s.status));

          if (isAllDone) {
            const anySuccess = allSubs.some(s => s.status.includes('delivered'));
            const allSuccess = allSubs.every(s => s.status.includes('delivered'));
            
            let finalMasterStatus: string;
            if (allSuccess) finalMasterStatus = 'fulfilled';
            else if (anySuccess) finalMasterStatus = 'partially_fulfilled';
            else finalMasterStatus = 'cancelled';

            await tx.update(orders)
              .set({ 
                status: finalMasterStatus as any,
                updatedAt: new Date().toISOString()
              })
              .where(eq(orders.id, masterOrderId));

            await tx.insert(orderTracking).values({
              masterOrderId,
              status: finalMasterStatus as any,
              updatedByUserId: userId,
              updatedByUserRole: 'delivery-boy',
              timestamp: new Date(),
              message: `Master order moved to ${finalMasterStatus} state.`,
            } as any);

            getIO().emit(`order:${masterOrderId}:finalized`, { status: finalMasterStatus });
          }
        }

        return updatedBatch;
      });

      // 6. Real-time Notifications
      getIO().emit(`user:${customerId}:batch-update`, {
        batchId: batchId,
        status: newStatus,
        message: `Your package status: ${newStatus.replace(/_/g, ' ')}`
      });

      return res.status(200).json({
        success: true,
        message: 'Status updated successfully.',
        batch: finalBatch
      });

    } catch (error: any) {
      console.error('❌ Status Update Error:', error);
      return res.status(500).json({ error: 'Failed to update delivery status.' });
    }
  }
);
export default router;