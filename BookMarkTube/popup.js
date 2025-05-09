let currentVideo = null;

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    if (currentTab.url && currentTab.url.includes('youtube.com/watch')) {
        let rawTitle = currentTab.title.replace(' - YouTube', '');
        // Remove leading (number) or (number) from the title
        let cleanTitle = rawTitle.replace(/^\(\d+\)\s*/, '');
        currentVideo = {
            id: new URLSearchParams(new URL(currentTab.url).search).get('v'),
            url: currentTab.url,
            title: cleanTitle
        };

        document.getElementById('current-video').textContent = currentVideo.title;
        loadBookmarks();
    } else {
        document.getElementById('current-video').textContent = 'Not a YouTube video page';
    }
});

// Load bookmarks for current video
async function loadBookmarks() {
    const bookmarks = await getBookmarks();
    const currentVideoBookmarks = bookmarks.filter(b => b.videoId === currentVideo.id);
    const bookmarksList = document.getElementById('bookmarks-list');
    const noBookmarks = document.getElementById('no-bookmarks');

    bookmarksList.innerHTML = '';

    // Update the extension badge
    updateExtensionBadge(currentVideo.id);

    if (currentVideoBookmarks.length === 0) {
        noBookmarks.style.display = 'block';
        return;
    }

    noBookmarks.style.display = 'none';
    currentVideoBookmarks.forEach(bookmark => {
        const bookmarkElement = createBookmarkElement(bookmark);
        bookmarksList.appendChild(bookmarkElement);
    });
}

// Create bookmark element
function createBookmarkElement(bookmark) {
    const div = document.createElement('div');
    div.className = 'bookmark-item';
    div.innerHTML = `
        <div class="bookmark-info">
            <div class="bookmark-name">${bookmark.name}</div>
            <div class="bookmark-timestamp">
                <span class="material-icons" style="font-size: 16px;">schedule</span>
                ${formatTime(bookmark.timestamp)}
            </div>
        </div>
        <div class="bookmark-actions">
            <button class="play-bookmark" title="Play">
                <span class="material-icons">play_arrow</span>
            </button>
            <button class="edit-bookmark" title="Edit">
                <span class="material-icons">edit</span>
            </button>
            <button class="delete-bookmark" title="Delete">
                <span class="material-icons">delete</span>
            </button>
        </div>
    `;

    // Play button click handler
    div.querySelector('.play-bookmark').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, {
            action: 'seekTo',
            time: bookmark.timestamp
        });
    });

    // Edit button click handler
    div.querySelector('.edit-bookmark').addEventListener('click', () => {
        const bookmarkInfo = div.querySelector('.bookmark-info');
        const oldName = bookmark.name;
        
        bookmarkInfo.innerHTML = `
            <input type="text" class="edit-name" value="${oldName}" style="
                width: 100%;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                margin-bottom: 4px;
                font-size: 14px;
            ">
            <div class="bookmark-timestamp">
                <span class="material-icons" style="font-size: 16px;">schedule</span>
                ${formatTime(bookmark.timestamp)}
            </div>
        `;

        const input = bookmarkInfo.querySelector('.edit-name');
        input.focus();
        
        input.addEventListener('keyup', async (e) => {
            if (e.key === 'Enter') {
                const newName = input.value.trim();
                if (newName && newName !== oldName) {
                    const bookmarks = await getBookmarks();
                    const index = bookmarks.findIndex(b => 
                        b.videoId === bookmark.videoId && 
                        b.timestamp === bookmark.timestamp &&
                        b.name === oldName
                    );
                    
                    if (index !== -1) {
                        bookmarks[index].name = newName;
                        await chrome.storage.local.set({ bookmarks });
                        loadBookmarks();
                        updateExtensionBadge(bookmark.videoId);
                    }
                } else {
                    loadBookmarks();
                }
            }
        });
    });

    // Delete button click handler
    div.querySelector('.delete-bookmark').addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this bookmark?')) {
            const bookmarks = await getBookmarks();
            const updatedBookmarks = bookmarks.filter(b => 
                !(b.videoId === bookmark.videoId && 
                  b.timestamp === bookmark.timestamp &&
                  b.name === bookmark.name)
            );
            await chrome.storage.local.set({ bookmarks: updatedBookmarks });
            loadBookmarks();
            updateExtensionBadge(bookmark.videoId);
        }
    });

    return div;
}

// Helper function to get bookmarks from storage
async function getBookmarks() {
    const result = await chrome.storage.local.get('bookmarks');
    return result.bookmarks || [];
}

// Helper function to format time
function formatTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 8);
}

// Add this function to set the badge on the extension icon
async function updateExtensionBadge(videoId) {
    chrome.runtime.sendMessage({ action: 'updateBadge', videoId });
}
