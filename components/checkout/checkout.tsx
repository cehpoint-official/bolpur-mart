"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MobileLayout } from "@/components/layout/MobileLayout";
import {
  MapPin,
  CreditCard,
  Banknote,
  Smartphone,
  Clock,
  Plus,
  Check,
  QrCode,
  Copy,
  Camera,
  AlertCircle,
  Truck,
  Timer,
  CalendarClock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { FirebaseProductService } from "@/lib/firebase-products";
import { useAuth } from "@/hooks/useAuth";
import { useCartStore } from "@/stores/useCartStore";
import { useOrderStore } from "@/stores/useOrderStore";
import { OrderConfirmationDialog } from "@/components/ui/order-confirmation-dialog";
import type {
  CartSummary,
  Address,
  UpiPaymentMethod,
  DeliverySlot,
  Product,
  CartItem,
} from "@/types";

export default function Checkout() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    items: cartItems,
    clear: clearCart,
    initialized: cartInitialized,
    loading: cartLoading,
    init: initCart,
  } = useCartStore();
  const {
    createOrder,
    fetchUpiMethods,
    currentOrder,
    upiMethods,
    placing,
    uploading,
    uploadProgress,
    clearCurrentOrder,
    error: orderError,
    clearError,
  } = useOrderStore();

  // Static tax amount for MVP
  const STATIC_TAX_AMOUNT = 5;

  // Get addresses from user customData
  const addresses = user?.customData?.addresses || [];

  // Fetch product details using React Query
  const {
    data: products = [],
    isLoading: productsLoading,
    error: productsError,
  } = useQuery<Product[]>({
    queryKey: ["checkout-products", cartItems.map((item) => item.productId)],
    queryFn: async () => {
      if (cartItems.length === 0) return [];

      console.log("Fetching products for cart items:", cartItems);

      const productIds = [...new Set(cartItems.map((item) => item.productId))];
      const productPromises = productIds.map((id) =>
        FirebaseProductService.getProductById(id)
      );

      const fetchedProducts = await Promise.all(productPromises);
      const validProducts = fetchedProducts.filter(
        (product): product is Product => product !== null
      );

      console.log("Fetched products:", validProducts);

      return validProducts;
    },
    enabled: cartItems.length > 0 && cartInitialized,
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: 1000,
  });

  // Create cart items with product details
  const cartItemsWithProducts = useMemo(() => {
    return cartItems
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          ...item,
          product,
        };
      })
      .filter((item) => item.product);
  }, [cartItems, products]);

  // State management
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash_on_delivery" | "upi_online"
  >("cash_on_delivery");
  const [deliverySlot, setDeliverySlot] = useState<string>("immediate");
  const [orderNotes, setOrderNotes] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [showUpiDialog, setShowUpiDialog] = useState(false);
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
  const [upiMethodsLoading, setUpiMethodsLoading] = useState(true);

  // Time picker dialog states
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [scheduledPeriod, setScheduledPeriod] = useState<"AM" | "PM">("PM");

  // UPI Payment states
  const [upiTransactionId, setUpiTransactionId] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(
    null
  );

  // Keep delivery slots as they were
  const [deliverySlots] = useState<DeliverySlot[]>([
    {
      id: "immediate",
      type: "immediate",
      label: "Deliver Now",
      description: "Get it in 30-45 minutes",
      fee: 0,
      estimatedMinutes: 40,
      isAvailable: true,
    },
    {
      id: "express",
      type: "express",
      label: "Express Delivery",
      description: "Get it in 15-20 minutes",
      fee: 25,
      estimatedMinutes: 18,
      isAvailable: true,
    },
    {
      id: "scheduled",
      type: "scheduled",
      label: "Schedule for Later",
      description: "Choose your preferred time",
      fee: 0,
      estimatedMinutes: 120,
      isAvailable: true,
    },
  ]);

  // Check if initial loading is complete
  const isInitialLoading =
    authLoading ||
    !cartInitialized ||
    cartLoading ||
    (cartItems.length > 0 && productsLoading) ||
    upiMethodsLoading;

  // Check if cart is actually empty after initialization
  const isCartEmpty = cartInitialized && !cartLoading && cartItems.length === 0;

  // Redirect if not authenticated (but only after auth loading is complete)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/auth";
      return;
    }
  }, [isAuthenticated, authLoading]);

  // Load UPI methods and initialize
  useEffect(() => {
    const loadCheckoutData = async () => {
      if (!user?.uid) return;

      setUpiMethodsLoading(true);
      try {
        await fetchUpiMethods();

        // Select default address or first address
        if (addresses && addresses.length > 0) {
          const defaultAddress = addresses.find(
            (addr: Address) => addr.isDefault
          );
          if (defaultAddress) {
            setSelectedAddress(defaultAddress.id);
          } else {
            setSelectedAddress(addresses[0].id);
          }
        }
      } catch (error) {
        console.error("Error loading checkout data:", error);
        toast({
          title: "Error",
          description: "Failed to load checkout data.",
          variant: "destructive",
        });
      } finally {
        setUpiMethodsLoading(false);
      }
    };

    if (!authLoading && user?.uid) {
      loadCheckoutData();
    }
  }, [user?.uid, fetchUpiMethods, addresses, authLoading]);

  // Clear errors on component mount and when dependencies change
  useEffect(() => {
    clearError();
  }, [clearError, paymentMethod, selectedAddress]);

  // Watch for successful order creation
  useEffect(() => {
    if (currentOrder && !placing && !orderError) {
      console.log(
        "Order created successfully, showing confirmation:",
        currentOrder
      );
      setShowOrderConfirmation(true);
    }
  }, [currentOrder, placing, orderError]);

  // Calculate cart summary with products
  const cartSummary: CartSummary = useMemo(() => {
    const itemCount = cartItemsWithProducts.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const subtotal = cartItemsWithProducts.reduce((sum, item) => {
      if (!item.product) return sum;
      const price = item.product.discountedPrice || item.product.price;
      return sum + price * item.quantity;
    }, 0);

    const discount = cartItemsWithProducts.reduce((sum, item) => {
      if (!item.product?.hasDiscount) return sum;
      const originalPrice = item.product.price;
      const discountedPrice = item.product.discountedPrice || originalPrice;
      return sum + (originalPrice - discountedPrice) * item.quantity;
    }, 0);

    const deliveryFee =
      deliverySlots.find((slot) => slot.id === deliverySlot)?.fee || 0;
    const taxes = STATIC_TAX_AMOUNT;
    const total = subtotal + deliveryFee + taxes;

    return {
      itemCount,
      subtotal,
      deliveryFee,
      taxes,
      discount,
      total,
    };
  }, [cartItemsWithProducts, deliverySlot, deliverySlots]);

  // Generate time options for 12-hour format
  const generateTimeOptions = () => {
    const times: string[] = [];
    for (let hour = 1; hour <= 12; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour}:${minute.toString().padStart(2, "0")}`;
        times.push(timeString);
      }
    }
    return times;
  };

  // Generate date options (today and next 7 days)
  const generateDateOptions = () => {
    const dates: { value: string; label: string }[] = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const value = date.toISOString().split("T")[0];
      const label =
        i === 0
          ? "Today"
          : i === 1
            ? "Tomorrow"
            : date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            });

      dates.push({ value, label });
    }
    return dates;
  };

  // Set default scheduled date to today
  useEffect(() => {
    if (!scheduledDate) {
      setScheduledDate(new Date().toISOString().split("T")[0]);
    }
  }, [scheduledDate]);

  const handleDeliverySlotChange = (value: string) => {
    setDeliverySlot(value);
    if (value === "scheduled") {
      setShowTimeDialog(true);
    }
  };

  const handleTimeConfirm = () => {
    if (scheduledDate && scheduledTime) {
      setShowTimeDialog(false);
      toast({
        title: "Delivery Time Set",
        description: `Scheduled for ${new Date(
          scheduledDate
        ).toLocaleDateString()} at ${scheduledTime} ${scheduledPeriod}`,
      });
    } else {
      toast({
        title: "Complete Selection",
        description: "Please select both date and time",
        variant: "destructive",
      });
    }
  };

  const handleScreenshotUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File Type",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }

      setPaymentScreenshot(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setScreenshotPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const copyUpiId = async () => {
    const selectedUpiMethod = upiMethods[0];
    if (!selectedUpiMethod) return;

    try {
      await navigator.clipboard.writeText(selectedUpiMethod.upiId);
      toast({
        title: "UPI ID Copied",
        description: "UPI ID has been copied to clipboard",
      });
    } catch {
      toast({
        title: "Copy Failed",
        description: "Please copy the UPI ID manually",
        variant: "destructive",
      });
    }
  };

  const validateOrderData = () => {
    const errors: string[] = [];

    if (cartItemsWithProducts.length === 0) {
      errors.push("Cart is empty");
    }

    if (!selectedAddress) {
      errors.push("Please select a delivery address");
    }

    if (deliverySlot === "scheduled" && (!scheduledDate || !scheduledTime)) {
      errors.push("Please set your preferred delivery time");
    }

    if (paymentMethod === "upi_online") {
      if (!upiTransactionId?.trim()) {
        errors.push("Please provide UPI transaction ID");
      }
      if (!paymentScreenshot) {
        errors.push("Please upload payment screenshot");
      }
      if (upiMethods.length === 0) {
        errors.push("UPI payment methods are not available");
      }
    }

    // Validate cart items have products
    const invalidItems = cartItemsWithProducts.filter((item) => !item.product);
    if (invalidItems.length > 0) {
      errors.push(
        `${invalidItems.length} items are missing product information`
      );
    }

    // Validate address exists
    if (
      selectedAddress &&
      !addresses.find((addr: Address) => addr.id === selectedAddress)
    ) {
      errors.push("Selected address is no longer valid");
    }

    return errors;
  };

  const handlePlaceOrder = async () => {
    console.log("Starting order placement process...");

    // Clear any previous errors
    clearError();

    // Validate order data
    const validationErrors = validateOrderData();
    if (validationErrors.length > 0) {
      console.log("Validation errors:", validationErrors);
      toast({
        title: "Please fix the following:",
        description: validationErrors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setIsPlacingOrder(true);

    try {
      console.log("Validation passed, creating order...");

      const selectedAddr = addresses.find(
        (addr: Address) => addr.id === selectedAddress
      );

      if (!selectedAddr) {
        throw new Error("Selected address not found");
      }

      const selectedSlot = deliverySlots.find(
        (slot) => slot.id === deliverySlot
      );

      if (!selectedSlot) {
        throw new Error("Selected delivery slot not found");
      }

      // Ensure all cart items have valid products
      const validCartItems = cartItemsWithProducts.filter(
        (item) => item.product
      );

      if (validCartItems.length === 0) {
        throw new Error("No valid products in cart");
      }

      const orderData = {
        customerId: user!.uid,
        customerName: user!.customData?.name || selectedAddr.receiverName,
        customerPhone: user!.customData?.phone || selectedAddr.receiverPhone,
        customerEmail: user!.email || user!.customData?.email || "",
        deliveryAddress: selectedAddr,
        cartItems: validCartItems,
        paymentMethod,
        ...(paymentMethod === "upi_online" && {
          paymentDetails: {
            upiTransactionId: upiTransactionId.trim(),
            upiId: upiMethods[0]?.upiId || "",
            receiptFile: paymentScreenshot,
          },
        }),
        deliverySlot: {
          type: selectedSlot.type,
          fee: selectedSlot.fee,
          ...(deliverySlot === "scheduled" &&
            scheduledDate &&
            scheduledTime && {
            scheduledDate,
            scheduledTime: `${scheduledTime} ${scheduledPeriod}`,
          }),
        },
        notes: orderNotes.trim() || "",
        specialInstructions: "",
      };

      console.log("Order data prepared:", orderData);

      const order = await createOrder(orderData);

      if (order) {
        console.log("Order created successfully:", order);

        // Clear cart after successful order
        try {
          await clearCart();
          console.log("Cart cleared successfully");
        } catch (cartError) {
          console.error("Error clearing cart:", cartError);
          // Don't fail the entire process for cart clearing
        }

        // Reset form
        setUpiTransactionId("");
        setPaymentScreenshot(null);
        setScreenshotPreview(null);
        setOrderNotes("");
        setScheduledDate("");
        setScheduledTime("");
        setShowUpiDialog(false);
        setShowTimeDialog(false);

        toast({
          title: "Order Placed Successfully! 🎉",
          description: `Your order ${order.orderNumber} has been placed.`,
        });

        // The confirmation dialog will be shown by the useEffect watching currentOrder
      } else {
        throw new Error("Order creation returned null");
      }
    } catch (error) {
      console.error("Order placement failed:", error);

      let errorMessage = "Unable to place order. Please try again.";

      if (error instanceof Error) {
        errorMessage = error.message;
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      }

      toast({
        title: "Order Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const getUserId = () => {
    if (isAuthenticated && user) {
      return user.uid;
    }
    return "guest-user";
  };

  useEffect(() => {
    const userId = getUserId();
    const actualUserId = userId === "guest-user" ? null : userId;
    initCart(actualUserId);
  }, [user, isAuthenticated, initCart]);

  // Show loading screen during initial load
  if (isInitialLoading) {
    return (
      <MobileLayout
        title="Checkout"
        subtitle="Complete your order"
        showBottomNav={false}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">
              {authLoading
                ? "Loading user data..."
                : !cartInitialized
                  ? "Initializing cart..."
                  : productsLoading
                    ? "Loading products..."
                    : "Loading checkout data..."}
            </p>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Show empty cart only after everything is loaded
  if (isCartEmpty) {
    return (
      <MobileLayout
        title="Checkout"
        subtitle="Complete your order"
        showBottomNav={false}
      >
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🛒</span>
            </div>
            <h3 className="font-semibold mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Add some items to proceed with checkout
            </p>
            <Button onClick={() => (window.location.href = "/")}>
              Start Shopping
            </Button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Show error if products failed to load but cart has items
  if (
    productsError ||
    (cartItems.length > 0 &&
      cartItemsWithProducts.length === 0 &&
      !productsLoading)
  ) {
    return (
      <MobileLayout
        title="Checkout"
        subtitle="Complete your order"
        showBottomNav={false}
      >
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="font-semibold mb-2">Failed to load products</h3>
            <p className="text-muted-foreground text-sm mb-6">
              There was an error loading your cart items. Please try again.
            </p>
            <div className="space-x-2">
              <Button onClick={() => window.location.reload()}>Retry</Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/")}
              >
                Start Shopping
              </Button>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout
      title="Checkout"
      subtitle="Review and place your order"
      showBottomNav={false}
    >
      <div className="space-y-4 px-4 pt-4 pb-32">
        {/* Show order error if exists */}
        {orderError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-800">{orderError}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearError}
                  className="ml-auto text-red-600"
                >
                  ✕
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Address */}
        <Card className="mobile-card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <MapPin className="mr-2 text-primary" size={20} />
              Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedAddress}
              onValueChange={setSelectedAddress}
              className="space-y-3"
            >
              {addresses.map((address: Address) => (
                <div
                  key={address.id}
                  className="flex items-start space-x-3 p-3 border border-border rounded-lg mobile-card-hover"
                >
                  <RadioGroupItem
                    value={address.id}
                    id={address.id}
                    className="mt-1"
                  />
                  <Label htmlFor={address.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium capitalize">
                        {address.type}
                      </span>
                      {address.isDefault && (
                        <Badge
                          variant="secondary"
                          className="bg-black text-white text-xs"
                        >
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      {address.receiverName} • {address.receiverPhone}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {address.fullAddress}
                    </p>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={() => (window.location.href = "/addresses")}
            >
              <Plus size={16} className="mr-2" />
              Add New Address
            </Button>
          </CardContent>
        </Card>

        {/* Delivery Time */}
        <Card className="mobile-card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <Truck className="mr-2 text-primary" size={20} />
              Delivery Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={deliverySlot}
              onValueChange={handleDeliverySlotChange}
              className="space-y-3"
            >
              {deliverySlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-start space-x-3 p-3 border border-border rounded-lg mobile-card-hover"
                >
                  <RadioGroupItem
                    value={slot.id}
                    id={slot.id}
                    className="mt-1"
                    disabled={!slot.isAvailable}
                  />
                  <Label htmlFor={slot.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{slot.label}</span>
                        {slot.type === "express" && (
                          <Badge className="bg-orange-500 text-white text-xs">
                            Fast
                          </Badge>
                        )}
                        {slot.type === "scheduled" && (
                          <Badge className="bg-purple-500 text-white text-xs">
                            <CalendarClock size={12} className="mr-1" />
                            Custom
                          </Badge>
                        )}
                      </div>
                      {slot.fee > 0 ? (
                        <span className="text-sm font-medium text-primary">
                          +₹{slot.fee}
                        </span>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-xs text-green-600"
                        >
                          FREE
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {slot.description}
                    </p>
                    {slot.id === "scheduled" &&
                      scheduledDate &&
                      scheduledTime && (
                        <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded">
                          <p className="text-xs font-medium text-purple-800 dark:text-purple-200">
                            Scheduled for{" "}
                            {new Date(scheduledDate).toLocaleDateString()} at{" "}
                            {scheduledTime} {scheduledPeriod}
                          </p>
                        </div>
                      )}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {/* Time Picker Dialog */}
            <Dialog open={showTimeDialog} onOpenChange={setShowTimeDialog}>
              <DialogContent className="max-w-sm sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center">
                    <Clock className="mr-2" size={20} />
                    Set Delivery Time
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Select Date</Label>
                    <Select
                      value={scheduledDate}
                      onValueChange={setScheduledDate}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose date" />
                      </SelectTrigger>
                      <SelectContent>
                        {generateDateOptions().map((date) => (
                          <SelectItem key={date.value} value={date.value}>
                            {date.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Time</Label>
                      <Select
                        value={scheduledTime}
                        onValueChange={setScheduledTime}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Hour:Minute" />
                        </SelectTrigger>
                        <SelectContent>
                          {generateTimeOptions().map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Period</Label>
                      <Select
                        value={scheduledPeriod}
                        onValueChange={(value: "AM" | "PM") =>
                          setScheduledPeriod(value)
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AM">AM</SelectItem>
                          <SelectItem value="PM">PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded">
                    <AlertCircle size={16} className="text-blue-600 mt-0.5" />
                    <div className="text-xs text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-1">Delivery Window</p>
                      <p>
                        We'll deliver within a 1-hour window around your
                        selected time. You'll receive notifications about the
                        exact delivery time.
                      </p>
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowTimeDialog(false)}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleTimeConfirm}
                    className="w-full sm:w-auto"
                    disabled={!scheduledDate || !scheduledTime}
                  >
                    Confirm Time
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card className="mobile-card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <CreditCard className="mr-2 text-primary" size={20} />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value: "cash_on_delivery" | "upi_online") =>
                setPaymentMethod(value)
              }
              className="space-y-3"
            >
              {/* Cash on Delivery */}
              <div className="flex items-start space-x-3 p-3 border border-border rounded-lg mobile-card-hover">
                <RadioGroupItem
                  value="cash_on_delivery"
                  id="cod"
                  className="mt-1"
                />
                <Label htmlFor="cod" className="flex-1 cursor-pointer">
                  <div className="flex items-center space-x-2 mb-1">
                    <Banknote size={16} className="text-green-600" />
                    <span className="font-medium">Cash on Delivery</span>
                    <Badge
                      variant="outline"
                      className="bg-green-500 text-white text-xs"
                    >
                      Popular
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Pay when your order arrives
                  </p>
                </Label>
              </div>

              {/* UPI Payment */}
              <div className="flex items-start space-x-3 p-3 border border-border rounded-lg mobile-card-hover">
                <RadioGroupItem value="upi_online" id="upi" className="mt-1" />
                <Label htmlFor="upi" className="flex-1 cursor-pointer">
                  <div className="flex items-center space-x-2 mb-1">
                    <Smartphone size={16} className="text-blue-600" />
                    <span className="font-medium">Pay by UPI</span>
                    <Badge className="bg-blue-500 text-white text-xs">
                      Instant
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Pay using UPI apps like PhonePe, GPay, Paytm
                  </p>
                </Label>
              </div>
            </RadioGroup>

            {/* UPI Payment Details */}
            {paymentMethod === "upi_online" && upiMethods.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">
                    UPI Payment Details
                  </h4>
                  <Dialog open={showUpiDialog} onOpenChange={setShowUpiDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <QrCode size={16} className="mr-2" />
                        View QR Code
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle className="text-center">
                          Scan QR Code to Pay
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="flex justify-center">
                          <img
                            src={upiMethods[0]?.qrImageUrl}
                            alt="UPI QR Code"
                            className="w-48 h-48 border border-border rounded-lg"
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-2">
                            Scan with any UPI app or use UPI ID
                          </p>
                          <div className="flex items-center justify-center space-x-2 p-2 bg-muted rounded-lg">
                            <code className="text-sm font-mono">
                              {upiMethods[0]?.upiId}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={copyUpiId}
                            >
                              <Copy size={14} />
                            </Button>
                          </div>
                        </div>
                        <div className="text-center">
                          <Badge className="bg-green-500 text-white">
                            Amount: ₹{cartSummary.total.toFixed(0)}
                          </Badge>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="flex items-center justify-between p-2 bg-background rounded border">
                  <span className="text-sm">
                    UPI ID: {upiMethods[0]?.upiId}
                  </span>
                  <Button size="sm" variant="ghost" onClick={copyUpiId}>
                    <Copy size={14} />
                  </Button>
                </div>

                <div className="mt-4 space-y-4">
                  {/* Transaction ID Input */}
                  <div>
                    <Label htmlFor="txn-id" className="text-sm font-medium">
                      UPI Transaction ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="txn-id"
                      placeholder="Enter UPI Transaction ID"
                      value={upiTransactionId}
                      onChange={(e) => setUpiTransactionId(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {/* Payment Screenshot Upload */}
                  <div>
                    <Label className="text-sm font-medium">
                      Payment Screenshot <span className="text-red-500">*</span>
                    </Label>
                    <div className="mt-2">
                      {screenshotPreview ? (
                        <div className="relative">
                          <img
                            src={screenshotPreview}
                            alt="Payment Screenshot"
                            className="w-full h-32 object-cover border border-border rounded-lg"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              setPaymentScreenshot(null);
                              setScreenshotPreview(null);
                            }}
                          >
                            Change
                          </Button>
                        </div>
                      ) : (
                        <Label htmlFor="screenshot-upload">
                          <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50">
                            <Camera
                              size={24}
                              className="mb-2 text-muted-foreground"
                            />
                            <span className="text-sm text-muted-foreground">
                              Upload Payment Screenshot
                            </span>
                          </div>
                        </Label>
                      )}
                      <Input
                        id="screenshot-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="flex items-start space-x-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded">
                    <AlertCircle size={16} className="text-amber-600 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      Please complete the payment and upload the screenshot
                      before placing your order. Your order will be processed
                      after payment verification.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === "upi_online" && upiMethods.length === 0 && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle size={16} className="text-red-600" />
                  <p className="text-sm text-red-800 dark:text-red-200">
                    UPI payment is currently unavailable. Please select Cash on
                    Delivery.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Notes */}
        <Card className="mobile-card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Special Instructions (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add cooking preferences, delivery instructions, or any special requests..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="min-h-[80px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {orderNotes.length}/500 characters
            </p>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card className="mobile-card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cartItemsWithProducts.map((item) => (
                <div key={item.id} className="flex items-center space-x-3">
                  <img
                    src={item.product?.imageUrl}
                    alt={item.product?.name}
                    className="w-12 h-12 object-cover rounded border"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm leading-tight">
                      {item.product?.name}
                    </h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Qty: {item.quantity}
                      </span>
                      <span className="text-xs text-muted-foreground">×</span>
                      <span className="text-xs font-medium">
                        ₹{item.product?.discountedPrice || item.product?.price}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">
                      ₹
                      {(
                        (item.product?.discountedPrice ||
                          item.product?.price ||
                          0) * item.quantity
                      ).toFixed(0)}
                    </span>
                    {item.product?.hasDiscount && (
                      <p className="text-xs text-muted-foreground line-through">
                        ₹{(item.product.price * item.quantity).toFixed(0)}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal ({cartSummary.itemCount} items)</span>
                  <span>₹{cartSummary.subtotal.toFixed(0)}</span>
                </div>

                {cartSummary.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Item Discount</span>
                    <span>-₹{cartSummary.discount.toFixed(0)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span
                    className={
                      cartSummary.deliveryFee === 0 ? "text-green-600" : ""
                    }
                  >
                    {cartSummary.deliveryFee === 0
                      ? "FREE"
                      : `₹${cartSummary.deliveryFee}`}
                  </span>
                </div>

                {cartSummary.taxes > 0 && (
                  <div className="flex justify-between">
                    <span>Taxes & Charges</span>
                    <span>₹{cartSummary.taxes.toFixed(0)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between font-bold text-lg">
                  <span>Total Amount</span>
                  <span className="text-primary">
                    ₹{cartSummary.total.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-background/95 backdrop-blur-md border border-border p-4 z-50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-xl font-bold text-primary">
              ₹{cartSummary.total.toFixed(0)}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{cartSummary.itemCount} items</p>
            <div className="flex items-center">
              <Timer size={12} className="mr-1" />
              <span>
                {deliverySlot === "scheduled" && scheduledTime
                  ? `${scheduledTime} ${scheduledPeriod}`
                  : `${deliverySlots.find((s) => s.id === deliverySlot)
                    ?.estimatedMinutes
                  } mins`}
              </span>
            </div>
          </div>
        </div>

        <Button
          onClick={handlePlaceOrder}
          disabled={
            isPlacingOrder ||
            placing ||
            uploading ||
            !selectedAddress ||
            (deliverySlot === "scheduled" &&
              (!scheduledDate || !scheduledTime)) ||
            (paymentMethod === "upi_online" &&
              (!upiTransactionId?.trim() || !paymentScreenshot))
          }
          className="w-full py-3 text-lg font-bold"
          size="lg"
        >
          {isPlacingOrder || placing ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>
                {uploading
                  ? `Uploading... ${uploadProgress}%`
                  : "Placing Order..."}
              </span>
            </div>
          ) : (
            <>
              <Check className="mr-2" size={20} />
              {paymentMethod === "cash_on_delivery"
                ? "Place Order"
                : "Confirm & Pay"}
            </>
          )}
        </Button>

        {paymentMethod === "upi_online" && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Your order will be confirmed after payment verification
          </p>
        )}
      </div>

      {/* Order Confirmation Dialog */}
      <OrderConfirmationDialog
        isOpen={showOrderConfirmation}
        order={currentOrder}
        onClose={() => {
          setShowOrderConfirmation(false);
          clearCurrentOrder();
        }}
      />
    </MobileLayout>
  );
}
