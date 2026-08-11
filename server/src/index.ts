import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import argon2 from "argon2";
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
  UPLOAD_DIR: z.string().default("/data/uploads"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_SSL: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
}).parse(process.env);

const app = Fastify({
  logger: { redact: ["req.headers.authorization", "req.headers.cookie", "password", "password_hash"] },
  bodyLimit: 1_000_000,
  trustProxy: env.NODE_ENV === "production",
});
const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : false,
});
const secret = new TextEncoder().encode(env.JWT_SECRET);
const SESSION_COOKIE = "orbe_session";

await app.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "no-referrer" },
});
await app.register(cors, { origin: env.APP_ORIGIN, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE"] });
await app.register(cookie);
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 5 } });
await mkdir(env.UPLOAD_DIR, { recursive: true });

app.addHook("onRequest", async (request, reply) => {
  if (!["POST", "PATCH", "DELETE"].includes(request.method)) return;
  const origin = request.headers.origin;
  if (origin && origin !== env.APP_ORIGIN) return reply.code(403).send({ message: "Origem não autorizada." });
});

async function tokenFor(userId: string) {
  return new SignJWT({ sub: userId, aud: "orbe-web", iss: "orbe-api" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}
async function setSession(reply: FastifyReply, userId: string) {
  reply.setCookie(SESSION_COOKIE, await tokenFor(userId), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}
async function auth(request: FastifyRequest) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) throw Object.assign(new Error("Não autenticado"), { statusCode: 401 });
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"], audience: "orbe-web", issuer: "orbe-api" });
  if (!payload.sub) throw Object.assign(new Error("Sessão inválida"), { statusCode: 401 });
  return payload.sub;
}

const credentials = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

app.post("/auth/register", { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const input = credentials.parse(request.body);
  const hash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 3, parallelism: 1 });
  try {
    const result = await pool.query("INSERT INTO users(email, password_hash) VALUES($1,$2) RETURNING id,email", [input.email, hash]);
    await setSession(reply, result.rows[0].id);
    return reply.code(201).send({ user: result.rows[0] });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return reply.code(409).send({ message: "Este e-mail já está em uso." });
    throw error;
  }
});

app.post("/auth/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const input = credentials.parse(request.body);
  const result = await pool.query("SELECT id,email,password_hash FROM users WHERE email=$1", [input.email]);
  const user = result.rows[0];
  if (!user || !(await argon2.verify(user.password_hash, input.password))) return reply.code(401).send({ message: "Credenciais inválidas." });
  await setSession(reply, user.id);
  return { user: { id: user.id, email: user.email } };
});

app.get("/auth/me", async (request) => {
  const userId = await auth(request);
  const result = await pool.query("SELECT id,email FROM users WHERE id=$1", [userId]);
  if (!result.rows[0]) throw Object.assign(new Error("Sessão inválida"), { statusCode: 401 });
  return { user: result.rows[0] };
});

app.post("/auth/logout", async (_request, reply) => {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
  return { ok: true };
});

app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { status: "ok" };
});

app.get("/api/pages", async (request) => {
  const userId = await auth(request);
  const result = await pool.query("SELECT id,parent_id,title,icon,content,is_favorite,updated_at FROM pages WHERE owner_id=$1 ORDER BY updated_at DESC", [userId]);
  return result.rows;
});

app.post("/api/pages", async (request, reply) => {
  const userId = await auth(request);
  const input = z.object({
    title: z.string().trim().min(1).max(300).default("Página sem título"),
    parentId: z.string().uuid().nullable().optional(),
    icon: z.string().max(8).nullable().optional(),
    content: z.array(z.object({ type: z.string().max(50), data: z.record(z.string(), z.unknown()) })).max(200).default([]),
  }).parse(request.body);
  const result = await pool.query(
    "INSERT INTO pages(owner_id,parent_id,title,icon,content) VALUES($1,$2,$3,$4,$5) RETURNING id,parent_id,title,icon,content,is_favorite,updated_at",
    [userId, input.parentId ?? null, input.title, input.icon ?? null, JSON.stringify(input.content)],
  );
  return reply.code(201).send(result.rows[0]);
});

