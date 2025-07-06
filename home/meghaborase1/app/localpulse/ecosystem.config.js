
module.exports = {
  apps: [
    {
      name: 'localpulse-app',
      script: 'npm',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G', // Restart if it exceeds 2GB
      env: {
        NODE_ENV: 'production',
        // Increase the default heap size for the Node.js process
        NODE_OPTIONS: '--max-old-space-size=2048',
        // This forces the app to use cookies compatible with a reverse proxy that isn't passing the X-Forwarded-Proto header.
        // It is useful for environments like WebViews that may not serve over HTTPS.
        ALLOW_INSECURE_LOGIN_FOR_HTTP: 'true',
      },
    },
  ],
};
