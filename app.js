/**************************************
 * API KEY – DEMO LOCAL (FRONTEND)
 **************************************/
function obtenerApiKey() {
  let key = localStorage.getItem("openai_api_key");

  if (!key) {
    key = prompt(
      "🔐 Ingresa tu API Key de OpenAI\n\n" +
      "• Se guardará solo en este navegador\n" +
      "• Puedes borrarla desde el DevTools\n" +
      "• Usa una key de DEMO"
    );

    if (!key || !key.trim()) {
      alert("⚠️ No se ingresó una API Key. La app no podrá funcionar.");
      return null;
    }

    localStorage.setItem("openai_api_key", key.trim());
  }

  return key;
}

const OPENAI_API_KEY = obtenerApiKey();
/*************************************************
 * CONFIGURACIÓN GENERAL
 *************************************************/

const OPENAI_MODEL = "gpt-4.1-mini";
const HISTORIAL_KEY = "transactions";

/*************************************************
 * ELEMENTOS DOM
 *************************************************/

const inputText = document.getElementById("caseInput");
const output = document.getElementById("output");
const historyList = document.getElementById("historyList");
const pdfInput = document.getElementById("pdfInput");
const themeToggle = document.getElementById("themeToggle");

let mostrarSoloFavoritos = false;

/*************************************************
 * CARGA DE NORMAS (JSON RAG)
 *************************************************/

let LEY_30096 = null;
let CODIGO_PENAL = null;
let NCPP = null;

async function cargarNormas() {
  try {
    LEY_30096 = await fetch("ley30096.rag.json").then(r => r.json());
    CODIGO_PENAL = await fetch("codigo_penal.rag.json").then(r => r.json());
    NCPP = await fetch("ncpp.rag.json").then(r => r.json());
  } catch (e) {
    console.error("Error cargando normas:", e);
    alert("Error cargando archivos normativos (JSON).");
  }
}

cargarNormas();

/*************************************************
 * RAG – DETECCIÓN MÚLTIPLE DE DELITOS
 *************************************************/

function detectarDelitos(texto) {
  const t = texto.toLowerCase();
  const delitos = new Set();

  if (
    t.includes("suplantación") ||
    t.includes("suplantacion") ||
    t.includes("se hizo pasar") ||
    t.includes("uso de identidad")
  ) {
    delitos.add("SUPLANTACION");
  }

  if (
    t.includes("fraude") ||
    t.includes("phishing") ||
    t.includes("transferencia") ||
    t.includes("movimientos bancarios") ||
    t.includes("página web falsa") ||
    t.includes("pagina web falsa")
  ) {
    delitos.add("FRAUDE");
  }

  if (
    t.includes("acceso no autorizado") ||
    t.includes("accedió sin autorización") ||
    t.includes("credenciales") ||
    t.includes("clave")
  ) {
    delitos.add("ACCESO");
  }

  return Array.from(delitos);
}

/*************************************************
 * RAG – ARTÍCULOS AUTORIZADOS
 *************************************************/

function obtenerArticulosAutorizados(delitos) {
  if (!LEY_30096) return [];

  const articulos = [];

  delitos.forEach(delito => {
    if (delito === "SUPLANTACION") {
      articulos.push(...LEY_30096.articulos.filter(a => a.numero === 9));
    }
    if (delito === "FRAUDE") {
      articulos.push(...LEY_30096.articulos.filter(a => a.numero === 8));
    }
    if (delito === "ACCESO") {
      articulos.push(...LEY_30096.articulos.filter(a => a.numero === 2));
    }
  });

  return Array.from(
    new Map(articulos.map(a => [a.numero, a])).values()
  );
}

function construirBloqueNormativo(articulos) {
  if (!articulos.length) {
    return "NO SE IDENTIFICAN ARTÍCULOS APLICABLES EN LA BASE NORMATIVA.";
  }

  return articulos.map(a => `
LEY 30096
ARTÍCULO ${a.codigo} – ${a.titulo}
${a.texto}
`).join("\n");
}

/*************************************************
 * PROMPTS (RAG ESTRICTO)
 *************************************************/

