// client/src/components/layout/SellerDashboardLayout.tsx

import React from 'react';
import { Outlet } from 'react-router-dom'; 
import SellerSidebar from './SellerSidebar'; 

// sidebar.tsx से आवश्यक कंपोनेंट्स इम्पोर्ट करें
import {
  SidebarProvider, // मुख्य प्रोवाइडर जो साइडबार की स्थिति को प्रबंधित करता है
  SidebarTrigger,   // साइडबार को टॉगल करने के लिए बटन (मोबाइल पर)
  SidebarInset,     // मुख्य कंटेंट एरिया के लिए कंपोनेंट
  useSidebar        // साइडबार की स्थिति तक पहुँचने के लिए (वैकल्पिक, लेकिन उपयोगी)
} from '../ui/sidebar'; // आपके sidebar.tsx फाइल का सही पाथ

import { Button } from '../ui/button'; // Shadcn UI बटन
import { PanelLeft } from 'lucide-react'; // हैमबर्गर आइकन

const SellerDashboardLayout: React.FC = () => {
  // useSidebar हुक का उपयोग करके साइडबार की वर्तमान स्थिति प्राप्त करें
  // यह हमें मोबाइल पर रहते हुए ही एक विशिष्ट टॉगल बटन दिखाने की अनुमति देता है
  const { toggleSidebar, isMobile } = useSidebar(); // useSidebar को SidebarProvider के अंदर से एक्सेस किया जाना चाहिए

  return (
    // SidebarProvider पूरे लेआउट को रैप करेगा ताकि सभी बच्चे साइडबार की स्थिति तक पहुंच सकें
    <SidebarProvider>
      {/*
        SidebarProvider के अंदर, हम useSidebar को फिर से कॉल करते हैं
        ताकि हम वर्तमान संदर्भ से isMobile और toggleSidebar को प्राप्त कर सकें।
        यह एक छोटा सा री-रेंडरिंग है लेकिन यह सुनिश्चित करता है कि हुक सही संदर्भ में है।
      */}
      <LayoutContent />
    </SidebarProvider>
  );
};

// एक सहायक कंपोनेंट जो SidebarProvider के संदर्भ का उपयोग करता है
const LayoutContent: React.FC = () => {
  const { toggleSidebar, isMobile } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-100 flex"> {/* 'flex-col' हटाया, अब साइडबार खुद ही फिक्स्ड होगा */}
      {/* मोबाइल पर ऊपर-बाएं कोने में हैमबर्गर मेनू */}
      {isMobile && (
        <header className="fixed top-0 left-0 w-full bg-white shadow-sm p-3 z-20 flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleSidebar} // मोबाइल साइडबार को टॉगल करने के लिए
            className="h-8 w-8"
          >
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
          <h1 className="ml-4 text-xl font-bold text-gray-800">Seller Hub</h1> {/* मोबाइल हेडर टाइटल */}
        </header>
      )}

      {/* SellerSidebar कंपोनेंट, जिसे हमने अपडेट किया है */}
      <SellerSidebar />
      
      {/* मुख्य कंटेंट एरिया अब SidebarInset द्वारा हैंडल किया जाएगा */}
      {/* md:mt-[56px] (यदि मोबाइल हेडर है) या कोई अन्य मार्जिन जोड़ें ताकि कंटेंट हेडर के नीचे से शुरू हो */}
      <SidebarInset className={isMobile ? "mt-[56px]" : ""}> {/* मोबाइल पर हेडर के लिए मार्जिन */}
        <div className="p-8 overflow-y-auto w-full"> {/* Inner div for padding and scroll */}
          <Outlet /> 
        </div>
      </SidebarInset>
    </div>
  );
};

export default SellerDashboardLayout;
