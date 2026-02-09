import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Wallet, Package, User } from 'lucide-react';

const DeliveryLayout = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="bg-neutral-50 min-h-screen pb-24"> {/* pb-24 ताकि कंटेंट नीचे मेनू के पीछे न छुपे */}
      
      {/* Top Header */}
      <header className="bg-white p-4 shadow-sm sticky top-0 z-50 flex justify-between items-center">
        <h1 className="font-black text-xl text-orange-600">ShopNish <span className="text-black text-sm font-medium">Delivery</span></h1>
        <div className="w-8 h-8 bg-neutral-200 rounded-full flex items-center justify-center">
          <User size={18} />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto">
        <Outlet />
      </main>

      {/* 📱 Mobile Bottom Navigation (Sidebar का विकल्प) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-6 py-3 flex justify-between items-center z-50">
        <NavLink to="/delivery/dashboard" icon={<Home size={22} />} label="Home" active={isActive('/delivery/dashboard')} />
        <NavLink to="/delivery/orders" icon={<Package size={22} />} label="Orders" active={isActive('/delivery/orders')} />
        <NavLink to="/delivery/wallet" icon={<Wallet size={22} />} label="Wallet" active={isActive('/delivery/wallet')} />
        <NavLink to="/delivery/profile" icon={<User size={22} />} label="Profile" active={isActive('/delivery/profile')} />
      </nav>
    </div>
  );
};

// छोटा हेल्पर कंपोनेंट
const NavLink = ({ to, icon, label, active }: any) => (
  <Link to={to} className={`flex flex-col items-center gap-1 ${active ? 'text-orange-600' : 'text-neutral-400'}`}>
    {icon}
    <span className="text-[10px] font-bold uppercase">{label}</span>
  </Link>
);

export default DeliveryLayout;