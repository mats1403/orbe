import argon2 from "argon2";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
const initialPassword = process.env.ORBE_INITIAL_PASSWORD;
if (!connectionString || !initialPassword) throw new Error("DATABASE_URL e ORBE_INITIAL_PASSWORD são obrigatórios.");

const pool = new pg.Pool({ connectionString });
const passwordHash = await argon2.hash(initialPassword, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 3,
  parallelism: 1,
});

const accounts = [
  { email: "admin@orbe.local", name: "Administrador", role: "admin" },
  { email: "mats@orbe.local", name: "Mats", role: "user" },
] as const;

for (const account of accounts) {
  await pool.query(
    `INSERT INTO users(email, password_hash, display_name, role)
     VALUES($1,$2,$3,$4)
     ON CONFLICT(email) DO UPDATE
     SET password_hash=EXCLUDED.password_hash, display_name=EXCLUDED.display_name, role=EXCLUDED.role`,
    [account.email, passwordHash, account.name, account.role],
  );
}

await pool.end();
console.log("Contas locais preparadas: Administrador e Mats.");
