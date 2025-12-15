import { Request, Response } from 'express';
import axios from 'axios';
import { db } from '../db';
// इम्पोर्ट पाथ को '../../shared/backend/tables' पर वापस रीसेट किया गया
import { deliveryAreas } from '../../shared/backend/tables'; 
import { eq } from 'drizzle-orm';
import { z } from "zod"; 

// Zod स्कीमा:
const ProcessLocationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
});

/**
 * एड्रेस कंपोनेंट्स ऐरे से पोस्टल कोड निकालता है।
 */
function extractPostalCode(components: any[]): string | null {
    const postal = components.find(c => c.types.includes('postal_code'));
    return postal ? postal.long_name : null; 
}

export const processCurrentLocation = async (req: Request, res: Response) => {
    try {
        // 1. Zod Validation
        const validation = ProcessLocationSchema.safeParse(req.body);
        if (!validation.success) {
            console.error("[ERROR] processCurrentLocation: Zod validation failed.", validation.error.errors);
            return res.status(400).json({
                message: "Invalid input for coordinates.",
                errors: validation.error.errors
            });
        }
        const { latitude, longitude } = validation.data;

        console.log(`[DEBUG] processCurrentLocation: Validated coordinates: Lat ${latitude}, Lng ${longitude}`);

        const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

        if (!GOOGLE_MAPS_API_KEY) {
            console.error("[ERROR] processCurrentLocation: Server configuration error - Google Maps API Key is NOT configured.");
            return res.status(500).json({ message: "Server configuration error: Google Maps API Key is missing." });
        }
        // console.log("[DEBUG] processCurrentLocation: Google Maps API Key is configured."); // अनावश्यक लॉग हटाया गया

        // 2. Reverse Geocode Google API को कॉल करें
        const apiUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
        // console.log("[DEBUG] processCurrentLocation: Calling Google Geocoding API at URL:", apiUrl); // URL लॉग हटा दिया गया

        const geocodeResponse = await axios.get(apiUrl);

        console.log("[DEBUG] processCurrentLocation: Google API Raw Response Status:", geocodeResponse.status);

        // Google API रिस्पॉन्स की जांच करें
        if (geocodeResponse.data.status !== 'OK') {
            console.warn(`[WARN] processCurrentLocation: Google API returned non-OK status: ${geocodeResponse.data.status}`);
            
            const errorMessage = geocodeResponse.data.error_message || geocodeResponse.data.status;
            
            // यदि स्टेटस 'ZERO_RESULTS' है तो 404 दें, अन्यथा 500
            const statusCode = geocodeResponse.data.status === 'ZERO_RESULTS' ? 404 : 500;
            const message = geocodeResponse.data.status === 'ZERO_RESULTS' 
                ? "Could not resolve address from coordinates (no results)." 
                : `Google API error: ${errorMessage}`;
                
            return res.status(statusCode).json({ message: message });
        }

        if (!geocodeResponse.data.results?.length) {
            console.warn("[WARN] processCurrentLocation: Google API returned 'OK' status but no results found.");
            return res.status(404).json({ message: "Could not resolve address from coordinates (no results)." });
        }

        const result = geocodeResponse.data.results[0];
        const addressComponents = result.address_components;
        const postalCode = extractPostalCode(addressComponents);
        const fullAddress = result.formatted_address;

        console.log(`[DEBUG] processCurrentLocation: Resolved Address: "${fullAddress}"`);
        console.log(`[DEBUG] processCurrentLocation: Extracted Postal Code: "${postalCode}"`);

        if (!postalCode) {
            console.warn("[WARN] processCurrentLocation: No postal code extracted from address components for resolved address.");
            return res.status(404).json({ message: "Could not extract postal code from resolved address." });
        }

        // 3. सेवा क्षेत्र की जांच करें (Drizzle ORM)
        const serviceArea = await db.select()
            .from(deliveryAreas)
            .where(eq(deliveryAreas.pincode, postalCode))
            .limit(1);
        
        // 🛑 FIX: यहाँ city और state को भी Geocoding results से extract करने की आवश्यकता है,
        // क्योंकि Frontend को full address object बनाना होता है।
        let city = '';
        let state = '';
        addressComponents.forEach((component: any) => {
            if (component.types.includes('locality') && !city) {
                city = component.long_name;
            } else if (component.types.includes('administrative_area_level_1') && !state) {
                state = component.long_name;
            }
        });


        const inServiceArea = serviceArea.length > 0;

        console.log(`[DEBUG] processCurrentLocation: Service Area check for Pincode ${postalCode}: ${inServiceArea ? 'Found' : 'Not Found'}`);

        // 4. प्रतिक्रिया लौटाएं
        return res.status(200).json({
            address: fullAddress,
            addressLine1: result.address_components.find((c: any) => c.types.includes('street_number'))?.long_name || result.address_components.find((c: any) => c.types.includes('route'))?.long_name || '',
            city: city, // City जोड़ा गया
            state: state, // State जोड़ा गया
            pincode: postalCode,
            latitude,
            longitude,
            inServiceArea: inServiceArea,
            deliveryCharges: inServiceArea ? serviceArea[0].deliveryCharge : null,
        });

    } catch (err: any) {
        console.error("Error in processCurrentLocation catch block:", err.message || err);
        if (axios.isAxiosError(err) && err.response) { 
            console.error("Axios Error Response Status:", err.response.status);
            console.error("Axios Error Response Data:", err.response.data);
        }
        return res.status(500).json({ message: "Internal server error during location processing." });
    }
};
