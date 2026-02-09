import { useState, useEffect } from 'react';
import { TrendingUp, IndianRupee, History, ArrowUpRight, Clock, Loader2, Download } from 'lucide-react';

interface Transaction {
  id: number;
  amount: string;
  type: string;
  description: string;
  createdAt: string;
  status: string;
}

const SellerWallet = () => {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. डेटा फेच करने का फंक्शन
  const fetchSellerWallet = async () => {
    try {
      setLoading(true);
      // Backend API (अभी हम इसे बनाएंगे)
      const response = await fetch('/api/wallet/my-wallet'); 
      const data = await response.json();
      
      setBalance(Number(data.balance || 0));
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error("Error fetching seller wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerWallet();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 bg-neutral-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-black text-neutral-800 tracking-tight">Financial Overview</h1>
        <button className="flex items-center gap-2 text-sm font-bold bg-white border border-neutral-200 px-4 py-2 rounded-xl hover:bg-neutral-50 transition">
          <Download size={16} /> Export Statement
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Main Balance Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-neutral-100 relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <IndianRupee size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-3 py-1 rounded-full">
              Available
            </span>
          </div>
          <p className="text-neutral-400 text-sm font-medium">Net Earnings</p>
          <h2 className="text-4xl font-black text-neutral-900 mt-1">₹{balance.toLocaleString()}</h2>
          <button 
            disabled={balance <= 0}
            className="w-full mt-6 bg-black text-white py-4 rounded-2xl font-bold hover:bg-neutral-800 transition disabled:bg-neutral-200 disabled:cursor-not-allowed shadow-lg shadow-black/10"
          >
            Withdraw Funds
          </button>
        </div>

        {/* Pending Payouts Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-neutral-100">
          <div className="flex items-center justify-between mb-6 text-orange-500">
            <div className="p-3 bg-orange-50 rounded-2xl">
              <Clock size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 px-3 py-1 rounded-full">
              Processing
            </span>
          </div>
          <p className="text-neutral-400 text-sm font-medium">Pending Settlements</p>
          <h2 className="text-4xl font-black text-neutral-900 mt-1">₹{(balance * 0.15).toFixed(2)}</h2> 
          <p className="text-xs text-neutral-400 mt-4 flex items-center gap-1 font-medium">
            <TrendingUp size={12} className="text-green-500" /> +12% from last week
          </p>
        </div>
      </div>

      {/* Recent Payouts Table */}
      {/* Recent Payouts Table के ठीक ऊपर वाली हेडिंग में */}
<div className="flex items-center justify-between mb-6">
  <h3 className="font-black text-xl text-neutral-800 tracking-tight flex items-center gap-2">
    <History size={22} className="text-neutral-400" /> Transaction History
  </h3>
</div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-neutral-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50">
                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-neutral-400">Activity</th>
                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-neutral-400">Date</th>
                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-neutral-400">Amount</th>
                <th className="px-8 py-5 text-[11px] font-black uppercase tracking-widest text-neutral-400 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {transactions.length > 0 ? (
                transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-neutral-50/50 transition">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-neutral-100 text-neutral-600 rounded-lg">
                          <ArrowUpRight size={16} />
                        </div>
                        <span className="font-bold text-neutral-800 text-sm">{txn.description}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-neutral-500 font-medium">
                      {new Date(txn.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-5 font-black text-sm text-neutral-800">
                      ₹{Number(txn.amount).toLocaleString()}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="text-[10px] bg-green-100 text-green-700 px-3 py-1 rounded-full font-black uppercase">
                        {txn.status || 'Completed'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-neutral-400 font-medium">
                    No transactions found in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SellerWallet;