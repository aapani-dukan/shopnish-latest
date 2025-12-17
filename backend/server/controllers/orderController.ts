// backend/server/controllers/ordercontroller.ts
import { Request, Response, NextFunction } from "express"; // ✅ express imports को सही करें
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import {
  deliveryAddresses,
  orders, // Master Order
  subOrders, // Sub-Orders per seller
  deliveryBatches, // Delivery groups
  orderItems, // Items now link to subOrders
  cartItems,
  orderTracking,
  products,
  masterOrderStatusEnum, // ✅ Master Order Status
  subOrderStatusEnum, // ✅ Sub-Order Status
  deliveryStatusEnum, // ✅ Delivery Batch Status
  approvalStatusEnum,
  sellersPgTable,
  stores, // ✅ Stores टेबल इम्पोर्ट करें
  deliveryBoys, // ✅ Delivery Boys इम्पोर्ट करें (रिलेशंस के लिए)
  // paymentMethodEnum, // ✅ यदि paymentMethodEnum का उपयोग कर रहे हो तो इम्पोर्ट करें
  // paymentStatusEnum, // ✅ यदि paymentStatusEnum का उपयोग कर रहे हो तो इम्पोर्ट करें
} from "../../shared/backend/schema"; // ✅ schema फ़ाइल से इम्पोर्ट करें
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { AuthenticatedRequest } from "../middleware/authMiddleware"; // ✅ AuthenticatedRequest को सही नाम से इम्पोर्ट करें
import { getIO } from "../socket"; // ✅ getIo को सही नाम से इम्पोर्ट करें
import { json } from "drizzle-orm/pg-core"; // ✅ json को drizzle से इम्पोर्ट करें

// --- सहायक कार्य (Helper Functions) ---

// ध्यान दें: यह Haversine फ़ॉर्मूला के लिए एक सरल प्लेसहोल्डर है।
// उत्पादन (Production) में, आपको एक सटीक कार्यान्वयन या PostGIS का उपयोग करना चाहिए।
// PostGIS के बिना, यह एक अनुमानित दूरी है।
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
 // client/src/pages/checkout2.tsx में `handleLocationUpdate` फ़ंक्शन के नीचे,
// या `createOrderMutation` से पहले कहीं भी यह जोड़ें।

// ... (handleDeliveryAddress फ़ंक्शन अपरिवर्तित है)

/**
 * handles placing a direct "buy now" order.
 */
