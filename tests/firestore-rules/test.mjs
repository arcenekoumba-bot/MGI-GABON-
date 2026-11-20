import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, addDoc } from 'firebase/firestore';

const projectId = 'demo-mgi-security';
const env = await initializeTestEnvironment({
  projectId,
  firestore: { rules: fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
});

const landlordUid = 'landlordUID000000000001';
const tenantUid = 'tenantUID00000000000001';
const outsiderUid = 'outsiderUID0000000000001';
const unverifiedUid = 'unverifiedUID00000000001';
const landlord = { email: 'bailleur@example.test', email_verified: true };
const tenant = { email: 'locataire@example.test', email_verified: true };
const outsider = { email: 'autre@example.test', email_verified: true };
const unverified = { email: 'nonverifie@example.test', email_verified: false };
const contractId = 'contract123';
const pendingId = 'pending123';
const contract = {
  statut: 'valide',
  bailleurEmail: landlord.email,
  bailleurUid: landlordUid,
  locataireEmail: tenant.email,
  locataireUid: tenantUid,
};

try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'contrats', contractId), contract);
    await setDoc(doc(db, 'contratsEnAttente', pendingId), {
      statut: 'en_attente_locataire', bailleurEmail: landlord.email,
      bailleurUid: landlordUid, locataireEmail: tenant.email,
    });
    await setDoc(doc(db, 'incidents', 'incident123'), {
      statut: 'Ouvert', bailleurEmail: landlord.email, locataireEmail: tenant.email,
      contratId: contractId, locataireUid: tenantUid,
    });
  });

  const bdb = env.authenticatedContext(landlordUid, landlord).firestore();
  const tdb = env.authenticatedContext(tenantUid, tenant).firestore();
  const odb = env.authenticatedContext(outsiderUid, outsider).firestore();
  const udb = env.authenticatedContext(unverifiedUid, unverified).firestore();

  await assertSucceeds(getDoc(doc(tdb, 'contrats', contractId)));
  await assertFails(getDoc(doc(odb, 'contrats', contractId)));
  await assertFails(getDoc(doc(udb, 'contrats', contractId)));

  await assertSucceeds(setDoc(doc(tdb, 'contrats', 'accepted456'), {
    ...contract, contratAttenteId: pendingId,
    signatureLocataire: 'sig-tenant', signatureBailleur: 'sig-landlord',
  }));
  await assertFails(setDoc(doc(odb, 'contrats', 'forged456'), {
    ...contract, contratAttenteId: pendingId,
    signatureLocataire: 'sig-other', signatureBailleur: 'sig-landlord',
    locataireEmail: outsider.email, locataireUid: outsiderUid,
  }));
  await assertFails(updateDoc(doc(tdb, 'contrats', contractId), { locataireEmail: outsider.email }));

  const msg = {
    auteurEmail: tenant.email, locataireEmail: tenant.email,
    bailleurEmail: landlord.email, contratId: contractId, texte: 'Bonjour', lu: false,
  };
  const msgRef = await assertSucceeds(addDoc(collection(tdb, 'messages'), msg));
  await assertFails(addDoc(collection(odb, 'messages'), {
    ...msg, auteurEmail: outsider.email, locataireEmail: outsider.email,
  }));
  await assertFails(updateDoc(doc(tdb, 'messages', msgRef.id), { texte: 'contenu modifié après envoi' }));
  await assertSucceeds(updateDoc(doc(bdb, 'messages', msgRef.id), { lu: true }));
  await assertFails(updateDoc(doc(bdb, 'messages', msgRef.id), { locataireEmail: outsider.email }));
  await assertSucceeds(getDocs(query(collection(bdb, 'messages'), where('bailleurEmail', '==', landlord.email))));

  await assertSucceeds(addDoc(collection(tdb, 'paiements'), {
    bailleurEmail: landlord.email, locataireEmail: tenant.email, contratId: contractId,
    origine: 'mobile_money_locataire', statut: 'En attente', montant: 1000,
  }));
  await assertFails(addDoc(collection(tdb, 'paiements'), {
    bailleurEmail: landlord.email, locataireEmail: tenant.email, contratId: contractId,
    origine: 'mobile_money_locataire', statut: 'À Jour', montant: 1000,
  }));
  await assertFails(addDoc(collection(tdb, 'paiements'), {
    bailleurEmail: outsider.email, locataireEmail: tenant.email, contratId: contractId,
    origine: 'mobile_money_locataire', statut: 'En attente', montant: 1000,
  }));

  await assertSucceeds(setDoc(doc(tdb, 'documentsPersonnels', 'personal123'), {
    proprietaireUid: tenantUid, proprietaireEmail: tenant.email,
    fournisseurStockage: 'supabase',
    cheminObjet: `users/${tenantUid}/personnels/personal123/attestation.pdf`,
  }));
  await assertFails(setDoc(doc(tdb, 'documentsPersonnels', 'forged123'), {
    proprietaireUid: tenantUid, proprietaireEmail: tenant.email,
    fournisseurStockage: 'supabase',
    cheminObjet: `users/${outsiderUid}/personnels/forged123/attestation.pdf`,
  }));
  await assertSucceeds(getDocs(query(collection(tdb, 'documentsPersonnels'), where('proprietaireEmail', '==', tenant.email))));

  await assertSucceeds(addDoc(collection(tdb, 'signaturesLocataire'), {
    locataireEmail: tenant.email, signatureImage: 'signature', dateSig: '19/11/2026',
  }));
  await assertFails(addDoc(collection(tdb, 'signaturesLocataire'), {
    locataireEmail: tenant.email, bailleurEmail: outsider.email, contratId: contractId,
    signatureImage: 'signature', dateSig: '19/11/2026',
  }));

  await assertSucceeds(setDoc(doc(tdb, 'documentsRecusBailleur', 'shared123'), {
    bailleurEmail: landlord.email, locataireEmail: tenant.email, locataireUid: tenantUid,
    contratId: contractId, fournisseurStockage: 'supabase',
    cheminObjet: `users/${tenantUid}/personnels/shared123/justificatif.pdf`,
  }));
  await assertFails(setDoc(doc(tdb, 'documentsRecusBailleur', 'shared456'), {
    bailleurEmail: outsider.email, locataireEmail: tenant.email, locataireUid: tenantUid,
    contratId: contractId, fournisseurStockage: 'supabase',
    cheminObjet: `users/${tenantUid}/personnels/shared456/justificatif.pdf`,
  }));
  await assertSucceeds(getDocs(query(collection(bdb, 'documentsRecusBailleur'), where('bailleurEmail', '==', landlord.email))));
  await assertSucceeds(addDoc(collection(bdb, 'immeubles'), {
    nom: 'Immeuble test', bailleurEmail: landlord.email, bailleurUid: landlordUid,
  }));
  await assertSucceeds(getDocs(query(collection(bdb, 'immeubles'), where('bailleurEmail', '==', landlord.email))));

  await assertSucceeds(updateDoc(doc(bdb, 'incidents', 'incident123'), { statut: 'En cours' }));
  await assertFails(updateDoc(doc(bdb, 'incidents', 'incident123'), { locataireEmail: outsider.email }));
  await assertSucceeds(addDoc(collection(bdb, 'documentsLocataire'), {
    type: 'statut_incident', bailleurEmail: landlord.email,
    locataireEmail: tenant.email, incidentId: 'incident123', statut: 'En cours',
  }));
  await assertFails(addDoc(collection(odb, 'documentsLocataire'), {
    type: 'statut_incident', bailleurEmail: outsider.email,
    locataireEmail: tenant.email, incidentId: 'incident123', statut: 'En cours',
  }));

  console.log('PASS: règles Firestore — autorisations et refus testés.');
} finally {
  await env.cleanup();
}
