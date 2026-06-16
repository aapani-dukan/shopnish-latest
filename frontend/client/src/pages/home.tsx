import { useState, useEffect, useMemo } from "react"; 
import { useQuery } from "@tanstack/react-query"; 
import { useLocation as useRouterLocation, Link, useNavigate } from "react-router-dom"; 
import { 
  Filter, ArrowRight, ShieldIcon, Loader2, Sparkles, 
  ShoppingBag, MapPin, Search, 
  Store
} from "lucide-react"; 

// UI Components
import { Button } from "@/components/ui/button"; 
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProductCard from "@/components/product-card"; 
import Footer from "@/components/footer"; 
import LocationDisplay from '@/components/LocationDisplay'; 
import { useLocation as useGeoLocation } from '../context/LocationContext'; 
import { useAuth } from '@/hooks/useAuth'; 
import axios from 'axios';

// Swiper for Banners
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
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
    urlParams.set('pincode', String(currentLocation?.pincode || ''));
    urlParams.set('lat', String(currentLocation?.latitude || ''));
    urlParams.set('lng', String(currentLocation?.longitude || ''));
    setSelectedCategory(urlParams.get('category') ? parseInt(urlParams.get('category')!) : null);
    setSearchQuery(urlParams.get('search') || "");
  }, [routerLocation.search]);

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
        lat: String(currentLocation?.latitude || ""),
        lng: String(currentLocation?.longitude || ""),
      });
      if (selectedCategory) params.append('categoryId', String(selectedCategory));
      if (searchQuery) params.append('search', searchQuery);
      if (sortBy) params.append('sortBy', sortBy);

      const res = await axios.get(`/api/products?${params.toString()}`);
      return Array.isArray(res.data) ? { products: res.data } : res.data;
    },
    enabled: isLocationReady,
  });

  const { data: layoutSections = [] } = useQuery<LayoutSection[]>({
    queryKey: ['layout', currentLocation?.pincode],
    queryFn: async () => (await axios.get(`/api/layout/public?pincode=${currentLocation?.pincode}`)).data,
    enabled: isLocationReady,
  });

  const rawProducts = productsData?.products || [];

  // ==================== 🎯 100% बुलेटप्रूफ यूनिवर्सल डिस्काउंट एवं वैरिएंट नॉर्मलाइजेशन इंजन ====================
  const normalizedProducts = useMemo(() => {
    return rawProducts.map((p: any) => {
      const variantsList = p.variants || [];
      let basePrice = Number(p.price || p.variant?.price || 0);
      let baseMrp = Number(p.mrp || p.originalPrice || p.variant?.mrp || p.variant?.originalPrice || 0);

      if (variantsList.length > 0) {
        const lowestVariant = variantsList.reduce((min: any, v: any) => 
          Number(v.price || 0) < Number(min.price || 0) ? v : min, variantsList[0]
        );
        basePrice = Number(lowestVariant?.price || basePrice);
        baseMrp = Number(lowestVariant?.mrp || lowestVariant?.originalPrice || baseMrp);
      }

      const savings = baseMrp - basePrice;
      let calculatedDiscountText = '';
      if (baseMrp > basePrice && savings > 0) {
        if (savings < 100) {
          calculatedDiscountText = '${Math.round((savings / baseMrp) * 100)}% OFF';
        } else {
          calculatedDiscountText = 'Flat ₹${Math.round(savings)} OFF';
        }
      }

      return {
        ...p,
        price: basePrice,
        mrp: baseMrp,
        discountText: calculatedDiscountText,
        hasMultipleVariants: variantsList.length > 1
      };
    });
  }, [rawProducts]);

  // --- 2. Filtering Logic ---
  const filteredProducts = useMemo(() => {
    if (priceFilter.length === 0) return normalizedProducts;
    return normalizedProducts.filter((p: any) => {
      const price = Number(p.price);
      return priceFilter.some(range => {
        if (range === "under-250") return price < 250;
        if (range === "250-500") return price >= 250 && price < 500;
        if (range === "500-1000") return price >= 500 && price < 1000;
        if (range === "over-5000") return price >= 5000;
        return true;
      });
    });
  }, [normalizedProducts, priceFilter]);

  // --- 3. Dynamic Section Building (Mobile App USP Synchronization) ---
  const homeSections = useMemo(() => {
    if (!isLocationReady || searchQuery || selectedCategory) return [];
    const list = [];

    // A. Hero Banner Block
    const hero = layoutSections.find(s => s.sectionType === 'HERO_BANNER' || s.sectionType === 'main_banner');
    if (hero) list.push({ type: 'HERO', data: hero });

    // 🏪 यूनिक लोकल दुकानें निकालो भाई साहब होम पेज पर प्रचार चमकाने के लिए
    const localShops: any[] = [];
    const shopsSeen: any = {};
    normalizedProducts.forEach((p: any) => {
      if (p.seller && p.seller.id && !shopsSeen[p.seller.id]) {
        shopsSeen[p.seller.id] = true;
        localShops.push({
          id: p.seller.id,
          businessName: p.seller.businessName || "Local Trusted Store",
          businessAddress: p.seller.businessAddress || "Nearby Local Market, Bundi",
        });
      }
    });

    // B. Trending Nearby Block: सीधा कड़क 21 प्रोडक्ट्स की क्षमता (7 लाइन्स) भाई साहब!
    const trendingChunk = normalizedProducts.slice(0, 21);
    if (trendingChunk.length > 0) {
      // पहले 10 प्रोडक्ट्स रेंडर लिस्ट में डालो
      list.push({ type: 'TRENDING', items: trendingChunk.slice(0, 10) });

      // 🏪 पहली लोकल दुकान का मखमली विज्ञापनी कार्ड बीच में इंजेक्ट कर दो भाई साहब!
      if (localShops.length > 0) {
        list.push({ type: 'LOCAL_SHOP_AD', shop: localShops[0] });
      }

      // बचे हुए 11 प्रोडक्ट्स (टोटल 21 करने के लिए) रेंडर लिस्ट में जोड़ो
      if (trendingChunk.length > 10) {
        list.push({ type: 'TRENDING', items: trendingChunk.slice(10, 21) });
      }

      // 🏪 दूसरी लोकल दुकान का कार्ड (अगर उपलब्ध हो)
      if (localShops.length > 1) {
        list.push({ type: 'LOCAL_SHOP_AD', shop: localShops[1] });
      }
    }

    // C. Category Strips + Middle Ad Injection: यहाँ भी लिमिट कड़क 21 प्रोडक्ट्स पर लॉक!
    const specialAd = layoutSections.find(s => s.sectionType === 'category_special');
    let visibleCatCount = 0;

    categories.forEach((cat) => {
      const catProds = normalizedProducts.filter((p: any) => String(p.categoryId) === String(cat.id));
      if (catProds.length > 0) {
        visibleCatCount++;
        // कड़क लिमिट: सीधे 21 प्रोडक्ट्स पर स्ट्रिप को अपग्रेड किया भाई साहब!
        list.push({ type: 'STRIP', category: cat, items: catProds.slice(0, 21) });
        if (visibleCatCount === 2 && specialAd) list.push({ type: 'AD', data: specialAd });
      }
    });

    return list;
  }, [layoutSections, normalizedProducts, categories, isLocationReady, searchQuery, selectedCategory]);

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
  if (loadingLocation || categoriesLoading || productsLoading) {
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

      {/* Sticky Header Block */}
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
        
        {/* Category Icons Navigation Bar */}
        <div className="max-w-7xl mx-auto px-4 py-3 flex gap-8 overflow-x-auto no-scrollbar border-t border-slate-50">
           {categories.map((cat) => (
             <button 
               key={cat.id} 
               onClick={() => setSelectedCategory(cat.id)} 
               className={'flex items-center gap-2 min-w-fit transition-all duration-300 ' + (selectedCategory === cat.id ? 'scale-110' : 'opacity-70')}
             >
                <span className="text-xl">{cat.icon || '📦'}</span>
                <span className={'text-sm font-black ' + (selectedCategory === cat.id ? 'text-primary' : 'text-slate-600')}>{cat.name}</span>
             </button>
           ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pb-24">
        {(!selectedCategory && !searchQuery) ? (
          /* 🔵 HOME MODE: Dynamic Sections Render UI */
          <div className="space-y-16">
            {homeSections.map((section: any, idx) => {
              switch (section.type) {
                case 'HERO':
                  return (
                    <div key={idx} className="pt-8">
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
                          <p className="text-slate-500 font-bold">The most loved items in your area right now (Showing up to 21 items)</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {section.items.map((p: any) => <ProductCard key={p.id} product={p} />)}
                      </div>
                    </section>
                  );

                // 🏪 नया केस ब्लॉक: स्थानीय दुकानों का एलीट बॉर्डर वाला वीआईपी एडवरटाइजमेंट कार्ड (USP Sync)
                case 'LOCAL_SHOP_AD':
                  return (
                    <div 
                      key={idx} 
                      onClick={() => navigate(`/shop/${section.shop.id}?name=${encodeURIComponent(section.shop.businessName)}`)}
                      className="cursor-pointer border-2 border-indigo-100 bg-gradient-to-r from-indigo-50/50 via-white to-white rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="space-y-2">
                        <span className="inline-flex items-center text-xs font-black tracking-widest text-indigo-600 bg-indigo-100/60 px-3 py-1.5 rounded-full uppercase">
                          <Store size={12} className="mr-1.5" /> Local Trusted Merchant
                        </span>
                        <h4 className="text-2xl md:text-3xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{section.shop.businessName}</h4>
                        <p className="text-slate-500 text-sm font-bold">📍 Location: {section.shop.businessAddress}</p>
                      </div>
                      <Button className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-6 text-sm shadow-md group-hover:scale-105 transition-all shrink-0">
                        Browse Shop Catalog ➔
                      </Button>
                    </div>
                  );

                case 'STRIP':
                  return (
                    <section key={idx} className="pt-12 border-t border-slate-100">
                      <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-2xl">{section.category.icon || '🛍️'}</div>
                          <h3 className="text-2xl font-black text-slate-900">{section.category.name}</h3>
                        </div>
                        <Button onClick={() => setSelectedCategory(section.category.id)} variant="outline" className="rounded-2xl border-2 font-black px-8">View All 21 Items</Button>
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
          /* 🟢 SEARCH/CATEGORY MODE (सब-कैटेगरी का मखमली पट्टी फ़िल्टर लाइव भाई साहब!) */
          <div className="pt-12 flex flex-col lg:flex-row gap-12">
            
            {/* LEFT SIDEBAR: फ़िल्टर और सब-कैटेगरीज का महा-संगम */}
            <aside className="lg:w-64 shrink-0 space-y-8 sticky top-32 h-fit">
              
              {/* 🎛️ नया जादुई डिब्बा: सब-कैटेगरी लिस्टिंग (Blinkit Style Web Layout) */}
              {!searchQuery && selectedCategory && (
                <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
                  <CardContent className="p-6">
                    <h4 className="font-black text-slate-900 mb-4 text-xs uppercase tracking-wider text-indigo-600">
                      Subcategories / श्रेणियां
                    </h4>
                    
                    {/* सब-कैटेगरी फ़ेचिंग हुक या डायनेमिक मैपिंग भाई साहब */}
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          // 'All' करने पर उस कैटेगरी का सारा माल दिखेगा भाई
                          const url = new URL(window.location.href);
                          url.searchParams.delete('subcategory');
                          navigate(`${window.location.pathname}?${url.searchParams.toString()}`);
                        }}
                        className={`text-left px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                          !urlParams.get('subcategory') 
                            ? 'bg-indigo-600 text-white shadow-md scale-105' 
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        📁 All Items / सब कुछ
                      </button>

                      {/* 🎯 यहाँ डेटाबेस की सब-कैटेगरीज डायनेमिक रेंडर होंगी भाई */}
                      {/* नोट: अगर बैकएंड से सब-कैटेगरी लिस्ट इस पेज पर लानी हो तो categories के अंदर से या अलग useQuery से मैप कर सकते हैं */}
                      {normalizedProducts
                        .reduce((acc: any[], p: any) => {
                          if (p.subCategoryName && !acc.some(a => a.name === p.subCategoryName)) {
                            acc.push({ name: p.subCategoryName, nameHindi: p.subCategoryNameHindi || '' });
                          }
                          return acc;
                        }, [])
                        .map((sub: any, i: number) => {
                          const isSubSelected = urlParams.get('subcategory') === sub.name;
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                const url = new URL(window.location.href);
                                url.searchParams.set('subcategory', sub.name);
                                navigate(`${window.location.pathname}?${url.searchParams.toString()}`);
                              }}
                              className={`text-left px-4 py-2.5 rounded-xl font-bold text-sm flex flex-col transition-all ${
                                isSubSelected 
                                  ? 'bg-indigo-600 text-white shadow-md scale-105' 
                                  : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <span>{sub.name}</span>
                              <span className={`text-[10px] font-medium ${isSubSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                                {sub.nameHindi}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* पुराना वाला प्राइस फ़िल्टर कार्ड (बिल्कुल सेफ़ है भाई साहब) */}
              <Card className="rounded-[2.5rem] border-none shadow-sm bg-white overflow-hidden">
                <CardContent className="p-8">
                  <h4 className="font-black text-slate-900 mb-8 flex items-center gap-2">
                    <Filter size={18} className="text-primary" /> Price Filters
                  </h4>
                  <div className="space-y-4">
                    {['under-250', '250-500', '500-1000', 'over-5000'].map(range => (
                      <div key={range} className="flex items-center gap-3">
                        <Checkbox id={range} checked={priceFilter.includes(range)} onCheckedChange={(c) => handlePriceChange(range, c as boolean)} />
                        <label htmlFor={range} className="text-sm font-bold text-slate-600 capitalize cursor-pointer">
                          {range.replace('-', ' ')}
                        </label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </aside>

            {/* राइट साइड का प्रोडक्ट डिस्प्ले एरिया (वही सुधरा हुआ ३-४ का ग्रिड भाई) */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <h3 className="text-3xl font-black text-slate-900">
                  {searchQuery ? `Search: ${searchQuery}` : categories.find(c => c.id === selectedCategory)?.name || 'Collection'}
                  {urlParams.get('subcategory') && ` ➔ ${urlParams.get('subcategory')}`}
                </h3>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48 rounded-xl border-slate-200 font-bold bg-white"><SelectValue placeholder="Sort" /></SelectTrigger>
                  <SelectContent className="rounded-xl font-bold"><SelectItem value="best-match">Best Match</SelectItem><SelectItem value="price-low">Price: Low to High</SelectItem></SelectContent>
                </Select>
              </div>

              {/* 🎯 फ़िल्टर के साथ सब-कैटेगरी का लाइव सॉर्टिंग मैच */}
              {(() => {
                const subFilter = urlParams.get('subcategory');
                const finalDisplayProducts = subFilter 
                  ? filteredProducts.filter((p: any) => p.subCategoryName === subFilter)
                  : filteredProducts;

                return finalDisplayProducts.length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {finalDisplayProducts.map((p: any) => <ProductCard key={p.id} product={p} />)}
                  </div>
                ) : (
                  <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                    <ShoppingBag className="mx-auto h-20 w-20 text-slate-100 mb-6" />
                    <h4 className="text-2xl font-black text-slate-900 mb-2">No Items Found</h4>
                    <p className="text-slate-500 font-medium">Is subcategory me abhi koi fresh stock nahi hai bhai sahab.</p>
                  </div>
                );
              })()}
            </div>

          </div>
        )}
    </main> {/* 👈 यहाँ main टैग कतई परफेक्ट क्लोज हो गया भाई साहब! */}
      <Footer />
    </div>
  );
}