import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle>About Us</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-700">
              हम एक स्थानीय one-stop delivery marketplace हैं — छोटे शहरों के लोगों की रोज़मर्रा की ज़रूरतों को घर तक तेज़ी से पहुँचाना हमारा मकसद है.
            </p>

            <h3 className="font-semibold mt-4">क्या खास है</h3>
            <ul className="list-disc pl-5 text-gray-700">
              <li>पास की दुकानों के साथ पार्टनरशिप — भरोसेमंद और स्थानीय सप्लाई।</li>
              <li>तेज़ डिलीवरी — हमारी पहचान ‘fast local delivery’।</li>
              <li>किसी भी प्रकार के रोज़मर्रा के आइटम, फूड या ब्यूटी प्रोडक्ट्स।</li>
            </ul>

            <h3 className="font-semibold mt-4">हमारे उद्देश्य</h3>
            <p className="text-gray-700">स्थानीय कारोबार को ऑनलाइन लाना और अपने शहर को सुविधा देना।</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
