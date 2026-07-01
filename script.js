// Konfigurasi
const SOUNDS = [
    { name: 'Hujan Petir', file: 'hujan_petir.mp3', icon: 'fas fa-cloud-showers-heavy' },
    { name: 'Burung', file: 'burung.mp3', icon: 'fas fa-feather-alt' },
    { name: 'Angin', file: 'angin.mp3', icon: 'fas fa-wind' },
    { name: 'Air Mengalir', file: 'air.mp3', icon: 'fas fa-water' },
    { name: 'Api Unggun', file: 'api.mp3', icon: 'fas fa-fire' },
    { name: 'Kereta Api', file: 'kereta.mp3', icon: 'fas fa-train' },
    { name: 'Jangkrik', file: 'jangkrik.mp3', icon: 'fas fa-bug' },
    { name: 'Lonceng', file: 'lonceng.mp3', icon: 'fas fa-bell' }
];

const TIMER_DURATIONS = [0, 15, 30, 60, 90]; // 0=OFF, 15, 30, 60, 90 menit
const VOLUME_STEP_MASTER = 0.1; // Langkah perubahan 10%

// State aplikasi
const state = {
    audioElements: {},
    isPoweredOn: false,
    isPlaying: false,
    countdownTimer: null,
    durationIndex: 0,
    masterVolume: 0.5,
    zoomScale: 1.0
};

// Elemen DOM
const elements = {
    powerBtn: document.getElementById('power-btn'),
    volumeUpBtn: document.getElementById('volume-up-btn'),
    volumeDownBtn: document.getElementById('volume-down-btn'),
    durationCycleBtn: document.getElementById('duration-cycle-btn'),
    countdownDisplay: document.getElementById('countdown-display'),
    statusText: document.getElementById('status-text'),
    allSliders: document.querySelectorAll('.sound-slider'),
    lcdElement: document.querySelector('.lcd')
};

// --- KONTROL DRAG SLIDER KUSTOM ---

/**
 * Mengatur interaksi seret/geser sentuh (touch/drag) kustom untuk range slider
 */
function setupSliderDrag(slider) {
    let isDragging = false;

    function updateValueFromCoords(clientX, clientY) {
        const rect = slider.getBoundingClientRect();
        const isRotated = window.innerWidth <= 640 && window.innerHeight > window.innerWidth;
        
        let pct = 0;
        if (isRotated) {
            // Jika terputar (portrait mobile), slider terlihat horizontal di layar.
            // Ujung kiri adalah 0, ujung kanan adalah 100.
            pct = (clientX - rect.left) / rect.width;
        } else {
            // Jika normal (desktop/landscape), slider terlihat vertikal di layar.
            // Ujung bawah adalah 0, ujung atas adalah 100.
            pct = (rect.bottom - clientY) / rect.height;
        }
        
        pct = Math.max(0, Math.min(1, pct));
        const val = Math.round(pct * 100);
        slider.value = val;
        
        const soundFile = slider.getAttribute('data-sound-file');
        updateAudioVolume(soundFile, val);
        checkPlayingStatus();
    }

    slider.addEventListener('touchstart', (e) => {
        isDragging = true;
        const touch = e.touches[0];
        updateValueFromCoords(touch.clientX, touch.clientY);
        e.preventDefault();
    }, { passive: false });

    slider.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        updateValueFromCoords(touch.clientX, touch.clientY);
        e.preventDefault();
    }, { passive: false });

    slider.addEventListener('touchend', () => {
        isDragging = false;
    });

    slider.addEventListener('mousedown', (e) => {
        isDragging = true;
        updateValueFromCoords(e.clientX, e.clientY);
        
        function onMouseMove(moveEvent) {
            if (!isDragging) return;
            updateValueFromCoords(moveEvent.clientX, moveEvent.clientY);
        }
        
        function onMouseUp() {
            isDragging = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });
}

// --- FUNGSI UTAMA VOLUME DAN AUDIO ---

/**
 * Inisialisasi elemen audio dan event listeners
 */
function initSounds() {
    // Buat elemen Audio (hidden) dan petakan ke audioElements
    SOUNDS.forEach(sound => {
        const audio = new Audio(`./audio/${sound.file}`);
        audio.loop = true; 
        audio.volume = 0; 
        state.audioElements[sound.file] = audio;
    });

    // Tambahkan Event Listener ke semua slider statis
    elements.allSliders.forEach(slider => {
        slider.value = 0; // Volume awal 0
        slider.addEventListener('input', handleSliderChange);
        setupSliderDrag(slider);
    });

    // Inisialisasi tampilan timer
    updateTimerDisplay();
}

