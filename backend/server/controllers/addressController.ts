import { Request, Response } from 'express';
import axios from 'axios';
import { db } from '../db';
// इम्पोर्ट पाथ को '../../shared/backend/tables' पर वापस रीसेट किया गया
import { deliveryAreas } from '../../shared/backend/tables'; 
import { eq } from 'drizzle-orm';
import { z } from "zod"; // Zod इम्पोर्ट

// Zod स्कीमा: यह आमतौर पर एक अलग फाइल में परिभाषित होता है और इम्पोर्ट किया जाता है।
// यदि यह इसी फाइल में है, तो यह ठीक है।
const ProcessLocationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
});

// यह फंक्शन address_components ऐरे से पोस्टल कोड निकालता है
// इसकी केवल एक ही परिभाषा होनी चाहिए, और यह null लौटा सकता है।
function extractPostalCode(components: any[]): string | null {
    const postal = components.find(c => c.types.includes('postal_code'));
    return postal ? postal.long_name : null; // यदि पोस्टल कोड नहीं मिला तो null लौटाएं
}

export const processCurrentLocation = async (req: Request, res: Response) => {
    try {
        // 1. Zod Validation
        const validation = ProcessLocationSchema.safeParse(req.body);
        if (!validation.success) {
            console.error("[DEBUG] processCurrentLocation: Zod validation failed.", validation.error.errors);
            return res.status(400).json({
                message: "Invalid input for coordinates.",
                errors: validation.error.errors
            });
        }
        const { latitude, longitude } = validation.data;

        console.log(`[DEBUG] processCurrentLocation: Received and validated coordinates: Lat ${latitude}, Lng ${longitude}`);

        const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

        if (!GOOGLE_MAPS_API_KEY) {
            console.error("[DEBUG] processCurrentLocation: Server configuration error - Google Maps API Key is NOT configured.");
            return res.status(500).json({ message: "Server configuration error: Google Maps API Key is missing." });
        }
        console.log("[DEBUG] processCurrentLocation: Google Maps API Key is configured.");

        // 2. Reverse Geocode Google API को कॉल करें
        const apiUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
        console.log("[DEBUG] processCurrentLocation: Calling Google Geocoding API at URL:", apiUrl);

        const geocodeResponse = await axios.get(apiUrl);

        console.log("[DEBUG] processCurrentLocation: Google API Raw Response Status:", geocodeResponse.status);
        console.log("[DEBUG] processCurrentLocation: Google API Raw Response Data:", JSON.stringify(geocodeResponse.data, null, 2));

        // Google API रिस्पॉन्स की जांच करें
        if (geocodeResponse.data.status !== 'OK') {
            console.warn(`[DEBUG] processCurrentLocation: Google API returned non-OK status: ${geocodeResponse.data.status}`);
            if (geocodeResponse.data.error_message) {
                console.error("[DEBUG] processCurrentLocation: Google API Error Message:", geocodeResponse.data.error_message);
            }
            // यदि स्टेटस 'ZERO_RESULTS' है तो 404 दें, अन्यथा 500
            const statusCode = geocodeResponse.data.status === 'ZERO_RESULTS' ? 404 : 500;
            const message = geocodeResponse.data.status === 'ZERO_RESULTS' ? "Could not resolve address from coordinates (no results)." : `Google API error: ${geocodeResponse.data.error_message || geocodeResponse.data.status}`;
            return res.status(statusCode).json({ message: message });
        }

        if (!geocodeResponse.data.results?.length) {
            console.warn("[DEBUG] processCurrentLocation: Google API returned 'OK' status but no results found.");
            return res.status(404).json({ message: "Could not resolve address from coordinates (no results)." });
        }

        const result = geocodeResponse.data.results[0];
        const addressComponents = result.address_components;
        const postalCode = extractPostalCode(addressComponents);
        const fullAddress = result.formatted_address;

        console.log(`[DEBUG] processCurrentLocation: Resolved Address: "${fullAddress}"`);
        console.log(`[DEBUG] processCurrentLocation: Extracted Postal Code: "${postalCode}"`);

        if (!postalCode) {
            console.warn("[DEBUG] processCurrentLocation: No postal code extracted from address components for resolved address.");
            return res.status(404).json({ message: "Could not extract postal code from resolved address." });
        }

        // 3. सेवा क्षेत्र की जांच करें
        const serviceArea = await db.select()
            .from(deliveryAreas)
            .where(eq(deliveryAreas.pincode, postalCode))
            .limit(1);

        console.log(`[DEBUG] processCurrentLocation: Service Area check for Pincode ${postalCode}: ${serviceArea.length > 0 ? 'Found' : 'Not Found'}`);

        // 4. प्रतिक्रिया लौटाएं
        return res.status(200).json({
            address: fullAddress,
            pincode: postalCode,
            latitude,
            longitude,
            inServiceArea: serviceArea.length > 0,
            deliveryCharges: serviceArea.length > 0 ? serviceArea[0].deliveryCharge : null,
        });

    } catch (err: any) {
        console.error("Error in processCurrentLocation catch block:", err.message || err);
        if (axios.isAxiosError(err) && err.response) { // Axios errors have a 'response' property for HTTP errors
            console.error("Axios Error Response Status:", err.response.status);
            console.error("Axios Error Response Data:", err.response.data);
        }
        return res.status(500).json({ message: "Internal server error during location processing." });
    }
};

