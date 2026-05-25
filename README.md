# MacDeck Windows

Contrôle ton PC Windows depuis n'importe quel appareil sur le réseau (iPhone, Android, autre PC, tablette).

## Prérequis

- [Node.js](https://nodejs.org) installé sur le PC Windows
- Les appareils clients doivent être sur le **même réseau Wi-Fi**

## Installation

```bash
npm install
npm start
```

Puis sur n'importe quel appareil, ouvre : `http://<ip-du-pc>:3000`

Pour trouver l'IP du PC Windows : `ipconfig` dans le terminal → cherche "Adresse IPv4".

## Fonctionnalités

- Volume et luminosité (curseurs)
- Couper le son / couper le micro
- Contrôles médias (play/pause, suivant, précédent)
- Lancer des applications
- Actions système : verrouiller, veille, veille écran, mode sombre, capture d'écran, corbeille, Ne pas déranger
- Raccourcis clavier
- Affichage batterie (PC portable)
- Détection des apps en cours d'exécution (bordure verte)
- Installable comme PWA via "Ajouter à l'écran d'accueil"

## Autres versions

- [MacDeck iOS](https://github.com/Andre27aj/MacDeck-iOS) — app Swift native iPhone/iPad
- [MacDeck Mac](https://github.com/Andre27aj/MacDeck) — serveur pour Mac
