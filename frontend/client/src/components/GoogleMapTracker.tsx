import React, { useMemo, useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  MarkerF,
  Polyline,
  useJsApiLoader,
} from "@react-google-maps/api";
import { Truck, MapPin } from "lucide-react";

/* =======================
   Interfaces
======================= */
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
  destination?: { lat: number; lng: number }; // optional for route
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

/* =======================
   Config
======================= */
const containerStyle = { width: "100%", height: "100%" };
const LIBRARIES: (
  | "places"
  | "geometry"
  | "drawing"
  | "localContext"
  | "visualization"
  | "marker"
)[] = ["geometry", "marker"];
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

/* =======================
   Component
======================= */
const GoogleMapTracker: React.FC<GoogleMapTrackerProps> = ({
  customerAddress,
  deliveryBoys,
  stores,
}) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const animatedPositions = useRef<Map<number, google.maps.LatLngLiteral>>(new Map());
  const [routes, setRoutes] = useState<
    { dbId: number; path: google.maps.LatLngLiteral[]; eta: string }[]
  >([]);
  const [dashOffset, setDashOffset] = useState(0);

  /* 1️⃣ Loader */
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });

  /* 2️⃣ Icons */
  const { bikeIcon, homeIcon, storeIcon } = useMemo(() => {
    if (!isLoaded || !window.google?.maps)
      return { bikeIcon: undefined, homeIcon: undefined, storeIcon: undefined };

    return {
      bikeIcon: {
        url: "https://cdn-icons-png.freepik.com/512/3233/3233076.png",
        scaledSize: new window.google.maps.Size(35, 35),
        anchor: new window.google.maps.Point(18, 35),
      } as google.maps.Icon,
      homeIcon: {
        url: "https://maps.gstatic.com/mapfiles/ms/micons/blue-dot.png",
        scaledSize: new window.google.maps.Size(32, 32),
      } as google.maps.Icon,
      storeIcon: {
        url: "https://maps.gstatic.com/mapfiles/ms/micons/store.png",
        scaledSize: new window.google.maps.Size(32, 32),
      } as google.maps.Icon,
    };
  }, [isLoaded]);

  /* 3️⃣ Center */
  const fallbackCenter = { lat: 20.5937, lng: 78.9629 };
  const center = useMemo(() => {
    if (
      typeof customerAddress.lat === "number" &&
      typeof customerAddress.lng === "number" &&
      isFinite(customerAddress.lat) &&
      isFinite(customerAddress.lng)
    ) {
      return customerAddress;
    }
    return fallbackCenter;
  }, [customerAddress]);

  /* 4️⃣ Animate Polyline Dash */
  useEffect(() => {
    const animateDash = () => {
      setDashOffset((prev) => (prev + 1) % 20);
      requestAnimationFrame(animateDash);
    };
    animateDash();
  }, []);

  /* 5️⃣ Fetch Routes (Google Directions API, free plan) */
  useEffect(() => {
    if (!isLoaded || !window.google) return;

    const service = new window.google.maps.DirectionsService();
    const newRoutes: typeof routes = [];

    deliveryBoys.forEach((db) => {
      if (!db.destination) return;
      service.route(
        {
          origin: db.currentLocation,
          destination: db.destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK" && result.routes.length > 0) {
            const path = result.routes[0].overview_path.map((p) => ({
              lat: p.lat(),
              lng: p.lng(),
            }));

            // ETA in minutes
            const eta = result.routes[0].legs[0]?.duration?.text || "TBD";

            newRoutes.push({ dbId: db.id, path, eta });
            setRoutes([...newRoutes]); // update state
          }
        }
      );
    });
  }, [deliveryBoys, isLoaded]);

  /* 6️⃣ Auto fit bounds */
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(center);
    stores.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
    deliveryBoys.forEach((d) => bounds.extend(d.currentLocation));
    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds);
  }, [center, stores, deliveryBoys]);

  /* 7️⃣ Guards */
  if (loadError) return <div>❌ Map load failed</div>;
  if (!isLoaded) return <div>📍 Map loading…</div>;

  /* 8️⃣ Render */
  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={14}
        onLoad={(map) => (mapRef.current = map)}
        options={{
          mapId: "SHOPNISH_MULTI_TRACKER_MAP",
          disableDefaultUI: false,
        }}
      >
        {/* Customer */}
        {homeIcon && <MarkerF position={center} icon={homeIcon} title="Customer" />}

        {/* Stores */}
        {storeIcon &&
          stores.map(
            (store, i) =>
              isFinite(store.lat) &&
              isFinite(store.lng) && (
                <MarkerF key={`store-${i}`} position={store} icon={storeIcon} title={store.name} />
              )
          )}

        {/* Delivery Boys + Animated */}
        {bikeIcon &&
          deliveryBoys.map((db) => {
            const prev = animatedPositions.current.get(db.id) || db.currentLocation;
            const next = db.currentLocation;
            animatedPositions.current.set(db.id, next);

            return (
              <MarkerF
                key={db.id}
                position={prev}
                icon={bikeIcon}
                options={{ optimized: false, rotation: db.destination ? getRotation(prev, next) : 0 }}
                onLoad={(marker) => {
                  let step = 0;
                  const totalSteps = 30;
                  const animate = () => {
                    step++;
                    const pos = interpolate(prev, next, step / totalSteps);
                    marker.setPosition(pos);
                    if (step < totalSteps) requestAnimationFrame(animate);
                  };
                  animate();
                }}
              />
            );
          })}

        {/* Routes / Polylines */}
        {routes.map((r) => (
          <Polyline
            key={r.dbId}
            path={r.path}
            options={{
              strokeColor: "#FF0000",
              strokeOpacity: 0.7,
              strokeWeight: 4,
              icons: [
                {
                  icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 4, strokeColor: "#FF0000" },
                  offset: `${dashOffset}px`,
                  repeat: "20px",
                },
              ],
            }}
          />
        ))}
      </GoogleMap>

      {/* Info Box */}
      <div className="absolute top-2 left-2 bg-white shadow rounded-lg p-2 text-sm">
        <p>
          <MapPin className="inline w-4 h-4 mr-1 text-blue-600" />
          Stores: {stores.length}, Customer: 1
        </p>
        <p>
          <Truck className="inline w-4 h-4 mr-1 text-purple-600" />
          Live Riders: {deliveryBoys.length}
        </p>
      </div>
    </div>
  );
};

/* =======================
   Helper: Rotation (Marker direction)
======================= */
function getRotation(prev: google.maps.LatLngLiteral, next: google.maps.LatLngLiteral): number {
  const dx = next.lng - prev.lng;
  const dy = next.lat - prev.lat;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return angle;
}

export default React.memo(GoogleMapTracker);
