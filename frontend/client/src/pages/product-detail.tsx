// frontend/pages/productdetail.tsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, ShoppingCart, Heart, Share2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button"; // Adjusted path
import { Card, CardContent } from "@/components/ui/card"; // Adjusted path
import { Badge } from "@/components/ui/badge"; // Adjusted path
import { Separator } from "@/components/ui/separator"; // Adjusted path
import { Skeleton } from "@/components/ui/skeleton"; // Adjusted path
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Adjusted path
import { useToast } from "@/hooks/use-toast"; // Adjusted path
import { apiRequest } from "@/lib/queryclient"; // Adjusted path
import Header from "@/components/header"; // Adjusted path
import Footer from "@/components/footer"; // Adjusted path
// Removed direct import of api and auth as they are not used directly here anymore.
// import api from "../lib/api.ts";
// import { auth } from "../lib/firebase.ts";

// ✅ Updated Product Interface
interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number; // ✅ Changed from string to number
  originalPrice: number | null; // ✅ Changed from string to number
  image: string;
  images: string[] | null;
  brand: string | null;
  stock: number;
  rating: number | null; // ✅ Changed from string to number
  reviewCount: number | null; // ✅ Changed to camelCase
  categoryName: string | null; // ✅ Changed to camelCase
  seller: { // ✅ Added seller info for multi-seller context
    id: number;
    businessName: string;
  };
}

