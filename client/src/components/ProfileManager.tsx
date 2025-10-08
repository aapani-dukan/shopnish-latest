import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateSellerSchema } from "@shared/backend/schema";
import type { Seller } from "@shared/backend/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const sellerFormSchema = updateSellerSchema.omit({ userId: true });

interface ProfileManagerProps {
  seller: Seller;
}

export default function ProfileManager({ seller }: ProfileManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // ProfileManager.tsx (useForm hook के अंदर)

  const sellerForm = useForm<z.infer<typeof sellerFormSchema>>({
    resolver: zodResolver(sellerFormSchema),
    mode:"onChange",
    values: seller ? {
      businessName: seller.businessName || "",
      description: seller.description || "",
      businessAddress: seller.businessAddress || "",
      businessPhone: seller.businessPhone || "",
      gstNumber: seller.gstNumber || "",
      bankAccountNumber: seller.bankAccountNumber || "",
      ifscCode: seller.ifscCode || "",
      
      // ✅ ये फ़ील्ड्स Zod स्कीमा में आवश्यक हो सकते हैं, इन्हें जोड़ें
      city: seller.city || "", 
      pincode: seller.pincode || "",
      // यदि businessType भी है तो उसे भी जोड़ें
      businessType: seller.businessType || "", 
    } : {
      businessName: "",
      description: "",
      businessAddress: "",
      businessPhone: "",
      gstNumber: "",
      bankAccountNumber: "",
      ifscCode: "",
      city: "",
      pincode: "",
      businessType: "",
    },
  });
  

  const sellerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof sellerFormSchema>) => {
      return await apiRequest("PUT", "/api/sellers/me", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/me"] });
      toast({
        title: "Profile updated",
        description: "Your seller profile has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update seller profile",
        variant: "destructive",
      });
    },
  });

  const onSellerSubmit = (data: z.infer<typeof sellerFormSchema>) => {
    sellerMutation.mutate(data);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...sellerForm}>
          <form onSubmit={sellerForm.handleSubmit(onSellerSubmit)} className="space-y-4">
            <FormField
              control={sellerForm.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={sellerForm.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={sellerForm.control}
              name="businessAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Address</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={sellerForm.control}
              name="businessPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Phone</FormLabel>
                  <FormControl>
                    <Input {...field} type="tel" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={sellerForm.control}
              name="gstNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GST Number (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={sellerForm.control}
              name="bankAccountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Account Number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={sellerForm.control}
              name="ifscCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IFSC Code</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={sellerMutation.isPending}>
                {sellerMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
