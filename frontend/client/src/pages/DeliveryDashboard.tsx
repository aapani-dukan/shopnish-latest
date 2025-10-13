import React, { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";

import {
  User as UserIcon, 
  LogOut,
  Package,
  Clock,
  CheckCircle,
  Navigation,
  Loader2,
  Calendar,
  Zap,
} from "lucide-react";

import { format } from "date-fns"; 

import DeliveryOtpDialog from "./DeliveryOtpDialog"; 
import DeliveryOrdersList from "./DeliveryOrdersList"; 
import { useAuth } from "../hooks/useAuth"; 
import { useSocket } from "../hooks/useSocket"; 
import { apiRequest } from "../lib/queryClient"; 
import api from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"; 
import { Badge } from "../components/ui/badge"; 
import { Button } from "../components/ui/button"; 
import { useToast } from "../hooks/use-toast"; 
import { Label } from "../components/ui/label"; 
import { Input } from "../components/ui/input"; 

// --- Utility Functions ---
const getStatusColor = (status: string) => {
  switch (status) {
    case "pending": return "bg-amber-600 hover:bg-amber-700";
    case "accepted": return "bg-blue-600 hover:bg-blue-700";
    case "picked_up": return "bg-indigo-600 hover:bg-indigo-700";
    case "out_for_delivery": return "bg-purple-600 hover:bg-purple-700";
    case "delivered": return "bg-green-600 hover:bg-green-700";
    case "rejected":
    case "cancelled": return "bg-red-500 hover:bg-red-600";
    default: return "bg-gray-500 hover:bg-gray-600";
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case "pending": return "लंबित";
    case "accepted": return "स्वीकृत (असाइन)";
    case "preparing": return "तैयार हो रहा है";
    case "ready_for_pickup": return "पिकअप के लिए तैयार";
    case "picked_up": return "पिकअप हो गया";
    case "out_for_delivery": return "डिलीवरी के लिए निकला";
    case "delivered": return "डिलीवर हो गया";
    case "rejected": return "अस्वीकृत";
    case "cancelled": return "रद्द";
    default: return status || "अज्ञात";
  }
};

const getNextStatus = (current: string) => {
  switch (current) {
    case "pending": return "accepted";
    case "accepted": return "picked_up";
    case "picked_up": return "out_for_delivery";
    case "out_for_delivery": return null;
    default: return null;
  }
};

const getNextStatusLabel = (status: string) => {
  switch (status) {
    case "ready_for_pickup": return "पिकअप हो गया";
    case "picked_up": return "डिलीवरी के लिए निकला";
    case "out_for_delivery": return "OTP सत्यापन करें";
    default: return "";
  }
};

// --- Main Component ---
export default function DeliveryDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, auth, isLoadingAuth, isAuthenticated } = useAuth();
  const rawSocket = useSocket() as any;
  const socket = rawSocket?.socket ?? rawSocket;

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [otp, setOtp] = useState("");
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0); 
  const [dateFilter, setDateFilter] = useState<Date | null>(() => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    return fiveDaysAgo;
  });
  
  useEffect(() => {
    if (!user || !auth?.currentUser) return;
    try {
      const deliveryBoyId = user?.deliveryBoyId;
      if (deliveryBoyId !== undefined) {
        sessionStorage.setItem("deliveryBoyUser", JSON.stringify({ ...user, deliveryBoyId }));
      }
    } catch (err) {
      console.error("Delivery boy session store error:", err);
    }
  }, [user, auth?.currentUser]);

  const getValidToken = async () => {
    if (!auth?.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken(true);
    } catch (err) {
      console.error("टोकन लाने में त्रुटि:", err);
      return null;
    }
  };

  // ✅ Fix: myDeliveryBoyId को यहाँ user से सीधे प्राप्त करें
  // यह सुनिश्चित करता है कि जब user अपडेट हो तो myDeliveryBoyId भी अपडेट हो।
  const myDeliveryBoyId = user?.deliveryBoyId; 
  console.log("DEBUG: myDeliveryBoyId from user object (before useQuery):", myDeliveryBoyId); 


  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["deliveryOrders"],
    queryFn: async () => {
      try {
        const [availableRes, myRes] = await Promise.allSettled([
          apiRequest("get", "/api/delivery/orders/available"),
          apiRequest("get", "/api/delivery/orders/my"),
        ]);
        const availableOrders =
          availableRes.status === "fulfilled" && Array.isArray((availableRes.value as any).orders)
            ? (availableRes.value as any).orders
            : [];
        const myOrders =
          myRes.status === "fulfilled" && Array.isArray((myRes.value as any).orders)
            ? (myRes.value as any).orders
            : [];
        const map = new Map();
        [...availableOrders, ...myOrders].forEach((o) => {
          if (o && typeof o.id === "number") {
            map.set(o.id, {
              ...o,
              isMine: Number(o.deliveryBoyId) === Number(user?.deliveryBoyId),
            });
          }
        });
        return Array.from(map.values());
      } catch (err) {
        console.error("ऑर्डर लाने में त्रुटि:", err);
        toast({
          title: "डेटा लाने में त्रुटि",
          description: "ऑर्डर लाते समय कोई समस्या आई",
          variant: "destructive",
        });
        return [];
      }
    },
    // ✅ Fix: useQuery को तभी इनेबल करें जब user और myDeliveryBoyId दोनों उपलब्ध हों
    enabled: isAuthenticated && !!user && myDeliveryBoyId !== undefined && myDeliveryBoyId !== null,
  });

  useEffect(() => {
    if (!socket || !user) return;
    const onOrdersChanged = () => queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
    if (socket.emit) socket.emit("register-client", { role: "delivery", userId: user.uid ?? user.id });
    if (socket.on) {
      socket.on("delivery:orders-changed", onOrdersChanged);
      socket.on("new-order", onOrdersChanged);
      socket.on("order:update", onOrdersChanged);
    }
    return () => {
      if (socket.off) {
        socket.off("delivery:orders-changed", onOrdersChanged);
        socket.off("new-order", onOrdersChanged);
        socket.off("order:update", onOrdersChanged);
      }
    };
  }, [socket, user, queryClient, isAuthenticated]);

  // GPS tracking
  useEffect(() => {
    if (!socket || !user || isLoading || myDeliveryBoyId === undefined || myDeliveryBoyId === null) return; // ✅ myDeliveryBoyId की जांच करें

    let watchId: number | null = null;

    const activeOrder = orders.find((o: any) =>
      Number(o.deliveryBoyId) === Number(myDeliveryBoyId) && // ✅ सुनिश्चित करें कि ID मैच हो रहा है
      (o.deliveryStatus ?? "").toLowerCase() === "accepted" &&
      (o.status === "picked_up" || o.status === "out_for_delivery")
    );

    if (activeOrder && navigator.geolocation) {
      console.log(`📡 Starting GPS tracking for order ${activeOrder.id}`);

      const sendLocation = (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        socket.emit("deliveryBoy:location_update", {
          orderId: activeOrder.id,
          lat: latitude,
          lng: longitude,
          timestamp: new Date().toISOString()
        });
      };

      watchId = navigator.geolocation.watchPosition(
        sendLocation,
        (error) => {
          console.error("❌ Geolocation error:", error.message);
          if (error.code === error.PERMISSION_DENIED) {
            toast({
              title: "GPS अनुमति आवश्यक",
              description: "रियल-टाइम ट्रैकिंग के लिए स्थान (location) पहुँच की अनुमति दें।",
              variant: "destructive",
            });
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [orders, socket, user, isLoading, toast, myDeliveryBoyId]); // ✅ myDeliveryBoyId को dependencies array में जोड़ा

  // Mutations (बिना बदलाव)
  const acceptOrderMutation = useMutation({
    mutationFn: (orderId: number) => api.post("/api/delivery/accept", { orderId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] }),
    onError: () => toast({ title: "त्रुटि", description: "ऑर्डर स्वीकार करने में विफल", variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, newStatus }: { orderId: number; newStatus: string }) =>
      api.patch(`/api/delivery/orders/${orderId}/status`, { newStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] }),
    onError: () => toast({ title: "त्रुटि", description: "ऑर्डर स्थिति अपडेट करने में विफल", variant: "destructive" }),
  });

  const handleOtpSubmitMutation = useMutation({
    mutationFn: async ({ orderId, otp }: { orderId: number; otp: string }) => {
      const token = await getValidToken();
      if (!token) throw new Error("अमान्य या पुराना टोकन");
      const api_base = import.meta.env.VITE_API_BASE_URL || "https://shopnish-00ug.onrender.com";
      const response = await fetch(`${api_base}/api/delivery/orders/${orderId}/complete-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp }),
      });
      if (response.status === 401) throw new Error("OTP गलत है।");
      if (!response.ok) throw new Error("डिलीवरी पूरी करने में विफल");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
      toast({ title: "डिलीवरी पूरी हुई", description: "ऑर्डर सफलतापूर्वक डिलीवर हो गया है।", variant: "success" });
      setOtpDialogOpen(false);
      setOtp("");
      setSelectedOrder(null);
    },
    onError: (error: any) => {
      toast({ title: "OTP त्रुटि", description: error.message || "OTP जमा करने में विफल।", variant: "destructive" });
    },
  });

  const sendOtpToCustomerMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const token = await getValidToken();
      if (!token) throw new Error("अमान्य या पुराना टोकन");
      const api_base = import.meta.env.VITE_API_BASE_URL || "https://shopnish-00ug.onrender.com";
      const response = await fetch(`${api_base}/api/delivery/send-otp-to-customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "ग्राहक को OTP भेजने में विफल");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "OTP भेजा गया", description: "ग्राहक को WhatsApp पर OTP भेजा गया है।", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
    },
    onError: (error: any) => {
      toast({ title: "OTP भेजने में विफल", description: error.message || "कृपया पुनः प्रयास करें।", variant: "destructive" });
    },
  });

  const handleStatusProgress = (order: any) => {
    const currentStatus = (order.status ?? "").toLowerCase().trim();

    if (currentStatus === "out_for_delivery") {
      setSelectedOrder(order);
      setOtpDialogOpen(true);
      return; 
    }

    const next = getNextStatus(currentStatus);

    if (next === "accepted") return; 

    if (next) {
      if (next === "out_for_delivery" && currentStatus !== "out_for_delivery") {
        sendOtpToCustomerMutation.mutate(order.id);
      }
      updateStatusMutation.mutate({ orderId: order.id, newStatus: next });
    }
  };

  const handleOtpConfirmation = () => {
    if (!selectedOrder || otp.trim().length !== 6) {
      toast({ title: "OTP दर्ज करें", description: "6-अंकों का OTP आवश्यक है।", variant: "destructive" });
      return;
    }
    handleOtpSubmitMutation.mutate({ orderId: selectedOrder.id, otp });
  };

  const handleLogout = () => auth?.signOut().then(() => window.location.reload());

  const { assignedOrders, availableOrders, historyOrders, totalOrdersCount, pendingCount, deliveredCount, outForDeliveryCount } =
    useMemo(() => {
      const allOrders = orders || [];
      // ✅ Fix: myId को तभी सेट करें जब myDeliveryBoyId वास्तव में उपलब्ध हो
      const myId = myDeliveryBoyId !== undefined && myDeliveryBoyId !== null ? Number(myDeliveryBoyId) : null; 

      console.log("--- useMemo Debug Start ---");
      console.log("myDeliveryBoyId (as Number for comparison):", myId); // ✅ देखें कि यह NaN नहीं है
      console.log("Total Orders from API:", allOrders.length, allOrders); 

      const available = allOrders.filter((o: any) => {
        const status = (o.status ?? "").toLowerCase();
        const deliveryStatus = (o.deliveryStatus ?? "").toLowerCase(); 
        
        const isAvailable = (
            o.deliveryBoyId === null && 
            deliveryStatus === "pending" && 
            (status === "pending" || status === "ready_for_pickup") && 
            status !== "rejected" && 
            status !== "cancelled"
        );
        return isAvailable;
      });

      const assigned = allOrders.filter((o: any) => {
        const status = (o.status ?? "").toLowerCase();
        const deliveryStatus = (o.deliveryStatus ?? "").toLowerCase(); 
        
        const orderDeliveryBoyId = o.deliveryBoyId !== null && o.deliveryBoyId !== undefined ? Number(o.deliveryBoyId) : null;
        
        // ✅ Fix: सुनिश्चित करें कि myId null नहीं है, और फिर तुलना करें
        const isAssigned = (
          myId !== null && // ✅ यहाँ जाँच करें
          orderDeliveryBoyId === myId && 
          deliveryStatus === "accepted" && 
          status !== "delivered" && 
          status !== "rejected" &&
          status !== "cancelled"
        );

        // ✅ इन विस्तृत डिबग लॉग्स को अनकमेंट करें यदि 'assignedOrders' अभी भी 0 हैं
        // if (orderDeliveryBoyId !== null && myId !== null && orderDeliveryBoyId === myId) { 
        //     console.log(`--- Order ID: ${o.id} Debug (Assigned) ---`);
        //     console.log(`  - myDeliveryBoyId (as Number for comparison): ${myId}`);
        //     console.log(`  - order.deliveryBoyId (from API): ${o.deliveryBoyId} (as Number: ${orderDeliveryBoyId})`);
        //     console.log(`  - ID Match (orderDeliveryBoyId === myId): ${orderDeliveryBoyId === myId}`);
        //     console.log(`  - order.deliveryStatus (from API): '${o.deliveryStatus}' (as Lowercase: '${deliveryStatus}')`);
        //     console.log(`  - deliveryStatus is 'accepted': ${deliveryStatus === "accepted"}`);
        //     console.log(`  - order.status (from API): '${o.status}' (as Lowercase: '${status}')`);
        //     console.log(`  - Main Status NOT delivered/rejected/cancelled: ${status !== "delivered" && status !== "rejected" && status !== "cancelled"}`);
        //     console.log(`  - Final isAssigned: ${isAssigned}`);
        //     console.log(`-------------------------------------`);
        // }
        
        return isAssigned;
      });

      const history = allOrders.filter((o: any) => {
        const status = (o.status ?? "").toLowerCase();
        const isCompleted = status === "delivered" || status === "rejected" || status === "cancelled";
        if (isCompleted && dateFilter && o.createdAt) { 
            const orderDate = new Date(o.createdAt); orderDate.setHours(0,0,0,0);
            const filterDateMidnight = new Date(dateFilter); filterDateMidnight.setHours(0,0,0,0);
            return orderDate >= filterDateMidnight; 
        }
        return isCompleted; 
      });

      const total = allOrders.length;
      const pending = available.length;
      const delivered = history.filter((o: any) => (o.status ?? "").toLowerCase() === "delivered").length;
      const outForDelivery = assigned.filter((o: any) => (o.status ?? "").toLowerCase() === "out_for_delivery").length;

      console.log("Assigned Orders Final Count:", assigned.length, assigned); 
      console.log("--- useMemo Debug End ---");

      return {
        assignedOrders: assigned,
        availableOrders: available,
        historyOrders: history,
        totalOrdersCount: total,
        pendingCount: pending,
        deliveredCount: delivered,
        outForDeliveryCount: outForDelivery,
      };
    }, [orders, dateFilter, myDeliveryBoyId]); // ✅ myDeliveryBoyId को निर्भरता के रूप में जोड़ा

  if (isLoadingAuth || !isAuthenticated || !user || !socket || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-gray-500 mt-2">Connecting to server...</p>
      </div>
    ); 
  }
    
  return (
    <div className="min-h-screen bg-gray-50 font-inter text-gray-800">
      <header className="bg-white shadow-sm border-b rounded-b-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">डिलीवरी डैशबोर्ड</h1>
              <p className="text-sm text-gray-600">फिर से स्वागत है, {user?.name ?? 'डिलीवरी बॉय'}!</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" />
              लॉगआउट
            </Button>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center space-x-3">
            <Package className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{totalOrdersCount}</p>
              <p className="text-sm text-gray-600">कुल ऑर्डर</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center space-x-3">
            <Clock className="w-8 h-8 text-amber-600" />
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-gray-600">लंबित (उपलब्ध)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center space-x-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{deliveredCount}</p>
              <p className="text-sm text-gray-600">डिलीवर हुए</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center space-x-3">
            <Navigation className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold">{outForDeliveryCount}</p>
              <p className="text-sm text-gray-600">रास्ते में</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Tab Navigation & Date Filter */}
      <section className="max-w-6xl mx-auto px-4 pb-4">
        <div className="flex justify-between items-end mb-4 flex-wrap gap-4">
          <div className="flex space-x-2 border-b border-gray-200">
            <Button 
              variant={activeTab === 0 ? "default" : "outline"} 
              onClick={() => setActiveTab(0)}
              className={activeTab === 0 ? "bg-blue-600 text-white hover:bg-blue-700" : "hover:bg-gray-100"}
            >
              <Zap className="w-4 h-4 mr-2" />
              आपके असाइन किए गए ({assignedOrders.length})
            </Button>
            <Button 
              variant={activeTab === 1 ? "default" : "outline"} 
              onClick={() => setActiveTab(1)}
              className={activeTab === 1 ? "bg-amber-600 text-white hover:bg-amber-700" : "hover:bg-gray-100"}
            >
              <Clock className="w-4 h-4 mr-2" />
              उपलब्ध ऑर्डर ({availableOrders.length})
            </Button>
            <Button 
              variant={activeTab === 2 ? "default" : "outline"} 
              onClick={() => setActiveTab(2)}
              className={activeTab === 2 ? "bg-green-600 text-white hover:bg-green-700" : "hover:bg-gray-100"}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              डिलीवर किए गए / हिस्ट्री ({historyOrders.length})
            </Button>
          </div>

          {/* Date filter for history */}
          {activeTab === 2 && (
            <div className="flex items-center space-x-2">
              <Label htmlFor="date-filter" className="text-sm text-gray-600 whitespace-nowrap">से ऑर्डर दिखाएँ:</Label>
              <div className="relative">
                <Input
                  id="date-filter"
                  type="date"
                  value={dateFilter ? format(dateFilter, "yyyy-MM-dd") : ""} 
                  onChange={(e) => setDateFilter(e.target.value ? new Date(e.target.value) : null)}
                  className="pl-8 w-40"
                />
                <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Orders List */}
      <section className="max-w-6xl mx-auto px-4 pb-16 space-y-10">
        <h2 className="text-2xl font-bold mb-4">
          {activeTab === 0 && "आपके असाइन किए गए ऑर्डर"}
          {activeTab === 1 && "उपलब्ध पिकअप के लिए ऑर्डर"}
          {activeTab === 2 && `पूरे हुए/कैंसल ऑर्डर (शुरुआत: ${dateFilter ? format(dateFilter, "dd MMM yyyy") : 'सभी'})`}
        </h2>

        {activeTab === 0 && (
          <OrdersListView 
            orders={assignedOrders} 
            title="कोई असाइन किए गए ऑर्डर नहीं" 
            subtitle="नए ऑर्डर स्वीकार करें या पुराने ऑर्डर डिलीवर करें।"
            myDeliveryBoyId={myDeliveryBoyId} 
            onAcceptOrder={(() => {}) as any} 
            onUpdateStatus={(order: any) => handleStatusProgress(order)}
            acceptLoading={false}
            updateLoading={updateStatusMutation.isPending}
            Button={Button} Card={Card} CardContent={CardContent} CardHeader={CardHeader} CardTitle={CardTitle} Badge={Badge}
            statusColor={getStatusColor} statusText={getStatusText} nextStatus={getNextStatus} nextStatusLabel={getNextStatusLabel}
          />
        )}

        {activeTab === 1 && (
          <OrdersListView 
            orders={availableOrders} 
            title="कोई उपलब्ध ऑर्डर नहीं" 
            subtitle="नए ऑर्डर के लिए बाद में जाँच करें।"
            myDeliveryBoyId={myDeliveryBoyId} 
            onAcceptOrder={(id: number) => acceptOrderMutation.mutate(id)}
            onUpdateStatus={(() => {}) as any}
            acceptLoading={acceptOrderMutation.isPending}
            updateLoading={false} 
            Button={Button} Card={Card} CardContent={CardContent} CardHeader={CardHeader} CardTitle={CardTitle} Badge={Badge}
            statusColor={getStatusColor} statusText={getStatusText} nextStatus={getNextStatus} nextStatusLabel={getNextStatusLabel}
          />
        )}

        {activeTab === 2 && (
          <OrdersListView 
            orders={historyOrders} 
            title="कोई इतिहास ऑर्डर नहीं" 
            subtitle={`चुनी हुई तारीख़ (${format(dateFilter ?? new Date(), "dd MMM yyyy")}) के बाद कोई पूरा हुआ ऑर्डर नहीं मिला।`}
            myDeliveryBoyId={myDeliveryBoyId} 
            onAcceptOrder={(() => {}) as any} 
            onUpdateStatus={(() => {}) as any}
            acceptLoading={false} 
            updateLoading={false}
            Button={Button} Card={Card} CardContent={CardContent} CardHeader={CardHeader} CardTitle={CardTitle} Badge={Badge}
            statusColor={getStatusColor} statusText={getStatusText} nextStatus={getNextStatus} nextStatusLabel={getNextStatusLabel}
          />
        )}
      </section>

      {/* OTP Dialog */}
      <DeliveryOtpDialog
        open={otpDialogOpen}
        onOpenChange={setOtpDialogOpen}
        otp={otp}
        setOtp={setOtp}
        onConfirm={handleOtpConfirmation}
        isLoading={handleOtpSubmitMutation.isPending}
        orderNumber={selectedOrder?.orderNumber}
      />
    </div>
  ); 
} 

// --- Helper Component for Orders List ---
const OrdersListView: React.FC<any> = ({ orders, title, subtitle, ...props }) => (
  <>
    {orders.length === 0 ? (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">{title}</h3>
          <p className="text-gray-600">{subtitle}</p>
        </CardContent>
      </Card>
    ) : (
      <DeliveryOrdersList
        orders={orders}
        onAcceptOrder={props.onAcceptOrder} 
        onUpdateStatus={props.onUpdateStatus} 
        acceptLoading={props.acceptLoading}
        updateLoading={props.updateLoading}
        Button={props.Button} Card={props.Card} CardContent={props.CardContent} CardHeader={props.CardHeader} 
        CardTitle={props.CardTitle} Badge={props.Badge} statusColor={props.statusColor} 
        statusText={props.statusText} nextStatus={props.nextStatus} nextStatusLabel={props.nextStatusLabel}
      />
    )}
  </>
); 