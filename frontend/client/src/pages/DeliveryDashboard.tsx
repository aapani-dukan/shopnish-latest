import React, { useState, useEffect, useMemo } from "react"; // ✅ सभी imports सही केस में
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"; // ✅ @tanstack/react-query से इंपोर्ट करें

import {
  User as UserIcon, // ✅ UserIcon को User से बदला गया
  LogOut,             // ✅ LogOut को logout से बदला गया
  Package,            // ✅ Package को package से बदला गया
  Clock,              // ✅ Clock को clock से बदला गया
  CheckCircle,        // ✅ CheckCircle को checkcircle से बदला गया
  Navigation,         // ✅ Navigation को navigation से बदला गया
  Loader2,            // ✅ Loader2 को loader2 से बदला गया
  Calendar,           // ✅ Calendar को calendar से बदला गया
  Zap,                // ✅ Zap को zap से बदला गया
} from "lucide-react"; // ✅ सभी Lucide आइकन्स सही केस में

import { format } from "date-fns"; // ✅ format सही है

import DeliveryOtpDialog from "./DeliveryOtpDialog"; // ✅ DeliveryOtpDialog सही केस में
import DeliveryOrdersList from "./DeliveryOrdersList"; // ✅ DeliveryOrdersList सही केस में
import { useAuth } from "../hooks/useAuth"; // ✅ useAuth सही केस में
import { useSocket } from "../hooks/useSocket"; // ✅ useSocket सही केस में
import { apiRequest } from "../lib/queryClient"; // ✅ apiRequest सही केस में
import api from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"; // ✅ Card कॉम्पोनेंट्स सही केस में
import { Badge } from "../components/ui/badge"; // ✅ Badge सही केस में
import { Button } from "../components/ui/button"; // ✅ Button सही केस में
import { useToast } from "../hooks/use-toast"; // ✅ useToast सही केस में
import { Label } from "../components/ui/label"; // ✅ Label सही केस में
import { Input } from "../components/ui/input"; // ✅ Input सही केस में

