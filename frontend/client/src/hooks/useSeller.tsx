import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

interface Seller {
  id: string;
  userId: string;
  businessName: string;
  approvalStatus: "pending" | "approved" | "rejected";
  // Aapke schema ke hisab se baaki fields bhi add kar sakte hain
}

export function useSeller() {
  const { isAuthenticated, isLoadingAuth, user } = useAuth();

  const { data: seller, isLoading: sellerLoading, error } = useQuery<Seller | null>({
    queryKey: ["/api/sellers/me"],
    // ✅ Note: Humne QueryClient mein getQueryFn set kiya hua hai 
    // isliye yahan queryFn likhne ki zaroorat nahi hai agar default config set hai.
    // Lekin safety ke liye hum isAuthenticated flag use kar rahe hain.
    enabled: isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes tak data fresh rahega
    retry: false,
  });

  return {
    seller,
    // Agar user role 'seller' hai ya seller profile mil gayi hai
    isSeller: !!seller || user?.role === 'seller' || !!user?.isSeller,
    isLoading: isLoadingAuth || sellerLoading,
    isAuthenticated,
    error
  };
}