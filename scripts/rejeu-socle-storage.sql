-- Socle storage minimal du conteneur de rejeu (D-083), applique par
-- scripts/rejeu-migrations.sh avant les tests pgTAP, et seulement si les
-- tables storage manquent.
--
-- Dans la pile reelle, storage.buckets et storage.objects sont creees par le
-- service storage-api (supabase/storage-api:v1.89.12) a son premier
-- demarrage ; l'image Postgres seule ne cree que le schema vide. Ce socle
-- reprend les colonnes de ces tables utilisees par SIGTB (relevees le
-- 2026-11-16 sur storage-api v1.89.12 : id, bucket_id, name, owner, metadata,
-- version ; id, name, public, file_size_limit, allowed_mime_types), le meme
-- proprietaire et les memes droits des comptes, puis pose le bucket et les
-- politiques par public.configurer_stockage_pieces(). Il ne sert qu'aux
-- tests : il n'est jamais applique sur le serveur. Le comportement du vrai
-- service (depot, lecture, ecrasement et suppression refuses, limites du
-- bucket) est verifie par scripts/integration-stockage.sh.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    RAISE NOTICE 'tables storage presentes : socle de rejeu non applique';
    RETURN;
  END IF;
  CREATE SCHEMA IF NOT EXISTS storage;
  CREATE TABLE storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    owner uuid,
    public boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
  CREATE TABLE storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text REFERENCES storage.buckets(id),
    name text,
    owner uuid,
    metadata jsonb,
    version text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (bucket_id, name)
  );
  ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;
  ALTER TABLE storage.objects OWNER TO supabase_storage_admin;
  ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON storage.buckets, storage.objects TO anon, authenticated, service_role, postgres;
END $$;

SELECT public.configurer_stockage_pieces();
