// client/src/components/layout/SellerDashboardLayout.tsx

import React from 'react';
import { Outlet } from 'react-router-dom'; 
import SellerSidebar from './SellerSidebar'; 

const SellerDashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      

      <div className="flex flex-1">
      
        <SellerSidebar />
        
        <main className="flex-1 p-8 overflow-y-auto">
          
          <Outlet /> 
        </main>
      </div>
    </div>
  );
};

export default SellerDashboardLayout;
