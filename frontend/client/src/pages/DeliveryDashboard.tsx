// client/src/pages/deliveryBoy/DeliveryDashboard.tsx (Part 1/2 - Error Corrected: useMemo moved to Part 2)

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
import DeliveryOrdersList from "./DeliveryOrdersList"; // सुनिश्चित करें कि यह बैच कंपोनेंट है
import { useAuth } from "../hooks/useAuth"; 
import { useSocket } from "../hooks/useSocket"; 
// import { apiRequest } from "../lib/queryClient"; // यदि आप इसे उपयोग नहीं कर रहे हैं
import api from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"; 
import { Badge } from "../components/ui/badge"; 
import { Button } from "../components/ui/button"; 
import { useToast } from "../hooks/use-toast"; 
import { Label } from "../components/ui/label"; 
import { Input } from "../components/ui/input"; 
import { DatePicker } from "../components/ui/date-picker"; // मान लें कि आपके पास DatePicker कंपोनेंट है


// --- Utility Functions (Batch Statuses) ---
const getStatusColor = (status: string) => {
  switch (status.toLowerCase().trim()) {
    case "pending":          return "bg-amber-600 hover:bg-amber-700";
    case "assigned":         return "bg-blue-600 hover:bg-blue-700";
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
  switch (status.toLowerCase().trim()) {
    case "pending":          return "लंबित (उपलब्ध)";
    case "assigned":         return "असाइन किया गया"; 
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
  switch (current.toLowerCase().trim()) {
    case "ready_for_pickup":  return "picked_up";
    case "picked_up":         return "out_for_delivery";
    case "out_for_delivery":  return null; 
    default:                  return null;
  }
};

const getNextStatusLabel = (status: string) => {
  switch (status.toLowerCase().trim()) {
    case "ready_for_pickup":  return "पिकअप करें";
    case "picked_up":         return "डिलीवरी के लिए निकले (OTP)"; 
    case "out_for_delivery":  return "डिलीवरी पूरी करें (OTP)";
    default:                  return "";
  }
};

// --- OrdersListViewProps Interface (Required for Part 2) ---
interface OrdersListViewProps {
  orders: any[]; 
  title: string;
  subtitle?: string;
  myDeliveryBoyId: number | null | undefined;
  onAcceptOrder: (batchId: number) => void; 
  onUpdateStatus: (batch: any) => void; 
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
  nextStatus: (status: string) => string | null; 
  nextStatusLabel: (status: string) => string;
}
// 🛑 NEW: Raw Batch Interface (Backend Response)
interface RawBatch {
    id: number;
    masterOrderId: number; 
    deliveryBoyId?: number | null;
    status: string;
    // Drizzle Nested Fields
    customerDeliveryAddress: any;
    subOrders: Array<any>;
    // अन्य top-level fields
}
// 🛑 NEW: Data Normalizer Function (Solves the "0 items" issue)
const normalizeBatchData = (rawBatch: RawBatch, myDeliveryBoyId: number | null): DeliveryBatch => {
    
    if (!rawBatch.subOrders || rawBatch.subOrders.length === 0) {
        return { 
            id: rawBatch.id,
            masterOrderId: rawBatch.masterOrderId.toString(),
            totalAmount: 0, 
            items: [], 
            deliveryAddress: rawBatch.customerDeliveryAddress,
            sellerDetails: null,
            status: rawBatch.status,
            deliveryBoyId: rawBatch.deliveryBoyId,
        } as DeliveryBatch;
    }

    let grandTotal = 0;
    const allItems: OrderItem[] = [];
    const allSellers: Seller[] = [];

    rawBatch.subOrders.forEach(sub => {
        // A. आइटम और मात्रा जोड़ें
        if (sub.orderItems) {
            sub.orderItems.forEach((item: any) => {
                allItems.push({
                    id: item.id,
                    quantity: Number(item.quantity || 0),
                    product: item.product,
                    // यदि आपके पास price, itemTotal जैसे फ़ील्ड हैं, तो उन्हें यहाँ जोड़ें
                } as OrderItem);
            });
        }
        
        // B. कुल योग जोड़ें (JSON से स्ट्रिंग के रूप में आता है)
        grandTotal += Number(sub.total || 0);
        
        // C. विक्रेता विवरण इकट्ठा करें (केवल एक विक्रेता पर्याप्त है या सभी को रखें)
        if (sub.seller && sub.seller.id) {
            allSellers.push(sub.seller);
        }
    });

    // Master Order Number (if available from subOrders.masterOrder)
    const masterOrderNum = rawBatch.subOrders[0]?.masterOrder?.orderNumber ?? rawBatch.masterOrderId;
   // Try to build the address if rawBatch.customerDeliveryAddress is empty {}
    let finalAddress = rawBatch.customerDeliveryAddress;
    
    // यदि एड्रेस खाली है, तो हम masterOrder से विवरण खींचते हैं
    if (rawBatch.subOrders.length > 0 && (!finalAddress || Object.keys(finalAddress).length === 0)) {
        const masterOrderDetails = rawBatch.subOrders[0].masterOrder;
        
        finalAddress = {
            fullName: masterOrderDetails?.customer?.firstName + ' ' + masterOrderDetails?.customer?.lastName,
            phone: masterOrderDetails?.customer?.phone || '',
            city: masterOrderDetails?.deliveryCity,
            pincode: masterOrderDetails?.deliveryPincode,
            // ध्यान दें: addressLine1/address यहाँ उपलब्ध नहीं है, लेकिन city/pincode तो है
            // यदि backend से पूरा पता लाना है, तो आपको /users/me से customerAddresses को भी देखना होगा
        };
    } 
    return {
        id: rawBatch.id,
        masterOrderId: String(masterOrderNum),
        totalAmount: grandTotal,
        items: allItems,
        deliveryAddress: finalAddress, 
        
        sellerDetails: allSellers.length > 0 ? allSellers : null, 
        status: rawBatch.status,
        deliveryBoyId: rawBatch.deliveryBoyId,
        // isMine: Number(rawBatch.deliveryBoyId) === myDeliveryBoyId, // filtering in useMemo now
    } as DeliveryBatch;
};
// --- Main Component ---
export default function DeliveryDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, auth, isLoadingAuth, isAuthenticated } = useAuth();
  const rawSocket = useSocket() as any;
  const socket = rawSocket?.socket ?? rawSocket;

  const [selectedOrder, setSelectedOrder] = useState<any>(null); // Batch ऑब्जेक्ट
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0); 
  const [dateFilter, setDateFilter] = useState<Date | null>(() => {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    return fiveDaysAgo;
  });

  const myDeliveryBoyId = useMemo(() => user?.deliveryBoyId, [user]); 
  console.log("DEBUG: myDeliveryBoyId from user object (before useQuery):", myDeliveryBoyId); 


  // --- Data Fetching Hook (Batch Logic) ---
   // --- Data Fetching Hook (Batch Logic) ---
    const { data: batchesRaw = [], isLoading: isLoadingBatches } = useQuery({
        queryKey: ["delivery-batches"],
        queryFn: async () => {
            try {
                // एक साथ उपलब्ध और असाइन किए गए बैचेस को लाएं
                const [availableRes, myRes] = await Promise.allSettled([
                    api.get("/api/delivery/available-batches"),
                    api.get("/api/delivery/batches"), // GET /api/delivery/batches 
                ]);

                // 🛑 ध्यान दें: response.data?.batches प्राप्त करने के लिए API को ठीक किया गया है
                const availableBatches =
                    availableRes.status === "fulfilled" && availableRes.value && Array.isArray((availableRes.value as any).data?.batches)
                        ? (availableRes.value as any).data.batches
                        : [];
                        
                const myAssignedBatches =
                    myRes.status === "fulfilled" && myRes.value && Array.isArray((myRes.value as any).data?.batches)
                        ? (myRes.value as any).data.batches
                        : [];

                // 🛑 महत्वपूर्ण: Normalization लागू करें
                const normalizedBatches: DeliveryBatch[] = [];
                const allRawBatches = [...availableBatches, ...myAssignedBatches];
                
                // Batches को मर्ज करें और Normalizer चलाएं
                const map = new Map();
                allRawBatches.forEach((b: RawBatch) => {
                    if (b && typeof b.id === "number") {
                        // 🛑 Normalizer यहाँ डेटा को ठीक करता है
                        const normalized = normalizeBatchData(b, myDeliveryBoyId); 
                        map.set(b.id, normalized);
                    }
                });
                
                console.log("✅ Fetched and Normalized Batches Count:", map.size);
                return Array.from(map.values());

            } catch (err) {
                console.error("बैच लाने में त्रुटि:", err);
                toast({ title: "डेटा लाने में त्रुटि", description: "डिलीवरी बैच लाते समय कोई समस्या आई", variant: "destructive", });
                return [];
            }
        },
        enabled: isAuthenticated && !!user && myDeliveryBoyId !== undefined && myDeliveryBoyId !== null,
    });
    
    const isLoading = isLoadingAuth || isLoadingBatches;


  // --- Socket.io for Realtime Updates ---
  useEffect(() => {
    if (!socket || !user) return;
    const onBatchesChanged = () => queryClient.invalidateQueries({ queryKey: ["delivery-batches"] }); 

    if (typeof socket.emit === 'function') socket.emit("register-client", { role: "delivery", userId: user.uid ?? user.id });
    if (typeof socket.on === 'function') {
      socket.on("delivery:orders-changed", onBatchesChanged); 
      socket.on("new-order", onBatchesChanged); 
      socket.on("order:update", onBatchesChanged); 
    }
    return () => {
      if (typeof socket.off === 'function') {
        socket.off("delivery:orders-changed", onBatchesChanged);
        socket.off("new-order", onBatchesChanged);
        socket.off("order:update", onBatchesChanged);
      }
    };
  }, [socket, user, queryClient, isAuthenticated]);

  // --- GPS tracking (Batch-based logic) ---
  useEffect(() => {
    if (!socket || !user || isLoading || myDeliveryBoyId === undefined || myDeliveryBoyId === null) return;

    let watchId: number | null = null;
    
    // 🛑 हम GPS ट्रैकिंग के लिए बैचेस को फ़िल्टर करने के लिए useMemo का उपयोग नहीं कर सकते क्योंकि 
    // वह भाग 2 में है। इसलिए हमें यहीं `batchesRaw` को फ़िल्टर करना होगा।
    const activeBatch = batchesRaw.find((b: any) =>
      Number(b.deliveryBoyId) === Number(myDeliveryBoyId) &&
      (b.status === "picked_up" || b.status === "out_for_delivery")
    );

    if (activeBatch && navigator.geolocation) {
      console.log(`📡 Starting GPS tracking for batch ${activeBatch.id}`); 

      const sendLocation = (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        if (typeof socket.emit === 'function') {
          socket.emit("deliveryBoy:location_update", {
            batchId: activeBatch.id, 
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
  }, [batchesRaw, socket, user, isLoading, toast, myDeliveryBoyId]);


  // --- Mutations (Batch ID-based) ---
  
  // Claim Batch Mutation
  const acceptOrderMutation = useMutation({ 
    mutationFn: (batchId: number) => api.patch(`/api/delivery/batches/${batchId}/claim`), 
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-batches"] }); 
      toast({ title: "सफलता", description: "बैच सफलतापूर्वक असाइन किया गया।", variant: "success" });
    },
    onError: (error: any) => {
      const errorMsg = error?.response?.data?.error || "दावा करने में विफल।";
      toast({ title: "त्रुटि", description: errorMsg, variant: "destructive" });
    },
  });

  // Update Batch Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ batchId, newStatus }: { batchId: number; newStatus: string }) => 
      api.patch(`/api/delivery/batches/${batchId}/status`, { newStatus }), 
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["delivery-batches"] }), 
    onError: () => toast({ title: "त्रुटि", description: "बैच स्थिति अपडेट करने में विफल", variant: "destructive" }),
  });


  // OTP Submit + Complete Delivery (Batch-based)
  const handleOtpSubmitMutation = useMutation({ 
    mutationFn: async ({ batchId, otp }: { batchId: number; otp: string }) => { 
      let data; 

      try {
        const response = await api.post(`/api/delivery/batches/${batchId}/complete-delivery`, { otp }); 
        data = response.data; 

      } catch (error: any) {
        console.error("handleOtpSubmitMutation error:", error); 

        if (error.response) {
          throw new Error(error.response.data.message || "डिलीवरी पूरी करने में विफल"); 
        } else {
          throw new Error(error.message || "अनपेक्षित त्रुटि हुई।"); 
        }
      }
      // WhatsApp Thanks Message (Backend details are in data)
      await api.post(`/api/whatsapp/send-delivery-thanks`, {
        orderId: data?.masterOrderId, 
        customerPhone: data?.customerPhone, 
        customerName: data?.customerName, 
      }).catch((err) => console.warn("⚠️ whatsapp thanks message भेजने में समस्या:", err));

      return data;
    },

    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["delivery-batches"] }); 
      toast({ title: "डिलीवरी पूरी हुई", description: "बैच सफलतापूर्वक डिलीवर हो गया है।", variant: "success" });
      setOtpDialogOpen(false); 
      setSelectedOrder(null); 
    },

    onError: (error: any) => { 
      toast({ title: "OTP त्रुटि", description: error.message || "OTP जमा करने में विफल।", variant: "destructive" });
    },
  });

  // Send OTP to Customer (Batch-based)
  const sendOtpToCustomerMutation = useMutation({
    mutationFn: async (batchId: number) => { 
      let data; 
      try {
        const response = await api.post(`/api/delivery/batches/${batchId}/send-otp`); 
        data = response.data; 
      } catch (error: any) {
        console.error("sendOtpToCustomerMutation error:", error);
        if (error.response) {
          throw new Error(error.response.data.message || "ग्राहक को OTP भेजने में विफल");
        } else {
          throw new Error(error.message || "अनपेक्षित त्रुटि हुई।");
        }
      }
      return data; 
    },

    onSuccess: () => {
      toast({ title: "OTP भेजा गया", description: "ग्राहक को WhatsApp पर OTP भेजा गया है।", variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["delivery-batches"] }); 
    },

    onError: (error: any) => {
      toast({ title: "OTP भेजने में विफल", description: error.message || "कृपया पुनः प्रयास करें।", variant: "destructive" });
    },
  });


  // Complete Without OTP (Batch-based)
  const completeWithoutOtpMutation = useMutation({
    mutationFn: async (batchId: number) => { 
      let data; 
      try {
        const response = await api.post(`/api/delivery/batches/${batchId}/complete-without-otp`);
        data = response.data; 
      } catch (error: any) {
        console.error("completeWithoutOtpMutation error:", error);
        if (error.response) {
          throw new Error(error.response.data.message || "बिना OTP के डिलीवरी पूरी करने में विफल।");
        } else {
          throw new Error(error.message || "अनपेक्षित त्रुटि हुई।");
        }
      }

      await api.post(`/api/whatsapp/send-delivery-thanks`, {
        orderId: data?.masterOrderId,
        customerPhone: data?.customerPhone, 
        customerName: data?.customerName,
      }).catch((err) => console.warn("⚠️ WhatsApp Thanks Message भेजने में समस्या:", err));

      return data;
    },

    onSuccess: () => {
      toast({ title: "डिलीवरी पूरी हुई", description: "बैच बिना OTP के सफलतापूर्वक डिलीवर हो गया है।", variant: "success" });
      setOtpDialogOpen(false);
      setSelectedOrder(null);
      queryClient.invalidateQueries({ queryKey: ["delivery-batches"] }); 
    },

    onError: (error: any) => {
      toast({ title: "त्रुटि", description: error.message || "बिना OTP के डिलीवरी पूरी करने में विफल।", variant: "destructive" });
    },
  });

