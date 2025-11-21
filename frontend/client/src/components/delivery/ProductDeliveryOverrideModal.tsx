// components/delivery/ProductDeliveryOverrideModal.tsx

import React, { useState } from 'react';
import { ProductDeliverySettings, DeliveryScope } from '../../types/delivery';
import axios from 'axios';

interface Props {
  product: ProductDeliverySettings;
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean; // एडमिन चेक
  sellerId?: number; // एडमिन रूट के लिए जरूरी
}

const ProductDeliveryOverrideModal: React.FC<Props> = ({
  product,
  isOpen,
  onClose,
  isAdmin,
  sellerId
}) => {
  const [scope, setScope] = useState<DeliveryScope>(product.deliveryScope || 'GLOBAL');
  const [pincodesString, setPincodesString] = useState(
    product.productDeliveryPincodes?.join(', ') || ''
  );
  const [radius, setRadius] = useState<number | null>(product.productDeliveryRadiusKM);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const pincodesArray = pincodesString
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p !== '');

      // पे-लोड तैयार करें
      const payload = {
        deliveryScope: scope,
        // अगर स्कोप पिनकोड है, तो पिनकोड भेजें, वरना null
        productDeliveryPincodes: scope === 'PRODUCT_PINCODE' ? pincodesArray : null,
        // अगर स्कोप रेडियस है, तो रेडियस भेजें, वरना null
        productDeliveryRadiusKM: scope === 'PRODUCT_RADIUS' ? (radius ? Number(radius) : null) : null,
      };

       // API एंडपॉइंट तय करें
       let apiUrl = `/api/seller/products/${product.id}/delivery-override`;
       if (isAdmin && sellerId) {
         // एडमिन रूट का उदाहरण (अपने बैकएंड रूट के अनुसार बदलें)
         apiUrl = `/api/admin/sellers/${sellerId}/products/${product.id}/delivery-override`;
       }

      await axios.put(apiUrl, payload);
      alert('Product override settings saved!');
      onClose(); // मोडल बंद करें और पैरेंट को रिफ्रेश करें
    } catch (error) {
      console.error('Error saving product settings:', error);
      alert('Failed to save product settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">Delivery Settings for: {product.name}</h3>

        <div className="mb-4">
          <label className="block font-medium mb-2">Select Delivery Method:</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as DeliveryScope)}
            className="w-full p-2 border rounded"
          >
            <option value="GLOBAL">Use Global Default Settings</option>
            <option value="PRODUCT_PINCODE">Override: Specific Pincodes</option>
            <option value="PRODUCT_RADIUS">Override: Specific Radius</option>
          </select>
        </div>

        {/* --- कंडीशनल इनपुट्स --- */}
        {scope === 'PRODUCT_PINCODE' && (
          <div className="mb-4">
            <label className="block font-medium mb-1">Product Specific Pincodes:</label>
            <textarea
              value={pincodesString}
              onChange={(e) => setPincodesString(e.target.value)}
              className="w-full p-2 border rounded"
              rows={3}
              placeholder="Comma separated pincodes..."
            />
          </div>
        )}

        {scope === 'PRODUCT_RADIUS' && (
          <div className="mb-4">
            <label className="block font-medium mb-1">Product Specific Radius (KM):</label>
            <input
              type="number"
              value={radius || ''}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full p-2 border rounded"
              placeholder="e.g., 5"
            />
            <p className="text-sm text-gray-500 mt-1">Requires seller location to be set globally.</p>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? 'Saving...' : 'Save Product Setting'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDeliveryOverrideModal;
