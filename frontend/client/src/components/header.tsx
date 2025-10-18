// client/src/components/header.tsx

import react, { usestate } from "react";
import { link, usenavigate } from "react-router-dom";
import { useauth } from "/hooks/useauth";
import { usequery } from "tanstack/react-query";
import { apirequest } from "/lib/queryclient";

// ui कॉम्पोनेंट्स इम्पोर्ट करें
import { button } from "/components/ui/button";
import { input } from "/components/ui/input";
import {
  dropdownmenu,
  dropdownmenucontent,
  dropdownmenuitem,
  dropdownmenulabel,
  dropdownmenuseparator,
  dropdownmenutrigger,
} from "/components/ui/dropdown-menu";
import { sheet, sheetcontent, sheettrigger, sheetheader, sheettitle } from "/components/ui/sheet";
import {
  shoppingcart,
  menu,
  search,
  user,
  heart,
  store,
  logout,
  login,
  layoutdashboard,
  listordered,
} from "lucide-react";
import selleronboardingdialog from "./seller/selleronboardingdialog";
import { logout as firebaseLogout } from "/lib/firebase"; // ✅ Lucide icon से टकराव से बचने के लिए नाम बदला

import LocationDisplay from "./LocationDisplay"; // ✅ LocationDisplay को इम्पोर्ट किया

interface category {
  id: string;
  name: string;
  slug: string;
}

interface cartitem {
  id: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    price: string;
    image: string;
  };
}

interface cartresponse {
  message: string;
  items: cartitem[];
}

interface headerprops {
  categories: category[];
  // ✅ oncartclick प्रॉप्स को जोड़ें
  oncartclick: () => void;
}

