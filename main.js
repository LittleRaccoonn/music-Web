// Import data directly since we are using type="module"
import { categories } from './src/data.js';

// Initialize Lucide icons (Using CDN global variable)
const initIcons = () => {
    if (window.lucide) {
        window.lucide.createIcons();
    }
};

// --- STATE MANAGEMENT ---
let currentAudio = new Audio();
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let currentTrackUrl = null; 
let currentTrackMetadata = null; 
let favorites = JSON.parse(localStorage.getItem('auditica_favorites')) || [];
let recentlyPlayed = JSON.parse(localStorage.getItem('auditica_recently_played')) || []; 
let userPlaylists = JSON.parse(localStorage.getItem('auditica_user_playlists')) || []; // User Created Playlists
let topStreamsMode = 'local'; 
let topStreamsLimit = 8; 

// QUEUE SYSTEM
let currentQueue = []; // Array of track objects
let currentQueueIndex = -1; // Current index in queue

// DOM Elements
const mainView = document.getElementById('main-view');
const playerImage = document.getElementById('player-img');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');
const playerLikeBtn = document.getElementById('player-like-btn');
const progressFills = document.querySelectorAll('.progress-fill'); // Select all progress fills (desktop & mobile)
const currentTimeEl = document.querySelector('footer .current-time');
const durationEl = document.querySelector('footer .duration-time');
const volumeSlider = document.getElementById('volume-slider');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');

