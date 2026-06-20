import { Request, Response } from "express";
import { db } from "../db";
import {
  categories,
  categorySubcategories,
  products,
} from "../../shared/backend/schema";

import {
  eq,
  inArray,
  asc,
} from "drizzle-orm";
export const getCategories = async (
  req: Request,
  res: Response
) => {
  try {

    const categoriesList =
      await db.query.categories.findMany({

        with: {

          shops: true,

          products: {
            limit: 6,
          },

          subCategories: true,

        },

      });

    return res
      .status(200)
      .json(categoriesList);

  } catch (error: any) {

    console.error(
      "Error fetching categories:",
      error
    );

    return res.status(500).json({
      error: "Internal server error",
    });

  }
};
export const getCategorySubcategories = async (req: Request, res: Response) => {
  try {
    const categoryId = Number(req.params.categoryId);

    const subCategoryMappings = await db.query.categorySubcategories.findMany({
      where: eq(categorySubcategories.categoryId, categoryId),
      with: {
        subcategory: {
          with: {
            productMappings: {
              with: {
                product: true,
              },
            },
          },
        },
      },
    });
const categoryShopsMap = new Map<number, any>();
    const result = await Promise.all(
      subCategoryMappings.map(async (item) => {

        const sub = item.subcategory!;

        const masterIds = sub.productMappings.map(
          (p: any) => p.masterProductId
        );

        if (masterIds.length === 0) {
          return {
            id: sub.id,
            name: sub.name,
            nameHindi: sub.nameHindi,
            image: sub.image,
            productCount: 0,
            products: [],
          };
        }
       
        
        const productsList = await db.query.products.findMany({
  where: inArray(products.masterProductId, masterIds),
  with: {
    seller: true,
    variants: {
      orderBy: (variants, { asc }) => [asc(variants.price)],
    },
  },
});
const normalizedProducts = productsList.map((p: any) => {

  const variants = p.variants || [];

  const cheapest = variants[0];

  const price = Number(cheapest?.price || 0);

  const mrp = Number(
    cheapest?.originalPrice ||
    cheapest?.mrp ||
    price
  );

  const stock = variants.reduce(
    (sum: number, v: any) => sum + Number(v.stock || 0),
    0
  );

  const savings = mrp - price;

  let discountText = "";

  if (savings > 0) {

    if (savings < 100) {

      discountText =
        Math.round((savings / mrp) * 100) + "% OFF";

    } else {

      discountText =
        `Flat ₹${Math.round(savings)} OFF`;

    }

  }

  return {

    ...p,

    price,

    mrp,

    stock,

    discountText,

    hasMultipleVariants:
      variants.length > 1,

    sellerName:
      p.seller?.businessName,

    rating: 4.7,

    reviewCount: 120,

  };

});
const uniqueShopsMap = new Map();

normalizedProducts.forEach((p: any) => {

  if (!p.seller) return;

  if (!uniqueShopsMap.has(p.seller.id)) {

    uniqueShopsMap.set(
      p.seller.id,
      {
        id: p.seller.id,
        businessName: p.seller.businessName,
        businessAddress: p.seller.businessAddress,
        logo: p.seller.logo,
        rating: 4.8,
        estimatedDeliveryTime: "15-20 min",

        // Unique Products Store
        productIds: new Set(),
      }
    );

  }

  const shop = uniqueShopsMap.get(p.seller.id);

  shop.productIds.add(
    p.masterProductId
  );

});
const allShops = Array.from(
  uniqueShopsMap.values()
).map((shop: any) => ({

  ...shop,

  productCount:
    shop.productIds.size,

}));
allShops.forEach((shop: any) => {

  if (!categoryShopsMap.has(shop.id)) {

    categoryShopsMap.set(
      shop.id,
      shop
    );

  }

});
const recommendedShop =
  allShops.length > 0
    ? allShops[
        Math.floor(
          Math.random() *
          allShops.length
        )
      ]
    : null;
return {

    id: sub.id,

    name: sub.name,

    nameHindi: sub.nameHindi,

    image: sub.image,

    productCount:
      normalizedProducts.length,

    shopCount:
      allShops.length,

    recommendedShop,

    allShops,

    products:
      normalizedProducts.slice(0,9),

};
      })
    );

    // ✅ यही missing था
    return res.status(200).json({

  subCategories: result,

  allCategoryShops: Array.from(
    categoryShopsMap.values()
  ),

});

  } catch (err) {
    console.error("❌ getCategorySubcategories Error:", err);
    return res.status(500).json({
      error: "Failed to fetch subcategories",
    });
  }
};