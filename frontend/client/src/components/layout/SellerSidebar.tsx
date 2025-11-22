// client/src/components/layout/SellerSidebar.tsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, Settings, User, TrendingUp, FileText } from 'lucide-react';

const SellerSidebar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  const linkClasses = (path: string) => 
    `flex items-center p-3 rounded-md transition-colors duration-200 ${
      isActive(path) 
        ? 'bg-indigo-100 text-indigo-700 font-medium' 
        : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
    }`;

  return (
    <aside className="w-64 bg-white shadow-md p-4 flex flex-col h-screen sticky top-0">
      <div className="mb-8 flex items-center">
        {/* आप यहाँ अपना लोगो लगा सकते हैं */}
        <TrendingUp className="h-6 w-6 text-indigo-600 mr-2" />
        <h2 className="text-xl font-bold text-gray-800">Seller Hub</h2>
      </div>

      <nav className="flex-1 overflow-y-auto">
        <ul className="space-y-2">
          <li>
            <Link to="/seller-dashboard" className={linkClasses('/seller-dashboard')}>
              <TrendingUp className="h-5 w-5 mr-3" />
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/seller-dashboard/products" className={linkClasses('/seller-dashboard/products')}>
              <Package className="h-5 w-5 mr-3" />
              Products
            </Link>
          </li>
          <li>
            <Link to="/seller-dashboard/orders" className={linkClasses('/seller-dashboard/orders')}>
              <ShoppingCart className="h-5 w-5 mr-3" />
              Orders
            </Link>
          </li>
          <li>
            <Link to="/seller-dashboard/profile/edit" className={linkClasses('/seller-dashboard/profile/edit')}>
              <User className="h-5 w-5 mr-3" />
              Profile
            </Link>
          </li>
          <li>
            <Link to="/seller-dashboard/delivery-settings" className={linkClasses('/seller-dashboard/delivery-settings')}>
              <Settings className="h-5 w-5 mr-3" />
              Delivery Settings
            </Link>
          </li>
           <li>
            <Link to="/seller-dashboard/apply" className={linkClasses('/seller-dashboard/apply')}>
               <FileText className="h-5 w-5 mr-3" />
               Application Status
            </Link>
          </li>
        </ul>
      </nav>
      
      <div className="mt-auto pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">© 2024 Aapani Dukan</p>
      </div>
    </aside>
  );
};

export default SellerSidebar;
