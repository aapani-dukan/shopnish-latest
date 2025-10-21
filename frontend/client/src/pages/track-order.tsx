import React, { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";
import GoogleMapTracker from "../components/GoogleMapTracker";
import {
  Package,
  Truck,
  MapPin,
  Clock,
  Phone,
  CheckCircle,
  User,
  Store,
} from "lucide-react";

// -------------------- Interfaces --------------------

interface Location {
  lat: number;
  lng: number;
  timestamp: string;
}

interface DeliveryAddress {
  fullName: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
}

export interface OrderTracking {
  id: number;
  orderId: number;
  status: string;
  location: string;
  timestamp: string;
  notes: string;
}

interface DeliveryBoy {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface StoreType {
  id: number;
  storeName: string;
  address: string;
  phone: string;
  latitude?: number;
  longitude?: number;
}

export interface Product {
  id: number;
  name: string;
  image?: string;
  unit?: string;
  storeId?: number;
  store?: StoreType;
}

export interface OrderItem {
  id: number;
  quantity: number;
  product: Product;
}

export interface SubOrder {
  id: number;
  sellerId: number;
  sellerName?: string;
  sellerBusinessName?: string;
  status: string;
  deliveryStatus: string;
  total: string | number;
  items: OrderItem[];
  deliveryBoyId?: number;
  deliveryBoy?: DeliveryBoy;
  store?: StoreType;
}

export interface MainOrder {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: string | number;
  deliveryAddress: DeliveryAddress;
  estimatedDeliveryTime: string;
  createdAt: string;
  subOrders?: SubOrder[];
}

// -------------------- Component --------------------

export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const numericOrderId = orderId ? Number(orderId) : null;

  const queryParams = new URLSearchParams(location.search);
  const sellerId = queryParams.get("sellerId") ? Number(queryParams.get("sellerId")) : null;

  const { socket } = useSocket();
  const { user } = useAuth();

  const [deliveryBoyLocation, setDeliveryBoyLocation] = useState<Location | null>(null);

  const { data: mainOrder, isLoading: isMainOrderLoading } = useQuery<MainOrder>({
    queryKey: [`/api/orders/${numericOrderId}`],
    queryFn: async () => {
      const url = sellerId ? `/api/orders/${numericOrderId}?sellerId=${sellerId}` : `/api/orders/${numericOrderId}`;
      const response = await apiRequest("get", url);
      return response;
    },
    enabled: !!numericOrderId,
  });

  const order = useMemo(() => {
    if (!mainOrder) return null;
    if (sellerId && mainOrder.subOrders) {
      return mainOrder.subOrders.find((so) => so.sellerId === sellerId) || null;
    }
    // If no sellerId or no subOrders, treat mainOrder as the primary order
    return mainOrder;
  }, [mainOrder, sellerId]);

  const { data: trackingData, isLoading: isTrackingLoading } = useQuery<OrderTracking[]>({
    queryKey: [`/api/orders/${numericOrderId}/tracking`, { sellerId }],
    queryFn: async () => {
      const url = sellerId ? `/api/orders/${numericOrderId}/tracking?sellerId=${sellerId}` : `/api/orders/${numericOrderId}/tracking`;
      const response = await apiRequest("get", url);
      return response;
    },
    enabled: !!numericOrderId,
  });

  const tracking: OrderTracking[] = Array.isArray(trackingData) ? trackingData : [];

  const effectiveDeliveryBoy = order?.deliveryBoy;
  const effectiveStore = order?.store;
  const effectiveOrderId = order?.id || numericOrderId;

  useEffect(() => {
    const userIdToUse = user?.id || user?.uid;
    if (!socket || !effectiveOrderId || isMainOrderLoading || !userIdToUse) return;

    const handleLocationUpdate = (data: Location & { orderId: number }) => {
      if (data.orderId === effectiveOrderId) {
        setDeliveryBoyLocation({
          lat: data.lat,
          lng: data.lng,
          timestamp: data.timestamp,
        });
        console.log("🛵 New location received:", data.lat, data.lng);
      }
    };

    socket.emit("register-client", { role: "user", userId: userIdToUse });
    socket.emit("join-order-room", { orderId: effectiveOrderId });
    socket.on("order:delivery_location", handleLocationUpdate);

    return () => {
      socket.off("order:delivery_location", handleLocationUpdate);
    };
  }, [socket, effectiveOrderId, isMainOrderLoading, user]);

  if (isMainOrderLoading || isTrackingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!order || !mainOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">Order Not Found</h3>
            <p className="text-gray-600">Unable to track this order or sub-order.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'placed':
      case 'confirmed':
        return 'bg-blue-500';
      case 'preparing':
        return 'bg-yellow-500';
      case 'ready_for_pickup':
      case 'picked_up':
        return 'bg-orange-500';
      case 'out_for_delivery':
        return 'bg-purple-500';
      case 'delivered':
        return 'bg-green-500';
      case 'cancelled':
      case 'rejected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'placed': return 'Order Placed';
      case 'confirmed': return 'Order Confirmed';
      case 'preparing': return 'Preparing Order';
      case 'ready_for_pickup': return 'Ready for Pickup';
      case 'picked_up': return 'Picked Up';
      case 'on_the_way': return 'On The Way'; // Changed from 'out_for_delivery' to 'on_the_way'
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const estimatedTime = new Date(mainOrder.estimatedDeliveryTime).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const orderTime = new Date(mainOrder.createdAt).toLocaleString('en-IN');

  const store = effectiveStore;
  const deliveryBoy = effectiveDeliveryBoy;

  const currentOrderStatus = order.status;
  const lastCompletedIndex = tracking.length > 0 ? tracking.findIndex(t => t.status.toLowerCase() === currentOrderStatus.toLowerCase()) : -1;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Order</h1>
          <p className="text-lg text-gray-600">Order #{mainOrder.orderNumber}{sellerId ? ` (Seller: ${sellerId})` : ''}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Tracking */}
          <div className="lg:col-span-2 space-y-6">
            {(currentOrderStatus === 'picked_up' || currentOrderStatus === 'on_the_way') && deliveryBoy && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    <span>Real-time Tracking</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full h-80">
                    {deliveryBoyLocation && mainOrder.deliveryAddress ? (
                      <GoogleMapTracker
                        deliveryBoyLocation={deliveryBoyLocation}
                        customerAddress={mainOrder.deliveryAddress}
                        storeLocation={store ? {lat: store.latitude || 0, lng: store.longitude || 0} : undefined}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
                        <p>Waiting for delivery partner's location...</p>
                      </div>
                    )}
                  </div>

                  {deliveryBoyLocation && (
                    <div className="p-4 border-t">
                      <p className="text-sm font-medium">Delivery Partner Location Updated:</p>
                      <p className="text-xs text-gray-600">
                        Lat: {deliveryBoyLocation.lat.toFixed(4)}, Lng: {deliveryBoyLocation.lng.toFixed(4)}
                      </p>
                      <p className="text-xs text-gray-600">
                        Last Update: {new Date(deliveryBoyLocation.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Current Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Current Status</span>
                  <Badge className={`${getStatusColor(currentOrderStatus)} text-white`}>
                    {getStatusText(currentOrderStatus)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full ${getStatusColor(currentOrderStatus)} flex items-center justify-center`}>
                    {currentOrderStatus === 'delivered' ? (
                      <CheckCircle className="w-6 h-6 text-white" />
                    ) : currentOrderStatus === 'on_the_way' ? (
                      <Truck className="w-6 h-6 text-white" />
                    ) : (
                      <Package className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-lg">{getStatusText(currentOrderStatus)}</p>
                    <p className="text-gray-600">
                      {currentOrderStatus === 'delivered'
                        ? 'Your order has been delivered successfully.'
                        : currentOrderStatus === 'on_the_way'
                        ? `Arriving by ${estimatedTime}.`
                        : currentOrderStatus === 'preparing'
                        ? 'Your order is being prepared.'
                        : 'Order confirmed and being processed.'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Order Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {tracking.map((step, index) => {
                    const isCompleted = index <= lastCompletedIndex;
                    return (
                      <div key={step.id} className="flex items-center space-x-4">
                        <div className="relative">
                          <div className={`w-4 h-4 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`}>
                            {isCompleted && <CheckCircle className="w-4 h-4 text-white" />}
                          </div>
                          {index < tracking.length - 1 && (
                            <div className={`absolute top-4 left-2 w-0.5 h-6 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`} />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${isCompleted ? 'text-gray-900' : 'text-gray-500'}`}>
                            {getStatusText(step.status)}
                          </p>
                          {step.timestamp && (
                            <p className="text-sm text-gray-600">
                              {new Date(step.timestamp).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Delivery Details */}
            {deliveryBoy && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Delivery Partner</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{deliveryBoy.firstName} {deliveryBoy.lastName}</p>
                      <p className="text-sm text-gray-600">Delivery Partner</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Phone className="w-4 h-4 mr-2" />
                      Call
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Order Total</span>
                    <span className="font-medium">₹{Number(mainOrder.total).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment</span>
                    <Badge variant={mainOrder.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                      {mainOrder.paymentMethod === 'cod' ? 'Cash On Delivery' : 'Paid Online'}
                    </Badge>
                  </div>
                  <hr />
                  <div className="text-sm text-gray-600">
                    <p className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>Estimated Delivery: {estimatedTime}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Store Info */}
            {store && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Store className="w-5 h-5" />
                    <span>Store Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-medium">{store.storeName}</p>
                    <p className="text-sm text-gray-600">{store.address}</p>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-gray-600">Contact Store</span>
                      <Button variant="outline" size="sm">
                        <Phone className="w-4 h-4 mr-2" />
                        Call
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Delivery Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5" />
                  <span>Delivery Address</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium">{mainOrder.deliveryAddress.fullName}</p>
                  <p className="text-sm text-gray-600">{mainOrder.deliveryAddress.address}</p>
                  <p className="text-sm text-gray-600">
                    {mainOrder.deliveryAddress.city}, {mainOrder.deliveryAddress.pincode}
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{mainOrder.deliveryAddress.phone}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Help & Support */}
            <Card>
              <CardHeader>
                <CardTitle>Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <Phone className="w-4 h-4 mr-2" />
                    Call Support
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Package className="w-4 h-4 mr-2" />
                    Report Issue
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
