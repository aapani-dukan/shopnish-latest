// components/delivery/GlobalDeliverySettingsForm.tsx

import React, { useState, useEffect } from 'react';
import { SellerDeliverySettings } from '../../types/delivery';
import axios from 'axios';
import { getAuth } from "firebase/auth"; // 🚨 Firebase Auth इम्पोर्ट करें

interface Props {
  sellerId?: number; // अगर एडमिन है तो sellerId पास करें, अगर सेलर है तो undefined
  isAdmin: boolean; // यह बताने के लिए कि क्या यह एडमिन डैशबोर्ड है
  initialData: SellerDeliverySettings; // API से आया हुआ मौजूदा डेटा
  onSaveSuccess: () => void; // सेव होने के बाद क्या करना है
}

const GlobalDeliverySettingsForm: React.FC<Props> = ({
  sellerId,
  isAdmin,
  initialData,
  onSaveSuccess,
}) => {
  const [formData, setFormData] = useState<SellerDeliverySettings>(initialData);
  const [pincodesString, setPincodesString] = useState(
    initialData.deliveryPincodes?.join(', ') || ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // 🚨 एरर स्टेट जोड़ा

  // initialData बदलने पर formData को अपडेट करें
  useEffect(() => {
    setFormData(initialData);
    setPincodesString(initialData.deliveryPincodes?.join(', ') || '');
  }, [initialData]);


  // पिनकोड स्ट्रिंग बदलने पर हैंडलर
  const handlePincodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPincodesString(e.target.value);
  };

  // मोड (रेडियस/पिनकोड) बदलने पर हैंडलर
  const handleModeChange = (isDistanceBased: boolean) => {
    setFormData({ ...formData, isDistanceBasedDelivery: isDistanceBased });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null); // हर सबमिशन पर एरर रीसेट करें

    // 🚨 Firebase ID टोकन प्राप्त करें
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setError("User not logged in. Please log in to save settings.");
      setLoading(false);
      alert("Error: User not logged in. Please log in to save settings.");
      return;
    }

    let firebaseIdToken: string;
    try {
      firebaseIdToken = await user.getIdToken();
    } catch (tokenError) {
      console.error("Error getting Firebase ID token:", tokenError);
      setError("Failed to get authentication token. Please try again.");
      setLoading(false);
      alert("Error: Failed to get authentication token. Please try again.");
      return;
    }

    try {
      // कॉमा-सेपरेटेड स्ट्रिंग को वापस ऐरे में बदलें
      const pincodesArray = pincodesString
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p !== '');

      const payload = {
        ...formData,
        deliveryPincodes: pincodesArray,
        // सुनिश्चित करें कि रेडियस नंबर है
        deliveryRadius: formData.deliveryRadius ? Number(formData.deliveryRadius) : null,
      };

      // API एंडपॉइंट तय करें (एडमिन vs सेलर)
      let apiUrl = '/api/sellers/profile/delivery-settings'; // सेलर के लिए
      if (isAdmin && sellerId) {
        apiUrl = `/api/admin/sellers/${sellerId}/delivery-settings`; // एडमिन के लिए
      }

      // 🚨 यहाँ आपको अपना auth token हेडर में भेजना होगा
      await axios.put(apiUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseIdToken}` // 🚨 Firebase ID टोकन यहां
        }
      });
      alert('Global settings saved successfully!');
      onSaveSuccess();
    } catch (error: any) { // 🚨 error टाइपिंग को और सटीक बनाया
      console.error('Error saving settings:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save settings.';
      setError(errorMessage);
      alert(`Error saving settings: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const hasLocation = formData.latitude && formData.longitude;

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded shadow-sm bg-white">
      <h3 className="text-lg font-bold mb-4">Global Delivery Settings (Default)</h3>

      {/* रेडियो बटन: मोड का चयन करें */}
      <div className="mb-6">
        <label className="block font-medium mb-2">Choose Default Delivery Mode:</label>
        <div className="flex gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              checked={formData.isDistanceBasedDelivery === false}
              onChange={() => handleModeChange(false)}
              className="mr-2"
            />
            Pincode Based
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              checked={formData.isDistanceBasedDelivery === true}
              onChange={() => handleModeChange(true)}
              className="mr-2"
              disabled={!hasLocation} // अगर लोकेशन सेट नहीं है तो रेडियस डिसेबल करें
            />
            Radius Based {!hasLocation && '(Location not set)'}
          </label>
        </div>
      </div>

      {/* इनपुट फील्ड्स: चयन के आधार पर दिखाएं */}
      {!formData.isDistanceBasedDelivery ? (
        // --- पिनकोड सेक्शन ---
        <div className="mb-4">
          <label className="block font-medium mb-1">Global Delivery Pincodes:</label>
          <p className="text-sm text-gray-500 mb-2">Enter comma-separated pincodes (e.g., 302001, 302012)</p>
          <textarea
            value={pincodesString}
            onChange={handlePincodeChange}
            className="w-full p-2 border rounded"
            rows={3}
            placeholder="302001, 302002..."
          />
        </div>
      ) : (
        // --- रेडियस सेक्शन ---
        <div className="mb-4">
          <label className="block font-medium mb-1">Global Delivery Radius (KM):</label>
          <input
            type="number"
            value={formData.deliveryRadius || ''}
            onChange={(e) =>
              setFormData({ ...formData, deliveryRadius: Number(e.target.value) })
            }
            className="w-full p-2 border rounded"
            placeholder="e.g., 10"
            min="1"
          />
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>} {/* 🚨 एरर डिस्प्ले */}

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Saving...' : 'Save Global Settings'}
      </button>
    </form>
  );
};

export default GlobalDeliverySettingsForm;
