import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser,
  UserCredential,
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  DocumentData
} from 'firebase/firestore';
import { auth, db } from './firebase-client';
import type { Address, CreateUser, User, PaymentMethod } from '@/types';
import type { AuthUser } from '@/types/auth';
import { TokenManager } from './auth/token-manager';

export class FirebaseAuthService {
  private static googleProvider = new GoogleAuthProvider()

  // Helper function to convert Firebase user to AuthUser
  private static async convertToAuthUser(user: FirebaseUser | null): Promise<AuthUser | null> {
    if (!user || !db) return null

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const customData = userDoc.exists() ? (userDoc.data() as User) : null

      return {
        ...user,
        customData
      } as AuthUser
    } catch (error) {
      console.error('Error converting to AuthUser:', error)
      return {
        ...user,
        customData: null
      } as AuthUser
    }
  }

  // Email/Password Sign In
  static async signInWithEmailPassword(email: string, password: string): Promise<UserCredential> {
    if (!auth || !db) throw new Error('Authentication service is currently unavailable. Please check your connection or contact support.');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)

      // Get ID token for API authentication
      const idToken = await userCredential.user.getIdToken()

      // Store token
      TokenManager.setToken(idToken)

      // Update last login time ONLY
      const userDocRef = doc(db, 'users', userCredential.user.uid)
      await updateDoc(userDocRef, {
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).catch(() => {
        // Ignore error if user document doesn't exist yet
      })

      return userCredential
    } catch (error: any) {
      console.error('Sign in error:', error)
      throw new Error(this.getAuthErrorMessage(error.code))
    }
  }

  // Email/Password Sign Up
  static async signUpWithEmailPassword(
    email: string,
    password: string,
    name: string
  ): Promise<UserCredential> {
    if (!auth || !db) throw new Error('Authentication service is currently unavailable. Please check your connection or contact support.');
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Update profile with name
      await updateProfile(user, { displayName: name })

      // Send email verification
      await sendEmailVerification(user)

      // Create user document in Firestore
      const userData: CreateUser = {
        email: user.email!,
        name: name,
        phone: '',
        avatar: '',
        addresses: [],
        payments: [],
        cart: [],
        preferences: {
          notifications: true,
          theme: 'light',
          language: 'en',
          currency: 'INR'
        }
      }

      await setDoc(doc(db, 'users', user.uid), {
        ...userData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        emailVerified: false,
        profileCompleted: false,
        authProvider: 'email'
      })

      // Get ID token
      const idToken = await user.getIdToken()
      TokenManager.setToken(idToken)

      return userCredential
    } catch (error: any) {
      console.error('Sign up error:', error)
      throw new Error(this.getAuthErrorMessage(error.code))
    }
  }

  // Google Sign In - Preserves User Customizations
  static async signInWithGoogle(): Promise<UserCredential> {
    if (!auth || !db) throw new Error('Authentication service is currently unavailable. Please check your connection or contact support.');
    try {
      this.googleProvider.setCustomParameters({
        prompt: 'select_account'
      })

      const userCredential = await signInWithPopup(auth, this.googleProvider)
      const user = userCredential.user

      // Check if user document exists
      const userDocRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userDocRef)

      const currentTime = new Date().toISOString()

      if (!userDoc.exists()) {
        // Create new user document for Google user (first time only)
        const userData: CreateUser = {
          email: user.email!,
          name: user.displayName || '',
          phone: '',
          avatar: user.photoURL || '',
          addresses: [],
          payments: [],
          cart: [],
          preferences: {
            notifications: true,
            theme: 'light',
            language: 'en',
            currency: 'INR'
          }
        }

        await setDoc(userDocRef, {
          ...userData,
          createdAt: currentTime,
          updatedAt: currentTime,
          lastLoginAt: currentTime,
          emailVerified: user.emailVerified,
          profileCompleted: false,
          authProvider: 'google'
        })

        console.log(' Created new Google user document')
      } else {
        // FIXED: For existing users, preserve ALL customizations
        const existingData = userDoc.data()

        // Only update essential login-related fields
        const updateData: any = {
          updatedAt: currentTime,
          lastLoginAt: currentTime,
          emailVerified: user.emailVerified
        }

        // Only update email if it has changed (very rare)
        if (user.email && user.email !== existingData?.email) {
          updateData.email = user.email
        }

        // PRESERVE: avatar, name, phone, preferences, addresses
        // These should NEVER be overwritten on login

        await updateDoc(userDocRef, updateData)
        console.log(' Updated existing user login data (preserved customizations)')
      }

      // Get ID token
      const idToken = await user.getIdToken()
      TokenManager.setToken(idToken)

      return userCredential
    } catch (error: any) {
      console.error('Google sign in error:', error)
      throw new Error(this.getAuthErrorMessage(error.code))
    }
  }

  // Sign Out
  static async signOut(): Promise<void> {
    if (!auth) return;
    try {
      // Update last logout time before signing out
      if (auth.currentUser && db) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid)
        await updateDoc(userDocRef, {
          lastLogoutAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).catch(() => {
          // Ignore error if user document doesn't exist
        })
      }

      if (auth) await signOut(auth)
      TokenManager.clearAuthData()
    } catch (error: any) {
      console.error('Sign out error:', error)
      throw new Error('Failed to sign out. Please try again.')
    }
  }

  // Get current user with custom data
  static async getCurrentUserWithData(): Promise<AuthUser | null> {
    if (!auth) return null
    const user = auth.currentUser
    if (!user) return null

    return await this.convertToAuthUser(user)
  }

  // Auth state listener
  static onAuthStateChanged(callback: (user: AuthUser | null) => void) {
    if (!auth) {
      callback(null);
      return () => { };
    }
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Refresh token if needed
          if (TokenManager.needsRefresh()) {
            const newToken = await user.getIdToken(true)
            TokenManager.setToken(newToken)
          }

          // Update last activity
          TokenManager.updateLastActivity()

          // Get user with custom data and convert to AuthUser
          const authUser = await this.convertToAuthUser(user)
          callback(authUser)
        } catch (error) {
          console.error('Error in auth state change:', error)
          // Fallback: create AuthUser with null customData
          const authUser: AuthUser = {
            ...user,
            customData: null
          }
          callback(authUser)
        }
      } else {
        callback(null)
      }
    })
  }

  // Update user profile
  static async updateUserProfile(updates: Record<string, any>): Promise<void> {
    const user = auth.currentUser
    if (!user) throw new Error('No authenticated user')

    try {
      const userDocRef = doc(db, 'users', user.uid)

      // Update Firebase Auth profile if displayName is being changed
      if (updates.name && updates.name !== user.displayName) {
        await updateProfile(user, { displayName: updates.name })
      }

      // Create update data with all provided fields plus system fields
      const updateData = {
        ...updates,  // Accept any and all fields from updates
        updatedAt: new Date().toISOString(),
        profileCompleted: true
      }

      // Update Firestore document with all provided data
      await updateDoc(userDocRef, updateData)


    } catch (error: any) {
      console.error(' Update profile error:', error)
      throw new Error('Failed to update profile. Please try again.')
    }
  }

  // ADDRESS MANAGEMENT METHODS

  // Add new address to user's addresses array
  static async addAddress(addressData: Omit<Address, 'id'>): Promise<void> {
    const user = auth.currentUser
    if (!user) throw new Error('No authenticated user')

    try {
      const userDocRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userDocRef)

      if (!userDoc.exists()) {
        throw new Error('User document not found')
      }

      const userData = userDoc.data() as User
      const currentAddresses = userData.addresses || []

      // Generate new address ID
      const newAddressId = Date.now().toString()

      // If this is the first address or explicitly set as default, make it default
      const isFirstAddress = currentAddresses.length === 0
      const shouldBeDefault = isFirstAddress || addressData.isDefault

      // If setting as default, clear other defaults
      let updatedAddresses = currentAddresses
      if (shouldBeDefault) {
        updatedAddresses = currentAddresses.map(addr => ({
          ...addr,
          isDefault: false
        }))
      }

      // Add new address
      const newAddress: Address = {
        ...addressData,
        id: newAddressId,
        isDefault: shouldBeDefault
      }

      updatedAddresses.push(newAddress)

      // Update user document
      await updateDoc(userDocRef, {
        addresses: updatedAddresses,
        updatedAt: new Date().toISOString()
      })

    } catch (error: any) {
      console.error(' Add address error:', error)
      throw new Error('Failed to add address. Please try again.')
    }
  }

  // Update existing address
  static async updateAddress(addressId: string, updates: Partial<Address>): Promise<void> {
    const user = auth.currentUser
    if (!user) throw new Error('No authenticated user')

    try {
      const userDocRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userDocRef)

      if (!userDoc.exists()) {
        throw new Error('User document not found')
      }

      const userData = userDoc.data() as User
      const currentAddresses = userData.addresses || []

      // Find address index
      const addressIndex = currentAddresses.findIndex(addr => addr.id === addressId)
      if (addressIndex === -1) {
        throw new Error('Address not found')
      }

      let updatedAddresses = [...currentAddresses]

      // If setting as default, clear other defaults first
      if (updates.isDefault === true) {
        updatedAddresses = updatedAddresses.map(addr => ({
          ...addr,
          isDefault: false
        }))
      }

      // Update the specific address
      updatedAddresses[addressIndex] = {
        ...updatedAddresses[addressIndex],
        ...updates
      }

      // Update user document
      await updateDoc(userDocRef, {
        addresses: updatedAddresses,
        updatedAt: new Date().toISOString()
      })

    } catch (error: any) {
      console.error(' Update address error:', error)
      throw new Error('Failed to update address. Please try again.')
    }
  }

  // Delete address
  static async deleteAddress(addressId: string): Promise<void> {
    const user = auth.currentUser
    if (!user) throw new Error('No authenticated user')

    try {
      const userDocRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userDocRef)

      if (!userDoc.exists()) {
        throw new Error('User document not found')
      }

      const userData = userDoc.data() as User
      const currentAddresses = userData.addresses || []

      // Find the address to delete
      const addressToDelete = currentAddresses.find(addr => addr.id === addressId)
      if (!addressToDelete) {
        throw new Error('Address not found')
      }

      // Remove the address
      let updatedAddresses = currentAddresses.filter(addr => addr.id !== addressId)

      // If deleted address was default and there are remaining addresses, set first one as default
      if (addressToDelete.isDefault && updatedAddresses.length > 0) {
        updatedAddresses[0].isDefault = true
      }

      // Update user document
      await updateDoc(userDocRef, {
        addresses: updatedAddresses,
        updatedAt: new Date().toISOString()
      })

    } catch (error: any) {
      console.error(' Delete address error:', error)
      throw new Error('Failed to delete address. Please try again.')
    }
  }

  // Set default address
  static async setDefaultAddress(addressId: string): Promise<void> {
    const user = auth.currentUser
    if (!user) throw new Error('No authenticated user')

    try {
      const userDocRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userDocRef)

      if (!userDoc.exists()) {
        throw new Error('User document not found')
      }

      const userData = userDoc.data() as User
      const currentAddresses = userData.addresses || []

      // Find the address to set as default
      const addressIndex = currentAddresses.findIndex(addr => addr.id === addressId)
      if (addressIndex === -1) {
        throw new Error('Address not found')
      }

      // Update all addresses: clear defaults and set the selected one
      const updatedAddresses = currentAddresses.map(addr => ({
        ...addr,
        isDefault: addr.id === addressId
      }))

      // Update user document
      await updateDoc(userDocRef, {
        addresses: updatedAddresses,
        updatedAt: new Date().toISOString()
      })

    } catch (error: any) {
      console.error(' Set default address error:', error)
      throw new Error('Failed to set default address. Please try again.')
    }
  }

  // Get user addresses (helper method)
  static async getUserAddresses(): Promise<Address[]> {
    const user = auth.currentUser
    if (!user) return []

    try {
      const userDocRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userDocRef)

      if (!userDoc.exists()) {
        return []
      }

      const userData = userDoc.data() as User
      return userData.addresses || []
    } catch (error: any) {
      console.error(' Get addresses error:', error)
      return []
    }

  }

  // Get Current User's Payment Methods Array
  static async getPaymentMethods(): Promise<PaymentMethod[]> {
    const user = auth.currentUser;
    if (!user) return [];
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) return [];
    const userData = userDoc.data() as User;
    return userData.payments || [];
  }

  // Add New Payment Method
  static async addPaymentMethod(newPayment: Omit<PaymentMethod, 'id' | 'lastUsed'> & { isDefault?: boolean }): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) throw new Error('User not found');
    const userData = userDoc.data() as User;
    const payments: PaymentMethod[] = userData.payments || [];
    const id = `${Date.now()}`;
    // Only allow one default; if new is default, clear others
    let updatedPayments = payments.map(p => ({ ...p, isDefault: false }));
    const isDefault = payments.length === 0 || newPayment.isDefault;
    updatedPayments.push({ ...newPayment, id, isDefault, lastUsed: new Date().toISOString().split("T")[0] });
    await updateDoc(userDocRef, { payments: updatedPayments, updatedAt: new Date().toISOString() });
  }

  // Update Existing Payment Method
  static async updatePaymentMethod(paymentId: string, updates: Partial<PaymentMethod>): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) throw new Error('User not found');
    const userData = userDoc.data() as User;
    let payments: PaymentMethod[] = userData.payments || [];

    // If updates.makeDefault, set all others to isDefault=false
    if (updates.isDefault) {
      payments = payments.map(pm => ({ ...pm, isDefault: false }));
    }
    payments = payments.map(pm =>
      pm.id === paymentId
        ? { ...pm, ...updates, lastUsed: new Date().toISOString().split("T")[0] }
        : pm
    );
    await updateDoc(userDocRef, { payments, updatedAt: new Date().toISOString() });
  }

  // Delete Payment Method
  static async deletePaymentMethod(paymentId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) throw new Error('User not found');
    const userData = userDoc.data() as User;
    let payments: PaymentMethod[] = userData.payments || [];

    const wasDefault = payments.find(pm => pm.id === paymentId)?.isDefault;
    payments = payments.filter(pm => pm.id !== paymentId);

    if (wasDefault && payments.length > 0) payments[0].isDefault = true;
    await updateDoc(userDocRef, { payments, updatedAt: new Date().toISOString() });
  }

  // Set Default Payment Method
  static async setDefaultPayment(paymentId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) throw new Error('User not found');
    let payments: PaymentMethod[] = (userDoc.data() as User).payments || [];
    payments = payments.map(pm => ({ ...pm, isDefault: pm.id === paymentId }));
    await updateDoc(userDocRef, { payments, updatedAt: new Date().toISOString() });
  }
  // Get auth error messages
  private static getAuthErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email address.'
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.'
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.'
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password.'
      case 'auth/invalid-email':
        return 'Please enter a valid email address.'
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.'
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.'
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled. Please try again.'
      case 'auth/popup-blocked':
        return 'Popup was blocked. Please allow popups and try again.'
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using a different sign-in method.'
      case 'auth/invalid-credential':
        return 'The provided credentials are invalid or have expired.'
      default:
        return 'An error occurred during authentication. Please try again.'
    }
  }
}
