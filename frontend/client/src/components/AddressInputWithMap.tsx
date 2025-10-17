// client/src/components/AddressInputWithMap.tsx

import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import {
  GoogleMap, // Renamed to GoogleMap
  MarkerF,   // Renamed to MarkerF
  useLoadScript,
  Autocomplete,
} from "@react-google-maps/api";
import { useLocation } from '../context/LocationContext'; // <-- नया इम्पोर्ट

const containerStyle = { width: "100%", height: "200px" };
const libraries: ("places")[] = ["places"];
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY; // Renamed for consistency

interface LatLngLiteral { // Renamed to LatLngLiteral
  lat: number;
  lng: number;
}

interface GeocodedLocation extends LatLngLiteral { // Renamed
  city: string;
  pincode: string;
}

interface AddressInputProps { // Renamed
  currentAddress: string;
  currentLocation: LatLngLiteral | null;
  onLocationUpdate: (address: string, location: GeocodedLocation) => void;
  // यदि यह एक मॉडल के अंदर है तो onClose फंक्शन
  onClose?: () => void; // <-- नया
}

// 🔹 Helper: geocoder से city और pincode निकालना
const extractCityAndPincode = (results: any) => { // Renamed
  let city = "";
  let pincode = "";

  if (results && results[0] && results[0].address_components) {
    results[0].address_components.forEach((component: any) => { // Renamed to forEach
      if (component.types.includes("postal_code")) {
        pincode = component.long_name;
      }
      if (component.types.includes("locality")) {
        if (!city) city = component.long_name;
      }
      if (component.types.includes("administrative_area_level_2")) {
        if (!city) city = component.long_name;
      }
    });
  }
  return { city: city || "", pincode: pincode || "" };
};

const AddressInputWithMap: React.FC<AddressInputProps> = ({ // Renamed
  currentAddress,
  currentLocation,
  onLocationUpdate,
  onClose, // <-- नया
}) => {
  const { isLoaded, loadError } = useLoadScript({ // Renamed
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "", // Renamed
    libraries: libraries,
  });

  const { processLocation, setLoadingLocation } = useLocation(); // <-- LocationContext से processLocation प्राप्त करें

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null); // Renamed

  const defaultCenter = useMemo(
    () => ({ lat: 20.5937, lng: 78.9629 }),
    []
  );
  const [mapCenter, setMapCenter] = useState<LatLngLiteral>( // Renamed
    currentLocation || defaultCenter
  );

  useEffect(() => {
    if (currentLocation) {
      setMapCenter(currentLocation);
    }
  }, [currentLocation]);

  // 🔹 Autocomplete से place चुनने पर
  const onPlaceChanged = useCallback(() => { // Renamed
    const place = autocompleteRef.current?.getPlace(); // Renamed
    if (place?.geometry?.location && place.formatted_address) {
      const newLat = place.geometry.location.lat(); // Renamed
      const newLng = place.geometry.location.lng(); // Renamed
      const newLocation: LatLngLiteral = { lat: newLat, lng: newLng }; // Renamed

      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ location: newLocation }, (results: any, status: any) => {
        if (status === "OK" && results[0]) { // "ok" to "OK"
          const { city, pincode } = extractCityAndPincode(results); // Renamed
          const updatedLocation: GeocodedLocation = { // Renamed
            ...newLocation,
            city,
            pincode,
          };
          onLocationUpdate(place.formatted_address, updatedLocation);
        }
      });
      setMapCenter(newLocation); // Renamed
    }
  }, [onLocationUpdate]);

  // 🔹 Marker drag होने पर
  const onMarkerDragEnd = useCallback( // Renamed
    (e: google.maps.MapMouseEvent) => { // Renamed
      const newLat = e.latLng?.lat(); // Renamed
      const newLng = e.latLng?.lng(); // Renamed
      if (newLat && newLng) {
        const newLocation: LatLngLiteral = { lat: newLat, lng: newLng }; // Renamed
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ location: newLocation }, (results: any, status: any) => {
          if (status === "OK" && results && results[0]) { // "ok" to "OK"
            const { city, pincode } = extractCityAndPincode(results); // Renamed
   
            const updatedLocation: GeocodedLocation = { // Renamed
              ...newLocation,
              city,
              pincode,
            };
            onLocationUpdate(results[0].formatted_address, updatedLocation);
          }
        });
        setMapCenter(newLocation); // Renamed
      }
    },
    [onLocationUpdate]
  );

  // 🔹 Current location बटन
  const handleGeolocation = useCallback(async () => { // Renamed & made async
    if (navigator.geolocation) {
      setLoadingLocation(true); // Loading context को अपडेट करें
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const newLat = pos.coords.latitude;
          const newLng = pos.coords.longitude;

          // **यहाँ बदलाव: सीधे `onLocationUpdate` को कॉल करने के बजाय, अब हम बैकएंड API को कॉल करेंगे**
          await processLocation(newLat, newLng); 
          if (onClose) onClose(); // मॉडल को बंद करें अगर यह मॉडल के अंदर है
          setLoadingLocation(false);
        },
        (error) => {
          console.error("Geolocation Error: ", error);
          // handleError("वर्तमान स्थान प्राप्त करने में असमर्थ।", error); // त्रुटि को हैंडल करने के लिए
          setLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, [processLocation, onClose, setLoadingLocation]); // Dependencies updated

  if (loadError) return <div>नक्शा लोड नहीं हो पाया। एपीआई कुंजी जाँचें।</div>;
  if (!isLoaded) return <div>लोकेशन लोडिंग...</div>;

  return (
    <div>
      {/* ✅ Autocomplete input */}
      <Autocomplete
        onLoad={(ref) => (autocompleteRef.current = ref)} // Renamed
        onPlaceChanged={onPlaceChanged} // Renamed
      >
        <input
          type="text"
          placeholder="डिलीवरी एड्रेस खोजें"
          defaultValue={currentAddress}  // ✅ value की जगह defaultValue
          style={{
            boxSizing: "border-box", // Renamed
            border: "1px solid #ccc",
            width: "100%",
            height: "40px",
            padding: "0 12px",
            borderRadius: "4px", // Renamed
            marginTop: "8px",    // Renamed
          }}
        />
      </Autocomplete>

      {/* ✅ Map + Marker */}
      <div style={{ marginTop: "10px" }}> {/* Renamed */}
        <GoogleMap
          mapContainerStyle={containerStyle} // Renamed
          center={mapCenter} // Renamed
          zoom={15}
        >
          {currentLocation && (
            <MarkerF // Renamed
              position={currentLocation}
              draggable={true}
              onDragEnd={onMarkerDragEnd} // Renamed
            />
          )}
        </GoogleMap>
      </div>

      {/* ✅ Current location button */}
      <button
        type="button"
        onClick={handleGeolocation} // Renamed
        style={{
          marginTop: "10px", // Renamed
          padding: "8px 15px",
          backgroundColor: "#4caf50", // Renamed
          color: "white",
          border: "none",
          borderRadius: "5px", // Renamed
          cursor: "pointer",
        }}
      >
        📍 मेरी वर्तमान लोकेशन का उपयोग करें
      </button>

      {/* Debug latlng */}
      {currentLocation && (
        <p style={{ fontSize: "12px", color: "#555" }}> {/* Renamed */}
          Lat: {currentLocation.lat.toFixed(5)}, Lng:{" "} {/* Renamed */}
          {currentLocation.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
};

export default AddressInputWithMap;
