"use client";

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Truck, Globe, Percent, Plus, Loader2, AlertCircle, Layers, PackageSearch, ImageIcon, Wand2,BadgePercent , RefreshCw } from 'lucide-react'; // Added new icons
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert"; 
// -------------------- Interfaces --------------------

interface AdminSettings {
  defaultDeliveryRadius: number;
  baseDeliveryCharge: number;
  chargePerKm: number;
  freeDeliveryMinOrderValue: number;
  extraPickupCharge: number;
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
      alert('Settings updated successfully!');
    },
    onError: (error: Error) => {
      alert(`Error updating settings: ${error.message}`);
    }
  });
};

const usePromocodes = () => useQuery<Promocode[], Error>({
  queryKey: ['promocodes'],
  queryFn: () => apiRequest('GET', '/api/admin/promocodes'),
});

const useSyncActions = () => {
  return {
    master: useMutation({
      mutationFn: () => apiRequest('POST', '/api/admin/products/sync-master'),
      onSuccess: (data: any) => alert(data.message || 'Master sync started!'),
      onError: (error: Error) => alert(`Master Sync Error: ${error.message}`)
    }),
    manual: useMutation({
      mutationFn: () => apiRequest('POST', '/api/admin/products/sync-manual'),
      onSuccess: (data: any) => alert(data.message || 'Manual sync started!'),
      onError: (error: Error) => alert(`Manual Sync Error: ${error.message}`)
    }),
    gallery: useMutation({
      mutationFn: () => apiRequest('POST', '/api/admin/products/sync-gallery'),
      onSuccess: (data: any) => alert(data.message || 'Gallery sync started!'),
      onError: (error: Error) => alert(`Gallery Sync Error: ${error.message}`)
    })
  };
};

// -------------------- Component --------------------

