// client/src/pages/seller/ordermanager.tsx
import { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { Package, MapPin, User, CreditCard, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

// --- TYPES (आपके पुराने कोड के अनुसार सुरक्षित) ---
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
  orderItems?: OrderItem[]; // एक्स्ट्रा सेफ्टी के लिए
  deliveryBoy?: DeliveryBoy;
  deliveryBoyId?: number | null;
};

// Allowed statuses (आपके पुराने कोड का सटीक एरे)
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
    case "delivered_by_seller":
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
  orders: OrderWithDeliveryBoy[] | undefined;
  isLoading: boolean;
  error: any;
  seller: any;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { socket } = useSocket();
  const navigate = useNavigate();

  // --- SOCKET LISTENERS (आपके पुराने लॉजिक के अनुसार) ---
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

  // --- MUTATION ---
  const mutation = useMutation({
    mutationFn: async ({ subOrderId, status }: { subOrderId: number; status: string }) => {
      if (!VALID_STATUSES.includes(status)) {
        throw new Error("Invalid order status provided.");
      }
      return apiRequest("PATCH", `/api/sellers/sub-orders/${subOrderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] });
      toast({ title: "सफलता", description: "ऑर्डर की स्थिति सफलतापूर्वक अपडेट की गई।" });
    },
    onError: (err: any) => {
      toast({
        title: "त्रुटि",
        description: err?.response?.data?.error || err?.message || "स्थिति अपडेट विफल",
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = (subOrderId: number, newStatus: string) => {
    mutation.mutate({ subOrderId, status: newStatus });
  };

  const renderStatusActions = (order: OrderWithDeliveryBoy) => {
    if (!seller || seller.approvalStatus !== "approved") {
      return <p className="text-sm text-yellow-600">प्रोफ़ाइल स्वीकृत होने की प्रतीक्षा है।</p>;
    }

    const s = order.status;
    const canTrack = (order.deliveryBoy || order.deliveryBoyId) && ["picked_up", "out_for_delivery", "ready_for_pickup"].includes(s);

    return (
      <div className="flex flex-col w-full gap-3 mt-4">
        <div className="flex flex-wrap gap-2">
          {s === "pending" && (
            <>
              <Button className="bg-green-600 hover:bg-green-700 flex-1" onClick={() => handleStatusUpdate(order.id, "accepted")} disabled={mutation.isPending}>
                स्वीकार करें
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => handleStatusUpdate(order.id, "rejected")} disabled={mutation.isPending}>
                अस्वीकार करें
              </Button>
            </>
          )}
          {s === "accepted" && (
            <>
              <Button className="bg-blue-600 w-full" onClick={() => handleStatusUpdate(order.id, "preparing")} disabled={mutation.isPending}>
                तैयारी शुरू करें
              </Button>
              <Button variant="ghost" className="w-full text-red-500" onClick={() => handleStatusUpdate(order.id, "rejected")} disabled={mutation.isPending}>
                अस्वीकार करें
              </Button>
            </>
          )}
          {s === "preparing" && (
            <Button className="bg-orange-500 w-full" onClick={() => handleStatusUpdate(order.id, "ready_for_pickup")} disabled={mutation.isPending}>
              पिकअप के लिए तैयार करें
            </Button>
          )}
          {s === "ready_for_pickup" && order.isSelfDeliveryBySeller && (
            <Button className="bg-green-700 w-full" onClick={() => handleStatusUpdate(order.id, "delivered_by_seller")} disabled={mutation.isPending}>
              डिलीवर के रूप में चिह्नित करें
            </Button>
          )}
          {s === "ready_for_pickup" && !order.isSelfDeliveryBySeller && !order.deliveryBoy && (
            <p className="text-sm text-blue-600 italic animate-pulse">डिलीवरी बॉय का इंतज़ार है...</p>
          )}
        </div>

        {/* LIVE TRACKING BUTTON */}
        {canTrack && (
          <Button 
            variant="outline" 
            className="w-full border-blue-500 text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2"
            onClick={() => navigate(`/track-order/${order.id}`)}
          >
            <MapPin className="w-4 h-4" /> लाइव ट्रैकिंग देखें
          </Button>
        )}
      </div>
    );
  };

  const formatPrice = (value: any) => {
    const num = Number(value);
    return isFinite(num) ? num.toFixed(2) : "0.00";
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}</div>;
    }
    if (error) return <p className="text-red-500 p-4">ऑर्डर लोड करने में त्रुटि: {error?.message}</p>;
    if (!orders || orders.length === 0) return <p className="text-muted-foreground p-8 text-center">अभी कोई ऑर्डर नहीं है।</p>;

    return (
      <div className="space-y-6">
        {orders.map(order => {
          const displayItems = order.items || order.orderItems || [];
          return (
            <div key={order.id} className="border-2 rounded-xl overflow-hidden shadow-sm bg-card transition-all hover:shadow-md">
              {/* Header */}
              <div className="bg-muted/30 p-4 border-b flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-lg">ऑर्डर #{order.orderNumber || order.id}</h2>
                  <div className="flex items-center text-[10px] text-muted-foreground gap-1">
                    <Clock className="w-3 h-3" /> {order.createdAt ? new Date(order.createdAt).toLocaleString() : "—"}
                  </div>
                </div>
                <Badge variant={getStatusBadgeVariant(order.status) as any}>{getStatusText(order.status)}</Badge>
              </div>

              <div className="p-4 space-y-4">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/20 rounded-lg border border-secondary/30">
                  <div className="flex items-start gap-2 text-sm">
                    <User className="w-4 h-4 mt-0.5 text-muted-foreground" />
                    <div className="overflow-hidden">
                      <p className="font-semibold truncate">
                        {order.customer?.firstName ? `${order.customer.firstName} ${order.customer.lastName || ""}` : (order.deliveryAddress?.fullName || "अज्ञात")}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{order.deliveryAddress?.address || "No address"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">₹{formatPrice(order.total)}</p>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground uppercase">
                      <CreditCard className="w-3 h-3" /> {order.paymentMethod || "COD"}
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Package className="w-3 h-3" /> आइटम्स ({displayItems.length})
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {displayItems.length > 0 ? (
                      displayItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-2 bg-muted/10 rounded-lg border border-transparent hover:border-muted-foreground/10">
                          <img 
                            src={item.productImage || item.product?.image || "/placeholder.png"} 
                            alt="prod" 
                            className="w-10 h-10 object-cover rounded bg-white border" 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.productName || item.product?.name || "अनाम उत्पाद"}</p>
                            <p className="text-xs text-muted-foreground">मात्रा: {item.quantity} × ₹{formatPrice(item.productPrice || item.unitPrice)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-destructive italic">आइटम्स लोड नहीं हो पाए।</p>
                    )}
                  </div>
                </div>

                {/* Delivery Boy Info */}
                {order.deliveryBoy && (
                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-100 text-blue-700">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      <span>राइडर: <strong>{order.deliveryBoy.name}</strong></span>
                    </div>
                    {order.deliveryBoy.phone && <span className="text-[10px]">{order.deliveryBoy.phone}</span>}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2">
                  {renderStatusActions(order)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="shadow-none border-none">
      <CardHeader className="px-0">
        <CardTitle className="text-xl flex items-center gap-2">
           आपके सक्रिय ऑर्डर्स
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">{renderContent()}</CardContent>
    </Card>
  );
               }
