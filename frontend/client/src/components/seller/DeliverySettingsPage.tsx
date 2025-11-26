// client/src/pages/seller/DeliverySettingsPage.tsx

"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient'; // Assuming this path is correct
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Loader2, AlertCircle, PlusCircle } from 'lucide-react';

// Import our custom components
import GlobalDeliverySettingsForm from '../../components/delivery/GlobalDeliverySettingsForm';
import ProductDeliveryOverrideModal from '../../components/delivery/ProductDeliveryOverrideModal';

// -------------------- Interfaces --------------------
// सुनिश्चित करें कि ये `types/delivery.ts` में परिभाषित हैं और यहाँ इम्पोर्टेड हैं।
// अगर आपने इन्हें कहीं और रखा है, तो पाथ को एडजस्ट करें।
import { SellerDeliverySettings, ProductDeliverySettings, DeliveryScope } from '../../types/delivery';


// -------------------- API Hooks for Seller Dashboard --------------------

// सेलर की ग्लोबल डिलीवरी सेटिंग्स फेच करें
const useSellerDeliverySettings = () => useQuery<SellerDeliverySettings, Error>({
  queryKey: ['sellerDeliverySettings'],
  queryFn: () => apiRequest('GET', '/api/sellers/profile/delivery-settings'),
});

// सेलर के सभी प्रोडक्ट्स फेच करें (डिलीवरी ओवरराइड डेटा सहित)
// हमें productId और name भी चाहिए, और deliveryScope, productDeliveryPincodes, productDeliveryRadiusKM
const useSellerProductsForDelivery = () => useQuery<ProductDeliverySettings[], Error>({
  queryKey: ['sellerProductsForDelivery'],
  // आपको एक ऐसा API एंडपॉइंट चाहिए जो सिर्फ आवश्यक प्रोडक्ट डेटा लौटाता हो
  // उदाहरण के लिए: GET /api/seller/products/delivery-settings-overview
  // या अगर आपका मौजूदा /api/seller/products सभी डेटा लौटाता है, तो आप उसे फिल्टर कर सकते हैं।
  queryFn: () => apiRequest('GET', '/api/sellers/products/delivery-overview'), // नया API एंडपॉइंट मान रहे हैं
});


// -------------------- Component --------------------

export default function SellerDeliverySettingsPage() {
  const queryClient = useQueryClient();

  // --- Global Settings ---
  const { 
    data: globalSettings, 
    isLoading: isLoadingGlobalSettings, 
    isError: isGlobalSettingsError, 
    error: globalSettingsError 
  } = useSellerDeliverySettings();

  // --- Product Overrides ---
  const { 
    data: products, 
    isLoading: isLoadingProducts, 
    isError: isProductsError, 
    error: productsError 
  } = useSellerProductsForDelivery();

  // State for Product Override Modal
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductDeliverySettings | null>(null);

  // --- Handlers ---
  const handleGlobalSettingsSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['sellerDeliverySettings'] });
    // यदि प्रोडक्ट डिलीवरी लॉजिक ग्लोबल सेटिंग्स पर निर्भर करता है, तो इसे भी अमान्य करें
    queryClient.invalidateQueries({ queryKey: ['sellerProductsForDelivery'] }); 
  };

  const handleProductSelected = (product: ProductDeliverySettings) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const handleProductModalClose = () => {
    setIsProductModalOpen(false);
    setSelectedProduct(null);
    queryClient.invalidateQueries({ queryKey: ['sellerProductsForDelivery'] }); // प्रोडक्ट लिस्ट को रिफ्रेश करें
  };

  // --- Loading States ---
  if (isLoadingGlobalSettings || isLoadingProducts) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin h-8 w-8 text-gray-500" /></div>;
  }

  // --- Error States ---
  if (isGlobalSettingsError) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load global delivery settings: {globalSettingsError.message}.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isProductsError) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load product delivery settings: {productsError.message}.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Ensure initial data is available
  if (!globalSettings) {
    // अगर globalSettings null है तो यह एक और तरह की त्रुटि है (या डेटा नहीं मिला)
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Alert variant="warning">
          <AlertTitle>No Settings Found</AlertTitle>
          <AlertDescription>
            No global delivery settings found for this seller. Please configure them.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold mb-6">Your Delivery Settings</h1>

      {/* ------------------- 1. GLOBAL DELIVERY SETTINGS FORM ------------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Global Shop Delivery Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <GlobalDeliverySettingsForm
            isAdmin={false} // यह सेलर का डैशबोर्ड है
            initialData={globalSettings}
            onSaveSuccess={handleGlobalSettingsSaved}
            // sellerId यहाँ आवश्यक नहीं है क्योंकि API स्वयं authenticated user के ID का उपयोग करता है।
          />
        </CardContent>
      </Card>

      {/* ------------------- 2. SELECTIVE DELIVERY (PRODUCT-WISE OVERRIDES) ------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Product-Specific Delivery Overrides</span>
            <Button variant="outline" onClick={() => {/* Future: Add a button to add new products if needed */}}>
              <PlusCircle className="w-4 h-4 mr-2" />
              Manage Products
            </Button>
          </CardTitle>
          <p className="text-sm text-gray-500">
            यहां आप विशिष्ट उत्पादों के लिए ग्लोबल डिलीवरी नियमों को ओवरराइड कर सकते हैं।
          </p>
        </CardHeader>
        <CardContent>
          {products && products.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Scope</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pincodes/Radius</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.deliveryScope === 'GLOBAL' && 'Global Default'}
                        {product.deliveryScope === 'PRODUCT_PINCODE' && 'Pincode Specific'}
                        {product.deliveryScope === 'PRODUCT_RADIUS' && 'Radius Specific'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.deliveryScope === 'PRODUCT_PINCODE' && product.productDeliveryPincodes?.join(', ')}
                        {product.deliveryScope === 'PRODUCT_RADIUS' && `${product.productDeliveryRadiusKM || 0} KM`}
                        {product.deliveryScope === 'GLOBAL' && 'N/A (Uses Global)'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleProductSelected(product)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">No products found for this seller.</p>
          )}
        </CardContent>
      </Card>

      {/* Product Override Modal */}
      {selectedProduct && (
        <ProductDeliveryOverrideModal
          product={selectedProduct}
          isOpen={isProductModalOpen}
          onClose={handleProductModalClose}
          isAdmin={false} // यह सेलर का डैशबोर्ड है
          // sellerId यहाँ भी आवश्यक नहीं है क्योंकि API स्वयं authenticated user के ID का उपयोग करता है
        />
      )}
    </div>
  );
}
