import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const hash = await bcrypt.hash("admin123", 10);
  console.log("Generated hash:", hash);

  // Try to find existing admin user
  const { rows } = await pool.query(`SELECT id FROM "User" WHERE email = 'admin'`);

  if (rows.length > 0) {
    // Update password in case it's wrong
    await pool.query(
      `UPDATE "User" SET "passwordHash" = $1 WHERE email = 'admin'`,
      [hash]
    );
    console.log("Updated existing admin user password");
  } else {
    // Check what enum values exist
    const enumCheck = await pool.query(
      `SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'UserRole'`
    );
    console.log("Available UserRole values:", enumCheck.rows.map(r => r.enumlabel));

    await pool.query(
      `INSERT INTO "User" (id, email, "passwordHash", role, "createdAt")
       VALUES (gen_random_uuid(), 'admin', $1, 'ADMIN'::"UserRole", NOW())`,
      [hash]
    );
    console.log("Created admin user: admin / admin123");
  }

  // Verify the user exists
  const verify = await pool.query(
    `SELECT id, email, "passwordHash", role FROM "User" WHERE email = 'admin'`
  );
  console.log("Verification:", verify.rows[0] ? { id: verify.rows[0].id, email: verify.rows[0].email, role: verify.rows[0].role, hasHash: !!verify.rows[0].passwordHash } : "NOT FOUND");

} catch (e) {
  console.error("Init seed FAILED:", e.message);
  console.error(e.stack);
} finally {
  await pool.end();
}
