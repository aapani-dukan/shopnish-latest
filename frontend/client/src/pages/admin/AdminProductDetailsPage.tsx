// client/src/pages/admin/AdminProductDetailsPage.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "../../hooks/use-toast"; // Fixed: useToast hook properly
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Loader2, ArrowLeft, TrendingUp, Tag } from "lucide-react";
import { apiRequest } from "../../lib/queryClient";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  discountedPrice?: number; // Backend field
  priority?: number;        // Ranking field
  approvalStatus: "pending" | "approved" | "rejected";
  imageUrl?: string;
  deliveryPincodes?: string[];
}

const AdminProductDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [productData, setProductData] = useState<Partial<Product>>({});
  const [discountType, setDiscountType] = useState<"none" | "percentage" | "flat">("none");
  const [discountValue, setDiscountValue] = useState<number>(0);

  const { data: product, isLoading: isLoadingProduct, error: productError } = useQuery<Product, Error>({
    queryKey: ["adminProductDetails", productId],
    queryFn: () => apiRequest('GET', `/api/admin/products/${productId}`),
    enabled: !!productId,
  });

  useEffect(() => {
    if (product) {
      setProductData(product);
      // Priority initialize karein
      if (product.priority) setProductData(prev => ({ ...prev, priority: product.priority }));
    }
  }, [product]);

  // Discount Calculation Logic for UI Preview
  const getPreviewPrice = () => {
    const originalPrice = product?.price || 0;
    if (discountType === "percentage") {
      return originalPrice - (originalPrice * discountValue / 100);
    } else if (discountType === "flat") {
      return Math.max(0, originalPrice - discountValue);
    }
    return originalPrice;
  };

  const updateProductMutation = useMutation<void, Error, Partial<Product>>({
    mutationFn: async (dataToUpdate: Partial<Product>) => {
      // Data prepare karein jisme discountedPrice calculate ho chuka ho
      const finalData = {
        ...dataToUpdate,
        discountedPrice: getPreviewPrice(),
      };
      await apiRequest('PUT', `/api/admin/products/${productId}`, finalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProductDetails", productId] });
      toast({ title: "सफलता", description: "उत्पाद रैंकिंग और ऑफर्स अपडेट कर दिए गए हैं।" });
    },
  });

  if (isLoadingProduct) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;
if (productError) {
    return (
      <div className="p-4 text-red-500 text-center bg-red-50 rounded-lg m-10 border border-red-200">
        <h2 className="font-bold">सर्वर से संपर्क नहीं हो पाया</h2>
        <p className="text-sm">त्रुटि: {productError.message}</p>
        <Button onClick={() => navigate(-1)} className="mt-4" variant="outline">पीछे जाएं</Button>
      </div>
    );
  }
  return (
    <div className="p-4 bg-gray-50 min-h-screen font-inter">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" /> वापस</Button>
        <h1 className="text-2xl font-bold ml-4">उत्पाद पावर कंट्रोलर</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Basic Info Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h2 className="text-lg font-bold mb-4 flex items-center"><Tag className="mr-2 text-blue-500" /> मूलभूत जानकारी</h2>
          {product?.imageUrl && <img src={product.imageUrl} className="w-full h-40 object-cover rounded-lg mb-4" />}
          <div className="space-y-2">
            <p className="text-sm"><strong>नाम:</strong> {product?.name}</p>
            <p className="text-sm text-green-600 font-bold text-lg"><strong>मूल्य:</strong> ₹{product?.price}</p>
            {discountValue > 0 && (
              <p className="text-sm text-orange-600 font-bold"><strong>नया मूल्य:</strong> ₹{getPreviewPrice()}</p>
            )}
          </div>
        </div>

        {/* 2. Ranking & Visibility Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100">
          <h2 className="text-lg font-bold mb-4 flex items-center text-indigo-700"><TrendingUp className="mr-2" /> रैंकिंग (Sort Order)</h2>
          <div className="space-y-4">
            <Label htmlFor="priority">प्रायोरिटी लेवल (1-100)</Label>
            <Input 
              id="priority" 
              type="number" 
              value={productData.priority || 0} 
              onChange={(e) => setProductData({...productData, priority: Number(e.target.value)})}
              placeholder="Higher = Top of list"
            />
            <p className="text-xs text-gray-500 italic">जितना नंबर ज्यादा होगा, उत्पाद उतना ही ऊपर दिखेगा।</p>
          </div>
        </div>

        {/* 3. Offers & Discounts Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100">
          <h2 className="text-lg font-bold mb-4 text-green-700">धमाका ऑफर्स (Discounts)</h2>
          <div className="space-y-4">
            <Label>डिस्काउंट का प्रकार</Label>
            <Select onValueChange={(v: any) => setDiscountType(v)}>
              <SelectTrigger><SelectValue placeholder="चुने..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">कोई नहीं</SelectItem>
                <SelectItem value="percentage">प्रतिशत (%) Off</SelectItem>
                <SelectItem value="flat">फ्लैट (₹) Off</SelectItem>
              </SelectContent>
            </Select>

            {discountType !== "none" && (
              <>
                <Label>डिस्काउंट वैल्यू ({discountType === 'percentage' ? '%' : '₹'})</Label>
                <Input 
                  type="number" 
                  value={discountValue} 
                  onChange={(e) => setDiscountValue(Number(e.target.value))} 
                />
              </>
            )}

            <Button 
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700"
              onClick={() => updateProductMutation.mutate(productData)}
              disabled={updateProductMutation.isPending}
            >
              {updateProductMutation.isPending ? "सेव हो रहा है..." : "सेटिंग्स सेव करें"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProductDetailsPage;