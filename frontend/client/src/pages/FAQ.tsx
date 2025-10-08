import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const faqs = [
  { q: "कैसे ऑर्डर ट्रैक करूँ?", a: "Track Order पेज पर अपने ऑर्डर नंबर से देखें, या हमें App में लॉगिन कर के रीयल-टाइम मैप देखें।" },
  { q: "क्या आप COD स्वीकार करते हैं?", a: "हाँ — कई दुकानों पर Cash-on-Delivery उपलब्ध है, पेज पर लिखा रहेगा।" },
  { q: "डिलीवरी देर हो रही है — क्या करूँ?", a: "Contact/Support बटन से हमें तुरंत बतायें; हम स्टोर/डिलीवरी बॉय से चेक करवा देंगे।" },
  { q: "किस तरह के प्रोडक्ट आप allow करते हैं?", a: "घरेलू सामान, ब्यूटी, कपड़े, इलेक्ट्रॉनिक्स, फूड — पर प्रतिबंधित/खतरनाक सामान मना है।" },
];

export default function FAQ() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {faqs.map((f, i) => (
                <div key={i}>
                  <p className="font-semibold">{f.q}</p>
                  <p className="text-gray-700">{f.a}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