// यहाँ से कोड भाग 2 में जारी रहेगा...

  // --- Status Progression Logic (Batch-based) ---
  const handleStatusProgress = (batch: any) => { 
    console.log("handleStatusProgress: Batch ID:", batch.id, "Current Status:", batch.status);
    
    const batchId = batch.id;
    const currentStatus = (batch.status ?? "").toLowerCase().trim();
    console.log("handleStatusProgress: Trimmed and lowercased status:", currentStatus);

    if (currentStatus === "out_for_delivery") {
      console.log("handleStatusProgress: Status is 'out_for_delivery'. Opening OTP dialog.");
      setSelectedOrder(batch); // Batch को Dialog के लिए सेट करें
      setOtpDialogOpen(true);
      return;
    }

    const next = getNextStatus(currentStatus);
    console.log("handleStatusProgress: Next expected status:", next);

    if (!next) {
        console.log("handleStatusProgress: No next status defined for current status. Stopping.");
        return;
    }

    if (currentStatus === "picked_up" && next === "out_for_delivery") { 
      console.log(`handleStatusProgress: Moving to 'out_for_delivery' from '${currentStatus}'. Triggering sendOtpToCustomerMutation.`);
      sendOtpToCustomerMutation.mutate(batchId); // batchId का उपयोग करें
    } else {
        console.log(`handleStatusProgress: Updating status for batch ${batchId} to '${next}'.`);
        updateStatusMutation.mutate({ batchId: batchId, newStatus: next }); // batchId का उपयोग करें
    }
  };


  const handleOtpConfirmation = (otpValue: string) => {
    console.log("handleOtpConfirmation: Confirming OTP for Batch ID:", selectedOrder?.id, "OTP entered:", otpValue);
    if (!selectedOrder || otpValue.trim().length !== 4) {
      toast({ title: "OTP दर्ज करें", description: "4-अंकों का OTP आवश्यक है।", variant: "destructive" });
      return;
    }
    // handleOtpSubmitMutation में batchId का उपयोग करें
    handleOtpSubmitMutation.mutate({ batchId: selectedOrder.id, otp: otpValue }); 
  };

  const handleSendManualOtp = () => {
    if (selectedOrder?.id) {
        console.log("handleSendManualOtp: Initiating manual OTP send for Batch ID:", selectedOrder.id);
        sendOtpToCustomerMutation.mutate(selectedOrder.id); 
    }
  };

  const handleCompleteWithoutOtp = () => {
    if (selectedOrder?.id) {
        console.log("handleCompleteWithoutOtp: Attempting to complete delivery without OTP for Batch ID:", selectedOrder.id);
        if (window.confirm("क्या आप वाकई इस बैच को बिना OTP के डिलीवर करना चाहते हैं? यह केवल विशेष परिस्थितियों के लिए है और ऑडिट के लिए लॉग किया जाएगा।")) {
            completeWithoutOtpMutation.mutate(selectedOrder.id); 
        }
    }
  };


  const handleLogout = () => auth?.signOut().then(() => window.location.reload());

  // 🛑 प्रमुख परिवर्तन: useMemo को बैच फ़िल्टरिंग के लिए अपडेट करें
  const { 
    assignedBatches,
    availableBatches,
    historyBatches, 
    totalOrdersCount, // कुल बैचेस की संख्या
    availableCount,   // क्लेम करने के लिए उपलब्ध बैचेस की संख्या
    deliveredCount,   // डिलीवर हुए बैचेस की संख्या
    outForDeliveryCount // रास्ते में बैचेस की संख्या
  } = useMemo(() => {
      
      const allBatches = batchesRaw || []; 
      const myId = myDeliveryBoyId !== undefined && myDeliveryBoyId !== null ? Number(myDeliveryBoyId) : null; 

      // 1. Assigned Batches (सक्रिय रूप से मुझे असाइन किए गए)
      const assigned = allBatches.filter((b: any) => {
        const status = (b.status ?? "").toLowerCase().trim();
        
        const batchDeliveryBoyId = b.deliveryBoyId !== null && b.deliveryBoyId !== undefined ? Number(b.deliveryBoyId) : null;
        
        const isAssigned = (
          myId !== null && 
          batchDeliveryBoyId === myId && 
          status !== "delivered" && 
          status !== "rejected" &&
          status !== "cancelled"
        );
        
        return isAssigned;
      });
      
      // 2. Available Batches (Claim के लिए उपलब्ध)
      const available = allBatches.filter((b: any) => {
        const status = (b.status ?? "").toLowerCase();
        
        // वह बैच जिसे किसी को असाइन नहीं किया गया है
        const isAvailable = (
            b.deliveryBoyId === null && 
            (status === "pending" || status === "assigned") 
        );
        return isAvailable;
      });


      // 3. History Batches (पूरे हुए/रद्द/अस्वीकृत)
      const history = allBatches.filter((b: any) => {
        const status = (b.status ?? "").toLowerCase();
        const isCompleted = status === "delivered" || status === "rejected" || status === "cancelled";
        
        if (isCompleted && dateFilter && b.updatedAt) { 
            const batchDate = new Date(b.updatedAt); batchDate.setHours(0,0,0,0);
            const filterDateMidnight = new Date(dateFilter); filterDateMidnight.setHours(0,0,0,0);
            return batchDate >= filterDateMidnight; 
        }
        return isCompleted; 
      });

      // 4. Counts
      const total = allBatches.length;
      const currentAvailableCount = available.length; // टकराव से बचने के लिए नया नाम
      const delivered = history.filter((b: any) => (b.status ?? "").toLowerCase() === "delivered").length;
      const outForDelivery = assigned.filter((b: any) => (b.status ?? "").toLowerCase() === "out_for_delivery").length;

      return {
        assignedBatches: assigned,
        availableBatches: available,
        historyBatches: history,
        totalOrdersCount: total,
        availableCount: currentAvailableCount,
        deliveredCount: delivered,
        outForDeliveryCount: outForDelivery,
      };
      
    }, [batchesRaw, dateFilter, myDeliveryBoyId]); 


  if (isLoadingAuth || !isAuthenticated || !user || !socket || isLoadingBatches) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-gray-500 mt-2">सर्वर से कनेक्ट हो रहा है...</p>
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

      {/* Summary Cards (Batch-based counts) */}
      <section className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center space-x-3">
            <Package className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{totalOrdersCount}</p>
              <p className="text-sm text-gray-600">कुल बैच</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center space-x-3">
            <Clock className="w-8 h-8 text-amber-600" />
            <div>
              <p className="text-2xl font-bold">{availableCount}</p>
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
              आपके असाइन किए गए ({assignedBatches.length})
            </Button>
            <Button 
              variant={activeTab === 1 ? "default" : "outline"} 
              onClick={() => setActiveTab(1)}
              className={activeTab === 1 ? "bg-amber-600 text-white hover:bg-amber-700" : "hover:bg-gray-100"}
            >
              <Clock className="w-4 h-4 mr-2" />
              उपलब्ध बैच ({availableBatches.length})
            </Button>
            <Button 
              variant={activeTab === 2 ? "default" : "outline"} 
              onClick={() => setActiveTab(2)}
              className={activeTab === 2 ? "bg-green-600 text-white hover:bg-green-700" : "hover:bg-gray-100"}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              डिलीवर किए गए / हिस्ट्री ({historyBatches.length})
            </Button>
          </div>

          {/* Date filter for history */}
          {activeTab === 2 && (
            <div className="flex items-center space-x-2">
              <Label htmlFor="date-filter" className="text-sm text-gray-600 whitespace-nowrap">से बैच दिखाएँ:</Label> 
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

      {/* Batches List */}
      <section className="max-w-6xl mx-auto px-4 pb-16 space-y-10">
        <h2 className="text-2xl font-bold mb-4">
          {activeTab === 0 && "आपके असाइन किए गए डिलीवरी बैच"}
          {activeTab === 1 && "उपलब्ध पिकअप के लिए डिलीवरी बैच"}
          {activeTab === 2 && `पूरे हुए/कैंसल बैच (शुरुआत: ${dateFilter ? format(dateFilter, "dd MMM yyyy") : 'सभी'})`}
        </h2>

        {activeTab === 0 && (
          <OrdersListView 
            orders={assignedBatches} 
            title="कोई असाइन किए गए बैच नहीं" 
            subtitle="नए बैच स्वीकार करें या पुराने बैच डिलीवर करें।" 
            myDeliveryBoyId={myDeliveryBoyId} 
            onAcceptOrder={(() => {}) as any} 
            onUpdateStatus={(batch: any) => handleStatusProgress(batch)}
            acceptLoading={false}
            updateLoading={updateStatusMutation.isPending || sendOtpToCustomerMutation.isPending} 
            Button={Button} Card={Card} CardContent={CardContent} CardHeader={CardHeader} CardTitle={CardTitle} Badge={Badge}
            statusColor={getStatusColor} statusText={getStatusText} nextStatus={getNextStatus} nextStatusLabel={getNextStatusLabel}
          />
        )}

        {activeTab === 1 && (
          <OrdersListView 
            orders={availableBatches} 
            title="कोई उपलब्ध बैच नहीं" 
            subtitle="नए बैच के लिए बाद में जाँच करें।" 
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
            orders={historyBatches} 
            title="कोई इतिहास बैच नहीं" 
            subtitle={`चुनी हुई तारीख़ (${format(dateFilter ?? new Date(), "dd MMM yyyy")}) के बाद कोई पूरा हुआ बैच नहीं मिला।`} 
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

    {/* OTP Dialog (Batch-based) */}
    
{otpDialogOpen && selectedOrder && (
  <DeliveryOtpDialog
    isOpen={otpDialogOpen}
    onOpenChange={setOtpDialogOpen}
    order={selectedOrder} // यह अब Batch ऑब्जेक्ट है

    onConfirm={async (otp: string) => {
      handleOtpConfirmation(otp); 
    }}
    isSubmitting={handleOtpSubmitMutation.isPending}
    error={handleOtpSubmitMutation.error ? handleOtpSubmitMutation.error.message : null}

    onSendManualOtp={async () => {
      handleSendManualOtp(); 
    }}
    isSendingManualOtp={sendOtpToCustomerMutation.isPending}

    onCompleteWithoutOtp={async () => {
      handleCompleteWithoutOtp();
    }}
    isCompletingWithoutOtp={completeWithoutOtpMutation.isPending}
  />
)}
      
</div>
    );
}
      
// --- Helper Component for Batches List ---

const OrdersListView: React.FC<OrdersListViewProps> = ({ 
  orders, // Batches
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
          statusText={statusText} nextStatus={nextStatus} nextStatusLabel={getNextStatusLabel}
        />
      )}
    </>
  );
};
