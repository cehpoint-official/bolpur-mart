"use client";

import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export interface GeocodedAddress {
    city: string;
    state: string;
    pinCode: string;
    fullAddress: string;
    originalFormatted: string;
}

export function useGeolocation() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getAddressFromCoords = async (lat: number, lng: number): Promise<GeocodedAddress> => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

        if (!apiKey) {
            throw new Error('Google Maps API key not configured');
        }

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&result_type=street_address|sublocality|locality|administrative_area_level_2|administrative_area_level_1|postal_code`
        );

        if (!response.ok) throw new Error('Geocoding API request failed');

        const data = await response.json();

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            throw new Error(`Geocoding failed: ${data.status || 'No results'}`);
        }

        let city = "";
        let state = "";
        let pinCode = "";
        let subLocality = "";
        let locality = "";
        let district = "";
        let area = "";

        const result = data.results[0];
        const components = result.address_components;
        const fullFormattedAddress = result.formatted_address;

        components.forEach((component: any) => {
            const types = component.types;
            const longName = component.long_name;

            if (types.includes("postal_code")) pinCode = longName;
            if (types.includes("sublocality_level_1") || (types.includes("sublocality") && !subLocality)) subLocality = longName;
            if (types.includes("locality")) locality = longName;
            if (types.includes("administrative_area_level_2")) district = longName;
            if (types.includes("administrative_area_level_1")) state = longName;
            if (types.includes("neighborhood") && !area) area = longName;
        });

        city = subLocality || locality || district || area || "";
        if (city) {
            city = city.replace(/ Municipality| Corporation| Panchayat| Block| Gram Panchayat/gi, '').trim();
        }

        const addressParts = [];
        if (subLocality) addressParts.push(subLocality);
        if (area && area !== subLocality) addressParts.push(area);
        if (locality && locality !== subLocality && locality !== area) addressParts.push(locality);
        if (district && district !== locality && district !== subLocality) {
            const districtLower = district.toLowerCase();
            const existingPartsLower = addressParts.map(p => p.toLowerCase());
            if (!existingPartsLower.some(p => districtLower.includes(p) || p.includes(districtLower))) {
                addressParts.push(district);
            }
        }
        if (state) addressParts.push(state);

        const cleanFullAddress = addressParts.length > 0 ? addressParts.join(', ') : fullFormattedAddress;

        return {
            city: city || "Unknown",
            state: state || "Unknown",
            pinCode: pinCode || "",
            fullAddress: cleanFullAddress,
            originalFormatted: fullFormattedAddress
        };
    };

    const fetchLocation = async (): Promise<GeocodedAddress | null> => {
        setIsLoading(true);
        setError(null);

        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                const msg = "Geolocation not supported by this browser";
                setError(msg);
                setIsLoading(false);
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const { latitude, longitude } = position.coords;
                        const data = await getAddressFromCoords(latitude, longitude);
                        setIsLoading(false);
                        resolve(data);
                    } catch (err: any) {
                        console.error("Geocoding error:", err);
                        setError(err.message || "Failed to geocode location");
                        setIsLoading(false);
                        resolve(null);
                    }
                },
                (err) => {
                    let msg = "Could not detect location.";
                    if (err.code === 1) msg = "Location access denied.";
                    else if (err.code === 2) msg = "Location unavailable.";
                    else if (err.code === 3) msg = "Request timeout.";

                    setError(msg);
                    setIsLoading(false);
                    resolve(null);
                },
                { timeout: 20000, enableHighAccuracy: true, maximumAge: 600000 }
            );
        });
    };

    return { fetchLocation, isLoading, error };
}
