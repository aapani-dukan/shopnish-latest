import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth"; // Hook se data lene ke liye

export default function AdminLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isAdmin } = useAuth(); // Check user status
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🚩 Basic Check: Pehle OTP se login hona chahiye
    if (!isAuthenticated || !isAdmin) {
      toast({
        title: "Access Denied",
        description: "Bhai, pehle normal OTP login karo, tabhi admin verify hoga.",
        variant: "destructive",
      });
      return navigate("/login");
    }

    setLoading(true);
    try {
      // ✅ Backend ke naye "Password-Only" route ko hit karein
      const response = await fetch("/api/admin-verify-password", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}` // OTP wala token zaroori hai
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.adminVerified) {
        // ✅ 🚩 Sabse IMPORTANT: Password verify hone ka flag set karo
        localStorage.setItem("admin_password_verified", "true");
        
        toast({
          title: "Login Successful",
          description: "Boss, welcome to the control room! 🔥",
        });
        
        navigate("/admin-dashboard", { replace: true });
      } else {
        throw new Error(data.error || "Wrong Admin Password!");
      }
    } catch (err: any) {
      toast({
        title: "Verification Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-700 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold italic tracking-tighter uppercase">एडमिन एक्सेस</CardTitle>
          <CardDescription className="text-slate-400 font-medium uppercase text-[10px] tracking-widest">
             Authorized Personnel Only 🚩
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdminVerify} className="space-y-4">
            {/* ✅ Email Box ki zaroorat nahi, sirf Password mangenge */}
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter Secret Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="bg-slate-50 text-center py-6 text-lg"
                autoFocus
              />
            </div>
            
            <Button
              type="submit"
              className="w-full py-6 text-lg font-bold bg-blue-600 hover:bg-blue-700"
              disabled={loading || !password}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying...</>
              ) : (
                "अनलोक डैशबोर्ड"
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            Secure Session Monitoring Enabled
          </div>
        </CardContent>
      </Card>
    </div>
  );
}