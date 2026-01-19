import { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Search, Receipt, User } from "lucide-react";

interface MobileLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  backPath?: string;
  showBottomNav?: boolean;
  currentPage?: 'home' | 'search' | 'orders' | 'account';
}

export function MobileLayout({
  children,
  title,
  subtitle,
  showBackButton = true,
  backPath = "/account",
  showBottomNav = true,
  currentPage = 'account'
}: MobileLayoutProps) {

  return (
    <div className="mobile-container">
      {/* Header */}
      <header className="sticky border top-0 z-50 bg-background/95 backdrop-blur-md">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                asChild
                data-testid="back-button"
              >
                <Link href={backPath}>
                  <ArrowLeft size={20} />
                </Link>
              </Button>
            )}
            <div>
              <h1 className="font-bold text-xl">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className={`flex-1 overflow-y-auto mobile-scroll border ${showBottomNav ? 'pb-20' : 'pb-4'}`}>
        {children}
      </div>

      {/* Bottom Navigation - Only show if showBottomNav is true */}
      {showBottomNav && (
        <nav
          className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card border border-border z-50"
          data-testid="bottom-navigation"
        >
          <div className="flex items-center justify-around py-3">
            <Button
              variant="ghost"
              className={`flex flex-col items-center ${currentPage === 'home' ? 'text-primary' : 'text-muted-foreground'
                }`}
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
              className={`flex flex-col items-center ${currentPage === 'search' ? 'text-primary' : 'text-muted-foreground'
                }`}
              asChild
              data-testid="nav-search"
            >
              <Link href="/search">
                <Search size={20} />
                <span className="text-xs mt-1">Search</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              className={`flex flex-col items-center ${currentPage === 'orders' ? 'text-primary' : 'text-muted-foreground'
                }`}
              asChild
              data-testid="nav-orders"
            >
              <Link href="/orders">
                <Receipt size={20} />
                <span className="text-xs mt-1">Orders</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              className={`flex flex-col items-center ${currentPage === 'account' ? 'text-primary' : 'text-muted-foreground'
                }`}
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
      )}
    </div>
  );
}
