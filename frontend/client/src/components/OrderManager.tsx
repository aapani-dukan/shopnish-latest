// client/src/pages/seller/ordermanager.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"; // ✅ Corrected import paths
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient, useMutation } from "@tanstack/react-query";
// ✅ Assuming these types are correctly defined in shared/backend/schema
import type { Seller, OrderWithItems, OrderStatusEnum } from "shared/backend/schema";
import { apiRequest } from "@/lib/queryclient";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/usesocket";
import { useEffect } from "react";

// ✅ Extend OrderWithItems for consistency, assuming deliveryBoy is part of the order response
//    If deliveryBoy is NOT part of OrderWithItems in schema, this is correct.
//    If it IS, then OrderWithItems should be updated in schema directly.
interface OrderWithDeliveryBoy extends OrderWithItems {
  deliveryBoy?: { // ✅ Corrected to camelCase
    id: number;
    name: string;
    phone: string;
  };
}

interface OrderManagerProps {
  orders: OrderWithDeliveryBoy[]; // ✅ Using the extended interface
  isLoading: boolean;
  error: Error | null; // ✅ Using standard Error type
  seller: Seller | null;
}

const getStatusBadgeVariant = (status: string) => { // ✅ Consistent casing
  switch (status) {
    case "pending": return "secondary";
    case "accepted": return "info";
    case "preparing": return "warning";
    case "ready_for_pickup": return "info";
    case "picked_up": return "info";
    case "out_for_delivery": return "warning";
    case "delivered": return "success";
    case "cancelled":
    case "rejected": return "destructive";
    default: return "secondary";
  }
};

const getStatusText = (status: string) => { // ✅ Consistent casing
  switch (status) {
    case "pending": return "लंबित";
    case "accepted": return "स्वीकृत";
    case "preparing": return "तैयार हो रहा है";
    case "ready_for_pickup": return "पिकअप के लिए तैयार";
    case "picked_up": return "पिकअप किया गया";
    case "out_for_delivery": return "डिलीवरी के लिए निकला";
    case "delivered": return "डिलीवर किया गया";
    case "cancelled": return "रद्द कर दिया गया";
    case "rejected": return "अस्वीकृत";
    default: return "अज्ञात";
  }
};

