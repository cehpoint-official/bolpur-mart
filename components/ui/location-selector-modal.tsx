"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Home, Building, Check, Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation, GeocodedAddress } from "@/hooks/useGeolocation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Address } from "@/types";

interface LocationSelectorModalProps {
    isOpen: boolean;
    onCloseAction: () => void;
    onSelectAction: (city: string, state: string, address?: Address) => void;
}

export function LocationSelectorModal({
    isOpen,
    onCloseAction,
    onSelectAction,
}: LocationSelectorModalProps) {
    const { user } = useAuth();
    const { fetchLocation, isLoading: isDetecting } = useGeolocation();
    const [addresses, setAddresses] = useState<Address[]>([]);

    useEffect(() => {
        if (user?.customData?.addresses) {
            setAddresses(user.customData.addresses);
        }
    }, [user]);

    const handleUseCurrentLocation = async () => {
        const locationData = await fetchLocation();
        if (locationData) {
            onSelectAction(locationData.city, locationData.state);
            onCloseAction();
        }
    };

    const handleSelectAddress = (address: Address) => {
        onSelectAction(address.city, address.state, address);
        onCloseAction();
    };

    const getAddressIcon = (type: string) => {
        switch (type) {
            case "home":
                return <Home className="w-4 h-4" />;
            case "work":
                return <Building className="w-4 h-4" />;
            default:
                return <MapPin className="w-4 h-4" />;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onCloseAction()}>
            <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-none bg-background/95 backdrop-blur-sm">
                <div className="p-6 space-y-6">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <MapPin className="text-primary" /> Select Delivery Location
                        </DialogTitle>
                        <DialogDescription>
                            Choose where you want your orders delivered to see available items in your area.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                className="h-14 text-sm font-medium relative overflow-hidden group"
                                onClick={handleUseCurrentLocation}
                                disabled={isDetecting}
                            >
                                {isDetecting ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Detecting...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Navigation className="w-4 h-4 group-hover:animate-pulse" />
                                        Detect
                                    </div>
                                )}
                            </Button>

                            <Button
                                variant="outline"
                                className="h-14 text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                onClick={() => {
                                    onSelectAction("", "");
                                    onCloseAction();
                                }}
                            >
                                <X className="w-4 h-4 mr-2" />
                                Clear
                            </Button>
                        </div>

                        {addresses.length > 0 && (
                            <>
                                <div className="flex items-center gap-2 py-2">
                                    <Separator className="flex-1" />
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Saved Addresses
                                    </span>
                                    <Separator className="flex-1" />
                                </div>

                                <ScrollArea className="h-[250px] pr-4">
                                    <div className="space-y-3">
                                        {addresses.map((address) => (
                                            <button
                                                key={address.id}
                                                onClick={() => handleSelectAddress(address)}
                                                className="w-full text-left p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group relative"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-1 p-2 rounded-full bg-muted group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                                        {getAddressIcon(address.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-semibold capitalize truncate">
                                                                {address.type}
                                                            </span>
                                                            {address.isDefault && (
                                                                <Badge variant="secondary" className="text-[10px] h-4">
                                                                    Default
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground truncate">
                                                            {address.receiverName} • {address.receiverPhone}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                                            {address.fullAddress}, {address.city}, {address.state}
                                                        </p>
                                                    </div>
                                                    <Check className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity self-center" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
