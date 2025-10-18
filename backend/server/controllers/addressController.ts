import { Request, Response } from 'express';
import axios from 'axios';
import { db } from '../db';
import { deliveryAreas } from '../../shared/backend/tables';
import { eq } from 'drizzle-orm';

function extractPostalCode(components: any[]): string {
    const postal = components.find(c => c.types.includes('postal_code'));
    return postal ? postal.long_name : 'Unknown';
}

export const processCurrentLocation = async (req: Request, res: Response) => {
    try {
        const { latitude, longitude } = req.body;
        const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

        if (!GOOGLE_MAPS_API_KEY) throw new Error("Google Maps API Key not configured.");

        // 1. Reverse Geocode
        const geocodeResponse = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
        );

        if (!geocodeResponse.data.results?.length) {
            return res.status(404).json({ message: "Could not resolve address from coordinates." });
        }

        const result = geocodeResponse.data.results[0];
        const addressComponents = result.address_components;
        const postalCode = extractPostalCode(addressComponents);
        const fullAddress = result.formatted_address;

        // 2. Check service area
        const serviceArea = await db.select()
            .from(deliveryAreas)
            .where(eq(deliveryAreas.pincode, postalCode))
            .limit(1);

        // 3. Return response
        return res.status(200).json({
            address: fullAddress,
            pincode: postalCode,
            latitude,
            longitude,
            inServiceArea: serviceArea.length > 0,
            deliveryCharges: serviceArea[0]?.deliveryCharge || null,
        });
    } catch (err: any) {
        console.error("Error in processCurrentLocation:", err.message || err);
        return res.status(500).json({ message: "Internal server error." });
    }
};
