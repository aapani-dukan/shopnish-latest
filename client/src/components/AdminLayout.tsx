import { Link, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const AdminLayout = () => {
  const { user } = useAuth();

  return (
    <div className="bg-neutral-50 min-h-screen">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-lg p-6 min-h-screen">
          <div className="flex items-center space-x-2 mb-8">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-shield-check text-orange-500"
            >
              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span className="font-bold text-lg text-neutral-800">
              Admin Panel
            </span>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            <Link
              to="/admin/dashboard"
              className="flex items-center space-x-3 px-4 py-2 rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-layout-dashboard h-5 w-5 text-neutral-500"
              >
                <rect width="7" height="9" x="3" y="3" rx="1" />
                <rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" />
                <rect width="7" height="5" x="3" y="16" rx="1" />
              </svg>
              <span>Dashboard</span>
            </Link>

            <Link
              to="/admin/categories"
              className="flex items-center space-x-3 px-4 py-2 rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-tags h-5 w-5 text-neutral-500"
              >
                <path d="M9 5H2v7l8 8 7-7Z" />
                <path d="M13 13L9 9" />
                <circle cx="6" cy="6" r="2" />
                <path d="M17.5 17.5 12.5 12.5" />
                <path d="M19.5 21 14.5 16" />
                <path d="M22 21 17 16" />
              </svg>
              <span>Categories</span>
            </Link>

            {/* 🚀 Future links (Orders, Users, Reports, etc.) यहीं add करना */}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <header className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-neutral-800">
              Admin Dashboard
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-neutral-600">
                Welcome, {user?.name || "Admin"}
              </span>
            </div>
          </header>

          {/* ✅ Nested admin pages यहां render होंगे */}
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
