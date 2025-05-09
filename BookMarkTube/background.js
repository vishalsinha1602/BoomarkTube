// Background script to handle extension initialization and badge updates
chrome.runtime.onInstalled.addListener(() => {
    // Initialize empty bookmarks array in storage if not present
    chrome.storage.local.get('bookmarks', (result) => {
        if (!result.bookmarks) {
            chrome.storage.local.set({ bookmarks: [] });
        }
    });
});

function updateBadgeForTab(tabId, url) {
    if (!url || !url.includes('youtube.com/watch')) {
        chrome.action.setBadgeText({ text: '', tabId });
        return;
    }
    const videoId = new URLSearchParams(new URL(url).search).get('v');
    chrome.storage.local.get('bookmarks', (result) => {
        const bookmarks = result.bookmarks || [];
        const count = bookmarks.filter(b => b.videoId === videoId).length;
        if (count > 0) {
            chrome.action.setBadgeText({ text: count.toString(), tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#FF0000', tabId });
        } else {
            chrome.action.setBadgeText({ text: '', tabId });
        }
    });
}

// When the active tab changes
chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, tab => {
        updateBadgeForTab(tab.id, tab.url);
    });
});

// When the URL of a tab changes (navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        updateBadgeForTab(tabId, changeInfo.url);
    }
});

// Also update badge on message (for real-time add/delete)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateBadge' && request.videoId) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
                updateBadgeForTab(tab.id, tab.url);
            }
        });
    }
}); 