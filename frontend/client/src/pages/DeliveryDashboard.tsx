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
    case "pending":          return "bg-amber-600 hover:bg-amber-700";
    case "accepted":         return "bg-blue-600 hover:bg-blue-700";
    case "ready_for_pickup": return "bg-yellow-500 hover:bg-yellow-600";
    case "picked_up":        return "bg-indigo-600 hover:bg-indigo-700";
    case "out_for_delivery": return "bg-purple-600 hover:bg-purple-700";
    case "delivered":        return "bg-green-600 hover:bg-green-700";
    case "rejected":
    case "cancelled":        return "bg-red-500 hover:bg-red-600";
    default:                 return "bg-gray-500 hover:bg-gray-600";
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case "pending":          return "लंबित (उपलब्ध)";
    case "accepted":         return "स्वीकृत (असाइन)";
    case "preparing":        return "तैयार हो रहा है";
    case "ready_for_pickup": return "पिकअप के लिए तैयार";
    case "picked_up":        return "पिकअप हो गया";
    case "out_for_delivery": return "डिलीवरी के लिए निकला";
    case "delivered":        return "डिलीवर हो गया";
    case "rejected":         return "अस्वीकृत";
    case "cancelled":        return "रद्द";
    default:                 return status || "अज्ञात";
  }
};

const getNextStatus = (current: string) => {
  switch (current) {
    case "ready_for_pickup":  return "picked_up";
    case "picked_up":         return "out_for_delivery";
    case "out_for_delivery":  return null; 
    default:                  return null;
  }
};

const getNextStatusLabel = (status: string) => {
  switch (status) {
    case "ready_for_pickup":  return "पिकअप करें";
    case "picked_up":         return "डिलीवरी के लिए निकले";
    case "out_for_delivery":  return "डिलीवरी पूरी करें (OTP)";
    default:                  return "";
  }
};
// --- Main Component ---
export default function DeliveryDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, auth, isLoadingAuth, isAuthenticated } = useAuth();
  const rawSocket = useSocket() as any;
  const socket = rawSocket?.socket ?? rawSocket;

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
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
    if (!auth?.currentUser) {
        console.error("DEBUG: getValidToken - auth.currentUser is null or undefined. User might be logged out.");
        return null;
    }
    try {
      const token = await auth.currentUser.getIdToken(true);
      console.log("DEBUG: Token fetched successfully (first 20 chars):", token?.substring(0, 20), "...");
      return token;
    } catch (err: any) { // err को 'any' टाइप करें
      // 🔥 Firebase error code को लॉग करें
      console.error("DEBUG: ❌ Error fetching ID token:", err.message, "Code:", err.code); 
      return null;
    }
  };

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
    enabled: isAuthenticated && !!user && myDeliveryBoyId !== undefined && myDeliveryBoyId !== null,
  });

  useEffect(() => {
    if (!socket || !user) return;
    const onOrdersChanged = () => queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
    if (typeof socket.emit === 'function') socket.emit("register-client", { role: "delivery", userId: user.uid ?? user.id });
    if (typeof socket.on === 'function') {
      socket.on("delivery:orders-changed", onOrdersChanged);
      socket.on("new-order", onOrdersChanged);
      socket.on("order:update", onOrdersChanged);
    }
    return () => {
      if (typeof socket.off === 'function') {
        socket.off("delivery:orders-changed", onOrdersChanged);
        socket.off("new-order", onOrdersChanged);
        socket.off("order:update", onOrdersChanged);
      }
    };
  }, [socket, user, queryClient, isAuthenticated]);

  // GPS tracking
  useEffect(() => {
    if (!socket || !user || isLoading || myDeliveryBoyId === undefined || myDeliveryBoyId === null) return;

    let watchId: number | null = null;

    const activeOrder = orders.find((o: any) =>
      Number(o.deliveryBoyId) === Number(myDeliveryBoyId) &&
      (o.deliveryStatus ?? "").toLowerCase() === "accepted" &&
      (o.status === "picked_up" || o.status === "out_for_delivery")
    );

    if (activeOrder && navigator.geolocation) {
      console.log(`📡 Starting GPS tracking for order ${activeOrder.id}`);

      const sendLocation = (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        if (typeof socket.emit === 'function') {
          socket.emit("deliveryBoy:location_update", {
            orderId: activeOrder.id,
            lat: latitude,
            lng: longitude,
            timestamp: new Date().toISOString()
          });
        } else {
            console.error("❌ Socket.emit is not a function in GPS tracking.");
        }
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
  }, [orders, socket, user, isLoading, toast, myDeliveryBoyId]);

  // Mutations
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

  
// ✅ Unified Delivery Mutations (Production Ready)
const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://shopnish-seprate.onrender.com";

// ✅ OTP Submit + Complete Delivery
const handleOtpSubmitMutation = useMutation({
  mutationFn: async ({ orderId, otp }: { orderId: number; otp: string }) => {
    const token = await getValidToken();
    if (!token) throw new Error("अमान्य या पुराना टोकन");

    const response = await fetch(`${API_BASE}/api/delivery/orders/${orderId}/complete-delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ otp }),
    });

    if (response.status === 401) throw new Error("OTP गलत है।");
    if (!response.ok) throw new Error("डिलीवरी पूरी करने में विफल");

    const data = await response.json();

    // ✅ Delivery सफल होने के बाद WhatsApp पर "Thanks" मैसेज भेजो
    await fetch(`${API_BASE}/api/whatsapp/send-delivery-thanks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        customerPhone: data?.customerPhone,
        customerName: data?.customerName,
      }),
    }).catch(() => console.warn("⚠️ WhatsApp Thanks Message भेजने में समस्या"));

    return data;
  },

  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
    toast({
      title: "डिलीवरी पूरी हुई",
      description: "ऑर्डर सफलतापूर्वक डिलीवर हो गया है।",
      variant: "success",
    });
    setOtpDialogOpen(false);
    setSelectedOrder(null);
  },

  onError: (error: any) => {
    toast({
      title: "OTP त्रुटि",
      description: error.message || "OTP जमा करने में विफल।",
      variant: "destructive",
    });
  },
});

