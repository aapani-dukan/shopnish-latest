// frontend/client/src/components/LocationDisplay.tsx

import React, { useState } from 'react';
import { useLocation } from '@/context/LocationContext';
import LocationModal from './LocationModal';
import { ChevronDown, ChevronUp } from 'lucide-react';
const LocationDisplay: React.FC = () => { // corrected casing
    const { currentLocation, loadingLocation, error } = useLocation(); // corrected casing
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false); // corrected casing

    // Function to truncate address
    const truncateAddress = (address: string, maxLength: number = 30) => { // added function
        if (address.length <= maxLength) {
            return address;
        }
        return address.substring(0, maxLength) + '...';
    };

    if (loadingLocation) {
        return (
            <div className="flex items-center text-sm font-sans text-gray-600">
                <span className="animate-pulse">Loading location...</span>
            </div>
        );
    }

    // If there's an error and no current location, show error and reload button
    if (error && !currentLocation) {
        return (
            <div className="flex items-center text-sm font-sans text-red-600 space-x-2">
                <span>{error}</span>
                <button
                    onClick={() => window.location.reload()}
                    className="text-blue-600 hover:underline focus:outline-none"
                >
                    Try Again
                </button>
            </div>
        );
    }

    const fullAddress = currentLocation?.address || "Select your address";
    const displayedAddress = truncateAddress(fullAddress);

    return (
        <div className="location-display flex items-center text-sm font-sans text-gray-700">
            <span className="font-medium mr-1">Delivering to:</span>
            <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center space-x-1 p-1 rounded-md hover:bg-gray-200 transition-colors focus:outline-none"
                style={{ fontFamily: 'Arial, sans-serif' }} // Apply English font
            >
                <span className="text-blue-600 font-semibold text-left">{displayedAddress}</span>
                {isModalOpen ? (
                    <ChevronUp className="h-4 w-4 text-blue-600" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-blue-600" />
                )}
            </button>

            {isModalOpen && (
                <LocationModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    // Optionally pass current address to modal if it needs to display it
                    // currentAddress={fullAddress}
                />
            )}
        </div>
    );
};

export default LocationDisplay;