export const placeOrderBuyNow = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🚀 [API] Received request to place buy now order.");
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
    await db.transaction(async (tx) => {
      try {
        // Handle delivery address (stores new address in `deliveryAddresses` table and returns details)
        const {
          id: finalDeliveryAddressId,
          lat: finalDeliveryLat,
          lng: finalDeliveryLng,
          fullAddress: finalDeliveryAddressJson,
          city: finalCity,
          state: finalState,
          pincode: finalPincode,
        } = await handleDeliveryAddress(tx, userId, deliveryAddressId, newDeliveryAddress, req.user);

           if (userPhoneNumberForUpdate && typeof userPhoneNumberForUpdate === 'string' && userPhoneNumberForUpdate.length >= 10) {
            // हम यहाँ users टेबल को tx के माध्यम से अपडेट कर रहे हैं
            await tx.update(users)
                .set({
                    phone: userPhoneNumberForUpdate,
                    updatedAt: new Date(),
                })
                  .where(
                    // 1. उपयोगकर्ता आईडी से मिलान करें
                    eq(users.id, userId), 
                    // 2. OPTIONAL: केवल तभी अपडेट करें जब फ़ोन नंबर अभी खाली हो
                    // or(isNull(users.phone), eq(users.phone, '')) 
                    // सुरक्षा के लिए, हम सीधे अपडेट कर सकते हैं।
                );
            console.log(`User ${userId} phone number updated to ${userPhoneNumberForUpdate} during order placement.`);
           }
        // --- Fetch product(s) and validate each item ---
        let calculatedSubtotal = 0;
        const validatedItems: Array<{
          productId: number;
          product: any;
          unitPrice: number;
          quantity: number;
          itemTotal: number;
        }> = [];

        // ... (product validation logic is unchanged and is assumed correct)
        
        for (const it of normalizedItems) {
            // ... (product validation logic is unchanged)
            // ...
            const productId = Number(it.productId);
            const quantity = Number(it.quantity ?? 1);
            if (!productId || Number.isNaN(productId)) { throw new Error("Invalid productId in item."); }
            if (!quantity || Number.isNaN(quantity) || quantity <= 0) { throw new Error("Invalid quantity in item."); }
            const [product] = await tx.select().from(products).where(eq(products.id, productId));
            if (!product) { throw new Error(`Product ${productId} not found.`); }
            if (product.approvalStatus !== "approved") { throw new Error(`Product ${productId} is not available or not approved.`); }
            if (product.minOrderQty && quantity < product.minOrderQty) { throw new Error(`Minimum order quantity for ${product.name} is ${product.minOrderQty}.`); }
            if (product.maxOrderQty && quantity > product.maxOrderQty) { throw new Error(`Maximum order quantity for ${product.name} is ${product.maxOrderQty}.`); }
            const unitPrice = Number(it.priceAtAdded ?? it.unitPrice ?? product.price);
            if (Number.isNaN(unitPrice)) { throw new Error(`Invalid unit price for product ${productId}.`); }
            const itemTotalPrice = unitPrice * quantity;
            calculatedSubtotal += itemTotalPrice;

            validatedItems.push({
                productId,
                product,
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

        // 1. Create master order
const [masterOrder] = await tx.insert(orders).values({
    orderNumber: `ORD-${Date.now()}-${userId}`,
    customerId: userId,
    deliveryAddressId: finalDeliveryAddressId,
    // FIX APPLIED: Only save the addressLine1 string to the TEXT column
    deliveryAddress: JSON.stringify(finalDeliveryAddressJson),
    
    deliveryCity: finalCity,
    deliveryState: finalState,
    deliveryPincode: finalPincode,
    deliveryLat: finalDeliveryLat,
    deliveryLng: finalDeliveryLng,
    subtotal: calculatedSubtotal,
    total: total,
    
    // FIX APPLIED: Payment method converted to uppercase
    paymentMethod: paymentMethod.toUpperCase(), 
    
    paymentStatus: paymentMethod.toUpperCase() === 'COD' ? 'pending' : 'pending',
    
    // यह पहली बार है जब ये कीज़ परिभाषित की गई हैं
    status: masterOrderStatusEnum.enumValues?.[0] ?? 'pending',
    deliveryInstructions: deliveryInstructions || null,
    createdAt: new Date(),
    updatedAt: new Date(),
}).returning({ 
    id: orders.id, 
    orderNumber: orders.orderNumber, 
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

        // 3. Insert order items (all validatedItems)
for (const vItem of validatedItems) {
    await tx.insert(orderItems).values({
        // 🛑 FIX: order_id, seller_id, और user_id को स्पष्ट रूप से पास करें
        subOrderId: subOrder.id,
        orderId: masterOrder.id, // <--- नया! मास्टर ऑर्डर ID
        sellerId: sellerId,       // <--- नया! विक्रेता ID
        userId: userId,           // <--- नया! ग्राहक ID
        
        productId: vItem.productId,
        productName: vItem.product.name,
        productImage: vItem.product.image,
        productPrice: vItem.unitPrice,
        productUnit: vItem.product.unit,
        quantity: vItem.quantity,
        itemTotal: vItem.itemTotal,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
}
        

        // 4. Delivery batching if not self-delivery
        if (!isSelfDelivery) {
       //   const assignedDeliveryBoyId = await assignDeliveryBoy(tx, masterOrder.id, finalDeliveryLat, finalDeliveryLng);

          const [deliveryBatch] = await tx.insert(deliveryBatches).values({
            masterOrderId: masterOrder.id,
            deliveryBoyId: null,
            customerDeliveryAddressId: finalDeliveryAddressId,
            status: deliveryStatusEnum.enumValues?.[0] ?? 'pending',
            estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000), // dummy: 1 hour
            deliveryOtp: null,//Math.floor(1000 + Math.random() * 9000).toString(),
            deliveryOtpSentAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning({ id: deliveryBatches.id });

          await tx.update(subOrders)
            .set({
              deliveryBatchId: deliveryBatch.id,
            })
            .where(eq(subOrders.id, subOrder.id));
        }

        // Emit events
        getIO().emit("new-order", {
          orderId: masterOrder.id,
          orderNumber: masterOrder.orderNumber,
          customerId: masterOrder.customerId,
          total: masterOrder.total,
          status: masterOrder.status,
          createdAt: masterOrder.createdAt,
        });
        getIO().emit(`user:${userId}`, { type: 'order-placed', order: masterOrder, subOrder: subOrder });

        return res.status(201).json({
          message: "Order placed successfully!",
          orderId: masterOrder.id,
          orderNumber: masterOrder.orderNumber,
          data: masterOrder,
        });

      } catch (error: any) {
        console.error("❌ Error placing buy now order (transaction rolled back):", error);
        const errMsg = error?.message || "Failed to place order.";
        if (errMsg && (errMsg.includes("Invalid") || errMsg.includes("required") || errMsg.includes("does not match"))) {
          return res.status(400).json({ message: errMsg });
        }
        return res.status(500).json({ message: errMsg });
      }
    }); // end transaction

  } catch (err: any) {
    console.error("❌ Unexpected error in placeOrderBuyNow:", err);
    return res.status(500).json({ message: err?.message || "Internal server error." });
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

    // --- इनपुट वैलिडेशन ---
    if (!deliveryAddressId && !newDeliveryAddress) {
      return res.status(400).json({ message: "Delivery address is required. Provide deliveryAddressId or newDeliveryAddress." });
    }
    if (!paymentMethod) {
      return res.status(400).json({ message: "Invalid or missing payment method." });
    }
    
    // Coerce numeric fields safely
    const subtotal = typeof frontendSubtotal === "number" ? frontendSubtotal : parseFloat(frontendSubtotal);
    const total = typeof frontendTotal === "number" ? frontendTotal : parseFloat(frontendTotal);
    const deliveryCharge = typeof frontendDeliveryCharge === "number" ? frontendDeliveryCharge : parseFloat(frontendDeliveryCharge);

    if (Number.isNaN(subtotal) || Number.isNaN(total) || Number.isNaN(deliveryCharge)) {
      return res.status(400).json({ message: "subtotal, total, and deliveryCharge must be valid numbers." });
    }

    let transactionResult: { masterOrder: any, tempSubOrders: any[] };
const userPhoneNumberForUpdate = newDeliveryAddress?.phoneNumber;
    
    // Server-side transaction
    const result = await db.transaction(async (tx) => {
        // Handle delivery address
        const {
            id: finalDeliveryAddressId,
            lat: finalDeliveryLat,
            lng: finalDeliveryLng,
            fullAddress: finalDeliveryAddressJson,
            city: finalCity,
            state: finalState,
            pincode: finalPincode,
        } = await handleDeliveryAddress(tx, userId, deliveryAddressId, newDeliveryAddress, req.user);
  if (userPhoneNumberForUpdate && typeof userPhoneNumberForUpdate === 'string' && userPhoneNumberForUpdate.length >= 10) {
            // हम यहाँ users टेबल को tx के माध्यम से अपडेट कर रहे हैं
            await tx.update(users)
                .set({
                    phone: userPhoneNumberForUpdate,
                    updatedAt: new Date(),
                })
                .where(
                    // 1. उपयोगकर्ता आईडी से मिलान करें
                    eq(users.id, userId), 
                    // 2. OPTIONAL: केवल तभी अपडेट करें जब फ़ोन नंबर अभी खाली हो
                    // or(isNull(users.phone), eq(users.phone, '')) 
                    // सुरक्षा के लिए, हम सीधे अपडेट कर सकते हैं।
                );
            console.log(`User ${userId} phone number updated to ${userPhoneNumberForUpdate} during order placement.`);
  }
        // --- Fetch and Validate Cart Items ---
        const userCartItems = await tx.query.cartItems.findMany({
          where: eq(cartItems.userId, userId),
          with: {
            product: {
              columns: {
                id: true, name: true, price: true, sellerId: true, approvalStatus: true,
                minOrderQty: true, maxOrderQty: true, image: true, unit: true,
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

        // --- ग्रुपिंग और प्रारंभिक वैलिडेशन ---
        const groupedBySeller = new Map<number, (typeof cartItems.$inferSelect & { product: typeof products.$inferSelect })[]>();

        for (const cartItem of userCartItems) {
            const product = cartItem.product;
            if (!product || product.approvalStatus !== 'approved') {
              console.warn(`[order_from_cart] Product ${cartItem.productId} not found or not approved, skipping.`);
              continue;
            }
            if (product.minOrderQty && cartItem.quantity < product.minOrderQty) {
              throw new Error(`Minimum order quantity for ${product.name} is ${product.minOrderQty}.`);
            }
            if (product.maxOrderQty && cartItem.quantity > product.maxOrderQty) {
              throw new Error(`Maximum order quantity for ${product.name} is ${product.maxOrderQty}.`);
            }

            if (!groupedBySeller.has(cartItem.sellerId)) {
                groupedBySeller.set(cartItem.sellerId, []);
            }
            groupedBySeller.get(cartItem.sellerId)?.push({ ...cartItem, product: cartItem.product });
            
            // 🛑 FIX: सुनिश्चित करें कि totalPrice संख्या के रूप में जोड़ा जाए
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
            items: typeof cartItems.$inferSelect & { product: typeof products.$inferSelect }[]; 
            storeLat: number; 
            storeLng: number;
            estimatedTime: number; 
        }[] = [];

        for (const [sellerId, items] of groupedBySeller.entries()) {
            const store = sellerStoreMap.get(sellerId);
            const seller = items[0].seller;

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
                items: items,
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

        // 1. मास्टर ऑर्डर बनाएं
        const [masterOrder] = await tx.insert(orders).values({
            orderNumber: `ORD-${Date.now()}-${userId}`,
            customerId: userId,
            deliveryAddressId: finalDeliveryAddressId,
            deliveryAddress: JSON.stringify(finalDeliveryAddressJson),
            deliveryCity: finalCity,
            deliveryState: finalState,
            deliveryPincode: finalPincode,
            deliveryLat: finalDeliveryLat,
            deliveryLng: finalDeliveryLng,
            
            subtotal: masterOrderCalculatedSubtotal, 
            total: masterOrderCalculatedTotal,
            
            paymentMethod: paymentMethod.toUpperCase(),
            paymentStatus: paymentMethod.toUpperCase() === 'COD' ? 'pending' : 'pending',
            status: masterOrderStatusEnum.enumValues?.[0] ?? 'pending',
            deliveryInstructions: deliveryInstructions || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning({ id: orders.id, orderNumber: orders.orderNumber });

        if (!masterOrder) throw new Error('Failed to create master order.');

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
            const distA = calculateDistance(finalDeliveryLat, finalDeliveryLng, a.storeLat, a.storeLng);
            const distB = calculateDistance(finalDeliveryLat, finalDeliveryLng, b.storeLat, b.storeLng);
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

            // 3. Order Items बनाएं (Self-Delivery)
            for (const item of subOrderData.items) {
                await tx.insert(orderItems).values({
                    subOrderId: subOrder.id,
                    orderId: masterOrder.id, 
                    sellerId: subOrderData.sellerId,
                    userId: userId,
                    productId: item.product.id,
                    productName: item.product.name,
                    productImage: item.product.image,
                    productPrice: item.priceAtAdded,
                    productUnit: item.product.unit,
                    quantity: item.quantity,
                    itemTotal: item.totalPrice,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }
        }

        // 3. डिलीवरी बैच बनाएं और सब-ऑर्डर अपडेट करें (for Non-Self-Delivery)
        for (const batch of batchesToCreate) {
          //  const assignedDeliveryBoyId = await assignDeliveryBoy(tx, masterOrder.id, finalDeliveryLat, finalDeliveryLng);

            // a) डिलीवरी बैच बनाएं
            const [deliveryBatch] = await tx.insert(deliveryBatches).values({
                masterOrderId: masterOrder.id,
                deliveryBoyId:null,// assignedDeliveryBoyId,
                customerDeliveryAddressId: finalDeliveryAddressId,
                status: deliveryStatusEnum.enumValues?.[0] ?? 'pending',
                estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000),
                deliveryOtp:null,// Math.floor(1000 + Math.random() * 9000).toString(),
              deliveryOtpSentAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }).returning({ id: deliveryBatches.id });

            if (!deliveryBatch) throw new Error('Failed to create delivery batch.');

            // b) संबंधित सब-ऑर्डर को बैच ID के साथ अपडेट करें
            const subOrderIdsToUpdate = (batch.subOrdersData || []).map(s => s.subOrderId);
            if (subOrderIdsToUpdate.length > 0) {
                await tx.update(subOrders)
                    .set({
                        deliveryBatchId: deliveryBatch.id,
                    })
                    .where(inArray(subOrders.id, subOrderIdsToUpdate));
            }

            // c) Order Items बनाएं (Non-Self-Delivery)
            for (const subOrderData of batch.subOrdersData) {
                for (const item of subOrderData.items) {
                    await tx.insert(orderItems).values({
                        subOrderId: subOrderData.subOrderId,
                        orderId: masterOrder.id, 
                        sellerId: subOrderData.sellerId,
                        userId: userId,
                        productId: item.product.id,
                        productName: item.product.name,
                        productImage: item.product.image,
                        productPrice: item.priceAtAdded,
                        productUnit: item.product.unit,
                        quantity: item.quantity,
                        itemTotal: item.totalPrice,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                }
            }
        }

        // 4. कार्ट को खाली करें
        await tx.delete(cartItems).where(eq(cartItems.userId, userId));
        console.log("✅ Cart items deleted from cartItems table.");
        
        return { masterOrder, tempSubOrders }; 
        
    }); // end transaction
    
    // 🛑 FIX: ट्रांज़ैक्शन के परिणाम को असाइन करें
    transactionResult = result;

    if (!transactionResult || !transactionResult.masterOrder) {
        return res.status(500).json({ message: "Failed to place order due to an unknown transaction error." });
    }
    
    // Socket.io इवेंट को अब यहाँ emit करें
    getIO().emit("new-master-order", {
      masterOrder: transactionResult.masterOrder,
      subOrders: transactionResult.tempSubOrders.map(ts => ({ sellerId: ts.sellerId, subtotal: ts.subtotal, isSelfDelivery: ts.isSelfDelivery })),
    });
    getIO().emit(`user:${userId}`, { type: 'master-order-placed', masterOrder: transactionResult.masterOrder });

    return res.status(201).json({
        message: "Orders placed successfully!",
        masterOrderId: transactionResult.masterOrder.id,
        masterOrderNumber: transactionResult.masterOrder.orderNumber,
        data: transactionResult.masterOrder,
    });


  } catch (err: any) {
    console.error("❌ Unexpected error in placeOrderFromCart:", err);
    // सुनिश्चित करें कि यहां से 500 एरर वापस हो
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
           // यदि कोई भी बैच 'out_for_delivery' है, तो मास्टर स्टेटस 'In Transit' होना चाहिए।
           if (uniqueBatches.some(b => b.status === 'out_for_delivery')) {
                overallDeliveryStatus = 'In Transit';
           } 
           // यदि सभी बैचेस 'delivered' हैं, तो मास्टर स्टेटस 'Delivered'
           else if (uniqueBatches.every(b => b.status === 'delivered')) {
                overallDeliveryStatus = 'Delivered';
           }
           // यदि कोई भी बैच पिकअप हो गया है, लेकिन आउट फॉर डिलीवरी नहीं है, तो 'Picked Up'
           else if (uniqueBatches.some(b => b.status === 'picked_up')) {
                overallDeliveryStatus = 'Picked Up';
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
export const getOrderTrackingDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("📡 [API] Received request to get master order tracking details.");
  try {
    const customerId = req.user?.id;
    const orderId = Number(req.params.orderId);

    if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order ID." });
    if (!customerId) return res.status(401).json({ message: "Unauthorized: User not logged in." });


    const masterOrder = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, orderId),
        eq(orders.customerId, customerId)
      ),
      with: {
        deliveryAddress: true,
        subOrders: {
            with: {
                seller: {
                    columns: { id: true, businessName: true, latitude: true, longitude: true },
                },
                store: {
                    columns: { id: true, storeName: true, address: true, latitude: true, longitude: true },
                },
                deliveryBatch: {
                    with: {
                        deliveryBoy: {
                            columns: { id: true, name: true, phone: true, currentLat: true, currentLng: true },
                        },
                    },
                },
            },
        },
        orderTracking: { 
            orderBy: [desc(orderTracking.createdAt)],
            limit: 5, 
        },
      },
    });

    if (!masterOrder) {
      return res.status(404).json({ message: "Master order not found or access denied." });
    }
    
    // JSON पार्सिंग
    let parsedDeliveryAddress: any = {};
    try {
      // Drizzle/Postgres में JSONB फील्ड को parse करना पड़ सकता है
      parsedDeliveryAddress = typeof masterOrder.deliveryAddress === 'string' 
                              ? JSON.parse(masterOrder.deliveryAddress) 
                              : masterOrder.deliveryAddress; // यदि यह पहले से ही ऑब्जेक्ट है
    } catch (e) {
      console.warn(`Failed to parse deliveryAddress JSON for master order ${masterOrder.id}:`, e);
    }

    // 🟢 FIX: डिलीवरी जानकारी को बैच ID द्वारा समूहित करें
    const batchesMap = new Map();
    (masterOrder.subOrders || []).forEach(subOrder => {
        const batchId = subOrder.deliveryBatch?.id || 0; 
        const batchKey = batchId === 0 ? 'unassigned' : batchId;
        
        if (!batchesMap.has(batchKey)) {
            batchesMap.set(batchKey, {
                batchId: batchId,
                // असाइन न किए गए बैच के लिए, सब-ऑर्डर का स्टेटस या मास्टर ऑर्डर का स्टेटस दिखाएँ
                batchStatus: subOrder.deliveryBatch?.status || subOrder.status || masterOrder.status, 
                deliveryBoy: subOrder.deliveryBatch?.deliveryBoy ? {
                    id: subOrder.deliveryBatch.deliveryBoy.id,
                    name: subOrder.deliveryBatch.deliveryBoy.name,
                    phone: subOrder.deliveryBatch.deliveryBoy.phone,
                    currentLocation: { 
                      lat: subOrder.deliveryBatch.deliveryBoy.currentLat, 
                      lng: subOrder.deliveryBatch.deliveryBoy.currentLng 
                    },
                } : null,
                subOrders: [],
                storeLocations: new Set(),
            });
        }
        
        const batchData = batchesMap.get(batchKey);
        
        // सब-ऑर्डर को बैच के अंदर जोड़ें
        batchData.subOrders.push({
            subOrderId: subOrder.id,
            sellerId: subOrder.sellerId,
            sellerName: subOrder.seller?.businessName,
            subOrderStatus: subOrder.status, 
            isSelfDelivery: subOrder.isSelfDeliveryBySeller,
        });

        // स्टोर लोकेशन जोड़ें (ट्रैकिंग मैप के लिए)
        if (subOrder.store?.latitude && subOrder.store?.longitude) {
            batchData.storeLocations.add(JSON.stringify({ 
                lat: subOrder.store.latitude, 
                lng: subOrder.store.longitude, 
                name: subOrder.store.storeName 
            }));
        }
    });

    // 🟢 FIX: रिस्पॉन्स भेजना
    res.status(200).json({
      masterOrderId: masterOrder.id,
      masterOrderNumber: masterOrder.orderNumber,
      status: masterOrder.status, 
      paymentMethod: masterOrder.paymentMethod || 'N/A', 
      paymentStatus: masterOrder.paymentStatus || 'pending', 
      total: masterOrder.total || '0.00',
      estimatedDeliveryTime: masterOrder.estimatedDeliveryTime || new Date().toISOString(),
      createdAt: masterOrder.createdAt || new Date().toISOString(),
  
      
      customerDeliveryAddress: {
        lat: masterOrder.deliveryLat || 0,
        lng: masterOrder.deliveryLng || 0,
        address: parsedDeliveryAddress.addressLine1 || '', 
        city: parsedDeliveryAddress.city || '',
        pincode: parsedDeliveryAddress.pincode || '',
        fullName: parsedDeliveryAddress.fullName || '',
        phoneNumber: parsedDeliveryAddress.phoneNumber || '',
      },
      // बैच समरी
      deliveryBatchesSummary: Array.from(batchesMap.values()).map((batch: any) => ({
          ...batch,
          storeLocations: Array.from(batch.storeLocations).map(JSON.parse), 
      })),
      masterOrderTrackingHistory: masterOrder.orderTracking,
    });

  } catch (error) {
    console.error("❌ Error fetching master order tracking details:", error);
    res.status(500).json({ message: "Failed to fetch tracking details." });
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
                orderTracking: {
                    orderBy: [desc(orderTracking.createdAt)],
                }
            },
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
            const deliveryBoy = subOrder.deliveryBatch?.deliveryBoy || null;
            const deliveryStatus = subOrder.deliveryBatch?.status || (subOrder.isSelfDeliveryBySeller ? 'delivered_by_seller' : subOrder.status);
            
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


export const getOrderDetail = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🔍 [API] Fetching order details via Standard Joins...");
  try {
    const customerId = req.user?.id;
    const orderId = Number(req.params.orderId);

    if (!customerId) return res.status(401).json({ message: "Unauthorized." });
    if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order ID." });

    // 1. सबसे पहले Master Order और उसकी Basic Details लें
    const masterOrder = await db.select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
      .limit(1);

    if (masterOrder.length === 0) {
      return res.status(404).json({ message: "Master order not found." });
    }

    // 2. Tracking Details लें
    const tracking = await db.select()
      .from(orderTracking)
      .where(eq(orderTracking.masterOrderId, orderId))
      .orderBy(desc(orderTracking.createdAt));

    // 3. Sub-Orders, Sellers, Stores और Delivery Info एक साथ लें
    const subOrdersData = await db.select({
      subOrder: subOrders,
      seller: {
        id: sellersPgTable.id,
        businessName: sellersPgTable.businessName,
        businessPhone: sellersPgTable.businessPhone,
      },
      store: {
        id: stores.id,
        storeName: stores.storeName,
      },
      deliveryBoy: {
        id: deliveryBoys.id,
        name: deliveryBoys.name,
        phone: deliveryBoys.phone,
      },
      batchStatus: deliveryBatches.status
    })
    .from(subOrders)
    .leftJoin(sellersPgTable, eq(subOrders.sellerId, sellersPgTable.id))
    .leftJoin(stores, eq(subOrders.storeId, stores.id))
    .leftJoin(deliveryBatches, eq(subOrders.deliveryBatchId, deliveryBatches.id))
    .leftJoin(deliveryBoys, eq(deliveryBatches.deliveryBoyId, deliveryBoys.id))
    .where(eq(subOrders.masterOrderId, orderId));

    // 4. हर Sub-Order के लिए Items निकालें
    const detailedSubOrders = await Promise.all(subOrdersData.map(async (item) => {
      const items = await db.select({
        id: orderItems.id,
        quantity: orderItems.quantity,
        price: orderItems.unitPrice,
        product: {
          id: products.id,
          name: products.name,
          image: products.image,
          unit: products.unit,
        }
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.subOrderId, item.subOrder.id));

      return {
        ...item.subOrder,
        seller: item.seller,
        store: item.store,
        orderItems: items,
        deliveryBoy: item.deliveryBoy,
        deliveryStatus: item.batchStatus || item.subOrder.status
      };
    }));

    // JSON Parse Address
    let parsedAddress = {};
    try {
      parsedAddress = typeof masterOrder[0].deliveryAddress === 'string' 
        ? JSON.parse(masterOrder[0].deliveryAddress) 
        : masterOrder[0].deliveryAddress;
    } catch (e) {
      parsedAddress = masterOrder[0].deliveryAddress;
    }

    console.log(`✅ [API] Successfully fetched master order ${orderId}.`);
    
    res.status(200).json({
      ...masterOrder[0],
      deliveryAddress: parsedAddress,
      tracking: tracking,
      subOrders: detailedSubOrders,
    });

  } catch (error) {
    console.error("❌ Error fetching order details:", error);
    res.status(500).json({ message: "Internal Server Error while fetching order details." });
  }
};

