# VillageTrain Signage — Cloud Server

Admin web app για digital signage: **media uploads**, **playlists**, **trains**, **monitoring** και **real-time control**.
Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Firebase** (Auth, Firestore, Storage).

Production: **https://signage.villagetrain.gr**

---

## Ροή εργασίας (καθημερινή χρήση)

### 1. Κάνω αλλαγές στον κώδικα (local dev)

```bash
# Πρώτα δοκιμή local
npm run dev            # http://localhost:3000

# Όταν είναι OK → commit & push στο GitHub
git add -A
git commit -m "περιγραφή αλλαγής"
git push origin main
```

### 2. Deploy στον VPS (μετά από κάθε push)

```bash
# SSH στον server
ssh root@<vps-ip>

# Πήγαινε στο φάκελο
cd /var/www/signage   # ή όπου έχεις κάνει clone

# Κατέβασε τις αλλαγές
git pull origin main

# Εγκατάσταση τυχόν νέων dependencies
npm install

# Build (ΑΠΑΡΑΙΤΗΤΟ μετά από κάθε αλλαγή κώδικα)
npm run build

# Επανεκκίνηση με pm2
pm2 restart signage   # ή το όνομα που έχεις δώσει στο pm2
```

### 3. Πρώτη εγκατάσταση στον VPS

```bash
# Clone
git clone https://github.com/christosal/SignageCloudServer.git /var/www/signage
cd /var/www/signage

# Environment variables
cp .env.local.example .env.local
nano .env.local        # βάλε τα Firebase keys (δες παρακάτω)

# Install & build
npm install
npm run build

# Εκκίνηση με pm2
pm2 start npm --name signage -- start
pm2 save               # να ξεκινά αυτόματα μετά από reboot
pm2 startup            # ακολούθα τις οδηγίες που εμφανίζει
```

---

## Environment variables (`.env.local`)

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Τις βρίσκεις στο **Firebase Console → Project settings → General → Your apps → Web app → Config**.

> **Ποτέ μην κάνεις commit το `.env.local`** — περιέχει API keys. Το `.env.local.example` είναι το μόνο που μπαίνει στο git.

---

## Χρήσιμες pm2 εντολές

```bash
pm2 list                  # δες όλα τα processes
pm2 logs signage          # live logs
pm2 logs signage --lines 100  # τελευταίες 100 γραμμές
pm2 restart signage       # επανεκκίνηση
pm2 stop signage          # σταμάτημα
pm2 status                # status overview
```

---

## Σελίδες & λειτουργίες

| Σελίδα | Λειτουργία |
|---|---|
| **Dashboard** | Overview: αριθμός media, playlists, trains online |
| **Media** | Upload videos/images. Announcements οργανώνονται σε folders (subcategory). Διαγραφή με cascade αφαίρεση από playlists. |
| **Playlists** | Δημιουργία/επεξεργασία playlists. Drag & drop σειρά items. |
| **Trains** | Assign playlist σε train. Rename. "⏳ Waiting Screen" για να σταματήσει το playback. Live status badge. |
| **Monitoring** | Live status όλων των trains: online/offline, TVs, τι παίζει τώρα. |

---

## Media — Announcements & Folders

Τα announcements οργανώνονται σε **1 επίπεδο folder** (subcategory):

1. Πήγαινε στο **Media**
2. Επέλεξε category = `announcements`
3. Στο πεδίο **Folder** γράψε το όνομα (π.χ. `castle`, `stops`)
4. Το autocomplete δείχνει ήδη υπάρχοντα folders

Τα folders εμφανίζονται αυτόματα στο **control panel** του local server ομαδοποιημένα.

---

## Trains & Pis

Κάθε train = ένα Pi που τρέχει τον **SignageLocalServer**.

- Το Pi **αυτο-εγγράφεται** στο Firestore μόλις ξεκινήσει (αν δεν υπάρχει ήδη)
- Από τη σελίδα **Trains** ορίζεις ποιο playlist παίζει κάθε train
- Το Pi λαμβάνει την αλλαγή **real-time** μέσω `onSnapshot` (χωρίς polling)
- **Online** = heartbeat εντός 2 λεπτών
- **⏳ Waiting Screen**: στέλνει εντολή στο Pi να εμφανίσει την αναμονή (το μπλε με λογότυπο)

### Για να ορίσεις Waiting Screen από cloud:
1. **Trains** → βρες το train
2. Κουμπί **"⏳ Waiting Screen"** (εμφανίζεται μόνο αν είναι online)
3. Το Pi λαμβάνει την εντολή και τη μεταδίδει στις TVs

---

## Πρώτη ρύθμιση Firebase

1. **Firebase Console → Authentication → Sign-in method** → ενεργοποίησε **Email/Password**
2. **Authentication → Users → Add user** → δημιούργησε admin χρήστη
3. **Firestore Database** → Create database
4. **Storage** → Get started

### Security rules (για admin-only access)

**Firestore:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Storage:**
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## Firestore collections

| Collection | Περιεχόμενο |
|---|---|
| `media` | `title`, `mediaType`, `category`, `subcategory?`, `storagePath`, `downloadUrl`, `filename`, `duration` |
| `playlists` | `title`, `loop`, `items[]` (`mediaId`, `title`, `mediaType`, `downloadUrl`, `duration`) |
| `trains` | `name`, `activePlaylistId`, `activePlaylistTitle`, `status`, `lastHeartbeat`, `connectedTvs[]`, `pendingCommand?`, `currentState?`, `createdAt` |

---

## Project structure

```
app/
  login/          → σελίδα login
  (shell)/
    dashboard/    → overview
    media/        → media library
    playlists/    → list playlists
    playlists/[id]/ → edit playlist
    trains/       → train management
    monitoring/   → live monitoring
lib/
  firebase/       → Firebase client init
  hooks/          → useTrains (real-time onSnapshot)
  services/       → Firestore + Storage helpers
  types.ts        → TypeScript types
```

---

**VillageTrain** · signage.villagetrain.gr
