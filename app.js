/*************************************************
 * CONFIG
 *************************************************/

const OPENAI_MODEL = "gpt-4.1-mini";
const HISTORIAL_KEY = "transactions";

/*************************************************
 * ELEMENTOS
 *************************************************/

const inputText = document.getElementById("caseInput");
const output = document.getElementById("output");
const historyList = document.getElementById("historyList");
const pdfInput = document.getElementById("pdfInput");

/*************************************************
 * API KEY
 *************************************************/

let OPENAI_API_KEY = localStorage.getItem("openai_key");

if (!OPENAI_API_KEY) {
  OPENAI_API_KEY = prompt("🔐 Ingresa tu API Key de OpenAI:");
  if (OPENAI_API_KEY) {
    localStorage.setItem("openai_key", OPENAI_API_KEY.trim());
  }
}

/*************************************************
 * UTILIDADES UX
 *************************************************/

function setButtonsDisabled(state) {
  document.querySelectorAll(".tool-btn").forEach(btn => {
    btn.disabled = state;
  });
}

function safeBind(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
}

/*************************************************
 * HISTORIAL
 *************************************************/

function obtenerHistorial() {
  return JSON.parse(localStorage.getItem(HISTORIAL_KEY)) || [];
}

function guardarEnHistorial(item) {
  const historial = obtenerHistorial();
  historial.unshift(item);
  localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial));
}

function eliminarItem(id) {
  const historial = obtenerHistorial().filter(i => i.id !== id);
  localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial));
  renderizarHistorial();
}

function borrarTodoHistorial() {
  if (!confirm("¿Borrar todo el historial?")) return;
  localStorage.removeItem(HISTORIAL_KEY);
  renderizarHistorial();
}

/*************************************************
 * RENDER HISTORIAL
 *************************************************/

function renderizarHistorial(soloFavoritos = false) {
  const historial = obtenerHistorial();
  historyList.innerHTML = "";

  const items = soloFavoritos ? historial.filter(i => i.favorite) : historial;

  if (!items.length) {
    historyList.innerHTML = `<li class="empty">No hay consultas guardadas.</li>`;
    actualizarContador();
    return;
  }

  items.forEach(item => {
    const li = document.createElement("li");
    if (item.favorite) li.classList.add("favorito");

    li.innerHTML = `
      <div class="history-header">
        <div>
          <span class="badge">${item.tipo}</span>
          <strong>${item.tipo}</strong>
        </div>
        <div>
          <span class="favorite-item">${item.favorite ? "⭐" : "☆"}</span>
          <span class="delete-item">🗑️</span>
        </div>
      </div>
      <small>${item.fecha}</small>
      <p>${item.preview}</p>
    `;

    li.addEventListener("click", () => {
      output.textContent = item.output;
    });

    li.querySelector(".favorite-item").onclick = e => {
      e.stopPropagation();
      item.favorite = !item.favorite;
      localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial));
      renderizarHistorial(soloFavoritos);
    };

    li.querySelector(".delete-item").onclick = e => {
      e.stopPropagation();
      eliminarItem(item.id);
    };

    historyList.appendChild(li);
  });

  actualizarContador();
}

function actualizarContador() {
  const el = document.getElementById("historyCount");
  if (!el) return;
  el.textContent = obtenerHistorial().filter(i => i.favorite).length;
}

/*************************************************
 * PROMPTS
 *************************************************/

function construirPrompt(tipo, texto) {
  const base = `
Actúa como fiscal penal peruano.
Lenguaje técnico, sobrio y objetivo.
No inventes hechos ni datos.
No emitas juicios definitivos.
`;

  if (tipo === "Hechos") {
    return `${base}
Redacta el apartado HECHOS de forma cronológica y numerada:

${texto}`;
  }

  if (tipo === "Tipicidad") {
    return `${base}
Realiza un ANÁLISIS DE TIPICIDAD PENAL PRELIMINAR,
citando Código Penal y/o Ley 30096 cuando corresponda.

Caso:
${texto}`;
  }

  if (tipo === "Diligencias") {
    return `${base}
Propón DILIGENCIAS PRELIMINARES numeradas y razonables.

Caso:
${texto}`;
  }

  if (tipo === "Proveer") {
    return `${base}
Redacta una PROVIDENCIA FISCAL con esta estructura exacta:

DADO CUENTA:
El escrito que antecede;

CONSIDERANDO:
(una consideración breve)

SE PROVEE:
Téngase presente lo informado y agréguese a los actuados.

Texto:
${texto}`;
  }
}

/*************************************************
 * OPENAI
 *************************************************/

async function consultarIA(tipo) {
  const texto = inputText.value.trim();
  if (!texto) return alert("Ingrese texto o cargue un PDF.");

  const loader = document.getElementById("loadingIndicator");
  if (loader) loader.classList.remove("hidden");
  setButtonsDisabled(true);
  output.textContent = "";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: construirPrompt(tipo, texto) }],
        temperature: 0.2
      })
    });

    const data = await response.json();
    const resultado = data.choices[0].message.content.trim();

    output.textContent = resultado;

    guardarEnHistorial({
      id: Date.now(),
      tipo,
      fecha: new Date().toLocaleString(),
      preview: resultado.slice(0, 120) + "...",
      output: resultado,
      favorite: false
    });

    renderizarHistorial();

  } catch (e) {
    output.textContent = "Error al consultar la IA.";
    console.error(e);
  } finally {
    setButtonsDisabled(false);
    if (loader) loader.classList.add("hidden");
  }
}

/*************************************************
 * PDF.JS
 *************************************************/

pdfInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let texto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map(i => i.str).join(" ") + "\n\n";
  }

  inputText.value = texto.slice(0, 8000);
});

/*************************************************
 * TEMA OSCURO
 *************************************************/

const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("theme") || "light";
document.body.setAttribute("data-theme", savedTheme);
themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";

themeToggle.onclick = () => {
  const newTheme =
    document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";
};

/*************************************************
 * BINDS + INIT
 *************************************************/

safeBind("btnHechos", () => consultarIA("Hechos"));
safeBind("btnTipicidad", () => consultarIA("Tipicidad"));
safeBind("btnDiligencias", () => consultarIA("Diligencias"));
safeBind("btnProveer", () => consultarIA("Proveer"));

safeBind("clearHistoryBtn", borrarTodoHistorial);
safeBind("filterFavoritesBtn", () => renderizarHistorial(true));

renderizarHistorial();
