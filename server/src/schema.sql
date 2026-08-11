CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES pages(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Página sem título',
  icon text,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pages_owner_updated_idx ON pages(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS pages_content_search_idx ON pages USING gin(to_tsvector('portuguese', title || ' ' || content::text));

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id uuid REFERENCES pages(id) ON DELETE SET NULL,
  original_name text NOT NULL,
  storage_name text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS files_owner_created_idx ON files(owner_id, created_at DESC);
