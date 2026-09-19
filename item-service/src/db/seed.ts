import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { categories, menuItems } from './schema';

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log('Seeding categories...');

  const [food] = await db
    .insert(categories)
    .values({ name: 'Food' })
    .returning()
    .onConflictDoNothing({ target: categories.name });

  const [drinks] = await db
    .insert(categories)
    .values({ name: 'Drinks' })
    .returning()
    .onConflictDoNothing({ target: categories.name });

  if (!food || !drinks) {
    console.log('Categories already seeded, skipping.');
    return;
  }

  console.log('Seeding menu items...');

  await db.insert(menuItems).values([
    {
      name: 'Margherita Pizza',
      description: 'Classic tomato sauce, mozzarella, and fresh basil',
      price: '1299',
      categoryId: food.id,
      imageUrl:
        'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=400',
      available: true,
    },
    {
      name: 'Chicken Tikka Masala',
      description:
        'Tender chicken in creamy tomato curry sauce, served with basmati rice',
      price: '1499',
      categoryId: food.id,
      imageUrl:
        'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400',
      available: true,
    },
    {
      name: 'Caesar Salad',
      description:
        'Romaine lettuce, croutons, parmesan, house-made Caesar dressing',
      price: '999',
      categoryId: food.id,
      imageUrl:
        'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400',
      available: true,
    },
    {
      name: 'Classic Cheeseburger',
      description:
        'Angus beef patty, cheddar, lettuce, tomato, pickles, special sauce',
      price: '1399',
      categoryId: food.id,
      imageUrl:
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
      available: true,
    },
    {
      name: 'Iced Latte',
      description: 'Espresso with cold milk over ice',
      price: '599',
      categoryId: drinks.id,
      imageUrl:
        'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400',
      available: true,
    },
    {
      name: 'Mango Smoothie',
      description: 'Fresh mango, yogurt, honey, blended until smooth',
      price: '699',
      categoryId: drinks.id,
      imageUrl:
        'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400',
      available: true,
    },
    {
      name: 'Sparkling Water',
      description: 'Chilled sparkling mineral water',
      price: '299',
      categoryId: drinks.id,
      imageUrl:
        'https://images.unsplash.com/photo-1523362628745-0c100fc988a6?w=400',
      available: true,
    },
  ]);

  console.log('Seeding complete!');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
