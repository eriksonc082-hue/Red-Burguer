import { db, menuItemsTable } from "@workspace/db";

const items = [
  {
    name: "Red Classic Burger",
    description:
      "Pão brioche, hambúrguer bovino 150g, queijo cheddar, alface, tomate e maionese especial da casa.",
    price: "24.90",
    imageUrl: "/menu/red-classic-burger.jpg",
    category: "Burgers",
  },
  {
    name: "Bacon Supreme Burger",
    description:
      "Hambúrguer duplo, bacon crocante, cheddar derretido, cebola caramelizada e molho barbecue defumado.",
    price: "32.90",
    imageUrl: "/menu/bacon-supreme-burger.jpg",
    category: "Burgers",
  },
  {
    name: "Chicken Crispy Burger",
    description:
      "Filé de frango empanado extra crocante, alface fresca e maionese de alho artesanal.",
    price: "26.90",
    imageUrl: "/menu/chicken-crispy-burger.jpg",
    category: "Burgers",
  },
  {
    name: "Veggie Burger",
    description:
      "Hambúrguer de grão-de-bico e legumes grelhados, queijo e rúcula fresca no pão brioche.",
    price: "25.90",
    imageUrl: "/menu/veggie-burger.jpg",
    category: "Burgers",
  },
  {
    name: "Combo Duplo Bacon",
    description:
      "Bacon Supreme Burger + batata frita crocante + refrigerante gelado.",
    price: "44.90",
    imageUrl: "/menu/combo-duplo-bacon.jpg",
    category: "Combos",
  },
  {
    name: "Batata Frita Crocante",
    description: "Porção generosa de batatas fritas crocantes e douradas, temperadas na hora.",
    price: "14.90",
    imageUrl: "/menu/batata-frita.jpg",
    category: "Acompanhamentos",
  },
  {
    name: "Onion Rings",
    description: "Anéis de cebola empanados e fritos até ficarem crocantes por fora e macios por dentro.",
    price: "16.90",
    imageUrl: "/menu/onion-rings.jpg",
    category: "Acompanhamentos",
  },
  {
    name: "Milkshake de Chocolate",
    description: "Milkshake cremoso de chocolate, coberto com chantilly e calda.",
    price: "15.90",
    imageUrl: "/menu/milkshake-chocolate.jpg",
    category: "Bebidas",
  },
  {
    name: "Refrigerante Lata",
    description: "Lata gelada 350ml, sabores variados.",
    price: "6.90",
    imageUrl: "/menu/refrigerante-lata.jpg",
    category: "Bebidas",
  },
];

async function main() {
  const existing = await db.select().from(menuItemsTable);
  if (existing.length > 0) {
    console.log(
      `Menu já possui ${existing.length} itens. Nenhum item foi inserido.`,
    );
    process.exit(0);
  }

  await db.insert(menuItemsTable).values(items);
  console.log(`Inseridos ${items.length} itens no cardápio.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
