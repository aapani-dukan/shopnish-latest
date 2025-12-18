import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { getAuth } from 'firebase/auth'; 
import { Truck, ShoppingBag, Loader2 } from 'lucide-react'; // Icons

// ⚠️ Make sure apiRequest and any necessary UI components are imported from their respective paths.
// import { apiRequest } from '../../utils/api'; 
// import { Button, Card, Badge } from '../../components/ui';

// --- DATA INTERFACES (इनको अपनी Drizzle/Backend संरचना के अनुसार समायोजित करें) ---
interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  itemTotal: number;
}

interface DeliveryAddress {
    fullName: string;
    addressLine1: string;
    city: string;
    // ... अन्य पता फ़ील्ड्स
}

interface SubOrder {
    subOrderId: number;
    sellerName: string;
    deliveryStatus: string; // Sub-order status
    subtotal: number;
    deliveryCharge: number;
    total: number;
    items: OrderItem[];
    deliveryBatchId: number | null; // 🛑 FIX: फ़िल्टरिंग के लिए आवश्यक
    // ... अन्य सब-ऑर्डर विशिष्ट विवरण
}

interface MasterOrderDetails {
  orderNumber: string;
  overallDeliveryStatus: string;
  deliveryAddress: DeliveryAddress | null; 
  masterTotal: number;
  subOrders: SubOrder[]; 
  // ... अन्य मास्टर विवरण
}
// ------------------------------------------------------------------

