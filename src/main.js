import { drawScatter } from "./scatter.js";
import { drawMap } from "./map.js";
import { renderCountryGrid } from "./memberCountries.js";

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
    headline: "Does Money Buy Happiness?",
    description: `A common belief is that wealth is a direct path to happiness. Let's explore this with data.<br><br>The scatterplot below compares a country's economic output, measured by 'GDP per capita', with the average 'Life Satisfaction' score reported by its citizens. Each bubble represents a country.<br><br>As you can see, there is a clear upward trend: countries with a higher GDP per capita tend to have higher life satisfaction. This suggests that economic prosperity does play a significant role in a nation's well-being.<br><br>However, the relationship isn't perfect. Some countries report higher satisfaction than their GDP would suggest, while others fall below the trend line. This indicates that while money is a factor, other elements like social support, health, and work-life balance are also crucial pieces of the happiness puzzle.`,
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

document.addEventListener("DOMContentLoaded", () => {
  initCarousel();
});

function initCarousel() {
  const container = document.querySelector(".slide-container");
  const template = container.querySelector(".slide");
  template.remove();

  // Create and append progress indicator
  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-indicator';
  slides.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'progress-dot';
    dot.dataset.index = i;
    dot.addEventListener('click', () => navigateTo(i)); // Make dots clickable
    progressContainer.appendChild(dot);
  });
  // Place indicator before the slide container
  container.before(progressContainer);

  // Clone & populate slides
  const elems = slides.map((slide, i) => {
    const el = template.cloneNode(true);
    el.querySelector(".headline").innerHTML = slide.headline;
    el.querySelector(".description").innerHTML = slide.description;

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
    if (slide.headline === "Where are you from?") {
      const gridDiv = document.createElement("div");
      gridDiv.id = "member-countries-grid";
      gridDiv.style.margin = "20px 0";
      el.querySelector(".description").insertAdjacentElement("afterend", gridDiv);
    }
    if (slide.headline.startsWith("Does Money Buy Happiness")) {
      const scatterDiv = document.createElement("div");
      scatterDiv.id = "scatter-slide";
      scatterDiv.style.width = "100%";
      scatterDiv.style.marginTop = "20px";
      el.querySelector(".description").insertAdjacentElement("afterend", scatterDiv);
    }
    if (slide.headline === "World Map") {
      const mapDiv = document.createElement("div");
      mapDiv.id = "map-container";
      mapDiv.style.width = "100%";
      mapDiv.style.height = "320px";
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
  updateProgress(current);
  renderSlideContent(current);
}

// Navigate via Prev/Next buttons
function navigate(dir) {
  const isLast = current === slides.length - 1;
  const newIndex = current + dir;

  // Special case for last slide's "Next" button
  if (isLast && dir === 1) {
    window.location.href = "/dashboard.html";
    return;
  }
  
  // Navigate to the new index
  navigateTo(newIndex);
}

// Core function to navigate to a specific slide index
function navigateTo(index) {
  if (index < 0 || index >= slides.length || index === current) {
    return; // Index is out of bounds or already active
  }

  const allSlides = Array.from(document.querySelectorAll(".slide-container .slide"));
  
  allSlides[current].classList.remove("active");
  current = index;
  allSlides[current].classList.add("active");
  
  updateProgress(current);
  renderSlideContent(current);
}

function updateProgress(currentIndex) {
  const dots = document.querySelectorAll('.progress-indicator .progress-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('active', 'visited');
    if (i < currentIndex) {
      dot.classList.add('visited');
    } else if (i === currentIndex) {
      dot.classList.add('active');
    }
  });
  // Add cursor pointer to non-active dots
  dots.forEach((dot, i) => {
    if (i !== currentIndex) {
      dot.style.cursor = 'pointer';
    } else {
      dot.style.cursor = 'default';
    }
  });
}

function renderSlideContent(idx) {
  const title = slides[idx].headline;
  if (
    title === "Where are you from?" &&
    !document.querySelector("#member-countries-grid .country-box")
  ) {
    renderCountryGrid("#member-countries-grid");
    const slideEl = document.querySelectorAll(".slide-container .slide")[idx];
    const nextBtn = slideEl.querySelector(".next");
    nextBtn.disabled = true;
    function onSelect() {
      nextBtn.disabled = false;
      document.removeEventListener("countrySelected", onSelect);
    }
    document.addEventListener("countrySelected", onSelect);
  }
  if (
    title.startsWith("Does Money Buy Happiness") &&
    !document.querySelector("#scatter-slide svg")
  ) {
    drawScatter("scatter-slide");
  }
  if (
    title === "World Map" &&
    !document.querySelector("#map-container svg")
  ) {
    drawMap("map-container");
  }
}

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") navigate(1);
  else if (e.key === "ArrowLeft") navigate(-1);
});