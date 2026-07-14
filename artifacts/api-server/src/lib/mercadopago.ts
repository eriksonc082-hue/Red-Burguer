import { randomUUID } from "node:crypto";
import { logger } from "./logger";

const MP_API_BASE = "https://api.mercadopago.com";

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

function getAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new MercadoPagoError(
      "MERCADOPAGO_ACCESS_TOKEN is not configured on the server.",
    );
  }
  return token;
}

/**
 * Builds the publicly reachable base URL for this server, used as the
 * Mercado Pago webhook notification_url. Prefers the production domain(s),
 * falling back to the Replit dev domain for local/preview testing.
 */
function getPublicBaseUrl(): string | undefined {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  const host = domains || devDomain;
  if (!host) return undefined;
  return `https://${host}`;
}

export interface CreatePixPaymentParams {
  amount: number;
  description: string;
  externalReference: string;
  payerEmail: string;
  payerFirstName?: string;
  payerDocument?: string | null;
}

export interface MercadoPagoPixPayment {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  external_reference?: string;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
}

async function callMercadoPago<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string },
): Promise<T> {
  const token = getAccessToken();
  const { idempotencyKey, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(`${MP_API_BASE}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
        ...rest.headers,
      },
    });
  } catch (err) {
    logger.error({ err, path }, "Mercado Pago request failed to send");
    throw new MercadoPagoError(
      "Não foi possível conectar ao Mercado Pago. Tente novamente em instantes.",
    );
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => undefined);
    }
    logger.error(
      { status: response.status, body, path },
      "Mercado Pago returned an error response",
    );
    throw new MercadoPagoError(
      `Mercado Pago retornou um erro (${response.status}).`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

/**
 * Creates a PIX payment through the official Mercado Pago Payments API.
 * https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
 */
export async function createPixPayment(
  params: CreatePixPaymentParams,
): Promise<MercadoPagoPixPayment> {
  const notificationUrl = getPublicBaseUrl();

  const payload: Record<string, unknown> = {
    transaction_amount: Number(params.amount.toFixed(2)),
    description: params.description,
    payment_method_id: "pix",
    external_reference: params.externalReference,
    payer: {
      email: params.payerEmail,
      first_name: params.payerFirstName,
      ...(params.payerDocument
        ? {
            identification: {
              type: "CPF",
              number: params.payerDocument.replace(/\D/g, ""),
            },
          }
        : {}),
    },
    ...(notificationUrl
      ? { notification_url: `${notificationUrl}/api/webhooks/mercadopago` }
      : {}),
  };

  return callMercadoPago<MercadoPagoPixPayment>("/v1/payments", {
    method: "POST",
    body: JSON.stringify(payload),
    idempotencyKey: randomUUID(),
  });
}

/**
 * Fetches the authoritative current state of a payment directly from
 * Mercado Pago. Always used to confirm status instead of trusting webhook
 * payloads, since webhook bodies can be spoofed by third parties.
 */
export async function getPayment(
  paymentId: number | string,
): Promise<MercadoPagoPixPayment> {
  return callMercadoPago<MercadoPagoPixPayment>(`/v1/payments/${paymentId}`, {
    method: "GET",
  });
}

/**
 * Maps a Mercado Pago payment status to our internal order status.
 * https://www.mercadopago.com.br/developers/pt/docs/checkout-api/payment-management/status
 */
export function mapPaymentStatusToOrderStatus(
  mpStatus: string,
): "awaiting_payment" | "approved" | "rejected" | "cancelled" {
  switch (mpStatus) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    case "pending":
    case "in_process":
    case "in_mediation":
    default:
      return "awaiting_payment";
  }
}
