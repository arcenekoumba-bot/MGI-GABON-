# MGI — Checklist de test pilote

Cette checklist sert à valider les fonctions essentielles avant une démonstration ou l’ouverture à de vrais utilisateurs.

## Préparation des comptes

- [ ] Créer un compte bailleur A.
- [ ] Créer un compte bailleur B.
- [ ] Créer un compte locataire 1.
- [ ] Créer un compte locataire 2.
- [ ] Créer deux contrats pour le locataire 1 : deux logements chez le bailleur A.
- [ ] Créer un contrat pour le locataire 1 chez le bailleur B.
- [ ] Vérifier que chaque compte utilise une adresse e-mail différente.

## Quittances

- [ ] Le bailleur A sélectionne le logement 1 dans Générer une quittance.
- [ ] Vérifier que l’e-mail affiché correspond au locataire attendu.
- [ ] Générer la quittance.
- [ ] Vérifier le message de confirmation.
- [ ] Se connecter comme locataire 1.
- [ ] Ouvrir Mes Documents puis Mes Quittances de Loyer.
- [ ] Vérifier que la quittance apparaît une seule fois.
- [ ] Télécharger le PDF et vérifier l’adresse du bon logement.
- [ ] Refaire le test avec le logement 2.
- [ ] Vérifier que le locataire ne voit pas les quittances d’un autre compte.

## Contrats et signatures

- [ ] Envoyer un contrat du bailleur au locataire.
- [ ] Vérifier son apparition dans les contrats en attente.
- [ ] Signer sur téléphone.
- [ ] Vérifier la notification côté bailleur.
- [ ] Télécharger le contrat final avec les deux signatures.
- [ ] Vérifier qu’un autre locataire ne peut pas voir ce contrat.

## Incidents

- [ ] Côté locataire, ouvrir Signaler Incident.
- [ ] Vérifier le choix du logement/bailleur si plusieurs contrats existent.
- [ ] Envoyer un incident avec une photo.
- [ ] Refaire avec deux ou trois photos maximum.
- [ ] Vérifier l’affichage des miniatures côté bailleur.
- [ ] Ouvrir une photo dans la visionneuse intégrée.
- [ ] Modifier le statut : Ouvert → En cours → Résolu.
- [ ] Ajouter un commentaire bailleur.
- [ ] Archiver l’incident.
- [ ] Ouvrir l’onglet Archives.
- [ ] Restaurer l’incident.
- [ ] Vérifier que l’incident appartient au bon bailleur et au bon logement.

## Messagerie

- [ ] Envoyer un message bailleur → locataire.
- [ ] Répondre locataire → bailleur.
- [ ] Vérifier l’affichage immédiat du message envoyé.
- [ ] Vérifier la date et l’heure.
- [ ] Vérifier qu’un troisième compte ne voit pas la conversation.

## Documents privés

- [ ] Envoyer un document depuis le coffre-fort locataire.
- [ ] Télécharger le document avec un lien temporaire.
- [ ] Supprimer le document.
- [ ] Vérifier qu’il n’est plus téléchargeable.
- [ ] Refaire le test dans le coffre-fort bailleur.
- [ ] Ne jamais publier de clé secrète Supabase dans GitHub.

## Résultat du test

Pour chaque anomalie, noter :

1. le compte utilisé ;
2. le rôle : bailleur ou locataire ;
3. le logement concerné ;
4. l’action effectuée ;
5. le message affiché ;
6. une capture d’écran ;
7. l'heure approximative du test.

## Sécurité et confidentialité

- [ ] Se connecter avec un troisième compte et vérifier qu'il ne voit ni contrats, ni quittances, ni incidents, ni messages des autres comptes.
- [ ] Vérifier qu'un locataire ne peut pas ouvrir le document privé d'un autre locataire.
- [ ] Vérifier qu'un bailleur ne peut pas télécharger un document Supabase d'un autre bailleur.
- [ ] Vérifier qu'un lien temporaire de téléchargement expire après sa durée prévue.
- [ ] Tester un fichier PDF, JPG et PNG.
- [ ] Tester un fichier supérieur à 5 Mo et confirmer qu'il est refusé proprement.
- [ ] Tester un format non autorisé et confirmer qu'il est refusé.
- [ ] Vérifier qu'aucune clé Supabase `service_role`, mot de passe ou jeton privé n'est présent dans le dépôt public.
- [ ] Vérifier que la déconnexion masque immédiatement le tableau de bord, les paramètres, le coffre-fort et le chatbot.

## PWA et téléphone Android

- [ ] Ouvrir l'application depuis GitHub Pages en navigation privée.
- [ ] Vérifier que le formulaire de connexion s'affiche correctement.
- [ ] Installer MGI depuis le navigateur Android lorsque l'option est proposée.
- [ ] Vérifier le nom, l'icône et l'écran autonome de l'application installée.
- [ ] Fermer puis rouvrir l'application installée.
- [ ] Vérifier qu'une courte coupure réseau affiche au moins l'interface déjà mise en cache.
- [ ] Revenir en ligne et vérifier que Firebase fonctionne normalement après la reconnexion.
- [ ] Vérifier l'affichage en mode portrait sur un petit écran.
- [ ] Vérifier le mode sombre dans les contrats, quittances, messagerie, alertes et modales.

## Notifications et horodatage

- [ ] Toucher l'écran une fois avant le test sonore pour autoriser le bip mobile.
- [ ] Recevoir un message lorsque l'application est ouverte et vérifier l'alerte visuelle.
- [ ] Vérifier la vibration si elle est autorisée sur le téléphone.
- [ ] Vérifier que le bip ne se répète pas pour le même message.
- [ ] Vérifier le passage de « Envoyé » à « Lu ».
- [ ] Comparer l'heure d'un message, d'un paiement, d'une quittance et d'un incident après reconnexion.
- [ ] Vérifier que les nouvelles données conservent un horodatage serveur Firebase.

## Préparation du lancement pilote

- [ ] Choisir 3 à 5 testeurs volontaires et recueillir leur accord pour le test.
- [ ] Leur remettre uniquement l'URL de l'application, jamais une clé secrète.
- [ ] Préparer une adresse e-mail de support dédiée.
- [ ] Préparer un formulaire simple pour les bugs : compte, rôle, logement, action, message et capture d'écran.
- [ ] Faire relire les CGU, la politique de confidentialité et les mentions légales avant ouverture au public.
- [ ] Ajouter l'URL publique de la politique de confidentialité avant toute soumission au Play Store.

## Critères minimum avant pilote

- Les quittances sont visibles par le bon locataire.
- Les contrats sont isolés entre utilisateurs.
- Les photos d’incidents s’ouvrent correctement.
- Le choix du bailleur fonctionne pour les locataires multi-bailleurs.
- Les incidents peuvent être archivés et restaurés.
- Les documents privés ne sont pas accessibles par un autre compte.
- Aucun secret Supabase ou Firebase Admin n'est présent dans le dépôt public.
- Le manifest PWA contient le nom, l'icône, l'identifiant et les métadonnées Android nécessaires.
- Le service worker est renouvelé après chaque version importante de l'application.
- Les résultats du test sont conservés avec la date, l'appareil et la version testée.