export default function AdminSettingsPage() {
  const navigate = useNavigate();

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

  // --- Purane State ---
  const [formData, setFormData] = useState<Partial<AdminSettings>>({});
  const [isAddPromoModalOpen, setIsAddPromoModalOpen] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<number | null>(null);
  const syncActions = useSyncActions();

  // --- NAYE STATES: Commission & Brand Sync Remotes ---
  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [fmcgCommission, setFmcgCommission] = useState<string>('3.00');
  const [localCommission, setLocalCommission] = useState<string>('12.00');
  const [brandName, setBrandName] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // --- Effects ---
  React.useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Naye Dynamic Dropdowns Feed (On Mount Categories Load Karo)
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        setCategories(data || []);
      } catch (err) {
        console.error("Categories fail!", err);
      }
    }
    loadCategories();
  }, []);

  // Jab main category badle toh subcategories fetch karo dynamic
  const handleCategoryChange = async (catId: string) => {
    setSelectedCategory(catId);
    setSelectedSubCategory('');
    if (!catId) {
      setSubCategories([]);
      return;
    }
    try {
      const res = await fetch(`/api/categories/${catId}/subcategories`);
      const data = await res.json();
      setSubCategories(data || []);
    } catch (err) {
      console.error("Subcategories fail!", err);
    }
  };

  // --- Handlers ---
  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = e.target;
    if (type === 'number' && Number(value) < 0) return;

    setFormData(prev => ({
      ...prev,
      [id]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
  };

  // NAYE HANDLERS: Live operations
  const handleUpdateCommission = async () => {
    if (!selectedSubCategory) return alert("Pehle sub-category chuno bhai!");
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/subcategories/${selectedSubCategory}/commission`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fmcgBrandCommission: fmcgCommission, localBrandCommission: localCommission })
      });
      if (response.ok) {
        alert("Saff lock! Subcategory commission rate update ho gaya bhai साहब!");
      } else {
        alert("Commission update route failed!");
      }
    } catch (err) {
      alert("Network Error!");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncToBranded = async () => {
    if (!selectedSubCategory || !brandName.trim()) return alert("Subcategory aur Brand Name dono bhariye bhai साहब!");
    if (!confirm(`Kya aap is subcategory ke saare "${brandName}" products ko BRANDED (3%) me sync karna chahte hain?`)) return;
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/sync-specific-branded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subCategoryId: selectedSubCategory, brandName: brandName.trim() })
      });
      const data = await response.json();
      alert(data.message || "Sync Complete!");
      setBrandName('');
    } catch (err) {
      alert("Sync Operation Failed!");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkToLocal = async () => {
    if (!selectedSubCategory || !brandName.trim()) return alert("Subcategory aur Brand Name dono bhariye bhai!");
    if (!confirm(`Kya aap "${brandName}" ko wapas LOCAL (12%) bracket me rollback karna chahte hain?`)) return;
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/mark-specific-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subCategoryId: selectedSubCategory, brandName: brandName.trim() })
      });
      const data = await response.json();
      alert(data.message || "Rollback Complete!");
      setBrandName('');
    } catch (err) {
      alert("Rollback Operation Failed!");
    } finally {
      setActionLoading(false);
    }
  };

  // Purane Promo Code Modal Handlers
  const openAddPromoModal = () => {
      console.log("Opening Add Promo Modal (Not implemented yet)");
      setIsAddPromoModalOpen(true);
  };

  const openEditPromoModal = (id: number) => {
      console.log(`Opening Edit Promo Modal for ID: ${id} (Not implemented yet)`);
      setEditingPromoId(id);
  };

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
      
      {/* 🛡️ ------------------- NEW BLOCK: ADVANCED COMMISSION & BRAND MANAGER ------------------- */}
      <Card className="border-indigo-200 bg-indigo-50/10 shadow-md">
        <CardHeader className="bg-indigo-50/40 border-b border-indigo-100">
          <CardTitle className="flex items-center space-x-2 text-indigo-900">
            <BadgePercent className="w-5 h-5 text-indigo-700" />
            <span>Advanced Subcategory Commission & Brand Sync Manager</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Dropdowns */}
            <div className="space-y-4 bg-white p-4 border rounded-xl shadow-sm">
              <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-1">1. कैटलॉग टारगेट लॉक करें</h3>
              <div>
                <Label className="text-xs">मुख्य कैटेगरी चुनें</Label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500"
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">सब-कैटेगरी चुनें</Label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500"
                  value={selectedSubCategory}
                  onChange={(e) => {
                    setSelectedSubCategory(e.target.value);
                    const found = subCategories.find(s => String(s.id) === e.target.value);
                    if (found) {
                      setFmcgCommission(found.fmcgBrandCommission || '3.00');
                      setLocalCommission(found.localBrandCommission || '12.00');
                    }
                  }}
                  disabled={!selectedCategory}
                >
                  <option value="">-- Select Subcategory --</option>
                  {subCategories.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} {sub.nameHindi ? `(${sub.nameHindi})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Commission Settings Inputs */}
            <div className="space-y-4 bg-white p-4 border rounded-xl shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-sm text-gray-700 mb-3">2. लाइव सब-कैटेगरी कमीशन रेट सेट करें</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] text-gray-500">FMCG / BRANDED (%)</Label>
                    <Input type="number" step="0.01" value={fmcgCommission} onChange={(e) => setFmcgCommission(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-gray-500">LOCAL / UNBRANDED (%)</Label>
                    <Input type="number" step="0.01" value={localCommission} onChange={(e) => setLocalCommission(e.target.value)} className="mt-1" />
                  </div>
                </div>
              </div>
              <Button onClick={handleUpdateCommission} disabled={actionLoading || !selectedSubCategory} className="w-full bg-indigo-700 hover:bg-indigo-800 text-white mt-4">
                {actionLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Save Commission Rates
              </Button>
            </div>
          </div>

          {/* Brand Sync Actions Engine */}
          <div className="bg-white p-4 border rounded-xl shadow-sm space-y-4">
            <h3 className="font-semibold text-sm text-gray-700">3. सर्जिकल ब्रांड सिंक इंजन (Branded vs Local)</h3>
            <p className="text-xs text-gray-500">Subcategory ke andar kisi vishisht brand (e.g. Fortune, Tata) ka commission bracket badlein.</p>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <Label className="text-xs">टारगेट ब्रांड का नाम लिखें</Label>
                <Input placeholder="e.g., Fortune" value={brandName} onChange={(e) => setBrandName(e.target.value)} className="mt-1" />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Button onClick={handleSyncToBranded} disabled={actionLoading || !selectedSubCategory || !brandName} className="bg-green-600 hover:bg-green-700 text-white text-xs flex-1 md:flex-none">
                  ⚡ Sync to BRANDED
                </Button>
                <Button onClick={handleMarkToLocal} disabled={actionLoading || !selectedSubCategory || !brandName} variant="destructive" className="text-xs flex-1 md:flex-none">
                  ↩️ Mark to LOCAL
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <Label htmlFor="defaultDeliveryRadius">Default Delivery Radius (in KM)</Label>
              <Input
                id="defaultDeliveryRadius"
                type="number"
                value={formData.defaultDeliveryRadius?.toString() || ''}
                onChange={handleSettingsChange}
                placeholder="e.g., 5"
                min="1"
                step="0.1" 
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

            {/* --- Multi-Shop Bonus Section --- */}
            <div className="space-y-2">
              <label htmlFor="extraPickupCharge" className="block text-sm font-medium text-gray-700">
                Multi-Shop Pickup Bonus (₹)
              </label>
              <input
                id="extraPickupCharge" 
                type="number"
                step="0.01"
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 bg-white border-gray-300 text-sm"
                placeholder="e.g. 15"
                value={formData.extraPickupCharge || ''}
                onChange={handleSettingsChange}
                required
              />
              <p className="text-xs text-gray-500 italic">
                Ek se zyada dukanon se pickup होने पर डिलीवरी बॉय को मिलने वाला अतिरिक्त बोनस।
              </p>
            </div>

            <Button type="submit" disabled={isUpdatingSettings}>
              {isUpdatingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isUpdatingSettings ? 'Saving...' : 'Save Delivery Settings'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* SMART CATALOG CONTROL PANEL */}
      <Card className="border-orange-200 bg-orange-50/30">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-orange-700">
            <Wand2 className="w-5 h-5" />
            <span>Smart Catalog Sync Control</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1 border-b border-orange-100 pb-4">
            <h4 className="font-semibold text-gray-800">Smart Image Discovery Center</h4>
            <p className="text-sm text-gray-600">Placeholder इमेजेस को असली HD फोटोज से बदलें।</p>
            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-100">AI Powered Search</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. MASTER SYNC */}
            <div className="flex flex-col gap-3 p-4 border rounded-xl bg-white shadow-sm">
              <h5 className="text-xs font-bold text-indigo-700 flex items-center gap-1"><Layers className="w-3 h-3" /> 1. MASTER SYNC</h5>
              <p className="text-[10px] text-gray-500">मेन कैटलॉग के ब्रांडेड प्रोडक्ट्स को अपडेट करें।</p>
              <Button 
                disabled={syncActions.master.isPending} 
                onClick={() => confirm("Master Sync शुरू करें?") && syncActions.master.mutate()} 
                className="bg-indigo-700 hover:bg-indigo-800 text-white"
              >
                {syncActions.master.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Sync Master'}
              </Button>
            </div>

            {/* 2. SELLER PRODUCT SYNC */}
            <div className="flex flex-col gap-3 p-4 border rounded-xl bg-white shadow-sm">
              <h5 className="text-xs font-bold text-emerald-700 flex items-center gap-1"><PackageSearch className="w-3 h-3" /> 2. SELLER PRODUCTS SYNC</h5>
              <p className="text-[10px] text-gray-500">सेलर्स के प्रोडक्ट्स को अपडेट करें।</p>
              <Button 
                disabled={syncActions.manual.isPending} 
                onClick={() => confirm("Seller Products Sync शुरू करें?") && syncActions.manual.mutate()} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {syncActions.manual.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Sync Seller Products'}
              </Button>
            </div>

            {/* 3. GALLERY SYNC */}
            <div className="flex flex-col gap-3 p-4 border rounded-xl bg-white shadow-sm">
              <h5 className="text-xs font-bold text-orange-700 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> 3. GALLERY SYNC</h5>
              <p className="text-[10px] text-gray-500">प्रोडक्ट्स के अंदर 2-3 एक्स्ट्रा HD फोटोज भरें।</p>
              <Button 
                disabled={syncActions.gallery.isPending} 
                onClick={() => confirm("Gallery Sync शुरू करें?") && syncActions.gallery.mutate()} 
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {syncActions.gallery.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : 'Sync Gallery'}
              </Button>
            </div>
          </div>
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
            <Button variant="outline" onClick={openAddPromoModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Promo Code
            </Button>
          </div>
          
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
                <Button variant="secondary" className="flex items-center" onClick={() => navigate('/admin/delivery-areas')}>
                    <Globe className="w-4 h-4 mr-2" />
                    Manage Product Pincodes
                </Button>
            </div>
        </CardContent>
      </Card>

      {/* TypeScript safety fallback check validation using modal states */}
      {isAddPromoModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <Card className="w-[400px] bg-white">
                <CardHeader><CardTitle>Add Promo Code</CardTitle></CardHeader>
                <CardContent>
                    <p>Promo code form yahan aayega...</p>
                    <Button onClick={() => setIsAddPromoModalOpen(false)}>Close</Button>
                </CardContent>
            </Card>
        </div>
      )}
      
      {/* ------------------- 4. PROMO CODE MODALS ------------------- */}
      {(isAddPromoModalOpen || editingPromoId !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl border-none bg-white">
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
                <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white">
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