"use client"

import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { FirebaseAuthService } from "@/lib/firebase-services";
import { toast } from "@/hooks/use-toast";
import {
  User,
  Mail,
  Phone,
  Camera,
  Save,
  Edit,
  Bell,
  Palette,
  Globe,
  DollarSign,
  Loader2,
  Upload,
  X
} from "lucide-react";

// Cloudinary upload function
const uploadImageToCloudinary = async (file: File) => {
  const cloudinaryData = new FormData()
  // cloudinaryData.append("file", file)
  // cloudinaryData.append("upload_preset", "Images")
  // cloudinaryData.append("asset_folder", "UsersImage")
  // cloudinaryData.append("cloud_name", "dqoo1d1ip")

  cloudinaryData.append("file", file);
  cloudinaryData.append("upload_preset", "Images");
  cloudinaryData.append("folder", "UsersImage");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/dqoo1d1ip/image/upload`,
    {
      method: 'POST',
      body: cloudinaryData,
    }
  )

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.secure_url
}

// Theme options
const themeOptions = [
  { value: 'light', label: 'Light Mode' },
  { value: 'dark', label: 'Dark Mode' },
  { value: 'system', label: 'System Default' }
];

// Language options
const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'te', label: 'Telugu' },
  { value: 'ta', label: 'Tamil' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'mr', label: 'Marathi' },
  { value: 'pa', label: 'Punjabi' }
];

// Currency options
const currencyOptions = [
  { value: 'INR', label: 'Indian Rupee (₹)', symbol: '₹' },
  { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'British Pound (£)', symbol: '£' }
];

export default function ProfileInformation() {
  const { user, updateUserData } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notifications: true,
    theme: 'light',
    language: 'en',
    currency: 'INR'
  });

  // Initialize form data from user
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.displayName || user.customData?.name || '',
        email: user.email || '',
        phone: user.customData?.phone || '',
        notifications: user.customData?.preferences?.notifications ?? true,
        theme: user.customData?.preferences?.theme || 'light',
        language: user.customData?.preferences?.language || 'en',
        currency: user.customData?.preferences?.currency || 'INR'
      });
    }
  }, [user]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!user || !selectedFile) return;

    setIsUploadingAvatar(true);
    try {
      // Upload image to Cloudinary
      const avatarUrl = await uploadImageToCloudinary(selectedFile);
      console.log("urls-----", avatarUrl);
      // Update user profile with new avatar
      const updatedData = { avatar: avatarUrl };
      await FirebaseAuthService.updateUserProfile(updatedData);

      // Update local state
      updateUserData({
        ...user.customData,
        ...updatedData,
      });

      toast({
        title: "Avatar Updated",
        description: "Your profile picture has been updated successfully.",
      });

      // Reset dialog state
      setIsAvatarDialogOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error: any) {
      console.error("Error updating avatar:", error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Prepare update data
      const updateData = {
        name: formData.name,
        phone: formData.phone,
        preferences: {
          notifications: formData.notifications,
          theme: formData.theme,
          language: formData.language,
          currency: formData.currency
        }
      };

      // Update user profile
      await FirebaseAuthService.updateUserProfile(updateData);

      // Update local state
      updateUserData({
        ...user.customData,
        ...updateData,
      });

      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully.",
      });

      setIsEditing(false);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        name: user.displayName || user.customData?.name || '',
        email: user.email || '',
        phone: user.customData?.phone || '',
        notifications: user.customData?.preferences?.notifications ?? true,
        theme: user.customData?.preferences?.theme || 'light',
        language: user.customData?.preferences?.language || 'en',
        currency: user.customData?.preferences?.currency || 'INR'
      });
    }
    setIsEditing(false);
  };

  const handleNotificationToggle = async (checked: boolean) => {
    if (!user) return;

    try {
      const updateData = {
        preferences: {
          ...user.customData?.preferences,
          notifications: checked
        }
      };

      await FirebaseAuthService.updateUserProfile(updateData);

      updateUserData({
        ...user.customData,
        ...updateData,
      });

      handleInputChange('notifications', checked);

      toast({
        title: checked ? "Notifications Enabled" : "Notifications Disabled",
        description: checked
          ? "You'll receive updates about your orders."
          : "You won't receive push notifications anymore.",
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: "Failed to update notification settings.",
        variant: "destructive",
      });
    }
  };

  const handleComingSoon = (feature: string) => {
    toast({
      title: "Coming Soon",
      description: `${feature} feature will be available soon!`,
    });
  };

  const getUserAvatar = () => {
    return user?.customData?.avatar ||
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS8oghbsuzggpkknQSSU-Ch_xep_9v3m6EeBQ&s";
  };

  const getLanguageLabel = (code: string) => {
    return languageOptions.find(lang => lang.value === code)?.label || 'English';
  };

  const getCurrencyLabel = (code: string) => {
    return currencyOptions.find(curr => curr.value === code)?.label || 'Indian Rupee (₹)';
  };

  if (!user) {
    return (
      <MobileLayout title="Profile Information" backPath="/account">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout
      title="Profile Information"
      subtitle="Manage your personal details"
      backPath="/account"
    >
      <div className="p-4 space-y-4">
        {/* Profile Avatar Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <img
                  src={getUserAvatar()}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
                />
                <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background shadow-lg hover:scale-105 transition-transform"
                    >
                      <Camera size={14} />
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="flex flex-col max-w-sm sm:max-w-sm items-center">
                    <DialogHeader>
                      <DialogTitle className="flex items-center space-x-2">
                        <Camera className="w-5 h-5 text-primary" />
                        <span>Update Profile Picture</span>
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                      <div className="flex flex-col items-center space-y-4">
                        <div className="relative group">
                          <img
                            src={previewUrl || getUserAvatar()}
                            alt="Profile Preview"
                            className="w-32 h-32 rounded-full object-cover border-4 border-primary/20 shadow-lg"
                          />
                          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera className="w-8 h-8 text-white" />
                          </div>
                        </div>

                        <div className="flex flex-col items-center space-y-3">
                          <div className="flex space-x-2">
                            <Label htmlFor="avatar-upload">
                              <Button
                                variant="outline"
                                size="sm"
                                className="cursor-pointer bg-primary/5 hover:bg-primary/10 border-primary/20"
                                asChild
                              >
                                <span>
                                  <Upload className="w-4 h-4 mr-2" />
                                  Choose New Image
                                </span>
                              </Button>
                            </Label>
                            <input
                              id="avatar-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleFileSelect}
                              className="hidden"
                            />
                            {previewUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPreviewUrl(null);
                                  setSelectedFile(null);
                                }}
                                className="hover:bg-red-50 hover:text-red-600"
                              >
                                <X className="w-4 h-4 mr-1" />
                                Remove
                              </Button>
                            )}
                          </div>

                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">
                              Upload a new profile picture
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Max size: 5MB • Formats: JPG, PNG, WEBP
                            </p>
                          </div>
                        </div>
                      </div>

                      {selectedFile && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium text-green-800">
                              Image ready for upload
                            </span>
                          </div>
                          <p className="text-xs text-green-600 mt-1">
                            Click "Update Avatar" to save your new profile picture
                          </p>
                        </div>
                      )}
                    </div>

                    <DialogFooter className="flex  space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsAvatarDialogOpen(false)
                          setSelectedFile(null)
                          setPreviewUrl(null)
                        }}
                        disabled={isUploadingAvatar}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAvatarUpload}
                        disabled={isUploadingAvatar || !selectedFile}
                        className="min-w-[120px]"
                      >
                        {isUploadingAvatar ? (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Uploading...</span>
                          </div>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 mr-2" />
                            Update Avatar
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Profile Picture</h3>
                <p className="text-sm text-muted-foreground">
                  Update your profile photo
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Personal Information</h3>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="text-primary border"
                >
                  <Edit size={16} className="mr-2" />
                  Edit
                </Button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <User size={16} className="text-muted-foreground" />
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={!isEditing}
                    className={!isEditing ? "border-transparent bg-transparent shadow-none" : ""}
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Mail size={16} className="text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled={true}
                    className="border-transparent bg-muted shadow-none cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed for security reasons
                </p>
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Phone size={16} className="text-muted-foreground" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={!isEditing}
                    className={!isEditing ? "border-transparent bg-transparent shadow-none" : ""}
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="flex space-x-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </div>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-lg">Preferences</h3>

            <div className="space-y-4">
              {/* Notifications */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Bell size={16} className="text-muted-foreground" />
                  <div>
                    <p className="font-medium">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">Get updates about orders</p>
                  </div>
                </div>
                <Switch
                  checked={formData.notifications}
                  onCheckedChange={handleNotificationToggle}
                />
              </div>

              <Separator />

              {/* Theme - Coming Soon */}
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
                onClick={() => handleComingSoon("Theme selection")}
              >
                <div className="flex items-center space-x-3">
                  <Palette size={16} className="text-muted-foreground" />
                  <div>
                    <p className="font-medium">Theme</p>
                    <p className="text-sm text-muted-foreground">
                      {formData.theme === 'light' ? 'Light Mode' : formData.theme === 'dark' ? 'Dark Mode' : 'System Default'}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Coming Soon
                </div>
              </div>

              <Separator />

              {/* Language - Coming Soon */}
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
                onClick={() => handleComingSoon("Language selection")}
              >
                <div className="flex items-center space-x-3">
                  <Globe size={16} className="text-muted-foreground" />
                  <div>
                    <p className="font-medium">Language</p>
                    <p className="text-sm text-muted-foreground">{getLanguageLabel(formData.language)}</p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Coming Soon
                </div>
              </div>

              <Separator />

              {/* Currency - Coming Soon */}
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
                onClick={() => handleComingSoon("Currency selection")}
              >
                <div className="flex items-center space-x-3">
                  <DollarSign size={16} className="text-muted-foreground" />
                  <div>
                    <p className="font-medium">Currency</p>
                    <p className="text-sm text-muted-foreground">{getCurrencyLabel(formData.currency)}</p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Coming Soon
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-lg">Account Information</h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Member since</span>
                <span className="text-sm font-medium">
                  {user.metadata?.creationTime
                    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric'
                    })
                    : 'Recently'
                  }
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Sign-in method</span>
                <span className="text-sm font-medium">
                  {user.customData?.authProvider === 'google' ? 'Google' : 'Email & Password'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Email verified</span>
                <span className={`text-sm font-medium ${user.emailVerified ? 'text-green-600' : 'text-orange-600'}`}>
                  {user.emailVerified ? 'Verified' : 'Pending'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Profile completed</span>
                <span className={`text-sm font-medium ${user.customData?.profileCompleted ? 'text-green-600' : 'text-orange-600'}`}>
                  {user.customData?.profileCompleted ? 'Complete' : 'Incomplete'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
