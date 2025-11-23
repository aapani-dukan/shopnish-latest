// client/src/pages/sellereditproductpage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Save } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

// Shadcn UI Components
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

// आपके db/schema/product.ts से वास्तविक Product इंटरफ़ेस
interface Product {
  id: string; // Drizzle/PostgreSQL serial ID
  sellerid: number;
  storeid?: number; // store_id nullable हो सकता है
  categoryid: number; // यह एक ID है, नाम नहीं
  name: string;
  namehindi?: string;
  description: string;
  descriptionhindi?: string;
  price: number;
  originalprice?: number;
  image: string; // सिंगल इमेज URL
  images?: string[]; // इमेज URL का array
  unit: string;
  brand?: string;
  stock: number;
  minorderqty?: number;
  maxorderqty?: number;
  isactive: boolean;
  deliveryscope: string;
  productdeliverypincodes?: string[];
  productdeliveryradiuskm?: number;
  estimateddeliverytime?: string;
  approvalstatus: 'pending' | 'approved' | 'rejected'; // enum के अनुसार
  approvedat?: string;
  rejectionreason?: string;
  createdat: string;
  updatedat: string;
  // यदि API category name को join करके देता है तो आप इसे यहां जोड़ सकते हैं
  categoryName?: string;
}

// Categories स्कीमा से अनुमानित
interface Category {
    id: number;
    name: string;
}

const SellerEditProductPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // शुरुआती लोडिंग उत्पाद डेटा के लिए
  const [saving, setSaving] = useState<boolean>(false); // फॉर्म सबमिट के लिए
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]); // API से फेच की गई श्रेणियां
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);


  // API से श्रेणियां फेच करें
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // ✅ आपके बैकएंड के अनुसार सही एंडपॉइंट
        const response = await axios.get('/api/categories/all', { withCredentials: true }); // मान लें कि यह एंडपॉइंट सभी श्रेणियां देता है
        setCategories(response.data.categories || []);
      } catch (err: any) {
        console.error('Failed to fetch categories:', err);
        toast.error(err.response?.data?.message || 'श्रेणियां लोड करने में विफल।');
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);


  const fetchProduct = useCallback(async () => {
    if (!productId) {
      setError('उत्पाद ID गायब है।');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // ✅ आपके बैकएंड के अनुसार सही एंडपॉइंट
      const response = await axios.get(`/api/products/${productId}`, { withCredentials: true });
      setFormData(response.data.product); // API प्रतिक्रिया से .product ऑब्जेक्ट निकालें
    } catch (err: any) {
      console.error('Failed to fetch product for editing:', err);
      setError(err.response?.data?.message || 'उत्पाद डेटा लोड करने में विफल।');
      toast.error(err.response?.data?.message || 'उत्पाद डेटा लोड करने में विफल।');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    // सुनिश्चित करें कि श्रेणियां पहले लोड हो जाएं ताकि product data सेट होने पर select सही मान दिखा सके
    if (!categoriesLoading) {
      fetchProduct();
    }
  }, [fetchProduct, categoriesLoading]); // categoriesLoading पर निर्भरता जोड़ें

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => prev ? { ...prev, [id]: value } : null);
    setErrors(prev => ({ ...prev, [id]: '' }));
  };

  const handleSelectChange = (value: string, id: string) => {
    // categoryid को number में बदलें
    setFormData(prev => prev ? { ...prev, [id]: parseInt(value) } : null);
    setErrors(prev => ({ ...prev, [id]: '' }));
  };

  const validateForm = () => {
    if (!formData) return false;
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'उत्पाद का नाम आवश्यक है।';
    if (!formData.description) newErrors.description = 'विवरण आवश्यक है।';
    if (formData.price <= 0) newErrors.price = 'मूल्य 0 से अधिक होना चाहिए।';
    if (formData.stock < 0) newErrors.stock = 'स्टॉक ऋणात्मक नहीं हो सकता।';
    if (!formData.image) newErrors.image = 'छवि URL आवश्यक है।'; // सिंगल image फ़ील्ड
    if (!formData.categoryid) newErrors.categoryid = 'श्रेणी आवश्यक है।';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !validateForm()) {
      toast.error('कृपया फॉर्म में सभी आवश्यक फ़ील्ड भरें।');
      return;
    }

    setSaving(true);
    try {
      // API को भेजने से पहले categoryid को संख्या में बदलें (यह पहले ही handleSelectChange में हो गया है, लेकिन सुनिश्चित करें)
      const dataToSend = {
          name: formData.name,
          description: formData.description,
          price: formData.price,
          stock: formData.stock,
          image: formData.image,
          categoryid: formData.categoryid, // यह पहले से ही number है
          // अन्य फ़ील्ड्स जिन्हें आप अपडेट करने की अनुमति देते हैं, उन्हें यहां जोड़ें
          // जैसे: originalprice, unit, brand, isactive, deliveryscope, etc.
          // छवियों के लिए: images फ़ील्ड (यदि आप कई छवियों का समर्थन करते हैं)
          images: formData.images, // यदि बैकएंड इसे अपडेट करने की उम्मीद करता है
      };
      // ✅ आपके बैकएंड के अनुसार सही एंडपॉइंट
      await axios.put(`/api/products/${productId}`, dataToSend, { withCredentials: true });
      toast.success('उत्पाद सफलतापूर्वक अपडेट किया गया।');
      navigate('/seller-dashboard/products');
    } catch (err: any) {
      console.error('Failed to update product:', err);
      toast.error(err.response?.data?.message || 'उत्पाद अपडेट करने में विफल।');
    } finally {
      setSaving(false);
    }
  };

  if (loading || categoriesLoading) { // दोनों लोडिंग स्टेट्स को हैंडल करें
    return (
      <Card className="p-4 sm:p-6 lg:p-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="ml-2 text-lg text-gray-700">{loading ? 'उत्पाद डेटा लोड हो रहा है...' : 'श्रेणियां लोड हो रही हैं...'}</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 sm:p-6 lg:p-8">
        <div className="text-center p-8 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-xl font-semibold text-red-700">त्रुटि</h2>
          <p className="text-red-600 mt-2">{error}</p>
          <Button onClick={fetchProduct} className="mt-4" variant="destructive">
            पुनः प्रयास करें
          </Button>
        </div>
      </Card>
    );
  }

  if (!formData) {
    return (
        <Card className="p-4 sm:p-6 lg:p-8">
            <div className="text-center p-8">
                <h2 className="text-xl font-semibold text-gray-700">उत्पाद नहीं मिला</h2>
                <p className="text-gray-600 mt-2">संपादित करने के लिए कोई उत्पाद डेटा उपलब्ध नहीं है।</p>
                <Button onClick={() => navigate('/seller-dashboard/products')} className="mt-4">
                    उत्पाद सूची पर वापस जाएं
                </Button>
            </div>
        </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 lg:p-8">
      <CardHeader className="p-0 mb-6">
        <CardTitle className="text-3xl font-bold text-gray-800">उत्पाद संपादित करें: {formData.name}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="name">उत्पाद का नाम</Label>
            <Input
              type="text"
              id="name"
              placeholder="फैंसी टी-शर्ट"
              value={formData.name}
              onChange={handleChange}
              disabled={saving}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="description">विवरण</Label>
            <Textarea
              id="description"
              placeholder="उत्पाद का विस्तृत विवरण..."
              value={formData.description}
              onChange={handleChange}
              disabled={saving}
              rows={4}
            />
            {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="price">मूल्य (₹)</Label>
              <Input
                type="number"
                id="price"
                placeholder="199.99"
                value={formData.price}
                onChange={handleChange}
                disabled={saving}
                min="0"
                step="0.01"
              />
              {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price}</p>}
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="stock">स्टॉक</Label>
              <Input
                type="number"
                id="stock"
                placeholder="100"
                value={formData.stock}
                onChange={handleChange}
                disabled={saving}
                min="0"
              />
              {errors.stock && <p className="text-red-500 text-sm mt-1">{errors.stock}</p>}
            </div>
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="image">छवि URL</Label> {/* सिंगल image फ़ील्ड */}
            <Input
              type="url"
              id="image"
              placeholder="https://example.com/product-image.jpg"
              value={formData.image}
              onChange={handleChange}
              disabled={saving}
            />
            {errors.image && <p className="text-red-500 text-sm mt-1">{errors.image}</p>}
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="categoryid">श्रेणी</Label>
            <Select onValueChange={(value) => handleSelectChange(value, 'categoryid')} value={String(formData.categoryid)} disabled={saving || categoriesLoading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={categoriesLoading ? "श्रेणियां लोड हो रही हैं..." : "एक श्रेणी चुनें"} />
              </SelectTrigger>
              <SelectContent>
                {categories.length > 0 ? (
                    categories.map(category => (
                        <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
                    ))
                ) : (
                    <SelectItem value="" disabled>कोई श्रेणी उपलब्ध नहीं</SelectItem>
                )}
              </SelectContent>
            </Select>
            {errors.categoryid && <p className="text-red-500 text-sm mt-1">{errors.categoryid}</p>}
          </div>

          <Button type="submit" disabled={saving} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            परिवर्तन सहेजें
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SellerEditProductPage;
