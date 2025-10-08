
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import api from "@/lib/api";

// ✅ कैटेगरी इंटरफेस
interface Category {
  id: number;
  name: string;
  nameHindi?: string;
  slug: string;
  image: string;
  isActive: boolean;
  sortOrder: number;
}

const CategoriesManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("list");
  const [formState, setFormState] = useState({
    name: '',
    nameHindi: '',
    slug: '',
    description: '',
    image: null as File | null,
    isActive: true,
    sortOrder: 0,
  });

  const generateSlug = (text: string) => {
    return text.toString().normalize('NFD').replace(/[\u0900-\u097F]/g, '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'file') {
      const file = (e.target as HTMLInputElement).files?.[0] || null;
      setFormState({ ...formState, [name]: file });
    } else {
      setFormState({ ...formState, [name]: value });
      if (name === 'name') {
        setFormState(prevState => ({ ...prevState, slug: generateSlug(value) }));
      }
    }
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormState(prevState => ({ ...prevState, isActive: checked }));
  };

  // ✅ डेटा फेचिंग (api का इस्तेमाल करके)
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<Category[]>({
    queryKey: ["adminCategories"],
    queryFn: async () => {
      const res = await api.get("/api/categories");
      return res.data && Array.isArray(res.data) ? res.data : [];
    },
  });

  // ✅ म्यूटेशन (api का इस्तेमाल करके)
  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('name', formState.name);
      formData.append('nameHindi', formState.nameHindi);
      formData.append('slug', formState.slug);
      formData.append('description', formState.description);
      formData.append('isActive', String(formState.isActive));
      formData.append('sortOrder', String(formState.sortOrder));
      if (formState.image) {
        formData.append('image', formState.image);
      }
      return await api.post('/api/categories', formData);
    },
    onSuccess: () => {
      toast({ title: '✅ कैटेगरी बन गई!', description: `नई कैटेगरी "${formState.name}" जोड़ दी गई है।` });
      setFormState({ name: '', nameHindi: '', slug: '', description: '', image: null, isActive: true, sortOrder: 0 });
      queryClient.invalidateQueries({ queryKey: ['adminCategories'] });
      setActiveTab('list');
    },
    onError: (error: any) => {
      console.error('❌ कैटेगरी बनाने में त्रुटि:', error);
      toast({ title: '❌ कैटेगरी बनाने में विफल', description: error.message || 'एक अप्रत्याशित त्रुटि हुई।', variant: 'destructive' });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: number) => api.delete(`/api/categories/${categoryId}`),
    onSuccess: () => {
      toast({ title: "कैटेगरी हटा दी गई!" });
      queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
    },
    onError: (error: any) => {
      console.error("कैटेगरी हटाने में त्रुटि:", error);
      toast({ title: "कैटेगरी हटाने में विफल", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCategoryMutation.mutate();
  };

  const renderContent = () => {
    if (activeTab === "create") {
      return (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">नई कैटेगरी बनाएँ</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">नाम (अंग्रेजी)</Label>
                <Input id="name" name="name" type="text" value={formState.name} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameHindi">नाम (हिंदी)</Label>
                <Input id="nameHindi" name="nameHindi" type="text" value={formState.nameHindi} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">स्लग</Label>
                <Input id="slug" name="slug" type="text" value={formState.slug} onChange={handleInputChange} required readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">सॉर्ट ऑर्डर</Label>
                <Input id="sortOrder" name="sortOrder" type="number" value={formState.sortOrder} onChange={handleInputChange} />
              </div>
              <div className="space-y-2 col-span-1 md:col-span-2">
                <Label htmlFor="image">छवि</Label>
                <Input id="image" name="image" type="file" accept="image/*" onChange={handleInputChange} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="isActive" className="flex items-center gap-2">
                <span>सक्रिय है</span>
                <Switch id="isActive" checked={formState.isActive} onCheckedChange={handleSwitchChange} />
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">विवरण</Label>
              <Textarea id="description" name="description" value={formState.description} onChange={handleInputChange} />
            </div>
            <Button type="submit" className="w-full flex items-center gap-2" disabled={createCategoryMutation.isPending}>
              {createCategoryMutation.isPending ? (<><Loader2 className="h-4 w-4 animate-spin" /><span>बना रहा है...</span></>) : (<><Plus size={16} /><span>कैटेगरी बनाएँ</span></>)}
            </Button>
          </form>
        </div>
      );
    } else {
      return (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">मौजूदा कैटेगरी</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-4 py-2 text-left text-sm font-medium text-gray-700">नाम (EN)</th>
                  <th className="border px-4 py-2 text-left text-sm font-medium text-gray-700">नाम (HI)</th>
                  <th className="border px-4 py-2 text-left text-sm font-medium text-gray-700">स्लग</th>
                  <th className="border px-4 py-2 text-left text-sm font-medium text-gray-700">छवि</th>
                  <th className="border px-4 py-2 text-left text-sm font-medium text-gray-700">स्थिति</th>
                  <th className="border px-4 py-2 text-left text-sm font-medium text-gray-700">एक्शन</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingCategories ? (
                  <tr><td colSpan={6} className="border px-4 py-4 text-center text-gray-500"><Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> लोडिंग...</td></tr>
                ) : categories.length > 0 ? (
                  categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-gray-50">
                      <td className="border px-4 py-2">{cat.name}</td>
                      <td className="border px-4 py-2">{cat.nameHindi || '-'}</td>
                      <td className="border px-4 py-2">{cat.slug}</td>
                      <td className="border px-4 py-2">
                        <img src={cat.image} alt={cat.name} className="h-10 w-10 object-cover rounded" />
                      </td>
                      <td className="border px-4 py-2">
                        <span className={`font-semibold ${cat.isActive ? 'text-green-600' : 'text-red-600'}`}>
                          {cat.isActive ? 'एक्टिव' : 'इनएक्टिव'}
                        </span>
                      </td>
                      <td className="border px-4 py-2 space-x-2">
                        <Button className="px-3 py-1 rounded-full text-sm" variant="outline"><Edit size={16} /></Button>
                        <Button onClick={() => deleteCategoryMutation.mutate(cat.id)} className="px-3 py-1 rounded-full text-sm" variant="destructive" disabled={deleteCategoryMutation.isPending}><Trash2 size={16} /></Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="border px-4 py-4 text-center text-gray-500">कोई कैटेगरी नहीं मिली।</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen font-inter">
      <div className="flex space-x-4 mb-4">
        <Button onClick={() => setActiveTab("list")} className={`px-4 py-2 rounded ${activeTab === "list" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>
          कैटेगरीज़ देखें
        </Button>
        <Button onClick={() => setActiveTab("create")} className={`px-4 py-2 rounded ${activeTab === "create" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>
          नई कैटेगरी बनाएँ
        </Button>
      </div>
      {renderContent()}
    </div>
  );
};

export default CategoriesManagement;

