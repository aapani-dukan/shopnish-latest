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

// Firebase Storage क्लाइंट SDK
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase'; // ✅ अपनी firebase.ts फ़ाइल से इम्पोर्ट करें


interface ProductInput {
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string; // अब यह अपलोड होने के बाद URL रखेगा
  categoryid: string;
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
    categoryid: '',
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null); // ✅ चुनी हुई इमेज फ़ाइल
  const [imageUploadProgress, setImageUploadProgress] = useState<number>(0); // ✅ अपलोड प्रोग्रेस
  const [imageUploading, setImageUploading] = useState<boolean>(false); // ✅ इमेज अपलोड स्थिति
  const [loading, setLoading] = useState<boolean>(false); // मुख्य फॉर्म सबमिट लोडिंग
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // (आपके useEffect और handleChange फंक्शंस वही रहेंगे)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
      setErrors(prev => ({ ...prev, image: '' })); // इमेज एरर साफ़ करें
    } else {
      setSelectedImage(null);
    }
  };

  const handleImageUpload = async () => {
  if (!selectedImage) {
    toast.error('कृपया अपलोड करने के लिए एक इमेज चुनें।');
    return;
  }

  // **** यहाँ नए लॉग और चेक जोड़ें ****
  console.log("➡️ Before uploadBytesResumable:");
  console.log("➡️ selectedImage.name:", selectedImage.name);
  console.log("➡️ selectedImage.type:", selectedImage.type);
  console.log("➡️ selectedImage.size:", selectedImage.size); // <--- यह बहुत महत्वपूर्ण है
  console.log("➡️ selectedImage:", selectedImage); // <--- पूरे File ऑब्जेक्ट को भी लॉग करें

  // यदि फ़ाइल का आकार 0 है तो तुरंत रोकें
  if (selectedImage.size === 0) {
      toast.error('चुनी गई इमेज फ़ाइल खाली है या उसका आकार 0 बाइट्स है। कृपया एक वैध इमेज चुनें।');
      setImageUploading(false); // ✅ अपलोड रोकने के लिए
      return; // ✅ आगे अपलोड न करें
  }

  setImageUploading(true);
  const storageRef = ref(storage, `products/${Date.now()}_${selectedImage.name}`); // Firebase Storage में पाथ
  const uploadTask = uploadBytesResumable(storageRef, selectedImage);

  uploadTask.on(
    'state_changed',
    (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      setImageUploadProgress(progress);
      console.log(`➡️ Upload Progress: ${Math.round(progress)}%`); // प्रोग्रेस भी लॉग करें
    },
    (error) => {
      console.error('❌ Firebase Image Upload Error:', error); // Firebase से सीधे त्रुटि
      setImageUploading(false);
      toast.error('इमेज अपलोड करने में विफल।');
    },
    async () => {
      // अपलोड पूरा होने पर डाउनलोड URL प्राप्त करें
      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
      setFormData(prev => ({ ...prev, image: downloadURL })); // formData में URL अपडेट करें
      setImageUploading(false);
      toast.success('इमेज सफलतापूर्वक अपलोड की गई।');
      console.log('✅ Image uploaded successfully. Download URL:', downloadURL); // सफलता पर लॉग
    }
  );
};
  

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'उत्पाद का नाम आवश्यक है।';
    if (!formData.description) newErrors.description = 'विवरण आवश्यक है।';
    if (formData.price <= 0) newErrors.price = 'मूल्य 0 से अधिक होना चाहिए।';
    if (formData.stock < 0) newErrors.stock = 'स्टॉक ऋणात्मक नहीं हो सकता।';
    if (!formData.image) newErrors.image = 'उत्पाद की छवि आवश्यक है।'; // अब यह अपलोड किए गए URL की जाँच करेगा
    if (!formData.categoryid) newErrors.categoryid = 'श्रेणी आवश्यक है।';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // सुनिश्चित करें कि इमेज अपलोड हो चुकी है और formData.image में उसका URL है
    if (imageUploading) {
        toast.error('कृपया इमेज अपलोड पूरा होने का इंतजार करें।');
        return;
    }
    if (!validateForm()) {
      toast.error('कृपया फॉर्म में सभी आवश्यक फ़ील्ड भरें।');
      return;
    }

    setLoading(true);
    try {
      const dataToSend = {
          ...formData,
          categoryid: parseInt(formData.categoryid),
      };
      await axios.post('/api/products/create', dataToSend, { withCredentials: true });
      toast.success('उत्पाद सफलतापूर्वक जोड़ा गया।');
      navigate('/seller-dashboard/products');
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
          {/* अन्य फ़ील्ड्स (name, description, price, stock) */}

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="image-upload">उत्पाद छवि</Label>
            <Input
              id="image-upload"
              type="file" // ✅ अब यह एक फ़ाइल इनपुट है
              accept="image/jpeg, image/png, image/webp, image/heic" // ✅ स्वीकृत फॉर्मेट
              onChange={handleFileChange}
              disabled={loading || imageUploading}
            />
            {selectedImage && (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  type="button"
                  onClick={handleImageUpload}
                  disabled={imageUploading || !selectedImage}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {imageUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UploadCloud className="h-4 w-4 mr-2" />
                  )}
                  {imageUploading ? `अपलोड हो रहा है (${Math.round(imageUploadProgress)}%)` : 'छवि अपलोड करें'}
                </Button>
                {formData.image && (
                  <a href={formData.image} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                    अपलोड की गई छवि देखें
                  </a>
                )}
              </div>
            )}
            {errors.image && <p className="text-red-500 text-sm mt-1">{errors.image}</p>}

            {/* वैकल्पिक: इमेज का पूर्वावलोकन */}
            {selectedImage && !formData.image && (
                <div className="mt-4">
                    <p className="text-sm text-gray-600">पूर्वावलोकन:</p>
                    <img src={URL.createObjectURL(selectedImage)} alt="Image Preview" className="mt-2 h-32 w-32 object-cover rounded-lg" />
                </div>
            )}
            {formData.image && ( // एक बार इमेज अपलोड होने के बाद उसका पूर्वावलोकन दिखाएं
                <div className="mt-4">
                    <p className="text-sm text-gray-600">अपलोड की गई छवि:</p>
                    <img src={formData.image} alt="Uploaded Image" className="mt-2 h-32 w-32 object-cover rounded-lg" />
                </div>
            )}
          </div>

          {/* बाकी फ़ील्ड्स (categoryid) */}

          <Button type="submit" disabled={loading || imageUploading || !formData.image} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
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
            
