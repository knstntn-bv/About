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

const page = document.body.dataset.page;

function applySiteTitle(markdown) {
  const title = siteTitle(markdown);
  if (!title) return;
  const brand = document.querySelector(".brand");
  if (brand) brand.textContent = title;
  const portrait = document.querySelector(".portrait");
  if (portrait) portrait.alt = title;
  const suffix = document.body.dataset.titleSuffix;
  document.title = suffix ? `${title} — ${suffix}` : title;
}

let aboutMarkdown = null;

async function loadAbout() {
  if (!aboutMarkdown) aboutMarkdown = await load("data/about.md");
  applySiteTitle(aboutMarkdown);
  return aboutMarkdown;
}

if (page === "home") {
  const about = document.getElementById("about");
  const contacts = document.getElementById("contacts");
  try {
    const [aboutText, contactText] = await Promise.all([
      loadAbout(),
      load("data/contacts.md"),
    ]);
    about.innerHTML = renderProse(aboutText);
    contacts.innerHTML = renderProse(contactText);
  } catch (error) {
    console.error(error);
    fail(about, "Не удалось загрузить страницу.");
  }
} else {
  loadAbout().catch((error) => console.error(error));
}

if (page === "cv") {
  const lang = new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "ru";
  document.documentElement.lang = lang;
  const root = document.getElementById("cv");

  for (const link of document.querySelectorAll(".lang a")) {
    if (link.dataset.lang === lang) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  }

  try {
    root.innerHTML = renderCv(await load(`data/CV/${lang}.md`));
  } catch (error) {
    console.error(error);
    fail(root, "Не удалось загрузить CV.");
  }
}

if (page === "projects") {
  const root = document.getElementById("projects");
  try {
    root.innerHTML = renderProjects(await load("data/projects.md"));
  } catch (error) {
    console.error(error);
    fail(root, "Не удалось загрузить проекты.");
  }
}
