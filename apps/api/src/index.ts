import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { cookie } from "@elysiajs/cookie";
// Removed argon2 import
import { SignJWT, jwtVerify } from "jose";
import { eq, and, desc, or } from "drizzle-orm";
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

import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
});
export const db = drizzle(pool, { schema });

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

const app = new Elysia()
  .use(cors({ 
    origin: (request) => {
      const origin = request.headers.get("origin");
      if (!origin) return true;
      if (origin.endsWith(".vercel.app") || origin === env.APP_ORIGIN) return true;
      return false;
    }, 
    credentials: true, 
    allowedHeaders: ["Content-Type", "Authorization"] 
  }))
  .use(cookie())
  .derive(async ({ cookie: { orbe_session } }) => {
    if (!orbe_session?.value) return { userId: null };
    try {
      const { payload } = await jwtVerify(orbe_session.value as string, secret, { algorithms: ["HS256"], audience: "orbe-web", issuer: "orbe-api" });
      return { userId: payload.sub as string };
    } catch {
      return { userId: null };
    }
  })
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
const registerSchema = t.Object({
  email: t.String({ format: "email", maxLength: 254 }),
  username: t.String({ minLength: 3, maxLength: 64 }),
  password: t.String({ minLength: 12, maxLength: 128 }),
});

const loginSchema = t.Object({
  login: t.String({ minLength: 3, maxLength: 254 }),
  password: t.String({ minLength: 12, maxLength: 128 }),
});

app.group("/auth", (app) =>
  app
    .post("/register", async ({ body, set, cookie: { orbe_session } }) => {
      const input = body;
      input.email = input.email.toLowerCase();
      input.username = input.username.toLowerCase();
      const hash = await Bun.password.hash(input.password, { algorithm: "argon2id" });
      try {
        const result = await db.insert(schema.users).values({
          email: input.email,
          username: input.username,
          password_hash: hash,
          display_name: input.username,
        }).returning({ id: schema.users.id, email: schema.users.email, username: schema.users.username, display_name: schema.users.display_name, role: schema.users.role });
        const user = result[0];
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
          return { message: "Este e-mail ou nome de usuário já está em uso." };
        }
        throw error;
      }
    }, { body: registerSchema })
    .post("/login", async ({ body, set, cookie: { orbe_session } }) => {
      const input = body;
      const searchLogin = input.login.toLowerCase();
      const users = await db.select().from(schema.users).where(
        or(
          eq(schema.users.email, searchLogin),
          eq(schema.users.username, searchLogin)
        )
      );
      const user = users[0];
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
      return { user: { id: user.id, email: user.email, username: user.username, display_name: user.display_name, role: user.role } };
    }, { body: loginSchema })
    .get("/me", async ({ userId, set }) => {
      if (!userId) {
        set.status = 401;
        return { message: "Não autenticado" };
      }
      const users = await db.select({ id: schema.users.id, email: schema.users.email, username: schema.users.username, display_name: schema.users.display_name, role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId));
      if (!users[0]) {
        set.status = 401;
        return { message: "Sessão inválida" };
      }
      return { user: users[0] };
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
      return await db.select({
        id: schema.pages.id,
        parent_id: schema.pages.parent_id,
        title: schema.pages.title,
        icon: schema.pages.icon,
        content: schema.pages.content,
        is_favorite: schema.pages.is_favorite,
        updated_at: schema.pages.updated_at,
      }).from(schema.pages).where(eq(schema.pages.owner_id, userId)).orderBy(desc(schema.pages.updated_at));
    })
    .post("/pages", async ({ body, userId, set }) => {
      const input = body as any;
      const result = await db.insert(schema.pages).values({
        owner_id: userId,
        parent_id: input.parentId ?? null,
        title: input.title ?? "Página sem título",
        icon: input.icon ?? null,
        content: JSON.stringify(input.content ?? []),
      }).returning({
        id: schema.pages.id,
        parent_id: schema.pages.parent_id,
        title: schema.pages.title,
        icon: schema.pages.icon,
        content: schema.pages.content,
        is_favorite: schema.pages.is_favorite,
        updated_at: schema.pages.updated_at,
      });
      set.status = 201;
      return result[0];
    })
    .patch("/pages/:id", async ({ params: { id }, body, userId, set }) => {
      const input = body as any;
      const updates: any = { updated_at: new Date() };
      if (input.title !== undefined) updates.title = input.title;
      if (input.content !== undefined) updates.content = JSON.stringify(input.content);
      if (input.isFavorite !== undefined) updates.is_favorite = input.isFavorite;

      const result = await db.update(schema.pages)
        .set(updates)
        .where(and(eq(schema.pages.id, id), eq(schema.pages.owner_id, userId)))
        .returning({
          id: schema.pages.id,
          parent_id: schema.pages.parent_id,
          title: schema.pages.title,
          icon: schema.pages.icon,
          content: schema.pages.content,
          is_favorite: schema.pages.is_favorite,
          updated_at: schema.pages.updated_at,
        });
      
      if (!result.length) {
        set.status = 404;
        return { message: "Página não encontrada." };
      }
      return result[0];
    })
    .delete("/pages/:id", async ({ params: { id }, userId, set }) => {
      const result = await db.delete(schema.pages).where(and(eq(schema.pages.id, id), eq(schema.pages.owner_id, userId))).returning({ id: schema.pages.id });
      if (!result.length) {
        set.status = 404;
        return { message: "Página não encontrada." };
      }
      set.status = 204;
    })
    .get("/files", async ({ userId }) => {
      return await db.select({
        id: schema.files.id,
        original_name: schema.files.original_name,
        mime_type: schema.files.mime_type,
        size_bytes: schema.files.size_bytes,
        created_at: schema.files.created_at,
      }).from(schema.files).where(eq(schema.files.owner_id, userId)).orderBy(desc(schema.files.created_at));
    })
    .get("/files/:id", async ({ params: { id }, userId, set }) => {
      const files = await db.select({
        original_name: schema.files.original_name,
        storage_name: schema.files.storage_name,
        mime_type: schema.files.mime_type,
      }).from(schema.files).where(and(eq(schema.files.id, id), eq(schema.files.owner_id, userId)));
      const file = files[0];
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
