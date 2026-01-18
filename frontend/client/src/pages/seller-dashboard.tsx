"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Seller, OrderWithItems } from "../../../shared/backend/schema";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Link, useNavigate } from "react-router-dom"; 
import {
  Package, ShoppingCart, TrendingUp, Star, Clock, CheckCircle, Settings, XCircle, PlusCircle
} from "lucide-react";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";

// --- UI Components ---
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";

// --- Managers ---
import ProductManager from "../components/ProductManager";
import OrderManager from "../components/OrderManager";
import SellerProfileEdit from "../components/seller/SellerProfileEdit";

export default function SellerDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("products");
  const { socket, isConnected } = useSocket();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // ----------------- 1. Socket.io Logic -----------------
  useEffect(() => {
    if (!socket || !isConnected || !isAuthenticated || user?.role !== "seller") return;

    const handleNewOrder = (order: OrderWithItems) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] });
      toast({
        title: "🔔 नया ऑर्डर!",
        description: `ऑर्डर #${order.id} प्राप्त हुआ है।`,
        duration: 5000,
      });
    };

    socket.on("new-order-for-seller", handleNewOrder);
    return () => { socket.off("new-order-for-seller", handleNewOrder); };
  }, [socket, isConnected, isAuthenticated, user, toast, queryClient]);

  // ----------------- 2. Fetch Seller Profile -----------------
  const {
    data: seller,
    isLoading: sellerLoading,
    error: sellerError,
    refetch: refetchSeller,
  } = useQuery<Seller>({
    queryKey: ["/api/sellers/me"],
    // ✅ Fix: Argument count error solved by removing extra token param (handled by client headers)
    queryFn: () => apiRequest("GET", "/api/sellers/me"),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated && user?.role === "seller",
  });

  // ----------------- 3. Fetch Seller Orders -----------------
  const {
    data: orders,
    isLoading: ordersLoading,
    error: ordersError,
  } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/sellers/orders"],
    queryFn: () => apiRequest("GET", "/api/sellers/orders"),
    enabled: !!seller?.id,
    staleTime: 0,
    refetchInterval: 60 * 1000,
  });

  // ----------------- 4. Metrics & Revenue Fix -----------------
  // ----------------- metrics -----------------
// ✅ सुधार: TypeScript को बताने के लिए कि यह डेटा हो सकता है, 'as any' या fallback का उपयोग करें
// या बेहतर होगा कि इसे Number में बदलें ताकि toLocaleString() काम करे।

const totalRevenue = Number((seller as any)?.totalRevenue || 0);
const totalOrders = Number((seller as any)?.totalOrders || 0);
const totalProducts = Number((seller as any)?.totalProducts || 0);
const averageRating = parseFloat((seller as any)?.averageRating?.toString() || "0");

  // ----------------- 5. Loading / Error States -----------------
  if (sellerLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (sellerError || !seller) {
    if (seller?.approvalStatus === 'pending' || seller?.approvalStatus === 'rejected') {
        navigate(`/seller-status?status=${seller.approvalStatus}`, { replace: true });
        return null;
    }
    return (
      <div className="py-16 text-center">
        <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">प्रोफ़ाइल लोड करने में समस्या</h2>
        <Button onClick={() => refetchSeller()}>Retry</Button>
      </div>
    );
  }

  // ----------------- 6. Dashboard Content -----------------
  return (
    <div className="space-y-8 p-4 md:p-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground">स्वागत है, {seller.businessName}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* ✅ New High-Class Feature: Fast Link to Bulk Add Product */}
          <Link to="/seller/add-product">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md gap-2">
              <PlusCircle className="h-4 w-4" /> नया सामान जोड़ें
            </Button>
          </Link>

          {seller.approvalStatus === "approved" ? (
            <Badge className="bg-green-600 px-3 py-1">
              <CheckCircle className="h-3 w-3" />
              Verified Seller</Badge>
          ) : (
            <Badge variant="secondary" className="px-3 py-1">
              <Clock className="h-3 w-3" />
              Pending Review</Badge>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center">
            <div className="bg-green-100 p-3 rounded-lg"><TrendingUp className="h-6 w-6 text-green-600" /></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">₹{totalRevenue.toLocaleString('en-IN')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg"><ShoppingCart className="h-6 w-6 text-blue-600" /></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Orders</p>
              <p className="text-2xl font-bold">{totalOrders}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center">
            <div className="bg-orange-100 p-3 rounded-lg"><Package className="h-6 w-6 text-orange-600" /></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Products</p>
              <p className="text-2xl font-bold">{totalProducts}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6 flex items-center">
            <div className="bg-yellow-100 p-3 rounded-lg"><Star className="h-6 w-6 text-yellow-500" /></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Rating</p>
              <p className="text-2xl font-bold">{averageRating.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Section */}
      <Tabs defaultValue="products" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-gray-100 p-1">
          <TabsTrigger value="products" className="gap-2"><Package className="h-4 w-4" /> Products</TabsTrigger>
          <TabsTrigger value="orders" className="gap-2"><ShoppingCart className="h-4 w-4" /> Orders</TabsTrigger>
          <TabsTrigger value="profile" className="gap-2"><Settings className="h-4 w-4" /> Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-0">
          <Card className="border-none shadow-sm"><CardContent className="p-6">
              <ProductManager seller={seller} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-0">
          <Card className="border-none shadow-sm"><CardContent className="p-6">
              <OrderManager seller={seller} orders={orders as any} isLoading={ordersLoading} error={ordersError} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-0">
          <Card className="border-none shadow-sm"><CardContent className="p-6">
              <SellerProfileEdit />
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}