/**
 * Menghitung dan menerapkan volume akhir ke elemen audio
 */
function updateAudioVolume(soundFile, sliderPercent) {
    const volumeSlider = sliderPercent / 100;
    const finalVolume = volumeSlider * state.masterVolume; 
    state.audioElements[soundFile].volume = finalVolume;
}

/**
 * Menangani perubahan nilai slider volume (Volume Individual)
 */
function handleSliderChange(e) {
    const slider = e.target;
    const soundFile = slider.getAttribute('data-sound-file');
    const volumePercent = parseInt(slider.value);
    
    updateAudioVolume(soundFile, volumePercent);
    checkPlayingStatus();
}

/**
 * Memeriksa apakah ada audio yang dimainkan dan menyesuaikan status
 */
function checkPlayingStatus() {
    let activeSounds = 0;
    
    for (const file in state.audioElements) {
        if (state.audioElements[file].volume > 0.001) { 
            activeSounds++;
            if (state.audioElements[file].paused) {
                state.audioElements[file].play().catch(e => console.error("Error playing audio:", e));
            }
        } else {
            // Hanya pause jika power menyala. Jika power mati, pause akan ditangani oleh fadeOutAndStop.
            if (state.isPoweredOn) {
                state.audioElements[file].pause();
            }
        }
    }

    if (activeSounds > 0) {
        state.isPlaying = true;
        if (!elements.statusText.textContent.startsWith("VOL")) {
            elements.statusText.textContent = "PLAYING";
        }
    } else {
        state.isPlaying = false;
        if (!elements.statusText.textContent.startsWith("VOL")) {
            elements.statusText.textContent = state.isPoweredOn ? "READY" : "OFF";
        }
    }
}

// --- FUNGSI KONTROL PERANGKAT ---

/**
 * Mengaktifkan atau menonaktifkan semua kontrol
 */
function toggleControls(enable) {
    const allControls = [
        elements.volumeUpBtn, 
        elements.volumeDownBtn, 
        elements.durationCycleBtn, 
        ...elements.allSliders
    ];
    
    allControls.forEach(control => control.disabled = !enable);
}

/**
 * Memudarkan semua suara secara bertahap (fade-out) sebelum mematikan audio sepenuhnya
 */
function fadeOutAndStop() {
    const fadeDuration = 800; // ms
    const fadeInterval = 50; // ms
    const steps = fadeDuration / fadeInterval;
    
    // Simpan volume awal masing-masing audio
    const initialVolumes = {};
    for (const file in state.audioElements) {
        initialVolumes[file] = state.audioElements[file].volume;
    }
    
    let currentStep = 0;
    const intervalId = setInterval(() => {
        currentStep++;
        const ratio = 1 - (currentStep / steps);
        
        for (const file in state.audioElements) {
            if (initialVolumes[file] > 0) {
                state.audioElements[file].volume = Math.max(0, initialVolumes[file] * ratio);
            }
        }
        
        if (currentStep >= steps) {
            clearInterval(intervalId);
            // Matikan/pause semua audio dan set volume ke 0
            for (const file in state.audioElements) {
                state.audioElements[file].pause();
                state.audioElements[file].volume = 0;
            }
            // Reset semua volume slider ke 0 di UI
            elements.allSliders.forEach(slider => {
                slider.value = 0;
            });
            checkPlayingStatus();
        }
    }, fadeInterval);
}

/**
 * Tombol ON/OFF
 */
elements.powerBtn.addEventListener('click', () => {
    state.isPoweredOn = !state.isPoweredOn;
    
    if (state.isPoweredOn) {
        // ON
        elements.powerBtn.classList.add('on');
        elements.lcdElement.classList.add('active');
        elements.statusText.textContent = `VOL: ${Math.round(state.masterVolume * 100)}%`; 
        updateTimerDisplay();
        toggleControls(true);
    } else {
        // OFF
        elements.powerBtn.classList.remove('on');
        elements.lcdElement.classList.remove('active');
        
        // Matikan timer dan ubah UI langsung
        state.isPlaying = false;
        clearCountdown();
        elements.statusText.textContent = "OFF";
        elements.countdownDisplay.textContent = "00:00";
        toggleControls(false);

        // Mulai memudarkan suara
        fadeOutAndStop();
    }
});

