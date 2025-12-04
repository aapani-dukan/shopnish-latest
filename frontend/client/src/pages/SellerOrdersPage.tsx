// client/src/pages/SellerOrdersPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Package, CheckCircle, Clock, XCircle, ShoppingBag } from 'lucide-react';
import api from '../lib/api'; // आपका कॉन्फ़िगर किया गया API इंस्टेंस
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

// Shadcn UI Components
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

// SubOrder इंटरफ़ेस
interface SubOrder {
  id: string;
  masterorderid: number;
  subordernumber: string;
  sellerid: number;
  storeid?: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  subtotal: number;
  deliverycharge: number;
  total: number;
  deliverybatchid?: number;
  estimatedpreparationtime?: string;
  isselfdeliverybyseller: boolean;
  createdat: string;
  updatedat: string;
  productName?: string;
  customerName?: string;
  customerPhone?: string;
  orderNumber?: string;
}

const SellerOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<SubOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<SubOrder['status'] | 'all'>('all');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Vercel प्रॉक्सी के माध्यम से रिलेटिव पाथ
      const response = await api.get('/suborders/seller');
      setOrders(response.data.subOrders || []);
    } catch (err: any) {
      console.error('Failed to fetch orders:', err);
      
      if (err.response?.status === 401) {
         setError("कृपया ऑर्डर्स देखने के लिए लॉग इन करें।");
         toast.error("कृपया ऑर्डर्स देखने के लिए लॉग इन करें।");
         navigate('/login');
      } else {
        const errorMessage = err.response?.data?.message || 'ऑर्डर्स को लोड करने में विफल।';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusIcon = (status: SubOrder['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processing':
        return <Package className="h-4 w-4 text-blue-500" />;
      case 'shipped':
        return <Package className="h-4 w-4 text-purple-500" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: SubOrder['status']) => {
    switch (status) {
      case 'pending': return 'लंबित';
      case 'processing': return 'प्रसंस्करण में';
      case 'shipped': return 'भेजा गया';
      case 'delivered': return 'डिलीवर किया गया';
      case 'cancelled': return 'रद्द किया गया';
      default: return status;
    }
  };

  const filteredOrders = (orders || []).filter(order =>
    filterStatus === 'all' || order.status === filterStatus
  );

  if (loading) {
    return (
      <Card className="p-4 sm:p-6 lg:p-8">
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="ml-2 text-lg text-gray-700">ऑर्डर लोड हो रहे हैं...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 sm:p-6 lg:p-8">
        <div className="text-center p-8 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-xl font-semibold text-red-700">त्रुटि</h2>
          <p className="text-red-600 mt-2">{error}</p>
          <Button onClick={fetchOrders} className="mt-4" variant="destructive">
            पुनः प्रयास करें
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 lg:p-8">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-0 mb-6">
        <CardTitle className="text-3xl font-bold text-gray-800 mb-4 sm:mb-0">आपके ऑर्डर</CardTitle>
        <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as SubOrder['status'] | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="स्टेटस द्वारा फ़िल्टर करें" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">सभी ऑर्डर</SelectItem>
            <SelectItem value="pending">लंबित</SelectItem>
            <SelectItem value="processing">प्रसंस्करण में</SelectItem>
            <SelectItem value="shipped">भेजा गया</SelectItem>
            <SelectItem value="delivered">डिलीवर किया गया</SelectItem>
            <SelectItem value="cancelled">रद्द किया गया</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="p-0">
        {filteredOrders.length === 0 ? (
          <div className="text-center p-10 bg-gray-50 rounded-lg">
            <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
            <p className="text-lg text-gray-600 mt-4">कोई ऑर्डर नहीं मिला।</p>
            <p className="text-gray-500 mt-2">यहां आपके सभी ऑर्डर दिखाई देंगे।</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-gray-200">
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">सब-ऑर्डर #</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">उत्पाद विवरण</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">मात्रा</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">कुल</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">स्टेटस</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">तिथि</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">क्रियाएं</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{order.subordernumber}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {order.productName || `उत्पाद ID: ${order.id}`} <br/>
                      {order.customerName && <span className="text-xs text-gray-400">({order.customerName} - {order.customerPhone || 'N/A'})</span>}
                      {!order.customerName && order.masterorderid && <span className="text-xs text-gray-400">मास्टर ऑर्डर ID: {order.masterorderid}</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{order.quantity}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">₹{Number(order.total).toFixed(2)}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                      {/* यहाँ पर बदलाव किया गया है: अनावश्यक {} और `` हटा दिए गए हैं */}
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {getStatusIcon(order.status)}
                        <span className="ml-1">{getStatusText(order.status)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(order.createdat), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      {/* यह वह लाइन है जहाँ त्रुटि आ रही थी, अब यह ठीक होनी चाहिए */}
                      <Link to={`/seller-dashboard/orders/${order.id}`} className="text-indigo-600 hover:text-indigo-900">
                        <Button variant="ghost" size="sm">विवरण देखें</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SellerOrdersPage;