// --- API FUNCTIONS ---
async function fetchMusic(term, limit = 10) {
  try {
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`);
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching music:', error);
    return [];
  }
}

function getHighResImage(url) {
  return url ? url.replace('100x100bb.jpg', '600x600bb.jpg') : 'https://img-wrapper.vercel.app/image?url=https://img-wrapper.vercel.app/image?url=https://img-wrapper.vercel.app/image?url=https://placehold.co/600x600/1E1E1E/FFF?text=Music';
}

// --- PLAYLIST MANAGEMENT ---
function createPlaylist() {
    const name = prompt("Enter playlist name:");
    if (name && name.trim()) {
        const newPlaylist = {
            id: Date.now().toString(),
            name: name.trim(),
            tracks: [] // Future: Allow adding tracks to playlists
        };
        userPlaylists.push(newPlaylist);
        localStorage.setItem('auditica_user_playlists', JSON.stringify(userPlaylists));
        renderSidebarPlaylists();
        // Open the new playlist immediately
        renderPlaylistPage(name, name);
    }
}

function renderSidebarPlaylists() {
    const container = document.getElementById('playlist-container');
    if (!container) return;

    // Keep the static ones first
    const staticLinks = `
      <a href="#" data-query="workplace" class="playlist-link flex items-center gap-3 px-4 py-2.5 text-text-muted hover:text-white hover:bg-white/5 rounded-[6px] transition-all group">
        <i data-lucide="music-2" class="w-4 h-4"></i>
        <span class="text-[13px]">For workplace</span>
      </a>
      <a href="#" data-query="lofi" class="playlist-link block px-4 py-2.5 text-text-muted hover:text-white text-[13px] font-medium transition-colors hover:translate-x-1 duration-200">Lo-Fi Jazz upbeat</a>
      <a href="#" data-query="focus" class="playlist-link block px-4 py-2.5 text-text-muted hover:text-white text-[13px] font-medium transition-colors hover:translate-x-1 duration-200">Deep Focus</a>
      <a href="#" data-query="christmas" class="playlist-link block px-4 py-2.5 text-text-muted hover:text-white text-[13px] font-medium transition-colors hover:translate-x-1 duration-200">Christmas playlist</a>
    `;

    // Generate dynamic ones
    const dynamicLinks = userPlaylists.map(pl => `
        <a href="#" data-query="${pl.name}" data-is-user="true" class="playlist-link block px-4 py-2.5 text-text-muted hover:text-white text-[13px] font-medium transition-colors hover:translate-x-1 duration-200 flex items-center gap-2">
            <i data-lucide="list-music" class="w-3 h-3"></i>
            ${pl.name}
        </a>
    `).join('');

    container.innerHTML = staticLinks + dynamicLinks;
    
    // Re-attach listeners
    setupNavigation(); 
    initIcons();
}

// --- FAVORITES LOGIC ---
function isFavorite(trackId) {
    return favorites.some(f => f.id === trackId);
}

function toggleFavorite(track) {
    const index = favorites.findIndex(f => f.id === track.id);
    if (index === -1) {
        favorites.push(track);
    } else {
        favorites.splice(index, 1);
    }
    localStorage.setItem('auditica_favorites', JSON.stringify(favorites));
    
    const activeNav = document.querySelector('.nav-link.active-nav');
    if (activeNav && activeNav.id === 'nav-favorite') {
        renderFavoritesPage();
    }
    
    if (currentTrackMetadata && currentTrackMetadata.id === track.id) {
        updatePlayerLikeBtn(track.id);
    }
}

function updatePlayerLikeBtn(trackId) {
    if (!playerLikeBtn) return;
    const icon = playerLikeBtn.querySelector('svg') || playerLikeBtn.querySelector('i');
    
    if (isFavorite(trackId)) {
        playerLikeBtn.classList.add('text-primary');
        playerLikeBtn.classList.remove('text-text-muted');
        if(icon) {
            icon.style.fill = "#EE4950";
            icon.style.stroke = "#EE4950";
        }
    } else {
        playerLikeBtn.classList.remove('text-primary');
        playerLikeBtn.classList.add('text-text-muted');
        if(icon) {
            icon.style.fill = "none";
            icon.style.stroke = "currentColor";
        }
    }
}

// --- RECENTLY PLAYED LOGIC ---
function addToRecentlyPlayed(track) {
    recentlyPlayed = recentlyPlayed.filter(t => t.id !== track.id);
    recentlyPlayed.unshift(track);
    if (recentlyPlayed.length > 10) recentlyPlayed.pop();
    localStorage.setItem('auditica_recently_played', JSON.stringify(recentlyPlayed));
    
    const recentlyContainer = document.getElementById('recently-played-container');
    if (recentlyContainer) {
        renderListGrid(recentlyPlayed, 'recently-played-container');
    }
}

// --- VIEW RENDERERS ---
// ... (Render functions updated to store queue context)

async function renderHomePage() {
  mainView.innerHTML = `
    <!-- Hero Section -->
    <section class="relative w-full h-[380px] rounded-[20px] overflow-hidden group shadow-2xl shadow-black/50 mt-4 md:mt-0 fade-in">
      <img src="https://img-wrapper.vercel.app/image?url=https://img-wrapper.vercel.app/image?url=https://img-wrapper.vercel.app/image?url=https://s3-alpha-sig.figma.com/img/84d8/075d/589045fe3b117b894ed84e2458e17829?Expires=1765756800&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=ZNxCziC-XyGtF5if4O8XN-Zp7wAhctpw25aFTAjbwyFs6a6Iva9r4R72pqYPE5uDzTCZlV~TASwT4jP4~WEWl5Tiy-4K0QCVlDmq-wMYyBEYGjr6Ebbqd2XIf3~MyJGG6IV991RWna8VLZR96PAMLSftz8siMOQGBQDFZZ33R09mFSHVOUGBCxSpjQnHebVRd0rP5l4DvDTEkebeSda8Ydzd04Who~Q0OhT7DV5QvbMTGLkPQNWoZpFwB16qK8GLpl2-raRLptyb3FMk63X~DtcXRnseBDBuOKvlx8gvXN~uNuj7bwBNgBIIdzu541fQQlIDoPVuIrt0pHHL4oGZtQ__" alt="Post Malone" class="absolute inset-0 w-full h-full object-cover object-[center_20%] transition-transform duration-[2s] group-hover:scale-105">
      <div class="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-background/90 via-background/20 to-transparent"></div>
      <div class="absolute inset-0 p-8 md:p-10 flex justify-between">
        <div class="hidden sm:flex flex-col justify-center gap-5 z-10 mt-8">
           <div class="genre-action text-text-muted text-[13px] font-semibold hover:text-white cursor-pointer transition-colors tracking-wide" data-query="R&B">R&B</div>
           <div class="flex items-center gap-3 -ml-4 genre-action cursor-pointer" data-query="Pop">
             <div class="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_#EE4950]"></div> 
             <span class="text-white text-[19px] font-bold tracking-wide">Pop</span>
           </div>
           <div class="genre-action text-text-muted text-[13px] font-semibold hover:text-white cursor-pointer transition-colors tracking-wide" data-query="Rap">Rap</div>
           <div class="genre-action text-text-muted text-[13px] font-semibold hover:text-white cursor-pointer transition-colors tracking-wide" data-query="Ballad">Ballad</div>
        </div>
        <div class="flex flex-col items-end justify-end ml-auto text-right z-10 mb-4">
          <div class="text-[11px] font-extrabold tracking-[0.25em] text-white/80 mb-2 uppercase drop-shadow-md">Featured Songs</div>
          <h2 class="text-4xl font-light text-white mb-[-8px] tracking-tight drop-shadow-lg opacity-90">Post Malone</h2>
          <h1 class="text-[72px] leading-none font-bold text-white mb-8 tracking-tighter drop-shadow-2xl">Circles</h1>
          <div class="flex items-center justify-end gap-4">
             <button class="bg-primary hover:bg-[#D63D43] text-white px-10 py-3 rounded-[6px] font-bold text-[14px] flex items-center gap-2 transition-all shadow-[0_4px_20px_rgba(238,73,80,0.4)] hover:shadow-[0_6px_25px_rgba(238,73,80,0.6)] hover:-translate-y-0.5 ml-2" onclick="document.querySelector('.track-card')?.click()">
               <span>Play</span>
             </button>
          </div>
        </div>
      </div>
    </section>

    <!-- New Releases -->
    <section class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-[24px] font-bold text-white tracking-tight">New Releases</h2>
        <a href="#" class="text-[14px] font-semibold text-secondary hover:text-white transition-colors tracking-wide" id="see-more-releases">See more</a>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6" id="new-releases-container">
        <div class="col-span-full flex justify-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      </div>
    </section>

    <!-- You May Like -->
    <section class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-[24px] font-bold text-white tracking-tight">You May Like</h2>
      </div>
      <div class="flex gap-8 overflow-x-auto custom-scrollbar pb-6 pt-2" id="you-may-like-container"></div>
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 fade-in">
      <!-- Recently Played -->
      <section class="lg:col-span-2">
        <div class="flex items-center gap-4 mb-6">
          <h2 class="text-[24px] font-bold text-white tracking-tight">Recently Played</h2>
        </div>
        <div class="space-y-2" id="recently-played-container"></div>
      </section>

      <!-- Categories -->
      <section>
         <div class="flex items-center justify-between mb-6">
          <h2 class="text-[24px] font-bold text-white tracking-tight">Categories</h2>
        </div>
        <div class="grid grid-cols-2 gap-4" id="categories-container"></div>
      </section>
    </div>
    <div class="h-16"></div>
  `;

  const [newReleases, youMayLike] = await Promise.all([
      fetchMusic('top hits 2025', 10),
      fetchMusic('The Weeknd', 8)
  ]);

  renderTrackGrid(newReleases, 'new-releases-container');
  renderCircleGrid(youMayLike, 'you-may-like-container');
  renderCategories('categories-container');
  
  if (recentlyPlayed.length > 0) {
      renderListGrid(recentlyPlayed, 'recently-played-container');
  } else {
      const fallback = await fetchMusic('Taylor Swift', 4);
      renderListGrid(fallback, 'recently-played-container');
  }
  
  document.getElementById('see-more-releases')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('nav-browse').click();
  });
  
  initIcons();
}

async function renderBrowsePage() {
    mainView.innerHTML = `
        <h1 class="text-4xl font-bold text-white mb-8 fade-in">Browse</h1>
        
        <section class="mb-10 fade-in">
            <h2 class="text-2xl font-bold text-white mb-6">Genres & Moods</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" id="browse-categories"></div>
        </section>

        <section class="fade-in">
             <h2 class="text-2xl font-bold text-white mb-6">Trending Now</h2>
             <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6" id="browse-trending">
                <div class="col-span-full flex justify-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
             </div>
        </section>
        <div class="h-16"></div>
    `;

    renderCategories('browse-categories');
    const trending = await fetchMusic('chart toppers', 15);
    renderTrackGrid(trending, 'browse-trending');
    initIcons();
}

function renderFavoritesPage() {
    if (favorites.length === 0) {
        mainView.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-center fade-in pb-20">
                <div class="w-20 h-20 bg-[#2A2A2A] rounded-full flex items-center justify-center mb-6">
                    <i data-lucide="heart" class="w-10 h-10 text-text-muted"></i>
                </div>
                <h2 class="text-2xl font-bold text-white mb-2">No Favorites Yet</h2>
                <p class="text-text-muted mb-6">Save songs you love by clicking the heart icon.</p>
                <button id="go-browse-btn" class="px-6 py-3 bg-primary text-white rounded-full font-bold hover:bg-red-600 transition-colors">Find Songs</button>
            </div>
        `;
        document.getElementById('go-browse-btn')?.addEventListener('click', () => {
             document.getElementById('nav-browse').click();
        });
    } else {
        mainView.innerHTML = `
            <h1 class="text-4xl font-bold text-white mb-8 fade-in">Your Favorites</h1>
            <div class="space-y-2 fade-in" id="favorites-list"></div>
            <div class="h-16"></div>
        `;
        renderListGrid(favorites, 'favorites-list', true);
    }
    initIcons();
}

function renderLibraryPage() {
    mainView.innerHTML = `
        <h1 class="text-4xl font-bold text-white mb-8 fade-in">Your Library</h1>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 fade-in">
            <div id="lib-liked-songs" class="bg-[#1E1E1E] p-4 rounded-[12px] hover:bg-white/5 transition-colors group cursor-pointer relative overflow-hidden shadow-card">
                <div class="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div class="aspect-square bg-gradient-to-br from-[#2A2A2A] to-[#111] rounded-[8px] mb-4 flex items-center justify-center shadow-lg relative z-10">
                    <i data-lucide="heart" class="w-12 h-12 text-white fill-primary"></i>
                </div>
                <h3 class="text-white font-bold text-lg relative z-10">Liked Songs</h3>
                <p class="text-text-muted text-sm relative z-10"><span class="text-primary font-bold">${favorites.length}</span> songs</p>
            </div>
            <div class="bg-[#1E1E1E] p-4 rounded-[12px] hover:bg-white/5 transition-colors group cursor-pointer opacity-60 hover:opacity-100">
                <div class="aspect-square bg-[#2A2A2A] rounded-[8px] mb-4 flex items-center justify-center shadow-lg">
                    <i data-lucide="mic-2" class="w-12 h-12 text-text-muted group-hover:text-white transition-colors"></i>
                </div>
                <h3 class="text-white font-bold text-lg">Podcasts</h3>
                <p class="text-text-muted text-sm">0 saved</p>
            </div>
             <div class="bg-[#1E1E1E] p-4 rounded-[12px] hover:bg-white/5 transition-colors group cursor-pointer opacity-60 hover:opacity-100">
                <div class="aspect-square bg-[#2A2A2A] rounded-[8px] mb-4 flex items-center justify-center shadow-lg">
                    <i data-lucide="folder" class="w-12 h-12 text-text-muted group-hover:text-white transition-colors"></i>
                </div>
                <h3 class="text-white font-bold text-lg">Local Files</h3>
                <p class="text-text-muted text-sm">0 files</p>
            </div>
        </div>
    `;
    initIcons();

    document.getElementById('lib-liked-songs').addEventListener('click', () => {
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('active-nav', 'bg-primary', 'text-white', 'shadow-glow');
            l.classList.add('text-text-muted');
        });
        const favNav = document.getElementById('nav-favorite');
        if(favNav) {
            favNav.classList.add('active-nav', 'bg-primary', 'text-white', 'shadow-glow');
            favNav.classList.remove('text-text-muted');
        }
        renderFavoritesPage();
    });
}

