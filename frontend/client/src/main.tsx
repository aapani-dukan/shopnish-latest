// client/src/main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom"; // Capitalized BrowserRouter
import App from "./App.tsx";
import "./index.css";

// Providers from your setup
import { QueryClientProvider } from "@tanstack/react-query"; // Correct import path
import { queryClient } from "./lib/queryClient"; // Correct import path
import { Toaster } from "./components/ui/toaster"; // Assuming this path
import { TooltipProvider } from "./components/ui/tooltip"; // Assuming this path
import { AuthProvider } from "./hooks/useAuth"; // Assuming this path
import { SocketProvider } from "./hooks/useSocket"; // Assuming this path

// Import the LocationProvider
import { LocationProvider } from "./context/LocationContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            {/* LocationProvider को यहाँ जोड़ें */}
            <LocationProvider>
              <SocketProvider>
                 <>
                <Toaster />
                <App />
                 </>
                </SocketProvider>        
            </LocationProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
