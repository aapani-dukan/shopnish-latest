//frontend/client/src/components/LocationModal.tsx

import React, { useEffect, useState } from 'react';
import { useLocation, ProcessedLocation } from '@/context/LocationContext'; // ProcessedLocation इम्पोर्ट करें
import AddressInputWithMap from './AddressInputWithMap';
import axios from 'axios';
interface LocationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose }) => {
    const { 
        fetchCurrentGeolocation, 
        savedAddresses, 
        loadSavedAddresses, 
        setSelectedAddress,
        currentLocation,
        loadingLocation,
        error
    } = useLocation();

    const [showAddressInput, setShowAddressInput] = useState<boolean>(false);
    const [tempNewAddress, setTempNewAddress] = useState<ProcessedLocation | null>(null); // State to hold newly input address

    useEffect(() => {
        if (isOpen) {
            loadSavedAddresses(); 
        }
    }, [isOpen, loadSavedAddresses]);

    if (!isOpen) return null;

    const handleUseCurrentLocation = async () => {
        await fetchCurrentGeolocation();
        onClose(); 
    };

    const handleSelectSavedAddress = (address: ProcessedLocation) => {
        setSelectedAddress(address);
        onClose(); 
    };

    // AddressInputWithMap से नया पता प्राप्त करने के लिए handler
    const handleMapLocationUpdate = (addressString: string, locationData: { lat: number; lng: number; city: string; pincode: string }) => {
        setTempNewAddress({
            address: addressString,
            addressLine1: addressString.split(',')[0].trim(), // Simple parsing, refine as needed
            city: locationData.city,
            pincode: locationData.pincode,
            latitude: locationData.lat,
            longitude: locationData.lng,
            inServiceArea: true, // Assuming Map input is within service area for now, or check via backend
            label: 'नया पता', // Default label
        });
    };

    // नया पता सेव करने के लिए (यह बैकएंड API कॉल करेगा)
    const handleSaveNewAddress = async () => {
        if (!tempNewAddress) return;

        // Implement API call to save new address to backend
        // This will likely involve making a POST request to /api/addresses
        // and passing the user's auth token.
        const token = localStorage.getItem('authToken'); // Get actual token
        const userId = 'YOUR_USER_ID'; // Replace with actual user ID from auth context

        try {
            const response = await axios.post(`${import.meta.env.VITE_BACKEND_API_URL}/addresses`, {
                ...tempNewAddress,
                userId,
                isDefault: true // Or let user choose
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Backend should return the saved address including its ID
            const savedAddress = response.data; 

            setSelectedAddress(savedAddress); // Set as current
            loadSavedAddresses(); // Reload saved addresses list
            onClose(); // Close modal
        } catch (err) {
            console.error("Error saving new address:", err);
            // Handle error (e.g., show a toast message)
        }
    };


    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div className="modal-content" style={{
                backgroundColor: 'white', padding: '20px', borderRadius: '8px',
                width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
                position: 'relative'
            }}>
                <button 
                    className="modal-close" 
                    onClick={onClose}
                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', fontSize: '1.2em', cursor: 'pointer' }}
                >X</button>
                <h2>डिलीवरी लोकेशन चुनें</h2>

                {!showAddressInput ? (
                    <>
                        {/* वर्तमान स्थान का उपयोग करें */}
                        <button onClick={handleUseCurrentLocation} disabled={loadingLocation} style={{
                            padding: '10px 15px', backgroundColor: '#007bff', color: 'white',
                            border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px'
                        }}>
                            {loadingLocation ? 'खोज रहा है...' : '📍 वर्तमान स्थान का उपयोग करें'}
                        </button>
                        {error && <p style={{ color: 'red' }}>{error}</p>}

                        {/* सहेजे गए पते */}
                        <h3 style={{ marginTop: '20px' }}>सहेजे गए पते</h3>
                        {savedAddresses.length === 0 && <p>कोई पता सहेजा नहीं गया है।</p>}
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {savedAddresses.map((address) => (
                                <li 
                                    key={address.id} 
                                    onClick={() => handleSelectSavedAddress(address)}
                                    style={{
                                        padding: '10px', border: '1px solid #eee', borderRadius: '5px',
                                        marginBottom: '10px', cursor: 'pointer',
                                        backgroundColor: currentLocation?.id === address.id ? '#e6f7ff' : 'white'
                                    }}
                                >
                                    <strong>{address.label || address.addressLine1}</strong><br />
                                    {address.addressLine1}, {address.city} - {address.postalCode}
                                </li>
                            ))}
                        </ul>

                        {/* नया पता जोड़ें */}
                        <button onClick={() => setShowAddressInput(true)} style={{
                            padding: '10px 15px', backgroundColor: '#28a745', color: 'white',
                            border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '10px'
                        }}>नया पता जोड़ें</button>
                    </>
                ) : (
                    <div style={{ marginTop: '20px' }}>
                        <h3>मैप से नया पता चुनें</h3>
                        <AddressInputWithMap 
                            currentAddress={tempNewAddress?.address || currentLocation?.address || ""}
                            currentLocation={tempNewAddress || currentLocation || null}
                            onLocationUpdate={handleMapLocationUpdate}
                            onClose={() => setShowAddressInput(false)} // मॉडल को बंद करने के लिए
                        />
                         {tempNewAddress && (
                            <div style={{marginTop: '15px', padding: '10px', border: '1px solid #ddd', borderRadius: '5px'}}>
                                <h4>चुना गया पता:</h4>
                                <p>{tempNewAddress.address}</p>
                                <p>पिनकोड: {tempNewAddress.pincode}</p>
                                <button 
                                    onClick={handleSaveNewAddress} 
                                    style={{
                                        padding: '8px 15px', backgroundColor: '#007bff', color: 'white',
                                        border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px'
                                    }}
                                >
                                    इस पते को सहेजें
                                </button>
                            </div>
                         )}
                        <button type="button" onClick={() => setShowAddressInput(false)} style={{marginTop: '10px'}}>पीछे जाएं</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationModal;
