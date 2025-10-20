// backend/server/controllers/orderController.ts
import { Router, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import {
  deliveryAddresses,
  orders,
  orderItems,
  cartItems,
  products,
  orderStatusEnum,
  approvalStatusEnum,
  sellersPgTable, // ✅ sellersPgTable इम्पोर्ट करें
  deliveryStatusEnum, // ✅ deliveryStatusEnum इम्पोर्ट करें
  // paymentMethodEnum, // ✅ यदि paymentMethodEnum का उपयोग कर रहे हो तो इम्पोर्ट करें
} from "../../shared/backend/schema";
import { eq, desc, and } from "drizzle-orm";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getIO } from "../socket";

/**
 * Helper function to validate delivery address or create a new one.
 * @returns {Promise<{ id: number, lat: number, lng: number }>}
 */
async function handleDeliveryAddress(
  tx: any, // Drizzle Transaction
  userId: number,
  deliveryAddressId?: number,
  newDeliveryAddress?: any,
  reqUser?: any // req.user से डेटा के लिए
): Promise<{ id: number; lat: number; lng: number; fullAddress: string }> {
  let finalDeliveryAddressId: number;
  let finalDeliveryLat: number;
  let finalDeliveryLng: number;
  let finalFullAddress: string;

  if (newDeliveryAddress) {
    const safeAddress = newDeliveryAddress || {};
    const [insertedAddress] = await tx.insert(deliveryAddresses).values({
      userId,
      fullName: safeAddress.fullName || reqUser?.name || "Unknown Customer",
      phoneNumber: safeAddress.phone || reqUser?.phone || "0000000000",
      addressLine1: safeAddress.address || safeAddress.addressLine1 || "N/A",
      addressLine2: safeAddress.landmark || safeAddress.addressLine2 || "",
      city: safeAddress.city || "Unknown",
      postalCode: safeAddress.pincode || safeAddress.postalCode || "000000",
      state: safeAddress.state || "Rajasthan",
      latitude: safeAddress.latitude || 0,
      longitude: safeAddress.longitude || 0,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    if (!insertedAddress) throw new Error('Failed to create new delivery address.');

    finalDeliveryAddressId = insertedAddress.id;
    finalDeliveryLat = insertedAddress.latitude;
    finalDeliveryLng = insertedAddress.longitude;
    finalFullAddress = JSON.stringify({
      address: insertedAddress.addressLine1,
      city: insertedAddress.city,
      pincode: insertedAddress.postalCode,
      latitude: insertedAddress.latitude,
      longitude: insertedAddress.longitude,
    });
  } else if (deliveryAddressId) {
    const [existingAddress] = await tx.select()
      .from(deliveryAddresses)
      .where(and(eq(deliveryAddresses.id, deliveryAddressId), eq(deliveryAddresses.userId, userId)));

    if (!existingAddress) {
      throw new Error('Provided delivery address not found or does not belong to user.');
    }
    finalDeliveryAddressId = existingAddress.id;
    finalDeliveryLat = existingAddress.latitude;
    finalDeliveryLng = existingAddress.longitude;
    finalFullAddress = JSON.stringify({
      address: existingAddress.addressLine1,
      city: existingAddress.city,
      pincode: existingAddress.postalCode,
      latitude: existingAddress.latitude,
      longitude: existingAddress.longitude,
    });
  } else {
    throw new Error('No valid delivery address provided.');
  }

  return { id: finalDeliveryAddressId, lat: finalDeliveryLat, lng: finalDeliveryLng, fullAddress: finalFullAddress };
}

/**
 * Handles placing a direct "buy now" order.
 */
export const placeOrderBuyNow = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🚀 [API] Received request to place Buy Now order.");
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: User not logged in." });
  }

  const {
    deliveryAddressId,
    newDeliveryAddress,
    paymentMethod,
    deliveryInstructions,
    items, // { productId, quantity, priceAtAdded (या unitPrice), sellerId }
    subtotal,
    total,
    deliveryCharge,
    sellerId, // Buy Now के लिए एक ही sellerId अपेक्षित है
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: "Items list is empty, cannot place an order." });
  }
  if (!deliveryAddressId && !newDeliveryAddress) {
    return res.status(400).json({ message: "Delivery address is required. Provide deliveryAddressId or newDeliveryAddress." });
  }
  // paymentMethod validation (paymentMethodEnum का उपयोग करें यदि स्कीमा में है)
  if (!paymentMethod) { // || !paymentMethodEnum.enumValues.includes(paymentMethod)
    return res.status(400).json({ message: "Invalid or missing payment method." });
  }
  if (typeof subtotal !== 'number' || typeof total !== 'number' || typeof deliveryCharge !== 'number') {
    return res.status(400).json({ message: "Subtotal, total, and deliveryCharge must be numbers." });
  }
  if (!sellerId) {
      return res.status(400).json({ message: "Seller ID is required for 'Buy Now' order." });
  }

  const orderNumber = `ORD-${uuidv4()}`;

  await db.transaction(async (tx) => {
    try {
      const { id: finalDeliveryAddressId, lat: finalDeliveryLat, lng: finalDeliveryLng, fullAddress: finalDeliveryAddressJson } =
        await handleDeliveryAddress(tx, userId, deliveryAddressId, newDeliveryAddress, req.user);

      const orderItemsToInsert: typeof orderItems.$inferInsert[] = [];
      let calculatedSubtotal = 0; // सर्वर-साइड गणना

      for (const item of items) {
        // प्रोडक्ट डिटेल्स फेच करें (कम से कम पुष्टि करने के लिए कि प्रोडक्ट मौजूद है)
        const [product] = await tx.select().from(products).where(eq(products.id, item.productId));

        if (!product || product.approvalStatus !== approvalStatusEnum.enumValues[1]) {
          throw new Error(`Product ${item.productId} is not available or not approved.`);
        }
        // ✅ स्टॉक चेकिंग हटा दी गई है, लेकिन min/max ऑर्डर क्वांटिटी अभी भी उपयोगी हो सकती है
        if (product.minOrderQty && item.quantity < product.minOrderQty) {
          throw new Error(`Minimum order quantity for ${product.name} is ${product.minOrderQty}.`);
        }
        if (product.maxOrderQty && item.quantity > product.maxOrderQty) {
          throw new Error(`Maximum order quantity for ${product.name} is ${product.maxOrderQty}.`);
        }

        const unitPrice = item.priceAtAdded ?? item.unitPrice ?? product.price; // प्राथमिकता: priceAtAdded, फिर unitPrice, फिर product.price
        const itemTotalPrice = unitPrice * item.quantity;
        calculatedSubtotal += itemTotalPrice;
        
        orderItemsToInsert.push({
          productId: item.productId,
          sellerId: product.sellerId, // ✅ प्रोडक्ट से सेलर ID लें
          quantity: item.quantity,
          unitPrice: unitPrice,
          totalPrice: itemTotalPrice,
          orderId: undefined, // ट्रांजेक्शन के बाद सेट होगा
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // ✅ फ्रंटएंड से प्राप्त सबटोटल की सर्वर-साइड गणना से तुलना करें (अतिरिक्त सुरक्षा)
      if (Math.abs(calculatedSubtotal - subtotal) > 0.01) { // फ्लोटिंग पॉइंट तुलना के लिए मार्जिन
        throw new Error('Calculated subtotal does not match provided subtotal. Possible price discrepancy.');
      }
      // total और deliveryCharge की भी तुलना की जा सकती है यदि सर्वर-साइड लॉजिक मौजूद हो

      // ✅ नया ऑर्डर बनाएं
      const [orderResult] = await tx.insert(orders).values({
        customerId: userId,
        sellerId: sellerId, // Buy Now के लिए, यह एक ही सेलर होगा
        status: orderStatusEnum.enumValues[0], // 'pending'
        deliveryStatus: deliveryStatusEnum.enumValues[0], // 'pending'
        orderNumber,
        subtotal: subtotal,
        total: total,
        deliveryCharge: deliveryCharge,
        paymentMethod: paymentMethod,
        deliveryAddressId: finalDeliveryAddressId,
        deliveryInstructions: deliveryInstructions || null,
        deliveryLat: finalDeliveryLat,
        deliveryLng: finalDeliveryLng,
        deliveryAddress: finalDeliveryAddressJson, // ✅ JSON string को स्टोर करें
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      if (!orderResult) {
        throw new Error('Failed to create order.');
      }

      // ✅ ऑर्डर आइटम्स को ऑर्डर के साथ जोड़ें
      const finalOrderItems = orderItemsToInsert.map(oi => ({ ...oi, orderId: orderResult.id }));
      await tx.insert(orderItems).values(finalOrderItems);

      // ✅ स्टॉक को अपडेट करने की आवश्यकता नहीं है यदि बिजनेस मॉडल इसे अनुमति देता है।
      // यदि तुम इसे रखना चाहते हो, तो इसे यहां जोड़ा जा सकता है।

      getIO().emit("new-order", {
        orderId: orderResult.id,
        orderNumber: orderResult.orderNumber,
        customerId: orderResult.customerId,
        total: orderResult.total,
        status: orderResult.status,
        createdAt: orderResult.createdAt,
        items: finalOrderItems,
      });
      getIO().emit(`user:${userId}`, { type: 'order-placed', order: orderResult, items: finalOrderItems });

      return res.status(201).json({
        message: "Order placed successfully!",
        orderId: orderResult.id,
        orderNumber: orderResult.orderNumber,
        data: orderResult,
      });

    } catch (error: any) {
      console.error("❌ Error placing Buy Now order (transaction rolled back):", error);
      // next(error); // केंद्रीकृत त्रुटि हैंडलिंग के लिए
      return res.status(500).json({ message: error.message || "Failed to place order." });
    }
  });
};

/**
 * Handles placing an order from the user's cart.
 */
export const placeOrderFromCart = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🚀 [API] Received request to place order from cart.");
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: User not logged in." });
  }

  const {
    deliveryAddressId,
    newDeliveryAddress,
    paymentMethod,
    deliveryInstructions,
    subtotal,
    total,
    deliveryCharge,
  } = req.body;

  if (!deliveryAddressId && !newDeliveryAddress) {
    return res.status(400).json({ message: "Delivery address is required. Provide deliveryAddressId or newDeliveryAddress." });
  }
  // paymentMethod validation
  if (!paymentMethod) { // || !paymentMethodEnum.enumValues.includes(paymentMethod)
    return res.status(400).json({ message: "Invalid or missing payment method." });
  }
  if (typeof subtotal !== 'number' || typeof total !== 'number' || typeof deliveryCharge !== 'number') {
    return res.status(400).json({ message: "Subtotal, total, and deliveryCharge must be numbers." });
  }

  const orderNumber = `ORD-${uuidv4()}`;

  await db.transaction(async (tx) => {
    try {
      const { id: finalDeliveryAddressId, lat: finalDeliveryLat, lng: finalDeliveryLng, fullAddress: finalDeliveryAddressJson } =
        await handleDeliveryAddress(tx, userId, deliveryAddressId, newDeliveryAddress, req.user);

      // ✅ ग्राहक की कार्ट आइटम्स को fetch करें
      const userCartItems = await tx.query.cartItems.findMany({
        where: eq(cartItems.userId, userId),
        with: {
          product: {
            columns: {
              id: true,
              name: true,
              price: true,
              // stock: true, // ✅ स्टॉक चेकिंग हटा दी गई है तो इसकी आवश्यकता नहीं
              sellerId: true,
              approvalStatus: true,
              minOrderQty: true,
              maxOrderQty: true,
            }
          }
        }
      });

      if (userCartItems.length === 0) {
        throw new Error('Your cart is empty. Please add items before placing an order.');
      }

      // ✅ ऑर्डर आइटम्स बनाएं
      const orderItemsToInsert: typeof orderItems.$inferInsert[] = [];
      let calculatedSubtotal = 0; // सर्वर-साइड गणना

      // प्रत्येक सेलर के लिए एक अलग ऑर्डर बनाने के लिए मैपिंग
      const ordersPerSeller = new Map<number, { items: typeof orderItems.$inferInsert[], subtotal: number }>();

      for (const cartItem of userCartItems) {
        const product = cartItem.product;

        if (!product || product.approvalStatus !== approvalStatusEnum.enumValues[1]) {
          console.warn(`[ORDER_FROM_CART] Product ${cartItem.productId} not found or not approved, skipping.`);
          continue; // ✅ अमान्य/अस्वीकृत प्रोडक्ट को छोड़ दें
        }
        // ✅ स्टॉक चेकिंग हटा दी गई है
        if (product.minOrderQty && cartItem.quantity < product.minOrderQty) {
          throw new Error(`Minimum order quantity for ${product.name} is ${product.minOrderQty}.`);
        }
        if (product.maxOrderQty && cartItem.quantity > product.maxOrderQty) {
          throw new Error(`Maximum order quantity for ${product.name} is ${product.maxOrderQty}.`);
        }

        const itemPrice = cartItem.priceAtAdded;
        const itemTotal = itemPrice * cartItem.quantity;
        calculatedSubtotal += itemTotal;

        const orderItemData: typeof orderItems.$inferInsert = {
          productId: product.id,
          sellerId: product.sellerId,
          quantity: cartItem.quantity,
          unitPrice: itemPrice,
          totalPrice: itemTotal,
          createdAt: new Date(),
          updatedAt: new Date(),
          orderId: undefined, // बाद में सेट होगा
        };

        if (!ordersPerSeller.has(product.sellerId)) {
            ordersPerSeller.set(product.sellerId, { items: [], subtotal: 0 });
        }
        const sellerOrder = ordersPerSeller.get(product.sellerId)!;
        sellerOrder.items.push(orderItemData);
        sellerOrder.subtotal += itemTotal;
      }

      // ✅ फ्रंटएंड से प्राप्त सबटोटल की सर्वर-साइड गणना से तुलना करें (अतिरिक्त सुरक्षा)
      if (Math.abs(calculatedSubtotal - subtotal) > 0.01) {
        throw new Error('Calculated subtotal does not match provided subtotal. Possible price discrepancy.');
      }

      const createdOrders = [];

      for (const [sellerId, sellerOrderData] of ordersPerSeller.entries()) {
          // ✅ प्रत्येक सेलर के लिए एक नया ऑर्डर बनाएं
          const [orderResult] = await tx.insert(orders).values({
              customerId: userId,
              sellerId: sellerId, // ✅ प्रत्येक सेलर के लिए एक विशिष्ट ऑर्डर
              status: orderStatusEnum.enumValues[0],
              deliveryStatus: deliveryStatusEnum.enumValues[0],
              orderNumber: `ORD-${uuidv4()}`, // ✅ प्रत्येक ऑर्डर का अपना unique orderNumber
              subtotal: sellerOrderData.subtotal, // ✅ प्रत्येक सेलर ऑर्डर का सबटोटल
              total: sellerOrderData.subtotal + deliveryCharge / ordersPerSeller.size, // ✅ डिलीवरी चार्ज को वितरित करें (सरल उदाहरण)
              deliveryCharge: deliveryCharge / ordersPerSeller.size, // ✅ प्रत्येक सेलर ऑर्डर का डिलीवरी चार्ज
              paymentMethod: paymentMethod,
              deliveryAddressId: finalDeliveryAddressId,
              deliveryInstructions: deliveryInstructions || null,
              deliveryLat: finalDeliveryLat,
              deliveryLng: finalDeliveryLng,
              deliveryAddress: finalDeliveryAddressJson,
              createdAt: new Date(),
              updatedAt: new Date(),
          }).returning();

          if (!orderResult) {
              throw new Error(`Failed to create order for seller ${sellerId}.`);
          }

          // ✅ ऑर्डर आइटम्स को इस विशिष्ट ऑर्डर से जोड़ें
          const finalSellerOrderItems = sellerOrderData.items.map(oi => ({ ...oi, orderId: orderResult.id }));
          await tx.insert(orderItems).values(finalSellerOrderItems);
          createdOrders.push(orderResult);

          // ✅ Socket.IO इवेंट (प्रत्येक ऑर्डर के लिए)
          getIO().emit("new-order", {
              orderId: orderResult.id,
              orderNumber: orderResult.orderNumber,
              customerId: orderResult.customerId,
              total: orderResult.total,
              status: orderResult.status,
              createdAt: orderResult.createdAt,
              items: finalSellerOrderItems,
              sellerId: sellerId,
          });
          getIO().emit(`user:${userId}`, { type: 'order-placed', order: orderResult, items: finalSellerOrderItems, sellerId: sellerId });
      }

      // ✅ ग्राहक की कार्ट खाली करें
      await tx.delete(cartItems).where(eq(cartItems.userId, userId));
      console.log("✅ Cart items deleted from cartItems table.");

      return res.status(201).json({
        message: "Orders placed successfully!",
        orders: createdOrders.map(o => ({ id: o.id, orderNumber: o.orderNumber, total: o.total })),
      });
    } catch (error: any) {
      console.error("❌ Error placing cart order (transaction rolled back):", error);
      // next(error);
      return res.status(500).json({ message: error.message || "Failed to place order." });
    }
  });
};

/**
 * Fetches all orders for the authenticated user.
 */
export const getUserOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🔄 [API] Received request to get user orders.");
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User not logged in." });
    }

    const userOrders = await db.query.orders.findMany({
      where: eq(orders.customerId, userId),
      with: {
        items: {
          with: {
            product: {
              columns: {
                id: true,
                name: true,
                image: true,
                unit: true,
              }
            },
            seller: {
              columns: {
                id: true,
                businessName: true,
              }
            }
          }
        },
        deliveryAddress: true,
        deliveryBoy: { // ✅ डिलीवरी बॉय विवरण जोड़ें
          columns: {
            id: true,
            name: true,
            phoneNumber: true,
          }
        },
        seller: { // ✅ सेलर विवरण जोड़ें (यदि orders टेबल में sellerId है)
          columns: {
            id: true,
            businessName: true,
          }
        }
      },
      orderBy: [desc(orders.createdAt)],
    });

    // ✅ deliveryAddress JSON string को पार्स करें
    const formattedOrders = userOrders.map(order => {
      let parsedDeliveryAddress = {};
      try {
        parsedDeliveryAddress = JSON.parse(order.deliveryAddress as string);
      } catch (e) {
        console.warn(`Failed to parse deliveryAddress JSON for order ${order.id}:`, e);
      }
      return {
        ...order,
        deliveryAddress: parsedDeliveryAddress,
      };
    });

    console.log(`✅ [API] Found ${userOrders.length} orders for user ${userId}.`);
    res.status(200).json(formattedOrders);
  } catch (error) {
    console.error("❌ Error fetching user orders:", error);
    // next(error);
    res.status(500).json({ message: "Failed to fetch orders." });
  }
};

