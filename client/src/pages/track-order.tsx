import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect } from "react"; 
import { useAuth } from "@/hooks/useAuth"; 
import { useSocket } from "@/hooks/useSocket";
import GoogleMapTracker from "@/components/GoogleMapTracker";
import { 
  Package, 
  Truck, 
  MapPin, 
  Clock, 
  Phone, 
  CheckCircle,
  User,
  Store
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

interface OrderTracking {
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

interface StoreType {
  id: number;
  storeName: string;
  address: string;
  phone: string;
}

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: string;
  deliveryAddress: DeliveryAddress; 
  estimatedDeliveryTime: string;
  createdAt: string;
  deliveryBoyId?: number;
  deliveryBoy?: DeliveryBoy;
  items: Array<{
    product: {
      storeId: number;
      store?: StoreType;
    };
  }>;
}

// -------------------- Component --------------------

export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const numericOrderId = orderId ? Number(orderId) : null;

  const { socket } = useSocket(); 
  const { user } = useAuth(); 

  const [deliveryBoyLocation, setDeliveryBoyLocation] = useState<Location | null>(null);

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: [`/api/orders/${numericOrderId}`],
    enabled: !!numericOrderId,
  });

  const { data: trackingData } = useQuery<OrderTracking[]>({
    queryKey: [`/api/orders/${numericOrderId}/tracking`],
    enabled: !!numericOrderId,
  });

  const tracking: OrderTracking[] = Array.isArray(trackingData) ? trackingData : [];

  useEffect(() => {
    if (!socket || !numericOrderId || isLoading || !user) return;

    const handleLocationUpdate = (data: Location & { orderId: number }) => {
      if (data.orderId === numericOrderId) {
        setDeliveryBoyLocation({
          lat: data.lat,
          lng: data.lng,
          timestamp: data.timestamp,
        });
        console.log("🛵 New location received:", data.lat, data.lng);
      }
    };

    // ✅ फिक्स: user.id को प्राथमिकता दें, यह backendLogin और fetchAndSyncBackendUser दोनों में सेट है।
const userIdToUse = user.id || user.uid; // सबसे सुरक्षित तरीका

if (!socket || !numericOrderId || isLoading || !userIdToUse) return;

socket.emit("register-client", { role: "user", userId: userIdToUse }); 
    socket.emit("join-order-room", { orderId: numericOrderId });
    socket.on("order:delivery_location", handleLocationUpdate);

    return () => {
      socket.off("order:delivery_location", handleLocationUpdate);
    };
  }, [socket, numericOrderId, isLoading, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
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
            <p className="text-gray-600">Unable to track this order</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'placed':
      case 'confirmed':
        return 'bg-blue-500';
      case 'preparing':
        return 'bg-yellow-500';
      case 'ready':
      case 'picked_up':
        return 'bg-orange-500';
      case 'out_for_delivery':
        return 'bg-purple-500';
      case 'delivered':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'placed': return 'Order Placed';
      case 'confirmed': return 'Order Confirmed';
      case 'preparing': return 'Preparing Order';
      case 'ready': return 'Ready for Pickup';
      case 'picked_up': return 'Picked Up';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const estimatedTime = new Date(order.estimatedDeliveryTime).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const orderTime = new Date(order.createdAt).toLocaleString('en-IN');
  const store = order.items?.[0]?.product?.store;
  const lastCompletedIndex = tracking.length > 0 ? tracking.findIndex(t => t.status === order.status) : -1;

  return ( 
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Order</h1>
          <p className="text-lg text-gray-600">Order #{order.orderNumber}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Tracking */}
          <div className="lg:col-span-2 space-y-6">
            {(order.status === 'picked_up' || order.status === 'out_for_delivery') && order.deliveryBoyId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    <span>Real-Time Tracking</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full h-80">
                    {deliveryBoyLocation && order.deliveryAddress ? (
                      <GoogleMapTracker
                        deliveryBoyLocation={deliveryBoyLocation}
                        customerAddress={order.deliveryAddress}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
                        <p>Waiting for Delivery Partner's location...</p>
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
                  <Badge className={`${getStatusColor(order.status)} text-white`}>
                    {getStatusText(order.status)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full ${getStatusColor(order.status)} flex items-center justify-center`}>
                    {order.status === 'delivered' ? (
                      <CheckCircle className="w-6 h-6 text-white" />
                    ) : order.status === 'out_for_delivery' ? (
                      <Truck className="w-6 h-6 text-white" />
                    ) : (
                      <Package className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-lg">{getStatusText(order.status)}</p>
                    <p className="text-gray-600">
                      {order.status === 'delivered' 
                        ? 'Your order has been delivered successfully'
                        : order.status === 'out_for_delivery'
                        ? `Arriving by ${estimatedTime}`
                        : order.status === 'preparing'
                        ? 'Your order is being prepared'
                        : 'Order confirmed and being processed'
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
            {order.deliveryBoy && (
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
                      <p className="font-medium">{order.deliveryBoy.firstName} {order.deliveryBoy.lastName}</p>
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
                    <span className="font-medium">₹{order.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment</span>
                    <Badge variant={order.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                      {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
                    </Badge>
                  </div>
                  <hr />
                  <div className="text-sm text-gray-600">
                    <p className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>Estimated delivery: {estimatedTime}</span>
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
                  <p className="font-medium">{order.deliveryAddress.fullName}</p>
                  <p className="text-sm text-gray-600">{order.deliveryAddress.address}</p>
                  <p className="text-sm text-gray-600">
                    {order.deliveryAddress.city}, {order.deliveryAddress.pincode}
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{order.deliveryAddress.phone}</span>
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


{/*    
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Clock, MapPin, Store } from "lucide-react";
import { getAuth } from "firebase/auth";
import GoogleMapTracker from "@/components/GoogleMapTracker";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";

// Interfaces
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
interface OrderTracking {
  id?: number;
  orderId: number;
  status: string;
  location?: string;
  timestamp?: string;
  notes?: string;
}
interface DeliveryBoy {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
}
interface StoreType {
  id: number;
  storeName: string;
  address: string;
  phone: string;
}
interface Order {
  id: number;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: string;
  deliveryAddress?: DeliveryAddress;
  estimatedDeliveryTime?: string;
  createdAt: string;
  deliveryBoyId?: number;
  deliveryBoy?: DeliveryBoy;
  deliveryLocation?: Location;
  items: Array<{
    product: {
      storeId: number;
      store?: StoreType;
    };
  }>;
}

export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const numericOrderId = orderId ? Number(orderId) : null;

  const { socket } = useSocket();
  const { user } = useAuth();
  const [deliveryBoyLocation, setDeliveryBoyLocation] = useState<Location | null>(null);

  // Fetch Order
  const { data: order, isLoading } = useQuery<Order | null>({
    queryKey: ["/api/orders", numericOrderId],
    queryFn: async () => {
      if (!numericOrderId) return null;
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("User not authenticated");

      const res = await fetch(`/api/orders/${numericOrderId}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!numericOrderId,
  });

  // Fetch Tracking Data
  const { data: trackingData } = useQuery<OrderTracking[]>({
    queryKey: ["/api/orders/tracking", numericOrderId],
    queryFn: async () => {
      if (!numericOrderId) return [];
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("User not authenticated");

      const res = await fetch(`/api/orders/${numericOrderId}/tracking`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!numericOrderId,
  });

  const tracking: OrderTracking[] = Array.isArray(trackingData) ? trackingData : [];

  // Socket: Listen for delivery location updates
  useEffect(() => {
    if (!socket || !numericOrderId || !user) return;

    const userIdToUse = (user as any).id || (user as any).uid;
    if (!userIdToUse) return;

    socket.emit("register-client", { role: "customer", userId: userIdToUse });
    socket.emit("join-order-room", { orderId: numericOrderId });

    const handleSocketLocationUpdate = (data: { orderId: number; lat: number; lng: number; timestamp?: string }) => {
      if (data.orderId !== numericOrderId) return;
      setDeliveryBoyLocation({
        lat: data.lat,
        lng: data.lng,
        timestamp: data.timestamp || new Date().toISOString(),
      });
    };

    socket.on("order:delivery_location", handleSocketLocationUpdate);

    return () => {
      socket.off("order:delivery_location", handleSocketLocationUpdate);
    };
  }, [socket, numericOrderId, user]);

  // Helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case "placed": case "confirmed": return "bg-blue-500";
      case "preparing": return "bg-yellow-500";
      case "ready": case "picked_up": return "bg-orange-500";
      case "out_for_delivery": return "bg-purple-500";
      case "delivered": return "bg-green-500";
      case "cancelled": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };
  const getStatusText = (status: string) => {
    switch (status) {
      case "placed": return "Order Placed";
      case "confirmed": return "Order Confirmed";
      case "preparing": return "Preparing Order";
      case "ready": return "Ready for Pickup";
      case "picked_up": return "Picked Up";
      case "out_for_delivery": return "Out for Delivery";
      case "delivered": return "Delivered";
      case "cancelled": return "Cancelled";
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!order || !order.deliveryAddress || !order.items || order.items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h3 className="text-lg font-medium mb-2">Order Not Ready or Data Missing</h3>
            <p className="text-gray-600">Please wait while we prepare tracking information.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const customerAddress = order.deliveryAddress;
  const deliveryBoyLocationToShow = deliveryBoyLocation || order.deliveryLocation || null;
  const estimatedTime = order.estimatedDeliveryTime
    ? new Date(order.estimatedDeliveryTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "TBD";
  const store = order.items?.[0]?.product?.store;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Order</h1>
          <p className="text-lg text-gray-600">Order #{order.orderNumber}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {(order.status === "picked_up" || order.status === "out_for_delivery") && order.deliveryBoyId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    <span>Real-Time Tracking</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full h-[400px]">
                    {customerAddress ? (
                      <GoogleMapTracker
                        deliveryBoyLocation={deliveryBoyLocationToShow || undefined}
                        customerAddress={customerAddress}
                      />
                    ) : (
                      <div className="w-full h-[400px] bg-gray-200 flex items-center justify-center text-gray-500">
                        Delivery address not found.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Status Timeline */}
{/*   <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <span>Order Status Timeline</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tracking.map((track, idx) => (
                    <div key={idx} className="flex items-center space-x-4">
                      <Badge className={`${getStatusColor(track.status)} py-1 px-2 rounded`}>
                        {getStatusText(track.status)}
                      </Badge>
                      {track.timestamp && (
                        <span className="text-xs text-gray-500">
                          {new Date(track.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                      {track.notes && (
                        <span className="text-xs text-gray-400 italic">- {track.notes}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Details */}
{/* <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className
                  ="flex items-center space-x-2">
                  <Package className="w-5 h-5 text-green-500" />
                  <span>Order Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Order Number:</span>
                  <span>{order.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  <Badge className={`${getStatusColor(order.status)} py-1 px-2 rounded`}>
                    {getStatusText(order.status)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Payment:</span>
                  <span>{order.paymentMethod.toUpperCase()} ({order.paymentStatus})</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Total:</span>
                  <span>₹{order.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Estimated Delivery:</span>
                  <span>{estimatedTime}</span>
                </div>
              </CardContent>
            </Card>

            {/* Store Details */}
{/* {store && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Store className="w-5 h-5 text-blue-500" />
                    <span>Store Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Store Name:</span>
                    <span>{store.storeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Address:</span>
                    <span>{store.address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Phone:</span>
                    <span>{store.phone}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
*/}
