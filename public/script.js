
/* =========================
   FULL admin script.js
   - AUTH (token + role check)
   - CRUD users (load, add, edit, delete)
   - Logout button
   - Menu access blocking
   ========================= */

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const roleMap = {
  1: "Покупець",
  2: "Контент-менеджер",
  3: "Менеджер",
  4: "Адміністратор",
};

const TOKEN_KEY = "artspace_token";
const USER_KEY = "artspace_user";

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getUser() { 
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "{}"); }
  catch { return {}; }
}
function saveAuth(token, user) { 
  localStorage.setItem(TOKEN_KEY, token); 
  localStorage.setItem(USER_KEY, JSON.stringify(user)); 
}
function clearAuth() { 
  localStorage.removeItem(TOKEN_KEY); 
  localStorage.removeItem(USER_KEY); 
}

async function apiRequest(url, options = {}) {
  const token = getToken();
  const config = { 
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }, 
    ...options 
  };
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  const response = await fetch(url, config);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

/* =========================
   CHECK ADMIN ACCESS (your message + redirect)
   ========================= */
async function checkAdminAccess() {
  const token = localStorage.getItem('artspace_token');
  const user = JSON.parse(localStorage.getItem('artspace_user') || '{}');
  const roleId = user.roleId ?? 0;

  if (!token || roleId !== 4) {                // доступ тільки адміну
      alert("⛔ У вас немає доступу до цієї сторінки\n\n🔒 ПЕРЕВІРКА АВТОРИЗАЦІЇ ТА РОЛІ");
      clearAuth();
      window.location.href = "/index.html";
      return false;
  }

  console.log("🎉 Доступ надано. Ви адміністратор.");
  return true;
}

/* ===================== LOGOUT BUTTON ===================== */
function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Ви дійсно бажаєте вийти з акаунту?')) {
        clearAuth();
        window.location.href = '/index.html';
      }
    });
  }
}

function addLogoutButton() {
  const menus = document.querySelectorAll('nav ul.menu');
  menus.forEach(menu => {
    if (!menu.querySelector('#logoutBtn')) {
      menu.insertAdjacentHTML('beforeend','<li><a href="#" id="logoutBtn">Вийти</a></li>');
    }
  });
  setupLogout();
}

/* =========================
   VALIDATION
   ========================= */
