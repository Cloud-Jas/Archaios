// Template file for environment configuration
// Copy this to environment.ts and environment.prod.ts and fill in your values

export const environment = {
  production: false, // Set to true for production environment
  urlApi: 'YOUR_API_URL_HERE',
  backendApi: 'YOUR_BACKEND_API_URL_HERE',
  microsoftOauth: {
    clientId: 'YOUR_MICROSOFT_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID',
    redirectUri: 'YOUR_REDIRECT_URI'
  },
  googleOauth: {
    clientId: 'YOUR_GOOGLE_CLIENT_ID', 
    redirectUri: 'YOUR_REDIRECT_URI',
    scope: 'email profile'
  },
  mapboxToken: 'YOUR_MAPBOX_TOKEN'
};
