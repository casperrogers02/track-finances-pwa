// Settings page functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
  if (!getToken()) {
    window.location.href = 'login.html';
    return;
  }

    // Load user info
  const user = getUser();
  if (user) {
        // Populate profile fields
        const nameInput = document.getElementById('profileName');
        const emailInput = document.getElementById('profileEmail');
        const phoneInput = document.getElementById('profilePhone');
        const currencySelect = document.getElementById('currencySelect');

        if (nameInput) nameInput.value = user.full_name || '';
        if (emailInput) emailInput.value = user.email || '';
        if (phoneInput) phoneInput.value = user.phone || '';
        if (currencySelect) currencySelect.value = user.preferred_currency || 'UGX';

        // Load profile picture if exists
        loadProfilePicture(user);

        // Load font size
        const savedFontSize = localStorage.getItem('fontSize') || '1';
        const fontSizeSlider = document.getElementById('fontSizeSlider');
        const fontSizeLabel = document.getElementById('fontSizeLabel');
        if (fontSizeSlider) {
            fontSizeSlider.value = savedFontSize;
            document.documentElement.style.fontSize = `${savedFontSize}rem`;
            document.body.style.fontSize = `${savedFontSize}rem`;
            if (fontSizeLabel) {
                fontSizeLabel.textContent = savedFontSize === '1' ? 'Normal' : `${Math.round(savedFontSize * 100)}%`;
            }
        }
    }

    // Load theme preference - check both systems
    let savedTheme = localStorage.getItem('theme') || 'dark';

    // Also check themePrefs system
    if (window.themePrefs) {
        const prefs = window.themePrefs.loadPrefs();
        savedTheme = prefs.theme || savedTheme;
    }

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = savedTheme;
        // Apply theme immediately to both systems
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (window.themePrefs) {
            window.themePrefs.setThemePref(savedTheme);
        }
    }

    // Load font size preference
    const savedFontSize = localStorage.getItem('fontSize') || '1';
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeLabel = document.getElementById('fontSizeLabel');
    if (fontSizeSlider) {
        fontSizeSlider.value = savedFontSize;
        if (fontSizeLabel) {
            fontSizeLabel.textContent = savedFontSize === '1' ? 'Normal' : `${Math.round(savedFontSize * 100)}%`;
        }
        document.documentElement.style.fontSize = `${savedFontSize}rem`;
    }

    // Setup event listeners
    setupEventListeners();

    // Load Mobile Money settings
    loadMobileMoneySettings();

    // Setup Mobile Money sync listeners
    const syncIncomes = document.getElementById('syncIncomes');
    const syncExpenses = document.getElementById('syncExpenses');
    if (syncIncomes) {
        syncIncomes.addEventListener('change', toggleMobileMoneySync);
    }
    if (syncExpenses) {
        syncExpenses.addEventListener('change', toggleMobileMoneySync);
    }
});

// Setup event listeners
function setupEventListeners() {
    // Theme change
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            // Apply theme to document element (for CSS)
            document.documentElement.setAttribute('data-theme', theme);
            // Save in both systems
            localStorage.setItem('theme', theme);
            if (window.themePrefs) {
                window.themePrefs.setThemePref(theme);
            }
            showNotification('Theme updated', 'success');

            // Reload page to apply theme fully (charts, etc.)
            setTimeout(() => {
                window.location.reload();
            }, 500);
        });
    }

    // Font size change
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeLabel = document.getElementById('fontSizeLabel');
    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', (e) => {
            const fontSize = e.target.value;
            // Apply globally
            document.documentElement.style.fontSize = `${fontSize}rem`;
            document.body.style.fontSize = `${fontSize}rem`;
            // Save to localStorage
            localStorage.setItem('fontSize', fontSize);
            if (window.themePrefs) {
                window.themePrefs.setTextScalePref(parseFloat(fontSize));
            }
            if (fontSizeLabel) {
                fontSizeLabel.textContent = fontSize === '1' ? 'Normal' : `${Math.round(fontSize * 100)}%`;
            }
            showNotification('Font size updated', 'success');
        });
    }

    // Currency change
    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
        currencySelect.addEventListener('change', async (e) => {
            const currency = e.target.value;
            try {
                await authAPI.updateCurrency(currency);
                const user = getUser();
                if (user) {
                    user.preferred_currency = currency;
                    setUser(user);
                }
                showNotification('Currency preference updated', 'success');
            } catch (error) {
                console.error('Error updating currency:', error);
                // Update locally anyway
                const user = getUser();
                if (user) {
                    user.preferred_currency = currency;
                    setUser(user);
                }
                showNotification('Currency preference saved locally', 'info');
            }
        });
    }

    // Profile picture upload with camera/file options
    const profileAvatars = document.querySelectorAll('#profileAvatar, #settingsProfileAvatar'); // Updated selector
    profileAvatars.forEach(avatar => {
        if (avatar) {
            avatar.addEventListener('click', () => {
                openProfilePictureDialog();
            });
        }
    });
}

