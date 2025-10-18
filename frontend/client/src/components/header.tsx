// client/src/components/Header.tsx

import React, { useState } from "react"; // Capitalized React, useState
import { Link, useNavigate } from "react-router-dom"; // Capitalized Link, useNavigate
import { useAuth } from "../hooks/useAuth"; // Corrected path and Capitalized useAuth
import { useQuery } from "@tanstack/react-query"; // Corrected import path and Capitalized useQuery
import { apiRequest } from "../lib/queryClient"; // Corrected path and Capitalized apiRequest

// UI Components Import
import { Button } from "./ui/button"; // Capitalized Button
import { Input } from "./ui/input"; // Capitalized Input
import {
  DropdownMenu, // Capitalized
  DropdownMenuContent, // Capitalized
  DropdownMenuItem, // Capitalized
  DropdownMenuLabel, // Capitalized
  DropdownMenuSeparator, // Capitalized
  DropdownMenuTrigger, // Capitalized
} from "./ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "./ui/sheet"; // Capitalized Sheet components
import {
  ShoppingCart, // Capitalized
  Menu, // Capitalized
  Search, // Capitalized
  User, // Capitalized
  Heart, // Capitalized
  Store, // Capitalized
  LogOut, // Capitalized (Lucide icon is LogOut, not logout)
  LogIn, // Capitalized (Lucide icon is LogIn, not login)
  LayoutDashboard, // Capitalized
  ListOrdered, // Capitalized
} from "lucide-react";
import SellerOnboardingDialog from "./seller/SellerOnboardingDialog"; // Capitalized component name
import { logout as firebaseLogout } from "../lib/firebase"; // Aliased to avoid conflict with Lucide icon

import LocationDisplay from "./LocationDisplay"; // <-- LocationDisplay को इम्पोर्ट करें

interface Category { // Capitalized
  id: string;
  name: string;
  slug: string;
}

interface CartItem { // Capitalized
  id: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    price: string;
    image: string;
  };
}

interface CartResponse { // Capitalized
  message: string;
  items: CartItem[];
}

interface HeaderProps { // Capitalized
  // categories: Category[]; // यदि categories header में सीधे नहीं दिए जाते तो इसे हटा सकते हैं
  onCartClick: () => void; // Capitalized
}

