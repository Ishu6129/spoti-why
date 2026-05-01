/**
 * LumeBeat Pro - High Polish Music Player
 * Compatible with Desktop and Mobile
 */

// Configuration (Loaded from config.js)
const RAW_API_URL = typeof CONFIG !== 'undefined' ? CONFIG.RAW_API_URL : 'https://muse.abhiyank.in/api/music/search?query=';
const CORS_PROXY = typeof CONFIG !== 'undefined' ? CONFIG.CORS_PROXY : 'https://api.codetabs.com/v1/proxy?quest='; 
const API_URL = `${CORS_PROXY}${encodeURIComponent(RAW_API_URL)}`;

// State
let state = {
    isPlaying: false,
    currentTrack: null,
    currentSongIndex: -1,
    fullQueue: [],
    queue: [],
    showAllSongs: false,
    carouselIndex: 0,
    searchTimeout: null,
    volume: localStorage.getItem('lumebeat-volume') || 0.7
};

// DOM Elements
const els = {
    searchInput: document.getElementById('search-input'),
    albumCarousel: document.getElementById('album-carousel'),
    songsList: document.getElementById('songs-list'),
    audioPlayer: document.getElementById('audio-player'),
    playPauseBtn: document.getElementById('play-pause-btn'),
    progressFill: document.getElementById('progress-fill'),
    progressBar: document.getElementById('progress-bar'),
    currentTime: document.getElementById('current-time'),
    totalTime: document.getElementById('total-time'),
    volumeFill: document.getElementById('volume-fill'),
    volumeBar: document.getElementById('volume-bar'),
    bgGlow: document.getElementById('bg-glow'),
    toastContainer: document.getElementById('toast-container'),
    viewAllBtn: document.getElementById('view-all-songs'),
    mobileDrawer: document.getElementById('mobile-player-drawer'),
    drawerProgressFill: document.getElementById('drawer-progress-fill')
};

// --- Initialization ---
function init() {
    lucide.createIcons();
    els.audioPlayer.volume = state.volume;
    if (els.volumeFill) els.volumeFill.style.width = `${state.volume * 100}%`;
    
    setupEventListeners();
    setupKeyboardControls();
    setupMobileControls();
    
    gsap.from('.app-container', { scale: 0.95, opacity: 0, duration: 1, ease: "power3.out" });
}

function setupEventListeners() {
    els.searchInput.addEventListener('input', handleSearch);
    els.playPauseBtn.addEventListener('click', togglePlay);
    els.progressBar.addEventListener('click', seek);
    if (els.volumeBar) els.volumeBar.addEventListener('click', setVolume);
    
    document.getElementById('next-btn').addEventListener('click', playNext);
    document.getElementById('prev-btn').addEventListener('click', playPrev);
    document.getElementById('next-album').addEventListener('click', () => rotateCarousel(1));
    document.getElementById('prev-album').addEventListener('click', () => rotateCarousel(-1));
    els.viewAllBtn.addEventListener('click', toggleViewAll);
    
    els.audioPlayer.addEventListener('timeupdate', updateProgress);
    els.audioPlayer.addEventListener('ended', playNext);

    const shuffleBtn = document.querySelector('.control-btn i[data-lucide="shuffle"]').parentElement;
    shuffleBtn.addEventListener('click', shuffleQueue);

    document.getElementById('download-btn').addEventListener('click', () => {
        if (state.currentTrack) downloadTrack(state.currentTrack);
    });
}

function setupMobileControls() {
    const trackDetails = document.querySelector('.track-details');
    const closeBtn = document.getElementById('close-drawer');

    if (trackDetails) {
        trackDetails.addEventListener('click', () => {
            console.log('Track details clicked, window width:', window.innerWidth);
            if (window.innerWidth <= 900) {
                els.mobileDrawer.classList.add('open');
                document.body.style.overflow = 'hidden'; // Prevent background scrolling
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            els.mobileDrawer.classList.remove('open');
            document.body.style.overflow = '';
        });
    }

    document.getElementById('drawer-play-pause').addEventListener('click', togglePlay);
    document.getElementById('drawer-next').addEventListener('click', playNext);
    document.getElementById('drawer-prev').addEventListener('click', playPrev);
    document.getElementById('drawer-progress-bar').addEventListener('click', seek);

    // Nav Items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            showToast(`Navigated to ${item.innerText}`, 'info');
        });
    });
}

// --- Search & Fetch ---

