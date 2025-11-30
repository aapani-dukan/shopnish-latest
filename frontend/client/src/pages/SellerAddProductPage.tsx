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

// Firebase
import { uploadProductImage } from "../utils/uploadImage";

interface ProductInput {
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  categoryId: string;   // ⭐ FIXED (पहले categoryid था)
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
    image: '',
    categoryId: '',
  });

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});


  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get('/api/categories/all');
        setCategories(res.data);
      } catch {
        toast.error("श्रेणियाँ लोड नहीं हो सकीं");
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);


  // Handle Change
  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
  };


  // Select Image
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
      setErrors((prev) => ({ ...prev, image: '' }));
    }
  };


  // Upload image to Firebase
  const handleImageUpload = async () => {
    if (!selectedImage) {
      toast.error("कृपया एक इमेज चुनें।");
      return;
    }

    setImageUploading(true);

    try {
      const url = await uploadProductImage(selectedImage);
      setFormData((prev) => ({ ...prev, image: url }));
      toast.success("Image Uploaded Successfully!");
    } catch {
      toast.error("Image Upload Failed!");
    } finally {
      setImageUploading(false);
    }
  };


  // Form Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name) newErrors.name = "उत्पाद का नाम आवश्यक है।";
    if (!formData.description) newErrors.description = "विवरण आवश्यक है।";
    if (formData.price <= 0) newErrors.price = "मूल्य सही नहीं है।";
    if (formData.stock < 0) newErrors.stock = "स्टॉक गलत है।";
    if (!formData.image) newErrors.image = "कृपया इमेज अपलोड करें।";
    if (!formData.categoryId) newErrors.categoryId = "श्रेणी आवश्यक है।";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };


  // Submit
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
        categoryId: parseInt(formData.categoryId), // ⭐ FIXED
      };

      await axios.post("/api/products/create", data, { withCredentials: true });

      toast.success("उत्पाद सफलतापूर्वक जोड़ा गया!");
      navigate("/seller-dashboard/products");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "उत्पाद जोड़ने में समस्या!");
    } finally {
      setLoading(false);
    }
  };


  return (
    <Card className="p-6">
      <CardHeader>
        <CardTitle className="text-3xl font-bold">नया उत्पाद जोड़ें</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* PRODUCT NAME */}
          <div>
            <Label>उत्पाद का नाम</Label>
            <Input name="name" value={formData.name} onChange={handleChange} />
          </div>

          {/* DESCRIPTION */}
          <div>
            <Label>उत्पाद विवरण</Label>
            <Textarea name="description" value={formData.description} onChange={handleChange} />
          </div>

          {/* PRICE */}
          <div>
            <Label>मूल्य</Label>
            <Input type="number" name="price" value={formData.price} onChange={handleChange} />
          </div>

          {/* STOCK */}
          <div>
            <Label>स्टॉक</Label>
            <Input type="number" name="stock" value={formData.stock} onChange={handleChange} />
          </div>

          {/* IMAGE UPLOAD */}
          <div className="space-y-2">
            <Label>उत्पाद छवि</Label>

            <Input
              type="file"
              accept="image/*"
              name="image"        // ⭐ SUPER IMPORTANT FIX
              onChange={handleFileChange}
            />

            {selectedImage && !formData.image && (
              <img
                src={URL.createObjectURL(selectedImage)}
                className="h-32 w-32 rounded-lg object-cover mt-2"
              />
            )}

            {formData.image && (
              <img src={formData.image} className="h-32 w-32 rounded-lg object-cover mt-2" />
            )}

            <Button
              type="button"
              disabled={!selectedImage || imageUploading}
              onClick={handleImageUpload}
              className="bg-green-600"
            >
              {imageUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
              {imageUploading ? "अपलोड हो रहा है..." : "छवि अपलोड करें"}
            </Button>
          </div>

          {/* CATEGORY */}
          <div>
            <Label>श्रेणी</Label>
            <Select
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, categoryId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="श्रेणी चुनें" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SUBMIT */}
          <Button type="submit" disabled={loading} className="bg-indigo-600 w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
            उत्पाद जोड़ें
          </Button>

        </form>
      </CardContent>
    </Card>
  );
};

export default SellerAddProductPage;
