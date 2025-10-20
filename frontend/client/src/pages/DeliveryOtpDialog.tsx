// client/src/pages/DeliveryOtpDialog.tsx
import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

// --- TypeScript Type Definitions ---
export interface Order {
  id: number;
  orderNumber?: string | number;
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
  onSendManualOtp: (orderId: number) => void;
  isSendingManualOtp: boolean;
  onCompleteWithoutOtp: (orderId: number) => void;
  isCompletingWithoutOtp: boolean;
}

// --- Main Component: DeliveryOtpDialog ---
const DeliveryOtpDialog: React.FC<DeliveryOtpDialogProps> = ({
  isOpen,
  onOpenChange,
  order,
  onConfirm,
  isSubmitting,
  error,
  onSendManualOtp,
  isSendingManualOtp,
  onCompleteWithoutOtp,
  isCompletingWithoutOtp,
}) => {
  const [otp, setOtp] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setOtp("");
    }
  }, [isOpen]);

  const handleConfirm = () => {
    console.log("DeliveryOtpDialog: Confirm button clicked. OTP:", otp);
    if (otp.trim().length === 4) {
      onConfirm(otp);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>डिलीवरी पूरी करें</DialogTitle>
          <DialogDescription>
            डिलीवरी की पुष्टि करने के लिए ग्राहक से 4-अंकों का OTP माँगें।
          </DialogDescription>
        </DialogHeader>

        {order && (
          <div className="p-4 bg-blue-50 rounded-lg mb-4">
            <p className="font-medium">ऑर्डर #{order.orderNumber}</p>
            <p className="text-sm text-gray-600">{order.deliveryAddress?.fullName}</p>
            <p className="text-sm text-gray-600">कुल: ₹{Number(order.total ?? 0).toLocaleString('en-IN')}</p> 
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
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
        </div>

        <Button
          variant="outline"
          onClick={() => onSendManualOtp(order.id)}
          disabled={isSendingManualOtp || isSubmitting || isCompletingWithoutOtp}
          className="w-full mb-2"
        >
          {isSendingManualOtp ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> OTP भेजा जा रहा है...
            </>
          ) : (
            "OTP दोबारा भेजें"
          )}
        </Button>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting || isSendingManualOtp || isCompletingWithoutOtp}
          >
            रद्द करें
          </Button>
          <Button
            type="submit"
            onClick={handleConfirm}
            disabled={isSubmitting || otp.trim().length !== 4 || isSendingManualOtp || isCompletingWithoutOtp}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> सत्यापित हो रहा है...
              </>
            ) : (
              "पुष्टि करें"
            )}
          </Button>
        </div>

        <Button
          variant="destructive"
          onClick={() => onCompleteWithoutOtp(order.id)}
          disabled={isCompletingWithoutOtp || isSubmitting || isSendingManualOtp}
          className="w-full mt-4"
        >
          {isCompletingWithoutOtp ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> डिलीवर किया जा रहा है...
            </>
          ) : (
            "बिना OTP के डिलीवर करें"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryOtpDialog;
