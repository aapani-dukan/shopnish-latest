import { useState, useEffect } from 'react';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Search, CheckCircle, RefreshCcw } from 'lucide-react';
import { auth } from '../../lib/firebase';
interface WalletData {
  walletId: number;
  userId: number;
  userName: string;
  userLastName: string;
  userPhone: string;
  userType: 'seller' | 'delivery-boy' | 'admin' | 'customer';
  balance: string | number;
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

  // 2. Settlement Logic (कैश जमा करना)
  const handleSettle = async (userId:number, amount:number, type:string) => {
    const defaultNote = `Settlement for ${type.toUpperCase()} - Cash received`;
    const note = prompt("Enter settlement note:", defaultNote);
    if (!note) return;

    try {
    const token = await auth.currentUser?.getIdToken(); // ✅ Get fresh token
    
    const res = await fetch('/api/wallet/admin/settle-cash', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ targetUserId: userId, amount, note })
    });
    
    if (res.ok) {
      alert("Settlement Successful!");
      fetchWallets();
    }
  } catch (error) {
    alert("Settlement failed!");
  }
};

  const filteredWallets = wallets.filter(w => 
    w.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    w.userPhone?.includes(searchTerm)
  );

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
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
          <p className="text-sm text-gray-500 uppercase font-bold">Total Platform Balance</p>
          <h2 className="text-3xl font-black">₹{wallets.reduce((acc, curr) => acc + Number(curr.balance), 0).toFixed(2)}</h2>
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
  <div className="flex items-center gap-3">
    {/* 🚀 आइकन्स का असली इस्तेमाल यहाँ है */}
    {Number(wallet.balance) < 0 ? (
      <div className="p-2 bg-red-100 rounded-full text-red-600">
        <ArrowDownCircle size={20} />
      </div>
    ) : (
      <div className="p-2 bg-green-100 rounded-full text-green-600">
        <ArrowUpCircle size={20} />
      </div>
    )}

    <div>
      <span className={`text-lg font-bold ${Number(wallet.balance) < 0 ? 'text-red-500' : 'text-green-600'}`}>
        {Number(wallet.balance) < 0 ? '-' : '+'}₹{Math.abs(Number(wallet.balance)).toFixed(2)}
      </span>
      {Number(wallet.balance) < 0 ? (
        <p className="text-[10px] text-red-400 font-sans uppercase tracking-wider font-bold">Cash Due to Office</p>
      ) : (
        <p className="text-[10px] text-green-400 font-sans uppercase tracking-wider font-bold">Earnings Ready</p>
      )}
    </div>
  </div>
</td>
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => handleSettle(wallet.userId, Math.abs(Number(wallet.balance)), wallet.userType)}
                    className="flex items-center gap-2 mx-auto bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition text-sm"
                  >
                    <CheckCircle size={16} /> Settle Full
                  </button>
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