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
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    // Detect platform
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    const android = /android/i.test(navigator.userAgent)

    setIsIOS(ios)
    setIsAndroid(android)

    // Detect already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone
      if (isStandalone) {
        setIsInstalled(true)
        setCanInstall(false)
        console.log("PWA: App is running in standalone mode (already installed)")
        return true
      }
      return false
    }

    if (checkInstalled()) return

    // Capture native install prompt (Android / Chrome / Brave)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log("✅ PWA: beforeinstallprompt FIRED")
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }

    const handleAppInstalled = () => {
      console.log("🎉 PWA: App installed successfully")
      setIsInstalled(true)
      setDeferredPrompt(null)
      setCanInstall(false)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    // Check again after a short delay (sometimes display-mode matches late)
    const timer = setTimeout(checkInstalled, 1000)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
      clearTimeout(timer)
    }
  }, [])

  const installApp = async () => {
    // 1️⃣ Native prompt (best case — Android / Chrome / Brave)
    if (deferredPrompt) {
      setIsInstalling(true)
      try {
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === "accepted") {
          setDeferredPrompt(null)
          setCanInstall(false)
        }
      } catch (error) {
        console.error("PWA: Install error:", error)
      } finally {
        setIsInstalling(false)
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
    isInstalling,
  }
}
