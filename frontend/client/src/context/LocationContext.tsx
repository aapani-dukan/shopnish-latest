// client/src/context/LocationContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import axios from "axios";

// --- Interfaces for Location Data ---
interface LatLng {
  lat: number;
  lng: number;
}

interface ProcessedLocation extends LatLng {
  address: string;
  pincode: string;
  inServiceArea: boolean;
  deliveryCharges?: number | null;
  id?: number;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  label?: string;
  isDefault?: boolean;
  phoneNumber?: string;
  fullName?: string;
}

interface LocationContextType {
  currentLocation: ProcessedLocation | null;
  setCurrentLocation: React.Dispatch<
    React.SetStateAction<ProcessedLocation | null>
  >;
  loadingLocation: boolean;
  error: string | null;
  fetchCurrentGeolocation: () => Promise<void>;
  processLocation: (lat: number, lng: number) => Promise<void>;
  savedAddresses: ProcessedLocation[];
  loadSavedAddresses: () => Promise<void>;
  setSelectedAddress: (address: ProcessedLocation) => void;
  setLoadingLocation: React.Dispatch<React.SetStateAction<boolean>>;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({
  children,
}) => {
  const [currentLocation, setCurrentLocation] =
    useState<ProcessedLocation | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<ProcessedLocation[]>([]);
  const [loadingLocation, setLoadingLocation] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "https://shopnish-seprate.onrender.com";

  // 🔐 Get token
  const getAuthToken = useCallback((): string | null => {
    return localStorage.getItem("authToken");
  }, []);

  // --- Fetch and process user location from backend ---
  const processLocation = useCallback(
    async (lat: number, lng: number) => {
      setLoadingLocation(true);
      setError(null);
      try {
        const response = await axios.post<ProcessedLocation>(
          `${API_BASE_URL}/api/addresses/process-current-location`,
          {
            latitude: lat,
            longitude: lng,
          }
        );

        // Normalize backend keys
        const data = {
          ...response.data,
          lat: response.data.lat ?? response.data.lat,
          lng: response.data.lng ?? response.data.lng,
        };

        setCurrentLocation(data);

        localStorage.setItem("userLat", String(data.lat));
        localStorage.setItem("userLng", String(data.lng));
        localStorage.setItem("userAddress", data.address);
        localStorage.setItem("userPincode", data.pincode);
        localStorage.setItem("userServiceArea", String(data.inServiceArea));
      } catch (err) {
        console.error("Error processing location:", err);
        setError("लोकेशन प्रोसेस करने में असमर्थ।");
      } finally {
        setLoadingLocation(false);
      }
    },
    [API_BASE_URL]
  );

  // --- Fetch location from browser ---
  const fetchCurrentGeolocation = useCallback(async () => {
    setLoadingLocation(true);
    setError(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          await processLocation(latitude, longitude);
        },
        (geoError) => {
          console.error("Geolocation Error: ", geoError);
          setError("लोकेशन प्राप्त करने में असमर्थ। कृपया अनुमति दें।");
          setLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setError("आपका ब्राउज़र जियोलोकेशन को सपोर्ट नहीं करता।");
      setLoadingLocation(false);
    }
  }, [processLocation]);

  // --- Load cached or current location ---
  useEffect(() => {
    const loadInitialLocation = async () => {
      setLoadingLocation(true);
      setError(null);

      const storedLat = localStorage.getItem("userLat");
      const storedLng = localStorage.getItem("userLng");
      const storedAddress = localStorage.getItem("userAddress");
      const storedPincode = localStorage.getItem("userPincode");
      const storedServiceArea = localStorage.getItem("userServiceArea");

      if (storedLat && storedLng && storedAddress && storedPincode) {
        setCurrentLocation({
          address: storedAddress,
          pincode: storedPincode,
          lat: parseFloat(storedLat),
          lng: parseFloat(storedLng),
          inServiceArea: storedServiceArea === "true",
        });
        setLoadingLocation(false);
        return;
      }

      await fetchCurrentGeolocation();
    };

    loadInitialLocation();
  }, [fetchCurrentGeolocation]);

  // --- Load saved addresses ---
  const loadSavedAddresses = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setSavedAddresses([]);
      return;
    }

    try {
      const response = await axios.get<ProcessedLocation[]>(
        `${API_BASE_URL}/api/addresses/user`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSavedAddresses(response.data);
    } catch (err) {
      console.error("Error loading saved addresses:", err);
      setError("सहेजे गए पते लोड करने में असमर्थ।");
    }
  }, [API_BASE_URL, getAuthToken]);

  // --- Select a saved address ---
  const setSelectedAddress = useCallback((address: ProcessedLocation) => {
    setCurrentLocation(address);
    localStorage.setItem("userLat", String(address.lat));
    localStorage.setItem("userLng", String(address.lng));
    localStorage.setItem(
      "userAddress",
      address.addressLine1
        ? `${address.addressLine1}, ${address.city ?? ""} - ${
            address.pincode ?? ""
          }`
        : address.address
    );
    localStorage.setItem("userPincode", address.pincode);
    localStorage.setItem("userServiceArea", String(true));
  }, []);

  const contextValue = useMemo(
    () => ({
      currentLocation,
      setCurrentLocation,
      loadingLocation,
      error,
      fetchCurrentGeolocation,
      processLocation,
      savedAddresses,
      loadSavedAddresses,
      setSelectedAddress,
      setLoadingLocation,
    }),
    [
      currentLocation,
      loadingLocation,
      error,
      fetchCurrentGeolocation,
      processLocation,
      savedAddresses,
      loadSavedAddresses,
      setSelectedAddress,
    ]
  );

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};

// --- Hook ---
export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};