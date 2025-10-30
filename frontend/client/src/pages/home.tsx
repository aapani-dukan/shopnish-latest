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
    error: locationError,
    fetchCurrentGeolocation
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

  // --- Categories data fetching ---
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useQuery<Category[]>({
    queryKey: ['categories'], 
    queryFn: fetchCategories,
  });

  // --- Products fetching using Axios ---
  // ✅ Updated Products & Featured Products fetching with better location handling

const isLocationReady =
  !!currentLocation?.pincode &&
  !!currentLocation?.lat &&
  !!currentLocation?.lng &&
  !loadingLocation;

const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery<Product[]>({
  queryKey: ['products', selectedCategory, searchQuery, currentLocation, sortBy],
  queryFn: async () => {
    if (!currentLocation?.pincode || !currentLocation?.lat || !currentLocation?.lng) {
      throw new Error("Customer location (pincode, lat, lng) is required for filtering.");
    }

    const params = new URLSearchParams({
      pincode: currentLocation.pincode.toString(),
      lat: currentLocation.lat.toString(),
      lng: currentLocation.lng.toString(),
    });

    if (selectedCategory) params.append('categoryId', selectedCategory.toString());
    if (searchQuery) params.append('search', searchQuery);
    if (sortBy) params.append('sortBy', sortBy);

    const response = await axios.get(`/api/products?${params.toString()}`);
    return response.data;
  },
  enabled: isLocationReady,
  retry: (failureCount, error: any) => {
    // retry only if location was not ready
    if (error?.message?.includes('location')) return failureCount < 3;
    return false;
  },
  retryDelay: 1000,
});

// ✅ Featured products fetching (similar handling)
// ✅ Featured products fetching (similar handling)
const { data: featuredProducts = [], isLoading: featuredProductsLoading, error: featuredProductsError } =
  useQuery<Product[]>({
    queryKey: ['featuredProducts', currentLocation],
    queryFn: async () => {
      // ✨ fallback default location अगर user location नहीं मिली
      const safeLocation = currentLocation || { pincode: '323001', lat: 25.4454386, lng: 75.6655767 };

      if (!safeLocation.pincode || !safeLocation.lat || !safeLocation.lng) {
        throw new Error("Customer location (pincode, lat, lng) is required for filtering.");
      }

      const params = new URLSearchParams({
        pincode: safeLocation.pincode.toString(),
        lat: safeLocation.lat.toString(),
        lng: safeLocation.lng.toString(),
        featured: 'true',
      });

      const response = await axios.get(`/api/products?${params.toString()}`);
      return response.data;
    },
    enabled: isLocationReady,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('location')) return failureCount < 3;
      return false;
    },
    retryDelay: 1000,
  });

// ✅ Loading State
if (loadingLocation || categoriesLoading || productsLoading || featuredProductsLoading) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Skeleton className="h-16 w-full mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ✅ Error Handling
if (locationError || categoriesError || productsError || featuredProductsError) {
  return (
    <div className="min-h-screen flex items-center justify-center text-red-600">
      <p>
        Error loading content:{' '}
        {getErrorMessage(locationError) ||
          getErrorMessage(categoriesError) ||
          getErrorMessage(productsError) ||
          getErrorMessage(featuredProductsError) ||
          'Unknown error'}
      </p>
    </div>
  );
}

// ✅ No Location Set
if (!isLocationReady && !loadingLocation) {
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-700">
      <p className="text-lg">Please select your delivery location to see products.</p>
    </div>
  );
}

  // --- Price Filter ---
  const filteredProducts = products.filter(product => {
    if (priceFilter.length === 0) return true;
    const price = parseFloat(product.price);
    return priceFilter.some(range => {
      switch (range) {
        case 'under-250': return price < 250;
        case '250-500': return price >= 250 && price < 500;
        case '500-1000': return price >= 500 && price < 1000;
        case '1000-5000': return price >= 1000 && price < 5000;
        case 'over-5000': return price >= 5000;
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

  // --- UI ---
  return (
    <div className="min-h-screen bg-neutral-50">
      {renderAdminButton()}
      {!selectedCategory && !searchQuery && (
        <section className="bg-gradient-to-r from-primary to-orange-500 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl lg:text-6xl font-bold mb-6">
                  Shop everything you need
                </h2>
                <p className="text-xl mb-8 text-orange-100">
                  Discover millions of products from trusted sellers with fast delivery and great prices.
                </p>
                <Button onClick={scrollToProducts} size="lg" className="bg-white text-primary hover:bg-gray-100 font-semibold">
                  Start shopping <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d"
                  alt="online shopping experience"
                  className="rounded-xl shadow-2xl w-full h-auto"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {!selectedCategory && !searchQuery && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-3xl font-bold text-neutral-900 mb-12 text-center">
              Shop by category
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {categories.slice(0, 4).map((category) => (
                <div 
                  key={category.id} 
                  className="text-center group cursor-pointer"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <img
                    src={category.image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8'}
                    alt={category.name}
                    className="w-full h-48 object-cover rounded-lg group-hover:shadow-lg transition-shadow"
                  />
                  <h4 className="text-lg font-semibold mt-4">
                    {category.name}
                  </h4>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <main id="products-section" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filters Sidebar */}
            <aside className="lg:w-64 flex-shrink-0">
              <Card className="sticky top-24">
                <CardContent className="p-6">
                  <h4 className="text-lg font-semibold mb-4 flex items-center">
                    <Filter className="mr-2 h-5 w-5" />
                    Filters
                  </h4>
                  
                  {/* Price Range */}
                  <div className="mb-6">
                    <h5 className="font-medium mb-3">Price Range</h5>
                    <div className="space-y-2">
                      {[
                        { id: 'under-250', label: 'Under ₹250' },
                        { id: '250-500', label: '₹250 - ₹500' },
                        { id: '500-1000', label: '₹500 - ₹1000' },
                        { id: '1000-5000', label: '₹1000 - ₹5000' },
                        { id: 'over-5000', label: 'Over ₹5000' },
                      ].map((range) => (
                        <div key={range.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={range.id}
                            checked={priceFilter.includes(range.id)}
                            onCheckedChange={(checked) => handlePriceFilterChange(range.id, checked as boolean)}
                          />
                          <label htmlFor={range.id} className="text-sm cursor-pointer">
                            {range.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="mb-6">
                    <h5 className="font-medium mb-3">Categories</h5>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="all-categories"
                          checked={!selectedCategory}
                          onCheckedChange={() => setSelectedCategory(null)}
                        />
                        <label htmlFor="all-categories" className="text-sm cursor-pointer">
                          All Categories
                        </label>
                      </div>
                      {categories.map((category) => (
                        <div key={category.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`category-${category.id}`}
                            checked={selectedCategory === category.id}
                            onCheckedChange={() =>
                              setSelectedCategory(selectedCategory === category.id ? null : category.id)
                            }
                          />
                          <label htmlFor={`category-${category.id}`} className="text-sm cursor-pointer">
                            {category.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </aside>

            {/* Product Grid */}
            <div className="flex-1">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-neutral-900">
                  {searchQuery ? `Search results for "${searchQuery}"` : 
                   selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 
                   'Featured Products'}
                </h3>
                <div className="flex items-center space-x-4">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="best-match">Best Match</SelectItem>
                      <SelectItem value="price-low">Price: Low to High</SelectItem>
                      <SelectItem value="price-high">Price: High to Low</SelectItem>
                      <SelectItem value="rating">Customer Rating</SelectItem>
                      <SelectItem value="newest">Newest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {productsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-80 w-full" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No products found matching your criteria.</p>
                  <Button
                    onClick={() => {
                      setSelectedCategory(null);
                      setSearchQuery("");
                      setPriceFilter([]);
                    }}
                    className="mt-4"
                    variant="outline"
                  >
                    Clear Filters
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map((product) => (
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
