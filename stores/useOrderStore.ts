// stores/useOrderStore.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  FirebaseOrderService,
  OrdersQueryResult,
} from "@/lib/firebase-order-service";
import { FirebaseSettingsService } from "@/lib/firebase-settings-service";
import { toast } from "@/hooks/use-toast";
import type { Order, CartItem, Address, UpiPaymentMethod } from "@/types";
import { DocumentSnapshot } from "firebase/firestore";

// Extended interface for order creation
interface OrderCreationPaymentDetails {
  upiTransactionId?: string;
  upiId?: string;
  receiptFile?: File | null;
  paymentScreenshot?: string;
}

interface OrderState {
  // State
  orders: Order[];
  currentOrder: Order | null;
  upiMethods: UpiPaymentMethod[];
  loading: boolean;
  loadingMore: boolean;
  placing: boolean;
  uploading: boolean;
  uploadProgress: number;
  refreshing: boolean;

  // Pagination
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  totalOrders: number;

  // Error handling
  error: string | null;

  // Actions
  createOrder: (orderData: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryAddress: Address;
    cartItems: CartItem[];
    paymentMethod: "cash_on_delivery" | "upi_online";
    paymentDetails?: OrderCreationPaymentDetails;
    deliverySlot: {
      type: "immediate" | "express" | "scheduled";
      fee: number;
      scheduledDate?: string;
      scheduledTime?: string;
    };
    notes?: string;
    specialInstructions?: string;
  }) => Promise<Order | null>;

  fetchUserOrders: (userId: string, refresh?: boolean) => Promise<void>;
  loadMoreOrders: (userId: string) => Promise<void>;
  refreshOrders: (userId: string) => Promise<void>;
  refreshSingleOrder: (orderId: string) => Promise<void>;
  fetchUpiMethods: () => Promise<void>;
  uploadReceipt: (file: File) => Promise<string | null>;
  cancelOrder: (orderId: string, reason?: string) => Promise<void>;
  clearOrders: () => void;
  clearCurrentOrder: () => void;
  clearError: () => void;
}

