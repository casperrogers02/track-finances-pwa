// Shared navigation functionality for Cursor-style layout

// Initialize navigation
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!getToken()) {
        window.location.href = 'login.html';
        return;
    }

    // Load user info and update profile avatar
    const user = getUser();
    if (user) {
        updateProfileAvatar();
        // Sync profile picture from server when online
        if (navigator.onLine) {
            syncProfilePictureFromServer();
        }
    }

    initNavigation();
    initOfflineIndicator();
    initNavbarTitleScrollEffect();
});

// Initialize navigation
function initNavigation() {
    // Hamburger menu toggle
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (hamburgerBtn && sidebar && sidebarOverlay) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            sidebarOverlay.classList.toggle('show');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('show');
        });
    }

    // Close sidebar when clicking nav item on mobile
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar?.classList.remove('open');
                sidebarOverlay?.classList.remove('show');
            }
        });
    });

    // Set active navigation link based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const navLinks = document.querySelectorAll('.nav-item');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
    setActiveNavItem();

    // Update profile avatar
    updateProfileAvatar();

    // Initialize notification badge
    initNotificationBadge();
}

// Set active navigation item
function setActiveNavItem() {
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href && href.includes(currentPage)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Update profile avatar with user initials or image
function updateProfileAvatar() {
    const avatar = document.getElementById('profileAvatar');
    if (!avatar) return;

    // Check localStorage first for image (fastest)
    const pictureUrl = localStorage.getItem('profilePicture');

    // Use window.getUser if available (from module), otherwise try global
    const getUserFn = window.getUser || (typeof getUser !== 'undefined' ? getUser : null);
    const user = getUserFn ? getUserFn() : null;

    if (pictureUrl) {
        avatar.style.backgroundImage = `url(${pictureUrl})`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
        avatar.textContent = '';
        if (user) avatar.title = user.full_name || user.email;
    } else if (user && user.full_name) {
        const initials = user.full_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        avatar.textContent = initials;
        avatar.title = user.full_name;
        avatar.style.backgroundImage = '';
    } else if (user && user.email) {
        avatar.textContent = user.email[0].toUpperCase();
        avatar.title = user.email;
        avatar.style.backgroundImage = '';
    }
}

// Initialize notification badge
function initNotificationBadge() {
    const notificationIcon = document.getElementById('notificationIcon');
    if (!notificationIcon) return;

    // Add click handler to navigate to notifications page
    notificationIcon.addEventListener('click', () => {
        window.location.href = 'notifications.html';
    });

    // Load initial count
    updateNotificationBadge();

    // Poll for updates every 10 seconds for near real-time updates
    setInterval(updateNotificationBadge, 10000);
}

// Update notification badge count
async function updateNotificationBadge(shouldBroadcast = true) {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;

    try {
        // Use window.notificationsAPI if available (from module)
        const notifications = window.notificationsAPI || (typeof notificationsAPI !== 'undefined' ? notificationsAPI : null);
        if (!notifications) return;

        const response = await notifications.getUnreadCount();
        const count = response.unreadCount || 0;

        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }

        // Broadcast update to other tabs
        if (shouldBroadcast) {
            const channel = new BroadcastChannel('spendwise_notifications');
            channel.postMessage({ type: 'update_badge' });
            setTimeout(() => channel.close(), 1000); // Close after sending
        }
    } catch (error) {
        console.error('Error loading notification count:', error);
        // Hide badge on error
        badge.style.display = 'none';
    }
}

// Listen for broadcast updates
const notificationChannel = new BroadcastChannel('spendwise_notifications');
notificationChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'update_badge') {
        updateNotificationBadge(false); // Don't re-broadcast to avoid loops
    }
};

