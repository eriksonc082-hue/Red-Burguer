import { useEffect, useState, useRef } from "react";
import { useRoute, Link } from "wouter";
import { QrCode, Copy, CheckCircle2, AlertCircle, XCircle, Clock, RefreshCw, ChevronLeft } from "lucide-react";
import { 
  useCreateOrderPixPayment, 
  useGetOrder,
  getGetOrderQueryKey 
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";

export default function Payment() {
  const [match, params] = useRoute("/pagamento/:orderId");
  const orderId = match ? parseInt(params.orderId) : 0;
  
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  
  const createPix = useCreateOrderPixPayment();
  const hasCreatedPix = useRef(false);

  const { data: order, error: orderError, refetch } = useGetOrder(orderId, {
    query: {
      queryKey: getGetOrderQueryKey(orderId),
      enabled: !!orderId,
      refetchInterval: (query) => {
        const status = query.state?.data?.status;
        return status === "pending" || status === "awaiting_payment" ? 3000 : false;
      }
    }
  });

  // Automatically trigger PIX creation when entering the page if it's pending
  useEffect(() => {
    if (order?.status === "pending" && !hasCreatedPix.current && !createPix.isPending) {
      hasCreatedPix.current = true;
      createPix.mutate({ id: orderId }, {
        onSuccess: (updatedOrder) => {
          queryClient.setQueryData(getGetOrderQueryKey(orderId), updatedOrder);
        }
      });
    }
  }, [order?.status, orderId, createPix, queryClient]);

  const copyPixCode = () => {
    if (order?.pixQrCode) {
      navigator.clipboard.writeText(order.pixQrCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Helper formatting for countdown
  const [timeLeft, setTimeLeft] = useState<string>("");
  
  useEffect(() => {
    if (!order?.pixExpiresAt || order.status !== "awaiting_payment") return;
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiresAt = new Date(order.pixExpiresAt!).getTime();
      const diff = expiresAt - now;
      
      if (diff <= 0) {
        setTimeLeft("Expirado");
        clearInterval(interval);
      } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [order?.pixExpiresAt, order?.status]);


  if (!orderId) return null;

  if (orderError) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md w-full">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-display font-bold uppercase">Erro no Pedido</h2>
          <p className="text-muted-foreground">Não foi possível carregar as informações do pedido.</p>
          <Button onClick={() => refetch()} className="w-full">Tentar Novamente</Button>
          <Link href="/">
            <Button variant="outline" className="w-full">Voltar ao Cardápio</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Loading state (creating PIX or initial load)
  if (!order || createPix.isPending || (order.status === "pending" && !order.pixQrCodeBase64)) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md w-full animate-in fade-in">
          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <QrCode className="w-10 h-10 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold uppercase tracking-tight">Gerando PIX</h2>
            <p className="text-muted-foreground mt-2">Aguarde um momento, estamos preparando seu código de pagamento...</p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (order.status === "approved") {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="animate-in zoom-in-95 duration-500 max-w-md w-full space-y-6">
          <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-75"></div>
            <CheckCircle2 className="w-16 h-16 text-primary relative z-10" />
          </div>
          <h1 className="text-4xl font-display font-black uppercase text-white tracking-tighter">
            Pagamento<br/><span className="text-primary">Aprovado!</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Seu pedido #{order.id} já está na chapa. Em breve estará pronto!
          </p>
          <div className="pt-8">
            <Link href="/">
              <Button size="lg" className="w-full text-lg h-14 font-display uppercase tracking-wide">
                Fazer Novo Pedido
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Failed/Expired states
  if (order.status === "rejected" || order.status === "cancelled" || order.status === "expired") {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md w-full">
          <XCircle className="w-20 h-20 text-destructive mx-auto" />
          <h2 className="text-3xl font-display font-black uppercase">
            {order.status === "expired" ? "PIX Expirado" : "Pagamento Recusado"}
          </h2>
          <p className="text-muted-foreground text-lg">
            {order.status === "expired" 
              ? "O tempo para pagamento esgotou." 
              : "Houve um problema com seu pagamento."}
          </p>
          <div className="pt-4 space-y-3">
            <Button 
              onClick={() => {
                hasCreatedPix.current = false; // Reset to allow recreation
                createPix.mutate({ id: orderId });
              }} 
              size="lg" 
              className="w-full h-14 text-lg"
              disabled={createPix.isPending}
            >
              {createPix.isPending ? "Gerando..." : "Gerar Novo PIX"}
            </Button>
            <Link href="/">
              <Button variant="outline" size="lg" className="w-full h-14 text-lg">
                Voltar ao Cardápio
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Awaiting Payment State
  return (
    <div className="min-h-[100dvh] bg-background pb-10">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="bg-primary/20 text-primary p-2 rounded-full">
              <Clock className="w-4 h-4" />
            </span>
            <span className="font-bold text-sm">Aguardando PIX</span>
          </div>
          {timeLeft && (
            <div className="font-mono font-bold text-lg text-primary tabular-nums">
              {timeLeft}
            </div>
          )}
        </div>
      </header>

      <main className="container max-w-lg mx-auto p-4 pt-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-black uppercase tracking-tight mb-2">Finalize seu pedido</h1>
          <p className="text-muted-foreground">Escaneie o QR Code ou copie o código abaixo para pagar via PIX.</p>
        </div>

        <Card className="border-border overflow-hidden bg-card/50 backdrop-blur shadow-2xl relative">
          {/* Subtle glow effect behind card */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-primary/20 blur-[100px] rounded-full z-0 pointer-events-none"></div>
          
          <CardContent className="p-6 sm:p-8 space-y-8 relative z-10">
            <div className="text-center">
              <div className="text-sm text-muted-foreground uppercase tracking-widest font-bold mb-1">Valor a pagar</div>
              <div className="text-5xl font-black text-white font-display tracking-tighter">
                {formatCurrency(order.total)}
              </div>
            </div>

            {order.pixQrCodeBase64 && (
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-2xl shadow-xl">
                  <img 
                    src={`data:image/png;base64,${order.pixQrCodeBase64}`} 
                    alt="QR Code PIX" 
                    className="w-56 h-56 md:w-64 md:h-64 object-contain"
                  />
                </div>
              </div>
            )}

            {order.pixQrCode && (
              <div className="space-y-3">
                <div className="text-sm font-bold text-center text-muted-foreground uppercase">Ou copie o código</div>
                <div className="relative">
                  <input 
                    type="text" 
                    readOnly 
                    value={order.pixQrCode} 
                    className="w-full bg-background border border-border rounded-lg h-14 pl-4 pr-12 text-sm font-mono text-muted-foreground focus:outline-none focus:border-primary truncate"
                  />
                  <div className="absolute right-2 top-2 bottom-2 w-10 flex items-center justify-center bg-background pointer-events-none">
                    ...
                  </div>
                </div>
                <Button 
                  onClick={copyPixCode} 
                  size="lg" 
                  className={`w-full h-14 text-lg transition-all ${copied ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                >
                  {copied ? (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" /> Copiado!
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Copy className="w-5 h-5" /> Copiar Código PIX
                    </span>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-accent py-2 px-4 rounded-full border border-border">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Aguardando confirmação automática...
          </div>
        </div>
      </main>
    </div>
  );
}
