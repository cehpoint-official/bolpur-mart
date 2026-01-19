"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/ui/product-card";
import { FloatingCart } from "@/components/ui/floating-cart";
import { CartModal } from "@/components/ui/cart-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SearchIcon,
  ArrowLeft,
  SlidersHorizontal,
  X,
  Home,
  ClipboardList,
  User,
  Loader2,
  Filter,
} from "lucide-react";
import { useTimeSlot } from "@/hooks/use-time-slot";
import { FirebaseProductService } from "@/lib/firebase-products";
import type { Product, CategoryReference } from "@/types";
import { useCartStore } from "@/stores/useCartStore";
import { useAuth } from "@/hooks/useAuth";

export default function Search() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentTimeSlot } = useTimeSlot();
  const { init: initCart } = useCartStore();
  const [searchQuery, setSearchQuery] = useState("");
  // const [debouncedQuery, setDebouncedQuery] = useState(""); // Commented out for future implementation
  const [isCartOpen, setIsCartOpen] = useState(false);
  // const [suggestions, setSuggestions] = useState<string[]>([]); // Commented out for future implementation
  // const [showSuggestions, setShowSuggestions] = useState(false); // Commented out for future implementation
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Infinite scroll states
  const [products, setProducts] = useState<Product[]>([]);
  const [allProductsCache, setAllProductsCache] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);

  const userId = isAuthenticated && user ? user.uid : "guest-user";
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);

  // Fetch available categories for current time slot
  const { data: availableCategories = [], isLoading: categoriesLoading } =
    useQuery<CategoryReference[]>({
      queryKey: ["availableCategories", currentTimeSlot],
      queryFn: () => FirebaseProductService.getAvailableCategories(),
      refetchOnWindowFocus: false,
      staleTime: 10 * 60 * 1000, // 10 minutes
    });

  // Load products with pagination
  const loadProducts = useCallback(
    async (
      pageNum: number,
      query: string,
      categories: string[],
      isNewSearch: boolean = false
    ) => {
      if (isLoadingMore && !isNewSearch) return;

      try {
        if (isNewSearch) {
          setInitialLoading(true);
          setProducts([]);
          setAllProductsCache([]);
        } else {
          setIsLoadingMore(true);
        }

        // For the first page or new search, get all products from Firebase
        if (pageNum === 1 || isNewSearch) {
          console.log("Fetching products from Firebase...", {
            query,
            categories,
            currentTimeSlot,
          });

          // Pass the full array of categories to Firebase service
          const categoryFilter = categories.length > 0 ? categories : undefined;
          const allProducts = await FirebaseProductService.getProducts(
            query,
            categoryFilter
          );

          console.log("Fetched products:", allProducts.length);

          // Store all products in state for pagination
          setAllProductsCache(allProducts);

          // Get first page of products
          const itemsPerPage = 10;
          const startIndex = 0;
          const endIndex = itemsPerPage;
          const newProducts = allProducts.slice(startIndex, endIndex);
          const hasMoreProducts = endIndex < allProducts.length;

          console.log("Setting initial products:", newProducts.length);
          setProducts(newProducts);
          setHasMore(hasMoreProducts);
          setPage(2); // Set to 2 since we've loaded page 1
        } else {
          // Use cached products for subsequent pages
          console.log("Loading more from cache...", allProductsCache.length);
          const itemsPerPage = 10;
          const startIndex = (pageNum - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          const newProducts = allProductsCache.slice(startIndex, endIndex);
          const hasMoreProducts = endIndex < allProductsCache.length;

          console.log("Adding more products:", newProducts.length);
          setProducts((prev) => [...prev, ...newProducts]);
          setHasMore(hasMoreProducts);
          setPage((prev) => prev + 1);
        }
      } catch (error) {
        console.error("Error loading products:", error);
        setHasMore(false);
      } finally {
        setIsLoadingMore(false);
        setInitialLoading(false);
      }
    },
    [isLoadingMore, allProductsCache, currentTimeSlot]
  );

  // Load initial products when search query or filters change
  useEffect(() => {
    console.log("Effect triggered:", {
      searchQuery,
      selectedCategories,
      currentTimeSlot,
    });
    if (searchQuery.length > 0 || selectedCategories.length > 0) {
      loadProducts(1, searchQuery, selectedCategories, true);
    } else {
      setProducts([]);
      setAllProductsCache([]);
      setHasMore(true);
      setPage(1);
      setInitialLoading(false);
    }
  }, [searchQuery, selectedCategories, currentTimeSlot]);

  // Intersection Observer for infinite scrolling
  useEffect(() => {
    if (isLoadingMore || !hasMore || products.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !isLoadingMore) {
          loadProducts(page, searchQuery, selectedCategories);
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
  }, [
    isLoadingMore,
    hasMore,
    page,
    searchQuery,
    selectedCategories,
    loadProducts,
    products.length,
  ]);

  // Handle device orientation/height changes
  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        if (
          loadingRef.current &&
          hasMore &&
          !isLoadingMore &&
          products.length > 0
        ) {
          const rect = loadingRef.current.getBoundingClientRect();
          if (rect.top < window.innerHeight) {
            loadProducts(page, searchQuery, selectedCategories);
          }
        }
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [
    hasMore,
    isLoadingMore,
    page,
    searchQuery,
    selectedCategories,
    loadProducts,
    products.length,
  ]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    // setShowSuggestions(value.length > 0); // Commented out for future implementation
  };

  // const handleSuggestionClick = (suggestion: string) => { // Commented out for future implementation
  //   setSearchQuery(suggestion);
  //   setShowSuggestions(false);
  // };

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    setSelectedCategories((prev) => {
      if (checked) {
        return [...prev, categoryId];
      } else {
        return prev.filter((id) => id !== categoryId);
      }
    });
  };

  const clearFilters = () => {
    setSelectedCategories([]);
  };

  const clearSearch = () => {
    setSearchQuery("");
    // setShowSuggestions(false); // Commented out for future implementation
    setProducts([]);
    setAllProductsCache([]);
    setPage(1);
    setHasMore(true);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const handleCheckout = () => {
    router.push("/checkout");
  };

  // const clearAllFilters = () => {
  //   setSelectedCategories([]);
  //   setSearchQuery("");
  //   setShowFilters(false);
  // };

  useEffect(() => {
    const actualUserId = userId === "guest-user" ? null : userId;
    initCart(actualUserId);
  }, [user, isAuthenticated, initCart, userId]);

  // Check if we should show products
  const shouldShowProducts =
    searchQuery.length > 0 || selectedCategories.length > 0;

  return (
    <div className="mobile-container">
      {/* Search Header */}
      <header
        className="sticky top-0 z-50 bg-background border-b border-border"
        data-testid="search-header"
      >
        <div className="flex items-center p-4 space-x-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/")}
            data-testid="back-button"
          >
            <ArrowLeft size={20} />
          </Button>

          <div className="flex-1 relative">
            <SearchIcon
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <Input
              type="text"
              placeholder="Search for products..."
              className="pl-10 pr-10 bg-muted/50"
              value={searchQuery}
              onChange={handleSearch}
              data-testid="search-input"
              autoFocus
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                onClick={clearSearch}
                data-testid="clear-search"
              >
                <X size={16} />
              </Button>
            )}
          </div>

          {/* Filter Button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="search-filters"
              className={selectedCategories.length > 0 ? "text-primary" : ""}
              disabled={categoriesLoading}
            >
              <SlidersHorizontal size={20} />
              {selectedCategories.length > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 text-xs bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                  {selectedCategories.length}
                </span>
              )}
            </Button>

            {/* Filter Dropdown */}
            {showFilters && !categoriesLoading && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-background border border-border rounded-lg shadow-lg z-40">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Filter by Categories</h3>
                      {selectedCategories.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                        >
                          Clear All
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {availableCategories.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No categories available for current time slot
                        </p>
                      ) : (
                        availableCategories.map((category) => (
                          <div
                            key={category.id}
                            className="flex items-center space-x-3"
                          >
                            <Checkbox
                              id={category.id}
                              checked={selectedCategories.includes(category.id)}
                              onCheckedChange={(checked) =>
                                handleCategoryChange(
                                  category.id,
                                  checked as boolean
                                )
                              }
                            />
                            <label
                              htmlFor={category.id}
                              className="flex-1 text-sm font-medium cursor-pointer"
                            >
                              {category.name}
                            </label>
                            <span className="text-xs text-green-600">
                              Available
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex justify-end mt-4">
                      <Button size="sm" onClick={() => setShowFilters(false)}>
                        Apply Filters
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Applied Filters */}
        {selectedCategories.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {selectedCategories.map((categoryId) => {
                const category = availableCategories.find(
                  (c) => c.id === categoryId
                );
                return (
                  <Badge
                    key={categoryId}
                    variant="secondary"
                    className="text-xs"
                  >
                    {category?.name}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 h-auto p-0 w-4 "
                      onClick={() => handleCategoryChange(categoryId, false)}
                    >
                      <X size={12} />
                    </Button>
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Search Suggestions - Commented out for future implementation */}
        {/* {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-background border-b border-border shadow-lg z-40 max-w-md mx-auto">
            <div className="p-2">
              {suggestions.slice(0, 5).map((suggestion, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="w-full justify-start p-3 text-left"
                  onClick={() => handleSuggestionClick(suggestion)}
                  data-testid={`suggestion-${index}`}
                >
                  <SearchIcon size={16} className="mr-3 text-muted-foreground" />
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )} */}
      </header>

      {/* Close filter dropdown when clicking outside */}
      {showFilters && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowFilters(false)}
        />
      )}

      <div className="flex-1 overflow-y-auto pb-20">
        {/* Search Results */}
        {shouldShowProducts ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-lg">Search Results</h2>
                <p className="text-sm text-muted-foreground">
                  {initialLoading
                    ? "Searching..."
                    : `${products.length} items found`}
                  {searchQuery && ` for "${searchQuery}"`}
                  {selectedCategories.length > 0 && (
                    <span>
                      {" "}
                      • {selectedCategories.length} filter
                      {selectedCategories.length > 1 ? "s" : ""} applied
                    </span>
                  )}
                </p>
              </div>
            </div>

            {initialLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-card rounded-xl p-3 border border-border"
                  >
                    <div className="skeleton w-full h-32 rounded-lg mb-2"></div>
                    <div className="skeleton-text mb-1"></div>
                    <div className="skeleton-text w-3/4 mb-2"></div>
                    <div className="flex justify-between items-center">
                      <div className="skeleton-text w-1/3"></div>
                      <div className="skeleton w-8 h-8 rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <SearchIcon className="text-muted-foreground" size={32} />
                </div>
                <h3 className="font-semibold mb-2">No products found</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {availableCategories.length === 0
                    ? "No categories available for current time slot"
                    : "Try searching with different keywords or remove some filters"}
                </p>
                {selectedCategories.length > 0 && (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      userId={userId}
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
                      <span className="text-sm text-muted-foreground">
                        Loading more products...
                      </span>
                    </div>
                  )}
                  {!hasMore && products.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      You've reached the end of search results
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* Search Landing */
          <div className="p-4">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <SearchIcon className="text-primary" size={32} />
              </div>
              <h3 className="font-semibold mb-2">Discover Products</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Search for products or filter by categories
              </p>
            </div>

            {/* Available Categories Preview */}
            {/* {!categoriesLoading && availableCategories.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Available Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.slice(0, 6).map((category) => (
                    <Badge
                      key={category.id}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                      onClick={() => {
                        setSelectedCategories([category.id]);
                      }}
                    >
                      {category.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )} */}

            {/* Recent Searches - Commented out for future implementation */}
            {/* <div className="mb-6">
              <h3 className="font-semibold mb-3">Recent Searches</h3>
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm">
                  Your recent searches will appear here
                </p>
              </div>
            </div> */}
          </div>
        )}
      </div>

      {/* Floating Cart */}
      <FloatingCart userId={userId} onOpenCart={() => setIsCartOpen(true)} />

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card border-t border-border z-50">
        <div className="flex items-center justify-around py-2">
          <Button
            variant="ghost"
            className="flex flex-col items-center p-2 text-muted-foreground"
            asChild
            data-testid="nav-home"
          >
            <Link href="/">
              <Home size={20} />
              <span className="text-xs mt-1">Home</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center p-2 text-primary"
            data-testid="nav-search"
          >
            <SearchIcon size={20} />
            <span className="text-xs mt-1">Search</span>
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center p-2 text-muted-foreground"
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
            className="flex flex-col items-center p-2 text-muted-foreground"
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
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={handleCheckout}
        userId={userId}
      />

      {/* Custom CSS for skeleton loading */}
      <style jsx>{`
        .skeleton {
          background: linear-gradient(
            90deg,
            #f0f0f0 25%,
            #e0e0e0 50%,
            #f0f0f0 75%
          );
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
        }

        .skeleton-text {
          height: 1rem;
          background: linear-gradient(
            90deg,
            #f0f0f0 25%,
            #e0e0e0 50%,
            #f0f0f0 75%
          );
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: 4px;
        }

        @keyframes loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}
