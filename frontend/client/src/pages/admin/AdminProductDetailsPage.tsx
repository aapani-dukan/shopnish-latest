// client/src/pages/admin/AdminProductDetailsPage.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "../../hooks/use-toast";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import apiRequest from "../../lib/queryclient"; // Ensure this path is correct

// Interfaces
interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  approvalStatus: "pending" | "approved" | "rejected";
  imageUrl?: string; // Assuming product might have an image
  // New field for settings
  deliveryPincodes?: string[]; // Optional array of pincodes for the product
}

const AdminProductDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Get product ID from URL params
  const productId = Number(id);
  const { toast } = toast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [productData, setProductData] = useState<Partial<Product>>({}); // State for form data

  // 1. Fetch Product Details
  const { data: product, isLoading: isLoadingProduct, error: productError } = useQuery<Product, Error>({
    queryKey: ["adminProductDetails", productId],
    queryFn: () => apiRequest('GET', `/api/admin/products/${productId}`), // Assumed API endpoint for single product
    enabled: !!productId, // Only fetch if productId is available
  });

  useEffect(() => {
    if (product) {
      setProductData(product); // Initialize form data with fetched product data
    }
  }, [product]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setProductData(prev => ({
      ...prev,
      [id]: value,
    }));
  };

  const handlePincodesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setProductData(prev => ({
      ...prev,
      deliveryPincodes: value.split(',').map(p => p.trim()).filter(p => p.length > 0),
    }));
  };

  // 2. Update Product Settings Mutation
  const updateProductSettingsMutation = useMutation<void, Error, Partial<Product>>({
    mutationFn: async (dataToUpdate: Partial<Product>) => {
      await apiRequest('PUT', `/api/admin/products/${productId}`, dataToUpdate); // Assumed API endpoint for updating product
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminProductDetails", productId] });
      toast({
        title: "उत्पाद सेटिंग्स अपडेटेड",
        description: "उत्पाद की सेटिंग्स सफलतापूर्वक अपडेट की गई हैं।",
        variant: "default",
      });
    },
    onError: (err) => {
      toast({
        title: "अपडेट विफल",
        description: (err as any).response?.data?.message || err.message || "उत्पाद की सेटिंग्स अपडेट करने में विफल।",
        variant: "destructive",
      });
    },
  });

  const handleUpdateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateProductSettingsMutation.mutate(productData);
  };

  if (isLoadingProduct) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (productError) {
    return <p className="p-4 text-red-500 text-center">उत्पाद विवरण लोड करने में त्रुटि: {productError.message}</p>;
  }

  if (!product) {
    return <p className="p-4 text-center">उत्पाद नहीं मिला।</p>;
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen font-inter">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold text-gray-800">उत्पाद विवरण: {product.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product Basic Information */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">मूलभूत जानकारी</h2>
          {product.imageUrl && (
            <img src={product.imageUrl} alt={product.name} className="w-full h-48 object-cover rounded-md mb-4" />
          )}
          <p className="mb-2"><strong>ID:</strong> {product.id}</p>
          <p className="mb-2"><strong>नाम:</strong> {product.name}</p>
          <p className="mb-2"><strong>विवरण:</strong> {product.description}</p>
          <p className="mb-2"><strong>मूल्य:</strong> ₹{product.price}</p>
          <p className="mb-2">
            <strong>स्थिति:</strong>
            <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${
                product.approvalStatus === "approved" ? "bg-green-100 text-green-800" :
                product.approvalStatus === "pending" ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-800"
              }`}>
              {product.approvalStatus}
            </span>
          </p>
          {/* Add more product details here if needed */}
        </div>

        {/* Product Delivery Pincode Settings */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">डिलीवरी पिनकोड सेटिंग्स</h2>
          <form onSubmit={handleUpdateSettings} className="space-y-4">
            <div>
              <Label htmlFor="deliveryPincodes">डिलीवरी पिनकोड (कॉमा से अलग)</Label>
              <Input
                id="deliveryPincodes"
                type="text"
                value={productData.deliveryPincodes?.join(', ') ?? ''}
                onChange={handlePincodesChange}
                placeholder="उदा. 110001, 110002, 110003"
              />
              <p className="text-xs text-muted-foreground mt-1">
                विशिष्ट पिनकोड जहां इस उत्पाद की डिलीवरी की जा सकती है। यह उच्चतम प्राथमिकता का नियम है।
              </p>
            </div>

            <Button type="submit" disabled={updateProductSettingsMutation.isPending}>
              {updateProductSettingsMutation.isPending ? 'सेटिंग्स सेव हो रही हैं...' : 'सेटिंग्स सेव करें'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminProductDetailsPage;
    