const header: react.fc<headerprops> = ({ categories = [], oncartclick }) => {
  const [searchvalue, setsearchvalue] = usestate("");
  const navigate = usenavigate();
  const { user, isauthenticated, isloadingauth } = useauth();
  const [issellerdialogopen, setissellerdialogopen] = usestate(false);

  const { data: cartdata } = usequery<cartresponse>({
    querykey: ["/api/cart"],
    queryfn: () => apirequest("get", "/api/cart"),
    enabled: isauthenticated,
  });

  const totalitemsincart = cartdata?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  const handlesearch = (e: react.formevent) => {
    e.preventdefault();
    if (searchvalue.trim()) {
      navigate(`/search?q=${encodeuricomponent(searchvalue.trim())}`);
      setsearchvalue("");
    }
  };

  const handlelogout = async () => {
    try {
      await firebaseLogout(); // ✅ अलीस किए गए लॉगआउट का उपयोग करें
      console.log("header: user logged out successfully.");
      navigate("/");
      localstorage.removeitem('redirectintent');
    } catch (error) {
      console.error("header: error during logout:", error);
    }
  };



  const handlesellerbuttonclick = () => {
    console.log("seller button clicked! isauthenticated:", isauthenticated, "user:", user);

    if (isloadingauth) {
      return;
    }

    if (!isauthenticated) {
      localstorage.setitem('redirectintent', 'become-seller');
      navigate("/auth");
      return;
    }

    // ✅ लॉजिक को ठीक किया गया
    if (user?.role === "seller") {
      const approvalstatus = user.sellerprofile?.approvalstatus;
      if (approvalstatus === "approved") {
        navigate("/seller-dashboard");
      } else { // यह 'pending' या 'null' स्थिति को संभालता है
        navigate("/seller-status");
      }
    } else { // यह तब चलता है जब उपयोगकर्ता 'customer' या अन्य भूमिका में हो
      setissellerdialogopen(true);
    }
  };


  const getdashboardlink = () => {
    if (!isauthenticated || !user) return null;

    switch (user.role) {
      case "seller":
        if (user.sellerprofile?.approvalstatus === "approved") {
          return { label: "seller dashboard", path: "/seller-dashboard" };
        } else if (user.sellerprofile?.approvalstatus === "pending") {
          return { label: "seller status", path: "/seller-status" };
        } else {
          return { label: "seller application", path: "/seller-apply" };
        }
      case "admin":
        return { label: "admin login", path: "/admin-login" };
      case "delivery":
        return { label: "delivery dashboard", path: "/delivery-page" };
      case "customer":
        return { label: "my orders", path: "/customer/orders" };
      default:
        return null;
    }
  };

  const dashboardlink = getdashboardlink();

  const getsellerbuttonlabel = () => {
    if (user?.role === "seller") {
      const status = user.sellerprofile?.approvalstatus;
      if (status === "pending") return "view seller status";
      if (status === "approved") return "go to seller dashboard";
      return "become a seller";
    }
    return "become a seller";
  };
  
  return (
    <header classname="sticky top-0 z-50 bg-white shadow-sm">
      <div classname="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <link to="/" classname="flex items-center text-xl font-bold text-blue-600">
          <store classname="mr-2 h-6 w-6" />
          shopnish
        </link>

        <form onsubmit={handlesearch} classname="hidden md:flex flex-grow max-w-md mx-4">
          <input
            type="search"
            placeholder="search products..."
            classname="w-full rounded-l-lg border-r-0 focus-visible:ring-offset-0 focus-visible:ring-0"
            value={searchvalue}
            onchange={(e) => setsearchvalue(e.target.value)}
          />
          <button type="submit" variant="ghost" classname="rounded-l-none rounded-r-lg border-l-0">
            <search classname="h-5 w-5" />
          </button>
        </form>

        <nav classname="hidden md:flex items-center space-x-4">
          <button
            onclick={handlesellerbuttonclick}
            disabled={isloadingauth}
            variant="ghost"
            classname="w-full justify-start text-blue-600 hover:bg-blue-50"
          >
            <store classname="mr-2 h-4 w-4" />
            {getsellerbuttonlabel()}
          </button>

          <link to="/wishlist">
            <button variant="ghost" size="icon">
              <heart classname="h-5 w-5" />
              <span classname="sr-only">wishlist</span>
            </button>
          </link>

          {/* ✅ कार्ट बटन को अपडेट करें */}
          <button
            variant="ghost"
            size="icon"
            classname="relative"
            onclick={oncartclick} // ✅ यहाँ पर onclick हैंडलर जोड़ें
          >
            <shoppingcart classname="h-5 w-5" />
            {totalitemsincart > 0 && (
              <span classname="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {totalitemsincart}
              </span>
            )}
            <span classname="sr-only">shopping cart</span>
          </button>

          <dropdownmenu>
            <dropdownmenutrigger aschild>
              <button variant="ghost" size="icon">
                <user classname="h-5 w-5" />
                <span classname="sr-only">user menu</span>
              </button>
            </dropdownmenutrigger>
            <dropdownmenucontent align="end" classname="w-56">
              {isloadingauth ? (
                <dropdownmenulabel>loading...</dropdownmenulabel>
              ) : isauthenticated ? (
                <>
                  <dropdownmenulabel>{user?.name || user?.email || "my account"}</dropdownmenulabel>
                  <dropdownmenuseparator />
                  {dashboardlink && (
                    <dropdownmenuitem aschild>
                      <link to={dashboardlink.path}>
                        <layoutdashboard classname="mr-2 h-4 w-4" />
                        {dashboardlink.label}
                      </link>
                    </dropdownmenuitem>
                  )}
                  {user?.role === "customer" && (
                    <dropdownmenuitem aschild>
                      <link to="/customer/orders">
                        <listordered classname="mr-2 h-4 w-4" />
                        my orders
                      </link>
                    </dropdownmenuitem>
                  )}
                  <dropdownmenuitem onclick={handlelogout}>
                    <logout classname="mr-2 h-4 w-4" />
                    logout
                  </dropdownmenuitem>
                </>
              ) : (
                <>
                  <dropdownmenuitem aschild>
                    <link to="/auth">
                      <login classname="mr-2 h-4 w-4" />
                      login / sign up
                    </link>
                  </dropdownmenuitem>
                </>
              )}
            </dropdownmenucontent>
          </dropdownmenu>
        </nav>

        {/* मोबाइल मेनू */}
        <div classname="flex items-center md:hidden">
          {/* ✅ मोबाइल कार्ट बटन को अपडेट करें */}
          <button
            variant="ghost"
            size="icon"
            classname="relative mr-2"
            onclick={oncartclick} // ✅ यहाँ पर onclick हैंडलर जोड़ें
          >
            <shoppingcart classname="h-5 w-5" />
            {totalitemsincart > 0 && (
              <span classname="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {totalitemsincart}
              </span>
            )}
            <span classname="sr-only">shopping cart</span>
          </button>

          <sheet>
            <sheettrigger aschild>
              <button variant="ghost" size="icon">
                <menu classname="h-5 w-5" />
                <span classname="sr-only">toggle menu</span>
              </button>
            </sheettrigger>
            <sheetcontent side="right" classname="w-full max-w-xs p-4">
              <sheetheader>
                <sheettitle>menu</sheettitle>
              </sheetheader>
              <div classname="flex flex-col items-start space-y-4">
                <form onsubmit={handlesearch} classname="w-full flex">
                  <input
                    type="search"
                    placeholder="search products..."
                    classname="flex-grow rounded-r-none focus-visible:ring-offset-0 focus-visible:ring-0"
                    value={searchvalue}
                    onchange={(e) => setsearchvalue(e.target.value)}
                  />
                  <button type="submit" variant="ghost" classname="rounded-l-none">
                    <search classname="h-5 w-5" />
                  </button>
                </form>

                {isloadingauth ? (
                  <p classname="text-gray-700">loading user...</p>
                ) : isauthenticated ? (
                  <>
                    <span classname="font-semibold text-gray-900">hello, {user?.name || user?.email?.split('')[0] || "user"}</span>
                    {dashboardlink && (
                      <link to={dashboardlink.path} classname="w-full">
                        <button variant="ghost" classname="w-full justify-start">
                          <layoutdashboard classname="mr-2 h-4 w-4" />
                          {dashboardlink.label}
                        </button>
                      </link>
                    )}
                    {user?.role === "customer" && (
                      <link to="/customer/orders" classname="w-full">
                        <button variant="ghost" classname="w-full justify-start">
                          <listordered classname="mr-2 h-4 w-4" />
                          my orders
                        </button>
                      </link>
                    )}
                    <button onclick={handlelogout} variant="ghost" classname="w-full justify-start text-red-500 hover:bg-red-50">
                      <logout classname="mr-2 h-4 w-4" />
                      logout
                    </button>
                  </>
                ) : (
                  <link to="/auth" classname="w-full">
                    <button variant="ghost" classname="w-full justify-start">
                      <login classname="mr-2 h-4 w-4" />
                      login / sign up
                    </button>
                  </link>
                )}

                <link to="/wishlist" classname="w-full">
                  <button variant="ghost" classname="w-full justify-start">
                    <heart classname="mr-2 h-4 w-4" />
                    wishlist
                  </button>
                </link>

                <button
                  onclick={handlesellerbuttonclick}
                  disabled={isloadingauth}
                  variant="ghost"
                  classname="w-full justify-start text-blue-600 hover:bg-blue-50"
                >
                  <store classname="mr-2 h-4 w-4" />
                  {getsellerbuttonlabel()}
                </button>

                <div classname="w-full border-t pt-4">
                  <p classname="font-semibold mb-2">categories</p>
                  {categories.length > 0 ? (
                    <ul classname="space-y-2">
                      {categories.map((category) => (
                        <li key={category.id}>
                          <link to={`/category/${category.slug}`}>
                            <button variant="ghost" classname="w-full justify-start">
                              {category.name}
                            </button>
                          </link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p classname="text-sm text-gray-500">no categories available.</p>
                  )}
                </div>
              </div>
            </sheetcontent>
          </sheet>
        </div>
      </div>
      
      {/* ✅ यहां पर LocationDisplay कंपोनेंट को जोड़ें */}
      <div classname="bg-gray-100 py-2 border-t border-b">
        <div classname="container mx-auto px-4 md:px-6">
          <LocationDisplay /> {/* ✅ LocationDisplay कंपोनेंट */}
        </div>
      </div>

      {isauthenticated && (
        <selleronboardingdialog
          isopen={issellerdialogopen}
          onclose={() => setissellerdialogopen(false)}
        />
      )}
    </header>
  );
};

export default header;
