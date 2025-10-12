import axios from "axios";

export async function sendWhatsAppOTP(
  phone: string,
    otp: string,
      orderId: number,
        customerName: string
        ) {
          const authKey = process.env.MSG91_AUTHKEY;
            const integratedNumber = process.env.MSG91_WHATSAPP_NUMBER;

              const data = {
                  recipient_number: phone.replace("+", ""), // example: 919876543210
                      integrated_number: integratedNumber,
                          content_type: "template",
                              template_name: "shopnish-whatsapp-otp",
                                  variables: {
                                        "1": customerName,
                                              "2": `SH${orderId}`,
                                                    "3": otp
                                                        }
                                                          };

                                                            try {
                                                                const res = await axios.post(
                                                                      "https://control.msg91.com/api/v5/whatsapp/send-template",
                                                                            data,
                                                                                  {
                                                                                          headers: {
                                                                                                    authkey: authKey,
                                                                                                              "Content-Type": "application/json",
                                                                                                                      },
                                                                                                                            }
                                                                                                                                );
                                                                                                                                    console.log("WhatsApp OTP sent:", res.data);
                                                                                                                                        return res.data;
                                                                                                                                          } catch (err) {
                                                                                                                                              console.error("Failed to send WhatsApp OTP:", err);
                                                                                                                                                  return null;
                                                                                                                                                    }
                                                                                                                                                    }