// client/src/pages/admin/AdminVendorDetailsPage.tsx

"use client";

import React, { useState, useEffect } from "react"; 
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom"; 
//import { toast as useToastHook } from "../../hooks/use-toast"; 
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea"; 
import { Loader2, ArrowLeft } from "lucide-react"; 
import { apiRequest } from "../../lib/queryClient"; 
import { useToast } from "../../hooks/use-toast"; // 'useToast' को सीधा इम्पोर्ट करें
// Interfaces
interface Seller { 
  id: number;
  businessName: string; 
  email: string | null; 
  phone: string;
  approvalStatus: "pending" | "approved" | "rejected"; 
  rejectionReason: string | null; 
  approvedAt: string | null; 
  // New fields for settings
  deliveryRadius?: number; 
  deliveryPincodes?: string[]; 
  baseDeliveryCharge?: number; 
  chargePerKm?: number; 
  city?: string;
  pincode?: string;
  deliveryPhone?: string;
}

const AdminVendorDetailsPage: React.FC = () => { 
  const { id } = useParams<{ id: string }>(); 
  const sellerId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [showRejectModal, setShowRejectModal] = useState(false); 
  const [rejectionReason, setRejectionReason] = useState(""); 
  const [sellerData, setSellerData] = useState<Partial<Seller>>({}); 

  // 1. Fetch Seller Details
  const { data: seller, isLoading: isLoadingSeller, error: sellerError } = useQuery<Seller, Error>({
    queryKey: ["adminSellerDetails", sellerId],
    queryFn: () => apiRequest('GET', `/api/admin/vendors/${sellerId}`), 
    enabled: !!sellerId, 
  });

  useEffect(() => {
    if (seller) {
      setSellerData(seller); 
    }
  }, [seller]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setSellerData(prev => ({
      ...prev,
      [id]: type === 'number' ? Number(value) : value,
    }));
  };

  const handlePincodesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSellerData(prev => ({
      ...prev,
      deliveryPincodes: value.split(',').map(p => p.trim()).filter(p => p.length > 0),
    }));
  };


  // 2. Approve Seller Mutation
  const approveMutation = useMutation<void, Error, number>({
    mutationFn: async (idToApprove: number) => {
      await apiRequest('PATCH', `/api/admin/vendors/approve/${idToApprove}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSellerDetails", sellerId] });
      queryClient.invalidateQueries({ queryKey: ["adminpendingvendors"] }); 
      queryClient.invalidateQueries({ queryKey: ["adminapprovedvendors"] }); 
      // Success toast with JSX content wrapper
      // ✅ सही तरीका (Plain Text)
toast({
  title: "विक्रेता स्वीकृत", // 👈 <div> हटा दिया
  description: "विक्रेता को सफलतापूर्वक स्वीकृत किया गया है।", 
  variant: "default", // 'success' की जगह 'default' रखें अगर एरर आए
  className: "bg-green-600 text-white", // स्टाइल के लिए className का उपयोग करें
});
    },
    onError: (err) => {
      toast({
        title: "स्वीकृति विफल",
        description: (err as any).response?.data?.message || err.message || "विक्रेता को स्वीकृत करने में विफल।",
        variant: "destructive",
      });
    },
  });

  // 3. Reject Seller Mutation
  const rejectMutation = useMutation<void, Error, { sellerId: number; reason: string }>({
    mutationFn: async ({ sellerId: idToReject, reason }) => {
      await apiRequest('PATCH', `/api/admin/vendors/reject/${idToReject}`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSellerDetails", sellerId] });
      queryClient.invalidateQueries({ queryKey: ["adminpendingvendors"] }); 
      setShowRejectModal(false);
      setRejectionReason("");
      // Success toast with JSX content wrapper
      toast({
        title: "विक्रेता अस्वीकृत",
        description: "विक्रेता को सफलतापूर्वक अस्वीकृत किया गया है।",
        variant: "destructive",
        className: "bg-red-600 text-white",
      });
    },
    onError: (err) => {
      const errorMessage = (err as any).response?.data?.message || err.message || "विक्रेता को अस्वीकृत करने में विफल।";
      // Error toast with JSX content wrapper and explicit red background
      toast({
        title: "❌ अस्वीकृति विफल",
        description: errorMessage,
        variant: "destructive",
        className: "bg-red-700 text-white",
      });
    },
  });

  // 4. Update Seller Settings Mutation
  const updateSellerSettingsMutation = useMutation<void, Error, Partial<Seller>>({
    mutationFn: async (dataToUpdate: Partial<Seller>) => {
      await apiRequest('PATCH', `/api/admin/vendors/${sellerId}`, dataToUpdate); 
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSellerDetails", sellerId] });
      // Success toast with JSX content wrapper
      toast({
        title: "विक्रेता सेटिंग्स अपडेटेड",
        description: "विक्रेता की सेटिंग्स सफलतापूर्वक अपडेट की गई हैं।",
        variant: "default",
        className: "bg-green-600 text-white",
      });
    },
    onError: (err) => {
      toast({
        title: "अपडेट विफल",
        description: (err as any).response?.data?.message || err.message || "विक्रेता की सेटिंग्स अपडेट करने में विफल।",
        variant: "destructive",
      });
    },
  });

  // 5. Delete Seller Mutation (Permanent Cleanup)
  const deleteMutation = useMutation<void, Error, number>({
    mutationFn: async (idToDelete: number) => {
      await apiRequest('DELETE', `/api/admin/vendors/${idToDelete}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminpendingvendors"] }); 
      queryClient.invalidateQueries({ queryKey: ["adminapprovedvendors"] }); 
      
      // Success toast for deletion
      toast({
        title: "🗑️ विक्रेता हटाया गया",
        description: "विक्रेता रिकॉर्ड डेटाबेस से सफलतापूर्वक हटा दिया गया है।",
        variant: "destructive", 
        className: "bg-red-700 text-white",
      });
      
      // Navigate back to the list page
      navigate('/admin/vendors'); 
    },
    onError: (err) => {
      const errorMessage = (err as any).response?.data?.message || err.message || "विक्रेता को हटाने में विफल।";
      // Error toast 
      toast({
        title: "❌ डिलीट विफल",
        description: errorMessage,
        variant: "destructive",
        className: "bg-red-700 text-white",
      });
    },
  });

  const handleApprove = () => { 
    approveMutation.mutate(sellerId);
  };

  const openRejectModal = () => { 
    setShowRejectModal(true);
  };

  const handleRejectSubmit = () => { 
    if (!rejectionReason.trim()) {
      toast({
        title: "अस्वीकृति रद्द",
        description: "अस्वीकृति का कारण खाली नहीं हो सकता।",
        variant: "default",
      });
      return;
    }
    rejectMutation.mutate({ sellerId: sellerId, reason: rejectionReason });
  };

  const handleUpdateSettings = (e: React.FormEvent) => {
  e.preventDefault();

  // 1. सिर्फ वो डेटा निकालें जो डेटाबेस अपडेट के लिए ज़रूरी है
  // फालतू की चीज़ें जैसे user, createdAt, id हटा दें
  const { 
    deliveryRadius, 
    deliveryPincodes, 
    baseDeliveryCharge, 
    chargePerKm,
    businessName,
    city,
    pincode
  } = sellerData;

  // 2. एक साफ़ ऑब्जेक्ट बनाएँ (जो बैकएंड मांग रहा है)
  const cleanData = {
    deliveryRadius: deliveryRadius, // हम Km वाले को ही असली Radius मान रहे हैं
    deliveryPincodes,
   deliveryCharge: baseDeliveryCharge ? Number(baseDeliveryCharge) : undefined,
      chargePerKm: chargePerKm ? Number(chargePerKm) : undefined,
      businessName,
      city,
      pincode
  };

  // 3. जो अनडिफाइंड हैं उन्हें डिलीट करें ताकि एरर न आए
  Object.keys(cleanData).forEach(key => 
    (cleanData[key as keyof typeof cleanData] === undefined || cleanData[key as keyof typeof cleanData] === null) && delete cleanData[key as keyof typeof cleanData]
  );

  updateSellerSettingsMutation.mutate(cleanData);
};
  const handleDelete = () => {
    if (window.confirm("क्या आप इस विक्रेता को स्थायी रूप से हटाना चाहते हैं? यह कार्रवाई अपरिवर्तनीय है।")) {
        deleteMutation.mutate(sellerId);
    }
  };


  if (isLoadingSeller) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (sellerError) {
    return <p className="p-4 text-red-500 text-center">विक्रेता विवरण लोड करने में त्रुटि: {sellerError.message}</p>;
  }

  if (!seller) {
    return <p className="p-4 text-center">विक्रेता नहीं मिला।</p>;
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen font-inter">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold text-gray-800">विक्रेता विवरण: {seller.businessName}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seller Basic Information */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">मूलभूत जानकारी</h2>
          <p className="mb-2"><strong>ID:</strong> {seller.id}</p>
          <p className="mb-2"><strong>व्यवसाय का नाम:</strong> {seller.businessName}</p>
          <p className="mb-2"><strong>Email:</strong> {seller.email}</p> 
          <p className="mb-2">
            <strong>स्थिति:</strong>
            <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${
                seller.approvalStatus === "approved" ? "bg-green-100 text-green-800" :
                seller.approvalStatus === "pending" ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-800"
              }`}>
              {seller.approvalStatus}
            </span>
          </p>
          <p className="flex justify-between border-b pb-2">
              <span className="text-slate-500 font-medium">Phone (Login):</span>
              <span className="font-bold text-blue-600">{seller.phone}</span> {/* ✅ Phone Number dikhana zaroori hai */}
            </p>
          {seller.rejectionReason && (
            <p className="text-red-500 text-sm mb-2">
              <strong>अस्वीकृति का कारण:</strong> {seller.rejectionReason}
            </p>
          )}
          {seller.approvedAt && (
            <p className="text-gray-500 text-sm">
              <strong>अनुमोदित तिथि:</strong> {new Date(seller.approvedAt).toLocaleString()}
            </p>
          )}

          <div className="mt-6 flex space-x-2">
            {seller.approvalStatus === "pending" && (
              <>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleApprove}
                  disabled={approveMutation.isPending || rejectMutation.isPending || deleteMutation.isPending}
                >
                  {approveMutation.isPending ? "स्वीकृत हो रहा है..." : "स्वीकृत करें"}
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={openRejectModal}
                  disabled={approveMutation.isPending || rejectMutation.isPending || deleteMutation.isPending}
                >
                  अस्वीकृत करें
                </Button>
              </>
            )}
            {/* Optionally allow re-rejection for approved sellers or other status changes */}
            {seller.approvalStatus === "approved" && (
                <Button
                    variant="destructive"
                    onClick={openRejectModal}
                    disabled={rejectMutation.isPending || deleteMutation.isPending}
                >
                    अस्वीकृत करें (पुनः)
                </Button>
            )}
            
            {/* 🗑️ DELETE BUTTON ADDED HERE */}
            {/* यह बटन Reject या Approve बटन के साथ भी दिखना चाहिए ताकि एडमिन cleanup कर सके */}
            <Button
                // ✅ FIX: The incorrect closing tag issue is resolved by ensuring proper JSX syntax.
                // We use bg-gray-800 for a distinct "Cleanup" action.
                variant="default" 
                className="bg-gray-800 hover:bg-gray-900 text-white" 
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
            >
                {deleteMutation.isPending ? "हटाया जा रहा है..." : "स्थायी रूप से हटाएं"}
            </Button>

          </div>
        </div>

        {/* Seller Delivery & Charges Settings */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">डिलीवरी और शुल्क सेटिंग्स</h2>
          <form onSubmit={handleUpdateSettings} className="space-y-4">
            <div>
              <Label htmlFor="deliveryRadius">डिलीवरी रेडियस (KM में)</Label>
              <Input
                id="deliveryRadius"
                type="number"
                value={sellerData.deliveryRadius ?? ''}
                onChange={handleInputChange}
                placeholder="उदा. 10"
                min="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                यह विक्रेता का विशिष्ट डिलीवरी रेडियस है। खाली छोड़ने पर प्लेटफ़ॉर्म डिफ़ॉल्ट का उपयोग किया जाएगा।
              </p>
            </div>

            <div>
              <Label htmlFor="deliveryPincodes">डिलीवरी पिनकोड (कॉमा से अलग)</Label>
              <Input
                id="deliveryPincodes"
                type="text"
                value={sellerData.deliveryPincodes?.join(', ') ?? ''}
                onChange={handlePincodesChange}
                placeholder="उदा. 110001, 110002, 110003"
              />
              <p className="text-xs text-muted-foreground mt-1">
                विक्रेता द्वारा कवर किए गए विशिष्ट पिनकोड। खाली छोड़ने पर रेडियस का उपयोग किया जाएगा।
              </p>
            </div>

            <div>
              <Label htmlFor="baseDeliveryCharge">बेस डिलीवरी चार्ज (₹)</Label>
              <Input
                id="baseDeliveryCharge"
                type="number"
                value={sellerData.baseDeliveryCharge ?? ''}
                onChange={handleInputChange}
                placeholder="उदा. 20"
                min="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                यह विक्रेता का विशिष्ट बेस डिलीवरी चार्ज है। खाली छोड़ने पर प्लेटफ़ॉर्म डिफ़ॉल्ट का उपयोग किया जाएगा।
              </p>
            </div>

            <div>
              <Label htmlFor="chargePerKm">प्रति किलोमीटर चार्ज (₹)</Label>
              <Input
                id="chargePerKm"
                type="number"
                value={sellerData.chargePerKm ?? ''}
                onChange={handleInputChange}
                placeholder="उदा. 5"
                min="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                यह विक्रेता का विशिष्ट प्रति किलोमीटर चार्ज है। खाली छोड़ने पर प्लेटफ़ॉर्म डिफ़ॉल्ट का उपयोग किया जाएगा।
              </p>
            </div>

            <Button type="submit" disabled={updateSellerSettingsMutation.isPending || deleteMutation.isPending}>
              {updateSellerSettingsMutation.isPending ? 'सेटिंग्स सेव हो रही हैं...' : 'सेटिंग्स सेव करें'}
            </Button>
          </form>
        </div>
      </div>


      {showRejectModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="relative bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4">अस्वीकृति का कारण बताएं</h3>
            <Textarea 
              className="w-full h-24 p-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="अस्वीकृति का कारण यहां लिखें..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                variant="ghost"
                onClick={() => setShowRejectModal(false)}
              >
                रद्द करें
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white" 
                onClick={handleRejectSubmit}
                disabled={rejectMutation.isPending || deleteMutation.isPending}
              >
                {rejectMutation.isPending ? "अस्वीकृत हो रहा है..." : "अस्वीकृत करें"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVendorDetailsPage;