app.patch("/api/pages/:id", async (request, reply) => {
  const userId = await auth(request);
  const id = z.string().uuid().parse((request.params as { id: string }).id);
  const input = z.object({
    title: z.string().trim().min(1).max(300),
    content: z.array(z.object({ type: z.string().max(50), data: z.record(z.string(), z.unknown()) })).max(200),
    isFavorite: z.boolean(),
  }).partial().parse(request.body);
  const result = await pool.query(
    "UPDATE pages SET title=COALESCE($1,title),content=COALESCE($2,content),is_favorite=COALESCE($3,is_favorite),updated_at=now() WHERE id=$4 AND owner_id=$5 RETURNING id,parent_id,title,icon,content,is_favorite,updated_at",
    [input.title ?? null, input.content ? JSON.stringify(input.content) : null, input.isFavorite ?? null, id, userId],
  );
  if (!result.rowCount) return reply.code(404).send({ message: "Página não encontrada." });
  return result.rows[0];
});

app.delete("/api/pages/:id", async (request, reply) => {
  const userId = await auth(request);
  const id = z.string().uuid().parse((request.params as { id: string }).id);
  const result = await pool.query("DELETE FROM pages WHERE id=$1 AND owner_id=$2", [id, userId]);
  return result.rowCount ? reply.code(204).send() : reply.code(404).send({ message: "Página não encontrada." });
});

app.get("/api/files", async (request) => {
  const userId = await auth(request);
  const result = await pool.query("SELECT id,original_name,mime_type,size_bytes,created_at FROM files WHERE owner_id=$1 ORDER BY created_at DESC", [userId]);
  return result.rows;
});

app.get("/api/files/:id", async (request, reply) => {
  const userId = await auth(request);
  const id = z.string().uuid().parse((request.params as { id: string }).id);
  const result = await pool.query("SELECT original_name,storage_name,mime_type FROM files WHERE id=$1 AND owner_id=$2", [id, userId]);
  const file = result.rows[0];
  if (!file) return reply.code(404).send({ message: "Arquivo não encontrado." });
  reply.header("Content-Type", file.mime_type);
  reply.header("Content-Disposition", "inline; filename*=UTF-8''" + encodeURIComponent(file.original_name));
  reply.header("X-Content-Type-Options", "nosniff");
  return reply.send(createReadStream(join(env.UPLOAD_DIR, file.storage_name)));
});

app.post("/api/files", async (request, reply) => {
  const userId = await auth(request);
  const part = await request.file();
  if (!part) return reply.code(400).send({ message: "Arquivo ausente." });
  const safeExt = extname(part.filename).replace(/[^.a-zA-Z0-9]/g, "").slice(0, 12);
  const storageName = randomUUID() + safeExt;
  const target = join(env.UPLOAD_DIR, storageName);
  try {
    await pipeline(part.file, createWriteStream(target, { flags: "wx", mode: 0o600 }));
    const size = part.file.bytesRead;
    const result = await pool.query(
      "INSERT INTO files(owner_id,original_name,storage_name,mime_type,size_bytes) VALUES($1,$2,$3,$4,$5) RETURNING id,original_name,mime_type,size_bytes,created_at",
      [userId, part.filename.slice(0, 500), storageName, part.mimetype.slice(0, 150), size],
    );
    return reply.code(201).send(result.rows[0]);
  } catch (error) {
    await unlink(target).catch(() => undefined);
    throw error;
  }
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof z.ZodError) return reply.code(400).send({ message: "Dados inválidos.", issues: error.issues });
  const appError = error instanceof Error ? error : new Error("Erro desconhecido");
  const status = (appError as Error & { statusCode?: number }).statusCode ?? 500;
  if (status >= 500) app.log.error(appError);
  return reply.code(status).send({ message: status >= 500 ? "Erro interno." : appError.message });
});

app.addHook("onClose", async () => pool.end());
await app.listen({ host: "0.0.0.0", port: env.PORT });