async function renderPlaylistPage(query, title) {
    mainView.innerHTML = `
        <div class="flex items-end gap-6 mb-8 fade-in">
            <div class="w-48 h-48 bg-gradient-to-br from-primary to-purple-900 rounded-[12px] shadow-2xl flex items-center justify-center">
                <i data-lucide="music-2" class="w-20 h-20 text-white"></i>
            </div>
            <div>
                <p class="text-xs font-bold uppercase tracking-widest text-white mb-2">Playlist</p>
                <h1 class="text-5xl font-bold text-white mb-4 tracking-tight">${title}</h1>
                <p class="text-text-muted text-sm">Curated just for you.</p>
            </div>
        </div>
        
        <div class="space-y-2 fade-in" id="playlist-tracks">
             <div class="col-span-full flex justify-center py-10"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
        </div>
        <div class="h-16"></div>
    `;
    initIcons();
    
    const tracks = await fetchMusic(query, 15);
    renderListGrid(tracks, 'playlist-tracks');
    initIcons();
}

// --- HELPER RENDERERS (Updated for Queue) ---

// Store rendered tracks in a temporary global map to retrieve them when clicked
let renderedContexts = {};

function renderTrackGrid(tracks, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Save tracks for queue
    renderedContexts[containerId] = tracks.map(t => ({
        id: t.trackId,
        title: t.trackName,
        artist: t.artistName,
        image: getHighResImage(t.artworkUrl100),
        previewUrl: t.previewUrl
    }));
    
    container.innerHTML = tracks.map((track, index) => {
        const trackData = JSON.stringify({
            id: track.trackId,
            title: track.trackName,
            artist: track.artistName,
            image: getHighResImage(track.artworkUrl100),
            previewUrl: track.previewUrl
        }).replace(/"/g, '&quot;');

        return `
        <div class="group cursor-pointer track-card flex flex-col" data-track="${trackData}" data-context="${containerId}" data-index="${index}">
          <div class="relative aspect-square rounded-[8px] overflow-hidden mb-4 shadow-card bg-[#2A2A2A]">
            <img src="${getHighResImage(track.artworkUrl100)}" alt="${track.trackName}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90 group-hover:opacity-100">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]">
              <button class="bg-primary text-white w-12 h-12 flex items-center justify-center rounded-full shadow-[0_0_20px_rgba(238,73,80,0.6)] transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:scale-110">
                <i data-lucide="play" class="w-5 h-5 fill-current ml-1"></i>
              </button>
            </div>
          </div>
          <div class="flex items-start justify-between gap-2 min-w-0">
            <div class="min-w-0 flex-1">
              <h3 class="text-white font-bold text-[15px] truncate hover:text-primary transition-colors leading-tight mb-1.5">${track.trackName}</h3>
              <p class="text-text-muted text-[13px] truncate hover:text-white transition-colors">${track.artistName}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    attachTrackListeners();
}

function renderCircleGrid(tracks, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    renderedContexts[containerId] = tracks.map(t => ({
        id: t.trackId,
        title: t.trackName,
        artist: t.artistName,
        image: getHighResImage(t.artworkUrl100),
        previewUrl: t.previewUrl
    }));
    
    container.innerHTML = tracks.map((track, index) => {
        const trackData = JSON.stringify({
            id: track.trackId,
            title: track.trackName,
            artist: track.artistName,
            image: getHighResImage(track.artworkUrl100),
            previewUrl: track.previewUrl
        }).replace(/"/g, '&quot;');

        return `
        <div class="flex flex-col items-center gap-3 min-w-[110px] cursor-pointer group track-card" data-track="${trackData}" data-context="${containerId}" data-index="${index}">
          <div class="w-[90px] h-[90px] rounded-full p-[3px] bg-gradient-to-br from-[#333] to-[#111] group-hover:from-primary group-hover:to-orange-500 transition-all duration-300 shadow-lg">
            <div class="w-full h-full rounded-full p-[3px] bg-background overflow-hidden">
              <img src="${track.artworkUrl100}" alt="${track.artistName}" class="w-full h-full rounded-full object-cover opacity-90 group-hover:opacity-100 transition-opacity">
            </div>
          </div>
          <div class="text-center w-full">
            <h3 class="text-white font-semibold text-[13px] truncate w-full leading-tight group-hover:text-primary transition-colors">${track.trackName}</h3>
            <p class="text-text-muted text-[11px] truncate w-full mt-1">${track.artistName}</p>
          </div>
        </div>
      `;
    }).join('');
    attachTrackListeners();
}

function renderListGrid(tracks, containerId, isFavoriteList = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    renderedContexts[containerId] = tracks.map(t => ({
        id: t.id || t.trackId,
        title: t.title || t.trackName,
        artist: t.artist || t.artistName,
        image: t.image || getHighResImage(t.artworkUrl100),
        previewUrl: t.previewUrl
    }));
    
    container.innerHTML = tracks.map((track, index) => {
        const trackData = JSON.stringify({
            id: track.id || track.trackId, 
            title: track.title || track.trackName,
            artist: track.artist || track.artistName,
            image: track.image || getHighResImage(track.artworkUrl100),
            previewUrl: track.previewUrl
        }).replace(/"/g, '&quot;');
        
        const t = JSON.parse(trackData.replace(/&quot;/g, '"'));
        const liked = isFavorite(t.id);

        return `
        <div class="flex items-center justify-between p-3 rounded-[8px] hover:bg-white/5 group transition-all duration-200 track-card cursor-pointer border border-transparent hover:border-white/5"
             data-track="${trackData}" data-context="${containerId}" data-index="${index}">
          <div class="flex items-center gap-5 flex-1">
            <div class="w-6 text-center">
                 <span class="text-text-dark font-bold text-[14px] group-hover:hidden">${index + 1}</span>
                 <button class="hidden group-hover:flex items-center justify-center text-primary"><i data-lucide="play" class="w-4 h-4 fill-current"></i></button>
            </div>
            
            <div class="w-14 h-14 rounded-[6px] overflow-hidden bg-[#2A2A2A] flex-shrink-0 shadow-md group-hover:shadow-glow transition-shadow">
              <img src="${t.image}" class="w-full h-full object-cover">
            </div>
            
            <div class="flex-1 min-w-0 ml-2">
              <h3 class="text-[15px] font-bold truncate text-white group-hover:text-primary transition-colors">${t.title}</h3>
              <p class="text-[13px] text-text-muted truncate mt-1">${t.artist}</p>
            </div>
          </div>

          <div class="hidden md:flex items-center gap-8 flex-1 justify-end text-[13px] text-text-muted font-medium">
            <span class="w-40 truncate text-right">${track.collectionName || 'Single'}</span>
          </div>

          <div class="flex items-center gap-6 ml-4 w-28 justify-end">
            <span class="text-[13px] text-text-muted font-medium">0:30</span>
            <div class="flex items-center gap-2 w-12 justify-end">
               <button class="like-btn text-text-muted hover:scale-110 transition-all ${liked ? 'text-primary' : 'hover:text-primary opacity-0 group-hover:opacity-100'}" onclick="event.stopPropagation();">
                 <i data-lucide="heart" class="w-4 h-4 ${liked ? 'fill-current' : ''}"></i>
               </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    container.querySelectorAll('.like-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('.track-card');
            const data = JSON.parse(card.dataset.track.replace(/&quot;/g, '"'));
            toggleFavorite(data);
            
            const icon = btn.querySelector('svg') || btn.querySelector('i');
            if (isFavorite(data.id)) {
                btn.classList.add('text-primary');
                btn.classList.remove('opacity-0'); 
                if(icon) {
                    icon.style.fill = "#EE4950";
                    icon.style.stroke = "#EE4950";
                }
            } else {
                btn.classList.remove('text-primary');
                if(!isFavoriteList) btn.classList.add('opacity-0');
                if(icon) {
                    icon.style.fill = "none";
                    icon.style.stroke = "currentColor";
                }
            }
        });
    });
    
    attachTrackListeners();
}

