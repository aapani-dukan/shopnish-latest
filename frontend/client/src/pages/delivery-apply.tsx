import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useDeliveryBoy } from "@/hooks/useDeliveryBoy";
import { useAuth } from "@/hooks/useAuth"; // ✅ Backend sync ke liye zaroori
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient"; // ✅ Manual fetch ki jagah ye use karein
import { useNavigate } from "react-router-dom";

const deliveryApplySchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(10, "Phone number is required"),
  address: z.string().min(5, "Address is required"),
  vehicleType: z.string().min(2, "Vehicle type is required"),
});

type DeliveryApplyData = z.infer<typeof deliveryApplySchema>;

export default function DeliveryApplyPage() {
  const { toast } = useToast();
  const { refetchUser } = useAuth(); // ✅ Profile update karne ke liye
  const { deliveryUser } = useDeliveryBoy();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeliveryApplyData>({
    resolver: zodResolver(deliveryApplySchema),
    defaultValues: {
      fullName: deliveryUser?.name || "",
      phone: deliveryUser?.phoneNumber || "", // ✅ phoneNumber use karein
      address: "",
      vehicleType: "",
    },
  });

  const onSubmit = async (formData: DeliveryApplyData) => {
    try {
      // ✅ apiRequest khud token aur headers handle kar lega
      await apiRequest("POST", "/api/delivery/register", formData);

      toast({
        title: "Application submitted! 🚀",
        description: "Bhai, admin ke approval ka wait karein.",
      });

      // ✅ Auth state refresh karein taaki user profile update ho jaye
      await refetchUser();
      
      // Submit ke baad dashboard ya home par bhej dein
      navigate("/");
    } catch (error: any) {
      console.error("Application submission failed:", error);
      toast({
        title: "Something went wrong!",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-8 bg-white shadow-2xl rounded-[2rem] border border-slate-100">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-100">
          <span className="text-3xl text-white">🛵</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Delivery Partner</h1>
        <p className="text-slate-400 font-medium">Shopnish team se judne ke liye form bharein</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label className="font-bold text-slate-700 ml-1">Full Name</Label>
          <Input 
            {...register("fullName")} 
            className="py-6 rounded-xl border-slate-200 focus:border-blue-500 transition-all"
            placeholder="Apna poora naam likhein"
          />
          {errors.fullName && <p className="text-xs text-red-500 font-bold ml-1">{errors.fullName.message}</p>}
        </div>

        <div className="space-y-2">
          <Label className="font-bold text-slate-700 ml-1">Phone Number</Label>
          <Input 
            type="tel" 
            {...register("phone")} 
            className="py-6 rounded-xl border-slate-200 focus:border-blue-500 transition-all"
            placeholder="9928XXXXXX"
          />
          {errors.phone && <p className="text-xs text-red-500 font-bold ml-1">{errors.phone.message}</p>}
        </div>

        <div className="space-y-2">
          <Label className="font-bold text-slate-700 ml-1">Current Address</Label>
          <Textarea 
            {...register("address")} 
            className="rounded-xl border-slate-200 focus:border-blue-500 transition-all min-h-[100px]"
            placeholder="Apna poora pata likhein..."
          />
          {errors.address && <p className="text-xs text-red-500 font-bold ml-1">{errors.address.message}</p>}
        </div>

        <div className="space-y-2">
          <Label className="font-bold text-slate-700 ml-1">Vehicle Type</Label>
          <Input 
            {...register("vehicleType")} 
            className="py-6 rounded-xl border-slate-200 focus:border-blue-500 transition-all"
            placeholder="Bike, Scooter, ya Cycle?"
          />
          {errors.vehicleType && <p className="text-xs text-red-500 font-bold ml-1">{errors.vehicleType.message}</p>}
        </div>

        <Button 
          type="submit" 
          className="w-full py-7 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-70"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting Application..." : "Apply Now"}
        </Button>
      </form>
    </div>
  );
}