function validateUser(data, checkPassword = true) {
  const nameRegex = /^[А-Яа-яA-Za-zЁёЇїІіЄєҐґ'-]{2,}$/;
  const emailRegex = /^\S+@\S+\.\S+$/;
  const passwordRegex = /^.{6,12}$/;

  if (!data.FirstName || !nameRegex.test(data.FirstName))
    return "Ім'я має містити лише букви та ≥2 символів";

  if (!data.LastName || !nameRegex.test(data.LastName))
    return "Прізвище має містити лише букви та ≥2 символів";

  if (!data.Email || !emailRegex.test(data.Email))
    return "Некоректний email";

  if (!data.Phone) return "Поле Телефон обов'язкове";

  const phone = data.Phone.trim();
  if (!( (phone.length===10 && /^\d{10}$/.test(phone)) || (phone.length===13 && /^\+\d{12}$/.test(phone)) ))
    return "Телефон повинен бути 10 цифр або 12 з '+'";

  if (checkPassword && (!data.Password || !passwordRegex.test(data.Password)))
    return "Пароль має бути 6-12 символів";

  if (!data.RoleId || ![1,2,3,4].includes(parseInt(data.RoleId)))
    return "Оберіть роль";

  return null;
}

/* =========================
   LOAD USERS (render table rows)
   ========================= */
async function loadUsers() {
  try {
    const res = await apiRequest("/api/users");
    const users = res.users || res;
    const tbody = document.getElementById("userTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";
    users.forEach((user) => {
      const row = document.createElement("tr");
      row.dataset.id = user.UserId;
      row.innerHTML = `
        <td>${user.UserId}</td>
        <td data-field="FirstName" contenteditable="false">${escapeHtml(user.FirstName)}</td>
        <td data-field="LastName" contenteditable="false">${escapeHtml(user.LastName)}</td>
        <td data-field="Email" contenteditable="false">${escapeHtml(user.Email)}</td>
        <td data-field="Phone" contenteditable="false">${escapeHtml(user.Phone || "")}</td>
        <td data-field="RoleId" contenteditable="false">${roleMap[user.RoleId] || "Невідома"}</td>
        <td>
          <button class="edit-btn">Редагувати</button>
          <button class="delete-btn">Видалити</button>
        </td>`;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    alert("Помилка при завантаженні користувачів");
  }
}

/* =========================
   INIT ADMIN PANEL (add, edit, delete)
   ========================= */
async function initAdminPanel() {
  const form = document.getElementById("addUserForm");
  const toggleBtn = document.getElementById("toggleAddUserFormBtn");
  const tbody = document.getElementById("userTableBody");

  if (!form || !toggleBtn || !tbody) {
    console.error("❌ Admin елементи не знайдено");
    return;
  }

  // toggle form visibility
  toggleBtn.addEventListener("click", () => {
    const visible = form.style.display === "block";
    form.style.display = visible ? "none" : "block";
    toggleBtn.textContent = visible ? "Додати нового користувача" : "Приховати форму";
  });

  // add user
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      FirstName: form.first_name.value.trim(),
      LastName: form.last_name.value.trim(),
      Email: form.email.value.trim(),
      Phone: form.phone_number.value.trim(),
      Password: form.password.value.trim(),
      RoleId: parseInt(form.RoleId.value),
    };

    const error = validateUser(data);
    if (error) { alert(error); return; }

    try {
      await apiRequest("/api/users", { method: "POST", body: JSON.stringify(data) });
      alert("Користувача успішно додано!");
      form.reset();
      form.style.display = "none";
      toggleBtn.textContent = "Додати нового користувача";
      await loadUsers();
    } catch (err) {
      alert("Помилка при додаванні користувача: " + err.message);
    }
  });

  // edit/delete (event delegation)
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const row = btn.closest("tr");
    const id = row.dataset.id;

    // DELETE
    if (btn.classList.contains("delete-btn")) {
      if (!confirm("Ви дійсно хочете видалити цього користувача?")) return;
      try {
        await apiRequest(`/api/users/${id}`, { method: "DELETE" });
        alert("Користувача видалено");
        await loadUsers();
      } catch (err) {
        alert("Помилка при видаленні: " + err.message);
      }
      return;
    }

    // EDIT / SAVE
    if (btn.classList.contains("edit-btn")) {
      const isEditing = row.dataset.editing === "true";
      if (!isEditing) {
        // enter edit mode
        row.querySelectorAll("td[data-field]").forEach((td) => {
          if (td.dataset.field !== "RoleId") td.contentEditable = "true";
        });

        const roleTd = row.querySelector("td[data-field='RoleId']");
        const currentRoleId = parseInt(Object.keys(roleMap).find((k) => roleMap[k] === roleTd.textContent) || "1");
        roleTd.innerHTML = `<select data-role-id>${Object.entries(roleMap)
          .map(([id, name]) => `<option value="${id}" ${parseInt(id) === currentRoleId ? "selected" : ""}>${name}</option>`)
          .join("")}</select>`;

        row.dataset.editing = "true";
        btn.textContent = "Зберегти";
      } else {
        // gather payload
        const payload = {};
        row.querySelectorAll("td[data-field]").forEach((td) => {
          if (td.dataset.field === "RoleId") payload.RoleId = parseInt(td.querySelector("select").value);
          else if (td.dataset.field === "FirstName") payload.FirstName = td.textContent.trim();
          else if (td.dataset.field === "LastName") payload.LastName = td.textContent.trim();
          else if (td.dataset.field === "Email") payload.Email = td.textContent.trim();
          else if (td.dataset.field === "Phone") payload.Phone = td.textContent.trim();
        });

        const error = validateUser({ ...payload, Password: "dummy" }, false);
        if (error) { alert(error); return; }

        try {
          await apiRequest(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(payload) });
          alert("Користувача оновлено");
          // exit edit mode and reload
          delete row.dataset.editing;
          btn.textContent = "Редагувати";
          await loadUsers();
        } catch (err) {
          alert("Помилка при редагуванні: " + err.message);
        }
      }
    }
  });

  await loadUsers();
}

/* =========================
   MENU ACCESS BLOCKING (prevent unauthorized nav clicks)
   ========================= */
function setupMenuBlocking() {
  const user = getUser();
  const roleId = user.roleId ?? 0;
  document.querySelectorAll('nav ul.menu a').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = link.getAttribute('href');
      const pages = {
        "content-manager.html": [3,4],
        "manager.html": [2,4],
        "admin.html": [4]
      };
      if (pages[target] && !pages[target].includes(roleId)) {
        e.preventDefault();
        clearAuth();
        alert("⛔ У вас немає доступу до цієї сторінки");
        window.location.href = "/index.html";
      }
    });
  });
}

/* =========================
   MAIN START
   ========================= */
document.addEventListener("DOMContentLoaded", async () => {
  addLogoutButton();             // вставляє кнопку Вийти в меню
  setupMenuBlocking();           // блокує навігацію для чужих ролей

  const allowed = await checkAdminAccess(); // твоя перевірка (alert + redirect)
  if (!allowed) return;

  await initAdminPanel();
  console.log("✅ АДМІН ПАНЕЛЬ ГОТОВА!");
});

