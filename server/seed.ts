import { db } from "./db";
import { faker } from "@faker-js/faker";
import {
  users,
  sellersPgTable as sellers,
  categories,
  stores,
  products,
  deliveryBoys,
  orders,
  orderItems,
  cartItems,
  reviews,
  userRoleEnum,
  approvalStatusEnum,
} from "../shared/backend/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from 'uuid';

async function seedDatabase() {
  try {
    console.log("➡️ Starting database seed...");

    // 1️⃣ Clean existing data (order matters due to foreign keys)
    console.log("🗑️ Cleaning existing data...");
    await db.delete(reviews);
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(cartItems);
    await db.delete(products);
    await db.delete(stores);
    await db.delete(sellers);
    await db.delete(deliveryBoys);
    await db.delete(users);
    await db.delete(categories);
    console.log("✅ Existing data cleaned.");


    // 2️⃣ Insert Category
    console.log("➕ Inserting categories...");
    const seedCategories = [
      // ग्रॉसरी और खाने-पीने की चीजें
      {
          name: "Vegetables",
          nameHindi: "सब्जियां",
          slug: "vegetables",
          image: "https://placehold.co/400x300?text=सब्जियां", 
          description: "ताजी और जैविक सब्जियां",
          isActive: true,
          sortOrder: 1,
      },
      {
          name: "Fruits",
          nameHindi: "फल",
          slug: "fruits",
          image: "https://placehold.co/400x300?text=फल", 
          description: "विभिन्न प्रकार के मौसमी फल",
          isActive: true,
          sortOrder: 2,
      },
      {
          name: "Dairy & Eggs",
          nameHindi: "डेयरी और अंडे",
          slug: "dairy-eggs",
          image: "https://placehold.co/400x300?text=डेयरी", 
          description: "दूध, दही, पनीर और अंडे",
          isActive: true,
          sortOrder: 3,
      },
      {
          name: "Snacks",
          nameHindi: "स्नैक्स",
          slug: "snacks",
          image: "https://placehold.co/400x300?text=स्नैक्स",
          description: "मीठे और नमकीन स्नैक्स की वैराइटी",
          isActive: true,
          sortOrder: 4,
      },
      {
          name: "Beverages",
          nameHindi: "पेय पदार्थ",
          slug: "beverages",
          image: "https://placehold.co/400x300?text=पेय",
          description: "चाय, कॉफी, जूस और कोल्ड ड्रिंक्स",
          isActive: true,
          sortOrder: 5,
      },

      // इलेक्ट्रॉनिक्स और गैजेट्स
      {
          name: "Mobile Phones",
          nameHindi: "मोबाइल फ़ोन",
          slug: "mobile-phones",
          image: "https://placehold.co/400x300?text=मोबाइल",
          description: "स्मार्टफोन, बेसिक फोन और एक्सेसरीज़",
          isActive: true,
          sortOrder: 6,
      },
      {
          name: "Laptops & Computers",
          nameHindi: "लैपटॉप और कंप्यूटर",
          slug: "laptops-computers",
          image: "https://placehold.co/400x300?text=कंप्यूटर",
          description: "सभी प्रकार के लैपटॉप, डेस्कटॉप और पेरिफेरल्स",
          isActive: true,
          sortOrder: 7,
      },
      {
          name: "Home Appliances",
          nameHindi: "घरेलू उपकरण",
          slug: "home-appliances",
          image: "https://placehold.co/400x300?text=उपकरण",
          description: "किचन और घर के लिए उपकरण",
          isActive: true,
          sortOrder: 8,
      },

      // फ़ैशन और कपड़े
      {
          name: "Men's Fashion",
          nameHindi: "पुरुषों का फैशन",
          slug: "mens-fashion",
          image: "https://placehold.co/400x300?text=पुरुष",
          description: "पुरुषों के लिए कपड़े, जूते और एक्सेसरीज़",
          isActive: true,
          sortOrder: 9,
      },
      {
          name: "Women's Fashion",
          nameHindi: "महिलाओं का फैशन",
          slug: "womens-fashion",
          image: "https://placehold.co/400x300?text=महिला",
          description: "महिलाओं के लिए एथनिक और वेस्टर्न वियर",
          isActive: true,
          sortOrder: 10,
      },
      {
          name: "Kids' Fashion",
          nameHindi: "बच्चों का फैशन",
          slug: "kids-fashion",
          image: "https://placehold.co/400x300?text=बच्चे",
          description: "बच्चों के कपड़े और जूते",
          isActive: true,
          sortOrder: 11,
      },

      // घर और किचन
      {
          name: "Home Decor",
          nameHindi: "घर की सजावट",
          slug: "home-decor",
          image: "https://placehold.co/400x300?text=सजावट",
          description: "दीवार की सजावट, लाइटिंग और शोपीस",
          isActive: true,
          sortOrder: 12,
      },
      {
          name: "Furniture",
          nameHindi: "फर्नीचर",
          slug: "furniture",
          image: "https://placehold.co/400x300?text=फर्नीचर",
          description: "घर और ऑफिस के लिए फर्नीचर",
          isActive: true,
          sortOrder: 13,
      },
      {
          name: "Cookware",
          nameHindi: "किचन के बर्तन",
          slug: "cookware",
          image: "https://placehold.co/400x300?text=बर्तन",
          description: "खाना बनाने के बर्तन और उपकरण",
          isActive: true,
          sortOrder: 14,
      },

      // सेवाएँ (Services)
      {
          name: "Home Services",
          nameHindi: "घरेलू सेवाएँ",
          slug: "home-services",
          image: "https://placehold.co/400x300?text=सेवाएँ",
          description: "प्लंबिंग, इलेक्ट्रिशियन और रिपेयर सेवाएँ",
          isActive: true,
          sortOrder: 15,
      },
      {
          name: "Professional Services",
          nameHindi: "व्यावसायिक सेवाएँ",
          slug: "professional-services",
          image: "https://placehold.co/400x300?text=प्रोफेशनल",
          description: "ट्यूटरिंग, कानूनी और सलाहकार सेवाएँ",
          isActive: true,
          sortOrder: 16,
      },
      {
          name: "Event Services",
          nameHindi: "इवेंट सेवाएँ",
          slug: "event-services",
          image: "https://placehold.co/400x300?text=इवेंट",
          description: "कैटर्स, डेकोरेटर और इवेंट प्लानर",
          isActive: true,
          sortOrder: 17,
      },

    ];

    // ✅ कैटेगरीज़ को डालें और उनका ID प्राप्त करें
    const insertedCategories = await db.insert(categories).values(seedCategories).returning();
    console.log(`✅ Inserted ${insertedCategories.length} categories.`);
    
    
    // 3️⃣ Insert Users
    console.log("➕ Inserting users...");
    const userInputs = [
      { firebaseUid: faker.string.uuid(), email: "admin@example.com", password: "password123", firstName: "Admin", lastName: "User", phone: "9876543210", role: userRoleEnum.enumValues[2] }, // "admin"
      { firebaseUid: faker.string.uuid(), email: "customer@example.com", password: "password123", firstName: "Customer", lastName: "User", phone: "9876543210", role: userRoleEnum.enumValues[0] }, // "customer"
      { firebaseUid: faker.string.uuid(), email: "seller@example.com", password: "password123", firstName: "Seller", lastName: "User", phone: "9876543210", role: userRoleEnum.enumValues[1] }, // "seller"
      { firebaseUid: faker.string.uuid(), email: "delivery@example.com", password: "password123", firstName: "Delivery", lastName: "User", phone: "9876543210", role: userRoleEnum.enumValues[3] }, // "delivery_boy"
    ];

    const insertedUsers = await db.insert(users).values(userInputs).returning();
    
    const sellerUser = insertedUsers.find(u => u.role === userRoleEnum.enumValues[1]);
    const customerUser = insertedUsers.find(u => u.role === userRoleEnum.enumValues[0]);
    const deliveryUser = insertedUsers.find(u => u.role === userRoleEnum.enumValues[3]);


    if (!sellerUser) throw new Error("❌ Seller user not found.");
    if (!customerUser) throw new Error("❌ Customer user not found.");
    if (!deliveryUser) throw new Error("❌ Delivery user not found.");
    console.log(`✅ Inserted ${insertedUsers.length} users.`);


    // 4️⃣ Insert Seller
    console.log("➕ Inserting seller...");
    const [insertedSeller] = await db.insert(sellers).values({
      userId: sellerUser.id, // userId अब users.id (integer) को संदर्भित करता है
      businessName: faker.company.name(),
      businessType: "grocery",
      businessAddress: faker.location.streetAddress(),
      city: "Indore",
      pincode: "452001",
      businessPhone: "9876543210",
      approvalStatus: approvalStatusEnum.enumValues[1], // "approved"
      gstNumber: "22AAAAA0000A1Z5",
      bankAccountNumber: "1234567890",
      ifscCode: "SBIN0000001",
    }).returning();
    if (!insertedSeller?.id) throw new Error("❌ Seller insert failed! No seller ID returned.");
    console.log("✅ Seller inserted.");


    // 5️⃣ Insert Store for that Seller
    console.log("➕ Inserting store...");
    const [insertedStore] = await db.insert(stores).values({
      sellerId: insertedSeller.id,
      storeName: "My Grocery Store",
      storeType: "grocery",
      address: "123 Main Road",
      city: "Indore",
      pincode: "452001",
      phone: "9999999999",
      isActive: true,
      licenseNumber: "LIC123",
      gstNumber: "22BBBBB0000B1Z6",
    }).returning();

    if (!insertedStore?.id) {
      throw new Error("❌ Store insert failed! No store ID returned.");
    }
    console.log("✅ Store inserted.");


    // 6️⃣ Insert Delivery Boy
    console.log("➕ Inserting delivery boy...");
    const deliveryBoyName = (deliveryUser.firstName || '') + ' ' + (deliveryUser.lastName || '');
    await db.insert(deliveryBoys).values({
      userId: deliveryUser.id, 
      email: deliveryUser.email!,
      name: deliveryBoyName.trim(),
      vehicleType: "bike",
      approvalStatus: approvalStatusEnum.enumValues[1], 
      firebaseUid: deliveryUser.firebaseUid, 
    });
    console.log("✅ Delivery boy inserted.");
    // 7️⃣ Insert Products
    console.log("➕ Inserting products...");
    const insertedProducts = await db.insert(products).values(
      insertedCategories.map(cat => {
        const price = faker.commerce.price({ min: 10, max: 200, dec: 2 });
        const originalPrice = (parseFloat(price) * 1.2).toFixed(2);

        return {
          sellerId: insertedSeller.id,
          storeId: insertedStore.id,
          categoryId: cat.id,
          name: faker.commerce.productName(),
          nameHindi: "हिंदी नाम",
          description: faker.commerce.productDescription(),
          descriptionHindi: "हिंदी विवरण",
          price: price.toString(),
          originalPrice: originalPrice.toString(),
          image: faker.image.url(),
          images: [faker.image.url(), faker.image.url()],
          unit: "kg",
          stock: 50,
          minOrderQty: 1,
          maxOrderQty: 5,
          isActive: true,
        };
      })
    ).returning();
    console.log(`✅ Inserted ${insertedProducts.length} products.`);


    // 8️⃣ Insert Order
    console.log("➕ Inserting order...");
    const [order] = await db.insert(orders).values({
      customerId: customerUser.id,
      deliveryBoyId: null,
      orderNumber: "ORD-" + Date.now(),
      subtotal: "0.00",
      deliveryCharge: "0.00",
      discount: "0.00",
      total: "0.00",
      paymentMethod: "cod",
      paymentStatus: "paid",
      status: "placed",
      deliveryAddress: {
        address: "Customer Street",
        city: "Indore",
        pincode: "452001",
      },
    }).returning();
    if (!order?.id) throw new Error("❌ Order insert failed! No order ID returned.");
    console.log("✅ Order inserted.");


    // 9️⃣ Order Items
    console.log("➕ Inserting order items...");
    let totalOrderValue = 0;
    const items = insertedProducts.slice(0, 2).map(p => {
      const qty = 2;
      const unitPrice = parseFloat(p.price || "0");
      const totalPrice = (unitPrice * qty).toFixed(2);
      totalOrderValue += parseFloat(totalPrice);

      return {
        orderId: order.id,
        productId: p.id,
        sellerId: insertedSeller.id,
        quantity: qty,
        unitPrice: unitPrice.toString(),
        totalPrice: totalPrice.toString(),
      };
    });
    await db.insert(orderItems).values(items);
    await db.update(orders).set({
      subtotal: totalOrderValue.toFixed(2).toString(),
      total: totalOrderValue.toFixed(2).toString()
    }).where(eq(orders.id, order.id));
    console.log(`✅ Inserted ${items.length} order items and updated order total.`);


    // 🔟 Reviews
    console.log("➕ Inserting reviews...");
    if (insertedProducts.length > 0) {
      await db.insert(reviews).values([
        {
          customerId: customerUser.id,
          productId: insertedProducts[0].id,
          orderId: order.id,
          rating: 4,
          comment: "Nice product!",
        },
        {
          customerId: customerUser.id,
          productId: insertedProducts[0].id,
          orderId: order.id,
          rating: 5,
          comment: "Excellent quality!",
        }
      ]);
      console.log("✅ Reviews inserted.");
    } else {
      console.log("⚠️ No products to review. Skipping review insertion.");
    }


    // 🔁 Cart Items
    console.log("➕ Inserting cart items...");
    await db.insert(cartItems).values(insertedProducts.slice(0, 2).map(p => ({
      userId: customerUser.id,
      productId: p.id,
      quantity: 1,
    })));
    console.log(`✅ Inserted ${insertedProducts.slice(0, 2).length} cart items.`);

    console.log("🎉 Seed complete! Database is populated.");

  } catch (err: any) {
    console.error("❌ Seeding failed:", err.message || err);
    process.exit(1);
  }
}

seedDatabase();
