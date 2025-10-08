import { useState } from "react";
// ✅ wouter के बजाय react-router-dom से useParams और useNavigate इंपोर्ट करें
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RotateCcw, Package, AlertCircle, CheckCircle } from "lucide-react";

interface OrderItem {
  id: number;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  product: {
    id: number;
    name: string;
    nameHindi: string;
    image: string;
    unit: string;
  };
}

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  items: OrderItem[];
}

export default function ReturnRequest() {
  const { orderId } = useParams();
  // ✅ navigate हुक का उपयोग करें
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [returnData, setReturnData] = useState({
    reason: "",
    description: "",
    refundMethod: "original",
    selectedItems: [] as number[]
  });

  // Fetch order details
  const { data: order, isLoading } = useQuery<Order>({
    queryKey: [`/api/orders/${orderId}`],
    enabled: !!orderId,
  });

  // Submit return request mutation
  const submitReturnMutation = useMutation({
    mutationFn: async (requestData: any) => {
      return await apiRequest("POST", `/api/orders/${orderId}/return-request`, requestData);
    },
    onSuccess: () => {
      toast({
        title: "Return Request Submitted",
        description: "Your return request has been submitted successfully. We'll review it within 24 hours.",
      });
      navigate("/order-history");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit return request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleItemSelection = (itemId: number, checked: boolean) => {
    if (checked) {
      setReturnData({
        ...returnData,
        selectedItems: [...returnData.selectedItems, itemId]
      });
    } else {
      setReturnData({
        ...returnData,
        selectedItems: returnData.selectedItems.filter(id => id !== itemId)
      });
    }
  };

  const handleSubmit = () => {
    if (!returnData.reason) {
      toast({
        title: "Reason Required",
        description: "Please select a reason for return",
        variant: "destructive",
      });
      return;
    }

    if (returnData.selectedItems.length === 0) {
      toast({
        title: "Items Required",
        description: "Please select at least one item to return",
        variant: "destructive",
      });
      return;
    }

    if (!returnData.description.trim()) {
      toast({
        title: "Description Required",
        description: "Please provide a description of the issue",
        variant: "destructive",
      });
      return;
    }

    const selectedOrderItems = order?.items.filter(item => 
      returnData.selectedItems.includes(item.id)
    ) || [];

    const refundAmount = selectedOrderItems.reduce((sum, item) => 
      sum + parseFloat(item.totalPrice), 0
    );

    submitReturnMutation.mutate({
      ...returnData,
      refundAmount: refundAmount.toFixed(2),
      orderItems: selectedOrderItems
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">Order not found</h3>
            <p className="text-gray-600 mb-4">Unable to process return request</p>
            <Button onClick={() => navigate("/order-history")}>Back to Orders</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedItems = order.items.filter(item => 
    returnData.selectedItems.includes(item.id)
  );
  const refundAmount = selectedItems.reduce((sum, item) => 
    sum + parseFloat(item.totalPrice), 0
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <RotateCcw className="w-8 h-8 text-orange-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Return Request</h1>
              <p className="text-gray-600">Order #{order.orderNumber}</p>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-800">Return Policy</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Items can be returned within 24 hours of delivery for damaged, defective, or wrong products. 
                  Refunds will be processed within 3-5 business days after approval.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Return Form */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Select Items */}
            <Card>
              <CardHeader>
                <CardTitle>Select Items to Return</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <Checkbox
                        checked={returnData.selectedItems.includes(item.id)}
                        onCheckedChange={(checked) => handleItemSelection(item.id, checked as boolean)}
                      />
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium">{item.product.name}</h4>
                        <p className="text-sm text-gray-600">{item.product.nameHindi}</p>
                        <p className="text-sm text-gray-500">
                          ₹{item.unitPrice} × {item.quantity} {item.product.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">₹{item.totalPrice}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Return Reason */}
            <Card>
              <CardHeader>
                <CardTitle>Reason for Return</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={returnData.reason}
                  onValueChange={(value) => setReturnData({...returnData, reason: value})}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="damaged" id="damaged" />
                    <Label htmlFor="damaged">Item was damaged during delivery</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="defective" id="defective" />
                    <Label htmlFor="defective">Item is defective or not working</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="wrong_item" id="wrong_item" />
                    <Label htmlFor="wrong_item">Wrong item delivered</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="quality" id="quality" />
                    <Label htmlFor="quality">Poor quality or not as described</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="expired" id="expired" />
                    <Label htmlFor="expired">Item is expired or near expiry</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other">Other reason</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Describe the Issue</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={returnData.description}
                  onChange={(e) => setReturnData({...returnData, description: e.target.value})}
                  placeholder="Please provide details about the issue with your order..."
                  rows={4}
                />
              </CardContent>
            </Card>

            {/* Refund Method */}
            <Card>
              <CardHeader>
                <CardTitle>Refund Method</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={returnData.refundMethod}
                  onValueChange={(value) => setReturnData({...returnData, refundMethod: value})}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="original" id="original" />
                    <Label htmlFor="original">Refund to original payment method</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="wallet" id="wallet" />
                    <Label htmlFor="wallet">Add to Shopnish wallet credit</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          {/* Return Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Return Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Selected Items</p>
                    <p className="font-medium">{returnData.selectedItems.length} of {order.items.length} items</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">Refund Amount</p>
                    <p className="text-2xl font-bold text-green-600">₹{refundAmount.toFixed(2)}</p>
                  </div>

                  {returnData.refundMethod === "original" && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Refund will be processed to your original payment method within 3-5 business days
                      </p>
                    </div>
                  )}

                  {returnData.refundMethod === "wallet" && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-800">
                        Amount will be added to your Shopnish wallet instantly after approval
                      </p>
                    </div>
                  )}

                  <div className="space-y-3 pt-4">
                    <Button
                      onClick={handleSubmit}
                      disabled={submitReturnMutation.isPending || returnData.selectedItems.length === 0}
                      className="w-full"
                    >
                      {submitReturnMutation.isPending ? "Submitting..." : "Submit Return Request"}
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => navigate("/order-history")}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Help Section */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600">
                    For any questions about returns, contact our support team:
                  </p>
                  <p className="font-medium">📞 +91-9876543210</p>
                  <p className="font-medium">📧 support@shopnish.com</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
