import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Star, User, MessageSquare } from "lucide-react";

interface Review {
  id: number;
  rating: number;
  comment: string;
  customerId: number;
  customerName: string;
  createdAt: string;
  isVerifiedPurchase: boolean;
}

interface ProductReviewsProps {
  productId: number;
  averageRating?: number;
  totalReviews?: number;
}

export default function ProductReviews({ productId, averageRating = 0, totalReviews = 0 }: ProductReviewsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [newReview, setNewReview] = useState({
    rating: 5,
    comment: ""
  });

  // Fetch reviews
  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: [`/api/products/${productId}/reviews`]
  });

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: async (reviewData: { rating: number; comment: string }) => {
      return await apiRequest("POST", `/api/products/${productId}/reviews`, {
        ...reviewData,
        customerId: 1, // Guest customer for demo
        customerName: "Guest User"
      });
    },
    onSuccess: () => {
      toast({
        title: "Review Submitted",
        description: "Thank you for your feedback!",
      });
      setNewReview({ rating: 5, comment: "" });
      setShowWriteReview(false);
      queryClient.invalidateQueries({ queryKey: [`/api/products/${productId}/reviews`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitReview = () => {
    if (!newReview.comment.trim()) {
      toast({
        title: "Review Required",
        description: "Please write a review comment",
        variant: "destructive",
      });
      return;
    }
    submitReviewMutation.mutate(newReview);
  };

  const renderStars = (rating: number, interactive = false, onRatingChange?: (rating: number) => void) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating 
                ? "text-yellow-400 fill-yellow-400" 
                : "text-gray-300"
            } ${interactive ? "cursor-pointer hover:text-yellow-400" : ""}`}
            onClick={() => interactive && onRatingChange?.(star)}
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Review Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Customer Reviews</span>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowWriteReview(!showWriteReview)}
            >
              Write Review
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold">{averageRating.toFixed(1)}</div>
              {renderStars(Math.round(averageRating))}
              <div className="text-sm text-gray-600 mt-1">{totalReviews} reviews</div>
            </div>
            <div className="flex-1">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = reviews.filter(r => r.rating === stars).length;
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center space-x-2 text-sm">
                    <span className="w-8">{stars}★</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-400 h-2 rounded-full" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-8 text-gray-600">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Write Review Form */}
      {showWriteReview && (
        <Card>
          <CardHeader>
            <CardTitle>Write a Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Rating</label>
                {renderStars(newReview.rating, true, (rating) => 
                  setNewReview({ ...newReview, rating })
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Your Review</label>
                <Textarea
                  value={newReview.comment}
                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  placeholder="Share your experience with this product..."
                  rows={4}
                />
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={handleSubmitReview}
                  disabled={submitReviewMutation.isPending}
                >
                  {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowWriteReview(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : reviews.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No reviews yet</h3>
              <p className="text-gray-600">Be the first to review this product!</p>
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-6">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{review.customerName}</p>
                        <div className="flex items-center space-x-2">
                          {renderStars(review.rating)}
                          {review.isVerifiedPurchase && (
                            <Badge variant="secondary" className="text-xs">
                              Verified Purchase
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    <p className="text-gray-700">{review.comment}</p>
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
