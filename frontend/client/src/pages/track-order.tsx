import React, { useState, useEffect, useMemo } from "react";
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
  ChevronRight,
  Circle,
  ShieldCheck,
  CreditCard,
  Navigation,
  Info
} from "lucide-react";

/* ==========================================================================
   INTERFACES (COMPREHENSIVE)
   ========================================================================== */

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
  address?: string;
}

interface DeliveryBoySummary {
  id: number;
  name: string;
  phone: string;
  rating?: string | number;
  vehicleType?: string;
  currentLocation?: { lat: number; lng: number };
}

interface BatchSubOrderSummary {
  subOrderId: number;
  sellerName: string;
  subOrderStatus: string;
  isSelfDelivery: boolean;
  itemsCount?: number;
}

export interface DeliveryBatchSummary {
  batchId: number;
  batchStatus: string;
  deliveryBoy: DeliveryBoySummary | null;
  subOrders: BatchSubOrderSummary[];
  storeLocations: StoreLocationSummary[];
  estimatedDeliveryTime?: string;
  actualPickupTime?: string;
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
  masterOrderTrackingHistory: { 
    status: string; 
    timestamp: string; 
    message?: string;
    locationName?: string;
  }[];
}

/* ==========================================================================
   HELPERS & LOGIC
   ========================================================================== */

const getStatusColor = (status: string = "") => {
  const s = status.toLowerCase();
  if (['placed', 'confirmed', 'accepted'].includes(s)) return 'bg-blue-500';
  if (['preparing', 'processing'].includes(s)) return 'bg-yellow-500';
  if (['ready_for_pickup', 'packed'].includes(s)) return 'bg-orange-500';
  if (['picked_up', 'out_for_delivery', 'in transit', 'shipped'].includes(s)) return 'bg-purple-600';
  if (['delivered', 'completed'].includes(s)) return 'bg-green-500';
  if (['cancelled', 'rejected', 'failed'].includes(s)) return 'bg-red-500';
  return 'bg-gray-500';
};

const getStatusText = (status: string = "") => {
  const s = status.toLowerCase();
  switch (s) {
    case 'placed': return 'Order Placed Successfully';
    case 'confirmed': return 'Confirmed by Kitchen/Store';
    case 'preparing': return 'Items being Prepared';
    case 'ready_for_pickup': return 'Order Packed & Ready';
    case 'picked_up': return 'Picked up by Partner';
    case 'out_for_delivery': return 'Rider is on the way';
    case 'in transit': return 'In Transit';
    case 'delivered': return 'Delivered to your Doorstep';
    case 'cancelled': return 'Order Cancelled';
    default: return status.replace(/_/g, ' ').toUpperCase();
  }
};

