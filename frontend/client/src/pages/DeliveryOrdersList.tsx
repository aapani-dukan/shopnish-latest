import React from "react";
import { Navigation, Phone, MapPin, Loader2 } from "lucide-react";

// --- TypeScript Type Definitions ---
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

export interface Order {
  id: number;
  orderNumber?: string;
  total?: string;
  items?: OrderItem[];
  deliveryStatus?: string;
  status?: string;
  deliveryAddress?: any;
  seller?: any;
  sellerDetails?: any;
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

export interface DeliveryOrdersListProps extends UIComponents {
  orders: Order[];
  onAcceptOrder: (orderId: number) => void;
  onUpdateStatus: (order: Order) => void;
  statusColor: (status: string) => string;
  statusText: (status: string) => string;
  nextStatus: (status: string) => string | null;
  nextStatusLabel: (status: string) => string;
  acceptLoading: boolean;
  updateLoading: boolean;
  myDeliveryBoyId: number | undefined;
}

// --- Normalizers ---
const normalizeDeliveryAddress = (raw: any): Address | null => {
  if (!raw) return null;

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return normalizeDeliveryAddress(parsed);
    } catch {
      return null;
    }
  }

  if (!raw.fullName && !raw.phone && !raw.address && !raw.addressLine1) return null;

  return {
    fullName: raw.fullName,
    phone: raw.phone || raw.phoneNumber,
    address: raw.address || raw.addressLine1,
    addressLine1: raw.addressLine1,
    city: raw.city,
    state: raw.state,
    pincode: raw.pincode || raw.postalCode,
    postalCode: raw.postalCode,
    landmark: raw.landmark,
    phoneNumber: raw.phoneNumber,
  };
};

const normalizeSeller = (order: Order): Seller | null => {
  let rawSellerData = order.items?.[0]?.product?.seller || order.sellerDetails || order.seller;
  if (!rawSellerData) return null;

  return {
    id: rawSellerData.id ?? undefined,
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

// --- AddressBlock ---
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

  const phone = (details as any).phone ?? (details as any).phoneNumber ?? "-";
  const addressLine =
    (details as any).address ?? (details as any).addressLine1 ?? "पता उपलब्ध नहीं";
  const city = (details as any).city ?? (details as any).state ?? "";
  const pincode = (details as any).pincode ?? (details as any).postalCode ?? "";
  const email = (details as Seller).email ?? null;

  const handleNavigate = () => {
    const query = encodeURIComponent(`${addressLine} ${city} ${pincode}`);
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
        <Button variant="outline" size="sm" onClick={handleCall} disabled={!phone || phone === "-"}>
          <Phone className="w-4 h-4 mr-2" /> कॉल करें
        </Button>
      </div>
    </div>
  );
};

// --- OrderItems ---
const OrderItems: React.FC<{ items: OrderItem[] }> = ({ items }) => (
  <div className="mt-6 pt-4 border-t">
    <h4 className="font-medium mb-2">ऑर्डर आइटम</h4>
    <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
      {items.length > 0 ? (
        items.map((item) => (
          <div key={item.id} className="flex items-center space-x-3 text-sm">
            <img
              src={item.product?.image || "https://placehold.co/32x32/E2E8F0/1A202C?text=No+Img"}
              alt={item.product?.name || "No Name"}
              className="w-8 h-8 object-cover rounded"
            />
            <div className="flex-1">
              <p className="font-medium">{item.product?.name || "उत्पाद डेटा उपलब्ध नहीं"}</p>
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

// --- OrderCard ---
interface OrderCardProps extends Omit<DeliveryOrdersListProps, "orders"> {
  order: Order;
  isLoading: boolean;
  myDeliveryBoyId: number | undefined;
}

const OrderCard: React.FC<OrderCardProps> = React.memo(
  ({
    order,
    onAcceptOrder,
    onUpdateStatus,
    statusColor,
    statusText,
    nextStatus,
    nextStatusLabel,
    isLoading,
    myDeliveryBoyId,
    ...ui
  }) => {
    if (!order) return null;

    const mainStatus = (order.status ?? "").toLowerCase();
    const deliveryStatus = (order.deliveryStatus ?? "").toLowerCase();
    const isMine = myDeliveryBoyId && Number(order.deliveryBoyId) === Number(myDeliveryBoyId);

    // ✅ Accept order logic (more flexible)
    const canAccept =
      order.deliveryBoyId == null &&
      deliveryStatus === "pending" &&
      (mainStatus === "pending" || mainStatus === "ready_for_pickup");

    // ✅ Next status logic
    const next = nextStatus(mainStatus);
    const hasNextAction = isMine && deliveryStatus === "accepted" && next != null;

    const normalizedAddress = normalizeDeliveryAddress(order.deliveryAddress);
    const normalizedSeller = normalizeSeller(order);

    return (
      <ui.Card>
        <ui.CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <ui.CardTitle>ऑर्डर #{order.orderNumber ?? "N/A"}</ui.CardTitle>
              <p className="text-sm text-gray-600">
                {order.items?.length || 0} आइटम • ₹{order.total ?? 0}
              </p>
            </div>
            <ui.Badge
              className={`${statusColor(mainStatus)} text-white px-3 py-1 rounded-full text-xs font-semibold`}
            >
              {statusText(mainStatus)}
            </ui.Badge>
          </div>
        </ui.CardHeader>

        <ui.CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AddressBlock title="ग्राहक विवरण" details={normalizedAddress} Button={ui.Button} />
            <AddressBlock title="विक्रेता विवरण" details={normalizedSeller} Button={ui.Button} />
          </div>

          <OrderItems items={order.items ?? []} />

          <div className="mt-6 pt-4 border-t flex flex-wrap gap-2">
            {canAccept ? (
              <ui.Button size="sm" onClick={() => onAcceptOrder(order.id)} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                ऑर्डर स्वीकार करें
              </ui.Button>
            ) : hasNextAction ? (
              <ui.Button size="sm" onClick={() => onUpdateStatus(order)} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {nextStatusLabel(mainStatus)}
              </ui.Button>
            ) : null}
          </div>
        </ui.CardContent>
      </ui.Card>
    );
  }
);

// --- DeliveryOrdersList ---
const DeliveryOrdersList: React.FC<DeliveryOrdersListProps> = ({
  orders,
  myDeliveryBoyId,
  ...props
}) => (
  <div className="space-y-6">
    {orders.length === 0 && (
      <div className="text-sm text-gray-500">कोई ऑर्डर उपलब्ध नहीं</div>
    )}
    {orders.map((order) => (
      <OrderCard
        key={order.id}
        order={order}
        isLoading={props.acceptLoading || props.updateLoading}
        myDeliveryBoyId={myDeliveryBoyId}
        {...props}
      />
    ))}
  </div>
);

export default React.memo(DeliveryOrdersList); 