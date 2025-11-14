// Corrected: frontend/client/src/pages/SellerDashboard.tsx
"use client"; // Assuming this is a client component

import Header from "../components/header"; // Corrected casing
import { Card, CardContent } from "../components/ui/card"; // Corrected casing
import { Badge } from "../components/ui/badge"; // Corrected casing
import { Skeleton } from "../components/ui/skeleton"; // Corrected casing
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"; // Corrected casing
import { Button } from "../components/ui/button"; // Corrected casing
import { useQuery, useQueryClient } from "@tanstack/react-query"; // Corrected casing
import type { Seller, OrderWithItems } from "../../shared/backend/schema"; // Corrected casing
import { apiRequest } from "../lib/queryclient";
import { useToast } from "../hooks/use-toast"; // Corrected casing
import { Link, useNavigate } from "react-router-dom"; // Link and useNavigate corrected casing
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Star,
  Clock,
  CheckCircle,
  Settings,
  XCircle,
} from "lucide-react"; // Corrected casing
import { useEffect, useState } from "react"; // Corrected casing
import { useSocket } from "../hooks/useSocket"; // Corrected casing
import { useAuth } from "../hooks/useAuth"; // Corrected casing
import ProductManager from "../components/productManager"; // Corrected casing
import OrderManager from "../components/orderManager"; // Corrected casing
// import ProfileManager from "../components/profileManager"; // 👈 यह हटा दिया गया है
import SellerProfileEdit from "../components/seller/SellerProfileEdit"; // 👈 इसके बजाय नया कंपोनेंट इंपोर्ट किया गया है

