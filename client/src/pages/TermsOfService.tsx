import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle>Terms of Service</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-700">
              इन Terms को पढ़कर और हमारी सेवाओं का उपयोग करके आप इन शर्तों से सहमत होते हैं।
            </p>

            <h3 className="font-semibold mt-4">1. हमारी सेवा क्या है</h3>
            <p className="text-gray-700 mb-3">
              हम स्थानीय दुकानों के साथ पार्टनर होकर प्रोडक्ट और फूड को कस्टमर तक पहुंचाते हैं। हम मार्केटप्लेस और डिलीवरी प्लेटफ़ॉर्म दोनों हैं — कई मामलों में विक्रेता खुद अपना प्रोडक्ट और कीमत तय करते हैं।
            </p>

            <h3 className="font-semibold mt-4">2. ऑर्डर और पेमेंट</h3>
            <p className="text-gray-700 mb-3">
              ऑर्डर कन्फर्मेशन तब तक वैध नहीं जब तक भुगतान (यदि वांछित) सफल न हो। COD विकल्प पर डिलीवरी के समय भुगतान लिया जा सकता है।
            </p>

            <h3 className="font-semibold mt-4">3. रिटर्न और रिफंड</h3>
            <p className="text-gray-700 mb-3">
              रिटर्न/रिफंड पॉलिसी विक्रेता/प्रोडक्ट टाइप पर निर्भर कर सकती है। बिक्री पृष्ठ पर बताया गया नियम लागू होगा; किसी विवाद में हमारी कस्टमर सपोर्ट टीम मध्यस्थ हो सकती है।
            </p>

            <h3 className="font-semibold mt-4">4. डिलीवरी और रियल-टाइम ट्रैकिंग</h3>
            <p className="text-gray-700 mb-3">
              डिलीवरी शेड्यूल अनुमानित होते हैं — ट्रैफ़िक/मौसम/स्टोर लेटनेस कारणों से समय बदल सकता है। रीयल-टाइम लोकेशन तभी साझा की जाती है जब डिलीवरी बॉय अनुमति देता है।
            </p>

            <h3 className="font-semibold mt-4">5. उपयोग की प्रतिबंधित चीजें</h3>
            <p className="text-gray-700 mb-3">
              अवैध, खतरनाक या प्रतिबंधित आइटम की बिक्री/डिलीवरी निषिद्ध है। विक्रेता/यूजर इन शर्तों का उल्लंघन कर सकते हैं; उल्लंघन पर अकाउंट निलंबित/रद्द होगा।
            </p>

            <h3 className="font-semibold mt-4">6. दायित्व की सीमा</h3>
            <p className="text-gray-700 mb-3">
              हमारी जिम्मेदारी सीमित है और हम अप्रत्यक्ष/अकस्मात नुकसान के लिए उत्तरदायी नहीं होंगे। (कानूनी रूप से ज़रूरी सीमाएँ लागू होंगी)
            </p>

            <h3 className="font-semibold mt-4">7. बदलाव</h3>
            <p className="text-gray-700 mb-3">
              हम समय-समय पर Terms अपडेट कर सकते हैं; महत्वपूर्ण बदलाव पर सूचना दी जाएगी।
            </p>

            <p className="text-sm text-gray-500 mt-6">
              Effective date: {new Date().toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