const Header: React.FC<HeaderProps> = ({ onCartClick }) => { // Capitalized Header, onCartClick
  const [searchValue, setSearchValue] = useState(""); // Capitalized
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth } = useAuth(); // Capitalized
  const [isSellerDialogOpen, setIsSellerDialogOpen] = useState(false); // Capitalized

  const { data: cartData } = useQuery<CartResponse>({ // Capitalized
    queryKey: ["/api/cart"], // Capitalized
    queryFn: () => apiRequest("get", "/api/cart"), // Capitalized
    enabled: isAuthenticated, // Capitalized
  });

  const totalItemsInCart = cartData?.items.reduce((sum, item) => sum + item.quantity, 0) || 0; // Capitalized

  const handleSearch = (e: React.FormEvent) => { // Capitalized
    e.preventDefault(); // Capitalized
    if (searchValue.trim()) { // Capitalized
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
      setSearchValue(""); // Capitalized
    }
  };

  const handleLogout = async () => { // Capitalized
    try {
      await firebaseLogout(); // Use aliased logout
      console.log("Header: user logged out successfully.");
      navigate("/");
      localStorage.removeItem('redirectIntent'); // Capitalized
    } catch (error) {
      console.error("Header: error during logout:", error);
    }
  };

  const handleSellerButtonClick = () => { // Capitalized
    console.log("Seller button clicked! isAuthenticated:", isAuthenticated, "user:", user); // Capitalized

    if (isLoadingAuth) { // Capitalized
      return;
    }

    if (!isAuthenticated) { // Capitalized
      localStorage.setItem('redirectIntent', 'become-seller'); // Capitalized
      navigate("/auth");
      return;
    }

    if (user?.role === "seller") {
      const approvalStatus = user.sellerProfile?.approvalStatus; // Capitalized
      if (approvalStatus === "approved") {
        navigate("/seller-dashboard");
      } else { // This handles 'pending' or 'null' status
        navigate("/seller-status");
      }
    } else { // This runs if user role is 'customer' or other
      setIsSellerDialogOpen(true); // Capitalized
    }
  };

  const getDashboardLink = () => { // Capitalized
    if (!isAuthenticated || !user) return null; // Capitalized

    switch (user.role) {
      case "seller":
        if (user.sellerProfile?.approvalStatus === "approved") { // Capitalized
          return { label: "Seller Dashboard", path: "/seller-dashboard" }; // Capitalized
        } else if (user.sellerProfile?.approvalStatus === "pending") { // Capitalized
          return { label: "Seller Status", path: "/seller-status" }; // Capitalized
        } else {
          return { label: "Seller Application", path: "/seller-apply" }; // Capitalized
        }
      case "admin":
        return { label: "Admin Dashboard", path: "/admin" }; // Changed to admin dashboard
      case "delivery":
        return { label: "Delivery Dashboard", path: "/delivery-page" }; // Capitalized
      case "customer":
        return { label: "My Orders", path: "/customer/orders" }; // Capitalized
      default:
        return null;
    }
  };

  const dashboardLink = getDashboardLink(); // Capitalized

  const getSellerButtonLabel = () => { // Capitalized
    if (user?.role === "seller") {
      const status = user.sellerProfile?.approvalStatus; // Capitalized
      if (status === "pending") return "View Seller Status"; // Capitalized
      if (status === "approved") return "Go to Seller Dashboard"; // Capitalized
      return "Become a Seller"; // Capitalized
    }
    return "Become a Seller"; // Capitalized
  };
  
  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm"> {/* className */}
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6"> {/* className */}
        <Link to="/" className="flex items-center text-xl font-bold text-blue-600"> {/* className */}
          <Store className="mr-2 h-6 w-6" /> {/* Capitalized Store */}
          ShopNish
        </Link>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-grow max-w-md mx-4"> {/* Capitalized onSubmit, className */}
          <Input // Capitalized Input
            type="search"
            placeholder="Search products..." // Capitalized
            className="w-full rounded-l-lg border-r-0 focus-visible:ring-offset-0 focus-visible:ring-0" // Capitalized
            value={searchValue} // Capitalized
            onChange={(e) => setSearchValue(e.target.value)} // Capitalized onChange, setSearchValue
          />
          <Button type="submit" variant="ghost" className="rounded-l-none rounded-r-lg border-l-0"> {/* Capitalized Button, className */}
            <Search className="h-5 w-5" /> {/* Capitalized Search */}
          </Button>
        </form>

        <nav className="hidden md:flex items-center space-x-4"> {/* className */}
          <Button // Capitalized Button
            onClick={handleSellerButtonClick} // Capitalized
            disabled={isLoadingAuth} // Capitalized
            variant="ghost"
            className="w-full justify-start text-blue-600 hover:bg-blue-50" // Capitalized
          >
            <Store className="mr-2 h-4 w-4" /> {/* Capitalized Store */}
            {getSellerButtonLabel()} {/* Capitalized */}
          </Button>

          <Link to="/wishlist"> {/* Capitalized Link */}
            <Button variant="ghost" size="icon"> {/* Capitalized Button */}
              <Heart className="h-5 w-5" /> {/* Capitalized Heart */}
              <span className="sr-only">Wishlist</span> {/* Capitalized */}
            </Button>
          </Link>

          {/* ✅ Cart Button */}
          <Button // Capitalized Button
            variant="ghost"
            size="icon"
            className="relative" // Capitalized
            onClick={onCartClick} // ✅ Here is the onClick handler
          >
            <ShoppingCart className="h-5 w-5" /> {/* Capitalized ShoppingCart */}
            {totalItemsInCart > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white"> {/* className */}
                {totalItemsInCart}
              </span>
            )}
            <span className="sr-only">Shopping Cart</span> {/* Capitalized */}
          </Button>

          <DropdownMenu> {/* Capitalized */}
            <DropdownMenuTrigger asChild> {/* Capitalized */}
              <Button variant="ghost" size="icon"> 
                <>
                <User className="h-5 w-5" /> {/* Capitalized User */}
                <span className="sr-only">User Menu</span> 
                </>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56"> {/* Capitalized */}
              {isLoadingAuth ? ( // Capitalized
                <DropdownMenuLabel>Loading...</DropdownMenuLabel> // Capitalized
              ) : isAuthenticated ? ( // Capitalized
                <>
                  <DropdownMenuLabel>{user?.name || user?.email?.split('@')[0] || "My Account"}</DropdownMenuLabel> {/* Capitalized, split fixed */}
                  <DropdownMenuSeparator /> {/* Capitalized */}
                  {dashboardLink && ( // Capitalized
                    <DropdownMenuItem asChild> {/* Capitalized */}
                      <Link to={dashboardLink.path}> {/* Capitalized Link */}
                        <LayoutDashboard className="mr-2 h-4 w-4" /> {/* Capitalized */}
                        {dashboardLink.label}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {user?.role === "customer" && (
                    <DropdownMenuItem asChild> {/* Capitalized */}
                      <Link to="/customer/orders"> {/* Capitalized Link */}
                        <ListOrdered className="mr-2 h-4 w-4" /> {/* Capitalized */}
                        My Orders
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout}> {/* Capitalized */}
                    <LogOut className="mr-2 h-4 w-4" /> {/* Capitalized LogOut */}
                    Logout
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild> {/* Capitalized */}
                    <Link to="/auth"> {/* Capitalized Link */}
                      <LogIn className="mr-2 h-4 w-4" /> {/* Capitalized LogIn */}
                      Login / Sign Up
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Mobile Menu */}
        <div className="flex items-center md:hidden"> {/* className */}
          {/* ✅ Mobile Cart Button */}
          <Button // Capitalized Button
            variant="ghost"
            size="icon"
            className="relative mr-2" // Capitalized
            onClick={onCartClick} // ✅ Here is the onClick handler
          >
            <ShoppingCart className="h-5 w-5" /> {/* Capitalized ShoppingCart */}
            {totalItemsInCart > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white"> {/* className */}
                {totalItemsInCart}
              </span>
            )}
            <span className="sr-only">Shopping Cart</span> {/* Capitalized */}
          </Button>

          <Sheet> {/* Capitalized */}
            <SheetTrigger asChild> {/* Capitalized */}
              <Button variant="ghost" size="icon"> {/* Capitalized Button */}
                <Menu className="h-5 w-5" /> {/* Capitalized Menu */}
                <span className="sr-only">Toggle Menu</span> {/* Capitalized */}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs p-4"> {/* Capitalized */}
              <SheetHeader> {/* Capitalized */}
                <SheetTitle>Menu</SheetTitle> {/* Capitalized */}
              </SheetHeader>
              <div className="flex flex-col items-start space-y-4"> {/* className */}
                <form onSubmit={handleSearch} className="w-full flex"> {/* Capitalized onSubmit, className */}
                  <Input // Capitalized Input
                    type="search"
                    placeholder="Search products..." // Capitalized
                    className="flex-grow rounded-r-none focus-visible:ring-offset-0 focus-visible:ring-0" // Capitalized
                    value={searchValue} // Capitalized
                    onChange={(e) => setSearchValue(e.target.value)} // Capitalized
                  />
                  <Button type="submit" variant="ghost" className="rounded-l-none"> {/* Capitalized Button, className */}
                    <Search className="h-5 w-5" /> {/* Capitalized Search */}
                  </Button>
                </form>

                {isLoadingAuth ? ( // Capitalized
                  <p className="text-gray-700">Loading user...</p> // Capitalized
                ) : isAuthenticated ? ( // Capitalized
                  <>
                    <span className="font-semibold text-gray-900">Hello, {user?.name || user?.email?.split('@')[0] || "User"}</span> {/* Capitalized, split fixed */}
                    {dashboardLink && ( // Capitalized
                      <Link to={dashboardLink.path} className="w-full"> {/* Capitalized Link, className */}
                        <Button variant="ghost" className="w-full justify-start"> {/* Capitalized Button, className */}
                          <LayoutDashboard className="mr-2 h-4 w-4" /> {/* Capitalized */}
                          {dashboardLink.label}
                        </Button>
                      </Link>
                    )}
                    {user?.role === "customer" && (
                      <Link to="/customer/orders" className="w-full"> {/* Capitalized Link, className */}
                        <Button variant="ghost" className="w-full justify-start"> {/* Capitalized Button, className */}
                          <ListOrdered className="mr-2 h-4 w-4" /> {/* Capitalized */}
                          My Orders
                        </Button>
                      </Link>
                    )}
                    <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-red-500 hover:bg-red-50"> {/* Capitalized Button, className */}
                      <LogOut className="mr-2 h-4 w-4" /> {/* Capitalized LogOut */}
                      Logout
                    </Button>
                  </>
                ) : (
                  <Link to="/auth" className="w-full"> {/* Capitalized Link, className */}
                    <Button variant="ghost" className="w-full justify-start"> {/* Capitalized Button, className */}
                      <LogIn className="mr-2 h-4 w-4" /> {/* Capitalized LogIn */}
                      Login / Sign Up
                    </Button>
                  </Link>
                )}

                <Link to="/wishlist" className="w-full"> {/* Capitalized Link, className */}
                  <Button variant="ghost" className="w-full justify-start"> {/* Capitalized Button, className */}
                    <Heart className="mr-2 h-4 w-4" /> {/* Capitalized Heart */}
                    Wishlist
                  </Button>
                </Link>

                <Button // Capitalized Button
                  onClick={handleSellerButtonClick} // Capitalized
                  disabled={isLoadingAuth} // Capitalized
                  variant="ghost"
                  className="w-full justify-start text-blue-600 hover:bg-blue-50" // Capitalized
                >
                  <Store className="mr-2 h-4 w-4" /> {/* Capitalized Store */}
                  {getSellerButtonLabel()} {/* Capitalized */}
                </Button>

                <div className="w-full border-t pt-4"> {/* className */}
                  <p className="font-semibold mb-2">Categories</p> {/* className */}
                  {/* categories prop को HeaderProps से हटाया गया है। यदि यह डेटा Header में चाहिए,
                      तो इसे useQuery के माध्यम से Fetch करना बेहतर होगा।
                  */}
                  {/* <ul className="space-y-2">
                    {categories.map((category) => (
                      <li key={category.id}>
                        <Link to={`/category/${category.slug}`}>
                          <Button variant="ghost" className="w-full justify-start">
                            {category.name}
                          </Button>
                        </Link>
                      </li>
                    ))}
                  </ul> */}
                   <p className="text-sm text-gray-500">No categories available (for mobile nav).</p>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      {/* LocationDisplay को Header के नीचे एक अलग div में जोड़ें ताकि यह स्थिर रहे */}
      <div className="bg-gray-100 py-2 border-t border-b">
        <div className="container mx-auto px-4 md:px-6">
          {/*   <LocationDisplay /> */}
          Location Placeholder
        </div>
      </div>

      {isAuthenticated && ( // Capitalized
        <SellerOnboardingDialog // Capitalized
          isOpen={isSellerDialogOpen} // Capitalized
          onClose={() => setIsSellerDialogOpen(false)} // Capitalized
        />
      )}
    </header>
  );
};

export default Header; // Capitalized
                      
