import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const { rows } = await pool.query("SELECT id FROM \"User\" LIMIT 1");
  if (rows.length === 0) {
    console.log("No users found — creating admin user...");
    const hash = await bcrypt.hash("admin123", 10);
    await pool.query(
      `INSERT INTO "User" (id, email, "passwordHash", role, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'ADMIN', NOW(), NOW())`,
      ["admin@coastalhr.io", hash]
    );
    console.log("Admin created: admin@coastalhr.io / admin123");
  } else {
    console.log("Users exist — skipping seed.");
  }
} catch (e) {
  console.error("Init seed error:", e.message);
} finally {
  await pool.end();
}
