// frontend/client/src/components/GoogleMapTracker.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GoogleMap,
  MarkerF,
  DirectionsService,
  DirectionsRenderer,
  useJsApiLoader,
} from '@react-google-maps/api';

// ----------------------------
// Interfaces and Constants (TypeScript Standards)
// ----------------------------

interface CustomerAddress {
  address: string;
  city: string;
  pincode: string;
  lat?: number; // Optional Lat/Lng for pre-geocoded addresses
  lng?: number; 
}

interface Location {
  lat: number;
  lng: number;
  timestamp?: string; // Delivery Boy Location
}

interface GoogleMapTrackerProps {
  // deliveryBoyLocation को Location interface का उपयोग करना चाहिए
  deliveryBoyLocation: Location | null; 
  customerAddress: CustomerAddress; 
}

const containerStyle = { width: '100%', height: '300px' };
const LIBRARIES: ('places' | 'geometry' | 'drawing' | 'localContext' | 'visualization' | 'marker')[] = [
    'places', 
    'geometry', 
    'marker' // Marker लाइब्रेरी को सुनिश्चित करें यदि कस्टम मार्कर का उपयोग कर रहे हैं
];
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// ----------------------------
// Component Logic
// ----------------------------

const GoogleMapTracker: React.FC<GoogleMapTrackerProps> = ({ 
    customerAddress, 
    deliveryBoyLocation // Prop का उपयोग करें
}) => {
  // 'currentLocation' डिलीवरी बॉय की लोकेशन को स्टोर करेगा
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [distance, setDistance] = useState<string | null>(null);

  // 1. Google Maps Loader
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  // 2. Real-time GPS Tracking (useEffect)
  useEffect(() => {
    // अगर deliveryBoyLocation prop मौजूद है, तो उसका उपयोग करें और GPS Tracking न चलाएं
    if (deliveryBoyLocation) {
      setCurrentLocation(deliveryBoyLocation);
      return;
    }

    // अगर prop मौजूद नहीं है, तो (शायद) डिलीवरी बॉय खुद अपनी लोकेशन ट्रैक कर रहा है
    if (!navigator.geolocation) return;
    
    // प्रारंभिक स्थान
    navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }, (err) => console.error('Initial Geolocation error:', err), { enableHighAccuracy: true });

    // लगातार स्थान ट्रैक करें (वॉचर)
    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.error('Geolocation error:', err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    // क्लीनअप फ़ंक्शन
    return () => navigator.geolocation.clearWatch(watcher);
  }, [deliveryBoyLocation]);


  // 3. Destination (useMemo) - ग्राहक का पता LatLng या String में
  const destination = useMemo(() => {
    if (customerAddress.lat && customerAddress.lng) {
        return { lat: customerAddress.lat, lng: customerAddress.lng }; 
    }
    // यदि Lat/Lng उपलब्ध नहीं है, तो स्ट्रिंग पते का उपयोग करें (Google Geocodes it)
    return `${customerAddress.address}, ${customerAddress.city}, ${customerAddress.pincode}`;
  }, [customerAddress]);
  
  // 4. Directions Callback (useCallback)
  const directionsCallback = useCallback(
    (response: google.maps.DirectionsResult | null) => {
      if (response && response.status === 'OK') {
        setDirectionsResponse(response);
        const leg = response.routes[0].legs[0];
        if (leg?.distance?.text) {
          setDistance(leg.distance.text);
        }
      } else if (response) {
        console.error('Directions failed:', response.status);
        setDirectionsResponse(null);
      }
    },
    []
  );

  // 5. Marker Icons (useMemo) - केवल एक बार लोड होने पर परिभाषित करें
  const { bikeIcon, homeIcon } = useMemo(() => {
    if (!isLoaded || !window.google?.maps) {
        return { bikeIcon: undefined, homeIcon: undefined }; 
    }
    
    // 🏍️ डिलीवरी बॉय आइकॉन
    const BIKE_ICON: google.maps.Icon = {
      url: 'https://raw.githubusercontent.com/aapani-dukan/shopnish-xyz/main/dist/public/assets/pngtree-delivery-bike-black-icon-vector-png-image_12551154.png', 
      scaledSize: new window.google.maps.Size(40, 40),
      anchor: new window.google.maps.Point(20, 40), 
    };
    
    // 🏠 ग्राहक आइकॉन 
    const HOME_ICON: google.maps.Icon = {
      url: 'https://maps.gstatic.com/mapfiles/ms/micons/blue-dot.png',
      scaledSize: new window.google.maps.Size(32, 32),
    };
    
    return { bikeIcon: BIKE_ICON, homeIcon: HOME_ICON };
  }, [isLoaded]);


  // 6. Guards and Options
  if (loadError) return <div>नक्शा लोड नहीं हो पाया: {String(loadError)}</div>;
  if (!isLoaded) return <div>लोकेशन लोडिंग...</div>;
  // यदि currentLocation अभी भी null है (यानी, GPS से भी प्राप्त नहीं हो सका)
  if (!currentLocation) return <div>आपकी लोकेशन प्राप्त हो रही है...</div>; 

  const mapOptions = useMemo(() => ({
    mapId: 'SHOPNISH_TRACKER_MAP',
    disableDefaultUI: false,
    zoom: 14, // Zoom level को स्थिर करें
    center: currentLocation, // Map का केंद्र
  }), [currentLocation]);
  
  // ग्राहक का अंतिम स्थान (DirectionsRenderer से)
  const customerLatLngFromDirections = directionsResponse?.routes[0]?.legs[0]?.end_location;

  // 7. Render
  return (
    <div className="relative w-full h-[300px]">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={currentLocation} // यह currentLocation useMemo से आ रहा है
        zoom={14}
        options={mapOptions}
      >
        {/* Directions Service - जब दोनों लोकेशन मौजूद हों */}
        {currentLocation && destination && bikeIcon && homeIcon && (
          <DirectionsService
            options={{
              origin: currentLocation,
              destination: destination,
              travelMode: window.google.maps.TravelMode.DRIVING, 
            }}
            callback={directionsCallback}
          />
        )}

        {/* Directions Renderer */}
        {directionsResponse && (
          <DirectionsRenderer
            options={{
              directions: directionsResponse,
              suppressMarkers: true, // कस्टम मार्कर का उपयोग करने के लिए true
              polylineOptions: {
                strokeColor: '#2563eb',
                strokeWeight: 5,
              },
            }}
          />
        )}
        
        {/* Delivery Boy Marker */}
        {bikeIcon && (
          <MarkerF 
            position={currentLocation} 
            icon={bikeIcon} 
            title="डिलीवरी पार्टनर" 
          />
        )}
        
        {/* Customer Marker - DirectionsRenderer के end_location का उपयोग करें यदि उपलब्ध हो, या prop का*/}
        {homeIcon && (customerLatLngFromDirections || (customerAddress.lat && customerAddress.lng)) && (
          <MarkerF
            position={customerLatLngFromDirections || {lat: customerAddress.lat!, lng: customerAddress.lng!}}
            icon={homeIcon}
            title="ग्राहक लोकेशन"
          />
        )}
      </GoogleMap>

      {/* Distance Info */}
      {distance && (
        <div className="absolute bottom-2 right-2 bg-white shadow-md rounded-lg px-3 py-1 text-sm font-medium text-gray-700">
          दूरी: {distance}
        </div>
      )}
    </div>
  );
};

export default React.memo(GoogleMapTracker);
