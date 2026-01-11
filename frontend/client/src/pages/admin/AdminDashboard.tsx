// client/src/pages/admin/AdminDashboard.tsx // ✅ File name change for consistency

"use client";

import React, { useState, useEffect } from "react"; 
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; 
import { toast } from "../../hooks/use-toast";
import { Button } from "../../components/ui/button"; 
import { Check, X, Loader2, Pencil } from "lucide-react";
import api from "../../lib/api"; // ✅ api - assuming this is your Axios instance
import { useSocket } from "../../hooks/useSocket"; 
import { useNavigate } from "react-router-dom"; 
import AdminSettingsPage from "./AdminSettingsPage"; 
import AdminOrderDashboard from "./AdminOrderDashboard"; 
import { Image as ImageIcon, PlusCircle, Trash2 } from "lucide-react";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
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
// Interfaces mein ye jodiye
interface LayoutElement {
  id: number;
  type: string;
  imageUrl: string;
  title?: string;
  link?: string;
}
const AdminDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pending-vendors");
  const { socket } = useSocket();
  const navigate = useNavigate();
const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerType, setBannerType] = useState("main_banner");
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
      queryClient.invalidateQueries({ queryKey: ["adminRejectedVendors"] }); // ✅ ADDED: Invalidate Rejected Vendors
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
    socket.on("admin:deliveryboy-updated", handleDeliveryBoyUpdate);

    return () => {
      socket.off("admin:vendor-updated", handleVendorUpdate);
      socket.off("admin:product-updated", handleProductUpdate);
      socket.off("admin:deliveryboy-updated", handleDeliveryBoyUpdate);
    };
  }, [socket, queryClient]); 

  // --- Vendors API calls ---
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

  // ✅ ADDED: Rejected Vendors Query
  const { data: rejectedVendors } = useQuery<Vendor[]>({
    queryKey: ["adminRejectedVendors"],
    queryFn: async () => {
      const res = await api.get("/api/admin/vendors/rejected"); // Backend में यह रूट पहले ही जोड़ा जा चुका है
      return res.data;
    },
  });


  // --- Products API calls ---
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

  // --- Delivery Boys API calls ---
  const { data: pendingDeliveryBoys } = useQuery<DeliveryBoy[]>({
    queryKey: ["adminPendingDeliveryBoys"],
    queryFn: async () => {
      const res = await api.get("/api/admin/delivery-boys/pending"); 
      return res.data;
    },
  });

  const { data: approvedDeliveryBoys } = useQuery<DeliveryBoy[]>({
    queryKey: ["adminApprovedDeliveryBoys"],
    queryFn: async () => {
      const res = await api.get("/api/admin/delivery-boys/approved"); 
      return res.data;
    },
  });
  // --- Layout API Calls ---
  const { data: layoutElements, isLoading: isLoadingLayout } = useQuery<LayoutElement[]>({
    queryKey: ["adminLayout"],
    queryFn: async () => {
      const res = await api.get("/api/layout/public");
      return res.data;
    },
    enabled: activeTab === "layout-mgmt"
  });

  const uploadBannerMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await api.post("/api/layout/admin/add", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
    },
    onSuccess: () => {
      toast({ title: "Banner Uploaded Successfully!" });
      setBannerFile(null);
      queryClient.invalidateQueries({ queryKey: ["adminLayout"] });
    },
    onError: (err: any) => {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    }
  });

  const handleBannerSubmit = () => {
    if (!bannerFile) return toast({ title: "Please select an image" });
    const formData = new FormData();
    formData.append("image", bannerFile);
    formData.append("type", bannerType);
    formData.append("title", "New Promotion"); // Aap ise dynamic bhi kar sakte hain
    uploadBannerMutation.mutate(formData);
  };

  // --- Mutations (existing logic for approval/rejection remains) ---
  const approveVendorMutation = useMutation({
    mutationFn: (vendorId: number) => api.patch(`/api/admin/vendors/approve/${vendorId}`), 
    onSuccess: () => {
      toast({ title: "Vendor approved" });
      queryClient.invalidateQueries({ queryKey: ["adminPendingVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedVendors"] });
    },
    onError: (error: any) => { 
      console.error("Error approving vendor:", error);
      toast({ title: "Failed to approve vendor", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  const rejectVendorMutation = useMutation({
    mutationFn: (vendorId: number) => api.patch(`/api/admin/vendors/reject/${vendorId}`, { reason: "not eligible" }), 
    onSuccess: () => {
      toast({ title: "Vendor rejected" });
      queryClient.invalidateQueries({ queryKey: ["adminPendingVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedVendors"] }); 
      queryClient.invalidateQueries({ queryKey: ["adminRejectedVendors"] }); // ✅ ADDED: Invalidate Rejected Vendors
    },
    onError: (error: any) => {
      console.error("Error rejecting vendor:", error);
      toast({ title: "Failed to reject vendor", description: error.message || "An unexpected error occurred.", variant: "destructive" });
    }
  });

  const approveProductMutation = useMutation({
    mutationFn: (productId: number) => api.patch(`/api/admin/products/${productId}/approve`), 
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
    mutationFn: (productId: number) => api.patch(`/api/admin/products/${productId}/reject`, { reason: "not eligible" }), 
    onSuccess: () => {
      toast({ title: "Product rejected" });
      queryClient.invalidateQueries({ queryKey: ["adminPendingProducts"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedProducts"] }); 
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
    mutationFn: (deliveryBoyId: number) => api.patch(`/api/admin/delivery-boys/reject/${deliveryBoyId}`, { reason: "not eligible" }), 
    onSuccess: () => {
      toast({ title: "Delivery boy rejected" });
      queryClient.invalidateQueries({ queryKey: ["adminPendingDeliveryBoys"] });
      queryClient.invalidateQueries({ queryKey: ["adminApprovedDeliveryBoys"] }); 
    },
    onError: (error: any) => {
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
        
      // ✅ ADDED: Rejected Vendors Case
      case "rejected-vendors": 
        return (
          <div>
            <h2 className="text-lg font-semibold mb-2 text-red-700">Rejected Vendors (Cleanup List)</h2> 
            {Array.isArray(rejectedVendors) && rejectedVendors.length > 0 ? (
                rejectedVendors.map((vendor) => ( 
                <div key={vendor.id} className="flex justify-between items-center bg-white p-2 rounded mb-2 shadow-sm border-l-4 border-red-500"> 
                    <span>
                        {vendor.businessName} 
                        {vendor.rejectionReason && <span className="ml-2 text-xs text-red-500 italic"> (Reason: {vendor.rejectionReason})</span>}
                    </span> 
                    <div className="flex items-center space-x-2"> 
                        {/* यह बटन Vendor Details Page पर ले जाएगा जहाँ Delete बटन मौजूद है */}
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/vendors/${vendor.id}`)}> 
                            <Pencil className="h-4 w-4 mr-1" /> View/Delete
                        </Button>
                    </div>
                </div>
            ))
            ) : (
                <p className="text-gray-500">कोई भी अस्वीकृत (Rejected) विक्रेता नहीं है।</p>
            )}
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
            {approvedProducts?.map((product) => ( 
              <div key={product.id} className="flex justify-between items-center bg-white p-2 rounded mb-2 shadow-sm"> 
                <span>{product.name}</span>
                <Button variant="outline" size="sm" onClick={() => navigate(`/admin/products/${product.id}`)}> 
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
                <div key={dboy.id} className="flex justify-between items-center bg-white p-2 rounded mb-2 shadow-sm border"> 
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
                <div key={dboy.id} className="bg-white p-2 rounded mb-2 shadow-sm border px-4 py-3"> 
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

      case "layout-mgmt":
        return (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100">
              <h2 className="text-xl font-bold mb-4 flex items-center text-indigo-800">
                <PlusCircle className="mr-2" /> Add New Banner / Promotion
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Promotion Type</Label>
                  <select 
                    className="w-full p-2 border rounded-md bg-white" 
                    value={bannerType} 
                    onChange={(e) => setBannerType(e.target.value)}
                  >
                    <option value="main_banner">Main Home Banner (Top)</option>
                    <option value="flash_sale">Flash Sale Ad (Middle)</option>
                    <option value="category_ad">Category Special Ad</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Select Image</Label>
                  <Input type="file" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
                </div>
                <Button 
                  onClick={handleBannerSubmit} 
                  disabled={uploadBannerMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {uploadBannerMutation.isPending ? <Loader2 className="animate-spin" /> : "Upload Now"}
                </Button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border">
              <h2 className="text-lg font-bold mb-4">Current Active Layout Elements</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoadingLayout ? <Loader2 className="animate-spin" /> : 
                  layoutElements?.map((el) => (
                    <div key={el.id} className="relative group border rounded-lg overflow-hidden shadow-sm">
                      <img src={el.imageUrl} alt={el.type} className="w-full h-32 object-cover" />
                      <div className="p-2 bg-gray-50 flex justify-between items-center border-t">
                        <span className="text-xs font-bold uppercase text-gray-500">{el.type.replace('_', ' ')}</span>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 p-0 h-8 w-8">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        );

      default:
        return <p className="text-gray-500">Select a tab to view content.</p>; 
    }
  }; // <--- renderContent function ends here

  return (
    <div className="p-4 bg-gray-50 min-h-screen font-inter"> 
      <h1 className="text-2xl font-bold mb-4 text-indigo-900">Shopnish Admin Dashboard</h1> 
      
      <div className="flex flex-wrap gap-2 mb-6 bg-white p-3 rounded-lg shadow-sm border"> 
        <Button variant={activeTab === "pending-vendors" ? "default" : "outline"} onClick={() => setActiveTab("pending-vendors")}>Pending Vendors</Button> 
        <Button variant={activeTab === "approved-vendors" ? "default" : "outline"} onClick={() => setActiveTab("approved-vendors")}>Approved Vendors</Button>
        <Button 
            variant={activeTab === "rejected-vendors" ? "destructive" : "outline"} 
            className={activeTab === "rejected-vendors" ? "bg-red-600 text-white" : ""}
            onClick={() => setActiveTab("rejected-vendors")}
        >
            Rejected Vendors ({rejectedVendors?.length || 0})
        </Button> 
        <Button variant={activeTab === "pending-products" ? "default" : "outline"} onClick={() => setActiveTab("pending-products")}>Pending Products</Button>
        <Button variant={activeTab === "approved-products" ? "default" : "outline"} onClick={() => setActiveTab("approved-products")}>Approved Products</Button>
        <Button variant={activeTab === "pending-deliveryboys" ? "default" : "outline"} onClick={() => setActiveTab("pending-deliveryboys")}>Pending D-Boys</Button>
        <Button variant={activeTab === "approved-deliveryboys" ? "default" : "outline"} onClick={() => setActiveTab("approved-deliveryboys")}>Approved D-Boys</Button>
        <Button variant={activeTab === "orders" ? "default" : "outline"} onClick={() => setActiveTab("orders")}>Orders</Button>
        <Button variant={activeTab === "layout-mgmt" ? "default" : "outline"} className={activeTab === "layout-mgmt" ? "bg-indigo-600 text-white" : "text-indigo-600 border-indigo-200"} onClick={() => setActiveTab("layout-mgmt")}>
          <ImageIcon className="mr-2 h-4 w-4" /> Layout & Banners
        </Button>
        <Button variant={activeTab === "platform-settings" ? "default" : "outline"} onClick={() => setActiveTab("platform-settings")}>Settings</Button>
      </div>

      <div className="mt-4">
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminDashboard;