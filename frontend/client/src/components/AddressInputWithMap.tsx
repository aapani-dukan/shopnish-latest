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

// पिनकोड और सिटी निकालने का सहायक फ़ंक्शन
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

  // 🛑 FIX: mapCenter को सुरक्षित रूप से आरंभ करें
  const [mapCenter, setMapCenter] = useState<LatLngLiteral>(() => {
    if (currentLocation && isFinite(currentLocation.lat) && isFinite(currentLocation.lng)) {
      return currentLocation;
    }
    return defaultCenter;
  });

  const [inputAddress, setInputAddress] = useState(currentAddress);

  // Parent से नया address आने पर inputAddress को अपडेट करें
  useEffect(() => {
    setInputAddress(currentAddress);
  }, [currentAddress]);

  // Parent से नई location आने पर mapCenter को अपडेट करें
  useEffect(() => {
    if (currentLocation && isFinite(currentLocation.lat) && isFinite(currentLocation.lng)) {
      setMapCenter(currentLocation);
    }
  }, [currentLocation]);

  // Autocomplete से चयन होने पर
  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (place?.geometry?.location && place.formatted_address) {
      const newLat = place.geometry.location.lat();
      const newLng = place.geometry.location.lng();
      const newLocation: LatLngLiteral = { lat: newLat, lng: newLng };

      // Geocoder की आवश्यकता है क्योंकि place ऑब्जेक्ट में हमेशा address_components नहीं होते हैं।
      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ location: newLocation }, (results: any, status: any) => {
        if (status === "OK" && results && results[0]) {
          const { city, pincode } = extractCityAndPincode(results);
          const updatedLocation: GeocodedLocation = {
            ...newLocation,
            city,
            pincode,
          };
          // 🛑 FIX: onLocationUpdate को कॉल करें
          onLocationUpdate(results[0].formatted_address, updatedLocation); 
        }
      });

      setMapCenter(newLocation);
    }
  }, [onLocationUpdate]);

  // मार्कर को ड्रैग करने पर
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
            // 🛑 FIX: onLocationUpdate को कॉल करें
            onLocationUpdate(results[0].formatted_address, updatedLocation);
          }
        });

        setMapCenter(newLocation);
      }
    },
    [onLocationUpdate]
  );

  // मेरी वर्तमान लोकेशन का उपयोग करें
// मेरी वर्तमान लोकेशन का उपयोग करें
const handleGeolocation = useCallback(async () => {
  if (navigator.geolocation) {
    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;

        console.log("📍 GPS से कोर्डिनेट्स मिले:", newLat, newLng);

        // ✅ सुधार 1: कोर्डिनेट्स मिलते ही तुरंत मैप को वहां ले जाएं 
        // ताकि यूजर को तुरंत फीडबैक मिले, भले ही एड्रेस आने में 2 सेकंड लगे
        setMapCenter({ lat: newLat, lng: newLng });

        try {
          // ✅ सुधार 2: बैकएंड API को कॉल करना
          const result = await processLocation(newLat, newLng); 
          
          if (result && result.address && result.location) {
            onLocationUpdate(result.address, result.location as GeocodedLocation); 
            setInputAddress(result.address);
            console.log("🏠 एड्रेस सफलतापूर्वक मिल गया:", result.address);
          }
        } catch (apiError) {
          console.error("API Error (Reverse Geocoding failed):", apiError);
          alert("कोर्डिनेट्स तो मिल गए, लेकिन एड्रेस लोड नहीं हो पाया। कृपया मैन्युअल रूप से टाइप करें।");
        }

        // लोडिंग बंद करें
        setLoadingLocation(false);
        if (onClose) onClose();
      },
      (error) => {
        console.error("Geolocation Error Details: ", error);
        setLoadingLocation(false);

        // ✅ सुधार 3: एरर के अनुसार सही मैसेज
        if (error.code === 1) {
          alert("Permission Denied: कृपया ब्राउज़र की सेटिंग्स में लोकेशन 'Allow' करें।");
        } else if (error.code === 3) {
          alert("Timeout: लोकेशन खोजने में बहुत समय लग रहा है। कृपया दोबारा कोशिश करें या अच्छे नेटवर्क में जाएं।");
        } else {
          alert("लोकेशन ढूंढने में समस्या हुई। कृपया एड्रेस टाइप करें।");
        }
      },
      { 
        // ✅ सुधार 4: सेटिंग्स को बैलेंस करना
        enableHighAccuracy: false, // इसे false रखें ताकि WiFi/टावर से जल्दी लोकेशन मिले
        timeout: 20000,            // समय बढ़ाकर 20 सेकंड किया ताकि '0' से खोजने में आसानी हो
        maximumAge: 10000          // 10 सेकंड पुरानी लोकेशन कैश से ले सकता है (स्पीड के लिए)
      }
    );
  } else {
    alert("आपका ब्राउज़र Geolocation सपोर्ट नहीं करता है।");
  }
}, [processLocation, onClose, setLoadingLocation, onLocationUpdate]);
  
      },
      (error) => {
        console.error("Geolocation Error: ", error);
        if (error.code === 1) {
          alert("कृपया ब्राउज़र सेटिंग्स में लोकेशन 'Allow' करें।");
        } else {
          alert("लोकेशन ढूंढने में समय लग रहा है। कृपया फिर से कोशिश करें।");
        }
        setLoadingLocation(false);
      },
      { 
        enableHighAccuracy: false, // 🎯 इसे false रखने से मोबाइल टावर/WiFi से जल्दी लोकेशन मिलती है
        timeout: 15000,            // ⏳ 15 सेकंड का समय दें
        maximumAge: 0 
      }
    );
  }
}, [processLocation, onClose, setLoadingLocation, onLocationUpdate]);
  
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
          value={inputAddress}
          onChange={(e) => setInputAddress(e.target.value)} 
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
          // 🛑 FIX: mapCenter को सुरक्षित रूप से पास करें
          center={mapCenter}
          zoom={15}
        >
          {/* mapCenter की जाँच पहले ही useState initialization में हो चुकी है */}
          <MarkerF
            position={mapCenter}
            draggable={true}
            onDragEnd={onMarkerDragEnd}
          />
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

      {/* Lat/Lng Display */}
      {currentLocation && (
        <p style={{ fontSize: "12px", color: "#555" }}>
          Lat: {currentLocation.lat?.toFixed(5)}, Lng: {currentLocation.lng?.toFixed(5)}
        </p>
      )}
    </div>
  );
};

export default AddressInputWithMap;
