// backend/services/locationservice.ts

import axios from 'axios';

// Environment variable का नाम `GOOGLE_MAPS_API_KEY` (अपरकेस) में बदला गया
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error("[DEBUG] locationService: GOOGLE_MAPS_API_KEY is NOT set in backend environment variables.");
  // process.exit(1); // आप इसे अनकमेंट कर सकते हैं यदि आप चाहते हैं कि सर्वर कुंजी के बिना शुरू न हो
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

/**
 * रिवर्स जियोकोडिंग: अक्षांश/देशांतर को पठनीय पते में बदलें।
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult | null> {
  console.log(`[DEBUG] reverseGeocode: Attempting reverse geocode for Lat ${latitude}, Lng ${longitude}`);

  if (!GOOGLE_MAPS_API_KEY) {
    console.error("[DEBUG] reverseGeocode: GOOGLE_MAPS_API_KEY is NOT available at call time.");
    // पहले यहां error थ्रो हो रहा था, अब null लौटाएं ताकि addressRoutes में 404 हैंडल हो
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

      // extract relevant address components
      for (const component of addressComponents) {
        if (component.types.includes('street_number') || component.types.includes('route')) {
          addressLine1 += component.long_name + ' ';
        } else if (component.types.includes('sublocality_level_2')) { // often more specific than locality
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
      if (!addressLine1 && city) addressLine1 = city; // fallback if street info is missing

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
    return null; // यदि 'OK' स्टेटस नहीं है या कोई परिणाम नहीं है तो null लौटाएं
  } catch (error) {
    console.error('[DEBUG] reverseGeocode: Error in catch block during reverse geocoding:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error("[DEBUG] reverseGeocode: Axios Error Response Status:", error.response.status);
      console.error("[DEBUG] reverseGeocode: Axios Error Response Data:", error.response.data);
    }
    // पहले error थ्रो हो रहा था, अब null लौटाएं
    return null;
  }
}

/**
 * जियोकोडिंग: पते को अक्षांश/देशांतर में बदलें।
 * (शायद इस प्रोजेक्ट में सीधे उपयोग नहीं किया जाएगा, लेकिन भविष्य के लिए अच्छा है)
 */
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
 *
 * param pincode - जांच करने के लिए पिनकोड
 * returns - यदि पिनकोड सर्विस एरिया में है तो true, अन्यथा false
 */
export async function isWithinServiceArea(pincode: string): Promise<boolean> {
  console.log(`[DEBUG] isWithinServiceArea: Checking for pincode: ${pincode}`);
  // TODO: डेटाबेस से सर्विस एरिया पिनकोड/जोन को fetch करने के लिए लॉजिक लागू करें
  // अभी के लिए, यह एक डमी लॉजिक है।
  const servicePincodes = ['110001', '110002', '110003', '110004', '122001']; // उदाहरण पिनकोड
  const isInArea = servicePincodes.includes(pincode);
  console.log(`[DEBUG] isWithinServiceArea: Pincode ${pincode} is ${isInArea ? 'within' : 'not within'} service area.`);
  return isInArea;
}


/**
 * डिलीवरी शुल्क की गणना करें।
 *
 * param pincode - डिलीवरी स्थान का पिनकोड
 * returns - गणना की गई डिलीवरी शुल्क
 */
export async function calculateDeliveryCharges(pincode: string): Promise<number> {
  console.log(`[DEBUG] calculateDeliveryCharges: Calculating for pincode: ${pincode}`);
  // TODO: डिलीवरी शुल्क की गणना के लिए लॉजिक लागू करें
  // यह दूरी, पिनकोड, या अन्य कारकों के आधार पर हो सकता है।
  // डेटाबेस से शुल्क तालिकाओं को fetch करना एक तरीका हो सकता है।
  // अभी के लिए, यह एक डमी लॉजिक है।
  if (pincode === '110001') return 20;
  if (pincode === '122001') return 40;
  console.log(`[DEBUG] calculateDeliveryCharges: Defaulting to 30 for pincode: ${pincode}`);
  return 30; // डिफ़ॉल्ट शुल्क
}
