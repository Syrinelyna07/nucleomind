import mysql from "mysql2/promise";

async function test() {
  try {
    const conn = await mysql.createConnection({
      host: "metro.proxy.rlwy.net",
      port: 53057,
      user: "root",
      password: "PHsMcEtZrUmQnGxTsxneBzwSMiYNChGm",
      database: "railway",
      ssl: { rejectUnauthorized: false }, // VERY IMPORTANT
      connectTimeout: 10000
    });

    console.log("✅ Connected!");
    await conn.end();
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
  }
}

test();