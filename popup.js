document.addEventListener('DOMContentLoaded', async () => {
    const notesContainer = document.getElementById('notes-container');
    const exportBtn = document.getElementById('export-btn');
    const clearBtn = document.getElementById('clear-btn');

    let currentVideoId = null;

    // Helper: Get active tab's video ID
    async function getVideoId() {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) return null;

        const url = new URL(tabs[0].url);
        const params = new URLSearchParams(url.search);
        return params.get('v');
    }

    // Format seconds to MM:SS or HH:MM:SS
    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m.toString().padStart(2, '0') }:${s.toString().padStart(2, '0')}`;
    }

    // Load notes
    async function loadNotes() {
        currentVideoId = await getVideoId();
        if (!currentVideoId) {
            notesContainer.innerHTML = '<div class="empty-state">Open a YouTube video to see notes.</div>';
            return;
        }

        const data = await chrome.storage.local.get(currentVideoId);
        const notes = data[currentVideoId] || [];

        renderNotes(notes);
    }

    // Render notes list
    function renderNotes(notes) {
        notesContainer.innerHTML = '';

        if (notes.length === 0) {
            notesContainer.innerHTML = '<div class="empty-state">No notes for this video.</div>';
            return;
        }

        // Sort by timestamp
        notes.sort((a, b) => a.timestamp - b.timestamp);

        notes.forEach((note, index) => {
            const noteEl = document.createElement('div');
            noteEl.className = 'note-item';

            noteEl.innerHTML = `
        <div class="note-header">
          <span class="timestamp" data-time="${note.timestamp}">${formatTime(note.timestamp)}</span>
          <button class="delete-btn" data-index="${index}" title="Delete note">×</button>
        </div>
        <div class="note-text">${escapeHtml(note.text)}</div>
      `;

            notesContainer.appendChild(noteEl);
        });

        // Add event listeners for dynamic elements
        document.querySelectorAll('.timestamp').forEach(el => {
            el.addEventListener('click', (e) => {
                const time = parseFloat(e.target.dataset.time);
                seekTo(time);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(el => {
            el.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                deleteNote(index);
            });
        });
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Seek video
    function seekTo(seconds) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'seek', timestamp: seconds });
            }
        });
    }

    // Delete note
    async function deleteNote(index) {
        if (!currentVideoId) return;

        const data = await chrome.storage.local.get(currentVideoId);
        let notes = data[currentVideoId] || [];

        notes.splice(index, 1);

        await chrome.storage.local.set({ [currentVideoId]: notes });
        loadNotes();
    }

    // Export notes
    // exportBtn.addEventListener('click', async () => {
    //     if (!currentVideoId) return;

    //     const data = await chrome.storage.local.get(currentVideoId);
    //     const notes = data[currentVideoId] || [];

    //     if (notes.length === 0) return;

    //     let content = `Notes for Video ID: ${currentVideoId}\n\n`;
    //     notes.forEach(note => {
    //         content += `[${formatTime(note.timestamp)}] ${note.text}\n`;
    //     });

    //     const blob = new Blob([content], { type: 'text/plain' });
    //     const url = URL.createObjectURL(blob);

    //     chrome.downloads.download({
    //         url: url,
    //         filename: `youtube-notes-${currentVideoId}.txt`
    //     });
    // });

    // Clear all
    clearBtn.addEventListener('click', async () => {
        if (!currentVideoId) return;
        if (confirm('Are you sure you want to delete all notes for this video?')) {
            await chrome.storage.local.remove(currentVideoId);
            loadNotes();
        }
    });

    // Initial load
    loadNotes();
});
