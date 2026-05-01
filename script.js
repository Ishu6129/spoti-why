/**
 * Spoti-why - Premium Music Player
 * Fully responsive: Desktop + Mobile
 * Party mode with smooth canvas animation
 */

// Configuration
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
    userPlaylist: JSON.parse(localStorage.getItem('lumebeat-playlist') || '[]'),
    showAllSongs: false,
    searchTimeout: null,
    volume: parseFloat(localStorage.getItem('lumebeat-volume')) || 0.7,
    repeatMode: 'none', // none, one, all
    shuffleOn: false,
    partyMode: false,
    partyAutoEnabled: true
};

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80';

function decodeHTMLEntities(text) {
    if (!text) return '';
    const ta = document.createElement('textarea');
    ta.innerHTML = text;
    return ta.value;
}

// DOM
const els = {
    searchInput: document.getElementById('search-input'),
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
    drawerProgressFill: document.getElementById('drawer-progress-fill'),
    searchLoader: document.getElementById('search-loader'),
    visualizer: document.getElementById('visualizer'),
    partyCanvas: document.getElementById('party-canvas')
};

// ===== PARTY MODE (lightweight canvas) =====
const party = {
    ctx: null,
    particles: [],
    raf: null,
    maxParticles: 40,

    init() {
        if (!els.partyCanvas) return;
        this.ctx = els.partyCanvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    },

    resize() {
        if (!els.partyCanvas) return;
        els.partyCanvas.width = window.innerWidth;
        els.partyCanvas.height = window.innerHeight;
    },

    start() {
        if (this.raf) return;
        els.partyCanvas.classList.add('active');
        document.getElementById('app-logo')?.classList.add('party-logo');
        document.getElementById('player-bar')?.classList.add('party-active');
        this.spawnBurst(15);
        this.loop();
    },

    stop() {
        els.partyCanvas.classList.remove('active');
        document.getElementById('app-logo')?.classList.remove('party-logo');
        document.getElementById('player-bar')?.classList.remove('party-active');
        if (this.raf) {
            cancelAnimationFrame(this.raf);
            this.raf = null;
        }
        this.particles = [];
        if (this.ctx) this.ctx.clearRect(0, 0, els.partyCanvas.width, els.partyCanvas.height);
    },

    spawnBurst(count) {
        const w = els.partyCanvas.width;
        const h = els.partyCanvas.height;
        const colors = ['#ff7eb3', '#85d6ff', '#ffd285', '#a78bfa', '#34d399', '#f472b6'];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * w,
                y: h + 20,
                vx: (Math.random() - 0.5) * 2,
                vy: -(1.5 + Math.random() * 3),
                r: 3 + Math.random() * 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 0.7 + Math.random() * 0.3,
                life: 120 + Math.random() * 120
            });
        }
        // Cap particles
        if (this.particles.length > this.maxParticles) {
            this.particles = this.particles.slice(-this.maxParticles);
        }
    },

    loop() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = els.partyCanvas.width;
        const h = els.partyCanvas.height;
        ctx.clearRect(0, 0, w, h);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.01; // slight gravity
            p.life--;
            p.alpha = Math.max(0, p.alpha - 0.004);

            if (p.life <= 0 || p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Continuously spawn a few while playing
        if (state.isPlaying && state.partyMode && Math.random() < 0.3) {
            this.spawnBurst(2);
        }

        if (this.particles.length > 0 || (state.isPlaying && state.partyMode)) {
            this.raf = requestAnimationFrame(() => this.loop());
        } else {
            this.raf = null;
            ctx.clearRect(0, 0, w, h);
            els.partyCanvas.classList.remove('active');
        }
    }
};

// ===== INIT =====
function init() {
    lucide.createIcons();
    els.audioPlayer.volume = state.volume;
    if (els.volumeFill) els.volumeFill.style.width = `${state.volume * 100}%`;

    party.init();
    setupEventListeners();
    setupKeyboardControls();
    setupMobileControls();

    const navHome = document.getElementById('nav-home');
    if (navHome) navHome.click();

    gsap.from('.app-container', { scale: 0.97, opacity: 0, duration: 0.8, ease: 'power3.out' });
}

