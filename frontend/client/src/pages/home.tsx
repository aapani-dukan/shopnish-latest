// client/src/pages/home.tsx

import React, { useState, useEffect } from "react"; // ✅ usestate, useeffect को React से इम्पोर्ट करें
import { useQuery } from "@tanstack/react-query"; // ✅ usequery को @tanstack/react-query से इम्पोर्ट करें
import { useLocation as useRouterLocation, Link } from "react-router-dom"; // ✅ react-router-dom के useLocation को useRouterLocation नाम दें
import { useLocation } from '../context/LocationContext'; // ✅ अपने LocationContext से useLocation इम्पोर्ट करें
import { Filter, ArrowRight, ShieldIcon } from "lucide-react"; // ✅ icons के नाम सही करें
import { Button } from "/components/ui/button"; // ✅ Button को Button के रूप में इम्पोर्ट करें
import { Card, CardContent } from "/components/ui/card";
import { Checkbox } from "/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "/components/ui/select";
import { Skeleton } from "/components/ui/skeleton";
import ProductCard from "/components/product-card"; // ✅ ProductCard का नामकरण सही करें
import Footer from "/components/footer"; // ✅ Footer का नामकरण सही करें
import axios from 'axios';
import { useAuth } from '/hooks/useauth'; // ✅ useAuth का नामकरण सही करें
import LocationDisplay from '../components/locationdisplay'; // ✅ LocationDisplay का नामकरण सही करें

// Add URLSearchParams import for older environments if needed
// import { URLSearchParams } from 'url'; 

// --- Interfaces ---
interface Category { // ✅ interfaces का नामकरण सही करें
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
}

interface Product { // ✅ interfaces का नामकरण सही करें
  id: number;
  name: string;
  description: string | null;
  price: string;
  originalPrice: string | null; // ✅ originalPrice का नामकरण सही करें
  image: string;
  brand: string | null;
  rating: string | null;
  reviewCount: number | null; // ✅ reviewCount का नामकरण सही करें
}

// Function to fetch categories
const fetchCategories = async (): Promise<Category[]> => { // ✅ function का नामकरण सही करें
  const response = await axios.get('/api/categories');
  return response.data;
};

