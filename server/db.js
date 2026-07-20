"use strict";
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// DATABASE_URL viene de la variable de entorno (Render la provee automaticamente
// al crear una base de datos Postgres administrada y vincularla al servicio).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

async function query(text, params) {
  return pool.query(text, params);
}

// Se ejecuta una sola vez al iniciar el servidor. schema.sql usa "IF NOT EXISTS" en
// todo, asi que correrlo en cada arranque es seguro y no requiere que nadie toque
// la base de datos a mano ni corra SQL manualmente.
async function ensureExtensions() {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await pool.query(schemaSql);
    console.log("Esquema de base de datos verificado/creado correctamente.");
    return true;
  } catch (e) {
    console.error("No se pudo aplicar el esquema automaticamente:", e.message);
    return false;
  }
}

module.exports = { pool, query, ensureExtensions };
