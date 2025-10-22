import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  RotateCcw,
  Receipt,
  // ✅ added custom user auth hook
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient"; // Assuming apiRequest is available

// ✅ Updated DeliveryAddress interface
interface DeliveryAddress {
  id: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

// ✅ Updated OrderItem interface
interface OrderItem {
  id: number;
  quantity: number;
  unitPrice: number; // ✅ Changed to number
  totalPrice: number; // ✅ Changed to number
  product: {
    id: number;
    name: string;
    nameHindi: string; // ✅ Corrected to camelCase
    image: string;
    unit: string;
  };
}

// ✅ Updated Order interface
interface Order {
  id: number;
  orderNumber: string; // ✅ Corrected to camelCase
  status: string;
  paymentMethod: string; // ✅ Corrected to camelCase
  paymentStatus: string; // ✅ Corrected to camelCase
  total: number; // ✅ Changed to number
  deliveryAddress: DeliveryAddress; // ✅ Using updated interface
  createdAt: string; // ✅ Corrected to camelCase
  estimatedDeliveryTime: string; // ✅ Corrected to camelCase
  deliveredAt?: string; // ✅ Added deliveredAt field, optional
}

export default function OrderHistory() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth(); // ✅ Get user and isAuthenticated from useAuth

  // ✅ Dynamically get customerId from authenticated user
  const customerId = user?.id;

  const { data: orders = [], isLoading } = useQuery<Order[]>({ // ✅ Corrected casing
    queryKey: ["/api/orders", customerId], // ✅ Include customerId in queryKey
    queryFn: async () => {
      if (!isAuthenticated || !customerId) {
        // If not authenticated or customerId is missing, return an empty array
        // or throw an error depending on desired behavior.
        // For now, let's return an empty array to prevent unnecessary API calls.
        return [];
      }
      return apiRequest("get", `/api/orders?customerId=${customerId}`); // ✅ Use apiRequest with customerId
    },
    enabled: isAuthenticated && !!customerId, // ✅ Only run query if authenticated and customerId exists
  });

  const getStatusIcon = (status: string) => { // ✅ Corrected casing
    switch (status) {
      case 'placed':
      case 'confirmed':
        return <Clock className="w-4 h-4" />;
      case 'preparing':
      case 'ready':
        return <Package className="w-4 h-4" />;
      case 'out_for_delivery':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => { // ✅ Corrected casing
    switch (status) {
      case 'placed':
      case 'confirmed':
        return 'bg-blue-500';
      case 'preparing':
      case 'ready':
        return 'bg-yellow-500';
      case 'out_for_delivery':
        return 'bg-purple-500';
      case 'delivered':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => { // ✅ Corrected casing
    switch (status) {
      case 'placed': return 'Order Placed'; // ✅ Consistent casing
      case 'confirmed': return 'Confirmed';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const canRequestReturn = (order: Order) => { // ✅ Corrected casing
    // ✅ fix: deliveredAt के आधार पर रिटर्न की अनुमति दें
    if (order.status !== 'delivered' || !order.deliveredAt) return false; // ✅ Corrected casing
    const deliveredDate = new Date(order.deliveredAt); // ✅ Corrected casing
    const now = new Date();
    const hoursDiff = Math.abs(now.getTime() - deliveredDate.getTime()) / 36e5; // ✅ Corrected casing
    return hoursDiff <= 24; // Return allowed within 24 hours of delivery
  };

  const formatDate = (dateString: string) => { // ✅ Corrected casing
    return new Date(dateString).toLocaleString('en-IN', { // ✅ Corrected casing
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAuthenticated) { // ✅ Handle non-authenticated user
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <Card>
            <CardContent className="py-12">
              <h2 className="text-2xl font-bold mb-4">Please Log In</h2>
              <p className="text-gray-600 mb-6">You need to be logged in to view your order history.</p>
              <Button onClick={() => navigate('/login')}>Go to Login</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) { // ✅ Corrected casing
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">

        {/* header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order History</h1> {/* ✅ Consistent casing */}
          <p className="text-gray-600">Track and manage all your orders</p>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Orders Yet</h3> 
              <p className="text-gray-600 mb-6">Start shopping to see your orders here</p>
              <Button onClick={() => navigate("/")}>
                Start Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardHeader className="bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Order #{order.orderNumber}</CardTitle> 
                      <p className="text-sm text-gray-600 mt-1">
                        Placed on {formatDate(order.createdAt)} 
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={`${getStatusColor(order.status)} text-white mb-2`}> 
                        {getStatusIcon(order.status)} 
                        <span className="ml-1">{getStatusText(order.status)}</span>
                      </Badge>
                      <p className="text-lg font-bold">₹{order.total.toFixed(2)}</p> 
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  {/* order items */}
                  <div className="space-y-4 mb-6">
                    <h4 className="font-medium text-gray-900">Order Items</h4> 
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center space-x-4">
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <h5 className="font-medium">{item.product.name}</h5>
                          <p className="text-sm text-gray-600">{item.product.nameHindi}</p> 
                          <p className="text-sm text-gray-500">
                            ₹{item.unitPrice.toFixed(2)} × {item.quantity} {item.product.unit} 
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">₹{item.totalPrice.toFixed(2)}</p> 
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* order summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Payment Method</p> 
                      <p className="font-medium">
                        {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'} 
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Payment Status</p> 
                      <Badge variant={order.paymentStatus === 'paid' ? 'default' : 'secondary'}> 
                        {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)} 
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Delivery Address</p> 
                      <p className="font-medium text-sm">
                        {order.deliveryAddress.address}, {order.deliveryAddress.city} 
                      </p>
                    </div>
                  </div>

                  {/* action buttons */}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/track-order/${order.id}`)}
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Track Order 
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => navigate(`/order-confirmation/${order.id}`)}
                    >
                      <Receipt className="w-4 h-4 mr-2" />
                      View Details 
                    </Button>

                    {canRequestReturn(order) && ( // ✅ Corrected casing
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/return-request/${order.id}`)}
                        className="text-orange-600 border-orange-600 hover:bg-orange-50"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Request Return 
                      </Button>
                    )}

                    {order.status === 'delivered' && (
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/product/${order.items[0].product.id}#reviews`)}
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                      >
                        Write Review 
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
