// frontend/client/src/interfaces/ProductWithSeller.ts

import { Product, Seller } from '../pages/DeliveryOrderList.tsx'; // मान लें कि Product यहाँ परिभाषित है


export interface ProductWithSeller extends Product {
  seller: Seller;
}
