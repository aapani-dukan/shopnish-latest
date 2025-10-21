import React, { useState, useEffect } from "react"; // ✅ React, useState, useEffect capitalized
import { useParams, useLocation } from "react-router-dom"; // ✅ useLocation जोड़ा गया
import { useQuery } from "@tanstack/react-query"; // ✅ tanstack/react-query से import
import { apiRequest } from "../lib/queryclient"; // ✅ सापेक्ष पथ
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"; // ✅ सापेक्ष पथ
import { Badge } from "../components/ui/badge"; // ✅ सापेक्ष पथ
import { Button } from "../components/ui/button"; // ✅ सापेक्ष पथ
import { useAuth } from "../hooks/useAuth"; // ✅ सापेक्ष पथ और useAuth capitalized
import { useSocket } from "../hooks/useSocket"; // ✅ सापेक्ष पथ और useSocket capitalized
import GoogleMapTracker from "../components/GoogleMapTracker"; // ✅ सापेक्ष पथ और GoogleMapTracker capitalized
import { // ✅ icons capitalized
  Package,
  Truck,
  MapPin,
  Clock,
  Phone,
  CheckCircle,
  User,
  Store
} from "lucide-react";

// -------------------- interfaces --------------------

interface Location { // ✅ Location capitalized
  lat: number;
  lng: number;
  timestamp: string;
}

interface DeliveryAddress { // ✅ DeliveryAddress capitalized
  fullName: string; // ✅ fullName capitalized
  address: string;
  city: string;
  pincode: string;
  phone: string;
}

export interface OrderTracking { // ✅ OrderTracking capitalized
  id: number;
  orderId: number; // ✅ orderId capitalized
  status: string;
  location: string;
  timestamp: string;
  notes: string;
}

interface DeliveryBoy { // ✅ DeliveryBoy capitalized
  id: number;
  firstName: string; // ✅ firstName capitalized
  lastName: string; // ✅ lastName capitalized
  phone: string;
}

export interface StoreType { // ✅ StoreType capitalized
  id: number;
  storeName: string; // ✅ storeName capitalized
  address: string;
  phone: string;
  latitude?: number; // ✅ latitude जोड़ा गया
  longitude?: number; // ✅ longitude जोड़ा गया
}

export interface Product {
  id: number;
  name: string;
  image?: string;
  unit?: string;
  storeId?: number; // ✅ storeId जोड़ा गया
  store?: StoreType; // ✅ store जोड़ा गया
}

export interface OrderItem {
  id: number;
  quantity: number;
  product: Product;
}

// ✅ SubOrder इंटरफ़ेस को customerorderspage से फिर से उपयोग करें
export interface SubOrder {
  id: number;
  sellerId: number;
  sellerName?: string;
  sellerBusinessName?: string;
  status: string;
  deliveryStatus: string;
  total: string | number;
  items: OrderItem[];
  deliveryBoyId?: number; // ✅ SubOrder स्तर पर डिलीवरी बॉय
  deliveryBoy?: DeliveryBoy;
  store?: StoreType; // ✅ SubOrder स्तर पर स्टोर
}

export interface MainOrder { // ✅ MainOrder (पुराने Order के बजाय)
  id: number;
  orderNumber: string; // ✅ orderNumber capitalized
  status: string;
  paymentMethod: string; // ✅ paymentMethod capitalized
  paymentStatus: string; // ✅ paymentStatus capitalized
  total: string | number;
  deliveryAddress: DeliveryAddress; // ✅ DeliveryAddress capitalized
  estimatedDeliveryTime: string; // ✅ estimatedDeliveryTime capitalized
  createdAt: string; // ✅ createdAt capitalized
  // main order में अब subOrders होते हैं, जिसमें डिलीवरी बॉय और स्टोर की जानकारी होती है
  subOrders?: SubOrder[];
}


// -------------------- component --------------------

