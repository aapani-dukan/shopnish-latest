// client/src/pages/SellerProductsPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Loader2, Package } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import axiosInstance from '../../api/axiosInstance'; // आपका axios इंस्टेंस
import { getAuth } from 'firebase/auth'; // Firebase Auth से

// Shadcn UI Components (आपके रेपो से इम्पोर्ट पाथ)
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from '../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';

// आपके db/schema/product.ts से वास्तविक Product इंटरफ़ेस
interface Product {
  id: string; // Drizzle/PostgreSQL serial ID (string के रूप में हैंडल किया जा सकता है)
  sellerid: number;
  storeid: number;
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

const SellerProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ✅ आपके बैकएंड के अनुसार सही एंडपॉइंट (getAllProducts या getSellerProducts)
      // `getSellerProducts` के लिए, यह `/api/products/seller` होगा।
      // मान लें कि `productRoutes` `app.use("/api/products", productRoutes)` के तहत माउंटेड है।
      const response = await axios.get('/api/products/seller', { withCredentials: true });
      // API response structure को समायोजित करें: `response.data` सीधे array नहीं हो सकता
      setProducts(response.data.products || []); // मान लें कि उत्पादों को `products` key में भेजा जाता है
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      setError(err.response?.data?.message || 'उत्पादों को लोड करने में विफल।');
      toast.error(err.response?.data?.message || 'उत्पादों को लोड करने में विफल।');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteProduct = async (productId: string) => {
    setDeletingProductId(productId);
    try {
      // ✅ आपके बैकएंड के अनुसार सही एंडपॉइंट
      await axios.delete(`/api/products/${productId}`, { withCredentials: true });
      setProducts(prevProducts => prevProducts.filter(product => product.id !== productId));
      toast.success('उत्पाद सफलतापूर्वक हटाया गया।');
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      toast.error(err.response?.data?.message || 'उत्पाद हटाने में विफल।');
    } finally {
      setDeletingProductId(null);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) // यदि categoryName उपलब्ध है
  );

  if (loading) {
    return (
      <Card className="p-4 sm:p-6 lg:p-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="ml-2 text-lg text-gray-700">उत्पाद लोड हो रहे हैं...</p>
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
          <Button onClick={fetchProducts} className="mt-4" variant="destructive">
            पुनः प्रयास करें
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 lg:p-8">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-0 mb-6">
        <CardTitle className="text-3xl font-bold text-gray-800 mb-4 sm:mb-0">आपके उत्पाद</CardTitle>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Input
            type="text"
            placeholder="उत्पाद खोजें..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64"
          />
          <Link to="/seller-dashboard/products/add">
            <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4 mr-2" />
              उत्पाद जोड़ें
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filteredProducts.length === 0 ? (
          <div className="text-center p-10 bg-gray-50 rounded-lg">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <p className="text-lg text-gray-600 mt-4">कोई उत्पाद नहीं मिला।</p>
            <p className="text-gray-500 mt-2">अपना पहला उत्पाद जोड़ने के लिए ऊपर 'उत्पाद जोड़ें' पर क्लिक करें।</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-gray-200">
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">छवि</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">नाम</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">श्रेणी ID</TableHead> {/* categoryid दिखाएँ */}
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">मूल्य</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">स्टॉक</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">अनुमोदन</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">क्रियाएं</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="px-4 py-3 whitespace-nowrap">
                      <img
                        src={product.image || 'https://via.placeholder.com/50'} // सिंगल image फ़ील्ड का उपयोग करें
                        alt={product.name}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.categoryid || 'N/A'}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">₹{product.price.toFixed(2)}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.stock}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.approvalstatus === 'approved' ? 'bg-green-100 text-green-800' :
                          product.approvalstatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                      }`}>
                          {product.approvalstatus === 'approved' ? 'अनुमोदित' :
                           product.approvalstatus === 'pending' ? 'समीक्षा में' :
                           'अस्वीकृत'}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <Link to={`/seller-dashboard/products/edit/${product.id}`} className="text-indigo-600 hover:text-indigo-900 mr-2">
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">संपादित करें</span>
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-900" disabled={deletingProductId === product.id}>
                            {deletingProductId === product.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                            <span className="sr-only">डिलीट करें</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>क्या आप वाकई निश्चित हैं?</AlertDialogTitle>
                            <AlertDialogDescription>
                              यह क्रिया आपके उत्पाद को स्थायी रूप से हटा देगी।
                              आप इस क्रिया को पूर्ववत नहीं कर सकते।
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>रद्द करें</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteProduct(product.id)} variant="destructive">
                              जारी रखें
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SellerProductsPage;
