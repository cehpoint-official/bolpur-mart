import {
  collection,
  addDoc,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase-client";
import { Notification } from "@/types";

export class FirebaseNotificationService {
  private static notificationsCollection = "notifications";

  static async createPaymentVerificationNotification(
    orderId: string,
    orderNumber: string,
    customerId: string,
    customerName: string,
    verificationStatus: "verified" | "rejected",
    paymentMethod: string,
    total: number,
    rejectionReason?: string
  ): Promise<void> {
    if (!db) return;
    try {
      const notificationsRef = collection(db, this.notificationsCollection);

      const isVerified = verificationStatus === "verified";

      const notification = {
        type: isVerified ? "payment_verified" : "payment_rejected",
        title: isVerified
          ? "Payment Verified! "
          : "Payment Verification Failed ",
        message: isVerified
          ? `Your payment for order ${orderNumber} has been verified successfully. Total: ₹${total}`
          : `Your payment for order ${orderNumber} could not be verified. ${rejectionReason
            ? `Reason: ${rejectionReason}`
            : "Please contact support for assistance."
          }`,
        orderId,
        orderNumber,
        customerId,
        customerName,
        total,
        paymentMethod,
        verificationStatus,
        rejectionReason: rejectionReason || null,
        targetAudience: "customer",
        isRead: false,
        priority: isVerified ? "normal" : "high", // High priority for rejections
        createdAt: new Date().toISOString(),
      };

      await addDoc(notificationsRef, notification);

      console.log(
        `Payment ${verificationStatus} notification created for order ${orderNumber}`
      );
    } catch (error) {
      console.error("Error creating payment verification notification:", error);
      throw error;
    }
  }

  // Batch create payment verification notifications
  static async batchCreatePaymentVerificationNotifications(
    notifications: Array<{
      orderId: string;
      orderNumber: string;
      customerId: string;
      customerName: string;
      verificationStatus: "verified" | "rejected";
      paymentMethod: string;
      total: number;
      rejectionReason?: string;
    }>
  ): Promise<void> {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      const notificationsRef = collection(db, this.notificationsCollection);

      notifications.forEach((notificationData) => {
        const docRef = doc(notificationsRef);
        const isVerified = notificationData.verificationStatus === "verified";

        batch.set(docRef, {
          type: isVerified ? "payment_verified" : "payment_rejected",
          title: isVerified
            ? "Payment Verified! "
            : "Payment Verification Failed ",
          message: isVerified
            ? `Your payment for order ${notificationData.orderNumber} has been verified successfully. Total: ₹${notificationData.total}`
            : `Your payment for order ${notificationData.orderNumber
            } could not be verified. ${notificationData.rejectionReason
              ? `Reason: ${notificationData.rejectionReason}`
              : "Please contact support for assistance."
            }`,
          orderId: notificationData.orderId,
          orderNumber: notificationData.orderNumber,
          customerId: notificationData.customerId,
          customerName: notificationData.customerName,
          total: notificationData.total,
          paymentMethod: notificationData.paymentMethod,
          verificationStatus: notificationData.verificationStatus,
          rejectionReason: notificationData.rejectionReason || null,
          targetAudience: "customer",
          isRead: false,
          priority: isVerified ? "normal" : "high",
          createdAt: new Date().toISOString(),
        });
      });

      await batch.commit();
      console.log(
        `${notifications.length} payment verification notifications created`
      );
    } catch (error) {
      console.error(
        "Error batch creating payment verification notifications:",
        error
      );
      throw error;
    }
  }

  // All other existing methods remain unchanged...
  static async getUserNotifications(
    userId: string,
    limitCount: number = 20
  ): Promise<Notification[]> {
    if (!db) return [];
    try {
      const notificationsRef = collection(db, this.notificationsCollection);
      const q = query(
        notificationsRef,
        where("customerId", "==", userId),
        where("targetAudience", "==", "customer"),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const notifications: Notification[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notifications.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt
            ? typeof data.createdAt === "string"
              ? new Date(data.createdAt)
              : data.createdAt.toDate()
            : new Date(),
        } as Notification);
      });

      return notifications;
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }
  }

  // Listen to real-time notifications
  static subscribeToUserNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void,
    onError?: (error: Error) => void
  ) {
    if (!db) return () => { };
    const notificationsRef = collection(db, this.notificationsCollection);
    const q = query(
      notificationsRef,
      where("customerId", "==", userId),
      where("targetAudience", "==", "customer"),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    return onSnapshot(
      q,
      (querySnapshot) => {
        const notifications: Notification[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          notifications.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt
              ? typeof data.createdAt === "string"
                ? new Date(data.createdAt)
                : data.createdAt.toDate()
              : new Date(),
          } as Notification);
        });
        callback(notifications);
      },
      onError
    );
  }

  // Mark notification as read
  static async markNotificationAsRead(notificationId: string): Promise<void> {
    if (!db) return;
    try {
      const notificationRef = doc(
        db,
        this.notificationsCollection,
        notificationId
      );
      await updateDoc(notificationRef, {
        isRead: true,
        readAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  // Mark all notifications as read for a user
  static async markAllNotificationsAsRead(userId: string): Promise<void> {
    if (!db) return;
    try {
      const notificationsRef = collection(db, this.notificationsCollection);
      const q = query(
        notificationsRef,
        where("customerId", "==", userId),
        where("targetAudience", "==", "customer"),
        where("isRead", "==", false)
      );

      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);

      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, {
          isRead: true,
          readAt: new Date().toISOString(),
        });
      });

      await batch.commit();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  // Get unread notification count
  static async getUnreadNotificationCount(userId: string): Promise<number> {
    if (!db) return 0;
    try {
      const notificationsRef = collection(db, this.notificationsCollection);
      const q = query(
        notificationsRef,
        where("customerId", "==", userId),
        where("targetAudience", "==", "customer"),
        where("isRead", "==", false)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }

  // Create a new notification
  static async createNotification(
    notification: Omit<Notification, "id" | "createdAt">
  ): Promise<void> {
    if (!db) return;
    try {
      const notificationsRef = collection(db, this.notificationsCollection);
      await addDoc(notificationsRef, {
        ...notification,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }
}
