// frontend/components/product-card.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query"; // ✅ Corrected casing
import { toast } from "@/hooks/use-toast"; // Assuming correct path based on common Next.js/React setup
import { Button } from "@/components/ui/button"; // ✅ Corrected casing and path
import { apiRequest } from "@/lib/queryClient"; // ✅ Corrected casing and path
import React, { useState } from "react"; // ✅ Corrected casing
import { useAuth } from "@/hooks/useauth"; // Assuming correct path and casing
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // ✅ Corrected casing
import { useNavigate } from "react-router-dom"; // ✅ Corrected casing

// ✅ Updated Product Interface to include seller information
interface Product {
  id: number;
  name: string;
  price: string;
  image: string;
  stock: number;
  sellerId: number; // For buy-now logic or other seller-specific actions
  // ✅ Added seller object as expected from backend
  seller: {
    id: number;
    businessName: string;
  };
}

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const queryClient = useQueryClient(); // ✅ Corrected casing
  const { user } = useAuth(); // ✅ Corrected casing
  const navigate = useNavigate(); // ✅ Corrected casing
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false); // ✅ Corrected casing

  const addToCartMutation = useMutation({ // ✅ Corrected casing
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => {
      return await apiRequest("post", "/api/cart/add", { productId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Added to Cart", // ✅ Consistent casing for toast title
        description: `${product.name} has been added to your cart.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add to Cart", // ✅ Consistent casing for toast title
        description: error.message || "An error occurred while adding the item to your cart.",
        variant: "destructive",
      });
    },
  });

  const handleAddToCart = () => { // ✅ Corrected casing
    if (!user) {
      setIsLoginPopupOpen(true);
      return;
    }

    if (product.stock === 0) {
      toast({
        title: "Out of Stock", // ✅ Consistent casing
        description: "This product is currently unavailable.",
        variant: "destructive",
      });
      return;
    }

    addToCartMutation.mutate({ productId: product.id, quantity: 1 });
  };

  const handleBuyNow = () => { // ✅ Corrected casing
    if (!user) {
      setIsLoginPopupOpen(true);
      return;
    }

    if (product.stock === 0) {
      toast({
        title: "Out of Stock", // ✅ Consistent casing
        description: "This product is currently unavailable.",
        variant: "destructive",
      });
      return;
    }

    console.log("➡️ Buy Now clicked for product ID:", product.id);
    // For "Buy Now", we are redirecting to a checkout page directly for a single product.
    // The checkout page will need to handle how to create an order for this single item.
    // Make sure your checkout page (checkout2 in this case) is ready to receive product ID and quantity directly.
    navigate(`/checkout2/${product.id}?quantity=1`);
  };

  return (
    <div className="p-4 border rounded-lg"> {/* ✅ Corrected className */}
      <img src={product.image} alt={product.name} className="h-40 w-full object-cover rounded-lg mb-4" /> {/* ✅ Corrected className */}
      <h3 className="text-lg font-semibold truncate">{product.name}</h3> {/* ✅ Corrected className */}
      <p className="text-gray-600 mb-2">By: {product.seller ? product.seller.businessName : 'N/A'}</p> {/* ✅ New: Display Seller Name */}
      <p className="text-gray-600 mb-2">₹{product.price}</p> {/* ✅ Corrected className */}
      <div className="flex flex-col gap-2"> {/* ✅ Corrected className */}
        <Button // ✅ Corrected component name
          onClick={handleAddToCart} // ✅ Corrected casing
          disabled={addToCartMutation.isPending || product.stock === 0} // ✅ Corrected casing
          className="w-full" // ✅ Corrected className
        >
          {addToCartMutation.isPending ? "Adding..." : "Add to Cart"}
        </Button>
        <Button // ✅ Corrected component name
          onClick={handleBuyNow} // ✅ Corrected casing
          disabled={product.stock === 0}
          className="w-full" // ✅ Corrected className
        >
          Buy Now
        </Button>
      </div>

      <Dialog open={isLoginPopupOpen} onOpenChange={setIsLoginPopupOpen}> {/* ✅ Corrected casing */}
        <DialogContent> {/* ✅ Corrected casing */}
          <DialogHeader> {/* ✅ Corrected casing */}
            <DialogTitle>Login Required</DialogTitle> {/* ✅ Corrected casing */}
            <DialogDescription> {/* ✅ Corrected casing */}
              Please log in to add items to your cart or buy now.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2"> {/* ✅ Corrected className */}
            <Button variant="outline" onClick={() => setIsLoginPopupOpen(false)}>Cancel</Button> {/* ✅ Corrected casing */}
            <Button onClick={() => { // ✅ Corrected casing
              setIsLoginPopupOpen(false);
              navigate("/login");
            }}>Login</Button> {/* ✅ Corrected casing */}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductCard; // ✅ Corrected casing
