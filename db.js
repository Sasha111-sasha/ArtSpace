/*const sql = require("msnodesqlv8");

const connectionString = "Driver={ODBC Driver 18 for SQL Server};Server=localhost;Database=ArtSpaceDb;Trusted_Connection=Yes;TrustServerCertificate=Yes;";

// Функція виконання SQL запиту з параметрами
function query(sqlQuery, params = {}) {
  return new Promise((resolve, reject) => {
    const request = new sql.SqlRequest(connectionString);

    // Додаємо параметри
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }

    request.query(sqlQuery, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Тест підключення
sql.query(connectionString, "SELECT 1 as number", (err, rows) => {
  if (err) console.error("❌ DB connection error:", err);
  else console.log("✅ DB connected:", rows);
});

module.exports = { query };
*/
const sql = require("mssql/msnodesqlv8");

const config = {
  server: "localhost",
  database: "ArtSpaceDb",
  driver: "msnodesqlv8",
  options: {
    trustedConnection: true,
    trustServerCertificate: true
  }
};

const pool = new sql.ConnectionPool(config);

pool.connect()
  .then(() => console.log("✅ Підключення до MSSQL успішне"))
  .catch(err => console.error("❌ Помилка підключення:", err));

async function query(sqlQuery, params = []) {
  try {
    const request = pool.request();
    params.forEach((param, i) => request.input(`param${i}`, param));
    const result = await request.query(sqlQuery);
    return result.recordset;
  } catch (err) {
    throw err;
  }
}

module.exports = { query };
