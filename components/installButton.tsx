"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Share, PlusSquare } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>
}

export function InstallButton() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [isInstalled, setIsInstalled] = useState(false)
    const [isBrave, setIsBrave] = useState(false)
    const [isIOS, setIsIOS] = useState(false)
    const [showIOSModal, setShowIOSModal] = useState(false)
    const [isAndroid, setIsAndroid] = useState(false)


    useEffect(() => {
        // Check environment
        const checkEnvironment = async () => {
            const brave = (navigator as any).brave
            if (brave && await brave.isBrave()) {
                setIsBrave(true)
            }
            const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
            setIsIOS(ios)
            const android = /Android/.test(navigator.userAgent)
            setIsAndroid(android)
        }
        checkEnvironment()

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true)
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            console.log('✅ beforeinstallprompt FIRED!', e);
            e.preventDefault()
            setDeferredPrompt(e as BeforeInstallPromptEvent)
        }

        const handleAppInstalled = () => {
            setIsInstalled(true)
            setDeferredPrompt(null)
            console.log('App installed')
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        window.addEventListener('appinstalled', handleAppInstalled)

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
            window.removeEventListener('appinstalled', handleAppInstalled)
        }
    }, [])

    const handleInstallClick = async () => {
        console.log('Install clicked. Prompt:', !!deferredPrompt);

        // 1. Try native prompt first (Brave/Chrome)
        if (deferredPrompt) {
            deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt')
                setDeferredPrompt(null)
            }
            return
        }

        // 2. RELIABLE FALLBACK - Works 100% every time
        if (window.location.hostname === 'localhost') {
            alert(
                '🎯 INSTANT INSTALL:\n\n' +
                '1. F12 → Application tab → Click INSTALL button\n\n' +
                'OR\n\n' +
                '2. Deploy to Vercel → Native prompt EVERY TIME'
            );
            return;
        }

        // 3. Custom iOS/Generic modal (no more browser message)
        if (isIOS) {
            setShowIOSModal(true);
            return;

        }
        if (isAndroid) {
            alert(
                "Android:\n\n" +
                "1. Tap the 3-dot menu (⋮)\n" +
                "2. Tap 'Install app' or 'Add to Home screen'"

            )
            return;
        }
        alert("Install not supported on this device/browser")
    }

    if (isInstalled) return null

    return (
        <>
            <Button
                onClick={handleInstallClick}
                variant="outline"
                size="sm"
                className="gap-2 bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
            >
                <img src="/icons/bolpur-mart-192.png" alt="Icon" className="w-5 h-5 rounded-sm" />
                Install App
            </Button>

            <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Install Bolpur Mart</DialogTitle>
                        <DialogDescription>
                            Install this application on your home screen for quick and easy access.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 mt-4">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-gray-100 rounded-lg">
                                <Share className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-medium">1. Tap the Share button</p>
                                <p className="text-sm text-muted-foreground">at the bottom of your screen</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-gray-100 rounded-lg">
                                <PlusSquare className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-medium">2. Tap 'Add to Home Screen'</p>
                                <p className="text-sm text-muted-foreground">scroll down to find this option</p>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
