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
import { Package, MapPin } from "lucide-react"; // MapPin आइकॉन जोड़ा
import { useNavigate } from "react-router-dom"; // नेविगेशन के लिए

// ... (getStatusBadgeVariant और getStatusText पहले जैसे ही रहेंगे) ...

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
  orders: any[] | undefined;
  isLoading: boolean;
  error: any;
  seller: any;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { socket } = useSocket();
  const navigate = useNavigate(); // ✅ हुक जोड़ा

  useEffect(() => {
    if (!socket) return;
    const onOrderUpdated = (updated: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] });
      toast({ title: "ऑर्डर अपडेट हुआ", description: `स्टेटस: ${getStatusText(updated.status)}` });
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
      toast({ title: "सफलता", description: "स्टेटस अपडेट हो गया" });
    },
  });

  const handleStatusUpdate = (subOrderId: number, newStatus: string) => {
    mutation.mutate({ subOrderId, status: newStatus });
  };

  const renderStatusActions = (order: any) => {
    if (!seller || seller.approvalStatus !== "approved") return null;
    const s = order.status;

    // 🛰️ लाइव ट्रैकिंग बटन - जब राइडर मिल गया हो और ऑर्डर रास्ते में हो
    const canTrack = order.deliveryBoyId && ["picked_up", "out_for_delivery", "ready_for_pickup"].includes(s);

    return (
      <div className="flex flex-col w-full gap-2">
        <div className="flex gap-2">
          {s === "pending" && (
            <>
              <Button className="flex-1 bg-green-600" onClick={() => handleStatusUpdate(order.id, "accepted")}>स्वीकार करें</Button>
              <Button variant="destructive" onClick={() => handleStatusUpdate(order.id, "rejected")}>अस्वीकार करें</Button>
            </>
          )}
          {s === "accepted" && <Button className="w-full bg-blue-600" onClick={() => handleStatusUpdate(order.id, "preparing")}>तैयारी शुरू करें</Button>}
          {s === "preparing" && <Button className="w-full bg-orange-500" onClick={() => handleStatusUpdate(order.id, "ready_for_pickup")}>पिकअप के लिए तैयार</Button>}
          {s === "ready_for_pickup" && order.isSelfDeliveryBySeller && (
            <Button className="w-full bg-green-700" onClick={() => handleStatusUpdate(order.id, "delivered_by_seller")}>डिलीवर हो गया</Button>
          )}
        </div>

        {/* ✅ लाइव ट्रैकिंग बटन यहाँ दिखेगा */}
        {canTrack && (
          <Button 
            variant="outline" 
            className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
            onClick={() => navigate(`/track-order/${order.id}`)}
          >
            <MapPin className="w-4 h-4 mr-2" /> लाइव ट्रैकिंग देखें
          </Button>
        )}
      </div>
    );
  };

  const formatPrice = (value: any) => {
    const num = Number(value);
    return isFinite(num) ? num.toFixed(2) : "0.00";
  };

  if (isLoading) return <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-48 w-full" />)}</div>;
  if (error) return <p className="text-red-500 p-4 text-center">ऑर्डर लोड करने में त्रुटि</p>;
  if (!orders || orders.length === 0) return <p className="p-8 text-center text-muted-foreground">अभी कोई ऑर्डर नहीं है।</p>;

  return (
    <div className="space-y-6">
      {orders.map((order) => {
        const displayItems = order.items || order.orderItems || [];
        return (
          <Card key={order.id} className="overflow-hidden border-2 shadow-sm">
            <CardHeader className="bg-muted/30 pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-md">ऑर्डर #{order.orderNumber || order.id}</CardTitle>
                  <p className="text-[10px] text-muted-foreground">{order.createdAt ? new Date(order.createdAt).toLocaleString() : ""}</p>
                </div>
                <Badge variant={getStatusBadgeVariant(order.status) as any}>{getStatusText(order.status)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-2 text-sm mb-4 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                <p className="font-medium">👤 {order.deliveryAddress?.fullName || "अज्ञात ग्राहक"}</p>
                <p className="text-right font-bold text-green-700">₹{formatPrice(order.total)}</p>
                <p className="text-xs text-muted-foreground capitalize">💳 {order.paymentMethod} ({order.paymentStatus})</p>
                {order.deliveryBoy && <p className="text-xs text-right text-blue-600">🛵 {order.deliveryBoy.name}</p>}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center tracking-wider">
                  <Package className="w-3 h-3 mr-1" /> सामान की सूची
                </p>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {displayItems.length > 0 ? (
                    displayItems.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between bg-muted/20 p-2 rounded-md border border-transparent hover:border-muted-foreground/20 transition-all">
                        <div className="flex items-center gap-3">
                          <img 
                            src={item.productImage || item.product?.image || "/placeholder.png"} 
                            className="w-10 h-10 object-cover rounded bg-white"
                            alt="product"
                          />
                          <div>
                            <p className="text-sm font-medium leading-tight">{item.productName || item.product?.name}</p>
                            <p className="text-xs text-muted-foreground">मात्रा: {item.quantity}</p>
                          </div>
                        </div>
                        <p className="text-xs font-semibold">₹{formatPrice(item.productPrice || item.unitPrice)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-destructive italic p-2 text-center">आइटम्स लोड नहीं हो पाए!</p>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t">
                {renderStatusActions(order)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
            }
