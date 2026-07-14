import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, menuItemsTable, ordersTable, type OrderItemJson } from "@workspace/db";
import {
  CreateOrderBody,
  CreateOrderResponse,
  GetOrderParams,
  GetOrderResponse,
  CreateOrderPixPaymentParams,
  CreateOrderPixPaymentResponse,
} from "@workspace/api-zod";
import {
  createPixPayment,
  MercadoPagoError,
} from "../lib/mercadopago";

const router: IRouter = Router();

type OrderRow = typeof ordersTable.$inferSelect;

function serializeOrder(order: OrderRow) {
  return {
    id: order.id,
    status: order.status,
    total: Number(order.total),
    items: order.items,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    notes: order.notes ?? null,
    createdAt: order.createdAt,
    pixQrCode: order.pixQrCode ?? null,
    pixQrCodeBase64: order.pixQrCodeBase64 ?? null,
    pixExpiresAt: order.pixExpiresAt ?? null,
  };
}

/**
 * Orders sitting in awaiting_payment past their PIX expiration are treated
 * as expired even if the webhook never fires (e.g. the buyer simply walks
 * away). This keeps status correct without needing a background job.
 */
async function expireIfNeeded(order: OrderRow): Promise<OrderRow> {
  if (
    order.status === "awaiting_payment" &&
    order.pixExpiresAt &&
    order.pixExpiresAt.getTime() < Date.now()
  ) {
    const [updated] = await db
      .update(ordersTable)
      .set({ status: "expired" })
      .where(eq(ordersTable.id, order.id))
      .returning();
    return updated ?? order;
  }
  return order;
}

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const body = parsed.data;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customerEmail)) {
    res.status(400).json({ error: "E-mail inválido." });
    return;
  }

  const menuItemIds = [...new Set(body.items.map((item) => item.menuItemId))];

  const menuRows = await db
    .select()
    .from(menuItemsTable)
    .where(inArray(menuItemsTable.id, menuItemIds));

  const menuById = new Map(menuRows.map((row) => [row.id, row]));

  const missing = menuItemIds.filter((id) => !menuById.has(id));
  if (missing.length > 0) {
    res.status(400).json({
      error: `Itens do cardápio não encontrados: ${missing.join(", ")}`,
    });
    return;
  }

  const orderItems: OrderItemJson = body.items.map((item) => {
    const menuItem = menuById.get(item.menuItemId)!;
    return {
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: Number(menuItem.price),
      quantity: item.quantity,
    };
  });

  const total = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const [order] = await db
    .insert(ordersTable)
    .values({
      status: "pending",
      total: total.toFixed(2),
      items: orderItems,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      customerDocument: body.customerDocument ?? null,
      notes: body.notes ?? null,
    })
    .returning();

  req.log.info({ orderId: order!.id, total }, "Order created");
  res.status(201).json(CreateOrderResponse.parse(serializeOrder(order!)));
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));

  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  const fresh = await expireIfNeeded(order);
  res.json(GetOrderResponse.parse(serializeOrder(fresh)));
});

router.post("/orders/:id/pix", async (req, res): Promise<void> => {
  const params = CreateOrderPixPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));

  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  // Idempotent: if a PIX payment was already generated and hasn't expired,
  // just return the existing order instead of creating a duplicate charge.
  if (
    order.pixQrCode &&
    order.status === "awaiting_payment" &&
    order.pixExpiresAt &&
    order.pixExpiresAt.getTime() > Date.now()
  ) {
    res
      .status(201)
      .json(CreateOrderPixPaymentResponse.parse(serializeOrder(order)));
    return;
  }

  if (order.status === "approved") {
    res
      .status(201)
      .json(CreateOrderPixPaymentResponse.parse(serializeOrder(order)));
    return;
  }

  try {
    const payment = await createPixPayment({
      amount: Number(order.total),
      description: `Pedido #${order.id} - Red Burguer`,
      externalReference: String(order.id),
      payerEmail: order.customerEmail,
      payerFirstName: order.customerName.split(" ")[0],
      payerDocument: order.customerDocument,
    });

    const transactionData = payment.point_of_interaction?.transaction_data;
    if (!transactionData?.qr_code || !transactionData?.qr_code_base64) {
      req.log.error(
        { paymentId: payment.id },
        "Mercado Pago payment created without PIX QR data",
      );
      res.status(502).json({
        error: "O Mercado Pago não retornou os dados do PIX. Tente novamente.",
      });
      return;
    }

    const [updated] = await db
      .update(ordersTable)
      .set({
        status: "awaiting_payment",
        mpPaymentId: payment.id,
        pixQrCode: transactionData.qr_code,
        pixQrCodeBase64: transactionData.qr_code_base64,
        pixExpiresAt: payment.date_of_expiration
          ? new Date(payment.date_of_expiration)
          : null,
      })
      .where(eq(ordersTable.id, order.id))
      .returning();

    req.log.info(
      { orderId: order.id, paymentId: payment.id },
      "PIX payment created",
    );
    res
      .status(201)
      .json(CreateOrderPixPaymentResponse.parse(serializeOrder(updated!)));
  } catch (err) {
    if (err instanceof MercadoPagoError) {
      req.log.error({ err, orderId: order.id }, "Mercado Pago error");
      res.status(502).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
