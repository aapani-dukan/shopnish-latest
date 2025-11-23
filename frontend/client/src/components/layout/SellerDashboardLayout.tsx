// client/src/components/layout/SellerDashboardLayout.tsx

import React from 'react';
import { Outlet } from 'react-router-dom'; 
import SellerSidebar from './SellerSidebar'; 

// sidebar.tsx से आवश्यक कंपोनेंट्स इम्पोर्ट करें
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  useSidebar
} from '../ui/sidebar';

import { Button } from '../ui/button';
import { PanelLeft } from 'lucide-react';

const SellerDashboardLayout: React.FC = () => {
  return (
    // SidebarProvider पूरे लेआउट को रैप करेगा
    <SidebarProvider>
      {/* LayoutContent अब SidebarProvider का सीधा बच्चा है */}
      <LayoutContent />
    </SidebarProvider>
  );
};

// एक सहायक कंपोनेंट जो SidebarProvider के संदर्भ का उपयोग करता है
const LayoutContent: React.FC = () => {
  const { toggleSidebar, isMobile } = useSidebar();

  return (
    // यह outer div SidebarProvider के 'group/sidebar-wrapper' div के child के रूप में रेंडर होगा।
    // हमें यह सुनिश्चित करना होगा कि इसमें एक ही child हो, यदि 'group/sidebar-wrapper' div ऐसा ही चाहता है।
    // लेकिन आम तौर पर, SidebarProvider का 'children' प्रॉप कई बच्चों को स्वीकार करता है।
    //
    // समस्या 'SidebarProvider' के children में नहीं, बल्कि 'Sidebar' कंपोनेंट के
    // अंदर के 'Sheet' या 'Tooltip' में हो सकती है।
    //
    // इस त्रुटि का सबसे आम कारण यह होता है कि `SheetTrigger` या `TooltipTrigger` को
    // एक से अधिक child दिए जाते हैं, या कोई child नहीं दिया जाता है।
    //
    // चूंकि हमने SellerSidebar में `asChild` को ठीक कर दिया है,
    // अब हमें `LayoutContent` के स्ट्रक्चर को देखना होगा।
    //
    // SidebarProvider का child सीधे `Sidebar` और `SidebarInset` होना चाहिए।
    // यदि `isMobile` है, तो हमें `header` को भी शामिल करना होगा।
    //
    // आइए `isMobile` हेडर को `SidebarProvider` के बाहर ही रखें,
    // ताकि वह लेआउट का हिस्सा न बने बल्कि एक ओवरले के रूप में काम करे।
    //
    // **अंतिम प्रयास का तरीका:**
    // हम एक टॉप-लेवल `div` रखेंगे, और `isMobile` हेडर को सशर्त रूप से उस `div` के बाहर रेंडर करेंगे,
    // या हम इसे `SidebarProvider` के भीतर लेकिन `Sidebar` और `SidebarInset` के बाहर रखेंगे।

    <> {/* React Fragment का उपयोग करें ताकि हम एक से अधिक टॉप-लेवल एलिमेंट रेंडर कर सकें */}
      {isMobile && (
        // मोबाइल हेडर को `SidebarProvider` के बाहर रखें ताकि यह `children` काउंट को प्रभावित न करे।
        // या, इसे SidebarProvider के अंदर, लेकिन SellerSidebar/SidebarInset के "बाहर" रखें।
        // इसे यहां रखना सुरक्षित है क्योंकि यह एक फिक्स्ड ओवरले है।
        <header className="fixed top-0 left-0 w-full bg-white shadow-sm p-3 z-20 flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidebar}
            className="h-8 w-8"
          >
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
          <h1 className="ml-4 text-xl font-bold text-gray-800">Seller Hub</h1>
        </header>
      )}

      {/* यह वह div है जो SidebarProvider के children के रूप में रेंडर होगा।
          इसके बच्चों को Sidebar और SidebarInset होना चाहिए, जो flexbox में होंगे। */}
      <div className="min-h-screen bg-gray-100 flex"> {/* यह div SidebarProvider के child के रूप में काम करता है */}
        {/* SellerSidebar कंपोनेंट */}
        <SellerSidebar />
        
        {/* मुख्य कंटेंट एरिया अब SidebarInset द्वारा हैंडल किया जाएगा */}
        {/* ध्यान दें: SidebarInset खुद अपने पैडिंग और बैकग्राउंड को हैंडल कर सकता है। */}
        <SidebarInset className={isMobile ? "mt-[56px]" : ""}>
          <div className="p-8 overflow-y-auto w-full">
            <Outlet /> 
          </div>
        </SidebarInset>
      </div>
    </>
  );
};

export default SellerDashboardLayout;
