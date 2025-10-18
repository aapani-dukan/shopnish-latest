// client/src/components/header.tsx

import React, { useState, useCallback } from "react"; // Corrected: React, useState, useCallback (useCallback भी उपयोग हुआ है)
import { Link, useNavigate } from "react-router-dom"; // Corrected: Link, useNavigate
import { useAuth } from "../hooks/useAuth"; // Corrected: useAuth
import { useQuery } from "@tanstack/react-query"; // Corrected: useQuery, @tanstack/react-query
import { apiRequest } from "../lib/queryClient"; // Corrected: apiRequest

// ui components import
import { Button } from "./ui/button"; // Corrected: Button
import { Input } from "./ui/input"; // Corrected: Input
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"; // Corrected: DropdownMenu, etc.
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "./ui/sheet"; // Corrected: Sheet, etc.
import {
  ShoppingCart,
  Menu,
  Search,
  User,
  Heart,
  Store,
  LogOut, // Corrected: LogOut (Lucide icon)
  LogIn,  // Corrected: LogIn (Lucide icon)
  LayoutDashboard,
  ListOrdered,
} from "lucide-react"; // Corrected: ShoppingCart, etc.
import SellerOnboardingDialog from "./seller/SellerOnboardingDialog"; // Corrected: SellerOnboardingDialog
import { logout as firebaseLogout } from "../lib/firebase"; // Corrected: firebaseLogout

//import LocationDisplay from "./LocationDisplay"; // Corrected: LocationDisplay (PascalCase for React Component)

// यदि आप category डेटा header में उपयोग कर रहे हैं तो इसे वापस जोड़ें, अन्यथा हटा दें।
// मुझे लगता है कि यह कहीं और से आना चाहिए (जैसे useQuery से), या यह प्रॉप के माध्यम से पास किया जाएगा।
// चूंकि आपने इसे props से हटा दिया है, तो मैं इसे यहाँ कमेंट कर रहा हूँ।
// interface Category {
//   id: string;
//   name: string;
//   slug: string;
// }

interface CartItem { // Corrected: CartItem
  id: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    price: string;
    image: string;
  };
}

interface CartResponse { // Corrected: CartResponse
  message: string;
  items: CartItem[];
}

interface HeaderProps { // Corrected: HeaderProps
  // categories: Category[]; // Removed as per your comment
  onCartClick: () => void; // Corrected: onCartClick
}

