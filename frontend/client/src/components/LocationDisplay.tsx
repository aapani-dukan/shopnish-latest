// frontend/client/src/components/LocationDisplay.tsx

import React, { useState } from 'react';
import { useLocation } from '../context/LocationContext';
import LocationModal from './LocationModal';

const LocationDisplay: React.FC = () => {
    const { currentLocation, loadingLocation, error } = useLocation();
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    if (loadingLocation) {
        return <div className="location-display">लोकेशन लोड हो रही है...</div>;
    }

    if (error && !currentLocation) { // Show error if no location is set
        return (
            <div className="location-display error">
                {error} 
                <button onClick={() => window.location.reload()}>फिर से कोशिश करें</button>
            </div>
        );
    }

    return (
        <div className="location-display">
            डिलीवरिंग टू: 
            <span 
                className="current-address" 
                onClick={() => setIsModalOpen(true)}
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
            >
                {currentLocation?.address || "पता चुनें"} 
            </span>
            <button onClick={() => setIsModalOpen(true)} style={{ marginLeft: '10px' }}>बदलें</button>

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
