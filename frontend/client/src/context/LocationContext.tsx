// client/src/context/LocationContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import axios from 'axios';

// --- Interfaces for Location Data ---
interface LatLng {
    lat: number;
    lng: number;
}

interface ProcessedLocation extends LatLng {
    address: string;
    pincode: string;
    inServiceArea: boolean;
    deliveryCharges?: number | null; // Optional, as it comes from backend
    id?: number; // For saved addresses
    // Add other fields from deliveryAddressesPgTable if needed for saved addresses
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
    setCurrentLocation: React.Dispatch<React.SetStateAction<ProcessedLocation | null>>;
    loadingLocation: boolean;
    error: string | null;
    fetchCurrentGeolocation: () => Promise<void>;
    processLocation: (lat: number, long: number) => Promise<void>;
    savedAddresses: ProcessedLocation[]; // Saved addresses from backend
    loadSavedAddresses: () => Promise<void>;
    setSelectedAddress: (address: ProcessedLocation) => void;
    setLoadingLocation: React.Dispatch<React.SetStateAction<boolean>>; // Added for AddressInputWithMap
}

// Default context value (useful for initial setup or without provider)
const LocationContext = createContext<LocationContextType | undefined>(undefined);

// --- Provider Component ---
interface LocationProviderProps {
    children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
    const [currentLocation, setCurrentLocation] = useState<ProcessedLocation | null>(null);
    const [savedAddresses, setSavedAddresses] = useState<ProcessedLocation[]>([]);
    const [loadingLocation, setLoadingLocation] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://shopnish-seprate.onrender.com';

    // Helper to get auth token
    const getAuthToken = useCallback((): string | null => {
        // Implement your actual token retrieval logic here
        // e.g., from localStorage or a global auth state
        return localStorage.getItem('authToken'); 
    }, []);

    // --- 1. Load initial location from cache or fetch geolocation ---
    useEffect(() => {
        const loadInitialLocation = async () => {
            setLoadingLocation(true);
            setError(null);
            
            const storedLat = localStorage.getItem('userLat');
            const storedLong = localStorage.getItem('userLong');
            const storedAddress = localStorage.getItem('userAddress');
            const storedPincode = localStorage.getItem('userPincode');
            const storedServiceArea = localStorage.getItem('userServiceArea');

            if (storedLat && storedLong && storedAddress && storedPincode) {
                setCurrentLocation({
                    address: storedAddress,
                    pincode: storedPincode,
                    latitude: parseFloat(storedLat),
                    longitude: parseFloat(storedLong),
                    inServiceArea: storedServiceArea === 'true',
                });
                setLoadingLocation(false);
                return;
            }

            await fetchCurrentGeolocation();
        };

        loadInitialLocation();
    }, [getAuthToken]); // Rerun if auth token changes (e.g., user logs in)
        // --- 3. Process location via backend API (for service area check & full address) ---
    const processLocation = useCallback(async (lat: number, long: number) => {
        setLoadingLocation(true);
        setError(null);
        try {
            const response = await axios.post<ProcessedLocation>(`${API_BASE_URL}/addresses/process-current-location`, {
                latitude: lat,
                longitude: long,
            });
            const data = response.data;
            setCurrentLocation(data);
            
            localStorage.setItem('userLat', String(data.latitude));
            localStorage.setItem('userLong', String(data.longitude));
            localStorage.setItem('userAddress', data.address);
            localStorage.setItem('userPincode', data.pincode);
            localStorage.setItem('userServiceArea', String(data.inServiceArea));

        } catch (err) {
            console.error("Error processing location:", err);
            setError("लोकेशन प्रोसेस करने में असमर्थ।");
        } finally {
            setLoadingLocation(false);
        }
    }, [API_BASE_URL]);

    // --- 2. Fetch current geolocation from browser ---
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



    // --- 4. Load saved addresses (when user is logged in) ---
    const loadSavedAddresses = useCallback(async () => {
        const token = getAuthToken();
        if (!token) {
            // setError("कृपया लॉग इन करें ताकि आपके सहेजे गए पते दिख सकें।");
            setSavedAddresses([]); // Clear saved addresses if not logged in
            return;
        }

        try {
            const response = await axios.get<ProcessedLocation[]>(`${API_BASE_URL}/addresses/user`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSavedAddresses(response.data);
        } catch (err) {
            console.error("Error loading saved addresses:", err);
            setError("सहेजे गए पते लोड करने में असमर्थ।");
        }
    }, [API_BASE_URL, getAuthToken]);

    // --- 5. Set a saved address as current/selected ---
    const setSelectedAddress = useCallback((address: ProcessedLocation) => {
        setCurrentLocation(address);
        // Save to local storage
        localStorage.setItem('userLat', String(address.latitude));
        localStorage.setItem('userLong', String(address.longitude));
        localStorage.setItem('userAddress', address.addressLine1 ? `${address.addressLine1}, ${address.city} - ${address.postalCode}` : address.address);
        localStorage.setItem('userPincode', address.pincode);
        localStorage.setItem('userServiceArea', String(true)); // Saved addresses are assumed to be in service area
    }, []);

    // Provide context values
    const contextValue = useMemo(() => ({
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
    }), [
        currentLocation,
        loadingLocation,
        error,
        fetchCurrentGeolocation,
        processLocation,
        savedAddresses,
        loadSavedAddresses,
        setSelectedAddress,
        setLoadingLocation,
    ]);

    return (
        <LocationContext.Provider value={contextValue}>
            {children}
        </LocationContext.Provider>
    );
};

// Hook to consume the location context
export const useLocation = () => {
    const context = useContext(LocationContext);
    if (context === undefined) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};
      
