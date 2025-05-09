// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getCurrentTime') {
        const video = document.querySelector('video');
        if (video) {
            sendResponse({ currentTime: Math.floor(video.currentTime) });
        } else {
            sendResponse({ currentTime: 0 });
        }
        return;
    } else if (request.action === 'seekTo') {
        const video = document.querySelector('video');
        if (video) {
            video.currentTime = request.time;
            video.play();
        }
        return;
    } else if (request.action === 'updateBadge' && request.videoId) {
        chrome.storage.local.get('bookmarks', (result) => {
            const bookmarks = result.bookmarks || [];
            const count = bookmarks.filter(b => b.videoId === request.videoId).length;
            if (count > 0) {
                chrome.action.setBadgeText({ text: count.toString() });
                chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
            } else {
                chrome.action.setBadgeText({ text: '' });
            }
        });
    }
});

// Create and inject the bookmark button
function createBookmarkButton() {
    // Create the button container
    const container = document.createElement('div');
    container.className = 'ytp-button-container';
    container.style.cssText = `
        display: inline-block;
        vertical-align: top;
        height: 48px;
        width: 48px;
        margin: 0;
        padding: 0;
        position: relative;
    `;

    // Create the button
    const button = document.createElement('button');
    button.id = 'yt-bookmark-btn';
    button.className = 'ytp-button';
    button.title = 'Add Bookmark';
    button.style.cssText = `
        width: 100%;
        height: 100%;
        padding: 0;
        margin: 0;
        background: none;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    `;

    // Create the icon
    const icon = document.createElement('div');
    icon.className = 'ytp-bookmark-icon';
    icon.style.cssText = `
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #FF0000;
    `;
    icon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M6 4a2 2 0 0 0-2 2v16l8-5.333L20 22V6a2 2 0 0 0-2-2H6z"/>
        </svg>
    `;
    button.appendChild(icon);
    container.appendChild(button);
    return container;
}

// Inject the bookmark button into YouTube's controls
function injectBookmarkButton() {
    // Remove existing button if present
    const existingBtn = document.getElementById('yt-bookmark-btn');
    if (existingBtn) {
        existingBtn.closest('.ytp-button-container')?.remove();
    }

    // Find the right controls container
    const rightControls = document.querySelector('.ytp-right-controls');
    if (!rightControls) return;

    // Create and insert the bookmark button as the first child (left-most)
    const bookmarkButton = createBookmarkButton();
    rightControls.insertBefore(bookmarkButton, rightControls.firstChild);

    // Add click handler
    const btn = bookmarkButton.querySelector('#yt-bookmark-btn');
    btn.addEventListener('click', showBookmarkDialog);
}

// Show the bookmark dialog
function showBookmarkDialog() {
    // Remove existing dialog and overlay if present
    const existingDialog = document.getElementById('yt-bookmark-dialog');
    if (existingDialog) existingDialog.remove();
    const existingOverlay = document.getElementById('yt-bookmark-overlay');
    if (existingOverlay) existingOverlay.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'yt-bookmark-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9998;
    `;
    document.body.appendChild(overlay);

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.id = 'yt-bookmark-dialog';
    dialog.style.cssText = `
        position: fixed;
        background: #282828;
        border-radius: 12px;
        padding: 24px;
        width: 340px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        z-index: 9999;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        box-sizing: border-box;
    `;

    dialog.innerHTML = `
        <div style="margin-bottom: 20px; display: flex; flex-direction: column; gap: 16px; width: 100%; box-sizing: border-box;">
            <div style="width: 100%; box-sizing: border-box;">
                <input type="text" id="yt-bookmark-name" placeholder="Enter bookmark name" style="
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #404040;
                    border-radius: 8px;
                    background: #181818;
                    color: #fff;
                    font-size: 15px;
                    outline: none;
                    transition: all 0.2s ease;
                    box-sizing: border-box;
                ">
            </div>
            <div style="font-size: 13px; color: #aaa; padding: 0 4px;">
                Current time: ${formatTime(document.querySelector('video')?.currentTime || 0)}
            </div>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end; border-top: 1px solid #404040; padding-top: 20px; margin-top: 12px; width: 100%; box-sizing: border-box;">
            <button id="yt-bookmark-cancel" style="
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                background: #404040;
                color: #fff;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                min-width: 90px;
            ">Cancel</button>
            <button id="yt-bookmark-save" style="
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                background: #FF0000;
                color: #fff;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                min-width: 90px;
            ">Save</button>
        </div>
    `;

    document.body.appendChild(dialog);

    const input = dialog.querySelector('#yt-bookmark-name');
    input.focus();

    const saveBookmark = () => {
        const name = input.value.trim();
        if (!name) {
            input.style.border = '1px solid #FF0000';
            return;
        }
        const video = document.querySelector('video');
        const url = window.location.href;
        const videoId = new URLSearchParams(window.location.search).get('v');
        const title = document.title.replace(' - YouTube', '');
        const timestamp = Math.floor(video.currentTime);

        const bookmark = {
            name,
            timestamp,
            videoId,
            videoTitle: title,
            videoUrl: url,
            created: Date.now()
        };

        chrome.storage.local.get('bookmarks', (result) => {
            const bookmarks = result.bookmarks || [];
            bookmarks.push(bookmark);
            chrome.storage.local.set({ bookmarks }, () => {
                dialog.remove();
                overlay.remove();
                showToast('Bookmark saved!');
                chrome.runtime.sendMessage({ action: 'updateBadge', videoId });
            });
        });
    };

    dialog.querySelector('#yt-bookmark-save').addEventListener('click', saveBookmark);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveBookmark();
        }
    });
    dialog.querySelector('#yt-bookmark-cancel').addEventListener('click', () => {
        dialog.remove();
        overlay.remove();
    });

    // Close on overlay click
    overlay.addEventListener('click', () => {
        dialog.remove();
        overlay.remove();
    });

    // Handle escape key
    function escHandler(e) {
        if (e.key === 'Escape') {
            dialog.remove();
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    }
    document.addEventListener('keydown', escHandler);
}

// Show a toast message
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #282828;
        color: #4CAF50;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 9999;
        font-size: 14px;
        font-weight: 500;
        animation: fadeInOut 2s ease-in-out;
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -20px); }
            15% { opacity: 1; transform: translate(-50%, 0); }
            85% { opacity: 1; transform: translate(-50%, 0); }
            100% { opacity: 0; transform: translate(-50%, -20px); }
        }
    `;
    document.head.appendChild(style);

    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
        style.remove();
    }, 2000);
}

// Helper function to format time
function formatTime(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 8);
}

// Initialize the extension
function initialize() {
    // Initial injection
    injectBookmarkButton();

    // Observe for YouTube's player changes
    const observer = new MutationObserver(() => {
        if (!document.getElementById('yt-bookmark-btn')) {
            injectBookmarkButton();
        }
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Start the extension
initialize(); 