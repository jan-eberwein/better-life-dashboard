import { drawScatter } from "./scatter.js";
import { drawMap } from "./map.js";
import { drawIndexWidget } from "./indexWidget.js";
import { renderCountryGrid } from "./memberCountries.js";

// Key for persisting the current slide index
const STORAGE_KEY = "bli-current-slide";

// Slides for the introduction carousel
const slides = [
  {
    headline: "How’s life?",
    description: `What makes for a good life? Many people might say “money” or “career success,” but quality of life goes far beyond income. The OECD Better Life Index 2024 compares countries not just economically, but across 11 key dimensions that truly shape our daily lives — like health, education, environment, work-life balance, and social connection.<br><br>This project invites you to explore these factors interactively. Through data and storytelling, we’ll uncover where people are most satisfied with life in 2024 — and why.`,
  },
  {
    headline: "Where are you from?",
    description: `The Better Life Index focuses on 38 OECD member countries. These nations vary widely in culture, policy, and — as we’ll see — in overall life satisfaction.<br><br>Take a look at the map below, and you’ll already notice something interesting: countries like Finland, Denmark, and the Netherlands are glowing with high satisfaction scores.<br><br>In contrast, countries like Turkey or Greece show much lower levels of reported life satisfaction. What explains this difference? What are the real drivers of happiness?`,
  },
  {
    headline: "Money or time? What really makes us happy?",
    description: `It’s tempting to assume: more money means more happiness. But let’s test that idea.<br><br>Below is a scatterplot showing average income on the x-axis and the share of people working very long hours on the y-axis — two key factors that shape our day-to-day experience. We might expect that richer countries offer more leisure, while poorer ones require more work. But do the data agree?<br><br>The result is surprising: there’s no strong trend. The U.S., for instance, has high income but also a large share of people working very long hours. On the other hand, the Netherlands — with moderate income — shows one of the lowest rates of overwork.<br><br>In short: money alone doesn’t buy balance. Time — and how it’s spent — may be even more important than wealth. This moment of contradiction keeps the audience curious and engaged: what else matters?`,
  },
  {
    headline: "What does the “perfect” country look like?",
    description: `Each country has its own strengths — and weaknesses. The Better Life Index evaluates 11 different life aspects: from jobs and health to environment, education, safety, and community.<br><br>No country is best at everything. That’s why we compare “profiles”—unique patterns across all dimensions of well-being. Compare, for example, the Netherlands and the United States. The Netherlands excels in work-life balance and social support, while the U.S. leads in education and income—but falls behind in safety and civic engagement.<br><br>The key insight: top-performing countries aren’t perfect—but balanced. They combine moderate to high values across many dimensions to create a more sustainable satisfaction.`,
  },
  {
    headline: "World Map",
    description: `Curious about your own country? Use the map below to see how it stacks up against others. Discover where it excels—and where it still has room to grow.`,
  },
  {
    headline: "Conclusion: <br> What is a “better life”?",
    description: `Our journey through the data shows:<br><br>There is no single “best” country. But there are patterns. The most satisfied societies aren’t always the richest—they’re the most balanced. They value time, trust, health, and freedom.<br><br>Quality of life is multi-dimensional. It’s about balance—not just growth. Data can help us understand, compare, and improve it. So what would you choose in a better life? More time? Better health? A safer community? This dashboard is your tool to explore.`,
  },
];

let current = 0;
// Restore saved slide index
const saved = localStorage.getItem(STORAGE_KEY);
if (saved !== null) {
  const idx = parseInt(saved, 10);
  if (!isNaN(idx) && idx >= 0 && idx < slides.length) current = idx;
}

document.addEventListener("DOMContentLoaded", () => {
  initCarousel();
});

