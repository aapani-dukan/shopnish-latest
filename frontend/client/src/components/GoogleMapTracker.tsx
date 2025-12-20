import React, { useMemo, useEffect, useRef } from "react";
import {
  GoogleMap,
  MarkerF,
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
)[] = ["marker"];

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
  /* 🔴 MAP REF */
  const mapRef = useRef<google.maps.Map | null>(null);
const animatedPositions = useRef<Map<number, google.maps.LatLngLiteral>>(new Map());
  /* 1️⃣ Google Maps Loader */
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });

  /* 2️⃣ Icons */
  const { bikeIcon, homeIcon, storeIcon } = useMemo(() => {
    if (!isLoaded || !window.google?.maps) {
      return { bikeIcon: undefined, homeIcon: undefined, storeIcon: undefined };
    }

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

  /* 3️⃣ Default Center (fallback only) */
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

  /* 4️⃣ AUTO FIT BOUNDS (🔥 MOST IMPORTANT FIX) */
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    const bounds = new window.google.maps.LatLngBounds();

    // customer
    if (center.lat && center.lng) {
      bounds.extend(center);
    }

    // stores
    stores.forEach((s) => {
      if (isFinite(s.lat) && isFinite(s.lng)) {
        bounds.extend({ lat: s.lat, lng: s.lng });
      }
    });

    // delivery boys
    deliveryBoys.forEach((d) => {
      const loc = d.currentLocation;
      if (isFinite(loc.lat) && isFinite(loc.lng)) {
        bounds.extend(loc);
      }
    });

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds);
    }
  }, [center, stores, deliveryBoys]);

  /* 5️⃣ Guards */
  if (loadError) return <div>❌ Map load failed</div>;
  if (!isLoaded) return <div>📍 Map loading…</div>;

  /* 6️⃣ Render */
  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={14}
        onLoad={(map) => {
          mapRef.current = map; // 🔥 attach map
        }}
        options={{
          mapId: "SHOPNISH_MULTI_TRACKER_MAP",
          disableDefaultUI: false,
        }}
      >
        {/* 🏠 Customer */}
        {homeIcon && (
          <MarkerF
            position={center}
            icon={homeIcon}
            title="Delivery Address"
          />
        )}

        {/* 🏪 Stores */}
        {storeIcon &&
          stores.map(
            (store, i) =>
              isFinite(store.lat) &&
              isFinite(store.lng) && (
                <MarkerF
                  key={`store-${i}`}
                  position={{ lat: store.lat, lng: store.lng }}
                  icon={storeIcon}
                  title={store.name}
                />
              )
          )}

        {/* 🏍️ Delivery Boys */}
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
        options={{ optimized: false }}
        onLoad={(marker) => {
          let step = 0;
          const totalSteps = 30;

          const animate = () => {
            step++;
            const pos = interpolate(prev, next, step / totalSteps);
            marker.setPosition(pos);

            if (step < totalSteps) {
              requestAnimationFrame(animate);
            }
          };

          animate();
        }}
      />
    );
  })}
      </GoogleMap>

      {/* ℹ️ Info Box */}
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

export default React.memo(GoogleMapTracker);
