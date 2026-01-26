// lib/firebase-order-service.ts
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  DocumentSnapshot,
  startAfter,
} from "firebase/firestore";
import { db } from "./firebase-client";
import type { Order, OrderItem, Address } from "@/types";

export interface OrdersQueryResult {
  orders: Order[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  total: number;
}

export class FirebaseOrderService {
  private static ordersCollection = "orders";
  private static notificationsCollection = "notifications";

  // Generate unique order ID
  static generateOrderId(): string {
    const timestamp = Date.now().toString();
    const randomPart = Math.random().toString(36).substr(2, 9).toUpperCase();
    return `ORD${timestamp.slice(-8)}${randomPart}`;
  }

  // Get user orders with pagination
  static async getUserOrdersPaginated(
    userId: string,
    limitCount: number = 10,
    lastDocument?: DocumentSnapshot | null
  ): Promise<OrdersQueryResult> {
    try {
      const ordersRef = collection(db, this.ordersCollection);

      let q = query(
        ordersRef,
        where("customerId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(limitCount + 1) // Get one extra to check if there are more
      );

      if (lastDocument) {
        q = query(
          ordersRef,
          where("customerId", "==", userId),
          orderBy("createdAt", "desc"),
          startAfter(lastDocument),
          limit(limitCount + 1)
        );
      }

      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs;

      // Check if there are more documents
      const hasMore = docs.length > limitCount;
      const orders: Order[] = [];

      // Process documents (excluding the extra one if it exists)
      const docsToProcess = hasMore ? docs.slice(0, -1) : docs;

      docsToProcess.forEach((doc) => {
        const data = doc.data();
        orders.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt
            ? typeof data.createdAt === "string"
              ? new Date(data.createdAt)
              : data.createdAt.toDate()
            : new Date(),
          updatedAt: data.updatedAt
            ? typeof data.updatedAt === "string"
              ? new Date(data.updatedAt)
              : data.updatedAt.toDate()
            : new Date(),
          estimatedDeliveryTime: data.estimatedDeliveryTime
            ? typeof data.estimatedDeliveryTime === "string"
              ? new Date(data.estimatedDeliveryTime)
              : data.estimatedDeliveryTime.toDate()
            : new Date(),
          deliverySlot: {
            ...data.deliverySlot,
            estimatedTime: data.deliverySlot.estimatedTime
              ? typeof data.deliverySlot.estimatedTime === "string"
                ? new Date(data.deliverySlot.estimatedTime)
                : data.deliverySlot.estimatedTime.toDate()
              : new Date(),
            actualDeliveryTime: data.deliverySlot.actualDeliveryTime
              ? typeof data.deliverySlot.actualDeliveryTime === "string"
                ? new Date(data.deliverySlot.actualDeliveryTime)
                : data.deliverySlot.actualDeliveryTime.toDate()
              : undefined,
          },
          orderTracking: {
            placedAt: data.orderTracking?.placedAt
              ? typeof data.orderTracking.placedAt === "string"
                ? new Date(data.orderTracking.placedAt)
                : data.orderTracking.placedAt.toDate()
              : new Date(),
            confirmedAt: data.orderTracking?.confirmedAt
              ? typeof data.orderTracking.confirmedAt === "string"
                ? new Date(data.orderTracking.confirmedAt)
                : data.orderTracking.confirmedAt.toDate()
              : new Date(),
            preparingAt: data.orderTracking?.preparingAt
              ? typeof data.orderTracking.preparingAt === "string"
                ? new Date(data.orderTracking.preparingAt)
                : data.orderTracking.preparingAt.toDate()
              : new Date(),
            outForDeliveryAt: data.orderTracking?.outForDeliveryAt
              ? typeof data.orderTracking.outForDeliveryAt === "string"
                ? new Date(data.orderTracking.outForDeliveryAt)
                : data.orderTracking.outForDeliveryAt.toDate()
              : new Date(),
            deliveredAt: data.orderTracking?.deliveredAt
              ? typeof data.orderTracking.deliveredAt === "string"
                ? new Date(data.orderTracking.deliveredAt)
                : data.orderTracking.deliveredAt.toDate()
              : new Date(),
          },
          reviewedAt: data.reviewedAt
            ? typeof data.reviewedAt === "string"
              ? new Date(data.reviewedAt)
              : data.reviewedAt.toDate()
            : new Date(),
        } as Order);
      });

      // Get the last document for pagination
      const lastDoc =
        docsToProcess.length > 0
          ? docsToProcess[docsToProcess.length - 1]
          : null;

      // Get total count (can be expensive for large collections - consider caching)
      const totalQuery = query(ordersRef, where("customerId", "==", userId));
      const totalSnapshot = await getDocs(totalQuery);
      const total = totalSnapshot.size;

      return {
        orders,
        lastDoc,
        hasMore,
        total,
      };
    } catch (error) {
      console.error("Error fetching user orders:", error);
      return {
        orders: [],
        lastDoc: null,
        hasMore: false,
        total: 0,
      };
    }
  }

