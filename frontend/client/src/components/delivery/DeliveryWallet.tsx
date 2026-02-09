import { useState, useEffect } from 'react';
import { Wallet, ArrowDownLeft, ArrowUpRight, History, AlertCircle, Loader2 } from 'lucide-react';

const DeliveryWallet = () => {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Backend se Data Fetch karne ka logic
  const fetchWalletData = async () => {
    try {
      setLoading(true);
      // Maan lo aapka endpoint ye hai (Isko hum backend mein banayenge)
      const response = await fetch('/api/wallet/my-wallet'); 
      const data = await response.json();
      
      setBalance(Number(data.balance || 0));
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error("Error fetching wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  // 2. useEffect ka use karke page load hote hi data mangwana
  useEffect(() => {
    fetchWalletData();
  }, []);

  // Calculation Logic
  const cashInHand = balance < 0 ? Math.abs(balance) : 0;
  const earnings = balance > 0 ? balance : 0;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-orange-500" size={40} />
      </div>
    );
  }

  return (
    <div className="p-4 bg-neutral-50 min-h-screen pb-20 font-sans">
      <h1 className="text-xl font-bold mb-4">My Wallet</h1>

      {/* 💳 Balance Card */}
      <div className="bg-neutral-900 text-white p-6 rounded-[2.5rem] shadow-2xl mb-6 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-neutral-400 text-sm mb-1 font-medium">Platform Balance</p>
          <h2 className="text-4xl font-black mb-4 tracking-tight">₹{balance.toFixed(2)}</h2>
          
          <div className="grid grid-cols-2 gap-4 border-t border-neutral-800 pt-5">
            <div>
              <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Your Earnings</p>
              <p className="text-green-400 text-lg font-black">₹{earnings.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">COD to Deposit</p>
              <p className="text-red-400 text-lg font-black">₹{cashInHand.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <Wallet className="absolute -right-6 -bottom-6 text-neutral-800/50" size={140} />
      </div>

      {/* ⚠️ Alert Logic */}
      {cashInHand > 2000 && (
        <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-start gap-3 mb-6 animate-pulse">
          <AlertCircle className="text-orange-600 mt-1" size={20} />
          <div>
            <p className="text-orange-900 font-bold text-sm">Limit Exceeded!</p>
            <p className="text-orange-700 text-xs">Please deposit cash at office to continue receiving orders.</p>
          </div>
        </div>
      )}

      {/* 📜 Transactions List */}
      <h3 className="font-bold flex items-center gap-2 mb-4 text-neutral-800">
        <History size={18} /> Transaction History
      </h3>

      <div className="space-y-3">
        {transactions.length > 0 ? (
          transactions.map((txn) => (
            <div key={txn.id} className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm border border-neutral-100">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${Number(txn.amount) > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {Number(txn.amount) > 0 ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                </div>
                <div>
                  <p className="font-bold text-sm text-neutral-800">{txn.description}</p>
                  <p className="text-[10px] text-neutral-400 font-medium">
                    {new Date(txn.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <p className={`font-black ${Number(txn.amount) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Number(txn.amount) > 0 ? '+' : ''}₹{txn.amount}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-neutral-400">
            <p>No transactions yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryWallet;