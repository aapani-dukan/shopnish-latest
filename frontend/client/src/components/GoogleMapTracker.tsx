import React, { useMemo } from 'react';
import {
  GoogleMap,
  MarkerF,
  useJsApiLoader,
} from '@react-google-maps/api';
import { Truck, MapPin, Store } from 'lucide-react'; 

// ----------------------------
// Interfaces (Multi-Batch Tracking)
// ----------------------------

// ग्राहक का अंतिम गंतव्य (lat/lng अनिवार्य है)
interface CustomerLocation {
  lat: number;
  lng: number;
  address?: string;
}

// डिलीवरी बॉय की लाइव/अंतिम लोकेशन
interface DeliveryBoyTracker {
  id: number;
  batchId: number | string;
  currentLocation: { lat: number; lng: number };
  name: string;
}

// स्टोर लोकेशन
interface StoreTracker {
  lat: number;
  lng: number;
  name: string;
}

interface GoogleMapTrackerProps {
  customerAddress: CustomerLocation; 
  deliveryBoys: DeliveryBoyTracker[]; // 👈 एकाधिक डिलीवरी बॉय
  stores: StoreTracker[]; // 👈 एकाधिक स्टोर
}

const containerStyle = { width: '100%', height: '100%' };
const LIBRARIES: ('places' | 'geometry' | 'drawing' | 'localContext' | 'visualization' | 'marker')[] = [
    'marker' // 'marker' लाइब्रेरी को सही ढंग से टाइप किया गया
];
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// ----------------------------
// Component Logic
// ----------------------------

const GoogleMapTracker: React.FC<GoogleMapTrackerProps> = ({ 
    customerAddress, 
    deliveryBoys, 
    stores 
}) => {
  
  // 1. Google Maps Loader
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  // 2. Marker Icons (useMemo)
  const { bikeIcon, homeIcon, storeIcon } = useMemo(() => {
    if (!isLoaded || !window.google?.maps) {
        return { bikeIcon: undefined, homeIcon: undefined, storeIcon: undefined }; 
    }
    
    // 🏍️ डिलीवरी बॉय आइकॉन 
    const BIKE_ICON: google.maps.Icon = {
      url: 'https://cdn-icons-png.freepik.com/512/3233/3233076.png', 
      scaledSize: new window.google.maps.Size(35, 35),
      anchor: new window.google.maps.Point(18, 35), 
    };
    
    // 🏠 ग्राहक आइकॉन 
    const HOME_ICON: google.maps.Icon = {
      url: 'https://maps.gstatic.com/mapfiles/ms/micons/blue-dot.png',
      scaledSize: new window.google.maps.Size(32, 32),
    };

    // 🏪 स्टोर आइकॉन
    const STORE_ICON: google.maps.Icon = {
        url: 'https://maps.gstatic.com/mapfiles/ms/micons/store.png',
        scaledSize: new window.google.maps.Size(32, 32),
    };
    
    return { bikeIcon: BIKE_ICON, homeIcon: HOME_ICON, storeIcon: STORE_ICON };
  }, [isLoaded]);


  // 3. Map Options and Center
  const center = useMemo(() => {
    // 🛑 FIX 1: सुनिश्चित करें कि lat/lng नंबर हैं, नहीं तो डिफॉल्ट पर फॉलबैक करें
    const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // Example: Center of India (fallback)

    if (
        typeof customerAddress.lat === 'number' && isFinite(customerAddress.lat) &&
        typeof customerAddress.lng === 'number' && isFinite(customerAddress.lng)
    ) {
        return { lat: customerAddress.lat, lng: customerAddress.lng };
    }
    return defaultCenter;

  }, [customerAddress]);
  
  const mapOptions = useMemo(() => ({
    mapId: 'SHOPNISH_MULTI_TRACKER_MAP',
    disableDefaultUI: false,
    zoom: 14,
    center: center,
  }), [center]);


  // 4. Guards
  if (loadError) return <div>नक्शा लोड नहीं हो पाया: {String(loadError)}</div>;
  if (!isLoaded) return <div>लोकेशन लोडिंग...</div>;
  
  // 5. Render
  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        // आप mapOptions में zoom को परिभाषित कर रहे हैं, इसलिए इसे यहाँ हटा सकते हैं या इसे 14 पर लॉक कर सकते हैं
        zoom={14} 
        options={mapOptions}
      >
        
        {/* 🏠 Customer Marker */}
        {/* 🛑 FIX 2: center object का उपयोग करें जो पहले ही चेक किया जा चुका है */}
        {homeIcon && (
          <MarkerF
            position={center} 
            icon={homeIcon}
            title="आपका डिलीवरी एड्रेस"
          />
        )}

        {/* 🏪 Store Markers (Loop) */}
        {storeIcon && stores.map((store, index) => (
            // 🛑 FIX 3: सुनिश्चित करें कि store location भी valid है
            (typeof store.lat === 'number' && typeof store.lng === 'number' && isFinite(store.lat) && isFinite(store.lng)) && (
                <MarkerF
                    key={`store-${index}`}
                    position={{ lat: store.lat, lng: store.lng }}
                    icon={storeIcon}
                    title={`Store: ${store.name}`}
                />
            )
        ))}

        {/* 🏍️ Delivery Boy Markers (Loop) */}
        {bikeIcon && deliveryBoys.map((db) => (
            // 🛑 FIX 4: सुनिश्चित करें कि DB location भी valid है
            (typeof db.currentLocation.lat === 'number' && typeof db.currentLocation.lng === 'number' && isFinite(db.currentLocation.lat) && isFinite(db.currentLocation.lng)) && (
                <MarkerF 
                    key={db.id} 
                    position={db.currentLocation} 
                    icon={bikeIcon} 
                    title={`डिलीवरी पार्टनर: ${db.name} (Batch #${db.batchId})`} 
                />
            )
        ))}
      </GoogleMap>

      {/* Summary Info */}
      <div className="absolute top-2 left-2 bg-white shadow-md rounded-lg p-2 text-sm font-medium text-gray-700">
        {/* 🛑 FIX 5: mapStores के बजाय stores का उपयोग करें */}
        <p><MapPin className="w-4 h-4 inline mr-1 text-blue-600"/> लोकेशन्स: {stores.length} स्टोर, 1 ग्राहक</p> 
        <p><Truck className="w-4 h-4 inline mr-1 text-purple-600"/> लाइव डिलीवरी: {deliveryBoys.length}</p>
      </div>
    </div>
  );
};

export default React.memo(GoogleMapTracker);
