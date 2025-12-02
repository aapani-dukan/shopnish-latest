// src/pages/admin/AdminDashboard.tsx
import React from 'react';

// यहाँ कोई फैंसी हुक या जटिल लॉजिक नहीं है
const SimpleAdminDashboard = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f4f8', minHeight: '80vh' }}>
      <h1>✅ Admin Dashboard - Test Page Loaded Successfully!</h1>
      <p>यह पेज सफलतापूर्वक लोड हो रहा है, जिसका अर्थ है कि AdminLogin और रूटिंग सही काम कर रहे हैं।</p>
      <p>अगर आपको अभी भी ब्लैंक पेज दिखता है, तो समस्या AdminLayout या AdminGuard में है।</p>
      
      <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px', backgroundColor: '#fff' }}>
        <h2>Quick Checklist:</h2>
        <ul>
          <li><strong>रूटिंग:</strong> /admin/dashboard पर सही नेविगेट हुआ।</li>
          <li><strong>गार्ड:</strong> AdminGuard सही ढंग से पास हुआ।</li>
          <li><strong>लेआउट:</strong> AdminLayout रेंडर हो रहा होगा (या क्रैश हो रहा होगा)।</li>
        </ul>
      </div>
    </div>
  );
};

export default SimpleAdminDashboard;