export default function TrackOrder() { // ✅ TrackOrder capitalized
  const { orderid } = useParams<{ orderid: string }>(); // ✅ useParams capitalized
  const location = useLocation(); // ✅ useLocation hook
  const numericOrderId = orderid ? Number(orderid) : null; // ✅ numericOrderId capitalized

  // ✅ URL से sellerId प्राप्त करें
  const queryParams = new URLSearchParams(location.search);
  const sellerId = queryParams.get('sellerId') ? Number(queryParams.get('sellerId')) : null;

  const { socket } = useSocket(); // ✅ useSocket capitalized
  const { user } = useAuth(); // ✅ useAuth capitalized

  const [deliveryBoyLocation, setDeliveryBoyLocation] = useState<Location | null>(null); // ✅ deliveryBoyLocation capitalized

  const { data: mainOrder, isLoading: isMainOrderLoading } = useQuery<MainOrder>({ // ✅ mainOrder, isMainOrderLoading capitalized
    queryKey: [`/api/orders/${numericOrderId}`], // ✅ queryKey capitalized
    queryFn: async () => {
      // ✅ यदि sellerId मौजूद है, तो इसे API को भेजें ताकि विक्रेता-विशिष्ट डेटा फ़िल्टर हो सके
      const url = sellerId ? `/api/orders/${numericOrderId}?sellerId=${sellerId}` : `/api/orders/${numericOrderId}`;
      const response = await apiRequest("get", url); // ✅ apiRequest capitalized
      return response;
    },
    enabled: !!numericOrderId,
  });

  // ✅ यदि sellerId मौजूद है, तो subOrder डेटा का चयन करें
  const order = React.useMemo(() => {
    if (!mainOrder) return null;
    if (sellerId && mainOrder.subOrders) {
      return mainOrder.subOrders.find(so => so.sellerId === sellerId) || null;
    }
    // यदि कोई sellerId नहीं है या subOrders नहीं हैं, तो mainOrder को दिखाएँ (सिंगल-सेलर केस)
    // ✅ इस स्थिति में, हमें MainOrder को SubOrder के रूप में दिखाना पड़ सकता है
    // ताकि UI लॉजिक को सरल बनाया जा सके।
    return mainOrder; 
  }, [mainOrder, sellerId]);

  // ✅ ट्रैकिंग डेटा अब subOrder.status पर आधारित होगा यदि sellerId मौजूद है
  const { data: trackingData, isLoading: isTrackingLoading } = useQuery<OrderTracking[]>({ // ✅ trackingData, isTrackingLoading capitalized
    queryKey: [`/api/orders/${numericOrderId}/tracking`, { sellerId }], // ✅ queryKey में sellerId जोड़ा गया
    queryFn: async () => {
      const url = sellerId ? `/api/orders/${numericOrderId}/tracking?sellerId=${sellerId}` : `/api/orders/${numericOrderId}/tracking`;
      const response = await apiRequest("get", url); // ✅ apiRequest capitalized
      return response;
    },
    enabled: !!numericOrderId,
  });

  const tracking: OrderTracking[] = Array.isArray(trackingData) ? trackingData : []; // ✅ OrderTracking, Array capitalized

  const effectiveDeliveryBoy = order?.deliveryBoy; // ✅ अब order से डिलीवरी बॉय लें
  const effectiveStore = order?.store; // ✅ अब order से स्टोर लें
  const effectiveOrderId = order?.id || numericOrderId; // socket के लिए सही orderId का उपयोग करें

  useEffect(() => { // ✅ useEffect capitalized
    const userIdToUse = user?.id || user?.uid; // ✅ user?.id, user?.uid
    // ✅ socket को केवल तभी रजिस्टर करें जब प्रभावी orderId और user मौजूद हों
    if (!socket || !effectiveOrderId || isMainOrderLoading || !userIdToUse) return;

    const handleLocationUpdate = (data: Location & { orderId: number }) => { // ✅ handleLocationUpdate capitalized
      if (data.orderId === effectiveOrderId) { // ✅ effectiveOrderId
        setDeliveryBoyLocation({ // ✅ setDeliveryBoyLocation capitalized
          lat: data.lat,
          lng: data.lng,
          timestamp: data.timestamp,
        });
        console.log("🛵 new location received:", data.lat, data.lng);
      }
    };

    socket.emit("register-client", { role: "user", userId: userIdToUse }); // ✅ userId capitalized
    socket.emit("join-order-room", { orderId: effectiveOrderId }); // ✅ orderId, effectiveOrderId capitalized
    socket.on("order:delivery_location", handleLocationUpdate); // ✅ handleLocationUpdate capitalized

    return () => {
      socket.off("order:delivery_location", handleLocationUpdate); // ✅ handleLocationUpdate capitalized
    };
  }, [socket, effectiveOrderId, isMainOrderLoading, user]); // ✅ isMainOrderLoading capitalized

  if (isMainOrderLoading || isTrackingLoading) { // ✅ isMainOrderLoading, isTrackingLoading capitalized
    return (
      <div className="min-h-screen flex items-center justify-center"> {/* ✅ className capitalized */}
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div> {/* ✅ className capitalized */}
      </div>
    );
  }

  if (!order || !mainOrder) { // ✅ mainOrder भी चेक करें
    return (
      <div className="min-h-screen flex items-center justify-center"> {/* ✅ className capitalized */}
        <Card className="w-full max-w-md"> {/* ✅ Card, className capitalized */}
          <CardContent className="pt-6 text-center"> {/* ✅ CardContent, className capitalized */}
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" /> {/* ✅ Package, className capitalized */}
            <h3 className="text-lg font-medium mb-2">Order not found</h3> {/* ✅ className capitalized */}
            <p className="text-gray-600">Unable to track this order or sub-order.</p> {/* ✅ className capitalized */}
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => { // ✅ getStatusColor capitalized
    switch (status.toLowerCase()) { // ✅ status.toLowerCase() जोड़ा गया
      case 'placed':
      case 'confirmed':
        return 'bg-blue-500';
      case 'preparing':
        return 'bg-yellow-500';
      case 'ready_for_pickup': // ✅ 'ready' को 'ready_for_pickup' में बदला गया
      case 'picked_up':
        return 'bg-orange-500';
      case 'out_for_delivery':
        return 'bg-purple-500';
      case 'delivered':
        return 'bg-green-500';
      case 'cancelled':
      case 'rejected': // ✅ rejected जोड़ा गया
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => { // ✅ getStatusText capitalized
    switch (status.toLowerCase()) { // ✅ status.toLowerCase() जोड़ा गया
      case 'placed': return 'Order Placed';
      case 'confirmed': return 'Order Confirmed';
      case 'preparing': return 'Preparing Order';
      case 'ready_for_pickup': return 'Ready for Pickup'; // ✅ 'ready' को 'ready_for_pickup' में बदला गया
      case 'picked_up': return 'Picked Up';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      case 'rejected': return 'Rejected'; // ✅ Rejected जोड़ा गया
      default: return status;
    }
  };

  const estimatedTime = new Date(mainOrder.estimatedDeliveryTime).toLocaleTimeString('en-IN', { // ✅ mainOrder, estimatedDeliveryTime capitalized, Date capitalized
    hour: '2-digit',
    minute: '2-digit'
  });

  const orderTime = new Date(mainOrder.createdAt).toLocaleString('en-IN'); // ✅ mainOrder, createdAt capitalized, Date capitalized

  // ✅ अब स्टोर की जानकारी order (यानी subOrder) से ली जाती है
  const store = effectiveStore; 
  // ✅ deliveryboy की जानकारी भी order (यानी subOrder) से ली जाती है
  const deliveryBoy = effectiveDeliveryBoy;

  // ✅ currentOrder (mainOrder या subOrder) के status का उपयोग करें
  const currentOrderStatus = order.status; 
  const lastCompletedIndex = tracking.length > 0 ? tracking.findIndex(t => t.status.toLowerCase() === currentOrderStatus.toLowerCase()) : -1; // ✅ status.toLowerCase()

  return (
    <div className="min-h-screen bg-gray-50 py-8"> {/* ✅ className capitalized */}
      <div className="max-w-4xl mx-auto px-4"> {/* ✅ className capitalized */}

        {/* header */}
        <div className="mb-8 text-center"> {/* ✅ className capitalized */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Order</h1> {/* ✅ className capitalized */}
          <p className="text-lg text-gray-600">Order #{mainOrder.orderNumber}{sellerId ? ` (Seller: ${sellerId})` : ''}</p> {/* ✅ mainOrder.orderNumber */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8"> {/* ✅ className capitalized */}

          {/* main tracking */}
          <div className="lg:col-span-2 space-y-6"> {/* ✅ className capitalized */}
            {(currentOrderStatus === 'picked_up' || currentOrderStatus === 'out_for_delivery') && deliveryBoy && ( // ✅ currentOrderStatus
              <Card> {/* ✅ Card capitalized */}
                <CardHeader> {/* ✅ CardHeader capitalized */}
                  <CardTitle className="flex items-center space-x-2"> {/* ✅ CardTitle, className capitalized */}
                    <MapPin className="w-5 h-5 text-purple-600" /> {/* ✅ MapPin capitalized */}
                    <span>Real-Time Tracking</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0"> {/* ✅ CardContent, className capitalized */}
                  <div className="w-full h-80"> {/* ✅ className capitalized */}
                    {deliveryBoyLocation && mainOrder.deliveryAddress && ( // ✅ mainOrder.deliveryAddress
                      <GoogleMapTracker // ✅ GoogleMapTracker capitalized
                        deliveryBoyLocation={deliveryBoyLocation} // ✅ deliveryBoyLocation capitalized
                        customerAddress={mainOrder.deliveryAddress} // ✅ mainOrder.deliveryAddress capitalized
                        storeLocation={store ? {lat: store.latitude || 0, lng: store.longitude || 0} : undefined} 
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500"> 
                        <p>Waiting for delivery partner's location...</p>
                      </div>
                    )}
                  </div>

                  {deliveryBoyLocation && ( // ✅ deliveryBoyLocation capitalized
                    <div className="p-4 border-t"> {/* ✅ className capitalized */}
                      <p className="text-sm font-medium">Delivery partner location updated:</p> {/* ✅ className capitalized */}
                      <p className="text-xs text-gray-600"> {/* ✅ className capitalized */}
                        Lat: {deliveryBoyLocation.lat.toFixed(4)}, Lng: {deliveryBoyLocation.lng.toFixed(4)} {/* ✅ deliveryBoyLocation capitalized */}
                      </p>
                      <p className="text-xs text-gray-600"> {/* ✅ className capitalized */}
                        Last update: {new Date(deliveryBoyLocation.timestamp).toLocaleTimeString()} {/* ✅ deliveryBoyLocation, Date capitalized */}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* current status */}
            <Card> {/* ✅ Card capitalized */}
              <CardHeader> {/* ✅ CardHeader capitalized */}
                <CardTitle className="flex items-center justify-between"> {/* ✅ CardTitle, className capitalized */}
                  <span>Current Status</span>
                  <Badge className={`${getStatusColor(currentOrderStatus)} text-white`}> {/* ✅ getStatusColor, currentOrderStatus, className capitalized */}
                    {getStatusText(currentOrderStatus)} {/* ✅ getStatusText, currentOrderStatus capitalized */}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent> {/* ✅ CardContent capitalized */}
                <div className="flex items-center space-x-4"> {/* ✅ className capitalized */}
                  <div className={`w-12 h-12 rounded-full ${getStatusColor(currentOrderStatus)} flex items-center justify-center`}> {/* ✅ getStatusColor, currentOrderStatus, className capitalized */}
                    {currentOrderStatus === 'delivered' ? ( // ✅ currentOrderStatus
                      <CheckCircle className="w-6 h-6 text-white" /> {/* ✅ CheckCircle capitalized */}
                    ) : currentOrderStatus === 'out_for_delivery' ? ( // ✅ currentOrderStatus
                      <Truck className="w-6 h-6 text-white" /> {/* ✅ Truck capitalized */}
                    ) : (
                      <Package className="w-6 h-6 text-white" /> {/* ✅ Package capitalized */}
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-lg">{getStatusText(currentOrderStatus)}</p> {/* ✅ getStatusText, currentOrderStatus, className capitalized */}
                    <p className="text-gray-600"> {/* ✅ className capitalized */}
                      {currentOrderStatus === 'delivered' // ✅ currentOrderStatus
                        ? 'Your order has been delivered successfully.'
                        : currentOrderStatus === 'out_for_delivery' // ✅ currentOrderStatus
                        ? `Arriving by ${estimatedTime}.`
                        : currentOrderStatus === 'preparing' // ✅ currentOrderStatus
                        ? 'Your order is being prepared.'
                        : 'Order confirmed and being processed.'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* progress timeline */}
            <Card> {/* ✅ Card capitalized */}
              <CardHeader> {/* ✅ CardHeader capitalized */}
                <CardTitle>Order Timeline</CardTitle> {/* ✅ CardTitle capitalized */}
              </CardHeader>
              <CardContent> {/* ✅ CardContent capitalized */}
                <div className="space-y-6"> {/* ✅ className capitalized */}
                  {tracking.map((step, index) => {
                    const isCompleted = index <= lastCompletedIndex; // ✅ isCompleted capitalized
                    return (
                      <div key={step.id} className="flex items-center space-x-4"> {/* ✅ className capitalized */}
                        <div className="relative"> {/* ✅ className capitalized */}
                          <div className={`w-4 h-4 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`}> {/* ✅ isCompleted, className capitalized */}
                            {isCompleted && <CheckCircle className="w-4 h-4 text-white" />} {/* ✅ isCompleted, CheckCircle capitalized */}
                          </div>
                          {index < tracking.length - 1 && (
                            <div className={`absolute top-4 left-2 w-0.5 h-6 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`} /> {/* ✅ isCompleted, className capitalized */}
                          )}
                        </div>
                        <div className="flex-1"> {/* ✅ className capitalized */}
                          <p className={`font-medium ${isCompleted ? 'text-gray-900' : 'text-gray-500'}`}> {/* ✅ isCompleted, className capitalized */}
                            {getStatusText(step.status)} {/* ✅ getStatusText capitalized */}
                          </p>
                          {step.timestamp && (
                            <p className="text-sm text-gray-600"> {/* ✅ className capitalized */}
                              {new Date(step.timestamp).toLocaleString()} {/* ✅ Date capitalized */}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* delivery details */}
            {deliveryBoy && ( // ✅ deliveryBoy
              <Card> {/* ✅ Card capitalized */}
                <CardHeader> {/* ✅ CardHeader capitalized */}
                  <CardTitle className="flex items-center space-x-2"> {/* ✅ CardTitle, className capitalized */}
                    <User className="w-5 h-5" /> {/* ✅ User capitalized */}
                    <span>Delivery Partner</span>
                  </CardTitle>
                </CardHeader>
                <CardContent> {/* ✅ CardContent capitalized */}
                  <div className="flex items-center justify-between"> {/* ✅ className capitalized */}
                    <div>
                      <p className="font-medium">{deliveryBoy.firstName} {deliveryBoy.lastName}</p> {/* ✅ deliveryBoy.firstName, deliveryBoy.lastName */}
                      <p className="text-sm text-gray-600">Delivery Partner</p> {/* ✅ className capitalized */}
                    </div>
                    <Button variant="outline" size="sm"> {/* ✅ Button capitalized */}
                      <Phone className="w-4 h-4 mr-2" /> {/* ✅ Phone capitalized */}
                      Call
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* sidebar */}
          <div className="space-y-6"> {/* ✅ className capitalized */}
            {/* order summary */}
            <Card> {/* ✅ Card capitalized */}
              <CardHeader> {/* ✅ CardHeader capitalized */}
                <CardTitle>Order Summary</CardTitle> {/* ✅ CardTitle capitalized */}
              </CardHeader>
              <CardContent> {/* ✅ CardContent capitalized */}
                <div className="space-y-3"> {/* ✅ className capitalized */}
                  <div className="flex justify-between"> {/* ✅ className capitalized */}
                    <span>Order Total</span>
                    <span className="font-medium">₹{Number(mainOrder.total).toLocaleString('en-IN')}</span> {/* ✅ mainOrder.total */}
                  </div>
                  <div className="flex justify-between"> {/* ✅ className capitalized */}
                    <span>Payment</span>
                    <Badge variant={mainOrder.paymentStatus === 'paid' ? 'default' : 'secondary'}> {/* ✅ mainOrder.paymentStatus */}
                      {mainOrder.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid Online'} {/* ✅ mainOrder.paymentMethod */}
                    </Badge>
                  </div>
                  <hr />
                  <div className="text-sm text-gray-600"> {/* ✅ className capitalized */}
                    <p className="flex items-center space-x-2"> {/* ✅ className capitalized */}
                      <Clock className="w-4 h-4" /> {/* ✅ Clock capitalized */}
                      <span>Estimated Delivery: {estimatedTime}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* store info */}
            {store && ( // ✅ store
              <Card> {/* ✅ Card capitalized */}
                <CardHeader> {/* ✅ CardHeader capitalized */}
                  <CardTitle className="flex items-center space-x-2"> {/* ✅ CardTitle, className capitalized */}
                    <Store className="w-5 h-5" /> {/* ✅ Store capitalized */}
                    <span>Store Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent> {/* ✅ CardContent capitalized */}
                  <div className="space-y-2"> {/* ✅ className capitalized */}
                    <p className="font-medium">{store.storeName}</p> {/* ✅ store.storeName */}
                    <p className="text-sm text-gray-600">{store.address}</p> {/* ✅ className capitalized */}
                    <div className="flex items-center justify-between pt-2"> {/* ✅ className capitalized */}
                      <span className="text-sm text-gray-600">Contact Store</span> {/* ✅ className capitalized */}
                      <Button variant="outline" size="sm"> {/* ✅ Button capitalized */}
                        <Phone className="w-4 h-4 mr-2" /> {/* ✅ Phone capitalized */}
                        Call
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* delivery address */}
            <Card> {/* ✅ Card capitalized */}
              <CardHeader> {/* ✅ CardHeader capitalized */}
                <CardTitle className="flex items-center space-x-2"> {/* ✅ CardTitle, className capitalized */}
                  <MapPin className="w-5 h-5" /> {/* ✅ MapPin capitalized */}
                  <span>Delivery Address</span>
                </CardTitle>
              </CardHeader>
              <CardContent> {/* ✅ CardContent capitalized */}
                <div className="space-y-2"> {/* ✅ className capitalized */}
                  <p className="font-medium">{mainOrder.deliveryAddress.fullName}</p> {/* ✅ mainOrder.deliveryAddress.fullName */}
                  <p className="text-sm text-gray-600">{mainOrder.deliveryAddress.address}</p> {/* ✅ mainOrder.deliveryAddress.address */}
                  <p className="text-sm text-gray-600"> {/* ✅ className capitalized */}
                    {mainOrder.deliveryAddress.city}, {mainOrder.deliveryAddress.pincode} {/* ✅ mainOrder.deliveryAddress.city, mainOrder.deliveryAddress.pincode */}
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-gray-600"> {/* ✅ className capitalized */}
                    <Phone className="w-4 h-4" /> {/* ✅ Phone capitalized */}
                    <span>{mainOrder.deliveryAddress.phone}</span> {/* ✅ mainOrder.deliveryAddress.phone */}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* help & support */}
            <Card> {/* ✅ Card capitalized */}
              <CardHeader> {/* ✅ CardHeader capitalized */}
                <CardTitle>Need Help?</CardTitle> {/* ✅ CardTitle capitalized */}
              </CardHeader>
              <CardContent> {/* ✅ CardContent capitalized */}
                <div className="space-y-3"> {/* ✅ className capitalized */}
                  <Button variant="outline" className="w-full justify-start"> {/* ✅ Button, className capitalized */}
                    <Phone className="w-4 h-4 mr-2" /> {/* ✅ Phone capitalized */}
                    Call Support
                  </Button>
                  <Button variant="outline" className="w-full justify-start"> {/* ✅ Button, className capitalized */}
                    <Package className="w-4 h-4 mr-2" /> {/* ✅ Package capitalized */}
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
