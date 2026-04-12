// client/src/components/Header.tsx

import React, { useState } from "react"; // ✅ Corrected casing
import { Link, useNavigate } from "react-router-dom"; // ✅ Corrected casing
import { useAuth } from "../hooks/useAuth"; // ✅ Corrected casing and path
import { useQuery } from "@tanstack/react-query"; // ✅ Corrected casing
import { apiRequest } from "../lib/queryClient"; // ✅ Corrected casing and path

// UI कॉम्पोनेंट्स इम्पोर्ट करें (पाथ और केसिंग को आपके प्रोजेक्ट स्ट्रक्चर के अनुसार एडजस्ट करें)
import { Button } from "../components/ui/button"; // ✅ Corrected casing and path
import { Input } from "../components/ui/input"; // ✅ Corrected casing and path
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"; // ✅ Corrected casing and path
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "../components/ui/sheet"; // ✅ Corrected casing and path
import {
  ShoppingCart, // ✅ Corrected casing
  Menu, // ✅ Corrected casing
  Search, // ✅ Corrected casing
  User, // ✅ Corrected casing
  Heart, // ✅ Corrected casing
  Store, // ✅ Corrected casing
  LogOut, // ✅ Corrected casing
  LogIn, // ✅ Corrected casing
  LayoutDashboard, // ✅ Corrected casing
  ListOrdered, // ✅ Corrected casing
} from "lucide-react";
import SellerOnboardingDialog from "./seller/SellerOnboardingDialog"; // ✅ Corrected casing
import { logout } from "../lib/firebase"; // ✅ Corrected casing and path
//import LocationDisplay from "./LocationDisplay"; // ✅ Corrected casing

interface Category { // ✅ Corrected casing
  id: string;
  name: string;
  slug: string;
}

interface CartItem { // ✅ Corrected casing
  id: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    price: string;
    image: string;
  };
}

interface CartResponse { // ✅ Corrected casing
  message: string;
  items: CartItem[];
}

interface HeaderProps { // ✅ Corrected casing
  categories?: Category[]; // ✅ Made optional with default value below
  onCartClick: () => void; // ✅ Added onCartClick prop
}
const Header: React.FC<HeaderProps> = ({ categories = [], onCartClick }) => {
  const [searchValue, setSearchValue] = useState("");
  const navigate = useNavigate();
  // ✅ useAuth se ab humein verified phone number bhi mil raha hai
  const { user, isAuthenticated, isLoadingAuth } = useAuth(); 
  const [isSellerDialogOpen, setIsSellerDialogOpen] = useState(false);

  const { data: cartData } = useQuery<CartResponse>({ // ✅ Corrected casing
    queryKey: ["/api/cart"],
    queryFn: () => apiRequest("GET", "/api/cart"), // ✅ Method to GET
    enabled: isAuthenticated,
  });

  const totalItemsInCart = cartData?.items.reduce((sum, item) => sum + item.quantity, 0) || 0; // ✅ Corrected casing

  const handleSearch = (e: React.FormEvent) => { // ✅ Corrected casing
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
      setSearchValue("");
    }
  };
 const getDisplayName = () => {
    if (!user) return "User";
    if (user.name) return user.name;
    // Agar name nahi hai, toh Phone Number dikhao (e.g., +91 9928XXXXXX)
    if (user.phoneNumber) return user.phoneNumber;
    // Fallback agar kuch bhi na ho (Purana email logic handle karne ke liye)
    if (user?.email) return user.email.split('@')[0];
    return "My Account";
  };
 const handleLogout = async () => {
    try {
      await logout();
      navigate("/login"); // ✅ "/auth" ko "/login" kiya
      localStorage.removeItem('redirectIntent');
    } catch (error) {
      console.error("Header Logout Error:", error);
    }
  };
