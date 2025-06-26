
module.exports = {
  apps: [
    {
      name: 'localpulse',
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
      },
    },
  ],
};