// Open profile picture dialog with camera/file options
function openProfilePictureDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'modal active';
    dialog.style.zIndex = '3000';
    dialog.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h2 class="modal-title">Change Profile Picture</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
                <button class="btn btn-primary" onclick="openCameraCapture()" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    ${getIcon('camera')} Take Photo
                </button>
                <button class="btn btn-primary" onclick="openFilePicker()" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    ${getIcon('folder')} Choose from Device
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // Close on outside click
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.remove();
    });
}

// Open camera capture
function openCameraCapture() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'user'; // Use front-facing camera on mobile
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadProfilePicture(file);
            document.querySelector('.modal.active')?.remove();
        }
    };
    input.click();
}

// Open file picker
function openFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadProfilePicture(file);
            document.querySelector('.modal.active')?.remove();
        }
    };
    input.click();
}

// Make functions globally available
window.openCameraCapture = openCameraCapture;
window.openFilePicker = openFilePicker;

// Load profile picture
async function loadProfilePicture(user) {
    const API_BASE_URL = window.API_BASE_URL || 'https://track-finances-pwa-production.up.railway.app/api';
    const avatars = document.querySelectorAll('#profileAvatar, #settingsProfileAvatar'); // Added settingsProfileAvatar
    if (avatars.length === 0) return;

    // First, try to get the latest profile picture from server
    try {
        if (navigator.onLine && getToken()) {
            const response = await fetch(`${API_BASE_URL}/profile/picture`, {
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.profile_picture) {
                    // Update user object with server URL
                    if (user) {
                        user.profile_picture = data.profile_picture;
                        setUser(user);
                    }
                    
                    let fullUrl = data.profile_picture;
                    if (fullUrl.startsWith('/uploads')) {
                        const url = new URL(API_BASE_URL);
                        fullUrl = `${url.origin}${fullUrl}`;
                    }
                    
                    // Save to localStorage for offline fallback
                    localStorage.setItem('profilePicture', fullUrl);
                    updateAllProfileAvatars(fullUrl);
                    return;
                }
            }
        }
    } catch (error) {
        console.log('Could not fetch latest profile picture from server, using cached version');
    }

    // Fallback to cached version
    let pictureUrl = user?.profile_picture || localStorage.getItem('profilePicture');

    // Handle relative paths from backend
    if (pictureUrl && pictureUrl.startsWith('/uploads')) {
        try {
            const url = new URL(API_BASE_URL);
            pictureUrl = `${url.origin}${pictureUrl}`;
        } catch (e) {
            console.warn('Could not construct absolute URL for profile picture:', e);
        }
    }

    // If we have a picture URL, update all avatars
    if (pictureUrl) {
        updateAllProfileAvatars(pictureUrl);
    } else {
        // Set default avatar
        updateAllProfileAvatars(null);
    }
}

