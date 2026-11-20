import { createClient } from 'npm:@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'npm:jose@5';

const ALLOWED_ORIGIN = 'https://arcenekoumba-bot.github.io';
const BUCKET = 'MGI documents';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIGNED_URL_SECONDS = 900;
const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || 'mgi-gabon';
const firebaseIssuer = `https://securetoken.google.com/${projectId}`;
const googleKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '600',
  'Vary': 'Origin',
};

type FirebaseClaims = JWTPayload & {
  email?: string;
  email_verified?: boolean;
  firebase?: { sign_in_provider?: string };
};

type AuthenticatedUser = {
  uid: string;
  email: string;
  token: string;
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function cleanPath(value: unknown): string {
  if (typeof value !== 'string' || !/^users\/[A-Za-z0-9_-]{10,150}\/(personnels|contrats|quittances|incidents)\/[A-Za-z0-9_-]{1,80}\/[A-Za-z0-9._-]{1,120}$/.test(value)) {
    throw new HttpError(400, 'Chemin de fichier refusé.');
  }
  return value;
}

function ownsPath(path: string, uid: string): boolean {
  return path.startsWith(`users/${uid}/`);
}

function validDocumentId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
}

function getStorage() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  let secretKey = Deno.env.get('MGI_STORAGE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secretKey) {
    try {
      secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    } catch {
      secretKey = undefined;
    }
  }
  if (!supabaseUrl || !secretKey) throw new Error('Configuration Supabase Storage absente.');
  return createClient(supabaseUrl, secretKey).storage.from(BUCKET);
}

async function authenticate(req: Request): Promise<AuthenticatedUser> {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'Authentification requise.');

  let payload: FirebaseClaims;
  try {
    const verified = await jwtVerify(token, googleKeys, { issuer: firebaseIssuer, audience: projectId });
    payload = verified.payload as FirebaseClaims;
  } catch {
    throw new HttpError(401, 'Jeton Firebase invalide ou expiré.');
  }

  if (typeof payload.sub !== 'string' || !payload.firebase) {
    throw new HttpError(401, 'Jeton Firebase invalide.');
  }
  if (payload.email_verified !== true || typeof payload.email !== 'string' || !payload.email.trim()) {
    throw new HttpError(403, 'Une adresse e-mail vérifiée est obligatoire.');
  }

  return { uid: payload.sub, email: payload.email.trim().toLowerCase(), token };
}

async function firestoreDocument(user: AuthenticatedUser, collection: string, id: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${user.token}`, Accept: 'application/json' },
  });
  if (!response.ok) return null;
  return await response.json();
}

function stringField(doc: Record<string, any> | null, name: string): string {
  const value = doc?.fields?.[name]?.stringValue;
  return typeof value === 'string' ? value : '';
}

function requestedExpiry(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 300;
  return Math.min(Math.max(Math.floor(number), 60), MAX_SIGNED_URL_SECONDS);
}

async function sniffMimeType(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isPdf = bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (isPdf) return 'application/pdf';
  if (isJpeg) return 'image/jpeg';
  if (isPng) return 'image/png';
  throw new HttpError(400, 'Le contenu réel du fichier ne correspond pas à un format autorisé (PDF, JPEG ou PNG).');
}

async function createSharedUrl(user: AuthenticatedUser, documentId: unknown, expiresIn: unknown) {
  if (!validDocumentId(documentId)) throw new HttpError(400, 'Document partagé introuvable.');

  const document = await firestoreDocument(user, 'documentsRecusBailleur', documentId);
  if (!document) throw new HttpError(403, 'Document non accessible pour ce bailleur.');

  const bailleurEmail = stringField(document, 'bailleurEmail').toLowerCase();
  const locataireEmail = stringField(document, 'locataireEmail').toLowerCase();
  const locataireUid = stringField(document, 'locataireUid');
  const contractId = stringField(document, 'contratId');
  const sharedPath = stringField(document, 'cheminObjet');
  if (!bailleurEmail || bailleurEmail !== user.email || !locataireEmail || !locataireUid || !validDocumentId(contractId)) {
    throw new HttpError(403, 'Accès partagé refusé.');
  }

  const match = sharedPath.match(/^users\/([A-Za-z0-9_-]{10,150})\/personnels\/([A-Za-z0-9_-]{1,80})\/([A-Za-z0-9._-]{1,120})$/);
  if (!match || match[1] !== locataireUid || match[2] !== documentId) {
    throw new HttpError(403, 'Le fichier ne correspond pas au document partagé.');
  }

  const contract = await firestoreDocument(user, 'contrats', contractId);
  if (!contract
    || stringField(contract, 'statut') !== 'valide'
    || stringField(contract, 'bailleurEmail').toLowerCase() !== user.email
    || stringField(contract, 'locataireEmail').toLowerCase() !== locataireEmail
    || stringField(contract, 'locataireUid') !== locataireUid
    || stringField(contract, 'bailleurUid') !== user.uid) {
    throw new HttpError(403, 'Aucun contrat actif ne confirme ce partage.');
  }

  const storage = getStorage();
  const seconds = requestedExpiry(expiresIn);
  const { data, error } = await storage.createSignedUrl(sharedPath, seconds);
  if (error || !data?.signedUrl) throw new HttpError(404, 'Fichier introuvable ou indisponible.');
  return { ok: true, path: sharedPath, signedUrl: data.signedUrl, expiresIn: seconds };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.headers.get('origin') && req.headers.get('origin') !== ALLOWED_ORIGIN) {
    return json({ error: 'Origine non autorisée.' }, 403);
  }
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  try {
    const user = await authenticate(req);
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new HttpError(400, 'Formulaire invalide.');
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(String(form.get('body') || '{}')) as Record<string, unknown>;
    } catch {
      throw new HttpError(400, 'Paramètres invalides.');
    }

    const action = String(form.get('action') || '');
    if (action === 'sharedUrl') {
      const result = await createSharedUrl(user, body.documentId, body.expiresIn);
      return json(result);
    }

    if (!['upload', 'signedUrl', 'delete'].includes(action)) {
      throw new HttpError(400, 'Action inconnue.');
    }

    const path = cleanPath(body.path);
    if (!ownsPath(path, user.uid)) throw new HttpError(403, 'Accès refusé à ce document.');
    const storage = getStorage();

    if (action === 'upload') {
      const file = form.get('file');
      if (!(file instanceof File)) throw new HttpError(400, 'Fichier manquant.');
      if (file.size <= 0 || file.size > MAX_BYTES) throw new HttpError(400, 'Fichier trop volumineux (5 Mo maximum).');
      const mimeType = await sniffMimeType(file);
      if (file.type && file.type !== mimeType) throw new HttpError(400, 'Le type MIME déclaré ne correspond pas au contenu du fichier.');
      const { error } = await storage.upload(path, file, { contentType: mimeType, upsert: false });
      if (error) throw new HttpError(400, error.message);
      return json({ ok: true, path, size: file.size, mimeType });
    }

    if (action === 'signedUrl') {
      const seconds = requestedExpiry(body.expiresIn);
      const { data, error } = await storage.createSignedUrl(path, seconds);
      if (error || !data?.signedUrl) throw new HttpError(404, 'Fichier introuvable ou indisponible.');
      return json({ ok: true, path, signedUrl: data.signedUrl, expiresIn: seconds });
    }

    const { error } = await storage.remove([path]);
    if (error) throw new HttpError(400, error.message);
    return json({ ok: true, path });
  } catch (error) {
    console.error('MGI Storage request failed:', error);
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    return json({ error: 'Une erreur interne est survenue. Réessayez ou contactez l’administrateur.' }, 500);
  }
});
