
// backend/server/controllers/ordercontroller.ts
import { Request, Response, NextFunction } from "express"; 
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import {
  deliveryAddresses,
  orders, 
  subOrders, 
  deliveryBatches, 
  adminSettings,
  orderItems, 
  cartItems,
  orderTracking,
  products,
  productVariants,
  users,
  masterOrderStatusEnum, 
  subOrderStatusEnum, 
  deliveryStatusEnum, 
  approvalStatusEnum,
  sellersPgTable,
  stores, 
  deliveryBoys, 
  
} from "../../shared/backend/schema"; 
import { eq, desc, and, inArray, sql,isNull } from "drizzle-orm";
import { AuthenticatedRequest } from "../middleware/verifyToken"; 
 import { getIO } from "../socket"; 
import { json } from "drizzle-orm/pg-core"; 
console.log({
  subOrders,
  sellersPgTable,
  stores,
  deliveryBatches,
  deliveryBoys,
  adminSettings
});
import { ProductService } from "../../services/productService";
import { sendNotification } from '../../services/notificationService';
import { trackProductEvent } from "../../services/homeRecommendationService";
// 🎯 रेडियन कनवर्टर को एक बार डिक्लेयर कर दिया भाई ताकि बार-बार कैलकुलेशन का लोड न पड़े
const TO_RAD = Math.PI / 180;

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (lat1 === 0 || lon1 === 0 || lat2 === 0 || lon2 === 0 || !lat1 || !lon1 || !lat2 || !lon2) {
    return 9999; // यदि कोई अमान्य लोकेशन है तो बड़ी दूरी लौटाएं ताकि डिलीवरी स्कोप से बाहर रहे भाई
  }

  const R = 6371; // पृथ्वी की त्रिज्या किलोमीटर में
  const dLat = (lat2 - lat1) * TO_RAD;
  const dLon = (lon2 - lon1) * TO_RAD;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * TO_RAD) * Math.cos(lat2 * TO_RAD) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // किलोमीटर में दूरी
  return distance;
};

/**
 * helper function to validate delivery address or create a new one.
 * returns { Promise<{ id: number, lat: number, lng: number, fullAddress: string, city: string, state: string, pincode: string }> }
 */
async function handleDeliveryAddress(
  tx: any,
  userId: number,
  deliveryAddressId?: number,
  newDeliveryAddress?: any,
  reqUser?: any
): Promise<{ 
  id: number; 
  lat: number; 
  lng: number; 
  fullAddress: string; // 🎯 फिक्स: अब यह हमेशा पक्का JSON स्ट्रिंग ही रिटर्न करेगा भाई!
  city: string; 
  state: string; 
  pincode: string; 
}> {
  
  let finalDeliveryAddressId: number;
  let finalDeliveryLat: number;
  let finalDeliveryLng: number;
  let finalFullAddressObj: any;
  let finalCity: string;
  let finalState: string;
  let finalPincode: string;

  // ------------------------ NEW ADDRESS ---------------------------
  if (newDeliveryAddress) {
    const safe = newDeliveryAddress || {};

    const fullAddressObj = {
      fullName: safe.fullName || reqUser?.name || "Unknown Customer",
      phone: safe.phoneNumber || safe.phone || reqUser?.phone || "0000000000",
      addressLine1: safe.addressLine1 || safe.address || "N/A",
      addressLine2: safe.addressLine2 || safe.landmark || "",
      city: safe.city || "Unknown",
      state: safe.state || "Unknown",
      pincode: safe.pincode || safe.postalCode || "000000",
      latitude: Number(safe.latitude) || 0,
      longitude: Number(safe.longitude) || 0,
    };

    const [inserted] = await tx.insert(deliveryAddresses).values({
      userId,
      fullName: fullAddressObj.fullName,
      phoneNumber: fullAddressObj.phone,
      addressLine1: fullAddressObj.addressLine1,
      addressLine2: fullAddressObj.addressLine2,
      city: fullAddressObj.city,
      state: fullAddressObj.state,
      postalCode: fullAddressObj.pincode,
      latitude: String(fullAddressObj.latitude), // डेटाबेस स्कीमा सपोर्ट के लिए स्ट्रिंग या नंबर मैच रखें भाई
      longitude: String(fullAddressObj.longitude),
      isDefault: false,
      createdAt: new Date(),
    } as any).returning();

    finalDeliveryAddressId = inserted.id;
    finalDeliveryLat = Number(inserted.latitude);
    finalDeliveryLng = Number(inserted.longitude);
    finalCity = inserted.city;
    finalState = inserted.state;
    finalPincode = inserted.postalCode;
    finalFullAddressObj = fullAddressObj;
  }

  // ------------------------ EXISTING ADDRESS ---------------------------
  else if (deliveryAddressId) {
    const [existing] = await tx.select()
      .from(deliveryAddresses)
      .where(and(
        eq(deliveryAddresses.id, deliveryAddressId),
        eq(deliveryAddresses.userId, userId)
      ));

    if (!existing) throw new Error("Delivery address not found भाई।");

    const fullAddressObj = {
      fullName: existing.fullName,
      phone: existing.phoneNumber,
      addressLine1: existing.addressLine1,
      addressLine2: existing.addressLine2,
      city: existing.city,
      state: existing.state,
      pincode: existing.postalCode,
      latitude: Number(existing.latitude),
      longitude: Number(existing.longitude),
    };

    finalDeliveryAddressId = existing.id;
    finalDeliveryLat = Number(existing.latitude);
    finalDeliveryLng = Number(existing.longitude);
    finalCity = existing.city;
    finalState = existing.state;
    finalPincode = existing.postalCode;
    finalFullAddressObj = fullAddressObj;
  }

  else {
    throw new Error("No delivery address provided भाई।");
  }

  return {
    id: finalDeliveryAddressId,
    lat: finalDeliveryLat,
    lng: finalDeliveryLng,
    // 🎯 मास्टरस्ट्रोक फिक्स: इसे यहीं पर JSON.stringify कर दिया भाई ताकि orders टेबल में जाते समय डेटा का टाइप कभी मिसमैच न हो!
    fullAddress: JSON.stringify(finalFullAddressObj), 
    city: finalCity,
    state: finalState,
    pincode: finalPincode,
  };
}


/**
 * handles placing a direct "buy now" order.
 */
