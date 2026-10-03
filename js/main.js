import { downloadCvPdf } from "./cv-pdf.js";
import { renderCv, renderProse, renderProjects, siteTitle } from "./render.js";

function asset(path) {
  return new URL(path, new URL(".", window.location.href)).href;
}

async function load(path) {
  const response = await fetch(asset(path));
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.text();
}

function fail(element, message) {
  element.innerHTML = `<p class="error">${message}</p>`;
}

function readLang() {
  const param = new URLSearchParams(location.search).get("lang");
  if (param === "en" || param === "ru") {
    try {
      localStorage.setItem("site-lang", param);
    } catch (_) {
      /* private mode */
    }
    return param;
  }
  try {
    return localStorage.getItem("site-lang") === "en" ? "en" : "ru";
  } catch (_) {
    return "ru";
  }
}

function withLang(page, lang) {
  const file = page.split("?")[0];
  return `${file}?lang=${lang}`;
}

const lang = readLang();
const page = document.body.dataset.page;
document.documentElement.lang = lang;

const here = location.pathname.split("/").pop() || "index.html";

for (const link of document.querySelectorAll(".lang a")) {
  const target = link.dataset.lang === "en" ? "en" : "ru";
  link.href = withLang(here, target);
  if (target === lang) link.setAttribute("aria-current", "true");
  else link.removeAttribute("aria-current");
}

for (const link of document.querySelectorAll(".nav a, .brand")) {
  link.href = withLang(link.getAttribute("href"), lang);
  if (link.dataset.ru && link.dataset.en) {
    link.textContent = lang === "en" ? link.dataset.en : link.dataset.ru;
  }
}

for (const button of document.querySelectorAll(".pdf-download")) {
  if (button.dataset.ru && button.dataset.en) {
    button.textContent = lang === "en" ? button.dataset.en : button.dataset.ru;
  }
}

const nav = document.querySelector(".nav");
if (nav) nav.setAttribute("aria-label", lang === "en" ? "Sections" : "Разделы");

const themeLabels = {
  light: { ru: "Включить светлую тему", en: "Switch to light theme" },
  dark: { ru: "Включить тёмную тему", en: "Switch to dark theme" },
};

function readStoredTheme() {
  try {
    const value = localStorage.getItem("site-theme");
    return value === "light" || value === "dark" ? value : null;
  } catch (_) {
    return null;
  }
}

function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function syncThemeChrome(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === "light" ? "#f7f4f1" : "#110e0e";
  const icon = document.querySelector('link[rel="icon"]');
  if (icon) icon.href = asset(theme === "light" ? "favicon-light.svg" : "favicon.svg");
  const button = document.querySelector(".theme-toggle");
  if (!button) return;
  const next = theme === "dark" ? "light" : "dark";
  button.setAttribute("aria-label", themeLabels[next][lang]);
}

function applyTheme(theme, persist) {
  document.documentElement.dataset.theme = theme;
  syncThemeChrome(theme);
  if (!persist) return;
  try {
    localStorage.setItem("site-theme", theme);
  } catch (_) {
    /* private mode */
  }
}

for (const el of document.querySelectorAll(".theme-toggle [data-ru]")) {
  el.textContent = lang === "en" ? el.dataset.en : el.dataset.ru;
}

const themeButton = document.querySelector(".theme-toggle");
if (themeButton) {
  themeButton.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark", true);
  });
}

syncThemeChrome(currentTheme());

if (!readStoredTheme()) {
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (event) => {
    if (!readStoredTheme()) applyTheme(event.matches ? "light" : "dark", false);
  });
}

const errors = {
  home: { ru: "Не удалось загрузить страницу.", en: "Could not load the page." },
  cv: { ru: "Не удалось загрузить CV.", en: "Could not load the CV." },
  resume: { ru: "Не удалось загрузить резюме.", en: "Could not load the resume." },
  projects: { ru: "Не удалось загрузить проекты.", en: "Could not load projects." },
};

function applySiteTitle(markdown) {
  const title = siteTitle(markdown, lang);
  if (!title) return;
  const brand = document.querySelector(".brand");
  if (brand) brand.textContent = title;
  const portrait = document.querySelector(".portrait");
  if (portrait) portrait.alt = title;
  const suffix =
    page === "cv" ? "CV" : page === "projects" ? (lang === "en" ? "Projects" : "Проекты") : "";
  document.title = suffix ? `${title} — ${suffix}` : title;
}

async function loadAbout() {
  const markdown = await load("data/about.md");
  applySiteTitle(markdown);
  return markdown;
}

if (page === "home") {
  const about = document.getElementById("about");
  const contacts = document.getElementById("contacts");
  try {
    const [aboutText, contactText] = await Promise.all([
      loadAbout(),
      load("data/contacts.md"),
    ]);
    about.innerHTML = renderProse(aboutText, lang, { skipFirstH2: true });
    contacts.innerHTML = renderProse(contactText, lang);
  } catch (error) {
    console.error(error);
    fail(about, errors.home[lang]);
  }
}

function bindPdfDownload(button, markdown, kind, status) {
  if (!button) return;
  button.hidden = false;
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    const buttons = [...document.querySelectorAll(".pdf-download")];
    const idle = lang === "en" ? button.dataset.en : button.dataset.ru;
    const busy = lang === "en" ? button.dataset.enBusy : button.dataset.ruBusy;
    const message = lang === "en" ? button.dataset.enError : button.dataset.ruError;
    for (const item of buttons) item.disabled = true;
    button.textContent = busy;
    if (status) {
      status.hidden = true;
      status.textContent = "";
    }
    try {
      await downloadCvPdf(markdown, lang, kind);
    } catch (error) {
      console.error(error);
      if (status) {
        status.hidden = false;
        status.textContent = message;
      }
    } finally {
      for (const item of buttons) item.disabled = false;
      button.textContent = idle;
    }
  });
}

if (page === "cv") {
  const root = document.getElementById("cv");
  const status = document.getElementById("pdf-status");
  loadAbout().catch((error) => console.error(error));
  try {
    const markdown = await load(`data/CV/${lang}.md`);
    root.innerHTML = renderCv(markdown);
    bindPdfDownload(document.getElementById("download-pdf"), markdown, "cv", status);
  } catch (error) {
    console.error(error);
    fail(root, errors.cv[lang]);
  }
  try {
    const resume = await load(`data/resume/${lang}.md`);
    bindPdfDownload(document.getElementById("download-resume"), resume, "resume", status);
  } catch (error) {
    console.error(error);
    if (status && status.hidden) {
      status.hidden = false;
      status.textContent = errors.resume[lang];
    }
  }
}

if (page === "projects") {
  const root = document.getElementById("projects");
  loadAbout().catch((error) => console.error(error));
  try {
    root.innerHTML = renderProjects(await load("data/projects.md"), lang);
  } catch (error) {
    console.error(error);
    fail(root, errors.projects[lang]);
  }
}
