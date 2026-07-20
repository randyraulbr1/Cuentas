"use strict";
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

module.exports = { pool, query };
