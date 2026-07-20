import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const envName = process.env.PLAID_ENV || "sandbox";
const basePath = PlaidEnvironments[envName];

if (!basePath) {
  throw new Error(`PLAID_ENV no válido: ${envName}`);
}

if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
  throw new Error("Faltan PLAID_CLIENT_ID o PLAID_SECRET en el archivo .env");
}

const configuration = new Configuration({
  basePath,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);
export const plaidEnvironment = envName;