// --- Utility Functions ---
// ✅ सभी फंक्शन नाम camelCase में
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
export default function DeliveryDashboard() { // ✅ कॉम्पोनेंट का नाम PascalCase में
  const { toast } = useToast(); // ✅ useToast सही केस में
  const queryClient = useQueryClient(); // ✅ queryClient सही केस में
  const { user, auth, isLoadingAuth, isAuthenticated } = useAuth(); // ✅ सभी सही केस में
  const rawSocket = useSocket() as any; // ✅ useSocket सही केस में
  // ✅ सुनिश्चित करें कि socket null या undefined है अगर useSocket() कुछ नहीं लौटाता है
  const socket = rawSocket?.socket ?? rawSocket; 

  const [selectedOrder, setSelectedOrder] = useState<any>(null); // ✅ सभी स्टेट्स सही केस में
  const [otp, setOtp] = useState(""); // ✅ OTP डायलॉग के अंदर चला गया है
  const [otpDialogOpen, setOtpDialogOpen] = useState(false); // ✅ सही केस में
  const [activeTab, setActiveTab] = useState(0); // ✅ सही केस में
  const [dateFilter, setDateFilter] = useState<Date | null>(() => { // ✅ सही केस में
    const fiveDaysAgo = new Date(); // ✅ Date सही केस में
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    return fiveDaysAgo;
  });
  
  useEffect(() => {
    if (!user || !auth?.currentUser) return; // ✅ currentUser सही केस में
    try {
      const deliveryBoyId = user?.deliveryBoyId; // ✅ deliveryBoyId सही केस में
      if (deliveryBoyId !== undefined) {
        sessionStorage.setItem("deliveryBoyUser", JSON.stringify({ ...user, deliveryBoyId })); // ✅ sessionStorage, JSON सही केस में
      }
    } catch (err) {
      console.error("Delivery boy session store error:", err);
    }
  }, [user, auth?.currentUser]); // ✅ currentUser सही केस में

  const getValidToken = async () => { // ✅ getValidToken सही केस में
    if (!auth?.currentUser) return null; // ✅ currentUser सही केस में
    try {
      return await auth.currentUser.getIdToken(true); // ✅ getIdToken सही केस में
    } catch (err) {
      console.error("टोकन लाने में त्रुटि:", err);
      return null;
    }
  };

  // ✅ Fix: myDeliveryBoyId को यहाँ user से सीधे प्राप्त करें
  const myDeliveryBoyId = user?.deliveryBoyId; // ✅ सही केस में
  console.log("DEBUG: myDeliveryBoyId from user object (before useQuery):", myDeliveryBoyId); 


  const { data: orders = [], isLoading } = useQuery({ // ✅ isLoading सही केस में
    queryKey: ["deliveryOrders"], // ✅ queryKey सही केस में
    queryFn: async () => { // ✅ queryFn सही केस में
      try {
        const [availableRes, myRes] = await Promise.allSettled([ // ✅ Promise.allSettled सही केस में
          apiRequest("get", "/api/delivery/orders/available"), // ✅ apiRequest सही केस में
          apiRequest("get", "/api/delivery/orders/my"), // ✅ apiRequest सही केस में
        ]);
        const availableOrders = // ✅ सही केस में
          availableRes.status === "fulfilled" && Array.isArray((availableRes.value as any).orders) // ✅ Array.isArray सही केस में
            ? (availableRes.value as any).orders
            : [];
        const myOrders = // ✅ सही केस में
          myRes.status === "fulfilled" && Array.isArray((myRes.value as any).orders) // ✅ Array.isArray सही केस में
            ? (myRes.value as any).orders
            : [];
        const map = new Map(); // ✅ Map सही केस में
        [...availableOrders, ...myOrders].forEach((o) => { // ✅ forEach सही केस में
          if (o && typeof o.id === "number") {
            map.set(o.id, {
              ...o,
              isMine: Number(o.deliveryBoyId) === Number(user?.deliveryBoyId), // ✅ Number, deliveryBoyId सही केस में
            });
          }
        });
        return Array.from(map.values()); // ✅ Array.from सही केस में
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
    // ✅ Fix: socket एक ऑब्जेक्ट होना चाहिए जिसमें emit और on विधियां हों
    if (typeof socket.emit === 'function') socket.emit("register-client", { role: "delivery", userId: user.uid ?? user.id }); // ✅ userId सही केस में
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
    if (!socket || !user || isLoading || myDeliveryBoyId === undefined || myDeliveryBoyId === null) return; // ✅ myDeliveryBoyId सही केस में

    let watchId: number | null = null; // ✅ watchId सही केस में

    const activeOrder = orders.find((o: any) =>
      Number(o.deliveryBoyId) === Number(myDeliveryBoyId) && // ✅ deliveryBoyId, Number सही केस में
      (o.deliveryStatus ?? "").toLowerCase() === "accepted" && // ✅ toLowerCase सही केस में
      (o.status === "picked_up" || o.status === "out_for_delivery")
    );

    if (activeOrder && navigator.geolocation) {
      console.log(`📡 Starting GPS tracking for order ${activeOrder.id}`);

      const sendLocation = (position: GeolocationPosition) => { // ✅ GeolocationPosition सही केस में
        const { latitude, longitude } = position.coords;
        // ✅ Fix: सुनिश्चित करें कि socket.emit एक फ़ंक्शन है
        if (typeof socket.emit === 'function') {
          socket.emit("deliveryBoy:location_update", { // ✅ deliveryBoy:location_update सही केस में
            orderId: activeOrder.id, // ✅ orderId सही केस में
            lat: latitude,
            lng: longitude,
            timestamp: new Date().toISOString() // ✅ Date सही केस में
          });
        } else {
            console.error("❌ Socket.emit is not a function in GPS tracking.");
        }
      };

      watchId = navigator.geolocation.watchPosition(
        sendLocation,
        (error) => {
          console.error("❌ Geolocation error:", error.message);
          if (error.code === error.PERMISSION_DENIED) { // ✅ PERMISSION_DENIED सही केस में
            toast({
              title: "GPS अनुमति आवश्यक",
              description: "रियल-टाइम ट्रैकिंग के लिए स्थान (location) पहुँच की अनुमति दें।",
              variant: "destructive",
            });
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } // ✅ enableHighAccuracy, maximumAge सही केस में
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId); // ✅ clearWatch सही केस में
    };
  }, [orders, socket, user, isLoading, toast, myDeliveryBoyId]); // ✅ myDeliveryBoyId को dependencies array में जोड़ा

  // Mutations
  const acceptOrderMutation = useMutation({ // ✅ acceptOrderMutation सही केस में
    mutationFn: (orderId: number) => api.post("/api/delivery/accept", { orderId }), // ✅ orderId सही केस में
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] }), // ✅ queryClient सही केस में
    onError: () => toast({ title: "त्रुटि", description: "ऑर्डर स्वीकार करने में विफल", variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({ // ✅ updateStatusMutation सही केस में
    mutationFn: ({ orderId, newStatus }: { orderId: number; newStatus: string }) => // ✅ orderId, newStatus सही केस में
      api.patch(`/api/delivery/orders/${orderId}/status`, { newStatus }), // ✅ newStatus सही केस में
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] }), // ✅ queryClient सही केस में
    onError: () => toast({ title: "त्रुटि", description: "ऑर्डर स्थिति अपडेट करने में विफल", variant: "destructive" }),
  });

  const handleOtpSubmitMutation = useMutation({ // ✅ handleOtpSubmitMutation सही केस में
    mutationFn: async ({ orderId, otp }: { orderId: number; otp: string }) => { // ✅ orderId सही केस में
      const token = await getValidToken(); // ✅ getValidToken सही केस में
      if (!token) throw new Error("अमान्य या पुराना टोकन"); // ✅ Error सही केस में
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://shopnish-00ug.onrender.com"; // ✅ API_BASE सही केस में
      const response = await fetch(`${API_BASE}/api/delivery/orders/${orderId}/complete-delivery`, { // ✅ orderId सही केस में
        method: "POST", // ✅ POST सही केस में
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, // ✅ Content-Type, Authorization सही केस में
        body: JSON.stringify({ otp }), // ✅ JSON.stringify सही केस में
      });
      if (response.status === 401) throw new Error("OTP गलत है।"); // ✅ Error सही केस में
      if (!response.ok) throw new Error("डिलीवरी पूरी करने में विफल"); // ✅ Error सही केस में
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] }); // ✅ queryClient सही केस में
      toast({ title: "डिलीवरी पूरी हुई", description: "ऑर्डर सफलतापूर्वक डिलीवर हो गया है।", variant: "success" });
      setOtpDialogOpen(false); // ✅ setOtpDialogOpen सही केस में
      setOtp(""); // ✅ setOtp सही केस में
      setSelectedOrder(null); // ✅ setSelectedOrder सही केस में
    },
    onError: (error: any) => {
      toast({ title: "OTP त्रुटि", description: error.message || "OTP जमा करने में विफल।", variant: "destructive" });
    },
  });

  const sendOtpToCustomerMutation = useMutation({ // ✅ sendOtpToCustomerMutation सही केस में
    mutationFn: async (orderId: number) => { // ✅ orderId सही केस में
      const token = await getValidToken(); // ✅ getValidToken सही केस में
      if (!token) throw new Error("अमान्य या पुराना टोकन"); // ✅ Error सही केस में
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://shopnish-00ug.onrender.com"; // ✅ API_BASE सही केस में
      const response = await fetch(`${API_BASE}/api/delivery/send-otp-to-customer`, {
        method: "POST", // ✅ POST सही केस में
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, // ✅ Content-Type, Authorization सही केस में
        body: JSON.stringify({ orderId }), // ✅ JSON.stringify, orderId सही केस में
      });
      if (!response.ok) {
        const errorData = await response.json(); // ✅ errorData सही केस में
        throw new Error(errorData.message || "ग्राहक को OTP भेजने में विफल"); // ✅ Error सही केस में
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "OTP भेजा गया", description: "ग्राहक को WhatsApp पर OTP भेजा गया है।", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] }); // ✅ queryClient सही केस में
    },
    onError: (error: any) => {
      toast({ title: "OTP भेजने में विफल", description: error.message || "कृपया पुनः प्रयास करें।", variant: "destructive" });
    },
  });

  // ✅ नया mutation: मैन्युअल OTP भेजने के लिए
  const sendManualOtpMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const token = await getValidToken();
      if (!token) throw new Error("अमान्य या पुराना टोकन");
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://shopnish-00ug.onrender.com";
      const response = await fetch(`${API_BASE}/api/delivery/orders/${orderId}/send-otp-manual`, { // ✅ नया एंडपॉइंट
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "मैन्युअल OTP भेजने में विफल।");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "OTP भेजा गया", description: "ग्राहक को OTP सफलतापूर्वक भेज दिया गया है।", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] }); // ✅ Refresh orders
    },
    onError: (error: any) => {
      toast({ title: "OTP भेजने में त्रुटि", description: error.message || "OTP भेजने में विफल।", variant: "destructive" });
    },
  });

  // ✅ नया mutation: बिना OTP के डिलीवरी पूरी करने के लिए
  const completeWithoutOtpMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const token = await getValidToken();
      if (!token) throw new Error("अमान्य या पुराना टोकन");
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://shopnish-00ug.onrender.com";
      const response = await fetch(`${API_BASE}/api/delivery/orders/${orderId}/complete-without-otp`, { // ✅ नया एंडपॉइंट
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "बिना OTP के डिलीवरी पूरी करने में विफल।");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
      toast({ title: "डिलीवरी पूरी हुई", description: "ऑर्डर बिना OTP के सफलतापूर्वक डिलीवर हो गया है।", variant: "success" });
      setOtpDialogOpen(false);
      setOtp(""); // ✅ clear OTP field
      setSelectedOrder(null);
    },
    onError: (error: any) => {
      toast({ title: "त्रुटि", description: error.message || "बिना OTP के डिलीवरी पूरी करने में विफल।", variant: "destructive" });
    },
  });

  
