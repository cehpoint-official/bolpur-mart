import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
// import "./index.css"
import Providers from "./providers"
import { RegisterSW } from "@/components/pwa/register-sw"
import { Suspense } from "react"
import { AuthInitializer } from "@/components/auth/auth-initializer"

export const metadata: Metadata = {
  title: "Bolpur Mart - Quick Commerce",
  description:
    "World-class quick commerce app for groceries, vegetables, fruits, medicine, and food delivery in Bolpur",
  generator: "v0.app",
}

export const viewport = {
  themeColor: "#FF6B35",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Use className instead of inline styles to avoid hydration mismatch */}
        <style dangerouslySetInnerHTML={{
          __html: `
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        ` }} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Bolpur Mart" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body>
        <Providers>
          <AuthInitializer />
          <Suspense fallback={null}>{children}</Suspense>
        </Providers>
        <RegisterSW />
      </body>
    </html>
  )
}
