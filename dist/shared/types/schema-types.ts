// shared/types/schema-types.ts

export type Seller = {
  id: number;
    userId: number;
      businessName: string;
        businessType: string;
          description?: string;
            businessAddress: string;
              city: string;
                pincode: string;
                  businessPhone: string;
                    gstNumber?: string;
                      bankAccountNumber?: string;
                        ifscCode?: string;
                          deliveryRadius?: number;
                            email?: string;
                              phone?: string;
                                address?: string;
                                  approvalStatus: "pending" | "approved" | "rejected";
                                    approvedAt?: string;
                                      rejectionReason?: string;
                                        createdAt: string;
                                          updatedAt: string;
                                          };

                                          export type ProductWithSeller = {
                                            id: number;
                                              sellerId: number;
                                                storeId: number;
                                                  categoryId: number;
                                                    name: string;
                                                      nameHindi?: string;
                                                        description?: string;
                                                          descriptionHindi?: string;
                                                            price: string;
                                                              originalPrice?: string;
                                                                image: string;
                                                                  images?: string[];
                                                                    unit: string;
                                                                      brand?: string;
                                                                        stock: number;
                                                                          minOrderQty?: number;
                                                                            maxOrderQty?: number;
                                                                              isActive: boolean;
                                                                                createdAt: string;
                                                                                  updatedAt: string;
                                                                                  };

                                                                                  export type Category = {
                                                                                    id: number;
                                                                                      name: string;
                                                                                        nameHindi?: string;
                                                                                          slug: string;
                                                                                            description?: string;
                                                                                              image?: string;
                                                                                                isActive: boolean;
                                                                                                  sortOrder: number;
                                                                                                  };

                                                                                                  export type OrderWithItems = {
                                                                                                    id: number;
                                                                                                      customerId: number;
                                                                                                        orderNumber: string;
                                                                                                          status: string;
                                                                                                            total: string;
                                                                                                              createdAt: string;
                                                                                                                updatedAt: string;
                                                                                                                  items: {
                                                                                                                      id: number;
                                                                                                                          orderId: number;
                                                                                                                              productId: number;
                                                                                                                                  sellerId: number;
                                                                                                                                      quantity: number;
                                                                                                                                          unitPrice: string;
                                                                                                                                              totalPrice: string;
                                                                                                                                                }[];
                                                                                                                                                };