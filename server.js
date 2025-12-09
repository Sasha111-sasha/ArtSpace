
const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");

// ==============================
//      Конфігурація
// ==============================
const PORT = 3000;
const JWT_SECRET = "ArtSpaceSuperSecretKey2025!!!";
const connectionString =
  "Driver={ODBC Driver 18 for SQL Server};Server=localhost;Database=ArtSpaceDb;Trusted_Connection=Yes;TrustServerCertificate=Yes;";

const roleMap = {
  1: "Покупець",
  2: "Контент-менеджер",
  3: "Менеджер",
  4: "Адміністратор"
};

// ==============================
//      Папка для завантажень
// ==============================
const uploadDir = path.join(__dirname, "assets", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: "assets/uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Тільки фото!"), false);
  },
});

// ==============================
//      Ініціалізація сервера
// ==============================
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/html", express.static(path.join(__dirname, "html")));

// ==============================
//      Функція запиту до БД
// ==============================
function query(sqlQuery, params = []) {
  console.log("🔍 SQL:", sqlQuery.replace(/\s+/g, " ").trim());
  console.log("🔍 PARAMS:", params);
  return new Promise((resolve, reject) => {
    sql.query(connectionString, sqlQuery, params, (err, rows) => {
      if (err) {
        console.error("❌ SQL ERROR:", err.message);
        reject(err);
      } else {
        console.log("✅ SQL SUCCESS:", Array.isArray(rows) ? `${rows.length} rows` : rows);
        resolve(rows);
      }
    });
  });
}

// ==============================
//      Middleware: JWT
// ==============================
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    if (req.path.endsWith(".html")) {
      return res.status(401).send(`
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>Помилка авторизації</title></head>
        <body style="font-family:Arial,sans-serif;padding:30px">
          <h1>Токен відсутній</h1>
          <p>Вам потрібно ввійти в систему для доступу до цієї сторінки.</p>
          <a href="/login.html">Перейти до входу</a>
        </body></html>
      `);
    }
    return res.status(401).json({ success: false, message: "Токен відсутній" });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      if (req.path.endsWith(".html")) {
        return res.status(403).send(`
          <!DOCTYPE html>
          <html><head><meta charset="utf-8"><title>Помилка авторизації</title></head>
          <body style="font-family:Arial,sans-serif;padding:30px">
            <h1>Невірний токен</h1>
            <p>Токен недійсний або прострочений. Будь ласка, увійдіть знову.</p>
            <a href="/login.html">Увійти</a>
          </body></html>
        `);
      }
      return res.status(403).json({ success: false, message: "Невірний токен" });
    }

    try {
      const dbUser = await query("SELECT UserId, RoleId, FirstName FROM dbo.Users WHERE UserId = ?", [decoded.userId]);
      if (!dbUser || dbUser.length === 0) {
        return res.status(403).json({ success: false, message: "Користувач не знайдений" });
      }

      req.user = {
        userId: dbUser[0].UserId,
        roleId: dbUser[0].RoleId,
        firstName: dbUser[0].FirstName,
      };
      next();
    } catch (error) {
      console.error("❌ JWT auth error:", error);
      res.status(500).json({ success: false, message: "Помилка сервера" });
    }
  });
}

// ==============================
//      Рольова авторизація для сторінок/роутів
// ==============================
// ==============================
// 🔥 ВИПРАВЛЕНА рольова авторизація (не блокує HTML)
// ==============================
function requireRoleForPage(page) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).redirect("/login.html");
    }
    
    const roleId = req.user.roleId;
    const pageAccess = {
      "/admin.html": [4],
      "/manager.html": [3, 4],
      "/content-manager.html": [2, 4],
      "/user.html": [1, 3, 4],
    };
    
    const allowedRoles = pageAccess[page] || [];
    if (!allowedRoles.includes(roleId)) {
      console.log(`🚫 Блокування ${page} для ролі ${roleId}`); // DEBUG
      return res.status(403).send(`
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>Помилка доступу</title></head>
        <body style="font-family:Arial;padding:30px">
          <h1>🔒 Недостатньо прав доступу</h1>
          <p>Ваша роль: ${roleMap[roleId] || 'Невідома'}</p>
          <a href="/index.html" style="color:blue;text-decoration:underline">← На головну</a>
        </body></html>
      `);
    }
    next();
  };
}


