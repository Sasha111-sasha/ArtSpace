
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