import { useState, useEffect } from "react"; 
import { useQuery } from "@tanstack/react-query"; 
import { useLocation as useRouterLocation, Link } from "react-router-dom"; 
import { useLocation } from '../context/LocationContext'; 
import { Filter, ArrowRight, ShieldIcon, Loader2 } from "lucide-react"; 
import { Button } from "@/components/ui/button"; 
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/product-card"; 
import type { Product } from "@/components/product-card"; // Component se hi type liya hai
import Footer from "@/components/footer"; 
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth'; 
import LocationDisplay from '@/components/LocationDisplay'; 

// --- Helper function ---
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (axios.isAxiosError(error)) return error.response?.data?.message || error.message;
  return "An unexpected error occurred.";
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
}

// Layout Interface for Banners
interface LayoutSection {
  id: number;
  displayName: string;
  sectionType: string;
  config: {
    items: {
      title?: string;
      image?: string;
      deeplink?: string;
    }[];
  };
}

export default function Home() {
  const { user } = useAuth();
  const routerLocation = useRouterLocation();
  const urlParams = new URLSearchParams(routerLocation.search);
  const categoryParam = urlParams.get('category');
  const searchParam = urlParams.get('search');

  const { 
    currentLocation, 
    loadingLocation, 
    error: locationError
  } = useLocation();

  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    categoryParam ? parseInt(categoryParam) : null
  );
  const [searchQuery, setSearchQuery] = useState(searchParam || "");
  const [priceFilter, setPriceFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("best-match");

  useEffect(() => {
    const currentUrlParams = new URLSearchParams(routerLocation.search);
    const newCategoryParam = currentUrlParams.get('category');
    const newSearchParam = currentUrlParams.get('search');
    setSelectedCategory(newCategoryParam ? parseInt(newCategoryParam) : null);
    setSearchQuery(newSearchParam || "");
  }, [routerLocation.search]);

  // --- 1. Categories fetching ---
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery<Category[]>({
    queryKey: ['categories'], 
    queryFn: async () => {
      const response = await axios.get('/api/categories');
      return response.data;
    },
  });

  const isLocationReady = !loadingLocation && !!currentLocation?.pincode;

  // --- 2. Home Layout (Banners) - Pincode filtered ---
  const { data: layoutSections = [], isLoading: layoutLoading } = useQuery<LayoutSection[]>({
    queryKey: ['layout', currentLocation?.pincode],
    queryFn: async () => {
      const response = await axios.get(`/api/layout/public?pincode=${currentLocation?.pincode || ""}`);
      return response.data;
    },
    enabled: isLocationReady,
  });

  // --- 3. Products Query -
  // --- 3. Products Query ---
  const { data: productsData, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ['products', selectedCategory, searchQuery, currentLocation?.pincode, sortBy],
    queryFn: async () => {
      // Sabhi values ko pehle hi string mein convert kar lete hain
      const pin = String(currentLocation?.pincode || "");
      const latitude = String(currentLocation?.lat || "");
      const longitude = String(currentLocation?.lng || "");

      const params = new URLSearchParams({
        pincode: pin,
        lat: latitude,
        lng: longitude,
      });

      if (selectedCategory) {
        params.append('categoryId', String(selectedCategory)); 
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      if (sortBy) {
        params.append('sortBy', sortBy);
      }

      const response = await axios.get(`/api/products?${params.toString()}`);
      return Array.isArray(response.data) ? { products: response.data } : response.data;
    },
    enabled: isLocationReady,
  });

  // --- 4. Featured Products Query ---
  const { data: featuredProductsData, isLoading: featuredProductsLoading, error: featuredProductsError } = useQuery({
    queryKey: ['featuredProducts', currentLocation?.pincode],
    queryFn: async () => {
      const params = new URLSearchParams({
        pincode: currentLocation?.pincode?.toString() || "",
        featured: 'true',
      });
      const response = await axios.get(`/api/products?${params.toString()}`);
      return Array.isArray(response.data) ? { products: response.data } : response.data;
    },
    enabled: isLocationReady,
  });

  const products = productsData?.products || [];
  const featuredProducts = featuredProductsData?.products || [];

  if (loadingLocation || categoriesLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary h-10 w-10" />
      </div>
    );
  }

  if (!isLocationReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-700 bg-neutral-50 p-4 text-center">
        <div className="bg-white p-10 rounded-2xl shadow-lg max-w-md border border-gray-100">
          <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Filter className="text-orange-600 h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-neutral-900">डिलीवरी लोकेशन सेट करें</h2>
          <p className="text-gray-500 mb-8">आस-पास के स्टोर और प्रोडक्ट्स देखने के लिए पिनकोड वाला पता चुनें।</p>
          <LocationDisplay /> 
        </div>
      </div>
    );
  }
