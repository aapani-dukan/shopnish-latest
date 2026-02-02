import { useState, useEffect, useMemo } from "react"; 
import { useQuery } from "@tanstack/react-query"; 
import { useLocation as useRouterLocation, Link, useNavigate } from "react-router-dom"; 
import { 
  Filter, ArrowRight, ShieldIcon, Loader2, Sparkles, 
  ShoppingBag, MapPin, Search, ChevronRight 
} from "lucide-react"; 

// UI Components
import { Button } from "@/components/ui/button"; 
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/product-card"; 
import Footer from "@/components/footer"; 
import LocationDisplay from '@/components/LocationDisplay'; 
import { useLocation as useGeoLocation } from '../context/LocationContext'; 
import { useAuth } from '@/hooks/useAuth'; 
import axios from 'axios';

// Swiper for Banners
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

// --- Types ---
interface Category {
  id: number;
  name: string;
  image: string | null;
  icon?: string;
}

interface LayoutSection {
  id: number;
  displayName: string;
  sectionType: string;
  config: {
    items: {
      title?: string;
      image?: string;
      deeplink?: string;
      productId?: string;
      categoryId?: string;
    }[];
  };
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const { currentLocation, loadingLocation } = useGeoLocation();

  // URL Params & States
  const urlParams = new URLSearchParams(routerLocation.search);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    urlParams.get('category') ? parseInt(urlParams.get('category')!) : null
  );
  const [searchQuery, setSearchQuery] = useState(urlParams.get('search') || "");
  const [sortBy, setSortBy] = useState("best-match");
  const [priceFilter, setPriceFilter] = useState<string[]>([]);

  // Sync state with URL
  useEffect(() => {
    const params = new URLSearchParams({
  pincode: String(currentLocation?.pincode),
  lat: String(currentLocation?.latitude),
  lng: String(currentLocation?.longitude),
});
    setSelectedCategory(params.get('category') ? parseInt(params.get('category')!) : null);
    setSearchQuery(params.get('search') || "");
  }, [routerLocation.search]);

  // अब यह चेक करेगा कि Pincode के साथ-साथ Lat/Lng भी होने चाहिए
