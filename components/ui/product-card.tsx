"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Minus, Plus, ShoppingCart, Star, Clock, Heart, ShoppingBag, MapPin } from "lucide-react";
import { useCartStore } from "@/stores/useCartStore";
import { useWishlistStore } from "@/stores/useWishlistStore";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import type { Product } from "@/types";
import Image from "next/image";
import { LoginRequiredDialog } from "@/components/auth/login-required-dialog";
import {
  getOptimizedImageUrl,
  getPlaceholderUrl,
} from "@/lib/cloudinary-config";

interface ProductCardProps {
  product: Product;
  userId: string | null;
  viewMode?: "grid" | "list";
}

export function ProductCard({ product, userId }: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false); // Individual loading state
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // Cart store
  const {
    items,
    addItem,
    updateQuantity,
    loading: cartLoading,
  } = useCartStore();

  // Wishlist store
  const {
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
    init: initWishlist,
    initialized: wishlistInitialized
  } = useWishlistStore();

  // Initialize wishlist store
  useEffect(() => {
    if (!wishlistInitialized) {
      initWishlist(userId);
    }
  }, [userId, initWishlist, wishlistInitialized]);

  const isWishlisted = isInWishlist(product.id);

  const cartItem = items.find(
    (item) => item.productId === product.id && (!item.variant || item.variant === "")
  );
  const quantity = cartItem ? cartItem.quantity : 0;

  // Price calculations
  const originalPrice = product.price;
  const discountedPrice = product.discountedPrice ?? null;
  const hasDiscount = product.hasDiscount;
  const discountPercentage = product.discountPercentage ?? 0;

  // Ratings
  const averageRating = product.averageRating ?? 0;
  const totalRatings = product.totalRatings ?? 0;
  const roundedRating = Math.round(averageRating * 10) / 10;

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      setShowLoginDialog(true);
      return;
    }
    setIsAddingToCart(true);
    try {
      await addItem(product.id, 1, undefined);
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleIncreaseQuantity = async () => {
    if (!isAuthenticated) {
      setShowLoginDialog(true);
      return;
    }
    if (cartItem) {
      await updateQuantity(cartItem.id, cartItem.quantity + 1);
    } else {
      await addItem(product.id, 1, undefined);
    }
  };

  const handleDecreaseQuantity = async () => {
    // Decrease doesn't need auth check as user must be logged in to have items in cart
    if (cartItem && quantity > 0) {
      await updateQuantity(cartItem.id, quantity - 1);
    }
  };

  const toggleWishlist = async () => {
    // Check if user is authenticated
    if (!isAuthenticated || !userId) {
      toast({
        title: "Login Required",
        description: "Please login to add items to your wishlist.",
        variant: "destructive"
      });

      // Navigate to auth page
      router.push("/auth");
      return;
    }

    if (isWishlistLoading) return;

    setIsWishlistLoading(true); // Set loading for this specific product

    try {
      if (isWishlisted) {
        await removeFromWishlist(userId, product.id);
      } else {
        await addToWishlist(userId, product.id);
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsWishlistLoading(false); // Clear loading for this specific product
    }
  };

  // Image handling - use imageUrl from product
  const productImage = product.imageUrl || "";
  const optimizedImageUrl = productImage && !imageError
    ? getOptimizedImageUrl(productImage)
    : getPlaceholderUrl(400, 250);

  // Format price display
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price).replace('₹', '');
  };

  return (
    <Card
      className="product-card overflow-hidden border border-border shadow-sm hover:shadow-lg transition-all duration-300 bg-card"
      data-testid={`product-card-${product.id}`}
    >
      <div className="relative">
        {/* Product Image */}
        <div className="relative w-full h-32 bg-muted border-b">
          <Image
            src={optimizedImageUrl}
            alt={product.name}
            fill
            className="object-cover transition-opacity duration-300"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            data-testid={`product-image-${product.id}`}
            sizes="(max-width: 768px) 50vw, 25vw"
          />

          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Discount Badge */}
        {hasDiscount && discountPercentage > 0 && (
          <Badge
            className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold shadow-sm"
            data-testid={`product-discount-${product.id}`}
          >
            {discountPercentage}% OFF
          </Badge>
        )}

        {/* Stock Status Badge */}
        {product.stock < 5 && product.stock > 0 && (
          <Badge
            className="absolute top-2 left-2 mt-8 bg-orange-100 text-orange-700 border-orange-300 text-xs"
          >
            Only {product.stock} left
          </Badge>
        )}

        {/* Out of Stock Badge */}
        {product.stock === 0 && (
          <Badge
            className="absolute top-2 left-2 bg-gray-500 text-white text-xs"
          >
            Out of Stock
          </Badge>
        )}

        {/* Wishlist Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 w-8 h-8 bg-white/90 hover:bg-white rounded-full shadow-sm"
          onClick={toggleWishlist}
          disabled={isWishlistLoading}
          data-testid={`wishlist-button-${product.id}`}
        >
          {isWishlistLoading ? (
            <div className="w-4 h-4 border border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Heart
              className={`h-4 w-4 transition-colors ${isWishlisted ? "text-red-500 fill-current" : "text-muted-foreground"
                }`}
            />
          )}
        </Button>
      </div>

      <CardContent className="p-3">
        {/* Product Name */}
        <h3
          className="font-semibold text-sm mb-1 line-clamp-2 leading-tight"
          data-testid={`product-name-${product.id}`}
        >
          {product.name}
        </h3>

        {/* Product Description */}
        <p
          className="text-xs text-muted-foreground mb-2 line-clamp-2 leading-relaxed"
          data-testid={`product-description-${product.id}`}
        >
          {product.description}
        </p>

        {/* Rating Display */}
        {totalRatings > 0 ? (
          <div className="flex items-center mb-2">
            <div className="flex items-center">
              {/* Star Rating Display */}
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${i < Math.floor(averageRating)
                    ? "text-yellow-500 fill-current"
                    : i < averageRating
                      ? "text-yellow-500 fill-current opacity-50"
                      : "text-gray-300"
                    }`}
                />
              ))}
            </div>
            <span
              className="text-xs text-muted-foreground ml-1 font-medium"
              data-testid={`product-rating-${product.id}`}
            >
              {roundedRating}
            </span>
            <span className="text-xs text-muted-foreground mx-1">•</span>
            <span className="text-xs text-muted-foreground">
              {totalRatings} {totalRatings === 1 ? 'review' : 'reviews'}
            </span>
          </div>
        ) : (
          <div className="flex items-center mb-2">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3 w-3 text-gray-300" />
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-1">No reviews yet</span>
          </div>
        )}

        {/* Price and Add to Cart Section */}
        <div className="flex items-center justify-between">
          {/* Price Display */}
          <div className="flex flex-col">
            <div className="flex items-center space-x-1">
              <span
                className="font-bold text-primary text-sm"
                data-testid={`product-price-${product.id}`}
              >
                ₹{formatPrice(hasDiscount && discountedPrice ? discountedPrice : originalPrice)}
              </span>
              {hasDiscount && discountedPrice && (
                <span className="text-xs text-muted-foreground line-through">
                  ₹{formatPrice(originalPrice)}
                </span>
              )}
            </div>
            {hasDiscount && discountedPrice && (
              <span className="text-xs text-green-600 font-medium">
                Save ₹{formatPrice(originalPrice - discountedPrice)}
              </span>
            )}
          </div>

          {/* Add to Cart Controls */}
          <div className="flex items-center space-x-1">
            {quantity > 0 ? (
              <div className="flex items-center space-x-1 bg-muted rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 hover:bg-background"
                  onClick={handleDecreaseQuantity}
                  data-testid={`decrease-quantity-${product.id}`}
                  disabled={product.stock === 0 || cartLoading}
                >
                  <Minus className="h-3 w-3" />
                </Button>

                <span
                  className="w-6 text-center font-semibold text-sm"
                  data-testid={`product-quantity-${product.id}`}
                >
                  {quantity}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6 hover:bg-background"
                  onClick={handleIncreaseQuantity}
                  disabled={isAddingToCart || product.stock === 0 || quantity >= product.stock || cartLoading}
                  data-testid={`increase-quantity-${product.id}`}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="h-8 px-3 text-xs font-medium"
                onClick={handleAddToCart}
                disabled={isAddingToCart || product.stock === 0 || cartLoading}
                data-testid={`add-to-cart-${product.id}`}
              >
                {isAddingToCart ? (
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Adding...</span>
                  </div>
                ) : product.stock === 0 ? (
                  'Out of Stock'
                ) : (
                  <>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Delivery Info */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            <span>15-20 min</span>
          </div>
          <div className="flex items-center">
            <span className="text-green-600 font-medium">Free delivery</span>
          </div>
        </div>
      </CardContent>
      <LoginRequiredDialog
        open={showLoginDialog}
        onOpenChangeAction={setShowLoginDialog}
      />
    </Card>
  );
}