function renderCategories(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = categories.map(item => `
        <div class="genre-action relative h-[90px] rounded-[8px] overflow-hidden cursor-pointer group shadow-card" data-query="${item.name}">
          <img src="${item.image}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-1">
          <div class="absolute inset-0 bg-gradient-to-r ${item.color} opacity-80 mix-blend-multiply transition-opacity group-hover:opacity-90"></div>
          <span class="absolute inset-0 flex items-center justify-center text-white font-bold text-[17px] drop-shadow-md tracking-wide z-10 group-hover:scale-105 transition-transform">${item.name}</span>
        </div>
      `).join('');
    }
}

// --- NAVIGATION LOGIC (Updated for Mobile Menu) ---

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const playlistLinks = document.querySelectorAll('.playlist-link');
    const searchInput = document.getElementById('search-input');
    const addPlaylistBtn = document.getElementById('add-playlist-btn');
    
    // Mobile Menu Logic
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');

    const toggleSidebar = (show) => {
        if (show) {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden', 'opacity-0');
            overlay.classList.add('block', 'opacity-100');
        } else {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.remove('block', 'opacity-100');
            overlay.classList.add('hidden', 'opacity-0');
        }
    };

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => toggleSidebar(true));
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
    if (overlay) overlay.addEventListener('click', () => toggleSidebar(false));

    // Add Playlist
    if (addPlaylistBtn) {
        // Remove old listeners to prevent duplicates if called multiple times
        const newBtn = addPlaylistBtn.cloneNode(true);
        addPlaylistBtn.parentNode.replaceChild(newBtn, addPlaylistBtn);
        newBtn.addEventListener('click', createPlaylist);
    }

    // Main Nav
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSidebar(false); // Close mobile menu on click
            
            navLinks.forEach(l => {
                l.classList.remove('active-nav', 'bg-primary', 'text-white', 'shadow-glow');
                l.classList.add('text-text-muted');
            });
            
            link.classList.add('active-nav', 'bg-primary', 'text-white', 'shadow-glow');
            link.classList.remove('text-text-muted');
            
            const id = link.id;
            if (id === 'nav-home') renderHomePage();
            if (id === 'nav-browse') renderBrowsePage();
            if (id === 'nav-favorite') renderFavoritesPage();
            if (id === 'nav-library') renderLibraryPage();
        });
    });

    // Playlist Nav
    playlistLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSidebar(false); // Close mobile menu
            
            const query = link.dataset.query;
            const titleElement = link.querySelector('span');
            // Fix for user playlists which are direct text inside 'a' sometimes
            let title = titleElement ? titleElement.textContent : link.innerText;
            
            // Clean up title if it has icon text
            if (link.dataset.isUser) {
                title = link.innerText.trim(); 
            }

            navLinks.forEach(l => l.classList.remove('active-nav', 'bg-primary', 'text-white', 'shadow-glow'));
            renderPlaylistPage(query, title);
        });
    });

    if(searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const term = searchInput.value;
                if(term) renderPlaylistPage(term, `Search: ${term}`);
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        const genreBtn = e.target.closest('.genre-action');
        if (genreBtn) {
            const query = genreBtn.dataset.query;
            if (query) {
                 navLinks.forEach(l => l.classList.remove('active-nav', 'bg-primary', 'text-white', 'shadow-glow'));
                 renderPlaylistPage(query, `${query} Mix`);
            }
        }
    });
}

