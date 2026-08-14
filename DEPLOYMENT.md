# מדריך התקנה - Momentum (Docker + Linux VM)

מסמך זה מרכז את כל השלבים הדרושים להרצת פרויקט ה-Momentum על שרת הלינוקס שלך בצורה חלקה ומאובטחת באמצעות Docker. 
קבצי התצורה של ה-Docker (`Dockerfile` ו-`docker-compose.prod.yml`) כבר הוכנו ונוספו לפרויקט שלך.

---

## מה הפרויקט כולל כרגע:
1. **`backend/Dockerfile`**: להרצת שרת ה-Node.js.
2. **`backend/start.sh`**: סקריפט המריץ את המיגרציות לדאטהבייס (`npx prisma migrate deploy`) לפני שהשרת עולה.
3. **`frontend/Dockerfile`**: בונה את אפליקציית ה-Vite ועוטף אותה בשרת Nginx.
4. **`frontend/nginx.conf`**: תצורת Nginx שמטפלת ב-SSL, ניתוב לקבצים הסטטיים של React ו-Reverse Proxy ל-API של ה-Backend.
5. **`docker-compose.prod.yml`**: מאגד את ה-Backend וה-Frontend יחד ומגדיר את התקשורת מול מסד הנתונים שמותקן על השרת.

*(הערה: ה-Backend עובד מול מסד הנתונים PostgreSQL. אין צורך להשתמש ב-MongoDB כפי שצוין בנתוני השרת).*

---

## שלבי ההתקנה בשרת (VM)

### 1. העברת הקוד אל השרת
עליך להעביר את כל קבצי הפרויקט, כולל הקבצים החדשים שנוצרו, לשרת הלינוקס שלך. תוכל לעשות זאת על ידי:
* דחיפת הקוד ל-Git וביצוע `git clone` / `git pull` בשרת.
* או העברת הקבצים ישירות דרך SCP או SFTP (דרך פורט 22 בחיבור ה-VPN).

### 2. בדיקה ועדכון שמות תעודות ה-SSL (קריטי!)
בקובץ `frontend/nginx.conf`, הוגדר ש-Nginx יקרא את תעודות ה-SSL מתוך התיקייה `/etc/ssl/cs/`.
יש לפתוח את הקובץ ולוודא שהשמות תואמים לשמות הקבצים בפועל על השרת.
מצא את השורות הבאות (שורות 14-15) ותקן במידת הצורך:
```nginx
    ssl_certificate /etc/ssl/cs/certificate.crt;
    ssl_certificate_key /etc/ssl/cs/private.key;
```
*(לדוגמה, ייתכן ושם הקובץ הוא `momentum.cs.colman.ac.il.crt` וכו').*

### 3. הכנת מסד הנתונים (PostgreSQL)
סיסמת הגישה למסד הנתונים היא `bartar20@CS`. מכיוון שהיא מכילה את התו `@`, בקובץ `docker-compose.prod.yml` היא קודדה ל-`%40` כדי למנוע שגיאות בקריאת ה-URL.
שורת החיבור נראית כך: 
`postgresql://postgres:bartar20%40CS@host.docker.internal:5432/momentum`
* **`host.docker.internal`**: מאפשר לקונטיינרים בדוקר לגשת ל-PostgreSQL שרץ ישירות על המכונה המארחת שלך (על פורט 5432).

**הקמת ה-Database:**
אם הדאטהבייס `momentum` עדיין לא קיים בשרת, עליך ליצור אותו. התחבר לשרת והרץ:
```bash
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE momentum;"
```
*(אם אינך מצליח להריץ את זה משורת הפקודה, תוכל להתחבר עם כלי כמו pgAdmin דרך ה-VPN וליצור את המסד דרך הממשק).*

### 4. הגדרת סודות סביבה (מומלץ)
מומלץ ליצור קובץ `.env` באותה התיקייה בה נמצא קובץ ה-`docker-compose.prod.yml` על השרת, ולהכניס בו סודות כמו ה-API של ג'ימיני או אסימון הבוט של טלגרם:
```env
JWT_SECRET=your_super_secret_jwt_key
GEMINI_API_KEY=your_gemini_key
BOT_TOKEN=your_telegram_bot_token
```

### 5. הפעלת הפרויקט דרך Docker
התחבר למכונה ב-SSH (עם הרשאות `sudo`), נווט לתיקיית הפרויקט והרץ:
```bash
sudo docker compose -f docker-compose.prod.yml up -d --build
```
*(הערה: אם בשרת שלך מותקנת גרסת Docker ישנה, ייתכן שתצטרך להשתמש בפקודה עם מקף: `sudo docker-compose ...`).*

---

## ארכיטקטורת ההפעלה (איך זה עובד מאחורי הקלעים?)
1. **הבנייה:** Docker בונה את קונטיינר ה-Backend מבוסס Node.js, ואת ה-Frontend בונה בעזרת Vite ועוטף אותו בשרת Nginx.
2. **ה-Backend:** עולה ראשון, מריץ את הפקודה `npx prisma migrate deploy` כדי לסדר את הטבלאות ב-PostgreSQL שבמכונה המארחת, ומתחיל להאזין פנימית על פורט 3000.
3. **ה-Frontend (Nginx):** עולה, קורא את תעודות ה-SSL מהשרת המארח (קריאה בלבד) ומאזין לפורטים `80` (ומפנה אוטומטית ל-HTTPS) ו-`443`.
4. **ניתוב:**
   - גלישה לכתובת `https://momentum.cs.colman.ac.il/` תגיש את האתר (קבצי Vite/React הסטטיים).
   - כל פנייה אל ה-API (לדוגמה: `https://momentum.cs.colman.ac.il/api/auth`) תנותב על ידי ה-Nginx באופן מאובטח מאחורי הקלעים היישר אל קונטיינר ה-Backend.

**בהצלחה!**
במידה ויש שגיאות או בעיות חיבור ניתן תמיד לבדוק את הלוגים של דוקר:
```bash
sudo docker compose -f docker-compose.prod.yml logs -f
```
