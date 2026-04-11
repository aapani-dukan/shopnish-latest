import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";

/**
 * ✅ useDeliveryBoy Hook
 * Ab ye hook khud API call nahi karega, balki useAuth se data lega.
 * Isse duplicate login calls aur loading issues khatam ho jayenge.
 */
export function useDeliveryBoy() {
  const { user, isLoadingAuth, error: authError } = useAuth();

  // Sirf tab true hoga jab user logged in ho aur uska role delivery-boy ho
  const isDeliveryBoy = useMemo(() => {
    return user?.role === "delivery-boy" || !!user?.isDelivery;
  }, [user]);

  return {
    isDeliveryBoy,
    deliveryUser: isDeliveryBoy ? user : null,
    isLoading: isLoadingAuth,
    error: authError?.message || null,
  };
}