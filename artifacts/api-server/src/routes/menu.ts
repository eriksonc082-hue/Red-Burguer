import { Router, type IRouter } from "express";
import { asc } from "drizzle-orm";
import { db, menuItemsTable } from "@workspace/db";
import { ListMenuItemsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/menu", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(menuItemsTable)
    .orderBy(asc(menuItemsTable.category), asc(menuItemsTable.id));

  const data = rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    imageUrl: row.imageUrl,
    category: row.category,
  }));

  req.log.info({ count: data.length }, "Listed menu items");
  res.json(ListMenuItemsResponse.parse(data));
});

export default router;
