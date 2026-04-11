import { useEffect, useState } from "react";
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
    // ⏳ Wait for Auth to load
    if (isLoadingAuth) return;
    
    // 🛡️ Guard: Login check
    if (!isAuthenticated) {
      navigate("/login", { replace: true }); // "/auth" ko "/login" kiya (naye page ke hisab se)
      return;
    }
    
    if (user) {
      // ✅ Role & Profile Check
      // Hum 'seller' role ya 'isSeller' boolean dono check kar rahe hain
      const isActuallySeller = user.role === "seller" || !!user.sellerProfile;
      const approvalStatus = user.sellerProfile?.approvalStatus || user.sellerApprovalStatus;

      if (isActuallySeller) {
        if (approvalStatus === "approved") {
          toast({
            title: "लॉगिन सफल! 🏪",
            description: "आपको विक्रेता डैशबोर्ड पर भेजा जा रहा है।"
          });
          navigate("/seller-dashboard", { replace: true });
        } else if (approvalStatus === "pending") {
          toast({
            title: "आवेदन लंबित है ⏳",
            description: "आपका आवेदन अभी समीक्षा में है। कृपया प्रतीक्षा करें।"
          });
          setIsDialogOpen(false);
          // Optional: Redirect to a 'Thank You' or 'Status' page instead of just white screen
          navigate("/", { replace: true });
        } else {
          // 'rejected' ya naya seller profile (no status)
          setIsDialogOpen(true);
        }
      } else {
        // Agar role 'seller' nahi hai, toh onboarding dikhao
        setIsDialogOpen(true);
      }
    }
    
  }, [isAuthenticated, isLoadingAuth, user, navigate, toast]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      {isLoadingAuth ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold">Verifying Seller Status...</p>
        </div>
      ) : (
        <SellerOnboardingDialog
          isOpen={isDialogOpen}
          onClose={() => navigate("/", { replace: true })}
        />
      )}
    </div>
  );
};

export default SellerApply;