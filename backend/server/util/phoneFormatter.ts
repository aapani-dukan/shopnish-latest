// backend/server/util/phoneFormatter.ts

export const formatPhone = (phone: string | null | undefined): string | null => {
  if (!phone) return null;

  // 1. Saare non-numeric characters (spaces, symbols) hatao
  const cleaned = phone.replace(/\D/g, ''); 
  
  // 2. Case 1: Agar 10 digit hai (e.g. 9928305966) -> +91 lagao
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  
  // 3. Case 2: Agar 12 digit hai aur 91 se shuru hai (e.g. 919928305966) -> sirf + lagao
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }
  
  // 4. Case 3: Pehle se + ke saath hai ya koi aur format hai
  // Ensure karein ki return hamesha '+' se shuru ho
  return phone.startsWith('+') ? phone : `+${phone}`;
};