import mysql from "mysql2/promise";
import { config } from "dotenv";
config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const sqls = [
  `ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscriptionPlan ENUM('free','starter','pro','agency') DEFAULT 'free' NOT NULL`,
  `ALTER TABLE app_users ADD COLUMN IF NOT EXISTS contactPerson VARCHAR(255)`,
  `ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`,
  `ALTER TABLE app_users ADD COLUMN IF NOT EXISTS companyName VARCHAR(255)`,
  `ALTER TABLE app_users ADD COLUMN IF NOT EXISTS notes TEXT`,
];

for (const sql of sqls) {
  try {
    await connection.execute(sql);
    console.log("✓", sql.slice(0, 60));
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME" || err.message?.includes("Duplicate column")) {
      console.log("⚠ Already exists:", sql.slice(0, 60));
    } else {
      console.error("✗ Error:", err.message);
    }
  }
}

await connection.end();
console.log("Done!");
