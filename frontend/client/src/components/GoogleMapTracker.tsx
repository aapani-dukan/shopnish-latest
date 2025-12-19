import React, { useMemo } from 'react';
import {
  GoogleMap,
  MarkerF,
  useJsApiLoader,
} from '@react-google-maps/api';
import { Truck, MapPin } from 'lucide-react';

// ----------------------------
// Interfaces (Multi-Batch Tracking)
// ----------------------------

interface CustomerLocation {
  lat: number;
  lng: number;
  address?: string;
}

interface DeliveryBoyTracker {
  id: number;
  batchId: number | string;
  currentLocation: { lat: number; lng: number };
  name: string;
}

interface StoreTracker {
  lat: number;
  lng: number;
  name: string;
}

interface GoogleMapTrackerProps {
  customerAddress: CustomerLocation; 
  deliveryBoys: DeliveryBoyTracker[];
  stores: StoreTracker[];
}

// ----------------------------
// Config
// ----------------------------
const containerStyle = { width: '100%', height: '100%' };
const LIBRARIES: ('places' | 'geometry' | 'drawing' | 'localContext' | 'visualization' | 'marker')[] = [
    'marker'
];
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// ----------------------------
// Component
// ----------------------------
const GoogleMapTracker: React.FC<GoogleMapTrackerProps> = ({ 
    customerAddress, 
    deliveryBoys, 
    stores 
}) => {

  // 1️⃣ Google Maps Loader
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  // 2️⃣ Marker Icons
  const { bikeIcon, homeIcon, storeIcon } = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return { bikeIcon: undefined, homeIcon: undefined, storeIcon: undefined };

    const BIKE_ICON: google.maps.Icon = {
      url: 'https://cdn-icons-png.freepik.com/512/3233/3233076.png',
      scaledSize: new window.google.maps.Size(35, 35),
      anchor: new window.google.maps.Point(18, 35),
    };

    const HOME_ICON: google.maps.Icon = {
      url: 'https://maps.gstatic.com/mapfiles/ms/micons/blue-dot.png',
      scaledSize: new window.google.maps.Size(32, 32),
    };

    const STORE_ICON: google.maps.Icon = {
      url: 'https://maps.gstatic.com/mapfiles/ms/micons/store.png',
      scaledSize: new window.google.maps.Size(32, 32),
    };

    return { bikeIcon: BIKE_ICON, homeIcon: HOME_ICON, storeIcon: STORE_ICON };
  }, [isLoaded]);

  // 3️⃣ Map Center
  const center = useMemo(() => {
    const defaultCenter = { lat: 20.5937, lng: 78.9629 }; // fallback India

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
    center,
  }), [center]);

  // 4️⃣ Guards
  if (loadError) return <div>नक्शा लोड नहीं हो पाया: {String(loadError)}</div>;
  if (!isLoaded) return <div>लोकेशन लोडिंग...</div>;

  // 5️⃣ Render
  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={14}
        options={mapOptions}
      >
        {/* Customer */}
        {homeIcon && (
          <MarkerF
            position={center}
            icon={homeIcon}
            title="आपका डिलीवरी एड्रेस"
          />
        )}

        {/* Stores */}
        {storeIcon && stores.map((store, index) => (
          typeof store.lat === 'number' && typeof store.lng === 'number' && isFinite(store.lat) && isFinite(store.lng) && (
            <MarkerF
              key={`store-${index}`}
              position={{ lat: store.lat, lng: store.lng }}
              icon={storeIcon}
              title={`Store: ${store.name}`}
            />
          )
        ))}

        {/* Delivery Boys */}
        {bikeIcon && deliveryBoys.map((db) => (
          typeof db.currentLocation.lat === 'number' && typeof db.currentLocation.lng === 'number' && isFinite(db.currentLocation.lat) && isFinite(db.currentLocation.lng) && (
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
        <p><MapPin className="w-4 h-4 inline mr-1 text-blue-600"/> लोकेशन्स: {stores.length} स्टोर, 1 ग्राहक</p> 
        <p><Truck className="w-4 h-4 inline mr-1 text-purple-600"/> लाइव डिलीवरी: {deliveryBoys.length}</p>
      </div>
    </div>
  );
};

export default React.memo(GoogleMapTracker);
