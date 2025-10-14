// client/src/pages/DeliveryOtpDialog.tsx
import React, { useState, useEffect } from "react"; // ✅ React, useEffect सही केस में
import { Loader2 } from "lucide-react"; // ✅ Loader2 सही केस में

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
  // ✅ नए प्रॉप्स
  onSendManualOtp: (orderId: number) => void; // मैन्युअल OTP भेजने के लिए
  isSendingManualOtp: boolean; // मैन्युअल OTP भेजने की लोडिंग स्थिति
  onCompleteWithoutOtp: (orderId: number) => void; // बिना OTP के डिलीवरी पूरी करने के लिए
  isCompletingWithoutOtp: boolean; // बिना OTP के डिलीवरी पूरी करने की लोडिंग स्थिति
}

// --- Main Component: DeliveryOtpDialog ---
const DeliveryOtpDialog: React.FC<DeliveryOtpDialogProps> = ({
  isOpen,
  onOpenChange,
  order,
  onConfirm,
  isSubmitting,
  error,
  // ✅ नए प्रॉप्स डीस्ट्रक्चर करें
  onSendManualOtp,
  isSendingManualOtp,
  onCompleteWithoutOtp,
  isCompletingWithoutOtp,
}) => {
  const [otp, setOtp] = useState("");

  // जब डायलॉग बंद होता है, तो OTP को रीसेट करें
  useEffect(() => {
    if (!isOpen) {
      setOtp("");
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (otp.trim().length === 4) { // OTP की लंबाई जांचें
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
            <p className="text-sm text-gray-600">कुल: ₹{order.total}</p>
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
              maxLength={4} // ✅ OTP अब 4-अंकों का है
              className="text-center text-lg tracking-widest"
            />
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
          </div>
        </div>

        {/* ✅ यहाँ "OTP दोबारा भेजें" बटन जोड़ें */}
        <Button
          variant="outline"
          onClick={() => onSendManualOtp(order.id)}
          disabled={isSendingManualOtp || isSubmitting}
          className="w-full mb-2" // थोड़ा स्टाइल
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
            disabled={isSubmitting || isSendingManualOtp || isCompletingWithoutOtp} // अन्य बटनों की स्थिति भी देखें
          >
            रद्द करें
          </Button>
          <Button
            type="submit"
            onClick={handleConfirm}
            disabled={isSubmitting || otp.trim().length !== 4 || isSendingManualOtp || isCompletingWithoutOtp} // OTP की लंबाई और अन्य बटनों की स्थिति देखें
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

        {/* ✅ यहाँ "बिना OTP के डिलीवर करें" बटन जोड़ें */}
        <Button
          variant="destructive"
          onClick={() => onCompleteWithoutOtp(order.id)}
          disabled={isCompletingWithoutOtp || isSubmitting || isSendingManualOtp} // अन्य बटनों की स्थिति भी देखें
          className="w-full mt-4" // थोड़ा स्टाइल
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
