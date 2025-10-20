// client/src/pages/customerorderspage.tsx
import React, { useEffect } from "react"; // ✅ React import जोड़ा गया
import { useQuery, useQueryClient } from "@tanstack/react-query"; // ✅ tanstack/react-query से import
import { apiRequest } from "../lib/queryclient"; // ✅ /lib/queryclient से सापेक्ष पथ
import { Link } from "react-router-dom"; // ✅ Link capitalized
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"; // ✅ सापेक्ष पथ
import { Button } from "../components/ui/button"; // ✅ सापेक्ष पथ
import { Badge } from "../components/ui/badge"; // ✅ सापेक्ष पथ
import { Skeleton } from "../components/ui/skeleton"; // ✅ सापेक्ष पथ
import { Package } from "lucide-react"; // ✅ Package capitalized
import { useSocket } from "../hooks/useSocket"; // ✅ सापेक्ष पथ और useSocket capitalized

// api से आने वाले ऑर्डर डेटा का इंटरफ़ेस
// ✅ updated for multi-seller structure
export interface SubOrderItem {
  id: number;
  quantity: number;
  product?: {
    id: number;
    name: string;
    image?: string;
    unit?: string;
  };
}

export interface SubOrder {
  id: number;
  sellerId: number;
  sellerName?: string; // विक्रेता का नाम
  sellerBusinessName?: string; // विक्रेता का व्यावसायिक नाम
  status: string; // इस विक्रेता के हिस्से का स्टेटस
  deliveryStatus: string; // इस विक्रेता के हिस्से का डिलीवरी स्टेटस
  total: string | number; // इस विक्रेता के हिस्से का कुल
  items: SubOrderItem[]; // इस विक्रेता के आइटम
}

export interface CustomerOrder { // ✅ CustomerOrder capitalized
  id: number;
  orderNumber: string; // ✅ orderNumber capitalized
  status: string; // मुख्य ऑर्डर का स्टेटस
  deliveryStatus: string; // मुख्य ऑर्डर का डिलीवरी स्टेटस
  total: string | number;
  createdAt: string; // ✅ createdAt capitalized
  subOrders?: SubOrder[]; // ✅ subOrders जोड़ा गया
}

// स्टेटस के लिए बैज वेरिएंट
const statusBadgeVariants = { // ✅ statusBadgeVariants capitalized
  pending: "secondary",
  accepted: "info",
  preparing: "secondary",
  ready_for_pickup: "secondary",
  picked_up: "info",
  out_for_delivery: "info",
  delivered: "success",
  cancelled: "destructive",
  rejected: "destructive",
  default: "secondary",
};

const getStatusBadgeVariant = (status: string) => { // ✅ getStatusBadgeVariant capitalized
  return statusBadgeVariants[status.toLowerCase() as keyof typeof statusBadgeVariants] || statusBadgeVariants.default; // ✅ status.toLowerCase() जोड़ा गया
};

// स्टेटस का टेक्स्ट
const getStatusText = (status: string) => { // ✅ getStatusText capitalized
  switch (status.toLowerCase()) { // ✅ status.toLowerCase() जोड़ा गया
    case "pending": return "लंबित";
    case "accepted": return "स्वीकृत";
    case "preparing": return "तैयार हो रहा है";
    case "ready_for_pickup": return "पिकअप के लिए तैयार";
    case "picked_up": return "पिकअप हो गया";
    case "out_for_delivery": return "रास्ते में है";
    case "delivered": return "डिलीवर हो गया";
    case "cancelled": return "रद्द कर दिया गया";
    case "rejected": return "अस्वीकृत";
    default: return "अज्ञात";
  }
};

