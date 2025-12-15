// frontend/client/src/components/LocationModal.tsx

import React, { useEffect, useState } from 'react';
import { useLocation, ProcessedLocation } from '@/context/LocationContext'; 
import AddressInputWithMap from './AddressInputWithMap';
import axios from 'axios';

// Interfaces for LatLng data received from Map component
interface MapLocationData { 
    lat: number; 
    lng: number; 
    city: string; 
    pincode: string; // Ensure this matches Backend schema (pincode/postalCode)
}

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
    const [tempNewAddress, setTempNewAddress] = useState<ProcessedLocation | null>(null); 

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
    const handleMapLocationUpdate = (addressString: string, locationData: MapLocationData) => {
        // ⚠️ WARNING: addressLine1 और state जैसे फ़ील्ड यहाँ उपलब्ध नहीं हैं, 
        // इसलिए हम सरल अनुमान लगाते हैं या उन्हें खाली छोड़ देते हैं। 
        // Backend Geocoding से इसे ठीक से प्राप्त करना आदर्श है।
        setTempNewAddress({
            address: addressString,
            addressLine1: locationData.city, // अस्थायी रूप से city को addressLine1 मान लें (या खाली छोड़ दें)
            city: locationData.city,
            pincode: locationData.pincode,
            latitude: locationData.lat,
            longitude: locationData.lng,
            inServiceArea: true, // Backend को इसे सत्यापित करना चाहिए
            label: 'नया पता', 
            // isDefault, createdAt, updatedAt, userId, id जैसे Drizzle फ़ील्ड छोड़े गए
            // क्योंकि वे Frontend द्वारा आवश्यक नहीं हैं
        });
    };

    // नया पता सेव करने के लिए (यह बैकएंड API कॉल करेगा)
    const handleSaveNewAddress = async () => {
        if (!tempNewAddress) return;

        // 🛑 FIX 1: Auth token को सही ढंग से प्राप्त करें
        const token = localStorage.getItem('authToken'); 
        
        if (!token) {
            console.error("Authentication token is missing. Cannot save address.");
            alert("कृपया पता सहेजने से पहले लॉग इन करें।");
            return;
        }

        try {
            const API_URL = import.meta.env.VITE_BACKEND_API_URL;
            if (!API_URL || API_URL.includes('undefined')) {
                console.error("API URL is misconfigured:", API_URL);
                throw new Error("API URL Configuration Error.");
            }
            
            const response = await axios.post(`${API_URL}/addresses`, {
                // Backend Zod schema के अनुसार फ़ील्ड पास करें
                fullName: 'Guest User', // Placeholder; इसे User Context से भरा जाना चाहिए
                phoneNumber: '9999999999', // Placeholder; इसे User Input से भरा जाना चाहिए
                addressLine1: tempNewAddress.addressLine1 || tempNewAddress.address.split(',')[0].trim(),
                addressLine2: '',
                city: tempNewAddress.city,
                state: 'Rajasthan', // Placeholder; Map/Backend से प्राप्त करें
                pincode: tempNewAddress.pincode, // Backend schema से मेल खाना चाहिए
                latitude: tempNewAddress.latitude,
                longitude: tempNewAddress.longitude,
                label: tempNewAddress.label,
                isDefault: true,
                // 🛑 FIX 2: userId को Payload से हटाया गया
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const savedAddress = response.data; 

            setSelectedAddress(savedAddress); 
            loadSavedAddresses(); 
            onClose(); 
        } catch (err) {
            console.error("Error saving new address:", err);
            if (axios.isAxiosError(err) && err.response) {
                console.error("Backend Response Error:", err.response.data);
                alert(`पता सहेजने में त्रुटि: ${err.response.data.message || err.response.statusText}`);
            } else {
                alert("पता सहेजते समय एक अज्ञात त्रुटि हुई।");
            }
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
                                        // 🛑 FIX 3: Drizzle ID नंबर है, इसलिए इसे string से तुलना के लिए सुरक्षित रूप से प्रबंधित करें (या तुलना से पहले stringify करें)
                                        backgroundColor: currentLocation?.id === address.id ? '#e6f7ff' : 'white'
                                    }}
                                >
                                    <strong>{address.label || address.addressLine1}</strong><br />
                                    {address.addressLine1}, {address.city} - {address.pincode} {/* postalCode को pincode में बदला गया */}
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
                            onClose={() => setShowAddressInput(false)}
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