// Upload profile picture
async function uploadProfilePicture(file) {
    const API_BASE_URL = window.API_BASE_URL || 'https://track-finances-pwa-production.up.railway.app/api';
    if (file.size > 5 * 1024 * 1024) { // Updated to 5MB to match backend
        showNotification('Image size must be less than 5MB', 'error');
        return;
    }

    // Show loading state or immediate feedback if possible
    showNotification('Uploading profile picture...', 'info');

    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageUrl = e.target.result;

        // Optimistic update (show base64 temporarily)
        const user = getUser();
        updateAllProfileAvatars(imageUrl); // Show local preview

        try {
            // Try to save to backend
            const formData = new FormData();
            formData.append('image', file); // Changed to 'image' to match backend

            const response = await fetch(`${API_BASE_URL}/profile/picture`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                // Update user object with server URL if provided
                if (user && data.profile_picture) {
                    user.profile_picture = data.profile_picture;
                    setUser(user);

                    // We don't save full URL to localStorage, just the path (or what server returns)
                    // But for display we need full URL.
                    // Let loadProfilePicture handle the URL construction next time.
                    // For now, updateAllProfileAvatars needs the FULL URL.

                    let fullUrl = data.profile_picture;
                    if (fullUrl.startsWith('/uploads')) {
                        const url = new URL(API_BASE_URL);
                        fullUrl = `${url.origin}${fullUrl}`;
                    }

                    localStorage.setItem('profilePicture', fullUrl); // Save full URL for offline fallback
                    updateAllProfileAvatars(fullUrl);
                }
                showNotification('Profile picture updated successfully', 'success');
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            showNotification('Error uploading profile picture. Saved locally.', 'warning');

            // Fallback: Save base64 to localStorage for local persistence
            localStorage.setItem('profilePicture', imageUrl);
            if (user) {
                user.profile_picture = imageUrl; // Save base64 to user obj locally
                setUser(user);
            }
        }
    };
    reader.readAsDataURL(file);
}

// Update all profile avatars
function updateAllProfileAvatars(imageUrl) {
    // Select both by class and ID to ensure all instances are updated
    const avatars = document.querySelectorAll('.profile-avatar, #profileAvatar');
    avatars.forEach(avatar => {
        if (imageUrl) {
            avatar.style.backgroundImage = `url(${imageUrl})`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.textContent = '';
    }
  });
}