// आपको अपने वास्तविक API फ़ंक्शन को यहाँ परिभाषित करना होगा या उसे इंपोर्ट करना होगा।
// मान लीजिए कि यह फ़ंक्शन मौजूद है:
const apiRequest = async (method: string, url: string, data?: any) => {
    // ⚠️ TODO: अपने वास्तविक API logic को यहाँ लागू करें
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated.");

    const authToken = await user.getIdToken(); 
    
    const response = await fetch(url, {
        method: method,
        headers: {
            Authorization: `Bearer ${authToken}`, 
            'Content-Type': 'application/json'
        },
        body: data ? JSON.stringify(data) : undefined,
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Server error.' }));
        throw new Error(errorData.message || 'Failed to fetch data.');
    }
    return response.json();
};


const OrderDetailsPage = () => {
  const { id } = useParams<{ id: string }>(); 
  const orderId = id; // Master Order ID

  // 🟢 FIX 1: Query Parameter से batchId प्राप्त करें (वैकल्पिक फ़िल्टर)
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const batchIdFilter = queryParams.get('batchId'); // e.g., "101"

  const auth = getAuth(); 

  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<MasterOrderDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    
    if (orderId) {
      const user = auth.currentUser;

      if (!user) {
          setError("User not logged in. Redirecting to login...");
          setLoading(false);
          // ⚠️ TODO: यहां यूजर को लॉगिन पेज पर रीडायरेक्ट करें
          return;
      }
      
      const fetchDetails = async () => {
        setLoading(true);
        setError(null);
        
        try {
          // 🟢 FIX 2: API कॉल को Master Order Details API में बदलें
          // यह API अब सभी सब-ऑर्डर्स लौटाएगा (batchId फ़िल्टर Frontend पर लागू होता है)
          const apiUrl = `/api/orders/${orderId}/details`; 
          
          const data: MasterOrderDetails = await apiRequest("get", apiUrl);
          setOrderDetails(data);
          
        } catch (err: any) {
          console.error("Fetching error:", err);
          setError(err.message || "Unable to load order details.");
        } finally {
          setLoading(false);
        }
      };

      fetchDetails();
    } else {
        setLoading(false);
        setError("Invalid URL parameters (Order ID is missing)."); 
    }
  }, [orderId]); // orderId पर निर्भरता रखें

  // --- रेंडरिंग स्टेट्स ---

  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="ml-3 text-lg">Loading order details...</p>
        </div>
    );
  }

  if (error) {
    return (
        <div className="p-8 text-red-600 text-center">
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p>{error}</p>
        </div>
    );
  }

  if (!orderDetails) {
    return (
        <div className="p-8 text-center text-gray-600">No details found for Order #{orderId}.</div>
    );
  }

  // 🟢 FIX 3: वैकल्पिक Batch फ़िल्टरिंग लागू करें
  const subOrdersToDisplay = batchIdFilter
      ? orderDetails.subOrders.filter(subOrder => 
          subOrder.deliveryBatchId?.toString() === batchIdFilter
        )
      : orderDetails.subOrders; 

  const isFiltered = !!batchIdFilter;
  
  // --- फाइनल रेंडरिंग ---

  return (
      <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-4xl mx-auto px-4">
              
              <h1 className="text-3xl font-bold mb-6 text-gray-800 flex items-center justify-between">
                  <span>Order #{orderDetails.orderNumber} Details</span>
                  {isFiltered && (
                      <span className="text-xl font-normal text-indigo-500 bg-indigo-100 px-3 py-1 rounded-full">
                          <Link to={`/order-details/${orderId}`} className="hover:underline">
                            Batch #{batchIdFilter} Filtered (Remove Filter)
                          </Link>
                      </span>
                  )}
              </h1>
              
              {/* Master Order Summary Card (शेडो के बजाय सरल DIV का उपयोग) */}
              <div className="bg-white p-6 rounded-lg mb-6 border-b-4 border-indigo-500">
                  <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold">Overall Status</h2>
                      <span className="text-lg font-bold text-green-700">{orderDetails.overallDeliveryStatus}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-right">
  Total Paid: ₹{Number(orderDetails?.masterTotal || 0).toFixed(2)}
</p>
                
                  
                  {/* Delivery Address */}
                  {orderDetails.deliveryAddress && (
                      <div className="mt-4 pt-3 border-t">
                           <p className="text-sm text-gray-500">Delivery To:</p>
                           <p className="font-medium">{orderDetails.deliveryAddress.fullName}</p>
                           <p className="text-sm">{orderDetails.deliveryAddress.addressLine1}, {orderDetails.deliveryAddress.city}</p>
                      </div>
                  )}
              </div>

              {/* Sub-Orders Section */}
              <h2 className="text-2xl font-bold mb-4 flex items-center text-gray-800">
                   <ShoppingBag className="h-6 w-6 mr-2 text-indigo-600" /> 
                   Sub-Orders ({subOrdersToDisplay?.length || 0})

              </h2>
              
              {subOrdersToDisplay.length === 0 && isFiltered && (
                   <p className="text-gray-600 p-4 bg-yellow-50 rounded-lg">
                       This batch has no active sub-orders to display.
                   </p>
              )}

              <div className="space-y-6">
                  {subOrdersToDisplay.map((subOrder) => (
                      <div key={subOrder.subOrderId} className="bg-white p-5 rounded-xl border border-gray-200">
                          <h3 className="text-xl font-bold mb-3 text-indigo-700 flex justify-between items-center">
                              Sub-Order from {subOrder.sellerName}
                              {/* ⚠️ Batch ID Display (ज़रूरी नहीं कि यह हमेशा बैच ID हो) */}
                              {subOrder.deliveryBatchId && (
                                  <span className="text-sm font-normal text-gray-500">Batch #{subOrder.deliveryBatchId}</span>
                              )}
                          </h3>
                          
                          <div className="grid grid-cols-3 gap-4 text-sm mb-4 pb-4 border-b">
                              <p><strong>Status:</strong> <span className="text-green-600">{subOrder.deliveryStatus}</span></p>
                              <p><strong>Total:</strong> ₹{subOrder.total.toFixed(2)}</p>
                          </div>

                          {/* Items List for this Sub-Order */}
                          <div className="border rounded-lg overflow-hidden mb-4">
                            {subOrder.items.map((item, itemIndex) => (
                              <div key={itemIndex} className="flex justify-between p-3 border-b last:border-b-0 bg-gray-50">
                                <span className="flex-1 text-sm">{item.productName} ({item.quantity} x ₹{item.unitPrice.toFixed(2)})</span>
                                <span className="font-medium text-sm">₹{item.itemTotal.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          
                          {/* Sub-Order Summary */}
                          <div className="text-right text-sm">
                              <p className="text-gray-600">Subtotal: ₹{subOrder.subtotal.toFixed(2)}</p>
                              <p className="text-gray-600">Delivery Charge: ₹{subOrder.deliveryCharge.toFixed(2)}</p>
                              <p className="font-bold border-t pt-1 mt-1">Sub-Order Total: ₹{subOrder.total.toFixed(2)}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
  );
};

export default OrderDetailsPage;