// --- PLAYER LOGIC (Updated for Queue & Shuffle/Repeat) ---

function attachTrackListeners() {
  document.querySelectorAll('.track-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if(e.target.closest('.like-btn')) return;
      
      const data = JSON.parse(card.dataset.track.replace(/&quot;/g, '"'));
      const contextId = card.dataset.context;
      const index = parseInt(card.dataset.index);
      
      // Update Queue
      if (contextId && renderedContexts[contextId]) {
          currentQueue = renderedContexts[contextId];
          currentQueueIndex = index;
      } else {
          // Fallback if no context (shouldn't happen with new renderers)
          currentQueue = [data];
          currentQueueIndex = 0;
      }

      playTrack(data.previewUrl, data);
    });
  });
}

function playTrack(url, metadata) {
  if (!url) return;

  addToRecentlyPlayed(metadata);

  if (currentTrackUrl === url) {
    togglePlay();
    return;
  }

  currentAudio.src = url;
  currentTrackUrl = url;
  currentTrackMetadata = metadata; 
  
  if(playerImage) playerImage.src = metadata.image;
  if(playerTitle) playerTitle.textContent = metadata.title;
  if(playerArtist) playerArtist.textContent = metadata.artist;
  
  updatePlayerLikeBtn(metadata.id);

  currentAudio.play().catch(err => {
    if (err.name !== 'AbortError') console.error('Playback error:', err);
  });
  
  isPlaying = true;
  updatePlayButton();
}

