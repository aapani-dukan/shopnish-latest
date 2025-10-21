// frontend/components/productreviews.tsx
import { useState } from "react"; // ✅ Corrected casing
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // ✅ Corrected casing
import { Button } from "@/components/ui/button"; // ✅ Corrected casing and path
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // ✅ Corrected casing and path
import { Textarea } from "@/components/ui/textarea"; // ✅ Corrected casing and path
import { Badge } from "@/components/ui/badge"; // ✅ Corrected casing and path
import { useToast } from "@/hooks/use-toast"; // ✅ Corrected casing and path
import { apiRequest } from "@/lib/queryClient"; // ✅ Corrected casing and path
import { Star, User, MessageSquare } from "lucide-react"; // ✅ Corrected casing
import { useAuth } from "@/hooks/useAuth"; // ✅ Added for authenticated user info

// ✅ Updated Review Interface
interface Review {
  id: number;
  rating: number;
  comment: string;
  customerId: number; // ✅ Corrected to camelCase
  customerName: string; // ✅ Corrected to camelCase
  createdAt: string; // ✅ Corrected to camelCase
  isVerifiedPurchase: boolean; // ✅ Corrected to camelCase
}

interface ProductReviewsProps {
  productId: number;
  averageRating?: number;
  totalReviews?: number;
}