// ✅ Updated Review Interface
interface Review {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string; // ✅ Changed to camelCase
  user: {
    firstName: string | null; // ✅ Changed to camelCase
    lastName: string | null; // ✅ Changed to camelCase
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
  const [quantity, setQuantity] = useState(1); // ✅ Corrected casing
  const [selectedImage, setSelectedImage] = useState(0); // ✅ Corrected casing
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // categories data fetching
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    queryFn: () => apiRequest("get", "/api/categories"), // ✅ Added queryFn
  });

  // product data fetching
  const { data: product, isLoading: productLoading, error } = useQuery<Product>({ // ✅ Corrected casing
    queryKey: ['/api/products', id],
    queryFn: async () => {
      if (!id) throw new Error('Product ID is missing');
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Product not found');
      }
      return response.json();
    },
    enabled: !!id,
  });

  // product reviews fetching
  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ['/api/products', id, 'reviews'],
    queryFn: async () => {
      if (!id) return []; // If no product ID, no reviews
      const response = await fetch(`/api/products/${id}/reviews`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch reviews');
      }
      return response.json();
    },
    enabled: !!id,
  });

  // ✅ add to cart mutation
  const addToCartMutation = useMutation({ // ✅ Corrected casing
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => { // ✅ Corrected casing
      return await apiRequest("post", "/api/cart/add", { productId, quantity }); // ✅ Corrected casing
    },
    onSuccess: (data) => {
      console.log("✅ Cart API response (onSuccess):", data);

      // ✅ cart query को invalidate करें ताकि cart page पर data refresh हो
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });

      // ✅ success toast message दिखाएँ
      toast({
        title: "Added to Cart", // ✅ Consistent casing
        description: `${quantity} × ${product?.name} added to your cart.`,
      });
    },
    onError: (error: any) => { // ✅ Explicitly type error as any
      console.error("❌ Error adding to cart:", error);
      toast({
        title: "Failed to Add to Cart", // ✅ Consistent casing
        description: error.message || "An error occurred while adding the item to your cart.",
        variant: "destructive",
      });
    },
  });

  const handleAddToCart = () => { // ✅ Corrected casing
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
      productId: product.id, // ✅ Corrected casing
      quantity,
    });
  };

  // ✅ New function for "buy now" button
  const handleBuyNow = () => { // ✅ Corrected casing
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
    console.log("➡️ Navigating with product ID:", product.id, "and quantity:", quantity);
    navigate(`/checkout2/${product.id}?quantity=${quantity}`);
  };

  const renderStars = (rating: number) => { // ✅ Corrected casing
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => ( // ✅ Corrected Array casing
          <Star // ✅ Corrected component name
            key={i}
            className={`h-4 w-4 ${ // ✅ Corrected className
              i < rating ? "text-yellow-400 fill-current" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  const averageRating = reviews.length > 0 // ✅ Corrected casing
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  if (productLoading) { // ✅ Corrected casing
    return (
      <div className="min-h-screen bg-neutral-50"> {/* ✅ Corrected className */}
        <Header categories={categories} /> {/* ✅ Pass categories to Header */}
        <div className="max-w-7xl mx-auto px-4 py-8"> {/* ✅ Corrected className */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"> {/* ✅ Corrected className */}
            <Skeleton className="h-96 w-full" /> {/* ✅ Corrected component name and className */}
            <div className="space-y-4"> {/* ✅ Corrected className */}
              <Skeleton className="h-8 w-3/4" /> {/* ✅ Corrected component name and className */}
              <Skeleton className="h-4 w-1/2" /> {/* ✅ Corrected component name and className */}
              <Skeleton className="h-6 w-1/4" /> {/* ✅ Corrected component name and className */}
              <Skeleton className="h-32 w-full" /> {/* ✅ Corrected component name and className */}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-neutral-50"> {/* ✅ Corrected className */}
        <Header categories={categories} /> {/* ✅ Pass categories to Header */}
        <div className="max-w-7xl mx-auto px-4 py-8"> {/* ✅ Corrected className */}
          <Card> {/* ✅ Corrected component name */}
            <CardContent className="p-8 text-center"> {/* ✅ Corrected component name and className */}
              <h2 className="text-2xl font-bold mb-4">Product Not Found</h2> {/* ✅ Consistent casing and className */}
              <p className="text-gray-600 mb-4">The product you're looking for doesn't exist.</p> {/* ✅ Corrected className */}
              <Button onClick={() => window.history.back()}>Go Back</Button> {/* ✅ Corrected component name and casing */}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const images = product.images || [product.image];

  return (
    <div className="min-h-screen bg-neutral-50"> {/* ✅ Corrected className */}
      <Header categories={categories} /> {/* ✅ Pass categories to Header */}

      <main className="max-w-7xl mx-auto px-4 py-8"> {/* ✅ Corrected className */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12"> {/* ✅ Corrected className */}
          {/* product images */}
          <div className="space-y-4"> {/* ✅ Corrected className */}
            <div className="relative"> {/* ✅ Corrected className */}
              <img
                src={images[selectedImage]} // ✅ Corrected casing
                alt={product.name}
                className="w-full h-96 object-cover rounded-lg" // ✅ Corrected className
              />
              {product.originalPrice && ( // ✅ Corrected casing
                <Badge className="absolute top-4 left-4 bg-red-500 text-white"> {/* ✅ Corrected component name and className */}
                  Sale
                </Badge>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex space-x-2 overflow-x-auto"> {/* ✅ Corrected className */}
                {images.map((image, index) => (
                  <Button // Use Button for consistent styling and accessibility
                    key={index}
                    onClick={() => setSelectedImage(index)} // ✅ Corrected casing
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 p-0 ${ // ✅ Corrected className
                      selectedImage === index ? 'border-primary' : 'border-gray-200' // ✅ Corrected casing
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover" // ✅ Corrected className
                    />
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* product info */}
          <div className="space-y-6"> {/* ✅ Corrected className */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2"> {/* ✅ Corrected className */}
                {product.name}
              </h1>
              {product.categoryName && ( // ✅ Corrected casing
                <p className="text-sm text-gray-500">Category: <span className="font-medium">{product.categoryName}</span></p> // ✅ Consistent casing and className
              )}
              {product.brand && (
                <p className="text-gray-600">By {product.brand}</p> {/* ✅ Corrected className */}
              )}
              {product.seller && ( // ✅ New: Display seller info
                <p className="text-gray-600 text-sm">Sold by: <span className="font-semibold">{product.seller.businessName}</span></p>
              )}
            </div>

            {/* rating */}
            <div className="flex items-center space-x-4"> {/* ✅ Corrected className */}
              {renderStars(Math.round(averageRating))} {/* ✅ Corrected casing */}
              <span className="text-gray-600"> {/* ✅ Corrected className */}
                ({reviews.length} reviews)
              </span>
            </div>

            {/* price */}
            <div className="flex items-center space-x-4"> {/* ✅ Corrected className */}
              <span className="text-3xl font-bold text-primary"> {/* ✅ Corrected className */}
                ₹{product.price.toFixed(2)} {/* ✅ Format price */}
              </span>
              {product.originalPrice && ( // ✅ Corrected casing
                <span className="text-xl text-gray-400 line-through"> {/* ✅ Corrected className */}
                  ₹{product.originalPrice.toFixed(2)} {/* ✅ Format price */}
                </span>
              )}
            </div>

            {/* stock status */}
            <div>
              {product.stock > 0 ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800"> {/* ✅ Corrected component name and className */}
                  In Stock ({product.stock} available)
                </Badge>
              ) : (
                <Badge variant="destructive"> {/* ✅ Corrected component name */}
                  Out of Stock
                </Badge>
              )}
            </div>

            {/* quantity selector */}
            <div className="flex items-center space-x-4"> {/* ✅ Corrected className */}
              <Label className="text-sm font-medium">Quantity:</Label> {/* ✅ Corrected component name and className */}
              <div className="flex items-center border border-gray-300 rounded-lg"> {/* ✅ Corrected className */}
                <Button // ✅ Corrected component name
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))} // ✅ Corrected casing
                  disabled={quantity <= 1 || product.stock === 0} // ✅ Disable if stock is 0
                  className="px-3 py-1" // ✅ Corrected className
                >
                  <Minus className="h-4 w-4" /> {/* ✅ Corrected className */}
                </Button>
                <span className="px-4 py-2 min-w-[50px] text-center"> {/* ✅ Corrected className */}
                  {quantity}
                </span>
                <Button // ✅ Corrected component name
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} // ✅ Corrected casing
                  disabled={quantity >= product.stock || product.stock === 0} // ✅ Disable if stock is 0
                  className="px-3 py-1" // ✅ Corrected className
                >
                  <Plus className="h-4 w-4" /> {/* ✅ Corrected className */}
                </Button>
              </div>
            </div>

            {/* action buttons */}
            <div className="space-y-4"> {/* ✅ Corrected className */}
              <Button // ✅ Corrected component name
                onClick={handleAddToCart} // ✅ Corrected casing
                disabled={product.stock === 0 || addToCartMutation.isPending} // ✅ Corrected casing
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-white" // ✅ Corrected className
              >
                {addToCartMutation.isPending ? "Adding..." : ( // ✅ Corrected casing
                  <>
                    <ShoppingCart className="mr-2 h-5 w-5" /> {/* ✅ Corrected component name and className */}
                    Add to Cart
                  </>
                )}
              </Button>
              <Button // ✅ Corrected component name
                onClick={handleBuyNow} // ✅ Corrected casing
                disabled={product.stock === 0}
                size="lg"
                className="w-full bg-primary/20 hover:bg-primary/30 text-primary" // ✅ Corrected className
              >
                Buy Now
              </Button>
            </div>

            <Separator /> {/* ✅ Corrected component name */}

            <div className="flex space-x-4"> {/* ✅ Corrected className */}
              <Button variant="outline" size="lg" className="flex-1"> {/* ✅ Corrected component name and className */}
                <Heart className="mr-2 h-5 w-5" /> {/* ✅ Corrected component name and className */}
                Add to Wishlist
              </Button>
              <Button variant="outline" size="lg" className="flex-1"> {/* ✅ Corrected component name and className */}
                <Share2 className="mr-2 h-5 w-5" /> {/* ✅ Corrected component name and className */}
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* product details tabs */}
        <Tabs defaultValue="description" className="w-full"> {/* ✅ Corrected component name and className */}
          <TabsList className="grid w-full grid-cols-2"> {/* ✅ Corrected component name and className */}
            <TabsTrigger value="description">Description</TabsTrigger> {/* ✅ Corrected component name */}
            <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger> {/* ✅ Corrected component name */}
          </TabsList>

          <TabsContent value="description"> {/* ✅ Corrected component name */}
            <Card> {/* ✅ Corrected component name */}
              <CardContent className="p-6"> {/* ✅ Corrected component name and className */}
                <h3 className="text-xl font-semibold mb-4">Product Description</h3> {/* ✅ Consistent casing and className */}
                <p className="text-gray-700 leading-relaxed"> {/* ✅ Corrected className */}
                  {product.description || "No description available for this product."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews"> {/* ✅ Corrected component name */}
            <Card> {/* ✅ Corrected component name */}
              <CardContent className="p-6"> {/* ✅ Corrected component name and className */}
                <h3 className="text-xl font-semibold mb-4">Customer Reviews</h3> {/* ✅ Consistent casing and className */}

                {reviews.length === 0 ? (
                  <p className="text-gray-600">No reviews yet. Be the first to review this product!</p> {/* ✅ Corrected className */}
                ) : (
                  <div className="space-y-6"> {/* ✅ Corrected className */}
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0"> {/* ✅ Corrected className */}
                        <div className="flex items-center justify-between mb-2"> {/* ✅ Corrected className */}
                          <div className="flex items-center space-x-2"> {/* ✅ Corrected className */}
                            {renderStars(review.rating)}
                            <span className="font-medium"> {/* ✅ Corrected className */}
                              {review.user.firstName || 'Anonymous'} {review.user.lastName || ''} {/* ✅ Corrected casing */}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500"> {/* ✅ Corrected className */}
                            {new Date(review.createdAt).toLocaleString()} {/* ✅ Corrected casing */}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-gray-700">{review.comment}</p> {/* ✅ Corrected className */}
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
                                                      
