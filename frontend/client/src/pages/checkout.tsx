// client/src/pages/Checkout.tsx

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ShoppingCart, MapPin, CreditCard, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; 
import AddressInputWithMap from "@/components/AddressInputWithMap"; 

interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    nameHindi: string;
    price: string;
    image: string;
    unit: string;
    brand: string;
    sellerId: number;   
  };
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

// 💡 api object is assumed to be defined elsewhere or should be imported correctly
const api = {
    post: async (endpoint: string, data: any) => {
        return apiRequest("POST", endpoint, data);
    }
};

export default function Checkout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  

const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
  fullName: user?.firstName || "", // अगर user data उपलब्ध है तो उपयोग करें
  phone: user?.phone || "",
  address: "",
  city: "Bundi", 
  pincode: "",
  landmark: "",
  
  latitude: 25.4326, 
  longitude: 75.6450,
});


  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");

  // ✅ Fetch cart items
  const { data, isLoading } = useQuery({
    queryKey: ["/api/cart"],
    queryFn: async () => await apiRequest("GET", "/api/cart"),
    enabled: isAuthenticated, // केवल authenticated user के लिए fetch
  });

  const cartItems: CartItem[] = data?.items || [];

  const subtotal = cartItems.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0
  );
  const deliveryCharge = subtotal >= 500 ? 0 : 25;
  const total = subtotal + deliveryCharge;

  // ✅ Create order mutation


const createOrderMutation = useMutation({
  mutationFn: (orderData: any) => api.post("/api/orders", orderData),
  
  onSuccess: (data) => {
    toast({
      title: "Order placed successfully!",
      description: "Your cart has been emptied.",
    });
    

    // *******************************************************************
    // मैं दोनों को रखने का सुझाव देता हूँ, क्योंकि यह Fast UI (setQueryData)
    // और Data Integrity (invalidateQueries) दोनों सुनिश्चित करता है।
    // *******************************************************************
    
    queryClient.setQueryData(["/api/cart"], { items: [] });
    queryClient.invalidateQueries({ queryKey: ["/api/cart"], refetchType: 'active' }); 
    

    // Navigation Logic
    const orderId = data?.id || data?.orderId || data?.data?.id; 
    
    if (orderId) {
        navigate(`/order-confirmation/${orderId}`);
    } else {
        navigate(`/`); 
    }
  },


    onError: (error) => {
      toast({
        title: "Order Failed",
        description: "Failed to place order. Please try again.",
        variant: "destructive",
      });
    },
  });


// =========================================================================
// ✅ FIX: handleLocationUpdate को कॉम्पोनेंट स्कोप में परिभाषित किया गया
// =========================================================================
const handleLocationUpdate = useCallback(
    // 💡 सुनिश्चित करें कि location ऑब्जेक्ट में city और pincode आ रहे हैं (AddressInputWithMap.tsx में बदलाव के बाद)
    (address: string, location: { lat: number; lng: number; city: string; pincode: string; }) => {
        setDeliveryAddress(prev => ({
            ...prev,
            address: address, 
            latitude: location.lat,
            longitude: location.lng,
            
            // ✅ Fix: Pincode और City को स्टेट में असाइन करें
            city: location.city, 
            pincode: location.pincode,
        }));
    },
    [setDeliveryAddress] 
);
// =========================================================================

const handlePlaceOrder = () => {
  if (!user?.id) {
    toast({
      title: "Authentication Error",
      description: "You must be logged in to place an order.",
      variant: "destructive",
    });
    return;
  }

  // City फ़ील्ड को भी अनिवार्य करें (अगर Bundi के अलावा कुछ और है)
  if (!deliveryAddress.fullName || !deliveryAddress.phone || !deliveryAddress.address || !deliveryAddress.pincode || !deliveryAddress.city || !deliveryAddress.latitude || !deliveryAddress.longitude) {
    toast({
      title: "Address Required",
      description: "Please fill in all delivery address fields and select a location on the map.",
      variant: "destructive",
    });
    return;
  }

  if (!cartItems || cartItems.length === 0) {
    toast({
      title: "No Items to Order",
      description: "There are no items to place an order.",
      variant: "destructive",
    });
    return;
  }

  const itemsToOrder = cartItems.map(item => ({
    id: item.id,
    productId: item.product.id,
    sellerId: item.product.sellerId,
    quantity: item.quantity,
    unitPrice: item.product.price,
    totalPrice: (parseFloat(item.product.price) * item.quantity).toFixed(2),
  }));

  const orderData = {
    customerId: user.id,
    deliveryAddress: {
      ...deliveryAddress,
      // Lat/Lng सुनिश्चित करें कि यह number है
      latitude: deliveryAddress.latitude,
      longitude: deliveryAddress.longitude,
    },
    paymentMethod,
    subtotal: subtotal.toFixed(2),
    total: total.toFixed(2),
    deliveryCharge: deliveryCharge.toFixed(2),
    deliveryInstructions,
    items: itemsToOrder,
    cartOrder: true,
  };

  createOrderMutation.mutate(orderData);
};

  // ------------------- JSX Loading / Empty States -------------------

  if (isLoading) {
    // ... (Loading JSX)
  }

  if (!cartItems || cartItems.length === 0) {
    // ... (Empty Cart JSX)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkout</h1>
          <div className="flex space-x-4">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex items-center space-x-2 ${currentStep >= step ? "text-green-600" : "text-gray-400"}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep > step ? "bg-green-600 text-white" : "bg-gray-200"}`}>
                  {currentStep > step ? <Check className="w-4 h-4" /> : step}
                </div>
                <span className="font-medium">
                  {step === 1 ? "Cart Review" : step === 2 ? "Delivery Address" : "Payment"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {currentStep === 1 && (
              // ... (Step 1 Cart Review JSX)
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ShoppingCart className="w-5 h-5" />
                    <span>Review Your Order</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cartItems.map((item, index) => (
                      <div key={item.id || index} className="flex items-center space-x-4 py-4 border-b">
                        <img src={item.product.image} alt={item.product.name} className="w-16 h-16 object-cover rounded-lg"/>
                        <div className="flex-1">
                          <h3 className="font-medium">{item.product.name}</h3>
                          <p className="text-sm text-gray-600">{item.product.nameHindi}</p>
                          <p className="text-sm text-gray-500">{item.product.brand} • {item.product.unit}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">₹{item.product.price} × {item.quantity}</p>
                          <p className="text-sm text-gray-600">₹{(parseFloat(item.product.price) * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                    <div className="pt-4">
                      <Button onClick={() => setCurrentStep(2)} className="w-full">Proceed to Delivery Address</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                        
                    {/* ✅ NEW: AddressInputWithMap कंपोनेंट */}

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
{/* ✅ मैप से मिला एड्रेस दिखाने और एडिट करने के लिए */}
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
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>Back to Cart</Button>
                    <Button onClick={() => setCurrentStep(3)}>Proceed to Payment</Button>
                  </div>
                </CardContent>
              </Card>
            )}

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

    </div>
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

          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Subtotal ({cartItems.length} items)</span>
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
                    <p>From: Kumar General Store, Jaipur</p>
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
