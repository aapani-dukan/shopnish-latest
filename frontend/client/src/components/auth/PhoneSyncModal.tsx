"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogPortal,
  DialogOverlay
} from "@/components/ui/dialog";
import api from "@/lib/api"; 
import { useAuth } from "@/hooks/useAuth";

interface PhoneSyncModalProps {
  isOpen: boolean;
  tempData: any;
  onSuccess: (user: any) => void;
}

export function PhoneSyncModal({ isOpen, tempData, onSuccess }: PhoneSyncModalProps) {
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  // Hooks
  const { setMustSyncPhone, setTempData } = useAuth();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhone("");
      setError("");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (phone.length !== 10) {
      setError("Bhai, pura 10-digit number dalo.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await api.post("/api/auth/sync-phone", {
        ...tempData,
        phone: phone,
      });

      if (response.data.user) {
        // 1. Pehle local storage set karein
        localStorage.setItem("user", JSON.stringify(response.data.user));

        // 2. Global Auth states ko clean karein (Yahi loop break karega)
        setMustSyncPhone(false);
        setTempData(null);

        // 3. Success callback (Redirect etc.)
        onSuccess(response.data.user);
      }
    } catch (err: any) {
      console.error("Sync Error:", err);
      setError(err.response?.data?.message || "Kuch galat hua, phir koshish karein.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
  <Dialog open={isOpen} onOpenChange={(open) => { if(!open) return; }}> 
    <DialogPortal>
      {/* 1. Overlay ko full screen aur dark rakho */}
      <DialogOverlay className="bg-black/80 backdrop-blur-sm z-[10000] fixed inset-0" /> 
      
      <DialogContent 
        // 2. 'aria-describedby' ko explicitly wahi ID do jo niche description ki hai
        aria-describedby="phone-sync-description"
        className="fixed left-[50%] top-[50%] z-[10001] w-[95%] max-w-[400px] translate-x-[-50%] translate-y-[-50%] gap-6 border-none shadow-2xl bg-white p-8 rounded-[2rem] duration-300 animate-in fade-in zoom-in-95"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-3xl font-black text-slate-900 tracking-tighter leading-tight">
            Ek Akhri Kadam! 🚀
          </DialogTitle>
          
          {/* 🚩 Warning Fix: ID pakka check karo 'phone-sync-description' hi ho */}
          <DialogDescription 
            id="phone-sync-description" 
            className="text-slate-500 font-medium text-sm leading-relaxed"
          >
            Shopnish par apna account verify karne ke liye apna 10-digit mobile number link karein.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-2">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                Mobile Number
              </label>
              <div className="flex shadow-sm rounded-2xl overflow-hidden border-2 border-slate-100 focus-within:border-orange-500 transition-all bg-slate-50/50">
                <span className="inline-flex items-center px-5 bg-slate-100 text-slate-600 font-black border-r border-slate-200">
                  +91
                </span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="992830XXXX"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(val);
                    if (val.length === 10) setError("");
                  }}
                  className="border-0 focus-visible:ring-0 text-xl py-7 h-auto bg-transparent font-bold tracking-tight"
                  required
                  autoFocus // 👈 Direct focus taaki keyboard khul jaye
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
                ⚠️ {error}
              </div>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full py-8 text-xl font-black bg-orange-500 hover:bg-orange-600 shadow-xl shadow-orange-200 transition-all rounded-2xl text-white active:scale-95"
            disabled={isSubmitting || phone.length < 10}
          >
            {isSubmitting ? "Linking Account..." : "Confirm & Continue"}
          </Button>
        </form>

        <div className="pt-2 text-center">
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
             🛡️ 100% Safe & Secure Authentication
          </p>
        </div>
      </DialogContent>
    </DialogPortal>
  </Dialog>
  );
}