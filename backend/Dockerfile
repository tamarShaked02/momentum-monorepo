FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run db:generate
RUN npm run build

# Add a startup script to run migrations before starting
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 3000
CMD ["/start.sh"]