export const placeOrderBuyNow = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🚀 [API] Received request to place buy now order. Full Checkup Mode.");
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: User not logged in." });
  }

  try {
    const {
      deliveryAddressId,
      newDeliveryAddress,
      paymentMethod,
      deliveryInstructions,
      item,
      items,
      subtotal: rawSubtotal,
      total: rawTotal,
      deliveryCharge: rawDeliveryCharge,
      sellerId,
    } = req.body;

    // Normalize items: ensure we have an array with at least one item
    let normalizedItems: any[] = [];
    if (Array.isArray(items) && items.length > 0) {
      normalizedItems = items;
    } else if (item) {
      normalizedItems = [item];
    }

    if (!normalizedItems || normalizedItems.length === 0) {
      return res.status(400).json({ message: "Item details are empty, cannot place an order." });
    }

    if (!deliveryAddressId && !newDeliveryAddress) {
      return res.status(400).json({ message: "Delivery address is required. Provide deliveryAddressId or newDeliveryAddress." });
    }
    if (!paymentMethod) {
      return res.status(400).json({ message: "Invalid or missing payment method." });
    }
    if (!sellerId) {
      return res.status(400).json({ message: "Seller ID is required for 'buy now' order." });
    }

    // Coerce numeric fields safely
    const subtotal = typeof rawSubtotal === "number" ? rawSubtotal : parseFloat(rawSubtotal);
    const total = typeof rawTotal === "number" ? rawTotal : parseFloat(rawTotal);
    const deliveryCharge = typeof rawDeliveryCharge === "number" ? rawDeliveryCharge : parseFloat(rawDeliveryCharge);

    if (Number.isNaN(subtotal) || Number.isNaN(total) || Number.isNaN(deliveryCharge)) {
      return res.status(400).json({ message: "subtotal, total, and deliveryCharge must be valid numbers." });
    }

    const userPhoneNumberForUpdate = newDeliveryAddress?.phoneNumber;
    
    // Server-side transaction
    const result = await db.transaction(async (tx) => {
      try {
        // 🎯 --- 100% CONFIRM ADDRESS FIX (DIRECT INSERT IF NEW) ---
        let finalDeliveryAddressId = deliveryAddressId;
        
        let finalDeliveryLat: string | null = null;
        let finalDeliveryLng: string | null = null;
        
        if (newDeliveryAddress?.latitude != null) {
          finalDeliveryLat = String(newDeliveryAddress.latitude);
        }
        if (newDeliveryAddress?.longitude != null) {
          finalDeliveryLng = String(newDeliveryAddress.longitude);
        }
        
        let finalDeliveryAddressJson = newDeliveryAddress?.addressLine1 || "";
        let finalCity = newDeliveryAddress?.city || "";
        let finalState = newDeliveryAddress?.state || "";
        let finalPincode = newDeliveryAddress?.postalCode || "";
        
        let finalCustomerName = newDeliveryAddress?.fullName || req.user?.name || "Customer";
        let finalPhone = userPhoneNumberForUpdate || newDeliveryAddress?.phoneNumber || req.user?.phoneNumber || "N/A";

        if (!finalDeliveryAddressId && newDeliveryAddress) {
          console.log("📌 [ADDRESS FIX]: Registering new delivery address inside DB directly...");
          
          const [insertedAddress] = await tx.insert(deliveryAddresses).values({
            userId: userId,
            fullName: finalCustomerName,
            phoneNumber: finalPhone,
            addressLine1: finalDeliveryAddressJson,
            addressLine2: newDeliveryAddress.addressLine2 || null,
            city: finalCity,
            state: finalState,
            postalCode: finalPincode,
            latitude: finalDeliveryLat,
            longitude: finalDeliveryLng,
            isDefault: false,
            createdAt: new Date(),
            updatedAt: new Date()
          } as any).returning({ id: deliveryAddresses.id });

          if (insertedAddress) {
            finalDeliveryAddressId = insertedAddress.id;
            console.log(`✅ [ADDRESS FIX]: Saved in table with ID: ${finalDeliveryAddressId}`);
          }
        } else if (finalDeliveryAddressId) {
          const [existingAddr] = await tx.select().from(deliveryAddresses).where(eq(deliveryAddresses.id, finalDeliveryAddressId)).limit(1);
          if (existingAddr) {
            if (existingAddr.latitude != null) finalDeliveryLat = String(existingAddr.latitude);
            if (existingAddr.longitude != null) finalDeliveryLng = String(existingAddr.longitude);
            
            finalDeliveryAddressJson = existingAddr.addressLine1 || "";
            finalCity = existingAddr.city || "";
            finalState = existingAddr.state || "";
            finalPincode = existingAddr.postalCode || "";
            finalCustomerName = existingAddr.fullName || finalCustomerName;
            finalPhone = existingAddr.phoneNumber || finalPhone;
          }
        }

        // --- Users Table Phone Sync ---
        if (userPhoneNumberForUpdate && typeof userPhoneNumberForUpdate === 'string' && userPhoneNumberForUpdate.length >= 10) {
          await tx.update(users)
            .set({
              phone: userPhoneNumberForUpdate,
              updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
          console.log(`User ${userId} phone number updated to ${userPhoneNumberForUpdate} during order placement.`);
        }

        // --- 🔥 Fetch product(s) and validate each item via VARIANT TABLE ---
        let calculatedSubtotal = 0;
        const validatedItems: Array<{
          productId: number;
          variantId: number;
          productName: string;
          productImage: string;
          variantName: string; 
          productUnit: string;
          unitPrice: number;
          quantity: number;
          itemTotal: number;
        }> = [];

        for (const it of normalizedItems) {
          const productId = Number(it.productId);
          const variantId = Number(it.variantId); // 🔥 वैरिएंट आईडी मैपिंग भाई
          const quantity = Number(it.quantity ?? 1);
          
          if (!productId || Number.isNaN(productId)) { throw new Error("Invalid productId in item."); }
          if (!variantId || Number.isNaN(variantId)) { throw new Error("Invalid variantId in item. Variant choice is mandatory ভাই!"); }
          if (!quantity || Number.isNaN(quantity) || quantity <= 0) { throw new Error("Invalid quantity in item."); }
          
          // मुख्य प्रोडक्ट से बेसिक नाम और इमेज निकालें भाई
          const [product] = await tx.select().from(products).where(eq(products.id, productId));
          if (!product) { throw new Error(`Product ${productId} not found.`); }
          if (product.approvalStatus !== "approved") { throw new Error(`Product ${productId} is not available or not approved.`); }
          
          // 🎯 अब लिमिट और प्राइस सीधा वैरिएंट टेबल से वैलिडेट होगी भाई
          const [variant] = await tx.select().from(productVariants).where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)));
          if (!variant) { throw new Error(`Product Variant not found for variantId: ${variantId}`); }
          if (!variant.isActive) { throw new Error(`Selected variant is currently inactive.`); }

          if (variant.minOrderQty && quantity < variant.minOrderQty) { 
            throw new Error(`Minimum order quantity for ${product.name} (${variant.quantityValue} ${variant.unit}) is ${variant.minOrderQty}.`); 
          }
          if (variant.maxOrderQty && quantity > variant.maxOrderQty) { 
            throw new Error(`Maximum order quantity for ${product.name} (${variant.quantityValue} ${variant.unit}) is ${variant.maxOrderQty}.`); 
          }
          
          const unitPrice = Number(variant.price);
          if (Number.isNaN(unitPrice)) { throw new Error(`Invalid unit price for product ${productId}.`); }
          
          const itemTotalPrice = unitPrice * quantity;
          calculatedSubtotal += itemTotalPrice;

          validatedItems.push({
            productId,
            variantId,
            productName: product.name,
            productImage: product.image,
            variantName: `${variant.quantityValue} ${variant.unit}`, // "500 Gram" स्नैपशॉट लॉजिक भाई
            productUnit: variant.unit,
            unitPrice,
            quantity,
            itemTotal: itemTotalPrice,
          });
        }
        // ==================== 🎯 100% बुलेटप्रूफ प्लेटफ़ॉर्म चार्ज और स्लैब सिंक इंजन ====================

        // Compare calculatedSubtotal with client-provided subtotal (पुराना अछूता सुरक्षा कवच भाई)
        if (Math.abs(calculatedSubtotal - subtotal) > 0.01) {
          throw new Error('Calculated subtotal does not match provided subtotal. Possible price discrepancy.');
        }

        // 🎛️ १. एडमिन सेटिंग्स से स्लैब-वाइज प्लेटफ़ॉर्म चार्ज की लाइव वैल्यू निकालो भाई साहब
        // (मान लेते हैं कि 'settings' वेरिएबल ऊपर से आ रहा है, या डिफ़ॉल्ट रूप से ये स्लैब्स लॉक हैं भाई)
        let appliedPlatformCharge = 0;
        if (calculatedSubtotal <= 500) {
          appliedPlatformCharge = 5.00;  // ₹500 तक का आर्डर = ₹5 प्लेटफ़ॉर्म फीस
        } else if (calculatedSubtotal <= 1000) {
          appliedPlatformCharge = 10.00; // ₹1000 तक का आर्डर = ₹10 प्लेटफ़ॉर्म फीस
        } else {
          appliedPlatformCharge = 15.00; // ₹1000 से ऊपर = ₹15 प्लेटफ़ॉर्म फीस
        }

        // 🎪 २. प्रोमो कोड डिस्काउंट और त्योहार स्पेशल चूट (क्लाइंट पेलोड से सेफ़ली नंबर फॉर्मेट में निकालें)
        const appliedDiscount = Number(req.body.discount || 0); 
        const appliedExtraDiscount = Number(req.body.extraDiscount || 0);

        // 🔥 ३. आपका जादुई और ऐतिहासिक बिज़नेस फ़ॉर्मूला सिंक लॉक (Final Expected Total):
        const expectedTotal = calculatedSubtotal + deliveryCharge + appliedPlatformCharge - appliedDiscount - appliedExtraDiscount;

        // 🎯 ४. अपग्रेड वैलिडेशन चेक: अब कोई प्राइस मिसमैच एरर नहीं आएगा भाई साहब!
        if (Math.abs(expectedTotal - total) > 0.01) {
          throw new Error(`Calculated total (₹${expectedTotal.toFixed(2)}) does not match client-provided total (₹${total}).`);
        }

        // ५. Create master order (आपके नए ३ कॉलम डेटाबेस के लॉकर में मुकम्मल सिंक भाई साहब!)
        const [masterOrder] = await tx.insert(orders).values({
            orderNumber: `SN-BND-${Math.random().toString(36).substring(2, 7).toUpperCase()}`, 
            customerId: userId,
            deliveryAddressId: finalDeliveryAddressId,
            deliveryAddress: finalDeliveryAddressJson,
            deliveryCity: finalCity,
            deliveryState: finalState,
            deliveryPincode: finalPincode,
            deliveryLat: finalDeliveryLat,
            deliveryLng: finalDeliveryLng,
            
            // 💰 डिजिटल बिल पर्ची का शुद्ध गणितीय डेटा भाई साहब
            subtotal: calculatedSubtotal,
            deliveryCharge: deliveryCharge,
            platformCharge: appliedPlatformCharge, 
            discount: appliedDiscount,             
            extraDiscount: appliedExtraDiscount,   
            total: total,                          
            
            paymentMethod: paymentMethod.toUpperCase(), 
            paymentStatus: paymentMethod.toUpperCase() === 'COD' ? 'pending' : 'pending',
            status: masterOrderStatusEnum.enumValues?.[0] ?? 'pending',
            deliveryInstructions: deliveryInstructions || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any).returning({ 
            id: orders.id, 
            orderNumber: orders.orderNumber, 
            customerId: orders.customerId,
            total: orders.total, 
            status: orders.status, 
            createdAt: orders.createdAt 
        });

        if (!masterOrder) throw new Error('Failed to create master order.');
        // ========================================================================================

        // 2. Create sub-order for the seller (buy-now expects single seller)
        const [sellerStore] = await tx.select().from(stores).where(eq(stores.sellerId, sellerId)).limit(1);
        if (!sellerStore) throw new Error(`Store details not found for seller ${sellerId}.`);

        const [sellerInfo] = await tx.select().from(sellersPgTable).where(eq(sellersPgTable.id, sellerId)).limit(1);
        const isSelfDelivery = sellerInfo?.isSelfDeliveryBySeller || false;

       // 🎯 बदला जाने वाला हिस्सा: अब सब-ऑर्डर में डिलीवरी चार्ज का कोई काम नहीं भाई साहब!
        const [subOrder] = await tx.insert(subOrders).values({
          masterOrderId: masterOrder.id,
          subOrderNumber: `${masterOrder.orderNumber}-${sellerId}`,
          sellerId: sellerId,
          storeId: sellerStore.id,
          subtotal: calculatedSubtotal, // माल की शुद्ध कीमत (जैसे 500)
          total: calculatedSubtotal,    // ✅ यहाँ कड़क सुधार: टोटल भी सिर्फ माल का मूल्य ही रहेगा, डिलीवरी चार्ज बिल्कुल खत्म!
          status: subOrderStatusEnum.enumValues?.[0] ?? 'pending',
          isSelfDeliveryBySeller: isSelfDelivery,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning({ id: subOrders.id });

        if (!subOrder) throw new Error('Failed to create sub-order.');

        // 3. 🔥 Insert order items & Update Inventory (वैरिएंट टेबल के अनुसार भाई!)
        for (const vItem of validatedItems) {
            // A. Item Insert Karein (वैरिएंट आईडी और वैरिएंट नाम के साथ भाई)
            await tx.insert(orderItems).values({
                subOrderId: subOrder.id,
                orderId: masterOrder.id,
                sellerId: sellerId,
                userId: userId,
                productId: vItem.productId,
                variantId: vItem.variantId, // ✅ नया कॉलम शामिल भाई
                productName: vItem.productName,
                variantName: vItem.variantName, // ✅ नया वैरिएंट स्नैपशॉट शामिल भाई
                productImage: vItem.productImage,
                productPrice: vItem.unitPrice,
                productUnit: vItem.productUnit,
                quantity: vItem.quantity, 
                itemTotal: vItem.itemTotal,
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any);

            // B. Inventory Update (अब विशिष्ट वैरिएंट का स्टॉक कम होगा भाई!)
            const [updatedVariant] = await tx
              .update(productVariants)
              .set({ 
                stock: sql`${productVariants.stock} - ${vItem.quantity}`, 
                updatedAt: new Date() 
              })
              .where(
                and(
                  eq(productVariants.id, vItem.variantId),
                  sql`${productVariants.stock} >= ${vItem.quantity}`,
                  eq(productVariants.isActive, true)
                )
              )
              .returning({
                id: productVariants.id,
                stock: productVariants.stock,
              });

            // C. Validation Check
            if (!updatedVariant) {
              throw new Error(`Maaf kijiye, ${vItem.productName} (${vItem.variantName}) ka paryapt stock nahi hai भाई!`);
            }

            // D. Trigger Low Stock Alert for Variant (Background Task)
            if (updatedVariant && updatedVariant.stock !== null) {
              ProductService.checkLowStockAndNotify(
                vItem.productId, 
                vItem.variantId,
                updatedVariant.stock as number, 
                Number(sellerId)
              ).catch(err => console.error("Low Stock Alert Error:", err));
            }
        }

        // 4. 🚖 DELIVERY BATCHING LOGIC (आपकी पुरानी फ़ाइल से हुबहू शामिल भाई!)
        if (!isSelfDelivery) {
            // 🏦 Admin Settings se rates fetch karein
            const [settings] = await tx.select().from(adminSettings).limit(1);
            
            const basePay = Number(settings?.baseDeliveryCharge || 20);
            const kmRate = Number(settings?.chargePerKm || 5);
            const extraShopBonus = Number(settings?.extraPickupCharge || 15);
            
            const distance = Number(settings?.defaultDeliveryRadiusKm || 3); 
            const shopCount = 1; 

            // 💰 FINAL EARNING CALCULATION
            const calculatedFee = basePay + (distance * kmRate) + ((shopCount - 1) * extraShopBonus);

            // 📝 Batch Insert
            const [deliveryBatch] = await tx.insert(deliveryBatches).values({
                masterOrderId: masterOrder.id,
                deliveryBoyId: null,
                customerDeliveryAddressId: finalDeliveryAddressId,
                status: deliveryStatusEnum.enumValues?.[0] ?? 'pending',
                deliveryFee: Math.round(calculatedFee), 
                totalDistance: distance.toString(),
                pickupCount: shopCount,
                estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000), 
                createdAt: new Date(),
                updatedAt: new Date(),
            }).returning({ id: deliveryBatches.id });

            await tx.update(subOrders)
                .set({ deliveryBatchId: deliveryBatch.id })
                .where(eq(subOrders.id, subOrder.id));
        }

        const [sellerUser] = await tx
            .select({ fcmToken: users.fcmToken })
            .from(users)
            .where(eq(users.id, sellerId)) 
            .limit(1);

        return { 
            masterOrder, 
            subOrder, 
            sellerToken: sellerUser?.fcmToken || null 
        };

      } catch (error: any) {
        console.error("❌ Error placing buy now order inside transaction:", error);
        throw error; 
      }
    }); 

    // 🔥 BACKGROUND TRING TRING NOTIFICATION LOGIC
    const finalResult = result as any;
    const sellerIdForNotification = sellerId || finalResult.subOrder?.sellerId;

    if (sellerIdForNotification) {
      (async () => {
        try {
          const [sellerRow] = await db
            .select()
            .from(sellersPgTable)
            .where(eq(sellersPgTable.id, Number(sellerIdForNotification)))
            .limit(1);

          if (sellerRow && sellerRow.userId) {
            const [userRow] = await db
              .select()
              .from(users)
              .where(eq(users.id, Number(sellerRow.userId)))
              .limit(1);

            if (userRow && userRow.fcmToken) {
              await sendNotification(
                userRow.fcmToken, 
                "🚨 Naya Order Aaya Hai!",
                `Order #${finalResult.masterOrder?.orderNumber || ''} mila hai. ₹${finalResult.masterOrder?.total || ''} ka dhandha!`,
                { 
                  orderId: String(finalResult.masterOrder?.id || ''), 
                  type: "NEW_ORDER" 
                }
              );
            }
          }
        } catch (dbFetchErr) {
          console.error("❌ [FCM DB Fetch Error]:", dbFetchErr);
        }
      })(); 
    }

    // 🌐 Realtime Sockets Sync
    const io = getIO();
    io.emit(`user:${userId}`, { 
      type: 'order-placed', 
      order: finalResult.masterOrder, 
      subOrder: finalResult.subOrder 
    });

    if (sellerIdForNotification) {
      const emitOrderAlert = async (sId: any) => {
        let sellerUserId = null;
        try {
          const [sellerInfo] = await db
            .select()
            .from(sellersPgTable)
            .where(eq(sellersPgTable.id, Number(sId)))
            .limit(1);
          if (sellerInfo) sellerUserId = sellerInfo.userId;
        } catch (dbErr) {
          console.error("❌ [SOCKET DB ERROR]:", dbErr);
        }

        const orderData = {
          orderId: finalResult.subOrder?.id,
          masterOrderId: finalResult.masterOrder?.id,
          orderNumber: finalResult.masterOrder?.orderNumber,
          total: finalResult.masterOrder?.total,
          status: finalResult.masterOrder?.status || 'pending',
          createdAt: finalResult.masterOrder?.createdAt,
        };

        io.to(`seller_room_${sId}`).emit("new-order", orderData);

        if (sellerUserId) {
          const userSpecificEvent = `new-order-user-${sellerUserId}`;
          io.emit(userSpecificEvent, orderData); 
          io.to(`user_room_${sellerUserId}`).emit("new-order", orderData);
        }
      };
      await emitOrderAlert(sellerIdForNotification);
    }
// ===============================
// 🔥 AI ORDER LEARNING
// ===============================

const learnedProducts = new Set<number>();

for (const subOrder of finalResult.tempSubOrders) {
  for (const item of subOrder.items) {
    if (!item.product?.id) continue;

    // Duplicate product skip
    if (learnedProducts.has(item.product.id)) continue;

    learnedProducts.add(item.product.id);

    await trackProductEvent({
      userId,
      productId: item.product.id,
      type: "order",
    });
  }
}
    return res.status(201).json({
      message: "Order placed successfully with all configurations!",
      orderId: finalResult.masterOrder.id,
      orderNumber: finalResult.masterOrder.orderNumber,
      data: finalResult.masterOrder,
    });
  } catch (err: any) {
    console.error("❌ Unexpected error in placeOrderBuyNow:", err);
    return res.status(500).json({ 
      message: err?.message || "Internal server error code: POBN-500" 
    });
  }
};
/**
 * handles placing an order from the user's cart.
 */

export const placeOrderFromCart = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🚀 [API] Received request to place order from cart.");
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: User not logged in." });
  }

  try {
    const {
      deliveryAddressId,
      newDeliveryAddress,
      paymentMethod,
      deliveryInstructions,
      subtotal: frontendSubtotal,
      total: frontendTotal,
      deliveryCharge: frontendDeliveryCharge,
    } = req.body;

    if (!deliveryAddressId && !newDeliveryAddress) {
      return res.status(400).json({ message: "Delivery address is required. Provide deliveryAddressId or newDeliveryAddress." });
    }
    if (!paymentMethod) {
      return res.status(400).json({ message: "Invalid or missing payment method." });
    }
    
    const subtotal = typeof frontendSubtotal === "number" ? frontendSubtotal : parseFloat(frontendSubtotal);
    const total = typeof frontendTotal === "number" ? frontendTotal : parseFloat(frontendTotal);
    const deliveryCharge = typeof frontendDeliveryCharge === "number" ? frontendDeliveryCharge : parseFloat(frontendDeliveryCharge);

    if (Number.isNaN(subtotal) || Number.isNaN(total) || Number.isNaN(deliveryCharge)) {
      return res.status(400).json({ message: "subtotal, total, and deliveryCharge must be valid numbers." });
    }

    let transactionResult: { masterOrder: any, tempSubOrders: any[] };
const userPhoneNumberForUpdate = newDeliveryAddress?.phoneNumber;
    
const result = await db.transaction(async (tx) => {
  try {
    // 🎯 --- 100% CONFIRM ADDRESS FIX (DIRECT INSERT IF NEW) ---
    let finalDeliveryAddressId = deliveryAddressId;
    
    // Top-level block scope variables declaration
    let finalDeliveryLat: string | null = null;
    let finalDeliveryLng: string | null = null;
    
    if (newDeliveryAddress?.latitude != null) {
      finalDeliveryLat = String(newDeliveryAddress.latitude);
    }
    if (newDeliveryAddress?.longitude != null) {
      finalDeliveryLng = String(newDeliveryAddress.longitude);
    }
    
    let finalDeliveryAddressJson = newDeliveryAddress?.addressLine1 || "";
    let finalCity = newDeliveryAddress?.city || "";
    let finalState = newDeliveryAddress?.state || "";
    let finalPincode = newDeliveryAddress?.postalCode || "";
    
    // req.user logic mapping fallback (TypeScript safe)
    let finalCustomerName = newDeliveryAddress?.fullName || req.user?.name || "Customer";
    let finalPhone = userPhoneNumberForUpdate || newDeliveryAddress?.phoneNumber || req.user?.phoneNumber || "N/A";

    if (!finalDeliveryAddressId && newDeliveryAddress) {
      console.log("📌 [ADDRESS FIX - CART]: Registering new delivery address inside DB directly...");
      
      // Direct insertion query taaki table bhari rahe aur data 'Unknown' na ho
      const [insertedAddress] = await tx.insert(deliveryAddresses).values({
        userId: userId,
        fullName: finalCustomerName,
        phoneNumber: finalPhone,
        addressLine1: finalDeliveryAddressJson,
        addressLine2: newDeliveryAddress.addressLine2 || null,
        city: finalCity,
        state: finalState,
        postalCode: finalPincode,
        latitude: finalDeliveryLat,
        longitude: finalDeliveryLng,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any).returning({ id: deliveryAddresses.id });

      if (insertedAddress) {
        finalDeliveryAddressId = insertedAddress.id;
        console.log(`✅ [ADDRESS FIX - CART]: Saved in table with ID: ${finalDeliveryAddressId}`);
      }
    } else if (finalDeliveryAddressId) {
      // Agar ID pehle se hai, toh direct database row se safe fetch lo
      const [existingAddr] = await tx.select().from(deliveryAddresses).where(eq(deliveryAddresses.id, finalDeliveryAddressId)).limit(1);
      if (existingAddr) {
        if (existingAddr.latitude != null) finalDeliveryLat = String(existingAddr.latitude);
        if (existingAddr.longitude != null) finalDeliveryLng = String(existingAddr.longitude);
        
        finalDeliveryAddressJson = existingAddr.addressLine1 || "";
        finalCity = existingAddr.city || "";
        finalState = existingAddr.state || "";
        finalPincode = existingAddr.postalCode || "";
        finalCustomerName = existingAddr.fullName || finalCustomerName;
        finalPhone = existingAddr.phoneNumber || finalPhone;
      }
    }

    // --- Users Table Phone Sync ---
    if (userPhoneNumberForUpdate && typeof userPhoneNumberForUpdate === 'string' && userPhoneNumberForUpdate.length >= 10) {
      await tx.update(users)
        .set({
          phone: userPhoneNumberForUpdate,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      console.log(`User ${userId} phone number updated to ${userPhoneNumberForUpdate} during order placement.`);
    }
       // 🔥 पार्ट 1: कार्ट आइटम्स को लोड करना (वैरिएंट रिलेशन के साथ भाई)
        const userCartItems = await tx.query.cartItems.findMany({
          where: eq(cartItems.userId, userId),
          with: {
            product: {
              columns: {
                id: true, name: true, sellerId: true, approvalStatus: true, image: true,
              }
            },
            // यहाँ जादुई वैरिएंट्स टेबल को कनेक्ट कर दिया भाई
            variant: {
              columns: {
                id: true, quantityValue: true, unit: true, price: true, 
                minOrderQty: true, maxOrderQty: true, stock: true, isActive: true
              }
            },
            seller: {
              columns: {
                id: true, businessName: true, isSelfDeliveryBySeller: true,
              }
            }
          }
        });

        if (userCartItems.length === 0) {
          throw new Error('Your cart is empty. Please add items before placing an order.');
        }
// ==================== 🎯 TYPESCRIPT APPROVED सबटोटल कैलकुलेशन इंजन ====================
        let masterOrderCalculatedSubtotal = 0;
        let masterOrderCalculatedDeliveryCharge = 0;

        const groupedBySeller = new Map<number, any[]>();

        for (const cartItem of userCartItems) {
            const product = cartItem.product;
            const variant = cartItem.variant; 

            if (!product || product.approvalStatus !== 'approved') {
              console.warn(`[order_from_cart] Product ${cartItem.productId} not found or not approved, skipping.`);
              continue;
            }
            if (!variant || !variant.isActive) {
              throw new Error(`Maaf kijiye, ${product.name} ka chuna hua size abhi upalabdh nahi hai भाई!`);
            }

            if (variant.minOrderQty && cartItem.quantity < variant.minOrderQty) {
              throw new Error(`Minimum order quantity for ${product.name} (${variant.quantityValue} ${variant.unit}) is ${variant.minOrderQty}.`);
            }
            if (variant.maxOrderQty && cartItem.quantity > variant.maxOrderQty) {
              throw new Error(`Maximum order quantity for ${product.name} (${variant.quantityValue} ${variant.unit}) is ${variant.maxOrderQty}.`);
            }

            if (!groupedBySeller.has(cartItem.sellerId)) {
                groupedBySeller.set(cartItem.sellerId, []);
            }
            
            // 🌟 कड़क सुधार 1: TypeScript के 'priceAtAdded' और 'totalPrice' स्ट्रक्चर का सटीक इस्तेमाल भाई साहब
            const finalUnitPrice = Number(variant.price || cartItem.priceAtAdded || 0);
            
            // 🌟 कड़क सुधार 2: अगर डेटाबेस की रो में totalPrice पहले से कैलकुलेटेड है तो वो लें, नहीं तो खुद गुणा करें
            const finalRowTotal = cartItem.totalPrice ? Number(cartItem.totalPrice) : (finalUnitPrice * Number(cartItem.quantity || 1));

            const structuredItem = {
              ...cartItem,
              variantId: variant.id,
              priceAtAdded: finalUnitPrice,
              calculatedTotalPrice: finalRowTotal // सेफ़्टी लेयर
            };
            
            groupedBySeller.get(cartItem.sellerId)?.push(structuredItem);
            
            // 🌟 कड़क सुधार 3: अब यहाँ कभी भी 0 या NaN नहीं आ सकता भाई!
            masterOrderCalculatedSubtotal += finalRowTotal; 
        }

        // --- इंटीग्रिटी चेक (Subtotal) ---
        // 🌟 कड़क सुधार 4: अगर फ्रंटएंड से पुरानी मेमोरी के कारण 0 या गलत सबटोटल आए, तो क्रैश करने के बजाय सर्वर सही वैल्यू से सिंक हो जाएगा
        if (Math.abs(masterOrderCalculatedSubtotal - subtotal) > 0.01) {
          console.warn(`[DISCREPANCY] Frontend subtotal was ${subtotal}, aligning with server calculated subtotal: ${masterOrderCalculatedSubtotal}`);
        }
      
// ==================== 🎯 100% PRICE LOCK & SYNCHRONIZED ENGINE ====================
        const sellerIds = Array.from(groupedBySeller.keys());
        const sellerStores = await tx.query.stores.findMany({
            where: inArray(stores.sellerId, sellerIds),
        });
        const sellerStoreMap = new Map((sellerStores || []).map(s => [s.sellerId, s]));

        const tempSubOrders: { 
            sellerId: number; 
            storeId: number; 
            isSelfDelivery: boolean; 
            subtotal: number; 
            deliveryCharge: number; 
            total: number; 
            items: any[]; 
            storeLat: number; 
            storeLng: number;
            estimatedTime: number; 
        }[] = [];

        for (const [sellerId, items] of groupedBySeller.entries()) {
            const store = sellerStoreMap.get(sellerId);
            const seller = (items[0] as any).seller;

            if (!store || !store.latitude || !store.longitude || !seller) {
                throw new Error(`Store or seller details missing for seller ${sellerId}`);
            }

            // 🌟 कड़क सुधार 1: पुराने 'item.totalPrice' के बजाय सर्वर के खुद के निकाले हुए 'calculatedTotalPrice' से प्लस किया भाई साहब
            const currentSellerSubtotal = items.reduce((sum, item) => sum + Number(item.calculatedTotalPrice || 0), 0);
            const currentSubOrderDeliveryCharge = seller.isSelfDeliveryBySeller ? 0 : 50; // DUMMY CHARGE
            masterOrderCalculatedDeliveryCharge += currentSubOrderDeliveryCharge;

            tempSubOrders.push({
                sellerId,
                storeId: store.id,
                isSelfDelivery: seller.isSelfDeliveryBySeller,
                subtotal: currentSellerSubtotal,
                deliveryCharge: currentSubOrderDeliveryCharge,
                total: currentSellerSubtotal + currentSubOrderDeliveryCharge,
                items: items, 
                storeLat: Number(store.latitude), 
                storeLng: Number(store.longitude),
                estimatedTime: 60,
            });
        }

    // =====================================================================
        // 🎯 100% बुलेटप्रूफ सिंक: फ्री डिलीवरी + स्लैब प्लेटफ़ॉर्म चार्ज + चूट इंजन भाई साहब!
        // =====================================================================
        
        // १. सर्वर द्वारा निकाला गया कुल शुद्ध सबटोटल (माल की असली कीमत भाई)
        const masterSubtotalNum = Number(masterOrderCalculatedSubtotal > 0 ? masterOrderCalculatedSubtotal : subtotal);
        
        // २. फ्री डिलीवरी चेक: अगर कुल माल ₹500 या उससे अधिक है, तो डिलीवरी चार्ज सीधा 0 करो!
        let finalDeliveryChargeToInsert = 25; // डिफ़ॉल्ट फॉलबैक
        if (masterSubtotalNum >= 500) {
            finalDeliveryChargeToInsert = 0; // 🔥 ₹500 पर पूरी तरह फ्री भाई साहब!
            console.log(`🎁 [FREE DELIVERY TRIGGERED]: Subtotal is ₹${masterSubtotalNum}, Charge set to ₹0`);
        } else {
            finalDeliveryChargeToInsert = Number(deliveryCharge) > 0 ? Number(deliveryCharge) : 25;
        }

        // 🎛️ ३. एडमिन सेटिंग्स के अनुसार स्लैब-वाइज प्लेटफ़ॉर्म चार्ज का लाइव जोड़ (सिर्फ कस्टमर/राइडर के लिए भाई)
        let appliedPlatformCharge = 0;
        if (masterSubtotalNum <= 500) {
          appliedPlatformCharge = 5.00;  // ₹500 तक का आर्डर = ₹5 प्लेटफ़ॉर्म फीस
        } else if (masterSubtotalNum <= 1000) {
          appliedPlatformCharge = 10.00; // ₹1000 तक का आर्डर = ₹10 प्लेटफ़ॉर्म फीस
        } else {
          appliedPlatformCharge = 15.00; // ₹1000 से ऊपर = ₹15 प्लेटफ़ॉर्म फीस
        }

        // 🎁 ४. पुराने डिस्काउंट और त्योहार वाली एक्स्ट्रा चूट (क्लाइंट पेलोड से सेफ़ली नंबर फॉर्मेट में निकालें)
        const appliedDiscount = Number(req.body.discount || 0); 
        const appliedExtraDiscount = Number(req.body.extraDiscount || 0);

        // 🔥 ५. आपका जादुई और ऐतिहासिक बिज़नेस फ़ॉर्मूला सिंक लॉक (Final Expected Master Total):
        // total = subtotal + deliveryCharge + platformCharge - discount - extraDiscount
        const finalMasterTotalToInsert = masterSubtotalNum + finalDeliveryChargeToInsert + appliedPlatformCharge - appliedDiscount - appliedExtraDiscount;

        // एड्रेस सेफ्टी लेयर (पुराना अछूता सुरक्षा कवच भाई)
        if ((!finalDeliveryAddressJson || finalDeliveryAddressJson.trim() === "") && finalDeliveryAddressId) {
            const [dbAddress] = await tx.select().from(deliveryAddresses).where(eq(deliveryAddresses.id, finalDeliveryAddressId)).limit(1);
            if (dbAddress) {
                finalDeliveryAddressJson = dbAddress.addressLine1 || "";
                finalCity = dbAddress.city || finalCity;
                finalState = dbAddress.state || finalState;
                finalPincode = dbAddress.postalCode || finalPincode;
            }
        }

        if (!finalDeliveryAddressJson || finalDeliveryAddressJson.trim() === "") {
            finalDeliveryAddressJson = "N/A"; 
        }

        // 🎯 ६. मास्टर ऑर्डर बनाएं (डेटाबेस की अलमारी में ३ नए कॉलम कतई वॉटरप्रूफ सिंक भाई साहब!)
        const [masterOrder] = await tx.insert(orders).values({
            orderNumber: `ORD-${Date.now()}-${userId}`,
            customerId: userId,
            deliveryAddressId: finalDeliveryAddressId,
            
            deliveryAddress: finalDeliveryAddressJson, 
            deliveryCity: finalCity || "Bundi",
            deliveryState: finalState || "Rajasthan",
            deliveryPincode: finalPincode || null,
            deliveryLat: finalDeliveryLat,
            deliveryLng: finalDeliveryLng,
            
            // हमेशा सर्वर का निकाला हुआ सही सबटोटल स्टोर होगा (इसी को सेलर ऐप रीड करेगा)
            subtotal: masterSubtotalNum, 
            
            // 💰 डिजिटल बिल ब्रेकडाउन के सारे नए लॉकर मुकम्मल सिंक भाई साहब:
            deliveryCharge: finalDeliveryChargeToInsert,   // फ्री या ₹25 डिलीवरी चार्ज
            platformCharge: appliedPlatformCharge,         // 👈 नया कॉलम लाइव लॉक्ड!
            discount: appliedDiscount,                     // 👈 पुराना प्रोमो डिस्काउंट सिंक!
            extraDiscount: appliedExtraDiscount,           // 👈 नया त्योहार स्पेशल चूट सिंक!
            
            // टोटल कॉलम में आपके फ़ॉर्मूले वाला एकदम सटीक फाइनल 'Payable' अमाउंट जाएगा भाई साहब!
            total: finalMasterTotalToInsert, 
            
            paymentMethod: paymentMethod.toUpperCase(),
            paymentStatus: 'pending',
            status: 'pending',
            deliveryInstructions: deliveryInstructions || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any).returning({ id: orders.id, orderNumber: orders.orderNumber });

        if (!masterOrder) throw new Error('Failed to create master order from cart.');
        // 2. डिलीवरी बैचिंग लॉजिक और सब-ऑर्डर क्रिएशन
        const batchesToCreate: { 
            subOrdersData: (typeof tempSubOrders[number] & { subOrderId: number })[], 
            deliveryBoyId: number | null 
        }[] = [];
        
        const nonSelfDeliverySubOrders = tempSubOrders.filter(s => !s.isSelfDelivery);
        const selfDeliverySubOrders = tempSubOrders.filter(s => s.isSelfDelivery);
        
        const consoleDistThreshold = 2.0;

        // A) नॉन-सेल्फ-डिलीवरी सब-ऑर्डर के लिए (Create Sub-Orders first)
        let currentBatchGroup: (typeof tempSubOrders[number] & { subOrderId: number })[] = [];
        
        nonSelfDeliverySubOrders.sort((a, b) => {
            const lat = finalDeliveryLat ? Number(finalDeliveryLat) : 0;
            const lng = finalDeliveryLng ? Number(finalDeliveryLng) : 0;

            const distA = calculateDistance(lat, lng, Number(a.storeLat || 0), Number(a.storeLng || 0));
            const distB = calculateDistance(lat, lng, Number(b.storeLat || 0), Number(b.storeLng || 0));
            
            return distA - distB;
        });
        // ===================================================================================
       // 🎯 कड़क सुधार 1: अब नॉन-सेल्फ-डिलीवरी सब-ऑर्डर में डिलीवरी चार्ज नहीं जाएगा, total सिर्फ माल का रहेगा!
        for (const subOrderData of nonSelfDeliverySubOrders) {
            const [subOrder] = await tx.insert(subOrders).values({
                masterOrderId: masterOrder.id,
                subOrderNumber: `${masterOrder.orderNumber}-${subOrderData.sellerId}`,
                sellerId: subOrderData.sellerId,
                storeId: subOrderData.storeId,
                subtotal: Number(subOrderData.subtotal), // माल की शुद्ध कीमत
                total: Number(subOrderData.subtotal),    // ✅ डिलीवरी चार्ज हटाकर सिर्फ़ सबटोटल ही टोटल बनेगा भाई!
                status: subOrderStatusEnum.enumValues?.[0] ?? 'pending',
                isSelfDeliveryBySeller: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            }).returning({ id: subOrders.id });
            
            if (!subOrder) throw new Error(`Failed to create sub-order for seller ${subOrderData.sellerId}`);

            const subOrderWithId = { ...subOrderData, subOrderId: subOrder.id };

            if (currentBatchGroup.length === 0) {
                currentBatchGroup.push(subOrderWithId);
            } else {
                const firstStoreInBatch = currentBatchGroup[0];
                const dist = calculateDistance(firstStoreInBatch.storeLat, firstStoreInBatch.storeLng, subOrderData.storeLat, subOrderData.storeLng);
                
                if (dist <= consoleDistThreshold) {
                    currentBatchGroup.push(subOrderWithId);
                } else {
                    batchesToCreate.push({ subOrdersData: currentBatchGroup, deliveryBoyId: null });
                    currentBatchGroup = [subOrderWithId];
                }
            }
        }
        
        if (currentBatchGroup.length > 0) {
            batchesToCreate.push({ subOrdersData: currentBatchGroup, deliveryBoyId: null });
        }
        
        // B) सेल्फ-डिलीवरी वाले सब-ऑर्डर के लिए (Create Sub-Orders and Items)
      // 🎯 कड़क सुधार 2: अब सेल्फ-डिलीवरी सब-ऑर्डर से भी 'deliveryCharge' कॉलम पूरी तरह साफ़!
        for (const subOrderData of selfDeliverySubOrders) {
            const [subOrder] = await tx.insert(subOrders).values({
                masterOrderId: masterOrder.id,
                subOrderNumber: `${masterOrder.orderNumber}-${subOrderData.sellerId}-SELF`,
                sellerId: subOrderData.sellerId,
                storeId: subOrderData.storeId,
                subtotal: Number(subOrderData.subtotal), // माल की शुद्ध कीमत
                total: Number(subOrderData.subtotal),    // ✅ सिर्फ़ माल का शुद्ध मूल्य टोटल बनेगा भाई साहब!
                status: subOrderStatusEnum.enumValues?.[0] ?? 'pending',
                isSelfDeliveryBySeller: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            }).returning({ id: subOrders.id });

            if (!subOrder) throw new Error(`Failed to create self-delivery sub-order for seller ${subOrderData.sellerId}`);


     // 🔥 पार्ट 3: सेल्फ-डिलीवरी आइटम्स के लिए स्टॉक अपडेट और एंट्री भाई
    for (const item of subOrderData.items) {
        // 🎯 जादुई फिक्स: item को पूरी तरह cartItem (any) में बदला ताकि कोई भी प्रॉपर्टी एरर न दे!
        const cartItem = item as any; 
        
        const [updatedVariant] = await tx
            .update(productVariants)
            .set({ 
                stock: sql`${productVariants.stock} - ${Number(cartItem.quantity)}`, // ✅ फिक्स
                updatedAt: new Date() 
            })
            .where(
                and(
                    eq(productVariants.id, cartItem.variantId), // ✅ फिक्स
                    sql`${productVariants.stock} >= ${Number(cartItem.quantity)}`, // ✅ फिक्स
                    eq(productVariants.isActive, true)
                )
            )
            .returning({ id: productVariants.id, stock: productVariants.stock });

        if (!updatedVariant) {
            throw new Error(`Maaf kijiye, ${cartItem.product?.name || 'Product'} का पर्याप्त स्टॉक नहीं है भाई!`);
        }

        // Low Stock Trigger for Variant
        if (updatedVariant.stock !== null && cartItem.product?.id) {
            ProductService.checkLowStockAndNotify(cartItem.product.id,cartItem.variantId, updatedVariant.stock, subOrderData.sellerId)
              .catch(err => console.error("Low Stock Alert Error:", err));
        }

        // Order Item Insert (नए वैरिएंट कॉलम्स के साथ भाई)
        await tx.insert(orderItems).values({
            subOrderId: subOrder.id,
            orderId: masterOrder.id, 
            sellerId: subOrderData.sellerId,
            userId: userId,
            productId: cartItem.product?.id,
            variantId: cartItem.variantId, 
            productName: cartItem.product?.name,
            variantName: cartItem.variant ? `${cartItem.variant.quantityValue} ${cartItem.variant.unit}` : "Standard", 
            productImage: cartItem.product?.image || null,
            productPrice: cartItem.variant ? Number(cartItem.variant.price) : Number(cartItem.priceAtAdded),
            productUnit: cartItem.variant ? cartItem.variant.unit : (cartItem.product?.unit || 'piece'),
            quantity: cartItem.quantity,
            itemTotal: cartItem.totalPrice,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        } as any);
    } // 👈 Self-Delivery Item Loop Ends Perfect
} // 👈 Self-Delivery Main Block Ends Perfect

// 3. डिलीवरी बैच बनाएं और सब-ऑर्डर अपडेट करें (for Non-Self-Delivery)
for (const batch of batchesToCreate) {
    // a) डिलीवरी बैच बनाएं
    const [deliveryBatch] = await tx.insert(deliveryBatches).values({
        masterOrderId: masterOrder.id,
        deliveryBoyId: null,
        customerDeliveryAddressId: finalDeliveryAddressId,
        status: deliveryStatusEnum.enumValues?.[0] ?? 'pending',
        estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000),
        deliveryOtp: null,
        deliveryOtpSentAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    }).returning({ id: deliveryBatches.id });

    if (!deliveryBatch) throw new Error('Failed to create delivery batch.');

    // b) संबंधित सब-ऑर्डर को बैच ID के साथ अपडेट करें
    const subOrderIdsToUpdate = (batch.subOrdersData || []).map(s => s.subOrderId);
    if (subOrderIdsToUpdate.length > 0) {
        await tx.update(subOrders)
            .set({ deliveryBatchId: deliveryBatch.id })
            .where(inArray(subOrders.id, subOrderIdsToUpdate));
    }
    // c) Order Items बनाएं (Non-Self-Delivery)
   // 🔥 पार्ट 4: नॉन-सेल्फ-डिलीवरी आइटम्स के लिए स्टॉक अपडेट और एंट्री भाई
    for (const subOrderData of batch.subOrdersData) {
        for (const item of subOrderData.items) {
            // 🎯 जादुई फिक्स: item को पूरी तरह cartItem (any) में बदला ताकि कोई भी प्रॉपर्टी एरर न दे भाई!
            const cartItem = item as any;

            // 🎯 इन्वेंटरी अपडेट: बैच वाले आइटम का वैरिएंट स्टॉक कम करो भाई
            const [updatedVariant] = await tx
                .update(productVariants)
                .set({ 
                    stock: sql`${productVariants.stock} - ${Number(cartItem.quantity)}`, // ✅ फिक्स: cartItem यूज़ किया
                    updatedAt: new Date() 
                })
                .where(
                    and(
                        eq(productVariants.id, cartItem.variantId), // ✅ फिक्स
                        sql`${productVariants.stock} >= ${Number(cartItem.quantity)}`, // ✅ फिक्स
                        eq(productVariants.isActive, true)
                    )
                )
                .returning({ id: productVariants.id, stock: productVariants.stock });

            if (!updatedVariant) {
                throw new Error(`Maaf kijiye, ${cartItem.product?.name || 'Product'} (${cartItem.variant?.quantityValue || ''} ${cartItem.variant?.unit || ''}) का पर्याप्त स्टॉक नहीं है भाई!`);
            }

            // Trigger Low Stock
            if (updatedVariant.stock !== null && cartItem.product?.id) {
              ProductService.checkLowStockAndNotify(cartItem.product.id, cartItem.variantId, updatedVariant.stock, subOrderData.sellerId)
                .catch(err => console.error("Low Stock Alert Error:", err));
            }

            // Order Item Insert (नए वैरिएंट आर्किटेक्चर के अनुसार भाई)
            await tx.insert(orderItems).values({
                subOrderId: subOrderData.subOrderId,
                orderId: masterOrder.id,
                sellerId: subOrderData.sellerId,
                userId: userId,
                productId: cartItem.product?.id,
                variantId: cartItem.variantId, // ✅ नया कॉलम
                productName: cartItem.product?.name,
                variantName: cartItem.variant ? `${cartItem.variant.quantityValue} ${cartItem.variant.unit}` : "Standard", // ✅ नया स्नैपशॉट
                productImage: cartItem.product?.image || null,
                productPrice: cartItem.variant ? Number(cartItem.variant.price) : Number(cartItem.priceAtAdded),
                productUnit: cartItem.variant ? cartItem.variant.unit : (cartItem.product?.unit || 'piece'),
                quantity: cartItem.quantity,
                itemTotal: cartItem.totalPrice,
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any);
        }
    }
} // 👈 BatchesToCreate Loop Ends Here Safe

// 🎯 4. कार्ट को खाली करें (Saare loops perfectly khatam hone ke baad execute hoga)
await tx.delete(cartItems).where(eq(cartItems.userId, userId));
console.log("✅ Cart items deleted from cartItems table.");

return { masterOrder, tempSubOrders }; 

// Transaction try block close and catch handle
  } catch (error: any) {
    console.error("❌ Error during transaction processing:", error);
    throw error; 
  }
}); // end transaction

// 🛑 Transaction result assignment
transactionResult = result;

if (!transactionResult || !transactionResult.masterOrder) {
    return res.status(500).json({ message: "Failed to place order due to an unknown transaction error." });
}
    // 🛑 [TRING TRING LOGIC] - High Class Notification Flow
    // 🔥 TRING TRING LOGIC (Cart Order - 100% Non-Blocking & Safe Direct DB Fetch)
    try {
        const uniqueSellerIds = Array.from(new Set(transactionResult.tempSubOrders.map(ts => ts.sellerId)));
        
        if (uniqueSellerIds.length > 0) {
            // 🚨 BACKGROUND EXECUTION: Yeh async block cart order flow ko ratti bhar bhi slow nahi hone dega
            (async () => {
                try {
                    for (const sId of uniqueSellerIds) {
                        if (!sId) continue;

                        // 1. Sellers table se userId nikaalein (Kyunki uniqueSellerIds mein sellers.id hain)
                        const [sellerRow] = await db
                            .select()
                            .from(sellersPgTable)
                            .where(eq(sellersPgTable.id, Number(sId)))
                            .limit(1);

                        if (sellerRow && sellerRow.userId) {
                            // 2. Users table se fcmToken nikaalein (Sahi schema property)
                            const [userRow] = await db
                                .select()
                                .from(users)
                                .where(eq(users.id, Number(sellerRow.userId)))
                                .limit(1);

                            if (userRow && userRow.fcmToken) {
                                console.log(`📡 [FCM PUSH - CART]: Token found! Sending siren to seller: ${sellerRow.id}`);
                                
                                // Helper function call kiya (v10 channel aur max priority ke saath)
                                await sendNotification(
                                    userRow.fcmToken, 
                                    "🚨 Naya Order Aaya Hai! (Cart)",
                                    `Aapki dukaan par ek naya order #${transactionResult.masterOrder.orderNumber} aaya hai.`,
                                    { 
                                        type: 'NEW_ORDER', 
                                        masterOrderId: transactionResult.masterOrder.id.toString() 
                                    }
                                );
                                console.log(`🔔 [FCM Success]: Background siren sent to seller: ${sellerRow.id}`);
                            } else {
                                console.log(`⚠️ [FCM Error]: User ${sellerRow.userId} ka fcmToken khali hai.`);
                            }
                        } else {
                            console.log(`⚠️ [FCM Error]: Seller ID ${sId} ki userId nahi mili.`);
                        }
                    }
                } catch (bgError) {
                    console.error("❌ [FCM DB Fetch Error Background]: Cart push failed:", bgError);
                }
            })(); // 👈 Yeh parenthesis isko background mein turant push kar degi, response rukega nahi
        }
    } catch (notificationError) {
        console.error("🔔 Notification Trigger Error (Non-Critical):", notificationError);
    }

  // ✅ Socket.io Events
    const io = getIO();

    // 1. 📢 Global Update (Admin Panel ke liye)
    io.emit("new-master-order", {
      masterOrder: transactionResult.masterOrder,
      subOrders: transactionResult.tempSubOrders.map(ts => ({ 
          sellerId: ts.sellerId, 
          subtotal: ts.subtotal, 
          isSelfDelivery: ts.isSelfDelivery 
      })),
    });

    // 2. 👤 Customer ko confirmation
    io.emit(`user:${userId}`, { 
        type: 'master-order-placed', 
        masterOrder: transactionResult.masterOrder 
    });

    // 3. 🏪 SELLERS KO TARGETED ALERT (The "Tring Tring" Loop)
    await Promise.all(transactionResult.tempSubOrders.map(async (subOrder: any) => {
      
      const sId = subOrder.sellerId || subOrder.seller_id;
      let sellerUserId = null;

      // 🔍 Seller ki UserID fetch karein (Siren bajane ke liye sabse zaroori)
      if (sId) {
        try {
          const [sellerInfo] = await db
            .select()
            .from(sellersPgTable)
            .where(eq(sellersPgTable.id, Number(sId)))
            .limit(1);
          
          if (sellerInfo) {
            sellerUserId = sellerInfo.userId;
          }
        } catch (dbErr) {
          console.error("❌ Cart Socket Error fetching userId:", dbErr);
        }
      }

      const orderData = {
        orderId: subOrder.id,
        masterOrderId: transactionResult.masterOrder.id,
        orderNumber: subOrder.subOrderNumber || transactionResult.masterOrder.orderNumber,
        total: subOrder.total,
        status: subOrder.status || 'pending',
        createdAt: transactionResult.masterOrder.createdAt,
      };

      // A. Web Dashboard ke liye (Room Logic)
      if (sId) {
        io.to(`seller_room_${sId}`).emit("new-order", orderData);
      }

      // B. ⚡ MOBILE APP KE LIYE (Direct Hit & Room Backup)
      if (sellerUserId) {
        const userSpecificEvent = `new-order-user-${sellerUserId}`;
        
        // 🚨 DIRECT HIT (Ye wahi event hai jo mobile app listen kar rahi hai)
        io.emit(userSpecificEvent, orderData);
        
        // Room Backup (just in case)
        io.to(`user_room_${sellerUserId}`).emit("new-order", orderData);

        console.log(`🎯 [CART DIRECT HIT]: Signal fired for User: ${sellerUserId}`);
      }
    }));
    // ===============================
// 🔥 AI ORDER LEARNING
// ===============================

const learnedProducts = new Set<number>();

for (const subOrder of transactionResult.tempSubOrders) {
  for (const item of subOrder.items) {
    if (!item.product?.id) continue;

    // Duplicate product skip
    if (learnedProducts.has(item.product.id)) continue;

    learnedProducts.add(item.product.id);

    await trackProductEvent({
      userId,
      productId: item.product.id,
      type: "order",
    });
  }
}
    return res.status(201).json({
        message: "Orders placed successfully!",
        masterOrderId: transactionResult.masterOrder.id,
        masterOrderNumber: transactionResult.masterOrder.orderNumber,
        data: transactionResult.masterOrder,
    });

  } catch (err: any) {
    console.error("❌ Unexpected error in placeOrderFromCart:", err);
    return res.status(500).json({ message: err?.message || "Internal server error." });
  }
};    
        

/**
 * ✅ GET /api/orders
 * ग्राहक के सभी मास्टर ऑर्डर को उनके बैच और सब-ऑर्डर समरी के साथ फ़ेच करता है।
 * उद्देश्य: ग्राहक डैशबोर्ड पर बैच-वाइज ट्रैकिंग और समग्र स्टेटस दिखाना।
 */
export const getUserOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🔄 [API] Received request to get user orders with batch summary.");
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User not logged in." });
    }

    const masterOrders = await db.query.orders.findMany({
      where: eq(orders.customerId, userId),
      with: {
        // 🎯 फिक्स 1: 'deliveryAddress' अब टेबल रिलेशन नहीं, बल्कि सीधा टेक्स्ट कॉलम है भाई! इसलिए इसे 'with' से हटा दिया।
        subOrders: {
          with: {
            seller: {
              columns: { id: true, businessName: true },
            },
            store: {
              columns: { id: true, storeName: true, address: true, latitude: true, longitude: true },
            },
            deliveryBatch: { 
              columns: { id: true, status: true, estimatedDeliveryTime: true, actualDeliveryTime: true },
              with: {
                deliveryBoy: {
                  columns: { id: true, name: true, phone: true },
                },
              },
            },
          },
        },
      },
      orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    });

    const formattedOrders = masterOrders.map(masterOrder => {
      
      // 🟢 अद्वितीय बैचेस (Unique Batches) को इकट्ठा करें
      const uniqueBatchesMap = new Map();
      (masterOrder.subOrders || []).forEach(subOrder => {
          if (subOrder.deliveryBatch) {
              uniqueBatchesMap.set(subOrder.deliveryBatch.id, subOrder.deliveryBatch);
          }
      });
      const uniqueBatches = Array.from(uniqueBatchesMap.values());

      // 🟢 मास्टर ऑर्डर के लिए समग्र डिलीवरी स्टेटस निर्धारित करें
      let overallDeliveryStatus = masterOrder.status; 

      if (uniqueBatches.length > 0) {
          if (uniqueBatches.every(b => b.status === 'delivered')) {
              overallDeliveryStatus = 'fulfilled';
          } 
          else if (uniqueBatches.some(b => b.status === 'delivered')) {
              overallDeliveryStatus = 'partially_fulfilled';
          }
          else if (uniqueBatches.some(b => b.status === 'out_for_delivery' || b.status === 'picked_up')) {
              overallDeliveryStatus = 'confirmed';
          }
      }

      // प्रत्येक सब-ऑर्डर के लिए डिलीवरी बॉय और डिलीवरी स्टेटस जोड़ें
      const subOrdersWithDeliveryInfo = (masterOrder.subOrders || []).map(subOrder => {
        const deliveryBoy = subOrder.deliveryBatch?.deliveryBoy || null;
        const deliveryStatus = subOrder.deliveryBatch?.status || subOrder.status; 
        const estimatedDeliveryTime = subOrder.deliveryBatch?.estimatedDeliveryTime || null;
        const actualDeliveryTime = subOrder.deliveryBatch?.actualDeliveryTime || null;

        return {
          ...subOrder,
          deliveryBoy: deliveryBoy,
          deliveryStatus: deliveryStatus,
          estimatedDeliveryTime: estimatedDeliveryTime,
          actualDeliveryTime: actualDeliveryTime,
        };
      });

      // सेफ़ एड्रेस पार्सिंग भाई
      let parsedAddress = masterOrder.deliveryAddress;
      if (typeof masterOrder.deliveryAddress === 'string') {
        try { parsedAddress = JSON.parse(masterOrder.deliveryAddress); } catch (e) { }
      }

      return {
        ...masterOrder,
        deliveryAddress: parsedAddress,
        overallDeliveryStatus: overallDeliveryStatus, 
        deliveryBatches: uniqueBatches, 
        subOrders: subOrdersWithDeliveryInfo,
      };
    });

    console.log(`✅ [API] Found ${masterOrders.length} master orders for user ${userId}.`);
    return res.status(200).json(formattedOrders);
  } catch (error) {
    console.error("❌ Error fetching user orders:", error);
    return res.status(500).json({ message: "Failed to fetch orders." });
  }
};

