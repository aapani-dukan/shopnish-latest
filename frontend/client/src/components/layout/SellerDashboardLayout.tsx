// client/src/components/layout/SellerDashboardLayout.tsx

import React from 'react';
import { Outlet, Link } from 'react-router-dom'; 
import SellerSidebar from './SellerSidebar'; 

// sidebar.tsx से आवश्यक कंपोनेंट्स इम्पोर्ट करें
import {
  SidebarProvider,
  SidebarInset,
  useSidebar
} from '../ui/sidebar';

import { Button } from '../ui/button';
//import { PanelLeft } from 'lucide-react';

import { ShoppingCart, Menu } from 'lucide-react'; // Menu आइकन का उपयोग कर रहा हूँ


const SellerDashboardLayout: React.FC = () => {
  return (
    // SidebarProvider पूरे लेआउट को रैप करेगा
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
};

// एक सहायक कंपोनेंट जो SidebarProvider के संदर्भ का उपयोग करता है
const LayoutContent: React.FC = () => {
  const { toggleSidebar, isMobile } = useSidebar();

  // हेडर की ऊंचाई को Tailwind classes से अनुमानित करें, उदा. h-14 (56px)
  // या आप इसे CSS वेरिएबल में भी सेट कर सकते हैं।
  const HEADER_HEIGHT_CLASS = "h-14"; // लगभग 56px

  return (
    <div className="flex min-h-screen w-full bg-background"> {/* मुख्य फ्लेक्स कंटेनर */}
      {/* 🚨 टॉप हेडर (Shopnish, कार्ट, मोबाइल साइडबार ट्रिगर) */}
      {/* यह हेडर Sidebar के ऊपर होगा */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b bg-card px-4 ${HEADER_HEIGHT_CLASS}`}
      >
        <div className="flex items-center">
          {/* मोबाइल पर साइडबार ट्रिगर */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="mr-2"
            >
              <Menu className="h-5 w-5" /> {/* मोबाइल के लिए बर्गर मेनू आइकन */}
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
          )}
          <Link to="/" className="flex items-center space-x-2">
            <h1 className="text-xl font-bold">Shopnish</h1> {/* आपका ऐप नाम */}
          </Link>
        </div>

        <nav className="flex items-center space-x-4">
          <Link to="/cart">
            <Button variant="ghost" size="icon">
              <ShoppingCart className="h-5 w-5" />
              <span className="sr-only">Cart</span>
            </Button>
          </Link>
          {/* अन्य हेडर आइटम यहाँ आ सकते हैं */}
        </nav>
      </header>

      {/* मुख्य लेआउट कंटेंट, हेडर के नीचे से शुरू होगा */}
      {/* `pt-[calc(theme(spacing.14))]` हेडर की ऊंचाई के बराबर पैडिंग-टॉप देता है */}
      <div className={`flex flex-1 ${isMobile ? 'flex-col' : ''} pt-[calc(theme(spacing.14))]`}>
        {/* SellerSidebar कंपोनेंट */}
        {/* यह सुनिश्चित करेगा कि साइडबार हेडर के नीचे से शुरू हो */}
        <div className={`relative ${isMobile ? 'w-full' : ''}`}>
           <SellerSidebar />
        </div>

        {/* मुख्य कंटेंट एरिया अब SidebarInset द्वारा हैंडल किया जाएगा */}
        {/* `SidebarInset` को अब मुख्य `div` का एक बच्चा होना चाहिए */}
        <SidebarInset className="flex-1"> {/* SidebarInset को Flex-1 दें ताकि यह शेष जगह ले */}
          <div className="p-8 overflow-y-auto w-full"> {/* यहां आपका Outlet कंटेंट होगा */}
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </div>
  );
};

export default SellerDashboardLayout;
