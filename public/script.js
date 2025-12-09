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

async function loadUsers() {
  try {
    const res = await fetch("/api/users");
    if (!res.ok) throw new Error("Помилка при отриманні користувачів");
    const users = await res.json();
    const tbody = document.getElementById("userTableBody");
    tbody.innerHTML = "";

    users.forEach((user) => {
      const row = document.createElement("tr");
      row.dataset.id = user.UserId;
      row.innerHTML = `
        <td>${user.UserId}</td>
        <td contenteditable="false" data-field="first_name">${escapeHtml(user.FirstName)}</td>
        <td contenteditable="false" data-field="last_name">${escapeHtml(user.LastName)}</td>
        <td contenteditable="false" data-field="email">${escapeHtml(user.Email)}</td>
        <td contenteditable="false" data-field="phone_number">${escapeHtml(user.Phone || "")}</td>
        <td contenteditable="false" data-field="role_id">${roleMap[user.RoleId] || "Невідома"}</td>
        <td>
          <button class="edit-btn">Редагувати</button>
          <button class="delete-btn">Видалити</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    alert("Помилка при завантаженні користувачів");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("addUserForm");
  const toggleBtn = document.getElementById("toggleAddUserFormBtn");
  const tbody = document.getElementById("userTableBody");

  toggleBtn.addEventListener("click", () => {
    const visible = form.style.display === "block";
    form.style.display = visible ? "none" : "block";
    toggleBtn.textContent = visible ? "Додати нового користувача" : "Приховати форму";
  });

  function validateUser(data, checkPassword = true) {
    const nameRegex = /^[А-Яа-яA-Za-zЁёЇїІіЄєҐґ'-]{2,}$/;
    const emailRegex = /^\S+@\S+\.\S+$/;
    const passwordRegex = /^.{6,12}$/;

    if (!data.FirstName || !nameRegex.test(data.FirstName))
      return "Ім’я має містити лише букви та ≥2 символів";

    if (!data.LastName || !nameRegex.test(data.LastName))
      return "Прізвище має містити лише букви та ≥2 символів";

    if (!data.Email || !emailRegex.test(data.Email))
      return "Некоректний email";

    if (!data.Phone)
      return "Поле Телефон обов’язкове для заповнення";

    const phone = data.Phone.trim();
    if (phone.length === 10 && /^\d{10}$/.test(phone)) {
      // Valid 10 digits without plus
    } else if (phone.length === 13 && /^\+\d{12}$/.test(phone)) {
      // Valid 12 digits with plus
    } else {
      return "Телефон повинен бути 10 цифр без плюса або 12 цифр з плюсом (11 цифр не допускається)";
    }

    if (checkPassword && (!data.Password || !passwordRegex.test(data.Password)))
      return "Пароль має містити 6-12 символів";

    if (!data.RoleId)
      return "Оберіть роль";

    return null;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const roleSelect = form.querySelector("select[name='RoleId']");
    const selectedOption = roleSelect.options[roleSelect.selectedIndex];

    const data = {
      FirstName: form.first_name.value.trim(),
      LastName: form.last_name.value.trim(),
      Email: form.email.value.trim(),
      Phone: form.phone_number.value.trim(),
      Password: form.password.value.trim(),
      RoleId: parseInt(selectedOption.value),
    };

    const error = validateUser(data);
    if (error) {
      alert(error);
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();

      if (!res.ok) {
        alert(result.message || "Помилка при додаванні користувача");
        return;
      }

      alert(result.message || "Користувача успішно додано!");
      form.reset();
      form.style.display = "none";
      toggleBtn.textContent = "Додати нового користувача";
      await loadUsers();
    } catch (err) {
      alert("Помилка при додаванні користувача");
      console.error(err);
    }
  });

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const row = btn.closest("tr");
    const id = row.dataset.id;

    // 🔴 Видалення
if (btn.classList.contains("delete-btn")) {
  if (!confirm("Ви дійсно хочете видалити цього користувача?")) return;

  try {
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    const result = await res.json();
    alert(result.message || "Користувача успішно видалено!");
    await loadUsers();
  } catch (err) {
    console.error(err);
    alert("Помилка при видаленні користувача");
  }
}


    if (btn.classList.contains("edit-btn")) {
      const isEditing = row.dataset.editing === "true";

      if (!isEditing) {
        row.querySelectorAll("td[data-field]").forEach((td) => {
          if (td.dataset.field !== "role_id") td.contentEditable = "true";
        });

        const roleTd = row.querySelector("td[data-field='role_id']");
        const currentRoleId = parseInt(
          Object.keys(roleMap).find((k) => roleMap[k] === roleTd.textContent) || "0"
        );
        roleTd.innerHTML = `<select>${Object.entries(roleMap)
          .map(
            ([id, name]) =>
              `<option value="${id}" ${parseInt(id) === currentRoleId ? "selected" : ""}>${name}</option>`
          )
          .join("")}</select>`;

        row.dataset.editing = "true";
        btn.textContent = "Зберегти";
      } else {
        const payload = {};
        row.querySelectorAll("td[data-field]").forEach((td) => {
          if (td.dataset.field === "role_id")
            payload.RoleId = parseInt(td.querySelector("select").value);
          else if (td.dataset.field === "first_name") payload.FirstName = td.textContent.trim();
          else if (td.dataset.field === "last_name") payload.LastName = td.textContent.trim();
          else if (td.dataset.field === "email") payload.Email = td.textContent.trim();
          else if (td.dataset.field === "phone_number") payload.Phone = td.textContent.trim();
        });

        const error = validateUser({ ...payload, Password: "dummy" }, false);
        if (error) {
          alert(error);
          return;
        }

        try {
          const res = await fetch(`/api/users/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const result = await res.json();

          if (!res.ok) {
            alert(result.message || "Помилка при редагуванні користувача");
            return;
          }

          row.querySelectorAll("td[data-field]").forEach((td) => (td.contentEditable = false));
          row.querySelector("td[data-field='role_id']").textContent =
            roleMap[payload.RoleId] || "Невідома";
          delete row.dataset.editing;
          btn.textContent = "Редагувати";
          await loadUsers();
        } catch (err) {
          alert("Помилка при редагуванні користувача");
          console.error(err);
        }
      }
    }
  });

  loadUsers();
});