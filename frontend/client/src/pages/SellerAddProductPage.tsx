// client/src/pages/SellerAddProductPage.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, PlusCircle, UploadCloud } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

// UI Components
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

// Firebase यूटिलिटी फ़ंक्शन
import { uploadProductImage } from "../utils/uploadImage";

interface ProductInput {
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string; // Firebase से प्राप्त URL
  categoryId: string;
}

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
    image: '', // इमेज URL के लिए खाली
    categoryId: '',
  });

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [loading, setLoading] = useState(false); // मुख्य फॉर्म सबमिशन के लिए लोडिंग
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});


  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get('/api/categories/all');
        setCategories(res.data);
      } catch (error) {
        console.error("श्रेणियाँ लोड नहीं हो सकीं:", error);
        toast.error("श्रेणियाँ लोड नहीं हो सकीं");
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);


  // Handle Change for form inputs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors((prev) => ({ ...prev, [name]: '' })); // संबंधित एरर को साफ़ करें
  };


  // Select Image (File input change)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
      setErrors((prev) => ({ ...prev, image: '' })); // इमेज एरर साफ़ करें
    } else {
      setSelectedImage(null);
    }
  };


  // Upload image to Firebase (via uploadProductImage utility)
  const handleImageUpload = async () => {
    if (!selectedImage) {
      toast.error("कृपया अपलोड करने के लिए एक इमेज चुनें।");
      return;
    }

    // ⭐ महत्वपूर्ण लॉगिंग: यहाँ selectedImage की जाँच करें
    console.log("🔥 handleImageUpload function called!");
    console.log("➡️ selectedImage.name:", selectedImage.name);
    console.log("➡️ selectedImage.type:", selectedImage.type);
    console.log("➡️ selectedImage.size:", selectedImage.size);
    console.log("➡️ selectedImage object:", selectedImage);


    // यदि फ़ाइल का आकार 0 है तो तुरंत रोकें
    if (selectedImage.size === 0) {
      toast.error('चुनी गई इमेज फ़ाइल खाली है या उसका आकार 0 बाइट्स है। कृपया एक वैध इमेज चुनें।');
      setImageUploading(false);
      return;
    }

    setImageUploading(true);

    try {
      // ⭐ uploadProductImage फ़ंक्शन यहाँ उपयोग किया जा रहा है
      const url = await uploadProductImage(selectedImage);
      setFormData((prev) => ({ ...prev, image: url }));
      toast.success("इमेज सफलतापूर्वक अपलोड की गई!");
      console.log('✅ Image uploaded successfully. Download URL:', url); // सफलता पर URL लॉग करें
    } catch (error) {
      console.error('❌ Image Upload Failed:', error); // त्रुटि को अधिक विस्तार से लॉग करें
      toast.error("इमेज अपलोड करने में विफल!");
    } finally {
      setImageUploading(false);
    }
  };


  // Form Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) newErrors.name = "उत्पाद का नाम आवश्यक है।";
    if (!formData.description) newErrors.description = "विवरण आवश्यक है।";
    if (formData.price <= 0) newErrors.price = "मूल्य 0 से अधिक होना चाहिए।";
    if (formData.stock < 0) newErrors.stock = "स्टॉक ऋणात्मक नहीं हो सकता।";
    if (!formData.image) newErrors.image = "कृपया इमेज अपलोड करें।"; // इमेज URL के लिए जाँच करें
    if (!formData.categoryId) newErrors.categoryId = "श्रेणी आवश्यक है।";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  // Submit Product Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (imageUploading) {
      toast.error("कृपया इमेज अपलोड होने का इंतज़ार करें।");
      return;
    }

    if (!validateForm()) {
      toast.error("कृपया सभी आवश्यक फ़ील्ड भरें।");
      return;
    }

    setLoading(true);

    try {
      const data = {
        ...formData,
        categoryId: parseInt(formData.categoryId), // categoryId को इंटीजर में पार्स करें
      };

      await axios.post("/api/products/create", data, { withCredentials: true });

      toast.success("उत्पाद सफलतापूर्वक जोड़ा गया!");
      navigate("/seller-dashboard/products");
    } catch (err: any) {
      console.error('Failed to add product:', err); // त्रुटि को अधिक विस्तार से लॉग करें
      toast.error(err.response?.data?.message || "उत्पाद जोड़ने में समस्या!");
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

          {/* PRODUCT NAME */}
          <div>
            <Label htmlFor="name">उत्पाद का नाम</Label>
            <Input id="name" name="name" value={formData.name} onChange={handleChange} />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* DESCRIPTION */}
          <div>
            <Label htmlFor="description">उत्पाद विवरण</Label>
            <Textarea id="description" name="description" value={formData.description} onChange={handleChange} />
            {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
          </div>

          {/* PRICE */}
          <div>
            <Label htmlFor="price">मूल्य</Label>
            <Input id="price" type="number" name="price" value={formData.price} onChange={handleChange} />
            {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price}</p>}
          </div>

          {/* STOCK */}
          <div>
            <Label htmlFor="stock">स्टॉक</Label>
            <Input id="stock" type="number" name="stock" value={formData.stock} onChange={handleChange} />
            {errors.stock && <p className="text-red-500 text-sm mt-1">{errors.stock}</p>}
          </div>

          {/* IMAGE UPLOAD */}
          <div className="space-y-2">
            <Label htmlFor="image-upload">उत्पाद छवि</Label>

            <Input
              id="image-upload" // ⭐ id जोड़ा गया
              type="file"
              accept="image/*"
              name="image-file" // ⭐ एक अद्वितीय नाम जोड़ा गया (यह formData.image से अलग है)
              onChange={handleFileChange}
              disabled={loading}
            />

            {/* इमेज पूर्वावलोकन: यदि selectedImage है लेकिन अभी तक अपलोड नहीं हुआ है */}
            {selectedImage && !formData.image && (
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Image Preview"
                className="h-32 w-32 rounded-lg object-cover mt-2"
              />
            )}

            {/* अपलोड की गई इमेज का पूर्वावलोकन: यदि formData.image में URL है */}
            {formData.image && (
              <img src={formData.image} alt="Uploaded Product" className="h-32 w-32 rounded-lg object-cover mt-2" />
            )}

            <Button
              type="button"
              disabled={!selectedImage || imageUploading || loading} // मुख्य फॉर्म लोडिंग के दौरान भी अक्षम करें
              onClick={handleImageUpload}
              className="bg-green-600 hover:bg-green-700"
            >
              {imageUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
              {imageUploading ? "अपलोड हो रहा है..." : "छवि अपलोड करें"}
            </Button>
            {errors.image && <p className="text-red-500 text-sm mt-1">{errors.image}</p>}
          </div>

          {/* CATEGORY */}
          <div>
            <Label htmlFor="categoryId">श्रेणी</Label>
            <Select
              name="categoryId" // ⭐ name जोड़ा गया
              onValueChange={(value) => {
                setFormData((prev) => ({ ...prev, categoryId: value }));
                setErrors((prev) => ({ ...prev, categoryId: '' })); // एरर साफ़ करें
              }}
              value={formData.categoryId} // ⭐ currentValue सेट किया गया
              disabled={categoriesLoading || loading} // लोडिंग के दौरान अक्षम करें
            >
              <SelectTrigger id="categoryId"> {/* ⭐ id जोड़ा गया */}
                <SelectValue placeholder="श्रेणी चुनें" />
              </SelectTrigger>
              <SelectContent>
                {categoriesLoading ? (
                  <SelectItem value="loading" disabled>लोड हो रहा है...</SelectItem>
                ) : categories.length === 0 ? (
                  <SelectItem value="no-categories" disabled>कोई श्रेणियाँ नहीं</SelectItem>
                ) : (
                  categories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.categoryId && <p className="text-red-500 text-sm mt-1">{errors.categoryId}</p>}
          </div>

          {/* SUBMIT */}
          <Button type="submit" disabled={loading || imageUploading || !formData.image} className="bg-indigo-600 hover:bg-indigo-700 w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
            उत्पाद जोड़ें
          </Button>

        </form>
      </CardContent>
    </Card>
  );
};

export default SellerAddProductPage;
