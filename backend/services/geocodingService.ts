import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string; // यदि तुम Google से प्राप्त formatted address भी स्टोर करना चाहते हो
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("[ERROR] geocodeAddress: GOOGLE_MAPS_API_KEY is NOT configured.");
    return null;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      const formattedAddress = data.results[0].formatted_address;
      return {
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: formattedAddress,
      };
    } else if (data.status === 'ZERO_RESULTS') {
      console.warn(`[WARNING] geocodeAddress: No results found for address: ${address}`);
      return null;
    } else {
      console.error(`[ERROR] Google Geocoding API returned status: ${data.status || 'UNKNOWN'}. Message: ${data.error_message || 'N/A'}`);
      return null;
    }
  } catch (error) {
    console.error('[ERROR] Error calling Google Geocoding API:', error);
    return null;
  }
}
