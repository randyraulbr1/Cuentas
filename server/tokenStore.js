const items = new Map();

export function saveItem(profileId, data) {
  items.set(profileId, {
    ...data,
    profileId,
    connectedAt: new Date().toISOString(),
  });
}

export function getItem(profileId) {
  return items.get(profileId) || null;
}

export function removeItem(profileId) {
  return items.delete(profileId);
}

export function hasItem(profileId) {
  return items.has(profileId);
}

// Solo para desarrollo: los access tokens viven en memoria y se pierden al reiniciar.
// En producción deben almacenarse cifrados en una base de datos segura.
