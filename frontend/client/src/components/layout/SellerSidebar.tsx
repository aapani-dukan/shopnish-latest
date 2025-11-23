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
  SidebarSeparator,
  SidebarTrigger,
  useSidebar
} from '../ui/sidebar';

import { Button } from '../ui/button';
// TooltipProvider को SellerSidebarLayout में इम्पोर्ट करना बेहतर है,
// क्योंकि यह Tooltip कंपोनेंट्स के लिए context प्रदान करता है।
// या तो इसे यहां से हटा दें, या सुनिश्चित करें कि आपके पास एक TooltipProvider है।
// (SidebarProvider पहले से ही TooltipProvider को रैप कर रहा है, इसलिए इसकी यहां आवश्यकता नहीं है)
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';


const SellerSidebar: React.FC = () => {
  const location = useLocation();
  const { state: sidebarState, isMobile } = useSidebar();

  const isactive = (path: string) => location.pathname === path;

  const MenuItem = ({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) => {
    const active = isactive(to);
    return (
      <SidebarMenuItem>
        {/*
          यहां बदलाव किया गया है:
          Link को SidebarMenuButton के asChild के रूप में उपयोग करें।
          इससे SidebarMenuButton Link के सभी props प्राप्त करेगा और खुद एक <a/> टैग के रूप में रेंडर होगा।
          यह सुनिश्चित करता है कि TooltipTrigger को एक ही child मिले।
        */}
        <SidebarMenuButton
          asChild // <Link> को child के रूप में प्राप्त करने के लिए
          isactive={active}
          tooltip={label}
          className="w-full justify-start"
        >
          <Link to={to} className="w-full flex items-center"> {/* Link को asChild के रूप में पास करें */}
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

