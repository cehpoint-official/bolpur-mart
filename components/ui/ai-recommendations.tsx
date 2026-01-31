"use client"

import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { ProductCard } from "@/components/ui/product-card"
import { RefreshCw, Bot } from "lucide-react"
import { useTimeSlot } from "@/hooks/use-time-slot"
import type { Product } from "@/types"
import { apiGet } from "@/lib/queryClient"

interface AIRecommendationsProps {
  userId: string
}

interface RecommendationResponse {
  productId: string
  score: number
  reason: string
}

export function AIRecommendations({ userId }: AIRecommendationsProps) {
  const { currentTimeSlot } = useTimeSlot()

  const {
    data: recommendations = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<RecommendationResponse[]>({
    queryKey: ["/api/recommendations", userId, currentTimeSlot],
    queryFn: () => apiGet<RecommendationResponse[]>(`/recommendations?userId=${userId}&timeSlot=${currentTimeSlot}`),
    enabled: !!userId,
  })

  // Fetch products for the recommended product IDs
  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", "timeSlot", currentTimeSlot],
    queryFn: () => apiGet<Product[]>(`/products?timeSlot=${currentTimeSlot}`),
  })

  const recommendedProducts = recommendations
    .map((rec) => {
      const product = allProducts.find((p) => p.id === rec.productId)
      return product ? { product, ...rec } : null
    })
    .filter((item): item is { product: Product } & RecommendationResponse => item !== null)
    .slice(0, 6) // Limit to 6 recommendations

  const handleRefresh = () => {
    refetch()
  }

  if (isLoading) {
    return (
      <div className="px-4 mb-6" data-testid="ai-recommendations-loading">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Bot className="text-primary" size={20} />
            <h2 className="font-semibold text-lg">AI Recommendations</h2>
          </div>
          <div className="animate-spin">
            <RefreshCw size={16} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-3 border border-border">
              <div className="w-full h-24 rounded-lg mb-2 bg-gray-200 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded mb-1 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (recommendedProducts.length === 0) {
    return (
      <div className="px-4 mb-6" data-testid="ai-recommendations-empty">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Bot className="text-primary" size={20} />
            <h2 className="font-semibold text-lg">AI Recommendations</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefetching}
            data-testid="refresh-recommendations"
          >
            {isRefetching ? <RefreshCw className="animate-spin" size={16} /> : "Refresh"}
          </Button>
        </div>
        <div className="text-center py-8">
          <Bot className="mx-auto text-muted-foreground mb-2" size={48} />
          <p className="text-muted-foreground">No recommendations available at the moment</p>
          <Button
            variant="outline"
            onClick={handleRefresh}
            className="mt-2 bg-transparent"
            data-testid="retry-recommendations"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 mb-6" data-testid="ai-recommendations">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Bot className="text-primary" size={20} />
          <h2 className="font-semibold text-lg">AI Recommendations</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefetching}
          data-testid="refresh-recommendations"
        >
          {isRefetching ? <RefreshCw className="animate-spin" size={16} /> : "Refresh"}
        </Button>
      </div>

      <p className="text-muted-foreground text-sm mb-4">Based on your preferences and time of day</p>

      <div className="grid grid-cols-2 gap-3">
        {recommendedProducts.map((item) => (
          <div key={item.product.id} className="relative">
            <ProductCard product={item.product} userId={userId} />
            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
              AI Pick
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
