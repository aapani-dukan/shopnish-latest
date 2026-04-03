import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true); // Shuruat mein true rakha hai jab tak auth check na ho jaye

  useEffect(() => {
    // onAuthStateChanged check karta hai ki kya admin pehle se login hai
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          // Admin claim check ho raha hai
          if (idTokenResult.claims.admin) {
            navigate("/admin/dashboard", { replace: true });
          } else {
            await signOut(auth); // Agar admin nahi hai toh logout kar do
            toast({
              title: "Access Denied",
              description: "You are not authorized to access the admin panel.",
              variant: "destructive",
            });
            setLoading(false);
          }
        } catch (error: any) {
          console.error("Error checking admin claims:", error);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [navigate, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Form refresh hone se rokega
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
        description: err.message || "Invalid credentials.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  if (loading && !email) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-700 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">एडमिन एक्सेस</CardTitle>
          <CardDescription className="text-slate-400">
            विक्रेता और उत्पाद प्रबंधन के लिए सुरक्षित एडमिन पैनल
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Admin Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                className="bg-slate-50"
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="bg-slate-50"
              />
            </div>
            <Button
              type="submit"
              className="w-full py-6 text-lg font-bold"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking...</>
              ) : (
                "एडमिन पैनल में प्रवेश करें"
              )}
            </Button>
          </form>
          <div className="mt-6 text-center text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            Authorized Personnel Only
          </div>
        </CardContent>
      </Card>
    </div>
  );
}