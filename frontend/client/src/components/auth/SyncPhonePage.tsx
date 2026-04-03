import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";

export default function SyncPhonePage() {
  const { tempData, setMustSyncPhone, setTempData } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) return alert("10 digit number dalo bhai!");

    setLoading(true);
    try {
      const res = await api.post("/api/auth/sync-phone", { ...tempData, phone });
      if (res.data.user) {
        localStorage.setItem("user", JSON.stringify(res.data.user));
        setMustSyncPhone(false);
        setTempData(null);
        window.location.replace("/"); // Direct hard redirect to home
      }
    } catch (err) {
      alert("Sync fail ho gaya, phir koshish karein.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center space-y-6">
        <h1 className="text-3xl font-black text-slate-900">Ek Akhri Kadam! 🚀</h1>
        <p className="text-slate-500 font-medium">Verification ke liye apna mobile number link karein.</p>
        
        <form onSubmit={handleSync} className="space-y-4">
          <div className="flex border-2 border-slate-100 rounded-2xl overflow-hidden focus-within:border-orange-500 transition-all">
            <span className="bg-slate-100 px-4 flex items-center font-bold text-slate-600">+91</span>
            <Input 
              type="tel" 
              value={phone} 
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="border-0 py-7 text-xl font-bold focus-visible:ring-0" 
              placeholder="992830XXXX"
              required
            />
          </div>
          <Button disabled={loading || phone.length < 10} className="w-full py-7 text-lg font-bold bg-orange-500 hover:bg-orange-600 rounded-2xl">
            {loading ? "Linking..." : "Confirm & Dashboard Pe Chalein"}
          </Button>
        </form>
      </div>
    </div>
  );
}