// --- Error Handling Block ---
  if (productsError || featuredProductsError || locationError || categoriesError) {
    const errMsg = getErrorMessage(productsError || featuredProductsError || locationError || categoriesError);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-600 p-6">
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-red-100 max-w-lg">
          <p className="text-lg font-medium mb-4">कंटेंट लोड करने में त्रुटि हुई</p>
          <p className="text-sm text-gray-500 mb-6">{errMsg}</p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => window.location.reload()}>पुनः प्रयास करें</Button>
            <LocationDisplay />
          </div>
        </div>
      </div>
    );
  }
  const currentProductPool = searchQuery || selectedCategory ? products : featuredProducts;

  const filteredProducts = currentProductPool.filter((product: Product) => {
    if (priceFilter.length === 0) return true;
    const price = Number(product.price);
    return priceFilter.some(range => {
      switch (range) {
        case "under-250": return price < 250;
        case "250-500": return price >= 250 && price < 500;
        case "500-1000": return price >= 500 && price < 1000;
        case "1000-5000": return price >= 1000 && price < 5000;
        case "over-5000": return price >= 5000;
        default: return true;
      }
    });
  });

  const handlePriceFilterChange = (range: string, checked: boolean) => {
    if (checked) setPriceFilter(prev => [...prev, range]);
    else setPriceFilter(prev => prev.filter(r => r !== range));
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {user?.isAdmin && (
        <div className="absolute top-4 right-4 z-50">
          <Button asChild><Link to="/admin-login"><ShieldIcon className="mr-2 h-4 w-4" /> एडimin लॉगिन</Link></Button>
        </div>
      )}
      
      {/* 🚀 Dynamic Hero/Banner Section */}
      {!selectedCategory && !searchQuery && (
        <section className="bg-white pb-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            {layoutLoading ? (
              <Skeleton className="h-[300px] md:h-[450px] w-full rounded-2xl" />
            ) : layoutSections.length > 0 ? (
              layoutSections
                .filter(s => s.sectionType === 'main_banner' || s.sectionType === 'HERO_BANNER')
                .map((banner) => (
                  <div key={banner.id} className="relative rounded-2xl overflow-hidden shadow-xl group">
                    <img 
                      src={banner.config.items[0]?.image || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d"} 
                      className="w-full h-[300px] md:h-[450px] object-cover transition-transform duration-700 group-hover:scale-105"
                      alt={banner.displayName}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-8 md:p-16">
                      <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
                        {banner.config.items[0]?.title || banner.displayName}
                      </h2>
                      <Button asChild className="w-fit bg-primary hover:bg-primary/90 text-white font-bold">
                        <Link to={banner.config.items[0]?.deeplink || "#"}>Shop Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
                      </Button>
                    </div>
                  </div>
                ))
            ) : (
              // Fallback Banner if no banners found
              <div className="bg-orange-500 rounded-2xl h-[300px] flex items-center justify-center text-white">
                <h2 className="text-2xl font-bold">Welcome to Shopnish</h2>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Categories Grid */}
      {!selectedCategory && !searchQuery && (
        <section className="py-12 bg-white border-y border-neutral-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-2xl font-bold text-neutral-900 mb-8">Shop by Category</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {categories.map((category) => (
                <div key={category.id} className="text-center cursor-pointer group" onClick={() => setSelectedCategory(category.id)}>
                  <div className="w-20 h-20 mx-auto rounded-full bg-neutral-100 overflow-hidden mb-3 border-2 border-transparent group-hover:border-primary transition-all">
                    <img src={category.image || ''} alt={category.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-sm font-medium text-neutral-700 group-hover:text-primary">{category.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <main id="products-section" className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filter Sidebar */}
            <aside className="lg:w-64 space-y-6">
              <Card><CardContent className="p-6">
                <h4 className="font-bold mb-4 flex items-center"><Filter className="mr-2 h-4 w-4" /> Filters</h4>
                <div className="space-y-4">
                  <div>
                    <h5 className="text-sm font-semibold mb-2">Price Range</h5>
                    {['under-250', '250-500', '500-1000', '1000-5000', 'over-5000'].map(id => (
                      <div key={id} className="flex items-center space-x-2 mb-1">
                        <Checkbox id={id} checked={priceFilter.includes(id)} onCheckedChange={(c) => handlePriceFilterChange(id, c as boolean)} />
                        <label htmlFor={id} className="text-xs">{id.replace('-', ' ')}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent></Card>
            </aside>

            {/* Products Grid */}
            <div className="flex-1">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">
                  {searchQuery ? `Results for "${searchQuery}"` : selectedCategory ? 'Category Items' : 'Recommended For You'}
                </h3>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Sort" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="best-match">Best Match</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

             {(productsLoading || featuredProductsLoading) ? ( 
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredProducts.map((product: Product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}