# 🌍 ByMap — Application Mobile de Cartographie & Annonces Locales

> Application React Native (Expo) combinant une carte interactive 3D/2D avec un système d'annonces géolocalisées.

---

## 📋 Table des matières

- [Présentation](#présentation)
- [Architecture du projet](#architecture-du-projet)
- [Écrans & Fonctionnalités](#écrans--fonctionnalités)
- [Stack technique](#stack-technique)
- [Installation & Lancement](#installation--lancement)
- [Configuration](#configuration)
- [Navigation](#navigation)
- [Permissions](#permissions)
- [Dépendances principales](#dépendances-principales)
- [État actuel & TODO](#état-actuel--todo)

---

## 📱 Présentation

**ByMap** est une application mobile cross-platform (iOS / Android / Web) développée avec **React Native** et **Expo**. Elle permet aux utilisateurs de :

- Visualiser un **globe 3D interactif** qui transite en douceur vers une **carte 2D** (Leaflet)
- Choisir parmi **4 styles de carte** (Satellite, Standard, Cyclable, Topographique)
- Se **géolocaliser** en temps réel
- Consulter et rechercher des **annonces locales** (immobilier, électronique, véhicules, mobilier…)
- S'**authentifier** (email, téléphone, Google, Facebook, Apple)

---

## 🗂️ Architecture du projet

```
ByMap/
├── App.js                   # Point d'entrée — Navigation principale
├── index.js                 # Enregistrement Expo (registerRootComponent)
├── app.json                 # Configuration Expo (nom, icône, permissions…)
├── package.json             # Dépendances npm
│
├── assets/
│   └── logo.png             # Logo de l'application
│
└── src/
    └── screens/
        ├── Welcome.js       # Écran de démarrage (splash animé)
        ├── MapScreen.js     # Écran carte (globe 3D + carte 2D Leaflet)
        ├── LoginScreen.js   # Authentification (connexion / inscription)
        ├── LocalScreen.js   # Liste d'annonces locales (mode solo)
        └── DuoScreen.js     # Liste d'annonces locales (mode duo / alternatif)
```

---

## 🖥️ Écrans & Fonctionnalités

### 1. `Welcome.js` — Écran de démarrage

Écran de chargement affiché au lancement de l'application.

**Fonctionnalités :**
- Fond dégradé sombre (`LinearGradient` : `#0a0a1a → #050510`)
- Logo centré avec animation **fade-in + scale** au démarrage (700ms)
- **Barre de progression animée** (3 secondes, couleur `#1E90FF`)
- Redirection automatique vers `MapScreen` après 3 secondes (`navigation.replace`)

---

### 2. `MapScreen.js` — Écran Carte Principal

Écran central de l'application. Combine un globe 3D et une carte 2D interactive.

**Fonctionnalités :**

#### Globe 3D (WebView + Three.js)
- Globe rendu via **Three.js r128** dans une `WebView`
- **Texture de carte réelle** chargée par tuiles (8×8, zoom niveau 3)
- **Champ d'étoiles** en arrière-plan (6 000 points)
- **Atmosphère** lumineuse subtile autour du globe
- Animation d'introduction :
  1. Rotation automatique pendant 3 secondes
  2. Orientation vers Tunis (lat: 36.8065, lng: 10.1815)
  3. Zoom progressif → déclenchement de la transition vers la carte 2D
- **Interactions tactiles :**
  - Glisser (1 doigt) → rotation du globe
  - Pincer (2 doigts) → zoom, déclenche la transition carte 2D quand le zoom max est atteint
  - Rotation automatique reprend après 4s d'inactivité
- Communication `WebView → React Native` via `postMessage` (`SWITCH_TO_MAP:lat:lng` / `READY`)

#### Carte 2D (Leaflet via WebView)
- Carte **Leaflet** rendue dans une seconde `WebView`
- Marqueur de position utilisateur
- **Géocodage** : recherche de lieux par texte (Nominatim / OpenStreetMap)
- Suggestions de recherche en temps réel
- FAB (bouton flottant) pour recentrer sur la position actuelle

#### Styles de carte (4 options)
| Style | Emoji | Couleur | Source |
|---|---|---|---|
| Satellite | 🛰️ | `#3D6B4F` | ArcGIS World Imagery |
| Standard | 🗺️ | `#6C72CB` | OpenStreetMap |
| Cycle | 🚴 | `#50B478` | CyclOSM |
| Topo | ⛰️ | `#8B5E3C` | OpenTopoMap |

#### Interface (UI)
- Header avec logo **ByMap**, barre de recherche et menu hamburger
- Menu déroulant : `Local Ads`, `Duo`, `Login`
- Sélection de style via des "balles" colorées (boutons ronds en bas d'écran)
- Badge d'erreur affiché si la géolocalisation échoue
- Attribution OSM en bas à gauche

---

### 3. `LoginScreen.js` — Authentification

Écran d'authentification complet avec deux onglets animés.

**Fonctionnalités :**

#### Onglet Connexion (`login`)
- Champ **email** (icône ✉)
- Séparateur « ou »
- Champ **téléphone** avec préfixe `+216` (Tunisie)
- Champ **mot de passe** (avec toggle afficher/masquer 👁)
- Lien « Mot de passe oublié ? »
- Bouton **SE CONNECTER** → navigue vers `MapScreen`

#### Onglet Inscription (`signup`)
- Champs : **Nom**, **Prénom**, **Email**, **Téléphone**, **Mot de passe**, **Confirmation**
- Bouton **CRÉER MON COMPTE** → navigue vers `MapScreen`
- Validation basique (champs obligatoires, confirmation mot de passe)

#### Authentification Sociale
- **Google** → Alert (intégration Firebase Auth prévue)
- **Facebook** → Ouvre `https://www.facebook.com/login` via `Linking`
- **Apple** → Alert (intégration `expo-apple-authentication` prévue)

#### Design
- Indicateur d'onglet animé (slide horizontal avec `Animated.spring`)
- Inputs avec bordure animée bleu au focus
- Animations d'entrée : fade + slide vertical
- Palette de couleurs : `#1E90FF` (bleu), `#1E1E2E` (gris foncé), `#F5F6FA` (fond)

---

### 4. `LocalScreen.js` — Annonces Locales (Solo)

Liste filtrée d'annonces locales avec recherche.

**Fonctionnalités :**
- **FlatList** d'annonces avec animation de scale au toucher (`Animated.spring`)
- Barre de recherche (filtre sur titre et sous-titre)
- Bouton de suppression de recherche (`✕`)
- **FAB `+`** pour ajouter une annonce (TODO)
- État vide avec icône 📭

#### Types de cartes d'annonces
- `image` : zone de prévisualisation image (placeholder 🖼️)
- `slide` : zone de texte avec style dashed border

#### Données fictives incluses (5 annonces)
| # | Titre | Catégorie | Prix |
|---|---|---|---|
| 1 | Appartement F3 à Tunis | Immobilier | 850 DT/mois |
| 2 | Samsung Galaxy S24 Ultra | Électronique | 2 800 DT |
| 3 | Voiture Clio 5 · 2022 | Véhicules | 32 000 DT |
| 4 | Canapé angle moderne | Mobilier | 1 200 DT |
| 5 | Villa avec piscine | Immobilier | 450 000 DT |

#### Bottom Tab Bar
| Onglet | Icône | Action |
|---|---|---|
| Globe | 🌍 | Navigue vers `MapScreen` |
| Search | 🔍 | Actif sur cet écran |
| Profile | 👤 | (non implémenté) |

---

### 5. `DuoScreen.js` — Annonces Locales (Duo)

Écran identique à `LocalScreen` — variante prévue pour un mode alternatif ou comparatif. Partage la même structure de données, les mêmes composants et le même design. Différenciable via le nom de la route (`Duo`).

---

## 🛠️ Stack technique

| Technologie | Rôle |
|---|---|
| **React Native 0.76.9** | Framework mobile |
| **Expo ~52.0.49** | Toolchain & build |
| **React Navigation 7** | Navigation entre écrans |
| **expo-location ~18.0** | Géolocalisation GPS |
| **expo-linear-gradient ~14.0** | Dégradés (écran Welcome) |
| **react-native-webview 13.12** | Globe 3D + carte Leaflet |
| **Three.js r128** | Rendu 3D du globe (via CDN dans WebView) |
| **Leaflet** | Carte 2D interactive (via CDN dans WebView) |
| **Nominatim (OSM)** | Géocodage / recherche de lieux |
| **ArcGIS / OSM / CyclOSM / OpenTopoMap** | Tuiles cartographiques |
| **axios ^1.8** | Requêtes HTTP |
| **AsyncStorage 1.23** | Stockage local |

---

## 🚀 Installation & Lancement

### Prérequis

- **Node.js** ≥ 18
- **npm** ou **yarn**
- **Expo CLI** : `npm install -g expo-cli`
- **Expo Go** (iOS/Android) ou un émulateur

### Étapes

```bash
# 1. Cloner le projet
git clone <url-du-repo>
cd ByMap

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm start
# ou
npm

# 4. Lancer sur une plateforme spécifique
npm run android    # Android
npm run ios        # iOS
npm run web        # Web
```

---

## ⚙️ Configuration

### `app.json` — Configuration Expo

```json
{
  "expo": {
    "name": "ByMap",
    "slug": "ByMap",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/logo.png",
    "splash": {
      "backgroundColor": "#140729"
    },
    "ios": {
      "bundleIdentifier": "com.bymap.app"
    },
    "android": {
      "package": "com.bymap.app",
      "config": {
        "googleMaps": {
          "apiKey": "AIzaSyDIJ9XX2ZvRKCJcFRrl-lRanEtFUow4piM"
        }
      }
    }
  }
}
```

## 🧭 Navigation

L'application utilise un `Stack Navigator` de `@react-navigation/stack` sans header visible (`headerShown: false`).

```
Welcome  →  Map  ↔  Login
                ↔  Local
                ↔  Duo
```

| Route | Composant | Description |
|---|---|---|
| `Welcome` | `Welcome.js` | Écran de splash (initial) |
| `Map` | `MapScreen.js` | Carte principale |
| `Login` | `LoginScreen.js` | Connexion / Inscription |
| `Local` | `LocalScreen.js` | Annonces locales (solo) |
| `Duo` | `DuoScreen.js` | Annonces locales (duo) |

---

## 🔐 Permissions

### iOS (`app.json` → `infoPlist`)
```
NSLocationWhenInUseUsageDescription
NSLocationAlwaysUsageDescription
```

### Android (`app.json` → `permissions`)
```
ACCESS_COARSE_LOCATION
ACCESS_FINE_LOCATION
```

### Plugin Expo
```json
["expo-location", {
  "locationWhenInUsePermission": "...",
  "locationAlwaysAndWhenInUsePermission": "..."
}]
```

---

## 📦 Dépendances principales

```json
{
  "@react-navigation/native": "^7.1.34",
  "@react-navigation/stack": "^7.8.6",
  "expo": "~52.0.49",
  "expo-linear-gradient": "~14.0.2",
  "expo-location": "~18.0.10",
  "react-native": "0.76.9",
  "react-native-webview": "13.12.5",
  "react-native-maps": "1.18.0",
  "react-native-gesture-handler": "~2.20.2",
  "react-native-reanimated": "~3.16.1",
  "react-native-safe-area-context": "4.12.0",
  "react-native-screens": "~4.4.0",
  "axios": "^1.8.4",
  "@react-native-async-storage/async-storage": "1.23.1"
}
```

---

## ✅ État actuel & TODO

### ✅ Implémenté
- [x] Écran de splash avec animation et barre de progression
- [x] Globe 3D interactif (Three.js, tuiles réelles, rotation, zoom)
- [x] Transition automatique Globe → Carte 2D
- [x] Carte Leaflet 2D avec géolocalisation
- [x] 4 styles de carte sélectionnables
- [x] Recherche de lieux (géocodage Nominatim)
- [x] Écran Connexion / Inscription avec validation
- [x] Toggle afficher/masquer mot de passe
- [x] Boutons de connexion sociale (Google, Facebook, Apple)
- [x] Liste d'annonces avec filtrage par recherche
- [x] Animations de cards au toucher

### 🔧 À implémenter (TODO)
- [ ] Intégration **Firebase Auth** (Google, Apple, email réel)
- [ ] Connexion Facebook via SDK officiel
- [ ] Page de détail d'une annonce
- [ ] Formulaire de publication d'annonce (bouton `+`)
- [ ] Onglet `Profile` (gestion compte utilisateur)
- [ ] Backend / API pour les annonces réelles
- [ ] Persistance de session (AsyncStorage)
- [ ] Gestion des erreurs réseau
- [ ] Tests unitaires et d'intégration
- [ ] Sécurisation de la clé API Google Maps

---

## 🎨 Palette de couleurs

| Couleur | Hex | Usage |
|---|---|---|
| Bleu principal | `#1E90FF` | Boutons, accents, inputs actifs |
| Bleu foncé | `#0A6FCC` | Hover / pressed |
| Violet globe | `#6C72CB` | FAB carte, style Standard |
| Fond sombre | `#0a0a1a` | Welcome, globe |
| Fond clair | `#F5F6FA` | Écrans annonces |
| Texte principal | `#1E1E2E` | Titres |
| Texte secondaire | `#888888` | Sous-titres, labels |

---
# FrontWeb-bymap
