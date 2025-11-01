import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield } from "lucide-react";
import {getAuth, signInWithEmailAndPassword, onAuthStateChanged} from "firebase/auth";
import { firebaseApp } from "@/lib/firebase";

export default function AdminLogin() { // ✅ 'AdminLogin'
  const navigate = useNavigate(); // ✅ 'useNavigate'
  const { toast } = useToast(); // ✅ 'useToast'
  const [email, setEmail] = useState(""); // ✅ Email state जोड़ा
  const [password, setPassword] = useState(""); // ✅ 'setPassword'
  const [loading, setLoading] = useState(false); // ✅ 'setLoading'
  const auth = getAuth(firebaseApp); // ✅ Firebase app को getAuth में पास करें

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          if (idTokenResult.claims.admin) {
            navigate("/admin/dashboard", { replace: true });
          } else {
            await auth.signOut();
            toast({
              title: "Access Denied",
              description: "You are not authorized to access the admin panel.",
              variant: "destructive",
            });
          }
        } catch (error: any) {
          console.error("Error checking admin claims:", error);
          toast({
            title: "Authentication Error",
            description: error.message || "Failed to verify admin status.",
            variant: "destructive",
          });
          setLoading(false); 
        }
      } else {
        setLoading(false); 
      }
    });
    return () => unsubscribe();
  }, [navigate, toast, auth]);


  const handleLogin = async () => { // ✅ 'handleLogin'
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      
      toast({
        title: "Login Successful",
        description: "Verifying admin access...",
      });
      
    } catch (err: any) {
      toast({
        title: "Login Failed",
        description: err.message || "An unknown error occurred during login.",
        variant: "destructive",
      });
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
          <CardDescription className="text-muted-foreground">
            विक्रेता और उत्पाद प्रबंधन के लिए सुरक्षित एडमिन पैनल
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Admin Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
            <Button
              onClick={handleLogin}
              className="w-full"
              size="lg"
              disabled={loading || !email || !password}
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