{/*
// client/src/pages/admin/AdminDashboard.tsx // ✅ File name change for consistency

"use client";

import React, { useState, useEffect } from "react"; // ✅ React, useState, useEffect
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // ✅ tanstack/react-query
import { toast } from "../../hooks/use-toast";
import { Button } from "../../components/ui/button"; // ✅ Button
import { Check, X, Loader2, Pencil } from "lucide-react";
import api from "../../lib/api"; // ✅ api - assuming this is your Axios instance
import { useSocket } from "../../hooks/useSocket"; // ✅ useSocket
import { useNavigate } from "react-router-dom"; // ✅ useNavigate
import AdminSettingsPage from "./AdminSettingsPage"; // ✅ AdminSettingsPage
import AdminOrderDashboard from "./AdminOrderDashboard"; // ✅ AdminOrderDashboard

// Interfaces (✅ camelCase for properties)
interface Vendor {
  id: number;
  businessName: string;
  approvalStatus: "pending" | "approved" | "rejected";
  rejectionReason?: string;
}

interface Product {
  id: number;
  name: string;
  approvalStatus: "pending" | "approved" | "rejected";
  rejectionReason?: string;
}

interface DeliveryBoy {
  id: number;
  name: string; // Assuming name is directly available, otherwise it would be dboy.user.firstName
  approvalStatus: "pending" | "approved" | "rejected";
  rejectionReason?: string;
}

const AdminDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending-vendors");
  const { socket } = useSocket();
  const navigate = useNavigate();

  // Socket.io real-time updates
  useEffect(() => {
    if (!socket) {
      console.log("Waiting for socket connection in AdminDashboard...");
      return;
    }

    console.log("Socket connection established. Listening for admin events.");

    const handleVendorUpdate = () => {
      console.log("Vendor update event received.");
      queryClient.invalidateQueries({ queryKey: ["adminPendingVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedVendors"] });
    };

    const handleProductUpdate = () => {
      console.log("Product update event received.");
      queryClient.invalidateQueries({ queryKey: ["adminPendingProducts"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedProducts"] });
    };

    const handleDeliveryBoyUpdate = () => {
      console.log("Delivery boy update event received.");
      queryClient.invalidateQueries({ queryKey: ["adminPendingDeliveryBoys"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedDeliveryBoys"] });
    };

    socket.on("admin:vendor-updated", handleVendorUpdate);
    socket.on("admin:product-updated", handleProductUpdate);
    socket.on("admin:deliveryboy-updated", handleDeliveryBoyUpdate); // Note: Backend event name

    return () => {
      socket.off("admin:vendor-updated", handleVendorUpdate);
      socket.off("admin:product-updated", handleProductUpdate);
      socket.off("admin:deliveryboy-updated", handleDeliveryBoyUpdate);
    };
  }, [socket, queryClient]); // ✅ queryClient dependency

  // Vendors API calls (✅ camelCase queryKey)
  const { data: pendingVendors } = useQuery<Vendor[]>({
    queryKey: ["adminPendingVendors"],
    queryFn: async () => {
      const res = await api.get("/api/admin/vendors/pending");
      return res.data;
    },
  });

  const { data: approvedVendors } = useQuery<Vendor[]>({
    queryKey: ["adminApprovedVendors"],
    queryFn: async () => {
      const res = await api.get("/api/admin/vendors/approved");
      return res.data;
    },
  });

  // Products API calls (✅ camelCase queryKey)
  const { data: pendingProducts } = useQuery<Product[]>({
    queryKey: ["adminPendingProducts"],
    queryFn: async () => {
      const res = await api.get("/api/admin/products/pending");
      return res.data;
    },
  });

  const { data: approvedProducts } = useQuery<Product[]>({
    queryKey: ["adminApprovedProducts"],
    queryFn: async () => {
      const res = await api.get("/api/admin/products/approved");
      return res.data;
    },
  });

  // Delivery Boys API calls (✅ camelCase queryKey and CORRECTED URL)
  const { data: pendingDeliveryBoys } = useQuery<DeliveryBoy[]>({
    queryKey: ["adminPendingDeliveryBoys"],
    queryFn: async () => {
      const res = await api.get("/api/admin/delivery-boys/pending"); // ✅ CORRECTED URL
      return res.data;
    },
  });

  const { data: approvedDeliveryBoys } = useQuery<DeliveryBoy[]>({
    queryKey: ["adminApprovedDeliveryBoys"],
    queryFn: async () => {
      const res = await api.get("/api/admin/delivery-boys/approved"); // ✅ CORRECTED URL
      return res.data;
    },
  });

  // Mutations (existing logic for approval/rejection remains)
  const approveVendorMutation = useMutation({
    mutationFn: (vendorId: number) => api.patch(`/api/admin/vendors/approve/${vendorId}`), // ✅ Corrected method (PATCH)
    onSuccess: () => {
      toast({ title: "Vendor approved" });
      queryClient.invalidateQueries({ queryKey: ["adminPendingVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedVendors"] });
    },
    onError: (error: any) => { // ✅ Added type for error
      console.error("Error approving vendor:", error);
      toast({ title: "Failed to approve vendor", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  const rejectVendorMutation = useMutation({
    mutationFn: (vendorId: number) => api.patch(`/api/admin/vendors/reject/${vendorId}`, { reason: "not eligible" }), // ✅ Corrected method (PATCH)
    onSuccess: () => {
      toast({ title: "Vendor rejected" });
      queryClient.invalidateQueries({ queryKey: ["adminPendingVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedVendors"] }); // ✅ Also invalidate approved list
    },
    onError: (error: any) => {
      console.error("Error rejecting vendor:", error);
      toast({ title: "Failed to reject vendor", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  const approveProductMutation = useMutation({
    mutationFn: (productId: number) => api.patch(`/api/admin/products/${productId}/approve`), // ✅ Corrected method (PATCH) and URL path
    onSuccess: () => {
      toast({ title: "Product approved" });
      queryClient.invalidateQueries({ queryKey: ["adminPendingProducts"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedProducts"] });
    },
    onError: (error: any) => {
      console.error("Error approving product:", error);
      toast({ title: "Failed to approve product", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  const rejectProductMutation = useMutation({
    mutationFn: (productId: number) => api.patch(`/api/admin/products/${productId}/reject`, { reason: "not eligible" }), // ✅ Corrected method (PATCH) and URL path
    onSuccess: () => {
      toast({ title: "Product rejected" });
      queryClient.invalidateQueries({ queryKey: ["adminPendingProducts"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedProducts"] }); // ✅ Also invalidate approved list
    },
    onError: (error: any) => {
      console.error("Error rejecting product:", error);
      toast({ title: "Failed to reject product", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  const approveDeliveryBoyMutation = useMutation({
    mutationFn: (deliveryBoyId: number) => api.patch(`/api/admin/delivery-boys/approve/${deliveryBoyId}`), 
    
    onSuccess: () => {
      toast({ title: "Delivery boy approved" });
      queryClient.invalidateQueries({ queryKey: ["adminPendingDeliveryBoys"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedDeliveryBoys"] });
    },
    onError: (error: any) => {
      console.error("Error approving delivery boy:", error);
      toast({ title: "Failed to approve delivery boy", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  const rejectDeliveryBoyMutation = useMutation({
    mutationFn: (deliveryBoyId: number) => api.patch(`/api/admin/delivery-boys/reject/${deliveryBoyId}`, { reason: "not eligible" }), // ✅ CORRECTED METHOD (PATCH) AND URL PATH
    onSuccess: () => {
      toast({ title: "Delivery boy rejected" });
      queryClient.invalidateQueries({ queryKey: ["adminPendingDeliveryBoys"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedDeliveryBoys"] }); // ✅ Also invalidate approved list
    },
    onError: (error: any) => {
      console.error("Error rejecting delivery boy:", error);
      toast({ title: "Failed to reject delivery boy", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  // Render content based on active tab
  const renderContent = () => { // ✅ renderContent
    switch (activeTab) {
      case "pending-vendors":
        return (
          <div>
            <h2 className="text-lg font-semibold mb-2">Pending Vendors</h2> 
            {pendingVendors?.map((vendor) => ( // ✅ pendingVendors
              <div key={vendor.id} className="flex justify-between items-center bg-white p-2 rounded mb-2 shadow-sm"> 
                <span>{vendor.businessName}</span> 
                <div className="flex items-center space-x-2"> 
                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/vendors/${vendor.id}`)}> 
                    <Pencil className="h-4 w-4 mr-1" /> View/Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => approveVendorMutation.mutate(vendor.id)} disabled={approveVendorMutation.isPending}> 
                    {approveVendorMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />} 
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => rejectVendorMutation.mutate(vendor.id)} disabled={rejectVendorMutation.isPending}> 
                    {rejectVendorMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <X className="h-4 w-4" />} 
                  </Button>
                </div>
              </div>
            ))}
          </div>
        );

      case "approved-vendors":
        return (
          <div>
            <h2 className="text-lg font-semibold mb-2">Approved Vendors</h2> 
            {approvedVendors?.map((vendor) => ( // ✅ approvedVendors
              <div key={vendor.id} className="flex justify-between items-center bg-white p-2 rounded mb-2 shadow-sm"> 
                <span>{vendor.businessName}</span> 
                <Button variant="outline" size="sm" onClick={() => navigate(`/admin/vendors/${vendor.id}`)}> 
                  <Pencil className="h-4 w-4 mr-1" /> View/Edit
                </Button>
              </div>
            ))}
          </div>
        );

      case "pending-products":
        return (
          <div>
            <h2 className="text-lg font-semibold mb-2">Pending Products</h2> 
            {pendingProducts?.map((product) => ( // ✅ pendingProducts
              <div key={product.id} className="flex justify-between items-center bg-white p-2 rounded mb-2 shadow-sm"> 
                <span>{product.name}</span>
                <div className="flex items-center space-x-2"> 
                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/products/${product.id}`)}> 
                    <Pencil className="h-4 w-4 mr-1" /> View/Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => approveProductMutation.mutate(product.id)} disabled={approveProductMutation.isPending}> 
                    {approveProductMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />} 
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => rejectProductMutation.mutate(product.id)} disabled={rejectProductMutation.isPending}> 
                    {rejectProductMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <X className="h-4 w-4" />} 
                  </Button>
                </div>
              </div>
            ))}
          </div>
        );

      case "approved-products":
        return (
          <div>
            <h2 className="text-lg font-semibold mb-2">Approved Products</h2> 
            {approvedProducts?.map((product) => ( // ✅ approvedProducts
              <div key={product.id} className="flex justify-between items-center bg-white p-2 rounded mb-2 shadow-sm"> 
                <span>{product.name}</span>
                <Button variant="outline" size="sm" onClick={() => navigate(`/admin/products/${product.id}`)}> 
                    <Pencil className="h-4 w-4 mr-1" /> View/Edit
                </Button>
              </div>
            ))}
          </div>
        );

      case "pending-deliveryboys": // ✅ activeTab
        return (
          <div>
            <h2 className="text-lg font-semibold mb-2">Pending Delivery Boys</h2> 
            {Array.isArray(pendingDeliveryBoys) && pendingDeliveryBoys.length > 0 ? ( // ✅ Array.isArray, pendingDeliveryBoys
              pendingDeliveryBoys.map((dboy) => ( // ✅ pendingDeliveryBoys
                <div key={dboy.id} className="flex justify-between items-center bg-white p-2 rounded mb-2 shadow-sm"> 
                  <span>{dboy.name}</span>
                  <div className="flex items-center space-x-2"> 
                    <Button variant="outline" size="sm" onClick={() => approveDeliveryBoyMutation.mutate(dboy.id)} disabled={approveDeliveryBoyMutation.isPending}> 
                      {approveDeliveryBoyMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />} 
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => rejectDeliveryBoyMutation.mutate(dboy.id)} disabled={rejectDeliveryBoyMutation.isPending}> 
                      {rejectDeliveryBoyMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <X className="h-4 w-4" />} 
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">कोई भी पेंडिंग डिलीवरी बॉय नहीं है।</p> 
            )}
          </div>
        );

      case "approved-deliveryboys": // ✅ activeTab
        return (
          <div>
            <h2 className="text-lg font-semibold mb-2">Approved Delivery Boys</h2> 
            {Array.isArray(approvedDeliveryBoys) && approvedDeliveryBoys.length > 0 ? ( // ✅ Array.isArray, approvedDeliveryBoys
              approvedDeliveryBoys.map((dboy) => ( // ✅ approvedDeliveryBoys
                <div key={dboy.id} className="bg-white p-2 rounded mb-2 shadow-sm"> 
                  <span>{dboy.name}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500">कोई भी अप्रूव्ड डिलीवरी बॉय नहीं है।</p> 
            )}
          </div>
        );

      case "platform-settings":
        return <AdminSettingsPage />; // ✅ AdminSettingsPage

      case "orders":
        return <AdminOrderDashboard />; // ✅ AdminOrderDashboard

      default:
        return <p>Select a tab</p>; // ✅ capital S
    }
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen font-inter"> 
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1> 
      <div className="flex flex-wrap gap-4 mb-6"> 
        <Button variant={activeTab === "pending-vendors" ? "default" : "outline"} onClick={() => setActiveTab("pending-vendors")}>Pending Vendors</Button> 
        <Button variant={activeTab === "approved-vendors" ? "default" : "outline"} onClick={() => setActiveTab("approved-vendors")}>Approved Vendors</Button>
        <Button variant={activeTab === "pending-products" ? "default" : "outline"} onClick={() => setActiveTab("pending-products")}>Pending Products</Button>
        <Button variant={activeTab === "approved-products" ? "default" : "outline"} onClick={() => setActiveTab("approved-products")}>Approved Products</Button>
        <Button variant={activeTab === "pending-deliveryboys" ? "default" : "outline"} onClick={() => setActiveTab("pending-deliveryboys")}>Pending Delivery Boys</Button>
        <Button variant={activeTab === "approved-deliveryboys" ? "default" : "outline"} onClick={() => setActiveTab("approved-deliveryboys")}>Approved Delivery Boys</Button>
        
        <Button variant={activeTab === "orders" ? "default" : "outline"} onClick={() => setActiveTab("orders")}>Orders</Button>
        <Button variant={activeTab === "platform-settings" ? "default" : "outline"} onClick={() => setActiveTab("platform-settings")}>Platform Settings</Button>
      </div>
      {renderContent()}
    </div>
  );
};

export default AdminDashboard; // ✅ AdminDashboard
*/}
              
