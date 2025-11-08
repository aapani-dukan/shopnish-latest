// frontend/client/src/interfaces/ProductWithSeller.ts

import { Product } from './Product'; // मान लें कि Product यहाँ परिभाषित है
import { Seller } from './Seller';   // मान लें कि Seller यहाँ परिभाषित है

export interface ProductWithSeller extends Product {
  seller: Seller;
}
