// client/src/pages/DeliveryLogin.tsx

import { useState } from "react"; // `useState` में `usestate` को ठीक किया
import { useToast } from "@/hooks/use-toast"; // `@/hooks/use-toast` का पथ भी `hooks` से है, `/hooks` नहीं
import { Button } from "@/components/ui/button"; // `Button` में `button` को ठीक किया
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // `Card`, `CardContent`, `CardHeader`, `CardTitle` को ठीक किया
import { useNavigate } from "react-router-dom"; // `useNavigate` में `usenavigate` को ठीक किया
import { Truck } from "lucide-react"; // `Truck` में `truck` को ठीक किया
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth"; // `signInWithPopup`, `GoogleAuthProvider` में `signinwithpopup`, `googleauthprovider` को ठीक किया
import { auth } from "@/lib/firebase"; // `auth` में `auth` को ठीक किया, `@/lib` का उपयोग किया
import { apiRequest } from "@/lib/queryClient"; // `apiRequest` में `apirequest` को ठीक किया, `@/lib` का उपयोग किया

export default function DeliveryLogin() { // `DeliveryLogin` में `deliverylogin` को ठीक किया
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false); // `setLoading` में `setloading` को ठीक किया, `useState` में `usestate` को ठीक किया

  const handleGoogleLogin = async () => { // `handleGoogleLogin` में `handlegooglelogin` को ठीक किया
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider(); // `GoogleAuthProvider` को ठीक किया
      const result = await signInWithPopup(auth, provider); // `signInWithPopup` को ठीक किया

      if (result && result.user) {
        const user = result.user;
        const token = await user.getIdToken(); // `getIdToken` में `getidtoken` को ठीक किया

        // बैकएंड को प्रमाणीकरण के लिए API call करें
        const backendResponse = await apiRequest("POST", "/api/delivery/login", { // `backendResponse` में `backendresponse` को ठीक किया, `POST` में `post` को ठीक किया
          firebaseUid: user.uid, // `firebaseUid` में `firebaseuid` को ठीक किया
          email: user.email || "",
          name: user.displayName || user.email || "", // `displayName` में `displayname` को ठीक किया
        });
        
        const deliveryBoy = { ...backendResponse.user, role: "delivery" }; // `deliveryBoy` में `deliveryboy` को ठीक किया, `backendResponse` को ठीक किया
        
        if (!deliveryBoy) {
          throw new Error("Delivery boy data not received from backend."); // `Error` में `error` को ठीक किया
        }

        // localStorage में टोकन और ईमेल सेव करें (वैकल्पिक)
        localStorage.setItem("deliveryBoyToken", token); // `localStorage.setItem` में `localstorage.setitem` को ठीक किया, "deliveryBoyToken" को ठीक किया
        localStorage.setItem("deliveryBoyEmail", deliveryBoy.email || ""); // "deliveryBoyEmail" को ठीक किया

        if (deliveryBoy.approvalStatus === "approved") { // `approvalStatus` में `approvalstatus` को ठीक किया
          toast({ title: "Login Successful", description: `Welcome ${deliveryBoy.name || deliveryBoy.email}` }); // `Login Successful` और `Welcome` में `login successful` और `welcome` को ठीक किया
          navigate("/delivery-page");
        } else {
          toast({
            title: "Approval Pending",
            description: "You are not approved yet. Please wait for admin approval.", // `Approval Pending` और `You are not approved yet` में `approval pending` और `you are not approved yet` को ठीक किया
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      console.error("Delivery login (popup) failed:", err); // `Delivery login` को ठीक किया
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        toast({
          title: "Login Failed",
          description: err.message || "Something went wrong during login.", // `Login Failed` और `Something went wrong` में `login failed` और `something went wrong` को ठीक किया
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => { // `handleRegister` में `handleregister` को ठीक किया
    navigate("/delivery-apply");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12"> {/* `className` में `classname` को ठीक किया */}
      <div className="max-w-md w-full"> {/* `className` में `classname` को ठीक किया */}
        <Card className="shadow-xl"> {/* `Card` और `className` को ठीक किया */}
          <CardHeader className="text-center"> {/* `CardHeader` और `className` को ठीक किया */}
            <div className="w-16 h-16 mx-auto bg-blue-600 rounded-full flex items-center justify-center mb-4"> {/* `className` में `classname` को ठीक किया */}
              <Truck className="w-8 h-8 text-white" /> {/* `Truck` और `className` को ठीक किया */}
            </div>
            <CardTitle className="text-2xl font-bold">Welcome Delivery Boy</CardTitle> {/* `CardTitle` और `className` को ठीक किया */}
          </CardHeader>
          <CardContent className="space-y-4"> {/* `CardContent` और `className` को ठीक किया */}
            <Button // `Button` को ठीक किया
              className="w-full" // `className` में `classname` को ठीक किया
              onClick={handleGoogleLogin} // `onClick` में `onclick` को ठीक किया, `handleGoogleLogin` को ठीक किया
              disabled={loading}
            >
              {loading ? "Checking..." : "Login with Google"} {/* "Checking..." और "Login with Google" में "checking..." और "login with google" को ठीक किया */}
            </Button>
            <Button // `Button` को ठीक किया
              variant="outline"
              className="w-full" // `className` में `classname` को ठीक किया
              onClick={handleRegister} // `onClick` में `onclick` को ठीक किया, `handleRegister` को ठीक किया
              disabled={loading}
            >
              Register
            </Button>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-gray-600"> {/* `className` में `classname` को ठीक किया */}
          Need help? Contact support@shopnish.com {/* "Need help?" को ठीक किया */}
        </p>
      </div>
    </div>
  );
}
