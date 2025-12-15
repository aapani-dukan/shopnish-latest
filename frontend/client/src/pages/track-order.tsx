import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";
import GoogleMapTracker from "../components/GoogleMapTracker"; // Ensure this component is updated to handle multiple inputs
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

// -------------------- Interfaces (Multi-Batch Tracking) --------------------

interface Location {
  lat: number;
  lng: number;
  timestamp: string;
}

interface CustomerDeliveryAddress {
  lat: number;
  lng: number;
  address: string;
  city: string;
  pincode: string;
  fullName: string;
  phoneNumber: string;
}

interface StoreLocationSummary {
  lat: number;
  lng: number;
  name: string;
}

interface DeliveryBoySummary {
  id: number;
  name: string;
  phone: string;
  currentLocation?: { lat: number; lng: number }; // Optional in summary, required for live
}

interface BatchSubOrderSummary {
  subOrderId: number;
  sellerName: string;
  subOrderStatus: string;
  isSelfDelivery: boolean;
}

export interface DeliveryBatchSummary {
  batchId: number | string; // 0 या 'unassigned' हो सकता है
  batchStatus: string;
  deliveryBoy: DeliveryBoySummary | null;
  subOrders: BatchSubOrderSummary[];
  storeLocations: StoreLocationSummary[]; // इस बैच में शामिल सभी स्टोर
  estimatedDeliveryTime?: string;
}

export interface TrackingResponse {
  masterOrderId: number;
  masterOrderNumber: string;
  status: string; // Master order status (e.g., 'confirmed')
  paymentMethod: string;
  paymentStatus: string;
  total: string | number;
  estimatedDeliveryTime: string;
  createdAt: string;
  customerDeliveryAddress: CustomerDeliveryAddress;
  deliveryBatchesSummary: DeliveryBatchSummary[]; // 👈 FIX: यह मुख्य डेटा है
  masterOrderTrackingHistory: any[]; // OrderTracking[]
}

// -------------------- Helpers --------------------

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'placed':
    case 'confirmed':
    case 'accepted':
      return 'bg-blue-500';
    case 'preparing':
      return 'bg-yellow-500';
    case 'ready_for_pickup':
      return 'bg-orange-500';
    case 'picked_up':
    case 'out_for_delivery':
    case 'in transit':
      return 'bg-purple-600';
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
    case 'accepted': return 'Order Accepted';
    case 'preparing': return 'Preparing Order';
    case 'ready_for_pickup': return 'Ready for Pickup';
    case 'picked_up': return 'Picked Up';
    case 'out_for_delivery': return 'Out For Delivery';
    case 'in transit': return 'Delivery In Progress';
    case 'delivered': return 'Delivered';
    case 'cancelled': return 'Cancelled';
    case 'rejected': return 'Rejected';
    default: return status;
  }
};

