# Installation Globale du MySQL MCP Server

Ce guide explique comment utiliser le MySQL MCP Server dans n'importe quel projet sur votre machine.

## 🎯 Comment ça marche ?

**Claude Code détecte AUTOMATIQUEMENT** les fichiers `.mcp.json` dans vos projets.
- **Pas besoin** de dire à Claude "utilise le MCP"
- **Pas besoin** de configurer quoi que ce soit
- Juste ouvrez un projet avec un `.mcp.json` et les outils sont disponibles immédiatement

## 📝 Utilisation pour un Nouveau Projet

**C'est tout simple !** Ajoutez juste ce fichier à la racine de votre projet:

**Fichier: `.mcp.json`**

```json
{
  "mcpServers": {
    "mysql-depse": {
      "command": "node",
      "args": ["C:\\wamp64\\www\\depse2019\\dist\\index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "",
        "MYSQL_DATABASE": "depse2019",
        "MYSQL_PROFILE": "balanced"
      }
    }
  }
}
```

**C'est tout !** Dès que vous rouvrez votre projet dans Claude Code, le MCP sera automatiquement disponible.

## ⚠️ Important

- **NE Créez PAS de lien symbolique** vers `.mcp.json` (cela casserait votre config personnelle)
- **Chaque projet** qui veut utiliser le MCP doit avoir son propre `.mcp.json`
- **WAMP/MariaDB doit être actif** sur votre machine pour que le MCP fonctionne

## ✅ Vérification

Pour vérifier que ça marche:

1. Ouvrez Claude Code
2. Ouvrez n'importe quel projet (ou créez un nouveau projet vide)
3. Ajoutez le fichier `.mcp.json` ci-dessus
4. Tapez: "Liste les tables de depse2019"

Claude devrait automatiquement utiliser le MCP et répondre avec la liste de vos tables ! 🎉

## 🛠️ Outils Disponibles

**Discovery Tools:**
- `list_databases` - Lister les bases de données accessibles
- `list_tables` - Lister les tables avec nombres de lignes
- `describe_table` - Schéma détaillé d'une table
- `search_schema` - Rechercher tables/colonnes par motif
- `get_table_sample` - Échantillon de lignes d'une table
- `get_table_stats` - Statistiques d'une table
- `refresh_schema_cache` - Rafraîchir le cache de schéma

**Execution Tools:**
- `validate_query` - Valider sans exécuter
- `execute_select` - Exécuter SELECT avec protections

## 💡 Exemples d'Utilisation

```
# Dans Claude Code, avec n'importe quel projet ouvert:

"Montre-moi toutes les tables de la base depse2019"
→ Claude utilise automatiquement list_tables

"Trouve les tables qui contiennent 'naissance'"
→ Claude utilise automatiquement search_schema("naissance")

"Quelle est la structure de la table depse_log_localite ?"
→ Claude utilise automatiquement describe_table("depse_log_localite")

"Exécute: SELECT COUNT(*) FROM depse_log_localite WHERE valide = 1"
→ Claude valide et exécute la requête en toute sécurité
```

**Rappel:** Vous n'avez pas besoin de mentionner "utilise le MCP" ou "appelle l'outil" - Claude sait automatiquement quand et comment l'utiliser !