const isStepCompleted = (stepStatus: string, currentStatus: string, history: any[]) => {
  const order = ['placed', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered'];
  const currentIndex = order.indexOf(currentStatus.toLowerCase());
  const stepIndex = order.indexOf(stepStatus.toLowerCase());
  if (stepIndex <= currentIndex && stepIndex !== -1) return true;
  return history.some(h => h.status.toLowerCase() === stepStatus.toLowerCase());
};

/* ==========================================================================
   MAIN COMPONENT
   ========================================================================== */

export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const numericOrderId = orderId ? Number(orderId) : null;
  const { socket } = useSocket();
  const { user } = useAuth();
  const [liveLocations, setLiveLocations] = useState<Map<number, Location>>(new Map());

  // Data Fetching
  const { 
    data: trackingResponse, 
    isLoading: isTrackingLoading, 
    isError,
    refetch 
  } = useQuery<TrackingResponse>({
    queryKey: [`/api/orders/${numericOrderId}/tracking`], 
    queryFn: async () => {
      const response = await apiRequest("get", `/api/orders/${numericOrderId}/tracking`);
      return response as TrackingResponse;
    },
    enabled: !!numericOrderId,
    refetchInterval: 30000, // Auto-refresh data every 30s
  });

  // Socket.io Implementation
  useEffect(() => {
    const userIdToUse = user?.id || user?.uid;
    if (!socket || !numericOrderId || !userIdToUse) return; 

    // Join order-specific room for real-time updates
    socket.emit("register-client", { role: "user", userId: userIdToUse });
    socket.emit("join-order-room", { orderId: numericOrderId });
    
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

    socket.on("order:delivery_location", handleLocationUpdate);
    socket.on("order:status_updated", () => refetch());

    return () => {
      socket.off("order:delivery_location", handleLocationUpdate);
      socket.off("order:status_updated");
    };
  }, [socket, numericOrderId, user?.id, refetch]);

  // ✅ Map Data Preparation (Updated for Backend compatibility)
const { mapDeliveryBoys, mapStores } = useMemo(() => {
  if (!trackingResponse) return { mapDeliveryBoys: [], mapStores: [] };

  const boys = trackingResponse.deliveryBatchesSummary
    .filter(b => b.deliveryBoy !== null)
    .map(batch => {
      const live = liveLocations.get(batch.batchId);
      
      // बैकेंड से आ रहे latitude/longitude को lat/lng में बदलें
      const currentLoc = {
        lat: parseFloat(String(live?.lat || batch.deliveryBoy?.currentLocation?.latitude || 0)),
        lng: parseFloat(String(live?.lng || batch.deliveryBoy?.currentLocation?.longitude || 0))
      };

      // कस्टमर का एड्रेस भी latitude नाम से आ रहा है
      let dest = { 
        lat: parseFloat(String(trackingResponse.customerDeliveryAddress?.latitude || 0)), 
        lng: parseFloat(String(trackingResponse.customerDeliveryAddress?.longitude || 0)) 
      };
      
      const isNotPickedUp = ["preparing", "ready_for_pickup", "accepted", "confirmed", "placed"]
        .includes(batch.batchStatus.toLowerCase());
      
      if (isNotPickedUp && batch.storeLocations && batch.storeLocations.length > 0) {
        dest = { 
          lat: parseFloat(String(batch.storeLocations[0].latitude || 0)), 
          lng: parseFloat(String(batch.storeLocations[0].longitude || 0)) 
        };
      }

      return {
        ...batch.deliveryBoy!,
        batchId: batch.batchId,
        currentLocation: currentLoc,
        destination: dest
      };
    })
    // 0,0 वाली लोकेशन हटा दें ताकि मैप क्रैश न हो
    .filter(db => db.currentLocation.lat !== 0);

  const stores = Array.from(new Set(
    trackingResponse.deliveryBatchesSummary.flatMap(b => (b.storeLocations || []).map(s => JSON.stringify(s)))
  )).map(s => {
    const parsed = JSON.parse(s);
    return {
      ...parsed,
      lat: parseFloat(String(parsed.latitude || 0)),
      lng: parseFloat(String(parsed.longitude || 0))
    };
  }).filter(s => s.lat !== 0);

  return { mapDeliveryBoys: boys, mapStores: stores };
}, [trackingResponse, liveLocations]);
  
  /* ==========================================================================
     RENDER STATES (LOADING / ERROR)
     ========================================================================== */

  if (isTrackingLoading || !numericOrderId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <Package className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary w-8 h-8" />
        </div>
        <p className="mt-6 text-gray-500 font-black animate-pulse tracking-widest uppercase text-xs">Syncing Live Status...</p>
      </div>
    );
  }

  if (isError || !trackingResponse || !trackingResponse.masterOrderId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="w-full max-w-lg text-center p-10 shadow-2xl rounded-[2rem] border-none bg-white">
          <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <CardTitle className="text-3xl font-black text-gray-900 mb-4">TRACKING UNAVAILABLE</CardTitle>
          <p className="text-gray-500 mb-8 leading-relaxed font-medium">
            We're having trouble connecting to the tracking server for Order #{numericOrderId}. 
            This could be due to a network error or the order might have been archived.
          </p>
          <div className="flex flex-col gap-3">
            <Button className="w-full h-14 rounded-2xl font-black text-lg shadow-lg shadow-primary/30" onClick={() => refetch()}>
              RETRY CONNECTION
            </Button>
            <Button variant="ghost" className="w-full font-bold text-gray-400" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { 
    customerDeliveryAddress, 
    masterOrderNumber, 
    status: masterStatus, 
    masterOrderTrackingHistory = [],
    total,
    paymentMethod,
    paymentStatus,
    estimatedDeliveryTime
  } = trackingResponse;

  /* ==========================================================================
     MAIN UI RENDER
     ========================================================================== */

  return (
    <div className="min-h-screen bg-[#F4F7FE] py-8 md:py-12 px-4 md:px-6">
      
<pre className="text-[10px] text-red-500">
  Map Data Status: {mapDeliveryBoys.length > 0 ? "Data Sent to Map" : "No Rider Data"}
  Destinations: {JSON.stringify(mapDeliveryBoys.map(d => d.destination))}
</pre>
      
      <div className="max-w-7xl mx-auto">
        
        {/* TOP BAR / HEADER */}
        <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="px-3 py-1 bg-green-100 text-green-600 rounded-full flex items-center gap-2">
                 <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                 </span>
                 <span className="text-[10px] font-black uppercase tracking-widest">Live Updates</span>
               </div>
               <span className="text-gray-300 font-light">|</span>
               <span className="text-gray-500 font-bold text-sm">#{masterOrderNumber}</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">TRACK ORDER</h1>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex-1 md:text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Current Status</p>
              <p className="text-xl font-black text-gray-800 uppercase">{getStatusText(masterStatus)}</p>
            </div>
            <div className={`w-14 h-14 rounded-2xl ${getStatusColor(masterStatus)} flex items-center justify-center shadow-xl shadow-primary/20`}>
               <Navigation className="text-white w-7 h-7" />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT SECTION (8 COLS) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* 1. MAP CARD (RE-ENGINEERED) */}
            <Card className="overflow-hidden shadow-2xl border-none rounded-[2.5rem] bg-white group">
              <CardHeader className="px-8 py-6 border-b border-gray-50 flex flex-row items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black text-gray-800">Delivery Route</CardTitle>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Real-time Location Stream</p>
                  </div>
                </div>
                {mapDeliveryBoys.length > 0 && (
                  <Badge className="bg-green-500 text-white border-none px-4 py-1.5 rounded-full font-black text-[10px] animate-bounce">
                    {mapDeliveryBoys.length} RIDER(S) ACTIVE
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-0 relative">
                <div className="w-full h-[350px] md:h-[550px] z-10">
                  <GoogleMapTracker
                    customerAddress={{ lat: customerDeliveryAddress.lat, lng: customerDeliveryAddress.lng }}
                    deliveryBoys={mapDeliveryBoys} 
                    stores={mapStores} 
                  />
                </div>
                {/* Map Overlay Info */}
                <div className="absolute bottom-6 left-6 right-6 z-20 flex flex-col md:flex-row gap-3">
                  <div className="flex-1 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20 flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase">Estimated Arrival</p>
                      <p className="text-lg font-black text-gray-900 leading-none">
                        {estimatedDeliveryTime ? new Date(estimatedDeliveryTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Calculating..."}
                      </p>
                    </div>
                  </div>
                  <div className="hidden md:flex bg-gray-900/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/10 items-center gap-4 text-white">
                    <ShieldCheck className="w-6 h-6 text-green-400" />
                    <div>
                      <p className="text-[10px] font-black text-white/50 uppercase">Safety Protocol</p>
                      <p className="text-xs font-bold">Contactless Delivery Enabled</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. BATCHES & SUBORDERS (RE-ENGINEERED) */}
            <section className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                  <Package className="w-7 h-7 text-primary" /> SHIPMENT DETAILS
                </h3>
                <span className="text-sm font-bold text-gray-400 italic">Total {trackingResponse.deliveryBatchesSummary.length} Batch(es)</span>
              </div>

              {trackingResponse.deliveryBatchesSummary.map((batch, bIdx) => (
                <Card key={batch.batchId || bIdx} className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white group hover:ring-2 ring-primary/10 transition-all">
                  <div className={`h-2 ${getStatusColor(batch.batchStatus)} w-full opacity-80`} />
                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 font-black text-xl text-gray-400 shadow-inner">
                          {batch.batchId || "01"}
                        </div>
                        <div>
                          <h4 className="font-black text-2xl text-gray-900 leading-none mb-1">Batch Logistics</h4>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            <span className="text-sm font-black text-primary">
                              ETA: {batch.estimatedDeliveryTime ? new Date(batch.estimatedDeliveryTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "TBD"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge className={`${getStatusColor(batch.batchStatus)} text-white px-6 py-2 text-xs font-black rounded-xl border-none shadow-lg`}>
                        {getStatusText(batch.batchStatus).toUpperCase()}
                      </Badge>
                    </div>

                    {batch.deliveryBoy && (
                      <div className="flex items-center justify-between bg-gray-50/50 p-5 rounded-[1.5rem] border border-gray-100 mb-8 transition-colors group-hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="w-14 h-14 bg-white rounded-full shadow-md flex items-center justify-center border border-gray-200">
                              <User className="w-7 h-7 text-gray-400" />
                            </div>
                            <div className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 border-4 border-white rounded-full shadow-sm" />
                          </div>
                          <div>
                            <p className="text-lg font-black text-gray-900 leading-none">{batch.deliveryBoy.name}</p>
                            <div className="flex items-center gap-1 mt-1">
                               <div className="flex text-yellow-400">★ ★ ★ ★ ★</div>
                               <span className="text-[10px] font-black text-gray-400 ml-1">TOP RATED</span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          size="lg" 
                          aria-label={`Call Partner ${batch.deliveryBoy.name}`}
                          className="rounded-2xl shadow-xl bg-white text-gray-900 hover:bg-primary hover:text-white border border-gray-100 h-14 px-8 font-black transition-all" 
                          onClick={() => window.location.href = `tel:${batch.deliveryBoy?.phone}`}
                        >
                          <Phone className="w-5 h-5 mr-3" /> CALL
                        </Button>
                      </div>
                    )}

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {batch.subOrders.map(so => (
                        <div key={so.subOrderId} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                           <div className="flex items-center gap-3 truncate">
                             <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                               <Store className="w-4 h-4 text-gray-400"/>
                             </div>
                             <div className="truncate">
                               <p className="text-xs font-black text-gray-800 truncate uppercase">{so.sellerName}</p>
                               <p className="text-[9px] font-bold text-gray-400">Order ID: #{so.subOrderId}</p>
                             </div>
                           </div>
                           <Badge variant="secondary" className="bg-gray-100 text-[9px] font-black text-gray-500 rounded-lg py-1">
                             {getStatusText(so.subOrderStatus)}
                           </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          </div>

          {/* RIGHT SECTION (4 COLS) - SIDEBAR */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* 3. PAYMENT SUMMARY */}
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-gray-900 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16" />
              <CardHeader className="border-b border-white/5 px-8 py-6">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-white/40">Checkout Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="flex justify-between items-end">
                  <span className="text-white/50 font-bold text-sm">Amount Paid</span>
                  <span className="text-4xl font-black tracking-tighter">₹{Number(total).toLocaleString('en-IN')}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black text-white/30 uppercase mb-1">Method</p>
                    <p className="text-sm font-black flex items-center gap-2 uppercase">
                      <CreditCard className="w-4 h-4 text-primary" /> {paymentMethod}
                    </p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black text-white/30 uppercase mb-1">Status</p>
                    <Badge className={`${paymentStatus === 'paid' ? 'bg-green-500' : 'bg-orange-500'} text-white border-none font-black text-[9px]`}>
                      {paymentStatus.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div className="bg-primary p-6 rounded-[1.5rem] shadow-2xl shadow-primary/40 flex items-center gap-5">
                   <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                     <Clock className="w-6 h-6 text-white" />
                   </div>
                   <div>
                     <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Master Arrival</p>
                     <p className="text-2xl font-black leading-none mt-1">
                        {estimatedDeliveryTime ? new Date(estimatedDeliveryTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "TBD"}
                     </p>
                   </div>
                </div>
              </CardContent>
            </Card>

            {/* 4. SHIP-TO ADDRESS */}
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white">
              <CardHeader className="border-b border-gray-50 px-8 py-6">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-400">Destination</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="flex gap-5">
                  <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border border-red-100">
                    <MapPin className="w-7 h-7 text-red-500" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-black text-xl text-gray-900 leading-tight">{customerDeliveryAddress.fullName}</p>
                    <p className="text-sm text-gray-500 font-medium leading-relaxed">{customerDeliveryAddress.address}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 font-black text-[10px]">{customerDeliveryAddress.city}</Badge>
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 font-black text-[10px]">{customerDeliveryAddress.pincode}</Badge>
                    </div>
                    <div className="pt-4 flex items-center gap-3 text-primary font-black">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Phone className="w-4 h-4" />
                      </div>
                      <span className="text-lg tracking-tight">{customerDeliveryAddress.phoneNumber}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 5. ENHANCED VERTICAL TIMELINE */}
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
              <CardHeader className="bg-gray-50 px-8 py-6">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-400">Order Journey</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="relative">
                  <div className="absolute left-[15px] top-0 bottom-0 w-1 bg-gray-50 rounded-full" />
                  
                  {['placed', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered'].map((stage, idx) => {
                    const completed = isStepCompleted(stage, masterStatus, masterOrderTrackingHistory);
                    const historyItem = masterOrderTrackingHistory.find(h => h.status.toLowerCase() === stage.toLowerCase());
                    
                    return (
                      <div key={idx} className={`relative pl-14 pb-10 last:pb-0 transition-all duration-500 ${completed ? 'opacity-100 scale-100' : 'opacity-20 scale-95'}`}>
                        {/* Dot */}
                        <div className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center z-10 shadow-lg border-4 border-white ${completed ? 'bg-green-500' : 'bg-gray-300'}`}>
                          {completed ? <CheckCircle className="w-4 h-4 text-white" /> : <Circle className="w-2 h-2 text-white" />}
                        </div>
                        
                        <div>
                          <p className={`font-black uppercase text-sm tracking-tight ${completed ? 'text-gray-900' : 'text-gray-400'}`}>
                            {getStatusText(stage)}
                          </p>
                          {completed && historyItem && (
                            <div className="mt-1 flex items-center gap-2">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <p className="text-[10px] text-gray-400 font-bold">
                                {new Date(historyItem.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                              </p>
                            </div>
                          )}
                          {completed && historyItem?.message && (
                            <p className="mt-3 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 font-medium italic border-l-4 border-primary/20">
                              "{historyItem.message}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 6. SUPPORT CARD */}
            <Card className="bg-gradient-to-br from-indigo-600 to-primary text-white border-none rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
               <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                 <Truck size={180} />
               </div>
               <CardContent className="p-10 relative z-10">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-xl">
                    <Info className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="font-black text-2xl mb-3 tracking-tight">NEED ASSISTANCE?</h4>
                  <p className="text-sm font-bold text-white/70 mb-8 leading-relaxed">
                    Experiencing delays or have a question about your order batches? We're here 24/7.
                  </p>
                  <div className="space-y-3">
                    <Button className="w-full h-14 bg-white text-primary font-black hover:bg-gray-100 rounded-2xl shadow-xl transition-all active:scale-95">
                      LIVE CHAT SUPPORT
                    </Button>
                    <Button variant="ghost" className="w-full text-white/80 font-black hover:bg-white/10 rounded-2xl">
                      VIEW FAQS
                    </Button>
                  </div>
               </CardContent>
            </Card>

          </div>
        </div>
        
        {/* FOOTER INFO */}
        <footer className="mt-16 text-center border-t border-gray-200 pt-10">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Shopnish Secure Logistics System v2.4</p>
        </footer>
      </div>
    </div>
  );
}
