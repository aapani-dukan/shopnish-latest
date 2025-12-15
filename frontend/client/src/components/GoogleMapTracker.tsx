import React, { useMemo } from 'react';
import {
  GoogleMap,
  MarkerF,
  useJsApiLoader,
} from '@react-google-maps/api';
import { Truck, MapPin, Store } from 'lucide-react'; // Lucide icons are placeholders

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
  deliveryBoys: DeliveryBoyTracker[]; // 👈 FIX: एकाधिक डिलीवरी बॉय
  stores: StoreTracker[]; // 👈 FIX: एकाधिक स्टोर
}

const containerStyle = { width: '100%', height: '100%' };
const LIBRARIES: ('places' | 'geometry' | 'drawing' | 'localContext' | 'visualization' | 'marker')[] = [
    'marker'
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

  // 2. Marker Icons (useMemo) - कस्टम SVG या PNG URL का उपयोग करें
  const { bikeIcon, homeIcon, storeIcon } = useMemo(() => {
    if (!isLoaded || !window.google?.maps) {
        return { bikeIcon: undefined, homeIcon: undefined, storeIcon: undefined }; 
    }
    
    // 🏍️ डिलीवरी बॉय आइकॉन (बैच-वाइज मार्कर)
    const BIKE_ICON: google.maps.Icon = {
      url: 'https://cdn-icons-png.freepik.com/512/3233/3233076.png', // या आपका कस्टम URL
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
    // मैप को ग्राहक के पते पर केंद्रित करें
    return { lat: customerAddress.lat, lng: customerAddress.lng };
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
        zoom={14}
        options={mapOptions}
      >
        
        {/* 🏠 Customer Marker */}
        {homeIcon && customerAddress.lat && customerAddress.lng && (
          <MarkerF
            position={{ lat: customerAddress.lat, lng: customerAddress.lng }}
            icon={homeIcon}
            title="आपका डिलीवरी एड्रेस"
          />
        )}

        {/* 🏪 Store Markers (Loop) */}
        {storeIcon && stores.map((store, index) => (
            <MarkerF
                key={`store-${index}`}
                position={{ lat: store.lat, lng: store.lng }}
                icon={storeIcon}
                title={`Store: ${store.name}`}
            />
        ))}

        {/* 🏍️ Delivery Boy Markers (Loop) */}
        {bikeIcon && deliveryBoys.map((db) => (
          <MarkerF 
            key={db.id} 
            position={db.currentLocation} 
            icon={bikeIcon} 
            title={`डिलीवरी पार्टनर: ${db.name} (Batch #${db.batchId})`} 
            // Delivery Boy पर क्लिक करने पर एक Info Window दिखा सकते हैं (अतिरिक्त सुविधा)
          />
        ))}
      </GoogleMap>

      {/* Summary Info */}
      <div className="absolute top-2 left-2 bg-white shadow-md rounded-lg p-2 text-sm font-medium text-gray-700">
        <p><MapPin className="w-4 h-4 inline mr-1 text-blue-600"/> Locations: {mapStores.length} Stores, 1 Customer</p>
        <p><Truck className="w-4 h-4 inline mr-1 text-purple-600"/> Live Deliveries: {deliveryBoys.length}</p>
      </div>
    </div>
  );
};

export default React.memo(GoogleMapTracker);