function togglePlay() {
  if (!currentTrackUrl) {
      // Try to play first track in queue or page
      const firstTrackCard = document.querySelector('.track-card');
      if (firstTrackCard) firstTrackCard.click();
      return;
  }

  if (isPlaying) {
    currentAudio.pause();
  } else {
    currentAudio.play().catch(err => {
      if (err.name !== 'AbortError') console.error('Playback error:', err);
    });
  }
  isPlaying = !isPlaying;
  updatePlayButton();
}

// SKIP LOGIC
function playNext() {
    if (isRepeat) {
        // If repeat is on, just replay current
        currentAudio.currentTime = 0;
        currentAudio.play().catch(() => {});
        return;
    }

    if (isShuffle && currentQueue.length > 1) {
        // Pick random index
        let nextIndex = Math.floor(Math.random() * currentQueue.length);
        // Avoid playing same song if possible
        if (nextIndex === currentQueueIndex) {
            nextIndex = (nextIndex + 1) % currentQueue.length;
        }
        currentQueueIndex = nextIndex;
        const nextTrack = currentQueue[currentQueueIndex];
        playTrack(nextTrack.previewUrl, nextTrack);
        return;
    }

    if (currentQueue.length > 0 && currentQueueIndex < currentQueue.length - 1) {
        currentQueueIndex++;
        const nextTrack = currentQueue[currentQueueIndex];
        playTrack(nextTrack.previewUrl, nextTrack);
    } else {
        // Loop back to start
        if (currentQueue.length > 0) {
            currentQueueIndex = 0;
            const nextTrack = currentQueue[0];
            playTrack(nextTrack.previewUrl, nextTrack);
        }
    }
}

function playPrev() {
    if (currentAudio.currentTime > 3) {
        currentAudio.currentTime = 0;
        return;
    }

    if (isShuffle && currentQueue.length > 1) {
         // For shuffle, prev usually just goes back in history, but for simplicity, let's just pick random again or go back in array
         let prevIndex = Math.floor(Math.random() * currentQueue.length);
         currentQueueIndex = prevIndex;
         const prevTrack = currentQueue[currentQueueIndex];
         playTrack(prevTrack.previewUrl, prevTrack);
         return;
    }

    if (currentQueue.length > 0 && currentQueueIndex > 0) {
        currentQueueIndex--;
        const prevTrack = currentQueue[currentQueueIndex];
        playTrack(prevTrack.previewUrl, prevTrack);
    } else {
        if (currentQueue.length > 0) {
             // Go to last
             currentQueueIndex = currentQueue.length - 1;
             const prevTrack = currentQueue[currentQueueIndex];
             playTrack(prevTrack.previewUrl, prevTrack);
        }
    }
}

function updatePlayButton() {
  const btn = document.getElementById('main-play-btn');
  if (!btn) return;
  
  btn.innerHTML = '';
  
  if (isPlaying) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'pause');
    icon.className = "w-5 h-5 fill-current ml-0.5";
    btn.appendChild(icon);
  } else {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'play');
    icon.className = "w-5 h-5 fill-current ml-1";
    btn.appendChild(icon);
  }
  initIcons();
}

// SHUFFLE & REPEAT LOGIC
function toggleShuffle() {
    isShuffle = !isShuffle;
    if(shuffleBtn) {
        if(isShuffle) {
            shuffleBtn.classList.add('text-primary');
            shuffleBtn.classList.remove('text-text-muted');
        } else {
            shuffleBtn.classList.remove('text-primary');
            shuffleBtn.classList.add('text-text-muted');
        }
    }
}

function toggleRepeat() {
    isRepeat = !isRepeat;
    if(repeatBtn) {
        if(isRepeat) {
            repeatBtn.classList.add('text-primary');
            repeatBtn.classList.remove('text-text-muted');
        } else {
            repeatBtn.classList.remove('text-primary');
            repeatBtn.classList.add('text-text-muted');
        }
    }
}

if(shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);
if(repeatBtn) repeatBtn.addEventListener('click', toggleRepeat);


const mainPlayBtn = document.getElementById('main-play-btn');
if (mainPlayBtn) mainPlayBtn.addEventListener('click', togglePlay);

// Attach Skip Listeners
const skipForwardBtn = document.getElementById('skip-forward-btn');
const skipBackBtn = document.getElementById('skip-back-btn');
if (skipForwardBtn) skipForwardBtn.addEventListener('click', playNext);
if (skipBackBtn) skipBackBtn.addEventListener('click', playPrev);


if(playerLikeBtn) {
    playerLikeBtn.addEventListener('click', () => {
        if (currentTrackMetadata) {
            toggleFavorite(currentTrackMetadata);
        }
    });
}

