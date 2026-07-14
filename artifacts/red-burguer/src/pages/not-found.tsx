import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="animate-in fade-in zoom-in-95 space-y-6 max-w-md">
        <AlertCircle className="w-20 h-20 text-destructive mx-auto" />
        <h1 className="text-4xl font-display font-black uppercase text-white tracking-tighter">
          Página não encontrada
        </h1>
        <p className="text-lg text-muted-foreground">
          A página que você está procurando não existe ou foi movida.
        </p>
        <Link href="/">
          <Button size="lg" className="w-full font-display uppercase tracking-wider text-lg h-14">
            Voltar ao Cardápio
          </Button>
        </Link>
      </div>
    </div>
  );
}