function setupEventListeners() {
    els.searchInput.addEventListener('keydown', handleSearch);
    els.playPauseBtn.addEventListener('click', togglePlay);
    els.progressBar.addEventListener('click', seek);
    if (els.volumeBar) els.volumeBar.addEventListener('click', setVolume);

    document.getElementById('next-btn').addEventListener('click', playNext);
    document.getElementById('prev-btn').addEventListener('click', playPrev);
    els.viewAllBtn.addEventListener('click', toggleViewAll);

    els.audioPlayer.addEventListener('timeupdate', updateProgress);
    els.audioPlayer.addEventListener('ended', handleTrackEnd);

    const shuffleBtn = document.getElementById('shuffle-btn');
    if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);

    const repeatBtn = document.getElementById('repeat-btn');
    if (repeatBtn) repeatBtn.addEventListener('click', toggleRepeat);

    const partyBtn = document.getElementById('party-btn');
    if (partyBtn) partyBtn.addEventListener('click', togglePartyMode);

    document.getElementById('download-btn').addEventListener('click', () => {
        if (state.currentTrack) downloadTrack(state.currentTrack);
    });
}

function setupMobileControls() {
    // Open drawer on player bar click (mobile)
    const playerBar = document.getElementById('player-bar');
    if (playerBar) {
        playerBar.addEventListener('click', (e) => {
            // Only on mobile, and not if clicking a button inside
            if (window.innerWidth <= 768 && !e.target.closest('button')) {
                els.mobileDrawer.classList.add('open');
                document.body.style.overflow = 'hidden';
            }
        });
    }

    const closeBtn = document.getElementById('close-drawer');
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

    const drawerShuffle = document.getElementById('drawer-shuffle-btn');
    if (drawerShuffle) drawerShuffle.addEventListener('click', toggleShuffle);

    const drawerRepeat = document.getElementById('drawer-repeat-btn');
    if (drawerRepeat) drawerRepeat.addEventListener('click', toggleRepeat);

    // Swipe down to close drawer
    let touchStartY = 0;
    els.mobileDrawer.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    els.mobileDrawer.addEventListener('touchend', (e) => {
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (dy > 100) {
            els.mobileDrawer.classList.remove('open');
            document.body.style.overflow = '';
        }
    }, { passive: true });

    // Nav items
    const showTab = (tabId) => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        const active = document.getElementById(tabId);
        if (active) active.classList.add('active');

        const songsSec = document.querySelector('.songs-section');
        const playPan = document.querySelector('.playlist-panel');

        if (tabId === 'nav-library') {
            if (songsSec) songsSec.classList.add('mobile-hidden');
            if (playPan) playPan.classList.add('mobile-active');
        } else {
            if (songsSec) songsSec.classList.remove('mobile-hidden');
            if (playPan) playPan.classList.remove('mobile-active');
            if (tabId === 'nav-search') els.searchInput.focus();
        }
    };

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => showTab(item.id));
    });
}

// ===== SEARCH & FETCH =====
function handleSearch(e) {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query.length < 2) return;
        els.songsList.innerHTML = Array(4).fill(0).map(() =>
            '<div class="song-item skeleton" style="height:68px;border-radius:16px;"></div>'
        ).join('');
        fetchMusic(query);
    }
}

async function fetchMusic(query) {
    if (els.searchLoader) els.searchLoader.style.display = 'block';
    try {
        const res = await fetch(`${API_URL}${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        renderUI(data);
    } catch {
        renderUI(MOCK_DATA);
        showToast('Using offline results', 'info');
    } finally {
        if (els.searchLoader) els.searchLoader.style.display = 'none';
    }
}

function renderUI(data) {
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
        const img = (Array.isArray(song.image) ? song.image[0] : song.image) || DEFAULT_IMG;

        item.innerHTML = `
            <img src="${img}" class="song-thumb" alt="" loading="lazy">
            <div class="song-meta">
                <h4>${decodeHTMLEntities(song.name)}</h4>
                <p>${decodeHTMLEntities(song.artist)}</p>
            </div>
            <div class="song-actions">
                <i data-lucide="plus-circle" class="add-icon" title="Add to Playlist"></i>
                <i data-lucide="download" class="dl-icon" title="Download"></i>
                <div class="song-duration">${formatTime(song.duration)}</div>
            </div>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.dl-icon')) downloadTrack(song);
            else if (e.target.closest('.add-icon')) addToPlaylist(song);
            else playSong(song, i);
        });

        item.style.animation = `fadeInUp 0.35s ease forwards ${Math.min(i * 0.04, 0.4)}s`;
        item.style.opacity = '0';
        els.songsList.appendChild(item);
    });

    updatePlaylistPanel();
    lucide.createIcons();
}

