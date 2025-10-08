"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import api from "@/lib/api";

// ✅ Order Item interface
interface OrderItem {
  id: number;
  productName: string;
  quantity: number;
  price: string;
  subtotal?: string;
}

// ✅ Updated Order interface with all fields
interface Order {
  id: number;
  orderNumber: string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "placed"
    | "out_for_delivery"
    | "completed"
    | "cancelled";
  deliveryStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  subtotal?: string;
  total?: string;
  createdAt: string;
  updatedAt?: string;
  deliveryAddress?: {
    fullName?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  } | null;
  seller?: { businessName: string; id?: number; email?: string } | null;
  deliveryBoy?: { id?: number; name: string; phone?: string } | null;
  items?: OrderItem[];
}

export default function AdminOrderDashboard() {
  const [expandedOrders, setExpandedOrders] = useState<number[]>([]);

  const toggleExpand = (orderId: number) => {
    setExpandedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data } = await api.get<Order[]>("/api/admin/orders");
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
    <Card>
      <CardHeader>
        <CardTitle>Orders</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Order No</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Delivery Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Subtotal</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Delivery Boy</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Updated At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.map((order) => {
              const isExpanded = expandedOrders.includes(order.id);

              return (
                <>
                  <TableRow
                    key={order.id}
                    className={isExpanded ? "bg-blue-50" : ""}
                  >
                    <TableCell>
                      {order.items && order.items.length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleExpand(order.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.orderNumber}</TableCell>
                    <TableCell>{order.status}</TableCell>
                    <TableCell>{order.deliveryStatus ?? "N/A"}</TableCell>
                    <TableCell>
                      {order.paymentMethod ?? "N/A"} (
                      {order.paymentStatus ?? "N/A"})
                    </TableCell>
                    <TableCell>{order.subtotal ?? "0"}</TableCell>
                    <TableCell>{order.total ?? "0"}</TableCell>
                    <TableCell>
                      {order.seller?.businessName ?? "N/A"}
                      {order.seller?.email ? ` (${order.seller.email})` : ""}
                    </TableCell>
                    <TableCell>
                      {order.deliveryBoy?.name ?? "N/A"}
                      {order.deliveryBoy?.phone
                        ? ` (${order.deliveryBoy.phone})`
                        : ""}
                    </TableCell>
                    <TableCell>
                      {order.deliveryAddress
                        ? `${order.deliveryAddress.fullName ?? ""}, ${
                            order.deliveryAddress.address ?? ""
                          }, ${order.deliveryAddress.city ?? ""}, ${
                            order.deliveryAddress.state ?? ""
                          } - ${order.deliveryAddress.pincode ?? ""}`
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {new Date(order.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {order.updatedAt
                        ? new Date(order.updatedAt).toLocaleString()
                        : "N/A"}
                    </TableCell>
                  </TableRow>

                  {/* ✅ Expand/Collapse Nested Table */}
                  {isExpanded && order.items && order.items.length > 0 && (
                    <TableRow className="bg-blue-100">
                      <TableCell colSpan={13}>
                        <div className="p-2">
                          <strong>Order Items:</strong>
                          <Table className="mt-2">
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Subtotal</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {order.items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell>{item.id}</TableCell>
                                  <TableCell>{item.productName}</TableCell>
                                  <TableCell>{item.quantity}</TableCell>
                                  <TableCell>{item.price}</TableCell>
                                  <TableCell>
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
                </>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
      }