// Direct Cloudinary upload function
const uploadImageToCloudinary = async (file: File): Promise<string> => {
  const cloudinaryData = new FormData();
  cloudinaryData.append("file", file);
  cloudinaryData.append("upload_preset", "Images");
  cloudinaryData.append("asset_folder", "Receipts");
  cloudinaryData.append("cloud_name", "dqoo1d1ip");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/dqoo1d1ip/image/upload`,
    {
      method: "POST",
      body: cloudinaryData,
    }
  );

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.secure_url;
};

export const useOrderStore = create<OrderState>()(
  devtools((set, get) => ({
    // Initial state
    orders: [],
    currentOrder: null,
    upiMethods: [],
    loading: false,
    loadingMore: false,
    placing: false,
    uploading: false,
    uploadProgress: 0,
    refreshing: false,
    lastDoc: null,
    hasMore: true,
    totalOrders: 0,
    error: null,

    createOrder: async (orderData) => {
      set({ placing: true, error: null });

      try {
        console.log("Starting order creation with data:", orderData);

        // Validate cart items have products
        const invalidItems = orderData.cartItems.filter(
          (item) => !item.product
        );
        if (invalidItems.length > 0) {
          throw new Error(`${invalidItems.length} items missing product data`);
        }

        // Calculate totals from cart items
        const subtotal = orderData.cartItems.reduce((sum, item) => {
          if (!item.product) return sum;
          const price =
            item.product.hasDiscount && item.product.discountedPrice
              ? item.product.discountedPrice
              : item.product.price;
          return sum + price * item.quantity;
        }, 0);

        const discount = orderData.cartItems.reduce((sum, item) => {
          if (!item.product) return sum;
          if (item.product.hasDiscount && item.product.discountedPrice) {
            const discountPerItem =
              item.product.price - item.product.discountedPrice;
            return sum + discountPerItem * item.quantity;
          }
          return sum;
        }, 0);

        const deliveryFee = orderData.deliverySlot.fee;
        const taxes = 0;
        const total = subtotal + deliveryFee + taxes;

        console.log("Order totals calculated:", {
          subtotal,
          discount,
          deliveryFee,
          taxes,
          total,
        });

        // Prepare order items
        const orderItems = orderData.cartItems.map((item) => ({
          productId: item.productId,
          productName: item.product?.name || "Unknown Product",
          quantity: item.quantity,
          price:
            item.product?.hasDiscount && item.product?.discountedPrice
              ? item.product.discountedPrice
              : item.product?.price || 0,
          total:
            item.quantity *
            (item.product?.hasDiscount && item.product?.discountedPrice
              ? item.product.discountedPrice
              : item.product?.price || 0),
          imageUrl: item.product?.imageUrl,
          variant: item.variant || null,
        }));

        console.log("Order items prepared:", orderItems);

        // Calculate estimated delivery time
        const now = new Date();
        const estimatedDelivery = new Date(
          now.getTime() +
          (orderData.deliverySlot.type === "immediate"
            ? 30 * 60 * 1000
            : orderData.deliverySlot.type === "express"
              ? 60 * 60 * 1000
              : 2 * 60 * 60 * 1000)
        );

        // Prepare payment details properly
        let finalPaymentDetails: any = {};

        if (
          orderData.paymentMethod === "upi_online" &&
          orderData.paymentDetails
        ) {
          console.log("Processing UPI payment details...");

          finalPaymentDetails = {
            upiTransactionId: orderData.paymentDetails.upiTransactionId || "",
            upiId: orderData.paymentDetails.upiId || "",
            verificationStatus: "pending" as const,
          };

          // Upload receipt if provided
          if (orderData.paymentDetails.receiptFile) {
            try {
              console.log("Uploading receipt...");
              set({ uploading: true, uploadProgress: 0 });

              const receiptUrl = await uploadImageToCloudinary(
                orderData.paymentDetails.receiptFile
              );

              console.log("Receipt uploaded:", receiptUrl);

              if (receiptUrl) {
                finalPaymentDetails.paymentScreenshot = receiptUrl;
              }

              set({ uploading: false, uploadProgress: 100 });
            } catch (uploadError) {
              console.error("Error uploading receipt:", uploadError);
              set({ uploading: false, uploadProgress: 0 });

              // Don't fail the entire order for upload issues
              toast({
                title: "Receipt Upload Failed",
                description: "Order will be created but receipt upload failed.",
                variant: "destructive",
              });
            }
          }
        } else if (orderData.paymentMethod === "cash_on_delivery") {
          finalPaymentDetails = {
            verificationStatus: "pending" as const,
          };
        }

        // Create clean delivery slot
        const cleanDeliverySlot: any = {
          type: orderData.deliverySlot.type,
          estimatedTime: estimatedDelivery,
          fee: orderData.deliverySlot.fee,
        };

        if (orderData.deliverySlot.scheduledDate) {
          cleanDeliverySlot.scheduledDate =
            orderData.deliverySlot.scheduledDate;
        }
        if (orderData.deliverySlot.scheduledTime) {
          cleanDeliverySlot.scheduledTime =
            orderData.deliverySlot.scheduledTime;
        }

        console.log("Final delivery slot:", cleanDeliverySlot);
        console.log("Final payment details:", finalPaymentDetails);

        // Prepare final order data
        const finalOrderData = {
          customerId: orderData.customerId,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          customerEmail: orderData.customerEmail,
          deliveryAddress: orderData.deliveryAddress,
          items: orderItems,
          subtotal,
          deliveryFee,
          taxes,
          discount,
          total,
          paymentMethod: orderData.paymentMethod,
          paymentDetails: finalPaymentDetails,
          deliverySlot: cleanDeliverySlot,
          notes: orderData.notes || "",
          specialInstructions: orderData.specialInstructions || "",
        };

        console.log("Creating order with final data:", finalOrderData);

        const order = await FirebaseOrderService.createOrder(finalOrderData);

        console.log("Order created successfully:", order);

        // Add new order to the beginning of the list
        set((state) => ({
          currentOrder: order,
          orders: [order, ...state.orders],
          placing: false,
          totalOrders: state.totalOrders + 1,
        }));


        return order;
      } catch (error) {
        console.error("Detailed error creating order:", error);

        // Log more details about the error
        if (error instanceof Error) {
          console.error("Error name:", error.name);
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
        }

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        set({
          placing: false,
          uploading: false,
          uploadProgress: 0,
          error: errorMessage,
        });

        toast({
          title: "Order Failed",
          description: `Failed to place order: ${error}`,
          variant: "destructive",
        });

        return null;
      }
    },

    fetchUserOrders: async (userId, refresh = false) => {
      if (refresh) {
        set({ refreshing: true, error: null });
      } else {
        set({ loading: true, error: null });
      }

      try {
        const result: OrdersQueryResult =
          await FirebaseOrderService.getUserOrdersPaginated(userId, 10);

        set({
          orders: result.orders,
          lastDoc: result.lastDoc,
          hasMore: result.hasMore,
          totalOrders: result.total,
          loading: false,
          refreshing: false,
        });
      } catch (error) {
        console.error("Error fetching orders:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load orders";

        set({
          loading: false,
          refreshing: false,
          error: errorMessage,
        });

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },

    loadMoreOrders: async (userId) => {
      const { hasMore, lastDoc, loadingMore } = get();

      if (!hasMore || loadingMore) return;

      set({ loadingMore: true, error: null });

      try {
        const result: OrdersQueryResult =
          await FirebaseOrderService.getUserOrdersPaginated(
            userId,
            10,
            lastDoc
          );

        set((state) => ({
          orders: [...state.orders, ...result.orders],
          lastDoc: result.lastDoc,
          hasMore: result.hasMore,
          loadingMore: false,
        }));
      } catch (error) {
        console.error("Error loading more orders:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load more orders";

        set({
          loadingMore: false,
          error: errorMessage,
        });

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },

    refreshOrders: async (userId) => {
      await get().fetchUserOrders(userId, true);
    },

    refreshSingleOrder: async (orderId) => {
      try {
        const refreshedOrder = await FirebaseOrderService.refreshOrder(orderId);

        if (refreshedOrder) {
          set((state) => ({
            orders: state.orders.map((order) =>
              order.id === orderId ? refreshedOrder : order
            ),
            currentOrder:
              state.currentOrder?.id === orderId
                ? refreshedOrder
                : state.currentOrder,
          }));

          toast({
            title: "Order Updated",
            description: "Order information has been refreshed.",
          });
        }
      } catch (error) {
        console.error("Error refreshing order:", error);
        toast({
          title: "Refresh Failed",
          description: "Failed to refresh order information.",
          variant: "destructive",
        });
      }
    },

    fetchUpiMethods: async () => {
      try {
        // Test connection first
        const isConnected = await FirebaseSettingsService.testConnection();
        if (!isConnected) {
          console.error("Firebase connection failed");
          set({ upiMethods: [] });
          return;
        }

        const upiMethods = await FirebaseSettingsService.getUpiPaymentMethods();

        set({ upiMethods });

        if (upiMethods.length === 0) {
          console.warn(
            "No UPI methods found. Check your Firestore collection."
          );
          toast({
            title: "No Payment Methods",
            description: "UPI payment methods are not available right now.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching UPI methods in store:", error);
        set({ upiMethods: [] });
        toast({
          title: "Error",
          description: "Failed to load payment methods.",
          variant: "destructive",
        });
      }
    },

    uploadReceipt: async (file) => {
      set({ uploading: true, uploadProgress: 0 });

      try {
        const receiptUrl = await uploadImageToCloudinary(file);
        set({ uploading: false, uploadProgress: 100 });
        return receiptUrl;
      } catch (error) {
        console.error("Error uploading receipt:", error);
        set({ uploading: false, uploadProgress: 0 });

        if (error instanceof Error) {
          toast({
            title: "Upload Failed",
            description: error.message,
            variant: "destructive",
          });
        }

        return null;
      }
    },

    cancelOrder: async (orderId, reason) => {
      try {
        await FirebaseOrderService.cancelOrder(orderId, reason);

        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === orderId
              ? { ...order, status: "cancelled" as const, isCancellable: false }
              : order
          ),
        }));

        toast({
          title: "Order Cancelled",
          description: "Your order has been cancelled successfully.",
        });
      } catch (error) {
        console.error("Error cancelling order:", error);
        toast({
          title: "Cancellation Failed",
          description: "Failed to cancel order. Please try again.",
          variant: "destructive",
        });
      }
    },

    clearOrders: () => {
      set({
        orders: [],
        lastDoc: null,
        hasMore: true,
        totalOrders: 0,
        error: null,
      });
    },

    clearCurrentOrder: () => {
      set({ currentOrder: null });
    },

    clearError: () => {
      set({ error: null });
    },
  }))
);