// Save profile
async function saveProfile() {
    const nameInput = document.getElementById('profileName');
    const phoneInput = document.getElementById('profilePhone');
    const emailInput = document.getElementById('profileEmail');

    if (!nameInput || !phoneInput || !emailInput) {
        showNotification('Form fields not found', 'error');
        return;
    }

    const full_name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();

    // Validate email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }

    try {
        // Update in database
        const updateData = {};
        if (full_name) updateData.full_name = full_name;
        if (phone) updateData.phone = phone;
        if (email) updateData.email = email;

        if (Object.keys(updateData).length > 0) {
            try {
                const response = await authAPI.updateProfile(updateData);

                // Update local user object with response data
                const user = getUser();
                if (user) {
                    // Use response data if available, otherwise use form data
                    user.full_name = response.user?.full_name || response.full_name || full_name || user.full_name;
                    user.phone = response.user?.phone || response.phone || phone || user.phone;
                    user.email = response.user?.email || response.email || email || user.email;
                    setUser(user);

                    // Also update sessionStorage for immediate access
                    sessionStorage.setItem('user', JSON.stringify(user));
                } else {
                    // Create new user object if none exists
                    const newUser = {
                        full_name: full_name,
                        phone: phone,
                        email: email
                    };
                    setUser(newUser);
                    sessionStorage.setItem('user', JSON.stringify(newUser));
                }

                showNotification('Profile saved successfully', 'success');

                // Update UI immediately
                updateProfileAvatar();
                const currentPic = user?.profile_picture || localStorage.getItem('profilePicture');
                updateAllProfileAvatars(currentPic);

                // Update dashboard welcome message if on dashboard
                if (typeof updateWelcomeMessage === 'function') {
                    const updatedUser = getUser();
                    if (updatedUser) {
                        updateWelcomeMessage(updatedUser);
                    }
                }

                // Trigger global user update event for other components
                window.dispatchEvent(new CustomEvent('userUpdated', { detail: getUser() }));

                // Refresh dashboard if on dashboard page (after a delay to show success message)
                setTimeout(() => {
                    if (window.location.pathname.includes('dashboard')) {
                        // Reload to ensure all components get updated data
                        window.location.reload();
                    }
                }, 1000);

            } catch (apiError) {
                console.error('API error:', apiError);

                // Show user-friendly error message
                const errorMessage = apiError.message || 'Could not connect to server';
                if (errorMessage.includes('token') || errorMessage.includes('401')) {
                    showNotification('Session expired. Please log in again.', 'error');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                    return;
                }

                // Update locally anyway for offline support
    const user = getUser();
    if (user) {
      user.full_name = full_name || user.full_name;
      user.phone = phone || user.phone;
                    user.email = email || user.email;
      setUser(user);
                    sessionStorage.setItem('user', JSON.stringify(user));
                }

                showNotification('Profile saved locally. ' + errorMessage, 'warning');

                // Still update UI
                updateProfileAvatar();
                if (typeof updateWelcomeMessage === 'function') {
                    const updatedUser = getUser();
                    if (updatedUser) {
                        updateWelcomeMessage(updatedUser);
                    }
                }
            }
        } else {
            showNotification('No changes to save', 'info');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showNotification('Error saving profile: ' + error.message, 'error');
    }
}

// Update profile avatar
function updateProfileAvatar() {
    const user = getUser();
    const avatars = document.querySelectorAll('.profile-avatar');

    avatars.forEach(avatar => {
        const pictureUrl = localStorage.getItem('profilePicture');
        if (pictureUrl) {
            avatar.style.backgroundImage = `url(${pictureUrl})`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.textContent = '';
        } else if (user && user.full_name) {
            const initials = user.full_name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
            avatar.textContent = initials;
            avatar.style.backgroundImage = '';
        } else if (user && user.email) {
            avatar.textContent = user.email[0].toUpperCase();
            avatar.style.backgroundImage = '';
        }
    });
}

// Show notification
function showNotification(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    if (!container) return;

    // Escape HTML to prevent XSS and template literal issues
    const escapedMessage = String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    container.innerHTML = '<div class="alert alert-' + type + '">' + escapedMessage + '</div>';
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

// Change password
async function changePassword(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        showNotification('New passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        await authAPI.changePassword({
            current_password: currentPassword,
            new_password: newPassword
        });

        // Clear form
        document.getElementById('passwordForm').reset();
        showNotification('Password changed successfully', 'success');

        // Optionally logout user to re-login with new password
        setTimeout(() => {
            if (confirm('Password changed successfully. Do you want to logout and login again?')) {
                logout();
            }
        }, 1000);
    } catch (error) {
        console.error('Error changing password:', error);
        showNotification(error.message || 'Error changing password. Please check your current password.', 'error');
    }
}

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        const type = input.type === 'password' ? 'text' : 'password';
        input.type = type;

        // Find the toggle button - it's the next sibling in the wrapper
        const btn = input.nextElementSibling;
        if (btn && btn.classList.contains('password-toggle')) {
            btn.innerHTML = type === 'password' ? getIcon('eye') : getIcon('eyeOff');
        }
    }
}

// Mobile Money Sync Functions
async function loadMobileMoneySettings() {
    try {
        const settings = await mobileMoneyAPI.getSettings();
        document.getElementById('enableSync').checked = settings.enabled || false;
        document.getElementById('syncIncomes').checked = settings.sync_incomes !== false;
        document.getElementById('syncExpenses').checked = settings.sync_expenses !== false;

        const syncOptions = document.getElementById('syncOptions');
        if (syncOptions) {
            syncOptions.style.display = settings.enabled ? 'block' : 'none';
        }
    } catch (error) {
        console.error('Error loading Mobile Money settings:', error);
        // Load from localStorage as fallback
        const settings = JSON.parse(localStorage.getItem('mobileMoneySettings') || '{"enabled": false, "sync_incomes": true, "sync_expenses": true}');
        document.getElementById('enableSync').checked = settings.enabled || false;
        document.getElementById('syncIncomes').checked = settings.sync_incomes !== false;
        document.getElementById('syncExpenses').checked = settings.sync_expenses !== false;

        const syncOptions = document.getElementById('syncOptions');
        if (syncOptions) {
            syncOptions.style.display = settings.enabled ? 'block' : 'none';
        }
    }
}

