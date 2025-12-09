import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Package, CheckCircle, Clock, XCircle, ShoppingBag, Bike } from 'lucide-react';
import api from '../lib/api';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

import { Button } from '../components/ui/button';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

interface SubOrder {
  id: number;
  masterorderid: number;
  subordernumber: string;
  sellerid: number;
  storeid?: number;

  // 🔥 Correct backend status enums
  status:
  
| 'pending'
| 'accepted'
| 'ready_for_pickup'
| 'picked_up'
| 'out_for_delivery'
| 'delivered'
| 'cancelled'
| 'rejected'

  subtotal: number;
  deliverycharge: number;
  total: number;
  deliverybatchid?: number;

  isselfdeliverybyseller: boolean;
  createdat: string;
  updatedat: string;

  productName?: string;
  customerName?: string;
  customerPhone?: string;
  quantity?: number;
  orderNumber?: string;
}

const SellerOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<SubOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] =
    useState<SubOrder['status'] | 'all'>('all');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/suborders/seller');
      setOrders(response.data.subOrders || []);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);

      if (err.response?.status === 401) {
        toast.error('कृपया ऑर्डर्स देखने के लिए लॉग इन करें।');
        navigate('/login');
        return;
      }

      toast.error('ऑर्डर्स को लोड करने में समस्या।');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusIcon = (status: SubOrder['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'accepted':
        return <Package className="h-4 w-4 text-blue-600" />;
      case 'ready_for_pickup':
        return <Package className="h-4 w-4 text-purple-600" />;
      case 'picked_up':
        return <Bike className="h-4 w-4 text-green-600" />;
      case 'out_for_delivery':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'delivered':
        return <XCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled':
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      
      default:
        return null;
    }
  };

  const getStatusText = (status: SubOrder['status']) => {
    switch (status) {
      case 'pending': return 'लंबित';
      case 'accepted': return 'स्वीकृत';
      
      case 'ready_for_pickup': return 'पिकअप के लिए तैयार';
      case 'picked_up': return 'पिकअप किया';
      case 'out_for_delivery': return 'डिलीवरी के लिए निकला';
      case 'delivered': return 'डिलीवर किया गया';
      case 'rejected': return 'अस्वीकृत';
      case 'cancelled': return 'रद्द';
      default: return status;
    }
  };

  const filtered = orders.filter(o =>
    filterStatus === 'all' ? true : o.status === filterStatus
  );

  if (loading) {
    return (
      <Card className="p-8 flex justify-center items-center">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="ml-2">ऑर्डर लोड हो रहे हैं…</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <CardHeader className="flex justify-between">
        <CardTitle className="text-2xl font-bold">आपके ऑर्डर</CardTitle>

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="स्टेटस फ़िल्टर" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">सभी</SelectItem>
            <SelectItem value="pending">लंबित</SelectItem>
            <SelectItem value="accepted">स्वीकृत</SelectItem>
            
            <SelectItem value="ready_for_pickup">पिकअप हेतु तैयार</SelectItem>
            <SelectItem value="picked_up">पिकअप किया</SelectItem>
            <SelectItem value="out_for_delivery">डिलीवरी के लिए निकला</SelectItem>
            
            <SelectItem value="delivered">डिलीवर</SelectItem>
            <SelectItem value="rejected">अस्वीकृत</SelectItem>
            <SelectItem value="cancelled">रद्द</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sub Order #</TableHead>
              <TableHead>उत्पाद</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.map(order => (
              <TableRow key={order.id}>
                <TableCell>{order.subordernumber}</TableCell>
                <TableCell>{order.productName || 'Product'}</TableCell>
                <TableCell>{order.quantity || 1}</TableCell>
                <TableCell>₹{order.total}</TableCell>

                <TableCell>
                  <span className="flex items-center gap-1">
                    {getStatusIcon(order.status)}
                    {getStatusText(order.status)}
                  </span>
                </TableCell>

                <TableCell>
                  {format(new Date(order.createdat), 'dd MMM yyyy')}
                </TableCell>

                <TableCell>
                  <Link to={`/seller-dashboard/orders/${order.id}`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-500">
            कोई ऑर्डर नहीं मिला।
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SellerOrdersPage;
