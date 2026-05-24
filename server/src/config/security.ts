const localDevFallbackDomains = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
];

export const clientDomains = [
  process.env.CLIENT_LOCAL_DOMAIN,
  process.env.CLIENT_DEV_DOMAIN,
  process.env.CLIENT_DEV_PREVIEW_DOMAIN,
  process.env.CLIENT_PROD_DOMAIN,
  ...localDevFallbackDomains,
].filter((origin, index, arr): origin is string => {
  return Boolean(origin) && arr.indexOf(origin) === index;
});
