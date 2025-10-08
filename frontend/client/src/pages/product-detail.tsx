import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom"; 
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, ShoppingCart, Heart, Share2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/header";
import Footer from "@/components/footer";
import api from "../lib/api.ts";
import { auth } from "../lib/firebase.ts";

interface Product {
  id: number;
  name: string;
  description: string | null;
  price: string;
  originalPrice: string | null;
  image: string;
  images: string[] | null;
  brand: string | null;
  stock: number;
  rating: string | null;
  reviewCount: number | null;
  categoryName: string | null;
}

interface Review {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: {
    firstName: string | null;
    lastName: string | null;
  };
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Categories data fetching
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Product data fetching
  const { data: product, isLoading: productLoading, error } = useQuery<Product>({
    queryKey: ['/api/products', id],
    queryFn: async () => {
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) throw new Error('Product not found');
      return response.json();
    },
    enabled: !!id, 
  });

  // Product reviews fetching
  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ['/api/products', id, 'reviews'],
    queryFn: async () => {
      const response = await fetch(`/api/products/${id}/reviews`);
      if (!response.ok) throw new Error('Failed to fetch reviews');
      return response.json();
    },
    enabled: !!id,
  });
  
  // ✅ Add to Cart Mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => {
      return await apiRequest("POST", "/api/cart/add", { productId, quantity });
    },
    onSuccess: (data) => {
      console.log("✅ Cart API Response (onSuccess):", data);
      
      // ✅ Cart query को invalidate करें ताकि cart page पर data refresh हो
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });

      // ✅ Success toast message दिखाएँ
      toast({
        title: "Added to cart",
        description: `${quantity} × ${product?.name} added to your cart.`,
      });
    },
    onError: (error) => {
      console.error("❌ Error adding to cart:", error);
      toast({
        title: "Failed to add to cart",
        description: "An error occurred while adding the item to your cart.",
        variant: "destructive",
      });
    },
  });

  const handleAddToCart = () => {
    console.log("Adding item to cart..."); 
    
    if (!product || typeof id === 'undefined') {
      console.error("Product data or ID is missing. Cannot add to cart.");
      toast({
          title: "Error",
          description: "Product data is not available. Please try again.",
          variant: "destructive",
      });
      return;
    }
  
    addToCartMutation.mutate({
      productId: product.id,
      quantity,
    });
  };

  // ✅ New function for "Buy Now" button
  const handleBuyNow = () => {
  if (!product || !product.id) {
    console.error("Product data is missing. Cannot proceed with purchase.");
    toast({
      title: "Error",
      description: "Product data is not available. Please try again.",
      variant: "destructive",
    });
    return;
  }

  // ✅ Navigate with product.id instead of param id
  console.log("➡️ Navigating with Product ID:", product.id, "and Quantity:", quantity);
  navigate(`/checkout2/${product.id}?quantity=${quantity}`);
};
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < rating ? "text-yellow-400 fill-current" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  if (productLoading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Header categories={categories} />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="h-96 w-full" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Header categories={categories} />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Product Not Found</h2>
              <p className="text-gray-600 mb-4">The product you're looking for doesn't exist.</p>
              <Button onClick={() => window.history.back()}>Go Back</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const images = product.images || [product.image];

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header categories={categories} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="relative">
              <img
                src={images[selectedImage]}
                alt={product.name}
                className="w-full h-96 object-cover rounded-lg"
              />
              {product.originalPrice && (
                <Badge className="absolute top-4 left-4 bg-red-500 text-white">
                  Sale
                </Badge>
              )}
            </div>
            
            {images.length > 1 && (
              <div className="flex space-x-2 overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                      selectedImage === index ? 'border-primary' : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {product.name}
              </h1>
              {product.categoryName && (
                <p className="text-sm text-gray-500">Category: <span className="font-medium">{product.categoryName}</span></p>
              )}
              {product.brand && (
                <p className="text-gray-600">by {product.brand}</p>
              )}
            </div>

            {/* Rating */}
            <div className="flex items-center space-x-4">
              {renderStars(Math.round(averageRating))}
              <span className="text-gray-600">
                ({reviews.length} reviews)
              </span>
            </div>

            {/* Price */}
            <div className="flex items-center space-x-4">
              <span className="text-3xl font-bold text-primary">
                ${product.price}
              </span>
              {product.originalPrice && (
                <span className="text-xl text-gray-400 line-through">
                  ${product.originalPrice}
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div>
              {product.stock > 0 ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  In Stock ({product.stock} available)
                </Badge>
              ) : (
                <Badge variant="destructive">
                  Out of Stock
                </Badge>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium">Quantity:</label>
              <div className="flex items-center border border-gray-300 rounded-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="px-3 py-1"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="px-4 py-2 min-w-[50px] text-center">
                  {quantity}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock}
                  className="px-3 py-1"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <Button
                onClick={handleAddToCart}
                disabled={product.stock === 0 || addToCartMutation.isPending}
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-white"
              >
                {addToCartMutation.isPending ? "Adding..." : (
                  <>
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Add to Cart
                  </>
                )}
              </Button>
              <Button
                onClick={handleBuyNow}
                disabled={product.stock === 0}
                size="lg"
                className="w-full bg-primary/20 hover:bg-primary/30 text-primary"
              >
                Buy Now
              </Button>
            </div>
            
            <Separator />

            <div className="flex space-x-4">
                <Button variant="outline" size="lg" className="flex-1">
                  <Heart className="mr-2 h-5 w-5" />
                  Add to Wishlist
                </Button>
                <Button variant="outline" size="lg" className="flex-1">
                  <Share2 className="mr-2 h-5 w-5" />
                  Share
                </Button>
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <Tabs defaultValue="description" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="description">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Product Description</h3>
                <p className="text-gray-700 leading-relaxed">
                  {product.description || "No description available for this product."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="reviews">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Customer Reviews</h3>
                
                {reviews.length === 0 ? (
                  <p className="text-gray-600">No reviews yet. Be the first to review this product!</p>
                ) : (
                  <div className="space-y-6">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {renderStars(review.rating)}
                            <span className="font-medium">
                              {review.user.firstName || 'Anonymous'} {review.user.lastName || ''}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-gray-700">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
                }