/**
 * Fetches the initial tracking details for a specific order.
 */
export const getOrderTrackingDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("📡 [API] Received request to get order tracking details.");
  try {
    const customerId = req.user?.id;
    const orderId = Number(req.params.orderId);

    if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order ID." });

    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, orderId),
        eq(orders.customerId, customerId)
      ),
      with: {
        deliveryAddress: true,
        deliveryBoy: { // ✅ डिलीवरी बॉय विवरण जोड़ें
          columns: {
            id: true,
            name: true,
            phoneNumber: true,
          }
        },
        seller: { // ✅ सेलर विवरण जोड़ें
            columns: {
                id: true,
                businessName: true,
            }
        }
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found or access denied." });
    }

    let parsedDeliveryAddress = {};
    try {
      parsedDeliveryAddress = JSON.parse(order.deliveryAddress as string);
    } catch (e) {
      console.warn(`Failed to parse deliveryAddress JSON for order ${order.id}:`, e);
    }

    res.status(200).json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      deliveryStatus: order.deliveryStatus, // ✅ डिलीवरी स्टेटस भी दिखाएं
      deliveryAddress: {
        lat: order.deliveryLat || 0,
        lng: order.deliveryLng || 0,
        // JSON से एड्रेस विवरण
        address: (parsedDeliveryAddress as any).address || (order.deliveryAddress as any)?.addressLine1 || '',
        city: (parsedDeliveryAddress as any).city || (order.deliveryAddress as any)?.city || '',
        pincode: (parsedDeliveryAddress as any).pincode || (order.deliveryAddress as any)?.postalCode || '',
        // यदि deliveryAddressId से भी डेटा चाहते हो
        fullName: order.deliveryAddress?.fullName || '',
        phoneNumber: order.deliveryAddress?.phoneNumber || '',
      },
      deliveryBoy: order.deliveryBoy, // ✅ डिलीवरी बॉय ऑब्जेक्ट
      seller: order.seller, // ✅ सेलर ऑब्जेक्ट
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      actualDeliveryTime: order.actualDeliveryTime,
    });

  } catch (error) {
    console.error("❌ Error fetching order tracking details:", error);
    // next(error);
    res.status(500).json({ message: "Failed to fetch tracking details." });
  }
};

