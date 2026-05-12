export const BASE_URL = import.meta.env.BASE_URL || "/";
export const assetUrl = (path) => `${BASE_URL}${path.replace(/^\//, "")}`;