export default function CustomerOrdersPage() { // ✅ CustomerOrdersPage capitalized
  const queryClient = useQueryClient(); // ✅ queryClient capitalized
  const { socket } = useSocket(); // ✅ useSocket capitalized

  const { data: orders, isLoading, isError, error } = useQuery<CustomerOrder[]>({ // ✅ isLoading, isError capitalized
    queryKey: ["customerorders"], // ✅ queryKey capitalized
    queryFn: async () => {
      // ✅ सुनिश्चित करें कि यह API मल्टी-सेलर स्ट्रक्चर में डेटा वापस करता है
      const response = await apiRequest("get", "/api/customer/orders"); // ✅ apiRequest capitalized, endpoint updated if needed
      return response as CustomerOrder[];
    },
  });

  // socket.io से ऑर्डर अपडेट्स सुनें
  useEffect(() => { // ✅ useEffect capitalized
    if (!socket || typeof socket.on !== "function") return;

    const onOrderStatusUpdated = (updatedOrder: CustomerOrder) => { // ✅ onOrderStatusUpdated capitalized
      console.log("📦 order update received:", updatedOrder);
      queryClient.invalidateQueries({ queryKey: ["customerorders"] }); // ✅ queryKey capitalized
    };

    socket.on("order:status-updated", onOrderStatusUpdated); // ✅ onOrderStatusUpdated capitalized

    return () => {
      if (socket && typeof socket.off === "function") {
        socket.off("order:status-updated", onOrderStatusUpdated); // ✅ onOrderStatusUpdated capitalized
      }
    };
  }, [socket, queryClient]); // ✅ queryClient capitalized

  // लोडिंग
  if (isLoading) { // ✅ isLoading capitalized
    return (
      <div className="container mx-auto p-4"> {/* ✅ className capitalized */}
        <h1 className="text-2xl font-bold mb-6">आपके ऑर्डर</h1> {/* ✅ className capitalized */}
        <div className="space-y-4"> {/* ✅ className capitalized */}
          {[...Array(3)].map((_, i) => ( {/* ✅ Array capitalized */}
            <Skeleton key={i} className="h-24 w-full rounded-lg" /> {/* ✅ Skeleton, className capitalized */}
          ))}
        </div>
      </div>
    );
  }

  // एरर
  if (isError) { // ✅ isError capitalized
    return (
      <div className="container mx-auto p-4 text-center"> {/* ✅ className capitalized */}
        <p className="text-red-500"> {/* ✅ className capitalized */}
          ऑर्डर लोड करने में त्रुटि: {(error as Error).message} {/* ✅ Error capitalized */}
        </p>
        <Button onClick={() => window.location.reload()} className="mt-4"> {/* ✅ Button, className capitalized */}
          पुनः प्रयास करें
        </Button>
      </div>
    );
  }

  // कोई ऑर्डर नहीं है
  if (!orders || orders.length === 0) {
    return (
      <div className="container mx-auto p-4 text-center"> {/* ✅ className capitalized */}
        <Package className="mx-auto h-16 w-16 text-gray-400 mb-4" /> {/* ✅ Package, className capitalized */}
        <h2 className="text-xl font-semibold mb-2">कोई ऑर्डर नहीं मिला</h2> {/* ✅ className capitalized */}
        <p className="text-gray-600"> {/* ✅ className capitalized */}
          आपने अभी तक कोई ऑर्डर नहीं दिया है। अभी खरीदारी शुरू करें!
        </p>
        <Button asChild className="mt-4"> {/* ✅ Button, asChild, className capitalized */}
          <Link to="/">खरीदारी करें</Link> {/* ✅ Link capitalized */}
        </Button>
      </div>
    );
  }

  // ऑर्डर लिस्ट दिखाएँ
  return (
    <div className="container mx-auto p-4"> {/* ✅ className capitalized */}
      <h1 className="text-2xl font-bold mb-6">आपके ऑर्डर्स</h1> {/* ✅ className capitalized */}
      <div className="space-y-4"> {/* ✅ className capitalized */}
        {orders.map((order: CustomerOrder) => (
          <Card key={order.id} className="p-4"> {/* ✅ Card, className capitalized */}
            <CardHeader className="p-0 mb-4"> {/* ✅ CardHeader, className capitalized */}
              <CardTitle className="flex justify-between items-center text-lg"> {/* ✅ CardTitle, className capitalized */}
                <span>ऑर्डर #{order.orderNumber}</span> {/* ✅ orderNumber capitalized */}
                <Badge variant={getStatusBadgeVariant(order.status)}> {/* ✅ getStatusBadgeVariant capitalized */}
                  {getStatusText(order.status)} {/* ✅ getStatusText capitalized */}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0"> {/* ✅ CardContent, className capitalized */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground"> {/* ✅ className capitalized */}
                <div>
                  <p>
                    <span className="font-medium text-gray-800">तारीख:</span>{" "} {/* ✅ className capitalized */}
                    {new Date(order.createdAt).toLocaleDateString()} {/* ✅ Date, createdAt capitalized */}
                  </p>
                </div>
                <div>
                  <p>
                    <span className="font-medium text-gray-800">कुल:</span> ₹ {/* ✅ className capitalized */}
                    {Number(order.total).toLocaleString('en-IN')} {/* ✅ Number capitalized, toLocaleString for currency format */}
                  </p>
                </div>
                <div>
                  <p>
                    <span className="font-medium text-gray-800">स्थिति:</span>{" "} {/* ✅ className capitalized */}
                    {getStatusText(order.status)} {/* ✅ getStatusText capitalized */}
                  </p>
                </div>
              </div>

              {/* ✅ यहाँ से प्रत्येक सब-ऑर्डर (विक्रेता के आधार पर) दिखाएं */}
              {order.subOrders && order.subOrders.length > 0 && (
                <div className="mt-6 border-t pt-4 space-y-4">
                  <h3 className="text-lg font-semibold">विक्रेता के ऑर्डर</h3>
                  {order.subOrders.map((subOrder: SubOrder) => (
                    <Card key={subOrder.id} className="p-3 bg-gray-50 border shadow-sm">
                      <CardHeader className="p-0 mb-2">
                        <CardTitle className="flex justify-between items-center text-md font-semibold">
                          <span>{subOrder.sellerBusinessName || subOrder.sellerName || `विक्रेता #${subOrder.sellerId}`}</span>
                          <Badge variant={getStatusBadgeVariant(subOrder.status)} className="text-xs">
                            {getStatusText(subOrder.status)}
                          </Badge>
                        </CardTitle>
                        <p className="text-sm text-gray-600">कुल: ₹{Number(subOrder.total).toLocaleString('en-IN')}</p>
                      </CardHeader>
                      <CardContent className="p-0 text-sm">
                        {subOrder.items && subOrder.items.length > 0 ? (
                          <div className="space-y-1">
                            {subOrder.items.map(item => (
                              <div key={item.id} className="flex items-center space-x-2">
                                {item.product?.image && (
                                  <img src={item.product.image} alt={item.product.name} className="w-6 h-6 object-cover rounded" />
                                )}
                                <p>{item.product?.name} x {item.quantity} {item.product?.unit}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">कोई आइटम नहीं</p>
                        )}
                         <div className="mt-3 flex space-x-2">
                          <Button asChild variant="outline" size="sm">
                              <Link to={`/order-details/${order.id}?sellerId=${subOrder.sellerId}`}> {/* ✅ विक्रेता-विशिष्ट विवरण लिंक */}
                                विक्रेता का विवरण देखें
                              </Link>
                          </Button>
                          {(subOrder.status === 'picked_up' || subOrder.status === 'out_for_delivery') && (
                            <Button asChild variant="default" className="bg-purple-600 hover:bg-purple-700" size="sm">
                                <Link to={`/track-order/${order.id}?sellerId=${subOrder.sellerId}`}> {/* ✅ विक्रेता-विशिष्ट लाइव ट्रैक */}
                                    live track
                                </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* यदि कोई सब-ऑर्डर नहीं हैं, तो पुराने बटन दिखाएं */}
              {(!order.subOrders || order.subOrders.length === 0) && (
                <div className="mt-4 flex space-x-3">
                  {/* 1. विवरण देखें (details) बटन */}
                  <Button asChild variant="outline">
                    <Link to={`/order-details/${order.id}`}>
                      विवरण देखें
                    </Link>
                  </Button>

                  {/* 2. live track बटन (केवल विशिष्ट स्टेटस के लिए) */}
                  {(order.status === 'picked_up' || order.status === 'out_for_delivery') && (
                      <Button asChild variant="default" className="bg-purple-600 hover:bg-purple-700">
                          <Link to={`/track-order/${order.id}`}>
                              live track
                          </Link>
                      </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
                      }
