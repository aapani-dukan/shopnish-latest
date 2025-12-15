// client/src/components/AddressInputWithMap.tsx

import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import {
  GoogleMap,
  MarkerF,
  useLoadScript,
  Autocomplete,
} from "@react-google-maps/api";
import { useLocation } from '@/context/LocationContext';

const containerStyle = { width: "100%", height: "200px" };
const libraries: ("places")[] = ["places"];
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
  onClose?: () => void;
}

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
  return { city, pincode };
};

const AddressInputWithMap: React.FC<AddressInputProps> = ({
  currentAddress,
  currentLocation,
  onLocationUpdate,
  onClose,
}) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    libraries: libraries,
  });

  const { processLocation, setLoadingLocation } = useLocation();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const defaultCenter = useMemo(
    () => ({ lat: 20.5937, lng: 78.9629 }),
    []
  );

  const [mapCenter, setMapCenter] = useState<LatLngLiteral>(
    currentLocation || defaultCenter
  );

  // ⭐ FIX ADDED: Address input as controlled component
  const [inputAddress, setInputAddress] = useState(currentAddress);

  // ⭐ FIX — whenever parent sends new address → update input
  useEffect(() => {
    setInputAddress(currentAddress);
  }, [currentAddress]);

  useEffect(() => {
    if (currentLocation) {
      setMapCenter(currentLocation);
    }
  }, [currentLocation]);

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

  const handleGeolocation = useCallback(async () => {
    if (navigator.geolocation) {
      setLoadingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const newLat = pos.coords.latitude;
          const newLng = pos.coords.longitude;

          await processLocation(newLat, newLng);

          if (onClose) onClose();
          setLoadingLocation(false);
        },
        (error) => {
          console.error("Geolocation Error: ", error);
          setLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, [processLocation, onClose, setLoadingLocation]);

  if (loadError) return <div>नक्शा लोड नहीं हो पाया।</div>;
  if (!isLoaded) return <div>लोकेशन लोडिंग...</div>;

  return (
    <div>
      {/* Input + Autocomplete */}
      <Autocomplete
        onLoad={(ref) => (autocompleteRef.current = ref)}
        onPlaceChanged={onPlaceChanged}
      >
        <input
          type="text"
          placeholder="डिलीवरी एड्रेस खोजें"
          value={inputAddress}              // ⭐ FIX (controlled)
          onChange={(e) => setInputAddress(e.target.value)} // ⭐ FIX
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

      {/* Map */}
      <div style={{ marginTop: "10px" }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={15}
        >
          {mapCenter && (
            <MarkerF
              position={mapCenter}       // ⭐ FIX (previously currentLocation)
              draggable={true}
              onDragEnd={onMarkerDragEnd}
            />
          )}
        </GoogleMap>
      </div>

      {/* Current Location Button */}
      <button
        type="button"
        onClick={handleGeolocation}
        style={{
          marginTop: "10px",
          padding: "8px 15px",
          backgroundColor: "#4caf50",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        📍 मेरी वर्तमान लोकेशन का उपयोग करें
      </button>

      {currentLocation && (
        <p style={{ fontSize: "12px", color: "#555" }}>
          Lat: {currentLocation.lat?.toFixed(5)}, Lng: {currentLocation.lng?.toFixed(5)}
        </p>
      )}
    </div>
  );
};

export default AddressInputWithMap;
