/**
 * These utilities have been removed from the production version
 * They were used during development for cleaning up test data
 */

// Placeholder function that does nothing in production
export function clearDummyData() {
  console.warn("clearDummyData() has been disabled in the production version");
  return {};
}

// Placeholder function that does nothing in production
export function removeItemById(id: string) {
  console.warn("removeItemById() has been disabled in the production version");
  return {};
}