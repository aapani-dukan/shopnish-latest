// client/src/pages/admin/AdminOrderDashboard.tsx

"use client";

import React, { useState } from "react"; // Corrected casing
import { useQuery } from "@tanstack/react-query";
import {
  Card, // Corrected casing
  CardContent, // Corrected casing
  CardHeader, // Corrected casing
  CardTitle, // Corrected casing
} from "../../components/ui/card"; // Corrected path
import {
  Table, // Corrected casing
  TableBody, // Corrected casing
  TableCell, // Corrected casing
  TableHead, // Corrected casing
  TableHeader, // Corrected casing
  TableRow, // Corrected casing
} from "../../components/ui/table"; // Corrected path
import { Button } from "../../components/ui/button"; // Corrected path
import { Loader2, ChevronDown, ChevronRight } from "lucide-react"; // Corrected casing
import api from "../../lib/api"; // Corrected path

// Order Item Interface
interface OrderItem { // Corrected casing
  id: number;
  productName: string; // Corrected casing
  quantity: number;
  price: string;
  subtotal?: string;
}

// Order Interface with all fields
interface Order { // Corrected casing
  id: number;
  orderNumber: string; // Corrected casing
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "placed"
    | "out_for_delivery"
    | "completed"
    | "cancelled";
  deliveryStatus?: string; // Corrected casing
  paymentStatus?: string; // Corrected casing
  paymentMethod?: string; // Corrected casing
  subTotal?: string; // Corrected casing
  total?: string;
  createdAt: string; // Corrected casing
  updatedAt?: string; // Corrected casing
  deliveryAddress?: { // Corrected casing
    fullName?: string; // Corrected casing
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  } | null;
  seller?: { businessName: string; id?: number; email?: string } | null; // Corrected casing
  deliveryBoy?: { id?: number; name: string; phone?: string } | null; // Corrected casing
  items?: OrderItem[]; // Corrected casing
}

