"use client";

import type React from "react";
import { useCartStore } from "@/stores/useCartStore";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TimeBanner } from "@/components/ui/time-banner";
import { ProductCard } from "@/components/ui/product-card";
// import { AIRecommendations } from "@/components/ai-recommendations";
import { FloatingCart } from "@/components/ui/floating-cart";
import { CartModal } from "@/components/ui/cart-modal";
import {
  Search,
  SlidersHorizontal,
  Bell,
  HomeIcon,
  ClipboardList,
  User,
  ShoppingBag,
  MapPin,
  Grid3X3,
  List,
  X,
  LogIn,
  Clock,
  Package,
  Gift,
  Percent,
  Check,
  ChevronDown,
  Filter,
  Loader2,
} from "lucide-react";
import { useTimeSlot } from "@/hooks/use-time-slot";
import { useAuth } from "@/hooks/useAuth";
import { FirebaseProductService } from "@/lib/firebase-products";
import type { Product, CategoryReference } from "@/types";
import { NotificationBell } from "../ui/notification-bell";


interface LocationState {
  city: string;
  state: string;
  loading: boolean;
  error: string | null;
}

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [location, setLocation] = useState<LocationState>({
    city: "Bolpur",
    state: "West Bengal",
    loading: true,
    error: null,
  });
  const [profileImageError, setProfileImageError] = useState(false);

  // Infinite scroll states
  const [products, setProducts] = useState<Product[]>([]);
  const [allProductsCache, setAllProductsCache] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { init: initCart } = useCartStore();
  const { currentTimeSlot } = useTimeSlot();

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);

  // Enhanced location fetching with improved accuracy
  useEffect(() => {
    const fetchLocation = async () => {
      // Check sessionStorage first
      const storedLocation = sessionStorage.getItem("userLocation");

      if (storedLocation) {
        const { city, state } = JSON.parse(storedLocation);
        setLocation({
          city,
          state,
          loading: false,
          error: null,
        });
        return; // Skip API call if data already exists
      }

      if (!navigator.geolocation) {
        setLocation((prev) => ({
          ...prev,
          loading: false,
          error: "Geolocation not supported",
        }));
        return;
      }

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 15000,
            enableHighAccuracy: true,
            maximumAge: 300000, // 5 minutes
          });
        });

        const { latitude, longitude } = position.coords;

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}&result_type=street_address|sublocality_level_1|sublocality_level_2|locality|administrative_area_level_3`;

        const response = await fetch(geocodeUrl);

        if (!response.ok) {
          throw new Error(`Geocoding failed with status: ${response.status}`);
        }

        const data = await response.json();

        if (data.results && data.results.length > 0) {
          let city = "Bolpur";
          let state = "West Bengal";

          // Look through all results to find the most specific location
          for (const result of data.results.slice(0, 3)) {
            const addressComponents = result.address_components;

            const cityTypes = [
              "sublocality_level_1",
              "sublocality_level_2",
              "sublocality",
              "locality",
              "administrative_area_level_3",
              "administrative_area_level_2",
              "postal_town",
              "neighborhood",
            ];

            // Find state
            for (const component of addressComponents) {
              if (component.types.includes("administrative_area_level_1")) {
                state = component.long_name;
                break;
              }
            }

            // Find city/locality
            for (const cityType of cityTypes) {
              for (const component of addressComponents) {
                if (component.types.includes(cityType)) {
                  const potentialCity = component.long_name;
                  if (
                    potentialCity !== state &&
                    !potentialCity.includes("Division") &&
                    !potentialCity.includes("District") &&
                    potentialCity.length > 2
                  ) {
                    city = potentialCity;
                    break;
                  }
                }
              }
              if (city !== "Bolpur") break;
            }

            if (city !== "Bolpur") break;
          }

          // Save location to sessionStorage
          sessionStorage.setItem(
            "userLocation",
            JSON.stringify({ city, state })
          );

          setLocation({
            city,
            state,
            loading: false,
            error: null,
          });
        } else {
          throw new Error("No location data found");
        }
      } catch (error: any) {
        setLocation((prev) => ({
          ...prev,
          loading: false,
          error: `Could not fetch location: ${error.message}`,
        }));
      }
    };

    fetchLocation();
  }, []);

  // Load products with pagination
  const loadProducts = useCallback(async (
    pageNum: number,
    query: string,
    category: string,
    isNewSearch: boolean = false
  ) => {
    if (isLoadingMore && !isNewSearch) return;

    if (isNewSearch) {
      setInitialLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      // For the first page or new search, get all products from Firebase
      if (pageNum === 1 || isNewSearch) {
        const allProducts = await FirebaseProductService.getProducts(query, category);

        // Store all products in state for pagination
        setAllProductsCache(allProducts);

        // Get first page of products
        const itemsPerPage = 12;
        const startIndex = 0;
        const endIndex = itemsPerPage;
        const newProducts = allProducts.slice(startIndex, endIndex);
        const hasMoreProducts = endIndex < allProducts.length;

        setProducts(newProducts);
        setHasMore(hasMoreProducts);
        setPage(2); // Set to 2 since we've loaded page 1
      } else {
        // Use cached products for subsequent pages
        const itemsPerPage = 12;
        const startIndex = (pageNum - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const newProducts = allProductsCache.slice(startIndex, endIndex);
        const hasMoreProducts = endIndex < allProductsCache.length;

        setProducts(prev => [...prev, ...newProducts]);
        setHasMore(hasMoreProducts);
        setPage(prev => prev + 1);
      }

    } catch (error) {
      console.error('Error loading products:', error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
      setInitialLoading(false);
    }
  }, [isLoadingMore, allProductsCache]);

  // Original query for categories (keep this)
  const { data: availableCategories = [] } = useQuery<CategoryReference[]>({
    queryKey: ["availableCategories", currentTimeSlot],
    queryFn: () => FirebaseProductService.getAvailableCategories(),
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Load initial products when search query or filters change
  useEffect(() => {
    setProducts([]);
    setAllProductsCache([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
    loadProducts(1, searchQuery, selectedCategory, true);
  }, [searchQuery, selectedCategory, currentTimeSlot]);

  // Intersection Observer for infinite scrolling
  useEffect(() => {
    if (isLoadingMore || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !isLoadingMore && products.length > 0) {
          loadProducts(page, searchQuery, selectedCategory);
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isLoadingMore, hasMore, page, searchQuery, selectedCategory, loadProducts, products.length]);

  // Handle device orientation/height changes
  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        if (loadingRef.current && hasMore && !isLoadingMore && products.length > 0) {
          const rect = loadingRef.current.getBoundingClientRect();
          if (rect.top < window.innerHeight) {
            loadProducts(page, searchQuery, selectedCategory);
          }
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [hasMore, isLoadingMore, page, searchQuery, selectedCategory, loadProducts, products.length]);


  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId === selectedCategory ? "" : categoryId);
    setShowFilters(false); // Close dropdown after selection
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };


  const handleCheckout = () => {
    router.push("/checkout");
  };

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const handleAuthClick = () => {
    router.push("/auth");
  };

  const getUserId = () => {
    if (isAuthenticated && user) {
      return user.uid;
    }
    return "guest-user";
  };

  const clearAllFilters = () => {
    setSelectedCategory("");
    setSearchQuery("");
    setShowFilters(false);
  };

  const selectedCategoryName = availableCategories.find(
    (cat) => cat.id === selectedCategory
  )?.name;

  // Get profile image URL with fallbacks
  const getProfileImageUrl = () => {
    if (!user) return null;

    // Try custom avatar first, then photoURL, then fallback
    return user.customData?.avatar
  };

  useEffect(() => {
    const userId = getUserId();
    const actualUserId = userId === "guest-user" ? null : userId;
    initCart(actualUserId);
  }, [user, isAuthenticated, initCart]);

  return (
    <div className="mobile-container border">
      {/* Navigation Header */}
      <header
        className="sticky top-0 z-[100] bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 border-b border-border/50"
        data-testid="navigation-header"
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <ShoppingBag className="text-primary-foreground" size={20} />
            </div>
            <div>
              <h1 className="font-bold text-xl text-foreground">Bolpur Mart</h1>
              <div className="text-xs text-muted-foreground flex items-center">
                <MapPin size={12} className="mr-1" />
                {location.loading ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-12 h-3 bg-gray-200 rounded animate-pulse"></div>
                    <span>,</span>
                    <div className="w-16 h-3 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                ) : (
                  <span>
                    {location.city}, {location.state}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Notification Bell */}
            <NotificationBell />

            {/* User Profile or Login Button */}
            {!mounted || authLoading ? (
              <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
            ) : isAuthenticated && user ? (
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 p-0"
                onClick={() => router.push("/account")}
                data-testid="profile-button"
              >
                {getProfileImageUrl() && !profileImageError ? (
                  <img
                    src={getProfileImageUrl()!}
                    alt="Profile"
                    className="w-full h-full object-cover rounded-full"
                    onError={() => setProfileImageError(true)}
                    onLoad={() => setProfileImageError(false)}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
                    <User size={20} className="text-primary" />
                  </div>
                )}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center space-x-1 px-3 border"
                onClick={handleAuthClick}
                data-testid="login-button"
              >
                <LogIn size={16} />
                <span className="text-sm font-medium">Login</span>
              </Button>
            )}
          </div>
        </div>
      </header>



      {/* Time-Based Banner */}
      <TimeBanner />

      {/* Search and Filters */}
      <div className="p-4 space-y-3 relative">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
            size={20}
          />
          <Input
            type="text"
            placeholder="Search for biryani, snacks, medicines..."
            className="pl-10 pr-12 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-ring"
            value={searchQuery}
            onChange={handleSearch}
            data-testid="search-input"
          />

          {/* Filter Button with Dropdown */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-50">
            <Button
              variant="ghost"
              size="icon"
              className={`relative rounded-full transition-all duration-200 ${showFilters
                ? "bg-primary/20 text-primary shadow-md"
                : "hover:bg-gray-100"
                }`}
              onClick={toggleFilters}
              data-testid="filters-button"
            >
              <Filter
                size={18}
                className={`transition-transform duration-200 ${showFilters ? "rotate-180" : ""
                  }`}
              />
              {selectedCategory && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse"></div>
              )}
            </Button>
          </div>
        </div>

        {/* Category Dropdown */}
        {showFilters && (
          <div className="absolute right-6 top-15 w-50 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999]">
            <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45"></div>

            <div className="bg-white rounded-lg overflow-hidden">
              <div className="p-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center">
                      <Filter className="w-3 h-3 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-gray-900">
                        Filter Categories
                      </h3>
                      <p className="text-[0.60rem] text-gray-500">
                        {availableCategories.length} categories available
                      </p>
                    </div>
                  </div>
                  {(selectedCategory || searchQuery) && (
                    <button
                      onClick={clearAllFilters}
                      className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto">
                <div
                  className={`px-3 py-2 cursor-pointer transition-colors ${!selectedCategory
                    ? "bg-blue-50 border-l-3 border-blue-500"
                    : "hover:bg-gray-50"
                    }`}
                  onClick={() => handleCategorySelect("")}
                >
                  <h4 className="text-xs font-medium text-gray-900">
                    All Categories
                  </h4>
                  <p className="text-[0.60rem] text-gray-500 mt-0.5">
                    Browse all products
                  </p>
                </div>

                {availableCategories.map((category) => {
                  const isSelected = selectedCategory === category.id;

                  return (
                    <div
                      key={category.id}
                      className={`px-3 py-2 cursor-pointer transition-colors ${isSelected
                        ? "bg-blue-50 border-l-3 border-blue-500"
                        : "hover:bg-gray-50"
                        }`}
                      onClick={() => handleCategorySelect(category.id)}
                    >
                      <h4 className="text-xs font-medium text-gray-900">
                        {category.name}
                      </h4>
                      <span className="text-[0.60rem] text-green-600">Available</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Filters Display */}
      {(searchQuery || selectedCategory) && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 px-4">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Active filters:
          </span>
          {searchQuery && (
            <Badge className="whitespace-nowrap bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors duration-200">
              <Search size={12} className="mr-1" />
              {searchQuery}
              <X
                size={12}
                className="ml-1 cursor-pointer hover:bg-blue-200 rounded transition-colors duration-200"
                onClick={() => setSearchQuery("")}
              />
            </Badge>
          )}
          {selectedCategory && (
            <Badge className="whitespace-nowrap bg-green-100 text-green-700 hover:bg-green-200 transition-colors duration-200">
              <Filter size={12} className="mr-1" />
              {selectedCategoryName}
              {/* <X
                size={12}
                className="ml-1 cursor-pointer hover:bg-green-200 rounded transition-colors duration-200"
                onClick={() => setSelectedCategory("")}
              /> */}
            </Badge>
          )}
          {(searchQuery || selectedCategory) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-destructive px-2 transition-colors duration-200"
            >
              Clear All
            </Button>
          )}
        </div>
      )}

      {/* Click outside to close filters */}
      {showFilters && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => setShowFilters(false)}
        />
      )}

      {/* Featured Banner */}
      <div className="px-4 mb-6">
        <Card className="relative rounded-2xl overflow-hidden h-48 bg-gradient-to-r from-orange-400 to-red-500">
          <img
            src="https://images.unsplash.com/photo-1596040033229-a9821ebd058d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
            alt="Special Biryani Offer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40"></div>
          <CardContent className="absolute bottom-4 left-4 right-4 text-white p-0">
            <h3 className="font-bold text-xl mb-1">Today's Special</h3>
            <p className="text-sm opacity-90 mb-2">
              Authentic Kolkata Biryani - 40% Off
            </p>
            <Button
              className="px-4 py-2 bg-white text-black hover:bg-gray-100"
              data-testid="special-offer-button"
            >
              Order Now
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Products Grid */}
      <div className="px-4 mb-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">
            {searchQuery
              ? "Search Results"
              : selectedCategory
                ? `${selectedCategoryName} Products`
                : "Available Now"}
            {products.length > 0 && (
              <span className="text-sm text-muted-foreground font-normal ml-2">
                ({products.length} items)
              </span>
            )}
          </h2>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("grid")}
              className={
                viewMode === "grid"
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground"
              }
              data-testid="grid-view-button"
            >
              <Grid3X3 size={20} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("list")}
              className={
                viewMode === "list"
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground"
              }
              data-testid="list-view-button"
            >
              <List size={20} />
            </Button>
          </div>
        </div>

        {initialLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-card rounded-xl p-3 border border-border animate-pulse"
              >
                <div className="w-full h-32 bg-gray-200 rounded-lg mb-2"></div>
                <div className="h-4 bg-gray-200 rounded mb-1"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 && !initialLoading ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="text-muted-foreground" size={32} />
            </div>
            <h3 className="font-semibold mb-2">No products available</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery
                ? "Try a different search term or adjust your filters"
                : "Check back later for available items"}
            </p>
            {(searchQuery || selectedCategory) && (
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div
              className={`grid ${viewMode === "grid" ? "grid-cols-2" : "grid-cols-1"
                } gap-4`}
            >
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  userId={getUserId()}
                />
              ))}
            </div>

            {/* Infinite scroll loading indicator */}
            <div
              ref={loadingRef}
              className="flex justify-center items-center py-8"
            >
              {isLoadingMore && (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading more products...</span>
                </div>
              )}
              {!hasMore && products.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  You've reached the end of available products
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating Cart */}
      <FloatingCart userId={getUserId()} onOpenCart={() => setIsCartOpen(true)} />

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card border border-border z-50"
        data-testid="bottom-navigation"
      >
        <div className="flex items-center justify-around py-3">
          <Button
            variant="ghost"
            className="flex flex-col items-center text-primary"
            data-testid="nav-home"
          >
            <HomeIcon size={20} />
            <span className="text-xs mt-1">Home</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center text-muted-foreground"
            asChild
            data-testid="nav-search"
          >
            <Link href="/search">
              <Search size={20} />
              <span className="text-xs mt-1">Search</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center text-muted-foreground"
            asChild
            data-testid="nav-orders"
          >
            <Link href="/orders">
              <ClipboardList size={20} />
              <span className="text-xs mt-1">Orders</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center text-muted-foreground"
            asChild
            data-testid="nav-account"
          >
            <Link href="/account">
              <User size={20} />
              <span className="text-xs mt-1">Account</span>
            </Link>
          </Button>
        </div>
      </nav>

      {/* Cart Modal */}
      <CartModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} onCheckout={handleCheckout} userId={getUserId()} />

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}
