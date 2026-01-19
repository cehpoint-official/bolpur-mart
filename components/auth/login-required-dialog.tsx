"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, ShoppingBag, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

interface LoginRequiredDialogProps {
    open: boolean;
    onOpenChangeAction: (open: boolean) => void;
}

export function LoginRequiredDialog({ open, onOpenChangeAction }: LoginRequiredDialogProps) {
    const router = useRouter();

    const handleLogin = () => {
        onOpenChangeAction(false);
        router.push("/auth"); // Or wherever your auth page is
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChangeAction}>
            <DialogContent className="sm:max-w-md border-primary/20 bg-gradient-to-b from-background to-amber-50/20">
                <DialogHeader className="flex flex-col items-center text-center space-y-2">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2 animate-pulse">
                        <ShoppingBag className="w-8 h-8 text-primary" />
                    </div>
                    <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-amber-600">
                        Start Your Shopping Journey
                    </DialogTitle>
                    <DialogDescription className="text-base text-muted-foreground pt-2">
                        Log in to add items to your cart, save your wishlist, and get personalized recommendations!
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col space-y-3 py-6">
                    <Button
                        size="lg"
                        className="w-full font-semibold shadow-lg shadow-primary/20"
                        onClick={handleLogin}
                    >
                        <LogIn className="mr-2 h-4 w-4" />
                        Login to Continue
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        className="w-full border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors"
                        onClick={handleLogin}
                    >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create Account
                    </Button>
                </div>
                <DialogFooter className="sm:justify-center">
                    <p className="text-xs text-muted-foreground text-center">
                        Join thousands of happy shoppers in Bolpur!
                    </p>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
