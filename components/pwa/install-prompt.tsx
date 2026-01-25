"use client"

import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    // Detect platform
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    const android = /android/i.test(navigator.userAgent)

    setIsIOS(ios)
    setIsAndroid(android)

    // Detect already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      setCanInstall(false)
      return
    }

    // Capture native install prompt (Android / Chrome / Brave)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log("✅ beforeinstallprompt FIRED")
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }

    const handleAppInstalled = () => {
      console.log("🎉 App installed")
      setIsInstalled(true)
      setDeferredPrompt(null)
      setCanInstall(false)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const installApp = async () => {
    // 1️⃣ Native prompt (best case — Android / Chrome / Brave)
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === "accepted") {
        setDeferredPrompt(null)
        setCanInstall(false)
      }
      return
    }

    // 2️⃣ iOS fallback (manual)
    if (isIOS) {
      alert("iOS:\n\nTap Share → Add to Home Screen")
      return
    }

    // 3️⃣ Android fallback (no prompt available)
    if (isAndroid) {
      alert(
        "Android:\n\n" +
        "1. Tap the 3-dot menu (⋮)\n" +
        "2. Tap 'Install app' or 'Add to Home screen'"
      )
      return
    }

    // 4️⃣ Desktop / unsupported
    alert("Install not supported on this device/browser")
  }

  return {
    installApp,
    canInstall,
    isInstalled,
    isIOS,
    isAndroid,
  }
}
