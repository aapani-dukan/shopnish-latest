import React, { useMemo, useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  MarkerF,
  Polyline,
  useJsApiLoader,
} from "@react-google-maps/api";
import { Truck, MapPin, Store as StoreIconLucide } from "lucide-react";

/* ==========================================================================
   INTERFACES & TYPES
   ========================================================================== */
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
  destination?: { lat: number; lng: number };
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

/* ==========================================================================
   CONFIG & HELPERS
   ========================================================================== */
const containerStyle = { width: "100%", height: "100%" };
const LIBRARIES: ("geometry" | "marker")[] = ["geometry", "marker"];
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// ✅ स्मूथ मूवमेंट के लिए इंटरपोलेशन फंक्शन
function interpolate(
  start: google.maps.LatLngLiteral,
  end: google.maps.LatLngLiteral,
  fraction: number
): google.maps.LatLngLiteral {
  return {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lng: start.lng + (end.lng - start.lng) * fraction,
  };
}

/* ==========================================================================
   MAIN COMPONENT
   ========================================================================== */
const GoogleMapTracker: React.FC<GoogleMapTrackerProps> = ({
  customerAddress,
  deliveryBoys,
  stores,
}) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const animatedPositions = useRef<Map<number, google.maps.LatLngLiteral>>(new Map());
  const [routes, setRoutes] = useState<{ dbId: number; path: google.maps.LatLngLiteral[]; eta: string }[]>([]);
  const [dashOffset, setDashOffset] = useState(0);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });

  // ✅ 1. प्रीमियम आइकन्स (HD Icons)
  const icons = useMemo(() => {
    if (!isLoaded || !window.google?.maps) return null;
    return {
      bike: {
        url: "https://cdn-icons-png.flaticon.com/512/3448/3448601.png", // High-end Rider Icon
        scaledSize: new window.google.maps.Size(45, 45),
        anchor: new window.google.maps.Point(22, 22),
      },
      home: {
        url: "https://cdn-icons-png.flaticon.com/512/1239/1239525.png",
        scaledSize: new window.google.maps.Size(35, 35),
      },
      store: {
        url: "https://cdn-icons-png.flaticon.com/512/606/606547.png",
        scaledSize: new window.google.maps.Size(35, 35),
      }
    };
  }, [isLoaded]);

  // ✅ 2. पॉलीलाइन एनीमेशन (दौड़ती हुई बिंदी)
  useEffect(() => {
    let animationFrame: number;
    const animateDash = () => {
      setDashOffset((prev) => (prev + 0.5) % 100);
      animationFrame = requestAnimationFrame(animateDash);
    };
    animateDash();
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  // ✅ 3. लाइव राउटिंग (Directions API)
  useEffect(() => {
    if (!isLoaded || !window.google || deliveryBoys.length === 0) return;
    const service = new window.google.maps.DirectionsService();

    deliveryBoys.forEach((db) => {
      if (!db.destination) return;
      service.route(
        {
          origin: db.currentLocation,
          destination: db.destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK" && result?.routes[0]) {
            const path = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
            setRoutes(prev => {
              const otherRoutes = prev.filter(r => r.dbId !== db.id);
              return [...otherRoutes, { dbId: db.id, path, eta: result.routes[0].legs[0].duration?.text || "" }];
            });
          }
        }
      );
    });
  }, [deliveryBoys, isLoaded]);

  // ✅ 4. ऑटो-फिट (Bounds)
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(customerAddress);
    stores.forEach(s => bounds.extend(s));
    deliveryBoys.forEach(d => bounds.extend(d.currentLocation));
    mapRef.current.fitBounds(bounds, { top: 80, right: 50, bottom: 50, left: 50 });
  }, [customerAddress, stores, deliveryBoys, isLoaded]);

  if (loadError) return <div className="h-full flex items-center justify-center bg-gray-100 text-red-500 font-bold">Map Error</div>;
  if (!isLoaded) return <div className="h-full w-full bg-gray-100 animate-pulse" />;

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        onLoad={(map) => (mapRef.current = map)}
        options={{
          disableDefaultUI: true,
          styles: silverMapStyle, // ✅ क्लीनर मैप लुक
          gestureHandling: "greedy"
        }}
      >
        {/* कस्टमर मार्कर */}
        <MarkerF position={customerAddress} icon={icons?.home} />

        {/* स्टोर मार्कर्स */}
        {stores.map((store, i) => (
          <MarkerF key={i} position={store} icon={icons?.store} title={store.name} />
        ))}

        {/* लाइव राइडर्स (Smooth Animation + Rotation) */}
        {deliveryBoys.map((db) => {
          const prevPos = animatedPositions.current.get(db.id) || db.currentLocation;
          const nextPos = db.currentLocation;
          animatedPositions.current.set(db.id, nextPos);

          // रोटेशन निकालें
          const heading = window.google.maps.geometry.spherical.computeHeading(
            new window.google.maps.LatLng(prevPos.lat, prevPos.lng),
            new window.google.maps.LatLng(nextPos.lat, nextPos.lng)
          );

          return (
            <MarkerF
              key={db.id}
              position={prevPos}
              icon={{
                ...icons?.bike,
                rotation: heading
              } as google.maps.Symbol}
              onLoad={(marker) => {
                let frame = 0;
                const totalFrames = 60; 
                const animate = () => {
                  frame++;
                  const pos = interpolate(prevPos, nextPos, frame / totalFrames);
                  marker.setPosition(pos);
                  if (frame < totalFrames) requestAnimationFrame(animate);
                };
                animate();
              }}
            />
          );
        })}

        {/* एनिमेटेड पॉलीलाइन्स (रूट्स) */}
        {routes.map((r) => (
          <React.Fragment key={r.dbId}>
            <Polyline
              path={r.path}
              options={{ strokeColor: "#8b5cf6", strokeOpacity: 0.2, strokeWeight: 6 }}
            />
            <Polyline
              path={r.path}
              options={{
                strokeColor: "#8b5cf6",
                strokeWeight: 6,
                icons: [{
                  icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 3, fillOpacity: 1, color: "#fff" },
                  offset: `${dashOffset}%`,
                }],
              }}
            />
          </React.Fragment>
        ))}
      </GoogleMap>

      {/* छोटा फ्लोटिंग इन्फो कार्ड */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-4 z-20">
        <div className="flex items-center gap-1 text-primary font-black text-xs uppercase tracking-tighter">
          <Truck size={14} /> {deliveryBoys.length} Riders
        </div>
        <div className="w-[1px] h-4 bg-gray-200" />
        <div className="flex items-center gap-1 text-gray-500 font-black text-xs uppercase tracking-tighter">
          <StoreIconLucide size={14} /> {stores.length} Stores
        </div>
      </div>
    </div>
  );
};

// क्लीन सिल्वर थीम स्टाइल
const silverMapStyle = [
  { featureType: "all", elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#e9e9e9" }] }
];

export default React.memo(GoogleMapTracker);
