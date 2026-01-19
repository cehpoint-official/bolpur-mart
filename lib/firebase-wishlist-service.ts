// lib/firebase-wishlist-service.ts
import { collection, query, where, getDocs, deleteDoc, addDoc } from "firebase/firestore";
import { db } from './firebase-client';
import type { WishlistItem, Product } from "@/types";
import { FirebaseProductService } from "./firebase-products";

export class FirebaseWishlistService {
  private static collection = 'wishlists';

  // Add item to wishlist
  static async addToWishlist(userId: string, productId: string): Promise<void> {
    if (!db) return;
    try {
      const wishlistRef = collection(db, this.collection);
      const q = query(wishlistRef, where('userId', '==', userId), where('productId', '==', productId));
      const querySnapshot = await getDocs(q);

      // Check if item already exists
      if (!querySnapshot.empty) {
        return; // Already in wishlist
      }

      // Add to wishlist
      await addDoc(wishlistRef, {
        userId,
        productId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      throw error;
    }
  }

  // Remove item from wishlist
  static async removeFromWishlist(userId: string, productId: string): Promise<void> {
    if (!db) return;
    try {
      const wishlistRef = collection(db, this.collection);
      const q = query(wishlistRef, where('userId', '==', userId), where('productId', '==', productId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docToDelete = querySnapshot.docs[0];
        await deleteDoc(docToDelete.ref);
      }
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      throw error;
    }
  }

  // Check if item is in wishlist
  static async isInWishlist(userId: string, productId: string): Promise<boolean> {
    if (!db) return false;
    try {
      const wishlistRef = collection(db, this.collection);
      const q = query(wishlistRef, where('userId', '==', userId), where('productId', '==', productId));
      const querySnapshot = await getDocs(q);

      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking wishlist:', error);
      return false;
    }
  }

  // Get user's wishlist items
  static async getUserWishlist(userId: string): Promise<WishlistItem[]> {
    if (!db) return [];
    try {
      const wishlistRef = collection(db, this.collection);
      const q = query(wishlistRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);

      const wishlistItems: WishlistItem[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        wishlistItems.push({
          id: doc.id,
          userId: data.userId,
          productId: data.productId,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });

      return wishlistItems.sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      return [];
    }
  }

  // Get wishlist with product details
  static async getWishlistWithProducts(userId: string): Promise<Product[]> {
    try {
      const wishlistItems = await this.getUserWishlist(userId);

      if (wishlistItems.length === 0) return [];

      // Fetch product details for each wishlist item
      const productPromises = wishlistItems.map(item =>
        FirebaseProductService.getProductById(item.productId)
      );

      const products = await Promise.all(productPromises);

      // Filter out null products and return only valid ones
      return products.filter((product): product is Product => product !== null);
    } catch (error) {
      console.error('Error fetching wishlist with products:', error);
      return [];
    }
  }

  // Clear entire wishlist
  static async clearWishlist(userId: string): Promise<void> {
    if (!db) return;
    try {
      const wishlistRef = collection(db, this.collection);
      const q = query(wishlistRef, where('userId', '==', userId));
      const querySnapshot = await getDocs(q);

      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error clearing wishlist:', error);
      throw error;
    }
  }
}
