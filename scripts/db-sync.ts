/**
 * Database Sync Script — คัดลอกข้อมูลทั้งหมดจาก Neon ไปยัง Supabase (Cloning)
 * เพื่อใช้เป็นฐานข้อมูลสำรอง (Backup/Failover) ป้องกันความผิดพลาด
 *
 * วิธีใช้งาน:
 *  1. ตรวจสอบว่ามีตารางที่ฝั่ง Supabase ครบแล้ว (โดยการรัน prisma db push ไปที่ Supabase ก่อน)
 *  2. กำหนดค่าใน .env:
 *     DATABASE_URL="postgresql://... (Neon)"
 *     SUPABASE_DB_URL="postgresql://... (Supabase)"
 *  3. รันสคริปต์: npx tsx scripts/db-sync.ts
 */

import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";

// ─── โหลดไฟล์ .env ด้วยตนเอง ──────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value;
      }
    });
  }
}

async function main() {
  loadEnv();

  const sourceUrl = process.env.DATABASE_URL;
  const targetUrl = process.env.SUPABASE_DB_URL;

  if (!sourceUrl) {
    console.error("❌ ไม่พบ DATABASE_URL (Neon) ใน .env");
    process.exit(1);
  }
  if (!targetUrl) {
    console.error("❌ ไม่พบ SUPABASE_DB_URL (Supabase) ใน .env");
    console.log("\nกรุณาเพิ่ม URL ของฐานข้อมูล Supabase ลงใน .env ก่อน เช่น:");
    console.log('SUPABASE_DB_URL="postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres"\n');
    process.exit(1);
  }

  console.log("🔌 กำลังเชื่อมต่อกับฐานข้อมูลต้นทาง (Neon)...");
  const sourceClient = new Client({ connectionString: sourceUrl });
  await sourceClient.connect();

  console.log("🔌 กำลังเชื่อมต่อกับฐานข้อมูลปลายทาง (Supabase)...");
  const targetClient = new Client({ connectionString: targetUrl });
  await targetClient.connect();

  try {
    // 1. ดึงชื่อตารางทั้งหมดใน public schema (ยกเว้น _prisma_migrations)
    const tablesRes = await sourceClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != '_prisma_migrations'
    `);
    const tables = tablesRes.rows.map((r) => r.table_name);

    console.log(`📋 ตารางที่พบทั้งหมด: ${tables.join(", ")}`);

    // 2. ปิดการตรวจ Foreign Key & Triggers ชั่วคราวบน Supabase เพื่อให้เขียนสลับคอลัมน์ได้อย่างอิสระ
    console.log("🔒 กำลังปิดระบบตรวจการเชื่อมโยง Foreign Keys บนปลายทางชั่วคราว...");
    await targetClient.query("SET session_replication_role = 'replica';");

    // 3. เคลียร์ตารางทั้งหมดปลายทางในขั้นตอนเดียวเพื่อความสะอาด ป้องกัน Cascade Deletes
    console.log("🧹 กำลังเคลียร์ข้อมูลตารางทั้งหมดที่ปลายทาง...");
    const truncateQueries = tables.map((t) => `TRUNCATE TABLE "${t}" CASCADE;`).join(" ");
    await targetClient.query(truncateQueries);

    for (const table of tables) {
      console.log(`\n⏳ กำลังโคลนตาราง: "${table}"...`);

      // ดึงข้อมูลทั้งหมดจากต้นทาง
      const dataRes = await sourceClient.query(`SELECT * FROM "${table}"`);
      const rows = dataRes.rows;

      if (rows.length === 0) {
        console.log(`   └ ℹ️ ไม่มีข้อมูลให้คัดลอก`);
        continue;
      }

      // สร้าง Bulk Insert Query
      const columns = Object.keys(rows[0]).map((c) => `"${c}"`).join(", ");
      
      // ดึงข้อมูลค่าและจัดระเบียบ Parameter placeholders
      const valuesPlaceholders: string[] = [];
      const flatValues: any[] = [];
      let valCounter = 1;

      for (const row of rows) {
        const placeholders = Object.keys(row)
          .map(() => `$${valCounter++}`)
          .join(", ");
        valuesPlaceholders.push(`(${placeholders})`);
        flatValues.push(...Object.values(row));
      }

      const insertQuery = `
        INSERT INTO "${table}" (${columns}) 
        VALUES ${valuesPlaceholders.join(", ")}
      `;

      await targetClient.query(insertQuery, flatValues);
      console.log(`   └ ✅ คัดลอกเสร็จสิ้น (${rows.length} แถว)`);
    }

    console.log("\n🔓 กำลังเปิดระบบตรวจ Foreign Keys บนปลายทางตามปกติ...");
    await targetClient.query("SET session_replication_role = 'origin';");

    console.log("\n🎉 โคลนข้อมูลเสร็จเรียบร้อย! ข้อมูลทั้งหมดจาก Neon ถูกคัดลอกไป Supabase แล้ว");
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดระหว่างซิงค์ข้อมูล:", error);
    try {
      await targetClient.query("SET session_replication_role = 'origin';");
    } catch {}
  } finally {
    await sourceClient.end();
    await targetClient.end();
  }
}

main();
