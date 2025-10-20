// client/src/pages/checkout.tsx

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button"; // Adjusted path
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Adjusted path
import { Input } from "@/components/ui/input"; // Adjusted path
import { Label } from "@/components/ui/label"; // Adjusted path
import { Textarea } from "@/components/ui/textarea"; // Adjusted path
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Adjusted path
import { useToast } from "@/hooks/use-toast"; // Adjusted path
import { apiRequest } from "@/lib/queryclient"; // Adjusted path
import { ShoppingCart, MapPin, CreditCard, Check } from "lucide-react"; // Adjusted path
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useauth"; // Adjusted path
import AddressInputWithMap from "@/components/addressinputwithmap"; // Adjusted path

// ✅ Updated CartItem Interface
interface CartItem {
  id: number;
  productId: number; // ✅ Corrected to camelCase
  quantity: number;
  product: {
    id: number;
    name: string;
    nameHindi: string; // ✅ Corrected to camelCase
    price: number; // ✅ Changed to number for calculations
    image: string;
    unit: string;
    brand: string;
    sellerId: number; // ✅ Corrected to camelCase
  };
}

// ✅ Updated DeliveryAddress Interface
interface DeliveryAddress {
  fullName: string; // ✅ Corrected to camelCase
  phone: string;
  address: string;
  city: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
}

// 💡 api object is no longer needed, using apiRequest directly.
// const api = {
//     post: async (endpoint: string, data: any) => {
//         return apiRequest("post", endpoint, data);
//     }
// };

