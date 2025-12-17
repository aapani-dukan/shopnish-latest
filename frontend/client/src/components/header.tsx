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
import LocationDisplay from "./LocationDisplay"; // ✅ Corrected casing

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

const Header: React.FC<HeaderProps> = ({ categories = [], onCartClick }) => { // ✅ Corrected casing, default categories
  const [searchValue, setSearchValue] = useState(""); // ✅ Corrected casing
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth } = useAuth(); // ✅ Corrected casing
  const [isSellerDialogOpen, setIsSellerDialogOpen] = useState(false); // ✅ Corrected casing

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

  const handleLogout = async () => { // ✅ Corrected casing
    try {
      await logout();
      console.log("Header: User logged out successfully.");
      navigate("/");
      localStorage.removeItem('redirectIntent'); // ✅ Added removeItem
    } catch (error) {
      console.error("Header: Error during logout:", error);
    }
  };

  const handleSellerButtonClick = () => { // ✅ Corrected casing
    console.log("Seller button clicked! isAuthenticated:", isAuthenticated, "user:", user);

    if (isLoadingAuth) {
      return;
    }

    if (!isAuthenticated) {
      localStorage.setItem('redirectIntent', 'become-seller');
      navigate("/auth");
      return;
    }

    // ✅ लॉजिक को ठीक किया गया
    if (user?.role === "seller") {
      const approvalStatus = user.sellerProfile?.approvalStatus; // ✅ Corrected casing
      if (approvalStatus === "approved") {
        navigate("/seller-dashboard");
      } else { // यह 'pending' या 'null' स्थिति को संभालता है
        navigate("/seller-status");
      }
    } else { // यह तब चलता है जब उपयोगकर्ता 'customer' या अन्य भूमिका में हो
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
      case "delivery":
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
              <Button variant="ghost" size="icon">
                <span> {/* Fix: Wrap children in a single element */}
                  <User className="h-5 w-5" />
                  <span className="sr-only">User menu</span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isLoadingAuth ? (
                <DropdownMenuLabel>Loading...</DropdownMenuLabel>
              ) : isAuthenticated ? (
                <>
                  <DropdownMenuLabel>{user?.name || user?.email?.split('@')[0] || "My Account"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {dashboardLink && (
                    <DropdownMenuItem asChild>
                      <Link to={dashboardLink.path}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        {dashboardLink.label}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {user?.role === "customer" && (
                    <DropdownMenuItem asChild>
                      <Link to="/customer/orders">
                        <ListOrdered className="mr-2 h-4 w-4" />
                        My Orders
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/auth">
                      <LogIn className="mr-2 h-4 w-4" />
                      Login / Sign Up
                    </Link>
                  </DropdownMenuItem>
                </>
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
                <span> {/* Fix: Wrap children in a single element */}
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs p-4">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col items-start space-y-4">
                <form onSubmit={handleSearch} className="w-full flex">
                  <Input
                    type="search"
                    placeholder="Search products..."
                    className="flex-grow rounded-r-none focus-visible:ring-offset-0 focus-visible:ring-0"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                  />
                  <Button type="submit" variant="ghost" className="rounded-l-none">
                    <Search className="h-5 w-5" />
                  </Button>
                </form>

                {isLoadingAuth ? (
                  <p className="text-gray-700">Loading user...</p>
                ) : isAuthenticated ? (
                  <>
                    <span className="font-semibold text-gray-900">Hello, {user?.name || user?.email?.split('@')[0] || "User"}</span>
                    {dashboardLink && (
                      <Link to={dashboardLink.path} className="w-full">
                        <Button variant="ghost" className="w-full justify-start">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          {dashboardLink.label}
                        </Button>
                      </Link>
                    )}
                    {user?.role === "customer" && (
                      <Link to="/customer/orders" className="w-full">
                        <Button variant="ghost" className="w-full justify-start">
                          <ListOrdered className="mr-2 h-4 w-4" />
                          My Orders
                        </Button>
                      </Link>
                    )}
                    <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-red-500 hover:bg-red-50">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <Link to="/auth" className="w-full">
                    <Button variant="ghost" className="w-full justify-start">
                      <LogIn className="mr-2 h-4 w-4" />
                      Login / Sign Up
                    </Button>
                  </Link>
                )}

                <Link to="/wishlist" className="w-full">
                  <Button variant="ghost" className="w-full justify-start">
                    <Heart className="mr-2 h-4 w-4" />
                    Wishlist
                  </Button>
                </Link>

                <Button
                  onClick={handleSellerButtonClick}
                  disabled={isLoadingAuth}
                  variant="ghost"
                  className="w-full justify-start text-blue-600 hover:bg-blue-50"
                >
                  <Store className="mr-2 h-4 w-4" />
                  {getSellerButtonLabel()}
                </Button>

                <div className="w-full border-t pt-4">
                  <p className="font-semibold mb-2">Categories</p>
                  {categories.length > 0 ? (
                    <ul className="space-y-2">
                      {categories.map((category) => (
                        <li key={category.id}>
                          <Link to={`/category/${category.slug}`}>
                            <Button variant="ghost" className="w-full justify-start">
                              {category.name}
                            </Button>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No categories available.</p>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      {/*   <div className="bg-gray-100 py-2 border-t border-b">
        <div className="container mx-auto px-4 md:px-6">
          <LocationDisplay />
        </div>
      </div> */}
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

                                       