function handleSearch(e) {
    const query = e.target.value.trim();
    if (state.searchTimeout) clearTimeout(state.searchTimeout);
    if (query.length < 2) return;

    els.songsList.innerHTML = Array(4).fill(0).map(() => `
        <div class="song-item skeleton" style="height: 70px; border-radius: 18px;"></div>
    `).join('');

    state.searchTimeout = setTimeout(() => fetchMusic(query), 600);
}

async function fetchMusic(query) {
    try {
        const response = await fetch(`${API_URL}${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        renderUI(data);
    } catch (error) {
        renderUI(MOCK_DATA);
        showToast('Using offline results', 'info');
    }
}

function renderUI(data) {
    renderCarousel(data.playlists || []);
    renderSongs(data.songs || []);
}

function renderSongs(songs, forceAll = false) {
    els.songsList.innerHTML = '';
    state.fullQueue = songs;
    state.showAllSongs = forceAll;
    
    state.queue = state.showAllSongs ? state.fullQueue : state.fullQueue.slice(0, 6);
    
    if (state.fullQueue.length > 6) {
        els.viewAllBtn.style.display = 'block';
        els.viewAllBtn.innerText = state.showAllSongs ? 'Show Less' : 'View All';
    } else {
        els.viewAllBtn.style.display = 'none';
    }

    state.queue.forEach((song, i) => {
        const item = document.createElement('div');
        item.className = 'song-item';
        const img = Array.isArray(song.image) ? song.image[0] : song.image;
        
        item.innerHTML = `
            <img src="${img}" class="song-thumb" alt="">
            <div class="song-meta">
                <h4>${song.name}</h4>
                <p>${song.artist}</p>
            </div>
            <div class="song-actions">
                <i data-lucide="download" class="dl-icon" title="Download"></i>
                <div class="song-duration">${formatTime(song.duration)}</div>
            </div>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.dl-icon')) {
                downloadTrack(song);
            } else {
                playSong(song, i);
            }
        });

        els.songsList.appendChild(item);
        gsap.fromTo(item, 
            { opacity: 0, x: -20 }, 
            { opacity: 1, x: 0, delay: Math.min(i * 0.03, 0.4), duration: 0.4 }
        );
    });
    
    updatePlaylistPanel();
    lucide.createIcons();
}

function toggleViewAll() {
    renderSongs(state.fullQueue, !state.showAllSongs);
}

// --- Player Core ---

function playSong(song, index) {
    state.currentTrack = song;
    state.currentSongIndex = index;
    const img = Array.isArray(song.image) ? song.image[1] || song.image[0] : song.image;
    
    const updateEl = (id, val, attr = 'innerText') => {
        const el = document.getElementById(id);
        if (el) el[attr] = val;
    };

    updateEl('player-title', song.name);
    updateEl('player-artist', song.artist);
    updateEl('player-img', img, 'src');
    
    updateEl('drawer-title', song.name);
    updateEl('drawer-artist', song.artist);
    updateEl('drawer-img', img, 'src');

    els.audioPlayer.src = song.url;
    els.audioPlayer.play().catch(() => showToast('Playback blocked. Click Play.', 'warning'));
    state.isPlaying = true;
    
    syncPlayState(true);
    updateGlow(img);
    showToast(`Playing ${song.name}`, 'music');
}

function togglePlay() {
    if (!state.currentTrack) return;
    if (state.isPlaying) {
        els.audioPlayer.pause();
        syncPlayState(false);
    } else {
        els.audioPlayer.play();
        syncPlayState(true);
    }
    state.isPlaying = !state.isPlaying;
}

function syncPlayState(playing) {
    const playIcons = ['play-icon', 'drawer-play-icon'];
    const playBtns = [els.playPauseBtn, document.getElementById('drawer-play-pause')];
    
    playIcons.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('data-lucide', playing ? 'pause' : 'play');
    });
    
    playBtns.forEach(btn => {
        if (btn) btn.classList.toggle('playing', playing);
    });
    
    const visualizer = document.getElementById('visualizer');
    if (visualizer) visualizer.classList.toggle('playing', playing);

    lucide.createIcons();
}

function playNext() {
    if (state.queue.length > 0 && state.currentSongIndex < state.queue.length - 1) {
        playSong(state.queue[state.currentSongIndex + 1], state.currentSongIndex + 1);
    }
}

function playPrev() {
    if (state.queue.length > 0 && state.currentSongIndex > 0) {
        playSong(state.queue[state.currentSongIndex - 1], state.currentSongIndex - 1);
    }
}

function shuffleQueue() {
    if (state.queue.length > 0) {
        const idx = Math.floor(Math.random() * state.queue.length);
        playSong(state.queue[idx], idx);
    }
}

// --- UI Updates ---

