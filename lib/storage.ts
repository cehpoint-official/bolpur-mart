import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  DocumentReference,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import type {
  User,
  InsertUser,
  Category,
  InsertCategory,
  Product,
  InsertProduct,
  CartItem,
  InsertCartItem,
  Order,
  InsertOrder,
  WishlistItem,
  InsertWishlistItem,
  Recommendation,
  InsertRecommendation,
  TimeSlotType,
} from '@/shared/schema';
import * as schema from '@/shared/schema';

function toEntity<T>(ref: DocumentReference<DocumentData>, data: DocumentData): T & { id: string } {
  return { id: ref.id, ...(data as T) } as T & { id: string };
}

async function getDocData<T>(ref: DocumentReference<DocumentData>): Promise<(T & { id: string }) | undefined> {
  if (!db) return undefined;
  const snap = await getDoc(ref);
  if (!snap.exists()) return undefined;
  return { id: snap.id, ...(snap.data() as T) } as T & { id: string };
}

async function getQueryDocs<T>(q: any): Promise<(T & { id: string })[]> {
  if (!db) return [];
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as T) })) as (T & { id: string })[];
}

class Storage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    if (!db) return undefined;
    const snap = await getDoc(doc(db, "users", id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as User) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!db) return undefined;
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) return undefined;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as User;
  }

  async createUser(user: InsertUser): Promise<User> {
    if (!db) throw new Error("Database not initialized");
    const ref = await addDoc(collection(db, "users"), user);
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as User;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    if (!db) return undefined;
    const ref = doc(db, "users", id);
    await updateDoc(ref, updates);
    const snap = await getDoc(ref);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as User) : undefined;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    const snap = await getDocs(query(collection(db, "categories"), orderBy("sortOrder")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Category));

  }

  async getCategoriesByTimeSlot(timeSlot: TimeSlotType): Promise<Category[]> {
    const q = query(collection(db, "categories"), where("isActive", "==", true));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Category))
      .filter(c => (c.timeSlots as string[])?.includes(timeSlot));
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const snap = await getDoc(doc(db, "categories", id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Category) : undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const ref = await addDoc(collection(db, "categories"), category);
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as Category;
  }

  // Products
  async getProducts(): Promise<Product[]> {
    const q = query(collection(db, "products"), where("isActive", "==", true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const q = query(
      collection(db, "products"),
      where("categoryId", "==", categoryId),
      where("isActive", "==", true)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  }

  async getProductsByTimeSlot(timeSlot: TimeSlotType): Promise<Product[]> {
    const categories = await this.getCategoriesByTimeSlot(timeSlot);
    const categoryIds = categories.map(c => c.id);
    if (!categoryIds.length) return [];

    const allProducts: Product[] = [];
    for (const id of categoryIds) {
      const q = query(
        collection(db, "products"),
        where("categoryId", "==", id),
        where("isActive", "==", true)
      );
      const snap = await getDocs(q);
      snap.docs.forEach(d => allProducts.push({ id: d.id, ...d.data() } as Product));
    }
    return allProducts;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const snap = await getDoc(doc(db, "products", id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Product) : undefined;
  }

  async searchProducts(queryText: string): Promise<Product[]> {
    const q = query(collection(db, "products"), where("isActive", "==", true));
    const snap = await getDocs(q);
    const text = queryText.toLowerCase();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Product))
      .filter(
        p =>
          p.name.toLowerCase().includes(text) ||
          p.description?.toLowerCase().includes(text)
      );
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const ref = await addDoc(collection(db, "products"), product);
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as Product;
  }

  // Cart
  async getCartItems(userId: string): Promise<CartItem[]> {
    const q = query(collection(db, "cart"), where("userId", "==", userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CartItem));
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    const q = query(
      collection(db, "cart"),
      where("userId", "==", item.userId),
      where("productId", "==", item.productId)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const docRef = snap.docs[0].ref;
      const existing = snap.docs[0].data() as CartItem;
      const newQuantity = existing.quantity + (item.quantity || 1);
      await updateDoc(docRef, { quantity: newQuantity });
      const updated = await getDoc(docRef);
      return { id: updated.id, ...updated.data() } as CartItem;
    }

    const ref = await addDoc(collection(db, "cart"), item);
    const newSnap = await getDoc(ref);
    return { id: newSnap.id, ...newSnap.data() } as CartItem;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const ref = doc(db, "cart", id);
    if (quantity <= 0) {
      await deleteDoc(ref);
      return undefined;
    }
    await updateDoc(ref, { quantity });
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as CartItem;
  }

  async removeFromCart(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, "cart", id));
      return true;
    } catch (error) {
      return false;
    }
  }

  async clearCart(userId: string): Promise<boolean> {
    try {
      const q = query(collection(db, "cart"), where("userId", "==", userId));
      const snap = await getDocs(q);
      for (const d of snap.docs) await deleteDoc(d.ref);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Orders
  async getOrders(userId: string): Promise<Order[]> {
    const q = query(collection(db, "orders"), where("userId", "==", userId), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));

  }

  async getOrder(id: string): Promise<Order | undefined> {
    const snap = await getDoc(doc(db, "orders", id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : undefined;

  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const ref = await addDoc(collection(db, "orders"), order);
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as Order;

  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const ref = doc(db, "orders", id);
    await updateDoc(ref, { status });
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as Order;
  }

  // Wishlist
  async getWishlistItems(userId: string): Promise<WishlistItem[]> {
    const q = query(collection(db, "wishlists"), where("userId", "==", userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as WishlistItem));

  }

  async addToWishlist(item: InsertWishlistItem): Promise<WishlistItem> {
    const q = query(
      collection(db, "wishlists"),
      where("userId", "==", item.userId),
      where("productId", "==", item.productId)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as WishlistItem;
    }

    const ref = await addDoc(collection(db, "wishlists"), item);
    const newSnap = await getDoc(ref);
    return { id: newSnap.id, ...newSnap.data() } as WishlistItem;

  }

  async removeFromWishlist(userId: string, productId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, "wishlists"),
        where("userId", "==", userId),
        where("productId", "==", productId)
      );

      const snap = await getDocs(q);

      if (snap.empty) return false;

      for (const docRef of snap.docs) {
        await deleteDoc(docRef.ref);
      }

      return true;
    } catch {
      return false;
    }
  }

  // async removeFromWishlist(id: string): Promise<boolean> {
  //   try {
  //     await deleteDoc(doc(db, "wishlists", id));
  //     return true;
  //   } catch (error) {
  //     return false;
  //   }
  // }

  async clearWishlist(userId: string): Promise<boolean> {
    try {
      const q = query(collection(db, "wishlists"), where("userId", "==", userId));
      const snap = await getDocs(q);
      for (const d of snap.docs) await deleteDoc(d.ref);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Recommendations
  async getRecommendations(userId: string): Promise<Recommendation[]> {
    const q = query(collection(db, "recommendations"), where("userId", "==", userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Recommendation));

  }

  async saveRecommendation(recommendation: InsertRecommendation): Promise<Recommendation> {
    const ref = await addDoc(collection(db, "recommendations"), recommendation);
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as Recommendation;

  }

  async clearRecommendations(userId: string): Promise<boolean> {
    const q = query(collection(db, "recommendations"), where("userId", "==", userId));
    const snap = await getDocs(q);
    for (const d of snap.docs) await deleteDoc(d.ref);
    return true;
  }
}

export const storage = new Storage();