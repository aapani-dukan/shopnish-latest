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


  const myDeliveryBoyId = user?.deliveryBoyId; 
  console.log("DEBUG: myDeliveryBoyId from user object (before useQuery):", myDeliveryBoyId); 


  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["deliveryOrders"],
    queryFn: async () => {
      try {
        const [availableRes, myRes] = await Promise.allSettled([
        api.get("/api/delivery/orders/available"),
          api.get("/api/delivery/orders/my"), 
        ]);
        
        // ✨ Axios Response को हैंडल करने के लिए बदलाव: .data.orders का उपयोग करें
        const availableOrders =
          availableRes.status === "fulfilled" && availableRes.value && Array.isArray((availableRes.value as any).data?.orders)
            ? (availableRes.value as any).data.orders
            : [];
            
        // ✨ Axios Response को हैंडल करने के लिए बदलाव: .data.orders का उपयोग करें
        const myOrders =
          myRes.status === "fulfilled" && myRes.value && Array.isArray((myRes.value as any).data?.orders)
            ? (myRes.value as any).data.orders
            : [];
            
        // यहाँ से आगे की लॉजिक सही है
        const map = new Map();
        [...availableOrders, ...myOrders].forEach((o) => {
          if (o && typeof o.id === "number") {
            map.set(o.id, {
              ...o,
              isMine: Number(o.deliveryBoyId) === Number(user?.deliveryBoyId),
            });
          }
        });
        
        console.log("✅ Fetched Orders Count:", map.size); // Debugging के लिए
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



// ✅ OTP Submit + Complete Delivery
const handleOtpSubmitMutation = useMutation({ // ✅ Corrected casing
  mutationFn: async ({ orderId, otp }: { orderId: number; otp: string }) => { // ✅ Corrected casing
    let data; // डेटा को यहाँ डिक्लेयर करें ताकि इसे `try` और `catch` ब्लॉक के बाहर एक्सेस किया जा सके

    try {
      // ✅ axios `api.post` का उपयोग करें। axios त्रुटियों को स्वचालित रूप से फेंकता है।
      const response = await api.post(`/api/delivery/orders/${orderId}/complete-delivery`, { otp }); // ✅ Corrected casing
      data = response.data; // ✨ axios में, डेटा `response.data` प्रॉपर्टी में होता है।

    } catch (error: any) {
      // ✨ axios त्रुटियों को यहाँ पकड़ा जाता है।
      console.error("handleOtpSubmitMutation error:", error); // ✅ Corrected casing

      if (error.response) {
        // सर्वर से एक प्रतिक्रिया मिली (जैसे 401, 404, 500)
        if (error.response.status === 401) {
          throw new Error("OTP गलत है।"); // ✅ Using standard Error
        }
        // सर्वर द्वारा प्रदान किया गया त्रुटि संदेश दिखाएँ, यदि उपलब्ध हो
        throw new Error(error.response.data.message || "डिलीवरी पूरी करने में विफल"); // ✅ Using standard Error
      } else if (error.request) {
        // अनुरोध भेजा गया था, लेकिन कोई प्रतिक्रिया नहीं मिली (नेटवर्क डाउन, CORS समस्या)
        throw new Error("नेटवर्क त्रुटि: सर्वर तक पहुँचने में विफल है।"); // ✅ Using standard Error
      } else {
        // अनुरोध सेट करते समय कुछ और गलत हो गया
        throw new Error(error.message || "अनपेक्षित त्रुटि हुई।"); // ✅ Using standard Error
      }
    }

    // ✅ delivery सफल होने के बाद whatsapp पर "thanks" मैसेज भेजो
    // 🔥 यहाँ भी `fetch` की जगह `api.post` का उपयोग करें ताकि इंटरसेप्टर ऑथेंटिकेशन हेडर जोड़ सके।
    await api.post(`/api/whatsapp/send-delivery-thanks`, {
      orderId, // ✅ Corrected casing
      customerPhone: data?.customerPhone, // ✨ `data` अब यहाँ एक्सेसिबल है // ✅ Corrected casing
      customerName: data?.customerName, // ✅ Corrected casing
    }).catch((err) => console.warn("⚠️ whatsapp thanks message भेजने में समस्या:", err));

    return data; // ✨ सफल होने पर यह डेटा वापस होगा
  },

  onSuccess: () => { // ✅ Corrected casing
    queryClient.invalidateQueries({ queryKey: ["deliveryorders"] }); // ✅ Corrected casing
    toast({
      title: "डिलीवरी पूरी हुई",
      description: "ऑर्डर सफलतापूर्वक डिलीवर हो गया है।",
      variant: "success",
    });
    setOtpDialogOpen(false); // ✅ Corrected casing
    setSelectedOrder(null); // ✅ Corrected casing
  },

  onError: (error: any) => { // ✅ Corrected casing
    // ✨ यहाँ error.message पहले से ही `mutationFn` के catch ब्लॉक में सेट हो चुका होगा
    toast({
      title: "OTP त्रुटि", // ✅ Corrected casing
      description: error.message || "OTP जमा करने में विफल।", // ✅ Corrected casing
      variant: "destructive",
    });
  },
});

// ✅ ग्राहक को WhatsApp पर OTP भेजने वाला mutation
// ✅ ग्राहक को WhatsApp पर OTP भेजने वाला mutation
const sendOtpToCustomerMutation = useMutation({
  mutationFn: async (orderId: number) => {
    
    // Axios इंटरसेप्टर ऑथेंटिकेशन और baseURL को स्वचालित रूप से संभाल लेगा।

    let data; // ✨ डेटा को यहाँ डिक्लेयर करें

    try {
      
      const response = await api.post(`/api/whatsapp/send-otp`, { orderId }); 
      data = response.data; // ✨ Axios में, डेटा `response.data` प्रॉपर्टी में होता है।

      // 🔥 `!response.ok` जैसी जाँचों की अब आवश्यकता नहीं है,
      //    Axios स्वचालित रूप से 4xx/5xx स्टेटस कोड पर त्रुटि फेंकता है।
      // 🔥 `response.json()` की भी आवश्यकता नहीं है।

    } catch (error: any) {
      // ✨ Axios त्रुटियों को यहाँ पकड़ा जाता है।
      console.error("sendOtpToCustomerMutation error:", error);

      if (error.response) {
        // सर्वर से एक प्रतिक्रिया मिली (जो 2xx रेंज से बाहर थी)
        // यदि सर्वर से कोई विशिष्ट त्रुटि संदेश आता है, तो उसे दिखाएँ।
        throw new Error(error.response.data.message || "ग्राहक को OTP भेजने में विफल");
      } else if (error.request) {
        // अनुरोध भेजा गया था, लेकिन कोई प्रतिक्रिया नहीं मिली (नेटवर्क त्रुटि)
        throw new Error("नेटवर्क त्रुटि: सर्वर तक पहुँचने में विफल है।");
      } else {
        // अनुरोध सेट करते समय कुछ और गलत हो गया
        throw new Error(error.message || "अनपेक्षित त्रुटि हुई।");
      }
    }

    return data; // ✨ सफल डेटा वापस करें
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
    // ✨ यहाँ error.message `mutationFn` के catch ब्लॉक में सेट हो चुका होगा
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
    // 🔥 `getValidToken()` और `API_BASE` की अब आवश्यकता नहीं है।
    // Axios इंटरसेप्टर ऑथेंटिकेशन और baseURL को स्वचालित रूप से संभाल लेगा।

    let data; // ✨ डेटा को यहाँ डिक्लेयर करें ताकि इसे `try` और `catch` ब्लॉक के बाहर एक्सेस किया जा सके

    try {
      // ✅ `fetch` की जगह `api.post` का उपयोग करें
      const response = await api.post(`/api/delivery/orders/${orderId}/complete-without-otp`);
      data = response.data; // ✨ Axios में, डेटा `response.data` प्रॉपर्टी में होता है।

      // 🔥 `!response.ok` जैसी जाँचों की अब आवश्यकता नहीं है,
      //    Axios स्वचालित रूप से 4xx/5xx स्टेटस कोड पर त्रुटि फेंकता है।
      // 🔥 `response.json()` की भी आवश्यकता नहीं है।

    } catch (error: any) {
      // ✨ Axios त्रुटियों को यहाँ पकड़ा जाता है।
      console.error("completeWithoutOtpMutation error:", error);

      if (error.response) {
        // सर्वर से एक प्रतिक्रिया मिली (जो 2xx रेंज से बाहर थी)
        throw new Error(error.response.data.message || "बिना OTP के डिलीवरी पूरी करने में विफल।");
      } else if (error.request) {
        // अनुरोध भेजा गया था, लेकिन कोई प्रतिक्रिया नहीं मिली (नेटवर्क त्रुटि)
        throw new Error("नेटवर्क त्रुटि: सर्वर तक पहुँचने में विफल है।");
      } else {
        // अनुरोध सेट करते समय कुछ और गलत हो गया
        throw new Error(error.message || "अनपेक्षित त्रुटि हुई।");
      }
    }

    // ✅ WhatsApp Thanks Message भेजो
    // 🔥 यहाँ भी `fetch` की जगह `api.post` का उपयोग करें
    await api.post(`/api/whatsapp/send-delivery-thanks`, {
      orderId,
      customerPhone: data?.customerPhone, // ✨ `data` अब यहाँ एक्सेसिबल है
      customerName: data?.customerName,
    }).catch((err) => console.warn("⚠️ WhatsApp Thanks Message भेजने में समस्या:", err));

    return data; // ✨ सफल डेटा वापस करें
  },

  onSuccess: () => {
    toast({
      title: "डिलीवरी पूरी हुई",
      description: "ऑर्डर बिना OTP के सफलतापूर्वक डिलीवर हो गया है।",
      variant: "success",
    });
    setOtpDialogOpen(false);
    setSelectedOrder(null);
    queryClient.invalidateQueries({ queryKey: ["deliveryOrders"] }); // ✨ क्वेरी को इनवैलिडेट करें
  },

  onError: (error: any) => {
    // ✨ यहाँ error.message `mutationFn` के catch ब्लॉक में सेट हो चुका होगा
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
    
{otpDialogOpen && selectedOrder && (
  <DeliveryOtpDialog
    isOpen={otpDialogOpen}
    onOpenChange={setOtpDialogOpen}
    order={selectedOrder}

    onConfirm={async (otp: string) => {
      if (selectedOrder?.id) {
        handleOtpSubmitMutation.mutate({ orderId: selectedOrder.id, otp });
      }
    }}
    isSubmitting={handleOtpSubmitMutation.isPending}
    error={handleOtpSubmitMutation.error ? handleOtpSubmitMutation.error.message : null}

    onSendManualOtp={async () => {
      if (selectedOrder?.id) {
        sendOtpToCustomerMutation.mutate(selectedOrder.id);
      }
    }}
    isSendingManualOtp={sendOtpToCustomerMutation.isPending}

    onCompleteWithoutOtp={async () => {
      if (selectedOrder?.id) {
        if (window.confirm("क्या आप वाकई इस ऑर्डर को बिना OTP के डिलीवर करना चाहते हैं? यह केवल विशेष परिस्थितियों के लिए है और ऑडिट के लिए लॉग किया जाएगा।")) {
          completeWithoutOtpMutation.mutate(selectedOrder.id);
        }
      }
    }}
    isCompletingWithoutOtp={completeWithoutOtpMutation.isPending}
  />
)}
      
</div>
    );
}
      
// --- Helper Component for Orders List ---

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
