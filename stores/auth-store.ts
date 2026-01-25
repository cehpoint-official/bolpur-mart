// stores/auth-store.ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { FirebaseAuthService } from "@/lib/firebase-services";
import { TokenManager } from "@/lib/auth/token-manager";
import {
  validateEmail,
  validatePassword,
  validateName,
  validateConfirmPassword,
  validateTerms,
  validateSigninFormData,
  validateSignupFormData,
} from "@/lib/validations/auth-validation";
import type {
  AuthStore,
  SigninFormData,
  SignupFormData,
  FormErrors,
  AuthUser,
} from "@/types/auth";
import { toast } from "@/hooks/use-toast";

const initialSigninForm: SigninFormData = {
  email: "",
  password: "",
  rememberMe: false,
};

const initialSignupForm: SignupFormData = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
};

const initialFormErrors: FormErrors = {};

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: false, // Changed from true to false initially
        currentTab: "signin",
        signinForm: initialSigninForm,
        signupForm: initialSignupForm,
        isSigningIn: false,
        isSigningUp: false,
        isGoogleAuth: false,
        isSigningOut: false,
        signinErrors: initialFormErrors,
        signupErrors: initialFormErrors,
        generalError: null,

        // User actions
        setUser: (user: AuthUser | null) => {
          set({
            user,
            isAuthenticated: !!user,
            isLoading: false,
          });

          if (user) {
            TokenManager.setUserData(user.customData);
          }
        },

        signin: async (
          email: string,
          password: string,
          rememberMe: boolean = false
        ) => {
          set({ isSigningIn: true, signinErrors: {}, generalError: null });

          try {
            const userCredential =
              await FirebaseAuthService.signInWithEmailPassword(
                email,
                password
              );
            const userWithData =
              await FirebaseAuthService.getCurrentUserWithData();

            // Store token with appropriate expiry
            const token = await userCredential.user.getIdToken();
            TokenManager.setToken(token, rememberMe);

            set({
              user: userWithData,
              isAuthenticated: true,
              isSigningIn: false,
              signinForm: initialSigninForm,
            });

            toast({
              title: "Welcome back!",
              description: "You have successfully signed in.",
            });
          } catch (error: any) {
            set({
              isSigningIn: false,
              generalError: error.message,
              signinErrors: { general: error.message },
            });

            toast({
              title: "Sign in failed",
              description: error.message,
              variant: "destructive",
            });
            throw error;
          }
        },

        signup: async (formData: Omit<SignupFormData, "confirmPassword">) => {
          set({ isSigningUp: true, signupErrors: {}, generalError: null });

          try {
            const userCredential =
              await FirebaseAuthService.signUpWithEmailPassword(
                formData.email,
                formData.password,
                formData.name
              );

            const userWithData =
              await FirebaseAuthService.getCurrentUserWithData();

            set({
              user: userWithData,
              isAuthenticated: true,
              isSigningUp: false,
              signupForm: initialSignupForm,
            });

            toast({
              title: "Account created!",
              description:
                "Welcome to Bolpur Mart. Please check your email to verify your account.",
            });
          } catch (error: any) {
            set({
              isSigningUp: false,
              generalError: error.message,
              signupErrors: { general: error.message },
            });

            toast({
              title: "Sign up failed",
              description: error.message,
              variant: "destructive",
            });
            throw error;
          }
        },

        googleAuth: async () => {
          set({ isGoogleAuth: true, generalError: null });

          try {
            const userCredential = await FirebaseAuthService.signInWithGoogle();
            const userWithData =
              await FirebaseAuthService.getCurrentUserWithData();

            set({
              user: userWithData,
              isAuthenticated: true,
              isGoogleAuth: false,
            });

            toast({
              title: "Welcome!",
              description: "You have successfully signed in with Google.",
            });
          } catch (error: any) {
            set({
              isGoogleAuth: false,
              generalError: error.message,
            });

            if (!error.message.includes("cancelled")) {
              toast({
                title: "Google sign in failed",
                description: error.message,
                variant: "destructive",
              });
            }
            throw error;
          }
        },

        signOut: async () => {
          set({ isSigningOut: true });

          try {
            await FirebaseAuthService.signOut();

            set({
              user: null,
              isAuthenticated: false,
              isSigningOut: false,
              signinForm: initialSigninForm,
              signupForm: initialSignupForm,
              signinErrors: {},
              signupErrors: {},
              generalError: null,
            });

            toast({
              title: "Signed out",
              description: "You have been successfully signed out.",
            });
          } catch (error: any) {
            set({ isSigningOut: false });

            toast({
              title: "Sign out failed",
              description: error.message,
              variant: "destructive",
            });
            throw error;
          }
        },

        // Form actions
        setCurrentTab: (tab: "signin" | "signup") => {
          set({
            currentTab: tab,
            signinErrors: {},
            signupErrors: {},
            generalError: null,
          });
        },
        updateUserData: (userData: any) => {
          const currentUser = get().user;
          if (currentUser) {
            set({
              user: {
                ...currentUser,
                customData: {
                  ...currentUser.customData,
                  ...userData,
                },
              },
            });
          }
        },
        updateSigninForm: (field: keyof SigninFormData, value: any) => {
          set((state) => ({
            signinForm: { ...state.signinForm, [field]: value },
            signinErrors: { ...state.signinErrors, [field]: undefined },
          }));
        },

        updateSignupForm: (field: keyof SignupFormData, value: any) => {
          set((state) => ({
            signupForm: { ...state.signupForm, [field]: value },
            signupErrors: { ...state.signupErrors, [field]: undefined },
          }));
        },

        // Error actions
        setSigninErrors: (errors: FormErrors) => {
          set({ signinErrors: errors });
        },

        setSignupErrors: (errors: FormErrors) => {
          set({ signupErrors: errors });
        },

        setGeneralError: (error: string | null) => {
          set({ generalError: error });
        },

        clearErrors: () => {
          set({
            signinErrors: {},
            signupErrors: {},
            generalError: null,
          });
        },

        clearForms: () => {
          set({
            signinForm: initialSigninForm,
            signupForm: initialSignupForm,
            signinErrors: {},
            signupErrors: {},
            generalError: null,
          });
        },

        // Validation methods
        validateSigninForm: () => {
          const { signinForm } = get();
          const errors = validateSigninFormData(signinForm);

          set({ signinErrors: errors });
          return Object.keys(errors).length === 0;
        },

        validateSignupForm: () => {
          const { signupForm } = get();
          const errors = validateSignupFormData(signupForm);

          set({ signupErrors: errors });
          return Object.keys(errors).length === 0;
        },

        // Real-time field validation methods
        validateSigninField: (field: keyof SigninFormData, value: any) => {
          const state = get();
          let error: string | null = null;

          switch (field) {
            case "email":
              error = validateEmail(value);
              break;
            case "password":
              if (!value) error = "Password is required";
              break;
          }

          set({
            signinErrors: {
              ...state.signinErrors,
              [field]: error || undefined,
            },
          });

          return !error;
        },

        validateSignupField: (field: keyof SignupFormData, value: any) => {
          const state = get();
          let error: string | null = null;

          switch (field) {
            case "name":
              error = validateName(value);
              break;
            case "email":
              error = validateEmail(value);
              break;
            case "password":
              error = validatePassword(value);
              break;
            case "confirmPassword":
              error = validateConfirmPassword(state.signupForm.password, value);
              break;
            case "acceptTerms":
              error = validateTerms(value);
              break;
          }

          set({
            signupErrors: {
              ...state.signupErrors,
              [field]: error || undefined,
            },
          });

          return !error;
        },
      }),
      {
        name: "bolpur-mart-auth",
        partialize: (state) => ({
          // Only persist UI/form state, not the auth user object itself
          currentTab: state.currentTab,
        }),
      }
    ),
    { name: "AuthStore" }
  )
);

// Initialize auth state on app load
export const initializeAuth = () => {
  // Set loading state initially
  useAuthStore.setState({ isLoading: true });

  const unsubscribe = FirebaseAuthService.onAuthStateChanged((user) => {
    useAuthStore.getState().setUser(user);
  });

  return unsubscribe;
};
