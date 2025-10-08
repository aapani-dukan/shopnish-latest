import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-700">
              हमारा उद्देश्य है कि हम आपके निजी डाटा को सुरक्षित और पारदर्शी तरीके से रखें।
            </p>

            <h3 className="font-semibold mt-4">1. हम कौन सा डेटा इकट्ठा करते हैं</h3>
            <ul className="list-disc pl-5 text-gray-700">
              <li>रजिस्ट्रेशन डेटा: नाम, ईमेल, फ़ोन, पते।</li>
              <li>अवंडरिंग/ऑर्डर डेटा: ऑर्डर आइटम, बिलिंग, भुगतान और डिलीवरी पता।</li>
              <li>लोकेशन डेटा: रीयल-टाइम ट्रैकिंग के लिए (जब आप अनुमति दें) — डिलीवरी बॉय और ग्राहक लोकेशन।</li>
              <li>डिवाइस & उपयोग डेटा: IP, ब्राउज़र, लॉग्स, फॉल्ट रिपोर्ट।</li>
            </ul>

            <h3 className="font-semibold mt-4">2. हम डेटा का उपयोग कैसे करते हैं</h3>
            <p className="text-gray-700 mb-3">
              सेवा प्रदान करने, ऑर्डर और डिलीवरी पूरा करने, भुगतान सत्यापन, ग्राहक सहायता, फ़्रॉड रोकथाम, तथा सर्विस में सुधार के लिए।
            </p>

            <h3 className="font-semibold mt-4">3. डेटा साझा करना</h3>
            <p className="text-gray-700 mb-3">
              हम आवश्यक पार्टनर्स के साथ (हमेरी भागीदार दुकाने, डिलीवरी पार्टनर, भुगतान प्रदाता) डाटा साझा कर सकते हैं। हम तृतीय-पक्ष को बेचते या किराये पर नहीं देते।
            </p>

            <h3 className="font-semibold mt-4">4. लोकेशन ट्रैकिंग</h3>
            <p className="text-gray-700 mb-3">
              रीयल-टाइम डिलीवरी ट्रैकिंग तभी चालू होती है जब उपयोगकर्ता/डिलीवरी बॉय ने अनुमति दी हो। लोकेशन केवल संबंधित ऑर्डर के ग्राहक और सर्वर तक सीमित भेजी जाती है।
            </p>

            <h3 className="font-semibold mt-4">5. सुरक्षा</h3>
            <p className="text-gray-700 mb-3">
              हम industry-standard उपाय (HTTPS, token-based auth, server-side access controls) अपनाते हैं। परंतु पूरी दुनिया में 100% सुरक्षा संभव नहीं — संवेदनशील ट्रांज़ैक्शन के लिए सावधानी रखें।
            </p>

            <h3 className="font-semibold mt-4">6. डेटा रिटेंशन</h3>
            <p className="text-gray-700 mb-3">
              हम लेन-देन रिकॉर्ड और कानूनी कारणों के लिए आवश्यक अवधि तक डेटा रख सकते हैं; अनावश्यक डेटा को सुरक्षित तरीके से हटाया जाता है।
            </p>

            <h3 className="font-semibold mt-4">7. आपके अधिकार</h3>
            <p className="text-gray-700 mb-3">
              आप अपने डेटा को देखने, सुधारने, हटाने या एक्सपोर्ट करने का अनुरोध कर सकते हैं। संपर्क पेज पर लिखें — हम जवाब देंगे।
            </p>

            <p className="text-sm text-gray-500 mt-6">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
