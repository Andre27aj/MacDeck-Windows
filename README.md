# MacDeck Windows

Le serveur Node.js qui fait tourner MacDeck sur ton PC Windows. Il expose une API REST locale que les clients (iPhone, Android, autre PC, tablette) utilisent pour contrôler le Windows depuis n'importe quel navigateur sur le réseau.

![Platform](https://img.shields.io/badge/Windows-10%2F11-blue) ![Node](https://img.shields.io/badge/Node.js-18%2B-green) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Écosystème MacDeck

| Repo | Description | Plateforme |
|------|-------------|------------|
| [MacDeck](https://github.com/Andre27aj/MacDeck) | Serveur Mac + interface web | macOS |
| [MacDeck-iOS](https://github.com/Andre27aj/MacDeck-iOS) | App native Swift | iPhone / iPad |
| **MacDeck-Windows** *(ce repo)* | Serveur Windows + interface web | Windows 10/11 |

---

## Ce que tu peux contrôler

- **Volume & luminosité** — sliders précis
- **Mute** son et micro indépendamment
- **Médias** — play/pause, piste suivante/précédente (touche média système)
- **Grille d'apps** — lance n'importe quelle app Windows, bordure verte si déjà ouverte
- **Actions système** — verrouiller, veille, veille écran, capture d'écran, vider la corbeille, Ne pas déranger, mode sombre/clair
- **Raccourcis clavier** — via WScript.Shell SendKeys
- **Batterie** — affichée pour les PC portables
- **Détection des apps ouvertes** — bordure verte sur les apps en cours d'exécution

---

## Installation

### Prérequis

- Windows 10 ou 11
- [Node.js 18+](https://nodejs.org) installé sur le PC
- L'appareil client sur le **même réseau Wi-Fi**
- PowerShell 5+ (inclus par défaut sur Windows 10/11)

### Lancer le serveur

```bash
git clone https://github.com/Andre27aj/MacDeck-Windows.git
cd MacDeck-Windows
npm install
npm start
```

Le terminal affiche : `MacDeck Windows server running on http://localhost:3000`

---

## Accéder depuis un autre appareil

1. Trouve l'IP du PC Windows : ouvre `cmd` → tape `ipconfig` → cherche **Adresse IPv4** (ex: `192.168.1.55`)
2. Sur n'importe quel appareil du même réseau, ouvre : `http://192.168.1.55:3000`

### Installer comme app (PWA)

| Appareil | Comment faire |
|----------|---------------|
| **Android** | Chrome → menu ⋮ → "Ajouter à l'écran d'accueil" |
| **iPhone / iPad** | Safari → icône partage → "Sur l'écran d'accueil" |
| **Autre PC** | Chrome ou Edge → icône d'installation dans la barre d'adresse |

Une fois installée, la PWA s'ouvre en plein écran comme une vraie app.

> **Android** : aucune installation d'APK nécessaire. Chrome propose d'installer la PWA directement. L'expérience est proche d'une app native.

---

## Comment ça fonctionne

```
Navigateur / PWA  ──HTTP──▶  Windows (Node.js serveur)  ──PowerShell──▶  Windows API
```

1. Le serveur expose une API REST sur le port 3000
2. L'interface web interroge `/system/status` toutes les 5 secondes
3. Chaque bouton envoie une requête POST
4. Le serveur exécute des scripts PowerShell pour piloter Windows

Tout passe par **PowerShell intégré à Windows** — pas besoin d'installer d'outils supplémentaires.

---

## Autoriser le pare-feu Windows

Pour que les autres appareils puissent accéder au serveur, il faut autoriser le port 3000 :

```powershell
# À lancer en tant qu'administrateur dans PowerShell
New-NetFirewallRule -DisplayName "MacDeck" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

Ou via l'interface : *Pare-feu Windows Defender → Règles de trafic entrant → Nouvelle règle → Port 3000*

---

## Structure du projet

```
MacDeck-Windows/
├── server.js          # Serveur Express (toute la logique Windows via PowerShell)
├── package.json
└── public/            # Interface web PWA
    ├── index.html     # App complète en un seul fichier HTML/CSS/JS
    ├── manifest.json  # Métadonnées PWA
    ├── sw.js          # Service worker
    ├── icon-192.png
    └── icon-512.png
```

---

## API — Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/system/status` | Volume, mute, batterie, app active, apps ouvertes, mode sombre |
| POST | `/volume` | `{ value: 0-100 }` |
| POST | `/mute` | `{ muted: bool }` |
| POST | `/mic/mute` | Toggle micro |
| POST | `/media/play-pause` | Touche média Play/Pause |
| POST | `/media/next` | Touche média Suivant |
| POST | `/media/prev` | Touche média Précédent |
| POST | `/launch` | `{ app: "notepad" }` — lance une app Windows |
| POST | `/shortcut` | `{ keys: ["ctrl","c"] }` — raccourci clavier |
| GET | `/system/brightness` | Luminosité actuelle (WMI) |
| POST | `/system/brightness` | `{ value: 0-100 }` |
| POST | `/system/lock` | Verrouille le PC |
| POST | `/system/sleep` | Veille |
| POST | `/system/sleep-display` | Éteint l'écran |
| POST | `/system/dark-mode` | Bascule mode sombre/clair (registre Windows) |
| POST | `/system/dnd` | Bascule Ne pas déranger (notifications) |
| POST | `/system/trash` | Vide la corbeille |
| POST | `/system/screenshot` | Capture d'écran → `~/Pictures/Screenshots/` |

---

## Limitations

- PC et client doivent être sur le **même réseau local**
- La luminosité (WMI) ne fonctionne que sur les écrans intégrés (laptops) — pas sur les moniteurs externes
- Le contrôle média utilise les touches multimédia système — compatible avec Spotify, YouTube, Windows Media Player, etc.
- Ne fonctionne pas à distance sans VPN
- PowerShell lance un nouveau processus par commande — temps de réponse ~200-400ms selon la commande