// ==============================
//      Публічні сторінки
// ==============================
// ==============================
//      Публічні сторінки
// ==============================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "html", "index.html")));
app.get("/index.html", (req, res) => res.sendFile(path.join(__dirname, "html", "index.html")));
app.get("/login.html", (req, res) => res.sendFile(path.join(__dirname, "html", "login.html")));
app.get("/register.html", (req, res) => res.sendFile(path.join(__dirname, "html", "register.html"))); // якщо є

// ==============================
//      Захищені сторінки
// ==============================
app.get("/admin.html", authenticateToken, requireRoleForPage("/admin.html"), (req, res) =>
  res.sendFile(path.join(__dirname, "html", "admin.html"))
);
app.get("/manager.html", authenticateToken, requireRoleForPage("/manager.html"), (req, res) =>
  res.sendFile(path.join(__dirname, "html", "manager.html"))
);
app.get("/content-manager.html", authenticateToken, requireRoleForPage("/content-manager.html"), (req, res) =>
  res.sendFile(path.join(__dirname, "html", "content-manager.html"))
);
app.get("/user.html", authenticateToken, requireRoleForPage("/user.html"), (req, res) =>
  res.sendFile(path.join(__dirname, "html", "user.html"))
);


app.post("/api/login", async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email та пароль потрібні" });
    }

    // Нормалізуємо email для пошуку
    const emailParam = String(email).trim().toLowerCase();

    // Шукаємо користувача в базі
    const users = await query(
      "SELECT UserId, FirstName, LastName, Email, Password, RoleId FROM dbo.Users WHERE LOWER(Email) = ?",
      [emailParam]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, message: "Невірний email або пароль" });
    }

    const user = users[0];

    // Перевірка паролю
    const match = await bcrypt.compare(password, user.Password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Невірний email або пароль" });
    }

    // Генеруємо JWT
    const token = jwt.sign({ userId: user.UserId }, JWT_SECRET, { expiresIn: "24h" });

    // Відповідь з користувачем та токеном
    res.json({
      success: true,
      message: "Успішний вхід",
      token,
      user: {
        userId: user.UserId,
        firstName: user.FirstName,
        lastName: user.LastName,
        email: user.Email,      // повертаємо з бази, зберігаємо регістр
        roleId: user.RoleId,
        roleName: roleMap[user.RoleId] || "Користувач"
      }
    });
  } catch (err) {
    console.error("❌ Помилка логіну:", err);
    res.status(500).json({ success: false, message: "Помилка сервера" });
  }
});


// ==============================
//      API: Поточний користувач
// ==============================
app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const rows = await query(
      "SELECT UserId, FirstName, LastName, Email, Phone, RoleId FROM dbo.Users WHERE UserId = ?",
      [req.user.userId]
    );
    if (!rows || rows.length === 0) 
      return res.status(404).json({ success: false, message: "Користувача не знайдено" });

    const u = rows[0];
    res.json({ 
      success: true, 
      user: {
        userId: u.UserId,
        firstName: u.FirstName,
        lastName: u.LastName,
        email: u.Email,       // 🔹 повертаємо з бази
        phone: u.Phone,
        roleId: u.RoleId
      }
    });
  } catch (err) {
    console.error("❌ /api/me error:", err);
    res.status(500).json({ success: false, message: "Помилка сервера" });
  }
});


