// client/src/components/layout/SellerSidebar.tsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, Settings, User, TrendingUp, FileText, MoreVertical } from 'lucide-react';

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
          asChild
          isActive={active}
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
      {/* 🚨 SidebarHeader के className को एडजस्ट किया गया है */}
      {/* अब यह 'p-4' (चारों ओर 1rem पैडिंग) का उपयोग करेगा,
          और 'justify-between' सुनिश्चित करेगा कि आइकन और टेक्स्ट के बीच जगह रहे। */}
      <SidebarHeader className="flex items-center justify-between p-4">
        {(sidebarState === "expanded" || isMobile) ? ( // 🚨 यहां एक शर्त जोड़ी गई है
          <div className="flex items-center">
            <TrendingUp className="h-6 w-6 text-indigo-600 mr-2" />
            <h2 className="text-lg font-bold text-gray-800">
              Seller Hub
            </h2>
          </div>
        ) : (
          // जब साइडबार कोलैप्स हो, तो केवल आइकन ही दिखना चाहिए, 'Seller Hub' नहीं।
          // यह तभी रेंडर होगा जब isMobile न हो और sidebarState 'collapsed' हो।
          // SidebarTrigger अपने आप में यह आइकन दिखाता है।
          // इसलिए, यदि साइडबार कोलैप्स है, तो हम Seller Hub टेक्स्ट को नहीं दिखाएँगे।
          // यदि आप कोलैप्स किए गए राज्य में भी कुछ आइकन दिखाना चाहते हैं,
          // तो आप यहां एक छोटा आइकन जोड़ सकते हैं।
          null // 🚨 यहां बदलाव: कोलैप्स होने पर Seller Hub टेक्स्ट/आइकन नहीं दिखेगा
        )}

        {!isMobile && (
          // SidebarTrigger को बिना 'asChild' के उपयोग करें।
          // इसकी पैडिंग और पोजीशनिंग sidebar.tsx से नियंत्रित होगी।
          // यदि अभी भी समस्या है, तो हमें sidebar.tsx में SidebarTrigger के className को देखना होगा।
          <SidebarTrigger />
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

      <SidebarFooter className="mt-auto pt-4 border-t border-gray-200 p-2">
        {(sidebarState === "expanded" || isMobile) && (
          <p className="text-xs text-gray-500">© 2024 Aapani Dukan</p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default SellerSidebar;

