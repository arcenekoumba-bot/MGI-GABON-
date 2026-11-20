# Sécurité — prérequis avant déploiement public

Ce document décrit le lot de sécurité préparé dans le dépôt. La présence des fichiers dans GitHub ou dans `main` ne déploie pas automatiquement les règles Firestore ni la fonction Supabase ; leur mise en service nécessite des opérations séparées. La publication du site statique dépend de la branche configurée dans GitHub Pages.

## Changements préparés

- Les accès Firestore sont refusés aux comptes dont l’adresse Firebase n’est pas vérifiée.
- Les messages, paiements, quittances, incidents et documents reçus sont rattachés à un contrat actif ; les champs d’identité des participants ne peuvent plus être changés par une mise à jour ordinaire.
- Les messages envoyés ne peuvent plus être réécrits ; le destinataire peut seulement marquer la lecture.
- Les fichiers personnels doivent être rangés sous l’UID du propriétaire et leur chemin est vérifié dans les règles et dans la fonction Supabase.
- Le partage d’un fichier exige un document reçu, le bon bailleur, le bon locataire, le chemin du fichier associé à l’identifiant du document et un contrat actif cohérent. Les URL signées restent temporaires.
- Le serveur vérifie la signature du jeton Firebase, l’e-mail vérifié, la taille réelle et la signature binaire du fichier PDF/JPEG/PNG. Aucun secret de service n’est ajouté au dépôt.
- Une demande Mobile Money n’est plus enregistrée comme un loyer payé : son état initial devient « En attente » jusqu’à une confirmation réelle.
- Des tests automatisés des règles peuvent être exécutés sur le seul émulateur Firebase.

## Blocage important : données déjà présentes

**Ne pas publier les nouvelles règles avant une migration contrôlée des données existantes.** Les anciens contrats finalisés peuvent ne pas contenir `bailleurUid` et `locataireUid` ; les anciens documents reçus peuvent ne pas avoir `contratId` ou `locataireUid`. Le partage de ces fichiers sera volontairement refusé par la nouvelle fonction jusqu’à ce que le lien soit prouvé.

Avant migration, sauvegarder Firestore. Puis, avec un compte Firebase Admin conservé hors du dépôt, rattacher chaque contrat à des profils `users/{uid}` uniquement si les e-mails correspondent sans ambiguïté. Rattacher ensuite les documents, incidents, paiements et messages à un contrat précis. Les enregistrements ambigus ou orphelins doivent être examinés manuellement, pas devinés. Vérifier aussi les anciens chemins de stockage et que le bucket `MGI documents` est privé.

Si les comptes déjà créés n’ont pas vérifié leur adresse, l’application affichera un écran bloqué avec les boutons « renvoyer le courriel » et « j’ai vérifié mon adresse » ; ils doivent terminer cette étape pour retrouver l’accès.

## Contrôles encore requis avant le grand public

1. Réaliser et valider la migration sur une copie de sauvegarde, puis tester les comptes bailleur/locataire sur un environnement pilote.
2. Déployer séparément les règles Firestore et la fonction Supabase après revue ; vérifier les secrets serveur depuis le tableau de bord Supabase, jamais dans le dépôt.
3. Tester inscription, vérification e-mail, connexion, contrat signé, messages, incidents, quittances, téléversement, partage expiré et accès refusé à un tiers.
4. Le rôle est actuellement choisi par l’utilisateur à l’inscription : ne pas l’utiliser comme preuve d’identité ni comme rôle administrateur. Prévoir une procédure de contrôle des bailleurs si le service doit inspirer une confiance publique.
5. Le parcours Mobile Money demande à l’utilisateur de confirmer par USSD ; il ne constitue pas une preuve automatisée de paiement. Ne pas annoncer un paiement comme encaissé sans confirmation opérateur ou validation manuelle.
6. Ajouter et faire relire les mentions légales, conditions d’utilisation et politique de confidentialité adaptées aux documents, signatures et données locatives traités ; définir rétention, sauvegarde, assistance et procédure d’incident.
7. Vérifier les restrictions de la clé Web Firebase dans la console (domaines autorisés et API nécessaires), la configuration App Check et les alertes/budgets Firebase/Supabase.

## Tests locaux des règles

Depuis la racine du dépôt :

```sh
npm --prefix tests/firestore-rules install
npx firebase-tools emulators:exec --only firestore --project demo-mgi-security "npm --prefix tests/firestore-rules test"
```

Le projet `demo-mgi-security` est un projet de démonstration utilisé par l’émulateur ; cette commande ne déploie pas les règles sur Firebase.