// ==============================
//      API: Реєстрація
// ==============================
app.post("/api/register", async (req, res) => {
  try {
    let { firstName, lastName, email, phone, password, confirmPassword } = req.body;
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Заповніть усі обов'язкові поля" });
    }
    if (password !== confirmPassword) return res.status(400).json({ success: false, message: "Паролі не співпадають" });

    email = String(email).trim().toLowerCase();
    const existingUser = await query("SELECT UserId FROM dbo.Users WHERE LOWER(Email) = ?", [email]);
    if (existingUser && existingUser.length > 0) return res.status(400).json({ success: false, message: "Email вже існує" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO dbo.Users (FirstName, LastName, Email, Phone, RoleId, Password) VALUES (?, ?, ?, ?, ?, ?)`,
      [String(firstName).trim(), String(lastName).trim(), email, phone || null, 1, hashedPassword]
    );

    res.json({ success: true, message: "Реєстрація успішна!" });
  } catch (err) {
    console.error("❌ Помилка реєстрації:", err);
    res.status(500).json({ success: false, message: "Помилка сервера" });
  }
});
app.put("/api/user/update", authenticateToken, async (req, res) => {
  try {
    let { firstName, lastName, email, phone } = req.body;

    // ✅ Обов'язкові поля
    if (!firstName || !lastName || !email)
      return res.status(400).json({ success: false, message: "Ім’я, Прізвище та Email обов'язкові" });

    // ✅ Нормалізація та trim
    firstName = String(firstName).trim();
    lastName = String(lastName).trim();
    email = String(email).trim().toLowerCase();
    phone = phone ? String(phone).trim() : null;

    // ✅ Перевірка унікальності email (інший користувач не може мати той самий email)
    const existing = await query(
      "SELECT UserId FROM dbo.Users WHERE LOWER(Email)=? AND UserId<>?",
      [email, req.user.userId]
    );
    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, message: "Цей Email вже використовується іншим користувачем" });
    }

    // ✅ Оновлення профілю
    await query(
      `UPDATE dbo.Users
       SET FirstName=?, LastName=?, Email=?, Phone=?
       WHERE UserId=?`,
      [firstName, lastName, email, phone, req.user.userId]
    );

    res.json({ success: true, message: "Профіль оновлено", user: { firstName, lastName, email, phone } });
  } catch (err) {
    console.error("❌ /api/user/update error:", err);
    res.status(500).json({ success: false, message: "Помилка сервера" });
  }
});


// ==============================
//      API: Фото користувача
// ==============================
const fsPromises = require('fs').promises;

app.post("/api/user/photo", authenticateToken, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, message: "Файл не отримано" });

    const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
    const newFileName = `user_${req.user.userId}${ext}`;
    const newPath = path.join(uploadDir, newFileName);

    await fsPromises.rename(req.file.path, newPath);

    res.json({ success: true, photoPath: `/assets/uploads/${newFileName}` });
  } catch (err) {
    console.error("❌ Помилка фото:", err);
    res.status(500).json({ success: false, message: "Помилка сервера" });
  }
});


// ==============================
//      API: Ролі (адмін)
// ==============================
app.get("/api/roles", authenticateToken, requireRoleForPage("/admin.html"), async (req, res) => {
  try {
    const rows = await query("SELECT RoleId, RoleName FROM dbo.Roles");
    res.json({ success: true, roles: rows });
  } catch (err) {
    console.error("❌ Помилка ролей:", err);
    res.status(500).json({ success: false, message: "Помилка при завантаженні ролей" });
  }
});

// ==============================
//      API: Користувачі (адмін)
// ==============================
app.get("/api/users", authenticateToken, requireRoleForPage("/admin.html"), async (req, res) => {
  try {
    const users = await query(
      `SELECT u.UserId, u.FirstName, u.LastName, u.Email, u.Phone, u.RoleId, r.RoleName
       FROM dbo.Users u
       JOIN dbo.Roles r ON u.RoleId = r.RoleId
       ORDER BY u.UserId`
    );
    res.json({ success: true, users });
  } catch (err) {
    console.error("❌ Помилка при отриманні користувачів:", err);
    res.status(500).json({ success: false, message: "Помилка при отриманні користувачів" });
  }
});

// ==============================
//      Додавання/оновлення/видалення користувачів (адмін)
// ==============================
app.post("/api/users", authenticateToken, requireRoleForPage("/admin.html"), async (req, res) => {
  try {
    const { FirstName, LastName, Email, Phone, RoleId, Password } = req.body;
    if (!FirstName || !LastName || !Email || !Password || !RoleId)
      return res.status(400).json({ success: false, message: "Заповніть усі обов'язкові поля" });

    const normalizedEmail = String(Email).trim().toLowerCase();
    const exists = await query("SELECT UserId FROM dbo.Users WHERE LOWER(Email) = ?", [normalizedEmail]);
    if (exists && exists.length > 0) return res.status(400).json({ success: false, message: "Користувач з таким email вже існує" });

    const hashedPassword = await bcrypt.hash(String(Password), 10);
    await query(
      `INSERT INTO dbo.Users (FirstName, LastName, Email, Phone, RoleId, Password) VALUES (?, ?, ?, ?, ?, ?)`,
      [String(FirstName).trim(), String(LastName).trim(), normalizedEmail, Phone || null, parseInt(RoleId), hashedPassword]
    );

    res.json({ success: true, message: "Користувача успішно додано" });
  } catch (err) {
    console.error("❌ Помилка додавання користувача:", err);
    res.status(500).json({ success: false, message: "Помилка при додаванні користувача" });
  }
});

app.put("/api/users/:id", authenticateToken, requireRoleForPage("/admin.html"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Невірний ID користувача" });

    let { FirstName, LastName, Email, Phone, RoleId, Password } = req.body;
    if (!FirstName || !LastName || !Email || !RoleId)
      return res.status(400).json({ success: false, message: "Заповніть усі обов'язкові поля" });

    const normalizedEmail = String(Email).trim().toLowerCase();
    const sameEmail = await query("SELECT UserId FROM dbo.Users WHERE LOWER(Email)=? AND UserId<>?", [normalizedEmail, id]);
    if (sameEmail && sameEmail.length > 0) return res.status(400).json({ success: false, message: "Email вже використовується іншим користувачем" });

    const params = [String(FirstName).trim(), String(LastName).trim(), normalizedEmail, Phone || null, parseInt(RoleId)];
    let sqlText = `UPDATE dbo.Users SET FirstName=?, LastName=?, Email=?, Phone=?, RoleId=?`;

    if (Password) {
      const hashed = await bcrypt.hash(String(Password), 10);
      sqlText += `, Password=?`;
      params.push(hashed);
    }
    sqlText += " WHERE UserId=?";
    params.push(id);

    await query(sqlText, params);
    res.json({ success: true, message: "Дані користувача оновлено" });
  } catch (err) {
    console.error("❌ Помилка при оновленні користувача:", err);
    res.status(500).json({ success: false, message: "Помилка при оновленні користувача" });
  }
});

app.delete("/api/users/:id", authenticateToken, requireRoleForPage("/admin.html"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Невірний ID користувача" });

    await query("DELETE FROM dbo.Users WHERE UserId=?", [id]);
    res.json({ success: true, message: "Користувача успішно видалено" });
  } catch (err) {
    console.error("❌ Помилка при видаленні користувача:", err);
    res.status(500).json({ success: false, message: "Помилка при видаленні користувача" });
  }
});

// ==============================
//      Тест з'єднання з БД
// ==============================
sql.query(connectionString, "SELECT 1 AS number", (err, rows) => {
  if (err) console.error("❌ DB connection error:", err);
  else console.log("✅ DB підключено:", rows);
});

// ==============================
//      Запуск сервера
// ==============================
app.listen(PORT, () => {
  console.log(`✅ Сервер запущено: http://localhost:${PORT}`);
  console.log(`📱 Логін: http://localhost:${PORT}/login.html`);
  console.log(`👑 Адмін: http://localhost:${PORT}/admin.html`);
});
