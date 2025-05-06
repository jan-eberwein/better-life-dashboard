interface Slide {
    headline: string;
    description: string;
    images: string[];
}

const slides: Slide[] = [
    { headline: 'Step 1', description: 'Description one.',   images: ['https://via.placeholder.com/600x400?text=1A','https://via.placeholder.com/600x400?text=1B'] },
    { headline: 'Step 2', description: 'Description two.',   images: ['https://via.placeholder.com/600x400?text=2A'] },
    { headline: 'Step 3', description: 'Description three.', images: ['https://via.placeholder.com/600x400?text=3A','https://via.placeholder.com/600x400?text=3B'] },
    { headline: 'Step 4', description: 'Description four.',  images: ['https://via.placeholder.com/600x400?text=4A'] },
    { headline: 'Step 5', description: 'Description five.',  images: ['https://via.placeholder.com/600x400?text=5A','https://via.placeholder.com/600x400?text=5B'] }
];

let current = 0;
const container = document.querySelector<HTMLDivElement>('.slide-container')!;
const template  = container.querySelector<HTMLDivElement>('.slide')!;

// Remove the template from the DOM so we can clone it
template.remove();

const elems = slides.map((s, i) => {
    const el = template.cloneNode(true) as HTMLDivElement;
    el.querySelector<HTMLHeadingElement>('.headline')!.textContent     = s.headline;
    el.querySelector<HTMLParagraphElement>('.description')!.textContent = s.description;

    const imgs = el.querySelectorAll<HTMLImageElement>('.images img');
    imgs[0].src = s.images[0];
    if (s.images[1]) {
        imgs[1].src = s.images[1];
    } else {
        imgs[1].style.display = 'none';
    }

    container.append(el);

    const prevBtn = el.querySelector<HTMLButtonElement>('.nav-controls .prev')!;
    const nextBtn = el.querySelector<HTMLButtonElement>('.nav-controls .next')!;

    // On the last slide, change "Next" to "Go to dashboard"
    if (i === slides.length - 1) {
        nextBtn.textContent = 'Go to dashboard →';
    }

    prevBtn.onclick = () => navigate(-1);
    nextBtn.onclick = () => navigate(1);

    return el;
});

function navigate(dir: number) {
    elems[current].classList.remove('active');

    // If we're on the last slide and hit Next, go to Dashboard
    if (current === slides.length - 1 && dir === 1) {
        window.location.href = 'Dashboard.html';
        return;
    }

    current = (current + dir + elems.length) % elems.length;

    const incoming = elems[current];
    const animName = dir > 0 ? 'slide-left' : 'slide-right';
    incoming.style.animation = `${animName} 0.6s ease forwards`;
    incoming.classList.add('active');

    setTimeout(() => {
        incoming.style.animation = '';
    }, 600);
}

// Show the first slide
elems[0].classList.add('active');
