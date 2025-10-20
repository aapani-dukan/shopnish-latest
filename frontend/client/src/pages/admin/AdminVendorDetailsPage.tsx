// client/src/pages/admin/AdminVendorDetailsPage.tsx

"use client";

import React, { useState, useEffect } from "react"; // Added useEffect
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom"; // Added useNavigate
import { toast } from "../../hooks/use-toast"; // Corrected path
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea"; // Assuming you have a Textarea component
import { Loader2, ArrowLeft } from "lucide-react"; // Added ArrowLeft icon
import apiRequest from "../../lib/queryclient"; // Changed from axios to apiRequest (assuming it's a wrapper over axios)

// Interfaces
interface Seller { // Renamed from seller to Seller for consistency
  id: number;
  businessName: string; // Corrected casing
  email: string; // Added email, assuming it exists
  approvalStatus: "pending" | "approved" | "rejected"; // Corrected casing
  rejectionReason: string | null; // Corrected casing
  approvedAt: string | null; // Corrected casing
  // New fields for settings
  deliveryRadiusKm?: number; // Optional delivery radius for the seller
  deliveryPincodes?: string[]; // Optional array of pincodes for the seller
  baseDeliveryCharge?: number; // Optional base delivery charge for the seller
  chargePerKm?: number; // Optional charge per km for the seller
}

const AdminVendorDetailsPage: React.FC = () => { // Renamed component
  const { id } = useParams<{ id: string }>(); // Get seller ID from URL params
  const sellerId = Number(id);
  const { toast } = toast(); // Corrected useToast hook
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [showRejectModal, setShowRejectModal] = useState(false); // Corrected casing
  const [rejectionReason, setRejectionReason] = useState(""); // Corrected casing
  const [sellerData, setSellerData] = useState<Partial<Seller>>({}); // State for form data

  // 1. Fetch Seller Details
  const { data: seller, isLoading: isLoadingSeller, error: sellerError } = useQuery<Seller, Error>({
    queryKey: ["adminSellerDetails", sellerId],
    queryFn: () => apiRequest('GET', `/api/admin/vendors/${sellerId}`), // Assumed API endpoint for single seller
    enabled: !!sellerId, // Only fetch if sellerId is available
  });

  useEffect(() => {
    if (seller) {
      setSellerData(seller); // Initialize form data with fetched seller data
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
      await apiRequest('POST', `/api/admin/vendors/${idToApprove}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSellerDetails", sellerId] });
      queryClient.invalidateQueries({ queryKey: ["adminpendingvendors"] }); // Invalidate also pending vendors list
      queryClient.invalidateQueries({ queryKey: ["adminapprovedvendors"] }); // Invalidate approved vendors list
      toast({
        title: "विक्रेता स्वीकृत",
        description: "विक्रेता को सफलतापूर्वक स्वीकृत किया गया है।",
        variant: "default",
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
      await apiRequest('POST', `/api/admin/vendors/${idToReject}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSellerDetails", sellerId] });
      queryClient.invalidateQueries({ queryKey: ["adminpendingvendors"] }); // Invalidate also pending vendors list
      setShowRejectModal(false);
      setRejectionReason("");
      toast({
        title: "विक्रेता अस्वीकृत",
        description: "विक्रेता को सफलतापूर्वक अस्वीकृत किया गया है।",
        variant: "default",
      });
    },
    onError: (err) => {
      toast({
        title: "अस्वीकृति विफल",
        description: (err as any).response?.data?.message || err.message || "विक्रेता को अस्वीकृत करने में विफल।",
        variant: "destructive",
      });
    },
  });

  // 4. Update Seller Settings Mutation (New)
  const updateSellerSettingsMutation = useMutation<void, Error, Partial<Seller>>({
    mutationFn: async (dataToUpdate: Partial<Seller>) => {
      await apiRequest('PUT', `/api/admin/vendors/${sellerId}`, dataToUpdate); // Assumed API endpoint for updating seller
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSellerDetails", sellerId] });
      toast({
        title: "विक्रेता सेटिंग्स अपडेटेड",
        description: "विक्रेता की सेटिंग्स सफलतापूर्वक अपडेट की गई हैं।",
        variant: "default",
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


  const handleApprove = () => { // Corrected casing
    approveMutation.mutate(sellerId);
  };

  const openRejectModal = () => { // Corrected casing
    setShowRejectModal(true);
  };

  const handleRejectSubmit = () => { // Corrected casing
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
    updateSellerSettingsMutation.mutate(sellerData);
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
          <p className="mb-2"><strong>Email:</strong> {seller.email}</p> {/* Display email */}
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
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  {approveMutation.isPending ? "स्वीकृत हो रहा है..." : "स्वीकृत करें"}
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={openRejectModal}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
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
                    disabled={rejectMutation.isPending}
                >
                    अस्वीकृत करें (पुनः)
                </Button>
            )}
          </div>
        </div>

        {/* Seller Delivery & Charges Settings */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">डिलीवरी और शुल्क सेटिंग्स</h2>
          <form onSubmit={handleUpdateSettings} className="space-y-4">
            <div>
              <Label htmlFor="deliveryRadiusKm">डिलीवरी रेडियस (KM में)</Label>
              <Input
                id="deliveryRadiusKm"
                type="number"
                value={sellerData.deliveryRadiusKm ?? ''}
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

            <Button type="submit" disabled={updateSellerSettingsMutation.isPending}>
              {updateSellerSettingsMutation.isPending ? 'सेटिंग्स सेव हो रही हैं...' : 'सेटिंग्स सेव करें'}
            </Button>
          </form>
        </div>
      </div>


      {showRejectModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="relative bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4">अस्वीकृति का कारण बताएं</h3>
            <Textarea // Changed to Textarea component
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
                className="bg-red-600 hover:bg-red-700 text-white" // Added text-white
                onClick={handleRejectSubmit}
                disabled={rejectMutation.isPending}
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
          
