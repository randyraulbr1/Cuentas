"use strict";
const crypto = require("crypto");

// ENCRYPTION_KEY debe ser 32 bytes en base64 (openssl rand -base64 32).
// Se lee de variable de entorno; nunca se guarda en el código.
function getKey() {
  const b64 = process.env.ENCRYPTION_KEY;
  if (!b64) throw new Error("Falta ENCRYPTION_KEY en las variables de entorno");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY debe decodificar a 32 bytes (AES-256)");
  return key;
}

function encrypt(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(12); // recomendado para GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: authTag.toString("base64"),
  };
}

function decrypt(ciphertextB64, ivB64, tagB64) {
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

module.exports = { encrypt, decrypt };
