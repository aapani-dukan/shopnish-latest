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
async function assignDeliveryBoy(tx: any, masterOrderId: number, customerLat: number, customerLng: number): Promise<number | null> {
    // यहाँ आप डेटाबेस से उपलब्ध डिलीवरी बॉय को क्वेरी कर सकते हैं
    // उदाहरण के लिए, 5 किमी के भीतर और उपलब्ध
    const availableDeliveryBoys = await tx.select()
        .from(deliveryBoys)
        .where(eq(deliveryBoys.isAvailable, true));
    
    // सरल बनाने के लिए, बस पहला उपलब्ध डिलीवरी बॉय लौटा दें
    if (availableDeliveryBoys.length > 0) {
        return availableDeliveryBoys[0].id;
    }
    return null;
}

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
          const assignedDeliveryBoyId = await assignDeliveryBoy(tx, masterOrder.id, finalDeliveryLat, finalDeliveryLng);

          const [deliveryBatch] = await tx.insert(deliveryBatches).values({
            masterOrderId: masterOrder.id,
            deliveryBoyId: assignedDeliveryBoyId,
            customerDeliveryAddressId: finalDeliveryAddressId,
            status: deliveryStatusEnum.enumValues?.[0] ?? 'pending',
            estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000), // dummy: 1 hour
            deliveryOtp: Math.floor(1000 + Math.random() * 9000).toString(),
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
                subtotal: subOrderData.subtotal,
                deliveryCharge: subOrderData.deliveryCharge,
                total: subOrderData.total,
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
                subtotal: subOrderData.subtotal,
                deliveryCharge: 0,
                total: subOrderData.subtotal,
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
            const assignedDeliveryBoyId = await assignDeliveryBoy(tx, masterOrder.id, finalDeliveryLat, finalDeliveryLng);

            // a) डिलीवरी बैच बनाएं
            const [deliveryBatch] = await tx.insert(deliveryBatches).values({
                masterOrderId: masterOrder.id,
                deliveryBoyId: assignedDeliveryBoyId,
                customerDeliveryAddressId: finalDeliveryAddressId,
                status: deliveryStatusEnum.enumValues?.[0] ?? 'pending',
                estimatedDeliveryTime: new Date(Date.now() + 60 * 60 * 1000),
                deliveryOtp: Math.floor(1000 + Math.random() * 9000).toString(),
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
 * fetches all orders for the authenticated user.
 * Now fetches Master Orders and populates sub-orders and delivery batch info.
 */
export const getUserOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🔄 [API] Received request to get user orders.");
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User not logged in." });
    }

    const masterOrders = await db.query.orders.findMany({
      where: eq(orders.customerId, userId),
      with: {
        deliveryAddress: true, // ✅ Delivery address directly linked to master order
        subOrders: {
          with: {
            seller: {
              columns: { id: true, businessName: true },
            },
            store: {
              columns: { id: true, storeName: true, address: true, latitude: true, longitude: true },
            },
            orderItems: {
              with: {
                product: {
                  columns: { id: true, name: true, image: true, unit: true },
                },
              },
            },
            deliveryBatch: { // ✅ Sub-order से डिलीवरी बैच को पॉपुलेट करें
              with: {
                deliveryBoy: {
                  columns: { id: true, name: true, phone: true, currentLat: true, currentLng: true },
                },
              },
            },
          },
        },
      },
      orderBy: [desc(orders.createdAt)],
    });

    const formattedOrders = masterOrders.map(masterOrder => {
      


      // प्रत्येक सब-ऑर्डर के लिए डिलीवरी बॉय और डिलीवरी स्टेटस जोड़ें
      const subOrdersWithDeliveryInfo = (masterOrder.subOrders || []).map(subOrder => {
        const deliveryBoy = subOrder.deliveryBatch?.deliveryBoy || null;
        const deliveryStatus = subOrder.deliveryBatch?.status || (subOrder.isSelfDeliveryBySeller ? 'delivered_by_seller' : 'not_assigned'); // ✅ सेल्फ-डिलीवरी के लिए अलग स्टेटस
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
        deliveryAddress: masterOrder.deliveryAddress, 
        subOrders: subOrdersWithDeliveryInfo,
        // masterOrder.deliveryCharge और masterOrder.estimatedDeliveryTime हटा दिया गया है
        // क्योंकि यह अब सब-ऑर्डर और डिलीवरी बैच में है
      };
    });

    console.log(`✅ [API] Found ${masterOrders.length} master orders for user ${userId}.`);
    res.status(200).json(formattedOrders);
  } catch (error) {
    console.error("❌ Error fetching user orders:", error);
    // next(error);
    res.status(500).json({ message: "Failed to fetch orders." });
  }
};

/**
 * fetches the initial tracking details for a specific master order.
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
        orderTracking: { // ✅ master order tracking भी हो सकती है
            orderBy: [desc(orderTracking.createdAt)],
            limit: 5, // नवीनतम कुछ ट्रैकिंग इवेंट
        },
      },
    });

    if (!masterOrder) {
      return res.status(404).json({ message: "Master order not found or access denied." });
    }

    //let parsedDeliveryAddress = {};
   // try {
   //   parsedDeliveryAddress = JSON.parse(masterOrder.deliveryAddress as string);
  //  } catch (e) {
    //  console.warn(`Failed to parse deliveryAddress JSON for master order ${masterOrder.id}:`, e);
   // }

    // डिलीवरी बॉय की स्थिति और अपेक्षित मार्ग दिखाने के लिए सब-ऑर्डर से डेटा एकत्र करें
    const deliveryInfo = (masterOrder.subOrders || []).map(subOrder => {
        const deliveryBoy = subOrder.deliveryBatch?.deliveryBoy;
        const deliveryStatus = subOrder.deliveryBatch?.status || (subOrder.isSelfDeliveryBySeller ? 'delivered_by_seller' : 'not_assigned');
        const storeLocation = { lat: subOrder.store?.latitude, lng: subOrder.store?.longitude };

        return {
            subOrderId: subOrder.id,
            sellerId: subOrder.sellerId,
            sellerName: subOrder.seller?.businessName,
            storeLocation: storeLocation,
            deliveryBoy: deliveryBoy ? {
                id: deliveryBoy.id,
                name: deliveryBoy.name,
                phone: deliveryBoy.phone,
                currentLocation: { lat: deliveryBoy.currentLat, lng: deliveryBoy.currentLng },
            } : null,
            deliveryStatus: deliveryStatus,
            estimatedDeliveryTime: subOrder.deliveryBatch?.estimatedDeliveryTime,
            actualDeliveryTime: subOrder.deliveryBatch?.actualDeliveryTime,
            isSelfDelivery: subOrder.isSelfDeliveryBySeller,
        };
    });

    res.status(200).json({
      masterOrderId: masterOrder.id,
      masterOrderNumber: masterOrder.orderNumber,
      status: masterOrder.status, // Master order status
      customerDeliveryAddress: {
        lat: masterOrder.deliveryLat || 0,
        lng: masterOrder.deliveryLng || 0,
        address:  (masterOrder.deliveryAddress as any).addressLine1 || '', 
        city: (parsedDeliveryAddress as any).city || '',
        pincode: (parsedDeliveryAddress as any).pincode || '',
        fullName: (parsedDeliveryAddress as any).fullName || '',
        phoneNumber: (parsedDeliveryAddress as any).phoneNumber || '',
      },
      deliveryDetails: deliveryInfo, // प्रत्येक सब-ऑर्डर के लिए डिलीवरी जानकारी
      masterOrderTrackingHistory: masterOrder.orderTracking, // मास्टर ऑर्डर के लिए ट्रैकिंग हिस्ट्री
    });

  } catch (error) {
    console.error("❌ Error fetching master order tracking details:", error);
    // next(error);
    res.status(500).json({ message: "Failed to fetch tracking details." });
  }
};
/**
 * ✅ GET /api/orders/:orderId/details
 * ग्राहक के लिए विशिष्ट सब-ऑर्डर विवरण (Seller-specific order details)
 * यह सुनिश्चित करता है कि ग्राहक केवल वह सब-ऑर्डर देखे जो sellerId से संबंधित है।
 */
export const getSubOrderDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const orderId = Number(req.params.orderId);
    const sellerId = Number(req.query.sellerId); // Query parameter से sellerId प्राप्त करें

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized." });
    }
    if (Number.isNaN(orderId) || Number.isNaN(sellerId)) {
        return res.status(400).json({ message: "Invalid Order ID or Seller ID." });
    }

    try {
        // 1. सब-ऑर्डर विवरण फ़ेच करें (Sub-Order details)
        const subOrder = await db.query.subOrders.findFirst({
            where: and(
                eq(subOrders.masterOrderId, orderId),
                eq(subOrders.sellerId, sellerId)
            ),
            with: {
                seller: {
                    columns: { businessName: true }
                }
            }
        });

        if (!subOrder) {
            return res.status(404).json({ message: "Sub-Order not found for this customer or seller." });
        }
        
        // सुरक्षा जाँच (Security Check): सुनिश्चित करें कि यह सब-ऑर्डर इस ग्राहक के मास्टर ऑर्डर से संबंधित है।
        // (इसके लिए आपको masterOrders टेबल में customerId को orderId से जोड़कर जाँच करनी होगी, 
        // जो subOrders table में masterOrderId से जुड़ा है)
        const masterOrder = await db.query.orders.findFirst({
            where: and(
                eq(orders.id, orderId),
                eq(orders.customerId, userId)
            ),
            columns: { deliveryAddress: true, deliveryCity: true }
        });

        if (!masterOrder) {
            return res.status(403).json({ message: "Access forbidden. Order does not belong to user." });
        }

        // 2. सब-ऑर्डर आइटम्स फ़ेच करें (Order Items)
        const orderItemsList = await db.query.orderItems.findMany({
            where: eq(orderItems.subOrderId, subOrder.id),
        });

        // 3. प्रतिक्रिया (Response)
        res.status(200).json({
            subOrderId: subOrder.id,
            masterOrderId: subOrder.masterOrderId,
            orderNumber: subOrder.subOrderNumber,
            sellerName: subOrder.seller?.businessName,
            deliveryStatus: subOrder.status,
            subtotal: subOrder.subtotal,
            deliveryCharge: subOrder.deliveryCharge,
            total: subOrder.total,
            deliveryAddress: JSON.parse(masterOrder.deliveryAddress), // Address को JSON से parse करें
            items: orderItemsList.map(item => ({
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: Number(item.productPrice),
                itemTotal: Number(item.itemTotal),
            })),
            // अन्य आवश्यक डेटा जोड़ें
        });

    } catch (error: any) {
        console.error("❌ Error fetching sub-order details:", error);
        next(error);
    }
};

