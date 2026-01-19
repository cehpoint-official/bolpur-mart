"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function AuthTabs() {
  const router = useRouter();
  const {
    // State
    user,
    isAuthenticated,
    isLoading,
    currentTab,
    signinForm,
    signupForm,
    signinErrors,
    signupErrors,
    generalError,

    // Loading states
    isSigningIn,
    isSigningUp,
    isGoogleAuth,

    // Actions
    signin,
    signup,
    googleAuth,
    setCurrentTab,
    updateSigninForm,
    updateSignupForm,
    validateSigninField,
    validateSignupField,
    validateSigninForm,
    validateSignupForm,
    clearErrors,
  } = useAuth();

  // Redirect authenticated users to root page
  useEffect(() => {
    // Don't redirect while still loading auth state
    if (isLoading) return;

    // If authenticated, always redirect to root page
    if (isAuthenticated && user) {
      router.replace('/'); // Always redirect to root page
    }
    // If not authenticated, stay on auth page (no redirection)
  }, [isAuthenticated, user, isLoading, router]);

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render auth form if authenticated (will redirect)
  if (isAuthenticated) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Handle form submissions
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!validateSigninForm()) {
      return;
    }

    try {
      await signin(
        signinForm.email,
        signinForm.password,
        signinForm.rememberMe
      );
      // No manual redirect needed - useEffect will handle it
    } catch (error) {
      // Error handling is done in the store
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!validateSignupForm()) {
      return;
    }

    try {
      await signup({
        name: signupForm.name,
        email: signupForm.email,
        password: signupForm.password,
        acceptTerms: signupForm.acceptTerms,
      });
      // No manual redirect needed - useEffect will handle it
    } catch (error) {
      // Error handling is done in the store
    }
  };

  const handleGoogleAuth = async () => {
    try {
      await googleAuth();
      // No manual redirect needed - useEffect will handle it
    } catch (error) {
      // Error handling is done in the store
    }
  };

  // Real-time field validation
  const handleSigninFieldChange = (field: keyof typeof signinForm, value: any) => {
    updateSigninForm(field, value);

    // Validate on blur for better UX
    setTimeout(() => {
      validateSigninField(field, value);
    }, 500);
  };

  const handleSignupFieldChange = (field: keyof typeof signupForm, value: any) => {
    updateSignupForm(field, value);

    // Validate on blur for better UX
    setTimeout(() => {
      validateSignupField(field, value);
    }, 500);
  };

  return (
    <div className="w-full">
      <Tabs
        value={currentTab}
        onValueChange={(value) => setCurrentTab(value as 'signin' | 'signup')}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 mb-8 bg-gray-100">
          <TabsTrigger
            value="signin"
            className="data-[state=active]:bg-black data-[state=active]:text-white font-medium"
          >
            Sign In
          </TabsTrigger>
          <TabsTrigger
            value="signup"
            className="data-[state=active]:bg-black data-[state=active]:text-white font-medium"
          >
            Sign Up
          </TabsTrigger>
        </TabsList>

        {/* Sign In Tab */}
        <TabsContent value="signin" className="space-y-6">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold text-center text-card-foreground">
                Welcome back
              </CardTitle>
              <CardDescription className="text-center text-muted-foreground">
                Sign in to your account to continue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignIn} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="signin-email"
                    className="text-sm font-medium text-foreground"
                  >
                    Email
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signinForm.email}
                    onChange={(e) => handleSigninFieldChange('email', e.target.value)}
                    onBlur={(e) => validateSigninField('email', e.target.value)}
                    className={`h-12 bg-input border-border focus:ring-ring text-foreground placeholder:text-muted-foreground ${signinErrors.email ? 'border-red-500 focus:ring-red-500' : ''
                      }`}
                    autoComplete="email"
                    disabled={isSigningIn}
                  />
                  {signinErrors.email && (
                    <p className="text-sm text-red-500 mt-1">{signinErrors.email}</p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="signin-password"
                    className="text-sm font-medium text-foreground"
                  >
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={signinForm.password}
                      onChange={(e) => handleSigninFieldChange('password', e.target.value)}
                      onBlur={(e) => validateSigninField('password', e.target.value)}
                      className={`h-12 bg-input border-border focus:ring-ring pr-10 text-foreground placeholder:text-muted-foreground ${signinErrors.password ? 'border-red-500 focus:ring-red-500' : ''
                        }`}
                      autoComplete="current-password"
                      disabled={isSigningIn}
                    />
                  </div>
                  {signinErrors.password && (
                    <p className="text-sm text-red-500 mt-1">{signinErrors.password}</p>
                  )}
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={signinForm.rememberMe}
                      onCheckedChange={(checked) =>
                        handleSigninFieldChange('rememberMe', checked)
                      }
                      disabled={isSigningIn}
                    />
                    <Label
                      htmlFor="remember"
                      className="text-sm text-muted-foreground"
                    >
                      Remember me
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 text-sm text-muted-foreground hover:text-foreground"
                    disabled={isSigningIn}
                  >
                    Forgot password?
                  </Button>
                </div>

                {/* General Error */}
                {(signinErrors.general || generalError) && (
                  <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                    {signinErrors.general || generalError}
                  </div>
                )}

                {/* Sign In Button */}
                <Button
                  type="submit"
                  className="w-full h-12 bg-amber-400 text-accent-foreground hover:bg-amber-400/80 font-medium"
                  disabled={isSigningIn || isGoogleAuth}
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                {/* Google Sign In Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 border-border hover:bg-muted bg-background text-foreground"
                  onClick={handleGoogleAuth}
                  disabled={isSigningIn || isGoogleAuth}
                >
                  {isGoogleAuth ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Continue with Google
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sign Up Tab - Same structure, just the form fields change */}
        <TabsContent value="signup" className="space-y-6">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold text-center text-card-foreground">
                Create account
              </CardTitle>
              <CardDescription className="text-center text-muted-foreground">
                Join us and start ordering your favorite food
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Full Name Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="signup-name"
                    className="text-sm font-medium text-foreground"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter your full name"
                    value={signupForm.name}
                    onChange={(e) => handleSignupFieldChange('name', e.target.value)}
                    onBlur={(e) => validateSignupField('name', e.target.value)}
                    className={`h-12 bg-input border-border focus:ring-ring text-foreground placeholder:text-muted-foreground ${signupErrors.name ? 'border-red-500 focus:ring-red-500' : ''
                      }`}
                    autoComplete="name"
                    disabled={isSigningUp}
                  />
                  {signupErrors.name && (
                    <p className="text-sm text-red-500 mt-1">{signupErrors.name}</p>
                  )}
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="signup-email"
                    className="text-sm font-medium text-foreground"
                  >
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={signupForm.email}
                    onChange={(e) => handleSignupFieldChange('email', e.target.value)}
                    onBlur={(e) => validateSignupField('email', e.target.value)}
                    className={`h-12 bg-input border-border focus:ring-ring text-foreground placeholder:text-muted-foreground ${signupErrors.email ? 'border-red-500 focus:ring-red-500' : ''
                      }`}
                    autoComplete="email"
                    disabled={isSigningUp}
                  />
                  {signupErrors.email && (
                    <p className="text-sm text-red-500 mt-1">{signupErrors.email}</p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="signup-password"
                    className="text-sm font-medium text-foreground"
                  >
                    Password
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={signupForm.password}
                    onChange={(e) => handleSignupFieldChange('password', e.target.value)}
                    onBlur={(e) => validateSignupField('password', e.target.value)}
                    className={`h-12 bg-input border-border focus:ring-ring text-foreground placeholder:text-muted-foreground ${signupErrors.password ? 'border-red-500 focus:ring-red-500' : ''
                      }`}
                    autoComplete="new-password"
                    disabled={isSigningUp}
                  />
                  {signupErrors.password && (
                    <p className="text-sm text-red-500 mt-1">{signupErrors.password}</p>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="signup-confirm-password"
                    className="text-sm font-medium text-foreground"
                  >
                    Confirm Password
                  </Label>
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    placeholder="Confirm your password"
                    value={signupForm.confirmPassword}
                    onChange={(e) => handleSignupFieldChange('confirmPassword', e.target.value)}
                    onBlur={(e) => validateSignupField('confirmPassword', e.target.value)}
                    className={`h-12 bg-input border-border focus:ring-ring text-foreground placeholder:text-muted-foreground ${signupErrors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''
                      }`}
                    autoComplete="new-password"
                    disabled={isSigningUp}
                  />
                  {signupErrors.confirmPassword && (
                    <p className="text-sm text-red-500 mt-1">{signupErrors.confirmPassword}</p>
                  )}
                </div>

                {/* Terms & Conditions */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="terms"
                      checked={signupForm.acceptTerms}
                      onCheckedChange={(checked) =>
                        handleSignupFieldChange('acceptTerms', checked)
                      }
                      disabled={isSigningUp}
                    />
                    <Label
                      htmlFor="terms"
                      className="text-sm text-muted-foreground"
                    >
                      I agree to the{" "}
                      <Button
                        type="button"
                        variant="link"
                        className="px-0 h-auto text-sm underline text-primary hover:text-primary/80"
                      >
                        Terms & Conditions
                      </Button>
                    </Label>
                  </div>
                  {signupErrors.terms && (
                    <p className="text-sm text-red-500 mt-1">{signupErrors.terms}</p>
                  )}
                </div>

                {/* General Error */}
                {(signupErrors.general || generalError) && (
                  <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                    {signupErrors.general || generalError}
                  </div>
                )}

                {/* Create Account Button */}
                <Button
                  type="submit"
                  className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
                  disabled={isSigningUp || isGoogleAuth}
                >
                  {isSigningUp ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                {/* Google Sign Up Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 border-border hover:bg-muted bg-background text-foreground"
                  onClick={handleGoogleAuth}
                  disabled={isSigningUp || isGoogleAuth}
                >
                  {isGoogleAuth ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Sign up with Google
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
