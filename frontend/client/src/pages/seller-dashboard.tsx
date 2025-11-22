// client/src/pages/SellerDashboard.tsx

"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Seller, OrderWithItems } from "../../../shared/backend/schema";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Link, useNavigate } from "react-router-dom"; 
import {
  Package, ShoppingCart, TrendingUp, Star, Clock, CheckCircle, Settings, XCircle,
} from "lucide-react";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";

// --- Import UI Components ---
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
// ✅ Header इम्पोर्ट हटा दिया गया है

// --- Import Managers ---
import ProductManager from "../components/productmanager";
import OrderManager from "../components/ordermanager";
import SellerProfileEdit from "../components/seller/sellerprofileedit";

export default function SellerDashboard() { 
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("products");

  const { socket, isConnected } = useSocket();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // ----------------- socket.io logic -----------------
  useEffect(() => {
    if (!socket || !isConnected || !isAuthenticated || user?.role !== "seller")
      return;

    const handleNewOrder = (order: OrderWithItems) => {
      console.log("📦 New order received for seller:", order);
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] });
      toast({
        title: "🔔 New Order!",
        description: `You received a new order for order #${order.id}.`,
        duration: 5000,
      });
    };

    const handleOrderUpdate = (order: OrderWithItems) => {
      console.log("🚚 Order update received for seller:", order);
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] });
      if (order.deliveryBoy && order.status !== 'pending') {
        toast({
          title: "✅ Delivery Assigned!",
          description: `Order #${order.id} assigned to delivery boy ${order.deliveryBoy.name}.`,
          duration: 8000,
        });
      }
    };

    socket.on("new-order-for-seller", handleNewOrder);
    socket.on("order-updated-for-seller", handleOrderUpdate);
    return () => {
      socket.off("new-order-for-seller", handleNewOrder);
      socket.off("order-updated-for-seller", handleOrderUpdate);
    };
  }, [socket, isConnected, isAuthenticated, user, toast, queryClient]);

  // ----------------- fetch seller profile -----------------
  const {
    data: seller,
    isLoading: sellerLoading,
    error: sellerError,
  } = useQuery<Seller>({
    queryKey: ["/api/sellers/me"],
    queryFn: () => apiRequest("GET", "/api/sellers/me", null, user?.idToken),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated && user?.role === "seller",
  });

  // ----------------- fetch seller orders -----------------
  const {
    data: orders,
    isLoading: ordersLoading,
    error: ordersError,
  } = useQuery<OrderWithItems[]>({
    queryKey: ["/api/sellers/orders"],
    queryFn: () => apiRequest("GET", "/api/sellers/orders", null, user?.idToken),
    enabled: !!seller?._id,
    staleTime: 0,
    refetchInterval: 60 * 1000,
  });

  // ----------------- metrics -----------------
  const totalRevenue =
    orders?.reduce(
      (sum, order) =>
        sum +
        order.items.reduce(
          (itemSum, item) =>
            itemSum +
            (typeof item.total === "string"
              ? parseFloat(item.total)
              : item.total),
          0
        ) || 0,
      0
    );

  const totalOrders = orders?.length || 0;
  const totalProducts = 0; 
  const averageRating = parseFloat(seller?.rating?.toString() || "0");

  // ----------------- loading / error UI -----------------
  if (sellerLoading) {
    return (
      <div className="py-8"> {/* ✅ min-h-screen और Header हटाया */}
        <div className="animate-pulse space-y-6">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-10 w-full mb-4 rounded-md" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (sellerError || !seller) {
    return (
      <div className="py-16 text-center"> {/* ✅ min-h-screen और Header हटाया */}
        <div className="text-6xl mb-4">
          {sellerError ? (
            <XCircle className="w-20 h-20 text-red-500 mx-auto" />
          ) : (
            "🏪"
          )}
        </div>
        <h2 className="text-2xl font-bold mb-4">
          {sellerError ? "Error Loading Profile" : "Seller Profile Not Found"}
        </h2>
        <p className="text-muted-foreground mb-6">
          {sellerError
            ? "There was an issue fetching your seller profile. Please try again."
            : "It looks like you haven't set up your seller profile yet or it's not approved."}
        </p>
        <Link to="/seller-apply">
          <Button>
            {sellerError ? "Retry" : "Apply to be a Seller"}
          </Button>
        </Link>
        <Link to="/">
          <Button variant="ghost" className="ml-4">
            Go Back Home
          </Button>
        </Link>
      </div>
    );
  }

  // ----------------- Dashboard Content -----------------
  return (
    <div className="space-y-8"> {/* ✅ min-h-screen और Header हटाया */}
      {/* Header / Metrics सेक्शन */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard Overview</h1>
          <p className="text-muted-foreground">Welcome back, {seller.businessName}</p>
        </div>
        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          {seller.approvalStatus === "approved" ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle className="h-3 w-3 mr-1" /> Verified Seller
            </Badge>
          ) : seller.approvalStatus === "pending" ? (
            <Badge variant="secondary">
              <Clock className="h-3 w-3 mr-1" /> Pending Verification
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" /> Rejected ({seller.rejectionReason || "no reason specified"})
            </Badge>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center">
            <ShoppingCart className="h-8 w-8 text-secondary" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{totalOrders}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center">
            <Package className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Products</p>
              <p className="text-2xl font-bold">{totalProducts}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center">
            <Star className="h-8 w-8 text-yellow-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Rating</p>
              <p className="text-2xl font-bold">{averageRating.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue="products"
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="products">
            <Package className="h-4 w-4 mr-2" /> Products
          </TabsTrigger>
          <TabsTrigger value="orders">
            <ShoppingCart className="h-4 w-4 mr-2" /> Orders
          </TabsTrigger>
          <TabsTrigger value="profile">
            <Settings className="h-4 w-4 mr-2" /> Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductManager seller={seller} />
        </TabsContent>

        <TabsContent value="orders">
          <OrderManager
            seller={seller}
            orders={orders}
            isLoading={ordersLoading}
            error={ordersError}
          />
        </TabsContent>

        <TabsContent value="profile">
          <SellerProfileEdit />
        </TabsContent>
      </Tabs>
    </div>
  );
              }
