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

// Backend से लौटाई गई संरचना से मेल खाने के लिए प्रोसेस किया गया स्थान
export interface ProcessedLocation extends LatLng {
  address: string;
  pincode: string;
  inServiceArea: boolean;
  deliveryCharges?: number | null;
  
  // Drizzle/Address Schema fields:
  id?: number; // Drizzle ID
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  label?: string;
  isDefault?: boolean;
  phoneNumber?: string;
  fullName?: string;
}

// --- Context Interface ---
interface LocationContextType {
  currentLocation: ProcessedLocation | null;
  setCurrentLocation: React.Dispatch<React.SetStateAction<ProcessedLocation | null>>;
  loadingLocation: boolean;
  setLoadingLocation: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  fetchCurrentGeolocation: () => Promise<void>;
  // 🛑 FIX 1: Promise रिटर्न टाइप में बदलाव किया गया
  processLocation: (lat: number, lng: number) => Promise<ProcessedLocation | undefined>; 
  savedAddresses: ProcessedLocation[];
  loadSavedAddresses: () => Promise<void>;
  setSelectedAddress: (address: ProcessedLocation) => void;
}

interface LocationProviderProps {
  children: ReactNode;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<ProcessedLocation | null>(null);
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
    async (lat: number, lng: number): Promise<ProcessedLocation | undefined> => {
      setLoadingLocation(true);
      setError(null);

      try {
        const response = await axios.post<ProcessedLocation>(
          `${API_BASE_URL}/api/addresses/process-current-location`,
          { latitude: lat, longitude: lng }
        );

        // 🛑 FIX 2: lat/lng को इनपुट से असाइन करें, Backend रिस्पांस से नहीं
        const locationData: ProcessedLocation = {
          ...response.data,
          lat: lat, 
          lng: lng,
          // सुनिश्चित करें कि Backend रिस्पांस में address/pincode हो
          address: response.data.address || "पता उपलब्ध नहीं", 
          pincode: response.data.pincode || "000000",
        };

        setCurrentLocation(locationData);
        
        // localStorage अपडेट करें
        localStorage.setItem("userLat", String(locationData.lat));
        localStorage.setItem("userLng", String(locationData.lng));
        localStorage.setItem("userAddress", locationData.address);
        localStorage.setItem("userPincode", locationData.pincode);
        localStorage.setItem("userServiceArea", String(locationData.inServiceArea));

        return locationData;
      } catch (err) {
        console.error("Error processing location:", err);
        setError("लोकेशन प्रोसेस करने में असमर्थ। कृपया बाद में प्रयास करें।");
        return undefined; // त्रुटि पर undefined लौटाएं
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

          try {
            // processLocation को कॉल करें
            await processLocation(latitude, longitude);

          } catch {
            setError("लोकेशन प्रोसेस करने में असमर्थ।");
          } finally {
            // setLoadingLocation अब processLocation के finally ब्लॉक में सेट होता है
          }
        },
        (geoError) => {
          console.error("Geolocation Error:", geoError);
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

  // --- Load saved addresses ---
  const loadSavedAddresses = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setSavedAddresses([]);
      // setError("पते लोड करने के लिए कृपया लॉग इन करें।"); // वैकल्पिक
      return;
    }

    try {
      const response = await axios.get<ProcessedLocation[]>(
        `${API_BASE_URL}/api/addresses/user`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSavedAddresses(response.data);
      
      // ✅ FIX 3: यदि current location सेट नहीं है, तो default address को सेट करें
      if (currentLocation === null || currentLocation.lat === 0) {
        const defaultAddress = response.data.find(addr => addr.isDefault);
        if (defaultAddress) {
            setSelectedAddress(defaultAddress); 
        }
      }

    } catch (err) {
      console.error("Error loading saved addresses:", err);
      setError("सहेजे गए पते लोड करने में असमर्थ।");
    }
  }, [API_BASE_URL, getAuthToken, currentLocation, setSelectedAddress]);


  // --- Select a saved address ---
  const setSelectedAddress = useCallback((address: ProcessedLocation) => {
    // 🛑 FIX 4: सुनिश्चित करें कि lat/lng नंबर हैं
    if (typeof address.lat !== 'number' || typeof address.lng !== 'number') return;
    
    // addressLine1 और city का उपयोग करके बेहतर पता स्ट्रिंग बनाएं
    const addressString = address.addressLine1 && address.city 
        ? `${address.addressLine1}, ${address.city} - ${address.pincode ?? ""}`
        : address.address; // Fallback to full address

    const updatedAddress: ProcessedLocation = {
      ...address,
      address: addressString, // अपडेटेड स्ट्रिंग को address में स्टोर करें
      inServiceArea: true, // सेव किया गया पता सर्विस एरिया में माना जाता है
    };

    setCurrentLocation(updatedAddress);
    
    // localStorage अपडेट करें
    localStorage.setItem("userLat", String(updatedAddress.lat));
    localStorage.setItem("userLng", String(updatedAddress.lng));
    localStorage.setItem("userAddress", addressString);
    localStorage.setItem("userPincode", updatedAddress.pincode);
    localStorage.setItem("userServiceArea", String(true)); 

  }, []);

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
          // अन्य आवश्यक फ़ील्ड्स को यहाँ न जोड़ें, वे तब तक undefined रहेंगे
        });
        setLoadingLocation(false);
      } else {
        // यदि कोई संग्रहीत (stored) स्थान नहीं है, तो जियोलोकेशन से प्राप्त करें
        await fetchCurrentGeolocation();
      }
    };

    loadInitialLocation();
    // लोड होने के बाद, सहेजे गए पते भी लोड करें (ताकि वे Modal में दिखाई दें)
    // loadSavedAddresses(); // इसे useEffect के बाहर कॉल करने पर अनंत लूप हो सकता है, इसलिए इसे केवल Modal में ही कॉल करें

  }, [fetchCurrentGeolocation]);

  const contextValue = useMemo(
    () => ({
      currentLocation,
      setCurrentLocation,
      loadingLocation,
      setLoadingLocation,
      error,
      fetchCurrentGeolocation,
      processLocation,
      savedAddresses,
      loadSavedAddresses,
      setSelectedAddress,
      // 🛑 FIX 5: अनावश्यक fields हटा दिए गए
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
    <LocationContext.Provider value={contextValue as LocationContextType}>
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
