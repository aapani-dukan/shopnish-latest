// client/src/types/delivery.ts

export interface SellerDeliverySettings {
  isDistanceBasedDelivery: boolean;
  deliveryPincodes: string[];
  deliveryRadius: number | null;
  latitude: number | null; // From sellersPgTable
  longitude: number | null; // From sellersPgTable
}

export type DeliveryScope = 'GLOBAL' | 'PRODUCT_PINCODE' | 'PRODUCT_RADIUS';

export interface ProductDeliverySettings {
  id: number; // Product ID
  name: string; // Product name for display
  deliveryScope: DeliveryScope;
  productDeliveryPincodes: string[] | null;
  productDeliveryRadiusKM: number | null;
}