export default function SellerDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("products");

  const { socket, isConnected } = useSocket();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate(); // useNavigate hook added

  // ----------------- socket.io logic -----------------
  useEffect(() => {
    if (!socket || !isConnected || !isAuthenticated || user?.role !== "seller")
      return;

    const handleNewOrder = (order: OrderWithItems) => { // Corrected casing
      console.log("📦 New order received for seller:", order); // Corrected casing

      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] }); // Corrected casing

      toast({
        title: "🔔 New Order!", // Corrected casing
        description: `You received a new order for order #${order.id}.`, // Corrected casing
        duration: 5000,
      });
    };

    const handleOrderUpdate = (order: OrderWithItems) => { // Corrected casing
      console.log("🚚 Order update received for seller:", order); // Corrected casing
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] }); // Corrected casing

      if (order.deliveryBoy && order.status !== 'pending') { // Corrected casing
        toast({
          title: "✅ Delivery Assigned!", // Corrected casing
          description: `Order #${order.id} assigned to delivery boy ${order.deliveryBoy.name}.`, // Corrected casing
          duration: 8000,
        });
      }
    };

    socket.on("new-order-for-seller", handleNewOrder); // Corrected casing
    socket.on("order-updated-for-seller", handleOrderUpdate); // Corrected casing
    return () => {
      socket.off("new-order-for-seller", handleNewOrder); // Corrected casing
      socket.off("order-updated-for-seller", handleOrderUpdate); // Corrected casing
    };
  }, [socket, isConnected, isAuthenticated, user, toast, queryClient]); // Corrected casing

  // ----------------- fetch seller profile -----------------
  const {
    data: seller,
    isLoading: sellerLoading, // Corrected casing
    error: sellerError, // Corrected casing
  } = useQuery<Seller>({ // Corrected casing
    queryKey: ["/api/sellers/me"], // Corrected casing
    queryFn: () => apiRequest("GET", "/api/sellers/me", null, user?.idToken), // GET method, pass null for body, pass idToken
    staleTime: 5 * 60 * 1000, // Corrected casing
    enabled: isAuthenticated && user?.role === "seller", // Corrected casing
  });

  // ----------------- fetch seller orders -----------------
  const {
    data: orders,
    isLoading: ordersLoading, // Corrected casing
    error: ordersError, // Corrected casing
  } = useQuery<OrderWithItems[]>({ // Corrected casing
    queryKey: ["/api/sellers/orders"], // Corrected casing
    queryFn: () => apiRequest("GET", "/api/sellers/orders", null, user?.idToken), // GET method, pass null for body, pass idToken
    enabled: !!seller?._id, // Corrected to _id for MongoDB, Corrected casing
    staleTime: 0, // Corrected casing
    refetchInterval: 60 * 1000, // Corrected casing
  });

  // ----------------- metrics -----------------
  const totalRevenue = // Corrected casing
    orders?.reduce(
      (sum, order) =>
        sum +
        order.items.reduce(
          (itemSum, item) => // Corrected casing
            itemSum +
            (typeof item.total === "string"
              ? parseFloat(item.total) // Corrected casing
              : item.total),
          0
        ),
      0
    ) || 0;

  const totalOrders = orders?.length || 0; // Corrected casing
  const totalProducts = 0; // this could be dynamic from productmanager // Corrected casing
  const averageRating = parseFloat(seller?.rating?.toString() || "0"); // Corrected casing

  // ----------------- loading -----------------
  if (sellerLoading) { // Corrected casing
    return (
      <div className="min-h-screen bg-background"> {/* Corrected casing */}
        <Header /> {/* Corrected casing */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"> {/* Corrected casing */}
          <div className="animate-pulse space-y-6"> {/* Corrected casing */}
            <Skeleton className="h-8 w-64 mb-6" /> {/* Corrected casing */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6"> {/* Corrected casing */}
              {[...Array(4)].map((_, i) => ( // Corrected casing
                <Skeleton key={i} className="h-32 rounded-xl" /> // Corrected casing
              ))}
            </div>
            <Skeleton className="h-10 w-full mb-4 rounded-md" /> {/* Corrected casing */}
            <Skeleton className="h-96 w-full rounded-xl" /> {/* Corrected casing */}
          </div>
        </div>
      </div>
    );
  }

  // ----------------- error -----------------
  if (sellerError || !seller) { // Corrected casing
    return (
      <div className="min-h-screen bg-background"> {/* Corrected casing */}
        <Header /> {/* Corrected casing */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center"> {/* Corrected casing */}
          <div className="text-6xl mb-4"> {/* Corrected casing */}
            {sellerError ? ( // Corrected casing
              <XCircle className="w-20 h-20 text-red-500 mx-auto" /> // Corrected casing
            ) : (
              "🏪"
            )}
          </div>
          <h2 className="text-2xl font-bold mb-4"> {/* Corrected casing */}
            {sellerError ? "Error loading profile" : "Seller profile not found"} {/* Corrected casing */}
          </h2>
          <p className="text-muted-foreground mb-6"> {/* Corrected casing */}
            {sellerError // Corrected casing
              ? "There was an issue fetching your seller profile. Please try again." // Corrected casing
              : "It looks like you haven't set up your seller profile yet or it's not approved."} {/* Corrected casing */}
          </p>
          <Link to="/seller-apply"> {/* Corrected casing */}
            <Button> {/* Corrected casing */}
              {sellerError ? "Retry" : "Apply to be a seller"} {/* Corrected casing */}
            </Button>
          </Link>
          <Link to="/"> {/* Corrected casing */}
            <Button variant="ghost" className="ml-4"> {/* Corrected casing */}
              Go back home {/* Corrected casing */}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ----------------- dashboard -----------------
  return (
    <div className="min-h-screen bg-background"> {/* Corrected casing */}
      <Header /> {/* Corrected casing */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"> {/* Corrected casing */}
        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8"> {/* Corrected casing */}
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2"> {/* Corrected casing */}
              Seller Dashboard {/* Corrected casing */}
            </h1>
            <p className="text-muted-foreground"> {/* Corrected casing */}
              Manage your products and orders {/* Corrected casing */}
            </p>
          </div>
          <div className="flex items-center space-x-4 mt-4 sm:mt-0"> {/* Corrected casing */}
            {seller.approvalStatus === "approved" ? ( // Corrected casing
              <Badge variant="default" className="bg-green-600"> {/* Corrected casing */}
                <CheckCircle className="h-3 w-3 mr-1" /> {/* Corrected casing */}
                Verified Seller {/* Corrected casing */}
              </Badge>
            ) : seller.approvalStatus === "pending" ? ( // Corrected casing
              <Badge variant="secondary"> {/* Corrected casing */}
                <Clock className="h-3 w-3 mr-1" /> {/* Corrected casing */}
                Pending Verification {/* Corrected casing */}
              </Badge>
            ) : (
              <Badge variant="destructive"> {/* Corrected casing */}
                <XCircle className="h-3 w-3 mr-1" /> {/* Corrected casing */}
                Rejected ({seller.rejectionReason || "No reason specified"}) {/* Corrected casing */}
              </Badge>
            )}
          </div>
        </div>

        {/* metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"> {/* Corrected casing */}
          <Card> {/* Corrected casing */}
            <CardContent className="p-6 flex items-center"> {/* Corrected casing */}
              <TrendingUp className="h-8 w-8 text-primary" /> {/* Corrected casing */}
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground"> {/* Corrected casing */}
                  Total Revenue {/* Corrected casing */}
                </p>
                <p className="text-2xl font-bold"> {/* Corrected casing */}
                  ₹{totalRevenue.toLocaleString()} {/* Corrected casing */}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card> {/* Corrected casing */}
            <CardContent className="p-6 flex items-center"> {/* Corrected casing */}
              <ShoppingCart className="h-8 w-8 text-secondary" /> {/* Corrected casing */}
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground"> {/* Corrected casing */}
                  Total Orders {/* Corrected casing */}
                </p>
                <p className="text-2xl font-bold">{totalOrders}</p> {/* Corrected casing */}
              </div>
            </CardContent>
          </Card>
          <Card> {/* Corrected casing */}
            <CardContent className="p-6 flex items-center"> {/* Corrected casing */}
              <Package className="h-8 w-8 text-yellow-600" /> {/* Corrected casing */}
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground"> {/* Corrected casing */}
                  Products {/* Corrected casing */}
                </p>
                <p className="text-2xl font-bold">{totalProducts}</p> {/* Corrected casing */}
              </div>
            </CardContent>
          </Card>
          <Card> {/* Corrected casing */}
            <CardContent className="p-6 flex items-center"> {/* Corrected casing */}
              <Star className="h-8 w-8 text-yellow-500" /> {/* Corrected casing */}
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground"> {/* Corrected casing */}
                  Rating {/* Corrected casing */}
                </p>
                <p className="text-2xl font-bold"> {/* Corrected casing */}
                  {averageRating.toFixed(1)} {/* Corrected casing */}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* tabs */}
        <Tabs
          defaultValue="products" // Corrected casing
          value={activeTab} // Corrected casing
          onValueChange={setActiveTab} // Corrected casing
          className="space-y-4" // Corrected casing
        >
          <TabsList> {/* Corrected casing */}
            <TabsTrigger value="products"> {/* Corrected casing */}
              <Package className="h-4 w-4 mr-2" /> Products {/* Corrected casing */}
            </TabsTrigger>
            <TabsTrigger value="orders"> {/* Corrected casing */}
              <ShoppingCart className="h-4 w-4 mr-2" /> Orders {/* Corrected casing */}
            </TabsTrigger>
            <TabsTrigger value="profile"> {/* Corrected casing */}
              <Settings className="h-4 w-4 mr-2" /> Profile {/* Corrected casing */}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products"> {/* Corrected casing */}
            <ProductManager seller={seller} /> {/* Corrected casing */}
          </TabsContent>

          <TabsContent value="orders"> {/* Corrected casing */}
            <OrderManager // Corrected casing
              seller={seller}
              orders={orders}
              isLoading={ordersLoading} // Corrected casing
              error={ordersError} // Corrected casing
            />
          </TabsContent>

          <TabsContent value="profile"> {/* Corrected casing */}
            {/* 👈 यहाँ बदलाव: ProfileManager की जगह SellerProfileEdit का उपयोग करें */}
            <SellerProfileEdit />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
 }
