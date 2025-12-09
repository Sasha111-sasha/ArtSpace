const express = require("express");
const path = require("path");
const sql = require("msnodesqlv8");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/public", express.static(path.join(__dirname, "public")));

const connectionString =
  "Driver={ODBC Driver 18 for SQL Server};Server=localhost;Database=ArtSpaceDb;Trusted_Connection=Yes;TrustServerCertificate=Yes;";

function query(sqlQuery, params = []) {
  return new Promise((resolve, reject) => {
    sql.query(connectionString, sqlQuery, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Test DB connection
sql.query(connectionString, "SELECT 1 AS number", (err, rows) => {
  if (err) console.error("❌ DB connection error:", err);
  else console.log("✅ DB connected:", rows);
});

// Helper: get RoleId by RoleName
async function getRoleIdByName(roleName) {
  const rows = await query("SELECT RoleId FROM dbo.Roles WHERE RoleName = ?", [roleName]);
  if (!rows || rows.length === 0) return null;
  return rows[0].RoleId;
}

// GET /api/users
app.get("/api/users", async (req, res) => {
  try {
    const users = await query(
      `SELECT u.UserId, u.FirstName, u.LastName, u.Email, u.Phone, u.RoleId, r.RoleName
       FROM dbo.Users u
       JOIN dbo.Roles r ON u.RoleId = r.RoleId
       ORDER BY u.UserId`
    );
    res.json(users);
  } catch (err) {
    console.error("❌ Помилка при отриманні користувачів:", err);
    res.status(500).json({ message: "Помилка при отриманні користувачів" });
  }
});

// POST /api/users
app.post("/api/users", async (req, res) => {
  try {
    const { FirstName, LastName, Email, Phone, RoleId, Password } = req.body;

    if (!FirstName || !LastName || !Email || !Password || !RoleId) {
      return res.status(400).json({ message: "Заповніть усі обов’язкові поля" });
    }

    const hashedPassword = await bcrypt.hash(Password, 10);

    await query(
      `INSERT INTO dbo.Users (FirstName, LastName, Email, Phone, RoleId, Password)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [FirstName, LastName, Email, Phone || null, RoleId, hashedPassword]
    );

    res.json({ success: true, message: "Користувача успішно додано" });
  } catch (err) {
    console.error("❌ Помилка при додаванні користувача:", err);
    res.status(500).json({ success: false, message: "Помилка при додаванні користувача" });
  }
});

// PUT /api/users/:id
app.put("/api/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: "Невірний ID користувача" });

    let { FirstName, LastName, Email, Phone, RoleId, RoleName, Password } = req.body;

    // If RoleName passed instead of RoleId
    if ((!RoleId || isNaN(parseInt(RoleId))) && RoleName) {
      const rid = await getRoleIdByName(RoleName);
      if (!rid) return res.status(400).json({ success: false, message: `Роль "${RoleName}" не знайдена` });
      RoleId = rid;
    }
    RoleId = parseInt(RoleId);

    if (!FirstName || !LastName || !Email || !RoleId) {
      return res.status(400).json({ success: false, message: "Заповніть усі обов’язкові поля" });
    }

    const params = [FirstName, LastName, Email, Phone || null, RoleId];
    let sqlText = `UPDATE dbo.Users SET FirstName=?, LastName=?, Email=?, Phone=?, RoleId=?`;

    if (Password) {
      const hashedPassword = await bcrypt.hash(Password, 10);
      sqlText += `, Password=?`;
      params.push(hashedPassword);
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

// DELETE /api/users/:id
app.delete("/api/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Невірний ID користувача" });

    await query("DELETE FROM dbo.Users WHERE UserId=?", [id]);

    res.json({ message: "Користувача успішно видалено" });
  } catch (err) {
    console.error("❌ Помилка при видаленні користувача:", err);
    res.status(500).json({ message: "Помилка при видаленні користувача" });
  }
});



// GET /api/roles
app.get("/api/roles", async (req, res) => {
  try {
    const roles = await query("SELECT RoleId, RoleName FROM dbo.Roles");
    res.json(roles);
  } catch (err) {
    console.error("❌ Помилка при завантаженні ролей:", err);
    res.status(500).json({ message: "Помилка при завантаженні ролей" });
  }
});

// Main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "html", "admin.html"));
});

app.listen(PORT, () => console.log(`✅ Сервер запущено: http://localhost:${PORT}`));