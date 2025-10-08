// client/src/pages/Checkout2.tsx
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ShoppingCart, MapPin, CreditCard, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AddressInputWithMap from "@/components/AddressInputWithMap";
// ✅ NOTE: आपको अपने प्रोजेक्ट में इस कंपोनेंट को import करना होगा!
// import AddressInputWithMap from "@/components/forms/AddressInputWithMap"; 

interface SellerInfo {
  id: number;
  businessName: string;
  city: string;
}

interface ProductItem {
  id: number;
  name: string;
  nameHindi: string;
  price: string;
  image: string;
  unit: string;
  brand: string;
  sellerId: number;
  seller?: SellerInfo;
}

interface DeliveryAddress {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
}

export default function Checkout2() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();

  const { id: directBuyProductId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const directBuyQuantity = searchParams.get("quantity") ? parseInt(searchParams.get("quantity")!) : 1;

  const [currentStep, setCurrentStep] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    fullName: "",
    phone: "",
    address: "",
    city: "bundi",
    pincode: "",
    landmark: "",
    
    latitude: 25.4419,  
    longitude:75.6179,
  });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");

  // ✅ Fetch direct buy product
  const { data: productData, isLoading, error } = useQuery<ProductItem>({
    queryKey: ['product', directBuyProductId],
    queryFn: () => apiRequest("GET", `/api/products/${directBuyProductId}`),
    enabled: !!directBuyProductId,
  });

  const subtotal = productData ? parseFloat(productData.price) * directBuyQuantity : 0;
  const deliveryCharge = subtotal >= 500 ? 0 : 25;
  const total = subtotal + deliveryCharge;

  // ----------------------------------------------------------------------------------
  // ✅ NEW: AddressInputWithMap से डेटा प्राप्त करने के लिए हैंडलर
  // ----------------------------------------------------------------------------------
  const handleLocationUpdate = useCallback(
    // 💡 सुनिश्चित करें कि location ऑब्जेक्ट में city और pincode आ रहे हैं
    (address: string, location: { lat: number; lng: number; city: string; pincode: string; }) => {
        setDeliveryAddress(prev => ({
            ...prev,
            address: address, 
            latitude: location.lat,
            longitude: location.lng,
            
            // ✅ Fix: Pincode और City को स्पष्ट रूप से अपडेट करें
            city: location.city, 
            pincode: location.pincode,
        }));
    },
    [setDeliveryAddress] 
);


  // ----------------------------------------------------------------------------------
  // ✅ Order Items को ठीक करें (Buy Now के लिए)
  // ----------------------------------------------------------------------------------
  const itemsToOrder = productData ? [{
    productId: productData.id,
    sellerId: productData.sellerId,
    quantity: directBuyQuantity,
    unitPrice: parseFloat(productData.price),
    totalPrice: parseFloat(productData.price) * directBuyQuantity,
  }] : [];


  // ----------------------------------------------------------------------------------
  // ✅ Order Mutation
  // ----------------------------------------------------------------------------------
  const createOrderMutation = useMutation({
    mutationFn: (orderData: any) => apiRequest("POST", "/api/orders/buy-now", orderData),
    onSuccess: (data) => {
      toast({
        title: "Order Placed Successfully!",
        description: `Order #${data.orderNumber} has been confirmed`,
      });
      navigate(`/order-confirmation/${data.orderId}`);
    },
    onError: (error) => {
      console.error("❌ Order placement failed:", error);
      toast({
        title: "Order Failed",
        description: "Failed to place order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePlaceOrder = () => {
    if (!user || !user.id) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to place an order.",
        variant: "destructive",
      });
      return;
    }

       if (!deliveryAddress.fullName || !deliveryAddress.phone || !deliveryAddress.address || !deliveryAddress.pincode || !deliveryAddress.latitude || !deliveryAddress.longitude) {
      toast({
        title: "Address Required",
        description: "Please fill in all delivery address fields and select a location on the map.",
        variant: "destructive",
      });
      return;
    }

    if (!productData) {
      toast({
        title: "Product Not Found",
        description: "Could not find the product to place an order.",
        variant: "destructive",
      });
      return;
    }

      // ✅ ORDER DATA UPDATE: नए Lat/Lng को orderData में शामिल करें
    const orderData = {
      customerId: user.id,
      deliveryAddress: {
          ...deliveryAddress,
          // Lat/Lng को number के रूप में भेजें
          latitude: deliveryAddress.latitude, 
          longitude: deliveryAddress.longitude
      },
      paymentMethod,
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2),
      deliveryCharge: deliveryCharge.toFixed(2),
      deliveryInstructions,
      items: itemsToOrder,
      cartOrder: false, // क्योंकि यह 'buy-now' ऑर्डर है
    };

    createOrderMutation.mutate(orderData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !productData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h3 className="text-lg font-medium mb-2">Product Not Found</h3>
            <p className="text-gray-600 mb-4">
              The product you're looking for doesn't exist or is not available.
            </p>
            <Link to="/">
              <Button>Go to Home Page</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Steps */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkout</h1>
          <div className="flex space-x-4">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex items-center space-x-2 ${currentStep >= step ? "text-green-600" : "text-gray-400"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentStep > step ? "bg-green-600 text-white" : "bg-gray-200"
                  }`}
                >
                  {currentStep > step ? <Check className="w-4 h-4" /> : step}
                </div>
                <span className="font-medium">
                  {step === 1 ? "Order Review" : step === 2 ? "Delivery Address" : "Payment"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Review */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ShoppingCart className="w-5 h-5" />
                    <span>Review Your Order</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4 py-4 border-b">
                      <img
                        src={productData.image}
                        alt={productData.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h3 className="font-medium">{productData.name}</h3>
                        <p className="text-sm text-gray-600">{productData.nameHindi}</p>
                        <p className="text-sm text-gray-500">{productData.brand} • {productData.unit}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">₹{productData.price} × {directBuyQuantity}</p>
                        <p className="text-sm text-gray-600">
                          ₹{(parseFloat(productData.price) * directBuyQuantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="pt-4">
                      <Button onClick={() => setCurrentStep(2)} className="w-full">
                        Proceed to Delivery Address
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Address */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5" />
                    <span>Delivery Address</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        value={deliveryAddress.fullName}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, fullName: e.target.value })}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={deliveryAddress.phone}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, phone: e.target.value })}
                        placeholder="Enter phone number"
                      />
                    </div>

<div className="md:col-span-2 border p-3 rounded-lg bg-gray-50">
    <Label htmlFor="address">Locate and Verify Address</Label>
     <AddressInputWithMap
        currentAddress={deliveryAddress.address}
        currentLocation={deliveryAddress.latitude && deliveryAddress.longitude 
            ? { lat: deliveryAddress.latitude, lng: deliveryAddress.longitude }
            : null
        }
        onLocationUpdate={handleLocationUpdate}
    />
</div>

{/* *************************************************************** */}
{/* ✅ नया कोड यहाँ जोड़ें: मैप से मिला एड्रेस दिखाने और एडिट करने के लिए */}
{/* *************************************************************** */}

<div className="md:col-span-2">
    <Label htmlFor="address_text">Delivery Address Text</Label>
    <Textarea
        id="address_text"
        value={deliveryAddress.address} // <-- Map से मिला पता यहाँ दिखेगा
        onChange={(e) => setDeliveryAddress({ 
            ...deliveryAddress, 
            address: e.target.value 
        })}
        placeholder="Map से या मैन्युअल रूप से अपना पूरा पता चुनें"
        rows={3}
    />
</div>

{/* *************************************************************** */}
<div>
    <Label htmlFor="city">City</Label>
    <Input
        id="city"
        value={deliveryAddress.city}
        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, city: e.target.value })}
        placeholder="City"
    />
</div>
                    <div>
                      <Label htmlFor="pincode">Pincode</Label>
                      <Input
                        id="pincode"
                        value={deliveryAddress.pincode}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, pincode: e.target.value })}
                        placeholder="Enter pincode"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="landmark">Landmark (Optional)</Label>
                      <Input
                        id="landmark"
                        value={deliveryAddress.landmark}
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, landmark: e.target.value })}
                        placeholder="Nearby landmark"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="instructions">Delivery Instructions</Label>
                      <Textarea
                        id="instructions"
                        value={deliveryInstructions}
                        onChange={(e) => setDeliveryInstructions(e.target.value)}
                        placeholder="Any special instructions for delivery"
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="flex space-x-4 mt-6">
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>Back to Order</Button>
                    <Button onClick={() => setCurrentStep(3)}>Proceed to Payment</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Payment */}
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CreditCard className="w-5 h-5" />
                    <span>Payment Method</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
    {/* ✅ FIX: सभी विकल्पों को इस 'space-y-4' DIV में रैप करें */}
    <div className="space-y-4"> 
        
        {/* पहला विकल्प: COD */}
        <div className="flex items-center space-x-2 p-4 border rounded-lg">
          <RadioGroupItem value="cod" id="cod" />
          <Label htmlFor="cod" className="flex-1 cursor-pointer">
            <div>
              <p className="font-medium">Cash on Delivery (COD)</p>
              <p className="text-sm text-gray-600">Pay when your order arrives</p>
            </div>
          </Label>
        </div>
        
        {/* दूसरा विकल्प: Online */}
        <div className="flex items-center space-x-2 p-4 border rounded-lg opacity-50">
          <RadioGroupItem value="online" id="online" disabled />
          <Label htmlFor="online" className="flex-1 cursor-pointer">
            <div>
              <p className="font-medium">Online Payment</p>
              <p className="text-sm text-gray-600">Pay now using UPI, Card, or Net Banking (Coming Soon)</p>
            </div>
          </Label>
        </div>

    </div> {/* ✅ रैपर DIV यहाँ बंद होता है */}
</RadioGroup>
                  

                  <div className="flex space-x-4 mt-6">
                    <Button variant="outline" onClick={() => setCurrentStep(2)}>Back to Address</Button>
                    <Button
                      onClick={handlePlaceOrder}
                      disabled={createOrderMutation.isPending}
                      className="flex-1"
                    >
                      {createOrderMutation.isPending ? "Placing Order..." : `Place Order - ₹${total.toFixed(2)}`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Subtotal ({directBuyQuantity} item{directBuyQuantity > 1 ? "s" : ""})</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Charges</span>
                    <span>{deliveryCharge === 0 ? "FREE" : `₹${deliveryCharge}`}</span>
                  </div>
                  {deliveryCharge === 0 && (
                    <p className="text-sm text-green-600">Free delivery on orders above ₹500</p>
                  )}
                  <hr />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Estimated delivery: Within 1 hour</p>
                    <p>
                      From:{" "}
                      {productData.seller?.businessName
                        ? `${productData.seller.businessName}, ${productData.seller.city}`
                        : "Our Partner Store"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 

