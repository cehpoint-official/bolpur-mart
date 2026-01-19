// lib/firebase-admin-services.ts
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { firebaseAdminApp } from './firebase-admin-config'

// Initialize services using the configured app if it exists
const adminAuth = firebaseAdminApp ? getAuth(firebaseAdminApp) : null
const adminFirestore = firebaseAdminApp ? getFirestore(firebaseAdminApp) : null
const adminStorage = firebaseAdminApp ? getStorage(firebaseAdminApp) : null

// Auth Service Functions
export class FirebaseAdminAuthService {
  static async verifyIdToken(token: string) {
    if (!adminAuth) throw new Error('Firebase Admin Auth not initialized');
    try {
      const decodedToken = await adminAuth!.verifyIdToken(token)
      return decodedToken
    } catch (error) {
      console.error('Token verification failed:', error)
      throw new Error('Invalid authentication token')
    }
  }

  static async createCustomToken(uid: string, additionalClaims?: object) {
    if (!adminAuth) throw new Error('Firebase Admin Auth not initialized');
    try {
      const customToken = await adminAuth!.createCustomToken(uid, additionalClaims)
      return customToken
    } catch (error) {
      console.error('Custom token creation failed:', error)
      throw error
    }
  }

  static async getUserById(uid: string) {
    if (!adminAuth) throw new Error('Firebase Admin Auth not initialized');
    try {
      const userRecord = await adminAuth!.getUser(uid)
      return userRecord
    } catch (error) {
      console.error('Get user failed:', error)
      throw error
    }
  }

  static async setCustomUserClaims(uid: string, customClaims: object) {
    if (!adminAuth) throw new Error('Firebase Admin Auth not initialized');
    try {
      await adminAuth!.setCustomUserClaims(uid, customClaims)
      return { success: true, message: 'Custom claims set successfully' }
    } catch (error) {
      console.error('Set custom claims failed:', error)
      throw error
    }
  }

  static async deleteUser(uid: string) {
    if (!adminAuth) throw new Error('Firebase Admin Auth not initialized');
    try {
      await adminAuth!.deleteUser(uid)
      return { success: true, message: 'User deleted successfully' }
    } catch (error) {
      console.error('Delete user failed:', error)
      throw error
    }
  }
}

// Firestore Service Functions
export class FirebaseAdminFirestoreService {
  static async getDocument(collection: string, documentId: string) {
    if (!adminFirestore) throw new Error('Firebase Admin Firestore not initialized');
    try {
      const docRef = adminFirestore!.collection(collection).doc(documentId)
      const docSnap = await docRef.get()

      if (docSnap.exists) {
        return { id: docSnap.id, ...docSnap.data() }
      } else {
        return null
      }
    } catch (error) {
      console.error('Get document failed:', error)
      throw error
    }
  }

  static async addDocument(collection: string, data: any) {
    if (!adminFirestore) throw new Error('Firebase Admin Firestore not initialized');
    try {
      const docRef = await adminFirestore!.collection(collection).add({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      return { id: docRef.id, ...data }
    } catch (error) {
      console.error('Add document failed:', error)
      throw error
    }
  }

  static async updateDocument(collection: string, documentId: string, data: any) {
    if (!adminFirestore) throw new Error('Firebase Admin Firestore not initialized');
    try {
      const docRef = adminFirestore!.collection(collection).doc(documentId)
      await docRef.update({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      return { success: true, message: 'Document updated successfully' }
    } catch (error) {
      console.error('Update document failed:', error)
      throw error
    }
  }

  static async deleteDocument(collection: string, documentId: string) {
    if (!adminFirestore) throw new Error('Firebase Admin Firestore not initialized');
    try {
      await adminFirestore!.collection(collection).doc(documentId).delete()
      return { success: true, message: 'Document deleted successfully' }
    } catch (error) {
      console.error('Delete document failed:', error)
      throw error
    }
  }

  static async getCollection(collection: string, filters?: any[]) {
    if (!adminFirestore) return [];
    try {
      let query: any = adminFirestore!.collection(collection)

      // Apply filters if provided
      if (filters && filters.length > 0) {
        filters.forEach(filter => {
          query = query.where(filter.field, filter.operator, filter.value)
        })
      }

      const querySnapshot = await query.get()
      const documents = querySnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }))

      return documents
    } catch (error) {
      console.error('Get collection failed:', error)
      throw error
    }
  }

  static async runTransaction(callback: (transaction: any) => Promise<any>) {
    if (!adminFirestore) throw new Error('Firebase Admin Firestore not initialized');
    try {
      return await adminFirestore!.runTransaction(callback)
    } catch (error) {
      console.error('Transaction failed:', error)
      throw error
    }
  }
}

// Utility Functions
export class FirebaseAdminUtilities {
  // Rate limiting helper
  private static userRequestCounts = new Map<string, { count: number; resetTime: number }>()

  static checkRateLimit(userId: string, maxRequests = 100, windowMs = 60000): boolean {
    const now = Date.now()
    const userLimit = this.userRequestCounts.get(userId)

    if (!userLimit || now > userLimit.resetTime) {
      this.userRequestCounts.set(userId, { count: 1, resetTime: now + windowMs })
      return true
    }

    if (userLimit.count >= maxRequests) {
      return false
    }

    userLimit.count++
    return true
  }

  // Batch operations
  static async batchWrite(operations: any[]) {
    if (!adminFirestore) throw new Error('Firebase Admin Firestore not initialized');
    try {
      const batch = adminFirestore!.batch()

      operations.forEach(operation => {
        switch (operation.type) {
          case 'set':
            batch.set(operation.ref, operation.data)
            break
          case 'update':
            batch.update(operation.ref, operation.data)
            break
          case 'delete':
            batch.delete(operation.ref)
            break
        }
      })

      await batch.commit()
      return { success: true, message: 'Batch operations completed' }
    } catch (error) {
      console.error('Batch write failed:', error)
      throw error
    }
  }

  // Server timestamp
  static getServerTimestamp() {
    return new Date().toISOString()
  }
}

// Export individual services for easy importing
export {
  adminAuth,
  adminFirestore,
  adminStorage
}
