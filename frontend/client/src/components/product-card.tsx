// frontend/components/product-card.tsx
import { usemutation, usequeryclient } from "tanstack/react-query";
import { toast } from "/hooks/use-toast";
import { button } from "/components/ui/button";
import { apirequest } from "/lib/queryclient";
import react, { usestate } from "react";
import { useauth } from "/hooks/useauth";
import {
  dialog,
  dialogcontent,
  dialogdescription,
  dialogheader,
  dialogtitle,
} from "/components/ui/dialog";
import { usenavigate } from "react-router-dom";

interface product {
  id: number;
  name: string;
  price: string;
  image: string;
  stock: number;
  sellerid: number;
  seller: {
    id: number;
    businessname: string;
  };
}

interface productcardprops {
  product: product;
}

const productcard: react.fc<productcardprops> = ({ product }) => {
  const queryclient = usequeryclient();
  const { user } = useauth();
  const navigate = usenavigate();
  const [isloginpopupopen, setisloginpopupopen] = usestate(false);

  const addtocartmutation = usemutation({
    mutationfn: async ({ productid, quantity }: { productid: number; quantity: number }) => {
      return await apirequest("post", "/api/cart/add", { productid, quantity });
    },
    onsuccess: () => {
      queryclient.invalidatequeries({ querykey: ["/api/cart"] });
      toast({
        title: "added to cart",
        description: `${product.name} has been added to your cart.`,
      });
    },
    onerror: (error: any) => {
      toast({
        title: "failed to add to cart",
        description: error.message || "an error occurred while adding the item to your cart.",
        variant: "destructive",
      });
    },
  });

  const handleaddtocart = () => {
    if (!user) {
      setisloginpopupopen(true);
      return;
    }

    if (product.stock === 0) {
      toast({
        title: "out of stock",
        description: "this product is currently unavailable.",
        variant: "destructive",
      });
      return;
    }

    addtocartmutation.mutate({ productid: product.id, quantity: 1 });
  };

  const handlebuynow = () => {
    if (!user) {
      setisloginpopupopen(true);
      return;
    }

    if (product.stock === 0) {
      toast({
        title: "out of stock",
        description: "this product is currently unavailable.",
        variant: "destructive",
      });
      return;
    }

    console.log("➡️ buy now clicked for product id:", product.id);
    navigate(`/checkout2/${product.id}?quantity=1`);
  };

  // Debugging: Log the image URL to console
  console.log(`product id: ${product.id}, name: ${product.name}, image url: ${product.image}`);
  
  return (
    <div classname="p-4 border rounded-lg">
      <img
        src={product.image}
        alt={product.name}
        classname="h-40 w-full object-cover rounded-lg mb-4"
        onError={(e) => { // Added onError handler for debugging purposes
          e.currentTarget.onerror = null; // Prevents infinite loop
          e.currentTarget.src = 'https://via.placeholder.com/150?text=Image+Not+Found'; // Fallback image
          console.error(`ERROR: Failed to load image for product ID: ${product.id}, URL: ${product.image}`);
          console.error("Image element HTML:", e.currentTarget.outerHTML);
        }}
      />
      <h3 classname="text-lg font-semibold truncate">{product.name}</h3>
      <p classname="text-gray-600 mb-2">by: {product.seller ? product.seller.businessname : 'n/a'}</p>
      <p classname="text-gray-600 mb-2">₹{product.price}</p>
      <div classname="flex flex-col gap-2">
        <button
          onclick={handleaddtocart}
          disabled={addtocartmutation.ispending || product.stock === 0}
          classname="w-full"
        >
          {addtocartmutation.ispending ? "adding..." : "add to cart"}
        </button>
        <button
          onclick={handlebuynow}
          disabled={product.stock === 0}
          classname="w-full"
        >
          buy now
        </button>
      </div>

      <dialog open={isloginpopupopen} onopenchange={setisloginpopupopen}>
        <dialogcontent>
          <dialogheader>
            <dialogtitle>login required</dialogtitle>
            <dialogdescription>
              please log in to add items to your cart or buy now.
            </dialogdescription>
          </dialogheader>
          <div classname="flex justify-end gap-2">
            <button variant="outline" onclick={() => setisloginpopupopen(false)}>cancel</button>
            <button onclick={() => {
              setisloginpopupopen(false);
              navigate("/login");
            }}>login</button>
          </div>
        </dialogcontent>
      </dialog>
    </div>
  );
};

export default productcard;
