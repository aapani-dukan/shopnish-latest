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
  ChevronRight,
  AlertCircle
} from "lucide-react";

// -------------------- Interfaces --------------------
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
const getStatusColor = (status: string = "") => {
  switch (status.toLowerCase()) {
    case 'placed': case 'confirmed': case 'accepted': return 'bg-blue-500';
    case 'preparing': return 'bg-yellow-500';
    case 'ready_for_pickup': return 'bg-orange-500';
    case 'picked_up': case 'out_for_delivery': case 'in transit': return 'bg-purple-600';
    case 'delivered': return 'bg-green-500';
    case 'cancelled': case 'rejected': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

const getStatusText = (status: string = "") => {
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

// -------------------- Main Component --------------------
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

    const handleLocationUpdate = (data: { lat: number; lng: number; batchId: number; timestamp?: string }) => {
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

    socket.emit("register-client", { role: "user", userId: userIdToUse });
    socket.emit("join-order-room", { orderId: numericOrderId });
    socket.on("order:delivery_location", handleLocationUpdate);

    return () => {
      socket.off("order:delivery_location", handleLocationUpdate);
    };
  }, [socket, numericOrderId, user]);

  // Loading State
  if (isTrackingLoading || !numericOrderId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {!numericOrderId ? (
          <div className="text-center p-8 bg-white rounded-xl shadow-sm">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-xl font-bold text-gray-900">Invalid Order ID</h3>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
            <p className="text-gray-500 animate-pulse">Fetching live status...</p>
          </div>
        )}
      </div>
    );
  }

  // Error State
  if (isError || !trackingResponse || !trackingResponse.masterOrderId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-8 text-center">
            <Package className="mx-auto h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-bold mb-2">Tracking Not Available</h3>
            <p className="text-gray-600 mb-6">
              We couldn't find tracking details for Order #{numericOrderId}. It might be too early or the order was cancelled.
            </p>
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
              Retry Connection
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

  // Map Data Logic
  const activeBatchesForMap = deliveryBatchesSummary.filter(
    (b) => b.deliveryBoy !== null && ["picked_up", "out_for_delivery", "in transit"].includes(b.batchStatus)
  );

  
const mapDeliveryBoys = activeBatchesForMap.map((batch) => ({
  ...batch.deliveryBoy!,
  batchId: batch.batchId,
  currentLocation: liveLocations.get(batch.batchId) || batch.deliveryBoy?.currentLocation || { lat: 0, lng: 0 },
  // ✅ यहाँ destination जोड़ें (कस्टमर का एड्रेस)
  destination: { 
    lat: customerDeliveryAddress.lat, 
    lng: customerDeliveryAddress.lng 
  }
})).filter(db => db.currentLocation.lat !== 0);
  

  const mapStores = Array.from(new Set(
    deliveryBatchesSummary.flatMap(b => (b.storeLocations || []).map(s => JSON.stringify(s)))
  )).map(s => JSON.parse(s));

  const estimatedTime = masterOrderDetails.estimatedDeliveryTime
    ? new Date(masterOrderDetails.estimatedDeliveryTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "Calculating...";

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">TRACK ORDER</h1>
            <p className="text-gray-500 font-medium">Order Reference: <span className="text-primary">{masterOrderNumber}</span></p>
          </div>
          <Badge className={`${getStatusColor(masterStatus)} text-white px-6 py-2 text-sm font-bold shadow-sm`}>
            {getStatusText(masterStatus).toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT COLUMN: Map and Timeline */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Map Card */}
            <Card className="overflow-hidden shadow-md border-none">
              <CardHeader className="bg-white border-b py-4">
                <CardTitle className="text-md flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span>Live Tracking Map</span>
                  </div>
                  {activeBatchesForMap.length > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full animate-pulse">
                      ● {activeBatchesForMap.length} Delivery Partners Live
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 relative">
                <div className="w-full h-[450px]">
                  <GoogleMapTracker
                    customerAddress={{ lat: customerDeliveryAddress.lat, lng: customerDeliveryAddress.lng }}
                    deliveryBoys={mapDeliveryBoys} 
                    stores={mapStores} 
                  />
                </div>
              </CardContent>
            </Card>

            {/* 2. Batch Progress Card (New from File 1) */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Truck className="w-6 h-6" /> Delivery Batches
              </h3>
              {deliveryBatchesSummary.map((batch) => (
                <Card key={batch.batchId} className="border-none shadow-sm overflow-hidden">
                  <div className={`h-1.5 ${getStatusColor(batch.batchStatus)}`} />
                  <CardContent className="p-5">
                    <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                      <div>
                        <h4 className="font-bold text-lg">Batch #{batch.batchId || "0"}</h4>
                        <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                          {batch.subOrders.length} Sub-orders • {batch.storeLocations.length} Stores
                        </p>
                      </div>
                      <Badge variant="outline" className={`${getStatusColor(batch.batchStatus)} bg-opacity-10 text-xs py-1`}>
                        {getStatusText(batch.batchStatus)}
                      </Badge>
                    </div>

                    {batch.deliveryBoy && (
                      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                              <User className="w-6 h-6 text-primary" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900">{batch.deliveryBoy.name}</p>
                            <p className="text-xs text-gray-500">Professional Delivery Partner</p>
                          </div>
                        </div>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="rounded-full shadow-sm"
                          onClick={() => window.location.href = `tel:${batch.deliveryBoy?.phone}`}
                        >
                          <Phone className="w-4 h-4 mr-2" /> Call
                        </Button>
                      </div>
                    )}

                    <div className="mt-4 space-y-2">
                      {batch.subOrders.map(so => (
                        <div key={so.subOrderId} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg text-sm">
                           <span className="flex items-center gap-2 font-medium">
                             <Store className="w-4 h-4 text-gray-400"/> {so.sellerName}
                           </span>
                           <span className="text-xs text-gray-400 italic">{getStatusText(so.subOrderStatus)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 3. Master Timeline (Original 490 lines logic) */}
            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle>Order History</CardTitle></CardHeader>
              <CardContent>
                <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {masterOrderTrackingHistory.length > 0 ? (
                    masterOrderTrackingHistory.map((step, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[29px] top-1 w-5 h-5 rounded-full bg-white border-4 border-primary z-10" />
                        <div>
                          <p className="font-bold text-gray-900">{getStatusText(step.status)}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date(step.timestamp).toLocaleString()}
                          </p>
                          {step.message && <p className="text-sm text-gray-600 mt-1 italic">"{step.message}"</p>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-sm">Status history will appear as your order progresses.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Sidebar Summary */}
          <div className="space-y-6">
            {/* Summary */}
            <Card className="border-none shadow-md bg-white">
              <CardHeader className="border-b"><CardTitle>Bill Details</CardTitle></CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Master Total</span>
                  <span className="font-bold text-lg text-gray-900">₹{Number(trackingResponse.total).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Method</span>
                  <Badge variant="secondary" className="font-bold">{trackingResponse.paymentMethod.toUpperCase()}</Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Payment Status</span>
                  <Badge className={trackingResponse.paymentStatus === 'paid' ? 'bg-green-500' : 'bg-orange-500'}>
                    {trackingResponse.paymentStatus.toUpperCase()}
                  </Badge>
                </div>
                <div className="bg-primary/5 p-4 rounded-xl flex items-center gap-4 border border-primary/10">
                  <Clock className="w-8 h-8 text-primary opacity-70" />
                  <div>
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">Est. Arrival</p>
                    <p className="text-xl font-black text-primary">{estimatedTime}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address */}
            <Card className="border-none shadow-md">
              <CardHeader className="border-b"><CardTitle className="text-sm uppercase tracking-wider text-gray-400">Delivery To</CardTitle></CardHeader>
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <MapPin className="w-5 h-5 text-red-500 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-black text-gray-900">{customerDeliveryAddress.fullName}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{customerDeliveryAddress.address}</p>
                    <p className="text-sm text-gray-600 font-bold">{customerDeliveryAddress.city}, {customerDeliveryAddress.pincode}</p>
                    <div className="pt-3 flex items-center gap-2 text-primary font-bold">
                      <Phone className="w-4 h-4" />
                      <span>{customerDeliveryAddress.phoneNumber}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Support */}
            <Card className="bg-gray-900 text-white border-none shadow-lg overflow-hidden relative">
              <div className="absolute right-[-20px] top-[-20px] opacity-10">
                <Truck size={120} />
              </div>
              <CardContent className="p-6 relative z-10">
                <h4 className="font-bold mb-2">Need help with delivery?</h4>
                <p className="text-xs text-gray-400 mb-6">If you have any issues with your batches or items, contact us.</p>
                <div className="space-y-2">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold border-none">
                    Contact Support
                  </Button>
                  <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10">
                    Order Issues
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

