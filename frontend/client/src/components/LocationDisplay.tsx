// client/src/components/LocationDisplay.tsx

import React, { useState } from 'react';
import { useLocation } from '@/context/LocationContext';
import LocationModal from './LocationModal';
import { ChevronDown, ChevronUp } from 'lucide-react';

const LocationDisplay: React.FC = () => {
    // 1. useLocation से डेटा ठीक से प्राप्त करें
    const { 
        currentLocation, 
        loadingLocation, 
        error 
    } = useLocation(); 
    
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    // Function to truncate address
    const truncateAddress = (address: string, maxLength: number = 30) => {
        if (address.length <= maxLength) {
            return address;
        }
        return address.substring(0, maxLength) + '...';
    };

    if (loadingLocation) {
        return (
            <div className="flex items-center text-sm font-sans text-gray-600">
                <span className="animate-pulse">लोकेशन लोड हो रही है...</span> {/* Hindi translation added */}
            </div>
        );
    }

    // If there's an error and no current location, show error and reload button
    if (error && !currentLocation) {
        return (
            <div className="flex items-center text-sm font-sans text-red-600 space-x-2">
                <span>त्रुटि: {error}</span> {/* Hindi translation added */}
                <button
                    // ⚠️ Warning: window.location.reload() कठोर है, बेहतर होगा कि आप LocationContext में 
                    // 'reloadLocation' फ़ंक्शन का उपयोग करें।
                    onClick={() => window.location.reload()} 
                    className="text-blue-600 hover:underline focus:outline-none"
                >
                    पुनः प्रयास करें
                </button>
            </div>
        );
    }

    const fullAddress = currentLocation?.address || "अपना पता चुनें"; // Hindi translation added
    const displayedAddress = truncateAddress(fullAddress);

    return (
        <div className="location-display flex items-center text-sm font-sans text-gray-700">
            <span className="font-medium mr-1">डिलीवर किया जा रहा है:</span> {/* Hindi translation added */}
            <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center space-x-1 p-1 rounded-md hover:bg-gray-200 transition-colors focus:outline-none"
                style={{ fontFamily: 'Arial, sans-serif' }} 
            >
                <span className="text-blue-600 font-semibold text-left">{displayedAddress}</span>
                {isModalOpen ? (
                    <ChevronUp className="h-4 w-4 text-blue-600" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-blue-600" />
                )}
            </button>

            {/* 🛑 FIX: Modal को render करें जब isOpen true हो */}
            {isModalOpen && (
                <LocationModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default LocationDisplay;