/**
 * Fetches details for a specific order ID.
 */
export const getOrderDetail = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  console.log("🔍 [API] Received request to get specific order details.");
  try {
    const customerId = req.user?.id;
    const orderId = Number(req.params.orderId);

    if (!customerId) return res.status(401).json({ message: "Unauthorized." });
    if (isNaN(orderId)) return res.status(400).json({ message: "Invalid order ID." });

    const orderDetail = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, orderId),
        eq(orders.customerId, customerId)
      ),
      with: {
        items: {
          with: {
            product: {
              columns: {
                id: true,
                name: true,
                image: true,
                unit: true,
                price: true,
                description: true, // ✅ विवरण भी जोड़ें
              }
            },
            seller: {
              columns: {
                id: true,
                businessName: true,
              }
            }
          }
        },
        deliveryAddress: true,
        deliveryBoy: { // ✅ डिलीवरी बॉय विवरण जोड़ें
          columns: {
            id: true,
            name: true,
            phoneNumber: true,
          }
        },
        seller: { // ✅ सेलर विवरण जोड़ें
            columns: {
                id: true,
                businessName: true,
            }
        }
      },
    });

    if (!orderDetail) {
      return res.status(404).json({ message: "Order not found or access denied." });
    }

    // ✅ deliveryAddress JSON string को पार्स करें
    let parsedDeliveryAddress = {};
    try {
      parsedDeliveryAddress = JSON.parse(orderDetail.deliveryAddress as string);
    } catch (e) {
      console.warn(`Failed to parse deliveryAddress JSON for order ${orderDetail.id}:`, e);
    }

    console.log(`✅ [API] Found order ${orderId}.`);
    res.status(200).json({
      ...orderDetail,
      deliveryAddress: parsedDeliveryAddress, // ✅ Parsed JSON
    });
  } catch (error) {
    console.error("❌ Error fetching specific order:", error);
    // next(error);
    res.status(500).json({ message: "Failed to fetch order details." });
  }
};
