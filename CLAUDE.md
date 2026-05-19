# CLAUDE.md

Ce fichier fournit des conseils à Claude Code (claude.ai/code) pour travailler avec le code de ce dépôt.

## Vue d'ensemble du projet

DEPSE (Direction des Études, de la Programmation et du Suivi-Évaluation) est une application web PHP pour une agence gouvernementale ivoirienne responsable des études, de la programmation et de l'évaluation. Le système gère les données d'état civil notamment les naissances, les décès et les mariages collectés auprès de diverses localités de Côte d'Ivoire.

## Architecture

### Composants Principaux

- **Point d'entrée** : `index.php` - Routeur principal gérant toutes les requêtes de pages via le paramètre `?parcours=`
- **Bibliothèque de fonctions** : `repertoire_fonction/code_fonctions_depse.php` - Inclure ce fichier pour accéder à toutes les fonctions principales et à la connexion base de données
- **Connexion base de données** : `repertoire_fonction/connexion_basededonnees.php` - Contient la configuration de connexion MySQLi

### Structure des Répertoires

- `repertoire_fonction/` - Fonctions PHP principales et configuration base de données
- `intranet/` - Interface d'administration pour la gestion des données (naissances, décès, mariages, localités)
- `imgs-depse/` - Application principale en production (contient les fichiers PHP, tableaux de bord, statistiques, rapports Excel)
- `css/`, `js/` - Assets frontend (Bootstrap 3, jQuery)
- `extraction_contenu_excel/` - Bibliothèque PHPExcel pour l'import/export Excel
- `images/` - Assets images (logos, images du site)
- `fichiers_uploades/` - Fichiers téléchargés par les utilisateurs
- `enligne_depse/` - Répertoire de déploiement en production
- `media_transferes/` - Fichiers médias transférés

### Base de Données

- **Nom** : `depse2019`
- **Connexion** : MySQLi utilisant `mysqli_connect()`
- **Variable de connexion** : `$connect_db` (disponible après inclusion de `connexion_basededonnees.php`)
- **Convention de nommage des tables** : `depse_log_*` (ex: `depse_log_localite`, `depse_log_localite_naissance`, `depse_log_localite_deces`)

## Commandes de Développement

### Connexion à la Base de Données

Pour travailler avec la base de données, incluez toujours le fichier des fonctions en haut de vos scripts PHP :

```php
include("repertoire_fonction/code_fonctions_depse.php");
// $connect_db est maintenant disponible pour mysqli_query()
```

### URLs de Développement Local

Le fichier `.htaccess` utilise des URLs locales (127.0.0.1). Le site de production est sur `www.depse.ci`.

### Exécution des Scripts de Maintenance

Plusieurs fichiers `maj_*.php` effectuent des mises à jour par lots sur les données d'état civil :
- `maj_declaration.php` - Met à jour les déclarations de localité
- `maj_localite_*.php` - Diverses mises à jour liées aux localités
- `maj_declaration_*.php` - Met à jour des types de déclarations spécifiques (naissances, décès, mariages)

Ces scripts traitent les enregistrements par lots (généralement 1000 enregistrements par lot via le paramètre `?indice=N`).

## Modèles Importants

### Modèle de Routage

Les pages sont routées via `index.php` en utilisant le paramètre `parcours` :
- `index.php?parcours=presentation` - Pages de présentation
- `index.php?parcours=liste_article` - Liste d'actualités/articles
- `index.php?parcours=galerie_photos` - Galerie photos
- `index.php?parcours=galerie_videos` - Galerie vidéos
- `index.php?parcours=contact` - Page de contact

### Modèle d'Inclusion

Les pages PHP principales incluent les composants dans cet ordre :
1. `depse_top_header.php`
2. `depse_header.php`
3. `depse_navbar.php`
4. Contenu principal
5. `depse_footer.php`

### Gestion des Dates

L'application utilise les formats de date française (JJ-MM-AAAA) pour l'affichage et le format de date MySQL (AAAA-MM-JJ) pour le stockage. Fonctions utilitaires dans `code_fonctions_depse.php` :
- `transforme_datepicker_en_datemysql()` - Français vers MySQL
- `transforme_datemysql_en_datepicker()` - MySQL vers Français
- `date_en_francais_a_partir_date_heure()` - Conversion de format

### Encodage des Caractères

La base de code utilise `utf8_decode()` et `utf8_encode()` pour gérer les caractères français accentués lors du stockage/récupération depuis MySQL.

## Stack Frontend

- Bootstrap 3.x (`css/bootstrap.min.css`)
- jQuery 2.2.4
- Styles personnalisés dans `css/style-main.css`
- Scripts personnalisés dans `js/custom.js`, `js/controle_formulaire.js`

## Admin/Intranet

La section intranet (`intranet/`) fournit des interfaces administratives pour :
- La gestion des données d'état civil (naissances, décès, mariages)
- La gestion des localités, départements, régions, juridictions
- L'export des données vers Excel utilisant la bibliothèque PHPExcel

### Authentification Intranet

La connexion est contrôlée via `intranet/controle_connexion.php` utilisant :
- **Authentification par session** avec délai d'expiration de 20 minutes d'inactivité
- **Hachage des mots de passe** : SHA1(password + salt) où le salt est stocké dans `depse_log_localite_personnel.hash`
- **Variables de session** : `$_SESSION['id_connect_depse_log_localite_personnel']` et `$_SESSION['date_connect_depse_log_localite_personnel']`

### Application de Production (imgs-depse/)

