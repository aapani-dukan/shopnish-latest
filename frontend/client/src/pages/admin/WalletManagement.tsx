import { useState, useEffect } from 'react';
import { Wallet, Search, CheckCircle, RefreshCcw } from 'lucide-react';
import { auth } from '../../lib/firebase';
interface WalletData {
  walletId: number;
  userId: number;
  userName: string;
  userLastName: string;
  userPhone: string;
  userType: 'seller' | 'delivery-boy' | 'admin' | 'customer';
  balance: string | number;
  codBalance: string | number;
}
const AdminWalletManager = () => {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // 1. डेटा लोड करना
 
const fetchWallets = async () => {
  setLoading(true);
  try {
    // 🚨 Firebase से ताज़ा टोकन प्राप्त करें
    const user = auth.currentUser;
    if (!user) {
      console.error("Admin not logged in");
      return;
    }
    
    // यह फ़ंक्शन JWT टोकन निकालता है
    const token = await user.getIdToken(); 

    const response = await fetch('/api/wallet/admin/all-wallets', {
      headers: {
        'Authorization': `Bearer ${token}`, // ✅ Firebase Token यहाँ जा रहा है
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    // 🚨 Array Check (ताकि .filter वाला एरर न आए)
    if (Array.isArray(data)) {
      setWallets(data);
    } else {
      console.error("API Error Response:", data);
      setWallets([]); 
    }
  } catch (error) {
    console.error("Error fetching wallets:", error);
    setWallets([]);
  } finally {
    setLoading(false);
  }
};
  useEffect(() => {
    fetchWallets();
  }, []);
const platformBalance = wallets
  .filter(w => w.userType === 'admin')
  .reduce(
    (acc, curr) => acc + Number(curr.balance || 0),
    0
  );

const totalCODCollected = wallets
  .filter(w => w.userType === 'delivery-boy')
  .reduce(
    (acc, curr) => acc + Number(curr.codBalance || 0),
    0
  );
  // 2. Settlement Logic (कैश जमा करना)
 
  const filteredWallets = wallets
  .filter(w => w.userType !== 'admin' && w.userType !== 'customer')
  .filter(w =>
    w.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.userPhone?.includes(searchTerm)
  );
  const handleSettle = async (
  userId: number,
  amount: number,
  type: string
) => {
  const defaultNote =
    type === 'delivery-boy'
      ? 'COD cash received from delivery boy'
      : 'Seller payout';

  const note = prompt('Enter settlement note:', defaultNote);

  if (!note) return;

  try {
    const token = await auth.currentUser?.getIdToken();

    if (!token) {
      alert('Authentication token not found.');
      return;
    }

    const endpoint =
      type === 'delivery-boy'
        ? '/api/wallet/admin/settle-cash'
        : '/api/wallet/admin/settle-seller';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        targetUserId: userId,
        amount,
        note
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'Settlement failed');
    }

    alert(
      type === 'delivery-boy'
        ? 'COD Settlement Successful!'
        : 'Seller Settlement Successful!'
    );

    fetchWallets();

  } catch (error: any) {
    console.error('Settlement Error:', error);
    alert(error?.message || 'Settlement failed!');
  }
};
const handleSettleEarning = async (
  userId: number,
  amount: number
) => {
  const settlementAmount = Math.abs(Number(amount));

  if (settlementAmount <= 0) {
    alert("No earning balance available for settlement.");
    return;
  }

  const note = prompt(
    "Enter earning settlement note:",
    "Delivery earning paid by admin"
  );

  if (!note) return;

  try {
    const token = await auth.currentUser?.getIdToken();

    if (!token) {
      alert("Authentication token not found.");
      return;
    }

    const res = await fetch('/api/wallet/admin/settle-earning', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        targetUserId: userId,
        amount: settlementAmount,
        note
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || "Earning settlement failed!");
      return;
    }

    alert("Delivery earning settlement successful!");
    fetchWallets();

  } catch (error) {
    console.error("Earning settlement error:", error);
    alert("Earning settlement failed!");
  }
};
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
  <Wallet className="text-blue-600" /> Wallet Master Control
</h1>
          <p className="text-gray-500">Manage all Seller & Delivery Partner balances</p>
        </div>
        <button onClick={fetchWallets} className="p-2 bg-white border rounded-lg hover:bg-gray-100">
          <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* ADMIN / PLATFORM BALANCE */}
  <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
    <p className="text-sm text-gray-500 uppercase font-bold">
      Platform Balance
    </p>

    <h2 className="text-3xl font-black text-blue-600">
      ₹{platformBalance.toFixed(2)}
    </h2>

    <p className="text-xs text-gray-400 mt-1">
      Admin Wallet
    </p>
  </div>
   {/* DELIVERY BOY COD */}
  <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-orange-500">
    <p className="text-sm text-gray-500 uppercase font-bold">
      COD With Delivery Partners
    </p>

    <h2 className="text-3xl font-black text-orange-600">
      ₹{totalCODCollected.toFixed(2)}
    </h2>

    <p className="text-xs text-gray-400 mt-1">
      Cash not yet deposited
    </p>
    </div>
     {/* TOTAL SELLER BALANCE */}
  <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
    <p className="text-sm text-gray-500 uppercase font-bold">
      Seller Payables
    </p>

    <h2 className="text-3xl font-black text-green-600">
      ₹
      {wallets
        .filter(w => w.userType === 'seller')
        .reduce(
          (acc, curr) => acc + Number(curr.balance || 0),
          0
        )
        .toFixed(2)}
    </h2>

    <p className="text-xs text-gray-400 mt-1">
      Amount payable to sellers
    </p>
  </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search by name or phone..." 
          className="w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Wallets Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100 text-gray-600 uppercase text-sm">
            <tr>
              <th className="px-6 py-4">User Details</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Current Balance</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredWallets.map((wallet) => (
              <tr key={wallet.walletId} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-800">{wallet.userName} {wallet.userLastName}</div>
                  <div className="text-xs text-gray-400">{wallet.userPhone}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    wallet.userType === 'seller' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {wallet.userType.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono">
  <div className="space-y-2">

    {/* EARNING BALANCE */}
    <div>
      <p className="text-[10px] text-gray-400 uppercase font-bold">
        Earning Balance
      </p>

      <span className="text-lg font-bold text-green-600">
        ₹{Number(wallet.balance || 0).toFixed(2)}
      </span>
    </div>

    {/* COD BALANCE - केवल Delivery Boy */}
    {wallet.userType === 'delivery-boy' && (
      <div>
        <p className="text-[10px] text-orange-500 uppercase font-bold">
          COD Collected
        </p>

        <span className="text-lg font-bold text-orange-600">
          ₹{Number(wallet.codBalance || 0).toFixed(2)}
        </span>
      </div>
    )}

  </div>
</td>
              <td className="px-6 py-4 text-center">
  <div className="flex flex-col items-center gap-2">

    {/* Delivery Boy Earning Settlement */}
    {wallet.userType === 'delivery-boy' && (
      <button
        onClick={() =>
          handleSettleEarning(
            wallet.userId,
            Math.abs(Number(wallet.balance || 0))
          )
        }
        disabled={Number(wallet.balance || 0) <= 0}
        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <CheckCircle size={16} />
        Settle Earning
      </button>
    )}

    {/* Delivery Boy COD Settlement */}
    {wallet.userType === 'delivery-boy' && (
      <button
        onClick={() =>
          handleSettle(
            wallet.userId,
            Number(wallet.codBalance || 0),
            wallet.userType
          )
        }
        disabled={Number(wallet.codBalance || 0) <= 0}
        className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <CheckCircle size={16} />
        Settle COD
      </button>
    )}

    {/* Seller Settlement */}
    {wallet.userType === 'seller' && (
      <button
        onClick={() =>
          handleSettle(
            wallet.userId,
            Math.abs(Number(wallet.balance || 0)),
            wallet.userType
          )
        }
        disabled={Number(wallet.balance || 0) <= 0}
        className="flex items-center gap-2 mx-auto bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <CheckCircle size={16} />
        Settle Full
      </button>
    )}

  </div>
</td>  
               
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminWalletManager;