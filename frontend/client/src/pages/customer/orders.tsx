import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { Package, Truck } from "lucide-react"; // Truck icon added for visual
import { useSocket } from "../../hooks/useSocket";

// -------------------------------------------------------------------------
// 🟢 FIX 1: इंटरफ़ेस अपडेट करें (DeliveryBatch और overallDeliveryStatus जोड़ें)
// -------------------------------------------------------------------------

export interface DeliveryBatch {
  id: number;
  status: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
  deliveryBoy?: { id: number; name?: string; phone?: string };
}

export interface SubOrderItem {
  id: number;
  quantity: number;
  product?: {
    id: number;
    name: string;
    image?: string;
    unit?: string;
  };
}

export interface SubOrder {
  id: number;
  sellerId: number;
  sellerName?: string;
  sellerBusinessName?: string;
  status: string;
  deliveryStatus: string;
  total: string | number;
  items: SubOrderItem[];
}

export interface CustomerOrder {
  id: number;
  orderNumber: string;
  status: string; // Master order status (confirmed, pending)
  overallDeliveryStatus?: string; // 👈 Backend से आ रहा नया समग्र स्टेटस
  deliveryStatus: string;
  total: string | number;
  createdAt: string;
  subOrders?: SubOrder[];
  deliveryBatches?: DeliveryBatch[]; // 👈 Backend से आ रहा बैच डेटा
}

const statusBadgeVariants = {
  pending: "secondary",
  accepted: "info",
  preparing: "secondary",
  ready_for_pickup: "secondary",
  picked_up: "info",
  // 🟢 'In Transit' को भी हैंडल करें
  'in transit': "warning", 
  out_for_delivery: "info",
  delivered: "success",
  cancelled: "destructive",
  rejected: "destructive",
  default: "secondary",
};

const getStatusBadgeVariant = (status: string) => {
  return statusBadgeVariants[status.toLowerCase() as keyof typeof statusBadgeVariants] || statusBadgeVariants.default;
};

const getStatusText = (status: string) => {
  switch (status.toLowerCase()) {
    case "pending": return "लंबित";
    case "accepted": return "स्वीकृत";
    case "preparing": return "तैयार हो रहा है";
    case "ready_for_pickup": return "पिकअप के लिए तैयार";
    case "picked_up": return "पिकअप हो गया";
    case "out_for_delivery": return "डिलीवरी के रास्ते में";
    case "in transit": return "डिलीवरी प्रगति पर"; // 🟢 नया स्टेटस टेक्स्ट
    case "delivered": return "डिलीवर हो गया";
    case "cancelled": return "रद्द कर दिया गया";
    case "rejected": return "अस्वीकृत";
    default: return "अज्ञात";
  }
};

// ... (fetch function is good)

export default function CustomerOrdersPage() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data: orders, isLoading, isError, error } = useQuery<CustomerOrder[]>({
    queryKey: ["customerOrders"],
    queryFn: async () => {
      const response = await apiRequest("get", "/api/orders");
      return response as CustomerOrder[];
    },
  });

  // ... (useEffect for socket is good)

  if (isLoading) {
    // ... (Loading state)
  }

  if (isError) {
    // ... (Error state)
  }

  if (!orders || orders.length === 0) {
    // ... (No orders state)
  }
  
  // -------------------------------------------------------------------------
  // 🟢 FIX 2: मुख्य रेंडर लॉजिक को बैच-केंद्रित करने के लिए अपडेट करें
  // -------------------------------------------------------------------------

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">आपके ऑर्डर्स</h1>
      <div className="space-y-4">
        {orders.map((order: CustomerOrder) => {
          
          // 🟢 समग्र स्टेटस का उपयोग करें
          const currentDisplayStatus = order.overallDeliveryStatus || order.status;
          
          // चेक करें कि कम से कम एक बैच ट्रैकिंग के लिए योग्य है
          const isTrackable = order.deliveryBatches?.some(b => 
              b.status === 'picked_up' || b.status === 'out_for_delivery'
          );

          return (
            <Card key={order.id} className="p-4">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="flex justify-between items-center text-lg">
                  <span>ऑर्डर #{order.orderNumber}</span>
                  <Badge variant={getStatusBadgeVariant(currentDisplayStatus)}>
                    {getStatusText(currentDisplayStatus)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                  <div>
                    <p>
                      <span className="font-medium text-gray-800">तारीख:</span>{" "}
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p>
                      <span className="font-medium text-gray-800">कुल:</span> ₹
                      {Number(order.total).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p>
                      <span className="font-medium text-gray-800">स्थिति:</span>{" "}
                      {getStatusText(currentDisplayStatus)}
                    </p>
                  </div>
                </div>

                {/* 🟢 FIX 3: बैच-वाइज समरी डिस्प्ले */}
                {order.deliveryBatches && order.deliveryBatches.length > 0 && (
                  <div className="mt-6 border-t pt-4 space-y-3">
                    <h3 className="text-lg font-semibold flex items-center">
                        <Truck className="h-5 w-5 mr-2 text-blue-600" /> डिलीवरी बैचेस
                    </h3>
                    
                    {order.deliveryBatches.map((batch: DeliveryBatch) => (
                      <Card key={batch.id} className="p-3 bg-blue-50/50 border-blue-200 shadow-sm">
                        <CardTitle className="text-md font-semibold flex justify-between items-center">
                            <span>Batch #{batch.id}</span>
                            <Badge variant={getStatusBadgeVariant(batch.status)} className="text-xs">
                              {getStatusText(batch.status)}
                            </Badge>
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                            डिलीवरी बॉय: {batch.deliveryBoy?.name || "जल्द ही असाइन किया जाएगा"}
                        </p>
                      </Card>
                    ))}
                  </div>
                )}
                
                <div className="mt-4 flex space-x-3">
                  <Button asChild variant="outline">
                    <Link to={`/order-details/${order.id}`}>
                      विवरण देखें (सभी सब-ऑर्डर)
                    </Link>
                  </Button>

                  {/* 🟢 FIX 4: ट्रैकिंग बटन अब मास्टर ऑर्डर ID का उपयोग करेगा */}
                  {isTrackable && (
                      <Button asChild variant="default" className="bg-purple-600 hover:bg-purple-700">
                          {/* हम ट्रैकिंग पेज पर पूरा बैच समरी भेज रहे हैं, इसलिए केवल Master Order ID ही काफी है */}
                          <Link to={`/track-order/${order.id}`}> 
                              Live Tracking
                          </Link>
                      </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
