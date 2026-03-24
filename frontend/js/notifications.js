// Notification functionality

document.addEventListener('DOMContentLoaded', async () => {
    // Check if API module is ready
    if (window.apiModuleReady) {
        initNotificationsPage();
    } else {
        window.addEventListener('apiModuleReady', initNotificationsPage);
    }
});

async function initNotificationsPage() {
    const listContainer = document.getElementById('notificationsList');
    const markAllBtn = document.getElementById('markAllReadBtn');

    // Setup event listeners
    if (markAllBtn) {
        markAllBtn.addEventListener('click', markAllAsRead);
    }

    // Load notifications
    await loadNotifications();

    // Mark all viewed notifications as read after a short delay
    setTimeout(() => {
        markAllAsRead(true); // true = silent mode (no toast)
    }, 2000);
}

async function loadNotifications() {
    const listContainer = document.getElementById('notificationsList');
    if (!listContainer) return;

    try {
        const response = await window.notificationsAPI.getAll({ limit: 50 });
        const notifications = response.notifications || [];

        renderNotifications(notifications);
    } catch (error) {
        console.error('Error loading notifications:', error);
        listContainer.innerHTML = `
            <div class="empty-state">
                <p>Error loading notifications. Please try again.</p>
                <button class="btn btn-sm btn-primary" onclick="window.location.reload()">Retry</button>
            </div>
        `;
    }
}

function renderNotifications(notifications) {
    const listContainer = document.getElementById('notificationsList');
    if (!listContainer) return;

    if (notifications.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <p>No notifications yet.</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = notifications.map(notification => {
        const isUnread = !notification.read;
        const icon = getNotificationIcon(notification.type);
        const date = new Date(notification.created_at).toLocaleString();

        return `
            <div class="notification-card ${isUnread ? 'unread' : ''}" data-id="${notification.id}">
                <div class="notification-icon-box">
                    ${icon}
                </div>
                <div class="notification-content">
                    <div class="notification-header">
                        <span class="notification-title">${escapeHtml(notification.title)}</span>
                        <span class="notification-time">${date}</span>
                    </div>
                    <p class="notification-message">${escapeHtml(notification.message)}</p>
                </div>
            </div>
        `;
    }).join('');
}

async function markAllAsRead(silent = false) {
    try {
        await window.notificationsAPI.markAllAsRead();

        // Update UI locally
        const cards = document.querySelectorAll('.notification-card.unread');
        cards.forEach(card => card.classList.remove('unread'));

        // Update badge (globally)
        if (typeof updateNotificationBadge === 'function') {
            updateNotificationBadge();
        }

        if (!silent && typeof showToast === 'function') {
            showToast('All notifications marked as read', 'success');
        }
    } catch (error) {
        console.error('Error marking all as read:', error);
    }
}

function getNotificationIcon(type) {
    // different icons based on notification type
    // budget, goal, system, income, expense

    if (type === 'budget_alert') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`; // Alert triangle
    } else if (type === 'goal_achieved') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`; // Check circle
    } else if (type === 'income') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`; // Dollar sign
    } else {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`; // Bell
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