function toggleViewAll() {
    renderSongs(state.fullQueue, !state.showAllSongs);
}

// ===== PLAYER CORE =====
function playSong(song, index) {
    state.currentTrack = song;
    state.currentSongIndex = index;
    const img = Array.isArray(song.image) ? (song.image[1] || song.image[0]) : song.image;

    const update = (id, val, attr = 'innerText') => {
        const el = document.getElementById(id);
        if (el) el[attr] = val;
    };

    update('current-title', decodeHTMLEntities(song.name));
    update('current-artist', decodeHTMLEntities(song.artist));
    update('current-img', img || DEFAULT_IMG, 'src');
    update('drawer-title', decodeHTMLEntities(song.name));
    update('drawer-artist', decodeHTMLEntities(song.artist));
    update('drawer-img', img || DEFAULT_IMG, 'src');

    document.querySelectorAll('.song-item').forEach((item, i) => {
        item.classList.toggle('active-song', i === index);
    });

    els.audioPlayer.src = song.url;
    els.audioPlayer.play().catch(() => showToast('Playback blocked. Tap play.', 'alert-circle'));
    state.isPlaying = true;

    syncPlayState(true);
    updateGlow(img);

    // Auto party mode when music plays
    if (state.partyAutoEnabled && !state.partyMode) {
        state.partyMode = true;
        party.start();
        const partyBtn = document.getElementById('party-btn');
        if (partyBtn) partyBtn.classList.add('active-mode');
    }

    showToast(`Playing: ${decodeHTMLEntities(song.name)}`, 'music');
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
    ['play-icon', 'drawer-play-icon'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.setAttribute('data-lucide', playing ? 'pause' : 'play');
    });

    [els.playPauseBtn, document.getElementById('drawer-play-pause')].forEach(btn => {
        if (btn) btn.classList.toggle('playing', playing);
    });

    const logo = document.getElementById('app-logo');
    if (logo && !state.partyMode) logo.classList.toggle('beating-logo', playing);

    if (els.visualizer) els.visualizer.classList.toggle('playing', playing);

    const drawerImg = document.getElementById('drawer-img');
    if (drawerImg) drawerImg.classList.toggle('playing', playing);

    // Sync party animation
    if (state.partyMode) {
        if (playing) party.start();
        else party.stop();
    }

    lucide.createIcons();
}

function handleTrackEnd() {
    if (state.repeatMode === 'one') {
        els.audioPlayer.currentTime = 0;
        els.audioPlayer.play();
        return;
    }

    if (state.shuffleOn && state.queue.length > 1) {
        let idx;
        do { idx = Math.floor(Math.random() * state.queue.length); }
        while (idx === state.currentSongIndex && state.queue.length > 1);
        playSong(state.queue[idx], idx);
        return;
    }

    if (state.currentSongIndex < state.queue.length - 1) {
        playSong(state.queue[state.currentSongIndex + 1], state.currentSongIndex + 1);
    } else if (state.repeatMode === 'all' && state.queue.length > 0) {
        playSong(state.queue[0], 0);
    } else {
        syncPlayState(false);
        state.isPlaying = false;
    }
}

function playNext() {
    if (state.shuffleOn && state.queue.length > 1) {
        let idx;
        do { idx = Math.floor(Math.random() * state.queue.length); }
        while (idx === state.currentSongIndex);
        playSong(state.queue[idx], idx);
    } else if (state.queue.length > 0 && state.currentSongIndex < state.queue.length - 1) {
        playSong(state.queue[state.currentSongIndex + 1], state.currentSongIndex + 1);
    } else if (state.repeatMode === 'all' && state.queue.length > 0) {
        playSong(state.queue[0], 0);
    }
}

