interface Slide {
  headline: string;
  description: string;
  images: string[];
}

const slides: Slide[] = [
  {
    headline: "How’s life?",
    description: `What makes for a good life? Many people might say “money” or “career success,” but quality of life goes far beyond income. The OECD Better Life Index 2024 compares countries not just economically, but across 11 key dimensions that truly shape our daily lives — like health, education, environment, work-life balance, and social connection. 
    <br><br>
    This project invites you to explore these factors interactively. Through data and storytelling, we’ll uncover where people are most satisfied with life in 2024 — and why.`,
    images: [
      "https://via.placeholder.com/600x400?text=1A",
      "https://via.placeholder.com/600x400?text=1B",
    ],
  },
  {
    headline: "The 38 member countries",
    description: `The Better Life Index focuses on 38 OECD member countries. These nations vary widely in culture, policy, and — as we’ll see — in overall life satisfaction. 
    <br><br>
    Take a look at the map below, and you’ll already notice something interesting: countries like Finland, Denmark, and the Netherlands are glowing with high satisfaction scores. <br><br> In contrast, countries like Turkey or Greece show much lower levels of reported life satisfaction. What explains this difference? What are the real drivers of happiness?`,
    images: ["https://via.placeholder.com/600x400?text=2A"],
  },
  {
    headline: "Money or time? What really makes us happy?",
    description: `It’s tempting to assume: more money means more happiness. But let’s test that idea.<br><br> Below is a scatterplot showing average income on the x-axis and the share of people working very long hours on the y-axis — two key factors that shape our day-to-day experience. We might expect that richer countries offer more leisure, while poorer ones require more work. But do the data agree?

    <br><br> <br><br> <br><br><br><br>

    The result is surprising: there’s no strong trend. The U.S., for instance, has high income but also a large share of people working very long hours. On the other hand, the Netherlands — with moderate income — shows one of the lowest rates of overwork. <br><br> In short: money alone doesn’t buy balance. Time — and how it’s spent — may be even more important than wealth. This moment of contradiction keeps the audience curious and engaged: what else matters?`,
    images: [
      "https://via.placeholder.com/600x400?text=3A",
      "https://via.placeholder.com/600x400?text=3B",
    ],
  },
  {
    headline: "What does the “perfect” country look like?",
    description: `Each country has its own strengths — and weaknesses. The Better Life Index evaluates 11 different life aspects: from jobs and health to environment, education, safety, and community. <br><br>
    But no country is best at everything. That’s why we compare countries using “profiles” — unique patterns across all dimensions of well-being.
    Compare, for example, the Netherlands and the United States. The Netherlands excels in work-life balance and social support, while the U.S. leads in education and income — but falls behind in safety and civic engagement. <br><br> <br><br> <br><br>
    The key insight: top-performing countries aren’t perfect — but balanced. They combine moderate to high values across many dimensions, creating a more sustainable kind of satisfaction.`,
    images: ["https://via.placeholder.com/600x400?text=4A"],
  },
  {
    headline: "Where are you from?",
    description: `Curious about your own country? Use the dropdown below to see how it stacks up against others. Discover where it excels — and where it still has room to grow.`,
    images: [
      "https://via.placeholder.com/600x400?text=5A",
      "https://via.placeholder.com/600x400?text=5B",
    ],
  },
  {
    headline: "Explore more: create your own comparisons",
    description: `Now it’s your turn. Select countries, filter categories, and test your own ideas. Look into income, safety, work pressure, education — whatever interests you. This part of the dashboard empowers you to explore, to ask questions, and to go deeper than any single story could.`,
    images: [
      "https://via.placeholder.com/600x400?text=6A",
      "https://via.placeholder.com/600x400?text=6B",
    ],
  },
  {
    headline: "Conclusion: <br> What is a “better life”?",
    description: `Our journey through the data shows:  <br><br>
        There is no single “best” country. But there are patterns. The most satisfied societies aren’t always the richest — they’re the most balanced. They value not only income, but also time, trust, health, and freedom. <br><br>
        Quality of life is multi-dimensional. It’s about balance — not just growth. And data can help us understand, compare, and improve it.
        So what would you choose in a better life? More time? Better health? A safer community? That’s for you to decide — and this dashboard is your tool to explore.`,
    images: [
      "https://via.placeholder.com/600x400?text=6A",
      "https://via.placeholder.com/600x400?text=6B",
    ],
  },
];

let current = 0;
const container = document.querySelector<HTMLDivElement>(".slide-container")!;
const template = container.querySelector<HTMLDivElement>(".slide")!;

// Remove the template from the DOM so we can clone it
template.remove();

const elems = slides.map((s, i) => {
  const el = template.cloneNode(true) as HTMLDivElement;

  el.querySelector<HTMLHeadingElement>(".headline")!.innerHTML = s.headline;
  el.querySelector<HTMLParagraphElement>(".description")!.innerHTML = s.description;

  const imgs = el.querySelectorAll<HTMLImageElement>(".images img");
  imgs[0].src = s.images[0];
  if (s.images[1]) {
    imgs[1].src = s.images[1];
  } else {
    imgs[1].style.display = "none";
  }

  container.append(el);

  const prevBtn = el.querySelector<HTMLButtonElement>(".nav-controls .prev")!;
  const nextBtn = el.querySelector<HTMLButtonElement>(".nav-controls .next")!;

  // On the last slide, change "Next" to "Go to dashboard"
  if (i === slides.length - 1) {
    nextBtn.textContent = "Go to dashboard →";
  }

  prevBtn.onclick = () => navigate(-1);
  nextBtn.onclick = () => navigate(1);

  return el;
});

function navigate(dir: number) {
  elems[current].classList.remove("active");

  // If we're on the last slide and hit Next, go to Dashboard
  if (current === slides.length - 1 && dir === 1) {
    window.location.href = "Dashboard.html";
    return;
  }

  current = (current + dir + elems.length) % elems.length;
  const incoming = elems[current];
  const animName = dir > 0 ? "slide-left" : "slide-right";

  incoming.style.animation = `${animName} 0.6s ease forwards`;
  incoming.classList.add("active");

  setTimeout(() => {
    incoming.style.animation = "";
  }, 600);
}

// Show the first slide
elems[0].classList.add("active");
