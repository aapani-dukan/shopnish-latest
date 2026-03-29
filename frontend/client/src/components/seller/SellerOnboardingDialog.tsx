"use client";

import { useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast"; // assuming use-toast is in @/components/ui
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";

// Google Maps API Key को .env फ़ाइल से लोड करें
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY; 

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
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/), // Regex fixed to uppercase for IFSC standard
  deliveryRadius: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().min(1).max(100)
  ),
  businessType: z.string().min(2).max(50),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

type FormData = z.infer<typeof sellerFormSchema>;

interface SellerOnboardingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// ✅ Custom Mutation Hook
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
        phone: formData.businessPhone,
        name: user.name,
      };

      try {
        const response = await apiRequest(
          "POST",
          "/api/sellers/apply",
          payload,
          
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
      businessPhone: "",
      city: "",
      pincode: "",
      gstNumber: "",
      bankAccountNumber: "",
      ifscCode: "",
      deliveryRadius: 5,
      latitude: undefined,
      longitude: undefined,
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
        title: "Please Wait...",
        description: "Authenticating user. Please try again.",
        variant: "default",
      });
      return;
    }

    if (data.latitude === undefined || data.longitude === undefined) {
      toast({
        title: "Location Missing",
        description: "Please ensure your business address is valid so we can pinpoint its location (latitude/longitude).",
        variant: "destructive",
      });
      return;
    }

    registerSellerMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  // 📍 Geocode Address फ़ंक्शन को जोड़ें
  const geocodeAddress = async (address: string) => {
    if (!GOOGLE_MAPS_API_KEY) {
      toast({ title: "API Key Missing", description: "Google Maps API Key is not configured in environment variables (`VITE_GOOGLE_MAPS_API_KEY`).", variant: "destructive" });
      return null;
    }
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        form.setValue('latitude', lat);
        form.setValue('longitude', lng);
        toast({ title: "Address Geocoded", description: `Lat: ${lat}, Lng: ${lng}` });
        return { lat, lng };
      } else {
        toast({ title: "Geocoding Failed", description: "Could not find coordinates for the given address. Please check your address, city, and pincode.", variant: "destructive" });
        return null;
      }
    } catch (error) {
      console.error("Geocoding API error:", error);
      toast({ title: "Geocoding Error", description: "An error occurred during geocoding.", variant: "destructive" });
      return null;
    }
  };

  // `businessAddress`, `city`, `pincode` में परिवर्तन होने पर geocode करने के लिए `useEffect`
  const businessAddress = form.watch('businessAddress');
  const city = form.watch('city');
  const pincode = form.watch('pincode');

  useEffect(() => {
    if (businessAddress && city && pincode && businessAddress.length > 5 && city.length > 2 && pincode.length === 6) {
      const fullAddress = `${businessAddress}, ${city}, ${pincode}`;
      const handler = setTimeout(() => {
        geocodeAddress(fullAddress);
      }, 1000);

      return () => {
        clearTimeout(handler);
      };
    } else {
      form.setValue('latitude', undefined);
      form.setValue('longitude', undefined);
    }
  }, [businessAddress, city, pincode, form.setValue, toast]);

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
              { name: "city", label: "City" },
              { name: "pincode", label: "Pincode", type: "number" },
              { name: "businessType", label: "Business Type" },
              { name: "description", label: "Description", type: "textarea" },
              { name: "businessPhone", label: "Business Phone" },
              { name: "gstNumber", label: "GST Number (Optional)" },
              { name: "bankAccountNumber", label: "Bank Account Number" },
              { name: "ifscCode", label: "IFSC Code" },
              { name: "deliveryRadius", label: "Delivery Radius (KM)", type: "number" },
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
                       <Textarea 
  {...field} 
  value={field.value ?? ""} />
                      ) : (
                       <Input
  {...field}
  // Null ko khali string ('') mein badal deta hai
  value={field.value ?? ""} 
  type={type === "number" ? "number" : "text"}
  // Number fields ke liye extra safety (optional par achha hai)
  onChange={(e) => {
    const val = e.target.value;
    field.onChange(type === "number" ? (val === "" ? "" : Number(val)) : val);
  }}
/>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            {/* 📍 अक्षांश और देशांतर के लिए हिडन इनपुट्स (ये UI में नहीं दिखेंगे) */}
            <input type="hidden" {...form.register('latitude', { valueAsNumber: true })} />
            <input type="hidden" {...form.register('longitude', { valueAsNumber: true })} />

            {/* 📍 जियोकोड किए गए निर्देशांक का रीड-ओनली डिस्प्ले */}
            {form.watch('latitude') !== undefined && form.watch('longitude') !== undefined ? (
              <FormItem>
                <FormLabel>Shop Location Coordinates</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={`Lat: ${form.watch('latitude')?.toFixed(7)}, Lng: ${form.watch('longitude')?.toFixed(7)}`}
                    readOnly
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </FormControl>
                <FormDescription>
                  These coordinates are automatically derived from your business address.
                </FormDescription>
              </FormItem>
            ) : (
              <FormItem>
                <FormLabel>Shop Location Coordinates</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value="Enter a valid Business Address, City, and Pincode to get coordinates."
                    readOnly
                    className="bg-red-50 text-red-700 cursor-not-allowed"
                  />
                </FormControl>
                <FormDescription className="text-red-600">
                  Business address, city, and pincode are required to automatically determine your shop's location.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}

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
