import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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
  AlertCircle,
  ChevronRight
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
  currentLocation?: { lat: number; lng: number };
}

interface BatchSubOrderSummary {
  subOrderId: number;
  sellerName: string;
  subOrderStatus: string;
  isSelfDelivery: boolean;
}

export interface DeliveryBatchSummary {
  batchId: number;
  batchStatus: string;
  deliveryBoy: DeliveryBoySummary | null;
  subOrders: BatchSubOrderSummary[];
  storeLocations: StoreLocationSummary[];
  estimatedDeliveryTime?: string;
}

export interface TrackingResponse {
  masterOrderId: number;
  masterOrderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: string | number;
  estimatedDeliveryTime: string;
  createdAt: string;
  customerDeliveryAddress: CustomerDeliveryAddress;
  deliveryBatchesSummary: DeliveryBatchSummary[];
  masterOrderTrackingHistory: any[];
}

// -------------------- Helpers --------------------

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
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
  switch (status?.toLowerCase()) {
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
  const numericOrderId = orderId ? Number(orderId) : null;

  const { socket } = useSocket();
  const { user } = useAuth();

  const [liveLocations, setLiveLocations] = useState<Map<number, Location>>(new Map());

  const { 
    data: trackingResponse, 
    isLoading: isTrackingLoading,
    isError 
  } = useQuery<TrackingResponse>({
    queryKey: [`/api/orders/${numericOrderId}/tracking`], 
    queryFn: async () => {
      const response = await apiRequest("get", `/api/orders/${numericOrderId}/tracking`);
      return response as TrackingResponse;
    },
    enabled: !!numericOrderId,
  });

  useEffect(() => {
    const userIdToUse = user?.id || user?.uid;
    if (!socket || !numericOrderId || !userIdToUse) return; 

    socket.emit("register-client", { role: "user", userId: userIdToUse });
    socket.emit("join-order-room", { orderId: numericOrderId });

    const handleLocationUpdate = (data: {
      lat: number;
      lng: number;
      batchId: number;
      timestamp?: string;
    }) => {
      setLiveLocations((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.batchId, {
          lat: data.lat,
          lng: data.lng,
          timestamp: data.timestamp || new Date().toISOString(),
        });
        return newMap;
      });
    };

    socket.on("order:delivery_location", handleLocationUpdate);
    return () => {
      socket.off("order:delivery_location", handleLocationUpdate);
    };
  }, [socket, numericOrderId, user]);

  if (isTrackingLoading || !numericOrderId) {
    if (!numericOrderId) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Card className="p-6 text-center shadow-lg">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold">Error: Invalid Order ID</h3>
          </Card>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (isError || !trackingResponse || !trackingResponse.masterOrderId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center">
            <Package className="mx-auto h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Order Tracking Not Available</h3>
            <p className="text-gray-600 mb-6">
              We could not find the tracking details for Order #{numericOrderId}. It may have been cancelled, or there is a server issue.
            </p>
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
              Retry Fetching
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { 
    deliveryBatchesSummary = [], 
    customerDeliveryAddress, 
    masterOrderTrackingHistory = [], 
    masterOrderNumber, 
    status: masterStatus,
    ...masterOrderDetails 
  } = trackingResponse;

  const activeBatchesForMap = deliveryBatchesSummary.filter(
    (b) => b.deliveryBoy !== null && ["picked_up", "out_for_delivery", "in transit"].includes(b.batchStatus)
  );

  const mapDeliveryBoys = activeBatchesForMap.map((batch) => {
    const live = liveLocations.get(batch.batchId);
    return {
      ...batch.deliveryBoy!,
      batchId: batch.batchId,
      currentLocation: {
        lat: Number(live?.lat || batch.deliveryBoy?.currentLocation?.lat || 0),
        lng: Number(live?.lng || batch.deliveryBoy?.currentLocation?.lng || 0)
      },
      // ✅ MapTracker requires destination for routing
      destination: { 
        lat: Number(customerDeliveryAddress.lat), 
        lng: Number(customerDeliveryAddress.lng) 
      }
    };
  }).filter(db => db.currentLocation.lat !== 0);

  const mapStores = Array.from(new Set(
    deliveryBatchesSummary.flatMap(b => (b.storeLocations || []).map(s => JSON.stringify(s)))
  )).map(s => JSON.parse(s));

  const estimatedTime = masterOrderDetails.estimatedDeliveryTime
    ? new Date(masterOrderDetails.estimatedDeliveryTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "TBD";

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        
        {/* Header Section */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">TRACK YOUR ORDER</h1>
            <p className="text-lg text-gray-500 font-medium">Order Reference: #{masterOrderNumber}</p>
          </div>
          <Badge className={`${getStatusColor(masterStatus)} text-white px-6 py-2 text-sm font-bold shadow-md`}>
            {getStatusText(masterStatus).toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 📍 Map Card */}
            {activeBatchesForMap.length > 0 && (
              <Card className="overflow-hidden shadow-lg border-none">
                <CardHeader className="bg-white border-b py-4 px-6">
                  <CardTitle className="text-md flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-purple-600" />
                      <span>Real-time Tracking ({activeBatchesForMap.length} Deliveries)</span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full h-[400px]">
                    <GoogleMapTracker
                      customerAddress={{ lat: customerDeliveryAddress.lat, lng: customerDeliveryAddress.lng }}
                      deliveryBoys={mapDeliveryBoys} 
                      stores={mapStores} 
                    />
                  </div>
                  <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-700 tracking-tight flex items-center gap-2">
                      <Truck className="w-4 h-4 text-purple-600" /> Tracking {mapDeliveryBoys.length} active delivery partners.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Overall Order Status (Master Card) */}
            <Card className="border-none shadow-sm overflow-hidden">
              <div className={`h-2 ${getStatusColor(masterStatus)}`} />
              <CardContent className="p-6">
                <div className="flex items-center space-x-6">
                  <div className={`w-16 h-16 rounded-2xl ${getStatusColor(masterStatus)} flex items-center justify-center shadow-lg rotate-3`}>
                    <Package className="w-8 h-8 text-white -rotate-3" />
                  </div>
                  <div>
                    <p className="font-black text-2xl text-gray-900">{getStatusText(masterStatus)}</p>
                    <p className="text-gray-500 font-medium">
                      {masterStatus === 'delivered'
                        ? 'Your entire order has been delivered successfully.'
                        : activeBatchesForMap.length > 0
                        ? `${activeBatchesForMap.length} separate deliveries are currently in transit.`
                        : 'Your order is confirmed and being prepared by our sellers.'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 📦 Detailed Batch Progress */}
            <div className="space-y-4">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-2 ml-1">
                <Truck className="w-6 h-6" /> DELIVERY BATCHES
              </h3>
              {deliveryBatchesSummary.map((batch) => (
                <Card key={batch.batchId} className="border-none shadow-sm overflow-hidden group">
                  <CardContent className="p-0">
                    <div className="p-5 flex flex-wrap justify-between items-center gap-4 border-b bg-white">
                      <div>
                        <h4 className="font-black text-gray-900">Batch #{batch.batchId === 0 ? "Unassigned" : batch.batchId}</h4>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{batch.subOrders.length} Sub-orders Included</p>
                      </div>
                      <Badge className={`${getStatusColor(batch.batchStatus)} text-white px-3 py-1 font-bold`}>
                        {getStatusText(batch.batchStatus)}
                      </Badge>
                    </div>
                    
                    {batch.deliveryBoy && (
                      <div className="p-4 bg-gray-50 border-b">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-full bg-white border-2 border-primary/20 flex items-center justify-center">
                              <User className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-gray-900">{batch.deliveryBoy.name}</p>
                              <p className="text-xs text-gray-500 font-medium">Professional Rider</p>
                            </div>
                          </div>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="rounded-full font-bold px-4"
                            onClick={() => window.location.href = `tel:${batch.deliveryBoy?.phone}`}
                          >
                            <Phone className="w-3 h-3 mr-2" /> Call Partner
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="p-4 space-y-3 bg-white">
                      {batch.subOrders.map(so => (
                        <div key={so.subOrderId} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-primary/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <Store className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-bold text-gray-700">{so.sellerName}</span>
                          </div>
                          <span className="text-xs font-black text-gray-400 italic">{getStatusText(so.subOrderStatus)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 🕒 Tracking Timeline (History) */}
            <Card className="border-none shadow-sm">
              <CardHeader className="border-b">
                <CardTitle className="text-lg font-black uppercase tracking-tight">Order Timeline</CardTitle>
              </CardHeader>
              <CardContent className="pt-8">
                <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {masterOrderTrackingHistory.map((step: any, index: number) => (
                    <div key={index} className="relative">
                      <div className="absolute -left-[29px] top-1 w-5 h-5 rounded-full bg-white border-4 border-primary z-10 shadow-sm" />
                      <div>
                        <p className="font-black text-gray-900 leading-none">{getStatusText(step.status)}</p>
                        <p className="text-xs text-gray-400 mt-1 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(step.timestamp).toLocaleString()}
                        </p>
                        {step.message && <p className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded-lg border-l-2 border-primary italic">"{step.message}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
          </div>
          
          {/* Sidebar Column */}
          <div className="space-y-6">
            
            {/* Bill Details */}
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader className="bg-gray-900 text-white py-4">
                <CardTitle className="text-sm font-bold uppercase tracking-widest">Billing Summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold">Total Amount</span>
                  <span className="text-2xl font-black text-gray-900">₹{Number(masterOrderDetails.total).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Payment Mode</span>
                  <Badge variant="secondary" className="font-black uppercase tracking-tighter">
                    {masterOrderDetails.paymentMethod === 'cod' ? 'Cash On Delivery' : 'Paid Online'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm border-t pt-4">
                  <span className="text-gray-500 font-medium">Payment Status</span>
                  <Badge className={masterOrderDetails.paymentStatus === 'paid' ? 'bg-green-500' : 'bg-orange-500'}>
                    {masterOrderDetails.paymentStatus.toUpperCase()}
                  </Badge>
                </div>
                <div className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                  <div className="bg-primary p-2 rounded-lg text-white">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest leading-none">Arrival Time</p>
                    <p className="text-xl font-black text-primary">{estimatedTime}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card className="border-none shadow-md">
              <CardHeader className="border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-gray-400">Ship To</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-gray-900 leading-none">{customerDeliveryAddress.fullName}</p>
                    <p className="text-sm text-gray-600 font-medium leading-relaxed">{customerDeliveryAddress.address}</p>
                    <p className="text-sm text-gray-900 font-black">{customerDeliveryAddress.city}, {customerDeliveryAddress.pincode}</p>
                    <div className="pt-3 flex items-center gap-2 text-primary font-bold">
                      <Phone className="w-4 h-4" />
                      <span>{customerDeliveryAddress.phoneNumber}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Help Support */}
            <Card className="bg-gray-50 border-dashed border-2 border-gray-200 shadow-none">
              <CardContent className="p-6">
                <h4 className="font-black text-gray-900 mb-2 uppercase text-sm">Need Help?</h4>
                <p className="text-xs text-gray-500 mb-6 font-medium">Facing issues with your delivery or items? Our support team is available 24/7.</p>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start font-bold bg-white">
                    <Phone className="w-4 h-4 mr-2 text-primary" /> Call Support
                  </Button>
                  <Button variant="outline" className="w-full justify-start font-bold bg-white">
                    <Package className="w-4 h-4 mr-2 text-primary" /> Report Batch Issue
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
