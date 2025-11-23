// client/src/components/layout/sellersidebar.tsx

import React from 'react'; // 'react' को 'React' के रूप में इम्पोर्ट करें
import { Link, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, Settings, User, TrendingUp, FileText, PanelLeft } from 'lucide-react'; // PanelLeft आइकन जोड़ा गया

// sidebar.tsx से आवश्यक कंपोनेंट्स इम्पोर्ट करें
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger, // यदि आप इसे साइडबार के अंदर टॉगल बटन के रूप में चाहते हैं
  useSidebar // यदि हमें साइडबार की स्थिति जानने की आवश्यकता है
} from '../ui/sidebar'; // आपके sidebar.tsx फाइल का सही पाथ

// आपके ui/button से Button कंपोनेंट
import { Button } from '../ui/button'; 

// shadcn/ui से tooltip कंपोनेंट्स को भी इम्पोर्ट करें ताकि sidebarMenuButton टूलटिप दिखा सके
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';


const SellerSidebar: React.FC = () => { // फंक्शन का नाम PascalCase में होना चाहिए
  const location = useLocation();
  const { state: sidebarState, isMobile } = useSidebar(); // sidebar state प्राप्त करें

  const isactive = (path: string) => location.pathname === path;

  // SidebarMenuButton को एक फंक्शन के रूप में परिभाषित करें ताकि हम टूलटिप और सक्रिय स्थिति को हैंडल कर सकें
  const MenuItem = ({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) => {
    const active = isactive(to);
    return (
      <SidebarMenuItem>
        <Link to={to} className="w-full"> {/* Link को पूरे बटन पर स्ट्रेच करें */}
          <SidebarMenuButton
            isactive={active}
            tooltip={label} // टूलटिप के रूप में लेबल दिखाएं
            className="w-full justify-start" // लिंक को बाईं ओर संरेखित करें
          >
            <Icon className="h-5 w-5 mr-3" />
            <span className={sidebarState === "collapsed" && !isMobile ? "sr-only" : ""}>
              {label}
            </span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    );
  };

  return (
    // 'sidebar.tsx' से Sidebar कंपोनेंट का उपयोग करें
    // 'collapsible' प्रॉप इसे मोबाइल पर ऑफकैंपस (शीट) और डेस्कटॉप पर आइकन-ओनली (संकुचित) बनाता है
    <Sidebar
      side="left"
      variant="sidebar" // या 'floating', 'inset' - आपकी पसंद के अनुसार
      collapsible="icon" // 'icon' या 'offcanvas' (यदि आप डेस्कटॉप पर भी इसे संकुचित करना चाहते हैं)
    >
      <SidebarHeader className="flex items-center justify-between p-4">
        {/* लोगो/शीर्षक केवल विस्तारित होने पर या मोबाइल पर दिखाएं */}
        {(sidebarState === "expanded" || isMobile) && (
          <div className="flex items-center">
            <TrendingUp className="h-6 w-6 text-indigo-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-800">Seller Hub</h2>
          </div>
        )}
        {/* डेस्कटॉप पर साइडबार को टॉगल करने के लिए बटन (यदि collapsible="icon" है) */}
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
