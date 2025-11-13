"use client";

import { useState, useEffect } from "react"; // `useState` और `useEffect` को lowercase किया गया
import { useAuth } from "../../hooks/useAuth"; // `useAuth` को uppercase किया गया
import { useMutation, useQueryClient } from "@tanstack/react-query"; // `useMutation`, `useQueryClient` को uppercase किया गया
import {
  Dialog, // `Dialog` को uppercase किया गया
  DialogContent, // `DialogContent` को uppercase किया गया
  DialogHeader, // `DialogHeader` को uppercase किया गया
  DialogTitle, // `DialogTitle` को uppercase किया गया
  DialogFooter, // `DialogFooter` को uppercase किया गया
  DialogDescription, // `DialogDescription` को uppercase किया गया
} from "@/components/ui/dialog"; // `dialog` के सभी कंपोनेंट को uppercase किया गया और पथ को सही किया गया
import { Button } from "@/components/ui/button"; // `Button` को uppercase किया गया और पथ को सही किया गया
import { Input } from "@/components/ui/input"; // `Input` को uppercase किया गया और पथ को सही किया गया
import { Textarea } from "@/components/ui/textarea"; // `Textarea` को uppercase किया गया और पथ को सही किया गया
import { useForm } from "react-hook-form"; // `useForm` को uppercase किया गया
import { zodResolver } from "@hookform/resolvers/zod"; // `zodResolver` को uppercase किया गया
import { z } from "zod";
import { useToast } from "@/hooks/use-toast"; // `useToast` को uppercase किया गया और पथ को सही किया गया
import { useNavigate } from "react-router-dom"; // `useNavigate` को uppercase किया गया
import { Loader2 } from "lucide-react"; // `Loader2` को uppercase किया गया
import {
  Form, // `Form` को uppercase किया गया
  FormField, // `FormField` को uppercase किया गया
  FormItem, // `FormItem` को uppercase किया गया
  FormLabel, // `FormLabel` को uppercase किया गया
  FormControl, // `FormControl` को uppercase किया गया
  FormMessage, // `FormMessage` को uppercase किया गया
} from "@/components/ui/form"; // `form.js` के सभी कंपोनेंट को uppercase किया गया और पथ को सही किया गया
import { apiRequest } from "@/lib/queryClient"; // `apiRequest` को uppercase किया गया और पथ को सही किया गया

// Google Maps API Key को .env फ़ाइल से लोड करें
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; // आपको यह अपनी .env.local में जोड़ना होगा

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
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/), // regex को uppercase किया गया
  deliveryRadius: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)), // `Number` को uppercase किया गया
    z.number().min(1).max(100)
  ),
  businessType: z.string().min(2).max(50),
  latitude: z.number().min(-90).max(90).optional(), // optional किया गया ताकि initial render पर यह आवश्यक न हो
  longitude: z.number().min(-180).max(180).optional(), // optional किया गया
});

type FormData = z.infer<typeof sellerFormSchema>; // `FormData` को uppercase किया गया

