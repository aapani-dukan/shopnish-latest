// types/delivery.ts

// सेलर की ग्लोबल सेटिंग्स के लिए
export interface SellerDeliverySettings {
  isDistanceBasedDelivery: boolean;
  deliveryPincodes: string[]; // यह array है
  deliveryRadius: number | null;
  // रेडियस के लिए lat/lng का होना जरूरी है
  latitude: number | null;
  longitude: number | null;
}

// प्रोडक्ट ओवरराइड सेटिंग्स के लिए
export type DeliveryScope = 'GLOBAL' | 'PRODUCT_PINCODE' | 'PRODUCT_RADIUS';

export interface ProductDeliverySettings {
  id: number; // प्रोडक्ट ID
  name: string;
  deliveryScope: DeliveryScope; // जो हमने ऊपर तय किया
  productDeliveryPincodes: string[] | null;
  productDeliveryRadiusKM: number | null;
}
