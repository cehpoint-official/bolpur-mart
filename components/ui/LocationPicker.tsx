"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Navigation } from "lucide-react";
import { useGeolocation, GeocodedAddress } from "@/hooks/useGeolocation";
import { toast } from "@/hooks/use-toast";

interface LocationPickerProps {
    onLocationFoundAction: (location: GeocodedAddress) => void;
    className?: string;
    label?: string;
}

export function LocationPicker({ onLocationFoundAction, className, label = "Use Current Location" }: LocationPickerProps) {
    const { fetchLocation, isLoading } = useGeolocation();

    const handleFetch = async () => {
        toast({
            title: "🔍 Requesting Location",
            description: "Please allow location access to auto-fill your address",
        });

        const locationData = await fetchLocation();

        if (locationData) {
            onLocationFoundAction(locationData);
            toast({
                title: "✅ Location Detected",
                description: `📍 ${locationData.city}, ${locationData.state}`,
            });
        } else {
            toast({
                title: "⚠️ Location Error",
                description: "Could not detect location. Please enter manually.",
                variant: "destructive",
            });
        }
    };

    return (
        <Button
            type="button"
            variant="outline"
            className={className}
            onClick={handleFetch}
            disabled={isLoading}
        >
            {isLoading ? (
                <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Detecting...</span>
                </div>
            ) : (
                <div className="flex items-center space-x-2">
                    <Navigation className="w-4 h-4" />
                    <span>{label}</span>
                </div>
            )}
        </Button>
    );
}