const Header: React.FC<HeaderProps> = ({ onCartClick }) => { // Corrected: Header, React.FC, HeaderProps, onCartClick
  const [searchValue, setSearchValue] = useState(""); // Corrected: searchValue, setSearchValue, useState
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth } = useAuth(); // Corrected: isAuthenticated, isLoadingAuth
  const [isSellerDialogOpen, setIsSellerDialogOpen] = useState(false); // Corrected: isSellerDialogOpen, setIsSellerDialogOpen, useState

  // Fetch categories here if they are not passed as props and needed
  // const { data: categoriesData } = useQuery<Category[]>({
  //   queryKey: ["/api/categories"],
  //   queryFn: () => apiRequest("get", "/api/categories"),
  // });
  // const categories = categoriesData || [];

  const { data: cartData } = useQuery<CartResponse>({ // Corrected: cartData, useQuery, CartResponse
    queryKey: ["/api/cart"], // Corrected: queryKey
    queryFn: () => apiRequest("get", "/api/cart"), // Corrected: queryFn, apiRequest
    enabled: isAuthenticated, // Corrected: isAuthenticated
  });

  const totalItemsInCart = cartData?.items.reduce((sum, item) => sum + item.quantity, 0) || 0; // Corrected: totalItemsInCart

  const handleSearch = (e: React.FormEvent) => { // Corrected: handleSearch, React.FormEvent
    e.preventDefault(); // Corrected: preventDefault
    if (searchValue.trim()) { // Corrected: searchValue
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
      setSearchValue(""); // Corrected: setSearchValue
    }
  };

  const handleLogout = async () => { // Corrected: handleLogout
    try {
      await firebaseLogout(); // Corrected: firebaseLogout
      console.log("Header: user logged out successfully.");
      navigate("/");
      localStorage.removeItem('redirectIntent'); // Corrected: localStorage, removeItem, redirectIntent
    } catch (error) {
      console.error("Header: error during logout:", error);
    }
  };

  const handleSellerButtonClick = () => { // Corrected: handleSellerButtonClick
    console.log("Seller button clicked! isAuthenticated:", isAuthenticated, "user:", user); // Corrected: isAuthenticated

    if (isLoadingAuth) { // Corrected: isLoadingAuth
      return;
    }

    if (!isAuthenticated) { // Corrected: isAuthenticated
      localStorage.setItem('redirectIntent', 'become-seller'); // Corrected: localStorage, setItem, redirectIntent
      navigate("/auth");
      return;
    }

    if (user?.role === "seller") {
      const approvalStatus = user.sellerProfile?.approvalStatus; // Corrected: approvalStatus, sellerProfile
      if (approvalStatus === "approved") {
        navigate("/seller-dashboard");
      } else { // This handles 'pending' or 'null' status
        navigate("/seller-status");
      }
    } else { // This runs if user role is 'customer' or other
      setIsSellerDialogOpen(true); // Corrected: setIsSellerDialogOpen
    }
  };

  const getDashboardLink = () => { // Corrected: getDashboardLink
    if (!isAuthenticated || !user) return null; // Corrected: isAuthenticated

    switch (user.role) {
      case "seller":
        if (user.sellerProfile?.approvalStatus === "approved") { // Corrected: sellerProfile, approvalStatus
          return { label: "Seller Dashboard", path: "/seller-dashboard" };
        } else if (user.sellerProfile?.approvalStatus === "pending") { // Corrected: sellerProfile, approvalStatus
          return { label: "Seller Status", path: "/seller-status" };
        } else {
          return { label: "Seller Application", path: "/seller-apply" };
        }
      case "admin":
        return { label: "Admin Dashboard", path: "/admin" }; // Corrected: Admin Dashboard
      case "delivery":
        return { label: "Delivery Dashboard", path: "/delivery-page" };
      case "customer":
        return { label: "My Orders", path: "/customer/orders" };
      default:
        return null;
    }
  };

  const dashboardLink = getDashboardLink(); // Corrected: dashboardLink

  const getSellerButtonLabel = () => { // Corrected: getSellerButtonLabel
    if (user?.role === "seller") {
      const status = user.sellerProfile?.approvalStatus; // Corrected: sellerProfile, approvalStatus
      if (status === "pending") return "View Seller Status";
      if (status === "approved") return "Go to Seller Dashboard";
      return "Become a Seller";
    }
    return "Become a Seller";
  };
  
  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm"> {/* Corrected: className */}
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6"> {/* Corrected: className */}
        <Link to="/" className="flex items-center text-xl font-bold text-blue-600"> {/* Corrected: Link, className */}
          <Store className="mr-2 h-6 w-6" /> {/* Corrected: Store, className */}
          Shopnish
        </Link>

        {/* search form */}    
        <form onSubmit={handleSearch} className="hidden md:flex flex-grow max-w-md mx-4"> {/* Corrected: onSubmit, className */}    
          <Input // Corrected: Input
            type="search"
            placeholder="Search products..."
            className="w-full rounded-l-lg border-r-0 focus-visible:ring-offset-0 focus-visible:ring-0" // Corrected: className
            value={searchValue} // Corrected: searchValue
            onChange={(e) => setSearchValue(e.target.value)} // Corrected: onChange, setSearchValue
          />    
          <Button type="submit" variant="ghost" className="rounded-l-none rounded-r-lg border-l-0"> {/* Corrected: Button, className */}    
            <Search className="h-5 w-5" /> {/* Corrected: Search, className */}    
          </Button>    
        </form>    

        <nav className="hidden md:flex items-center space-x-4"> {/* Corrected: className */}    
          <Button // Corrected: Button
            onClick={handleSellerButtonClick} // Corrected: onClick, handleSellerButtonClick
            disabled={isLoadingAuth} // Corrected: isLoadingAuth
            variant="ghost"
            className="w-full justify-start text-blue-600 hover:bg-blue-50" // Corrected: className
          >
            <Store className="mr-2 h-4 w-4" /> {/* Corrected: Store, className */}
            {getSellerButtonLabel()} {/* Corrected: getSellerButtonLabel */}
          </Button>

          <Link to="/wishlist"> {/* Corrected: Link */}
            <Button variant="ghost" size="icon"> {/* Corrected: Button */}
              <Heart className="h-5 w-5" /> {/* Corrected: Heart, className */}
              <span className="sr-only">Wishlist</span> {/* Corrected: className */}
            </Button>
          </Link>

          {/* ✅ cart button */}    
          <Button // Corrected: Button
            variant="ghost"
            size="icon"
            className="relative" // Corrected: className
            onClick={onCartClick} // Corrected: onClick, onCartClick
          >
            <ShoppingCart className="h-5 w-5" /> {/* Corrected: ShoppingCart, className */}
            {totalItemsInCart > 0 && ( // Corrected: totalItemsInCart
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white"> {/* Corrected: className */}
                {totalItemsInCart} {/* Corrected: totalItemsInCart */}
              </span>
            )}
            <span className="sr-only">Shopping Cart</span> {/* Corrected: className */}
          </Button>

          <DropdownMenu> {/* Corrected: DropdownMenu */}
            <DropdownMenuTrigger asChild> {/* Corrected: DropdownMenuTrigger, asChild */}
              <Button variant="ghost" size="icon"> {/* Corrected: Button */}
                <> {/* Added Fragment to ensure single child for <Button> */}
                  <User className="h-5 w-5" /> {/* Corrected: User, className */}
                  <span className="sr-only">User menu</span> {/* Corrected: className */}
                </>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56"> {/* Corrected: DropdownMenuContent, className */}
              {isLoadingAuth ? ( // Corrected: isLoadingAuth
                <DropdownMenuLabel>Loading...</DropdownMenuLabel> // Corrected: DropdownMenuLabel
              ) : isAuthenticated ? ( // Corrected: isAuthenticated
                <>
                  <DropdownMenuLabel>{user?.name || user?.email?.split('@')[0] || "My Account"}</DropdownMenuLabel> {/* Corrected: DropdownMenuLabel */}
                  <DropdownMenuSeparator /> {/* Corrected: DropdownMenuSeparator */}
                  {dashboardLink && ( // Corrected: dashboardLink
                    <DropdownMenuItem asChild> {/* Corrected: DropdownMenuItem, asChild */}
                      <Link to={dashboardLink.path}> {/* Corrected: Link, dashboardLink */}
                        <LayoutDashboard className="mr-2 h-4 w-4" /> {/* Corrected: LayoutDashboard, className */}
                        {dashboardLink.label} {/* Corrected: dashboardLink */}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {user?.role === "customer" && (
                    <DropdownMenuItem asChild> {/* Corrected: DropdownMenuItem, asChild */}
                      <Link to="/customer/orders"> {/* Corrected: Link */}
                        <ListOrdered className="mr-2 h-4 w-4" /> {/* Corrected: ListOrdered, className */}
                        My Orders
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout}> {/* Corrected: DropdownMenuItem, onClick, handleLogout */}
                    <LogOut className="mr-2 h-4 w-4" /> {/* Corrected: LogOut, className */}
                    Logout
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild> {/* Corrected: DropdownMenuItem, asChild */}
                    <Link to="/auth"> {/* Corrected: Link */}
                      <LogIn className="mr-2 h-4 w-4" /> {/* Corrected: LogIn, className */}
                      Login / Sign Up
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* mobile menu */}    
        <div className="flex items-center md:hidden"> {/* Corrected: className */}
          {/* ✅ mobile cart button */}    
          <Button // Corrected: Button
            variant="ghost"
            size="icon"
            className="relative mr-2" // Corrected: className
            onClick={onCartClick} // Corrected: onClick, onCartClick
          >
            <ShoppingCart className="h-5 w-5" /> {/* Corrected: ShoppingCart, className */}
            {totalItemsInCart > 0 && ( // Corrected: totalItemsInCart
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white"> {/* Corrected: className */}
                {totalItemsInCart} {/* Corrected: totalItemsInCart */}
              </span>
            )}
            <span className="sr-only">Shopping Cart</span> {/* Corrected: className */}
          </Button>

          <Sheet> {/* Corrected: Sheet */}
            <SheetTrigger asChild> {/* Corrected: SheetTrigger, asChild */}
              <Button variant="ghost" size="icon"> {/* Corrected: Button */}
                <Menu className="h-5 w-5" /> {/* Corrected: Menu, className */}
                <span className="sr-only">Toggle menu</span> {/* Corrected: className */}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs p-4"> {/* Corrected: SheetContent, className */}
              <SheetHeader> {/* Corrected: SheetHeader */}
                <SheetTitle>Menu</SheetTitle> {/* Corrected: SheetTitle */}
              </SheetHeader>
              <div className="flex flex-col items-start space-y-4"> {/* Corrected: className */}
                <form onSubmit={handleSearch} className="w-full flex"> {/* Corrected: onSubmit, className */}
                  <Input // Corrected: Input
                    type="search"
                    placeholder="Search products..."
                    className="flex-grow rounded-r-none focus-visible:ring-offset-0 focus-visible:ring-0" // Corrected: className
                    value={searchValue} // Corrected: searchValue
                    onChange={(e) => setSearchValue(e.target.value)} // Corrected: onChange, setSearchValue
                  />
                  <Button type="submit" variant="ghost" className="rounded-l-none"> {/* Corrected: Button, className */}
                    <Search className="h-5 w-5" /> {/* Corrected: Search, className */}
                  </Button>
                </form>

                {isLoadingAuth ? ( // Corrected: isLoadingAuth
                  <p className="text-gray-700">Loading user...</p> // Corrected: className
                ) : isAuthenticated ? ( // Corrected: isAuthenticated
                  <>
                    <span className="font-semibold text-gray-900">Hello, {user?.name || user?.email?.split('@')[0] || "User"}</span> {/* Corrected: className, split fixed */}
                    {dashboardLink && ( // Corrected: dashboardLink
                      <Link to={dashboardLink.path} className="w-full"> {/* Corrected: Link, className */}
                        <Button variant="ghost" className="w-full justify-start"> {/* Corrected: Button, className */}
                          <LayoutDashboard className="mr-2 h-4 w-4" /> {/* Corrected: LayoutDashboard, className */}
                          {dashboardLink.label} {/* Corrected: dashboardLink */}
                        </Button>
                      </Link>
                    )}
                    {user?.role === "customer" && (
                      <Link to="/customer/orders" className="w-full"> {/* Corrected: Link, className */}
                        <Button variant="ghost" className="w-full justify-start"> {/* Corrected: Button, className */}
                          <ListOrdered className="mr-2 h-4 w-4" /> {/* Corrected: ListOrdered, className */}
                          My Orders
                        </Button>
                      </Link>
                    )}
                    <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-red-500 hover:bg-red-50"> {/* Corrected: Button, onClick, handleLogout, className */}
                      <LogOut className="mr-2 h-4 w-4" /> {/* Corrected: LogOut, className */}
                      Logout
                    </Button>
                  </>
                ) : (
                  <Link to="/auth" className="w-full"> {/* Corrected: Link, className */}
                    <Button variant="ghost" className="w-full justify-start"> {/* Corrected: Button, className */}
                      <LogIn className="mr-2 h-4 w-4" /> {/* Corrected: LogIn, className */}
                      Login / Sign Up
                    </Button>
                  </Link>
                )}

                <Link to="/wishlist" className="w-full"> {/* Corrected: Link, className */}
                  <Button variant="ghost" className="w-full justify-start"> {/* Corrected: Button, className */}
                    <Heart className="mr-2 h-4 w-4" /> {/* Corrected: Heart, className */}
                    Wishlist
                  </Button>
                </Link>

                <Button // Corrected: Button
                  onClick={handleSellerButtonClick} // Corrected: onClick, handleSellerButtonClick
                  disabled={isLoadingAuth} // Corrected: isLoadingAuth
                  variant="ghost"
                  className="w-full justify-start text-blue-600 hover:bg-blue-50" // Corrected: className
                >
                  <Store className="mr-2 h-4 w-4" /> {/* Corrected: Store, className */}
                  {getSellerButtonLabel()} {/* Corrected: getSellerButtonLabel */}
                </Button>

                <div className="w-full border-t pt-4"> {/* Corrected: className */}
                  <p className="font-semibold mb-2">Categories</p> {/* Corrected: className */}
                  {/* categories prop को headerprops से हटाया गया है। यदि यह डेटा header में चाहिए,    
                      तो इसे usequery के माध्यम से fetch करना बेहतर होगा।    
                  */}    
                  {/* यदि categories को header में दिखाना है, तो उन्हें यहां fetching या props के माध्यम से जोड़ना होगा */}
                   <p className="text-sm text-gray-500">No categories available (for mobile nav).</p>    
                </div>    
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
    

    {isAuthenticated && ( // Corrected: isAuthenticated
      <SellerOnboardingDialog // Corrected: SellerOnboardingDialog
        isOpen={isSellerDialogOpen} // Corrected: isOpen, isSellerDialogOpen
        onClose={() => setIsSellerDialogOpen(false)} // Corrected: onClose, setIsSellerDialogOpen
      />
    )}
    </header>
  );
};

export default Header; // Corrected: Header
                