  // Create new order
  static async createOrder(orderData: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    deliveryAddress: Address;
    items: OrderItem[];
    subtotal: number;
    deliveryFee: number;
    taxes: number;
    discount: number;
    total: number;
    paymentMethod: "cash_on_delivery" | "upi_online";
    paymentDetails?: {
      upiTransactionId?: string;
      paymentScreenshot?: string;
      upiId?: string;
      verificationStatus?: "pending" | "verified" | "rejected";
    };
    deliverySlot: {
      type: "immediate" | "express" | "scheduled";
      estimatedTime: Date;
      fee: number;
      scheduledDate?: string;
      scheduledTime?: string;
    };
    notes?: string;
    specialInstructions?: string;
  }): Promise<Order> {
    try {
      const orderNumber = this.generateOrderId();
      const now = new Date();
      const nowISO = now.toISOString();

      // Build clean delivery slot
      const deliverySlot: any = {
        type: orderData.deliverySlot.type,
        estimatedTime: orderData.deliverySlot.estimatedTime.toISOString(),
        fee: orderData.deliverySlot.fee,
      };

      // Only add scheduled fields if they exist
      if (orderData.deliverySlot.scheduledDate) {
        deliverySlot.scheduledDate = orderData.deliverySlot.scheduledDate;
      }
      if (orderData.deliverySlot.scheduledTime) {
        deliverySlot.scheduledTime = orderData.deliverySlot.scheduledTime;
      }

      // Build payment details with proper structure
      let finalPaymentDetails: any = {};

      if (
        orderData.paymentMethod === "upi_online" &&
        orderData.paymentDetails
      ) {
        finalPaymentDetails = {
          upiTransactionId: orderData.paymentDetails.upiTransactionId || "",
          paymentScreenshot: orderData.paymentDetails.paymentScreenshot || "",
          upiId: orderData.paymentDetails.upiId || "",
          verificationStatus:
            orderData.paymentDetails.verificationStatus || "pending",
        };
      } else if (orderData.paymentMethod === "cash_on_delivery") {
        finalPaymentDetails = {
          verificationStatus: "pending",
        };
      }

      const order: Omit<Order, "id"> = {
        orderNumber,
        customerId: orderData.customerId,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        customerEmail: orderData.customerEmail,
        deliveryAddress: orderData.deliveryAddress,
        items: orderData.items,
        subtotal: orderData.subtotal,
        deliveryFee: orderData.deliveryFee,
        taxes: orderData.taxes,
        discount: orderData.discount,
        total: orderData.total,
        status: "placed",
        paymentStatus: "pending",
        paymentMethod: orderData.paymentMethod,
        paymentDetails: finalPaymentDetails,
        deliverySlot,
        notes: orderData.notes || "",
        specialInstructions: orderData.specialInstructions || "",
        orderTracking: {
          placedAt: now,
        },
        createdAt: now,
        updatedAt: now,
        isRefundable: true,
        isCancellable: true,
        estimatedDeliveryTime: orderData.deliverySlot.estimatedTime,
      };

      // Clean undefined fields
      const cleanOrder = Object.fromEntries(
        Object.entries(order).filter(([_, value]) => value !== undefined)
      );

      // Convert dates to ISO strings for Firestore
      const firestoreOrder = {
        ...cleanOrder,
        createdAt: nowISO,
        updatedAt: nowISO,
        estimatedDeliveryTime:
          orderData.deliverySlot.estimatedTime.toISOString(),
        orderTracking: {
          placedAt: nowISO,
        },
      };
      console.log("Creating order in Firestore:", firestoreOrder);


      const docRef = await addDoc(
        collection(db, this.ordersCollection),
        firestoreOrder
      );

      const createdOrder: Order = {
        id: docRef.id,
        ...order,
      };

      await this.createOrderNotifications(createdOrder);
      return createdOrder;
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    }
  }

  // Create notifications for order
  static async createOrderNotifications(order: Order): Promise<void> {
    const batch = writeBatch(db);
    const nowISO = new Date().toISOString();

    // Admin notification
    const adminNotificationRef = doc(
      collection(db, this.notificationsCollection)
    );
    batch.set(adminNotificationRef, {
      type: "admin_order_placed",
      title: "New Order Received",
      message: `New order ${order.orderNumber} placed by ${order.customerName}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      total: order.total,
      isRead: false,
      targetAudience: "admin",
      createdAt: nowISO,
      priority: "high",
    });

    // Customer notification
    const customerNotificationRef = doc(
      collection(db, this.notificationsCollection)
    );
    batch.set(customerNotificationRef, {
      type: "customer_order_placed",
      title: "Order Placed Successfully",
      message: `Order ${order.orderNumber} placed successfully for ₹${order.total}. Check your account for details.`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      total: order.total,
      isRead: false,
      targetAudience: "customer",
      createdAt: nowISO,
      priority: "normal",
    });

    await batch.commit();
  }

  // Get user orders (legacy method - kept for compatibility)
  static async getUserOrders(
    userId: string,
    limitCount: number = 20
  ): Promise<Order[]> {
    try {
      const result = await this.getUserOrdersPaginated(userId, limitCount);
      return result.orders;
    } catch (error) {
      console.error("Error fetching user orders:", error);
      return [];
    }
  }

  // Get order by ID
  static async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const orderDoc = await getDoc(doc(db, this.ordersCollection, orderId));

      if (!orderDoc.exists()) return null;

      const data = orderDoc.data();
      return {
        id: orderDoc.id,
        ...data,
        createdAt: data.createdAt
          ? typeof data.createdAt === "string"
            ? new Date(data.createdAt)
            : data.createdAt.toDate()
          : new Date(),
        updatedAt: data.updatedAt
          ? typeof data.updatedAt === "string"
            ? new Date(data.updatedAt)
            : data.updatedAt.toDate()
          : new Date(),
        estimatedDeliveryTime: data.estimatedDeliveryTime
          ? typeof data.estimatedDeliveryTime === "string"
            ? new Date(data.estimatedDeliveryTime)
            : data.estimatedDeliveryTime.toDate()
          : new Date(),
        deliverySlot: {
          ...data.deliverySlot,
          estimatedTime: data.deliverySlot.estimatedTime
            ? typeof data.deliverySlot.estimatedTime === "string"
              ? new Date(data.deliverySlot.estimatedTime)
              : data.deliverySlot.estimatedTime.toDate()
            : new Date(),
          actualDeliveryTime: data.deliverySlot.actualDeliveryTime
            ? typeof data.deliverySlot.actualDeliveryTime === "string"
              ? new Date(data.deliverySlot.actualDeliveryTime)
              : data.deliverySlot.actualDeliveryTime.toDate()
            : undefined,
        },
        orderTracking: {
          placedAt: data.orderTracking?.placedAt
            ? typeof data.orderTracking.placedAt === "string"
              ? new Date(data.orderTracking.placedAt)
              : data.orderTracking.placedAt.toDate()
            : new Date(),
          confirmedAt: data.orderTracking?.confirmedAt
            ? typeof data.orderTracking.confirmedAt === "string"
              ? new Date(data.orderTracking.confirmedAt)
              : data.orderTracking.confirmedAt.toDate()
            : undefined,
          preparingAt: data.orderTracking?.preparingAt
            ? typeof data.orderTracking.preparingAt === "string"
              ? new Date(data.orderTracking.preparingAt)
              : data.orderTracking.preparingAt.toDate()
            : undefined,
          outForDeliveryAt: data.orderTracking?.outForDeliveryAt
            ? typeof data.orderTracking.outForDeliveryAt === "string"
              ? new Date(data.orderTracking.outForDeliveryAt)
              : data.orderTracking.outForDeliveryAt.toDate()
            : undefined,
          deliveredAt: data.orderTracking?.deliveredAt
            ? typeof data.orderTracking.deliveredAt === "string"
              ? new Date(data.orderTracking.deliveredAt)
              : data.orderTracking.deliveredAt.toDate()
            : undefined,
        },
        reviewedAt: data.reviewedAt
          ? typeof data.reviewedAt === "string"
            ? new Date(data.reviewedAt)
            : data.reviewedAt.toDate()
          : undefined,
      } as Order;
    } catch (error) {
      console.error("Error fetching order:", error);
      return null;
    }
  }

  // Update order status
  static async updateOrderStatus(
    orderId: string,
    status: Order["status"],
    trackingUpdate?: Partial<Order["orderTracking"]>
  ): Promise<void> {
    try {
      const nowISO = new Date().toISOString();
      const updateData: any = {
        status,
        updatedAt: nowISO,
      };

      if (trackingUpdate) {
        const trackingField = Object.keys(trackingUpdate)[0];
        updateData[`orderTracking.${trackingField}`] = nowISO;
      }

      await updateDoc(doc(db, this.ordersCollection, orderId), updateData);
    } catch (error) {
      console.error("Error updating order status:", error);
      throw error;
    }
  }

  // Cancel order
  static async cancelOrder(orderId: string, reason?: string): Promise<void> {
    try {
      const nowISO = new Date().toISOString();

      await updateDoc(doc(db, this.ordersCollection, orderId), {
        status: "cancelled",
        cancelReason: reason,
        cancelledAt: nowISO,
        updatedAt: nowISO,
        isCancellable: false,
      });
    } catch (error) {
      console.error("Error cancelling order:", error);
      throw error;
    }
  }

  // Refresh single order
  static async refreshOrder(orderId: string): Promise<Order | null> {
    return this.getOrderById(orderId);
  }
}
