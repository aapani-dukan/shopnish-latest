import { Router, Request, Response } from 'express';
import { db } from '../server/db.ts';
import { products, categories, sellersPgTable } from '../shared/backend/schema.ts';
import { eq, like, inArray, and } from 'drizzle-orm';
import { calculateDistanceKm } from '../services/locationService'; 

const router = Router();

// ✅ GET /api/products/pending (यह लंबित प्रोडक्ट्स को लिस्ट करता है)
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const productsList = await db.select({
      id: products.id,
      name: products.name,
      price: products.price,
      // products.status की जगह products.approvalStatus का उपयोग करें, जैसा कि स्कीमा में है
      status: products.approvalStatus, 
      category: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    // products.status की जगह products.approvalStatus का उपयोग करें
    .where(eq(products.approvalStatus, 'pending'));
    
    res.status(200).json(productsList);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Internal error.' });
  }
});

// ✅ GET /api/products/approved (यह स्वीकृत प्रोडक्ट्स को लिस्ट करता है)
router.get('/approved', async (req: Request, res: Response) => {
  try {
    const productsList = await db.select({
      id: products.id,
      name: products.name,
      price: products.price,
      // products.status की जगह products.approvalStatus का उपयोग करें
      status: products.approvalStatus,
      category: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    // products.status की जगह products.approvalStatus का उपयोग करें
    .where(eq(products.approvalStatus, 'approved'));
    
    res.status(200).json(productsList);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Internal error.' });
  }
});


// GET /api/products (यह सभी प्रोडक्ट्स को लिस्ट करता है, अब स्थान के आधार पर फ़िल्टर किया गया)
router.get('/', async (req: Request, res: Response) => {
  const { categoryId, search, customerPincode, customerLat, customerLng } = req.query;

  // ग्राहक के स्थान की जानकारी आवश्यक है
  if (!customerPincode || !customerLat || !customerLng) {
    return res.status(400).json({ message: "Customer location (pincode, lat, lng) is required for filtering." });
  }

  const parsedCustomerLat = parseFloat(customerLat as string);
  const parsedCustomerLng = parseFloat(customerLng as string);

  try {
    // 1. सभी स्वीकृत सेलर्स को उनकी डिलीवरी प्राथमिकताओं के साथ Fetch करें
    const allApprovedSellers = await db.select()
      .from(sellersPgTable)
      .where(eq(sellersPgTable.approvalStatus, 'approved'));

    const deliverableSellerIds: number[] = [];
    const distanceCheckPromises: Promise<void>[] = [];

    for (const seller of allApprovedSellers) {
      if (!seller.id) continue;

      if (seller.isDistanceBasedDelivery) {
        // यह विक्रेता दूरी-आधारित डिलीवरी का उपयोग करता है
        // deliveryRadius को maxDeliveryDistanceKm के रूप में उपयोग करेंगे
        if (seller.latitude && seller.longitude && seller.deliveryRadius !== null && seller.deliveryRadius !== undefined) {
          distanceCheckPromises.push((async () => {
            const distance = await calculateDistanceKm(
              seller.latitude,
              seller.longitude,
              parsedCustomerLat,
              parsedCustomerLng
            );
            if (distance !== null && distance <= seller.deliveryRadius!) {
              deliverableSellerIds.push(seller.id);
            }
          })());
        } else {
            console.warn(`[ProductRoutes] Seller ${seller.id} chose distance-based delivery but missing shop location or max distance. Skipping.`);
        }
      } else {
        // यह विक्रेता पिनकोड-आधारित डिलीवरी का उपयोग करता है
        if (seller.deliveryPincodes && seller.deliveryPincodes.includes(customerPincode as string)) {
          deliverableSellerIds.push(seller.id);
        }
      }
    }

    // सभी डिस्टेंस API प्रॉमिसेस के पूरा होने का इंतजार करें
    await Promise.all(distanceCheckPromises);

    // यदि कोई भी विक्रेता डिलीवर नहीं कर सकता है, तो खाली सूची लौटाएं
    if (deliverableSellerIds.length === 0) {
      return res.status(200).json([]); // या { products: [] } यदि तुम वैसा JSON चाहते हो
    }

    // अब केवल उन स्वीकृत सेलर्स के उत्पादों को Fetch करें जो डिलीवर कर सकते हैं
    let query = db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      image: products.image,
      sellerId: products.sellerId,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(
      inArray(products.sellerId, deliverableSellerIds), // ✅ नया फ़िल्टर: डिलीवर करने वाले सेलर्स के उत्पाद
      eq(products.approvalStatus, 'approved') // ✅ सुनिश्चित करें कि केवल स्वीकृत उत्पाद ही दिखाए जाएं
    ));

    if (categoryId) {
      const parsedCategoryId = parseInt(categoryId as string);
      if (!isNaN(parsedCategoryId)) {
        query = query.where(eq(products.categoryId, parsedCategoryId));
      }
    }
    
    if (search) {
      query = query.where(like(products.name, `%${search}%`));
    }

    const productsList = await query;
    res.status(200).json(productsList);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Internal error.' });
  }
});


// GET /api/products/:id (यह एक सिंगल प्रोडक्ट को फ़ेच करता है)
router.get('/:id', async (req: Request, res: Response) => {
  const productId = parseInt(req.params.id);
  if (isNaN(productId)) return res.status(400).json({ error: 'Invalid product ID.' });

  try {
    const [product] = await db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      image: products.image,
      sellerId: products.sellerId,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, productId));

    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.status(200).json(product);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Internal error.' });
  }
});

export default router;