// -------------------- Component --------------------


  export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  
  // orderId को संख्या में बदलें, यदि यह मान्य नहीं है तो null
  const numericOrderId = orderId ? Number(orderId) : null;

  const { socket } = useSocket();
  const { user } = useAuth();

  // 🟢 FIX 1: एकाधिक डिलीवरी बॉय के स्थानों को मैप करने के लिए state
  const [liveLocations, setLiveLocations] = useState<Map<number, Location>>(new Map());

  // 🟢 FIX 2: नए Tracking API को Fetch करें
  const { 
    data: trackingResponse, 
    isLoading: isTrackingLoading,
    isError // Error State को भी कैप्चर करें
  } = useQuery<TrackingResponse>({
    queryKey: [`/api/orders/${numericOrderId}/tracking`], 
    queryFn: async () => {
      const response = await apiRequest("get", `/api/orders/${numericOrderId}/tracking`);
      return response as TrackingResponse;
    },
    enabled: !!numericOrderId, // केवल तभी Fetch करें जब numericOrderId मौजूद हो
  });

  // 🟢 FIX 3: Live Location Update Logic
  useEffect(() => {
    const userIdToUse = user?.id || user?.uid;
    // लॉजिक को केवल तभी शुरू करें जब ऑर्डर ID मौजूद हो, लोडिंग खत्म हो गई हो, और Socket तैयार हो
    // isTrackingLoading को निर्भरता से हटा सकते हैं, लेकिन यहाँ रखते हैं ताकि लोडिंग खत्म होने पर यह रजिस्टर हो
    if (!socket || !numericOrderId || !userIdToUse) return; 

    // डेटा में batchId शामिल होना चाहिए
    const handleLocationUpdate = (data: Location & { batchId: number; orderId: number }) => {
      if (data.orderId === numericOrderId) {
        setLiveLocations(prev => {
          const newMap = new Map(prev);
          newMap.set(data.batchId, { lat: data.lat, lng: data.lng, timestamp: data.timestamp });
          return newMap;
        });
      }
    };

    socket.emit("register-client", { role: "user", userId: userIdToUse });
    socket.emit("join-order-room", { orderId: numericOrderId }); // Master order room
    socket.on("order:delivery_location", handleLocationUpdate);

    return () => {
      socket.off("order:delivery_location", handleLocationUpdate);
    };
  }, [socket, numericOrderId, user]); // isTrackingLoading को useEffect dependencies से हटाया गया

  
  // -------------------- 🛑 FIX: लोडिंग और डेटा/एरर हैंडलिंग --------------------
  
  // 1. लोडिंग या अमान्य इनपुट
  if (isTrackingLoading || !numericOrderId) {
    // यदि orderId URL में मौजूद नहीं है
    if (!numericOrderId) {
         return (
             <div className="min-h-screen flex items-center justify-center">
                 <h3 className="text-xl font-bold text-red-500">❌ Error: Invalid or Missing Order ID.</h3>
             </div>
         );
    }
    // यदि orderId मौजूद है लेकिन डेटा Fetch हो रहा है
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // 2. 🟢 FIX: डेटा अनुपलब्धता/त्रुटि चेक (लोडिंग खत्म होने के बाद)
  // यदि fetching खत्म हो गई है, लेकिन कोई डेटा नहीं है या fetching में एरर आई है
  if (isError || !trackingResponse || !trackingResponse.masterOrderId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Package className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Order Tracking Not Available</h3>
            <p className="text-gray-600">
              We could not find the tracking details for Order #{numericOrderId}. It may have been cancelled, or there is a server issue.
            </p>
            {isError && <p className="mt-2 text-xs text-red-400">Server communication failed (Check Console).</p>}
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // -------------------- सुरक्षित Destructuring --------------------

  const { 
    deliveryBatchesSummary = [], // 👈 Destructuring को सुरक्षित करने के लिए डिफॉल्ट ऐरे
    customerDeliveryAddress, 
    masterOrderTrackingHistory = [], // 👈 Destructuring को सुरक्षित करने के लिए डिफॉल्ट ऐरे
    masterOrderNumber, 
    status: masterStatus,
    ...masterOrderDetails 
  } = trackingResponse; // अब यह सुनिश्चित है कि trackingResponse एक मान्य ऑब्जेक्ट है
  
  // 🟢 FIX 4: MapComponent के लिए डेटा तैयार करें
  const activeBatchesForMap = deliveryBatchesSummary.filter(b => 
    (b.batchStatus === 'picked_up' || b.batchStatus === 'out_for_delivery' || b.batchStatus === 'in transit') && b.deliveryBoy
  );

  const mapDeliveryBoys = activeBatchesForMap.map(batch => ({
    ...batch.deliveryBoy,
    batchId: batch.batchId as number,
    // लाइव लोकेशन को प्राथमिकता दें
    currentLocation: liveLocations.get(batch.batchId as number) || batch.deliveryBoy?.currentLocation || { lat: 0, lng: 0 }, 
  })).filter(db => db.currentLocation.lat !== 0 || db.currentLocation.lng !== 0); // Invalid locations filter

  // सभी बैचों से स्टोर स्थानों को इकट्ठा करें
  // (deliveryBatchesSummary || []) का उपयोग करने की आवश्यकता नहीं है क्योंकि हमने ऊपर इसे default [] कर दिया है
  const mapStores = Array.from(new Set(
    deliveryBatchesSummary.flatMap(b => (b.storeLocations || []).map(s => JSON.stringify(s))) // storeLocations को भी सुरक्षित करें
  )).map(s => JSON.parse(s));

  const estimatedTime = new Date(masterOrderDetails.estimatedDeliveryTime).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit'
  });

  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Order</h1>
          <p className="text-lg text-gray-600">Order #{masterOrderNumber}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Tracking & Map */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Real-time Tracking Map */}
            {activeBatchesForMap.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    <span>Real-time Tracking ({activeBatchesForMap.length} Deliveries)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full h-80">
                    {/* GoogleMapTracker को एकाधिक DBs और Stores पास करें */}
                    <GoogleMapTracker
                      customerAddress={{ lat: customerDeliveryAddress.lat, lng: customerDeliveryAddress.lng }}
                      deliveryBoys={mapDeliveryBoys} 
                      stores={mapStores} 
                    />
                  </div>
                  <div className="p-4 border-t">
                    <p className="text-sm font-medium">Tracking {mapDeliveryBoys.length} active delivery partners.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Current Status (Master Status) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Overall Order Status</span>
                  <Badge className={`${getStatusColor(masterStatus)} text-white`}>
                    {getStatusText(masterStatus)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full ${getStatusColor(masterStatus)} flex items-center justify-center`}>
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-lg">{getStatusText(masterStatus)}</p>
                    <p className="text-gray-600">
                      {masterStatus === 'delivered'
                        ? 'Your entire order has been delivered successfully.'
                        : activeBatchesForMap.length > 0
                        ? `${activeBatchesForMap.length} deliveries are currently in transit.`
                        : 'Order confirmed and being processed by sellers.'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Batch Progress (प्रत्येक बैच की स्थिति) */}
            <Card>
              <CardHeader>
                <CardTitle>Delivery Batch Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {deliveryBatchesSummary.map((batch) => (
                    <div key={batch.batchId} className="border p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <h4 className="font-semibold">Batch #{batch.batchId === 0 ? "Unassigned Items" : batch.batchId}</h4>
                        <Badge className={`${getStatusColor(batch.batchStatus)} text-white`}>
                          {getStatusText(batch.batchStatus)}
                        </Badge>
                      </div>
                      
                      {batch.deliveryBoy && (
                          <div className="mt-2 text-sm flex items-center justify-between">
                              <p><User className="w-4 h-4 mr-1 inline"/> DB: {batch.deliveryBoy.name}</p>
                              <Button variant="outline" size="xs" onClick={() => window.location.href = `tel:${batch.deliveryBoy?.phone}`}>
                                  <Phone className="w-3 h-3 mr-1" />
                                  Call
                              </Button>
                          </div>
                      )}

                      <details className="mt-2 text-xs text-gray-600">
                          <summary className="cursor-pointer text-blue-600">
                              View {batch.subOrders.length} Sub-Orders ({batch.storeLocations.length} Stores)
                          </summary>
                          <ul className="list-disc ml-4 mt-1">
                              {batch.subOrders.map(so => (
                                  <li key={so.subOrderId}>{so.sellerName} - {getStatusText(so.subOrderStatus)}</li>
                              ))}
                          </ul>
                      </details>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Master Order Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Order Timeline (Master)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {masterOrderTrackingHistory.map((step: any, index: number) => {
                    // Simpler rendering as we don't have a direct lastCompletedIndex for master status
                    return (
                      <div key={index} className="flex items-center space-x-4">
                        <div className="relative">
                          <div className={`w-4 h-4 rounded-full bg-blue-500`} />
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium text-gray-900`}>
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
                    <span className="font-medium">₹{Number(masterOrderDetails.total).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment</span>
                    <Badge variant={masterOrderDetails.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                      {masterOrderDetails.paymentMethod === 'cod' ? 'Cash On Delivery' : 'Paid Online'}
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
                  <p className="font-medium">{customerDeliveryAddress.fullName}</p>
                  <p className="text-sm text-gray-600">{customerDeliveryAddress.address}</p>
                  <p className="text-sm text-gray-600">
                    {customerDeliveryAddress.city}, {customerDeliveryAddress.pincode}
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{customerDeliveryAddress.phoneNumber}</span>
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
