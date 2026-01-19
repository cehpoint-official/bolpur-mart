"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heart, Search, Loader2, X } from "lucide-react";
import type { Product } from "@/types";
import { ProductCard } from "../ui/product-card";
import { FirebaseWishlistService } from "@/lib/firebase-wishlist-service";
import { useAuth } from "@/hooks/useAuth";
import { useWishlistStore } from "@/stores/useWishlistStore";

const ITEMS_PER_PAGE = 10;

export default function Wishlist() {
  const [allWishlistProducts, setAllWishlistProducts] = useState<Product[]>([]);
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  const { user, isAuthenticated } = useAuth();
  const { init: initWishlist } = useWishlistStore();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);

  const getUserId = () => {
    if (isAuthenticated && user) {
      return user.uid;
    }
    return null;
  };

  // Load all wishlist products from Firebase/localStorage
  const loadAllWishlistProducts = useCallback(async () => {
    setInitialLoading(true);
    try {
      const userId = getUserId();
      let products: Product[] = [];

      if (!userId) {
        // Guest user - load from localStorage
        const storedWishlist = localStorage.getItem('bolpur-mart-guest-wishlist');
        const guestWishlistIds = storedWishlist ? JSON.parse(storedWishlist) : [];

        if (guestWishlistIds.length > 0) {
          const { FirebaseProductService } = await import('@/lib/firebase-products');
          const productPromises = guestWishlistIds.map((id: string) =>
            FirebaseProductService.getProductById(id)
          );
          const fetchedProducts = await Promise.all(productPromises);
          products = fetchedProducts.filter((product): product is Product => product !== null);
        }
      } else {
        // Logged in user - load from Firebase
        products = await FirebaseWishlistService.getWishlistWithProducts(userId);
      }

      setAllWishlistProducts(products);
      setFilteredProducts(products);

      // Load first page
      const firstPageProducts = products.slice(0, ITEMS_PER_PAGE);
      setDisplayedProducts(firstPageProducts);
      setHasMore(products.length > ITEMS_PER_PAGE);
      setPage(2);
    } catch (error) {
      console.error("Error loading wishlist:", error);
      setAllWishlistProducts([]);
      setFilteredProducts([]);
      setDisplayedProducts([]);
      setHasMore(false);
    } finally {
      setInitialLoading(false);
    }
  }, [user, isAuthenticated]);

  // Load more products for pagination
  const loadMoreProducts = useCallback((currentPage: number, productsToShow: Product[]) => {
    if (loading || !hasMore) return;

    setLoading(true);

    // Simulate network delay for better UX
    setTimeout(() => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const nextProducts = productsToShow.slice(startIndex, endIndex);

      if (nextProducts.length > 0) {
        setDisplayedProducts(prev => [...prev, ...nextProducts]);
        setPage(prev => prev + 1);
        setHasMore(endIndex < productsToShow.length);
      } else {
        setHasMore(false);
      }

      setLoading(false);
    }, 500);
  }, [loading, hasMore]);

  // Initialize wishlist store and load products
  useEffect(() => {
    const userId = getUserId();
    initWishlist(userId);
    loadAllWishlistProducts();
  }, [user, isAuthenticated, initWishlist, loadAllWishlistProducts]);

  // Handle search with debouncing
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      let filtered: Product[] = [];

      if (!query.trim()) {
        filtered = allWishlistProducts;
      } else {
        filtered = allWishlistProducts.filter(product =>
          product.name.toLowerCase().includes(query.toLowerCase()) ||
          product.description.toLowerCase().includes(query.toLowerCase()) ||
          product.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        );
      }

      setFilteredProducts(filtered);

      // Reset pagination for search results
      const firstPageProducts = filtered.slice(0, ITEMS_PER_PAGE);
      setDisplayedProducts(firstPageProducts);
      setHasMore(filtered.length > ITEMS_PER_PAGE);
      setPage(2);
    }, 300);

    setSearchTimeout(timeout);
  }, [searchTimeout, allWishlistProducts]);

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setFilteredProducts(allWishlistProducts);

    // Reset to first page of all products
    const firstPageProducts = allWishlistProducts.slice(0, ITEMS_PER_PAGE);
    setDisplayedProducts(firstPageProducts);
    setHasMore(allWishlistProducts.length > ITEMS_PER_PAGE);
    setPage(2);
  };

  // Intersection Observer for infinite scrolling
  useEffect(() => {
    if (loading || !hasMore || initialLoading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loading) {
          loadMoreProducts(page, filteredProducts);
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
  }, [loading, hasMore, page, filteredProducts, loadMoreProducts, initialLoading]);

  // Handle device orientation/height changes
  useEffect(() => {
    const handleResize = () => {
      // Trigger a check if more products need to be loaded after resize
      setTimeout(() => {
        if (loadingRef.current && hasMore && !loading && !initialLoading) {
          const rect = loadingRef.current.getBoundingClientRect();
          if (rect.top < window.innerHeight) {
            loadMoreProducts(page, filteredProducts);
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
  }, [hasMore, loading, page, filteredProducts, loadMoreProducts, initialLoading]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  return (
    <MobileLayout title="Wishlist" subtitle="Your saved products" backPath="/account">
      <div className="mobile-container">
        {/* Search Bar */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search your wishlist..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-10 h-10 text-base rounded-lg border-2 focus:border-primary transition-colors"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-muted-foreground mt-2">
              Searching for "{searchQuery}" • {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="p-4">
          {initialLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Loading your wishlist...</p>
            </div>
          ) : displayedProducts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Heart size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">
                  {searchQuery ? "No products found" : "No Wishlist Items"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery
                    ? `No products match "${searchQuery}". Try a different search term.`
                    : "Start adding products to your wishlist by tapping the heart icon on any product!"
                  }
                </p>
                {searchQuery ? (
                  <Button variant="outline" onClick={clearSearch}>
                    Clear Search
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    onClick={() => window.location.href = "/"}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Shop Now
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Results summary */}
              {!searchQuery && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">
                    {allWishlistProducts.length} item{allWishlistProducts.length !== 1 ? 's' : ''} in your wishlist
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {displayedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    userId={getUserId()}
                  />
                ))}
              </div>

              {/* Loading indicator and infinite scroll trigger */}
              <div
                ref={loadingRef}
                className="flex justify-center items-center py-8"
              >
                {loading && (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Loading more products...</span>
                  </div>
                )}
                {!hasMore && displayedProducts.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    You've reached the end of your wishlist
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
