/* MGI — client de stockage Supabase
 * Ce fichier ne contient aucune clé secrète.
 * Il appelle une Edge Function qui vérifie le jeton Firebase avant tout accès.
 */
(function () {
  'use strict';

  const CONFIG = window.MGI_SUPABASE_CONFIG || {};
  const MAX_BYTES = 5 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

  function requireConfig() {
    if (!CONFIG.functionUrl) {
      throw new Error('Stockage Supabase non configuré : URL de fonction absente.');
    }
  }

  function validateFile(file) {
    if (!(file instanceof File)) throw new Error('Fichier invalide.');
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error('Format refusé. Utilisez un PDF, un JPG ou un PNG.');
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      throw new Error('Fichier trop volumineux. La limite est de 5 Mo.');
    }
  }

  function safeName(name) {
    return String(name || 'document')
      .normalize('NFKC')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
  }

  function pathFor(uid, category, documentId, fileName) {
    if (!/^[A-Za-z0-9_-]{10,150}$/.test(String(uid || ''))) {
      throw new Error('Identifiant utilisateur invalide.');
    }
    const categories = new Set(['personnels', 'contrats', 'quittances', 'incidents']);
    if (!categories.has(category)) throw new Error('Catégorie de fichier invalide.');
    const id = String(documentId || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
    if (!id) throw new Error('Identifiant de document manquant.');
    return `users/${uid}/${category}/${id}/${safeName(fileName)}`;
  }

  async function firebaseToken() {
    if (!window.firebase || !firebase.auth || !firebase.auth().currentUser) {
      throw new Error('Vous devez être connecté pour envoyer un fichier.');
    }
    return firebase.auth().currentUser.getIdToken(true);
  }

  async function call(action, body, file) {
    requireConfig();
    const token = await firebaseToken();
    const form = new FormData();
    form.append('action', action);
    form.append('body', JSON.stringify(body || {}));
    if (file) form.append('file', file, file.name);

    const response = await fetch(CONFIG.functionUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Erreur de stockage (${response.status}).`);
    return result;
  }

  window.MGIStorage = {
    MAX_BYTES,
    ALLOWED_TYPES,
    pathFor,
    async upload({ uid, category, documentId, file }) {
      validateFile(file);
      const path = pathFor(uid, category, documentId, file.name);
      return call('upload', {
        path,
        mimeType: file.type,
        size: file.size,
        originalName: file.name
      }, file);
    },
    async signedUrl(path, expiresIn = 300) {
      if (!String(path || '').startsWith('users/')) throw new Error('Chemin de fichier invalide.');
      return call('signedUrl', { path, expiresIn });
    },
    async sharedUrl(documentId, expiresIn = 300) {
      if (!/^[A-Za-z0-9_-]{10,200}$/.test(String(documentId || ''))) {
        throw new Error('Identifiant de document invalide.');
      }
      return call('sharedUrl', { documentId, expiresIn });
    },
    async remove(path) {
      if (!String(path || '').startsWith('users/')) throw new Error('Chemin de fichier invalide.');
      return call('delete', { path });
    }
  };
})();
