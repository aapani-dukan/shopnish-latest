import { useState, useEffect } from "react"; 
import { useQuery } from "@tanstack/react-query"; 
import { useLocation as useRouterLocation, Link } from "react-router-dom"; 
import { useLocation } from '../context/LocationContext'; 
import { Filter, ArrowRight, ShieldIcon } from "lucide-react"; 
import { Button } from "@/components/ui/button"; 
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/product-card"; 
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

// --- Interfaces ---
interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
}

interface Seller {
  id: number;
  userId: string;
  businessName: string;
  approvalStatus: "pending" | "approved" | "rejected";
}

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: string;
  originalPrice: string | null;
  image: string;
  brand: string | null;
  busnessName: string;
  rating: string | null;
  rejectionReason?: string;
  reviewCount: number | null;
  deliveryPincodes?: string[];
  stock: number;      
  sellerId: number;   
  seller: Seller;   
  unit?: string;
  storwIs: number;
  categoryName: string | null;
}

// --- Fetch categories ---
async function fetchCategories(): Promise<Category[]> {
  const response = await axios.get('/api/categories');
  return response.data;
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

  // Update filters when URL changes
  useEffect(() => {
    const currentUrlParams = new URLSearchParams(routerLocation.search);
    const newCategoryParam = currentUrlParams.get('category');
    const newSearchParam = currentUrlParams.get('search');
    
    setSelectedCategory(newCategoryParam ? parseInt(newCategoryParam) : null);
    setSearchQuery(newSearchParam || "");
  }, [routerLocation.search]);

  // 1. Categories data fetching
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery<Category[]>({
    queryKey: ['categories'], 
    queryFn: fetchCategories,
  });

  // 2. Location Ready Check
  const isLocationReady =
    !loadingLocation &&
    !!currentLocation?.lat &&
    !!currentLocation?.lng &&
    !!currentLocation?.pincode;

  // 3. Main Products fetching
  const { 
    data: productsData, 
    isLoading: productsLoading, 
    error: productsError 
  } = useQuery({
    queryKey: ['products', selectedCategory, searchQuery, currentLocation?.pincode, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        pincode: currentLocation?.pincode?.toString() || "",
        lat: currentLocation?.lat?.toString() || "",
        lng: currentLocation?.lng?.toString() || "",
      });

      if (selectedCategory) params.append('categoryId', selectedCategory.toString());
      if (searchQuery) params.append('search', searchQuery);
      if (sortBy) params.append('sortBy', sortBy);

      const response = await axios.get(`/api/products?${params.toString()}`);
      const data = response.data;
      return Array.isArray(data) ? { products: data } : data;
    },
    enabled: isLocationReady,
  });

  // 4. Featured products fetching
  const { 
    data: featuredProductsData, 
    isLoading: featuredProductsLoading, 
    error: featuredProductsError 
  } = useQuery({
    queryKey: ['featuredProducts', currentLocation?.pincode],
    queryFn: async () => {
      const params = new URLSearchParams({
        pincode: currentLocation?.pincode?.toString() || "",
        lat: currentLocation?.lat?.toString() || "",
        lng: currentLocation?.lng?.toString() || "",
        featured: 'true',
      });

      const response = await axios.get(`/api/products?${params.toString()}`);
      const data = response.data;
      return Array.isArray(data) ? { products: data } : data;
    },
    enabled: isLocationReady,
  });

  // Safely extract products arrays
  const products = productsData?.products || [];
  const featuredProducts = featuredProductsData?.products || [];

  // --- UI Rendering Logic (Important Order) ---

  // A. Loading State
  if (loadingLocation || categoriesLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-12 w-3/4 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // B. Location Not Set State
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

  // C. Error State
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

  // --- Logic for Displaying Products ---
  const displayProducts = searchQuery || selectedCategory ? products : featuredProducts;

  const filteredProducts = displayProducts.filter(product => {
    if (priceFilter.length === 0) return true;
    const price = parseFloat(product.price);
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

  const scrollToProducts = () => {
    document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const renderAdminButton = () => {
    if (user?.isAdmin) {
      return (
        <div className="absolute top-4 right-4">
          <Button asChild>
            <Link to="/admin-login">
              <ShieldIcon className="mr-2 h-4 w-4" />
              एडमिन लॉगिन
            </Link>
          </Button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {renderAdminButton()}
      {!selectedCategory && !searchQuery && (
        <section className="bg-gradient-to-r from-primary to-orange-500 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl lg:text-6xl font-bold mb-6">Shop everything you need</h2>
                <p className="text-xl mb-8 text-orange-100">Millions of products from trusted sellers with fast delivery.</p>
                <Button onClick={scrollToProducts} size="lg" className="bg-white text-primary hover:bg-gray-100 font-semibold">
                  Start shopping <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
              <div className="relative">
                <img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d" alt="shopping" className="rounded-xl shadow-2xl w-full" />
              </div>
            </div>
          </div>
        </section>
      )}

      {!selectedCategory && !searchQuery && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <h3 className="text-3xl font-bold text-center mb-12">Shop by category</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {categories.slice(0, 4).map((cat) => (
                <div key={cat.id} className="text-center group cursor-pointer" onClick={() => setSelectedCategory(cat.id)}>
                  <img src={cat.image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8'} alt={cat.name} className="w-full h-48 object-cover rounded-lg group-hover:shadow-lg transition-shadow" />
                  <h4 className="text-lg font-semibold mt-4">{cat.name}</h4>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <main id="products-section" className="py-16">
        <div className="max-w-7xl mx-auto px-4 flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-64 flex-shrink-0">
            <Card className="sticky top-24 p-6">
              <h4 className="text-lg font-semibold mb-4 flex items-center"><Filter className="mr-2 h-5 w-5" /> Filters</h4>
              <div className="mb-6">
                <h5 className="font-medium mb-3">Price Range</h5>
                {['under-250', '250-500', '500-1000', '1000-5000', 'over-5000'].map(r => (
                  <div key={r} className="flex items-center space-x-2 mb-2">
                    <Checkbox id={r} checked={priceFilter.includes(r)} onCheckedChange={(c) => handlePriceFilterChange(r, c as boolean)} />
                    <label htmlFor={r} className="text-sm cursor-pointer capitalize">{r.replace('-', ' ')}</label>
                  </div>
                ))}
              </div>
            </Card>
          </aside>

          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">
                {searchQuery ? `Results for "${searchQuery}"` : selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 'Featured Products'}
              </h3>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="best-match">Best Match</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(productsLoading || featuredProductsLoading) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-80 w-full" />)}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No products found.</p>
                <Button onClick={() => { setSelectedCategory(null); setSearchQuery(""); setPriceFilter([]); }} className="mt-4" variant="outline">Clear Filters</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
      }