export default function ProductReviews({ productId, averageRating = 0, totalReviews = 0 }: ProductReviewsProps) {
  const { toast } = useToast(); // ✅ Corrected casing
  const queryClient = useQueryClient(); // ✅ Corrected casing
  const { user } = useAuth(); // ✅ Get authenticated user

  const [showWriteReview, setShowWriteReview] = useState(false); // ✅ Corrected casing
  const [newReview, setNewReview] = useState({ // ✅ Corrected casing
    rating: 5,
    comment: ""
  });

  // fetch reviews
  const { data: reviews = [], isLoading } = useQuery<Review[]>({ // ✅ Corrected casing
    queryKey: [`/api/products/${productId}/reviews`], // ✅ Corrected casing
    queryFn: () => apiRequest("get", `/api/products/${productId}/reviews`), // ✅ Added queryFn
  });

  // submit review mutation
  const submitReviewMutation = useMutation({ // ✅ Corrected casing
    mutationFn: async (reviewData: { rating: number; comment: string }) => { // ✅ Corrected casing
      if (!user) { // ✅ Check if user is logged in
        throw new Error("You must be logged in to submit a review.");
      }
      return await apiRequest("post", `/api/products/${productId}/reviews`, {
        ...reviewData,
        customerId: user.id, // ✅ Use actual user ID
        customerName: user.name, // ✅ Use actual user name
      });
    },
    onSuccess: () => { // ✅ Corrected casing
      toast({
        title: "Review Submitted", // ✅ Consistent casing
        description: "Thank you for your feedback!",
      });
      setNewReview({ rating: 5, comment: "" }); // ✅ Corrected casing
      setShowWriteReview(false); // ✅ Corrected casing
      queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}/reviews`] }); // ✅ Corrected casing
    },
    onError: (error: any) => { // ✅ Corrected casing
      toast({
        title: "Error", // ✅ Consistent casing
        description: error.message || "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitReview = () => { // ✅ Corrected casing
    if (!user) { // ✅ Added check for user before showing toast
      toast({
        title: "Login Required",
        description: "Please log in to submit a review.",
        variant: "destructive",
      });
      return;
    }
    if (!newReview.comment.trim()) { // ✅ Corrected casing
      toast({
        title: "Review Required", // ✅ Consistent casing
        description: "Please write a review comment.",
        variant: "destructive",
      });
      return;
    }
    submitReviewMutation.mutate(newReview); // ✅ Corrected casing
  };

  const renderStars = (rating: number, interactive = false, onRatingChange?: (rating: number) => void) => { // ✅ Corrected casing
    return (
      <div className="flex space-x-1"> {/* ✅ Corrected className */}
        {[1, 2, 3, 4, 5].map((starValue) => ( // ✅ Changed 'star' to 'starValue' to avoid conflict with imported Star component
          <Star // ✅ Corrected component name
            key={starValue}
            className={`w-5 h-5 ${ // ✅ Corrected className
              starValue <= rating
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-300"
            } ${interactive ? "cursor-pointer hover:text-yellow-400" : ""}`}
            onClick={() => interactive && onRatingChange?.(starValue)} // ✅ Corrected casing
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateString: string) => { // ✅ Corrected casing
    if (!dateString) return "N/A"; // Handle empty date string
    try {
      return new Date(dateString).toLocaleString('en-IN', { // ✅ Corrected casing
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      console.error("Invalid date string:", dateString);
      return "Invalid Date";
    }
  };

  return (
    <div className="space-y-6"> {/* ✅ Corrected className */}

      {/* review summary */}
      <Card> {/* ✅ Corrected component name */}
        <CardHeader> {/* ✅ Corrected component name */}
          <CardTitle className="flex items-center justify-between"> {/* ✅ Corrected component name and className */}
            <div className="flex items-center space-x-2"> {/* ✅ Corrected className */}
              <MessageSquare className="w-5 h-5" /> {/* ✅ Corrected component name and className */}
              <span>Customer Reviews</span> {/* ✅ Consistent casing */}
            </div>
            <Button // ✅ Corrected component name
              variant="outline"
              onClick={() => setShowWriteReview(!showWriteReview)} // ✅ Corrected casing
            >
              Write Review
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent> {/* ✅ Corrected component name */}
          <div className="flex items-center space-x-4 mb-4"> {/* ✅ Corrected className */}
            <div className="text-center"> {/* ✅ Corrected className */}
              <div className="text-3xl font-bold">{averageRating.toFixed(1)}</div> {/* ✅ Corrected className */}
              {renderStars(Math.round(averageRating))} {/* ✅ Corrected casing */}
              <div className="text-sm text-gray-600 mt-1">{totalReviews} reviews</div> {/* ✅ Corrected className */}
            </div>
            <div className="flex-1"> {/* ✅ Corrected className */}
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = reviews.filter(r => r.rating === stars).length;
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center space-x-2 text-sm"> {/* ✅ Corrected className */}
                    <span className="w-8">{stars}★</span> {/* ✅ Corrected className */}
                    <div className="flex-1 bg-gray-200 rounded-full h-2"> {/* ✅ Corrected className */}
                      <div
                        className="bg-yellow-400 h-2 rounded-full" // ✅ Corrected className
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-8 text-gray-600">{count}</span> {/* ✅ Corrected className */}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* write review form */}
      {showWriteReview && ( // ✅ Corrected casing
        <Card> {/* ✅ Corrected component name */}
          <CardHeader> {/* ✅ Corrected component name */}
            <CardTitle>Write a Review</CardTitle> {/* ✅ Consistent casing */}
          </CardHeader>
          <CardContent> {/* ✅ Corrected component name */}
            <div className="space-y-4"> {/* ✅ Corrected className */}
              <div>
                <Label className="block text-sm font-medium mb-2">Rating</Label> {/* ✅ Corrected component name and className */}
                {renderStars(newReview.rating, true, (rating) => // ✅ Corrected casing
                  setNewReview({ ...newReview, rating }) // ✅ Corrected casing
                )}
              </div>

              <div>
                <Label className="block text-sm font-medium mb-2">Your Review</Label> {/* ✅ Corrected component name and className */}
                <Textarea // ✅ Corrected component name
                  value={newReview.comment} // ✅ Corrected casing
                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })} // ✅ Corrected casing
                  placeholder="Share your experience with this product..."
                  rows={4}
                />
              </div>

              <div className="flex space-x-2"> {/* ✅ Corrected className */}
                <Button // ✅ Corrected component name
                  onClick={handleSubmitReview} // ✅ Corrected casing
                  disabled={submitReviewMutation.isPending} // ✅ Corrected casing
                >
                  {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"} {/* ✅ Consistent casing */}
                </Button>
                <Button // ✅ Corrected component name
                  variant="outline"
                  onClick={() => setShowWriteReview(false)} // ✅ Corrected casing
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* reviews list */}
      <div className="space-y-4"> {/* ✅ Corrected className */}
        {isLoading ? ( // ✅ Corrected casing
          <div className="text-center py-8"> {/* ✅ Corrected className */}
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div> {/* ✅ Corrected className */}
          </div>
        ) : reviews.length === 0 ? (
          <Card> {/* ✅ Corrected component name */}
            <CardContent className="py-8 text-center"> {/* ✅ Corrected component name and className */}
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" /> {/* ✅ Corrected component name and className */}
              <h3 className="text-lg font-medium mb-2">No Reviews Yet</h3> {/* ✅ Consistent casing and className */}
              <p className="text-gray-600">Be the first to review this product!</p> {/* ✅ Corrected className */}
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id}> {/* ✅ Corrected component name */}
              <CardContent className="pt-6"> {/* ✅ Corrected component name and className */}
                <div className="flex items-start space-x-4"> {/* ✅ Corrected className */}
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center"> {/* ✅ Corrected className */}
                    <User className="w-5 h-5 text-gray-600" /> {/* ✅ Corrected component name and className */}
                  </div>
                  <div className="flex-1"> {/* ✅ Corrected className */}
                    <div className="flex items-center justify-between mb-2"> {/* ✅ Corrected className */}
                      <div>
                        <p className="font-medium">{review.customerName}</p> {/* ✅ Corrected casing and className */}
                        <div className="flex items-center space-x-2"> {/* ✅ Corrected className */}
                          {renderStars(review.rating)}
                          {review.isVerifiedPurchase && ( // ✅ Corrected casing
                            <Badge variant="secondary" className="text-xs"> {/* ✅ Corrected component name and className */}
                              Verified Purchase
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-gray-500"> {/* ✅ Corrected className */}
                        {formatDate(review.createdAt)} {/* ✅ Corrected casing */}
                      </span>
                    </div>
                    <p className="text-gray-700">{review.comment}</p> {/* ✅ Corrected className */}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
                }