async function toggleMobileMoneySync() {
    const enabled = document.getElementById('enableSync').checked;
    const syncOptions = document.getElementById('syncOptions');

    if (syncOptions) {
        syncOptions.style.display = enabled ? 'block' : 'none';
    }

    try {
        const settings = {
            enabled: enabled,
            sync_incomes: document.getElementById('syncIncomes').checked,
            sync_expenses: document.getElementById('syncExpenses').checked
        };

        await mobileMoneyAPI.updateSettings(settings);
        localStorage.setItem('mobileMoneySettings', JSON.stringify(settings));
        showNotification('Mobile Money sync settings updated', 'success');
    } catch (error) {
        console.error('Error updating Mobile Money settings:', error);
        // Save locally
        const settings = {
            enabled: enabled,
            sync_incomes: document.getElementById('syncIncomes').checked,
            sync_expenses: document.getElementById('syncExpenses').checked
        };
        localStorage.setItem('mobileMoneySettings', JSON.stringify(settings));
        showNotification('Settings saved locally. Will sync when online.', 'info');
    }
}

async function handleStatementUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(csv|pdf)$/i)) {
        showNotification('Please upload a CSV or PDF file', 'error');
        return;
    }

    try {
        showNotification('Uploading statement...', 'info');

        // Try API first
        let result;
        try {
            result = await mobileMoneyAPI.uploadStatement(file);
        } catch (apiError) {
            console.error('API error, parsing locally:', apiError);
            // Parse locally as fallback
            result = await parseStatementLocally(file);
        }

        if (result && result.transactions && result.transactions.length > 0) {
            showNotification(`Found ${result.transactions.length} transaction(s). Review and approve them.`, 'success');
            // Store transactions in dialog
            const dialog = showTransactionApprovalDialog(result.transactions);
            dialog.transactions = result.transactions;
        } else {
            showNotification('No transactions found in statement', 'info');
        }
    } catch (error) {
        console.error('Error uploading statement:', error);
        showNotification('Error uploading statement: ' + error.message, 'error');
    }
}

// Parse statement locally (fallback)
async function parseStatementLocally(file) {
    return new Promise((resolve, reject) => {
        if (file.name.endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n').filter(line => line.trim());
                    const transactions = [];

                    // Skip header row
                    for (let i = 1; i < lines.length; i++) {
                        const parts = lines[i].split(',').map(p => p.trim());
                        if (parts.length >= 3) {
                            const amount = parseFloat(parts[2]) || 0;
                            const type = amount > 0 ? 'income' : 'expense';
                            transactions.push({
                                type: type,
                                amount: Math.abs(amount),
                                currency: 'UGX',
                                date: parts[0] || new Date().toISOString().split('T')[0],
                                description: parts[1] || 'Mobile Money Transaction',
                                source: parts[1] || 'Mobile Money',
                                source_type: 'statement_upload'
                            });
                        }
                    }
                    resolve({ transactions });
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsText(file);
        } else {
            // PDF parsing would require a library, for now show error
            reject(new Error('PDF parsing requires server-side processing'));
        }
    });
}

async function parseSMS() {
    const smsText = document.getElementById('smsText').value.trim();
    if (!smsText) {
        showNotification('Please enter SMS text', 'error');
        return;
    }

    try {
        let result;
        try {
            result = await mobileMoneyAPI.parseSMS(smsText);
        } catch (apiError) {
            console.error('API error, parsing locally:', apiError);
            // Parse locally as fallback
            result = parseSMSLocally(smsText);
        }

        if (result && result.transaction) {
            showNotification('Transaction detected! Review and save it.', 'success');
            const dialog = showTransactionApprovalDialog([result.transaction]);
            dialog.transactions = [result.transaction];
            document.getElementById('smsText').value = '';
        } else {
            showNotification('Could not parse transaction from SMS', 'error');
        }
    } catch (error) {
        console.error('Error parsing SMS:', error);
        showNotification('Error parsing SMS: ' + error.message, 'error');
    }
}

