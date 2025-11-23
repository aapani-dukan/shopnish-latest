// client/src/components/layout/SellerSidebar.tsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, Settings, User, TrendingUp, FileText, PanelLeft } from 'lucide-react';

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger, // इसे यहां रहने दें
  useSidebar
} from '../ui/sidebar';

import { Button } from '../ui/button';

// TooltipProvider को SellerDashboardLayout में ही रहने दें, यहां इसकी आवश्यकता नहीं है।

const SellerSidebar: React.FC = () => {
  const location = useLocation();
  const { state: sidebarState, isMobile } = useSidebar();

  const isactive = (path: string) => location.pathname === path;

  const MenuItem = ({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) => {
    const active = isactive(to);
    return (
      <SidebarMenuItem>
        {/* यहां बदलाव किया गया है:
          SidebarMenuButton के अंदर Link को सीधे child के रूप में रखें।
          Link खुद एक HTML 'a' टैग के रूप में रेंडर होगा।
          SidebarMenuButton स्वयं एक <button> टैग या 'asChild' प्रॉप के आधार पर कुछ और रेंडर करेगा।
          TooltipTrigger को SidebarMenuButton के अंदर के <button> (या जो भी SidebarMenuButton रेंडर करता है)
          को सीधे प्राप्त करना चाहिए।

          महत्वपूर्ण: sidebar.tsx में SidebarMenuButton के 'asChild' प्रॉप को समझें।
          यदि sidebar.tsx में sidebarmenubutton के पास 'asChild' है, तो उसे child के रूप में
          एक React एलिमेंट की उम्मीद होगी, जिसे वह अपने प्रॉप्स के साथ क्लोन करेगा।
          यदि sidebar.tsx में SidebarMenuButton के अंदर Link को asChild के रूप में पास किया जाता है,
          तो SidebarMenuButton खुद Link बन जाएगा।

          लेकिन, चूंकि TooltipTrigger को 'asChild' के साथ SidebarMenuButton मिलता है,
          इसका मतलब है कि TooltipTrigger को SidebarMenuButton को क्लोन करना चाहिए।
          SidebarMenuButton के अंदर फिर Link है। यह नेस्टिंग समस्या पैदा कर सकता है।

          सबसे सरल तरीका है: SidebarMenuButton को एक बटन के रूप में रेंडर होने दें,
          और उसके children के रूप में Link को रेंडर करें (या Link के content को)।
          लेकिन Link को पूरे बटन पर clickable बनाने के लिए, हमें Link को ही Button बनाना होगा।

          आइए इसे ऐसे करें: SidebarMenuButton के 'asChild' के रूप में Link को पास करें,
          और 'Link' के अंदर आइकन और टेक्स्ट रखें। यह सबसे स्टैंडर्ड Shadcn 'asChild' पैटर्न है।
        */}
        <SidebarMenuButton
          asChild // SidebarMenuButton को Link के रूप में रेंडर करें
          isactive={active}
          tooltip={label} // Tooltip को Link पर ही दिखाया जाएगा
          className="w-full justify-start"
        >
          <Link to={to} className="flex items-center"> {/* Link ही अब बटन के रूप में काम करेगा */}
            <Icon className="h-5 w-5 mr-3" />
            <span className={sidebarState === "collapsed" && !isMobile ? "sr-only" : ""}>
              {label}
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar
      side="left"
      variant="sidebar"
      collapsible="icon"
    >
      <SidebarHeader className="flex items-center justify-between p-4">
        {(sidebarState === "expanded" || isMobile) && (
          <div className="flex items-center">
            <TrendingUp className="h-6 w-6 text-indigo-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-800">Seller Hub</h2>
          </div>
        )}
        {!isMobile && (
          // सुनिश्चित करें कि SidebarTrigger को भी एक ही child मिले
          <SidebarTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <PanelLeft className="h-4 w-4" />
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
          </SidebarTrigger>
        )}
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-y-auto p-2">
        <SidebarMenu>
          <MenuItem to="/seller-dashboard" icon={TrendingUp} label="Dashboard" />
          <MenuItem to="/seller-dashboard/products" icon={Package} label="Products" />
          <MenuItem to="/seller-dashboard/orders" icon={ShoppingCart} label="Orders" />
          <MenuItem to="/seller-dashboard/profile/edit" icon={User} label="Profile" />
          <MenuItem to="/seller-dashboard/delivery-settings" icon={Settings} label="Delivery Settings" />
          <MenuItem to="/seller-dashboard/apply" icon={FileText} label="Application Status" />
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter className="mt-auto pt-4 border-t border-gray-200">
        {(sidebarState === "expanded" || isMobile) && (
          <p className="text-xs text-gray-500">© 2024 Aapani Dukan</p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default SellerSidebar;