export default function AdminOrderDashboard() { // Corrected casing
  const [expandedOrders, setExpandedOrders] = useState<number[]>([]); // Corrected casing

  const toggleExpand = (orderId: number) => { // Corrected casing
    setExpandedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const { data: orders, isLoading } = useQuery<Order[]>({ // Corrected casing
    queryKey: ["admin-orders"], // Corrected casing
    queryFn: async () => {
      const { data } = await api.get<Order[]>("/api/admin/orders"); // Corrected casing
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <Card className="m-4"> {/* Added margin for better spacing */}
      <CardHeader>
        <CardTitle>Orders</CardTitle>
      </CardHeader>
      <CardContent>
        <Table> {/* Corrected casing */}
          <TableHeader> {/* Corrected casing */}
            <TableRow> {/* Corrected casing */}
              <TableHead></TableHead> {/* Corrected casing */}
              <TableHead>ID</TableHead> {/* Corrected casing */}
              <TableHead>Order No</TableHead> {/* Corrected casing */}
              <TableHead>Status</TableHead> {/* Corrected casing */}
              <TableHead>Delivery Status</TableHead> {/* Corrected casing */}
              <TableHead>Payment</TableHead> {/* Corrected casing */}
              <TableHead>Subtotal</TableHead> {/* Corrected casing */}
              <TableHead>Total</TableHead> {/* Corrected casing */}
              <TableHead>Seller</TableHead> {/* Corrected casing */}
              <TableHead>Delivery Boy</TableHead> {/* Corrected casing */}
              <TableHead>Address</TableHead> {/* Corrected casing */}
              <TableHead>Created At</TableHead> {/* Corrected casing */}
              <TableHead>Updated At</TableHead> {/* Corrected casing */}
            </TableRow>
          </TableHeader>
          <TableBody> {/* Corrected casing */}
            {orders?.map((order) => {
              const isExpanded = expandedOrders.includes(order.id); // Corrected casing

              return (
                <React.Fragment key={order.id}> {/* Use React.Fragment */}
                  <TableRow
                    className={isExpanded ? "bg-blue-50" : ""} // Corrected casing
                  >
                    <TableCell> {/* Corrected casing */}
                      {order.items && order.items.length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleExpand(order.id)} // Corrected casing
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" /> // Corrected casing
                          ) : (
                            <ChevronRight className="h-4 w-4" /> // Corrected casing
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>{order.id}</TableCell> {/* Corrected casing */}
                    <TableCell>{order.orderNumber}</TableCell> {/* Corrected casing */}
                    <TableCell>{order.status}</TableCell> {/* Corrected casing */}
                    <TableCell>{order.deliveryStatus ?? "N/A"}</TableCell> {/* Corrected casing */}
                    <TableCell> {/* Corrected casing */}
                      {order.paymentMethod ?? "N/A"} (
                      {order.paymentStatus ?? "N/A"})
                    </TableCell>
                    <TableCell>{order.subTotal ?? "0"}</TableCell> {/* Corrected casing */}
                    <TableCell>{order.total ?? "0"}</TableCell> {/* Corrected casing */}
                    <TableCell> {/* Corrected casing */}
                      {order.seller?.businessName ?? "N/A"} {/* Corrected casing */}
                      {order.seller?.email ? ` (${order.seller.email})` : ""}
                    </TableCell>
                    <TableCell> {/* Corrected casing */}
                      {order.deliveryBoy?.name ?? "N/A"} {/* Corrected casing */}
                      {order.deliveryBoy?.phone
                        ? ` (${order.deliveryBoy.phone})`
                        : ""}
                    </TableCell>
                    <TableCell> {/* Corrected casing */}
                      {order.deliveryAddress
                        ? `${order.deliveryAddress.fullName ?? ""}, ${ // Corrected casing
                            order.deliveryAddress.address ?? ""
                          }, ${order.deliveryAddress.city ?? ""}, ${
                            order.deliveryAddress.state ?? ""
                          } - ${order.deliveryAddress.pincode ?? ""}`
                        : "N/A"}
                    </TableCell>
                    <TableCell> {/* Corrected casing */}
                      {new Date(order.createdAt).toLocaleString()} {/* Corrected casing */}
                    </TableCell>
                    <TableCell> {/* Corrected casing */}
                      {order.updatedAt // Corrected casing
                        ? new Date(order.updatedAt).toLocaleString() // Corrected casing
                        : "N/A"}
                    </TableCell>
                  </TableRow>

                  {isExpanded && order.items && order.items.length > 0 && (
                    <TableRow className="bg-blue-100"> {/* Corrected casing */}
                      <TableCell colSpan={13}> {/* Corrected casing */}
                        <div className="p-2"> {/* Corrected casing */}
                          <strong>Order Items:</strong> {/* Corrected casing */}
                          <Table className="mt-2"> {/* Corrected casing */}
                            <TableHeader> {/* Corrected casing */}
                              <TableRow> {/* Corrected casing */}
                                <TableHead>ID</TableHead> {/* Corrected casing */}
                                <TableHead>Product</TableHead> {/* Corrected casing */}
                                <TableHead>Quantity</TableHead> {/* Corrected casing */}
                                <TableHead>Price</TableHead> {/* Corrected casing */}
                                <TableHead>Subtotal</TableHead> {/* Corrected casing */}
                              </TableRow>
                            </TableHeader>
                            <TableBody> {/* Corrected casing */}
                              {order.items.map((item) => (
                                <TableRow key={item.id}> {/* Corrected casing */}
                                  <TableCell>{item.id}</TableCell> {/* Corrected casing */}
                                  <TableCell>{item.productName}</TableCell> {/* Corrected casing */}
                                  <TableCell>{item.quantity}</TableCell> {/* Corrected casing */}
                                  <TableCell>{item.price}</TableCell> {/* Corrected casing */}
                                  <TableCell> {/* Corrected casing */}
                                    {item.subtotal ??
                                      String(
                                        Number(item.price) * item.quantity
                                      )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
