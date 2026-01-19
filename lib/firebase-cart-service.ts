import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from './firebase-client';
import type { CartItem, User, Product } from "@/types";

export class FirebaseCartService {
  private static collection = 'users';

  // Fetch user cart items with product details
  static async getCart(userId: string): Promise<CartItem[]> {
    if (!db) return [];
    try {
      const userDoc = await getDoc(doc(db, this.collection, userId));
      if (!userDoc.exists()) return [];
      const data = userDoc.data() as User;
      return data.cart || [];
    } catch (error) {
      console.error('Error fetching cart:', error);
      return [];
    }
  }

  // Save cart items to user doc
  static async saveCart(userId: string, cartItems: CartItem[]): Promise<void> {
    if (!db) return;
    try {
      const userDocRef = doc(db, this.collection, userId);

      // Clean cart items to remove undefined values
      const cleanCartItems = cartItems.map(item => ({
        id: item.id,
        userId: item.userId,
        productId: item.productId,
        quantity: item.quantity,
        variant: item.variant || null, // Convert undefined to null
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      await updateDoc(userDocRef, {
        cart: cleanCartItems,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving cart:', error);
      throw error;
    }
  }


  // Add or increase quantity for a product
  static async addItem(userId: string, productId: string, quantity: number, variant?: string): Promise<CartItem[]> {
    try {
      const cart = await this.getCart(userId);
      const existingItemIndex = cart.findIndex(item =>
        item.productId === productId && item.variant === variant
      );

      if (existingItemIndex !== -1) {
        cart[existingItemIndex].quantity += quantity;
      } else {
        const newItem: CartItem = {
          id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          productId,
          quantity,
          variant,
          createdAt: new Date().toISOString()
        };
        cart.push(newItem);
      }

      await this.saveCart(userId, cart);
      return cart;
    } catch (error) {
      console.error('Error adding item to cart:', error);
      throw error;
    }
  }

  // Update quantity or remove item if quantity is 0 or less
  static async updateItem(userId: string, cartItemId: string, quantity: number): Promise<CartItem[]> {
    try {
      let cart = await this.getCart(userId);

      if (quantity <= 0) {
        cart = cart.filter(item => item.id !== cartItemId);
      } else {
        const itemIndex = cart.findIndex(item => item.id === cartItemId);
        if (itemIndex !== -1) {
          cart[itemIndex].quantity = quantity;
          cart[itemIndex].updatedAt = new Date().toISOString();
        }
      }

      await this.saveCart(userId, cart);
      return cart;
    } catch (error) {
      console.error('Error updating cart item:', error);
      throw error;
    }
  }

  // Remove an item by id
  static async removeItem(userId: string, cartItemId: string): Promise<CartItem[]> {
    try {
      const cart = (await this.getCart(userId)).filter(item => item.id !== cartItemId);
      await this.saveCart(userId, cart);
      return cart;
    } catch (error) {
      console.error('Error removing cart item:', error);
      throw error;
    }
  }

  // Clear all cart items
  static async clearCart(userId: string): Promise<void> {
    try {
      await this.saveCart(userId, []);
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  }

  // Merge guest cart with user cart on login
  static async mergeGuestCart(userId: string, guestCartItems: CartItem[]): Promise<CartItem[]> {
    try {
      const existingCart = await this.getCart(userId);
      const mergedMap = new Map<string, CartItem>();

      // Add existing items to map
      existingCart.forEach(item => {
        const key = `${item.productId}-${item.variant || ''}`;
        mergedMap.set(key, item);
      });

      // Merge guest items
      guestCartItems.forEach(guestItem => {
        const key = `${guestItem.productId}-${guestItem.variant || ''}`;
        const existing = mergedMap.get(key);

        if (existing) {
          existing.quantity += guestItem.quantity;
          existing.updatedAt = new Date().toISOString();
        } else {
          const newItem: CartItem = {
            ...guestItem,
            id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            createdAt: new Date().toISOString()
          };
          mergedMap.set(key, newItem);
        }
      });

      const mergedCart = Array.from(mergedMap.values());
      await this.saveCart(userId, mergedCart);
      return mergedCart;
    } catch (error) {
      console.error('Error merging guest cart:', error);
      throw error;
    }
  }
}
