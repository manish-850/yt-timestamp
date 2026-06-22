// content.js
console.log("YouTube Timestamp Notes Extension Loaded");

let currentVideoId = null;

// --- DOM Helper Functions ---

function getVideoElement() {
    return document.querySelector('video.html5-main-video');
}

function getControlsBar() {
    return document.querySelectorAll('.ytp-right-controls')[0];
}

function getCurrentVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
}

// --- Injection Logic ---

function createAddNoteButton() {
    if (document.getElementById('yt-notes-add-btn')) return null;

    const btn = document.createElement('button');
    btn.id = 'yt-notes-add-btn';
    btn.className = 'ytp-button';
    btn.title = "Press Ctrl + N to add Note";
    btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 1V4H1V6H4V9H6V6H9V4H6V1H4ZM11 5C11 8.31371 8.31371 11 5 11C4.29873 11 3.62556 10.8797 3 10.6586V20.0066C3 20.5551 3.44694 21 3.99826 21H14V15C14 14.45 14.45 14 15 14H21V3.9985C21 3.44749 20.5552 3 20.0066 3H10.6586C10.8797 3.62556 11 4.29873 11 5ZM21 16L16 20.997V16H21Z"></path></svg>`;
    btn.addEventListener('click', showAddNoteModal);

    document.addEventListener('keydown', (e) => {
        if (
            e.target.tagName === "INPUT" ||
            e.target.tagName === "TEXTAREA"
        ) return;
        if (e.ctrlKey && (e.key === "q" || e.key === "Q")) {
            btn.click();
            document.getElementById('yt-notes-text').focus();
            setTimeout(() => {
                document.getElementById('yt-notes-text').value = "";
            }, 10);
        }
    });
    return btn;
}

function injectButton() {
    const controls = getControlsBar();
    if (controls && !document.getElementById('yt-notes-add-btn')) {
        const btn = createAddNoteButton();
        controls.prepend(btn);
    }
}

// --- Navigation Handling ---

// Observer to handle dynamic loading (SPA)
const observer = new MutationObserver((mutations) => {
    if (window.location.href.includes('/watch')) {
        // Re-inject if missing
        injectButton();

        const newVideoId = getCurrentVideoId();
        if (newVideoId !== currentVideoId) {
            currentVideoId = newVideoId;
            console.log("Video changed to:", currentVideoId);
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial check
if (window.location.href.includes('/watch')) {
    currentVideoId = getCurrentVideoId();
    // Attempt inject immediately and also retrying shortly if DOM isn't ready
    injectButton();
    setTimeout(injectButton, 1000);
    setTimeout(injectButton, 3000);
}


// --- Modal & Note Logic ---

function showAddNoteModal() {
    const video = getVideoElement();
    if (!video) return;

    // Pause video
    video.pause();
    const timestamp = video.currentTime;

    // Create Modal
    const overlay = document.createElement('div');
    overlay.className = 'yt-notes-modal-overlay';

    overlay.innerHTML = `
    <div class="yt-notes-modal">
      <h2>Add Note at ${formatTime(timestamp)}</h2>
      <textarea id="yt-notes-text" placeholder="Enter your note here..." autofocus></textarea>
      <div class="yt-notes-actions">
        <button class="yt-notes-btn yt-notes-btn-cancel" id="yt-notes-cancel">Cancel</button>
        <button class="yt-notes-btn yt-notes-btn-save" id="yt-notes-save">Save Note</button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('#yt-notes-text');
    const saveBtn = overlay.querySelector('#yt-notes-save');
    const cancelBtn = overlay.querySelector('#yt-notes-cancel');

    input.focus();

    // Handlers
    const close = () => {
        document.body.removeChild(overlay);
        video.play(); // Auto resume? Maybe user prefers to stay paused. Let's stay paused for now or user can resume.
        // Actually, usually you want to resume if you just added a quick note. 
        // But if editing was long, maybe not. Let's keep it paused to be safe.
    };

    cancelBtn.addEventListener('click', close);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    saveBtn.addEventListener('click', async () => {
        const text = input.value.trim();
        if (text) {
            await saveNote(text, timestamp);
            showToast('Note Saved');
        }
        close();
    });

    // Ctrl+Enter to save
    input.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            saveBtn.click();
        }
    });
}

async function saveNote(text, timestamp) {
    if (!currentVideoId) return;

    const data = await chrome.storage.local.get(currentVideoId);
    const notes = data[currentVideoId] || [];

    notes.push({
        text: text,
        timestamp: timestamp,
        date: new Date().toISOString()
    });

    await chrome.storage.local.set({ [currentVideoId]: notes });
}

// --- Utils ---

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'yt-notes-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

// --- Message Listener (Seek) ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'seek') {
        const video = getVideoElement();
        if (video) {
            video.currentTime = request.timestamp;
            video.play();
        }
    }
});
