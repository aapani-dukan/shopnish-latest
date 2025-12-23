// client/src/pages/seller/ordermanager.tsx
import React, { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { Package } from "lucide-react";
// NOTE: keep types permissive for now to avoid mismatch with your generated schema
type OrderItem = any;
type DeliveryBoy = { id: number; name?: string; phone?: string };
type Customer = any;

type OrderWithDeliveryBoy = {
  id: number;
  orderNumber?: string;
  status: string;
  isSelfDeliveryBySeller?: boolean;
  paymentMethod?: string;
  paymentStatus?: string;
  total?: number | string;
  createdAt?: string;
  customer?: Customer;
  deliveryAddress?: any;
  items?: OrderItem[];
  deliveryBoy?: DeliveryBoy;
};

// Allowed statuses (matches backend enum you specified)
const VALID_STATUSES = [
  "pending",
  "accepted",
  "preparing",
  "ready_for_pickup",
  "cancelled",
  "rejected",
  "delivered_by_seller",
  "delivered_by_delivery_boy",
];

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "pending": return "secondary";
    case "accepted": return "info";
    case "preparing": return "warning";
    case "ready_for_pickup": return "primary";
    
    
    case "cancelled": return "info";
    case "rejected": return "destructive";
    
    case "delivered_by_seller": return "success";
      case "delivered_by_delivery_boy": return "success";
    default: return "default";
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case "pending": return "लंबित";
    case "accepted": return "स्वीकृत";
    case "preparing": return "तैयार किया जा रहा है";
    case "ready_for_pickup": return "पिकअप के लिए तैयार";
    case "cancelled": return "रद्द किया गया";
    case "rejected": return "अस्वीकृत";
    case "delivered_by_seller": return "सेलर द्वारा डिलीवर किया";
    case "delivered_by_delivery_boy": return "डिलीवरी बॉय द्वारा डिलीवर किया";
    default: return status;
  }
};
export default function OrderManager({
  orders,
  isLoading,
  error,
  seller,
}: {
  orders: any[] | undefined;
  isLoading: boolean;
  error: any;
  seller: any;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    const onOrderUpdated = (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] });
      toast({ title: "ऑर्डर अपडेट हुआ", description: `ऑर्डर स्टेटस: ${getStatusText(updated.status)}` });
    };
    const onNewOrder = (newOrder: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] });
      toast({ title: "नया ऑर्डर!", description: "आपको एक नया ऑर्डर मिला है" });
    };
    socket.on("order-updated-for-seller", onOrderUpdated);
    socket.on("new-order-for-seller", onNewOrder);
    return () => {
      socket.off("order-updated-for-seller", onOrderUpdated);
      socket.off("new-order-for-seller", onNewOrder);
    };
  }, [socket, queryClient, toast]);

  const mutation = useMutation({
    mutationFn: async ({ subOrderId, status }: { subOrderId: number; status: string }) => {
      return apiRequest("PATCH", `/api/sellers/sub-orders/${subOrderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] });
      toast({ title: "सफलता", description: "ऑर्डर स्टेटस अपडेट हो गया" });
    },
  });

  const handleStatusUpdate = (subOrderId: number, newStatus: string) => {
    mutation.mutate({ subOrderId, status: newStatus });
  };

  const renderStatusActions = (order: any) => {
    if (!seller || seller.approvalStatus !== "approved") return null;
    const s = order.status;
    if (s === "pending") {
      return (
        <>
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusUpdate(order.id, "accepted")}>स्वीकार करें</Button>
          <Button variant="destructive" onClick={() => handleStatusUpdate(order.id, "rejected")}>अस्वीकार करें</Button>
        </>
      );
    }
    if (s === "accepted") {
      return <Button className="bg-blue-600" onClick={() => handleStatusUpdate(order.id, "preparing")}>तैयारी शुरू करें</Button>;
    }
    if (s === "preparing") {
      return <Button className="bg-orange-500" onClick={() => handleStatusUpdate(order.id, "ready_for_pickup")}>पिकअप के लिए तैयार</Button>;
    }
    if (s === "ready_for_pickup" && order.isSelfDeliveryBySeller) {
      return <Button onClick={() => handleStatusUpdate(order.id, "delivered_by_seller")}>डिलीवर हो गया</Button>;
    }
    return null;
  };

  const formatPrice = (value: any) => {
    const num = Number(value);
    return isFinite(num) ? num.toFixed(2) : "0.00";
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (error) return <p className="text-red-500">Error loading orders</p>;
  if (!orders || orders.length === 0) return <p className="p-4 text-center">कोई ऑर्डर नहीं मिला।</p>;

  return (
    <div className="space-y-6">
      {orders.map((order) => {
        // 🛑 महत्वपूर्ण सुधार: items को ढूँढने का तरीका
        const displayItems = order.items || order.orderItems || [];

        return (
          <Card key={order.id} className="overflow-hidden border-2">
            <CardHeader className="bg-muted/30 pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-md">ऑर्डर #{order.orderNumber || order.id}</CardTitle>
                <Badge variant={getStatusBadgeVariant(order.status) as any}>{getStatusText(order.status)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {/* ग्राहक और भुगतान जानकारी */}
              <div className="grid grid-cols-2 gap-2 text-sm mb-4 bg-blue-50/50 p-2 rounded">
                <p>👤 {order.deliveryAddress?.fullName || "अज्ञात ग्राहक"}</p>
                <p className="text-right font-bold text-green-700">₹{formatPrice(order.total)}</p>
                <p className="text-xs text-muted-foreground">💳 {order.paymentMethod} ({order.paymentStatus})</p>
                <p className="text-xs text-right text-muted-foreground">{order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : ""}</p>
              </div>

              {/* 📦 प्रोडक्ट्स की लिस्ट - यहाँ दिखेगा सामान */}
              <div className="space-y-3 border-t pt-3">
                <p className="text-xs font-bold uppercase text-muted-foreground flex items-center">
                  <Package className="w-3 h-3 mr-1" /> सामान की सूची:
                </p>
                {displayItems.length > 0 ? (
                  displayItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-muted/20 p-2 rounded-lg">
                      <div className="flex items-center gap-3">
                        <img 
                          src={item.productImage || item.product?.image || "/placeholder.png"} 
                          className="w-10 h-10 object-cover rounded shadow-sm"
                          alt="product"
                        />
                        <div>
                          <p className="text-sm font-medium leading-none">{item.productName || item.product?.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">मात्रा: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold">₹{formatPrice(item.productPrice || item.unitPrice)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-destructive italic">आइटम्स लोड नहीं हो पाए!</p>
                )}
              </div>

              {/* एक्शन्स */}
              <div className="flex gap-2 mt-5 pt-3 border-t">
                {renderStatusActions(order)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