Le répertoire `imgs-depse/` contient l'application de production avec :
- **Tableaux de bord** : `admin_accueil.php` - Vue d'ensemble des statistiques d'état civil
- **Gestion par type d'acte** : `admin_naissance.php`, `admin_deces.php`, `admin_mariage.php`
- **Administration des référentiels** : `admin_localite.php`, `admin_departement.php`, `admin_region.php`, `admin_juridiction.php`
- **Export Excel** : Utilisation de la bibliothèque PHPExcel dans `extraction_contenu_excel/`

## Fonctions Utilitaires Essentielles

Le fichier `repertoire_fonction/code_fonctions_depse.php` contient des fonctions fréquemment utilisées :

### Manipulation de Données

```php
// Affichage depuis la base de données (gère UTF-8)
extract_show($variable)  // Convertit pour l'affichage

// Insertion dans la base de données
extract_insert($variable)  // Échappe pour l'insertion

// Nettoyage des IDs
traite_valeur_id($variable)  // Nettoie les paramètres GET/POST
```

### Conversion de Dates

```php
// Français → MySQL
transforme_datepicker_en_datemysql($datepicker)  // "JJ/MM/AAAA" → "AAAA-MM-JJ"

// MySQL → Français
transforme_datemysql_en_datepicker($datemysql)  // "AAAA-MM-JJ" → "JJ.MM.AAAA"
date_en_francais($date_anglais)  // "AAAA-MM-JJ" → "JJ/MM/AAAA"
date_en_francais_a_partir_date_heure($date_heure_anglais)  // Avec heure
```

### Encodage des Caractères

L'application utilise systématiquement :
- `utf8_decode()` avant stockage dans MySQL
- `utf8_encode()` après récupération depuis MySQL
- `stripslashes()` pour nettoyer les chaînes
- `htmlentities()` pour l'affichage sécurisé

## URL Rewriting et Routage

### Routes Principales

Le fichier `.htaccess` définit des URL propres pour les pages principales. En développement, utiliser les URLs avec paramètres :

| URL Simplifiée | URL avec Paramètres |
|----------------|---------------------|
| `/accueil` | `index.php` |
| `/actualites/` | `index.php?parcours=liste_article&id_menu_deuxieme_niveau=1` |
| `/galerie-photos/` | `index.php?parcours=galerie_photos&id_menu_deuxieme_niveau=15` |
| `/contacts/` | `index.php?parcours=contact&id_menu_deuxieme_niveau=9` |
| `/faq/` | `index.php?parcours=foires_aux_questions&id_menu_deuxieme_niveau=2` |

### Pages d'Erreur Personnalisées

Le projet utilise des pages d'erreur personnalisées (400, 403, 404, 405, 408, 500, 501, 503) dans le répertoire racine.

## Patterns de Code Courants

### Requête SQL avecmysqli

```php
include("repertoire_fonction/code_fonctions_depse.php");
$rek = "SELECT * FROM depse_log_localite WHERE valide=1 AND suppression=0";
$exe = mysqli_query($connect_db, $rek);
while($valeur = mysqli_fetch_array($exe)) {
    $titre = extract_show($valeur['titre']);
    // Utiliser $titre
}
```

### Insertion avec Échappement

```php
$nom = mysqli_real_escape_string($connect_db, $_POST['nom']);
$nom = utf8_decode($nom);
$sql = "INSERT INTO table (nom) VALUES ('$nom')";
mysqli_query($connect_db, $sql);
```

## Système de Routage Détaillé

Le fichier `parcours_action.php` agit comme un routeur simple basé sur le paramètre `?parcours=` :

| Valeur de parcours | Fichier inclus |
|-------------------|----------------|
| `presentation` | `depse_presentation.php` |
| `dossiers` | `depse_dossiers.php` |
| `liste_article` | `depse_liste_article.php` |
| `detail_article` | `depse_detail_article.php` |
| `galerie_photos` | `depse_galerie_photo.php` |
| `detail_galerie_photo` | `depse_detail_galerie_photo.php` |
| `galerie_videos` | `depse_galerie_video.php` |
| `detail_galerie_video` | `depse_detail_galerie_video.php` |
| `contact` | `depse_contact.php` |
| (non défini) | `depse_accueil.php` |

## Structure des Données d'État Civil

### Tables Principales

Les données d'état civil sont organisées avec ces conventions :
- `depse_log_localite` - Localités (centres d'état civil)
- `depse_log_localite_naissance` - Données de naissances collectées
- `depse_log_localite_deces` - Données de décès collectés
- `depse_log_localite_mariage` - Données de mariages collectés
- `depse_log_localite_declaration` - Données brutes de déclaration
- `depse_log_localite_periode` - Périodes de collecte

### Colonnes Courantes

Chaque table de données contient généralement :
- `id_depse_log_*` - Clé primaire
- `id_depse_log_district` / `id_depse_log_region` / `id_depse_log_departement` - Clés étrangères géographiques
- `mois_collecte` / `annee_collecte` - Période de collecte
- `type_circonscription` - Type (commune/sous-préfecture)
- `type_centre_etat_civil` - Type de centre
- `est_centre_secondaire` - Centre secondaire (0/1)
- `valide` / `suppression` - Flags de statut (0/1)
- `date_heure_creation` / `date_derniere_modification` - Timestamps

## Développement de Nouvelles Fonctionnalités

### Créer une nouvelle page publique

1. Créer le fichier de contenu (ex: `depse_ma_page.php`)
2. Ajouter le routage dans `parcours_action.php`
3. Ajouter l'URL dans `.htaccess` (optionnel)
4. Inclure les composants de mise en page si nécessaire

### Créer une nouvelle page admin

1. Créer le fichier dans `intranet/` ou `imgs-depse/`
2. Inclure `../repertoire_fonction/code_fonctions_depse.php` en haut
3. Vérifier l'authentification via `$_SESSION['id_connect_depse_log_localite_personnel']`
4. Suivre les patterns de mise en page existants
