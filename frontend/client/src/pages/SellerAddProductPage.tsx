import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, PlusCircle, UploadCloud, Search, Package, CheckCircle2, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

// UI Components
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { auth } from "../lib/firebase";

interface Category { id: number; name: string; }

const SellerAddProductPage: React.FC = () => {
  const navigate = useNavigate();

  // --- States ---
  const [mode, setMode] = useState<'catalog' | 'manual'>('catalog');
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Catalog States
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [masterProducts, setMasterProducts] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<number, {price: number, stock: number}>>({});

  // Manual Mode State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    image: '',
    categoryId: '',
    brand: ''
  });

  // 1. श्रेणियाँ लोड करें
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get('/api/categories');
        setCategories(res.data);
      } catch (error) { toast.error("श्रेणियाँ लोड नहीं हो सकीं"); }
    };
    fetchCategories();
  }, []);

  // 2. मास्टर प्रोडक्ट लाइव सर्च और फिल्टर
  useEffect(() => {
    const fetchMasterData = async () => {
      if (mode !== 'catalog') return;
      if (!selectedCat && searchTerm.length < 2) {
        setMasterProducts([]);
        return;
      }
      try {
        let url = `https://shopnish-seprate.onrender.com/api/products/master-search?q=${searchTerm}`;
        if (selectedCat && selectedCat !== "all") url += `&categoryId=${selectedCat}`;
        const res = await axios.get(url);
        setMasterProducts(res.data);
      } catch (err) { console.error("Search failed", err); }
    };
    const timer = setTimeout(fetchMasterData, 400);
    return () => clearTimeout(timer);
  }, [selectedCat, searchTerm, mode]);

  // --- Handlers ---

  const toggleProduct = (productId: number) => {
    setSelectedItems(prev => {
      const newItems = { ...prev };
      if (newItems[productId]) delete newItems[productId];
      else newItems[productId] = { price: 0, stock: 10 };
      return newItems;
    });
  };

  const updateItemData = (id: number, field: 'price' | 'stock', value: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', 'shopnish_products'); 
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/dcah0b2jy/image/upload`, { method: 'POST', body: data });
      const fileData = await res.json();
      setFormData(prev => ({ ...prev, image: fileData.secure_url }));
      toast.success("Image uploaded!");
    } catch (err) { toast.error("Upload failed!"); }
    finally { setImageUploading(false); }
  };

  // 3. Submit Handler (Dono Modes ke liye)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = auth.currentUser;
      const token = await user?.getIdToken();
      if (!token) throw new Error("No token found");

      if (mode === 'catalog') {
        // --- Catalog Bulk Submit ---
        const itemIds = Object.keys(selectedItems);
        if (itemIds.length === 0) { toast.error("कृपया कम से कम एक उत्पाद चुनें"); setLoading(false); return; }

        const payload = itemIds.map(id => {
          const p = masterProducts.find(mp => mp.id === Number(id));
          return {
            masterProductId: p.id,
            name: p.name,
            image: p.image,
            categoryId: p.categoryId,
            price: selectedItems[p.id].price,
            stock: selectedItems[p.id].stock,
          };
        });

        await axios.post("/api/products/bulk", { products: payload }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Catalog items added!");
      } else {
        // --- Manual Mode Submit ---
        if (!formData.image) { toast.error("कृपया इमेज अपलोड करें"); setLoading(false); return; }
        await axios.post("/api/products", formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("New product published!");
      }
      navigate("/seller-dashboard/products");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Submit failed!");
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <Card className="shadow-2xl border-t-8 border-indigo-600">
        <CardHeader className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-3xl font-black flex items-center gap-2">
              <Package className="w-8 h-8 text-indigo-600" /> उत्पाद प्रबंधन
            </CardTitle>
            <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
              <button 
                onClick={() => setMode('catalog')}
                className={`flex-1 md:px-6 py-2 rounded-md text-sm font-bold transition-all ${mode === 'catalog' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
              >
                Catalog से जोड़ें
              </button>
              <button 
                onClick={() => setMode('manual')}
                className={`flex-1 md:px-6 py-2 rounded-md text-sm font-bold transition-all ${mode === 'manual' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
              >
                खुद का नया उत्पाद
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {mode === 'catalog' ? (
            <div className="space-y-6">
              {/* Filter & Search */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <div className="space-y-2">
                  <Label className="font-bold">Category</Label>
                  <Select onValueChange={setSelectedCat} value={selectedCat}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="कैटेगरी चुनें" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">सभी श्रेणियाँ</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">Search Product</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input className="pl-10 bg-white" placeholder="नाम से खोजें..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Selection List */}
              <div className="border rounded-xl bg-white overflow-hidden shadow-inner min-h-[300px]">
                <div className="max-h-[500px] overflow-y-auto divide-y">
                  {masterProducts.map((p) => {
                    const isSelected = !!selectedItems[p.id];
                    return (
                      <div key={p.id} className={`flex flex-col sm:flex-row items-center gap-4 p-4 transition-all ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-4 w-full">
                           <input type="checkbox" checked={isSelected} onChange={() => toggleProduct(p.id)} className="w-5 h-5 accent-indigo-600 cursor-pointer" />
                           <img src={p.image} className="w-16 h-16 object-contain bg-white rounded-lg border shadow-sm" alt="" />
                           <div className="flex-1">
                             <p className="font-bold text-gray-800 leading-tight">{p.name}</p>
                             <p className="text-xs text-indigo-600 font-medium">{p.brand || 'No Brand'}</p>
                             {p.unit && (
      <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-bold">
        {p.unit}
      </span>
    )}
                           </div>
                        </div>

                        {isSelected && (
                          <div className="flex gap-3 w-full sm:w-auto pt-2 sm:pt-0 animate-in fade-in zoom-in-95">
                            <div className="flex-1 sm:w-28">
                              <Label className="text-[10px] uppercase font-bold text-gray-400">Price (₹)</Label>
                              <Input type="number" className="h-9 border-indigo-200 focus:ring-indigo-500" placeholder="0" 
                                onChange={(e) => updateItemData(p.id, 'price', Number(e.target.value))} />
                            </div>
                            <div className="flex-1 sm:w-24">
                              <Label className="text-[10px] uppercase font-bold text-gray-400">Stock</Label>
                              <Input type="number" className="h-9 border-indigo-200 focus:ring-indigo-500" placeholder="0" 
                                onChange={(e) => updateItemData(p.id, 'stock', Number(e.target.value))} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {masterProducts.length === 0 && (
                    <div className="p-20 text-center text-gray-400 flex flex-col items-center gap-2">
                       <Search className="w-10 h-10 opacity-20" />
                       <p>खोज शुरू करने के लिए कैटेगरी चुनें या नाम लिखें</p>
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={handleSubmit} disabled={loading || Object.keys(selectedItems).length === 0} className="w-full h-16 text-xl bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg transition-transform active:scale-95">
                {loading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                {Object.keys(selectedItems).length} उत्पाद दुकान में जोड़ें
              </Button>
            </div>
          ) : (
            /* Manual Mode Form */
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-500">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="font-bold">उत्पाद का नाम</Label>
                      <Input placeholder="उदा: मेरी हाथ से बनी चॉकलेट" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold">विवरण (Description)</Label>
                      <Textarea className="h-32" placeholder="उत्पाद की खूबियां बताएं..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="font-bold">उत्पाद की फोटो</Label>
                      <div className="relative group border-2 border-dashed border-gray-300 rounded-2xl h-48 flex items-center justify-center overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors">
                        {formData.image ? (
                          <>
                            <img src={formData.image} className="w-full h-full object-contain" alt="Preview" />
                            <button type="button" onClick={() => setFormData({...formData, image: ''})} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <label className="cursor-pointer flex flex-col items-center gap-2">
                             {imageUploading ? <Loader2 className="animate-spin text-indigo-600" /> : <UploadCloud className="w-10 h-10 text-gray-400" />}
                             <span className="text-sm font-medium text-gray-500">फोटो अपलोड करें</span>
                             <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                          </label>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                         <Label className="font-bold">मूल्य (₹)</Label>
                         <Input type="number" value={formData.price || ''} onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} required />
                       </div>
                       <div className="space-y-2">
                         <Label className="font-bold">स्टॉक</Label>
                         <Input type="number" value={formData.stock || ''} onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})} required />
                       </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold">श्रेणी (Category)</Label>
                      <Select onValueChange={(val) => setFormData({...formData, categoryId: val})} value={formData.categoryId}>
                        <SelectTrigger><SelectValue placeholder="कैटेगरी चुनें" /></SelectTrigger>
                        <SelectContent>
                          {categories.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
               </div>
               <Button type="submit" disabled={loading || imageUploading} className="w-full h-16 text-xl bg-indigo-600 hover:bg-indigo-700 rounded-xl">
                 {loading ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2" />}
                 नया उत्पाद पब्लिश करें
               </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SellerAddProductPage;