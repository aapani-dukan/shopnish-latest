// frontend/components/product-card.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query"; // ✅ Corrected casing
import { toast } from "@/hooks/use-toast"; // Assuming correct path based on common Next.js/React setup
import { Button } from "@/components/ui/button"; // ✅ Corrected casing and path
import { apiRequest } from "@/lib/queryClient"; // ✅ Corrected casing and path
import React, { useState } from "react"; // ✅ Corrected casing
import { useAuth } from "@/hooks/useAuth"; // Assuming correct path and casing
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // ✅ Corrected casing
import { useNavigate } from "react-router-dom"; // ✅ Corrected casing

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  stock: number;
  sellerid: number;
  seller: {
    id: number;
    businessname: string;
  };
}

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);

  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => {
      return await apiRequest("post", "/api/cart/add", { productId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Added to Cart",
        description: `${product.name} has been added to your cart.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add to Cart",
        description: error.message || "An error occurred while adding the item to your cart.",
        variant: "destructive",
      });
    },
  });

  const handleAddToCart = () => {
    if (!user) {
      setIsLoginPopupOpen(true);
      return;
    }

    if (product.stock === 0) {
      toast({
        title: "Out of Stock",
        description: "This product is currently unavailable.",
        variant: "destructive",
      });
      return;
    }

    addToCartMutation.mutate({ productId: product.id, quantity: 1 });
  };

  const handleBuyNow = () => {
    if (!user) {
      setIsLoginPopupOpen(true);
      return;
    }

    if (product.stock === 0) {
      toast({
        title: "Out of Stock",
        description: "This product is currently unavailable.",
        variant: "destructive",
      });
      return;
    }

    console.log("➡️ Buy now clicked for product ID:", product.id);
    navigate(`/checkout2/${product.id}?quantity=1`);
  };

  console.log(`Product ID: ${product.id}, Name: ${product.name}, Image URL: ${product.image}`);
  
  return (
    <div className="p-4 border rounded-lg">
      <img
        src={product.image}
        alt={product.name}
        className="h-40 w-full object-cover rounded-lg mb-4"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = 'https://via.placeholder.com/150?text=Image+Not+Found';
          console.error(`ERROR: Failed to load image for product ID: ${product.id}, URL: ${product.image}`);
          console.error("Image element HTML:", e.currentTarget.outerHTML);
        }}
      />
      <h3 className="text-lg font-semibold truncate">{product.name}</h3>
      <p className="text-gray-600 mb-2">by: {product.seller ? product.seller.businessname : 'n/a'}</p>
      <p className="text-gray-600 mb-2">₹{product.price}</p>
      <div className="flex flex-col gap-2">
        <Button
          onClick={handleAddToCart}
          disabled={addToCartMutation.isPending || product.stock === 0}
          className="w-full"
        >
          {addToCartMutation.isPending ? "Adding..." : "Add to Cart"}
        </Button>
        <Button
          onClick={handleBuyNow}
          disabled={product.stock === 0}
          className="w-full"
        >
          Buy Now
        </Button>
      </div>

      <Dialog open={isLoginPopupOpen} onOpenChange={setIsLoginPopupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login Required</DialogTitle>
            <DialogDescription>
              Please log in to add items to your cart or buy now.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsLoginPopupOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              setIsLoginPopupOpen(false);
              navigate("/login");
            }}>Login</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductCard;
