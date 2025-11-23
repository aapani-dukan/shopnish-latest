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
  return (
    // SidebarProvider पूरे लेआउट को रैप करेगा ताकि सभी बच्चे साइडबार की स्थिति तक पहुंच सकें
    <SidebarProvider>
      {/* LayoutContent अब SidebarProvider का सीधा बच्चा है,
          इसलिए इसके अंदर useSidebar का उपयोग करना सुरक्षित है। */}
      <LayoutContent />
    </SidebarProvider>
  );
};

// एक सहायक कंपोनेंट जो SidebarProvider के संदर्भ का उपयोग करता है
const LayoutContent: React.FC = () => {
  // अब useSidebar को यहाँ कॉल करना सुरक्षित है, क्योंकि LayoutContent SidebarProvider के अंदर है।
  const { toggleSidebar, isMobile } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-100 flex">
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

      {/* SellerSidebar कंपोनेंट */}
      <SellerSidebar />
      
      {/* मुख्य कंटेंट एरिया अब SidebarInset द्वारा हैंडल किया जाएगा */}
      <SidebarInset className={isMobile ? "mt-[56px]" : ""}> {/* मोबाइल पर हेडर के लिए मार्जिन */}
        <div className="p-8 overflow-y-auto w-full"> {/* Inner div for padding and scroll */}
          <Outlet /> 
        </div>
      </SidebarInset>
    </div>
  );
};

export default SellerDashboardLayout;
