# Dockerfile for a Next.js application

# 1. Base Image
FROM node:18-alpine AS base

# 2. Dependencies Stage
FROM base AS deps
WORKDIR /app

# Install dependencies based on the lock file
COPY package.json package-lock.json* ./
RUN npm install --production

# 3. Builder Stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables if needed
# ENV NEXT_PUBLIC_SOME_VAR="value"

# Build the Next.js application
RUN npm run build

# 4. Runner Stage (Final Image)
FROM base AS runner
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
# Uncomment the following line if you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nextjs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Copy the standalone output from the builder
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy the public and static assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Set the port the container will listen on
EXPOSE 3000

# Set the host and port for the Next.js server
ENV PORT 3000
ENV HOSTNAME 0.0.0.0

# Start the Next.js server
# The server.js file is created by the standalone output mode
CMD ["node", "server.js"]