function initCarousel() {
  const container = document.querySelector(".slide-container");
  const template = container.querySelector(".slide");
  template.remove();

  // Clone & populate slides
  const elems = slides.map((slide, i) => {
    const el = template.cloneNode(true);
    el.querySelector(".headline").innerHTML = slide.headline;
    el.querySelector(".description").innerHTML = slide.description;

    // Slide 1: logo & index widget
    if (i === 0) {
      const logo = document.createElement("img");
      logo.src = "/logo-bli.png";
      logo.alt = "Better Life Index logo";
      logo.className = "logo";

      const subtitle = document.createElement("h2");
      subtitle.textContent = "2024 Visualized";
      subtitle.className = "subtitle";

      el.prepend(subtitle);
      el.prepend(logo);

      const widgetDiv = document.createElement("div");
      widgetDiv.id = "index-widget";
      widgetDiv.style.margin = "20px 0";

      el.querySelector(".description").insertAdjacentElement("afterend", widgetDiv);
    }

    // Slide 2: Member-countries grid
    if (slide.headline === "Where are you from?") {
      const gridDiv = document.createElement("div");
      gridDiv.id = "member-countries-grid";
      gridDiv.style.margin = "20px 0";

      el.querySelector(".description").insertAdjacentElement("afterend", gridDiv);
    }

    // Slide 3: Scatter
    if (slide.headline.startsWith("Money or time")) {
      const scatterDiv = document.createElement("div");
      scatterDiv.id = "scatter-slide";
      scatterDiv.style.width = "100%";
      scatterDiv.style.marginTop = "20px";

      el.querySelector(".description").insertAdjacentElement("afterend", scatterDiv);
    }

    // Slide 5: Choropleth map
    if (slide.headline === "World Map") {
      const mapDiv = document.createElement("div");
      mapDiv.id = "map-container";
      mapDiv.style.width = "100%";
      mapDiv.style.height = "400px";
      mapDiv.style.margin = "20px 0";

      el.querySelector(".description").insertAdjacentElement("afterend", mapDiv);
    }

    container.append(el);
    return el;
  });

  // Navigation buttons
  elems.forEach((el, i) => {
    const prev = el.querySelector(".prev");
    const next = el.querySelector(".next");
    prev.style.visibility = i === 0 ? "hidden" : "visible";
    next.textContent = i === slides.length - 1 ? "Go to Dashboard →" : "Next →";
    prev.onclick = () => navigate(-1);
    next.onclick = () => navigate(1);
  });

  // Activate current
  elems[current].classList.add("active");
  renderSlideContent(current);
}

function navigate(dir) {
  const isFirst = current === 0;
  const isLast = current === slides.length - 1;

  // If first slide, no “Back”
  if (isFirst && dir === -1) return;

  // If last slide, redirect to dashboard
  if (isLast && dir === 1) {
    localStorage.setItem(STORAGE_KEY, current.toString());
    window.location.href = "/dashboard.html";
    return;
  }

  const allSlides = Array.from(document.querySelectorAll(".slide-container .slide"));
  allSlides[current].classList.remove("active");
  current += dir;
  allSlides[current].classList.add("active");
  localStorage.setItem(STORAGE_KEY, current.toString());

  renderSlideContent(current);
}

function renderSlideContent(idx) {
  const title = slides[idx].headline;

  // “38 member countries” slide
  if (
    title === "Where are you from?" &&
    !document.querySelector("#member-countries-grid .country-box")
  ) {
    renderCountryGrid("#member-countries-grid");

    // Disable this slide’s Next button until a country is selected
    const slideEl = document.querySelectorAll(".slide-container .slide")[idx];
    const nextBtn = slideEl.querySelector(".next");
    nextBtn.disabled = true;

    // Listen for the custom “countrySelected” event
    function onSelect() {
      nextBtn.disabled = false;
      document.removeEventListener("countrySelected", onSelect);
    }
    document.addEventListener("countrySelected", onSelect);
  }

  // “Money or time” slide
  if (
    title.startsWith("Money or time") &&
    !document.querySelector("#scatter-slide svg")
  ) {
    drawScatter("scatter-slide");
  }

  // “World Map” slide
  if (
    title === "World Map" &&
    !document.querySelector("#map-container svg")
  ) {
    drawMap("map-container");
  }
}

// ← / → arrow keys
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") navigate(1);
  else if (e.key === "ArrowLeft") navigate(-1);
});
