
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

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (lat1 === 0 || lon1 === 0 || lat2 === 0 || lon2 === 0) return 9999; // यदि कोई अमान्य समन्वय है तो बड़ी दूरी लौटाएं

  const R = 6371; // पृथ्वी की त्रिज्या किलोमीटर में
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // किलोमीटर में दूरी
  return distance;
};

// एक डमी डिलीवरी बॉय असाइनमेंट फंक्शन
// वास्तविक कार्यान्वयन में, यह उपलब्धता, स्थान, लोड आदि के आधार पर एक डिलीवरी बॉय ढूंढेगा।
//async function assignDeliveryBoy(tx: any, masterOrderId: number, customerLat: number, customerLng: number): Promise<number | null> {
    // यहाँ आप डेटाबेस से उपलब्ध डिलीवरी बॉय को क्वेरी कर सकते हैं
    // उदाहरण के लिए, 5 किमी के भीतर और उपलब्ध
  //  const availableDeliveryBoys = await tx.select()
    //    .from(deliveryBoys)
    //    .where(eq(deliveryBoys.isAvailable, true));
    
    // सरल बनाने के लिए, बस पहला उपलब्ध डिलीवरी बॉय लौटा दें
  //  if (availableDeliveryBoys.length > 0) {
   //     return availableDeliveryBoys[0].id;
 //   }
 //   return null;
