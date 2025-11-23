// client/src/pages/SellerAddProductLage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, PlusCircle } from 'lucide-react';
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

// आपके db/schema/product.ts से अनुकूलित ProductInput प्रकार
interface ProductInput {
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string; // सिंगल इमेज URL
  categoryid: string; // अब categoryid एक string के रूप में भेज रहे हैं (select value string होती है)
  // अन्य फ़ील्ड्स जैसे storeId, sellerId बैकएंड द्वारा हैंडल किए जाने चाहिए
}

// Categories स्कीमा से अनुमानित
interface Category {
    id: number;
    name: string;
}

const SellerAddProductPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<ProductInput>({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    image: '',
    categoryid: '',
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]); // API से फेच की गई श्रेणियां
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

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


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    setErrors(prev => ({ ...prev, [id]: '' }));
  };

  const handleSelectChange = (value: string, id: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
    setErrors(prev => ({ ...prev, [id]: '' }));
  };

  const validateForm = () => {
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
    if (!validateForm()) {
      toast.error('कृपया फॉर्म में सभी आवश्यक फ़ील्ड भरें।');
      return;
    }

    setLoading(true);
    try {
      // API को भेजने से पहले categoryid को संख्या में बदलें
      const dataToSend = {
          ...formData,
          categoryid: parseInt(formData.categoryid), // string से number में बदलें
      };
      // ✅ आपके बैकएंड के अनुसार सही एंडपॉइंट
      await axios.post('/api/products/create', dataToSend, { withCredentials: true });
      toast.success('उत्पाद सफलतापूर्वक जोड़ा गया।');
      navigate('/seller-dashboard/products'); // उत्पाद सूची पेज पर रीडायरेक्ट करें
    } catch (err: any) {
      console.error('Failed to add product:', err);
      toast.error(err.response?.data?.message || 'उत्पाद जोड़ने में विफल।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 sm:p-6 lg:p-8">
      <CardHeader className="p-0 mb-6">
        <CardTitle className="text-3xl font-bold text-gray-800">नया उत्पाद जोड़ें</CardTitle>
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
              disabled={loading}
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
              disabled={loading}
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
                disabled={loading}
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
                disabled={loading}
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
              disabled={loading}
            />
            {errors.image && <p className="text-red-500 text-sm mt-1">{errors.image}</p>}
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="categoryid">श्रेणी</Label>
            <Select onValueChange={(value) => handleSelectChange(value, 'categoryid')} value={formData.categoryid} disabled={loading || categoriesLoading}>
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

          <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <PlusCircle className="h-4 w-4 mr-2" />
            )}
            उत्पाद जोड़ें
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SellerAddProductPage;