function construirPrompt(tipo, texto) {
  const reglas = `
Eres fiscal penal peruano.

REGLAS ABSOLUTAS:
- SOLO puedes citar artículos contenidos en el BLOQUE NORMATIVO.
- Está PROHIBIDO usar conocimiento jurídico externo.
- Si el artículo no está en el bloque, NO EXISTE.
- NO inventes ni sustituyas artículos.
`;

  if (tipo === "Tipicidad") {
    const delitos = detectarDelitos(texto);
    const articulos = obtenerArticulosAutorizados(delitos);
    const bloque = construirBloqueNormativo(articulos);

    return `${reglas}

BLOQUE NORMATIVO AUTORIZADO:
${bloque}

TAREA:
Realiza un ANÁLISIS DE TIPICIDAD PENAL PRELIMINAR.
Indica:
- Delito(s) identificado(s)
- Norma aplicable
- Artículo(s) exacto(s)
- Breve fundamentación

NO cites nada fuera del bloque.

CASO:
${texto}`;
  }

  if (tipo === "Hechos") {
    return `${reglas}
Redacta HECHOS de forma cronológica y numerada:

${texto}`;
  }

  if (tipo === "Diligencias") {
    return `${reglas}
Propón DILIGENCIAS PRELIMINARES razonables y numeradas,
conforme al Nuevo Código Procesal Penal:

${texto}`;
  }

  if (tipo === "Proveer") {
    return `${reglas}
Redacta una PROVIDENCIA FISCAL con esta estructura obligatoria:

DADO CUENTA:
El escrito que antecede;

CONSIDERANDO:
(una consideración breve)

SE PROVEE:
Téngase presente lo informado y agréguese a los actuados.

Texto base:
${texto}`;
  }
}

/*************************************************
 * OPENAI
 *************************************************/

async function consultarIA(tipo) {
  const texto = inputText.value.trim();
  if (!texto) {
    alert("Ingrese texto o cargue un PDF.");
    return;
  }

  output.textContent = "🧠⏳ Fizcal-IA está procesando...";

  const prompt = construirPrompt(tipo, texto);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);
      output.textContent =
        "❌ Error al consultar la IA.\n\n" +
        (data.error?.message || "Solicitud inválida a OpenAI.");
      return;
    }

    const resultado =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text;

    if (!resultado) {
      console.error("Respuesta inesperada:", data);
      output.textContent = "❌ La IA no devolvió texto.";
      return;
    }

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
    console.error(e);
    output.textContent = "❌ Error de conexión con OpenAI.";
  }
}

/*************************************************
 * HISTORIAL
 *************************************************/

function obtenerHistorial() {
  return JSON.parse(localStorage.getItem(HISTORIAL_KEY)) || [];
}

function guardarHistorial(historial) {
  localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial));
}

function guardarEnHistorial(item) {
  const historial = obtenerHistorial();
  historial.unshift(item);
  guardarHistorial(historial);
}

function renderizarHistorial() {
  const historial = obtenerHistorial();
  const items = mostrarSoloFavoritos
    ? historial.filter(i => i.favorite)
    : historial;

  historyList.innerHTML = "";

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
        <strong>${item.tipo}</strong>
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

    li.querySelector(".favorite-item").addEventListener("click", e => {
      e.stopPropagation();
      item.favorite = !item.favorite;

      const nuevoHistorial = obtenerHistorial()
        .map(i => i.id === item.id ? item : i)
        .sort((a, b) => b.favorite - a.favorite);

      guardarHistorial(nuevoHistorial);
      renderizarHistorial();
    });

    li.querySelector(".delete-item").addEventListener("click", e => {
      e.stopPropagation();
      guardarHistorial(obtenerHistorial().filter(i => i.id !== item.id));
      renderizarHistorial();
    });

    historyList.appendChild(li);
  });

  actualizarContador();
}

function actualizarContador() {
  const el = document.getElementById("historyCount");
  if (el) {
    el.textContent = obtenerHistorial().filter(i => i.favorite).length;
  }
}

/*************************************************
 * BINDS
 *************************************************/

document.getElementById("btnHechos").onclick = () => consultarIA("Hechos");
document.getElementById("btnTipicidad").onclick = () => consultarIA("Tipicidad");
document.getElementById("btnDiligencias").onclick = () => consultarIA("Diligencias");
document.getElementById("btnProveer").onclick = () => consultarIA("Proveer");

document.getElementById("filterFavoritesBtn").onclick = e => {
  mostrarSoloFavoritos = !mostrarSoloFavoritos;
  e.target.classList.toggle("active", mostrarSoloFavoritos);
  renderizarHistorial();
};

document.getElementById("clearHistoryBtn").onclick = () => {
  if (confirm("¿Borrar todo el historial?")) {
    localStorage.removeItem(HISTORIAL_KEY);
    renderizarHistorial();
  }
};

/*************************************************
 * PDF.JS
 *************************************************/

pdfInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
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

const savedTheme = localStorage.getItem("theme") || "light";
document.body.setAttribute("data-theme", savedTheme);
themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";

themeToggle.addEventListener("click", () => {
  const current = document.body.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";

  document.body.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeToggle.textContent = next === "dark" ? "☀️" : "🌙";
});

/*************************************************
 * INIT
 *************************************************/

renderizarHistorial();
