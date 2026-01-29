// client/src/pages/admin/AdminSettingsPage.tsx

"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Truck, Globe, Percent, Plus, Loader2, AlertCircle } from 'lucide-react'; // Added icons
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert"; // Assuming you have this component

// -------------------- Interfaces --------------------

interface AdminSettings {
  defaultDeliveryRadiusKm: number;
  baseDeliveryCharge: number;
  chargePerKm: number;
  freeDeliveryMinOrderValue: number;
}

interface Promocode {
  id: number;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue: number;
  expiryDate: string;
  isActive: boolean;
}

// -------------------- API Hooks --------------------

const useAdminSettings = () => useQuery<AdminSettings, Error>({
  queryKey: ['adminSettings'],
  queryFn: () => apiRequest('GET', '/api/admin/settings'),
});

const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AdminSettings>) => apiRequest('PUT', '/api/admin/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
      // सुझाव: यहां alert के बजाय Toast नोटिफिकेशन का उपयोग करें
      alert('Settings updated successfully!');
    },
    onError: (error: Error) => {
       // सुझाव: यहां alert के बजाय Toast नोटिफिकेशन का उपयोग करें
      alert(`Error updating settings: ${error.message}`);
    }
  });
};

const usePromocodes = () => useQuery<Promocode[], Error>({
  queryKey: ['promocodes'],
  queryFn: () => apiRequest('GET', '/api/admin/promocodes'),
});

