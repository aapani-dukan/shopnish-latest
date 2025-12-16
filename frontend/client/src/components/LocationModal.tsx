// frontend/client/src/components/LocationModal.tsx

import React, { useEffect, useState } from 'react';
import { useLocation, ProcessedLocation } from '@/context/LocationContext'; 
import AddressInputWithMap from './AddressInputWithMap';
import axios from 'axios';
// 🛑 FIX 1: Firebase Auth Context इम्पोर्ट करें
import { useAuth } from '@/context/AuthContext'; 

// Interfaces for LatLng data received from Map component
interface MapLocationData { 
    lat: number; 
    lng: number; 
    city: string; 
    pincode: string;
}

interface LocationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose }) => {
    
    // 🛑 FIX 2: useAuth से यूजर डेटा और टोकन प्राप्त करने के लिए फ़ंक्शन प्राप्त करें
    const { user, refetchUser } = useAuth(); 
    // AuthContext से टोकन प्राप्त करने का सीधा तरीका नहीं है, इसलिए हम एक Helper फंक्शन बनाएंगे
    
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
    const [isSaving, setIsSaving] = useState(false); // नया स्टेट

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
        setTempNewAddress({
            address: addressString,
            addressLine1: locationData.city, 
            city: locationData.city,
            pincode: locationData.pincode,
            latitude: locationData.lat,
            longitude: locationData.lng,
            inServiceArea: true, 
            label: 'नया पता', 
        });
    };

    // नया पता सेव करने के लिए (Firebase Auth के साथ)
    const handleSaveNewAddress = async () => {
        if (!tempNewAddress || isSaving) return;

        // 🛑 FIX 3: Firebase Auth Token चेक
        if (!user || !user.idToken) {
            console.error("Firebase user not logged in or token unavailable.");
            alert("कृपया पता सहेजने से पहले लॉग इन करें। (टोकन अनुपलब्ध)");
            return;
        }

        setIsSaving(true);
        const token = user.idToken; // ✅ Firebase Auth Context से टोकन प्राप्त करें

        try {
            const API_URL = import.meta.env.VITE_BACKEND_API_URL;
            
            const response = await axios.post(`${API_URL}/addresses`, {
                // fullName और phoneNumber को User Profile से प्राप्त किया जाना चाहिए, या इनपुट किया जाना चाहिए
                fullName: user.name || 'Guest User', 
                phoneNumber: user.phoneNumber || '9999999999', 
                addressLine1: tempNewAddress.addressLine1 || tempNewAddress.address.split(',')[0].trim(),
                addressLine2: '',
                city: tempNewAddress.city,
                state: 'Rajasthan', // Placeholder
                pincode: tempNewAddress.pincode, 
                latitude: tempNewAddress.latitude,
                longitude: tempNewAddress.longitude,
                label: tempNewAddress.label,
                isDefault: true,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const savedAddress = response.data; 

            setSelectedAddress(savedAddress); 
            loadSavedAddresses(); 
            // refetchUser(); // यदि आवश्यक हो तो user profile को re-sync करें
            onClose(); 
        } catch (err) {
            console.error("Error saving new address:", err);
            if (axios.isAxiosError(err) && err.response) {
                console.error("Backend Response Error:", err.response.data);
                alert(`पता सहेजने में त्रुटि: ${err.response.data.message || err.response.statusText}`);
            } else {
                alert("पता सहेजते समय एक अज्ञात त्रुटि हुई।");
            }
        } finally {
            setIsSaving(false);
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
                                    {address.addressLine1}, {address.city} - {address.pincode} 
                                </li>
                            ))}
                        </ul>

                        {/* नया पता जोड़ें */}
                        <button onClick={() => setShowAddressInput(true)} disabled={!user} style={{ // यदि लॉग इन नहीं है तो डिसेबल करें
                            padding: '10px 15px', backgroundColor: user ? '#28a745' : '#ccc', color: 'white',
                            border: 'none', borderRadius: '5px', cursor: 'pointer', marginTop: '10px'
                        }}>
                            {user ? 'नया पता जोड़ें' : 'लॉगिन करें (पता जोड़ने के लिए)'}
                        </button>
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
                                    disabled={isSaving}
                                    style={{
                                        padding: '8px 15px', backgroundColor: isSaving ? '#ccc' : '#007bff', color: 'white',
                                        border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px'
                                    }}
                                >
                                    {isSaving ? 'सहेज रहा है...' : 'इस पते को सहेजें'}
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

