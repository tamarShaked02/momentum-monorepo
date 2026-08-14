FROM node:22-alpine AS builder
WORKDIR /app

# התקנת התלויות (נשתמש ב-npm install כיוון שאין package-lock.json בתיקייה)
COPY package*.json ./
RUN npm install

# העתקת כל שאר הקבצים והגדרת כתובת ה-API הציבורית לבנייה
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# בניה (ייצור של תיקיית dist)
RUN npm run build

# שלב 2: הגדרת Nginx להגשת הקבצים הסטטיים
FROM nginx:alpine
# העתקת קבצי הבילד משלב הקודם
COPY --from=builder /app/dist /usr/share/nginx/html
# העתקת קובץ תצורת ה-Nginx שלנו שדורס את ברירת המחדל
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