export default function OrderManager({ // ✅ Consistent casing
  orders,
  isLoading,
  error,
  seller,
}: OrderManagerProps) { // ✅ Using updated interface
  const queryClient = useQueryClient(); // ✅ Consistent casing
  const { toast } = useToast();
  const { socket } = useSocket();

  // ---------------- socket.io listeners ----------------
  useEffect(() => {
    if (!socket || !seller) return;

    const handleOrderUpdate = (updatedOrder: OrderWithItems) => { // ✅ Consistent casing
      queryClient.setQueryData<OrderWithItems[]>(["/api/sellers/orders"], (old) =>
        old ? old.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)) : [updatedOrder]
      );

      toast({
        title: "ऑर्डर अपडेट किया गया", // ✅ Consistent casing and translation
        description: `ऑर्डर #${updatedOrder.id} → ${getStatusText(updatedOrder.status)}`,
      });
    };

    const handleNewOrderForSeller = (newOrder: OrderWithDeliveryBoy) => { // ✅ Consistent casing
      queryClient.setQueryData<OrderWithDeliveryBoy[]>(["/api/sellers/orders"], (old) =>
        old ? [newOrder, ...old] : [newOrder]
      );

      toast({
        title: "नया ऑर्डर प्राप्त हुआ", // ✅ Consistent casing and translation
        description: `ऑर्डर #${newOrder.id} आया है।`,
      });
    };

    // event listeners
    socket.on("order-updated-for-seller", handleOrderUpdate);
    socket.on("new-order-for-seller", handleNewOrderForSeller);

    return () => {
      socket.off("order-updated-for-seller", handleOrderUpdate);
      socket.off("new-order-for-seller", handleNewOrderForSeller);
    };
    // ✅ Add all necessary dependencies
  }, [socket, seller, queryClient, toast]); // ✅ Corrected casing for dependencies


  // ---------------- mutation (status update) ----------------
  const { mutate, isPending } = useMutation({ // ✅ Consistent casing
    mutationFn: async ({ orderId, newStatus }: { orderId: number; newStatus: string }) => { // ✅ Consistent casing
      // ✅ Validate newStatus against the enum from schema
      // This assumes OrderStatusEnum is an object with a .enum property containing valid values
      // Example: OrderStatusEnum = { enum: ["pending", "accepted", ...] }
      // If schema exports an array directly, adjust this line.
      const validStatuses = Object.values(OrderStatusEnum); 
      if (!validStatuses.includes(newStatus)) {
        throw new Error("Invalid order status provided."); // ✅ Using standard Error
      }
      return await apiRequest("patch", `/api/sellers/orders/${orderId}/status`, { newStatus }); // ✅ Consistent casing
    },
    onSuccess: () => { // ✅ Consistent casing
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] }); // ✅ Consistent casing
      toast({
        title: "ऑर्डर की स्थिति अपडेट हुई", // ✅ Consistent casing and translation
        description: "ऑर्डर की स्थिति सफलतापूर्वक अपडेट की गई है।",
      });
    },
    onError: (err: Error) => { // ✅ Using standard Error type
      toast({
        title: "त्रुटि", // ✅ Translation
        description: err.message || "ऑर्डर की स्थिति अपडेट करने में विफल।", // ✅ Translation
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = (orderId: number, newStatus: string) => { // ✅ Consistent casing
    mutate({ orderId, newStatus }); // ✅ Consistent casing
  };

  // ---------------- render helpers ----------------
  const renderStatusActions = (order: OrderWithItems) => { // ✅ Consistent casing
    // ✅ Ensure seller is approved before showing action buttons
    if (seller?.approvalStatus !== "approved") {
      return <p className="text-sm text-yellow-600">प्रोफ़ाइल स्वीकृत होने की प्रतीक्षा है।</p>;
    }

    switch (order.status) {
      case "pending":
      case "placed": // 'placed' status handled here as well
        return (
          <>
            <Button variant="success" onClick={() => handleStatusUpdate(order.id, "accepted")} disabled={isPending}> {/* ✅ Consistent casing */}
              स्वीकार करें
            </Button>
            <Button variant="destructive" onClick={() => handleStatusUpdate(order.id, "rejected")} disabled={isPending}> {/* ✅ Consistent casing */}
              अस्वीकार करें
            </Button>
          </>
        );
      case "accepted":
        return (
          <Button onClick={() => handleStatusUpdate(order.id, "preparing")} disabled={isPending}> {/* ✅ Consistent casing */}
            तैयार करना शुरू करें
          </Button>
        );
      case "preparing":
        return (
          <Button onClick={() => handleStatusUpdate(order.id, "ready_for_pickup")} disabled={isPending}> {/* ✅ Consistent casing */}
            पिकअप के लिए तैयार
          </Button>
        );
      case "ready_for_pickup":
        // ✅ Optionally show "Waiting for Delivery Boy" or similar
        return <p className="text-sm text-blue-600">डिलीवरी बॉय का इंतज़ार है...</p>;
      default:
        return null;
    }
  };

  const renderContent = () => { // ✅ Consistent casing
    if (isLoading) return ( // ✅ Consistent casing
      <div className="space-y-4"> {/* ✅ Consistent casing */}
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)} {/* ✅ Consistent casing */}
      </div>
    );

    if (error) return <p className="text-red-500">ऑर्डर लोड करने में त्रुटि: {error.message}</p>;
    if (!orders || orders.length === 0) return <p className="text-muted-foreground">अभी कोई ऑर्डर नहीं है।</p>;

    return (
      <div className="space-y-4"> {/* ✅ Consistent casing */}
        {orders.map((order: OrderWithDeliveryBoy) => ( // ✅ Using the extended interface
          <div key={order.id} className="border rounded-lg p-4 mb-4"> {/* ✅ Consistent casing */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-2"> {/* ✅ Consistent casing */}
              <h2 className="font-bold text-lg">ऑर्डर #{order.orderNumber || order.id}</h2> {/* ✅ Consistent casing */}
              <div className="flex items-center space-x-2 mt-2 md:mt-0"> {/* ✅ Consistent casing */}
                <Badge variant={getStatusBadgeVariant(order.status as string)}> {/* ✅ Consistent casing */}
                  {getStatusText(order.status)} {/* ✅ Consistent casing */}
                </Badge>
              </div>
            </div>

            {order.customer && order.deliveryAddress && ( // ✅ Consistent casing
              <p className="text-sm">ग्राहक: <strong>{order.customer.firstName || order.deliveryAddress.fullName || "अज्ञात"}</strong></p> // ✅ Consistent casing
            )}

            {order.deliveryBoy && ( // ✅ Consistent casing
              <div className="mt-2 p-3 border-l-4 border-blue-500 bg-blue-50/50 rounded"> {/* ✅ Consistent casing */}
                <p className="text-sm font-semibold text-blue-700">🚚 डिलीवरी बॉय असाइन</p>
                <p className="text-sm">नाम: <strong>{order.deliveryBoy.name}</strong></p> {/* ✅ Consistent casing */}
                <p className="text-sm">फ़ोन: <strong>{order.deliveryBoy.phone}</strong></p> {/* ✅ Consistent casing */}
              </div>
            )}

            <p className="text-sm text-muted-foreground">भुगतान: <strong>{order.paymentMethod || "लागू नहीं"}</strong> ({order.paymentStatus || "लंबित"})</p> {/* ✅ Consistent casing */}
            <p className="text-sm text-muted-foreground">कुल: <strong>₹{Number(order.total ?? 0).toLocaleString()}</strong></p> {/* ✅ Consistent casing and safe Number conversion */}
            <p className="text-sm text-muted-foreground">ऑर्डर किया गया: {new Date(order.createdAt).toLocaleString()}</p> {/* ✅ Consistent casing */}

            <div className="mt-4 space-y-3"> {/* ✅ Consistent casing */}
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center space-x-4"> {/* ✅ Consistent casing */}
                  <img src={item.product?.image || "/placeholder.png"} alt={item.product?.name || item.name || "product"} className="w-12 h-12 object-cover rounded" /> {/* ✅ Consistent casing */}
                  <div>
                    <p className="font-semibold">{item.product?.name || item.name || "अनाम उत्पाद"}</p> {/* ✅ Consistent casing */}
                    <p className="text-sm text-gray-500">मात्रा: {item.quantity} × ₹{Number(item.unitPrice ?? item.product?.price ?? 0).toLocaleString()}</p> {/* ✅ Consistent casing and safe Number conversion */}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex mt-6 space-x-2">{renderStatusActions(order)}</div> {/* ✅ Consistent casing */}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card> {/* ✅ Consistent casing */}
      <CardHeader> {/* ✅ Consistent casing */}
        <CardTitle>आपके ऑर्डर्स</CardTitle> {/* ✅ Consistent casing */}
      </CardHeader>
      <CardContent>{renderContent()}</CardContent> {/* ✅ Consistent casing */}
    </Card>
  );
}