function playPrev() {
    // If more than 3s in, restart current track
    if (els.audioPlayer.currentTime > 3) {
        els.audioPlayer.currentTime = 0;
        return;
    }
    if (state.queue.length > 0 && state.currentSongIndex > 0) {
        playSong(state.queue[state.currentSongIndex - 1], state.currentSongIndex - 1);
    }
}

function toggleShuffle() {
    state.shuffleOn = !state.shuffleOn;
    const btns = [document.getElementById('shuffle-btn'), document.getElementById('drawer-shuffle-btn')];
    btns.forEach(b => { if (b) b.classList.toggle('active-mode', state.shuffleOn); });
    showToast(state.shuffleOn ? 'Shuffle on' : 'Shuffle off', 'shuffle');
}

function toggleRepeat() {
    const modes = ['none', 'all', 'one'];
    const idx = (modes.indexOf(state.repeatMode) + 1) % modes.length;
    state.repeatMode = modes[idx];

    const icons = { none: 'repeat', all: 'repeat', one: 'repeat-1' };
    const btns = [document.getElementById('repeat-btn'), document.getElementById('drawer-repeat-btn')];
    btns.forEach(b => {
        if (!b) return;
        b.classList.toggle('active-mode', state.repeatMode !== 'none');
        const icon = b.querySelector('i, svg');
        if (icon) icon.setAttribute('data-lucide', icons[state.repeatMode]);
    });
    lucide.createIcons();

    const labels = { none: 'Repeat off', all: 'Repeat all', one: 'Repeat one' };
    showToast(labels[state.repeatMode], 'repeat');
}

function togglePartyMode() {
    state.partyMode = !state.partyMode;
    state.partyAutoEnabled = state.partyMode;
    const partyBtn = document.getElementById('party-btn');
    if (partyBtn) partyBtn.classList.toggle('active-mode', state.partyMode);

    if (state.partyMode && state.isPlaying) {
        party.start();
        showToast('Party mode on!', 'sparkles');
    } else {
        party.stop();
        const logo = document.getElementById('app-logo');
        if (logo) {
            logo.classList.remove('party-logo');
            logo.classList.toggle('beating-logo', state.isPlaying);
        }
        if (!state.partyMode) showToast('Party mode off', 'sparkles');
    }
}

// ===== UI UPDATES =====
function updateProgress() {
    const pct = (els.audioPlayer.currentTime / els.audioPlayer.duration) * 100 || 0;
    els.progressFill.style.width = `${pct}%`;
    if (els.drawerProgressFill) els.drawerProgressFill.style.width = `${pct}%`;

    const cur = formatTime(els.audioPlayer.currentTime);
    const tot = formatTime(els.audioPlayer.duration);
    els.currentTime.innerText = cur;
    els.totalTime.innerText = tot;

    const dc = document.getElementById('drawer-current');
    const dt = document.getElementById('drawer-total');
    if (dc) dc.innerText = cur;
    if (dt) dt.innerText = tot;
}

function seek(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = clickX / rect.width;
    if (els.audioPlayer.duration) {
        els.audioPlayer.currentTime = pct * els.audioPlayer.duration;
    }
}

function setVolume(e) {
    const rect = els.volumeBar.getBoundingClientRect();
    state.volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    els.audioPlayer.volume = state.volume;
    els.volumeFill.style.width = `${state.volume * 100}%`;
    localStorage.setItem('lumebeat-volume', state.volume);
}

