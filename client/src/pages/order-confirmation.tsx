import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Package, MapPin, Clock, Phone } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useSocket } from "@/hooks/useSocket";

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: string;
  deliveryCharge: string;
  total: string;
  deliveryAddress: {
    fullName: string;
    address: string;
    city: string;
    pincode: string;
    landmark?: string;
    phone: string;
  };
  deliveryInstructions?: string;
  estimatedDeliveryTime?: string | null;
  createdAt: string;
  items: Array<{
    id: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    product: {
      id: number;
      name: string;
      nameHindi?: string | null;
      image: string;
      unit: string;
      brand?: string | null;
    };
  }>;
}

export default function OrderConfirmation() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const queryClient = useQueryClient();
  const socket = useSocket();

  // Order data fetch
  const { data: order, isLoading, isError, error } = useQuery<Order>({
    queryKey: ["order", orderId],
    queryFn: async () => {
      if (!orderId) throw new Error("Order ID is missing.");
      return await apiRequest("GET", `/api/order-confirmation/${orderId}`);
    },
    enabled: !!orderId && isAuthenticated && !isLoadingAuth,
  });

  // ✅ Socket real-time updates (Safe)
  useEffect(() => {
    if (!socket || typeof socket.on !== "function" || !orderId) return;

    const handleUpdate = (data: { orderId: number }) => {
      if (data.orderId === Number(orderId)) {
        console.log("📦 Order updated:", data);
        queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      }
    };

    socket.on("order:update", handleUpdate);

    return () => {
      socket.off("order:update", handleUpdate);
    };
  }, [socket, orderId, queryClient]);

  if (isLoading || isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h3 className="text-lg font-medium mb-2">Error</h3>
            <p className="text-gray-600 mb-4">{(error as Error).message}</p>
            <Button onClick={() => navigate("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">Order not found</h3>
            <p className="text-gray-600 mb-4">
              The order you're looking for doesn't exist.
            </p>
            <Button onClick={() => navigate("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const estimatedTime = order.estimatedDeliveryTime
    ? new Date(order.estimatedDeliveryTime).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not available";

  const deliveryAddress = order.deliveryAddress;
  const deliveryInstructions = order.deliveryInstructions;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Success Header */}
        <div className="text-center mb-8">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Order Confirmed!
          </h1>
          <p className="text-lg text-gray-600">
            Thank you for your order. We'll deliver it within 1 hour.
          </p>
        </div>

        {/* Order Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="font-medium">Order Number:</span>
              <span>{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Status:</span>
              <Badge>{order.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Estimated Delivery:</span>
              <span>{estimatedTime}</span>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Delivery Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-gray-500" />
              <span>
                {deliveryAddress.address}, {deliveryAddress.city} - {deliveryAddress.pincode}
              </span>
            </div>
            <div className="flex items-center">
              <Phone className="h-5 w-5 mr-2 text-gray-500" />
              <span>{deliveryAddress.phone}</span>
            </div>
            {deliveryInstructions && (
              <div className="flex items-center">
                <Clock className="h-5 w-5 mr-2 text-gray-500" />
                <span>{deliveryInstructions}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex items-center space-x-4">
                  <img
                    src={item.product?.image || "https://placehold.co/64x64/E2E8F0/1A202C?text=No+Img"}
                    alt={item.product?.name || "No Name"}
                    className="h-16 w-16 rounded object-cover"
                  />
                  <div>
                    <p className="font-medium">{item.product?.name || "उत्पाद डेटा अनुपलब्ध"}</p>
                    <p className="text-sm text-gray-600">
                      {item.quantity} x ₹{item.unitPrice}
                    </p>
                  </div>
                </div>
                <span className="font-medium">₹{item.totalPrice}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <Button onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </div>
    </div>
  );
}
