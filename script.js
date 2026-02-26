const TMDB_API_KEY = '6c1880518383635c70f3c655216e31c1';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/original';

const blurOverlay = document.getElementById('blur-overlay');
const closeHintButton = document.getElementById('close-hint-button');
const highScoreSpan = document.getElementById('high-score');
const hintButton = document.getElementById('hint-button');
const hintContent = document.getElementById('hint-content');
const hintText = document.getElementById('hint-text');
const inputArea = document.getElementById('input-area');
const loadingDiv = document.getElementById('loading');
const modeButtons = document.querySelectorAll('.mode-button');
const movieImage = document.getElementById('movie-image');
const movieInput = document.getElementById('movie-input');
const nextButton = document.getElementById('next-button');
const notification = document.getElementById('notification');
const resultDiv = document.getElementById('result');
const scoreSpan = document.getElementById('score');
const skipButton = document.getElementById('skip-button');
const streakSpan = document.getElementById('streak');
const submitButton = document.getElementById('submit-button');

let currentMode = 'popular';
let currentMovie = null;
let highScore = parseInt(localStorage.getItem('filmeQuizHighScore')) || 0;
let hintUsed = false;
let isLoading = false;
let maxPageRange = {
    'now_playing': 2,
    'popular': 2,
    'top_rated': 2,
    'upcoming': 2
};
let nextMovieData = null;
let score = 0;
let streak = 0;
let totalPages = {
    'now_playing': 500,
    'popular': 500,
    'top_rated': 500,
    'upcoming': 500
};
let usedMovieIds = {
    'now_playing': new Set(),
    'popular': new Set(),
    'top_rated': new Set(),
    'upcoming': new Set()
};

function checkAnswer() {
    if (isLoading || !currentMovie) {
        return;
    }

    const userAnswer = movieInput.value.trim();

    if (!userAnswer) {
        return;
    }

    const normUser = normalizeText(userAnswer);
    const normTitle = normalizeText(currentMovie.title);
    const normOriginal = normalizeText(currentMovie.original_title);
    const isCorrect = normUser === normTitle || normUser === normOriginal;
    const points = hintUsed ? 50 : 100;

    if (isCorrect) {
        processCorrectAnswer(points);
    }

    if (!isCorrect) {
        processWrongAnswer();
    }

    resultDiv.style.display = 'block';
    nextButton.style.display = 'inline-block';
    inputArea.style.display = 'none';
    skipButton.disabled = true;
    hintButton.disabled = true;
    updateStats();
}

function closeHint() {
    blurOverlay.style.display = 'none';
    hintContent.style.display = 'none';
}

function expandPageRange(mode) {
    const currentRange = maxPageRange[mode];
    const newRange = Math.min(currentRange * 2, totalPages[mode]);
    maxPageRange[mode] = newRange;
    showNotification(`expandindo busca para ${newRange} páginas`);
}

function extractDirector(credits) {
    const director = credits.crew.find(p => p.job === 'Director');

    return director?.name || 'N/A';
}

function extractYear(movie) {
    return movie.release_date ? movie.release_date.substring(0, 4) : 'N/A';
}

async function fetchJson(url) {
    const response = await fetch(url);

    return response.json();
}

async function fetchMovieData(mode) {
    const endpoints = {
        'now_playing': '/movie/now_playing',
        'popular': '/movie/popular',
        'top_rated': '/movie/top_rated',
        'upcoming': '/movie/upcoming'
    };
    const randomPage = Math.floor(Math.random() * maxPageRange[mode]) + 1;
    const response = await fetch(`${TMDB_BASE_URL}${endpoints[mode]}?api_key=${TMDB_API_KEY}&language=pt-BR&page=${randomPage}`);
    const data = await response.json();

    if (data.total_pages && data.total_pages !== totalPages[mode]) {
        totalPages[mode] = Math.min(data.total_pages, 500);
    }

    const availableMovies = data.results.filter(m => m.id && !usedMovieIds[mode].has(m.id));

    if (availableMovies.length === 0) {
        return handleNoAvailableMovies(mode);
    }

    const movie = availableMovies[Math.floor(Math.random() * availableMovies.length)];
    usedMovieIds[mode].add(movie.id);
    const [details, credits, imagesData] = await Promise.all([
        fetchJson(`${TMDB_BASE_URL}/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=pt-BR`),
        fetchJson(`${TMDB_BASE_URL}/movie/${movie.id}/credits?api_key=${TMDB_API_KEY}`),
        fetchJson(`${TMDB_BASE_URL}/movie/${movie.id}/images?api_key=${TMDB_API_KEY}`)
    ]);
    const imagePath = selectMovieImage(movie, imagesData);

    return {
        director: extractDirector(credits),
        genres: formatGenres(details),
        hint: details.overview || 'dica indisponível',
        image: imagePath ? `${TMDB_IMAGE_URL}${imagePath}` : null,
        original_title: movie.original_title,
        title: movie.title,
        year: extractYear(movie)
    };
}

function formatGenres(details) {
    return details.genres.map(genre => genre.name).join(', ');
}

