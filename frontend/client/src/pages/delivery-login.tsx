"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Truck, Loader2, Phone, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DeliveryLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { sendOtp, verifyOtp, isLoadingAuth } = useAuth();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  // 🚀 1. OTP Bhejne ka Handler
  const handleSendOtp = async () => {
    if (phone.length < 10) {
      return toast({ title: "Error", description: "Bhai, valid number dalo!", variant: "destructive" });
    }

    try {
      const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
      const result = await sendOtp(formattedPhone);
      setConfirmationResult(result);
      setStep("otp");
      toast({ title: "OTP Sent", description: "Delivery partner verification code bhej diya gaya hai." });
    } catch (err: any) {
      console.error("Delivery OTP Error:", err);
      toast({ title: "Error", description: err.message || "OTP nahi gaya.", variant: "destructive" });
    }
  };

  // 🚀 2. OTP Verify karne ka Handler
  const handleVerifyOtp = async () => {
    try {
      await verifyOtp(confirmationResult, otp);
      
      // Verification ke baad humein check karna hoga ki banda delivery boy hai ya nahi
      // Ye logic useAuth ya backend handle kar lega, hum bas navigate karenge
      toast({ title: "Success", description: "Verification successful!" });
      navigate("/delivery"); // Dashboard chalo
    } catch (err: any) {
      toast({ title: "Failed", description: "Galti OTP, check karein.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
      {/* Invisible Recaptcha Container */}
      <div id="otp-container"></div>

      <div className="max-w-md w-full">
        <Card className="shadow-2xl border-none rounded-[2rem] overflow-hidden">
          <CardHeader className="text-center bg-blue-600 pb-10 pt-10">
            <div className="w-20 h-20 mx-auto bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mb-4 shadow-inner">
              <Truck className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-3xl font-black text-white tracking-tight">
              Delivery Partner
            </CardTitle>
            <p className="text-blue-100 text-sm font-medium">Shopnish Delivery Network</p>
          </CardHeader>

          <CardContent className="p-8 space-y-6 -mt-6 bg-white rounded-t-[2.5rem]">
            {step === "phone" ? (
              <div className="space-y-4">
                <div className="relative">
                  <Phone className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <Input
                    type="tel"
                    placeholder="Mobile Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    className="pl-12 py-7 text-lg rounded-2xl border-slate-200 focus:border-blue-500"
                    maxLength={10}
                  />
                </div>
                <Button
                  className="w-full py-7 text-xl font-bold bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-100 transition-all"
                  onClick={handleSendOtp}
                  disabled={isLoadingAuth || phone.length < 10}
                >
                  {isLoadingAuth ? <Loader2 className="animate-spin" /> : "Send OTP"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="pl-12 py-7 text-center text-2xl tracking-[0.3em] font-bold rounded-2xl border-slate-200 focus:border-blue-500"
                    maxLength={6}
                  />
                </div>
                <Button
                  className="w-full py-7 text-xl font-bold bg-green-600 hover:bg-green-700 rounded-2xl shadow-lg shadow-green-100 transition-all"
                  onClick={handleVerifyOtp}
                  disabled={isLoadingAuth || otp.length < 6}
                >
                  {isLoadingAuth ? <Loader2 className="animate-spin" /> : "Verify & Login"}
                </Button>
                <button 
                  onClick={() => setStep("phone")}
                  className="w-full text-center text-sm font-bold text-blue-600 hover:underline"
                >
                  Change Number?
                </button>
              </div>
            )}

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">New Here?</span></div>
            </div>

            <Button
              variant="outline"
              className="w-full py-6 rounded-2xl border-2 border-slate-100 hover:bg-slate-50 font-bold text-slate-600"
              onClick={() => navigate("/delivery-apply")}
              disabled={isLoadingAuth}
            >
              Apply as Delivery Partner
            </Button>
          </CardContent>
        </Card>
        <p className="mt-8 text-center text-xs text-slate-400 font-medium uppercase tracking-widest">
          © 2026 Shopnish Tech Logistics
        </p>
      </div>
    </div>
  );
}