// Progress Bar Logic
currentAudio.addEventListener('timeupdate', () => {
  if (currentAudio.duration) {
    const percent = (currentAudio.currentTime / currentAudio.duration) * 100;
    // Update all progress bars (desktop & mobile)
    progressFills.forEach(fill => {
        fill.style.width = `${percent}%`;
    });
    
    if(currentTimeEl) currentTimeEl.textContent = formatTime(currentAudio.currentTime);
    if(durationEl) durationEl.textContent = formatTime(currentAudio.duration);
  }
});

currentAudio.addEventListener('ended', () => {
  // Auto play next
  playNext();
});

// Volume Logic
if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        currentAudio.volume = value;
        
        const currentIcon = document.getElementById('volume-icon');
        
        if (currentIcon && currentIcon.parentNode) {
            let iconName = 'volume-2';
            if(value == 0) iconName = 'volume-x';
            else if(value < 0.5) iconName = 'volume-1';
            
            const newIcon = document.createElement('i');
            newIcon.setAttribute('data-lucide', iconName);
            newIcon.className = "w-5 h-5 text-text-muted group-hover:text-white transition-colors cursor-pointer";
            newIcon.id = 'volume-icon';
            
            currentIcon.parentNode.replaceChild(newIcon, currentIcon);
            initIcons();
        }
    });
}


function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Side bar right Top Streams
async function renderTopStreams() {
  const container = document.getElementById('top-streams-container');
  if (!container) return;

  const query = topStreamsMode === 'local' ? 'top hits UK' : 'top hits world';
  const tracks = await fetchMusic(query, topStreamsLimit);

  // Save to context for queue
  renderedContexts['top-streams-container'] = tracks.map(t => ({
        id: t.trackId,
        title: t.trackName,
        artist: t.artistName,
        image: getHighResImage(t.artworkUrl100),
        previewUrl: t.previewUrl
  }));

  container.innerHTML = tracks.map((track, index) => {
      const trackData = JSON.stringify({
            id: track.trackId,
            title: track.trackName,
            artist: track.artistName,
            image: getHighResImage(track.artworkUrl100),
            previewUrl: track.previewUrl
        }).replace(/"/g, '&quot;');
      
      return `
    <div class="flex items-center gap-4 p-2.5 rounded-[8px] hover:bg-white/5 group transition-all duration-200 cursor-pointer relative track-card border border-transparent hover:border-white/5"
         data-track="${trackData}" data-context="top-streams-container" data-index="${index}">
      <span class="text-text-dark text-[13px] font-bold w-4 text-center group-hover:text-primary transition-colors">${index + 1}</span>
      <div class="w-11 h-11 rounded-[6px] overflow-hidden flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
        <img src="${getHighResImage(track.artworkUrl100)}" class="w-full h-full object-cover">
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="text-white text-[14px] font-bold truncate group-hover:text-primary transition-colors leading-tight">${track.trackName}</h4>
        <p class="text-text-muted text-[12px] font-medium truncate mt-1">${track.artistName}</p>
      </div>
      
      <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
         <div class="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
            <i data-lucide="play" class="w-3 h-3 fill-white text-white"></i>
         </div>
      </div>
    </div>
  `}).join('');
  
  attachTrackListeners();
}

function setupTopStreamsToggle() {
    const btnLocal = document.getElementById('ts-local');
    const btnGlobal = document.getElementById('ts-global');
    const btnExpand = document.getElementById('expand-streams-btn');
    
    if (btnExpand) {
        // Remove old listener to prevent duplicates
        const newBtn = btnExpand.cloneNode(true);
        btnExpand.parentNode.replaceChild(newBtn, btnExpand);
        
        newBtn.addEventListener('click', () => {
            topStreamsLimit += 5; 
            renderTopStreams(); 
        });
    }
    
    if(!btnLocal || !btnGlobal) return;
    
    const toggle = (mode) => {
        topStreamsMode = mode;
        topStreamsLimit = 8; 
        if(mode === 'local') {
            btnLocal.classList.add('bg-primary', 'text-white', 'shadow-md');
            btnLocal.classList.remove('text-text-muted', 'hover:text-white');
            
            btnGlobal.classList.remove('bg-primary', 'text-white', 'shadow-md');
            btnGlobal.classList.add('text-text-muted', 'hover:text-white');
        } else {
            btnGlobal.classList.add('bg-primary', 'text-white', 'shadow-md');
            btnGlobal.classList.remove('text-text-muted', 'hover:text-white');
            
            btnLocal.classList.remove('bg-primary', 'text-white', 'shadow-md');
            btnLocal.classList.add('text-text-muted', 'hover:text-white');
        }
        renderTopStreams();
    };
    
    btnLocal.addEventListener('click', () => toggle('local'));
    btnGlobal.addEventListener('click', () => toggle('global'));
}

// --- INITIALIZATION ---
async function init() {
  renderSidebarPlaylists(); // This calls setupNavigation internally
  setupTopStreamsToggle();
  await renderHomePage();
  await renderTopStreams();
}

init();