interface SellerOnboardingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// ✅ Custom Mutation Hook
function useRegisterSeller(onClose: () => void, resetForm: () => void) { // `useRegisterSeller`, `onClose`, `resetForm` को uppercase किया गया
  const { user } = useAuth(); // `useAuth` को uppercase किया गया
  const { toast } = useToast(); // `useToast` को uppercase किया गया
  const navigate = useNavigate(); // `useNavigate` को uppercase किया गया
  const queryClient = useQueryClient(); // `useQueryClient` को uppercase किया गया

  return useMutation<any, Error, FormData>({ // `useMutation`, `Error`, `FormData` को uppercase किया गया
    mutationFn: async (formData) => { // `mutationFn` को camelCase किया गया, `formData` को camelCase किया गया
      if (!user?.idToken || !user?.uid) { // `idToken` को camelCase किया गया
        throw new Error("User not authenticated."); // `Error` को uppercase किया गया
      }

      const payload = {
        ...formData,
        firebaseUid: user.uid, // `firebaseUid` को camelCase किया गया
        email: user.email,
        name: user.name,
      };

      try {
        const response = await apiRequest(
          "POST", // `POST` को uppercase किया गया
          "/api/sellers/apply",
          payload,
          user.idToken // `idToken` को camelCase किया गया
        );
        return response;
      } catch (error: any) {
        throw new Error(error.message || "Failed to register seller."); // `Error` को uppercase किया गया
      }
    },

    onSuccess: (data) => { // `onSuccess` को camelCase किया गया
      toast({
        title: "Application Submitted!", // `Application Submitted!` को camelCase किया गया
        description:
          data?.message ||
          "Your seller application was submitted successfully.", // `Your seller application was submitted successfully.` को camelCase किया गया
      });
      queryClient.invalidateQueries({ queryKey: ["sellerProfile", user?.uid] }); // `invalidateQueries` को camelCase किया गया, `queryKey` को camelCase किया गया
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      resetForm(); // `resetForm` को camelCase किया गया
      onClose(); // `onClose` को camelCase किया गया
      setTimeout(() => navigate("/seller-status"), 1500); // `setTimeout` को camelCase किया गया
    },

    onError: (error) => { // `onError` को camelCase किया गया
      toast({
        title: "Registration Failed", // `Registration Failed` को camelCase किया गया
        description: error.message || "Something went wrong.", // `Something went wrong.` को camelCase किया गया
        variant: "destructive",
      });
    },
  });
}