const handleStatusProgress = (order: any) => { // ✅ handleStatusProgress सही केस में
    console.log("🔍 Checking order:", order.id, "current status:", order.status); // ✅ Checking सही केस में
    
    // Status को साफ़ करें और छोटे अक्षरों में बदलें
    const currentStatus = (order.status ?? "").toLowerCase().trim(); // ✅ toLowerCase सही केस में
    console.log("🔍 Trimmed and lowercased status:", currentStatus); // ✅ Trimmed, lowercased सही केस में

    // 1. यदि वर्तमान स्टेटस 'out_for_delivery' है, तो सीधे OTP डायलॉग खोलें।
    if (currentStatus === "out_for_delivery") {
      console.log("✅ Status is 'out_for_delivery'. Opening OTP dialog."); // ✅ Status सही केस में
      setSelectedOrder(order); // ✅ setSelectedOrder सही केस में
      setOtpDialogOpen(true); // ✅ setOtpDialogOpen सही केस में
      return;
    }

    // 2. अगला अपेक्षित स्टेटस ज्ञात करें (तुम्हारे getNextStatus फंक्शन का उपयोग करके)
    const next = getNextStatus(currentStatus); // ✅ getNextStatus सही केस में
    console.log("➡️ Next expected status:", next); // ✅ Next, expected सही केस में


    // 3. यदि कोई अगला स्टेटस परिभाषित नहीं है, तो कुछ न करें
    if (!next) {
        console.log("❌ No next status defined for current status. Stopping."); // ✅ No, next, status सही केस में
        return;
    }

    // 4. यदि अगला स्टेटस 'out_for_delivery' है (यानी currentStatus 'picked_up' है),
    // तो हमें OTP भेजना होगा, न कि केवल स्टेटस अपडेट करना।
    if (next === "out_for_delivery") {
      console.log(`✉️ Moving to 'out_for_delivery' from '${currentStatus}'. Sending OTP to customer.`);
      sendOtpToCustomerMutation.mutate(order.id); // ✅ sendOtpToCustomerMutation सही केस में
    }
    
    console.log(`🔄 Updating status for order ${order.id} to '${next}'.`);
    updateStatusMutation.mutate({ orderId: order.id, newStatus: next }); // ✅ updateStatusMutation, orderId, newStatus सही केस में
};

  const handleOtpConfirmation = () => { // ✅ handleOtpConfirmation सही केस में
    if (!selectedOrder || otp.trim().length !== 4) { // ✅ selectedOrder, OTP अब 4-अंकों का है
      toast({ title: "OTP दर्ज करें", description: "4-अंकों का OTP आवश्यक है।", variant: "destructive" });
      return;
    }
    handleOtpSubmitMutation.mutate({ orderId: selectedOrder.id, otp }); // ✅ handleOtpSubmitMutation, orderId सही केस में
  };

  // ✅ नया फंक्शन: मैन्युअल OTP भेजने के लिए
  const handleSendManualOtp = (orderId: number) => {
    sendManualOtpMutation.mutate(orderId);
  };

  // ✅ नया फंक्शन: बिना OTP के डिलीवरी पूरी करने के लिए
  const completeWithoutOtpMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const token = await getValidToken();
      if (!token) throw new Error("अमान्य या पुराना टोकन");
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://shopnish-00ug.onrender.com";
      const response = await fetch(`${API_BASE}/api/delivery/orders/${orderId}/complete-without-otp`, { // ✅ नया एंडपॉइंट
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "बिना OTP के डिलीवरी पूरी करने में विफल।");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] });
      toast({ title: "डिलीवरी पूरी हुई", description: "ऑर्डर बिना OTP के सफलतापूर्वक डिलीवर हो गया है।", variant: "success" });
      setOtpDialogOpen(false);
      setOtp(""); // ✅ clear OTP field
      setSelectedOrder(null);
    },
    onError: (error: any) => {
      toast({ title: "त्रुटि", description: error.message || "बिना OTP के डिलीवरी पूरी करने में विफल।", variant: "destructive" });
    },
  });

  
