import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

interface Product {
  id: number;
  name: string;
  price: string;
  image: string;
  stock: number;
  sellerId: number; // ✅ add sellerId for buy-now
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
      return await apiRequest("POST", "/api/cart/add", { productId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "Added to cart",
        description: `${product.name} has been added to your cart.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add to cart",
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

  // ✅ Cleaned up single Buy Now function
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

    console.log("➡️ Buy Now clicked for Product ID:", product.id);
    navigate(`/checkout2/${product.id}?quantity=1`);
  };

  return (
    <div className="p-4 border rounded-lg">
      <img src={product.image} alt={product.name} className="h-40 w-full object-cover rounded-lg mb-4" />
      <h3 className="text-lg font-semibold truncate">{product.name}</h3>
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
