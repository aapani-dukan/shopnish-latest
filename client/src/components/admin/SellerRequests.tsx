import React, { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast.js";
import { Button } from "@/components/ui/button";

type Seller = {
  id: number;
  businessName: string;
  approvalStatus: string;
  rejectionReason: string | null;
  approvedAt: string | null;
};

const SellerRequests = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [currentSellerId, setCurrentSellerId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: sellers, isLoading: loading, error } = useQuery<Seller[], Error>({
    queryKey: ["adminPendingSellers"],
    queryFn: async () => {
      const res = await axios.get("/api/admin/vendors/sellers/pending");
      return res.data;
    },
    staleTime: 5 * 60 * 1000, 
    gcTime: 10 * 60 * 1000,
  });

  const approveMutation = useMutation<void, Error, number>({
    mutationFn: async (sellerId: number) => {
      await axios.post(`/api/admin/vendors/sellers/${sellerId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPendingSellers"] });
      toast({
        title: "विक्रेता स्वीकृत",
        description: "विक्रेता को सफलतापूर्वक स्वीकृत किया गया है।",
        variant: "default",
      });
    },
    onError: (err) => {
      toast({
        title: "स्वीकृति विफल",
        description: axios.isAxiosError(err) ? err.response?.data?.message || "विक्रेता को स्वीकृत करने में विफल।" : err.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation<void, Error, { sellerId: number; reason: string }>({
    mutationFn: async ({ sellerId, reason }) => {
      await axios.post(`/api/admin/vendors/sellers/${sellerId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPendingSellers"] });
      toast({
        title: "विक्रेता अस्वीकृत",
        description: "विक्रेता को सफलतापूर्वक अस्वीकृत किया गया है।",
        variant: "default",
      });
      setShowRejectModal(false);
      setRejectionReason("");
      setCurrentSellerId(null);
    },
    onError: (err) => {
      toast({
        title: "अस्वीकृति विफल",
        description: axios.isAxiosError(err) ? err.response?.data?.message || "विक्रेता को अस्वीकृत करने में विफल।" : err.message,
        variant: "destructive",
      });
    },
  });

  const handleApprove = (sellerId: number) => {
    approveMutation.mutate(sellerId);
  };

  const openRejectModal = (sellerId: number) => {
    setCurrentSellerId(sellerId);
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
    if (currentSellerId) {
      rejectMutation.mutate({ sellerId: currentSellerId, reason: rejectionReason });
    }
  };

  if (loading) {
    return <p className="p-4 text-center">विक्रेता के अनुरोध लोड हो रहे हैं...</p>;
  }

  if (error) {
    return <p className="p-4 text-red-500 text-center">विक्रेता के अनुरोध लोड करने में त्रुटि: {error.message}</p>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">लंबित विक्रेता अनुरोध</h2>
      {sellers && sellers.length === 0 ? (
        <p className="text-gray-600">कोई लंबित विक्रेता अनुरोध नहीं हैं।</p>
      ) : (
        <ul className="space-y-4">
          {sellers?.map((seller: Seller) => (
            <li key={seller.id} className="border border-gray-200 p-4 rounded-lg shadow-sm bg-white">
              <p className="text-lg font-medium text-gray-700">
                <strong>व्यवसाय का नाम:</strong> {seller.businessName}
              </p>
              <p className="text-gray-500">
                <strong>स्थिति:</strong> {seller.approvalStatus}
              </p>
              {seller.rejectionReason && (
                <p className="text-red-500 text-sm">
                  <strong>कारण:</strong> {seller.rejectionReason}
                </p>
              )}
              <div className="mt-4 flex space-x-2">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-md transition duration-200 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
                  onClick={() => handleApprove(seller.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  {approveMutation.isPending && approveMutation.variables === seller.id
                    ? "स्वीकृत हो रहा है..."
                    : "स्वीकृत करें"}
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-md transition duration-200 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
                  onClick={() => openRejectModal(seller.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  अस्वीकृत करें
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="relative bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4">अस्वीकृति का कारण बताएं</h3>
            <textarea
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
                className="bg-red-600 hover:bg-red-700"
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

export default SellerRequests;

  
