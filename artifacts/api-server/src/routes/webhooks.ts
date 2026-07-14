import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import {
  getPayment,
  mapPaymentStatusToOrderStatus,
  MercadoPagoError,
} from "../lib/mercadopago";

const router: IRouter = Router();

/**
 * Mercado Pago webhook receiver.
 *
 * Security note: we never trust the webhook payload's status directly —
 * anyone can POST an arbitrary body to this URL. Instead we only use it to
 * learn *which* payment id changed, then call the Mercado Pago Payments API
 * (authenticated with our server-side access token) to fetch the
 * authoritative status before touching the order.
 */
router.post("/webhooks/mercadopago", async (req: Request, res: Response): Promise<void> => {
  // Mercado Pago sends the payment id either in the query string
  // (?type=payment&data.id=123) or in the JSON body ({ type, data: { id } }).
  const queryType = typeof req.query["type"] === "string" ? req.query["type"] : undefined;
  const queryTopic = typeof req.query["topic"] === "string" ? req.query["topic"] : undefined;
  const queryDataId = req.query["data.id"];
  const bodyType = typeof req.body?.type === "string" ? req.body.type : undefined;
  const bodyDataId = req.body?.data?.id;

  const type = queryType ?? queryTopic ?? bodyType;
  const paymentId = queryDataId ?? bodyDataId ?? req.body?.resource;

  // Always acknowledge quickly; Mercado Pago retries aggressively on
  // non-2xx responses. We still validate before doing any DB writes.
  if (type !== "payment" || !paymentId) {
    req.log.info({ type, paymentId }, "Ignoring unrelated webhook notification");
    res.sendStatus(200);
    return;
  }

  try {
    const payment = await getPayment(String(paymentId));
    const orderId = Number(payment.external_reference ?? Number.NaN);

    if (Number.isNaN(orderId)) {
      req.log.warn({ paymentId }, "Webhook payment has no valid external_reference");
      res.sendStatus(200);
      return;
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));

    if (!order) {
      req.log.warn({ orderId, paymentId }, "Webhook references unknown order");
      res.sendStatus(200);
      return;
    }

    const newStatus = mapPaymentStatusToOrderStatus(payment.status);
    if (newStatus !== order.status) {
      await db
        .update(ordersTable)
        .set({ status: newStatus, mpPaymentId: payment.id })
        .where(eq(ordersTable.id, order.id));
      req.log.info(
        { orderId: order.id, paymentId: payment.id, status: newStatus },
        "Order status updated from Mercado Pago webhook",
      );
    }

    res.sendStatus(200);
  } catch (err) {
    if (err instanceof MercadoPagoError) {
      req.log.error({ err, paymentId }, "Failed to confirm payment with Mercado Pago");
      // Return 200 anyway so Mercado Pago doesn't infinitely retry a
      // notification for a payment id that may no longer be valid; the
      // client-side polling on GET /orders/:id will still catch up once
      // Mercado Pago is reachable again.
      res.sendStatus(200);
      return;
    }
    throw err;
  }
});

export default router;
