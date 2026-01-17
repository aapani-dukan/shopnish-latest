import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const BulkUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        setStatus(`${jsonData.length} प्रोडक्ट्स अपलोड हो रहे हैं...`);

        // आपकी API कॉल
        const response = await fetch('http://localhost:3000/api/admin/bulk-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jsonData),
        });

        if (response.ok) {
          setStatus('मस्त! सारे प्रोडक्ट्स सफलतापूर्वक अपलोड हो गए। ✅');
        } else {
          throw new Error('Upload में कुछ गड़बड़ हो गई।');
        }
      } catch (err: any) {
        setStatus('Error: ' + err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-8 bg-white rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Bulk Product Upload</h2>
      <p className="mb-6 text-gray-600">एक्सेल फाइल चुनें और 800+ प्रोडक्ट्स एक साथ लोड करें।</p>
      
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
            uploading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
          }`}
        >
          {uploading ? 'Processing...' : 'Upload Excel File'}
        </label>
        {status && <p className="mt-4 font-medium text-blue-800">{status}</p>}
      </div>
    </div>
  );
};

export default BulkUpload;