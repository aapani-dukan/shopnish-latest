"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form.js";
import { apiRequest } from "@/lib/queryClient";

// 📦 Form Validation Schema
const sellerFormSchema = z.object({
  businessName: z.string().min(3).max(100),
  description: z.string().min(10).max(500),
  businessAddress: z.string().min(10).max(200),
  city: z.string().min(2).max(50),
  pincode: z.string().regex(/^\d{6}$/),
  businessPhone: z.string().regex(/^\d{10}$/),
  gstNumber: z.string().max(15).optional(),
  bankAccountNumber: z.string().regex(/^\d{9,18}$/),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
  deliveryRadius: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().min(1).max(100)
  ),
  businessType: z.string().min(2).max(50),
});

type FormData = z.infer<typeof sellerFormSchema>;

interface SellerOnboardingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// ✅ Custom mutation hook
function useRegisterSeller(onClose: () => void, resetForm: () => void) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation<any, Error, FormData>({
    mutationFn: async (formData) => {
      if (!user?.idToken || !user?.uid) {
        throw new Error("User not authenticated.");
      }

      const payload = {
        ...formData,
        firebaseUid: user.uid,
        email: user.email,
        name: user.name,
      };

      try {
        const response = await apiRequest(
          "POST",
          "/api/sellers/apply",
          payload,
          user.idToken
        );
        return response;
      } catch (error: any) {
        throw new Error(error.message || "Failed to register seller.");
      }
    },

    onSuccess: (data) => {
      toast({
        title: "Application Submitted!",
        description:
          data?.message ||
          "Your seller application was submitted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["sellerProfile", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      resetForm();
      onClose();
      setTimeout(() => navigate("/seller-status"), 1500);
    },

    onError: (error) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });
}

export default function SellerOnboardingDialog({
  isOpen,
  onClose,
}: SellerOnboardingDialogProps) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<FormData>({
    resolver: zodResolver(sellerFormSchema),
    defaultValues: {
      businessName: "",
      businessType: "grocery",
      description: "",
      businessAddress: "",
      city: "",
      pincode: "",
      businessPhone: "",
      gstNumber: "",
      bankAccountNumber: "",
      ifscCode: "",
      deliveryRadius: 5,
    },
  });

  const registerSellerMutation = useRegisterSeller(onClose, form.reset);

  const onSubmit = (data: FormData) => {
    if (
      !isAuthenticated ||
      isLoadingAuth ||
      !user?.uid ||
      !user?.idToken
    ) {
      toast({
        title: "Please wait...",
        description: "Authenticating user. Please try again.",
        variant: "default",
      });
      return;
    }

    registerSellerMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  if (!isOpen) return null;

  // ✅ Handle Auth States
  if (isLoadingAuth) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <h2 className="text-xl font-semibold">Verifying Login...</h2>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!isAuthenticated) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md text-center p-6">
          <h2 className="text-xl font-semibold">Login Required</h2>
          <p className="text-gray-600 mb-4">Please log in to continue.</p>
          <Button onClick={() => { handleClose(); navigate("/auth"); }}>
            Go to Login
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // ✅ Main Form UI
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Become a Seller</DialogTitle>
          <DialogDescription>
            Register your store for local delivery.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {[
              { name: "businessName", label: "Business Name" },
              { name: "businessAddress", label: "Business Address", type: "textarea" },
              { name: "businessType", label: "Business Type" },
              { name: "description", label: "Description", type: "textarea" },
              { name: "city", label: "City" },
              { name: "pincode", label: "Pincode", type: "number" },
              { name: "businessPhone", label: "Business Phone" },
              { name: "gstNumber", label: "GST Number (optional)" },
              { name: "bankAccountNumber", label: "Bank Account Number" },
              { name: "ifscCode", label: "IFSC Code" },
              { name: "deliveryRadius", label: "Delivery Radius (km)", type: "number" },
            ].map(({ name, label, type }) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof FormData}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      {type === "textarea" ? (
                        <Textarea {...field} />
                      ) : (
                        <Input
                          {...field}
                          type={type === "number" ? "number" : "text"}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={registerSellerMutation.isPending}>
                {registerSellerMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  "Register as Seller"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