function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function showToast(msg, iconName = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i data-lucide="${iconName}"></i> <span>${msg}</span>`;
    els.toastContainer.appendChild(toast);
    lucide.createIcons();
    gsap.to(toast, { y: 0, opacity: 1, duration: 0.4 });
    setTimeout(() => {
        gsap.to(toast, { y: -15, opacity: 0, duration: 0.4, onComplete: () => toast.remove() });
    }, 2500);
}

function updateGlow(img) {
    if (els.bgGlow) {
        els.bgGlow.style.background = 'radial-gradient(circle at center, rgba(133,214,255,0.2), transparent 60%)';
    }
    const drawer = document.getElementById('mobile-player-drawer');
    if (drawer) {
        drawer.style.setProperty('--drawer-bg-1', 'rgba(255,126,179,0.15)');
        drawer.style.setProperty('--drawer-bg-2', 'rgba(133,214,255,0.15)');
    }
}

function setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT') return;
        if (e.code === 'Space') { togglePlay(); e.preventDefault(); }
        if (e.code === 'ArrowRight') playNext();
        if (e.code === 'ArrowLeft') playPrev();
        if (e.code === 'KeyP') togglePartyMode();
    });
}

// ===== PLAYLIST =====
function updatePlaylistPanel() {
    const panel = document.getElementById('playlist-items');
    if (!panel) return;

    if (state.userPlaylist.length === 0) {
        panel.innerHTML = `
            <div class="empty-playlist">
                <i data-lucide="list-music"></i>
                <p>Your library is empty.</p>
                <small style="opacity:0.6">Search for songs and click + to add them.</small>
            </div>
        `;
    } else {
        const controls = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="margin:0;font-size:0.95rem;">${state.userPlaylist.length} Songs</h3>
                <button onclick="shufflePlaylist()" style="background:var(--primary-gradient);color:white;border:none;padding:7px 14px;border-radius:18px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:0.82rem;">
                    <i data-lucide="shuffle" style="width:14px;height:14px;"></i> Shuffle
                </button>
            </div>
        `;
        const list = state.userPlaylist.map((song, i) => {
            const img = Array.isArray(song.image) ? song.image[0] : song.image;
            return `
            <div class="song-item" onclick="playSongFromPlaylist(${i})">
                <img src="${img}" class="song-thumb" alt="" loading="lazy">
                <div class="song-meta">
                    <h4>${decodeHTMLEntities(song.name)}</h4>
                    <p>${decodeHTMLEntities(song.artist)}</p>
                </div>
                <div class="song-actions">
                    <i data-lucide="trash-2" class="trash-icon" onclick="event.stopPropagation();removeFromPlaylist(${i})" title="Remove"></i>
                </div>
            </div>`;
        }).join('');
        panel.innerHTML = controls + list;
    }
    lucide.createIcons();
}

window.shufflePlaylist = () => {
    if (state.userPlaylist.length > 0) {
        state.queue = [...state.userPlaylist];
        const idx = Math.floor(Math.random() * state.userPlaylist.length);
        playSong(state.userPlaylist[idx], idx);
        showToast('Shuffling playlist', 'shuffle');
    }
};

function addToPlaylist(song) {
    if (!state.userPlaylist.find(s => s.id === song.id)) {
        state.userPlaylist.push(song);
        localStorage.setItem('lumebeat-playlist', JSON.stringify(state.userPlaylist));
        updatePlaylistPanel();
        showToast('Added to playlist', 'check-circle');
    } else {
        showToast('Already in playlist', 'info');
    }
}

window.removeFromPlaylist = (idx) => {
    state.userPlaylist.splice(idx, 1);
    localStorage.setItem('lumebeat-playlist', JSON.stringify(state.userPlaylist));
    updatePlaylistPanel();
    showToast('Removed from playlist', 'trash-2');
};

window.playSongFromPlaylist = (idx) => {
    state.queue = [...state.userPlaylist];
    playSong(state.userPlaylist[idx], idx);
};

// ===== DOWNLOAD =====
function sanitizeFileName(name) {
    if (!name) return 'Unknown';
    const parser = new DOMParser();
    const decoded = parser.parseFromString(name, 'text/html').body.textContent;
    return decoded.replace(/[\\/:*?"<>|]/g, '').trim();
}

async function downloadTrack(song) {
    if (!song || !song.url) return;
    showToast('Preparing download...', 'download');

    try {
        let response = await fetch(song.url).catch(() => null);
        if (!response || !response.ok) {
            const proxied = `${CORS_PROXY}${encodeURIComponent(song.url)}`;
            response = await fetch(proxied);
        }
        if (!response.ok) throw new Error();

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizeFileName(song.name)} - ${sanitizeFileName(song.artist)}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 200);
        showToast('Download started!', 'check');
    } catch {
        showToast('Download failed. Try again.', 'x-circle');
    }
}

// Boot
init();
