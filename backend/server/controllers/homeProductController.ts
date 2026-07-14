import { Request, Response,NextFunction } from "express";
import { trackProductEvent,getUserProductScores } from "../../services/homeRecommendationService";
import { db } from "../db";
import {
  orderItems,
  productAffinity,
  products,
  sellersPgTable,
  approvalStatusEnum,
  productVariants,
} from "../../shared/backend/schema";
import { eq,sql,desc, inArray,and,asc,isNull } from "drizzle-orm";
import { calculateDistanceKm } from "../../services/locationService"; 
// =========================
// VIEW PRODUCT
// =========================
export const viewProduct = async (req: any, res: Response) => {
  
  try {
    const userId = req.user?.id;
    const productId = Number(req.params.id);

    if (!userId || !productId) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await trackProductEvent({
      userId,
      productId,
      type: "view",
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("viewProduct error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// =========================
// ADD TO CART
// =========================
export const addToCart = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const productId = Number(req.body.productId);

    if (!userId || !productId) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await trackProductEvent({
      userId,
      productId,
      type: "cart",
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("addToCart error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// =========================
// ADD TO WISHLIST
// =========================
export const addToWishlist = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const productId = Number(req.body.productId);

    if (!userId || !productId) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await trackProductEvent({
      userId,
      productId,
      type: "wishlist",
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("addToWishlist error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// =========================
// PLACE ORDER (BULK EVENT)
// =========================
export const placeOrder = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const items = req.body.items;

    if (!userId || !Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    for (const item of items) {
      if (!item?.productId) continue;

      await trackProductEvent({
        userId,
        productId: Number(item.productId),
        type: "order",
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("placeOrder error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
// =====================================================
// HOME PRODUCTS API
// =====================================================
export const getHomeProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {

    const userId = (req as any).user?.id ?? null;

    const {
      pincode,
      lat,
      lng,
      customerPincode,
      customerLat,
      customerLng,
    } = req.query;

    const effectivePincode =
      (pincode?.toString() ||
        customerPincode?.toString() ||
        "").trim();

    const effectiveLat = parseFloat(
      lat?.toString() ||
      customerLat?.toString() ||
      ""
    );

    const effectiveLng = parseFloat(
      lng?.toString() ||
      customerLng?.toString() ||
      ""
    );

    // =====================================
    // BASE WHERE
    // =====================================

    const whereClauses: any[] = [

      eq(
        products.approvalStatus,
        approvalStatusEnum.enumValues[1]
      ),

      eq(products.isActive, true),

      isNull(products.deletedAt),

    ];

    // =====================================
    // LOCATION REQUIRED
    // =====================================

    if (
      !effectivePincode ||
      Number.isNaN(effectiveLat) ||
      Number.isNaN(effectiveLng)
    ) {
      return res.status(400).json({
        message:
          "Location required",
      });
    }

    // =====================================
    // LOAD APPROVED SELLERS
    // =====================================

    const sellers = await db
      .select({
        id: sellersPgTable.id,
        latitude: sellersPgTable.latitude,
        longitude: sellersPgTable.longitude,
        deliveryRadius:
          sellersPgTable.deliveryRadius,
        deliveryPincodes:
          sellersPgTable.deliveryPincodes,
        isDistanceBasedDelivery:
          sellersPgTable.isDistanceBasedDelivery,
      })
      .from(sellersPgTable)
      .where(
        eq(
          sellersPgTable.approvalStatus,
          "approved"
        )
      );

    // =====================================
    // FIND DELIVERABLE SELLERS
    // =====================================

    const deliverableSellerIds =
      new Set<number>();

    for (const seller of sellers) {

      const sLat =
        Number(seller.latitude);

      const sLng =
        Number(seller.longitude);

      const radius =
        Number(seller.deliveryRadius);

      if (
        seller.isDistanceBasedDelivery
      ) {

        if (
          !Number.isNaN(sLat) &&
          !Number.isNaN(sLng) &&
          radius > 0
        ) {

          const distance =
            await calculateDistanceKm(
              sLat,
              sLng,
              effectiveLat,
              effectiveLng
            );

          if (
            distance !== null &&
            distance <= radius
          ) {

            deliverableSellerIds.add(
              seller.id
            );

          }

        }

      } else {

        if (
          seller.deliveryPincodes?.includes(
            effectivePincode
          )
        ) {

          deliverableSellerIds.add(
            seller.id
          );

        }

      }

    }

    if (
      deliverableSellerIds.size === 0
    ) {

      return res.json({
        success: true,
        total: 0,
        products: [],
      });

    }

    whereClauses.push(

      inArray(
        products.sellerId,
        [...deliverableSellerIds]
      )

    );

    // =====================================
    // LOAD DELIVERABLE PRODUCTS
    // =====================================

    const allProducts =
      await db.query.products.findMany({

        where: and(...whereClauses),

        with: {

          category: {
            columns: {
              id: true,
              name: true,
              nameHindi: true,
            },
          },

          seller: {
            columns: {
              id: true,
              businessName: true,
              businessAddress: true,
              latitude: true,
              longitude: true,
            },
          },

          masterProduct: {
            columns: {
              id: true,
              subCategoryId: true,
            },
          },

          variants: {

            where: eq(
              productVariants.isActive,
              true
            ),

            orderBy: [
              asc(productVariants.price),
            ],

            columns: {
              id: true,
              price: true,
              originalPrice: true,
              stock: true,
              unit: true,
              isActive: true,
            },

          },

        },

      });

    if (!allProducts.length) {

      return res.json({
        success: true,
        total: 0,
        products: [],
      });

    }

    const productIds =
      allProducts.map(
        p => p.id
      );

    // =====================================
    // PART 2
    // =====================================
    // =====================================
// USER INTEREST
// =====================================

const interestRows = userId
  ? await db
      .select({
        productId: productAffinity.productId,
        score: productAffinity.score,
        lastInteraction: productAffinity.lastInteraction,
      })
      .from(productAffinity)
      .where(
        and(
          eq(productAffinity.userId, userId),
          inArray(productAffinity.productId, productIds)
        )
      )
  : [];

const interestMap = new Map<number, number>();

const now = Date.now();

for (const row of interestRows) {

  const hours =
    (now -
      new Date(row.lastInteraction).getTime()) /
    (1000 * 60 * 60);

  // 5% decay every hour
  const decay = Math.exp(-0.05 * hours);

  interestMap.set(
    row.productId,
    Number(row.score ?? 0) * decay
  );

}

// =====================================
// BEST SELLING
// =====================================

const bestSellingRows = await db
  .select({
    productId: orderItems.productId,

    sold: sql<number>`
      COALESCE(SUM(${orderItems.quantity}),0)
    `,
  })
  .from(orderItems)
  .where(
    inArray(
      orderItems.productId,
      productIds
    )
  )
  .groupBy(orderItems.productId);

const bestSellingMap =
  new Map<number, number>();

for (const row of bestSellingRows) {

  bestSellingMap.set(
    row.productId,
    Number(row.sold)
  );

}

// =====================================
// AI SCORE
// =====================================

const scoredProducts = allProducts.map(
  (product: any) => {

    const interest =
      interestMap.get(product.id) ?? 0;

    const bestSelling =
      bestSellingMap.get(product.id) ?? 0;

    const random =
      Math.random() * 5;

    // ==========================
    // FINAL SCORE
    // ==========================

    const aiScore =

      interest * 5 +

      bestSelling * 3 +

      random;

    return {

      ...product,

      interest,

      bestSelling,

      aiScore,

    };

  }
);
const recommendedProducts = [...scoredProducts]
  .sort((a, b) => b.aiScore - a.aiScore)
  .slice(0, 18);
  const trendingProducts = [...scoredProducts]
  .sort(
    (a, b) =>
      (b.bestSelling || 0) -
      (a.bestSelling || 0)
  )
  .slice(0, 18);
  const recentlyViewed = [...interestRows]
  .sort(
    (a, b) =>
      new Date(b.lastInteraction).getTime() -
      new Date(a.lastInteraction).getTime()
  )
  .map(x => x.productId);
  const recentlyViewedProducts = recentlyViewed
  .map(id => scoredProducts.find(p => p.id === id))
  .filter(Boolean)
  .slice(0, 18);
// =====================================
// CATEGORY GROUPING
// =====================================

const categoryMap =
  new Map<number, any[]>();

for (const product of scoredProducts) {

  if (product.categoryId == null)
    continue;

  if (
    !categoryMap.has(
      product.categoryId
    )
  ) {

    categoryMap.set(
      product.categoryId,
      []
    );

  }

  categoryMap
    .get(product.categoryId)!
    .push(product);

}

// =====================================
// SORT INSIDE CATEGORY
// =====================================

for (const [, items] of categoryMap) {

  items.sort(
    (a, b) =>
      b.aiScore -
      a.aiScore
  );

}

// =====================================
// HOME MIX OPTIONS
// =====================================

const mixOptions = [

  { interest: 3, best: 3, random: 3 },

  { interest: 5, best: 1, random: 3 },

  { interest: 2, best: 4, random: 3 },

  { interest: 4, best: 2, random: 3 },

  { interest: 1, best: 5, random: 3 },

  { interest: 6, best: 1, random: 2 },

  { interest: 0, best: 4, random: 5 },

];

const finalProducts: any[] = [];

for (const [, items] of categoryMap) {

  // --------------------
  // Interest
  // --------------------

  const interestProducts =
    items.filter(
      p => p.interest > 0
    );

  // --------------------
  // Best Selling
  // --------------------

  const bestSellingProducts =
    items.filter(
      p =>
        p.interest === 0 &&
        p.bestSelling > 0
    );

  // --------------------
  // Random
  // --------------------

  const randomProducts =
    items.filter(
      p =>
        p.interest === 0 &&
        p.bestSelling === 0
    );

  randomProducts.sort(
    () => Math.random() - 0.5
  );

  // --------------------
  // Random Mix Option
  // --------------------

  const option =
    mixOptions[
      Math.floor(
        Math.random() *
        mixOptions.length
      )
    ];

  const selected: any[] = [];

  // ===============================
// INTEREST
// ===============================

selected.push(
  ...interestProducts.slice(
    0,
    Math.min(
      option.interest,
      interestProducts.length
    )
  )
);

// ===============================
// BEST SELLING
// ===============================

selected.push(
  ...bestSellingProducts
    .filter(
      p => !selected.includes(p)
    )
    .slice(
      0,
      Math.min(
        option.best,
        bestSellingProducts.length
      )
    )
);

// ===============================
// RANDOM
// ===============================

selected.push(
  ...randomProducts
    .filter(
      p => !selected.includes(p)
    )
    .slice(
      0,
      Math.min(
        option.random,
        randomProducts.length
      )
    )
);

  // --------------------
  // Fill Remaining
  // --------------------

  if (selected.length < 9) {

    const remaining =
      items.filter(
        p => !selected.includes(p)
      );

    selected.push(
      ...remaining.slice(
        0,
        9 - selected.length
      )
    );

  }

  finalProducts.push(
    ...selected.slice(0, 9)
  );

}
// =====================================
// FORMAT PRODUCTS
// =====================================
const formatProducts = (productsList: any[]) => {
  return productsList.map((prod: any) => {

    const variants = prod.variants || [];

    const cheapest = variants[0];

    const totalStock =
      variants.reduce(
        (sum: number, v: any) =>
          sum + Number(v.stock || 0),
        0
      );

    const mrp =
      cheapest
        ? (
            cheapest.originalPrice ??
            cheapest.price
          )
        : 0;

    return {
      ...prod,

      price:
        cheapest
          ? String(cheapest.price)
          : "0",

      originalPrice:
        cheapest
          ? String(
              cheapest.originalPrice ??
              cheapest.price
            )
          : "0",

      mrp: Number(mrp),

      stock: totalStock,

      unit:
        cheapest
          ? cheapest.unit
          : "piece",

      subCategoryId:
        prod.masterProduct?.subCategoryId ??
        null,

      variants,

      aiScore: undefined,
      interest: undefined,
      bestSelling: undefined,
    };

  });
};
const formattedProducts =
  formatProducts(finalProducts);

const formattedRecommended =
  formatProducts(recommendedProducts);

const formattedTrending =
  formatProducts(trendingProducts);

const formattedRecentlyViewed =
  formatProducts(recentlyViewedProducts);

// =====================================
// RESPONSE
// =====================================

return res.status(200).json({

  success: true,

  total: formattedProducts.length,

  categories: categoryMap.size,

  // Home Feed (पहले जैसा)
  products: formattedProducts,

  // AI Sections
  recommendedProducts: formattedRecommended,

  trendingProducts: formattedTrending,

  recentlyViewedProducts: formattedRecentlyViewed,

});

} catch (error) {

  console.error(
    "Home Feed Error",
    error
  );

  next(error);

}
};
