/*************************************************
 * CONFIGURACIÓN GENERAL
 *************************************************/

const OPENAI_MODEL = "gpt-4.1-mini";
const HISTORIAL_KEY = "transactions";

const inputText = document.getElementById("caseInput");
const output = document.getElementById("output");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const favoritesBtn = document.getElementById("filterFavoritesBtn");
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
 * HISTORIAL (UNA SOLA FUENTE DE VERDAD)
 *************************************************/

function obtenerHistorial() {
  return JSON.parse(localStorage.getItem(HISTORIAL_KEY)) || [];
}

function guardarEnHistorial(item) {
  const historial = obtenerHistorial();
  historial.unshift(item);
  localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial));
}

function eliminarItemHistorial(id) {
  const historial = obtenerHistorial().filter(i => i.id !== id);
  localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial));
  renderizarHistorial();
}

function borrarTodoHistorial() {
  if (!confirm("¿Deseas borrar todo el historial? Esta acción no se puede deshacer.")) return;
  localStorage.removeItem(HISTORIAL_KEY);
  renderizarHistorial();
}

/*************************************************
 * RENDER HISTORIAL
 *************************************************/

function renderizarHistorial(filtrarFavoritos = false) {
  const historial = obtenerHistorial();
  historyList.innerHTML = "";

  const items = filtrarFavoritos
    ? historial.filter(i => i.favorite)
    : historial;

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
        <div class="history-actions">
          <span class="favorite-item">${item.favorite ? "⭐" : "☆"}</span>
          <span class="delete-item">🗑️</span>
        </div>
      </div>
      <small>${item.fecha}</small>
      <p>${item.preview}</p>
    `;

    // Restaurar resultado
    li.addEventListener("click", () => {
      output.textContent = item.output;
    });

    // Favorito
    li.querySelector(".favorite-item").addEventListener("click", e => {
      e.stopPropagation();
      item.favorite = !item.favorite;
      localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial));
      renderizarHistorial(filtrarFavoritos);
    });

    // Eliminar
    li.querySelector(".delete-item").addEventListener("click", e => {
      e.stopPropagation();
      eliminarItemHistorial(item.id);
    });

    historyList.appendChild(li);
  });

  actualizarContador();
}

function actualizarContador() {
  const total = obtenerHistorial().filter(i => i.favorite).length;
  document.getElementById("historyCount").textContent = total;
}

/*************************************************
 * PROMPTS (VERSIÓN ESTABLE Y JURÍDICA)
 *************************************************/

function construirPrompt(tipo, texto) {
  const base = `
Actúa como un fiscal penal peruano.
Redacta con lenguaje técnico, sobrio y objetivo.
No inventes hechos ni datos.
No emitas juicios de responsabilidad definitiva.
No reemplazas el criterio fiscal.
`;

  if (tipo === "Hechos") {
    return `
${base}
Redacta el apartado HECHOS de una disposición fiscal,
en forma cronológica, numerada y objetiva,
a partir del siguiente caso:

${texto}
`;
  }

  if (tipo === "Tipicidad") {
    return `
${base}
Realiza un ANÁLISIS DE TIPICIDAD PENAL PRELIMINAR,
citando expresamente artículos del Código Penal peruano
y/o Ley 30096 si corresponde.
Usa estructura: Consideraciones y Conclusión.

Caso:
${texto}
`;
  }

  if (tipo === "Diligencias") {
    return `
${base}
Propón DILIGENCIAS PRELIMINARES razonables,
proporcionales y útiles,
numeradas y redactadas en lenguaje fiscal.

Caso:
${texto}
`;
  }

  if (tipo === "Proveer") {
    return `
${base}
Redacta una PROVIDENCIA FISCAL simple
con la siguiente estructura exacta:

DADO CUENTA:
El escrito que antecede;

CONSIDERANDO:
(Una sola consideración breve y formal)

SE PROVEE:
Téngase presente lo informado y agréguese a los actuados.

No inventes datos.
Caso / escrito:
${texto}
`;
  }
}

/*************************************************
 * LLAMADA A OPENAI
 *************************************************/

async function consultarIA(tipo) {
  const texto = inputText.value.trim();
  if (!texto) {
    alert("Ingrese un caso o escrito.");
    return;
  }

  output.textContent = "Procesando...";

  const prompt = construirPrompt(tipo, texto);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      })
    });

    const data = await response.json();
    const resultado = data.choices[0].message.content.trim();

    output.textContent = resultado;

    const item = {
      id: Date.now(),
      tipo,
      fecha: new Date().toLocaleString(),
      preview: resultado.slice(0, 120) + "...",
      output: resultado,
      favorite: false
    };

    guardarEnHistorial(item);
    renderizarHistorial();

  } catch (err) {
    output.textContent = "Error al consultar la IA.";
    console.error(err);
  }
}

/*************************************************
 * EVENTOS
 *************************************************/

document.getElementById("btnHechos").onclick = () => consultarIA("Hechos");
document.getElementById("btnTipicidad").onclick = () => consultarIA("Tipicidad");
document.getElementById("btnDiligencias").onclick = () => consultarIA("Diligencias");
document.getElementById("btnProveer").onclick = () => consultarIA("Proveer");

clearHistoryBtn.onclick = borrarTodoHistorial;

favoritesBtn.onclick = () => renderizarHistorial(true);

/*************************************************
 * PDF (LIGERO)
 *************************************************/

pdfInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    inputText.value = reader.result.slice(0, 8000);
  };
  reader.readAsText(file);
});

/*************************************************
 * INIT
 *************************************************/

renderizarHistorial();