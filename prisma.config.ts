export default {
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_aCPs2mGWTdZ6@ep-fancy-pine-aom5dqmg-pooler.c-2.ap-southeast-1.aws.neon.tech/e-Leave?sslmode=require&channel_binding=require",
  },
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
};
