// Client/src/hooks/useSeller.tsx
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import axios from "axios";
import { getAuth } from "firebase/auth";

interface Seller {
  id: string;
  userId: string;
  businessName: string;
  approvalStatus: "pending" | "approved" | "rejected";
}

export function useSeller() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: seller, isLoading: sellerLoading } = useQuery<Seller | null>({
    queryKey: ["/api/sellers/me"],
    queryFn: async () => {
      const auth = getAuth();
      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        console.warn("🚫 useSeller: No Firebase user found.");
        return null;
      }

      const idToken = await firebaseUser.getIdToken();
      if (!idToken) {
        console.warn("🚫 useSeller: Failed to get ID token.");
        return null;
      }

      const response = await axios.get("/api/sellers/me", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.status === 204) return null;
      return response.data;
    },
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000,
    onError: (error) => {
      console.error("❌ useSeller: Error fetching seller data:", error);
    },
  });

  return {
    seller,
    isSeller: !!seller,
    isLoading: authLoading || sellerLoading,
    isAuthenticated,
  };
}
