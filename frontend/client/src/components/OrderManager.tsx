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
    case "delivered_by_seller": return "डिलीवर किया गया";
    default: return status;
  }
};

export default function OrderManager({
  orders,
  isLoading,
  error,
  seller,
}: {
  orders: OrderWithDeliveryBoy[] | undefined;
  isLoading: boolean;
  error: any;
  seller: any;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { socket } = useSocket();

  // keep socket listeners to update UI in realtime
  useEffect(() => {
    if (!socket) return;

    const onOrderUpdated = (updated: any) => {
      queryClient.setQueryData<OrderWithDeliveryBoy[]>(["/api/sellers/orders"], (old) =>
        old ? old.map(o => (o.id === updated.id ? updated : o)) : [updated]
      );
      toast({
        title: "ऑर्डर अपडेट हुआ",
        description: `ऑर्डर #${updated.orderNumber || updated.id} → ${getStatusText(updated.status)}`,
      });
    };
    const onNewOrder = (newOrder: any) => {
      queryClient.setQueryData<OrderWithDeliveryBoy[]>(["/api/sellers/orders"], (old) =>
        old ? [newOrder, ...old] : [newOrder]
      );
      toast({
        title: "नया ऑर्डर!",
        description: `ऑर्डर #${newOrder.orderNumber || newOrder.id} आया`,
      });
    };

    socket.on("order-updated-for-seller", onOrderUpdated);
    socket.on("new-order-for-seller", onNewOrder);

    return () => {
      socket.off("order-updated-for-seller", onOrderUpdated);
      socket.off("new-order-for-seller", onNewOrder);
    };
  }, [socket, queryClient, toast]);

  // mutation: PATCH /api/sellers/sub-orders/:id/status
  const mutation = useMutation({
    mutationFn: async ({ subOrderId, status }: { subOrderId: number; status: string }) => {
      if (!VALID_STATUSES.includes(status)) {
        throw new Error("Invalid order status provided.");
      }
      // backend route you shared expects body { status: "<value>" }
      return apiRequest("PATCH", `/api/sellers/sub-orders/${subOrderId}/status`, { status });
    },
    onSuccess: (_data) => {
      // refetch the seller orders
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] });
      toast({
        title: "ऑर्डर की स्थिति अपडेट",
        description: "ऑर्डर की स्थिति सफलतापूर्वक अपडेट की गई।",
      });
    },
    onError: (err: any) => {
      toast({
        title: "त्रुटि",
        description: err?.response?.data?.error || err?.message || "स्थिति अपडेट विफल",
        variant: "destructive",
      });
    },
  });

  // What seller can do from UI (buttons). Keep it aligned to your backend transitions.
  // I implement a safe, simple flow here:
  // - pending -> accepted / rejected
  // - accepted -> ready_for_pickup (seller marks ready)
  // - if seller is self-delivery (isSelfDeliveryBySeller) show "Mark Delivered" to set delivered
  // - otherwise seller's responsibility ends at ready_for_pickup
  // (delivery boy / system moves to picked_up / out_for_delivery / delivered)
  const handleStatusUpdate = (subOrderId: number, newStatus: string) => {
    if (!VALID_STATUSES.includes(newStatus)) {
      toast({ title: "Invalid status", description: `Status ${newStatus} is not allowed.` });
      return;
    }
    mutation.mutate({ subOrderId, status: newStatus });
  };

  const renderStatusActions = (order: OrderWithDeliveryBoy) => {
    if (!seller || seller.approvalStatus !== "approved") {
      return <p className="text-sm text-yellow-600">प्रोफ़ाइल स्वीकृत होने की प्रतीक्षा है।</p>;
    }

    const s = order.status;

    if (s === "pending") {
      return (
        <>
          <Button variant="success" onClick={() => handleStatusUpdate(order.id, "accepted")} disabled={mutation.isLoading}>
            स्वीकार करें
          </Button>
          <Button variant="destructive" onClick={() => handleStatusUpdate(order.id, "rejected")} disabled={mutation.isLoading}>
            अस्वीकार करें
          </Button>
        </>
      );
    }

    if (s === "accepted") {
      // seller marks ready for pickup
      return (
        <>
          <Button onClick={() => handleStatusUpdate(order.id, "preparing")} disabled={mutation.isLoading}>
            तैयारी शुरू करें 
          </Button>
          <Button variant="destructive" onClick={() => handleStatusUpdate(order.id, "rejected")} disabled={mutation.isLoading}>
            अस्वीकार करें
          </Button>
        </>
      );
    }
  if (s === "preparing") {
      // ✅ नया फ्लो: तैयारी से पिकअप के लिए तैयार
      return (
        <>
          <Button variant="secondary" onClick={() => handleStatusUpdate(order.id, "ready_for_pickup")} disabled={mutation.isLoading}>
            पिकअप के लिए तैयार करें
          </Button>
          <Button variant="destructive" onClick={() => handleStatusUpdate(order.id, "rejected")} disabled={mutation.isLoading}>
            अस्वीकार करें
          </Button>
        </>
      );
  }
    if (s === "ready_for_pickup") {
      // If seller does self delivery, allow marking delivered
      if (order.isSelfDeliveryBySeller) {
        return (
          <Button onClick={() => handleStatusUpdate(order.id, "delivered_by_seller")} disabled={mutation.isLoading}>
            डिलीवर के रूप में चिह्नित करें
          </Button>
        );
      }
      return <p className="text-sm text-blue-600">डिलीवरी बॉय का इंतज़ार है...</p>;
    }

    // For other statuses (picked_up, out_for_delivery, delivered, cancelled, rejected) no seller action
    return null;
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      );
    }

    if (error) {
      return <p className="text-red-500">ऑर्डर लोड करने में त्रुटि: {error?.message || String(error)}</p>;
    }

    if (!orders || orders.length === 0) {
      return <p className="text-muted-foreground">अभी कोई ऑर्डर नहीं है।</p>;
    }

    return (
      <div className="space-y-4">
        {orders.map(order => (
          <div key={order.id} className="border rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-lg">ऑर्डर #{order.orderNumber || order.id}</h2>
              <Badge variant={getStatusBadgeVariant(order.status)}>{getStatusText(order.status)}</Badge>
            </div>

            {order.customer && (
              <p className="text-sm">ग्राहक: <strong>{order.customer.firstName ? `${order.customer.firstName} ${order.customer.lastName || ""}` : (order.deliveryAddress?.fullName || "अज्ञात")}</strong></p>
            )}

            <p className="text-sm text-muted-foreground">भुगतान: <strong>{order.paymentMethod || "N/A"}</strong> ({order.paymentStatus || "pending"})</p>
            <p className="text-sm text-muted-foreground">कुल: <strong>₹{Number(order.total ?? 0).toFixed(2)}</strong></p>
            <p className="text-sm text-muted-foreground">ऑर्डर समय: {order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"}</p>

            <div className="mt-4 space-y-3">
              {(order.items || []).map((item: any) => (
                <div key={item.id || `${order.id}-${item.productId}`} className="flex items-center space-x-4">
                  <img src={item.product?.image || item.productImage || "/placeholder.png"} alt={item.product?.name || item.productName || "product"} className="w-12 h-12 object-cover rounded" />
                  <div>
                    <p className="font-semibold">{item.product?.name || item.productName || "अनाम उत्पाद"}</p>
                    <p className="text-sm text-gray-500">मात्रा: {item.quantity} × ₹{Number(item.productPrice ?? item.unitPrice ?? 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex mt-6 space-x-2">{renderStatusActions(order)}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>आपके ऑर्डर्स</CardTitle>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}
