import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { getAuth } from "firebase/auth"; // Firebase Auth इम्पोर्ट किया

const BulkUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const auth = getAuth();
    const user = auth.currentUser;

    // चेक करें कि यूजर लॉगिन है या नहीं
    if (!user) {
      setStatus('Error: भाई, पहले एडमिन लॉगिन तो कर लो!');
      return;
    }

    setUploading(true);
    setStatus('Excel फाइल पढ़ी जा रही है...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // एक्सेल को JSON में बदलना
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);
        const totalProducts = jsonData.length;

        // Firebase से ताजा ID Token प्राप्त करें
        const token = await user.getIdToken();

        // 800+ प्रोडक्ट्स को छोटे टुकड़ों (Batches) में अपलोड करना
        const batchSize = 100;
        let uploadedCount = 0;

        for (let i = 0; i < jsonData.length; i += batchSize) {
          const batch = jsonData.slice(i, i + batchSize);
          
          setStatus(`अपलोड हो रहा है: ${uploadedCount} / ${totalProducts}...`);

          const response = await fetch('https://shopnish-seprate.onrender.com/api/admin/bulk-products', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` // Firebase Token यहाँ जोड़ दिया ✅
            },
            body: JSON.stringify(batch),
          });

          if (!response.ok) {
            const errRes = await response.json();
            throw new Error(errRes.message || `Batch upload failed at index ${i}`);
          }

          uploadedCount += batch.length;
        }

        setStatus(`मस्त! सारे ${totalProducts} प्रोडक्ट्स सफलतापूर्वक अपलोड हो गए। ✅`);
      } catch (err: any) {
        console.error("Upload Error:", err);
        setStatus('Error: ' + err.message);
      } finally {
        setUploading(false);
        // इनपुट को रिसेट करें ताकि दोबारा सेम फाइल चुनी जा सके
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-8 bg-white rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Shopnish Bulk Inventory</h2>
      <p className="mb-6 text-gray-600">प्रीमियम प्रोडक्ट्स (800+) को एक साथ क्लाउड पर भेजें।</p>
      
      <div className="flex flex-col items-center justify-center border-2 border-dashed border-blue-400 p-10 rounded-lg bg-blue-50">
        <input 
          type="file" 
          accept=".xlsx, .xls, .csv" 
          onChange={handleFileUpload}
          className="hidden" 
          id="excel-upload"
          disabled={uploading}
        />
        <label 
          htmlFor="excel-upload" 
          className={`px-6 py-3 rounded-full font-semibold cursor-pointer transition-all ${
            uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
          }`}
        >
          {uploading ? 'Processing & Uploading...' : 'Select Excel File'}
        </label>
        
        {status && (
          <div className={`mt-4 p-3 rounded text-center font-medium ${
            status.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'
          }`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkUpload;