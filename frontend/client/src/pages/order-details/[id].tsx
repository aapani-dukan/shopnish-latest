// pages/order-details/[id].tsx

import React, { useEffect, useState } from 'react';
// ✅ Next.js के बजाय React Router हुक्स का उपयोग करें
import { useParams, useLocation } from 'react-router-dom'; 
// ✅ Firebase Auth SDK को इंपोर्ट करें
import { getAuth } from 'firebase/auth'; 

// मान लीजिए कि आपके पास एक लेआउट कंपोनेंट और एक API फ़ेचर फ़ंक्शन है
// import Layout from '../../components/Layout';
// import { fetchSubOrderDetails } from '../../api/orderApi'; 

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  itemTotal: number;
}

interface SubOrderDetails {
  orderNumber: string;
  sellerName: string;
  deliveryStatus: string;
  subtotal: number;
  deliveryCharge: number;
  total: number;
  items: OrderItem[];
  // और अन्य प्रासंगिक जानकारी (जैसे पता, ETA, आदि)
}

const OrderDetailsPage = () => {
  // 1. URL Path पैरामीटर प्राप्त करें (e.g., /order-details/9 -> id=9)
  const { id } = useParams<{ id: string }>(); 
  const orderId = id;

  // 2. URL Query पैरामीटर प्राप्त करें (e.g., ?sellerId=7)
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const sellerId = queryParams.get('sellerId'); 

  // Firebase Auth इंस्टेंस प्राप्त करें
  // ⚠️ सुनिश्चित करें कि आपके मुख्य app.js/main.js में Firebase initialize हो चुका है।
  const auth = getAuth(); 

  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<SubOrderDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    
    // useParams/useLocation तुरंत उपलब्ध हैं
    if (orderId && sellerId) {
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
          // 🛑 FIX: हर बार कॉल करने से पहले Firebase से वर्तमान ID Token प्राप्त करें
          const authToken = await user.getIdToken(); 
          
          // Backend API कॉल (आपने जो Backend में परिभाषित किया है)
          const apiUrl = `/api/orders/${orderId}/details?sellerId=${sellerId}`; 
          
          const response = await fetch(apiUrl, {
              headers: {
                  // 🛑 FIX: वास्तविक authToken का उपयोग करें
                  Authorization: `Bearer ${authToken}`, 
                  'Content-Type': 'application/json'
              },
          });

          if (!response.ok) {
              const errorData = await response.json();
              
              if (response.status === 401) {
                  // यदि Firebase टोकन अस्वीकृत हो जाता है (जैसे एक्सपायर्ड)
                  setError("Session expired. Please log in again.");
              } else {
                  throw new Error(errorData.message || 'Failed to fetch order details.');
              }
          }

          const data: SubOrderDetails = await response.json();
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
        // यदि कोई पैरामीटर गुम है तो तुरंत लोड होना बंद कर दें
        setLoading(false);
        setError("Invalid URL parameters (Order ID or Seller ID is missing).");
    }
  }, [orderId, sellerId]); // Dependencies list में orderId और sellerId शामिल करें

  if (loading) {
    return (
      // <Layout>
        <div className="p-4 text-center">Loading order details...</div>
      // </Layout>
    );
  }

  if (error) {
    return (
      // <Layout>
        <div className="p-4 text-red-600 text-center">Error: {error}</div>
      // </Layout>
    );
  }

  if (!orderDetails) {
    return (
      // <Layout>
        <div className="p-4 text-center">No details found for this order.</div>
      // </Layout>
    );
  }

  return (
    // <Layout title={`Order #${orderDetails.orderNumber} Details`}>
      <div className="max-w-4xl mx-auto p-4 bg-white shadow-lg rounded-lg">
        <h1 className="text-2xl font-bold mb-4">Order Details (Sub-Order)</h1>
        
        <div className="grid grid-cols-2 gap-4 mb-6 border p-4 rounded-md">
          <div>
            <p className="text-sm text-gray-500">Order #</p>
            <p className="font-semibold">{orderDetails.orderNumber}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Seller</p>
            <p className="font-semibold">{orderDetails.sellerName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Delivery Status</p>
            <p className="font-semibold text-green-600">{orderDetails.deliveryStatus}</p>
          </div>
          {/* अन्य मुख्य विवरण */}
        </div>

        {/* Items List */}
        <h2 className="text-xl font-semibold mb-3">Items Purchased</h2>
        <div className="border rounded-lg overflow-hidden">
          {orderDetails.items.map((item, index) => (
            <div key={index} className="flex justify-between p-3 border-b last:border-b-0">
              <span className="flex-1">{item.productName} ({item.quantity} x {item.unitPrice.toFixed(2)})</span>
              <span className="font-medium">₹{item.itemTotal.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-6 text-right">
          <p className="text-gray-700">Subtotal: ₹{orderDetails.subtotal.toFixed(2)}</p>
          <p className="text-gray-700">Delivery Charge: ₹{orderDetails.deliveryCharge.toFixed(2)}</p>
          <p className="text-xl font-bold border-t pt-2 mt-2">Total: ₹{orderDetails.total.toFixed(2)}</p>
        </div>
      </div>
    // </Layout>
  );
};

export default OrderDetailsPage;
