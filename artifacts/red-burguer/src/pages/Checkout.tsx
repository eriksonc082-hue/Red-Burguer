import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Trash2, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCart } from "@/context/CartContext";
import { useCreateOrder } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const checkoutSchema = z.object({
  customerName: z.string().min(2, "Nome é obrigatório"),
  customerPhone: z.string().min(10, "Telefone inválido (ex: 11999999999)"),
  customerEmail: z.string().email("E-mail inválido"),
  customerDocument: z.string().optional(),
  notes: z.string().optional(),
});

type CheckoutValues = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, total, updateQuantity, removeItem, clearCart } = useCart();
  const createOrder = useCreateOrder();
  const { toast } = useToast();

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      customerDocument: "",
      notes: "",
    },
  });

  const onSubmit = (data: CheckoutValues) => {
    if (items.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione itens antes de finalizar",
        variant: "destructive",
      });
      return;
    }

    createOrder.mutate(
      {
        data: {
          items: items.map((i) => ({
            menuItemId: i.id,
            quantity: i.cartQuantity,
          })),
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          customerDocument: data.customerDocument || null,
          notes: data.notes || null,
        },
      },
      {
        onSuccess: (order) => {
          clearCart();
          setLocation(`/pagamento/${order.id}`);
        },
        onError: () => {
          toast({
            title: "Erro ao criar pedido",
            description: "Verifique os dados e tente novamente",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (items.length === 0 && !createOrder.isPending && !createOrder.isSuccess) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md w-full animate-in fade-in zoom-in-95">
          <div className="w-24 h-24 bg-muted rounded-full mx-auto flex items-center justify-center">
            <Trash2 className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-display font-bold uppercase">Seu carrinho está vazio</h2>
          <p className="text-muted-foreground">Que tal adicionar alguns hambúrgueres incríveis?</p>
          <Link href="/">
            <Button className="w-full mt-4" size="lg">Voltar ao Cardápio</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center px-4 max-w-2xl mx-auto gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-display font-bold text-xl uppercase flex-1 text-center pr-10">
            Finalizar Pedido
          </h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto p-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 pt-6">
        
        {/* Resumo do Pedido */}
        <section>
          <h2 className="font-display font-bold text-lg uppercase mb-4 text-muted-foreground">Seu Pedido</h2>
          <div className="space-y-4 bg-card border border-border p-4 rounded-xl">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0 last:pb-0">
                <div className="flex-1">
                  <div className="font-bold flex items-center gap-2">
                    <span>{item.cartQuantity}x</span>
                    <span>{item.name}</span>
                  </div>
                  <div className="text-muted-foreground text-sm">{formatCurrency(item.price)}</div>
                </div>
                <div className="font-bold text-right">
                  {formatCurrency(item.price * item.cartQuantity)}
                </div>
                <button 
                  onClick={() => removeItem(item.id)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="pt-4 flex items-center justify-between text-xl font-display font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
        </section>

        {/* Formulário */}
        <section>
          <h2 className="font-display font-bold text-lg uppercase mb-4 text-muted-foreground">Seus Dados</h2>
          <Card className="border-border">
            <CardContent className="p-4 sm:p-6">
              <Form {...form}>
                <form id="checkout-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="João da Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp</FormLabel>
                          <FormControl>
                            <Input placeholder="(11) 99999-9999" type="tel" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input placeholder="joao@exemplo.com" type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="customerDocument"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF (Opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="000.000.000-00" {...field} />
                        </FormControl>
                        <FormDescription>
                          Acelera a aprovação do pagamento via PIX.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Tirar a cebola, ponto da carne, etc..." className="resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
          </Card>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 w-full p-4 bg-background border-t border-border z-50">
        <div className="container max-w-2xl mx-auto">
          <Button 
            type="submit" 
            form="checkout-form"
            size="lg" 
            className="w-full text-lg h-14 relative overflow-hidden group"
            disabled={createOrder.isPending}
          >
            {createOrder.isPending ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                Processando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Pagar com PIX
                <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
