// client/src/pages/admin/AdminDashboard.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "../../hooks/use-toast";
import { Button } from "../../components/ui/button";
import { Check, X, Loader2, Pencil } from "lucide-react"; // Added Pencil icon
import api from "../../lib/api"; // This should be `apiRequest` if that's what you use for consistency
import { useSocket } from "../../hooks/useSocket";
import { useNavigate } from "react-router-dom";
import AdminSettingsPage from "./AdminSettingsPage";
import AdminOrderDashboard from "./AdminOrderDashboard"; // Ensure this is imported

// Interfaces
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
  name: string;
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
      queryClient.invalidateQueries({ queryKey: ["adminpendingvendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminapprovedvendors"] });
    };

    const handleProductUpdate = () => {
      console.log("Product update event received.");
      queryClient.invalidateQueries({ queryKey: ["adminpendingproducts"] });
      queryClient.invalidateQueries({ queryKey: ["adminapprovedproducts"] });
    };

    const handleDeliveryBoyUpdate = () => {
      console.log("Delivery boy update event received.");
      queryClient.invalidateQueries({ queryKey: ["adminpendingdeliveryboys"] });
      queryClient.invalidateQueries({ queryKey: ["adminapproveddeliveryboys"] });
    };

    socket.on("admin:vendor-updated", handleVendorUpdate);
    socket.on("admin:product-updated", handleProductUpdate);
    socket.on("admin:deliveryboy-updated", handleDeliveryBoyUpdate);

    return () => {
      socket.off("admin:vendor-updated", handleVendorUpdate);
      socket.off("admin:product-updated", handleProductUpdate);
      socket.off("admin:deliveryboy-updated", handleDeliveryBoyUpdate);
    };
  }, [socket, queryClient]);

  // Vendors API calls
  const { data: pendingVendors } = useQuery<Vendor[]>({
    queryKey: ["adminpendingvendors"],
    queryFn: async () => {
      const res = await api.get("/api/admin/vendors/pending");
      return res.data;
    },
  });

  const { data: approvedVendors } = useQuery<Vendor[]>({
    queryKey: ["adminapprovedvendors"],
    queryFn: async () => {
      const res = await api.get("/api/admin/vendors/approved");
      return res.data;
    },
  });

  // Products API calls
  const { data: pendingProducts } = useQuery<Product[]>({
    queryKey: ["adminpendingproducts"],
    queryFn: async () => {
      const res = await api.get("/api/admin/products/pending");
      return res.data;
    },
  });

  const { data: approvedProducts } = useQuery<Product[]>({
    queryKey: ["adminapprovedproducts"],
    queryFn: async () => {
      const res = await api.get("/api/admin/products/approved");
      return res.data;
    },
  });

  // Delivery Boys API calls
  const { data: pendingDeliveryBoys } = useQuery<DeliveryBoy[]>({
    queryKey: ["adminpendingdeliveryboys"],
    queryFn: async () => {
      const res = await api.get("/api/admin/delivery-boys/pending");
      return res.data;
    },
  });

  const { data: approvedDeliveryBoys } = useQuery<DeliveryBoy[]>({
    queryKey: ["adminapproveddeliveryboys"],
    queryFn: async () => {
      const res = await api.get("/api/admin/delivery-boys/approved");
      return res.data;
    },
  });

  // Mutations (Existing logic for approval/rejection remains, but consider moving to VendorDetails page)
  // mutations (existing logic for approval/rejection remains, but consider moving to vendordetails page)
  const approveVendorMutation = useMutation({ // ✅ camelCase
    // ✅ FIX 1: Change to PATCH method and correct URL path
    mutationFn: (vendorId: number) => api.patch(`/api/admin/vendors/approve/${vendorId}`),
    onSuccess: () => { // ✅ camelCase
      toast({ title: "Vendor approved" }); // ✅ camelCase
      queryClient.invalidateQueries({ queryKey: ["adminpendingvendors"] }); // ✅ queryKey is an object
      queryClient.invalidateQueries({ queryKey: ["adminapprovedvendors"] }); // ✅ queryKey is an object
    },
    onError: (error) => { // ✅ Add error handling
      console.error("Error approving vendor:", error);
      toast({ title: "Failed to approve vendor", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  const rejectVendorMutation = useMutation({ // ✅ camelCase
    // ✅ FIX 2: Change to PATCH method and correct URL path
    mutationFn: (vendorId: number) => api.patch(`/api/admin/vendors/reject/${vendorId}`, { reason: "not eligible" }),
    onSuccess: () => { // ✅ camelCase
      toast({ title: "Vendor rejected" }); // ✅ camelCase
      queryClient.invalidateQueries({ queryKey: ["adminpendingvendors"] }); // ✅ queryKey is an object
    },
    onError: (error) => { // ✅ Add error handling
      console.error("Error rejecting vendor:", error);
      toast({ title: "Failed to reject vendor", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  const approveProductMutation = useMutation({ // ✅ camelCase
    mutationFn: (productId: number) => api.post(`/api/admin/products/${productId}/approve`),
    onSuccess: () => { // ✅ camelCase
      toast({ title: "Product approved" }); // ✅ camelCase
      queryClient.invalidateQueries({ queryKey: ["adminpendingproducts"] }); // ✅ queryKey is an object
      queryClient.invalidateQueries({ queryKey: ["adminapprovedproducts"] }); // ✅ queryKey is an object
    },
    onError: (error) => { // ✅ Add error handling
      console.error("Error approving product:", error);
      toast({ title: "Failed to approve product", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  const rejectProductMutation = useMutation({ // ✅ camelCase
    mutationFn: (productId: number) => api.post(`/api/admin/products/${productId}/reject`, { reason: "not eligible" }),
    onSuccess: () => { // ✅ camelCase
      toast({ title: "Product rejected" }); // ✅ camelCase
      queryClient.invalidateQueries({ queryKey: ["adminpendingproducts"] }); // ✅ queryKey is an object
    },
    onError: (error) => { // ✅ Add error handling
      console.error("Error rejecting product:", error);
      toast({ title: "Failed to reject product", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  const approveDeliveryBoyMutation = useMutation({ // ✅ camelCase
    mutationFn: (deliveryBoyId: number) => api.post(`/api/admin/deliveryboys/${deliveryBoyId}/approve`),
    onSuccess: () => { // ✅ camelCase
      toast({ title: "Delivery boy approved" }); // ✅ camelCase
      queryClient.invalidateQueries({ queryKey: ["adminpendingdeliveryboys"] }); // ✅ queryKey is an object
      queryClient.invalidateQueries({ queryKey: ["adminapproveddeliveryboys"] }); // ✅ queryKey is an object
    },
    onError: (error) => { // ✅ Add error handling
      console.error("Error approving delivery boy:", error);
      toast({ title: "Failed to approve delivery boy", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  const rejectDeliveryBoyMutation = useMutation({ // ✅ camelCase
    mutationFn: (deliveryBoyId: number) => api.post(`/api/admin/deliveryboys/${deliveryBoyId}/reject`, { reason: "not eligible" }),
    onSuccess: () => { // ✅ camelCase
      toast({ title: "Delivery boy rejected" }); // ✅ camelCase
      queryClient.invalidateQueries({ queryKey: ["adminpendingdeliveryboys"] }); // ✅ queryKey is an object
    },
    onError: (error) => { // ✅ Add error handling
      console.error("Error rejecting delivery boy:", error);
      toast({ title: "Failed to reject delivery boy", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });
  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "pending-vendors":
        return (
          <div>
            <h2 className="text-lg font-semibold mb-2">Pending Vendors</h2>
            {pendingVendors?.map((vendor) => (
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
            {approvedVendors?.map((vendor) => (
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
            {pendingProducts?.map((product) => (
              <div key={product.id} className="flex justify-between items-center bg-white p-2 rounded mb-2 shadow-sm">
                <span>{product.name}</span>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/admin/products/${product.id}`)}> {/* New Edit Button */}
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
            {approvedProducts?.map((product) => (
              <div key={product.id} className="flex justify-between items-center bg-white p-2 rounded mb-2 shadow-sm">
                <span>{product.name}</span>
                <Button variant="outline" size="sm" onClick={() => navigate(`/admin/products/${product.id}`)}> {/* New Edit Button */}
                    <Pencil className="h-4 w-4 mr-1" /> View/Edit
                </Button>
              </div>
            ))}
          </div>
        );

      case "pending-deliveryboys":
        return (
          <div>
            <h2 className="text-lg font-semibold mb-2">Pending Delivery Boys</h2>
            {Array.isArray(pendingDeliveryBoys) && pendingDeliveryBoys.length > 0 ? (
              pendingDeliveryBoys.map((dboy) => (
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

      case "approved-deliveryboys":
        return (
          <div>
            <h2 className="text-lg font-semibold mb-2">Approved Delivery Boys</h2>
            {Array.isArray(approvedDeliveryBoys) && approvedDeliveryBoys.length > 0 ? (
              approvedDeliveryBoys.map((dboy) => (
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
        return <AdminSettingsPage />;

      case "orders":
        return <AdminOrderDashboard />;

      default:
        return <p>Select a tab</p>;
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

export default AdminDashboard;
