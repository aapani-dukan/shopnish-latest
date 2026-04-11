"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast"; 
import { 
  Phone, Loader2, CheckCircle 
} from 'lucide-react'; 

// --- States for Loading & Success (Simplified) ---
const AuthStatusState = ({ type, title, desc }: { type: 'loading' | 'success', title: string, desc: string }) => (
  <Card className="bg-white rounded-[2.5rem] shadow-2xl border-none p-10 text-center max-w-md">
    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${type === 'success' ? 'bg-green-100' : 'bg-orange-100'}`}>
      {type === 'success' ? <CheckCircle className="w-10 h-10 text-green-500" /> : <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />}
    </div>
    <h2 className="text-3xl font-black text-slate-800 mb-2">{title}</h2>
    <p className="text-slate-400 font-medium">{desc}</p>
  </Card>
);

export default function AuthPage() {
  const { sendOtp, verifyOtp, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // 🚀 OTP Bhejne ka Handler
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) return toast({ title: "Error", description: "10 digit number dalo bhai!", variant: "destructive" });

    try {
      const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone}`;
      const result = await sendOtp(formattedPhone);
      setConfirmationResult(result);
      setStep("otp");
      toast({ title: "OTP Sent! 📱", description: "Verification code bhej diya gaya hai." });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message || "OTP nahi bhej paye.", variant: "destructive" });
    }
  };

  // 🚀 OTP Verify karne ka Handler
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return toast({ title: "Error", description: "Poora OTP dalo!", variant: "destructive" });

    try {
      await verifyOtp(confirmationResult, otp);
      setShowSuccess(true);
      
      const redirectIntent = localStorage.getItem("redirectIntent");
      setTimeout(() => {
        localStorage.removeItem("redirectIntent");
        navigate(redirectIntent === "become-seller" ? "/seller-apply" : "/", { replace: true });
      }, 2000);
    } catch (err: any) {
      toast({ title: "Wrong OTP", description: "OTP match nahi hua, dobara check karein.", variant: "destructive" });
    }
  };

  if (showSuccess) return <AuthStatusState type="success" title="Welcome! 🎉" desc="Aapka account verify ho gaya hai. Dashboard pe chalte hain..." />;
  if (isLoadingAuth && step === 'otp') return <AuthStatusState type="loading" title="Verifying..." desc="Humein ek second dijiye, security check ho raha hai." />;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div id="otp-container"></div> {/* Firebase Recaptcha */}

      <Card className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl border-none overflow-hidden transition-all">
        <CardHeader className="text-center pt-12 pb-6">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200">
            <Phone className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-4xl font-black text-slate-900 tracking-tighter">
            {step === "phone" ? "Namaste!" : "Verify OTP"}
          </CardTitle>
          <p className="text-slate-400 font-medium mt-2">
            {step === "phone" ? "Apne number se login karein" : `Code sent to +91 ${phone}`}
          </p>
        </CardHeader>

        <CardContent className="p-10 pt-0">
          <form onSubmit={step === "phone" ? handleSendOtp : handleVerifyOtp} className="space-y-6">
            {step === "phone" ? (
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">+91</span>
                <Input
                  type="tel"
                  placeholder="Mobile Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="pl-14 py-8 text-xl font-bold rounded-2xl border-slate-100 focus:border-orange-500 focus:ring-orange-500 transition-all"
                  disabled={isLoadingAuth}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  type="text"
                  placeholder="0 0 0 0 0 0"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="py-8 text-center text-3xl tracking-[0.5em] font-black rounded-2xl border-slate-100 focus:border-orange-500"
                  maxLength={6}
                />
                <button 
                  type="button"
                  onClick={() => setStep("phone")}
                  className="w-full text-center text-sm font-bold text-orange-600 hover:underline"
                >
                  Number badalna hai?
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoadingAuth}
              className="w-full bg-slate-900 text-white py-8 text-xl font-bold rounded-2xl hover:bg-slate-800 transition-all shadow-xl active:scale-95"
            >
              {isLoadingAuth ? <Loader2 className="animate-spin" /> : step === "phone" ? "OTP Bhejein" : "Verify & Login"}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              By continuing, you agree to Shopnish's <span className="text-slate-900 underline font-bold">Terms</span> & <span className="text-slate-900 underline font-bold">Privacy</span>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}