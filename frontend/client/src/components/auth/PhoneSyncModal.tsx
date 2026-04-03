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
        <DialogOverlay className="bg-black/90 backdrop-blur-md z-[10000] fixed inset-0" /> 
        
        <DialogContent 
          // 🚩 Change 2: 'fixed' aur 'translate' classes ensure karein
          className="fixed left-[50%] top-[50%] z-[10001] w-[90%] max-w-[425px] translate-x-[-50%] translate-y-[-50%] gap-6 border-none shadow-2xl bg-white p-6 rounded-3xl duration-200"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          // 🚩 Change 3: Manual ID for description warning (Optional but safer)
          aria-describedby="phone-sync-description"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
              Ek Akhri Kadam! 🚀
            </DialogTitle>
            <DialogDescription 
              id="phone-sync-description" // Warning fix
              className="text-slate-500 font-medium pt-2"
            >
              Shopnish par apna account verify karne ke liye apna 10-digit mobile number link karein.
            </DialogDescription>
          </DialogHeader>
           
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">Mobile Number</label>
              <div className="flex shadow-sm rounded-xl overflow-hidden border-2 border-slate-100 focus-within:border-orange-500 transition-all">
                <span className="inline-flex items-center px-4 bg-slate-50 text-slate-500 font-bold border-r">
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
                  className="border-0 focus-visible:ring-0 text-lg py-6 h-auto"
                  required
                />
              </div>
              {error && (
                <p className="text-red-500 text-xs font-bold animate-pulse ml-1">
                  ⚠️ {error}
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full py-7 text-lg font-bold bg-orange-500 hover:bg-orange-600 shadow-lg transition-all rounded-xl"
              disabled={isSubmitting || phone.length < 10}
            >
              {isSubmitting ? "Linking Account..." : "Confirm & Continue"}
            </Button>
          </form>

          <p className="text-[10px] text-center text-slate-400 font-medium">
            Aapka data Shopnish par 100% safe hai.
          </p>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}