// }

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
  fullAddress: any;
  city: string; 
  state: string; 
  pincode: string 
}> {
  
  let finalDeliveryAddressId: number;
  let finalDeliveryLat: number;
  let finalDeliveryLng: number;
  let finalFullAddress: any;
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
      latitude: fullAddressObj.latitude,
      longitude: fullAddressObj.longitude,
      isDefault: false,
      createdAt: new Date(),
    }).returning();

    finalDeliveryAddressId = inserted.id;
    finalDeliveryLat = Number(inserted.latitude);
    finalDeliveryLng = Number(inserted.longitude);

    finalCity = inserted.city;
    finalState = inserted.state;
    finalPincode = inserted.postalCode;

    finalFullAddress = fullAddressObj;
  }

  // ------------------------ EXISTING ADDRESS ---------------------------
  else if (deliveryAddressId) {

    const [existing] = await tx.select()
      .from(deliveryAddresses)
      .where(and(
        eq(deliveryAddresses.id, deliveryAddressId),
        eq(deliveryAddresses.userId, userId)
      ));

    if (!existing) throw new Error("Delivery address not found.");

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

    finalFullAddress = fullAddressObj;
  }

  else {
    throw new Error("No delivery address provided.");
  }

  return {
    id: finalDeliveryAddressId,
    lat: finalDeliveryLat,
    lng: finalDeliveryLng,
    fullAddress: finalFullAddress,
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

        // Compare calculatedSubtotal with client-provided subtotal
        if (Math.abs(calculatedSubtotal - subtotal) > 0.01) {
          throw new Error('Calculated subtotal does not match provided subtotal. Possible price discrepancy.');
        }

        // Validate total
        if (Math.abs((calculatedSubtotal + deliveryCharge) - total) > 0.01) {
          throw new Error('Calculated total (subtotal + deliveryCharge) does not match provided total.');
        }

        // 1. Create master order (पूरे पेलोड के साथ भाई)
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
            subtotal: calculatedSubtotal,
            deliveryCharge: deliveryCharge,
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

        // 2. Create sub-order for the seller (buy-now expects single seller)
        const [sellerStore] = await tx.select().from(stores).where(eq(stores.sellerId, sellerId)).limit(1);
        if (!sellerStore) throw new Error(`Store details not found for seller ${sellerId}.`);

        const [sellerInfo] = await tx.select().from(sellersPgTable).where(eq(sellersPgTable.id, sellerId)).limit(1);
        const isSelfDelivery = sellerInfo?.isSelfDeliveryBySeller || false;

        const [subOrder] = await tx.insert(subOrders).values({
          masterOrderId: masterOrder.id,
          subOrderNumber: `${masterOrder.orderNumber}-${sellerId}`,
          sellerId: sellerId,
          storeId: sellerStore.id,
          subtotal: calculatedSubtotal,
          deliveryCharge: deliveryCharge,
          total: total,
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
    
    // Server-side transaction
  // Server-side transaction
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

        let masterOrderCalculatedSubtotal = 0;
        let masterOrderCalculatedDeliveryCharge = 0;

      // 🔥 पार्ट 2: लूप के अंदर वैरिएंट आधारित वैलिडेशन भाई
        const groupedBySeller = new Map<number, any[]>();

        for (const cartItem of userCartItems) {
            const product = cartItem.product;
            const variant = cartItem.variant; // कार्ट आइटम से जुड़ा वैरिएंट

            if (!product || product.approvalStatus !== 'approved') {
              console.warn(`[order_from_cart] Product ${cartItem.productId} not found or not approved, skipping.`);
              continue;
            }
            if (!variant || !variant.isActive) {
              throw new Error(`Maaf kijiye, ${product.name} ka chuna hua size abhi upalabdh nahi hai भाई!`);
            }

            // 🎯 लिमिट चेक अब सीधा वैरिएंट टेबल से होगी भाई
            if (variant.minOrderQty && cartItem.quantity < variant.minOrderQty) {
              throw new Error(`Minimum order quantity for ${product.name} (${variant.quantityValue} ${variant.unit}) is ${variant.minOrderQty}.`);
            }
            if (variant.maxOrderQty && cartItem.quantity > variant.maxOrderQty) {
              throw new Error(`Maximum order quantity for ${product.name} (${variant.quantityValue} ${variant.unit}) is ${variant.maxOrderQty}.`);
            }

            if (!groupedBySeller.has(cartItem.sellerId)) {
                groupedBySeller.set(cartItem.sellerId, []);
            }
            
            // 🎯 फिक्स: यहाँ cartItem के अंदर variantId को explicitely confirm कर देते हैं भाई
            // ताकि आगे Part 3 और Part 4 के लूप में कोई undefined एरर न आए!
            const structuredItem = {
              ...cartItem,
              variantId: variant.id,
              priceAtAdded: Number(variant.price)
            };
            
            groupedBySeller.get(cartItem.sellerId)?.push(structuredItem);
            
            // टोटल प्राइस संख्या के रूप में कैलकुलेट होगी भाई
            masterOrderCalculatedSubtotal += Number(cartItem.totalPrice); 
        }

        // --- इंटीग्रिटी चेक (Subtotal) ---
        if (Math.abs(masterOrderCalculatedSubtotal - subtotal) > 0.01) {
          throw new Error('Calculated subtotal does not match provided subtotal. Possible price discrepancy.');
        }

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
            items: any[]; // 👈 यहाँ any[] कर दिया ताकि कस्टमाइज्ड cartItem एक्सेप्ट हो सके भाई
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

            const subtotal = items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
            const currentSubOrderDeliveryCharge = seller.isSelfDeliveryBySeller ? 0 : 50; // DUMMY CHARGE
            masterOrderCalculatedDeliveryCharge += currentSubOrderDeliveryCharge;

            tempSubOrders.push({
                sellerId,
                storeId: store.id,
                isSelfDelivery: seller.isSelfDeliveryBySeller,
                subtotal,
                deliveryCharge: currentSubOrderDeliveryCharge,
                total: subtotal + currentSubOrderDeliveryCharge,
                items: items, // ✅ अब इसमें हर आइटम के पास अपनी variantId सुरक्षित है भाई!
                storeLat: Number(store.latitude), 
                storeLng: Number(store.longitude),
                estimatedTime: 60,
            });
        }
        // --- फाइनल टोटल चेक ---
        if (Math.abs(masterOrderCalculatedDeliveryCharge - deliveryCharge) > 0.01) {
          console.warn('Calculated total delivery charge does not match provided total delivery charge. Using calculated value.');
        }

        const masterOrderCalculatedTotal = masterOrderCalculatedSubtotal + masterOrderCalculatedDeliveryCharge;
        if (Math.abs(masterOrderCalculatedTotal - total) > 0.01) {
            console.warn('Calculated total does not match provided total. Using calculated value.');
        }

       // 🎯 कार्ट चेकआउट (placeOrderFromCart) के अंदर मास्टर ऑर्डर इंसर्ट को ऐसे अपडेट करें:
// ==================== 🎯 एड्रेस और डिलीवरी चार्ज का अचूक उपाय ====================
    
    // अगर किसी वजह से फ्रंटएंड से addressLine1 खाली आया है, तो पहले से मौजूद ID से पूरा पता निकालें
    if ((!finalDeliveryAddressJson || finalDeliveryAddressJson.trim() === "") && finalDeliveryAddressId) {
        const [dbAddress] = await tx.select().from(deliveryAddresses).where(eq(deliveryAddresses.id, finalDeliveryAddressId)).limit(1);
        if (dbAddress) {
            finalDeliveryAddressJson = dbAddress.addressLine1 || "";
            finalCity = dbAddress.city || finalCity;
            finalState = dbAddress.state || finalState;
            finalPincode = dbAddress.postalCode || finalPincode;
        }
    }

    // 🚨 सेफ़्टी फॉलबैक: अगर फिर भी खाली रह जाए, तो N/A रखें (गलत या ब्लैंक डेटाबेस एंट्री रोकने के लिए)
    if (!finalDeliveryAddressJson || finalDeliveryAddressJson.trim() === "") {
        finalDeliveryAddressJson = "N/A"; 
    }

    // 🎯 मास्टर ऑर्डर बनाएं (सिंक्रोनाइज्ड SQL मैपिंग)
    const [masterOrder] = await tx.insert(orders).values({
        orderNumber: `ORD-${Date.now()}-${userId}`,
        customerId: userId,
        deliveryAddressId: finalDeliveryAddressId,
        
        // अब यहाँ कभी भी खाली "" नहीं जाएगा भाई!
        deliveryAddress: finalDeliveryAddressJson, 
        deliveryCity: finalCity || "Bundi",
        deliveryState: finalState || "Rajasthan",
        deliveryPincode: finalPincode || null,
        deliveryLat: finalDeliveryLat,
        deliveryLng: finalDeliveryLng,
        
        subtotal: subtotal, 
        total: total,
        
        // 🎯 स्पेलिंग एरर फिक्स: डेटाबेस कॉलम 'delivery_charge' को सही वेरिएबल असाइन किया
        deliveryCharge: deliveryCharge, 
        
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
            // 🎯 TS FIX: String/Null ko safe number mein cast kiya taaki calculateDistance khush ho jaye
            const lat = finalDeliveryLat ? Number(finalDeliveryLat) : 0;
            const lng = finalDeliveryLng ? Number(finalDeliveryLng) : 0;

            const distA = calculateDistance(lat, lng, Number(a.storeLat || 0), Number(a.storeLng || 0));
            const distB = calculateDistance(lat, lng, Number(b.storeLat || 0), Number(b.storeLng || 0));
            
            return distA - distB;
        });

        for (const subOrderData of nonSelfDeliverySubOrders) {
            const [subOrder] = await tx.insert(subOrders).values({
                masterOrderId: masterOrder.id,
                subOrderNumber: `${masterOrder.orderNumber}-${subOrderData.sellerId}`,
                sellerId: subOrderData.sellerId,
                storeId: subOrderData.storeId,
                subtotal: Number(subOrderData.subtotal),
                deliveryCharge: Number(subOrderData.deliveryCharge),
                total: Number(subOrderData.total),
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
        for (const subOrderData of selfDeliverySubOrders) {
            const [subOrder] = await tx.insert(subOrders).values({
                masterOrderId: masterOrder.id,
                subOrderNumber: `${masterOrder.orderNumber}-${subOrderData.sellerId}-SELF`,
                sellerId: subOrderData.sellerId,
                storeId: subOrderData.storeId,
                subtotal: Number(subOrderData.subtotal),
                deliveryCharge: 0,
                total: Number(subOrderData.subtotal),
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
        deliveryAddress: true, 
        subOrders: {
          with: {
            seller: {
              columns: { id: true, businessName: true },
            },
            store: {
              columns: { id: true, storeName: true, address: true, latitude: true, longitude: true },
            },
            deliveryBatch: { // सब-ऑर्डर से डिलीवरी बैच को पॉपुलेट करें
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
      orderBy: [desc(orders.createdAt)],
    });

    const formattedOrders = masterOrders.map(masterOrder => {
      
      // 🟢 FIX 1: अद्वितीय बैचेस (Unique Batches) को इकट्ठा करें
      const uniqueBatchesMap = new Map();
      (masterOrder.subOrders || []).forEach(subOrder => {
          if (subOrder.deliveryBatch) {
              uniqueBatchesMap.set(subOrder.deliveryBatch.id, subOrder.deliveryBatch);
          }
      });
      const uniqueBatches = Array.from(uniqueBatchesMap.values());

      // 🟢 FIX 2: मास्टर ऑर्डर के लिए समग्र डिलीवरी स्टेटस निर्धारित करें
      let overallDeliveryStatus = masterOrder.status; 

if (uniqueBatches.length > 0) {
    // 1. यदि सभी बैचेस 'delivered' हैं, तो मास्टर स्टेटस 'fulfilled' (मतलब ऑर्डर पूरा हुआ)
    if (uniqueBatches.every(b => b.status === 'delivered')) {
        overallDeliveryStatus = 'fulfilled';
    } 
    // 2. यदि कोई बैच डिलीवर हो गया है और कुछ अभी भी रास्ते में हैं, तो 'partially_fulfilled'
    else if (uniqueBatches.some(b => b.status === 'delivered')) {
        overallDeliveryStatus = 'partially_fulfilled';
    }
    // 3. यदि कोई भी बैच 'out_for_delivery' या 'picked_up' है, तो उसे 'confirmed' मानें 
    // (क्योंकि ये अभी भी प्रोसेस में हैं)
    else if (uniqueBatches.some(b => b.status === 'out_for_delivery' || b.status === 'picked_up')) {
        overallDeliveryStatus = 'confirmed';
    }
}

      // प्रत्येक सब-ऑर्डर के लिए डिलीवरी बॉय और डिलीवरी स्टेटस जोड़ें (पुरानी मैपिंग बरकरार)
      const subOrdersWithDeliveryInfo = (masterOrder.subOrders || []).map(subOrder => {
        const deliveryBoy = subOrder.deliveryBatch?.deliveryBoy || null;
        // डिलीवरी स्टेटस के लिए डिलीवरी बैच स्टेटस को प्राथमिकता दें
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

      return {
        ...masterOrder,
        overallDeliveryStatus: overallDeliveryStatus, // 👈 Frontend पर दिखने वाला स्टेटस
        deliveryBatches: uniqueBatches, // 👈 बैच-वाइज ट्रैकिंग के लिए
        subOrders: subOrdersWithDeliveryInfo,
      };
    });

    console.log(`✅ [API] Found ${masterOrders.length} master orders for user ${userId}.`);
    res.status(200).json(formattedOrders);
  } catch (error) {
    console.error("❌ Error fetching user orders:", error);
    res.status(500).json({ message: "Failed to fetch orders." });
  }
};


/**
 * ✅ GET /api/orders/:orderId/tracking
 * विशिष्ट मास्टर ऑर्डर के लिए विस्तृत ट्रैकिंग जानकारी फ़ेच करता है।
 * उद्देश्य: मैप पर ट्रैकिंग और बैच-वाइज डिलीवरी प्रगति दिखाना।
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

    /* 3️⃣ Sub Orders - Updated with Seller Details */
const subOrdersList = await db.query.subOrders.findMany({
  where: eq(subOrders.masterOrderId, orderId),
  with: {
    seller: { // 👈 Ye relation add karna zaroori hai
      columns: {
        businessName: true,
        businessAddress: true,
      }
    },
    store: true // Agar store ka lat/lng bhi chahiye
  }
});

    /* 4️⃣ Delivery Batches */
    const deliveryBatchesList = await db
      .select()
      .from(deliveryBatches)
      .where(eq(deliveryBatches.masterOrderId, orderId));

    
    /* 5️⃣ Attach Delivery Boy (LIVE LOCATION FROM delivery_boys table) */
   for (const batch of deliveryBatchesList) {
  let deliveryBoy: any = null;

  // delivery boy assigned hai ya nahi
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
          boy.currentLat !== null &&
          boy.currentLng !== null
            ? {
                lat: Number(boy.currentLat),
                lng: Number(boy.currentLng),
              }
            : null,
      };
    }
  }

  // 👇 batch me attach kar do (yeh line rehni hi chahiye)
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

    for (const batch of deliveryBatchesList) {
      const relatedSubOrders = subOrdersList.filter(
        so => so.deliveryBatchId === batch.id
      );
//const sellerName = (subOrdersList[0] as any)?.seller?.businessName || "Shopnish Seller";
      deliveryBatchesSummary.push({
        batchId: batch.id,
        batchStatus: batch.status,
        deliveryBoy: (batch as any).deliveryBoy,
        subOrders: relatedSubOrders.map(so => ({
          subOrderId: so.id,
          SellerName: (so as any).seller?.businessName || (so as any).sellerName || "Shopnish Seller",
          subOrderStatus: so.status,
          isSelfDelivery: so.isSelfDeliveryBySeller,
        })),
        storeLocations: [],
      });
    }

    /* ✅ FINAL RESPONSE */
    return res.status(200).json({
      masterOrderId: masterOrder.id,
      masterOrderNumber: masterOrder.orderNumber,
      status: masterOrder.status,
      paymentMethod: masterOrder.paymentMethod,
      paymentStatus: masterOrder.paymentStatus,
      total: masterOrder.total,
      estimatedDeliveryTime: masterOrder.estimatedDeliveryTime,
      createdAt: masterOrder.createdAt,

      customerDeliveryAddress,
      deliveryBatchesSummary,
      masterOrderTrackingHistory: trackingHistory,
    });

  } catch (error) {
    console.error("❌ Order Tracking Error:", error);
    return res.status(500).json({
      message: "Unable to fetch order tracking details",
    });
  }
};
    
// ---------------------------------------------------------------------------------
// **NOTES:** getSubOrderDetails और getOrderDetail में मुख्य ट्रैकिंग लॉजिक शामिल नहीं है
// ---------------------------------------------------------------------------------

export const getSubOrderDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log("🔍 [API] Received request to get Master Order details (Legacy/Fallback).");
    try {
        const customerId = req.user?.id;
        const orderId = Number(req.params.orderId);
        
        // 🛑 FIX 1: sellerId की अपेक्षा करना बंद करें
        // यह लाइन अभी भी Query से sellerId को पढ़ने की कोशिश करती है, 
        // लेकिन हम इसे 400 त्रुटि देने के लिए उपयोग नहीं करेंगे।
        const sellerIdQuery = req.query.sellerId; 

        if (!customerId) {
            return res.status(401).json({ message: "Unauthorized." });
        }
        
        // ✅ FIX 2: Validation को केवल Master Order ID पर सीमित करें
        if (Number.isNaN(orderId)) {
            // हमने 'Seller ID' संदर्भ हटा दिया है।
            return res.status(400).json({ message: "Invalid Order ID." }); 
        }

        // ----------------------------------------------------------------------
        // ⚠️ महत्वपूर्ण: यदि यह फ़ंक्शन अब Master Order डिटेल्स दिखाता है, 
        // तो आपको इसकी Drizzle क्वेरी को भी बदलना होगा ताकि यह 'getOrderDetail' की तरह काम करे!
        // (जैसा कि आपने getOrderDetail में किया था)
        // ----------------------------------------------------------------------

        const masterOrderDetail = await db.query.orders.findFirst({
            where: and(
                eq(orders.id, orderId),
                eq(orders.customerId, customerId)
            ),
            with: {
                deliveryAddress: true,
                subOrders: {
                    with: {
                        seller: {
                            columns: { id: true, businessName: true, businessAddress: true, businessPhone: true },
                        },
                        // ... बाकी subOrders का डेटा ...
                    },
                },
             //   orderTracking: {
                //    orderBy: [desc(orderTracking.createdAt)],
              //  }
            },
        });
        const trackingHistory = await db.query.orderTracking.findMany({
  where: eq(orderTracking.masterOrderId, orderId),
  orderBy: [desc(orderTracking.timestamp)],
  limit: 5,
});
        // यदि masterOrderDetail नहीं मिला
        if (!masterOrderDetail) {
            return res.status(404).json({ message: "Master order not found or access denied." });
        }

        // Parsing logic (सही है)
        let parsedDeliveryAddress = {};
        try {
            parsedDeliveryAddress = JSON.parse(masterOrderDetail.deliveryAddress as string);
        } catch (e) {
            console.warn(`Failed to parse deliveryAddress JSON for master order ${masterOrderDetail.id}:`, e);
        }

        // SubOrders data mapping (सही है)
        const detailedSubOrders = (masterOrderDetail.subOrders || []).map(subOrder => {
            const deliveryBoy = (subOrder as any)?.deliveryBatch?.deliveryBoy || null;
            const deliveryStatus = (subOrder as any)?.deliveryBatch?.status || (subOrder.isSelfDeliveryBySeller ? 'delivered_by_seller' : subOrder.status);
            
            return {
                // ... subOrder fields
                deliveryBoy: deliveryBoy,
                deliveryStatus: deliveryStatus,
            };
        });

        console.log(`✅ [API] Found master order ${orderId}.`);
        
        // 🟢 FIX 3: Master Order फॉर्मेट में डेटा वापस करें
        res.status(200).json({
          ...masterOrderDetail,
          deliveryAddress: parsedDeliveryAddress,
          subOrders: detailedSubOrders,
        });

    } catch (error: any) {
        console.error("❌ Error fetching sub-order details (now master order details):", error);
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

    // 1. Address Parsing
    let parsedAddress = masterOrder.deliveryAddress;
    if (typeof masterOrder.deliveryAddress === 'string') {
      try { parsedAddress = JSON.parse(masterOrder.deliveryAddress); } catch (e) { }
    }

    // 2. Formatting Sub-Orders
    const formattedSubOrders = (masterOrder.subOrders || []).map(so => ({
      ...so,
      // 🛑 यहाँ सभी अमाउंट्स को पक्का नंबर में बदलें
      total: Number(so.total || 0),
      subtotal: Number(so.subtotal || 0),
      deliveryCharge: Number(so.deliveryCharge || 0), // 👈 यह लाइन एरर फिक्स करेगी
      
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

    // 3. Response
    return res.json({
      step: 1, 
      masterOrder: {
        ...masterOrder,
        total: Number(masterOrder.total || 0),
        subtotal: Number(masterOrder.subtotal || 0),
        deliveryCharge: Number(masterOrder.deliveryCharge || 0), // यहाँ भी सुरक्षित रखें
        deliveryAddress: parsedAddress
      },
      subOrders: formattedSubOrders 
    });

  } catch (e) {
    console.error("❌ getOrderDetail Error:", e);
    return res.status(500).json({ error: true, message: "Internal Server Error" });
  }
};
