import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, PlusCircle, UploadCloud, Search, Package, Plus } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

// UI Components (आपके प्रोजेक्ट के हिसाब से)
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

interface Category {
  id: number;
  name: string;
}

const SellerAddProductPage: React.FC = () => {
  const navigate = useNavigate();

  // Mode: catalog (master list) or manual (new product)
  const [mode, setMode] = useState<'catalog' | 'manual'>('catalog');
  
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    masterProductId: null as number | null,
    name: '',
    description: '',
    price: 0,
    stock: 0,
    image: '',
    categoryId: '',
    brand: ''
  });

  // 1. श्रेणियों को लोड करना (पुरानी फाइल की तरह)
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get('/api/categories/all');
        setCategories(res.data);
      } catch (error) {
        toast.error("श्रेणियाँ लोड नहीं हो सकीं");
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // 2. मास्टर प्रोडक्ट सर्च (Debounced Search)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length > 2 && mode === 'catalog' && !formData.masterProductId) {
        try {
          const res = await axios.get(`https://shopnish-seprate.onrender.com/api/products/master-search?q=${searchTerm}`);
          setSearchResults(res.data);
        } catch (err) {
          console.error("Search failed", err);
        }
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, mode, formData.masterProductId]);

  const handleSelectMaster = (product: any) => {
    setFormData({
      ...formData,
      masterProductId: product.id,
      name: product.name,
      description: product.description,
      image: product.image,
      categoryId: product.categoryId.toString(),
      brand: product.brand || ''
    });
    setSearchResults([]);
    setSearchTerm(product.name);
    setErrors({});
    toast.success("Master product selected!");
  };

  // 3. Cloudinary इमेज अपलोड (AI Optimization के साथ)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size 5MB से कम होनी चाहिए");
      return;
    }

    setImageUploading(true);
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', 'shopnish_products'); 

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/dcah0b2jy/image/upload`, {
        method: 'POST',
        body: data,
      });
      const fileData = await res.json();
      
      // Cloudinary Transformation: Auto-crop to 800x800 square with white background
      const optimizedUrl = fileData.secure_url.replace('/upload/', '/upload/c_pad,h_800,w_800,bg_white/');
      
      setFormData(prev => ({ ...prev, image: optimizedUrl }));
      setErrors(prev => ({ ...prev, image: '' }));
      toast.success("Image uploaded & optimized! ✅");
    } catch (err) {
      toast.error("इमेज अपलोड करने में विफल!");
    } finally {
      setImageUploading(false);
    }
  };

  // 4. Form Validation (आपकी पुरानी फाइल वाला लॉजिक)
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = "उत्पाद का नाम आवश्यक है।";
    if (!formData.description) newErrors.description = "विवरण आवश्यक है।";
    if (formData.price <= 0) newErrors.price = "मूल्य 0 से अधिक होना चाहिए।";
    if (formData.stock < 0) newErrors.stock = "स्टॉक ऋणात्मक नहीं हो सकता।";
    if (!formData.image) newErrors.image = "कृपया इमेज अपलोड करें या मास्टर लिस्ट से चुनें।";
    if (!formData.categoryId) newErrors.categoryId = "श्रेणी आवश्यक है।";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imageUploading) { toast.error("कृपया इमेज अपलोड होने का इंतज़ार करें।"); return; }
    if (!validateForm()) { toast.error("कृपया सभी आवश्यक फ़ील्ड भरें।"); return; }

    setLoading(true);
    try {
      await axios.post("/api/products/create", formData, { withCredentials: true });
      toast.success("उत्पाद सफलतापूर्वक जोड़ा गया!");
      navigate("/seller-dashboard/products");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "उत्पाद जोड़ने में समस्या!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <Card className="shadow-xl border-t-4 border-indigo-600">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Package className="w-8 h-8 text-indigo-600" /> उत्पाद जोड़ें
          </CardTitle>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button 
              type="button"
              variant={mode === 'catalog' ? 'default' : 'outline'}
              onClick={() => { setMode('catalog'); setFormData({...formData, masterProductId: null, image: ''}); setSearchTerm(''); }}
              className={`flex-1 h-12 ${mode === 'catalog' ? 'bg-indigo-600' : ''}`}
            >
              <Search className="w-4 h-4 mr-2" /> कैटलॉग से चुनें
            </Button>
            <Button 
              type="button"
              variant={mode === 'manual' ? 'default' : 'outline'}
              onClick={() => { setMode('manual'); setFormData({...formData, masterProductId: null, image: '', name: '', description: '', categoryId: ''}); }}
              className={`flex-1 h-12 ${mode === 'manual' ? 'bg-indigo-600' : ''}`}
            >
              <Plus className="w-4 h-4 mr-2" /> नया डिज़ाइन अपलोड करें
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Catalog Search Section */}
            {mode === 'catalog' && !formData.masterProductId && (
              <div className="relative space-y-2">
                <Label htmlFor="search">उत्पाद खोजें (जैसे: Nestle, Axe, Nike)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    id="search"
                    placeholder="कैटलॉग में सर्च करें..." 
                    className="pl-10 h-11"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border rounded-lg mt-1 shadow-2xl max-h-72 overflow-y-auto">
                    {searchResults.map((p) => (
                      <div 
                        key={p.id} 
                        onClick={() => handleSelectMaster(p)}
                        className="p-4 hover:bg-indigo-50 cursor-pointer flex items-center gap-4 border-b last:border-0 transition-colors"
                      >
                        <img src={p.image} className="w-14 h-14 object-cover rounded-md border" alt={p.name} />
                        <div>
                          <p className="font-bold text-gray-800">{p.name}</p>
                          <p className="text-xs text-indigo-600 font-medium">{p.brand || 'General'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected Product Preview */}
            {formData.image && (
              <div className="p-4 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/50 flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                   <img src={formData.image} className="w-32 h-32 object-contain bg-white rounded-lg border shadow-md" alt="Preview" />
                   {mode === 'manual' && (
                     <label className="absolute -bottom-2 -right-2 bg-white p-1.5 rounded-full shadow-lg border cursor-pointer hover:bg-gray-50">
                       <UploadCloud className="w-4 h-4 text-indigo-600" />
                       <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                     </label>
                   )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h4 className="text-lg font-bold text-indigo-900">{formData.name || 'उत्पाद का नाम'}</h4>
                  <p className="text-sm text-gray-600 line-clamp-2">{formData.description}</p>
                  {mode === 'catalog' && (
                    <Button variant="ghost" size="sm" className="mt-2 text-red-500 h-8 hover:text-red-700 hover:bg-red-50" onClick={() => {setFormData({...formData, masterProductId: null, image: ''}); setSearchTerm('');}}>
                      बदलें (Remove)
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Common Inputs: Price & Stock */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="price">आपका विक्रय मूल्य (₹)</Label>
                <Input 
                  id="price"
                  type="number" 
                  value={formData.price || ''} 
                  onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} 
                  placeholder="0.00"
                />
                {errors.price && <p className="text-red-500 text-xs">{errors.price}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">उपलब्ध स्टॉक</Label>
                <Input 
                  id="stock"
                  type="number" 
                  value={formData.stock || ''} 
                  onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})} 
                  placeholder="कितने पीस हैं?"
                />
                {errors.stock && <p className="text-red-500 text-xs">{errors.stock}</p>}
              </div>
            </div>

            {/* Manual Mode Only Inputs */}
            {mode === 'manual' && (
              <div className="space-y-6 border-t pt-6">
                <div className="space-y-2">
                  <Label htmlFor="name">उत्पाद का नाम</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="उदा: मेरी डिज़ाइन वाली टी-शर्ट" />
                  {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">उत्पाद विवरण</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="उत्पाद के बारे में विस्तार से बताएं..." />
                  {errors.description && <p className="text-red-500 text-xs">{errors.description}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>श्रेणी (Category)</Label>
                    <Select
                      onValueChange={(val) => setFormData({...formData, categoryId: val})}
                      value={formData.categoryId}
                      disabled={categoriesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="श्रेणी चुनें" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {errors.categoryId && <p className="text-red-500 text-xs">{errors.categoryId}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>इमेज अपलोड</Label>
                    {!formData.image && (
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {imageUploading ? <Loader2 className="animate-spin text-indigo-600" /> : <UploadCloud className="w-8 h-8 text-gray-500" />}
                            <p className="text-sm text-gray-500 mt-2">फोटो चुनें</p>
                          </div>
                          <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" disabled={imageUploading} />
                        </label>
                      </div>
                    )}
                    {errors.image && <p className="text-red-500 text-xs">{errors.image}</p>}
                  </div>
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={loading || imageUploading} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 h-14 text-lg font-bold transition-all shadow-lg active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2" />}
              {mode === 'catalog' ? 'कैटलॉग से दुकान में जोड़ें' : 'अपना नया उत्पाद पब्लिश करें'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SellerAddProductPage;