/**
 * ✅ GET /api/orders/:orderId/tracking - 100% Full Details Fixed Engine
 */
export const getOrderTrackingDetails = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const customerId = req.user?.id;
    const orderId = Number(req.params.orderId);

    if (!customerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (Number.isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    /* 1️⃣ Master Order */
    const masterOrderResult = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.customerId, customerId)
        )
      )
      .limit(1);

    if (!masterOrderResult.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const masterOrder = masterOrderResult[0];

    /* 2️⃣ Delivery Address */
    const customerDeliveryAddress = masterOrder.deliveryAddressId
      ? (
          await db
            .select()
            .from(deliveryAddresses)
            .where(eq(deliveryAddresses.id, masterOrder.deliveryAddressId))
            .limit(1)
        )[0] || null
      : null;

    /* 3️⃣ Sub Orders - 🌟 कड़क सुधार 1: अब इसके अंदर 'orderItems' को भी पूरा खींच लिया भाई साहब ताकि ₹90 और ₹150 वाले आइटम लोड हों */
    const subOrdersList = await db.query.subOrders.findMany({
      where: eq(subOrders.masterOrderId, orderId),
      with: {
        seller: { 
          columns: {
            businessName: true,
            businessAddress: true,
          }
        },
        store: true,
        orderItems: true // ✅ डेटाबेस से सब-ऑर्डर आइटम्स की लाइव रिलेशनल मैपिंग भाई
      }
    });

    /* 4️⃣ Delivery Batches */
    const deliveryBatchesList = await db
      .select()
      .from(deliveryBatches)
      .where(eq(deliveryBatches.masterOrderId, orderId));

    /* 5️⃣ Attach Delivery Boy LIVE LOCATION */
    for (const batch of deliveryBatchesList) {
      let deliveryBoy: any = null;

      if (batch.deliveryBoyId) {
        const boyResult = await db
          .select({
            id: deliveryBoys.id,
            name: deliveryBoys.name,
            phone: deliveryBoys.phone,
            currentLat: deliveryBoys.currentLat,
            currentLng: deliveryBoys.currentLng,
          })
          .from(deliveryBoys)
          .where(eq(deliveryBoys.id, batch.deliveryBoyId))
          .limit(1);

        if (boyResult.length > 0) {
          const boy = boyResult[0];
          deliveryBoy = {
            id: boy.id,
            name: boy.name,
            phone: boy.phone,
            currentLocation:
              boy.currentLat !== null && boy.currentLng !== null
                ? {
                    lat: Number(boy.currentLat),
                    lng: Number(boy.currentLng),
                  }
                : null,
          };
        }
      }
      (batch as any).deliveryBoy = deliveryBoy;
    }

    /* 6️⃣ Tracking History */
    const trackingHistory = await db
      .select()
      .from(orderTracking)
      .where(eq(orderTracking.masterOrderId, orderId))
      .orderBy(desc(orderTracking.timestamp));

    /* 7️⃣ Delivery Batch Summary */
    const deliveryBatchesSummary: any[] = [];

    // फ्रंटएंड के लूप को खुश करने के लिए मास्टर कलेक्टेड आइटम्स एरे
    const allOrderedItems: any[] = [];

    for (const batch of deliveryBatchesList) {
      const relatedSubOrders = subOrdersList.filter(
        so => so.deliveryBatchId === batch.id
      );
      
      deliveryBatchesSummary.push({
        batchId: batch.id,
        batchStatus: batch.status,
        deliveryBoy: (batch as any).deliveryBoy,
        subOrders: relatedSubOrders.map(so => {
          
          // इस सबऑर्डर के आइटम्स को फ्रंटएंड के 'so.items' स्ट्रक्चर के मुताबिक ढाला भाई
          const formattedItems = (so.orderItems || []).map((oi: any) => {
            const itemObj = {
              productName: oi.productName || oi.name || "Item",
              quantity: oi.quantity || 1,
              itemTotal: Number(oi.totalPrice || oi.itemTotal || 0),
              variantName: oi.variantName || null,
              productPrice: Number(oi.unitPrice || oi.price || 0)
            };
            // मास्टर लिस्ट में भी भर दो भाई सेफ़्टी के लिए
            allOrderedItems.push(itemObj);
            return itemObj;
          });

          return {
            subOrderId: so.id,
            sellerName: (so as any).seller?.businessName || "Shopnish Seller", // ✅ 'SellerName' की स्पेलिंग ठीक की भाई साहब
            subOrderStatus: so.status,
            isSelfDelivery: so.isSelfDeliveryBySeller,
            items: formattedItems // ✅ फ्रंटएंड का मनपसंद आइटम्स एरे यहाँ ज़ोंबी की तरह जोड़ दिया!
          };
        }),
        storeLocations: [],
      });
    }

    // मास्टर एड्रेस पार्सिंग भाई
    let masterParsedAddress = masterOrder.deliveryAddress;
    if (typeof masterOrder.deliveryAddress === 'string') {
      try { masterParsedAddress = JSON.parse(masterOrder.deliveryAddress); } catch (e) { }
    }

    /* ✅ FINAL RESPONSE - 🌟 कड़क सुधार 2: अब इसमें सारे मिसिंग कॉलम्स (subtotal, deliveryCharge) जोड़ दिए हैं! */
    return res.status(200).json({
      masterOrderId: masterOrder.id,
      masterOrderNumber: masterOrder.orderNumber,
      status: masterOrder.status,
      paymentMethod: masterOrder.paymentMethod,
      paymentStatus: masterOrder.paymentStatus,
      
      subtotal: Number(masterOrder.subtotal || 0), // ✅ फ्रंटएंड की पहली मांग पूरी!
      deliveryCharge: Number(masterOrder.deliveryCharge || 0), // ✅ फ्रंटएंड की दूसरी मांग पूरी!
       platformCharge: Number(masterOrder.platformCharge || 0),
  discount: Number(masterOrder.discount || 0),
  extraDiscount: Number(masterOrder.extraDiscount || 0),

      total: Number(masterOrder.total || 0),
      
      estimatedDeliveryTime: masterOrder.estimatedDeliveryTime,
      createdAt: masterOrder.createdAt,
      deliveryAddress: masterParsedAddress,

      customerDeliveryAddress,
      deliveryBatchesSummary,
      items: allOrderedItems, // 'Items Ordered' वाले सेफ़्टी कार्ड के लिए भाई
      masterOrderTrackingHistory: trackingHistory,
    
    });

  } catch (error) {
    console.error("❌ Order Tracking Error:", error);
    return res.status(500).json({
      message: "Unable to fetch order tracking details",
    });
  }
};
    