export default function Home() { // ✅ function का नामकरण सही करें
  const { user } = useAuth(); // ✅ useAuth का नामकरण सही करें
  const routerLocation = useRouterLocation(); // ✅ useRouterLocation का उपयोग करें
  const urlParams = new URLSearchParams(routerLocation.search); // ✅ URLSearchParams का नामकरण सही करें
  const categoryParam = urlParams.get('category'); // ✅ categoryParam का नामकरण सही करें
  const searchParam = urlParams.get('search'); // ✅ searchParam का नामकरण सही करें

  // ✅ LocationContext से useLocation हुक का उपयोग करें
  const { 
    currentLocation, 
    loadingLocation, 
    error: locationError,
    fetchCurrentGeolocation // यदि आप चाहें तो इसे मैन्युअल रूप से ट्रिगर कर सकते हैं
  } = useLocation();

  const [selectedCategory, setSelectedCategory] = useState<number | null>( // ✅ useState का नामकरण सही करें
    categoryParam ? parseInt(categoryParam) : null
  );
  const [searchQuery, setSearchQuery] = useState(searchParam || ""); // ✅ useState का नामकरण सही करें
  const [priceFilter, setPriceFilter] = useState<string[]>([]); // ✅ useState का नामकरण सही करें
  const [sortBy, setSortBy] = useState("best-match"); // ✅ useState का नामकरण सही करें

  // Update filters when URL changes
  useEffect(() => { // ✅ useEffect का नामकरण सही करें
    const currentUrlParams = new URLSearchParams(routerLocation.search);
    const newCategoryParam = currentUrlParams.get('category');
    const newSearchParam = currentUrlParams.get('search');
    
    setSelectedCategory(newCategoryParam ? parseInt(newCategoryParam) : null);
    setSearchQuery(newSearchParam || "");
  }, [routerLocation.search]);

  // Categories data fetching
  const { 
    data: categories = [], 
    isLoading: categoriesLoading, // ✅ isLoading का नामकरण सही करें
    error: categoriesError // ✅ error का नामकरण सही करें
  } = useQuery<Category[]>({ // ✅ useQuery का नामकरण सही करें
    queryKey: ['categories'], 
    queryFn: fetchCategories, // ✅ fetchCategories का नामकरण सही करें
  });

  // Product data fetching
  const { 
    data: products = [], 
    isLoading: productsLoading, // ✅ isLoading का नामकरण सही करें
    error: productsError // ✅ error का नामकरण सही करें
  } = useQuery<Product[]>({ // ✅ useQuery का नामकरण सही करें
    // ✅ QueryKey में currentLocation को ट्रैक करें
    queryKey: ['products', selectedCategory, searchQuery, currentLocation], 
    queryFn: async () => {
      const params = new URLSearchParams();
      
      // 1. यदि स्थान डेटा मौजूद नहीं है, तो एक स्पष्ट एरर थ्रो करें (जैसा कि बैकएंड अपेक्षित करता है)
      if (!currentLocation || !currentLocation.pincode || !currentLocation.lat || !currentLocation.lng) {
          throw new Error("Customer location (pincode, lat, lng) is required for filtering.");
      }

      // 2. आवश्यक स्थान पैरामीटर्स जोड़ें
      params.append('pincode', currentLocation.pincode.toString());
      params.append('lat', currentLocation.lat.toString());
      params.append('lng', currentLocation.lng.toString());
      
      // 3. मौजूदा फ़िल्टर जोड़ें
      if (selectedCategory) params.append('categoryId', selectedCategory.toString());
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/products?${params}`);
      
      if (!response.ok) {
        // ✅ बैकएंड से एरर मैसेज पढ़ें (जैसा कि 400 प्रतिक्रिया में आ रहा है)
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch products');
      }
      return response.json();
    },
    // ✅ केवल तभी फ़ेच करें जब location data उपलब्ध हो और लोड हो गया हो
    enabled: !!currentLocation?.pincode && !loadingLocation, 
  });

  // Featured products data fetching
  const { 
    data: featuredProducts = [], // ✅ featuredProducts का नामकरण सही करें
    isLoading: featuredProductsLoading, // ✅ isLoading का नामकरण सही करें
    error: featuredProductsError // ✅ error का नामकरण सही करें
  } = useQuery<Product[]>({ // ✅ useQuery का नामकरण सही करें
    queryKey: ['featuredProducts'], 
    queryFn: async () => {
      const response = await fetch('/api/products?featured=true');
      if (!response.ok) throw new Error('Failed to fetch featured products');
      return response.json();
    },
  });

  // Handle loading and error states at the top level for a better UX
  // ✅ LocationContext से लोडिंग स्टेट्स को भी शामिल करें
  if (loadingLocation || categoriesLoading || productsLoading || featuredProductsLoading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="h-16 w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => ( // ✅ Array का नामकरण सही करें
              <Skeleton key={i} className="h-80 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Consolidated error checks here
  // ✅ LocationContext से एरर को भी शामिल करें
  if (locationError || categoriesError || productsError || featuredProductsError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        <p>Error loading content: {
          (locationError?.message || categoriesError?.message || productsError?.message || featuredProductsError?.message || "Unknown error")
        }</p>
      </div>
    );
  }

  // यदि currentLocation उपलब्ध नहीं है (और कोई लोडिंग/एरर नहीं है), तो यूजर को प्रॉम्प्ट करें
  if (!currentLocation?.pincode) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-700">
        <p className="text-lg">Please select your delivery location to see products.</p>
        {/* यहाँ आप एक बटन जोड़ सकते हैं जो लोकेशन चयनकर्ता कंपोनेंट को खोलता है */}
      </div>
    );
  }


  const filteredProducts = products.filter(product => { // ✅ filteredProducts का नामकरण सही करें
    if (priceFilter.length === 0) return true; // ✅ priceFilter का नामकरण सही करें
    
    const price = parseFloat(product.price); // ✅ parseFloat का नामकरण सही करें
    return priceFilter.some(range => { // ✅ priceFilter का नामकरण सही करें
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

  const handlePriceFilterChange = (range: string, checked: boolean) => { // ✅ handlePriceFilterChange का नामकरण सही करें
    if (checked) {
      setPriceFilter(prev => [...prev, range]); // ✅ setPriceFilter का नामकरण सही करें
    } else {
      setPriceFilter(prev => prev.filter(r => r !== range)); // ✅ setPriceFilter का नामकरण सही करें
    }
  };

  const scrollToProducts = () => { // ✅ scrollToProducts का नामकरण सही करें
    document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' }); // ✅ getElementById का नामकरण सही करें
  };
  
  // ✅ Updated admin login button logic
  const renderAdminButton = () => { // ✅ renderAdminButton का नामकरण सही करें
    if (user?.isAdmin) { // ✅ isAdmin का नामकरण सही करें
      return (
        <div className="absolute top-4 right-4">
          <Button asChild> {/* ✅ Button का नामकरण सही करें */}
            <Link to="/admin-login">
              <ShieldIcon className="mr-2 h-4 w-4" /> {/* ✅ ShieldIcon का नामकरण सही करें */}
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

      {/* Hero section - only show on home page without filters */}
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
                <Button // ✅ Button का नामकरण सही करें
                  onClick={scrollToProducts}
                  size="lg"
                  className="bg-white text-primary hover:bg-gray-100 font-semibold"
                >
                  Start shopping <ArrowRight className="ml-2 h-5 w-5" /> {/* ✅ ArrowRight का नामकरण सही करें */}
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
     
      {/* Featured categories - only show on home page */}
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

      {/* Product catalog */}
      <main id="products-section" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filters sidebar */}
            <aside className="lg:w-64 flex-shrink-0">
              <Card className="sticky top-24"> {/* ✅ Card का नामकरण सही करें */}
                <CardContent className="p-6"> {/* ✅ CardContent का नामकरण सही करें */}
                  <h4 className="text-lg font-semibold mb-4 flex items-center">
                    <Filter className="mr-2 h-5 w-5" /> {/* ✅ Filter का नामकरण सही करें */}
                    Filters
                  </h4>
                  
                  {/* Price range */}
                  <div className="mb-6">
                    <h5 className="font-medium mb-3">Price Range</h5>
                    <div className="space-y-2">
                      {[
                        { id: 'under-250', label: 'Under ₹250' },
                        { id: '250-500', label: '₹250 - ₹500' },
                        { id: '500-1000', label: '₹500 - ₹1000' },
                        { id: '1000-5000', label: '₹1000 - ₹5000' },
                        { id: 'over-5000', label: '₹ Over 5000' },
                      ].map((range) => (
                        <div key={range.id} className="flex items-center space-x-2">
                          <Checkbox // ✅ Checkbox का नामकरण सही करें
                            id={range.id}
                            checked={priceFilter.includes(range.id)}
                            onCheckedChange={(checked) => // ✅ onCheckedChange का नामकरण सही करें
                              handlePriceFilterChange(range.id, checked as boolean)
                            }
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
                        <Checkbox // ✅ Checkbox का नामकरण सही करें
                          id="all-categories"
                          checked={!selectedCategory}
                          onCheckedChange={() => setSelectedCategory(null)} // ✅ onCheckedChange का नामकरण सही करें
                        />
                        <label htmlFor="all-categories" className="text-sm cursor-pointer">
                          All Categories
                        </label>
                      </div>
                      {categories.map((category) => (
                        <div key={category.id} className="flex items-center space-x-2">
                          <Checkbox // ✅ Checkbox का नामकरण सही करें
                            id={`category-${category.id}`}
                            checked={selectedCategory === category.id}
                            onCheckedChange={() => // ✅ onCheckedChange का नामकरण सही करें
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

            {/* Product grid */}
            <div className="flex-1">
              {/* Sort and view options */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-neutral-900">
                  {searchQuery ? `Search results for "${searchQuery}"` : 
                   selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : 
                   'Featured Products'}
                </h3>
                <div className="flex items-center space-x-4">
                  <Select value={sortBy} onValueChange={setSortBy}> {/* ✅ Select का नामकरण सही करें */}
                    <SelectTrigger className="w-48"> {/* ✅ SelectTrigger का नामकरण सही करें */}
                      <SelectValue placeholder="Sort by" /> {/* ✅ SelectValue का नामकरण सही करें */}
                    </SelectTrigger>
                    <SelectContent> {/* ✅ SelectContent का नामकरण सही करें */}
                      <SelectItem value="best-match">Best Match</SelectItem> {/* ✅ SelectItem का नामकरण सही करें */}
                      <SelectItem value="price-low">Price: Low to High</SelectItem> {/* ✅ SelectItem का नामकरण सही करें */}
                      <SelectItem value="price-high">Price: High to Low</SelectItem> {/* ✅ SelectItem का नामकरण सही करें */}
                      <SelectItem value="rating">Customer Rating</SelectItem> {/* ✅ SelectItem का नामकरण सही करें */}
                      <SelectItem value="newest">Newest First</SelectItem> {/* ✅ SelectItem का नामकरण सही करें */}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Product grid */}
              {productsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-80 w-full" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No products found matching your criteria.</p>
                  <Button // ✅ Button का नामकरण सही करें
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
