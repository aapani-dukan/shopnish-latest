import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import SellerOnboardingDialog from "@/components/seller/SellerOnboardingDialog";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const SellerApply = () => {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // ✅ सभी Auth डेटा लोड होने तक प्रतीक्षा करें
    if (isLoadingAuth) {
      return;
    }
    
    if (!isAuthenticated) {
      navigate("/auth", { replace: true });
      return;
    }
    
    if (user) {
      // ✅ उपयोगकर्ता की भूमिका के आधार पर लॉजिक
      if (user.role === "seller") {
        const approvalStatus = user.sellerProfile?.approvalStatus;
        if (approvalStatus === "approved") {
          // ✅ यदि विक्रेता अनुमोदित है, तो डैशबोर्ड पर भेजें
          toast({
            title: "लॉगिन सफल!",
            description: "आपको विक्रेता डैशबोर्ड पर रीडायरेक्ट किया जा रहा है।"
          });
          navigate("/seller-dashboard", { replace: true });
        } else if (approvalStatus === "pending") {
          // ✅ यदि लंबित है, तो एक पॉपअप दिखाएं
          toast({
            title: "आवेदन लंबित है",
            description: "आपका आवेदन अभी भी समीक्षाधीन है। कृपया अनुमोदन की प्रतीक्षा करें।"
          });
          // फ़ॉर्म को बंद रखें
          setIsDialogOpen(false);
        } else {
          // ✅ अगर स्टेटस 'rejected' या कोई और है, तो फ़ॉर्म दिखाएं
          setIsDialogOpen(true);
        }
      } else {
        // ✅ यदि रोल 'seller' नहीं है, तो फ़ॉर्म दिखाएं
        setIsDialogOpen(true);
      }
    }
    
  }, [isAuthenticated, isLoadingAuth, user, navigate, toast]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      {/* ✅ लोडिंग पूरी होने के बाद ही डायलॉग रेंडर करें */}
      {!isLoadingAuth && (
        <SellerOnboardingDialog
          isOpen={isDialogOpen}
          onClose={() => navigate("/", { replace: true })}
        />
      )}
    </div>
  );
};

export default SellerApply;

