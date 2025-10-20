// client/src/pages/admin/AdminSettingsPage.tsx

"use client"; // Added "use client" directive

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryclient'; // Corrected path
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { DollarSign, Truck, Globe, Percent, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// -------------------- Interfaces --------------------

interface AdminSettings {
  defaultDeliveryRadiusKm: number;
  baseDeliveryCharge: number;
  chargePerKm: number;
  freeDeliveryMinOrderValue: number;
  // ... अन्य सेटिंग्स
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

const useAdminSettings = () => useQuery<AdminSettings>({
  queryKey: ['adminSettings'],
  queryFn: () => apiRequest('GET', '/api/admin/settings'),
});

const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AdminSettings>) => apiRequest('PUT', '/api/admin/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
      alert('Settings updated successfully!');
    },
    onError: (error: Error) => {
      alert(`Error updating settings: ${error.message}`);
    }
  });
};

const usePromocodes = () => useQuery<Promocode[]>({
  queryKey: ['promocodes'],
  queryFn: () => apiRequest('GET', '/api/admin/promocodes'),
});

// -------------------- Component --------------------

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const { data: settings, isLoading: isLoadingSettings } = useAdminSettings();
  const { mutate: updateSettings, isPending: isUpdatingSettings } = useUpdateSettings();

  const { data: promocodes, isLoading: isLoadingPromocodes } = usePromocodes();

  const [formData, setFormData] = useState<Partial<AdminSettings>>({});

  React.useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
  };

  if (isLoadingSettings) {
    return <div className="text-center p-8">Loading Settings...</div>;
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
                value={formData.defaultDeliveryRadiusKm || ''}
                onChange={handleSettingsChange}
                placeholder="e.g., 5"
                min="1"
              />
              <p className="text-xs text-muted-foreground mt-1">यह उन विक्रेताओं के लिए है जिन्होंने अपना रेडियस सेट नहीं किया है।</p>
            </div>

            {/* Base Delivery Charge */}
            <div>
              <Label htmlFor="baseDeliveryCharge">Base Delivery Charge (₹)</Label>
              <Input
                id="baseDeliveryCharge"
                type="number"
                value={formData.baseDeliveryCharge || ''}
                onChange={handleSettingsChange}
                placeholder="e.g., 20"
                min="0"
              />
            </div>

            {/* Charge Per KM */}
            <div>
              <Label htmlFor="chargePerKm">Charge Per KM (₹)</Label>
              <Input
                id="chargePerKm"
                type="number"
                value={formData.chargePerKm || ''}
                onChange={handleSettingsChange}
                placeholder="e.g., 5"
                min="0"
              />
            </div>

            {/* Free Delivery Minimum Order Value */}
            <div>
              <Label htmlFor="freeDeliveryMinOrderValue">Min Order Value for Free Delivery (₹)</Label>
              <Input
                id="freeDeliveryMinOrderValue"
                type="number"
                value={formData.freeDeliveryMinOrderValue || ''}
                onChange={handleSettingsChange}
                placeholder="e.g., 500"
                min="0"
              />
            </div>

            <Button type="submit" disabled={isUpdatingSettings}>
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
            <Button variant="outline" onClick={() => {/* Open Promo Code Creation Modal */}}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Promo Code
            </Button>
          </div>
          
          {isLoadingPromocodes ? (
            <div className="text-center">Loading Promo Codes...</div>
          ) : (
            <div className="space-y-3">
              {promocodes?.length === 0 && <p className="text-center text-gray-500">No promo codes found.</p>}
              {promocodes?.map(promo => (
                <div key={promo.id} className="p-3 border rounded-lg flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-lg">{promo.code}</span>
                    <Badge variant={promo.isActive ? 'default' : 'secondary'} className="ml-2">
                      {promo.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <p className="text-sm text-gray-600">
                      {promo.discountType === 'percentage' ? `${promo.discountValue}% OFF` : `₹${promo.discountValue} OFF`} | Min: ₹{promo.minOrderValue}
                    </p>
                    <p className="text-xs text-muted-foreground">Expires: {new Date(promo.expiryDate).toLocaleDateString()}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => {/* Open Edit Modal */}}>Edit</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* ------------------- 3. Pincode Management Link (विक्रेता / उत्पाद स्तर पर) ------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5" />
            <span>Pincode and Zone Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-gray-600 mb-3">
                विक्रेता-विशिष्ट और उत्पाद-विशिष्ट डिलीवरी पिनकोड कवरेज को प्रबंधित करने के लिए विक्रेता या उत्पाद प्रबंधन पृष्ठ पर जाएं।
            </p>
            <div className="space-x-4">
                <Button variant="secondary" onClick={() => navigate('/admin/vendors')}>
                    Manage Vendor Pincodes
                </Button>
                <Button variant="secondary" onClick={() => navigate('/admin/products')}>
                    Manage Product Pincodes
                </Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
