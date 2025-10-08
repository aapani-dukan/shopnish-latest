// client/src/pages/DeliveryOtpDialog.tsx
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
// ✅ 1. Radix UI से सीधे आयात (Primitives)
import { Dialog } from "@radix-ui/react-dialog";
import { Label } from "@radix-ui/react-label";
// Radix UI and other components from your dependencies list
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button"; // Assuming a custom Button component using Radix Slot/CVA
import { Input } from "../components/ui/input"; // Assuming a custom Input component

// --- TypeScript Type Definitions ---
export interface Order {
  id: number;
  orderNumber?: string;
  total?: string;
  deliveryAddress?: {
    fullName?: string;
    address?: string;
    phone?: string;
  };
}

// --- Component Props ---
interface DeliveryOtpDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onConfirm: (otp: string) => void;
  isSubmitting: boolean;
  error: string | null;
}

// --- Main Component: DeliveryOtpDialog ---
const DeliveryOtpDialog: React.FC<DeliveryOtpDialogProps> = ({
  isOpen,
  onOpenChange,
  order,
  onConfirm,
  isSubmitting,
  error,
}) => {
  const [otp, setOtp] = useState("");

  const handleConfirm = () => {
    onConfirm(otp);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>डिलीवरी पूरी करें</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-gray-600 mb-4">
          डिलीवरी की पुष्टि करने के लिए ग्राहक से 4-अंकों का OTP माँगें।
        </div>
        {order && (
          <div className="p-4 bg-blue-50 rounded-lg mb-4">
            <p className="font-medium">ऑर्डर #{order.orderNumber}</p>
            <p className="text-sm text-gray-600">{order.deliveryAddress?.fullName}</p>
            <p className="text-sm text-gray-600">कुल: ₹{order.total}</p>
          </div>
        )}
        <div className="mb-4">
          <Label htmlFor="otp">OTP दर्ज करें</Label>
          <Input
            id="otp"
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="0000"
            maxLength={4}
            className="text-center text-lg tracking-widest"
          />
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || otp.trim().length !== 4}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> सत्यापित हो रहा है...
              </>
            ) : (
              "पुष्टि करें"
            )}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            रद्द करें
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryOtpDialog;