export default function Checkout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth(); // ✅ Corrected casing

  const [currentStep, setCurrentStep] = useState(1); // ✅ Corrected casing

  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({ // ✅ Corrected casing
    fullName: user?.firstName || "", // ✅ Use user data if available
    phone: user?.phone || "",
    address: "",
    city: "Bundi", // Default city
    pincode: "",
    landmark: "",
    latitude: 25.4326, // Default to Bundi coordinates
    longitude: 75.6450,
  });

  const [paymentMethod, setPaymentMethod] = useState("cod"); // ✅ Corrected casing
  const [deliveryInstructions, setDeliveryInstructions] = useState(""); // ✅ Corrected casing

  // ✅ fetch cart items
  const { data, isLoading } = useQuery({ // ✅ Corrected casing
    queryKey: ["/api/cart"], // ✅ Corrected casing
    queryFn: async () => await apiRequest("get", "/api/cart"), // ✅ Corrected casing
    enabled: isAuthenticated, // ✅ Only fetch for authenticated user
  });

  const cartItems: CartItem[] = data?.items || []; // ✅ Corrected casing

  const subtotal = cartItems.reduce( // ✅ Corrected casing
    (sum, item) => sum + item.product.price * item.quantity, // ✅ Use number type for price
    0
  );
  const deliveryCharge = subtotal >= 500 ? 0 : 25; // ✅ Corrected casing
  const total = subtotal + deliveryCharge;

  // ✅ create order mutation
  const createOrderMutation = useMutation({ // ✅ Corrected casing
    mutationFn: (orderData: any) => apiRequest("post", "/api/orders", orderData), // ✅ Use apiRequest directly

    onSuccess: (data) => { // ✅ Corrected casing
      toast({
        title: "Order Placed Successfully!", // ✅ Consistent casing
        description: "Your cart has been emptied.",
      });

      // *******************************************************************
      // मैं दोनों को रखने का सुझाव देता हूँ, क्योंकि यह fast ui (setQueryData)
      // और data integrity (invalidateQueries) दोनों सुनिश्चित करता है।
      // *******************************************************************

      queryClient.setQueryData(["/api/cart"], { items: [] });
      queryClient.invalidateQueries({ queryKey: ["/api/cart"], refetchType: 'active' });

      // navigation logic
      const orderId = data?.id || data?.orderId || data?.data?.id; // ✅ Corrected casing

      if (orderId) {
        navigate(`/order-confirmation/${orderId}`);
      } else {
        navigate(`/`);
      }
    },

    onError: (error: any) => { // ✅ Explicitly type error
      toast({
        title: "Order Failed", // ✅ Consistent casing
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive",
      });
    },
  });

  // =========================================================================
  // ✅ fix: handleLocationUpdate को कॉम्पोनेंट स्कोप में परिभाषित किया गया
  // =========================================================================
  const handleLocationUpdate = useCallback( // ✅ Corrected casing
    // 💡 सुनिश्चित करें कि location ऑब्जेक्ट में city और pincode आ रहे हैं (addressinputwithmap.tsx में बदलाव के बाद)
    (address: string, location: { lat: number; lng: number; city: string; pincode: string; }) => {
      setDeliveryAddress(prev => ({ // ✅ Corrected casing
        ...prev,
        address: address,
        latitude: location.lat,
        longitude: location.lng,

        // ✅ fix: pincode और city को स्टेट में असाइन करें
        city: location.city,
        pincode: location.pincode,
      }));
    },
    [setDeliveryAddress]
  );
  // =========================================================================

  const handlePlaceOrder = () => { // ✅ Corrected casing
    if (!user?.id) {
      toast({
        title: "Authentication Error", // ✅ Consistent casing
        description: "You must be logged in to place an order.",
        variant: "destructive",
      });
      return;
    }

    // city फ़ील्ड को भी अनिवार्य करें (अगर Bundi के अलावा कुछ और है)
    if (!deliveryAddress.fullName || !deliveryAddress.phone || !deliveryAddress.address || !deliveryAddress.pincode || !deliveryAddress.city || !deliveryAddress.latitude || !deliveryAddress.longitude) { // ✅ Corrected casing
      toast({
        title: "Address Required", // ✅ Consistent casing
        description: "Please fill in all delivery address fields and select a location on the map.",
        variant: "destructive",
      });
      return;
    }

    if (!cartItems || cartItems.length === 0) { // ✅ Corrected casing
      toast({
        title: "No Items to Order", // ✅ Consistent casing
        description: "There are no items to place an order.",
        variant: "destructive",
      });
      return;
    }

    const itemsToOrder = cartItems.map(item => ({ // ✅ Corrected casing
      id: item.id,
      productId: item.product.id, // ✅ Corrected to camelCase
      sellerId: item.product.sellerId, // ✅ Corrected to camelCase
      quantity: item.quantity,
      unitPrice: item.product.price, // ✅ Corrected to camelCase
      totalPrice: (item.product.price * item.quantity).toFixed(2), // ✅ Corrected calculation
    }));

    const orderData = { // ✅ Corrected casing
      customerId: user.id, // ✅ Corrected to camelCase
      deliveryAddress: { // ✅ Corrected casing
        ...deliveryAddress,
        // lat/lng सुनिश्चित करें कि यह number है
        latitude: deliveryAddress.latitude,
        longitude: deliveryAddress.longitude,
      },
      paymentMethod, // ✅ Corrected casing
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2),
      deliveryCharge: deliveryCharge.toFixed(2), // ✅ Corrected casing
      deliveryInstructions, // ✅ Corrected casing
      items: itemsToOrder, // ✅ Corrected casing
      cartOrder: true,
    };

    createOrderMutation.mutate(orderData); // ✅ Corrected casing
  };

  // ------------------- jsx loading / empty states -------------------

  if (isLoading) { // ✅ Corrected casing
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center"> {/* ✅ Corrected className */}
        <p className="text-xl font-semibold">Loading cart...</p> {/* ✅ Corrected className */}
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) { // ✅ Corrected casing
    return (
      <div className="min-h-screen bg-gray-50 py-8 text-center"> {/* ✅ Corrected className */}
        <h2 className="text-2xl font-bold mb-4">Your Cart is Empty</h2> {/* ✅ Corrected className */}
        <p className="text-gray-600 mb-6">Looks like you haven't added anything to your cart yet.</p> {/* ✅ Corrected className */}
        <Link to="/"> {/* ✅ Corrected component name */}
          <Button>Start Shopping</Button> {/* ✅ Corrected component name */}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8"> {/* ✅ Corrected className */}
      <div className="max-w-6xl mx-auto px-4"> {/* ✅ Corrected className */}
        <div className="mb-8"> {/* ✅ Corrected className */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkout</h1> {/* ✅ Corrected className */}
          <div className="flex space-x-4"> {/* ✅ Corrected className */}
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex items-center space-x-2 ${currentStep >= step ? "text-green-600" : "text-gray-400"}`} // ✅ Corrected className
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep > step ? "bg-green-600 text-white" : "bg-gray-200"}`}> {/* ✅ Corrected className */}
                  {currentStep > step ? <Check className="w-4 h-4" /> : step} {/* ✅ Corrected component name and className */}
                </div>
                <span className="font-medium"> {/* ✅ Corrected className */}
                  {step === 1 ? "Cart Review" : step === 2 ? "Delivery Address" : "Payment"} {/* ✅ Consistent casing */}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8"> {/* ✅ Corrected className */}
          <div className="lg:col-span-2 space-y-6"> {/* ✅ Corrected className */}
            {currentStep === 1 && ( // ✅ Corrected casing
              // ... (step 1 cart review jsx)
              <Card> {/* ✅ Corrected component name */}
                <CardHeader> {/* ✅ Corrected component name */}
                  <CardTitle className="flex items-center space-x-2"> {/* ✅ Corrected component name and className */}
                    <ShoppingCart className="w-5 h-5" /> {/* ✅ Corrected component name and className */}
                    <span>Review Your Order</span> {/* ✅ Consistent casing */}
                  </CardTitle>
                </CardHeader>
                <CardContent> {/* ✅ Corrected component name */}
                  <div className="space-y-4"> {/* ✅ Corrected className */}
                    {cartItems.map((item, index) => ( // ✅ Corrected casing
                      <div key={item.id || index} className="flex items-center space-x-4 py-4 border-b"> {/* ✅ Corrected className */}
                        <img src={item.product.image} alt={item.product.name} className="w-16 h-16 object-cover rounded-lg" /> {/* ✅ Corrected className */}
                        <div className="flex-1"> {/* ✅ Corrected className */}
                          <h3 className="font-medium">{item.product.name}</h3> {/* ✅ Corrected className */}
                          <p className="text-sm text-gray-600">{item.product.nameHindi}</p> {/* ✅ Corrected casing and className */}
                          <p className="text-sm text-gray-500">{item.product.brand} • {item.product.unit}</p> {/* ✅ Corrected className */}
                        </div>
                        <div className="text-right"> {/* ✅ Corrected className */}
                          <p className="font-medium">₹{item.product.price.toFixed(2)} × {item.quantity}</p> {/* ✅ Corrected toFixed(2) */}
                          <p className="text-sm text-gray-600">₹{(item.product.price * item.quantity).toFixed(2)}</p> {/* ✅ Corrected toFixed(2) */}
                        </div>
                      </div>
                    ))}
                    <div className="pt-4"> {/* ✅ Corrected className */}
                      <Button onClick={() => setCurrentStep(2)} className="w-full">Proceed to Delivery Address</Button> {/* ✅ Corrected component name and className */}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && ( // ✅ Corrected casing
              <Card> {/* ✅ Corrected component name */}
                <CardHeader> {/* ✅ Corrected component name */}
                  <CardTitle className="flex items-center space-x-2"> {/* ✅ Corrected component name and className */}
                    <MapPin className="w-5 h-5" /> {/* ✅ Corrected component name and className */}
                    <span>Delivery Address</span> {/* ✅ Consistent casing */}
                  </CardTitle>
                </CardHeader>
                <CardContent> {/* ✅ Corrected component name */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* ✅ Corrected className */}
                    <div>
                      <Label htmlFor="fullName">Full Name</Label> {/* ✅ Corrected component name and casing */}
                      <Input
                        id="fullName"
                        value={deliveryAddress.fullName} // ✅ Corrected casing
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, fullName: e.target.value })} // ✅ Corrected casing
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label> {/* ✅ Corrected component name and casing */}
                      <Input
                        id="phone"
                        value={deliveryAddress.phone} // ✅ Corrected casing
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, phone: e.target.value })} // ✅ Corrected casing
                        placeholder="Enter phone number"
                      />
                    </div>

                    {/* ✅ new: AddressInputWithMap कंपोनेंट */}
                    <div className="md:col-span-2 border p-3 rounded-lg bg-gray-50"> {/* ✅ Corrected className */}
                      <Label htmlFor="address">Locate and Verify Address</Label> {/* ✅ Corrected component name */}
                      <AddressInputWithMap // ✅ Corrected component name
                        currentAddress={deliveryAddress.address} // ✅ Corrected casing
                        currentLocation={deliveryAddress.latitude && deliveryAddress.longitude
                          ? { lat: deliveryAddress.latitude, lng: deliveryAddress.longitude }
                          : null
                        }
                        onLocationUpdate={handleLocationUpdate} // ✅ Corrected casing
                      />
                    </div>

                    {/* *************************************************************** */}
                    {/* ✅ मैप से मिला एड्रेस दिखाने और एडिट करने के लिए */}
                    {/* *************************************************************** */}

                    <div className="md:col-span-2"> {/* ✅ Corrected className */}
                      <Label htmlFor="address_text">Delivery Address Text</Label> {/* ✅ Corrected component name */}
                      <Textarea // ✅ Corrected component name
                        id="address_text"
                        value={deliveryAddress.address} // <-- map से मिला पता यहाँ दिखेगा
                        onChange={(e) => setDeliveryAddress({
                          ...deliveryAddress,
                          address: e.target.value
                        })}
                        placeholder="मैप से या मैन्युअल रूप से अपना पूरा पता चुनें"
                        rows={3}
                      />
                    </div>

                    {/* *************************************************************** */}

                    <div>
                      <Label htmlFor="city">City</Label> {/* ✅ Corrected component name and casing */}
                      <Input
                        id="city"
                        value={deliveryAddress.city} // ✅ Corrected casing
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, city: e.target.value })} // ✅ Corrected casing
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pincode">Pincode</Label> {/* ✅ Corrected component name and casing */}
                      <Input
                        id="pincode"
                        value={deliveryAddress.pincode} // ✅ Corrected casing
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, pincode: e.target.value })} // ✅ Corrected casing
                        placeholder="Enter pincode"
                      />
                    </div>
                    <div className="md:col-span-2"> {/* ✅ Corrected className */}
                      <Label htmlFor="landmark">Landmark (Optional)</Label> {/* ✅ Corrected component name and casing */}
                      <Input
                        id="landmark"
                        value={deliveryAddress.landmark || ''} // Ensure it's not undefined
                        onChange={(e) => setDeliveryAddress({ ...deliveryAddress, landmark: e.target.value })} // ✅ Corrected casing
                        placeholder="Nearby landmark"
                      />
                    </div>
                    <div className="md:col-span-2"> {/* ✅ Corrected className */}
                      <Label htmlFor="instructions">Delivery Instructions</Label> {/* ✅ Corrected component name and casing */}
                      <Textarea // ✅ Corrected component name
                        id="instructions"
                        value={deliveryInstructions} // ✅ Corrected casing
                        onChange={(e) => setDeliveryInstructions(e.target.value)} // ✅ Corrected casing
                        placeholder="Any special instructions for delivery"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="flex space-x-4 mt-6"> {/* ✅ Corrected className */}
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>Back to Cart</Button> {/* ✅ Corrected component name and casing */}
                    <Button onClick={() => setCurrentStep(3)}>Proceed to Payment</Button> {/* ✅ Corrected component name and casing */}
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && ( // ✅ Corrected casing
              <Card> {/* ✅ Corrected component name */}
                <CardHeader> {/* ✅ Corrected component name */}
                  <CardTitle className="flex items-center space-x-2"> {/* ✅ Corrected component name and className */}
                    <CreditCard className="w-5 h-5" /> {/* ✅ Corrected component name and className */}
                    <span>Payment Method</span> {/* ✅ Consistent casing */}
                  </CardTitle>
                </CardHeader>
                <CardContent> {/* ✅ Corrected component name */}
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}> {/* ✅ Corrected component name and casing */}
                    <div className="space-y-4"> 
                        {/* पहला विकल्प: COD */}
                      <div className="flex items-center space-x-2 p-4 border rounded-lg"> {/* ✅ Corrected className */}
                        <RadioGroupItem value="cod" id="cod" /> {/* ✅ Corrected component name */}
                        <Label htmlFor="cod" className="flex-1 cursor-pointer"> {/* ✅ Corrected component name and className */}
                          <div>
                            <p className="font-medium">Cash on Delivery (COD)</p> {/* ✅ Consistent casing and className */}
                            <p className="text-sm text-gray-600">Pay when your order arrives</p> {/* ✅ Corrected className */}
                          </div>
                        </Label>
                      </div>

                      {/* दूसरा विकल्प: Online */}
                      <div className="flex items-center space-x-2 p-4 border rounded-lg opacity-50"> {/* ✅ Corrected className */}
                        <RadioGroupItem value="online" id="online" disabled /> {/* ✅ Corrected component name */}
                        <Label htmlFor="online" className="flex-1 cursor-pointer"> {/* ✅ Corrected component name and className */}
                          <div>
                            <p className="font-medium">Online Payment</p> {/* ✅ Consistent casing and className */}
                            <p className="text-sm text-gray-600">Pay now using UPI, card, or net banking (coming soon)</p> {/* ✅ Corrected className */}
                          </div>
                        </Label>
                      </div>

                    </div>
                  </RadioGroup>


                  <div className="flex space-x-4 mt-6"> {/* ✅ Corrected className */}
                    <Button variant="outline" onClick={() => setCurrentStep(2)}>Back to Address</Button> {/* ✅ Corrected component name and casing */}
                    <Button
                      onClick={handlePlaceOrder} // ✅ Corrected casing
                      disabled={createOrderMutation.isPending} // ✅ Corrected casing
                      className="flex-1" // ✅ Corrected className
                    >
                      {createOrderMutation.isPending ? "Placing Order..." : `Place Order - ₹${total.toFixed(2)}`} {/* ✅ Consistent casing */}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div>
            <Card className="sticky top-4"> {/* ✅ Corrected component name and className */}
              <CardHeader> {/* ✅ Corrected component name */}
                <CardTitle>Order Summary</CardTitle> {/* ✅ Consistent casing */}
              </CardHeader>
              <CardContent> {/* ✅ Corrected component name */}
                <div className="space-y-3"> {/* ✅ Corrected className */}
                  <div className="flex justify-between"> {/* ✅ Corrected className */}
                    <span>Subtotal ({cartItems.length} items)</span> {/* ✅ Consistent casing */}
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between"> {/* ✅ Corrected className */}
                    <span>Delivery Charges</span> {/* ✅ Consistent casing */}
                    <span>{deliveryCharge === 0 ? "Free" : `₹${deliveryCharge.toFixed(2)}`}</span>
                  </div>
                  {deliveryCharge === 0 && ( // ✅ Corrected casing
                    <p className="text-sm text-green-600">Free delivery on orders above ₹500</p> {/* ✅ Consistent casing and className */}
                  )}
                  <hr />
                  <div className="flex justify-between font-semibold text-lg"> {/* ✅ Corrected className */}
                    <span>Total</span> {/* ✅ Consistent casing */}
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-gray-600"> {/* ✅ Corrected className */}
                    <p>Estimated Delivery: Within 1 hour</p> {/* ✅ Consistent casing */}
                    <p>From: Kumar General Store, Bundi</p> {/* ✅ Hardcoded to Bundi for now, consider dynamic seller info */}
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
