"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Ensure you have this component
import { Loader2, Phone} from "lucide-react";
import { toast } from "sonner"; // Agar sonner use kar rahe hain toh

export default function LoginPage() {
  const { sendOtp, verifyOtp, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  // 🚀 1. OTP Bhejne ka Handler
  const handleSendOtp = async () => {
    if (phone.length < 10) {
      return toast.error("Bhai, valid phone number toh dalo!");
    }

    try {
      // Phone number ko format karein (Backend/Firebase ke liye +91 zaroori hai)
      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
      const result = await sendOtp(formattedPhone);
      setConfirmationResult(result);
      setStep("otp");
      toast.success("OTP bhej diya gaya hai! 📱");
    } catch (err: any) {
      console.error("Send OTP Error:", err);
      toast.error(err.message || "OTP bhejne mein dikkat aayi.");
    }
  };

  // 🚀 2. OTP Verify karne ka Handler
  const handleVerifyOtp = async () => {
    if (otp.length < 6) return toast.error("Poora OTP dalo bhai!");

    try {
      await verifyOtp(confirmationResult, otp);
      toast.success("Login safal raha! 🎉");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Verify OTP Error:", err);
      toast.error("Galti OTP! Dobara check karein.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
      {/* 🛑 Firebase ReCaptcha Container (Invisible) */}
      <div id="otp-container"></div>

      <div className="p-10 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 text-center max-w-sm w-full transition-all duration-300">
        
        {/* Logo Section */}
        <div className="mb-10">
          <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-200">
             <span className="text-4xl text-white">🛒</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Shopnish</h1>
          <p className="text-slate-400 mt-2 font-medium">
            {step === "phone" ? "Apne business ko digital banayein" : "Bhai, OTP verify karein"}
          </p>
        </div>
        
        {/* Action Section */}
        <div className="space-y-4">
          {step === "phone" ? (
            <>
              <div className="relative">
                <Phone className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                <Input 
                  type="tel"
                  placeholder="Mobile Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-12 py-7 text-lg rounded-2xl border-slate-200 focus:border-orange-500 transition-all"
                />
              </div>
              <Button 
                onClick={handleSendOtp}
                disabled={isLoadingAuth || phone.length < 10}
                className="w-full py-7 text-xl bg-orange-500 hover:bg-orange-600 text-white transition-all rounded-2xl shadow-lg shadow-orange-200 flex items-center justify-center gap-3 active:scale-95"
              >
                {isLoadingAuth ? <Loader2 className="animate-spin" /> : "OTP Bhejein"}
              </Button>
            </>
          ) : (
            <>
              <Input 
                type="text"
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="py-7 text-center text-2xl tracking-[0.5em] font-bold rounded-2xl border-slate-200 focus:border-orange-500"
                maxLength={6}
              />
              <Button 
                onClick={handleVerifyOtp}
                disabled={isLoadingAuth || otp.length < 6}
                className="w-full py-7 text-xl bg-green-500 hover:bg-green-600 text-white transition-all rounded-2xl shadow-lg shadow-green-100 flex items-center justify-center gap-3 active:scale-95"
              >
                {isLoadingAuth ? <Loader2 className="animate-spin" /> : "Verify & Login"}
              </Button>
              <button 
                onClick={() => setStep("phone")} 
                className="text-sm text-slate-400 hover:text-orange-600 font-bold"
              >
                Number badalna hai?
              </button>
            </>
          )}
          
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium px-4">
            By continuing, you agree to Shopnish's <span className="text-orange-600 underline">Terms</span> and <span className="text-orange-600 underline">Privacy</span>.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-50">
          <p className="text-[10px] text-slate-300 uppercase tracking-[0.3em] font-black">
            © 2026 Shopnish Tech
          </p>
        </div>
      </div>
    </div>
  );
}