// Parse SMS locally (fallback)
function parseSMSLocally(smsText) {
    // Common Mobile Money SMS patterns in Uganda
    const patterns = [
        // MTN Mobile Money pattern: "You have received UGX 50,000 from John..."
        /received\s+UGX\s+([\d,]+)/i,
        /received\s+([\d,]+)\s+UGX/i,
        // Payment pattern: "You have paid UGX 12,000 to..."
        /paid\s+UGX\s+([\d,]+)/i,
        /paid\s+([\d,]+)\s+UGX/i,
        // Withdrawal pattern
        /withdrawn\s+UGX\s+([\d,]+)/i,
        /withdrawn\s+([\d,]+)\s+UGX/i
    ];

    let amount = 0;
    let type = 'expense';

    // Extract amount
    for (const pattern of patterns) {
        const match = smsText.match(pattern);
        if (match) {
            amount = parseFloat(match[1].replace(/,/g, ''));
            // Determine type
            if (smsText.toLowerCase().includes('received')) {
                type = 'income';
            } else {
                type = 'expense';
            }
            break;
        }
    }

    if (amount > 0) {
        // Extract date (try to find date in SMS or use today)
        const dateMatch = smsText.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        let date = new Date().toISOString().split('T')[0];
        if (dateMatch) {
            try {
                const dateParts = dateMatch[1].split(/[\/\-]/);
                if (dateParts.length === 3) {
                    date = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]).toISOString().split('T')[0];
                }
            } catch (e) {
                // Use today's date
            }
        }

        // Extract description/source
        const sourceMatch = smsText.match(/from\s+([A-Za-z\s]+)|to\s+([A-Za-z\s]+)/i);
        const source = sourceMatch ? (sourceMatch[1] || sourceMatch[2] || 'Mobile Money').trim() : 'Mobile Money';

        return {
            transaction: {
                type: type,
                amount: amount,
                currency: 'UGX',
                date: date,
                description: smsText.substring(0, 100),
                source: source,
                source_type: 'sms_sync'
            }
        };
    }

    return null;
}