const handleStatusProgress = (order: any) => { // ✅ handleStatusProgress सही केस में
    console.log("🔍 Checking order:", order.id, "current status:", order.status); // ✅ Checking सही केस में
    
    // Status को साफ़ करें और छोटे अक्षरों में बदलें
    const currentStatus = (order.status ?? "").toLowerCase().trim(); // ✅ toLowerCase सही केस में
    console.log("🔍 Trimmed and lowercased status:", currentStatus); // ✅ Trimmed, lowercased सही केस में

    // 1. यदि वर्तमान स्टेटस 'out_for_delivery' है, तो सीधे OTP डायलॉग खोलें।
    if (currentStatus === "out_for_delivery") {
      console.log("✅ Status is 'out_for_delivery'. Opening OTP dialog."); // ✅ Status सही केस में
      setSelectedOrder(order); // ✅ setSelectedOrder सही केस में
      setOtpDialogOpen(true); // ✅ setOtpDialogOpen सही केस में
      return;
    }

    // 2. अगला अपेक्षित स्टेटस ज्ञात करें (तुम्हारे getNextStatus फंक्शन का उपयोग करके)
    const next = getNextStatus(currentStatus); // ✅ getNextStatus सही केस में
    console.log("➡️ Next expected status:", next); // ✅ Next, expected सही केस में


    // 3. यदि कोई अगला स्टेटस परिभाषित नहीं है, तो कुछ न करें
    if (!next) {
        console.log("❌ No next status defined for current status. Stopping."); // ✅ No, next, status सही केस में
        return;
    }

    // 4. यदि अगला स्टेटस 'out_for_delivery' है (यानी currentStatus 'picked_up' है),
    // तो हमें OTP भेजना होगा, न कि केवल स्टेटस अपडेट करना।
    if (next === "out_for_delivery") {
      console.log(`✉️ Moving to 'out_for_delivery' from '${currentStatus}'. Sending OTP to customer.`);
      sendOtpToCustomerMutation.mutate(order.id); // ✅ sendOtpToCustomerMutation सही केस में
    }
    
    console.log(`🔄 Updating status for order ${order.id} to '${next}'.`);
    updateStatusMutation.mutate({ orderId: order.id, newStatus: next }); // ✅ updateStatusMutation, orderId, newStatus सही केस में
};

  const handleOtpConfirmation = () => { // ✅ handleOtpConfirmation सही केस में
    if (!selectedOrder || otp.trim().length !== 4) { // ✅ selectedOrder, OTP अब 4-अंकों का है
      toast({ title: "OTP दर्ज करें", description: "4-अंकों का OTP आवश्यक है।", variant: "destructive" });
      return;
    }
    handleOtpSubmitMutation.mutate({ orderId: selectedOrder.id, otp }); // ✅ handleOtpSubmitMutation, orderId सही केस में
  };

  // ✅ नया फंक्शन: मैन्युअल OTP भेजने के लिए
  const handleSendManualOtp = (orderId: number) => {
    sendManualOtpMutation.mutate(orderId);
  };

  // ✅ नया फंक्शन: बिना OTP के डिलीवरी पूरी करने के लिए
  const handleCompleteWithoutOtp = (orderId: number) => {
    if (window.confirm("क्या आप वाकई इस ऑर्डर को बिना OTP के डिलीवर करना चाहते हैं? यह केवल विशेष परिस्थितियों के लिए है और ऑडिट के लिए लॉग किया जाएगा।")) {
      completeWithoutOtpMutation.mutate(orderId);
    }
  };


  const handleLogout = () => auth?.signOut().then(() => window.location.reload()); // ✅ handleLogout, signOut सही केस में

  const { assignedOrders, availableOrders, historyOrders, totalOrdersCount, pendingCount, deliveredCount, outForDeliveryCount } = // ✅ सभी सही केस में
    useMemo(() => {
      const allOrders = orders || [];
      // ✅ Fix: myId को तभी सेट करें जब myDeliveryBoyId वास्तव में उपलब्ध हो
      const myId = myDeliveryBoyId !== undefined && myDeliveryBoyId !== null ? Number(myDeliveryBoyId) : null; // ✅ Number सही केस में

      console.log("--- useMemo Debug Start ---"); // ✅ useMemo सही केस में
      console.log("myDeliveryBoyId (as number for comparison):", myId);
      console.log("Total orders from API:", allOrders.length, allOrders); 

      const available = allOrders.filter((o: any) => {
        const status = (o.status ?? "").toLowerCase(); // ✅ toLowerCase सही केस में
        const deliveryStatus = (o.deliveryStatus ?? "").toLowerCase(); // ✅ toLowerCase सही केस में
        
        const isAvailable = ( // ✅ isAvailable सही केस में
            o.deliveryBoyId === null && // ✅ deliveryBoyId सही केस में
            deliveryStatus === "pending" && 
            (status === "pending" || status === "ready_for_pickup") && 
            status !== "rejected" && 
            status !== "cancelled"
        );
        return isAvailable;
      });

      const assigned = allOrders.filter((o: any) => {
        const status = (o.status ?? "").toLowerCase(); // ✅ toLowerCase सही केस में
        const deliveryStatus = (o.deliveryStatus ?? "").toLowerCase(); // ✅ toLowerCase सही केस में
        
        const orderDeliveryBoyId = o.deliveryBoyId !== null && o.deliveryBoyId !== undefined ? Number(o.deliveryBoyId) : null; // ✅ deliveryBoyId, Number सही केस में
        
        // ✅ Fix: सुनिश्चित करें कि myId null नहीं है, और फिर तुलना करें
        const isAssigned = ( // ✅ isAssigned सही केस में
          myId !== null && // ✅ यहाँ जाँच करें
          orderDeliveryBoyId === myId && 
          deliveryStatus === "accepted" && 
          status !== "delivered" && 
          status !== "rejected" &&
          status !== "cancelled"
        );

        // ✅ इन विस्तृत डिबग लॉग्स को अनकमेंट करें यदि 'assignedOrders' अभी भी 0 हैं
        // if (orderDeliveryBoyId !== null && myId !== null && orderDeliveryBoyId === myId) {
        //     console.log(`--- Order ID: ${o.id} Debug (assigned) ---`);
        //     console.log(`  - myDeliveryBoyId (as number for comparison): ${myId}`);
        //     console.log(`  - order.deliveryBoyId (from API): ${o.deliveryBoyId} (as number: ${orderDeliveryBoyId})`);
        //     console.log(`  - ID match (orderDeliveryBoyId === myId): ${orderDeliveryBoyId === myId}`);
        //     console.log(`  - order.deliveryStatus (from API): '${o.deliveryStatus}' (as lowercase: '${deliveryStatus}')`);
        //     console.log(`  - deliveryStatus is 'accepted': ${deliveryStatus === "accepted"}`);
        //     console.log(`  - order.status (from API): '${o.status}' (as lowercase: '${status}')`);
        //     console.log(`  - main status not delivered/rejected/cancelled: ${status !== "delivered" && status !== "rejected" && status !== "cancelled"}`);
        //     console.log(`  - Final isAssigned: ${isAssigned}`);
        //     console.log(`-------------------------------------`);
        // }
        
        return isAssigned;
      });

      const history = allOrders.filter((o: any) => {
        const status = (o.status ?? "").toLowerCase(); // ✅ toLowerCase सही केस में
        const isCompleted = status === "delivered" || status === "rejected" || status === "cancelled"; // ✅ isCompleted सही केस में
        if (isCompleted && dateFilter && o.createdAt) { // ✅ dateFilter, createdAt सही केस में
            const orderDate = new Date(o.createdAt); orderDate.setHours(0,0,0,0); // ✅ Date, setHours सही केस में
            const filterDateMidnight = new Date(dateFilter); filterDateMidnight.setHours(0,0,0,0); // ✅ Date, setHours सही केस में
            return orderDate >= filterDateMidnight; 
        }
        return isCompleted; 
      });

      const total = allOrders.length;
      const pending = available.length;
      const delivered = history.filter((o: any) => (o.status ?? "").toLowerCase() === "delivered").length; // ✅ toLowerCase सही केस में
      const outForDelivery = assigned.filter((o: any) => (o.status ?? "").toLowerCase() === "out_for_delivery").length; // ✅ toLowerCase सही केस में

      console.log("Assigned orders final count:", assigned.length, assigned); // ✅ Assigned सही केस में
      console.log("--- useMemo Debug End ---"); // ✅ useMemo सही केस में

      return {
        assignedOrders: assigned, // ✅ सही केस में
        availableOrders: available, // ✅ सही केस में
        historyOrders: history, // ✅ सही केस में
        totalOrdersCount: total, // ✅ सही केस में
        pendingCount: pending, // ✅ सही केस में
        deliveredCount: delivered, // ✅ सही केस में
        outForDeliveryCount: outForDelivery, // ✅ सही केस में
      };
    }, [orders, dateFilter, myDeliveryBoyId]); // ✅ myDeliveryBoyId को निर्भरता के रूप में जोड़ा

  if (isLoadingAuth || !isAuthenticated || !user || !socket || isLoading) { // ✅ सभी सही केस में
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50"> {/* ✅ className सही केस में */}
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" /> {/* ✅ Loader2 सही केस में */}
        <p className="text-gray-500 mt-2">connecting to server...</p> {/* ✅ className सही केस में */}
      </div>
    ); 
  }
    
  return (
    <div className="min-h-screen bg-gray-50 font-inter text-gray-800"> {/* ✅ className सही केस में */}
      <header className="bg-white shadow-sm border-b rounded-b-lg"> {/* ✅ className सही केस में */}
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between"> {/* ✅ className सही केस में */}
          <div className="flex items-center space-x-3"> {/* ✅ className सही केस में */}
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center"> {/* ✅ className सही केस में */}
              <UserIcon className="w-5 h-5 text-white" /> {/* ✅ UserIcon सही केस में */}
            </div>
            <div>
              <h1 className="text-xl font-bold">डिलीवरी डैशबोर्ड</h1> {/* ✅ className सही केस में */}
              <p className="text-sm text-gray-600">फिर से स्वागत है, {user?.name ?? 'डिलीवरी बॉय'}!</p> {/* ✅ className सही केस में */}
            </div>
          </div>
        <div className="flex space-x-2"> {/* ✅ className सही केस में */}
            <Button variant="outline" onClick={handleLogout}> {/* ✅ Button, onClick, handleLogout सही केस में */}
              <LogOut className="w-4 h-4 mr-1" /> {/* ✅ LogOut सही केस में */}
              लॉगआउट
            </Button>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-4 gap-6"> {/* ✅ className सही केस में */}
        <Card> {/* ✅ Card सही केस में */}
          <CardContent className="p-6 flex items-center space-x-3"> {/* ✅ CardContent सही केस में */}
            <Package className="w-8 h-8 text-blue-600" /> {/* ✅ Package सही केस में */}
            <div>
              <p className="text-2xl font-bold">{totalOrdersCount}</p> {/* ✅ totalOrdersCount सही केस में */}
              <p className="text-sm text-gray-600">कुल ऑर्डर</p> {/* ✅ className सही केस में */}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center space-x-3">
            <Clock className="w-8 h-8 text-amber-600" /> {/* ✅ Clock सही केस में */}
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p> {/* ✅ pendingCount सही केस में */}
              <p className="text-sm text-gray-600">लंबित (उपलब्ध)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center space-x-3">
            <CheckCircle className="w-8 h-8 text-green-600" /> {/* ✅ CheckCircle सही केस में */}
            <div>
              <p className="text-2xl font-bold">{deliveredCount}</p> {/* ✅ deliveredCount सही केस में */}
              <p className="text-sm text-gray-600">डिलीवर हुए</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center space-x-3">
            <Navigation className="w-8 h-8 text-purple-600" /> {/* ✅ Navigation सही केस में */}
            <div>
              <p className="text-2xl font-bold">{outForDeliveryCount}</p> {/* ✅ outForDeliveryCount सही केस में */}
              <p className="text-sm text-gray-600">रास्ते में</p>
            </div>
          </CardContent>
        </Card>
      </section>
        {/* Tab Navigation & Date Filter */}
      <section className="max-w-6xl mx-auto px-4 pb-4"> {/* ✅ className सही केस में */}
        <div className="flex justify-between items-end mb-4 flex-wrap gap-4"> {/* ✅ className सही केस में */}
          <div className="flex space-x-2 border-b border-gray-200"> {/* ✅ className सही केस में */}
            <Button // ✅ Button सही केस में
              variant={activeTab === 0 ? "default" : "outline"} // ✅ activeTab सही केस में
              onClick={() => setActiveTab(0)} // ✅ onClick, setActiveTab सही केस में
              className={activeTab === 0 ? "bg-blue-600 text-white hover:bg-blue-700" : "hover:bg-gray-100"} // ✅ className, activeTab सही केस में
            >
              <Zap className="w-4 h-4 mr-2" /> {/* ✅ Zap सही केस में */}
              आपके असाइन किए गए ({assignedOrders.length}) {/* ✅ assignedOrders सही केस में */}
            </Button>
            <Button // ✅ Button सही केस में
              variant={activeTab === 1 ? "default" : "outline"} // ✅ activeTab सही केस में
              onClick={() => setActiveTab(1)} // ✅ onClick, setActiveTab सही केस में
              className={activeTab === 1 ? "bg-amber-600 text-white hover:bg-amber-700" : "hover:bg-gray-100"} // ✅ className, activeTab सही केस में
            >
              <Clock className="w-4 h-4 mr-2" /> {/* ✅ Clock सही केस में */}
              उपलब्ध ऑर्डर ({availableOrders.length}) {/* ✅ availableOrders सही केस में */}
            </Button>
            <Button // ✅ Button सही केस में
              variant={activeTab === 2 ? "default" : "outline"} // ✅ activeTab सही केस में
              onClick={() => setActiveTab(2)} // ✅ onClick, setActiveTab सही केस में
              className={activeTab === 2 ? "bg-green-600 text-white hover:bg-green-700" : "hover:bg-gray-100"} // ✅ className, activeTab सही केस में
            >
              <CheckCircle className="w-4 h-4 mr-2" /> {/* ✅ CheckCircle सही केस में */}
              डिलीवर किए गए / हिस्ट्री ({historyOrders.length}) {/* ✅ historyOrders सही केस में */}
            </Button>
          </div>

          {/* Date filter for history */}
          {activeTab === 2 && ( // ✅ activeTab सही केस में
            <div className="flex items-center space-x-2"> {/* ✅ className सही केस में */}
              <Label htmlFor="date-filter" className="text-sm text-gray-600 whitespace-nowrap">से ऑर्डर दिखाएँ:</Label> {/* ✅ Label, htmlFor, className सही केस में */}
              <div className="relative"> {/* ✅ className सही केस में */}
                <Input // ✅ Input सही केस में
                  id="date-filter"
                  type="date"
                  value={dateFilter ? format(dateFilter, "yyyy-MM-dd") : ""} // ✅ dateFilter, format सही केस में
                  onChange={(e) => setDateFilter(e.target.value ? new Date(e.target.value) : null)} // ✅ onChange, setDateFilter, Date सही केस में
                  className="pl-8 w-40" // ✅ className सही केस में
                />
                <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" /> {/* ✅ Calendar सही केस में */}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Orders List */}
      <section className="max-w-6xl mx-auto px-4 pb-16 space-y-10"> {/* ✅ className सही केस में */}
        <h2 className="text-2xl font-bold mb-4"> {/* ✅ className सही केस में */}
          {activeTab === 0 && "आपके असाइन किए गए ऑर्डर"} {/* ✅ activeTab सही केस में */}
          {activeTab === 1 && "उपलब्ध पिकअप के लिए ऑर्डर"} {/* ✅ activeTab सही केस में */}
          {activeTab === 2 && `पूरे हुए/कैंसल ऑर्डर (शुरुआत: ${dateFilter ? format(dateFilter, "dd MMM yyyy") : 'सभी'})`} {/* ✅ activeTab, dateFilter सही केस में */}
        </h2>

        {activeTab === 0 && ( // ✅ activeTab सही केस में
          <OrdersListView // ✅ OrdersListView सही केस में
            orders={assignedOrders} // ✅ assignedOrders सही केस में
            title="कोई असाइन किए गए ऑर्डर नहीं"
            subtitle="नए ऑर्डर स्वीकार करें या पुराने ऑर्डर डिलीवर करें।"
            myDeliveryBoyId={myDeliveryBoyId} // ✅ myDeliveryBoyId सही केस में
            onAcceptOrder={(() => {}) as any} // ✅ onAcceptOrder सही केस में
            onUpdateStatus={(order: any) => handleStatusProgress(order)} // ✅ onUpdateStatus, handleStatusProgress सही केस में
            acceptLoading={false} // ✅ acceptLoading सही केस में
            updateLoading={updateStatusMutation.isPending} // ✅ updateLoading, updateStatusMutation सही केस में
            Button={Button} Card={Card} CardContent={CardContent} CardHeader={CardHeader} CardTitle={CardTitle} Badge={Badge} // ✅ सभी कॉम्पोनेंट्स सही केस में
            statusColor={getStatusColor} statusText={getStatusText} nextStatus={getNextStatus} nextStatusLabel={getNextStatusLabel} // ✅ सभी फंक्शन सही केस में
          />
        )}

        {activeTab === 1 && ( // ✅ activeTab सही केस में
          <OrdersListView // ✅ OrdersListView सही केस में
            orders={availableOrders} // ✅ availableOrders सही केस में
            title="कोई उपलब्ध ऑर्डर नहीं"
            subtitle="नए ऑर्डर के लिए बाद में जाँच करें।"
            myDeliveryBoyId={myDeliveryBoyId} // ✅ myDeliveryBoyId सही केस में
            onAcceptOrder={(id: number) => acceptOrderMutation.mutate(id)} // ✅ onAcceptOrder, acceptOrderMutation सही केस में
            onUpdateStatus={(() => {}) as any} // ✅ onUpdateStatus सही केस में
            acceptLoading={acceptOrderMutation.isPending} // ✅ acceptLoading, acceptOrderMutation सही केस में
            updateLoading={false} 
            Button={Button} Card={Card} CardContent={CardContent} CardHeader={CardHeader} CardTitle={CardTitle} Badge={Badge}
            statusColor={getStatusColor} statusText={getStatusText} nextStatus={getNextStatus} nextStatusLabel={getNextStatusLabel}
          />
        )}

        {activeTab === 2 && ( // ✅ activeTab सही केस में
          <OrdersListView // ✅ OrdersListView सही केस में
            orders={historyOrders} // ✅ historyOrders सही केस में
            title="कोई इतिहास ऑर्डर नहीं"
            subtitle={`चुनी हुई तारीख़ (${format(dateFilter ?? new Date(), "dd MMM yyyy")}) के बाद कोई पूरा हुआ ऑर्डर नहीं मिला।`} // ✅ dateFilter, Date सही केस में
            myDeliveryBoyId={myDeliveryBoyId} // ✅ myDeliveryBoyId सही केस में
            onAcceptOrder={(() => {}) as any} // ✅ onAcceptOrder सही केस में
            onUpdateStatus={(() => {}) as any} // ✅ onUpdateStatus सही केस में
            acceptLoading={false} 
            updateLoading={false}
            Button={Button} Card={Card} CardContent={CardContent} CardHeader={CardHeader} CardTitle={CardTitle} Badge={Badge}
            statusColor={getStatusColor} statusText={getStatusText} nextStatus={getNextStatus} nextStatusLabel={getNextStatusLabel}
          />
        )}
      </section>

    {/* OTP Dialog */}
    {otpDialogOpen && selectedOrder && ( // ✅ otpDialogOpen, selectedOrder सही केस में
      <DeliveryOtpDialog // ✅ DeliveryOtpDialog सही केस में
        isOpen={otpDialogOpen} // ✅ isOpen, otpDialogOpen सही केस में
        onOpenChange={setOtpDialogOpen} // ✅ onOpenChange, setOtpDialogOpen सही केस में
        order={selectedOrder} // ✅ order, selectedOrder सही केस में
        onConfirm={handleOtpConfirmation} // ✅ onConfirm, handleOtpConfirmation सही केस में
        isSubmitting={handleOtpSubmitMutation.isPending} // ✅ isSubmitting, handleOtpSubmitMutation सही केस में
        error={handleOtpSubmitMutation.error?.message || null}
        // ✅ यहाँ नए प्रॉप्स पास करें मैन्युअल OTP और बिना OTP के डिलीवरी के लिए
        onSendManualOtp={() => handleSendManualOtp(selectedOrder.id)}
        isSendingManualOtp={sendManualOtpMutation.isPending}
        onCompleteWithoutOtp={() => handleCompleteWithoutOtp(selectedOrder.id)}
        isCompletingWithoutOtp={completeWithoutOtpMutation.isPending}
      />
    )}
  </div>
);
} // ✅ DeliveryDashboard कॉम्पोनेंट का समापन

// --- Helper Component for Orders List ---
const OrdersListView: React.FC<any> = ({ orders, title, subtitle, ...props }) => ( // ✅ OrdersListView, React.FC सही केस में
  <>
    {orders.length === 0 ? (
      <props.Card> {/* ✅ props.Card सही केस में */}
        <props.CardContent className="py-12 text-center"> {/* ✅ props.CardContent, className सही केस में */}
          {/* ✅ Package आइकन को सही तरीके से इंपोर्ट करें और इस्तेमाल करें */}
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" /> {/* ✅ Package सही केस में */}
          <h3 className="text-lg font-medium mb-2">{title}</h3> {/* ✅ className सही केस में */}
          <p className="text-gray-600">{subtitle}</p> {/* ✅ className सही केस में */}
        </props.CardContent>
      </props.Card>
    ) : (
      <DeliveryOrdersList // ✅ DeliveryOrdersList सही केस में
        orders={orders}
        onAcceptOrder={props.onAcceptOrder} // ✅ onAcceptOrder सही केस में
        onUpdateStatus={props.onUpdateStatus} // ✅ onUpdateStatus सही केस में
        acceptLoading={props.acceptLoading} // ✅ acceptLoading सही केस में
        updateLoading={props.updateLoading} // ✅ updateLoading सही केस में
        Button={props.Button} Card={props.Card} CardContent={props.CardContent} CardHeader={props.CardHeader} // ✅ सभी कॉम्पोनेंट्स सही केस में
        CardTitle={props.CardTitle} Badge={props.Badge} statusColor={props.statusColor} // ✅ सभी कॉम्पोनेंट्स सही केस में
        statusText={props.statusText} nextStatus={props.nextStatus} nextStatusLabel={props.nextStatusLabel} // ✅ सभी फंक्शन सही केस में
      />
    )}
  </>
);
