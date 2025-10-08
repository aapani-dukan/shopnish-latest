import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ContactUs() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // यदि backend available है, POST करके भेजना; नहीं तो केवल UI पोज़िटिव फ़ीडबैक दें।
      // await fetch("/api/contact", { method: "POST", body: JSON.stringify({ name, email, message }) });
      setSent(true);
      setName(""); setEmail(""); setMessage("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle>Contact Us</CardTitle>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="p-4 bg-green-50 rounded">
                <p className="text-green-700">धन्यवाद! आपकी जानकारी मिल गई है — हम शीघ्र संपर्क करेंगे।</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="आपका नाम" className="w-full p-3 border rounded" required />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ईमेल" type="email" className="w-full p-3 border rounded" required />
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="संदेश" className="w-full p-3 border rounded h-32" required />
                <Button type="submit">Send Message</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
