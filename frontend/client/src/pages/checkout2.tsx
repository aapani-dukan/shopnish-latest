// client/src/pages/checkout2.tsx
import { useState, useCallback, useEffect } from "react"; // Added useEffect for user data pre-fill
import { useQuery, useMutation } from "@tanstack/react-query"; // Removed useQueryClient as it's not directly used for invalidation here
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
import AddressInputWithMap from "@/components/addressinputwithmap";

// ✅ Updated SellerInfo Interface
interface SellerInfo {
  id: number;
  businessName: string; // ✅ Corrected to camelCase
  city: string;
}

// ✅ Updated ProductItem Interface
interface ProductItem {
  id: number;
  name: string;
  nameHindi: string; // ✅ Corrected to camelCase
  price: number; // ✅ Changed from string to number for calculations
  image: string;
  unit: string;
  brand: string;
  sellerId: number; // ✅ Corrected to camelCase
  seller?: SellerInfo; // ✅ Added seller info
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

export default function Checkout2() {
  const navigate = useNavigate();
  const { toast } = useToast();
  // const queryClient = useQueryClient(); // Removed as not directly used for invalidation here
  const { isAuthenticated, user } = useAuth(); // ✅ Corrected casing

  const { id: directBuyProductId } = useParams<{ id: string }>(); // ✅ Corrected casing
  const [searchParams] = useSearchParams(); // ✅ Corrected casing
  const directBuyQuantity = searchParams.get("quantity") ? parseInt(searchParams.get("quantity")!) : 1; // ✅ Corrected casing

  const [currentStep, setCurrentStep] = useState(1); // ✅ Corrected casing
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({ // ✅ Corrected casing
    fullName: "",
    phone: "",
    address: "",
    city: "Bundi", // Default to Bundi
    pincode: "",
    landmark: "",
    latitude: 25.4419, // Default to Bundi coordinates
    longitude: 75.6179,
  });
  const [paymentMethod, setPaymentMethod] = useState("cod"); // ✅ Corrected casing
  const [deliveryInstructions, setDeliveryInstructions] = useState(""); // ✅ Corrected casing

  // ✅ Pre-fill delivery address with user data on component mount or user change
  useEffect(() => {
    if (user) {
      setDeliveryAddress(prev => ({
        ...prev,
        fullName: user.firstName || prev.fullName,
        phone: user.phone || prev.phone,
      }));
    }
  }, [user]);

  // ✅ fetch direct buy product
  const { data: productData, isLoading, error } = useQuery<ProductItem>({ // ✅ Corrected casing
    queryKey: ['product', directBuyProductId], // ✅ Corrected casing
    queryFn: () => apiRequest("get", `/api/products/${directBuyProductId}`), // ✅ Corrected casing
    enabled: !!directBuyProductId, // ✅ Only enable if product ID exists
  });

  const subtotal = productData ? productData.price * directBuyQuantity : 0; // ✅ Use number type for price
  const deliveryCharge = subtotal >= 500 ? 0 : 25; // ✅ Corrected casing
  const total = subtotal + deliveryCharge; // ✅ Corrected casing

  // ----------------------------------------------------------------------------------
  // ✅ new: addressinputwithmap से डेटा प्राप्त करने के लिए हैंडलर
  // ----------------------------------------------------------------------------------
  const handleLocationUpdate = useCallback( // ✅ Corrected casing
    (address: string, location: { lat: number; lng: number; city: string; pincode: string; }) => {
      setDeliveryAddress(prev => ({ // ✅ Corrected casing
        ...prev,
        address: address,
        latitude: location.lat,
        longitude: location.lng,

        // ✅ fix: pincode और city को स्पष्ट रूप से अपडेट करें
        city: location.city,
        pincode: location.pincode,
      }));
    },
    [setDeliveryAddress]
  );

  // ----------------------------------------------------------------------------------
  // ✅ order items को ठीक करें (buy now के लिए)
  // ----------------------------------------------------------------------------------
  const itemsToOrder = productData ? [{ // ✅ Corrected casing
    productId: productData.id, // ✅ Corrected to camelCase
    sellerId: productData.sellerId, // ✅ Corrected to camelCase
    quantity: directBuyQuantity, // ✅ Corrected casing
    unitPrice: productData.price, // ✅ Corrected to camelCase
    totalPrice: productData.price * directBuyQuantity, // ✅ Corrected calculation
  }] : [];

  // ----------------------------------------------------------------------------------
  // ✅ order mutation
  // ----------------------------------------------------------------------------------
  const createOrderMutation = useMutation({ // ✅ Corrected casing
    mutationFn: (orderData: any) => apiRequest("post", "/api/orders/buy-now", orderData), // ✅ Corrected casing
    onSuccess: (data) => { // ✅ Corrected casing
      toast({
        title: "Order Placed Successfully!", // ✅ Consistent casing
        description: `Order #${data.orderNumber || data.id} has been confirmed.`, // ✅ Use orderNumber or ID
      });
      // ✅ Use orderId or id for navigation
      const orderId = data.orderId || data.id;
      if (orderId) {
        navigate(`/order-confirmation/${orderId}`);
      } else {
        console.error("No order ID received for navigation.");
        navigate('/'); // Fallback to home if no order ID
      }
    },
    onError: (error: any) => { // ✅ Explicitly type error
      console.error("❌ Order placement failed:", error);
      toast({
        title: "Order Failed", // ✅ Consistent casing
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePlaceOrder = () => { // ✅ Corrected casing
    if (!user || !user.id) {
      toast({
        title: "Authentication Error", // ✅ Consistent casing
        description: "You must be logged in to place an order.",
        variant: "destructive",
      });
      return;
    }

    if (!deliveryAddress.fullName || !deliveryAddress.phone || !deliveryAddress.address || !deliveryAddress.pincode || !deliveryAddress.latitude || !deliveryAddress.longitude) { // ✅ Corrected casing
      toast({
        title: "Address Required", // ✅ Consistent casing
        description: "Please fill in all delivery address fields and select a location on the map.",
        variant: "destructive",
      });
      return;
    }

    if (!productData) { // ✅ Corrected casing
      toast({
        title: "Product Not Found", // ✅ Consistent casing
        description: "Could not find the product to place an order.",
        variant: "destructive",
      });
      return;
    }

    // ✅ order data update: नए lat/lng को orderData में शामिल करें
    const orderData = { // ✅ Corrected casing
      customerId: user.id, // ✅ Corrected to camelCase
      deliveryAddress: { // ✅ Corrected casing
        ...deliveryAddress,
        // lat/lng को number के रूप में भेजें
        latitude: deliveryAddress.latitude,
        longitude: deliveryAddress.longitude
      },
      paymentMethod, // ✅ Corrected casing
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2),
      deliveryCharge: deliveryCharge.toFixed(2), // ✅ Corrected casing
      deliveryInstructions, // ✅ Corrected casing
      items: itemsToOrder, // ✅ Corrected casing
      cartOrder: false, // क्योंकि यह 'buy-now' ऑर्डर है
    };

    createOrderMutation.mutate(orderData); // ✅ Corrected casing
  };

  if (isLoading) { // ✅ Corrected casing
    return (
      <div className="min-h-screen flex items-center justify-center"> {/* ✅ Corrected className */}
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div> {/* ✅ Corrected className */}
      </div>
    );
  }

  if (error || !productData) { // ✅ Corrected casing
    return (
      <div className="min-h-screen flex items-center justify-center"> {/* ✅ Corrected className */}
        <Card className="w-full max-w-md"> {/* ✅ Corrected component name and className */}
          <CardContent className="pt-6 text-center"> {/* ✅ Corrected component name and className */}
            <h3 className="text-lg font-medium mb-2">Product Not Found</h3> {/* ✅ Consistent casing and className */}
            <p className="text-gray-600 mb-4"> {/* ✅ Corrected className */}
              The product you're looking for doesn't exist or is not available.
            </p>
            <Link to="/"> {/* ✅ Corrected component name */}
              <Button>Go to Home Page</Button> {/* ✅ Corrected component name */}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8"> {/* ✅ Corrected className */}
      <div className="max-w-6xl mx-auto px-4"> {/* ✅ Corrected className */}
        {/* steps */}
        <div className="mb-8"> {/* ✅ Corrected className */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkout</h1> {/* ✅ Corrected className */}
          <div className="flex space-x-4"> {/* ✅ Corrected className */}
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex items-center space-x-2 ${currentStep >= step ? "text-green-600" : "text-gray-400"}`} // ✅ Corrected className
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${ // ✅ Corrected className
                    currentStep > step ? "bg-green-600 text-white" : "bg-gray-200"
                  }`}
                >
                  {currentStep > step ? <Check className="w-4 h-4" /> : step} {/* ✅ Corrected component name and className */}
                </div>
                <span className="font-medium"> {/* ✅ Corrected className */}
                  {step === 1 ? "Order Review" : step === 2 ? "Delivery Address" : "Payment"} {/* ✅ Consistent casing */}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8"> {/* ✅ Corrected className */}
          <div className="lg:col-span-2 space-y-6"> {/* ✅ Corrected className */}
            {/* step 1: review */}
            {currentStep === 1 && ( // ✅ Corrected casing
              <Card> {/* ✅ Corrected component name */}
                <CardHeader> {/* ✅ Corrected component name */}
                  <CardTitle className="flex items-center space-x-2"> {/* ✅ Corrected component name and className */}
                    <ShoppingCart className="w-5 h-5" /> {/* ✅ Corrected component name and className */}
                    <span>Review Your Order</span> {/* ✅ Consistent casing */}
                  </CardTitle>
                </CardHeader>
                <CardContent> {/* ✅ Corrected component name */}
                  <div className="space-y-4"> {/* ✅ Corrected className */}
                    <div className="flex items-center space-x-4 py-4 border-b"> {/* ✅ Corrected className */}
                      <img
                        src={productData.image} // ✅ Corrected casing
                        alt={productData.name} // ✅ Corrected casing
                        className="w-16 h-16 object-cover rounded-lg" // ✅ Corrected className
                      />
                      <div className="flex-1"> {/* ✅ Corrected className */}
                        <h3 className="font-medium">{productData.name}</h3> {/* ✅ Corrected casing and className */}
                        <p className="text-sm text-gray-600">{productData.nameHindi}</p> {/* ✅ Corrected casing and className */}
                        <p className="text-sm text-gray-500">{productData.brand} • {productData.unit}</p> {/* ✅ Corrected casing and className */}
                      </div>
                      <div className="text-right"> {/* ✅ Corrected className */}
                        <p className="font-medium">₹{productData.price.toFixed(2)} × {directBuyQuantity}</p> {/* ✅ Corrected casing and toFixed(2) */}
                        <p className="text-sm text-gray-600"> {/* ✅ Corrected className */}
                          ₹{(productData.price * directBuyQuantity).toFixed(2)} {/* ✅ Corrected calculation and toFixed(2) */}
                        </p>
                      </div>
                    </div>
                    <div className="pt-4"> {/* ✅ Corrected className */}
                      <Button onClick={() => setCurrentStep(2)} className="w-full"> {/* ✅ Corrected component name and casing */}
                        Proceed to Delivery Address
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* step 2: address */}
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
                    {/* ✅ नया कोड यहाँ जोड़ें: मैप से मिला एड्रेस दिखाने और एडिट करने के लिए */}
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
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>Back to Order</Button> {/* ✅ Corrected component name and casing */}
                    <Button onClick={() => setCurrentStep(3)}>Proceed to Payment</Button> {/* ✅ Corrected component name and casing */}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* step 3: payment */}
                    {currentStep === 3 && ( // ✅ Corrected casing
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
                            <p className="text-sm text-gray-600">Pay now using UPI, card, or net banking (coming soon)</p> 
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

          {/* order summary */}
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
                    <span>{deliveryCharge === 0 ? "Free" : `₹${deliveryCharge.toFixed(2)}`}</span>
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
                    <p>Estimated Delivery: Within 1 hour</p> 
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
