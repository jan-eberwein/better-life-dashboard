// src/main.ts
import { drawScatter } from "./scatter";
import { drawMap } from "./map";

interface Slide {
  headline: string;
  description: string;
  images: string[];
}

// Key for persisting the current slide index
const STORAGE_KEY = 'bli-current-slide';

// Slides for the introduction carousel
const slides: Slide[] = [
  {
    headline: "How’s life?",
    description: `What makes for a good life? Many people might say “money” or “career success,” but quality of life goes far beyond income. The OECD Better Life Index 2024 compares countries not just economically, but across 11 key dimensions that truly shape our daily lives — like health, education, environment, work-life balance, and social connection.<br><br>This project invites you to explore these factors interactively. Through data and storytelling, we’ll uncover where people are most satisfied with life in 2024 — and why.`,
    images: [],
  },
  {
    headline: "The 38 member countries",
    description: `The Better Life Index focuses on 38 OECD member countries. These nations vary widely in culture, policy, and — as we’ll see — in overall life satisfaction.<br><br>Take a look at the map below, and you’ll already notice something interesting: countries like Finland, Denmark, and the Netherlands are glowing with high satisfaction scores.<br><br>In contrast, countries like Turkey or Greece show much lower levels of reported life satisfaction. What explains this difference? What are the real drivers of happiness?`,
    images: [],
  },
  {
    headline: "Money or time? What really makes us happy?",
    description: `It’s tempting to assume: more money means more happiness. But let’s test that idea.<br><br>Below is a scatterplot showing average income on the x-axis and the share of people working very long hours on the y-axis — two key factors that shape our day-to-day experience. We might expect that richer countries offer more leisure, while poorer ones require more work. But do the data agree?<br><br>The result is surprising: there’s no strong trend. The U.S., for instance, has high income but also a large share of people working very long hours. On the other hand, the Netherlands — with moderate income — shows one of the lowest rates of overwork.<br><br>In short: money alone doesn’t buy balance. Time — and how it’s spent — may be even more important than wealth. This moment of contradiction keeps the audience curious and engaged: what else matters?`,
    images: [],
  },
  {
    headline: "What does the “perfect” country look like?",
    description: `Each country has its own strengths — and weaknesses. The Better Life Index evaluates 11 different life aspects: from jobs and health to environment, education, safety, and community.<br><br>No country is best at everything. That’s why we compare “profiles”—unique patterns across all dimensions of well-being. Compare, for example, the Netherlands and the United States. The Netherlands excels in work-life balance and social support, while the U.S. leads in education and income—but falls behind in safety and civic engagement.<br><br>The key insight: top-performing countries aren’t perfect—but balanced. They combine moderate to high values across many dimensions to create a more sustainable satisfaction.`,
    images: [],
  },
  {
    headline: "Where are you from?",
    description: `Curious about your own country? Use the dropdown below to see how it stacks up against others. Discover where it excels—and where it still has room to grow.`,
    images: [],
  },
  {
    headline: "Explore more: create your own comparisons",
    description: `Now it’s your turn. Select countries, filter categories, and test your own ideas. Look into income, safety, work pressure, education—whatever interests you. This dashboard empowers you to explore, ask questions, and go deeper than any single story could.`,
    images: [],
  },
  {
    headline: "Conclusion: <br> What is a “better life”?",
    description: `Our journey through the data shows:<br><br>There is no single “best” country. But there are patterns. The most satisfied societies aren’t always the richest—they’re the most balanced. They value time, trust, health, and freedom.<br><br>Quality of life is multi-dimensional. It’s about balance—not just growth. Data can help us understand, compare, and improve it. So what would you choose in a better life? More time? Better health? A safer community? This dashboard is your tool to explore.`,
    images: [],
  },
];

let current = 0;

// Restore saved slide index (if any) on load
const saved = localStorage.getItem(STORAGE_KEY);
if (saved !== null) {
  const idx = parseInt(saved, 10);
  if (!isNaN(idx) && idx >= 0 && idx < slides.length) {
    current = idx;
  }
}

const container = document.querySelector<HTMLDivElement>(".slide-container")!;
const template = container.querySelector<HTMLDivElement>(".slide")!;
template.remove();

const elems = slides.map((s, i) => {
  const el = template.cloneNode(true) as HTMLDivElement;
  el.querySelector(".headline")!.innerHTML    = s.headline;
  el.querySelector(".description")!.innerHTML = s.description;

  // images
  const imgWrap = el.querySelector<HTMLDivElement>(".images")!;
  if (s.images.length) {
    const imgs = imgWrap.querySelectorAll<HTMLImageElement>("img");
    imgs[0].src = s.images[0];
    if (s.images[1]) imgs[1].src = s.images[1];
    else imgs[1].style.display = "none";
  } else {
    imgWrap.remove();
  }

  // first‐slide logo + subtitle
  if (i === 0) {
    const logo = document.createElement("img");
    logo.src       = "/logo-bli.png";
    logo.alt       = "Better Life Index logo";
    logo.className = "logo";

    const subtitle = document.createElement("h2");
    subtitle.textContent = "2024 Visualized";
    subtitle.className   = "subtitle";

    el.prepend(subtitle);
    el.prepend(logo);
  }

  // ─── Map placeholder only on the “Where are you from?” slide
  if (s.headline === "Where are you from?") {
    const mapDiv = document.createElement("div");
    mapDiv.id = "map-container";
    el.querySelector(".description")!
        .insertAdjacentElement("afterend", mapDiv);
  }

  // ─── Scatter placeholder on the “Money or time?” slide
  if (s.headline.startsWith("Money or time")) {
    const scatterDiv = document.createElement("div");
    scatterDiv.id = "scatter-slide";
    scatterDiv.style.width     = "100%";
    scatterDiv.style.marginTop = "20px";
    el.querySelector(".description")!
        .insertAdjacentElement("afterend", scatterDiv);
  }

  container.append(el);
  return el;
});

// navigation buttons
elems.forEach((el, i) => {
  const prev = el.querySelector<HTMLButtonElement>(".prev")!;
  const next = el.querySelector<HTMLButtonElement>(".next")!;
  prev.style.visibility = i === 0 ? "hidden" : "visible";
  next.textContent      = i === slides.length - 1 ? "Go to Dashboard →" : "Next →";
  prev.onclick = () => navigate(-1);
  next.onclick = () => navigate(1);
});

function navigate(dir: number) {
  elems[current].classList.remove("active");

  // last slide → dashboard.html
  if (current === slides.length - 1 && dir === 1) {
    localStorage.setItem(STORAGE_KEY, current.toString());
    window.location.href = "dashboard.html";
    return;
  }

  current = (current + dir + elems.length) % elems.length;
  elems[current].classList.add("active");
  localStorage.setItem(STORAGE_KEY, current.toString());

  // draw map when landing on “Where are you from?”
  if (
      slides[current].headline === "Where are you from?" &&
      !document.querySelector("#map-container svg")
  ) {
    drawMap("map-container");
  }

  // draw scatter when landing on “Money or time?”
  if (
      slides[current].headline.startsWith("Money or time") &&
      !document.querySelector("#scatter-slide svg")
  ) {
    drawScatter("scatter-slide");
  }
}

// Activate the saved (or first) slide
elems[current].classList.add("active");

// ← / → arrow keys
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") navigate(1);
  else if (e.key === "ArrowLeft") navigate(-1);
});
