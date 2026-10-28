// The ADMIN's PUBLIC key (base64). Exports are encrypted so that only the holder of the matching
// private key can open them. This value is safe to commit and to ship inside the app: a public key
// can only lock, never unlock.
//
// How to fill it in (once):
//   1. The admin opens admin-tool/decrypt.html, creates a key, and copies the "Public key" it shows.
//   2. Paste it between the quotes below and rebuild the app.
// Never put the private key (the .key.json file) in this repo or on a reader's phone.
export const ADMIN_PUBLIC_KEY = '';
