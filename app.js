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

const sourcesBox = document.getElementById("sourcesBox");
const sourcesList = document.getElementById("sourcesList");

let mostrarSoloFavoritos = false;

/*************************************************
 * CARGA DE NORMAS (JSON RAG)
 *************************************************/

let LEY_30096 = null;

async function cargarNormas() {
  LEY_30096 = await fetch("ley30096.rag.json").then(r => r.json());
}
cargarNormas();

/*************************************************
 * RAG – DETECCIÓN DE DELITOS
 *************************************************/

function detectarDelitos(texto) {
  const t = texto.toLowerCase();
  const delitos = new Set();

  if (t.includes("suplantación") || t.includes("suplantacion")) delitos.add("SUPLANTACION");
  if (t.includes("fraude") || t.includes("phishing") || t.includes("transferencia")) delitos.add("FRAUDE");
  if (t.includes("acceso no autorizado") || t.includes("credenciales")) delitos.add("ACCESO");

  return Array.from(delitos);
}

/*************************************************
 * RAG – ARTÍCULOS AUTORIZADOS
 *************************************************/

function obtenerArticulosAutorizados(delitos) {
  if (!LEY_30096) return [];

  const mapa = {
    SUPLANTACION: 9,
    FRAUDE: 8,
    ACCESO: 2
  };

  return LEY_30096.articulos.filter(a =>
    delitos.some(d => a.numero === mapa[d])
  );
}

function construirBloqueNormativo(articulos) {
  if (!articulos.length) return "NO HAY ARTÍCULOS AUTORIZADOS.";

  return articulos.map(a => `
LEY 30096
ARTÍCULO ${a.codigo} – ${a.titulo}
${a.texto}
`).join("\n");
}

/*************************************************
 * MOSTRAR FUENTES EN UI
 *************************************************/

function mostrarFuentes(articulos) {
  if (!articulos.length) {
    sourcesBox.style.display = "none";
    return;
  }

  sourcesList.innerHTML = "";
  sourcesBox.style.display = "block";

  articulos.forEach(a => {
    const li = document.createElement("li");
    li.textContent = `Ley 30096 – Art. ${a.codigo}: ${a.titulo}`;
    sourcesList.appendChild(li);
  });
}

/*************************************************
 * PROMPTS
 *************************************************/

function construirPrompt(tipo, texto) {
  const reglas = `
Eres fiscal penal peruano.

REGLAS ABSOLUTAS:
- SOLO puedes usar los artículos del BLOQUE NORMATIVO.
- NO inventes artículos.
`;

  if (tipo === "Tipicidad") {
    const delitos = detectarDelitos(texto);
    const articulos = obtenerArticulosAutorizados(delitos);
    const bloque = construirBloqueNormativo(articulos);

    // Guardamos las fuentes para mostrarlas luego
    window.__ULTIMAS_FUENTES__ = articulos;

    return `${reglas}

BLOQUE NORMATIVO AUTORIZADO:
${bloque}

TAREA:
Realiza análisis de tipicidad penal preliminar.
Indica delito(s), norma y artículo exacto.

CASO:
${texto}`;
  }

  if (tipo === "Hechos") {
    return `Redacta HECHOS cronológicos y numerados:\n${texto}`;
  }

  if (tipo === "Diligencias") {
    return `Propón diligencias preliminares razonables:\n${texto}`;
  }

  if (tipo === "Proveer") {
    return `Redacta PROVIDENCIA FISCAL (DADO CUENTA / CONSIDERANDO / SE PROVEE):\n${texto}`;
  }
}

/*************************************************
 * OPENAI
 *************************************************/

async function consultarIA(tipo) {
  const texto = inputText.value.trim();
  if (!texto) return alert("Ingrese texto o cargue un PDF.");

  output.textContent = "Procesando...";
  sourcesBox.style.display = "none";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("openai_key")}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: construirPrompt(tipo, texto) }],
      temperature: 0
    })
  });

  const data = await response.json();
  const resultado = data.choices[0].message.content.trim();

  output.textContent = resultado;

  if (tipo === "Tipicidad") {
    mostrarFuentes(window.__ULTIMAS_FUENTES__ || []);
  }
}

/*************************************************
 * BINDS
 *************************************************/

document.getElementById("btnHechos").onclick = () => consultarIA("Hechos");
document.getElementById("btnTipicidad").onclick = () => consultarIA("Tipicidad");
document.getElementById("btnDiligencias").onclick = () => consultarIA("Diligencias");
document.getElementById("btnProveer").onclick = () => consultarIA("Proveer");

/*************************************************
 * TEMA OSCURO
 *************************************************/

const savedTheme = localStorage.getItem("theme") || "light";
document.body.setAttribute("data-theme", savedTheme);
themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";

themeToggle.onclick = () => {
  const next = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeToggle.textContent = next === "dark" ? "☀️" : "🌙";
};
