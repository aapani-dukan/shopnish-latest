"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import api from "@/lib/api"; // Aapka axios ya fetch instance

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) {
      setError("Bhai, valid 10-digit number dalo.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // 🚀 Hamara Master Sync Route jo humne backend mein banaya tha
      const response = await api.post("/api/auth/sync-phone", {
        ...tempData,
        phone: phone,
      });

      if (response.data.user) {
        // LocalStorage mein user data set karein (Login complete)
        localStorage.setItem("user", JSON.stringify(response.data.user));
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
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Ek Akhri Kadam! 🚀</DialogTitle>
          <DialogDescription>
             apna mobile number link karein taaki aapka account safe rahe aur orders track ho sakein.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mobile Number</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                +91
              </span>
              <Input
                type="tel"
                placeholder="992830XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="rounded-l-none"
                required
              />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Linking Account..." : "Confirm & Continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}