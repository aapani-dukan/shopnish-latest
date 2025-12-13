// client/src/pages/deliveryBoy/DeliveryOrdersList.tsx (UPDATED for Batch Model)

import React from "react";
import { Navigation, Phone, MapPin, Loader2 } from "lucide-react"; 

// --- TypeScript Type Definitions ---
// (Address, Seller, Product, OrderItem types are retained)

export interface Address {
  fullName?: string;
  phone?: string;
  phoneNumber?: string; 
  address?: string;
  addressLine1?: string; 
  city?: string;
  state?: string;
  pincode?: string;
  postalCode?: string;
  landmark?: string;
}

export interface Seller {
  id?: number;
  name?: string;
  businessName?: string;
  phone?: string;
  email?: string | null;
  address?: string;
  city?: string;
  pincode?: string;
  landmark?: string;
}

export interface Product {
  id?: number;
  name?: string;
  image?: string;
  unit?: string;
  seller?: any;
}

export interface OrderItem {
  id: number;
  quantity: number;
  product?: Product;
}

// 🛑 नया: DeliveryBatch टाइप
// बैच में डिलीवरी के लिए आवश्यक सभी जानकारी होती है, जिसमें ऑर्डर की सूची भी शामिल है।
// 🛑 UPDATED: DeliveryBatch Type (Normalizer से आने वाले टॉप-लेवल फ़ील्ड्स)
export interface DeliveryBatch {
  id: number; 
  masterOrderId?: string; 
  totalAmount?: string | number; // Normalizer द्वारा गणना की गई
  status?: string; 
  deliveryAddress: any; // Normalizer द्वारा टॉप-लेवल पर सेट किया गया
  items: OrderItem[]; // Normalizer द्वारा सभी सब-ऑर्डर से मर्ज किया गया
  sellerDetails?: Seller[] | null; // Normalizer द्वारा सभी विक्रेताओं का array
  deliveryBoyId?: number | null; 
}


export interface UIComponents {
  Button: React.FC<any>;
  Card: React.FC<any>;
  CardContent: React.FC<any>;
  CardHeader: React.FC<any>;
  CardTitle: React.FC<any>;
  Badge: React.FC<any>;
}

// 🛑 Updated Props: अब orders के बजाय batches का उपयोग कर रहे हैं
export interface DeliveryOrdersListProps extends UIComponents {
  orders: DeliveryBatch[]; // 🛑 Batch[] का उपयोग करें
  onAcceptOrder: (batchId: number) => void; // Batch ID स्वीकार करें
  onUpdateStatus: (batch: DeliveryBatch) => void; // Batch ऑब्जेक्ट पास करें
  statusColor: (status: string) => string;
  statusText: (status: string) => string;
  nextStatus: (status: string) => string | null;
  nextStatusLabel: (status: string) => string;
  acceptLoading: boolean;
  updateLoading: boolean;
  myDeliveryBoyId: number | undefined; 
}

// --- Normalizers (Updated to Handle Batch Structure) ---

// (normalizeDeliveryAddress remains the same)
const normalizeDeliveryAddress = (raw: any): Address | null => {
  // ... (Address normalization logic remains the same)
  if (!raw) return null;

  if (raw.fullName || raw.phone || raw.address) {
    return {
      fullName: raw.fullName,
      phone: raw.phone || raw.phoneNumber,
      address: raw.address || raw.addressLine1,
      city: raw.city,
      pincode: raw.pincode || raw.postalCode,
      landmark: raw.landmark,
      phoneNumber: raw.phoneNumber,
      addressLine1: raw.addressLine1,
      state: raw.state,
    };
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return normalizeDeliveryAddress(parsed);
    } catch {
      return null;
    }
  }

  return null;
};

