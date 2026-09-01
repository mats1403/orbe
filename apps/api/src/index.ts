import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { cookie } from "@elysiajs/cookie";
// Removed argon2 import
import { SignJWT, jwtVerify } from "jose";
import pg from "pg";
import { z } from "zod";
import { mkdir, unlink } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";

const env = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
  PORT: z.coerce.number().default(4000),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_SSL: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
}).parse(process.env);

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
});
const secret = new TextEncoder().encode(env.JWT_SECRET);
const SESSION_COOKIE = "orbe_session";

await mkdir(env.UPLOAD_DIR, { recursive: true });

async function tokenFor(userId: string) {
  return new SignJWT({ sub: userId, aud: "orbe-web", iss: "orbe-api" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

// Elysia Auth Plugin
const authPlugin = new Elysia()
  .use(cookie())
  .derive(async ({ cookie: { orbe_session } }) => {
    if (!orbe_session?.value) return { userId: null };
    try {
      const { payload } = await jwtVerify(orbe_session.value, secret, { algorithms: ["HS256"], audience: "orbe-web", issuer: "orbe-api" });
      return { userId: payload.sub as string };
    } catch {
      return { userId: null };
    }
  });

const app = new Elysia()
  .use(cors({ origin: env.APP_ORIGIN, credentials: true, allowedHeaders: ["Content-Type", "Authorization"] }))
  .use(cookie())
  .use(authPlugin)
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      set.status = 400;
      return { message: "Dados inválidos.", issues: error.all };
    }
    const appError = error as Error & { statusCode?: number };
    const status = appError.statusCode ?? 500;
    if (status >= 500) console.error(error);
    set.status = status;
    return { message: status >= 500 ? "Erro interno." : appError.message };
  })
  .get("/health", async () => {
    await pool.query("SELECT 1");
    return { status: "ok" };
  })
  .get("/", () => "Orbe API is running.");

// Auth Routes
const credentialsSchema = t.Object({
  email: t.String({ format: "email", maxLength: 254 }),
  password: t.String({ minLength: 12, maxLength: 128 }),
});

app.group("/auth", (app) =>
  app
    .post("/register", async ({ body, set, cookie: { orbe_session } }) => {
      const input = body;
      input.email = input.email.toLowerCase();
      const hash = await Bun.password.hash(input.password, { algorithm: "argon2id" });
      try {
        const result = await pool.query("INSERT INTO users(email, password_hash, display_name) VALUES($1,$2,split_part($1,'@',1)) RETURNING id,email,display_name,role", [input.email, hash]);
        const user = result.rows[0];
        orbe_session.set({
          value: await tokenFor(user.id),
          httpOnly: true,
          secure: env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: 7 * 24 * 60 * 60,
        });
        set.status = 201;
        return { user };
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          set.status = 409;
          return { message: "Este e-mail já está em uso." };
        }
        throw error;
      }
    }, { body: credentialsSchema })
    .post("/login", async ({ body, set, cookie: { orbe_session } }) => {
      const input = body;
      input.email = input.email.toLowerCase();
      const result = await pool.query("SELECT id,email,password_hash,display_name,role FROM users WHERE email=$1", [input.email]);
      const user = result.rows[0];
      if (!user || !(await Bun.password.verify(input.password, user.password_hash))) {
        set.status = 401;
        return { message: "Credenciais inválidas." };
      }
      orbe_session.set({
        value: await tokenFor(user.id),
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      return { user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role } };
    }, { body: credentialsSchema })
    .get("/me", async ({ userId, set }) => {
      if (!userId) {
        set.status = 401;
        return { message: "Não autenticado" };
      }
      const result = await pool.query("SELECT id,email,display_name,role FROM users WHERE id=$1", [userId]);
      if (!result.rows[0]) {
        set.status = 401;
        return { message: "Sessão inválida" };
      }
      return { user: result.rows[0] };
    })
    .post("/logout", async ({ cookie: { orbe_session } }) => {
      orbe_session.remove();
      return { ok: true };
    })
);

// API Routes
app.group("/api", (app) =>
  app
    .onBeforeHandle(({ userId, set }) => {
      if (!userId) {
        set.status = 401;
        return { message: "Não autenticado" };
      }
    })
    .get("/pages", async ({ userId }) => {
      const result = await pool.query("SELECT id,parent_id,title,icon,content,is_favorite,updated_at FROM pages WHERE owner_id=$1 ORDER BY updated_at DESC", [userId]);
      return result.rows;
    })
    .post("/pages", async ({ body, userId, set }) => {
      const input = body as any;
      const result = await pool.query(
        "INSERT INTO pages(owner_id,parent_id,title,icon,content) VALUES($1,$2,$3,$4,$5) RETURNING id,parent_id,title,icon,content,is_favorite,updated_at",
        [userId, input.parentId ?? null, input.title ?? "Página sem título", input.icon ?? null, JSON.stringify(input.content ?? [])]
      );
      set.status = 201;
      return result.rows[0];
    })
    .patch("/pages/:id", async ({ params: { id }, body, userId, set }) => {
      const input = body as any;
      const result = await pool.query(
        "UPDATE pages SET title=COALESCE($1,title),content=COALESCE($2,content),is_favorite=COALESCE($3,is_favorite),updated_at=now() WHERE id=$4 AND owner_id=$5 RETURNING id,parent_id,title,icon,content,is_favorite,updated_at",
        [input.title ?? null, input.content ? JSON.stringify(input.content) : null, input.isFavorite ?? null, id, userId]
      );
      if (!result.rowCount) {
        set.status = 404;
        return { message: "Página não encontrada." };
      }
      return result.rows[0];
    })
    .delete("/pages/:id", async ({ params: { id }, userId, set }) => {
      const result = await pool.query("DELETE FROM pages WHERE id=$1 AND owner_id=$2", [id, userId]);
      if (!result.rowCount) {
        set.status = 404;
        return { message: "Página não encontrada." };
      }
      set.status = 204;
    })
    .get("/files", async ({ userId }) => {
      const result = await pool.query("SELECT id,original_name,mime_type,size_bytes,created_at FROM files WHERE owner_id=$1 ORDER BY created_at DESC", [userId]);
      return result.rows;
    })
    .get("/files/:id", async ({ params: { id }, userId, set }) => {
      const result = await pool.query("SELECT original_name,storage_name,mime_type FROM files WHERE id=$1 AND owner_id=$2", [id, userId]);
      const file = result.rows[0];
      if (!file) {
        set.status = 404;
        return { message: "Arquivo não encontrado." };
      }
      set.headers["Content-Type"] = file.mime_type;
      set.headers["Content-Disposition"] = "inline; filename*=UTF-8''" + encodeURIComponent(file.original_name);
      set.headers["X-Content-Type-Options"] = "nosniff";
      return Bun.file(join(env.UPLOAD_DIR, file.storage_name));
    })
);

app.listen(env.PORT, () => {
  console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
});
