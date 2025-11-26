// client/src/components/layout/SellerSidebar.tsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, Settings, User, TrendingUp, FileText, MoreVertical } from 'lucide-react'; // PanelLeft के बजाय MoreVertical आयात करें

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar
} from '../ui/sidebar';

import { Button } from '../ui/button';

const SellerSidebar: React.FC = () => {
  const location = useLocation();
  const { state: sidebarState, isMobile } = useSidebar();

  const isactive = (path: string) => location.pathname === path;

  const MenuItem = ({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) => {
    const active = isactive(to);
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild // SidebarMenuButton को Link के रूप में रेंडर करें
          isActive={active} // isActive प्रॉप को सही केसिंग में बदलें
          tooltip={label}
          className="w-full justify-start"
        >
          <Link to={to} className="flex items-center">
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
      <SidebarHeader className="flex items-center justify-between p-2 pb-0"> {/* 🚨 पैडिंग कम की गई */}
        {(sidebarState === "expanded" || isMobile) && (
          <div className="flex items-center">
            <TrendingUp className="h-6 w-6 text-indigo-600 mr-2" />
            <h2 className="text-lg font-bold text-gray-800"> {/* 🚨 text-xl से text-lg किया गया */}
              Seller Hub
            </h2>
          </div>
        )}
        {!isMobile && (
          // SidebarTrigger को बिना 'asChild' के उपयोग करें ताकि यह अपने डिफ़ॉल्ट आइकन को रेंडर करे
          // और 'h-7 w-7' क्लास पहले से ही sidebar.tsx में सेट है।
          <SidebarTrigger /> // 🚨 SidebarTrigger को सरल किया गया
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

      <SidebarFooter className="mt-auto pt-4 border-t border-gray-200 p-2"> {/* 🚨 पैडिंग जोड़ी गई */}
        {(sidebarState === "expanded" || isMobile) && (
          <p className="text-xs text-gray-500">© 2024 Aapani Dukan</p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default SellerSidebar;