/**
 * fetches details for a specific master order id.
 */
export const getOrderDetail = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🔍 [API] Received request to get specific master order details.");
  try {
    const customerId = req.user?.id;
    const orderId = Number(req.params.orderId);

    if (!customerId) return res.status(401).json({ message: "Unauthorized." });
    if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order ID." });

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
            store: {
              columns: { id: true, storeName: true, address: true, phone: true },
            },
            orderItems: {
              with: {
                product: {
                  columns: {
                    id: true, name: true, image: true, unit: true, price: true, description: true,
                  },
                },
              },
            },
            deliveryBatch: {
              with: {
                deliveryBoy: {
                  columns: { id: true, name: true, phone: true },
                },
              },
            },
          },
        },
        orderTracking: {
            orderBy: [desc(orderTracking.createdAt)],
        }
      },
    });

    if (!masterOrderDetail) {
      return res.status(404).json({ message: "Master order not found or access denied." });
    }

    let parsedDeliveryAddress = {};
    try {
      parsedDeliveryAddress = JSON.parse(masterOrderDetail.deliveryAddress as string);
    } catch (e) {
      console.warn(`Failed to parse deliveryAddress JSON for master order ${masterOrderDetail.id}:`, e);
    }

    // सब-ऑर्डर और उनके आइटम को एक साथ जोड़ें
    const detailedSubOrders = (masterOrderDetail.subOrders || []).map(subOrder => {
        const deliveryBoy = subOrder.deliveryBatch?.deliveryBoy || null;
        const deliveryStatus = subOrder.deliveryBatch?.status || (subOrder.isSelfDeliveryBySeller ? 'delivered_by_seller' : 'not_assigned');
        
        return {
            ...subOrder,
            deliveryBoy: deliveryBoy,
            deliveryStatus: deliveryStatus,
            // seller और store ऑब्जेक्ट्स पहले से ही subOrder के अंदर popuplated होंगे
        };
    });

    console.log(`✅ [API] Found master order ${orderId}.`);
    res.status(200).json({
      ...masterOrderDetail,
      deliveryAddress: parsedDeliveryAddress,
      subOrders: detailedSubOrders,
    });
  } catch (error) {
    console.error("❌ Error fetching specific master order:", error);
    // next(error);
    res.status(500).json({ message: "Failed to fetch order details." });
  }
};