// --- KONTROL VOLUME MASTER ---

/**
 * Mengatur semua volume audio berdasarkan perubahan masterVolume baru
 */
function setMasterVolume() {
    elements.allSliders.forEach(slider => {
        const soundFile = slider.getAttribute('data-sound-file');
        const sliderPercent = parseInt(slider.value);
        updateAudioVolume(soundFile, sliderPercent);
    });

    elements.statusText.textContent = `VOL: ${Math.round(state.masterVolume * 100)}%`; 
    checkPlayingStatus(); 
    
    setTimeout(() => {
        if (state.isPoweredOn && elements.statusText.textContent.startsWith("VOL")) {
            elements.statusText.textContent = state.isPlaying ? "PLAYING" : "READY";
        }
    }, 1500);
}

function adjustMasterVolume(delta) {
    if (!state.isPoweredOn) return;

    state.masterVolume += delta;
    state.masterVolume = Math.max(0, Math.min(1, state.masterVolume));
    setMasterVolume();
}

elements.volumeUpBtn.addEventListener('click', () => {
    adjustMasterVolume(VOLUME_STEP_MASTER);
});

elements.volumeDownBtn.addEventListener('click', () => {
    adjustMasterVolume(-VOLUME_STEP_MASTER);
});

// --- COUNTDOWN/TIMER ---

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateTimerDisplay() {
    const currentDuration = TIMER_DURATIONS[state.durationIndex];
    elements.countdownDisplay.textContent = formatTime(currentDuration * 60);
    elements.statusText.textContent = currentDuration === 0 ? "TIMER OFF" : `${currentDuration} MIN`;
    
    if (state.isPoweredOn && !state.isPlaying) {
        setTimeout(() => {
            if (elements.statusText.textContent.includes("MIN") || elements.statusText.textContent.includes("TIMER")) {
                 elements.statusText.textContent = "READY";
            }
        }, 1500);
    }
}

function clearCountdown() {
    clearInterval(state.countdownTimer);
    updateTimerDisplay();
}

function startCountdown(minutes) {
    clearInterval(state.countdownTimer);
    let totalSeconds = minutes * 60;
    
    elements.countdownDisplay.textContent = formatTime(totalSeconds);
    
    state.countdownTimer = setInterval(() => {
        totalSeconds--;
        elements.countdownDisplay.textContent = formatTime(totalSeconds);
        
        if (totalSeconds <= 0) {
            clearInterval(state.countdownTimer);
            elements.powerBtn.click();
        }
    }, 1000);
}

elements.durationCycleBtn.addEventListener('click', () => {
    if (!state.isPoweredOn) return;
    
    state.durationIndex = (state.durationIndex + 1) % TIMER_DURATIONS.length;
    clearInterval(state.countdownTimer);
    updateTimerDisplay();
    
    const currentDuration = TIMER_DURATIONS[state.durationIndex];
    if (currentDuration > 0 && state.isPlaying) {
        startCountdown(currentDuration);
    }
});

// --- KONTROL ZOOM (MOBILE PORTRAIT) ---

function getInitialScale() {
    if (window.innerWidth <= 640 && window.innerHeight > window.innerWidth) {
        if (window.innerHeight <= 520) return 0.70;
        if (window.innerHeight <= 640) return 0.85;
    }
    return 1.0;
}

function applyZoom() {
    const device = document.querySelector('.device');
    if (device) {
        if (window.innerWidth <= 640 && window.innerHeight > window.innerWidth) {
            device.style.transform = `translate(-50%, -50%) rotate(90deg) scale(${state.zoomScale})`;
        } else {
            device.style.transform = '';
        }
    }
}

function initZoom() {
    state.zoomScale = getInitialScale();
    applyZoom();
}

// --- INISIALISASI APLIKASI ---
function initApp() {
    initSounds();
    toggleControls(false);
    initZoom();
    
    // Bind zoom button actions and resize handler
    window.addEventListener('resize', initZoom);

    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomInBtn && zoomOutBtn) {
        zoomInBtn.addEventListener('click', () => {
            state.zoomScale = Math.min(1.5, state.zoomScale + 0.05);
            applyZoom();
        });
        zoomOutBtn.addEventListener('click', () => {
            state.zoomScale = Math.max(0.4, state.zoomScale - 0.05);
            applyZoom();
        });
    }
}

// Jalankan aplikasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', initApp);