// 🛑 Updated normalizeSeller: Batch से Seller Details खींचना
// 🛑 UPDATED normalizeSeller: अब सीधे batch.sellerDetails का उपयोग करता है
const normalizeSeller = (batch: DeliveryBatch): Seller | null => {
  let rawSellerData = batch.sellerDetails;

  // यदि विक्रेता array है (कई पिकअप), तो हम सिर्फ पहले वाले को प्रदर्शित कर सकते हैं
  if (Array.isArray(rawSellerData) && rawSellerData.length > 0) {
      rawSellerData = rawSellerData[0];
  }
  
  if (!rawSellerData) {
    return null;
  }

  // Seller के डेटा को normalise करें
  return {
    id: rawSellerData.id,
    name: rawSellerData.name ?? rawSellerData.businessName, 
    businessName: rawSellerData.businessName ?? rawSellerData.name,
    phone: rawSellerData.businessPhone ?? rawSellerData.phone ?? rawSellerData.phoneNumber,
    
    email: rawSellerData.email ?? null,
    address: rawSellerData.businessAddress ?? rawSellerData.address ?? rawSellerData.addressLine1,
    city: rawSellerData.city,
    pincode: rawSellerData.pincode ?? rawSellerData.postalCode,
    landmark: rawSellerData.landmark,
  };
};


