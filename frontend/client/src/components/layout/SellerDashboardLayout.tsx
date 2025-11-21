// client/src/components/layout/SellerDashboardLayout.tsx

import React from 'react';
import { Outlet, Link } from 'react-router-dom'; // Outlet और Link को इम्पोर्ट करें

// आप यहाँ अपने UI कंपोनेंट्स को इम्पोर्ट कर सकते हैं, जैसे Header, Button, etc.
// उदाहरण के लिए, यदि आपके पास एक Sidebar कंपोनेंट है, तो उसे यहाँ इम्पोर्ट करें
// import SellerSidebar from './SellerSidebar';

const SellerDashboardLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-gray-100"> {/* उदाहरण लेआउट */}
      {/* 1. साइडबार */}
      <aside className="w-64 bg-white shadow-md p-4">
        <h2 className="text-xl font-bold mb-4">Seller Panel</h2>
        <nav>
          <ul>
            <li className="mb-2">
              <Link 
                to="/seller" 
                className="block p-2 rounded hover:bg-gray-200"
              >
                Dashboard
              </Link>
            </li>
            <li className="mb-2">
              <Link 
                to="/seller/apply" 
                className="block p-2 rounded hover:bg-gray-200"
              >
                Apply
              </Link>
            </li>
            <li className="mb-2">
              <Link 
                to="/seller/status" 
                className="block p-2 rounded hover:bg-gray-200"
              >
                Status
              </Link>
            </li>
            <li className="mb-2">
              <Link 
                to="/seller/profile/edit" 
                className="block p-2 rounded hover:bg-gray-200"
              >
                Edit Profile
              </Link>
            </li>
            <li className="mb-2">
              <Link 
                to="/seller/delivery-settings" 
                className="block p-2 rounded hover:bg-gray-200"
              >
                Delivery Settings
              </Link>
            </li>
            {/* यहाँ अन्य सेलर नेविगेशन लिंक्स जोड़ें */}
          </ul>
        </nav>
      </aside>

      {/* 2. मुख्य सामग्री क्षेत्र */}
      <div className="flex-1 p-8">
        {/* <Outlet /> वह जगह है जहाँ नेस्टेड रूट्स (जैसे SellerDashboard, SellerApplyPage) रेंडर होंगे */}
        <Outlet /> 
      </div>
    </div>
  );
};

export default SellerDashboardLayout;
