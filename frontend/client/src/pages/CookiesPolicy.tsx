import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function CookiesPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle>Cookies Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-700">
              हमारी वेबसाइट छोटे टेक्स्ट फाइल (cookies) का उपयोग कर सकती है ताकि अनुभव बेहतर हो और analytics चले।
            </p>

            <h3 className="font-semibold mt-4">कौन-कौन सी cookies हम यूज़ करते हैं</h3>
            <ul className="list-disc pl-5 text-gray-700">
              <li>आवश्यक (required): लॉगिन/सत्र के लिए।</li>
              <li>प्रदर्शन/एनालिटिक्स: उपयोग की जानकारी इकट्ठा करने के लिए (जैसे पेज विजिट)।</li>
              <li>प्राथमिकता/पर्सनलाइज़ेशन: UI/भाषा सेटिंग्स याद रखने के लिए।</li>
            </ul>

            <h3 className="font-semibold mt-4">इनको बंद कैसे करें</h3>
            <p className="text-gray-700 mb-3">ब्राउज़र सेटिंग से आप cookies ब्लॉक/डिलीट कर सकते हैं — पर कुछ फीचर्स काम करना बंद हो सकते हैं।</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
