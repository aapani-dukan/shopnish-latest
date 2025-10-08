// client/src/hooks/useDeliveryBoy.tsx
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase"; // Make sure this path is correct

type DeliveryUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  name: string;
  approvalStatus: "approved" | "pending" | "rejected";
};

export function useDeliveryBoy() { // <<< यह नाम `usedeliveryboy` नहीं है, `useDeliveryBoy` है
  const [deliveryUser, setDeliveryUser] = useState<DeliveryUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      setError(null);

      if (!firebaseUser) {
        setDeliveryUser(null);
        setLoading(false);
        return;
      }

      try {
        const token = await firebaseUser.getIdToken();
        
        const res = await fetch("/api/delivery/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            firebaseUid: firebaseUser.uid,
            email: firebaseUser.email,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to fetch user data.");
        }

        const data = await res.json();
        setDeliveryUser(data.user);

      } catch (err: any) {
        console.error("Failed to fetch delivery user:", err);
        setError(err.message);
        setDeliveryUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return {
    isDeliveryBoy: !!deliveryUser,
    deliveryUser,
    isLoading: loading,
    error,
    // यदि आप fetchDeliveryUser को यहां से एक्सपोर्ट करना चाहते हैं, तो यह useCallback के अंदर होना चाहिए
    // अभी के लिए, यह यहाँ नहीं है, इसलिए इसे DeliveryApply.tsx से हटाना होगा अगर यह useDeliveryBoy के रिटर्न का हिस्सा नहीं है
  };
}
