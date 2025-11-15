"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast} from "@/hooks/use-toast"; // Assuming all shadcn UI components are exported from an index.ts in components/ui
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient"; // Make sure this path is correct

// Google Maps API Key को .env फ़ाइल से लोड करें
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// 📦 Form Validation Schema (SellerOnboardingDialog से समान)
const sellerProfileSchema = z.object({
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
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

type FormData = z.infer<typeof sellerProfileSchema>;

export default function SellerProfileEdit() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 1. मौजूदा सेलर प्रोफ़ाइल डेटा फ़ेच करें
  const {
  data: sellerData,
  isLoading: isLoadingSeller,
  isError: isErrorSeller,
  error: sellerError,
} = useQuery<FormData>({
  queryKey: ["sellerProfile", user?.uid],
  queryFn: async () => {
    if (!user?.idToken) throw new Error("User not authenticated.");
    
    // 💡 यहाँ बदलाव है: `response.data` को लौटाएँ
    // apiRequest को कॉल करें
    const response = await apiRequest("GET", `/api/sellers/me`, null, user.idToken);
      return response.data;
    },
    enabled: isAuthenticated && !isLoadingAuth, // केवल तभी क्वेरी चलाएं जब यूजर प्रमाणित हो
  });

  const form = useForm<FormData>({
    resolver: zodResolver(sellerProfileSchema),
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
      latitude: undefined,
      longitude: undefined,
    },
    // `sellerData` लोड होने पर फ़ॉर्म को पॉपुलेट करने के लिए `reset` या `values` का उपयोग करें
    values: sellerData, // यह `sellerData` में बदलाव होने पर फ़ॉर्म को अपने आप अपडेट करेगा
  });

  // 3. सेलर प्रोफ़ाइल अपडेट करने के लिए mutation हुक
  const updateSellerMutation = useMutation<any, Error, FormData>({
    mutationFn: async (formData) => {
      if (!user?.idToken || !user?.uid || !sellerData?._id) { // MongoDB के लिए `_id` का उपयोग करें, या आपके डेटाबेस के आधार पर `id`
        throw new Error("User not authenticated or seller ID missing.");
      }
      const response = await apiRequest(
        "PATCH", // PATCH method
        `/api/sellers/${sellerData._id}`, // आपका अपडेट एंडपॉइंट (ID के साथ)
        formData,
        user.idToken
      );
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Profile Updated!",
        description: data?.message || "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["sellerProfile", user?.uid] }); // कैश को अमान्य करें
      // navigate("/seller-dashboard"); // अपडेट के बाद डैशबोर्ड पर रीडायरेक्ट करें (वैकल्पिक)
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (!isAuthenticated || isLoadingAuth) {
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

    updateSellerMutation.mutate(data);
  };

  // 📍 Geocode Address फ़ंक्शन
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

  // ✅ Handle Loading and Error States
  if (isLoadingAuth || isLoadingSeller) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold">Loading Seller Profile...</h2>
      </div>
    );
  }

  if (isErrorSeller) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center text-red-600">
        <h2 className="text-xl font-semibold">Error Loading Profile</h2>
        <p>{sellerError?.message || "Failed to fetch seller profile data."}</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["sellerProfile", user?.uid] })} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <h2 className="text-xl font-semibold">Login Required</h2>
        <p className="text-gray-600 mb-4">Please log in to view your profile.</p>
        <Button onClick={() => navigate("/auth")}>
          Go to Login
        </Button>
      </div>
    );
  }

  // ✅ Main Form UI
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-lg my-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Edit Your Seller Profile</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          {[
            { name: "businessName", label: "Business Name" },
            { name: "businessAddress", label: "Business Address", type: "textarea" },
            { name: "city", label: "City" },
            { name: "pincode", label: "Pincode", type: "number" },
            { name: "businessType", label: "Business Type" },
            { name: "description", label: "Business Description", type: "textarea" },
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

          <div className="flex justify-end space-x-2 mt-6">
            <Button type="button" variant="outline" onClick={() => form.reset()}>
              Reset Changes
            </Button>
            <Button type="submit" disabled={updateSellerMutation.isPending}>
              {updateSellerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
  }