function showTransactionApprovalDialog(transactions) {
    // Remove existing dialog if any
    const existing = document.querySelector('.modal.active[style*="z-index: 3000"]');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.className = 'modal active';
    dialog.style.zIndex = '3000';
    dialog.transactions = transactions; // Store transactions
    dialog.innerHTML = `
        <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
            <div class="modal-header">
                <h2 class="modal-title">Review Transactions</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div style="padding: 20px;">
                <p style="margin-bottom: 16px; color: var(--text-secondary);">
                    Found ${transactions.length} transaction(s). Review and approve them.
                </p>
                <div id="transactionList" style="display: flex; flex-direction: column; gap: 12px;">
                    ${transactions.map((txn, idx) => `
                        <div class="card" style="padding: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                <div>
                                    <strong>${txn.type === 'income' ? '💰 Income' : '💸 Expense'}</strong>
                                    <span style="font-size: 12px; color: var(--accent-teal); margin-left: 8px;">Auto-detected</span>
                                </div>
                                <strong style="color: ${txn.type === 'income' ? 'var(--success)' : 'var(--danger)'};">
                                    ${txn.type === 'income' ? '+' : '-'} ${(txn.currency || 'UGX')} ${parseFloat(txn.amount || 0).toLocaleString()}
                                </strong>
                            </div>
                            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                                Date: ${new Date(txn.date).toLocaleDateString()}<br>
                                Description: ${txn.description || txn.source || 'N/A'}
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn btn-sm btn-primary" onclick="approveTransaction(${idx})">✓ Approve</button>
                                <button class="btn btn-sm btn-outline" onclick="editTransaction(${idx})">✏️ Edit</button>
                                <button class="btn btn-sm btn-outline" onclick="rejectTransaction(${idx})">✗ Reject</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 16px; display: flex; gap: 8px;">
                    <button class="btn btn-primary" onclick="approveAllTransactions()" style="flex: 1;">Approve All</button>
                    <button class="btn btn-outline" onclick="this.closest('.modal').remove()" style="flex: 1;">Cancel</button>
                </div>
            </div>
        </div>
    `;

    // Store transactions in dialog for access
    dialog.transactions = transactions;
    document.body.appendChild(dialog);

    // Close on outside click
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.remove();
    });
}

// Approve transaction
async function approveTransaction(index) {
    const dialog = document.querySelector('.modal.active[style*="z-index: 3000"]');
    if (!dialog || !dialog.transactions) {
        console.error('Dialog or transactions not found');
        return;
    }

    const transaction = dialog.transactions[index];
    if (!transaction) {
        showNotification('Transaction not found', 'error');
        return;
    }

    try {
        const transactionData = {
            amount: parseFloat(transaction.amount),
            currency: transaction.currency || 'UGX',
            date: transaction.date || new Date().toISOString().split('T')[0],
            source_type: transaction.source_type || 'sms_sync',
            transaction_id: transaction.transaction_id || null // Include transaction ID
        };

        if (transaction.type === 'income') {
            transactionData.source = transaction.source || 'Mobile Money';
            await incomeAPI.create(transactionData);
        } else {
            transactionData.category = transaction.category || 'Mobile Money';
            transactionData.description = transaction.description || transaction.source || 'Mobile Money Transaction';
            await expensesAPI.create(transactionData);
        }

        showNotification('Transaction added successfully', 'success');
        dialog.transactions.splice(index, 1);

        // Update UI
        const list = document.getElementById('transactionList');
        if (list && dialog.transactions.length === 0) {
            dialog.remove();
            // Refresh pages if needed
            if (window.location.pathname.includes('dashboard')) {
                setTimeout(() => window.location.reload(), 1000);
            } else if (window.location.pathname.includes('income') || window.location.pathname.includes('expenses')) {
                setTimeout(() => window.location.reload(), 1000);
            }
        } else if (list) {
            list.children[index].remove();
            // Update the count message if possible, or just remove item
            const countP = dialog.querySelector('p[style*="color: var(--text-secondary)"]');
            if (countP) countP.textContent = `Found ${dialog.transactions.length} transaction(s). Review and approve them.`;
        }
    } catch (error) {
        console.error('Error approving transaction:', error);
        // Handle specific duplicate error
        const errorMsg = error.error || error.message || 'Unknown error';
        if (errorMsg.includes('Duplicate transaction')) {
            showNotification('⚠️ Duplicate: This transaction has already been recorded.', 'warning');
            // Optionally remove it from list or mark it as duplicate?
            // For now, let user decide to reject it.
        } else {
            showNotification('Error adding transaction: ' + errorMsg, 'error');
        }
    }
}

// Approve all transactions
async function approveAllTransactions() {
    const dialog = document.querySelector('.modal.active[style*="z-index: 3000"]');
    if (!dialog || !dialog.transactions) {
        console.error('Dialog or transactions not found');
        return;
    }

    try {
        let successCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;

        // Process in reverse so splicing doesn't mess up indices if we were removing, 
        // but here we are iterating over the array. We should create a copy or iterate carefully.
        // Better: iterate and collect results, then remove successful ones.
        const originalTransactions = [...dialog.transactions];
        const successfulIndices = [];

        for (let i = 0; i < originalTransactions.length; i++) {
            const transaction = originalTransactions[i];
            try {
                const transactionData = {
                    amount: parseFloat(transaction.amount),
                    currency: transaction.currency || 'UGX',
                    date: transaction.date || new Date().toISOString().split('T')[0],
                    source_type: transaction.source_type || 'sms_sync',
                    transaction_id: transaction.transaction_id || null // Include transaction ID
                };

                if (transaction.type === 'income') {
                    transactionData.source = transaction.source || 'Mobile Money';
                    await incomeAPI.create(transactionData);
                } else {
                    transactionData.category = transaction.category || 'Mobile Money';
                    transactionData.description = transaction.description || transaction.source || 'Mobile Money Transaction';
                    await expensesAPI.create(transactionData);
                }
                successCount++;
                successfulIndices.push(i);
            } catch (error) {
                console.error('Error adding transaction:', error);
                const errorMsg = error.error || error.message || '';
                if (errorMsg.includes('Duplicate transaction')) {
                    duplicateCount++;
                } else {
                    errorCount++;
                }
            }
        }

        // Remove successful transactions from the dialog list (in reverse order)
        for (let i = successfulIndices.length - 1; i >= 0; i--) {
            dialog.transactions.splice(successfulIndices[i], 1);
        }

        // Notification logic
        if (successCount > 0) {
            let msg = `Added ${successCount} transaction(s) successfully.`;
            if (duplicateCount > 0) msg += ` Skipped ${duplicateCount} duplicate(s).`;
            if (errorCount > 0) msg += ` Failed ${errorCount} transaction(s).`;
            showNotification(msg, duplicateCount > 0 ? 'warning' : 'success');
        } else if (duplicateCount > 0) {
            showNotification(`Skipped ${duplicateCount} duplicate transaction(s).`, 'warning');
        } else {
            showNotification('Error adding transactions', 'error');
        }

        // Close dialog if empty
        if (dialog.transactions.length === 0) {
            dialog.remove();
            // Refresh pages
            if (window.location.pathname.includes('dashboard')) {
                setTimeout(() => window.location.reload(), 1000);
            } else if (window.location.pathname.includes('income') || window.location.pathname.includes('expenses')) {
                setTimeout(() => window.location.reload(), 1000);
            }
        } else {
            // Refresh list to show remaining (failed/duplicates)
            const list = document.getElementById('transactionList');
            if (list) {
                // Re-render list (simplest way is to remove all and re-render remaining)
                // But since we don't have the render logic here easily without duplicating it...
                // Ideally we should call a render function.
                // For now, let's just reload the list by re-invoking showTransactionDialog... but wait, showTransactionDialog creates a NEW dialog.
                // We'll manually remove the approved elements.
                // Actually, recreating the list HTML is safer.
                list.innerHTML = dialog.transactions.map((txn, idx) => `
                    <div class="card" style="padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                            <div>
                                <strong>${txn.type === 'income' ? '💰 Income' : '💸 Expense'}</strong>
                                <span style="font-size: 12px; color: var(--accent-teal); margin-left: 8px;">Auto-detected</span>
                            </div>
                            <strong style="color: ${txn.type === 'income' ? 'var(--success)' : 'var(--danger)'};">
                                ${txn.type === 'income' ? '+' : '-'} ${(txn.currency || 'UGX')} ${parseFloat(txn.amount || 0).toLocaleString()}
                            </strong>
                        </div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
                            Date: ${new Date(txn.date).toLocaleDateString()}<br>
                            Description: ${txn.description || txn.source || 'N/A'}<br>
                            ${txn.transaction_id ? `<span style="font-size:10px; opacity:0.7">ID: ${txn.transaction_id}</span>` : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-sm btn-primary" onclick="approveTransaction(${idx})">✓ Approve</button>
                            <button class="btn btn-sm btn-outline" onclick="editTransaction(${idx})">✏️ Edit</button>
                            <button class="btn btn-sm btn-outline" onclick="rejectTransaction(${idx})">✗ Reject</button>
                        </div>
                    </div>
                `).join('');
                const countP = dialog.querySelector('p[style*="color: var(--text-secondary)"]');
                if (countP) countP.textContent = `Found ${dialog.transactions.length} transaction(s). Review and approve them.`;
            }
        }

    } catch (error) {
        console.error('Error approving transactions:', error);
        showNotification('Error adding transactions: ' + error.message, 'error');
    }
}

// Edit transaction
function editTransaction(index) {
    const dialog = document.querySelector('.modal.active');
    if (!dialog || !dialog.transactions) return;

    const transaction = dialog.transactions[index];
    // Open edit modal (similar to add expense/income modal)
    if (transaction.type === 'income') {
        // Open income edit modal
        window.location.href = 'income.html';
    } else {
        // Open expense edit modal
        window.location.href = 'expenses.html';
    }
}

// Reject transaction
function rejectTransaction(index) {
    const dialog = document.querySelector('.modal.active');
    if (!dialog || !dialog.transactions) return;

    dialog.transactions.splice(index, 1);
    const list = document.getElementById('transactionList');
    if (list && dialog.transactions.length === 0) {
        dialog.remove();
    } else if (list) {
        list.children[index].remove();
    }
}

// Make functions globally available
window.saveProfile = saveProfile;
window.changePassword = changePassword;
window.togglePassword = togglePassword;
window.toggleMobileMoneySync = toggleMobileMoneySync;
window.handleStatementUpload = handleStatementUpload;
window.parseSMS = parseSMS;
window.approveTransaction = approveTransaction;
window.approveAllTransactions = approveAllTransactions;
window.editTransaction = editTransaction;
window.rejectTransaction = rejectTransaction;