export const getSubOrderDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log("🔍 [API] Received request to get Master Order details (Legacy/Fallback).");
    try {
        const customerId = req.user?.id;
        const orderId = Number(req.params.orderId);

        if (!customerId) {
            return res.status(401).json({ message: "Unauthorized." });
        }
        
        if (Number.isNaN(orderId)) {
            return res.status(400).json({ message: "Invalid Order ID." }); 
        }

        const masterOrderDetail = await db.query.orders.findFirst({
            where: and(
                eq(orders.id, orderId),
                eq(orders.customerId, customerId)
            ),
            with: {
                // 🎯 फिक्स 2: 'deliveryAddress' यहाँ से हटाया, और subOrders के साथ orderItems को भी लोड किया भाई!
                subOrders: {
                    with: {
                        seller: {
                            columns: { id: true, businessName: true, businessAddress: true, businessPhone: true },
                        },
                        orderItems: true // आइटम्स की लिस्ट देखने के लिए भाई
                    },
                },
            },
        });

        if (!masterOrderDetail) {
            return res.status(404).json({ message: "Master order not found or access denied." });
        }

        let parsedDeliveryAddress = {};
        try {
            parsedDeliveryAddress = JSON.parse(masterOrderDetail.deliveryAddress as string);
        } catch (e) {
            parsedDeliveryAddress = { raw: masterOrderDetail.deliveryAddress };
        }

        // 🎯 फिक्स 3: '...subOrder' को स्प्रेड करना बेहद ज़रूरी था भाई, वरना सब-ऑर्डर की फ़ील्ड्स गायब हो जातीं!
        const detailedSubOrders = (masterOrderDetail.subOrders || []).map(subOrder => {
            const deliveryBoy = (subOrder as any)?.deliveryBatch?.deliveryBoy || null;
            const deliveryStatus = (subOrder as any)?.deliveryBatch?.status || (subOrder.isSelfDeliveryBySeller ? 'delivered_by_seller' : subOrder.status);
            
            // 🎯 बदला जाने वाला हिस्सा: रिस्पॉन्स मैपिंग से डिलीवरी चार्ज बिल्कुल खत्म भाई साहब!
            return {
                ...subOrder, 
                total: Number(subOrder.subtotal || 0), // ✅ टोटल अब सिर्फ़ माल का शुद्ध मूल्य रहेगा
                subtotal: Number(subOrder.subtotal || 0),
                // ❌ deliveryCharge वाली लाइन को यहाँ से पूरी तरह हटा दिया गया है भाई
                deliveryBoy: deliveryBoy,
                deliveryStatus: deliveryStatus,
                items: subOrder.orderItems || []
            };
        });

        console.log(`✅ [API] Found master order ${orderId}.`);
        
        return res.status(200).json({
          ...masterOrderDetail,
          total: Number(masterOrderDetail.total || 0),
          subtotal: Number(masterOrderDetail.subtotal || 0),
          deliveryCharge: Number(masterOrderDetail.deliveryCharge || 0),
          deliveryAddress: parsedDeliveryAddress,
          subOrders: detailedSubOrders,
        });

    } catch (error: any) {
        console.error("❌ Error fetching sub-order details:", error);
        next(error);
    }
};

