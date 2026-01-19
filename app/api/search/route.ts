import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { generateSearchSuggestions } from "@/lib/services/gemini";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const timeSlot = searchParams.get("timeSlot");

    if (!query) {
      return NextResponse.json(
        { error: "Missing required parameter: query" },
        { status: 400 }
      );
    }

    // Get all products for search processing
    const allProducts = await storage.getProducts();

    // Generate search suggestions using the Gemini service
    const suggestions = await generateSearchSuggestions(query, allProducts);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("Error in search suggestions API:", error);
    return NextResponse.json(
      { error: "Failed to get search suggestions" },
      { status: 500 }
    );
  }
}