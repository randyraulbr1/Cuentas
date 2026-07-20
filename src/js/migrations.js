"use strict";

/* ---------- migraciones ----------
   La migración real de datos (localStorage -> IndexedDB) ocurre de forma perezosa
   dentro de loadUserData() en storage.js, la primera vez que se abre cada perfil:
   así nunca se procesan ni se pierden datos que el usuario no ha vuelto a abrir,
   y el respaldo original en localStorage nunca se borra.

   Esta función solo registra en qué versión de esquema quedó la instalación,
   para poder añadir migraciones futuras sin repetir trabajo ya hecho. */
const SCHEMA_VERSION = 1;
const SCHEMA_KEY = "schema_version";

async function ensureMigrated() {
  try {
    const current = await idbGet(SCHEMA_KEY);
    if (current === SCHEMA_VERSION) return;
    // Aquí irían pasos de migración futuros entre versiones de esquema.
    await idbSet(SCHEMA_KEY, SCHEMA_VERSION);
  } catch (e) {
    // Si IndexedDB no está disponible, la app sigue funcionando con el
    // respaldo en localStorage a través de storage.js.
  }
}