const handleSellerButtonClick = () => {
    if (isLoadingAuth) return;

    if (!isAuthenticated) {
      localStorage.setItem('redirectIntent', 'become-seller');
      navigate("/login"); // ✅ Redirect to new login page
      return;
    }

    if (user?.role === "seller") {
      const status = user.sellerProfile?.approvalStatus || user.sellerApprovalStatus;
      if (status === "approved") {
        navigate("/seller-dashboard");
      } else {
        navigate("/seller-status");
      }
    } else {
      setIsSellerDialogOpen(true);
    }
  };

  const getDashboardLink = () => { // ✅ Corrected casing
    if (!isAuthenticated || !user) return null;

    switch (user.role) {
      case "seller":
        if (user.sellerProfile?.approvalStatus === "approved") { // ✅ Corrected casing
          return { label: "Seller Dashboard", path: "/seller-dashboard" };
        } else if (user.sellerProfile?.approvalStatus === "pending") { // ✅ Corrected casing
          return { label: "Seller Status", path: "/seller-status" };
        } else {
          return { label: "Seller Application", path: "/seller-apply" };
        }
      case "admin":
        return { label: "Admin Login", path: "/admin-login" };
      case "delivery-boy":
        return { label: "Delivery Dashboard", path: "/delivery-page" };
      case "customer":
        return { label: "My Orders", path: "/customer/orders" };
      default:
        return null;
    }
  };

  const dashboardLink = getDashboardLink(); // ✅ Corrected casing

  const getSellerButtonLabel = () => { // ✅ Corrected casing
    if (user?.role === "seller") {
      const status = user.sellerProfile?.approvalStatus; // ✅ Corrected casing
      if (status === "pending") return "View Seller Status";
      if (status === "approved") return "Go to Seller Dashboard";
      return "Become a Seller";
    }
    return "Become a Seller";
  };

return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center text-xl font-bold text-blue-600">
          <Store className="mr-2 h-6 w-6" />
          Shopnish
        </Link>

        <form onSubmit={handleSearch} className="hidden md:flex flex-grow max-w-md mx-4">
          <Input
            type="search"
            placeholder="Search products..."
            className="w-full rounded-l-lg border-r-0 focus-visible:ring-offset-0 focus-visible:ring-0"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <Button type="submit" variant="ghost" className="rounded-l-none rounded-r-lg border-l-0">
            <Search className="h-5 w-5" />
          </Button>
        </form>

        <nav className="hidden md:flex items-center space-x-4">
          <Button
            onClick={handleSellerButtonClick}
            disabled={isLoadingAuth}
            variant="ghost"
            className="w-full justify-start text-blue-600 hover:bg-blue-50"
          >
            <Store className="mr-2 h-4 w-4" />
            {getSellerButtonLabel()}
          </Button>

          <Link to="/wishlist">
            <Button variant="ghost" size="icon">
              <Heart className="h-5 w-5" />
              <span className="sr-only">Wishlist</span>
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={onCartClick}
          >
            <ShoppingCart className="h-5 w-5" />
            {totalItemsInCart > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {totalItemsInCart}
              </span>
            )}
            <span className="sr-only">Shopping Cart</span>
          </Button>
<DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <span>
                  <User className="h-5 w-5" />
                  <span className="sr-only">User menu</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-60 p-2 shadow-xl rounded-2xl border-slate-100">
              {isLoadingAuth ? (
                <DropdownMenuLabel className="text-slate-400">Profile loading...</DropdownMenuLabel>
              ) : isAuthenticated ? (
                <>
                  <DropdownMenuLabel className="flex flex-col pb-3">
                    <span className="text-sm font-black text-slate-900 leading-none mb-1">
                      {getDisplayName()}
                    </span>
                    <span className="text-[10px] text-blue-600 uppercase tracking-widest font-bold">
                      {user?.role || "Customer"}
                    </span>
                  </DropdownMenuLabel>
                  
                  <DropdownMenuSeparator className="my-1" />

                  {dashboardLink && (
                    <DropdownMenuItem asChild className="rounded-lg py-2.5 cursor-pointer">
                      <Link to={dashboardLink.path} className="flex items-center">
                        <LayoutDashboard className="mr-2 h-4 w-4 text-blue-500" />
                        <span className="font-medium text-slate-700">{dashboardLink.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  )}

                  {user?.role === "customer" && (
                    <DropdownMenuItem asChild className="rounded-lg py-2.5 cursor-pointer">
                      <Link to="/customer/orders" className="flex items-center">
                        <ListOrdered className="mr-2 h-4 w-4 text-slate-500" />
                        <span className="font-medium text-slate-700">My Orders</span>
                      </Link>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator className="my-1" />
                  
                  <DropdownMenuItem 
                    onClick={handleLogout} 
                    className="rounded-lg py-2.5 cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700 font-bold"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem asChild className="rounded-lg py-3 cursor-pointer bg-blue-600 text-white focus:bg-blue-700 focus:text-white">
                  <Link to="/login" className="flex items-center justify-center w-full">
                    <LogIn className="mr-2 h-4 w-4" />
                    <span className="font-bold text-center">Login / Sign Up</span>
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Mobile Menu */}
        <div className="flex items-center md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="relative mr-2"
            onClick={onCartClick}
          >
            <ShoppingCart className="h-5 w-5" />
            {totalItemsInCart > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {totalItemsInCart}
              </span>
            )}
            <span className="sr-only">Shopping Cart</span>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <span>
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs p-4 overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col items-start space-y-4 mt-4">
                <form onSubmit={handleSearch} className="w-full flex">
                  <Input
                    type="search"
                    placeholder="Search products..."
                    className="flex-grow rounded-r-none focus-visible:ring-0"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                  />
                  <Button type="submit" variant="ghost" className="rounded-l-none border border-l-0">
                    <Search className="h-5 w-5" />
                  </Button>
                </form>

                {isLoadingAuth ? (
                  <p className="text-sm text-gray-400">Loading user...</p>
                ) : isAuthenticated ? (
                  <>
                    <div className="bg-slate-50 w-full p-3 rounded-xl border border-slate-100">
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Welcome back</p>
                      <p className="font-bold text-slate-900">{getDisplayName()}</p>
                    </div>
                    
                    {dashboardLink && (
                      <Link to={dashboardLink.path} className="w-full">
                        <Button variant="ghost" className="w-full justify-start font-medium">
                          <LayoutDashboard className="mr-2 h-4 w-4 text-blue-500" />
                          {dashboardLink.label}
                        </Button>
                      </Link>
                    )}
                    
                    {user?.role === "customer" && (
                      <Link to="/customer/orders" className="w-full">
                        <Button variant="ghost" className="w-full justify-start font-medium">
                          <ListOrdered className="mr-2 h-4 w-4 text-slate-500" />
                          My Orders
                        </Button>
                      </Link>
                    )}
                    
                    <Button 
                      onClick={handleLogout} 
                      variant="ghost" 
                      className="w-full justify-start text-red-600 font-bold hover:bg-red-50"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <Link to="/login" className="w-full">
                    <Button className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl">
                      <LogIn className="mr-2 h-4 w-4" />
                      Login / Sign Up
                    </Button>
                  </Link>
                )}

                <div className="w-full h-[1px] bg-slate-100 my-2" />

                <Link to="/wishlist" className="w-full">
                  <Button variant="ghost" className="w-full justify-start font-medium">
                    <Heart className="mr-2 h-4 w-4 text-pink-500" />
                    Wishlist
                  </Button>
                </Link>

                <Button
                  onClick={handleSellerButtonClick}
                  disabled={isLoadingAuth}
                  variant="ghost"
                  className="w-full justify-start text-blue-600 font-bold hover:bg-blue-50"
                >
                  <Store className="mr-2 h-4 w-4" />
                  {getSellerButtonLabel()}
                </Button>

                <div className="w-full border-t pt-4">
                  <p className="font-bold text-slate-900 mb-3 px-2 text-sm uppercase tracking-widest">Categories</p>
                  {categories.length > 0 ? (
                    <div className="grid grid-cols-1 gap-1">
                      {categories.map((category) => (
                        <Link key={category.id} to={`/category/${category.slug}`}>
                          <Button variant="ghost" className="w-full justify-start text-slate-600">
                            {category.name}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 px-2">No categories available.</p>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      {isAuthenticated && (
        <SellerOnboardingDialog
          isOpen={isSellerDialogOpen}
          onClose={() => setIsSellerDialogOpen(false)}
        />
      )}
    </header>
  );
};

export default Header;

                                       
