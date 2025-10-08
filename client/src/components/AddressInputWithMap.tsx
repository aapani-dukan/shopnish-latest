// client/src/components/AddressInputWithMap.tsx

import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import {
  GoogleMap,
  MarkerF,
  useLoadScript,
  Autocomplete,
} from "@react-google-maps/api";

const containerStyle = { width: "100%", height: "200px" };
const LIBRARIES: ("places")[] = ["places"];
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

interface LatLngLiteral {
  lat: number;
  lng: number;
}

interface GeocodedLocation extends LatLngLiteral {
  city: string;
  pincode: string;
}

interface AddressInputProps {
  currentAddress: string;
  currentLocation: LatLngLiteral | null;
  onLocationUpdate: (address: string, location: GeocodedLocation) => void;
}

// 🔹 Helper: Geocoder से City और Pincode निकालना
const extractCityAndPincode = (results: any) => {
  let city = "";
  let pincode = "";

  if (results && results[0] && results[0].address_components) {
    results[0].address_components.forEach((component: any) => {
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

const AddressInputWithMap: React.FC<AddressInputProps> = ({
  currentAddress,
  currentLocation,
  onLocationUpdate,
}) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const defaultCenter = useMemo(
    () => ({ lat: 20.5937, lng: 78.9629 }),
    []
  );
  const [mapCenter, setMapCenter] = useState<LatLngLiteral>(
    currentLocation || defaultCenter
  );

  useEffect(() => {
    if (currentLocation) {
      setMapCenter(currentLocation);
    }
  }, [currentLocation]);

  // 🔹 Autocomplete से place चुनने पर
  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (place?.geometry?.location && place.formatted_address) {
      const newLat = place.geometry.location.lat();
      const newLng = place.geometry.location.lng();
      const newLocation: LatLngLiteral = { lat: newLat, lng: newLng };

      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ location: newLocation }, (results: any, status: any) => {
        if (status === "OK" && results[0]) {
          const { city, pincode } = extractCityAndPincode(results);
          const updatedLocation: GeocodedLocation = {
            ...newLocation,
            city,
            pincode,
          };
          onLocationUpdate(place.formatted_address, updatedLocation);
        }
      });
      setMapCenter(newLocation);
    }
  }, [onLocationUpdate]);

  // 🔹 Marker drag होने पर
  const onMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const newLat = e.latLng?.lat();
      const newLng = e.latLng?.lng();
      if (newLat && newLng) {
        const newLocation: LatLngLiteral = { lat: newLat, lng: newLng };
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ location: newLocation }, (results: any, status: any) => {
          if (status === "OK" && results && results[0]) {
   const { city, pincode } = extractCityAndPincode(results);
   
            const updatedLocation: GeocodedLocation = {
              ...newLocation,
              city,
              pincode,
            };
            onLocationUpdate(results[0].formatted_address, updatedLocation);
          }
        });
        setMapCenter(newLocation);
      }
    },
    [onLocationUpdate]
  );

  // 🔹 Current location बटन
  const handleGeolocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const newLocation: LatLngLiteral = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ location: newLocation }, (results: any, status: any) => {
           {
            if (status === "OK" && results && results[0]) {
   const { city, pincode } = extractCityAndPincode(results);
           }
            const updatedLocation: GeocodedLocation = {
              ...newLocation,
              city,
              pincode,
            };
            onLocationUpdate(results[0].formatted_address, updatedLocation);
          }
        });
        setMapCenter(newLocation);
      });
    }
  }, [onLocationUpdate]);

  if (loadError) return <div>नक्शा लोड नहीं हो पाया। API कुंजी जाँचें।</div>;
  if (!isLoaded) return <div>लोकेशन लोडिंग...</div>;

  return (
    <div>
      {/* ✅ Autocomplete Input */}
      <Autocomplete
        onLoad={(ref) => (autocompleteRef.current = ref)}
        onPlaceChanged={onPlaceChanged}
      >
        <input
  type="text"
  placeholder="डिलीवरी एड्रेस खोजें"
  defaultValue={currentAddress}  // ✅ value की जगह defaultValue
  style={{
    boxSizing: "border-box",
    border: "1px solid #ccc",
    width: "100%",
    height: "40px",
    padding: "0 12px",
    borderRadius: "4px",
    marginTop: "8px",
  }}
/>
      </Autocomplete>

      {/* ✅ Map + Marker */}
      <div style={{ marginTop: "10px" }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={15}
        >
          {currentLocation && (
            <MarkerF
              position={currentLocation}
              draggable={true}
              onDragEnd={onMarkerDragEnd}
            />
          )}
        </GoogleMap>
      </div>

      {/* ✅ Current Location Button */}
      <button
        type="button"
        onClick={handleGeolocation}
        style={{
          marginTop: "10px",
          padding: "8px 15px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        📍 मेरी वर्तमान लोकेशन का उपयोग करें
      </button>

      {/* Debug LatLng */}
      {currentLocation && (
        <p style={{ fontSize: "12px", color: "#555" }}>
          Lat: {currentLocation.lat.toFixed(5)}, Lng:{" "}
          {currentLocation.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
};

export default AddressInputWithMap;