function updateProgress() {
    const progress = (els.audioPlayer.currentTime / els.audioPlayer.duration) * 100 || 0;
    els.progressFill.style.width = `${progress}%`;
    if (els.drawerProgressFill) els.drawerProgressFill.style.width = `${progress}%`;
    
    const curTime = formatTime(els.audioPlayer.currentTime);
    const totTime = formatTime(els.audioPlayer.duration);
    
    els.currentTime.innerText = curTime;
    els.totalTime.innerText = totTime;
    
    const dCur = document.getElementById('drawer-current');
    const dTot = document.getElementById('drawer-total');
    if (dCur) dCur.innerText = curTime;
    if (dTot) dTot.innerText = totTime;
}

function seek(e) {
    const width = e.currentTarget.clientWidth;
    const clickX = e.offsetX;
    els.audioPlayer.currentTime = (clickX / width) * els.audioPlayer.duration;
}

function setVolume(e) {
    const width = els.volumeBar.clientWidth;
    state.volume = Math.max(0, Math.min(1, e.offsetX / width));
    els.audioPlayer.volume = state.volume;
    els.volumeFill.style.width = `${state.volume * 100}%`;
    localStorage.setItem('lumebeat-volume', state.volume);
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function showToast(msg, iconName = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i data-lucide="${iconName}"></i> <span>${msg}</span>`;
    els.toastContainer.appendChild(toast);
    lucide.createIcons();
    gsap.to(toast, { y: 0, opacity: 1, duration: 0.5 });
    setTimeout(() => {
        gsap.to(toast, { y: -20, opacity: 0, duration: 0.5, onComplete: () => toast.remove() });
    }, 3000);
}

function updateGlow(img) {
    els.bgGlow.style.background = `radial-gradient(circle at center, rgba(133, 214, 255, 0.2), transparent 60%)`;
}

function setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT') return;
        if (e.code === 'Space') { togglePlay(); e.preventDefault(); }
        if (e.code === 'ArrowRight') playNext();
        if (e.code === 'ArrowLeft') playPrev();
    });
}

function renderCarousel(albums) {
    els.albumCarousel.innerHTML = '';
    albums.slice(0, 5).forEach((album) => {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.innerHTML = `
            <img src="${album.image}" alt="">
            <div class="album-title">${album.title}</div>
            <div class="album-artist">${album.language}</div>
        `;
        els.albumCarousel.appendChild(card);
    });
    rotateCarousel(0);
}

function rotateCarousel(dir) {
    const cards = document.querySelectorAll('.album-card');
    if (cards.length === 0) return;
    state.carouselIndex = (state.carouselIndex + dir + cards.length) % cards.length;
    cards.forEach((card, i) => {
        const offset = i - state.carouselIndex;
        const absOffset = Math.abs(offset);
        card.classList.toggle('active', absOffset === 0);
        gsap.to(card, {
            x: offset * 240,
            scale: 1 - absOffset * 0.15,
            opacity: 1 - absOffset * 0.4,
            rotateY: offset * -15,
            zIndex: 10 - absOffset,
            duration: 0.6
        });
    });
}

function updatePlaylistPanel() {
    const panel = document.getElementById('playlist-items');
    panel.innerHTML = state.fullQueue.slice(0, 8).map((song, i) => `
        <div class="playlist-item" onclick="playSongFromPlaylist(${i})">
            <strong>${song.name}</strong><br><small>${song.artist}</small>
        </div>
    `).join('');
}

window.playSongFromPlaylist = (idx) => playSong(state.fullQueue[idx], idx);

function sanitizeFileName(name) {
    if (!name) return 'Unknown';
    // Decode HTML entities
    const parser = new DOMParser();
    const decoded = parser.parseFromString(name, 'text/html').body.textContent;
    // Remove characters that are invalid in file paths
    return decoded.replace(/[\\/:*?"<>|]/g, '').trim();
}

async function downloadTrack(song) {
    if (!song || !song.url) return;
    
    showToast('Preparing download...', 'download');
    
    try {
        // Try direct fetch first
        let response = await fetch(song.url).catch(() => null);
        
        // If direct fetch fails (CORS), try via proxy
        if (!response || !response.ok) {
            console.log('Direct download failed, trying via proxy...');
            const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(song.url)}`;
            response = await fetch(proxiedUrl);
        }

        if (!response.ok) throw new Error();
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const cleanName = sanitizeFileName(song.name);
        const cleanArtist = sanitizeFileName(song.artist);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${cleanName} - ${cleanArtist}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
        showToast('Download started!', 'check');
    } catch (error) {
        console.error('Download failed:', error);
        showToast('Download failed. Try again.', 'x-circle');
    }
}

init();