const isLocationReady = 
  !loadingLocation && 
  !!currentLocation?.pincode && 
  !!currentLocation?.latitude && 
  !!currentLocation?.longitude;

  // --- 1. Queries ---
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['categories'], 
    queryFn: async () => (await axios.get('/api/categories')).data,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products-all', selectedCategory, searchQuery, currentLocation?.pincode, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        pincode: String(currentLocation?.pincode || ""),
        lat: String((currentLocation as any)?.latitude || ""),
        lng: String((currentLocation as any)?.longitude || ""),
      });
      if (selectedCategory) params.append('categoryId', String(selectedCategory));
      if (searchQuery) params.append('search', searchQuery);
      if (sortBy) params.append('sortBy', sortBy);

      const res = await axios.get(`/api/products?${params.toString()}`);
      return Array.isArray(res.data) ? { products: res.data } : res.data;
    },
    enabled: isLocationReady,
  });

  const { data: layoutSections = [], isLoading: layoutLoading } = useQuery<LayoutSection[]>({
    queryKey: ['layout', currentLocation?.pincode],
    queryFn: async () => (await axios.get(`/api/layout/public?pincode=${currentLocation?.pincode}`)).data,
    enabled: isLocationReady,
  });

  const products = productsData?.products || [];

  // --- 2. Filtering Logic ---
  const filteredProducts = useMemo(() => {
    if (priceFilter.length === 0) return products;
    return products.filter((p: any) => {
      const price = Number(p.price);
      return priceFilter.some(range => {
        if (range === "under-250") return price < 250;
        if (range === "250-500") return price >= 250 && price < 500;
        if (range === "500-1000") return price >= 500 && price < 1000;
        if (range === "over-5000") return price >= 5000;
        return true;
      });
    });
  }, [products, priceFilter]);

  // --- 3. Dynamic Section Building (Mobile App Sync) ---
  const homeSections = useMemo(() => {
    if (!isLocationReady || searchQuery || selectedCategory) return [];
    const list = [];

    // Hero Banner
    const hero = layoutSections.find(s => s.sectionType === 'HERO_BANNER' || s.sectionType === 'main_banner');
    if (hero) list.push({ type: 'HERO', data: hero });

    // Featured/Trending
    if (products.length > 0) {
      list.push({ type: 'TRENDING', items: products.slice(0, 10) });
    }

    // Category Strips + Ad Injection
    const specialAd = layoutSections.find(s => s.sectionType === 'category_special');
    let visibleCatCount = 0;

    categories.forEach((cat) => {
      const catProds = products.filter((p: any) => String(p.categoryId) === String(cat.id));
      if (catProds.length > 0) {
        visibleCatCount++;
        list.push({ type: 'STRIP', category: cat, items: catProds.slice(0, 5) });
        if (visibleCatCount === 2 && specialAd) list.push({ type: 'AD', data: specialAd });
      }
    });

    return list;
  }, [layoutSections, products, categories, isLocationReady, searchQuery, selectedCategory]);

  // --- 4. Navigation Helpers ---
  const handleBannerPress = (item: any) => {
    if (item?.productId) navigate(`/product/${item.productId}`);
    else if (item?.categoryId) setSelectedCategory(Number(item.categoryId));
    else if (item?.deeplink) window.open(item.deeplink, '_blank');
  };

  const handlePriceChange = (range: string, checked: boolean) => {
    setPriceFilter(prev => checked ? [...prev, range] : prev.filter(r => r !== range));
  };

  // --- 5. Conditional Renders ---
  if (loadingLocation || categoriesLoading) {
    return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;
  }

  if (!isLocationReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md w-full p-10 text-center shadow-2xl rounded-[3rem] border-none bg-white">
          <MapPin className="text-primary/20 h-20 w-20 mx-auto mb-6" />
          <h2 className="text-2xl font-black mb-2 text-slate-900">Set Delivery Location</h2>
          <p className="text-slate-500 mb-8 font-medium">Please select your location to find shops and amazing deals nearby.</p>
          <LocationDisplay />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {user?.role === 'admin' && (
        <div className="fixed top-6 right-6 z-[60]">
          <Button asChild className="rounded-full shadow-2xl bg-black hover:bg-slate-800 transition-all font-bold">
            <Link to="/admin"><ShieldIcon className="mr-2 h-4 w-4" /> Admin Access</Link>
          </Button>
        </div>
      )}

      {/* 🟠 Premium Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center gap-6">
          <Link to="/" className="text-2xl font-black text-primary tracking-tighter" onClick={() => {setSelectedCategory(null); setSearchQuery("");}}>
            SHOPNISH
          </Link>
          <div onClick={() => navigate('/search')} className="flex-1 flex items-center bg-slate-100 rounded-2xl px-5 py-3.5 cursor-pointer hover:bg-slate-200 transition-all border border-transparent hover:border-slate-200">
            <Search className="text-slate-400" size={18} />
            <span className="ml-3 text-slate-500 font-bold hidden md:inline">Find premium items in Bundi...</span>
          </div>
          <Button variant="ghost" className="relative p-3 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm" onClick={() => navigate('/cart')}>
            <ShoppingBag size={22} className="text-slate-700" />
            <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-white">0</span>
          </Button>
        </div>
        
        {/* Category Scroller Logic */}
        <div className="max-w-7xl mx-auto px-4 py-3 flex gap-8 overflow-x-auto no-scrollbar border-t border-slate-50">
           {categories.map((cat) => (
             <button 
               key={cat.id} 
               onClick={() => setSelectedCategory(cat.id)} 
               className={`flex items-center gap-2 min-w-fit transition-all duration-300 ${selectedCategory === cat.id ? 'scale-110' : 'opacity-70'}`}
             >
                <span className="text-xl">{cat.icon || '📦'}</span>
                <span className={`text-sm font-black ${selectedCategory === cat.id ? 'text-primary' : 'text-slate-600'}`}>{cat.name}</span>
             </button>
           ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pb-24">
        {(!selectedCategory && !searchQuery) ? (
          /* 🔵 HOME MODE (Dynamic Sections) */
          <div className="space-y-16">
            {homeSections.map((section: any, idx) => {
              switch (section.type) {
                case 'HERO':
                  return (
                    <div key={idx} className="pt-8">
                      {layoutLoading ? (
        <Skeleton className="h-[300px] md:h-[500px] w-full rounded-[3rem]" />
      ) : (
                      <Swiper modules={[Pagination, Autoplay]} pagination={{ clickable: true }} autoplay={{ delay: 5000 }} className="rounded-[3rem] shadow-2xl h-[300px] md:h-[500px]">
                        {section.data.config.items.map((item: any, i: number) => (
                          <SwiperSlide key={i} onClick={() => handleBannerPress(item)}>
                            <div className="relative w-full h-full cursor-pointer overflow-hidden">
                              <img src={item.image} className="w-full h-full object-cover" alt="" />
                              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent flex flex-col justify-center p-12 md:p-24">
                                <h2 className="text-4xl md:text-7xl font-black text-white mb-6 leading-tight max-w-2xl">{item.title}</h2>
                                <Button className="w-fit rounded-full px-12 py-8 text-xl bg-primary font-black shadow-lg hover:scale-105 transition-transform">Explore Now<ArrowRight className="ml-2 h-6 w-6" /></Button>
                              </div>
                            </div>
                          </SwiperSlide>
                        ))}
                      </Swiper>
      )}
                    </div>
                  );

                case 'TRENDING':
                  return (
                    <section key={idx}>
                      <div className="flex justify-between items-end mb-8">
                        <div>
                          <h3 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <Sparkles className="text-amber-400 fill-amber-400" /> Trending Nearby
                          </h3>
                          <p className="text-slate-500 font-bold">The most loved items in your area right now</p>
                        </div>
                        <Button variant="ghost" className="text-primary font-black group">See All <ChevronRight className="ml-1 group-hover:translate-x-1 transition-transform"/></Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {section.items.map((p: any) => <ProductCard key={p.id} product={p} />)}
                      </div>
                    </section>
                  );

                case 'STRIP':
                  return (
                    <section key={idx} className="pt-12 border-t border-slate-100">
                      <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl">{section.category.icon || '🛍️'}</div>
                          <h3 className="text-2xl font-black text-slate-900">{section.category.name}</h3>
                        </div>
                        <Button onClick={() => setSelectedCategory(section.category.id)} variant="outline" className="rounded-2xl border-2 font-black px-8">View Collection</Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {section.items.map((p: any) => <ProductCard key={p.id} product={p} />)}
                      </div>
                    </section>
                  );

                case 'AD':
                  return (
                    <div key={idx} className="rounded-[2.5rem] overflow-hidden shadow-xl h-44 md:h-60">
                      <Swiper autoplay={{ delay: 6000 }} modules={[Autoplay]} className="h-full">
                        {section.data.config.items.map((ad: any, i: number) => (
                          <SwiperSlide key={i} onClick={() => handleBannerPress(ad)}>
                            <img src={ad.image} className="w-full h-full object-cover" alt="Promotion" />
                          </SwiperSlide>
                        ))}
                      </Swiper>
                    </div>
                  );
                default: return null;
              }
            })}
          </div>
        ) : (
          /* 🟢 SEARCH/CATEGORY MODE (Sidebar Filter Enabled) */
          <div className="pt-12 flex flex-col lg:flex-row gap-12">
            <aside className="lg:w-64 shrink-0">
              <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden sticky top-32">
                <CardContent className="p-8">
                  <h4 className="font-black text-slate-900 mb-8 flex items-center gap-2"><Filter size={18} className="text-primary" /> Filters</h4>
                  <div className="space-y-8">
                    <div>
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Price Range</h5>
                      {['under-250', '250-500', '500-1000', 'over-5000'].map(range => (
                        <div key={range} className="flex items-center gap-3 mb-3">
                          <Checkbox id={range} checked={priceFilter.includes(range)} onCheckedChange={(c) => handlePriceChange(range, c as boolean)} />
                          <label htmlFor={range} className="text-sm font-bold text-slate-600 capitalize cursor-pointer">{range.replace('-', ' ')}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </aside>

            <div className="flex-1">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <h3 className="text-3xl font-black text-slate-900">
                  {searchQuery ? `Search: ${searchQuery}` : categories.find(c => c.id === selectedCategory)?.name || 'Collection'}
                </h3>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48 rounded-xl border-slate-200 font-bold bg-white"><SelectValue placeholder="Sort" /></SelectTrigger>
                  <SelectContent className="rounded-xl font-bold"><SelectItem value="best-match">Best Match</SelectItem><SelectItem value="price-low">Price: Low to High</SelectItem></SelectContent>
                </Select>
              </div>

              {productsLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-80 w-full rounded-[2.5rem]" />)}
                </div>
              ) : filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredProducts.map((p: any) => <ProductCard key={p.id} product={p} />)}
                </div>
              ) : (
                <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                  <ShoppingBag className="mx-auto h-20 w-20 text-slate-100 mb-6" />
                  <h4 className="text-2xl font-black text-slate-900 mb-2">No Items Found</h4>
                  <p className="text-slate-500 font-medium">Try adjusting your filters or search keywords.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}