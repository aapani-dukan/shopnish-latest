// shared/productHelpers.ts

/**
 * Shopnish Product Offer Calculator
 * Ye function MRP aur Selling Price ke beech ka relation calculate karta hai.
 */
export const formatProductWithOffers = (product: any) => {
  if (!product) return null;

  let discountLabel = "";
  
  // SQL Decimal (String) ko Number mein convert karna safe rehta hai
  const sellingPrice = Number(product.price || 0);
  const originalPrice = Number(product.originalPrice || product.price || 0);

  // 1. Discount Label Logic
  if (originalPrice > sellingPrice) {
    if (product.discountType === 'percentage') {
      const percent = Math.round(((originalPrice - sellingPrice) / originalPrice) * 100);
      if (percent > 0) discountLabel = `${percent}% OFF`;
    } 
    else if (product.discountType === 'fixed_amount') {
      const flatOff = originalPrice - sellingPrice;
      if (flatOff > 0) discountLabel = `₹${Math.round(flatOff)} OFF`;
    }
  }

  // 2. High-Class Tags Logic (Zomato style labels)
  // Agar seller ne koi custom label nahi dala, toh hum automatic tags de sakte hain
  let finalTag = product.offerLabel || null;
  if (!finalTag && product.stock > 0 && product.stock < 10) {
    finalTag = "Only few left!"; // Scarcity logic
  }

  return {
    ...product,
    sellingPrice,
    originalPrice,
    discountLabel,
    showBadge: discountLabel !== "",
    customTag: finalTag
  };
};