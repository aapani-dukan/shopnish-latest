import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { getAuth, signInWithCustomToken } from "firebase/auth";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // ✅ लॉगिन के बाद नेविगेट करने के लिए useEffect का उपयोग करें
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // ✅ अगर उपयोगकर्ता लॉग इन है, तो डैशबोर्ड पर नेविगेट करें
        navigate("/admin/dashboard", { replace: true });
      }
    });
    return () => unsubscribe();
  }, [navigate]);


  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }
      
      const { customToken } = data;
      
      const auth = getAuth();
      await signInWithCustomToken(auth, customToken);
      
      const idToken = await auth.currentUser?.getIdToken(true);
      if (idToken) {
        localStorage.setItem("authToken", idToken);
      } else {
        throw new Error("Failed to retrieve ID token");
      }
      
      toast({
        title: "Login Successful",
        description: "Welcome Admin!",
      });
      
      // ✅ अब यहां से नेविगेट करने की जरूरत नहीं है, useEffect इसे संभालेगा
      
    } catch (err: any) {
      toast({
        title: "Login Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">एडमिन एक्सेस</CardTitle>
          <p className="text-muted-foreground">
            विक्रेता और उत्पाद प्रबंधन के लिए सुरक्षित एडमिन पैनल
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              onClick={handleLogin}
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? "Logging in..." : "एडमिन पैनल में प्रवेश करें"}
            </Button>
          </div>
          <div className="text-center text-xs text-muted-foreground">
            केवल अधिकृत प्रशासक ही इस पैनल तक पहुँच सकते हैं।
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
