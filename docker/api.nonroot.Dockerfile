# #1412: run the API container as a non-root user.
# Add these lines to the final stage of the API Dockerfile (this file shows the pattern).
FROM node:20-alpine AS runtime
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --chown=app:app . .
USER app
EXPOSE 3001
CMD ["node", "dist/main.js"]