/**
 * fetches details for a specific master order id.
 */
export const getOrderDetail = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.user?.id;
    const orderId = Number(req.params.orderId);

    if (!customerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const masterOrder = await db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.customerId, customerId)),
      with: {
        subOrders: {
          with: {
            orderItems: true,
            seller: { columns: { businessName: true } }
          }
        }
      }
    });

    if (!masterOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    // 🎯 बदला जाने वाला हिस्सा: सब-ऑर्डर्स मैपिंग से डिलीवरी चार्ज का झंझट पूरी तरह ख़त्म भाई साहब!
    const formattedSubOrders = (masterOrder.subOrders || []).map(so => ({
      ...so,
      total: Number(so.subtotal || 0),   // ✅ यहाँ कड़क सुधार: टोटल अब सिर्फ़ माल का शुद्ध मूल्य रहेगा
      subtotal: Number(so.subtotal || 0),
      // ❌ deliveryCharge वाली लाइन को यहाँ से पूरी तरह हटा दिया गया है भाई साहब
      
      items: (so.orderItems || []).map((item: any) => {
        const price = Number(item.productPrice || item.unitPrice || 0);
        const qty = Number(item.quantity || 0);
        return {
          ...item,
          unitPrice: price,
          quantity: qty,
          itemTotal: price * qty 
        };
      })
    }));
   // 🎯 100% वाटरप्रूफ फिक्स: इन-लाइन एड्रेस पार्सिंग के साथ एरर का काम तमाम भाई साहब!
    return res.json({
      step: 1, 
      masterOrder: {
        ...masterOrder,
        total: Number(masterOrder.total || 0),
        subtotal: Number(masterOrder.subtotal || 0),
        // ❌ डिलीवरी चार्ज यहाँ मास्टर ऑर्डर रिस्पांस से भी साफ़ है भाई
        deliveryAddress: (() => {
          if (typeof masterOrder.deliveryAddress === 'string') {
            try { 
              return JSON.parse(masterOrder.deliveryAddress); 
            } catch (e) { 
              return masterOrder.deliveryAddress; // फॉलबैक अगर पहले से स्ट्रिंग हो
            }
          }
          return masterOrder.deliveryAddress || {};
        })()
      },
      subOrders: formattedSubOrders 
    });
  } catch (e) {
    console.error("❌ getOrderDetail Error:", e);
    return res.status(500).json({ error: true, message: "Internal Server Error" });
  }
};