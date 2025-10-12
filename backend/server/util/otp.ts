// util/otp.ts
export function generateOTP(length = 6): string {
  const otp = Math.floor(Math.random() * Math.pow(10, length))
      .toString()
          .padStart(length, "0");
            return otp;
            }
            