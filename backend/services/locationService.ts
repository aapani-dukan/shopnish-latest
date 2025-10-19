// backend/services/locationservice.ts

import axios from 'axios';
import { db } from '../server/db';
import { deliveryAreas } from '../shared/backend/schema'; // तुम्हारे प्रदान किए गए स्कीमा का उपयोग करें
import { eq } from 'drizzle-orm';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error("[DEBUG] locationService: GOOGLE_MAPS_API_KEY is NOT set in backend environment variables.");
} else {
    console.log("[DEBUG] locationService: GOOGLE_MAPS_API_KEY is configured.");
}

interface GeocodeResult {
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null> {
  console.log(`[DEBUG] reverseGeocode: Attempting reverse geocode for Lat ${latitude}, Lng ${longitude}`);

  if (!GOOGLE_MAPS_API_KEY) {
    console.error("[DEBUG] reverseGeocode: GOOGLE_MAPS_API_KEY is NOT available at call time.");
    return null;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
  console.log("[DEBUG] reverseGeocode: Google API URL:", url);

  try {
    const response = await axios.get(url);
    const data = response.data;
    console.log("[DEBUG] reverseGeocode: Google API Raw Response Status:", response.status);
    console.log("[DEBUG] reverseGeocode: Google API Raw Response Data:", JSON.stringify(data, null, 2));

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      const addressComponents = result.address_components;

      let addressLine1 = '';
      let city = '';
      let state = '';
      let pincode = '';

      for (const component of addressComponents) {
        if (component.types.includes('street_number') || component.types.includes('route')) {
          addressLine1 += component.long_name + ' ';
        } else if (component.types.includes('sublocality_level_2')) {
          addressLine1 = component.long_name + ' ' + addressLine1;
        } else if (component.types.includes('locality')) {
          city = component.long_name;
        } else if (component.types.includes('administrative_area_level_1')) {
          state = component.long_name;
        } else if (component.types.includes('postal_code')) {
          pincode = component.long_name;
        }
      }

      addressLine1 = addressLine1.trim();
      if (!addressLine1 && city) addressLine1 = city;

      console.log(`[DEBUG] reverseGeocode: Successfully parsed address: ${result.formatted_address}`);
      return {
        formattedAddress: result.formatted_address,
        addressLine1: addressLine1 || 'Unknown Street',
        city: city || 'Unknown City',
        state: state || 'Unknown State',
        pincode: pincode || 'Unknown Pincode',
        lat: latitude,
        lng: longitude,
      };
    } else if (data.status === 'ZERO_RESULTS') {
        console.warn(`[DEBUG] reverseGeocode: Google API returned ZERO_RESULTS for ${latitude}, ${longitude}`);
    } else {
        console.error(`[DEBUG] reverseGeocode: Google API returned status ${data.status || 'UNKNOWN'}`);
        if (data.error_message) {
            console.error("[DEBUG] reverseGeocode: Google API Error Message:", data.error_message);
        }
    }
    return null;
  } catch (error) {
    console.error('[DEBUG] reverseGeocode: Error in catch block during reverse geocoding:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error("[DEBUG] reverseGeocode: Axios Error Response Status:", error.response.status);
      console.error("[DEBUG] reverseGeocode: Axios Error Response Data:", error.response.data);
    }
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  console.log(`[DEBUG] geocodeAddress: Attempting geocode for address: "${address}"`);
  if (!GOOGLE_MAPS_API_KEY) {
    console.error("[DEBUG] geocodeAddress: GOOGLE_MAPS_API_KEY is NOT available.");
    return null;
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
  console.log("[DEBUG] geocodeAddress: Google API URL:", url);

  try {
    const response = await axios.get(url);
    const data = response.data;
    console.log("[DEBUG] geocodeAddress: Google API Raw Response Status:", response.status);
    console.log("[DEBUG] geocodeAddress: Google API Raw Response Data:", JSON.stringify(data, null, 2));

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry.location;
      const addressComponents = result.address_components;

      let addressLine1 = '';
      let city = '';
      let state = '';
      let pincode = '';

      for (const component of addressComponents) {
        if (component.types.includes('street_number') || component.types.includes('route')) {
          addressLine1 += component.long_name + ' ';
        } else if (component.types.includes('sublocality_level_2')) {
          addressLine1 = component.long_name + ' ' + addressLine1;
        } else if (component.types.includes('locality')) {
          city = component.long_name;
        } else if (component.types.includes('administrative_area_level_1')) {
          state = component.long_name;
        } else if (component.types.includes('postal_code')) {
          pincode = component.long_name;
        }
      }
      addressLine1 = addressLine1.trim();
      if (!addressLine1 && city) addressLine1 = city;

      console.log(`[DEBUG] geocodeAddress: Successfully parsed address: ${result.formatted_address}`);
      return {
        formattedAddress: result.formatted_address,
        addressLine1: addressLine1 || 'Unknown Street',
        city: city || 'Unknown City',
        state: state || 'Unknown State',
        pincode: pincode || 'Unknown Pincode',
        lat: location.lat,
        lng: location.lng,
      };
    } else if (data.status === 'ZERO_RESULTS') {
        console.warn(`[DEBUG] geocodeAddress: Google API returned ZERO_RESULTS for "${address}"`);
    } else {
        console.error(`[DEBUG] geocodeAddress: Google API returned status ${data.status || 'UNKNOWN'}`);
        if (data.error_message) {
            console.error("[DEBUG] geocodeAddress: Google API Error Message:", data.error_message);
        }
    }
    return null;
  } catch (error) {
    console.error('[DEBUG] geocodeAddress: Error in catch block during geocoding:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error("[DEBUG] geocodeAddress: Axios Error Response Status:", error.response.status);
      console.error("[DEBUG] geocodeAddress: Axios Error Response Data:", error.response.data);
    }
    return null;
  }
}

/**
 * सर्विस एरिया की जांच करें: क्या दिया गया पिनकोड हमारे सर्विस एरिया में है?
 */
export async function isWithinServiceArea(pincode: string): Promise<boolean> {
  console.log(`[DEBUG] isWithinServiceArea: Checking for pincode: ${pincode}`);
  try {
    const area = await db.select()
      .from(deliveryAreas)
      .where(eq(deliveryAreas.pincode, pincode))
      .limit(1);

    const isInArea = area.length > 0 && area[0].isActive === true; // isActive की भी जाँच करें

    console.log(`[DEBUG] isWithinServiceArea: Pincode ${pincode} is ${isInArea ? 'within' : 'not within'} service area.`);
    return isInArea;
  } catch (error) {
    console.error(`[DEBUG] isWithinServiceArea: Error checking service area for pincode ${pincode}:`, error);
    return false; // त्रुटि होने पर, मान लें कि यह सर्विस एरिया में नहीं है
  }
}


/**
 * डिलीवरी शुल्क की गणना करें।
 */
export async function calculateDeliveryCharges(pincode: string): Promise<number> {
  console.log(`[DEBUG] calculateDeliveryCharges: Calculating for pincode: ${pincode}`);
  try {
    const area = await db.select()
      .from(deliveryAreas)
      .where(eq(deliveryAreas.pincode, pincode))
      .limit(1);

    if (area.length > 0 && area[0].isActive === true && area[0].deliveryCharge !== undefined) {
      // Drizzle में `decimal` को `string` के रूप में लौटाया जा सकता है, इसलिए इसे `number` में बदलें।
      const charge = parseFloat(area[0].deliveryCharge);
      console.log(`[DEBUG] calculateDeliveryCharges: Found delivery charge ${charge} for pincode: ${pincode}`);
      return charge;
    }
    console.warn(`[DEBUG] calculateDeliveryCharges: No active specific delivery charge found for pincode ${pincode} in DB, returning default.`);
    return 30; // डिफ़ॉल्ट शुल्क यदि डेटाबेस में नहीं मिला
  } catch (error) {
    console.error(`[DEBUG] calculateDeliveryCharges: Error calculating delivery charges for pincode ${pincode}:`, error);
    return 30; // त्रुटि होने पर, डिफ़ॉल्ट शुल्क लौटाएं
  }
}
