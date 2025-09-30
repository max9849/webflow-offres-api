{
  "cms_collection_name": "Offres d'emploi",
  
  "cms_fields": [
    {
      "field_name": "Post",
      "api_identifier": "post",
      "field_type": "Plain text",
      "required": true,
      "description": "Titre du poste (ex: Développeur Web, Comptable, Chef de projet...)"
    },
    {
      "field_name": "Slug",
      "api_identifier": "slug",
      "field_type": "Plain text",
      "required": true,
      "unique": true,
      "auto_generated": true,
      "description": "URL de l'offre (généré automatiquement par le serveur)"
    },
    {
      "field_name": "Description du poste",
      "api_identifier": "description-du-poste",
      "field_type": "Rich text",
      "required": false,
      "description": "Description générale du poste et de ses missions"
    },
    {
      "field_name": "Nom de l'entreprise",
      "api_identifier": "nom-de-lentreprise",
      "field_type": "Plain text",
      "required": false,
      "description": "Nom de l'entreprise qui recrute"
    },
    {
      "field_name": "Lieu",
      "api_identifier": "lieu",
      "field_type": "Plain text",
      "required": false,
      "description": "Lieu de travail (ville, canton, pays)"
    },
    {
      "field_name": "Type de contrat",
      "api_identifier": "type-de-contrat",
      "field_type": "Plain text",
      "required": false,
      "description": "Type de contrat (CDI, CDD, Temporaire, Stage...)"
    },
    {
      "field_name": "Salaire",
      "api_identifier": "salaire",
      "field_type": "Plain text",
      "required": false,
      "description": "Fourchette de salaire (ex: 80'000 - 100'000 CHF/an)"
    },
    {
      "field_name": "Email",
      "api_identifier": "email",
      "field_type": "Email",
      "required": false,
      "description": "Email de contact pour candidater"
    },
    {
      "field_name": "Téléphone",
      "api_identifier": "téléphone",
      "field_type": "Phone",
      "required": false,
      "description": "Numéro de téléphone de contact"
    },
    {
      "field_name": "Adresse",
      "api_identifier": "adresse",
      "field_type": "Plain text",
      "required": false,
      "description": "Adresse postale complète de l'entreprise"
    },
    {
      "field_name": "Responsabilités",
      "api_identifier": "responsabilites",
      "field_type": "Rich text",
      "required": false,
      "description": "Liste des responsabilités et tâches principales du poste"
    },
    {
      "field_name": "Profil",
      "api_identifier": "profil",
      "field_type": "Rich text",
      "required": false,
      "description": "Profil recherché : compétences, expérience, formation requise"
    }
  ],

  "variables_environnement": {
    "WEBFLOW_TOKEN": {
      "description": "Token d'API Webflow (à obtenir depuis Webflow > Site Settings > Apps & Integrations)",
      "required": true,
      "format": "Bearer token string",
      "exemple": "1234567890abcdef1234567890abcdef"
    },
    "WEBFLOW_COLLECTION_ID": {
      "description": "ID de la collection CMS Webflow (à obtenir depuis l'URL de la collection)",
      "required": true,
      "format": "String (ex: 64f5a1b2c3d4e5f6g7h8i9j0)",
      "exemple": "64f5a1b2c3d4e5f6g7h8i9j0"
    },
    "PORT": {
      "description": "Port du serveur",
      "required": false,
      "default": 8080,
      "format": "Number"
    }
  },

  "exemple_payload_creation": {
    "post": "Développeur Full Stack",
    "description": "Nous recherchons un développeur passionné pour rejoindre notre équipe.",
    "company": "TechCorp SA",
    "location": "Lausanne, Vaud",
    "type": "CDI",
    "salary": "90'000 - 110'000 CHF/an",
    "email": "jobs@techcorp.ch",
    "telephone": "+41 21 555 12 34",
    "address": "Avenue de la Gare 12, 1003 Lausanne",
    "responsibilities": "- Développer des applications web\n- Maintenir le code existant\n- Collaborer avec l'équipe",
    "profile": "- 3+ ans d'expérience\n- Maîtrise de React et Node.js\n- Excellente communication",
    "publish": true
  },

  "exemple_payload_modification": {
    "post": "Développeur Full Stack Senior",
    "salary": "100'000 - 120'000 CHF/an",
    "description": "Description mise à jour du poste"
  },

  "endpoints_api": {
    "base_url": "https://webflow-offres-api.onrender.com",
    "routes": [
      {
        "method": "GET",
        "path": "/health",
        "description": "Health check du serveur",
        "exemple_response": {
          "ok": true,
          "api": "v2",
          "timestamp": "2025-09-30T18:00:00.000Z"
        }
      },
      {
        "method": "GET",
        "path": "/api/offres",
        "description": "Récupérer toutes les offres publiées",
        "query_params": {
          "limit": "Nombre max d'offres (default: 20, max: 100)",
          "offset": "Offset pour pagination (default: 0)"
        },
        "exemple_response": {
          "ok": true,
          "count": 15,
          "items": [
            {
              "id": "abc123",
              "name": "Développeur Web",
              "post": "Développeur Web",
              "slug": "developpeur-web-123456",
              "description-du-poste": "Description...",
              "nom-de-lentreprise": "TechCorp",
              "lieu": "Lausanne",
              "type-de-contrat": "CDI",
              "salaire": "80k-100k CHF",
              "email": "jobs@techcorp.ch",
              "téléphone": "+41 21 555 1234",
              "adresse": "Rue de la Tech 1",
              "responsabilites": "Responsabilités...",
              "profil": "Profil recherché..."
            }
          ],
          "pagination": {
            "limit": 20,
            "offset": 0
          }
        }
      },
      {
        "method": "POST",
        "path": "/api/offres",
        "description": "Créer une nouvelle offre",
        "body": "voir exemple_payload_creation",
        "exemple_response": {
          "ok": true,
          "item": {
            "id": "generated_id",
            "fieldData": {}
          }
        }
      },
      {
        "method": "PUT",
        "path": "/api/offres/:itemId",
        "description": "Modifier une offre existante",
        "body": "voir exemple_payload_modification",
        "exemple_response": {
          "ok": true,
          "item": {
            "id": "item_id",
            "fieldData": {}
          }
        }
      },
      {
        "method": "DELETE",
        "path": "/api/offres/:itemId",
        "description": "Supprimer une offre",
        "exemple_response": {
          "ok": true,
          "message": "Item deleted successfully"
        }
      },
      {
        "method": "GET",
        "path": "/api/offres/:itemId",
        "description": "Récupérer une offre par son ID",
        "exemple_response": {
          "ok": true,
          "item": {}
        }
      },
      {
        "method": "GET",
        "path": "/api/offres-by-slug/:slug",
        "description": "Récupérer une offre par son slug",
        "exemple_response": {
          "ok": true,
          "item": {}
        }
      }
    ]
  },

  "instructions_deployment": {
    "etape_1_webflow_cms": {
      "titre": "Configuration du CMS Webflow",
      "actions": [
        "1. Aller dans Webflow > CMS",
        "2. Créer une nouvelle collection 'Offres d'emploi'",
        "3. Ajouter tous les 12 champs listés dans 'cms_fields'",
        "4. IMPORTANT: Respecter EXACTEMENT les 'api_identifier' (sensible à la casse!)",
        "5. Le champ 'Post' doit être le titre (Name field)",
        "6. Le champ 'Slug' doit être unique et auto-généré",
        "7. Sauvegarder la collection"
      ]
    },
    "etape_2_webflow_api": {
      "titre": "Obtenir les credentials Webflow",
      "actions": [
        "1. Aller dans Site Settings > Apps & Integrations",
        "2. Dans la section 'API Access', cliquer 'Generate API token'",
        "3. Copier le token (commence par 'wf_...')",
        "4. Ouvrir la collection CMS dans l'éditeur",
        "5. Regarder l'URL: ...collections/[COLLECTION_ID]",
        "6. Copier le COLLECTION_ID"
      ]
    },
    "etape_3_render_deployment": {
      "titre": "Déploiement sur Render.com",
      "actions": [
        "1. Créer un compte sur render.com",
        "2. Créer un nouveau 'Web Service'",
        "3. Connecter votre repository GitHub",
        "4. Configuration Build:",
        "   - Build Command: npm install",
        "   - Start Command: node server.js",
        "5. Ajouter les variables d'environnement:",
        "   - WEBFLOW_TOKEN = [votre token]",
        "   - WEBFLOW_COLLECTION_ID = [votre collection id]",
        "   - PORT = 8080",
        "6. Cliquer 'Create Web Service'",
        "7. Attendre le déploiement (5-10 min)",
        "8. Copier l'URL de votre API (ex: https://xxx.onrender.com)"
      ]
    },
    "etape_4_webflow_integration": {
      "titre": "Intégration dans Webflow",
      "actions": [
        "1. ADMIN: Créer une page 'Administration' (cachée)",
        "2. Ajouter un élément 'Embed' sur la page",
        "3. Copier-coller le code de l'artefact 1 (ADMIN)",
        "4. Remplacer 'https://webflow-offres-api.onrender.com' par VOTRE URL Render",
        "5. PUBLIC: Créer/modifier la page 'Offres d'emploi'",
        "6. Ajouter un élément 'Embed' sur la page",
        "7. Copier-coller le code de l'artefact 2 (PUBLIC)",
        "8. Remplacer 'https://webflow-offres-api.onrender.com' par VOTRE URL Render",
        "9. Publier le site Webflow"
      ]
    },
    "etape_5_tests": {
      "titre": "Tests de validation",
      "actions": [
        "1. Tester le health check:",
        "   GET https://votre-api.onrender.com/health",
        "2. Aller sur la page Admin dans Webflow",
        "3. Créer une nouvelle offre de test",
        "4. Vérifier qu'elle apparaît dans la liste",
        "5. Modifier l'offre et sauvegarder",
        "6. Aller sur la page publique 'Offres d'emploi'",
        "7. Vérifier que l'offre s'affiche correctement",
        "8. Tester la recherche",
        "9. Tester le bouton 'Postuler' (email)",
        "10. Retour admin: supprimer l'offre de test"
      ]
    }
  },

  "package_json": {
    "name": "valrjob-api",
    "version": "1.0.0",
    "type": "module",
    "description": "API pour valrjob.ch - Gestion des offres d'emploi",
    "main": "server.js",
    "scripts": {
      "start": "node server.js",
      "dev": "nodemon server.js"
    },
    "dependencies": {
      "express": "^4.18.2",
      "axios": "^1.6.2",
      "cors": "^2.8.5",
      "dotenv": "^16.3.1"
    },
    "devDependencies": {
      "nodemon": "^3.0.2"
    },
    "engines": {
      "node": ">=18.0.0"
    }
  },

  "fichier_env_exemple": {
    "nom_fichier": ".env",
    "contenu": "# Webflow API Credentials\nWEBFLOW_TOKEN=wf_your_token_here\nWEBFLOW_COLLECTION_ID=your_collection_id_here\n\n# Server Configuration\nPORT=8080"
  },

  "notes_importantes": {
    "cors": "Le serveur autorise uniquement valrjob.ch et www.valrjob.ch. Ajoutez d'autres domaines si nécessaire dans le code serveur.",
    "rate_limits": "L'API Webflow a des limites de requêtes (environ 60/min). Utilisez la pagination pour les grandes listes.",
    "securite": "Le panel admin n'a PAS d'authentification. Protégez l'accès via Webflow (page password-protected) ou ajoutez une authentification.",
    "slug": "Les slugs ne sont générés qu'à la CRÉATION. Lors des modifications, le slug existant est conservé pour éviter les conflits.",
    "publication": "Par défaut, les offres sont publiées immédiatement. Définissez 'publish: false' pour créer des brouillons.",
    "cache": "Render.com peut mettre en veille les services gratuits après 15 min d'inactivité. La première requête peut prendre 30-60 secondes.",
    "logs": "Consultez les logs sur Render.com pour déboguer les erreurs. Le code admin affiche aussi des logs détaillés dans la console du navigateur (F12).",
    "backup": "Pensez à faire des exports réguliers de vos offres depuis Webflow CMS.",
    "debug": "En cas d'erreur 500, ouvrez la console (F12) dans le navigateur pour voir les détails exacts de l'erreur retournée par le serveur."
  },

  "troubleshooting": {
    "erreur_500_sauvegarde": {
      "symptome": "Erreur 500 lors de la sauvegarde d'une offre",
      "causes_possibles": [
        "1. API identifier incorrect dans Webflow CMS (vérifier que tous les champs ont exactement les bons noms)",
        "2. Token API Webflow expiré ou invalide",
        "3. Collection ID incorrect",
        "4. Champ requis manquant dans Webflow",
        "5. Type de champ incorrect (ex: Number au lieu de Plain text)"
      ],
      "solution": [
        "1. Ouvrir la console du navigateur (F12) et regarder les logs détaillés",
        "2. Vérifier les logs Render.com pour voir l'erreur exacte de Webflow",
        "3. Comparer les API identifiers dans Webflow avec ceux dans le code",
        "4. S'assurer que TOUS les champs sont en Plain text ou Rich text (pas Number)",
        "5. Tester avec Postman/Insomnia en envoyant une requête directement à l'API"
      ]
    },
    "erreur_500_creation": {
      "symptome": "Erreur 500 lors de la création d'une offre",
      "causes_possibles": [
        "1. Slug déjà existant (peu probable avec timestamp)",
        "2. Champ 'post' (titre) requis mais vide",
        "3. Token API invalide"
      ],
      "solution": [
        "1. Vérifier que le titre n'est pas vide",
        "2. Consulter les logs Render.com",
        "3. Tester la création via l'API directement"
      ]
    },
    "offres_ne_chargent_pas": {
      "symptome": "Les offres ne s'affichent pas dans l'admin ou sur le site public",
      "causes_possibles": [
        "1. URL de l'API incorrecte dans le code",
        "2. Serveur Render en veille (premier chargement lent)",
        "3. Erreur CORS",
        "4. Aucune offre publiée dans Webflow"
      ],
      "solution": [
        "1. Vérifier l'URL de l'API dans les codes HTML",
        "2. Tester le health check: https://votre-api.onrender.com/health",
        "3. Attendre 60 secondes si le serveur est en veille",
        "4. Vérifier la console pour voir l'erreur exacte"
      ]
    }
  },

  "checklist_finale": [
    "✅ Collection CMS créée avec les 12 champs",
    "✅ API identifiers corrects (sensible à la casse)",
    "✅ Token API Webflow obtenu",
    "✅ Collection ID récupéré",
    "✅ Serveur Node.js déployé sur Render",
    "✅ Variables d'environnement configurées",
    "✅ URL de l'API notée",
    "✅ Code ADMIN intégré dans Webflow (page protégée)",
    "✅ Code PUBLIC intégré dans Webflow (page publique)",
    "✅ URLs API remplacées dans les deux codes",
    "✅ Tests effectués (créer, modifier, supprimer)",
    "✅ Site Webflow publié",
    "✅ Offres visibles sur le site public"
  ]
}
