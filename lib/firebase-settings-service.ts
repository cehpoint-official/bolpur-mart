// lib/firebase-settings-service.ts
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from './firebase-client';
import type { UpiPaymentMethod } from "@/types";

export class FirebaseSettingsService {
  private static settingsCollection = 'settings';
  private static upiMethodsCollection = 'upiPaymentMethods';

  // Get all UPI payment methods
  static async getUpiPaymentMethods(): Promise<UpiPaymentMethod[]> {
    if (!db) return [];
    try {
      console.log('Fetching UPI methods from collection:', this.upiMethodsCollection);

      const upiMethodsRef = collection(db, this.upiMethodsCollection);
      const querySnapshot = await getDocs(upiMethodsRef);

      console.log('UPI methods collection size:', querySnapshot.size);

      const upiMethods: UpiPaymentMethod[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('UPI method doc:', doc.id, data);

        const upiMethod: UpiPaymentMethod = {
          id: doc.id,
          name: data.name || '',
          upiId: data.upiId || '',
          qrImageUrl: data.qrImageUrl || '',
          isActive: data.isActive !== false, // Default to true if not specified
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        };

        // Only include active methods, but default to active if not specified
        if (upiMethod.isActive) {
          upiMethods.push(upiMethod);
        }
      });

      console.log('Processed UPI Methods:', upiMethods);

      // Sort by name for consistent ordering
      return upiMethods.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error fetching UPI methods:', error);
      return [];
    }
  }

  // Get single UPI method by ID
  static async getUpiMethodById(id: string): Promise<UpiPaymentMethod | null> {
    if (!db) return null;
    try {
      console.log('Fetching UPI method by ID:', id);

      const docRef = doc(db, this.upiMethodsCollection, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.log('No UPI method found with ID:', id);
        return null;
      }

      const data = docSnap.data();
      console.log('UPI method data:', data);

      return {
        id: docSnap.id,
        name: data.name || '',
        upiId: data.upiId || '',
        qrImageUrl: data.qrImageUrl || '',
        isActive: data.isActive !== false,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date()
      };
    } catch (error) {
      console.error('Error fetching UPI method by ID:', error);
      return null;
    }
  }

  // Get company settings
  static async getCompanySettings(): Promise<any> {
    const defaultSettings = {
      companyName: 'Bolpur Mart',
      supportPhone: '+91-9876543210',
      supportEmail: 'support@bolpurmart.com',
      deliveryRadius: 10,
      minOrderAmount: 50,
      maxOrderAmount: 5000,
      deliveryCharges: {
        immediate: 50,
        express: 30,
        scheduled: 0
      }
    };

    if (!db) return defaultSettings;

    try {
      console.log('Fetching company settings');

      const settingsDoc = await getDoc(doc(db, this.settingsCollection, 'company'));

      if (!settingsDoc.exists()) {
        console.log('No company settings found, returning defaults');

        return {
          companyName: 'Bolpur Mart',
          supportPhone: '+91-9876543210',
          supportEmail: 'support@bolpurmart.com',
          deliveryRadius: 10,
          minOrderAmount: 50,
          maxOrderAmount: 5000,
          deliveryCharges: {
            immediate: 50,
            express: 30,
            scheduled: 0
          }
        };
      }

      const data = settingsDoc.data();
      console.log('Company settings:', data);

      return data;
    } catch (error) {
      console.error('Error fetching company settings:', error);
      return {
        companyName: 'Bolpur Mart',
        supportPhone: '+91-9876543210',
        supportEmail: 'support@bolpurmart.com',
        deliveryRadius: 10,
        minOrderAmount: 50,
        maxOrderAmount: 5000,
        deliveryCharges: {
          immediate: 50,
          express: 30,
          scheduled: 0
        }
      };
    }
  }

  // Get all settings documents (for debugging)
  static async getAllSettings(): Promise<any[]> {
    if (!db) return [];
    try {
      console.log('Fetching all settings documents');

      const settingsRef = collection(db, this.settingsCollection);
      const querySnapshot = await getDocs(settingsRef);

      const settings: any[] = [];
      querySnapshot.forEach((doc) => {
        console.log('Settings doc:', doc.id, doc.data());
        settings.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return settings;
    } catch (error) {
      console.error('Error fetching all settings:', error);
      return [];
    }
  }

  // Test connection to Firebase
  static async testConnection(): Promise<boolean> {
    if (!db) return false;
    try {
      console.log('Testing Firebase connection...');

      // Try to fetch a simple collection
      const testRef = collection(db, this.upiMethodsCollection);
      const testSnap = await getDocs(testRef);

      console.log('Firebase connection test successful. Collection size:', testSnap.size);
      return true;
    } catch (error) {
      console.error('Firebase connection test failed:', error);
      return false;
    }
  }
}