function handleNoAvailableMovies(mode) {
    if (maxPageRange[mode] < totalPages[mode]) {
        expandPageRange(mode);

        return fetchMovieData(mode);
    }

    showNotification('todos os filmes já foram vistos');
    resetPageRange(mode);

    return fetchMovieData(mode);
}

async function initGame() {
    isLoading = true;
    loadingDiv.style.display = 'block';
    movieImage.style.opacity = '0';
    movieInput.value = '';
    inputArea.style.display = 'none';
    skipButton.disabled = true;
    hintButton.disabled = true;
    resultDiv.style.display = 'none';
    nextButton.style.display = 'none';
    hintUsed = false;
    hintButton.textContent = 'dica';
    closeHint();
    highScoreSpan.textContent = highScore;

    try {
        currentMovie = nextMovieData || await fetchMovieData(currentMode);

        if (!currentMovie.image) {
            showNotification('sem imagem, tentando outro...');
            currentMovie = await fetchMovieData(currentMode);
        }

        await new Promise((resolve, reject) => {
            movieImage.src = currentMovie.image;
            movieImage.onload = () => {
                resolve();
            };
            movieImage.onerror = () => {
                reject(new Error('falha no carregamento da imagem'));
            };
        });

        loadingDiv.style.display = 'none';
        movieImage.style.opacity = '1';
        inputArea.style.display = 'flex';
        skipButton.disabled = false;
        hintButton.disabled = false;
        movieInput.focus();
        isLoading = false;
        const nextMovie = await loadNextMovie();
        nextMovieData = nextMovie;
    } catch (error) {
        showNotification('erro na imagem, tentando outro...');
        initGame();
    }
}

async function loadNextMovie() {
    try {
        const data = await fetchMovieData(currentMode);

        if (!data.image) {
            return await loadNextMovie();
        }

        return data;
    } catch (error) {
        showNotification('erro ao carregar próximo');

        return null;
    }
}

function normalizeText(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,!?;:'"()\[\]-]/g, '').replace(/^(o |a |os |as |the |el |la |los |las |um |uma |uns |umas )/g, '').replace(/\s+/g, ' ').trim();
}

function processCorrectAnswer(points) {
    score += points;
    streak++;
    resultDiv.className = 'result correct';
    resultDiv.innerHTML = `<strong>acertou! +${points} pontos</strong><div class="movie-title-reveal">${currentMovie.title}</div><div class="movie-details"><p><strong>diretor:</strong> ${currentMovie.director}</p><p><strong>gêneros:</strong> ${currentMovie.genres}</p></div>`;
}

function processWrongAnswer() {
    score = Math.max(0, score - 30);
    streak = 0;
    resultDiv.className = 'result wrong';
    resultDiv.innerHTML = `<strong>errou!</strong><div class="movie-title-reveal">resposta correta ${currentMovie.title}</div><div class="movie-details"><p><strong>diretor:</strong> ${currentMovie.director}</p></div>`;
}

function resetPageRange(mode) {
    maxPageRange[mode] = 2;
    usedMovieIds[mode].clear();
}

function selectMovieImage(movie, imagesData) {
    const stills = imagesData.backdrops.filter(image => image.iso_639_1 === null);

    if (stills.length > 0) {
        return stills[Math.floor(Math.random() * stills.length)].file_path;
    }

    if (movie.backdrop_path) {
        return movie.backdrop_path;
    }

    if (movie.poster_path) {
        return movie.poster_path;
    }

    if (imagesData.backdrops.length > 0) {
        return imagesData.backdrops[0].file_path;
    }

    return null;
}

function showHint() {
    if (isLoading) {
        return;
    }

    if (!hintUsed) {
        score = Math.max(0, score - 10);
        hintUsed = true;
        hintButton.textContent = 'dica';
        updateStats();
    }

    blurOverlay.style.display = 'block';
    hintText.textContent = currentMovie.hint;
    hintContent.style.display = 'block';
}

function showNotification(msg) {
    notification.textContent = msg;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

function skipMovie() {
    if (isLoading) {
        return;
    }

    showNotification('pulado');
    nextMovieData = null;
    initGame();
}

function updateStats() {
    scoreSpan.textContent = score;
    streakSpan.textContent = streak;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('filmeQuizHighScore', highScore);
    }

    highScoreSpan.textContent = highScore;
}

submitButton.addEventListener('click', checkAnswer);
skipButton.addEventListener('click', skipMovie);
nextButton.addEventListener('click', () => initGame());
hintButton.addEventListener('click', showHint);
closeHintButton.addEventListener('click', closeHint);
blurOverlay.addEventListener('click', closeHint);
movieInput.addEventListener('keypress', (e) => e.key === 'Enter' && checkAnswer());
modeButtons.forEach(button => {
    button.addEventListener('click', () => {
        currentMode = button.dataset.level;
        document.querySelector('.mode-button.active').classList.remove('active');
        button.classList.add('active');
        resetPageRange(currentMode);
        nextMovieData = null;
        initGame();
    });
});
document.getElementById('new-game-button').addEventListener('click', () => {
    score = 0;
    streak = 0;
    updateStats();
    resetPageRange(currentMode);
    nextMovieData = null;
    initGame();
});
initGame();
