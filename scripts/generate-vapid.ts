/** Genererer VAPID-nøkler for Web Push. Legg dem i miljøvariablene (aldri i koden). */
import webpush from "web-push";
const keys = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:redaksjon@tulltall.no`);
