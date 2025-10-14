// client/src/pages/deliveryotpdialog.tsx
import React, { useState } from "react"; // ✅ React और useState को सही केस में (PascalCase)
import { Loader2 } from "lucide-react"; // ✅ Loader2 को सही केस में (PascalCase)

// ✅ Shadcn UI कॉम्पोनेंट्स को सही केस और सही पाथ से इंपोर्ट किया गया
// (यह मानते हुए कि तुमने Shadcn UI को `cn` कमांड से स्थापित किया है)
import {
  Dialog,           // ✅ Dialog (root component, PascalCase)
  DialogContent,    // ✅ DialogContent (PascalCase)
  DialogHeader,     // ✅ DialogHeader (PascalCase)
  DialogTitle,      // ✅ DialogTitle (PascalCase)
  DialogDescription // ✅ DialogDescription (PascalCase) - इसे भी जोड़ा गया है
} from "../components/ui/dialog"; // सुनिश्चित करें कि यह पाथ सही है

import { Button } from "../components/ui/button"; // ✅ Button (PascalCase)
import { Input } from "../components/ui/input";   // ✅ Input (PascalCase)
import { Label } from "../components/ui/label";   // ✅ Label (PascalCase) - यह Radix Label के बजाय Shadcn Label है


// --- TypeScript Type Definitions ---
export interface Order { // ✅ PascalCase
  id: number;
  orderNumber?: string; // ✅ PascalCase
  total?: string;
  deliveryAddress?: { // ✅ PascalCase
    fullName?: string; // ✅ PascalCase
    address?: string;
    phone?: string;
  };
}

// --- Component Props ---
interface DeliveryOtpDialogProps { // ✅ PascalCase
  isOpen: boolean; // ✅ PascalCase
  onOpenChange: (open: boolean) => void; // ✅ PascalCase (प्रॉप नाम)
  order: Order;
  onConfirm: (otp: string) => void; // ✅ PascalCase (प्रॉप नाम)
  isSubmitting: boolean; // ✅ PascalCase (प्रॉप नाम)
  error: string | null;
}

// --- Main Component: DeliveryOtpDialog ---
const DeliveryOtpDialog: React.FC<DeliveryOtpDialogProps> = ({ // ✅ PascalCase (कॉम्पोनेंट नाम)
  isOpen,         // ✅ PascalCase (डीस्ट्रक्चर्ड प्रॉप)
  onOpenChange,   // ✅ PascalCase (डीस्ट्रक्चर्ड प्रॉप)
  order,
  onConfirm,      // ✅ PascalCase (डीस्ट्रक्चर्ड प्रॉप)
  isSubmitting,   // ✅ PascalCase (डीस्ट्रक्चर्ड प्रॉप)
  error,
}) => {
  const [otp, setOtp] = useState(""); // ✅ useState और setOtp को सही केस में

  // जब डायलॉग बंद होता है, तो OTP को रीसेट करें
  React.useEffect(() => {
    if (!isOpen) {
      setOtp("");
    }
  }, [isOpen]);

  const handleConfirm = () => { // ✅ camelCase (फंक्शन नाम)
    if (otp.trim().length === 4) { // OTP की लंबाई जांचें
      onConfirm(otp);
    }
  };

  return (
    // ✅ Shadcn UI के Dialog कॉम्पोनेंट का उपयोग करें
    <Dialog open={isOpen} onOpenChange={onOpenChange}> {/* ✅ Dialog कॉम्पोनेंट, open और onOpenChange प्रॉप्स सही केस में */}
      <DialogContent className="sm:max-w-[425px]"> {/* ✅ DialogContent कॉम्पोनेंट, className सही केस में */}
        <DialogHeader> {/* ✅ DialogHeader कॉम्पोनेंट */}
          <DialogTitle>डिलीवरी पूरी करें</DialogTitle> {/* ✅ DialogTitle कॉम्पोनेंट */}
          <DialogDescription>
            डिलीवरी की पुष्टि करने के लिए ग्राहक से 4-अंकों का OTP माँगें।
          </DialogDescription>
        </DialogHeader>

        {order && (
          <div className="p-4 bg-blue-50 rounded-lg mb-4"> {/* ✅ className सही केस में */}
            <p className="font-medium">ऑर्डर #{order.orderNumber}</p>
            <p className="text-sm text-gray-600">{order.deliveryAddress?.fullName}</p>
            <p className="text-sm text-gray-600">कुल: ₹{order.total}</p>
          </div>
        )}

        <div className="grid gap-4 py-4"> {/* ✅ className सही केस में */}
          <div className="grid gap-2"> {/* ✅ className सही केस में */}
            <Label htmlFor="otp">OTP दर्ज करें</Label> {/* ✅ Label कॉम्पोनेंट, htmlFor सही है */}
            <Input // ✅ Input कॉम्पोनेंट
              id="otp"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)} // ✅ onChange और setOtp को सही केस में
              placeholder="0000"
              maxLength={4}
              className="text-center text-lg tracking-widest" // ✅ className सही केस में
            />
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
          </div>
        </div>

        <div className="flex justify-end space-x-2"> {/* ✅ className सही केस में */}
          <Button // ✅ Button कॉम्पोनेंट
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)} // ✅ onClick और onOpenChange को सही केस में
            disabled={isSubmitting}
          >
            रद्द करें
          </Button>
          <Button // ✅ Button कॉम्पोनेंट
            type="submit"
            onClick={handleConfirm} // ✅ onClick और handleConfirm को सही केस में
            disabled={isSubmitting || otp.trim().length !== 4}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> सत्यापित हो रहा है... {/* ✅ Loader2 सही केस में */}
              </>
            ) : (
              "पुष्टि करें"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryOtpDialog; // ✅ PascalCase
