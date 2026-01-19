"use client";

import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { FirebaseAuthService } from "@/lib/firebase-services";
import { toast } from "@/hooks/use-toast";
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Home as HomeIcon,
  Building,
  MapPinIcon,
  Phone,
  User,
  Loader2,
  Star,
  RefreshCw,
  Navigation
} from "lucide-react";
import type { Address } from "@/types";

const initialAddressForm = {
  type: "home" as 'home' | 'work' | 'other',
  receiverName: "",
  receiverPhone: "",
  street: "",
  city: "",
  state: "",
  pinCode: "",
  fullAddress: "",
  isDefault: false
};

// Dynamic Google Maps Geocoding function - COMPLETE
const getLocationFromCoords = async (lat: number, lng: number) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error('Google Maps API key not configured');
  }

  try {
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
    let area = "";
    let subLocality = "";
    let locality = "";
    let district = "";
    let fullFormattedAddress = "";

    // Get the most detailed result
    const result = data.results[0];
    const components = result.address_components;
    fullFormattedAddress = result.formatted_address;

    console.log('🗺️ Raw geocoding result:', {
      formatted_address: fullFormattedAddress,
      components: components.map((c: any) => ({ name: c.long_name, types: c.types }))
    });

    // Parse address components dynamically
    components.forEach((component: any) => {
      const types = component.types;
      const longName = component.long_name;

      if (types.includes("postal_code")) {
        pinCode = longName;
      }

      if (types.includes("sublocality_level_1") ||
        (types.includes("sublocality") && !subLocality)) {
        subLocality = longName;
      }

      if (types.includes("locality")) {
        locality = longName;
      }

      if (types.includes("administrative_area_level_2")) {
        district = longName;
      }

      if (types.includes("administrative_area_level_1")) {
        state = longName;
      }

      if (types.includes("neighborhood") && !area) {
        area = longName;
      }

      if (types.includes("political") &&
        !area &&
        longName !== state &&
        longName !== locality &&
        longName !== district) {
        area = longName;
      }
    });

    // Dynamic city selection with priority
    city = subLocality || locality || district || area || "";

    // Clean up city name
    if (city) {
      city = city.replace(/ Municipality| Corporation| Panchayat| Block| Gram Panchayat/gi, '').trim();
    }

    // Create clean full address
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

    const result_data = {
      city: city || "Unknown",
      state: state || "Unknown",
      pinCode: pinCode || "",
      fullAddress: cleanFullAddress,
      originalFormatted: fullFormattedAddress
    };

    console.log('✅ Processed location data:', result_data);
    return result_data;

  } catch (error: any) {
    console.error('❌ Geocoding error:', error);
    throw error;
  }
};

export default function SavedAddresses() {
  const { user, updateUserData } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState(initialAddressForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationSkeleton, setLocationSkeleton] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);

  // Load addresses from user data
  useEffect(() => {
    if (user?.customData?.addresses) {
      setAddresses(user.customData.addresses);
    } else {
      setAddresses([]);
    }
    setIsLoading(false);
  }, [user?.customData?.addresses]);

  const refreshUserData = async () => {
    if (!user?.uid) return;

    try {
      const updatedUser = await FirebaseAuthService.getCurrentUserWithData();
      if (updatedUser?.customData) {
        updateUserData(updatedUser.customData);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setAddressForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Enhanced location detection with skeleton loading
  const fetchCurrentLocation = async () => {
    setIsLoadingLocation(true);
    setLocationSkeleton(true);

    try {
      // Check sessionStorage first with timestamp
      const storedLocation = sessionStorage.getItem("userLocation");
      const locationTimestamp = sessionStorage.getItem("userLocationTimestamp");

      if (storedLocation && locationTimestamp) {
        const timestamp = parseInt(locationTimestamp);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

        // Use cached location if it's less than 1 hour old
        if (now - timestamp < oneHour) {
          const { city, state, pinCode, fullAddress } = JSON.parse(storedLocation);

          // Simulate loading for better UX
          await new Promise(resolve => setTimeout(resolve, 800));

          setAddressForm(prev => ({
            ...prev,
            city,
            state,
            pinCode: pinCode || prev.pinCode,
            fullAddress: prev.fullAddress || fullAddress
          }));

          toast({
            title: "📍 Cached Location Loaded",
            description: `${city}, ${state}${pinCode ? ` - ${pinCode}` : ''}`,
          });

          setLocationSkeleton(false);
          setIsLoadingLocation(false);
          return;
        }
      }

      if (!navigator.geolocation) {
        throw new Error("Geolocation not supported by this browser");
      }

      // Show location permission prompt
      toast({
        title: "🔍 Requesting Location",
        description: "Please allow location access to auto-fill your address",
      });

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            timeout: 20000, // 20 seconds
            enableHighAccuracy: true,
            maximumAge: 600000, // 10 minutes
          }
        );
      });

      const { latitude, longitude } = position.coords;

      toast({
        title: "📡 Location Found",
        description: "Fetching detailed address information...",
      });

      // Add delay for skeleton effect
      await new Promise(resolve => setTimeout(resolve, 1000));

      const locationData = await getLocationFromCoords(latitude, longitude);

      // Save to sessionStorage with timestamp
      sessionStorage.setItem("userLocation", JSON.stringify(locationData));
      sessionStorage.setItem("userLocationTimestamp", Date.now().toString());

      setAddressForm(prev => ({
        ...prev,
        city: locationData.city,
        state: locationData.state,
        pinCode: locationData.pinCode || prev.pinCode,
        // Only auto-fill fullAddress if it's empty
        fullAddress: prev.fullAddress || locationData.fullAddress
      }));

      toast({
        title: "✅ Location Detected Successfully!",
        description: `📍 ${locationData.city}, ${locationData.state}${locationData.pinCode ? ` - ${locationData.pinCode}` : ''}`,
      });

    } catch (error: any) {
      console.error("Location fetch error:", error);

      let errorMessage = "Could not detect location.";
      let toastTitle = "⚠️ Location Error";

      if (error.code === 1) {
        errorMessage = "Location access denied. Please enable location permissions and try again.";
        toastTitle = "🚫 Permission Denied";
      } else if (error.code === 2) {
        errorMessage = "Location unavailable. Please check your GPS/network settings.";
        toastTitle = "📍 Location Unavailable";
      } else if (error.code === 3) {
        errorMessage = "Location request timeout. Please try again.";
        toastTitle = "⏱️ Request Timeout";
      } else if (error.message.includes('API key')) {
        errorMessage = "Location service configuration error.";
        toastTitle = "⚙️ Service Error";
      }

      // Use default fallback location
      const defaultLocation = {
        city: "Bolpur",
        state: "West Bengal",
        pinCode: "731204"
      };

      setAddressForm(prev => ({
        ...prev,
        ...defaultLocation
      }));

      toast({
        title: toastTitle,
        description: `${errorMessage} Using default: Bolpur, West Bengal`,
        variant: "destructive",
      });

    } finally {
      setLocationSkeleton(false);
      setIsLoadingLocation(false);
    }
  };

  const handleAddAddress = () => {
    setEditingAddress(null);
    setAddressForm({
      ...initialAddressForm,
      isDefault: addresses.length === 0 // First address is default
    });
    setIsDialogOpen(true);
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setAddressForm({
      type: address.type,
      receiverName: address.receiverName,
      receiverPhone: address.receiverPhone,
      street: address.street,
      city: address.city,
      state: address.state,
      pinCode: address.pinCode,
      fullAddress: address.fullAddress,
      isDefault: address.isDefault
    });
    setIsDialogOpen(true);
  };

  const validateForm = (): boolean => {
    if (!addressForm.receiverName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter receiver's name.",
        variant: "destructive",
      });
      return false;
    }

    if (!addressForm.receiverPhone.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter receiver's phone number.",
        variant: "destructive",
      });
      return false;
    }

    if (!addressForm.fullAddress.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter the full address.",
        variant: "destructive",
      });
      return false;
    }

    if (!addressForm.city.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter the city.",
        variant: "destructive",
      });
      return false;
    }

    if (!addressForm.state.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter the state.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSaveAddress = async () => {
    if (!user?.uid) return;
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (editingAddress) {
        await FirebaseAuthService.updateAddress(editingAddress.id, addressForm);
        toast({
          title: " Address Updated",
          description: "Your address has been updated successfully.",
        });
      } else {
        await FirebaseAuthService.addAddress(addressForm);
        toast({
          title: " Address Added",
          description: "New address has been added successfully.",
        });
      }

      await refreshUserData();

      setIsDialogOpen(false);
      setAddressForm(initialAddressForm);
      setEditingAddress(null);
    } catch (error: any) {
      console.error('Save address error:', error);
      toast({
        title: " Save Failed",
        description: error.message || "Failed to save address. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (addressId: string) => {
    setAddressToDelete(addressId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!user?.uid || !addressToDelete) return;

    try {
      await FirebaseAuthService.deleteAddress(addressToDelete);

      toast({
        title: " Address Deleted",
        description: "Address has been removed successfully.",
      });

      await refreshUserData();

    } catch (error: any) {
      console.error('Delete address error:', error);
      toast({
        title: " Delete Failed",
        description: error.message || "Failed to delete address. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setAddressToDelete(null);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    if (!user?.uid) return;

    try {
      await FirebaseAuthService.setDefaultAddress(addressId);

      toast({
        title: " Default Address Set",
        description: "This address is now your default delivery address.",
      });

      await refreshUserData();

    } catch (error: any) {
      console.error('Set default address error:', error);
      toast({
        title: " Update Failed",
        description: error.message || "Failed to set default address. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getAddressTypeIcon = (type: string) => {
    switch (type) {
      case 'home':
        return <HomeIcon size={16} className="text-blue-600" />;
      case 'work':
        return <Building size={16} className="text-green-600" />;
      default:
        return <MapPinIcon size={16} className="text-gray-600" />;
    }
  };

  const getAddressTypeColor = (type: string) => {
    switch (type) {
      case 'home':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'work':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!user) {
    return (
      <MobileLayout title="Saved Addresses" backPath="/account">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Please sign in to view your addresses</p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout
      title="Saved Addresses"
      subtitle="Manage your delivery addresses"
      backPath="/account"
    >
      <div className="p-4 space-y-4">
        {/* Header Actions */}
        <div className="flex space-x-2">
          <Button
            className="flex-1"
            onClick={handleAddAddress}
          >
            <Plus size={16} className="mr-2" />
            Add New Address
          </Button>
          {/* <Button
            variant="outline"
            size="icon"
            onClick={refreshUserData}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </Button> */}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="animate-pulse space-y-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-gray-200 rounded"></div>
                      <div className="w-16 h-5 bg-gray-200 rounded"></div>
                      <div className="w-12 h-5 bg-gray-200 rounded"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="w-32 h-4 bg-gray-200 rounded"></div>
                      <div className="w-28 h-4 bg-gray-200 rounded"></div>
                      <div className="w-full h-4 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Addresses List */}
        {!isLoading && addresses.length > 0 && (
          <div className="space-y-3">
            {addresses.map((address) => (
              <Card key={address.id} className="mobile-card-hover">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Address Type and Default Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getAddressTypeIcon(address.type)}
                        <Badge className={`capitalize ${getAddressTypeColor(address.type)}`}>
                          {address.type}
                        </Badge>
                        {address.isDefault && (
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            <Star size={12} className="mr-1 fill-current" />
                            Default
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => handleEditAddress(address)}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(address.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>

                    {/* Receiver Info */}
                    <div className="space-y-1">
                      <div className="flex items-center text-sm font-medium">
                        <User size={14} className="mr-2 text-muted-foreground" />
                        {address.receiverName}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Phone size={14} className="mr-2" />
                        {address.receiverPhone}
                      </div>
                    </div>

                    {/* Address */}
                    <div className="flex items-start space-x-2">
                      <MapPin size={14} className="mt-0.5 text-muted-foreground flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        {address.fullAddress}
                      </p>
                    </div>

                    {/* Location Details */}
                    {(address.city || address.state || address.pinCode) && (
                      <div className="flex items-center text-xs text-muted-foreground space-x-2">
                        {address.city && <span>{address.city}</span>}
                        {address.state && (
                          <>
                            <span>•</span>
                            <span>{address.state}</span>
                          </>
                        )}
                        {address.pinCode && (
                          <>
                            <span>•</span>
                            <span>{address.pinCode}</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Set as Default Button */}
                    {!address.isDefault && (
                      <>
                        <Separator />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleSetDefault(address.id)}
                        >
                          <Star size={14} className="mr-2" />
                          Set as Default
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && addresses.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Addresses Added</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your first delivery address to get started with quick delivery
              </p>
            </CardContent>
          </Card>
        )}

        {/* Add/Edit Address Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? "Edit Address" : "Add New Address"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Address Type */}
              <div>
                <Label htmlFor="type">Address Type</Label>
                <Select
                  value={addressForm.type}
                  onValueChange={(value) => handleInputChange('type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">🏠 Home</SelectItem>
                    <SelectItem value="work">🏢 Work</SelectItem>
                    <SelectItem value="other">📍 Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Receiver Name */}
              <div>
                <Label htmlFor="receiverName">Receiver Name *</Label>
                <Input
                  id="receiverName"
                  value={addressForm.receiverName}
                  onChange={(e) => handleInputChange('receiverName', e.target.value)}
                  placeholder="Enter receiver's name"
                />
              </div>

              {/* Receiver Phone */}
              <div>
                <Label htmlFor="receiverPhone">Receiver Phone *</Label>
                <Input
                  id="receiverPhone"
                  value={addressForm.receiverPhone}
                  onChange={(e) => handleInputChange('receiverPhone', e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>

              {/* Location Detection with Skeleton */}
              <div>
                <Label>Auto-fill Location</Label>
                <div className="grid grid-cols-1  mt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={fetchCurrentLocation}
                    disabled={isLoadingLocation}
                  >
                    {isLoadingLocation ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Detecting...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Navigation className="w-4 h-4" />
                        <span>Use Current</span>
                      </div>
                    )}
                  </Button>


                </div>

                <p className="text-xs text-muted-foreground mt-1">
                  Auto-fill will detect your current location dynamically
                </p>
              </div>

              {/* Location Fields with Skeleton Loading */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="city">City *</Label>
                  {locationSkeleton ? (
                    <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                  ) : (
                    <Input
                      id="city"
                      value={addressForm.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="Enter city"
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  {locationSkeleton ? (
                    <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                  ) : (
                    <Input
                      id="state"
                      value={addressForm.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      placeholder="Enter state"
                    />
                  )}
                </div>
              </div>

              {/* Pin Code and Street */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="pinCode">Pin Code</Label>
                  {locationSkeleton ? (
                    <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                  ) : (
                    <Input
                      id="pinCode"
                      value={addressForm.pinCode}
                      onChange={(e) => handleInputChange('pinCode', e.target.value)}
                      placeholder="Pin code"
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="street">Street/Area</Label>
                  <Input
                    id="street"
                    value={addressForm.street}
                    onChange={(e) => handleInputChange('street', e.target.value)}
                    placeholder="Street name"
                  />
                </div>
              </div>

              {/* Full Address */}
              <div>
                <Label htmlFor="fullAddress">Complete Address *</Label>
                {locationSkeleton ? (
                  <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  <Textarea
                    id="fullAddress"
                    value={addressForm.fullAddress}
                    onChange={(e) => handleInputChange('fullAddress', e.target.value)}
                    placeholder="House/Flat number, Street name, Area, Landmark (if any)"
                    rows={3}
                    className="resize-none"
                  />
                )}
              </div>
            </div>

            <DialogFooter className="flex flex-row space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false)
                  setAddressForm(initialAddressForm)
                  setEditingAddress(null)
                  setLocationSkeleton(false)
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAddress}
                disabled={isSaving || locationSkeleton}
                className="min-w-[100px]"
              >
                {isSaving ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  editingAddress ? "Update Address" : "Save Address"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Address</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this address? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MobileLayout>
  );
}
