import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { CheckCircle, Package, MapPin, Clock, Phone, Store } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { apiRequest } from "../lib/queryClient";
import { useSocket } from "../hooks/useSocket";

export interface Product {
  id: number;
  name: string;
  nameHindi?: string | null;
  image: string;
  unit: string;
  brand?: string | null;
  storeId?: number;
  store?: StoreType;
}

export interface OrderItem {
  id: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: Product;
}

export interface DeliveryAddress {
  fullName: string;
  address: string;
  city: string;
  pincode: string;
  landmark?: string;
  phone: string;
}

export interface StoreType {
  id: number;
  storeName: string;
  address: string;
  phone: string;
}

export interface SubOrder {
  id: number;
  sellerId: number;
  sellerName?: string;
  sellerBusinessName?: string;
  status: string;
  deliveryStatus: string;
  subTotal: string | number;
  deliveryCharge: string | number;
  total: string | number;
  items: OrderItem[];
  deliveryBoyId?: number;
  store?: StoreType;
}

export interface MainOrder {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subTotal: string | number;
  deliveryCharge: string | number;
  total: string | number;
  deliveryAddress: DeliveryAddress;
  deliveryInstructions?: string;
  estimatedDeliveryTime?: string | null;
  createdAt: string;
  items: OrderItem[]; // Fallback for single-seller orders or overall items
  subOrders?: SubOrder[];
}

export default function OrderConfirmation() {
  const { orderid } = useParams<{ orderid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const queryParams = new URLSearchParams(location.search);
  const sellerId = queryParams.get('sellerId') ? Number(queryParams.get('sellerId')) : null;

  const { data: mainOrder, isLoading, isError, error } = useQuery<MainOrder>({
    queryKey: ["order", orderid, { sellerId }],
    queryFn: async () => {
      if (!orderid) throw new Error("Order ID is missing.");
      const url = sellerId 
        ? `/api/customer/orders/${orderid}?sellerId=${sellerId}` 
        : `/api/customer/orders/${orderid}`; // Updated API endpoint for customer orders
      return await apiRequest("get", url);
    },
    enabled: !!orderid && isAuthenticated && !isLoadingAuth,
  });

  const orderToDisplay = React.useMemo(() => {
    if (!mainOrder) return null;
    if (sellerId && mainOrder.subOrders) {
      return mainOrder.subOrders.find(sub => sub.sellerId === sellerId) || null;
    }
    return mainOrder;
  }, [mainOrder, sellerId]);

  useEffect(() => {
    if (!socket || typeof socket.on !== "function" || !orderid) return;

    const handleUpdate = (data: { orderId: number; sellerId?: number }) => {
      if (data.orderId === Number(orderid)) {
        if (sellerId && data.sellerId && data.sellerId === sellerId) {
          queryClient.invalidateQueries({ queryKey: ["order", orderid, { sellerId }] });
        } else if (!sellerId && !data.sellerId) {
          queryClient.invalidateQueries({ queryKey: ["order", orderid] });
        } else if (!sellerId && data.sellerId) { // Main order update might affect sub-orders
          queryClient.invalidateQueries({ queryKey: ["order", orderid] });
        }
      }
    };

    socket.on("order:update", handleUpdate);
    socket.on("suborder:status-updated", handleUpdate); // Listen for sub-order specific updates

    return () => {
      socket.off("order:update", handleUpdate);
      socket.off("suborder:status-updated", handleUpdate);
    };
  }, [socket, orderid, queryClient, sellerId]);

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

  if (!orderToDisplay || !mainOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">Order Not Found</h3>
            <p className="text-gray-600 mb-4">
              The order or sub-order you're looking for doesn't exist.
            </p>
            <Button onClick={() => navigate("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  const estimatedTime = mainOrder.estimatedDeliveryTime
    ? new Date(mainOrder.estimatedDeliveryTime).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not Available";

  const itemsToDisplay = (orderToDisplay as SubOrder).items || (orderToDisplay as MainOrder).items;
  const currentStatus = orderToDisplay.status;
  const currentTotal = Number(orderToDisplay.total).toLocaleString('en-IN');
  const currentSubtotal = Number(orderToDisplay.subTotal || 0).toLocaleString('en-IN');
  const currentDeliveryCharge = Number(orderToDisplay.deliveryCharge || 0).toLocaleString('en-IN');
  const sellerDetails = (orderToDisplay as SubOrder).sellerBusinessName || (orderToDisplay as SubOrder).sellerName;
  const storeDetails = (orderToDisplay as SubOrder).store;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Order Confirmed!
          </h1>
          <p className="text-lg text-gray-600">
            Thank you for your order. We'll deliver it within 1 hour.
          </p>
          {sellerDetails && (
             <p className="text-md font-semibold text-gray-700 mt-2">
               ({sellerDetails})
             </p>
           )}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="font-medium">Order Number:</span>
              <span>{mainOrder.orderNumber}{sellerId ? ` (Seller ID: ${sellerId})` : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Status:</span>
              <Badge>{getStatusText(currentStatus)}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Estimated Delivery:</span>
              <span>{estimatedTime}</span>
            </div>
            {storeDetails && (
              <div className="flex justify-between">
                <span className="font-medium">Store:</span>
                <span>{storeDetails.storeName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-medium">Payment Method:</span>
              <span>{mainOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</span>
            </div>
             <div className="flex justify-between">
              <span className="font-medium">Payment Status:</span>
              <Badge variant={mainOrder.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                {mainOrder.paymentStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Delivery Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-gray-500" />
              <span>
                {mainOrder.deliveryAddress.address}, {mainOrder.deliveryAddress.city} - {mainOrder.deliveryAddress.pincode}
              </span>
            </div>
            <div className="flex items-center">
              <Phone className="h-5 w-5 mr-2 text-gray-500" />
              <span>{mainOrder.deliveryAddress.phone}</span>
            </div>
            {mainOrder.deliveryInstructions && (
              <div className="flex items-center">
                <Clock className="h-5 w-5 mr-2 text-gray-500" />
                <span>{mainOrder.deliveryInstructions}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{sellerDetails ? `${sellerDetails}'s Items` : 'Order Items'}</CardTitle>
          </CardHeader>
          <CardContent>
            {itemsToDisplay && itemsToDisplay.length > 0 ? (
              itemsToDisplay.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center space-x-4">
                    <img
                      src={item.product?.image || "https://placehold.co/64x64/e2e8f0/1a202c?text=No+Img"}
                      alt={item.product?.name || "No Name"}
                      className="h-16 w-16 rounded object-cover"
                    />
                    <div>
                      <p className="font-medium">{item.product?.name || "Product data not available"}</p>
                      <p className="text-sm text-gray-600">
                        {item.quantity} x ₹{Number(item.unitPrice).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <span className="font-medium">₹{Number(item.totalPrice).toLocaleString('en-IN')}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No items available for this order/sub-order.</p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Bill Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>₹{currentSubtotal}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Delivery Charge</span>
              <span>₹{currentDeliveryCharge}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
              <span>Total</span>
              <span>₹{currentTotal}</span>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </div>
    </div>
  );
}
