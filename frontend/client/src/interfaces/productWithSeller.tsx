// frontend/client/src/interfaces/ProductWithSeller.ts

import { Product, Seller } from '../pages/DeliveryOrderList.tsx';

export interface ProductWithSeller extends Product {
  seller: Seller;
  // Product इंटरफ़ेस में गुम हुई प्रॉपर्टीज़ को यहाँ जोड़ें (या Product को ही ठीक करें)
  description?: string; // इसे वैकल्पिक मानें
  price: number; // इसे आवश्यक मानें
  originalPrice?: number; // इसे वैकल्पिक मानें
  categoryId: number; // इसे आवश्यक मानें
  stock: number; // इसे आवश्यक मानें
  image?: string; // URL के लिए, यदि आप इसे प्रदर्शित कर रहे हैं
}