// ✅ ग्राहक को WhatsApp पर OTP भेजने वाला mutation
const sendOtpToCustomerMutation = useMutation({
  mutationFn: async (orderId: number) => {
    const token = await getValidToken();
    if (!token) throw new Error("अमान्य या पुराना टोकन");

    const response = await fetch(`${API_BASE}/api/delivery/orders/${orderId}/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "ग्राहक को OTP भेजने में विफल");
    }

    return response.json();
  },

  onSuccess: () => {
    toast({
      title: "OTP भेजा गया",
      description: "ग्राहक को WhatsApp पर OTP भेजा गया है।",
      variant: "success",
    });
    queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
  },

  onError: (error: any) => {
    toast({
      title: "OTP भेजने में विफल",
      description: error.message || "कृपया पुनः प्रयास करें।",
      variant: "destructive",
    });
  },
});

// ✅ बिना OTP के डिलीवरी पूरी करने वाला mutation
const completeWithoutOtpMutation = useMutation({
  mutationFn: async (orderId: number) => {
    const token = await getValidToken();
    if (!token) throw new Error("अमान्य या पुराना टोकन");

    const response = await fetch(`${API_BASE}/api/delivery/orders/${orderId}/complete-without-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "बिना OTP के डिलीवरी पूरी करने में विफल।");
    }

    const data = await response.json();

    // ✅ WhatsApp Thanks Message भेजो
    await fetch(`${API_BASE}/api/whatsapp/send-delivery-thanks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        customerPhone: data?.customerPhone,
        customerName: data?.customerName,
      }),
    }).catch(() => console.warn("⚠️ WhatsApp Thanks Message भेजने में समस्या"));

    return data;
  },

  onSuccess: () => {
    toast({
      title: "डिलीवरी पूरी हुई",
      description: "ऑर्डर बिना OTP के सफलतापूर्वक डिलीवर हो गया है।",
      variant: "success",
    });
    setOtpDialogOpen(false);
    setSelectedOrder(null);
  },

  onError: (error: any) => {
    toast({
      title: "त्रुटि",
      description: error.message || "बिना OTP के डिलीवरी पूरी करने में विफल।",
      variant: "destructive",
    });
  },
});
  
  
  const handleStatusProgress = (order: any) => {
    console.log("handleStatusProgress: Order ID:", order.id, "Current Status:", order.status);
    
    const currentStatus = (order.status ?? "").toLowerCase().trim();
    console.log("handleStatusProgress: Trimmed and lowercased status:", currentStatus);

    if (currentStatus === "out_for_delivery") {
      console.log("handleStatusProgress: Status is 'out_for_delivery'. Opening OTP dialog.");
      setSelectedOrder(order);
      setOtpDialogOpen(true);
      return;
    }

    const next = getNextStatus(currentStatus);
    console.log("handleStatusProgress: Next expected status:", next);

    if (!next) {
        console.log("handleStatusProgress: No next status defined for current status. Stopping.");
        return;
    }

    if (next === "out_for_delivery") {
      console.log(`handleStatusProgress: Moving to 'out_for_delivery' from '${currentStatus}'. Triggering sendOtpToCustomerMutation.`);
      // यह mutation OTP भेजेगा और बैकएंड को स्टेटस 'out_for_delivery' में अपडेट करना चाहिए।
      sendOtpToCustomerMutation.mutate(order.id); 
    } else {
        console.log(`handleStatusProgress: Updating status for order ${order.id} to '${next}'.`);
        updateStatusMutation.mutate({ orderId: order.id, newStatus: next });
    }
};

  const handleOtpConfirmation = (otpValue: string) => {
    console.log("handleOtpConfirmation: Confirming OTP for Order ID:", selectedOrder?.id, "OTP entered:", otpValue);
    if (!selectedOrder || otpValue.trim().length !== 4) {
      toast({ title: "OTP दर्ज करें", description: "4-अंकों का OTP आवश्यक है।", variant: "destructive" });
      return;
    }
    handleOtpSubmitMutation.mutate({ orderId: selectedOrder.id, otp: otpValue });
  };

  const handleSendManualOtp = (orderId: number) => {
    console.log("handleSendManualOtp: Initiating manual OTP send for Order ID:", orderId);
    sendManualOtpMutation.mutate(orderId);
  };

  const handleCompleteWithoutOtp = (orderId: number) => {
    console.log("handleCompleteWithoutOtp: Attempting to complete delivery without OTP for Order ID:", orderId);
    if (window.confirm("क्या आप वाकई इस ऑर्डर को बिना OTP के डिलीवर करना चाहते हैं? यह केवल विशेष परिस्थितियों के लिए है और ऑडिट के लिए लॉग किया जाएगा।")) {
      completeWithoutOtpMutation.mutate(orderId);
    }
  };


  const handleLogout = () => auth?.signOut().then(() => window.location.reload());

  const { assignedOrders, availableOrders, historyOrders, totalOrdersCount, pendingCount, deliveredCount, outForDeliveryCount } =
    useMemo(() => {
      const allOrders = orders || [];
      const myId = myDeliveryBoyId !== undefined && myDeliveryBoyId !== null ? Number(myDeliveryBoyId) : null; 

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
        
        const isAssigned = (
          myId !== null && 
          orderDeliveryBoyId === myId && 
          deliveryStatus === "accepted" && 
          status !== "delivered" && 
          status !== "rejected" &&
          status !== "cancelled"
        );
        
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

      return {
        assignedOrders: assigned,
        availableOrders: available,
        historyOrders: history,
        totalOrdersCount: total,
        pendingCount: pending,
        deliveredCount: delivered,
        outForDeliveryCount: outForDelivery,
      };
    }, [orders, dateFilter, myDeliveryBoyId]);

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
    {/* ✅ OTP Dialog (WhatsApp integrated version) */}
{otpDialogOpen && selectedOrder && (
  <DeliveryOtpDialog
    isOpen={otpDialogOpen}
    onOpenChange={setOtpDialogOpen}
    order={selectedOrder}
    onConfirm={async (otp: string) => {
      try {
        const response = await fetch(`${API_BASE}/api/whatsapp/verify-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: selectedOrder.id, otp }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || "OTP सत्यापन असफल रहा");
        }

        toast({
          title: "OTP सफलतापूर्वक सत्यापित ✅",
          description: "डिलीवरी पूरी हो गई है।",
          variant: "success",
        });

        setOtpDialogOpen(false);
        setSelectedOrder(null);
        queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });

        // ✅ WhatsApp Thank-you message भेजो
        await fetch(`${API_BASE}/api/whatsapp/send-delivery-thanks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: selectedOrder.id,
            customerPhone: selectedOrder.customerPhone,
            customerName: selectedOrder.customerName,
          }),
        }).catch(() => console.warn("⚠️ WhatsApp Thanks Message नहीं भेजा जा सका"));
      } catch (error: any) {
        toast({
          title: "OTP त्रुटि",
          description: error.message || "OTP सत्यापन विफल हुआ।",
          variant: "destructive",
        });
      }
    }}
    isSubmitting={handleOtpSubmitMutation?.isPending || false}
    error={null}

    // ✅ WhatsApp OTP भेजना
    onSendManualOtp={async () => {
      try {
        const response = await fetch(`${API_BASE}/api/whatsapp/send-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: selectedOrder.id }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || "OTP भेजने में त्रुटि");
        }

        toast({
          title: "OTP भेजा गया 📩",
          description: "ग्राहक को WhatsApp पर OTP भेजा गया है।",
          variant: "success",
        });
      } catch (error: any) {
        toast({
          title: "OTP भेजने में विफल",
          description: error.message || "कृपया पुनः प्रयास करें।",
          variant: "destructive",
        });
      }
    }}
    isSendingManualOtp={false}

    // ✅ बिना OTP के डिलीवरी पूरी करना
    onCompleteWithoutOtp={async () => {
      try {
        const response = await fetch(`${API_BASE}/api/delivery/orders/${selectedOrder.id}/complete-without-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || "बिना OTP के डिलीवरी असफल रही");
        }

        toast({
          title: "डिलीवरी पूरी हुई ✅",
          description: "ऑर्डर बिना OTP के डिलीवर कर दिया गया है।",
          variant: "success",
        });

        setOtpDialogOpen(false);
        setSelectedOrder(null);
        queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });

        // ✅ WhatsApp Thank-you message भेजो
        await fetch(`${API_BASE}/api/whatsapp/send-delivery-thanks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: selectedOrder.id,
            customerPhone: selectedOrder.customerPhone,
            customerName: selectedOrder.customerName,
          }),
        }).catch(() => console.warn("⚠️ WhatsApp Thanks Message नहीं भेजा जा सका"));
      } catch (error: any) {
        toast({
          title: "त्रुटि",
          description: error.message || "बिना OTP के डिलीवरी विफल रही।",
          variant: "destructive",
        });
      }
    } }
    isCompletingWithoutOtp={false}
  />
)}
    </div>
    );
}
// --- Helper Component for Orders List ---
interface OrdersListViewProps {
  orders: any[];
  title: string;
  subtitle?: string;
  myDeliveryBoyId: number | null | undefined;
  onAcceptOrder: (orderId: number) => void;
  onUpdateStatus: (order: any) => void; // Changed from (orderId: string, status: string) to (order: any)
  acceptLoading: boolean;
  updateLoading: boolean;
  Button: React.ElementType;
  Card: React.ElementType;
  CardContent: React.ElementType;
  CardHeader: React.ElementType;
  CardTitle: React.ElementType;
  Badge: React.ElementType;
  statusColor: (status: string) => string;
  statusText: (status: string) => string;
  nextStatus: (status: string) => string | null; // Can return null
  nextStatusLabel: (status: string) => string;
}

const OrdersListView: React.FC<OrdersListViewProps> = ({ 
  orders, 
  title, 
  subtitle, 
  myDeliveryBoyId, 
  onAcceptOrder, 
  onUpdateStatus, 
  acceptLoading, 
  updateLoading, 
  Button, 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  Badge, 
  statusColor, 
  statusText, 
  nextStatus, 
  nextStatusLabel,
}) => {
  return (
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
          onAcceptOrder={onAcceptOrder}
          onUpdateStatus={onUpdateStatus}
          acceptLoading={acceptLoading}
          updateLoading={updateLoading}
          Button={Button} Card={Card} CardContent={CardContent} CardHeader={CardHeader}
          CardTitle={CardTitle} Badge={Badge} statusColor={statusColor}
          statusText={statusText} nextStatus={nextStatus} nextStatusLabel={nextStatusLabel}
        />
      )}
    </>
  );
};
