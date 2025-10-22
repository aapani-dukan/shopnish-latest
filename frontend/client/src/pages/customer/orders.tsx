import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { Package } from "lucide-react";
import { useSocket } from "../../hooks/useSocket";

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
  status: string;
  deliveryStatus: string;
  total: string | number;
  createdAt: string;
  subOrders?: SubOrder[];
}

const statusBadgeVariants = {
  pending: "secondary",
  accepted: "info",
  preparing: "secondary",
  ready_for_pickup: "secondary",
  picked_up: "info",
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
    case "out_for_delivery": return "रास्ते में है";
    case "delivered": return "डिलीवर हो गया";
    case "cancelled": return "रद्द कर दिया गया";
    case "rejected": return "अस्वीकृत";
    default: return "अज्ञात";
  }
};

export default function CustomerOrdersPage() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data: orders, isLoading, isError, error } = useQuery<CustomerOrder[]>({
    queryKey: ["customerOrders"],
    queryFn: async () => {
      const response = await apiRequest("get", "/api/customer/orders");
      return response as CustomerOrder[];
    },
  });

  useEffect(() => {
    if (!socket || typeof socket.on !== "function") return;

    const onOrderStatusUpdated = (updatedOrder: CustomerOrder) => {
      console.log("📦 Order update received:", updatedOrder);
      queryClient.invalidateQueries({ queryKey: ["customerOrders"] });
    };

    socket.on("order:status-updated", onOrderStatusUpdated);

    return () => {
      if (socket && typeof socket.off === "function") {
        socket.off("order:status-updated", onOrderStatusUpdated);
      }
    };
  }, [socket, queryClient]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">आपके ऑर्डर</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-red-500">
          ऑर्डर लोड करने में त्रुटि: {(error as Error).message}
        </p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          पुनः प्रयास करें
        </Button>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="container mx-auto p-4 text-center">
        <Package className="mx-auto h-16 w-16 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">कोई ऑर्डर नहीं मिला</h2>
        <p className="text-gray-600">
          आपने अभी तक कोई ऑर्डर नहीं दिया है। अभी खरीदारी शुरू करें!
        </p>
        <Button asChild className="mt-4">
          <Link to="/">खरीदारी करें</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">आपके ऑर्डर्स</h1>
      <div className="space-y-4">
        {orders.map((order: CustomerOrder) => (
          <Card key={order.id} className="p-4">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="flex justify-between items-center text-lg">
                <span>ऑर्डर #{order.orderNumber}</span>
                <Badge variant={getStatusBadgeVariant(order.status)}>
                  {getStatusText(order.status)}
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
                    {getStatusText(order.status)}
                  </p>
                </div>
              </div>

              {order.subOrders && order.subOrders.length > 0 && (
                <div className="mt-6 border-t pt-4 space-y-4">
                  <h3 className="text-lg font-semibold">विक्रेता के ऑर्डर</h3>
                  {order.subOrders.map((subOrder: SubOrder) => (
                    <Card key={subOrder.id} className="p-3 bg-gray-50 border shadow-sm">
                      <CardHeader className="p-0 mb-2">
                        <CardTitle className="flex justify-between items-center text-md font-semibold">
                          <span>{subOrder.sellerBusinessName || subOrder.sellerName || `विक्रेता #${subOrder.sellerId}`}</span>
                          <Badge variant={getStatusBadgeVariant(subOrder.status)} className="text-xs">
                            {getStatusText(subOrder.status)}
                          </Badge>
                        </CardTitle>
                        <p className="text-sm text-gray-600">कुल: ₹{Number(subOrder.total).toLocaleString('en-IN')}</p>
                      </CardHeader>
                      <CardContent className="p-0 text-sm">
                        {subOrder.items && subOrder.items.length > 0 ? (
                          <div className="space-y-1">
                            {subOrder.items.map(item => (
                              <div key={item.id} className="flex items-center space-x-2">
                                {item.product?.image && (
                                  <img src={item.product.image} alt={item.product.name} className="w-6 h-6 object-cover rounded" />
                                )}
                                <p>{item.product?.name} x {item.quantity} {item.product?.unit}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">कोई आइटम नहीं</p>
                        )}
                         <div className="mt-3 flex space-x-2">
                          <Button asChild variant="outline" size="sm">
                              <Link to={`/order-details/${order.id}?sellerId=${subOrder.sellerId}`}>
                                विक्रेता का विवरण देखें
                              </Link>
                          </Button>
                          {(subOrder.status === 'picked_up' || subOrder.status === 'out_for_delivery') && (
                            <Button asChild variant="default" className="bg-purple-600 hover:bg-purple-700" size="sm">
                                <Link to={`/track-order/${order.id}?sellerId=${subOrder.sellerId}`}>
                                    live track
                                </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {(!order.subOrders || order.subOrders.length === 0) && (
                <div className="mt-4 flex space-x-3">
                  <Button asChild variant="outline">
                    <Link to={`/order-details/${order.id}`}>
                      विवरण देखें
                    </Link>
                  </Button>

                  {(order.status === 'picked_up' || order.status === 'out_for_delivery') && (
                      <Button asChild variant="default" className="bg-purple-600 hover:bg-purple-700">
                          <Link to={`/track-order/${order.id}`}>
                              live track
                          </Link>
                      </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

