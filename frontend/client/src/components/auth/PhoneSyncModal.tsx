"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogPortal
} from "@/components/ui/dialog";
import api from "@/lib/api"; 
import { useAuth } from "@/hooks/useAuth";
interface PhoneSyncModalProps {
  isOpen: boolean;
  tempData: {
    firebaseUid: string;
    email: string;
    fullName: string;
  } | null;
  onSuccess: (user: any) => void;
}

export function PhoneSyncModal({ isOpen, tempData, onSuccess }: PhoneSyncModalProps) {
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { setMustSyncPhone, setTempData } = useAuth(); // ✅ ADD
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (phone.length !== 10) {
      setError("Bhai, pura 10-digit number dalo.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // 🚀 Backend Sync Call
      const response = await api.post("/api/auth/sync-phone", {
        ...tempData,
        phone: phone,
      });

      if (response.data.user) {
  localStorage.setItem("user", JSON.stringify(response.data.user));

  // 🔥 IMPORTANT FIX
  setMustSyncPhone(false);   // modal बंद
  setTempData(null);         // temp data साफ

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
<Dialog open={isOpen} onOpenChange={(open) => { if (!open) return; }}>
  <DialogPortal>
    <DialogContent 
      className="sm:max-w-[425px] z-[10001] gap-6"
      onPointerDownOutside={(e) => e.preventDefault()}
      onEscapeKeyDown={(e) => e.preventDefault()}
      aria-describedby="phone-sync-description"
    >
      <DialogHeader>
        <DialogTitle className="text-2xl font-black text-slate-900">
          Ek Akhri Kadam! 🚀
        </DialogTitle>

        <DialogDescription 
          id="phone-sync-description"
          className="text-slate-500 font-medium"
        >
          Shopnish par apna account verify karne ke liye apna 10-digit mobile number link karein.
        </DialogDescription>
      </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 ml-1">Mobile Number</label>
              <div className="flex shadow-sm rounded-xl overflow-hidden border-2 border-slate-100 focus-within:border-orange-500 transition-all">
                <span className="inline-flex items-center px-4 bg-slate-50 text-slate-500 font-bold border-r border-slate-100">
                  +91
                </span>
                <Input
                  type="tel"
                  inputMode="numeric" // Mobile keyboard numeric khulega
                  placeholder="992830XXXX"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(val);
                    if (val.length === 10) setError("");
                  }}
                  className="border-0 focus-visible:ring-0 text-lg py-6"
                  required
                />
              </div>
              {error && (
                <p className="text-red-500 text-xs font-bold animate-bounce ml-1">
                  ⚠️ {error}
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full py-7 text-lg font-bold bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-200 transition-all rounded-xl"
              disabled={isSubmitting || phone.length < 10}
            >
              {isSubmitting ? "Linking Account..." : "Confirm & Continue"}
            </Button>
          </form>

          {/* Footer note */}
          <p className="text-[10px] text-center text-slate-400 font-medium">
            Aapka data Shopnish par 100% safe hai.
          </p>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}