// -------------------- Component --------------------

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  //const queryClient = useQueryClient();

  // --- Queries with Error States ---
  const { 
    data: settings, 
    isLoading: isLoadingSettings, 
    isError: isSettingsError, 
    error: settingsError 
  } = useAdminSettings();

  const { 
    data: promocodes, 
    isLoading: isLoadingPromocodes,
    isError: isPromocodesError,
    error: promocodesError
  } = usePromocodes();

  const { mutate: updateSettings, isPending: isUpdatingSettings } = useUpdateSettings();

  // --- Local State ---
  const [formData, setFormData] = useState<Partial<AdminSettings>>({});

  // State for Promo Code Modals (Future implementation)
  const [isAddPromoModalOpen, setIsAddPromoModalOpen] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<number | null>(null);


  // --- Effects ---
  React.useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // --- Handlers ---
  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = e.target;
    // बेसिक वैलिडेशन: नेगेटिव वैल्यू को रोकें
    if (type === 'number' && Number(value) < 0) return;

    setFormData(prev => ({
      ...prev,
      [id]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // HTML5 फॉर्म वैलिडेशन पास होने के बाद यह कॉल होगा
    updateSettings(formData);
  };

  // Promo Code Modal Handlers
  const openAddPromoModal = () => {
      console.log("Opening Add Promo Modal (Not implemented yet)");
      setIsAddPromoModalOpen(true);
  };

  const openEditPromoModal = (id: number) => {
      console.log(`Opening Edit Promo Modal for ID: ${id} (Not implemented yet)`);
      setEditingPromoId(id);
  };


  // --- Loading & Error States for Main Page ---

  if (isLoadingSettings) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin h-8 w-8 text-gray-500" /></div>;
  }

  if (isSettingsError) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load settings: {settingsError.message}. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold mb-6">Platform Settings</h1>
      
      {/* ------------------- 1. DELIVERY SETTINGS (Radius & Charges) ------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Truck className="w-5 h-5" />
            <span>Delivery and Geographical Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSettingsSubmit} className="space-y-4">
            {/* Default Delivery Radius (भूगोल) */}
            <div>
              <Label htmlFor="defaultDeliveryRadiusKm">Default Delivery Radius (in KM)</Label>
              <Input
                id="defaultDeliveryRadiusKm"
                type="number"
                value={formData.defaultDeliveryRadiusKm?.toString() || ''}
                onChange={handleSettingsChange}
                placeholder="e.g., 5"
                min="1"
                step="0.1" // दशमलव की अनुमति दें
                required
              />
              <p className="text-xs text-muted-foreground mt-1">यह उन विक्रेताओं के लिए है जिन्होंने अपना रेडियस सेट नहीं किया है।</p>
            </div>

            {/* Base Delivery Charge */}
            <div>
              <Label htmlFor="baseDeliveryCharge">Base Delivery Charge (₹)</Label>
              <Input
                id="baseDeliveryCharge"
                type="number"
                value={formData.baseDeliveryCharge?.toString() || ''}
                onChange={handleSettingsChange}
                placeholder="e.g., 20"
                min="0"
                required
              />
            </div>

            {/* Charge Per KM */}
            <div>
              <Label htmlFor="chargePerKm">Charge Per KM (₹)</Label>
              <Input
                id="chargePerKm"
                type="number"
                value={formData.chargePerKm?.toString() || ''}
                onChange={handleSettingsChange}
                placeholder="e.g., 5"
                min="0"
                step="0.5"
                required
              />
            </div>

            {/* Free Delivery Minimum Order Value */}
            <div>
              <Label htmlFor="freeDeliveryMinOrderValue">Min Order Value for Free Delivery (₹)</Label>
              <Input
                id="freeDeliveryMinOrderValue"
                type="number"
                value={formData.freeDeliveryMinOrderValue?.toString() || ''}
                onChange={handleSettingsChange}
                placeholder="e.g., 500"
                min="0"
                required
              />
            </div>

            <Button type="submit" disabled={isUpdatingSettings}>
              {isUpdatingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isUpdatingSettings ? 'Saving...' : 'Save Delivery Settings'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ------------------- 2. PROMO CODE / DISCOUNT MANAGEMENT ------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Percent className="w-5 h-5" />
            <span>Platform Discount & Promo Codes</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            {/* Updated onClick */}
            <Button variant="outline" onClick={openAddPromoModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Promo Code
            </Button>
          </div>
          
          {/* Enhanced Loading/Error state for Promo Codes */}
          {isLoadingPromocodes ? (
            <div className="text-center py-8 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-gray-400" /></div>
          ) : isPromocodesError ? (
             <div className="text-red-500 text-center py-4 bg-red-50 rounded">Error loading promocodes: {promocodesError.message}</div>
          ) : (
            <div className="space-y-3">
              {promocodes?.length === 0 && <p className="text-center text-gray-500 py-4">No promo codes found.</p>}
              {promocodes?.map(promo => (
                <div key={promo.id} className="p-3 border rounded-lg flex justify-between items-center bg-white hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="flex items-center">
                        <span className="font-bold text-lg tracking-wide mr-2">{promo.code}</span>
                        <Badge variant={promo.isActive ? 'default' : 'secondary'} className={promo.isActive ? "bg-green-600 hover:bg-green-700" : ""}>
                        {promo.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {promo.discountType === 'percentage' ? `${promo.discountValue}% OFF` : `₹${promo.discountValue} OFF`} | Min Order: ₹{promo.minOrderValue}
                    </p>
                    <p className="text-xs text-muted-foreground">Expires: {new Date(promo.expiryDate).toLocaleDateString()}</p>
                  </div>
                  {/* Updated onClick */}
                  <Button variant="ghost" size="sm" onClick={() => openEditPromoModal(promo.id)}>Edit</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* ------------------- 3. Pincode Management Link ------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5" />
            <span>Pincode and Zone Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-gray-600 mb-3">
                विक्रेता-विशिष्ट और उत्पाद-विशिष्ट डिलीवरी पिनकोड कवरेज को प्रबंधित करने के लिए नीचे दिए गए लिंक का उपयोग करें।
            </p>
            <div className="flex flex-wrap gap-4">
                <Button variant="secondary" className="flex items-center" onClick={() => navigate('/admin/vendors')}>
                    <Globe className="w-4 h-4 mr-2" />
                    Manage Vendor Pincodes
                </Button>
                <Button variant="secondary" className="flex items-center" onClick={() => navigate('/admin/products')}>
                    <Globe className="w-4 h-4 mr-2" />
                    Manage Product Pincodes
                </Button>
            </div>
        </CardContent>
      </Card>

      {/* TODO: Add Modals here
          <AddPromocodeModal isOpen={isAddPromoModalOpen} onClose={() => setIsAddPromoModalOpen(false)} />
          <EditPromocodeModal promoId={editingPromoId} onClose={() => setEditingPromoId(null)} />
      */}
{/* ✅ अब TypeScript खुश रहेगा क्योंकि वैल्यू का इस्तेमाल हो रहा है */}
      {isAddPromoModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <Card className="w-[400px]">
                <CardHeader><CardTitle>Add Promo Code</CardTitle></CardHeader>
                <CardContent>
                    <p>Promo code form yahan aayega...</p>
                    <Button onClick={() => setIsAddPromoModalOpen(false)}>Close</Button>
                </CardContent>
            </Card>
        </div>
      )}
      {/* ------------------- 4. PROMO CODE MODALS (The Real Deal) ------------------- */}
      
      {(isAddPromoModalOpen || editingPromoId !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl border-none">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center gap-2">
                {editingPromoId ? <Percent className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                {editingPromoId ? 'Edit Promo Code' : 'Create New Promo Code'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Promo Code Name</Label>
                <Input placeholder="e.g., BUNDI20" className="uppercase font-bold" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount Value</Label>
                  <Input type="number" placeholder="Value" />
                </div>
                <div className="space-y-2">
                  <Label>Min Order Value</Label>
                  <Input type="number" placeholder="Min ₹" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => {
                    setIsAddPromoModalOpen(false);
                    setEditingPromoId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700">
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
