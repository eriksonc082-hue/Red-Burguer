import { Link, useLocation } from "wouter";
import { ShoppingBag, ChevronRight, X, Menu, Loader2, ArrowLeft } from "lucide-react";
import { useListMenuItems } from "@workspace/api-client-react";
import { useCart } from "@/context/CartContext";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils-cn";

function Navbar() {
  const { items } = useCart();
  const cartCount = items.reduce((acc, item) => acc + item.cartQuantity, 0);
  const [location] = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-primary text-primary-foreground p-1.5 rounded transform group-hover:rotate-6 transition-transform">
            <Menu className="h-5 w-5" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tighter uppercase">
            Red <span className="text-primary">Burguer</span>
          </span>
        </Link>
        {location === "/" && (
          <Link href="/checkout" className="relative group">
            <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-primary/20 bg-background hover:bg-primary hover:text-primary-foreground group-hover:border-primary transition-colors">
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}

export default function Home() {
  const { data: menuItems, isLoading, error } = useListMenuItems();
  const { addItem, updateQuantity, items: cartItems } = useCart();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (!menuItems) return [];
    const cats = new Set(menuItems.map(item => item.category));
    return Array.from(cats);
  }, [menuItems]);

  const groupedMenu = useMemo(() => {
    if (!menuItems) return {};
    return menuItems.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, typeof menuItems>);
  }, [menuItems]);

  const getItemQuantity = (id: number) => {
    const item = cartItems.find((i) => i.id === id);
    return item ? item.cartQuantity : 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 container max-w-4xl mx-auto p-4 space-y-6">
          <div className="flex gap-2 overflow-hidden">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-24 rounded-full" />)}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-8 w-40" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !menuItems) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-destructive/10 p-4 rounded-full mb-4">
            <X className="h-10 w-10 text-destructive" />
          </div>
          <h2 className="text-2xl font-display font-bold uppercase mb-2">Erro ao carregar cardápio</h2>
          <p className="text-muted-foreground mb-6">Não foi possível carregar os itens agora. Tente novamente.</p>
          <Button onClick={() => window.location.reload()}>Tentar Novamente</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col pb-24">
      <Navbar />
      
      {/* Categories Sticky Nav */}
      <div className="sticky top-16 z-40 bg-background/95 backdrop-blur border-b border-border py-3">
        <div className="container max-w-4xl mx-auto px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 w-max">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  const el = document.getElementById(`category-${category}`);
                  if (el) {
                    const y = el.getBoundingClientRect().top + window.scrollY - 120;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }}
                className={cn(
                  "px-4 py-2 rounded-full font-display uppercase tracking-wider text-sm transition-colors border",
                  activeCategory === category || (!activeCategory && categories[0] === category)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-card-foreground border-border hover:border-primary/50"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 container max-w-4xl mx-auto p-4">
        {categories.map((category) => (
          <div key={category} id={`category-${category}`} className="mb-10 pt-4">
            <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white mb-4 flex items-center gap-2">
              <div className="h-6 w-2 bg-secondary rounded-full" />
              {category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedMenu[category].map((item, index) => {
                const qty = getItemQuantity(item.id);
                return (
                  <div 
                    key={item.id} 
                    className="group bg-card border border-border rounded-xl overflow-hidden flex flex-col sm:flex-row shadow-sm hover:border-primary/50 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="aspect-video sm:aspect-square sm:w-32 sm:h-32 bg-muted relative overflow-hidden shrink-0">
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-accent/50">
                          <ShoppingBag className="opacity-20 w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                      <div>
                        <h3 className="font-display font-bold text-lg leading-tight mb-1">{item.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{item.description}</p>
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="font-bold text-primary text-lg">
                          {formatCurrency(item.price)}
                        </span>
                        
                        {qty > 0 ? (
                          <div className="flex items-center bg-accent rounded-full p-1 border border-border">
                            <button 
                              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-background transition-colors text-lg font-bold"
                              onClick={() => updateQuantity(item.id, qty - 1)}
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-bold text-sm">{qty}</span>
                            <button 
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-lg font-bold"
                              onClick={() => updateQuantity(item.id, qty + 1)}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="secondary"
                            className="rounded-full px-4 h-9 font-bold bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-none"
                            onClick={() => addItem(item)}
                          >
                            Adicionar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </main>

      {/* Floating Cart Button (Mobile mainly) */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-background via-background to-transparent z-50 animate-in slide-in-from-bottom-10">
          <div className="container max-w-4xl mx-auto">
            <Link href="/checkout" className="w-full flex items-center justify-between bg-primary text-primary-foreground h-14 rounded-xl px-6 font-display font-bold uppercase tracking-wider shadow-lg hover:bg-primary/90 transition-all hover:-translate-y-1 active:translate-y-0">
              <div className="flex items-center gap-3">
                <span className="bg-primary-foreground text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm">
                  {cartItems.reduce((acc, i) => acc + i.cartQuantity, 0)}
                </span>
                <span>Ver Carrinho</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{formatCurrency(cartItems.reduce((acc, i) => acc + (i.price * i.cartQuantity), 0))}</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
