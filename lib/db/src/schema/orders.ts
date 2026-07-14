import {
  pgTable,
  serial,
  text,
  numeric,
  timestamp,
  jsonb,
  bigint,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orderStatusValues = [
  "pending",
  "awaiting_payment",
  "approved",
  "rejected",
  "cancelled",
  "expired",
] as const;

export const orderItemsJsonSchema = z.array(
  z.object({
    menuItemId: z.number(),
    name: z.string(),
    price: z.number(),
    quantity: z.number(),
  }),
);
export type OrderItemJson = z.infer<typeof orderItemsJsonSchema>;

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  status: text("status", { enum: orderStatusValues })
    .notNull()
    .default("pending"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  items: jsonb("items").$type<OrderItemJson>().notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerDocument: text("customer_document"),
  notes: text("notes"),
  mpPaymentId: bigint("mp_payment_id", { mode: "number" }),
  pixQrCode: text("pix_qr_code"),
  pixQrCodeBase64: text("pix_qr_code_base64"),
  pixExpiresAt: timestamp("pix_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderRow = typeof ordersTable.$inferSelect;
