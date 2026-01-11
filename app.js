// ======================================
// ASISTENTE PENAL IA - APP.JS
// ======================================

// ---------- OPENAI ----------
let OPENAI_API_KEY = localStorage.getItem("openai_key");

if (!OPENAI_API_KEY) {
  OPENAI_API_KEY = prompt("🔐 Ingresa tu API Key de OpenAI:");
  if (OPENAI_API_KEY) {
    localStorage.setItem("openai_key", OPENAI_API_KEY.trim());
  }
}

// ---------- DOM ----------
const caseInput = document.getElementById("caseInput");
const loadCaseBtn = document.getElementById("loadCaseBtn");
const toolsSection = document.getElementById("toolsSection");
const output = document.getElementById("output");

const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const filterFavBtn = document.getElementById("filterFavBtn");
const favCount = document.getElementById("favCount");

const pdfInput = document.getElementById("pdfInput");

// ---------- ESTADO ----------
let caseData = "";
let mostrarSoloFavoritos = false;

// ======================================
// CARGAR TEXTO
// ======================================

loadCaseBtn.addEventListener("click", () => {
  const text = caseInput.value.trim();
  if (!text) {
    alert("Primero ingresa texto o carga un PDF.");
    return;
  }
  caseData = text;
  toolsSection.classList.remove("disabled");
  output.textContent = "Texto cargado. Selecciona una herramienta.";
});

// ======================================
// HERRAMIENTAS
// ======================================

document.querySelectorAll(".tools button").forEach(btn => {
  btn.addEventListener("click", () => {
    ejecutarHerramienta(btn.dataset.action);
  });
});

async function ejecutarHerramienta(tipo) {
  const prompt = construirPrompt(tipo, caseData);
  const resultado = await llamarOpenAI(prompt);

  output.textContent = resultado;

  guardarEnHistorial(
    nombreHerramienta(tipo),
    caseData,
    resultado
  );
}

// ======================================
// PROMPTS
// ======================================

function construirPrompt(tipo, caso) {
  switch (tipo) {
    case "hechos":
      return `Redacta los HECHOS de forma clara y cronológica.\n\nCASO:\n${caso}`;

    case "tipicidad":
      return `Analiza la TIPICIDAD PENAL conforme a la Ley 30096.\n\nCASO:\n${caso}`;

    case "diligencias":
      return `Propón DILIGENCIAS PRELIMINARES conforme al NCPP.\n\nCASO:\n${caso}`;

    case "proveer":
      return `Redacta una PROVIDENCIA FISCAL COMPLETA (Dado Cuenta breve, Considerando y Se Provee).\n\nDOCUMENTO:\n${caso}`;
  }
}

// ======================================
// OPENAI
// ======================================

async function llamarOpenAI(prompt) {
  output.textContent = "⏳ Fizcal-IA esta pensando...";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error.message);
    return data.choices[0].message.content.trim();
  } catch (e) {
    return `❌ Error:\n${e.message}`;
  }
}

// ======================================
// HISTORIAL + FAVORITOS
// ======================================

const HISTORY_KEY = "asistente_penal_historial";

function guardarEnHistorial(tipo, input, outputText) {
  const historial = obtenerHistorial();
  historial.unshift({
    id: Date.now(),
    tipo,
    fecha: new Date().toLocaleString(),
    input: input.slice(0, 200),
    output: outputText,
    favorite: false
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historial));
  renderizarHistorial();
}

function obtenerHistorial() {
  const data = localStorage.getItem(HISTORY_KEY);
  return data ? JSON.parse(data) : [];
}

function eliminarItemHistorial(id) {
  const historial = obtenerHistorial().filter(i => i.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historial));
  renderizarHistorial();
}

function toggleFavorito(id) {
  const historial = obtenerHistorial();
  const item = historial.find(i => i.id === id);
  if (item) item.favorite = !item.favorite;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historial));
  renderizarHistorial();
}

function renderizarHistorial() {
  let historial = obtenerHistorial();

  favCount.textContent = historial.filter(i => i.favorite).length;

  historial.sort((a, b) => (a.favorite === b.favorite ? 0 : a.favorite ? -1 : 1));

  if (mostrarSoloFavoritos) {
    historial = historial.filter(i => i.favorite);
  }

  historyList.innerHTML = "";

  if (!historial.length) {
    historyList.innerHTML = `<li class="empty">No hay consultas guardadas.</li>`;
    return;
  }

  historial.forEach(item => {
    const li = document.createElement("li");
    if (item.favorite) li.classList.add("favorito");

    li.innerHTML = `
      <div class="history-header">
        <strong>${item.tipo}</strong>
        <div>
          <button class="favorite-item">${item.favorite ? "⭐" : "☆"}</button>
          <button class="delete-item">🗑️</button>
        </div>
      </div>
      <small>${item.fecha}</small>
      <p>${item.input}...</p>
    `;

    li.addEventListener("click", () => output.textContent = item.output);
    li.querySelector(".favorite-item").addEventListener("click", e => {
      e.stopPropagation();
      toggleFavorito(item.id);
    });
    li.querySelector(".delete-item").addEventListener("click", e => {
      e.stopPropagation();
      if (confirm("¿Eliminar esta consulta?")) eliminarItemHistorial(item.id);
    });

    historyList.appendChild(li);
  });
}

filterFavBtn.addEventListener("click", () => {
  mostrarSoloFavoritos = !mostrarSoloFavoritos;
  filterFavBtn.classList.toggle("active", mostrarSoloFavoritos);
  renderizarHistorial();
});

clearHistoryBtn.addEventListener("click", () => {
  if (!confirm("⚠️ Se eliminará todo el historial. ¿Continuar?")) return;
  localStorage.removeItem(HISTORY_KEY);
  renderizarHistorial();
});

// ======================================
// PDF LIGERO
// ======================================

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

pdfInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  output.textContent = "⏳ Leyendo PDF…";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let texto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map(it => it.str).join(" ") + "\n\n";
  }

  caseInput.value = texto.trim();
  caseData = texto.trim();
  toolsSection.classList.remove("disabled");
  output.textContent = "✅ PDF cargado correctamente.";
  pdfInput.value = "";
});

// ---------- INIT ----------
renderizarHistorial();
// ======================================
// TEMA CLARO / OSCURO
// ======================================

const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("theme") || "light";

document.body.setAttribute("data-theme", savedTheme);
themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";

themeToggle.addEventListener("click", () => {
  const currentTheme = document.body.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  document.body.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";
});
