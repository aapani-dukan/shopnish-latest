import Header from "@/components/header"; // ✅ Corrected path and casing
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Seller, OrderWithItems } from "shared/backend/schema"; // ✅ Corrected casing
import { apiRequest } from "@/lib/queryclient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Star,
  Clock,
  CheckCircle,
  Settings,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/usesocket";
import { useAuth } from "@/hooks/useauth";
import ProductManager from "@/components/productmanager"; // ✅ Corrected casing
import OrderManager from "@/components/ordermanager"; // ✅ Corrected casing
import ProfileManager from "@/components/profilemanager"; // ✅ Corrected casing

export default function SellerDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("products"); // ✅ Corrected casing

  const { socket, isConnected } = useSocket(); // ✅ Corrected casing
  const { user, isAuthenticated } = useAuth(); // ✅ Corrected casing

  // ----------------- socket.io logic -----------------
  useEffect(() => {
    if (!socket || !isConnected || !isAuthenticated || user?.role !== "seller")
      return;

    const handleNewOrder = (order: OrderWithItems) => { // ✅ Corrected casing
      console.log("📦 नया ऑर्डर विक्रेता को मिला:", order);

      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] }); // ✅ Corrected casing

      toast({
        title: "🔔 नया ऑर्डर!",
        description: `आपको ऑर्डर #${order.id} के लिए नया ऑर्डर मिला।`,
        duration: 5000,
      });
    };

    const handleOrderUpdate = (order: OrderWithItems) => { // ✅ Corrected casing
      console.log("🚚 ऑर्डर अपडेट विक्रेता को मिला:", order);
      // ✅ Invalidate queries to refetch updated order data
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/orders"] });

      if (order.deliveryBoy && order.status !== 'pending') { // ✅ Corrected casing
        toast({
          title: "✅ डिलीवरी असाइन!",
          description: `ऑर्डर #${order.id} डिलीवरी बॉय ${order.deliveryBoy.name} को असाइन किया गया।`, // ✅ Corrected casing
          duration: 8000,
        });
      }
    };

    socket.on("new-order-for-seller", handleNewOrder); // ✅ Corrected casing
    socket.on("order-updated-for-seller", handleOrderUpdate); // ✅ Corrected casing
    return () => {
      socket.off("new-order-for-seller", handleNewOrder); // ✅ Corrected casing
      socket.off("order-updated-for-seller", handleOrderUpdate); // ✅ Corrected casing
    };
  }, [socket, isConnected, isAuthenticated, user, toast, queryClient]); // ✅ Corrected casing

  // ----------------- fetch seller profile -----------------
  const {
    data: seller,
    isLoading: sellerLoading, // ✅ Corrected casing
    error: sellerError, // ✅ Corrected casing
  } = useQuery<Seller>({ // ✅ Corrected casing
    queryKey: ["/api/sellers/me"],
    queryFn: () => apiRequest("get", "/api/sellers/me"),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated && user?.role === "seller", // ✅ Only fetch if authenticated as seller
  });

  // ----------------- fetch seller orders -----------------
  const {
    data: orders,
    isLoading: ordersLoading, // ✅ Corrected casing
    error: ordersError, // ✅ Corrected casing
  } = useQuery<OrderWithItems[]>({ // ✅ Corrected casing
    queryKey: ["/api/sellers/orders"],
    queryFn: () => apiRequest("get", "/api/sellers/orders"),
    enabled: !!seller?.id, // Only fetch orders if seller profile is loaded
    staleTime: 0,
    refetchInterval: 60 * 1000,
  });

  // ----------------- metrics -----------------
  const totalRevenue = // ✅ Corrected casing
    orders?.reduce(
      (sum, order) =>
        sum +
        order.items.reduce(
          (itemSum, item) => // ✅ Corrected casing
            itemSum +
            (typeof item.total === "string"
              ? parseFloat(item.total) // ✅ Corrected parseFloat casing
              : item.total),
          0
        ),
      0
    ) || 0;

  const totalOrders = orders?.length || 0; // ✅ Corrected casing
  const totalProducts = 0; // productManager से dynamic हो सकता है // ✅ Corrected casing
  const averageRating = parseFloat(seller?.rating?.toString() || "0"); // ✅ Corrected casing

  // ----------------- loading -----------------
  if (sellerLoading) { // ✅ Corrected casing
    return (
      <div className="min-h-screen bg-background"> 
        <Header /> {/* ✅ Corrected casing */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"> 
          <div className="animate-pulse space-y-6"> 
            <Skeleton className="h-8 w-64 mb-6" /> 
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6"> 
              {[...Array(4)].map((_, i) => ( // ✅ Corrected Array casing
                <Skeleton key={i} className="h-32 rounded-xl" /> 
              ))}
            </div>
            <Skeleton className="h-10 w-full mb-4 rounded-md" /> 
            <Skeleton className="h-96 w-full rounded-xl" /> 
          </div>
        </div>
      </div>
    );
  }

  // ----------------- error -----------------
  if (sellerError || !seller) { // ✅ Corrected casing
    return (
      <div className="min-h-screen bg-background"> 
        <Header /> 
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center"> 
          <div className="text-6xl mb-4"> 
            {sellerError ? ( // ✅ Corrected casing
              <XCircle className="w-20 h-20 text-red-500 mx-auto" /> 
            ) : (
              "🏪"
            )}
          </div>
          <h2 className="text-2xl font-bold mb-4"> 
            {sellerError ? "Error Loading Profile" : "Seller Profile Not Found"} 
          </h2>
          <p className="text-muted-foreground mb-6"> 
            {sellerError // ✅ Corrected casing
              ? "There was an issue fetching your seller profile. Please try again." // ✅ Consistent casing
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
      </div>
    );
  }

  // ----------------- dashboard -----------------
  return (
    <div className="min-h-screen bg-background"> 
      <Header /> 

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"> 
        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2"> 
              Seller Dashboard 
            </h1>
            <p className="text-muted-foreground"> 
              Manage your products and orders
            </p>
          </div>
          <div className="flex items-center space-x-4 mt-4 sm:mt-0"> 
            {seller.approvalStatus === "approved" ? ( // ✅ Corrected casing
              <Badge variant="default" className="bg-green-600"> 
                <CheckCircle className="h-3 w-3 mr-1" /> 
                Verified Seller 
              </Badge>
            ) : seller.approvalStatus === "pending" ? ( // ✅ Corrected casing
              <Badge variant="secondary"> 
                <Clock className="h-3 w-3 mr-1" /> 
                Pending Verification 
              </Badge>
            ) : (
              <Badge variant="destructive"> 
                <XCircle className="h-3 w-3 mr-1" /> 
                Rejected ({seller.rejectionReason || "No reason specified"}) 
              </Badge>
            )}
          </div>
        </div>

        {/* metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"> 
          <Card> {/* ✅ Corrected casing */}
            <CardContent className="p-6 flex items-center"> 
              <TrendingUp className="h-8 w-8 text-primary" /> 
              <div className="ml-4"> {
                <p className="text-sm font-medium text-muted-foreground"> 
                  Total Revenue 
                </p>
                <p className="text-2xl font-bold"> 
                  ₹{totalRevenue.toLocaleString()} 
                </p>
              </div>
            </CardContent>
          </Card>
          <Card> 
            <CardContent className="p-6 flex items-center"> 
              <ShoppingCart className="h-8 w-8 text-secondary" /> 
              <div className="ml-4"> 
                <p className="text-sm font-medium text-muted-foreground"> 
                  Total Orders 
                </p>
                <p className="text-2xl font-bold">{totalOrders}</p> 
              </div>
            </CardContent>
          </Card>
          <Card> 
            <CardContent className="p-6 flex items-center"> 
              <Package className="h-8 w-8 text-yellow-600" /> 
              <div className="ml-4"> 
                <p className="text-sm font-medium text-muted-foreground"> 
                  Products 
                </p>
                <p className="text-2xl font-bold">{totalProducts}</p> 
              </div>
            </CardContent>
          </Card>
          <Card> 
            <CardContent className="p-6 flex items-center"> 
              <Star className="h-8 w-8 text-yellow-500" /> 
              <div className="ml-4"> 
                <p className="text-sm font-medium text-muted-foreground"> 
                  Rating 
                </p>
                <p className="text-2xl font-bold"> 
                  {averageRating.toFixed(1)} 
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* tabs */}
        <Tabs
          defaultValue="products"
          value={activeTab} // ✅ Corrected casing
          onValueChange={setActiveTab} // ✅ Corrected casing
          className="space-y-4" // ✅ Corrected className
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
            <OrderManager // ✅ Corrected casing
              seller={seller}
              orders={orders}
              isLoading={ordersLoading} // ✅ Corrected casing
              error={ordersError} // ✅ Corrected casing
            />
          </TabsContent>

          <TabsContent value="profile"> 
            <ProfileManager seller={seller} /> 
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
          }
              