// Initialize offline indicator
function initOfflineIndicator() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    function updateOfflineStatus() {
        const isOffline = !navigator.onLine;
        const queueStats = window.offlineQueue ? window.offlineQueue.getOfflineStats() : { total: 0 };

        if (statusDot) {
            if (isOffline) {
                statusDot.classList.add('offline');
            } else {
                statusDot.classList.remove('offline');
            }
        }

        if (statusText) {
            // Only update status text if it exists and we're sure about the status
            if (isOffline) {
                statusText.textContent = queueStats.total > 0 ? `Offline (${queueStats.total} queued)` : 'Offline';
            } else {
                statusText.textContent = queueStats.total > 0 ? `Syncing (${queueStats.total})` : 'Online';
            }
        }
    }

    // Initial check
    updateOfflineStatus();

    // Listen for online/offline events
    window.addEventListener('online', () => {
        updateOfflineStatus();
        // Use window.showNotification if available, otherwise showToast
        const notifyFn = window.showNotification || showToast;
        if (notifyFn) {
            notifyFn('Back online! Syncing data...', 'success');
        }
    });

    window.addEventListener('offline', () => {
        updateOfflineStatus();
    });

    // Listen for offline sync events
    window.addEventListener('offline-sync-complete', (event) => {
        updateOfflineStatus();
        const { synced, failed, remaining } = event.detail;
        const notifyFn = window.showNotification || showToast;
        if (notifyFn) {
            if (synced > 0 && failed === 0) {
                notifyFn(`Successfully synced ${synced} items!`, 'success');
            } else if (synced > 0 && failed > 0) {
                notifyFn(`Synced ${synced} items, ${failed} failed`, 'warning');
            }
        }
    });

    // Update queue status every 5 seconds when items are queued
    setInterval(() => {
        if (window.offlineQueue && window.offlineQueue.getOfflineStats().total > 0) {
            updateOfflineStatus();
        }
    }, 5000);
}

// Navbar title: fade/ghost animation while the content scrolls
function initNavbarTitleScrollEffect() {
    const topbar = document.querySelector('.topbar');
    const title = document.querySelector('.page-title.word-ghost');
    if (!topbar || !title) return;

    // Prefer the internal scroll container (most SpendWise pages).
    const scrollEl = document.querySelector('.content-wrapper') || window;

    let lastState = false;
    let sweepTimer = null;
    let raf = null;

    const getScrollTop = () => {
        if (scrollEl === window) return window.scrollY || 0;
        return scrollEl.scrollTop || 0;
    };

    const update = () => {
        raf = null;

        const y = getScrollTop();
        const shouldHide = y > 24;

        if (shouldHide === lastState) return;
        lastState = shouldHide;

        if (shouldHide) {
            title.classList.add('is-hidden');
            // Trigger the “ghost text behind text” animation once per hide transition
            title.classList.add('ghost-sweep');
            if (sweepTimer) clearTimeout(sweepTimer);
            sweepTimer = setTimeout(() => title.classList.remove('ghost-sweep'), 950);
            topbar.classList.add('is-scrolled');
        } else {
            title.classList.remove('is-hidden');
            topbar.classList.remove('is-scrolled');
        }
    };

    const onScroll = () => {
        if (raf) return;
        raf = requestAnimationFrame(update);
    };

    // Scroll container might not exist immediately; still safe for typical pages.
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    // Run once so initial load state is correct (e.g. if user comes back mid-scroll)
    update();
}

// Show toast notification
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = `toast alert-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Make functions globally available
window.showToast = showToast;
window.showNotification = showToast;
window.updateNotificationBadge = updateNotificationBadge;

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Use window.authAPI if available (from module), otherwise try global
        const auth = window.authAPI || (typeof authAPI !== 'undefined' ? authAPI : null);
        if (auth) {
            auth.logout().catch(() => { });
        }
        // Use window.removeToken if available
        const removeTokenFn = window.removeToken || (typeof removeToken !== 'undefined' ? removeToken : null);
        if (removeTokenFn) {
            removeTokenFn();
        } else {
            localStorage.removeItem('token');
        }
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }
}

window.logout = logout;

// Sync profile picture from server using /me endpoint (which returns profile_picture from DB)
async function syncProfilePictureFromServer() {
    try {
        const API_BASE_URL = window.API_BASE_URL || 'https://track-finances-pwa-production.up.railway.app/api';
        const getTokenFn = window.getToken || (typeof getToken !== 'undefined' ? getToken : null);
        const getUserFn = window.getUser || (typeof getUser !== 'undefined' ? getUser : null);
        const setUserFn = window.setUser || (typeof setUser !== 'undefined' ? setUser : null);
        if (!getTokenFn || !getTokenFn()) return;

        const response = await fetch(`${API_BASE_URL}/me`, {
            headers: { 'Authorization': `Bearer ${getTokenFn()}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const serverPic = data.user?.profile_picture;
            if (serverPic) {
                // Update user object and local cache
                if (getUserFn && setUserFn) {
                    const user = getUserFn();
                    if (user) {
                        user.profile_picture = serverPic;
                        // Also sync full_name, email in case they changed on another device
                        if (data.user.full_name) user.full_name = data.user.full_name;
                        if (data.user.email) user.email = data.user.email;
                        if (data.user.preferred_currency) user.preferred_currency = data.user.preferred_currency;
                        setUserFn(user);
                    }
                }
                localStorage.setItem('profilePicture', serverPic);
                updateProfileAvatar();
            }
        }
    } catch (error) {
        console.log('Could not sync profile from server:', error);
    }
}