// --- AddressBlock (Logic remains the same) ---
const AddressBlock: React.FC<{
  title: string;
  details: Address | Seller | null;
  Button: UIComponents["Button"];
}> = ({ title, details, Button }) => {
  if (!details) {
    return (
      <div className="space-y-3">
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-gray-500">जानकारी उपलब्ध नहीं</p>
      </div>
    );
  }

  const displayName =
    (details as any).businessName ||
    (details as any).name ||
    (details as any).fullName ||
    "नाम उपलब्ध नहीं";

  const phone =
    (details as any).phone ?? (details as any).phoneNumber ?? "-";

  const addressLine =
    (details as any).address ??
    (details as any).addressLine1 ??
    "पता उपलब्ध नहीं";

  const city =
    (details as any).city ?? (details as any).state ?? "";

  const pincode =
    (details as any).pincode ?? (details as any).postalCode ?? "";

  const email = (details as Seller).email ?? null;

  // ✅ Google Maps URL को सही फॉर्मेट में बदला गया
  const handleNavigate = () => {
      const addressString = `${addressLine}, ${city}, ${pincode}`;
      const query = encodeURIComponent(addressString);
      // पुराने फॉर्मेट को सही Google Maps URL से बदलें
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };


  const handleCall = () => {
    if (phone && phone !== "-") window.open(`tel:${phone}`);
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium">{title}</h4>
      <p className="font-medium">{displayName}</p>

      {email && <div className="text-sm text-gray-600">✉️ {email}</div>}

      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <Phone className="w-4 h-4" />
        <span>{phone}</span>
      </div>

      <div className="flex items-start space-x-2 text-sm text-gray-600">
        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p>{addressLine}</p>
          <p>
            {city} {pincode ? `- ${pincode}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={handleNavigate}>
          <Navigation className="w-4 h-4 mr-2" /> नेविगेट करें
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCall}
          disabled={!phone || phone === "-"}
        >
          <Phone className="w-4 h-4 mr-2" /> कॉल करें
        </Button>
      </div>
    </div>
  );
};

// --- OrderItems (Logic remains the same, but now uses Batch.items) ---
const OrderItems: React.FC<{ items: OrderItem[] }> = ({ items }) => (
  <div className="mt-6 pt-4 border-t">
    <h4 className="font-medium mb-2">ऑर्डर आइटम</h4>
    <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
      {items.length > 0 ? (
        items.map((item) => (
          <div key={item.id} className="flex items-center space-x-3 text-sm">
            <img
              src={
                item.product?.image ||
                "https://placehold.co/32x32/E2E8F0/1A202C?text=No+Img"
              }
              alt={item.product?.name || "No Name"}
              className="w-8 h-8 object-cover rounded"
            />
            <div className="flex-1">
              <p className="font-medium">
                {item.product?.name || "उत्पाद डेटा उपलब्ध नहीं"}
              </p>
              <p className="text-gray-600">
                मात्रा: {item.quantity || 0} {item.product?.unit || ""}
              </p>
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-gray-500">कोई आइटम नहीं</p>
      )}
    </div>
  </div>
);

// --- BatchCard (Replaced OrderCard) ---

  const BatchCard: React.FC<
  Omit<DeliveryOrdersListProps, "orders" | "acceptLoading" | "updateLoading"> & {
    batch: DeliveryBatch;
    isLoading: boolean;
    myDeliveryBoyId?: number | null;
  }
> = React.memo(
  ({
    batch,
    onAcceptOrder,
    onUpdateStatus,
    statusColor,
    statusText,
    nextStatusLabel,
    isLoading,
    myDeliveryBoyId,
    ...ui
  }) => {
    if (!batch) return null;

    const mainStatus = (batch.status ?? "").toLowerCase().trim();

    const normalizedAddress = normalizeDeliveryAddress(batch.deliveryAddress);
    const normalizedSeller = normalizeSeller(batch);

    const totalItems =
      batch.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;

    const grandTotal = Number(batch.totalAmount ?? 0);

    /* ---------------- CLAIM LOGIC ---------------- */
    const canClaimBatch =
      batch.deliveryBoyId === null && mainStatus === "pending";

    /* ---------------- UPDATE STATUS LOGIC ---------------- */

    // 🔥 IMPORTANT CHANGE:
    // ❌ deliveryBoyId match पर depend मत करो
    // ✅ सिर्फ status देखो

    const canUpdateStatus = [
      "assigned",
      "out_for_pickup",
      "picked_up",
      "out_for_delivery",
    ].includes(mainStatus);

    const nextActionLabel = canUpdateStatus
      ? nextStatusLabel(mainStatus)
      : null;

    /* ---------------- DEBUG ---------------- */
    console.log(`--- Batch ${batch.id} ---`);
    console.log("Batch deliveryBoyId:", batch.deliveryBoyId);
    console.log("My deliveryBoyId:", myDeliveryBoyId);
    console.log("Main Status:", mainStatus);
    console.log("Can Update:", canUpdateStatus);
    console.log("--------------------------");

    /* ---------------- UI ---------------- */

    return (
      <ui.Card>
        <ui.CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <ui.CardTitle>बैच #{batch.id}</ui.CardTitle>
              <p className="text-sm text-gray-600">
                {totalItems} आइटम • ₹{grandTotal.toLocaleString("en-IN")}
              </p>
            </div>

            <ui.Badge
              className={`${statusColor(mainStatus)} text-white px-3 py-1 rounded-full`}
            >
              {statusText(mainStatus)}
            </ui.Badge>
          </div>
        </ui.CardHeader>

        <ui.CardContent>
          {/* CUSTOMER + SELLER DETAILS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <AddressBlock
              title="ग्राहक विवरण"
              details={normalizedAddress}
              Button={ui.Button}
            />
            <AddressBlock
              title="विक्रेता विवरण"
              details={normalizedSeller}
              Button={ui.Button}
            />
          </div>

          <OrderItems items={batch.items ?? []} />

          <div className="mt-6 flex gap-2 flex-wrap">
            {/* CLAIM */}
            {canClaimBatch && (
              <ui.Button
                size="sm"
                onClick={() => onAcceptOrder(batch.id)}
                disabled={isLoading}
              >
                बैच दावा करें
              </ui.Button>
            )}

            {/* UPDATE STATUS */}
            {canUpdateStatus && (
  <ui.Button
    size="sm"
    onClick={() => onUpdateStatus(batch)}
    disabled={isLoading}
  >
    {nextActionLabel || "स्टेटस आगे बढ़ाएँ"}
  </ui.Button>
)}
          </div>
        </ui.CardContent>
      </ui.Card>
    );
  }
);
    
// --- DeliveryOrdersList (Updated to use BatchCard) ---
const DeliveryOrdersList: React.FC<DeliveryOrdersListProps> = ({
  orders, // 🛑 अब यह DeliveryBatch[] है
  myDeliveryBoyId,
  ...props
}) => {
  return (
    <div className="space-y-6">
      {orders.length === 0 && (
        <div className="text-sm text-gray-500">कोई बैच उपलब्ध नहीं</div>
      )}
      {orders.map((batch) => ( // 🛑 order के बजाय batch का उपयोग करें
        <BatchCard
          key={batch.id}
          batch={batch} // 🛑 OrderCard के बजाय BatchCard का उपयोग करें
          isLoading={props.acceptLoading || props.updateLoading}
          myDeliveryBoyId={myDeliveryBoyId}
          {...props}
        />
      ))}
    </div>
  );
};

export default React.memo(DeliveryOrdersList);
