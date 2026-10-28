# Encrypted export - update 4

Extract at the project root (overwrites the files below), then:

    npm install --legacy-peer-deps    # adds tweetnacl (pure JS) and expo-crypto (NATIVE module)
    npx expo run:android --variant release --device    # a rebuild is required

`expo-crypto` is a native module, so a reload is not enough: rebuild and reinstall.

## One-time setup by the admin
1. Open `admin-tool/decrypt.html` in Chrome or Edge on the admin's computer (works offline).
2. "Create your key": choose a passphrase (12+ characters). A private key file
   (`mogpog-admin-private.key.json`) is downloaded and a **public key** is shown.
3. Paste the public key into `constants/adminKey.ts` (`ADMIN_PUBLIC_KEY`) and rebuild the app.
4. Store the key file and the passphrase in two separate safe places, plus a second copy with another officer.
   If both are lost, every export is permanently unreadable. Never put the key file in the repo or on a phone.

## Behaviour
* **Export** now always produces `WATER_READING_SYSTEM[_Barangay]_<year>.xlsx.enc`. The plain workbook only
  exists in memory; only the encrypted bytes are written to storage or shared.
* Each file is sealed with a fresh throw-away key (X25519 + XSalsa20-Poly1305 via tweetnacl). The reader's phone
  cannot reopen what it exported; only the admin's private key can. Files that are damaged or modified are
  rejected instead of opened.
* The Export screen shows the key ID (e.g. `3F2C-AD3E-704F-EDED`) so the admin can confirm which key the build uses.
* **Export is disabled** (with a message) until `ADMIN_PUBLIC_KEY` is set. There is no plain-text fallback.
* **Cache cleanup:** exports older than 10 minutes are deleted from the phone's cache when the Export screen opens or an
  export starts. This also removes plain `.xlsx` files left by earlier versions. (Not deleted immediately, because
  the receiving app may still be reading the file.)
* **Admin opens a file:** `decrypt.html` -> "Open an export" -> key file + passphrase + the `.enc` file -> the
  `.xlsx` downloads. Import into the app works as before.

## File format (for reference)
`"MWE1"(4) | admin key id(8) | ephemeral public key(32) | nonce(24) | sealed box` - defined in
`lib/exportCrypto.ts` and read by `admin-tool/decrypt.html`. Change one, change both.

## Files
`package.json`, `package-lock.json`, `constants/adminKey.ts` (new), `lib/exportCrypto.ts` (new),
`lib/exportCleanup.ts` (new), `app/(tabs)/export.tsx`, `admin-tool/decrypt.html` (new, generated),
`admin-tool/decrypt.template.html` (new), `admin-tool/build.mjs` (new).
To regenerate `decrypt.html` after editing the template: `node admin-tool/build.mjs`.

## Not changed
Database, import, receipts, billing. The database on the phone is still unencrypted, and there is no app lock yet.