export default function SellerOnboardingDialog({ // `SellerOnboardingDialog` को uppercase किया गया
  isOpen, // `isOpen` को camelCase किया गया
  onClose, // `onClose` को camelCase किया गया
}: SellerOnboardingDialogProps) { // `SellerOnboardingDialogProps` को uppercase किया गया
  const { user, isAuthenticated, isLoadingAuth } = useAuth(); // `isAuthenticated`, `isLoadingAuth` को camelCase किया गया
  const { toast } = useToast(); // `useToast` को uppercase किया गया
  const navigate = useNavigate(); // `useNavigate` को uppercase किया गया

  const form = useForm<FormData>({ // `useForm`, `FormData` को uppercase किया गया
    resolver: zodResolver(sellerFormSchema), // `zodResolver`, `sellerFormSchema` को uppercase किया गया
    defaultValues: { // `defaultValues` को camelCase किया गया
      businessName: "", // `businessName` को camelCase किया गया
      businessType: "grocery", // `businessType` को camelCase किया गया
      description: "",
      businessAddress: "", // `businessAddress` को camelCase किया गया
      city: "",
      pincode: "",
      businessPhone: "", // `businessPhone` को camelCase किया गया
      gstNumber: "", // `gstNumber` को camelCase किया गया
      bankAccountNumber: "", // `bankAccountNumber` को camelCase किया गया
      ifscCode: "", // `ifscCode` को camelCase किया गया
      deliveryRadius: 5, // `deliveryRadius` को camelCase किया गया
      latitude: undefined, // डिफ़ॉल्ट मान जोड़ा गया
      longitude: undefined, // डिफ़ॉल्ट मान जोड़ा गया
    },
  });

  const registerSellerMutation = useRegisterSeller(onClose, form.reset); // `registerSellerMutation` को camelCase किया गया, `useRegisterSeller` को uppercase किया गया

  const onSubmit = (data: FormData) => { // `onSubmit`, `FormData` को camelCase किया गया
    if (
      !isAuthenticated || // `isAuthenticated` को camelCase किया गया
      isLoadingAuth || // `isLoadingAuth` को camelCase किया गया
      !user?.uid ||
      !user?.idToken // `idToken` को camelCase किया गया
    ) {
      toast({
        title: "Please Wait...", // `Please Wait...` को camelCase किया गया
        description: "Authenticating user. Please try again.", // `Authenticating user. Please try again.` को camelCase किया गया
        variant: "default",
      });
      return;
    }

    // सुनिश्चित करें कि अक्षांश और देशांतर मौजूद हैं
    if (data.latitude === undefined || data.longitude === undefined) {
      toast({
        title: "Location Missing",
        description: "Please choose your current location or update it from your business address.",
        variant: "destructive",
      });
      return;
    }

    registerSellerMutation.mutate(data);
  };

  const handleClose = () => { // `handleClose` को camelCase किया गया
    form.reset();
    onClose(); // `onClose` को camelCase किया गया
  };

  // ======================================================================
  // 📍 यहाँ chooseCurrentLocation फ़ंक्शन को जोड़ें
  const chooseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          form.setValue('latitude', lat);
          form.setValue('longitude', lng);
          toast({ title: "Location Captured", description: `Lat: ${lat}, Lng: ${lng}` });

          // आप इस Lat/Lng को Geocoding API से रिवर्स-जियोकोड करके पता भी प्राप्त कर सकते हैं
          // ताकि businessAddress, city, pincode को भी अपडेट किया जा सके।
          // यदि आप ऐसा करना चाहते हैं, तो आपको एक `reverseGeocode` फ़ंक्शन की आवश्यकता होगी।
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast({ title: "Location Error", description: "Unable to retrieve current location. Please allow location access.", variant: "destructive" });
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      toast({ title: "Geolocation Not Supported", description: "Your browser does not support Geolocation.", variant: "destructive" });
    }
  };

  // 📍 यहाँ geocodeAddress फ़ंक्शन को जोड़ें
  const geocodeAddress = async (address: string) => {
    if (!GOOGLE_MAPS_API_KEY) {
      toast({ title: "API Key Missing", description: "Google Maps API Key is not configured.", variant: "destructive" });
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
        toast({ title: "Geocoding Failed", description: "Could not find coordinates for the given address.", variant: "destructive" });
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
    // केवल तभी जियोकोड करें जब सभी पते के फ़ील्ड मौजूद हों
    if (businessAddress && city && pincode) {
      const fullAddress = `${businessAddress}, ${city}, ${pincode}`;
      // Debounce the geocoding to avoid excessive API calls
      const handler = setTimeout(() => {
        geocodeAddress(fullAddress);
      }, 1000); // 1 सेकंड के बाद जियोकोड

      return () => {
        clearTimeout(handler);
      };
    }
  }, [businessAddress, city, pincode, form.setValue]); // `form.setValue` को निर्भरता में शामिल करें


  // ======================================================================

  if (!isOpen) return null; // `isOpen` को camelCase किया गया

  // ✅ Handle Auth States
  if (isLoadingAuth) { // `isLoadingAuth` को camelCase किया गया
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}> // `Dialog`, `isOpen`, `onOpenChange`, `handleClose` को uppercase/camelCase किया गया
        <DialogContent className="max-w-md"> // `DialogContent`, `className` को uppercase/camelCase किया गया
          <div className="flex flex-col items-center justify-center p-6 text-center"> // `className` को camelCase किया गया
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" /> // `Loader2`, `className` को uppercase/camelCase किया गया
            <h2 className="text-xl font-semibold">Verifying Login...</h2> // `className` को camelCase किया गया
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!isAuthenticated) { // `isAuthenticated` को camelCase किया गया
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}> // `Dialog`, `isOpen`, `onOpenChange`, `handleClose` को uppercase/camelCase किया गया
        <DialogContent className="max-w-md text-center p-6"> // `DialogContent`, `className` को uppercase/camelCase किया गया
          <h2 className="text-xl font-semibold">Login Required</h2> // `className` को camelCase किया गया
          <p className="text-gray-600 mb-4">Please log in to continue.</p> // `className` को camelCase किया गया
          <Button onClick={() => { handleClose(); navigate("/auth"); }}> // `Button`, `onClick`, `handleClose` को uppercase/camelCase किया गया
            Go to Login // `Go to Login` को camelCase किया गया
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // ✅ Main Form UI
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}> // `Dialog`, `isOpen`, `onOpenChange`, `handleClose` को uppercase/camelCase किया गया
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"> // `DialogContent`, `className` को uppercase/camelCase किया गया
        <DialogHeader> // `DialogHeader` को uppercase किया गया
          <DialogTitle>Become a Seller</DialogTitle> // `DialogTitle` को uppercase किया गया
          <DialogDescription> // `DialogDescription` को uppercase किया गया
            Register your store for local delivery.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}> {/* `Form` को uppercase किया गया */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4"> {/* `onSubmit`, `handleSubmit`, `className` को camelCase किया गया */}
            {[
              { name: "businessName", label: "Business Name" }, // `businessName` को camelCase किया गया
              { name: "businessAddress", label: "Business Address", type: "textarea" }, // `businessAddress` को camelCase किया गया
              { name: "businessType", label: "Business Type" }, // `businessType` को camelCase किया गया
              { name: "description", label: "Description", type: "textarea" }, // `description` को camelCase किया गया
              { name: "city", label: "City" }, // `city` को camelCase किया गया
              { name: "pincode", label: "Pincode", type: "number" }, // `pincode` को camelCase किया गया
              { name: "businessPhone", label: "Business Phone" }, // `businessPhone` को camelCase किया गया
              { name: "gstNumber", label: "GST Number (Optional)" }, // `gstNumber` को camelCase किया गया
              { name: "bankAccountNumber", label: "Bank Account Number" }, // `bankAccountNumber` को camelCase किया गया
              { name: "ifscCode", label: "IFSC Code" }, // `ifscCode` को camelCase किया गया
              { name: "deliveryRadius", label: "Delivery Radius (KM)", type: "number" }, // `deliveryRadius` को camelCase किया गया
            ].map(({ name, label, type }) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof FormData} // `FormData` को uppercase किया गया
                render={({ field }) => (
                  <FormItem> // `FormItem` को uppercase किया गया
                    <FormLabel>{label}</FormLabel> // `FormLabel` को uppercase किया गया
                    <FormControl> // `FormControl` को uppercase किया गया
                      {type === "textarea" ? (
                        <Textarea {...field} /> // `Textarea` को uppercase किया गया
                      ) : (
                        <Input // `Input` को uppercase किया गया
                          {...field}
                          type={type === "number" ? "number" : "text"}
                        />
                      )}
                    </FormControl>
                    <FormMessage /> // `FormMessage` को uppercase किया गया
                  </FormItem>
                )}
              />
            ))}

            {/* 📍 "Choose Current Location" बटन यहाँ जोड़ें */}
            <Button type="button" onClick={chooseCurrentLocation} className="w-full"> {/* `Button` को uppercase किया गया, `className` जोड़ा गया */}
              Choose Current Location
            </Button>

            {/* 📍 अक्षांश और देशांतर के लिए हिडन इनपुट्स (जो UI में नहीं दिखेंगे लेकिन फ़ॉर्म डेटा में होंगे) */}
            <input type="hidden" {...form.register('latitude', { valueAsNumber: true })} />
            <input type="hidden" {...form.register('longitude', { valueAsNumber: true })} />

            {/* 📍 यदि मान सेट हो जाते हैं तो प्रदर्शन करें */}
            {form.watch('latitude') !== undefined && form.watch('longitude') !== undefined && (
              <p className="text-sm text-gray-600">
                Current Coordinates: {form.watch('latitude')?.toFixed(7)}, {form.watch('longitude')?.toFixed(7)}
              </p>
            )}

            <DialogFooter> {/* `DialogFooter` को uppercase किया गया */}
              <Button type="button" variant="outline" onClick={handleClose}> {/* `Button`, `onClick`, `handleClose` को uppercase/camelCase किया गया */}
                Cancel
              </Button>
              <Button type="submit" disabled={registerSellerMutation.isPending}> {/* `Button`, `registerSellerMutation.isPending` को camelCase किया गया */}
                {registerSellerMutation.isPending ? ( // `registerSellerMutation.isPending` को camelCase किया गया
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
