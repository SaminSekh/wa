let contacts = JSON.parse(localStorage.getItem('wa_contacts')) || [];
let theme = localStorage.getItem('wa_theme') || 'light';
let currentTab = 'dashboard';
let currentStatusFilter = 'now'; // Dashboard filter
let currentContactFilter = 'all'; // Contacts filter
let contactSortMode = 'asc'; // 'asc' or 'desc'
let dashboardSortMode = 'time'; // 'time', 'asc', 'desc'
let manageViewMode = 'all'; // 'all', 'by_day', 'by_date'
let manageSortMode = 'asc'; // 'asc', 'desc', 'day', 'date'
let currentActivePhone = ''; // Track number for message modal
let completedActions = JSON.parse(localStorage.getItem('wa_completed_actions')) || {};
// Key format: contactId_time_date, Value: timestamp of completion
// Clean up expired entries (older than 10 hours)
function cleanExpiredCompletions() {
    const now = Date.now();
    const TEN_HOURS = 10 * 60 * 60 * 1000; // 10 hours in milliseconds
    let changed = false;

    for (const key in completedActions) {
        const timestamp = completedActions[key];
        if (typeof timestamp === 'boolean' || now - timestamp > TEN_HOURS) {
            delete completedActions[key];
            changed = true;
        }
    }

    if (changed) {
        localStorage.setItem('wa_completed_actions', JSON.stringify(completedActions));
    }
}
cleanExpiredCompletions(); // Run on load

let selectedEntries = []; // Track { id, time, phone, name } for bulk

// Initialize Theme
document.documentElement.setAttribute('data-theme', theme);

// --- 3-Dot Menu Logic ---
const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');

menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle('show');
});

window.addEventListener('click', () => {
    menuDropdown.classList.remove('show');
});

// --- Tab Switching Logic (Bottom Nav) ---
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        setActiveTab(target);
    });
});

function setActiveTab(target) {
    currentTab = target;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === target));
    tabContents.forEach(c => c.classList.toggle('active', c.id === target));

    if (target === 'dashboard') renderDashboard();
    if (target === 'contacts') renderContacts();
    if (target === 'random') renderRandomToday();
    if (target === 'manage') renderManage();
}

// --- Global Search Logic ---
const globalSearch = document.getElementById('globalSearch');
globalSearch.addEventListener('input', (e) => {
    const filter = e.target.value.toLowerCase();
    if (currentTab === 'contacts') renderContacts(filter);
    if (currentTab === 'dashboard') renderDashboard(filter);
});

// --- Status Filters Logic ---
// --- Status & Contact Filters Logic ---
document.addEventListener('click', (e) => {
    // Dashboard Filters
    if (e.target.classList.contains('filter-btn') && !e.target.dataset.context) {
        if (e.target.id === 'sortNameBtn') return; // Skip sort btn
        const filter = e.target.dataset.filter;
        currentStatusFilter = filter;

        // Update UI in Dashboard
        document.querySelectorAll('#dashboard .filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        renderDashboard(globalSearch.value.toLowerCase());
    }

    // Contact Filters
    if (e.target.classList.contains('filter-btn') && e.target.dataset.context === 'contacts') {
        const filter = e.target.dataset.filter;
        currentContactFilter = filter;

        // Update UI in Contacts
        document.querySelectorAll('#contacts .filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        renderContacts(globalSearch.value.toLowerCase());
    }

    // Manage Tab Filters
    if (e.target.classList.contains('filter-btn') && e.target.dataset.context === 'manage') {
        const filter = e.target.dataset.filter;
        manageViewMode = filter;

        // Update UI in Manage
        document.querySelectorAll('#manage .filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        renderManageList();
    }

    // Dashboard Sort Buttons
    if (e.target.classList.contains('filter-btn') && e.target.dataset.context === 'dashboard-sort') {
        const sortType = e.target.dataset.sort;
        dashboardSortMode = sortType;

        // Update UI in Dashboard
        document.querySelectorAll('#dashboard .filter-btn[data-context="dashboard-sort"]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === sortType);
        });

        renderDashboard(globalSearch.value.toLowerCase());
    }

    // Contacts Sort Buttons
    if (e.target.classList.contains('filter-btn') && e.target.dataset.context === 'contacts-sort') {
        const sortType = e.target.dataset.sort;
        contactSortMode = sortType;

        // Update UI in Contacts
        document.querySelectorAll('#contacts .filter-btn[data-context="contacts-sort"]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === sortType);
        });

        renderContacts(globalSearch.value.toLowerCase());
    }

    // Manage Sort Buttons
    if (e.target.classList.contains('filter-btn') && e.target.dataset.context === 'manage-sort') {
        const sortType = e.target.dataset.sort;
        manageSortMode = sortType;

        // Update UI in Manage
        document.querySelectorAll('#manage .filter-btn[data-context="manage-sort"]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === sortType);
        });

        renderManageList();
    }
});

// --- Sort Logic ---
// All sorting is now handled by dropdown logic above
// Removed old dashboard sort button logic


// --- Contact Management & Modal ---
const contactModal = document.getElementById('contactModal');
const contactForm = document.getElementById('contactForm');
const addContactBtn = document.getElementById('addContactBtn');
const closeModal = document.getElementById('closeModal');
const contactFreq = document.getElementById('contactFreq');
const weeklyOptions = document.getElementById('weeklyOptions');
const avatarGallery = document.getElementById('avatarGallery');
const previewImg = document.getElementById('previewImg');
const contactImgInput = document.getElementById('contactImg');
const imageUpload = document.getElementById('imageUpload');

// Initialize 60+ Default Avatars (Diverse & Reliable)
const defaultAvatars = [
    // Miniavs (Very reliable and clean)
    ...Array.from({ length: 25 }, (_, i) => `https://api.dicebear.com/7.x/miniavs/svg?seed=User${i + 100}`),
    // Avataaars (Modern)
    ...Array.from({ length: 20 }, (_, i) => `https://api.dicebear.com/7.x/avataaars/svg?seed=Avatar${i + 50}`),
    // Micah (Clean & Professional)
    ...Array.from({ length: 15 }, (_, i) => `https://api.dicebear.com/7.x/micah/svg?seed=Micah${i + 25}`),
    // Croodles (Artistic)
    ...Array.from({ length: 5 }, (_, i) => `https://api.dicebear.com/7.x/croodles/svg?seed=Art${i + 10}`),
    // Adventurer (Rich details)
    ...Array.from({ length: 15 }, (_, i) => `https://api.dicebear.com/7.x/adventurer/svg?seed=Adv${i + 30}`),
    // Open Peeps (Hand drawn)
    ...Array.from({ length: 15 }, (_, i) => `https://api.dicebear.com/7.x/open-peeps/svg?seed=Peep${i + 40}`),
    // Big Smile (Fun)
    ...Array.from({ length: 10 }, (_, i) => `https://api.dicebear.com/7.x/big-smile/svg?seed=Smile${i + 50}`)
];

function initAvatarGallery() {
    avatarGallery.innerHTML = '';
    defaultAvatars.forEach((url, index) => {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'avatar-item';
        // Add a small delay to avoid overwhelming the browser if many
        img.loading = 'lazy';
        img.onclick = () => selectAvatar(url, img);
        avatarGallery.appendChild(img);
    });
}

function selectAvatar(url, element) {
    document.querySelectorAll('.avatar-item').forEach(el => el.classList.remove('selected'));
    if (element) element.classList.add('selected');
    contactImgInput.value = url;
    previewImg.src = url;
}

imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = event.target.result;
            selectAvatar(base64String, null);
        };
        reader.readAsDataURL(file);
    }
});

addContactBtn.addEventListener('click', () => {
    contactForm.reset();
    document.getElementById('editId').value = '';
    document.getElementById('modalTitle').textContent = 'Add New Contact';
    document.getElementById('contactTime1').value = '22:00'; // Reset to default preferred time
    document.getElementById('weeklyDaysContainer').innerHTML = ''; // Clear dynamic fields
    document.getElementById('monthlyDaysContainer').innerHTML = ''; // Clear dynamic fields
    selectAvatar(defaultAvatars[0], null);
    contactModal.style.display = 'flex';
});

closeModal.addEventListener('click', () => {
    contactModal.style.display = 'none';
});

const monthlyOptions = document.getElementById('monthlyOptions');

contactFreq.addEventListener('change', () => {
    const freq = contactFreq.value;
    weeklyOptions.style.display = freq === 'weekly' ? 'block' : 'none';
    monthlyOptions.style.display = freq === 'monthly' ? 'block' : 'none';

    // Reset and Initialize Dynamic Fields if showing
    if (freq === 'weekly') {
        const container = document.getElementById('weeklyDaysContainer');
        if (container.children.length === 0) addWeeklyDay(1); // Default Monday
    }
    if (freq === 'monthly') {
        const container = document.getElementById('monthlyDaysContainer');
        if (container.children.length === 0) addMonthlyDay(1); // Default 1st
    }

    // Manage time inputs
    document.getElementById('time2Group').style.display = (freq === '2_day' || freq === '3_day') ? 'block' : 'none';
    document.getElementById('time3Group').style.display = freq === '3_day' ? 'block' : 'none';
    document.getElementById('time1Label').textContent = (freq === '2_day' || freq === '3_day') ? 'Preferred Time 1' : 'Preferred Time';
});

// --- Dynamic Day/Date Logic ---
document.getElementById('addWeeklyDayBtn').addEventListener('click', () => addWeeklyDay());
document.getElementById('addMonthlyDayBtn').addEventListener('click', () => addMonthlyDay());

function addWeeklyDay(defaultValue = 1, containerId = 'weeklyDaysContainer', selectClass = 'weekly-day-select') {
    const container = document.getElementById(containerId);
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.style.display = 'flex';
    div.style.gap = '10px';
    div.style.marginBottom = '5px';

    div.innerHTML = `
        <button type="button" class="btn-remove-small" onclick="this.parentElement.remove()" style="background: var(--wa-red); color: white; border: none; border-radius: 4px; padding: 0 10px;">×</button>
        <select class="${selectClass}" style="flex: 1; padding: 6px;">
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
            <option value="0">Sunday</option>
        </select>
    `;

    const select = div.querySelector('select');
    if (defaultValue !== null) select.value = defaultValue;
    container.appendChild(div);
}

function addMonthlyDay(defaultValue = 1, containerId = 'monthlyDaysContainer', inputClass = 'monthly-date-input') {
    const container = document.getElementById(containerId);
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.style.display = 'flex';
    div.style.gap = '10px';
    div.style.marginBottom = '5px';

    div.innerHTML = `
        <button type="button" class="btn-remove-small" onclick="this.parentElement.remove()" style="background: var(--wa-red); color: white; border: none; border-radius: 4px; padding: 0 10px;">×</button>
        <input type="number" class="${inputClass}" min="1" max="31" value="${defaultValue}" style="flex: 1; padding: 6px;">
    `;

    container.appendChild(div);
}

contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value || Date.now().toString();

    // Collect Weekly Days
    const weeklySelects = document.querySelectorAll('.weekly-day-select');
    const days = Array.from(weeklySelects).map(s => s.value);

    // Collect Monthly Dates
    const monthlyInputs = document.querySelectorAll('.monthly-date-input');
    const monthDays = Array.from(monthlyInputs).map(i => i.value);

    const contact = {
        id,
        img: contactImgInput.value,
        name: document.getElementById('contactName').value,
        phone: document.getElementById('contactPhone').value.replace(/\D/g, ''),
        freq: document.getElementById('contactFreq').value,
        days: days.length > 0 ? days : ['1'], // Default to Mon if empty (safety)
        monthDays: monthDays.length > 0 ? monthDays : ['1'], // Default to 1st
        times: [
            document.getElementById('contactTime1').value,
            document.getElementById('contactTime2').value,
            document.getElementById('contactTime3').value
        ].filter((t, i) => {
            if (i === 0) return true;
            if (i === 1) return contactFreq.value === '2_day' || contactFreq.value === '3_day';
            if (i === 2) return contactFreq.value === '3_day';
            return false;
        }),
        lastActed: Date.now()
    };

    const existingIndex = contacts.findIndex(c => c.id === id);
    if (existingIndex > -1) {
        contacts[existingIndex] = contact;
    } else {
        contacts.push(contact);
    }

    saveContacts();
    contactModal.style.display = 'none';
    setActiveTab(currentTab);
});

function saveContacts() {
    localStorage.setItem('wa_contacts', JSON.stringify(contacts));
}

function deleteContact(id) {
    if (confirm('Are you sure you want to delete this contact?')) {
        contacts = contacts.filter(c => c.id !== id);
        saveContacts();
        renderContacts();
    }
}

function editContact(id) {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;

    document.getElementById('editId').value = contact.id;
    contactImgInput.value = contact.img || '';
    previewImg.src = contact.img || defaultAvatars[0];
    document.getElementById('contactName').value = contact.name;
    document.getElementById('contactPhone').value = contact.phone;
    document.getElementById('contactFreq').value = contact.freq;

    // Populate Weekly Days
    document.getElementById('weeklyDaysContainer').innerHTML = '';
    const days = contact.days || (contact.day ? [contact.day] : ['1']); // Backwards compat
    days.forEach(d => addWeeklyDay(d));

    // Populate Monthly Dates
    document.getElementById('monthlyDaysContainer').innerHTML = '';
    const monthDays = contact.monthDays || (contact.monthDay ? [contact.monthDay] : ['1']); // Backwards compat
    monthDays.forEach(d => addMonthlyDay(d));

    const times = contact.times || [contact.time || '22:00'];
    document.getElementById('contactTime1').value = times[0] || '22:00';
    document.getElementById('contactTime2').value = times[1] || '14:00';
    document.getElementById('contactTime3').value = times[2] || '19:00';

    weeklyOptions.style.display = contact.freq === 'weekly' ? 'block' : 'none';
    monthlyOptions.style.display = contact.freq === 'monthly' ? 'block' : 'none';
    document.getElementById('time2Group').style.display = (contact.freq === '2_day' || contact.freq === '3_day') ? 'block' : 'none';
    document.getElementById('time3Group').style.display = contact.freq === '3_day' ? 'block' : 'none';
    document.getElementById('time1Label').textContent = (contact.freq === '2_day' || contact.freq === '3_day') ? 'Preferred Time 1' : 'Preferred Time';

    document.getElementById('modalTitle').textContent = 'Edit Contact';
    contactModal.style.display = 'flex';
}

// --- Rendering Logic ---
function createContactCard(contact, showActions = true) {
    const card = document.createElement('div');

    // Standardize display time
    const displayTime = contact._displayTime || '';

    const todayStr = new Date().toISOString().split('T')[0];
    const entryKey = `${contact.id}_${displayTime}_${todayStr}`;
    const isDone = completedActions[entryKey];

    // Check selection (ensure comparison is safe)
    const isSelected = selectedEntries.some(e => e.id === contact.id && (e.time || '') === displayTime);

    card.className = `contact-card ${isDone ? 'completed' : ''} ${isSelected ? 'selected' : ''}`;

    // Add data attributes for Select All functionality
    card.dataset.id = contact.id;
    card.dataset.time = displayTime;
    card.dataset.phone = contact.phone;
    card.dataset.name = contact.name;

    // Add Event Listener to the card for selection
    card.onclick = (e) => {
        if (e.target.closest('.action-btn') || e.target.closest('.contact-checkbox')) return;
        // Only allow selection toggling if it's not a preview card
        if (showActions) toggleSelectEntryById(contact.id, displayTime);
    };

    // Format the frequency/schedule string
    const scheduleStr = formatSchedule(contact);
    const contactTimes = contact.times || (contact.time ? [contact.time] : []);
    const displayTimeStr = contact._displayTime ? ` • ${contact._displayTime}` : (scheduleStr && contactTimes.length > 0 ? ` • ${contactTimes[0]}` : '');

    card.innerHTML = `
        <div class="contact-selection">
            <input type="checkbox" class="contact-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelectEntryById('${contact.id}', '${displayTime}')">
        </div>
        <div class="contact-img">
            <img src="${contact.img || defaultAvatars[0]}" alt="${contact.name}">
            ${isDone ? '<div class="completed-check" onclick="toggleCompletion(\'' + contact.id + '\', \'' + displayTime + '\', event)" style="cursor: pointer;" title="Click to unmark"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="white" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></div>' : ''}
        </div>
        <div class="contact-info">
            <div class="contact-name">${contact.name}</div>
            <div class="contact-phone">${contact.phone}</div>
            <div class="contact-schedule">${scheduleStr}</div>
        </div>
        ${showActions ? `
        <div class="contact-actions">
            <button class="action-btn" title="Open Chat" onclick="openMessageModal('${contact.phone}', '${contact.id}', '${displayTime}')">
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
            </button>
            <button class="action-btn" title="Forward to WhatsApp" onclick="openWhatsApp('${contact.phone}', 'audio', '', '${contact.id}', '${displayTime}')">
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.21c.28-.26.36-.65.25-1C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1zM19 12h2c0-4.97-4.03-9-9-9v2c3.87 0 7 3.13 7 7zm-4 0h2c0-2.76-2.24-5-5-5v2c1.66 0 3 1.34 3 3z"/></svg>
            </button>
            <button class="action-btn" title="Edit" onclick="editContact('${contact.id}'); event.stopPropagation();">
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            <button class="action-btn" title="Delete" onclick="deleteContact('${contact.id}'); event.stopPropagation();">
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
            </button>
        </div>` : ''}
    `;
    return card;
}

function formatSchedule(contact) {
    if (!contact.freq) return '';

    // Format Times
    const times = contact.times || (contact.time ? [contact.time] : []);
    const timeStr = times.length > 0 ? ` • ${times.join(', ')}` : '';

    if (contact.freq === 'daily') return `Daily${timeStr}`;
    if (contact.freq === '2_day') return `2 times a day${timeStr}`;
    if (contact.freq === '3_day') return `3 times a day${timeStr}`;

    if (contact.freq === 'weekly') {
        const daysMap = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat' };
        // Handle both old single 'day' and new array 'days'
        const rawDays = contact.days && contact.days.length > 0 ? contact.days : (contact.day ? [contact.day] : []);

        if (rawDays.length === 0) return `Weekly${timeStr}`;

        // Sort days (Mon=1 to Sun=0/7 logic if needed, but simple string sort is okay-ish, better to sort by int value)
        // Let's sort 1-6 then 0
        const sortedDays = [...rawDays].sort((a, b) => {
            const da = parseInt(a) === 0 ? 7 : parseInt(a);
            const db = parseInt(b) === 0 ? 7 : parseInt(b);
            return da - db;
        });

        const dayNames = sortedDays.map(d => daysMap[d]);
        return `Weekly (${dayNames.join(', ')})${timeStr}`;
    }

    if (contact.freq === 'monthly') {
        const rawDates = contact.monthDays && contact.monthDays.length > 0 ? contact.monthDays : (contact.monthDay ? [contact.monthDay] : []);
        if (rawDates.length === 0) return `Monthly${timeStr}`;

        const sortedDates = [...rawDates].sort((a, b) => parseInt(a) - parseInt(b));

        // Add ordinal suffix logic? e.g. 1st, 2nd. 
        // Simple mapping for display
        const dateStr = sortedDates.join(', ');
        return `Monthly (${dateStr})${timeStr}`;
    }

    return contact.freq + timeStr;
}

function renderContacts(filterText = '') {
    const list = document.getElementById('contactsList');
    list.innerHTML = '';

    let filtered = contacts.filter(c =>
        c.name.toLowerCase().includes(filterText) ||
        c.phone.includes(filterText)
    );

    // Apply Frequency Filter
    if (currentContactFilter !== 'all') {
        filtered = filtered.filter(c => c.freq === currentContactFilter);
    }

    // Apply Sorting
    filtered.sort((a, b) => {
        if (contactSortMode === 'asc') return a.name.localeCompare(b.name);
        if (contactSortMode === 'desc') return b.name.localeCompare(a.name);

        if (contactSortMode === 'day') {
            // Priority: Weekly > Daily > Others
            // Within Weekly: Mon(1) -> Sun(0/7)
            const getDayVal = (c) => {
                if (c.freq !== 'weekly') return 999;
                const d = c.days && c.days[0] ? parseInt(c.days[0]) : (c.day ? parseInt(c.day) : 99);
                return d === 0 ? 7 : d;
            };
            const valA = getDayVal(a);
            const valB = getDayVal(b);
            if (valA !== valB) return valA - valB;
            return a.name.localeCompare(b.name);
        }

        if (contactSortMode === 'date') {
            // Priority: Monthly > Daily > Others
            // Within Monthly: 1 -> 31
            const getDateVal = (c) => {
                if (c.freq !== 'monthly') return 999;
                return c.monthDays && c.monthDays[0] ? parseInt(c.monthDays[0]) : (c.monthDay ? parseInt(c.monthDay) : 99);
            };
            const valA = getDateVal(a);
            const valB = getDateVal(b);
            if (valA !== valB) return valA - valB;
            return a.name.localeCompare(b.name);
        }

        return a.name.localeCompare(b.name);
    });

    filtered.forEach(c => {
        list.appendChild(createContactCard(c));
    });
}

function renderDashboard(filterText = '') {
    const list = document.getElementById('dashboardList');
    list.innerHTML = '';

    const now = new Date();
    const currentDay = now.getDay().toString();
    const currentMonthDay = now.getDate().toString();

    let scheduledEntries = [];

    contacts.forEach(c => {
        const matchesSearch = c.name.toLowerCase().includes(filterText) || c.phone.includes(filterText);
        if (!matchesSearch) return;

        const times = c.times || [c.time || '09:00'];

        times.forEach(time => {
            let isDue = false;

            if (currentStatusFilter === 'today' || currentStatusFilter === 'now' || currentStatusFilter === 'pending' || currentStatusFilter === 'completed') {
                // For pending/completed, we default to showing Today's items unless we want ALL history.
                // Let's assume Pending/Completed applies to "Today" for relevance, or we can make it broader.
                // User requirement: "Filters... pending, complete". Usually implies a todo list view.
                // Let's make Pending/Completed act like "Today" but filtered by status.

                if (c.freq === 'daily' || c.freq === '2_day' || c.freq === '3_day') isDue = true;
                else if (c.freq === 'weekly') {
                    const days = c.days || (c.day ? [c.day] : []);
                    if (days.includes(currentDay)) isDue = true;
                }
                else if (c.freq === 'monthly') {
                    const monthDays = c.monthDays || (c.monthDay ? [c.monthDay] : []);
                    if (monthDays.includes(currentMonthDay)) isDue = true;
                }

                if (isDue && currentStatusFilter === 'now') {
                    const [hours, minutes] = time.split(':').map(Number);
                    const contactTime = new Date();
                    contactTime.setHours(hours, minutes, 0, 0);
                    const diff = (contactTime - now) / (1000 * 60 * 60);
                    isDue = (diff >= -1 && diff <= 2);
                }
            } else if (currentStatusFilter === 'next_day') {
                const tomorrow = new Date(now);
                tomorrow.setDate(now.getDate() + 1);
                const tomDay = tomorrow.getDay().toString();
                const tomMonthDay = tomorrow.getDate().toString();

                if (c.freq === 'daily' || c.freq === '2_day' || c.freq === '3_day') isDue = true;
                else if (c.freq === 'weekly') {
                    const days = c.days || (c.day ? [c.day] : []);
                    if (days.includes(tomDay)) isDue = true;
                }
                else if (c.freq === 'monthly') {
                    const monthDays = c.monthDays || (c.monthDay ? [c.monthDay] : []);
                    if (monthDays.includes(tomMonthDay)) isDue = true;
                }
            } else if (currentStatusFilter === 'week') {
                if (c.freq !== 'monthly') isDue = true;
                else {
                    // Check if ANY monthDay is within next 7 days
                    const monthDays = c.monthDays || (c.monthDay ? [c.monthDay] : []);

                    for (let i = 0; i < 7; i++) {
                        const d = new Date(now);
                        d.setDate(now.getDate() + i);
                        if (monthDays.includes(d.getDate().toString())) {
                            isDue = true;
                            break;
                        }
                    }
                }
            } else if (currentStatusFilter === 'month') {
                isDue = true;
            }

            if (isDue) {
                // Apply Pending/Completed filter on the generated entries
                const todayStr = new Date().toISOString().split('T')[0];
                const entryKey = `${c.id}_${time}_${todayStr}`;
                const isDone = completedActions[entryKey];

                if (currentStatusFilter === 'pending' && isDone) return;
                if (currentStatusFilter === 'completed' && !isDone) return;

                scheduledEntries.push({ ...c, _displayTime: time });
            }
        });
    });

    // Sort by Logic
    scheduledEntries.sort((a, b) => {
        if (dashboardSortMode === 'time') {
            return a._displayTime.localeCompare(b._displayTime);
        } else if (dashboardSortMode === 'asc') {
            return a.name.localeCompare(b.name);
        } else {
            return b.name.localeCompare(a.name);
        }
    });

    if (scheduledEntries.length === 0) {
        let msg = 'No contacts scheduled.';
        if (currentStatusFilter === 'today') msg = 'No contacts scheduled for today.';
        if (currentStatusFilter === 'now') msg = 'No contacts scheduled for right now.';
        if (currentStatusFilter === 'next_day') msg = 'No contacts scheduled for tomorrow.';
        if (currentStatusFilter === 'pending') msg = 'All caught up! No pending tasks.';
        if (currentStatusFilter === 'completed') msg = 'No completed tasks yet today.';

        list.innerHTML = `<p style="padding: 20px; text-align: center; color: var(--wa-text-secondary);">${filterText ? 'No results found.' : msg}</p>`;
    }

    scheduledEntries.forEach(c => {
        list.appendChild(createContactCard(c));
    });
}

function renderRandomToday() {
    const list = document.getElementById('randomList');
    list.innerHTML = '';

    // Use a persistent random seed for "today" unless refreshed
    const today = new Date().toDateString();
    let seedValue = 0;
    for (let i = 0; i < today.length; i++) seedValue += today.charCodeAt(i);

    // Add custom refresh seed
    const customSeed = localStorage.getItem('wa_random_seed') || '0';
    seedValue += parseInt(customSeed);

    const shuffled = [...contacts].sort(() => {
        seedValue = (seedValue * 9301 + 49297) % 233280;
        return (seedValue / 233280) - 0.5;
    });

    const selected = shuffled.slice(0, 5);

    if (selected.length === 0) {
        list.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--wa-text-secondary);">Add contacts first!</p>';
    }

    selected.forEach(c => {
        list.appendChild(createContactCard(c));
    });
}

function refreshRandom() {
    const newSeed = Math.floor(Math.random() * 10000);
    localStorage.setItem('wa_random_seed', newSeed.toString());
    renderRandomToday();

    // Tiny feedback animation on the refresh icon if it existed
    const refreshBtn = document.querySelector('.refresh-icon-btn');
    if (refreshBtn) {
        refreshBtn.classList.add('rotating');
        setTimeout(() => refreshBtn.classList.remove('rotating'), 500);
    }
}

// --- WhatsApp Deep Links ---
function openWhatsApp(phone, type, text = '', contactId = null, displayTime = null) {
    const cleanPhone = phone.replace(/\D/g, '');
    let url = '';

    if (type === 'audio' || type === 'video') {
        // Opens WhatsApp chat (wa.me is most reliable)
        url = `https://wa.me/${cleanPhone}`;
    } else {
        const encodedText = encodeURIComponent(text);
        url = `https://wa.me/${cleanPhone}${text ? `?text=${encodedText}` : ''}`;
    }

    // Open WhatsApp
    window.open(url, '_blank');

    // THEN mark as completed (only for audio/video calls)
    if ((type === 'audio' || type === 'video') && contactId && displayTime) {
        markAsCompleted(contactId, displayTime);
    }
}

let currentActiveEntry = { id: null, time: null };

// Quick Message Modal Logic
function openMessageModal(phone, contactId, displayTime) {
    currentActivePhone = phone;
    currentActiveEntry = { id: contactId, time: displayTime };
    document.getElementById('messageModal').style.display = 'flex';
    document.getElementById('quickMessageText').value = '';
    renderPresetMessages(); // Render presets when modal opens
    document.getElementById('quickMessageText').focus();
}

function closeMessageModal() {
    document.getElementById('messageModal').style.display = 'none';
    currentActivePhone = '';
    currentActiveEntry = { id: null, time: null };
}

function sendQuickMessage() {
    const text = document.getElementById('quickMessageText').value.trim();
    if (!text) {
        alert('Please type a message first.');
        return;
    }

    // Open WhatsApp FIRST with pre-filled message
    openWhatsApp(currentActivePhone, 'text', text);

    // THEN mark as completed
    if (currentActiveEntry.id && currentActiveEntry.time) {
        markAsCompleted(currentActiveEntry.id, currentActiveEntry.time);
    }

    closeMessageModal();
}

// --- Preset Messages Management ---
let presetMessages = JSON.parse(localStorage.getItem('wa_preset_messages')) || [];

function savePresetMessages() {
    localStorage.setItem('wa_preset_messages', JSON.stringify(presetMessages));
}

function renderPresetMessages() {
    const container = document.getElementById('presetMessagesContainer');
    if (!container) return;

    container.innerHTML = '';

    presetMessages.forEach((msg, index) => {
        const card = document.createElement('div');
        card.className = 'preset-message-card';
        card.onclick = () => selectPresetMessage(msg);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'preset-remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removePresetMessage(index);
        };

        card.textContent = msg;
        card.appendChild(removeBtn);
        container.appendChild(card);
    });
}

function addNewPreset() {
    const message = prompt('Enter your preset message:');
    if (message && message.trim()) {
        presetMessages.push(message.trim());
        savePresetMessages();
        renderPresetMessages();
    }
}

function removePresetMessage(index) {
    presetMessages.splice(index, 1);
    savePresetMessages();
    renderPresetMessages();
}

function selectPresetMessage(message) {
    document.getElementById('quickMessageText').value = message;
}

function markAsCompleted(contactId, displayTime) {
    const todayStr = new Date().toISOString().split('T')[0];
    const entryKey = `${contactId}_${displayTime}_${todayStr}`;
    completedActions[entryKey] = Date.now(); // Store timestamp instead of true
    localStorage.setItem('wa_completed_actions', JSON.stringify(completedActions));
    setActiveTab(currentTab); // Re-render
}

function toggleCompletion(contactId, displayTime, event) {
    if (event) event.stopPropagation(); // Prevent card click

    const todayStr = new Date().toISOString().split('T')[0];
    const entryKey = `${contactId}_${displayTime}_${todayStr}`;

    if (completedActions[entryKey]) {
        // Remove completion
        delete completedActions[entryKey];
    } else {
        // Mark as completed
        completedActions[entryKey] = Date.now();
    }

    localStorage.setItem('wa_completed_actions', JSON.stringify(completedActions));
    setActiveTab(currentTab); // Re-render
}

// --- Settings Actions ---
document.getElementById('themeToggle').addEventListener('click', () => {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wa_theme', theme);
    document.getElementById('themeToggle').textContent = theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
});

document.getElementById('notificationPermission').addEventListener('click', async () => {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            alert('Notifications enabled!');
        }
    }
});

// --- Manage Tab Logic ---
let manageSelection = []; // IDs of selected contacts in Manage tab

function renderManage() {
    // initialize listeners only once? checking existence effectively does this or rely on replacement
    // Trigger initial list render
    renderManageList();
}

// Manage Inputs Listeners
const manageFreq = document.getElementById('manageFreq');

if (manageFreq) {
    manageFreq.addEventListener('change', () => {
        const val = manageFreq.value;
        const isWeekly = val === 'weekly';
        const isMonthly = val === 'monthly';
        const isXDay = val === '2_day' || val === '3_day';

        document.getElementById('manageWeeklyInput').style.display = isWeekly ? 'block' : 'none';
        document.getElementById('manageMonthlyInput').style.display = isMonthly ? 'block' : 'none';

        if (isWeekly) {
            const container = document.getElementById('manageWeeklyDaysContainer');
            if (container.children.length === 0) addWeeklyDay(1, 'manageWeeklyDaysContainer', 'manage-weekly-day-select');
        }
        if (isMonthly) {
            const container = document.getElementById('manageMonthlyDaysContainer');
            if (container.children.length === 0) addMonthlyDay(1, 'manageMonthlyDaysContainer', 'manage-monthly-date-input');
        }

        // Times visibility
        document.getElementById('manageTimeGroup2').style.display = (val === '2_day' || val === '3_day') ? 'block' : 'none';
        document.getElementById('manageTimeGroup3').style.display = val === '3_day' ? 'block' : 'none';
        document.getElementById('manageTime1Label').textContent = isXDay ? 'Preferred Time 1' : 'Preferred Time';

        renderManageList();
    });

    // Add row buttons for manage
    document.getElementById('addManageWeeklyDayBtn').addEventListener('click', () => addWeeklyDay(1, 'manageWeeklyDaysContainer', 'manage-weekly-day-select'));
    document.getElementById('addManageMonthlyDayBtn').addEventListener('click', () => addMonthlyDay(1, 'manageMonthlyDaysContainer', 'manage-monthly-date-input'));

    [document.getElementById('manageTime1'),
    document.getElementById('manageTime2'),
    document.getElementById('manageTime3')
    ].forEach(el => {
        if (el) el.addEventListener('change', renderManageList);
    });
}

function renderManageList() {
    const list = document.getElementById('manageList');
    if (!list) return;
    list.innerHTML = '';

    // Get target schedule values
    const freq = manageFreq.value;

    // Collect selected days/dates/times from the UI
    const selectedWeekly = Array.from(document.querySelectorAll('.manage-weekly-day-select')).map(s => s.value);
    const selectedMonthly = Array.from(document.querySelectorAll('.manage-monthly-date-input')).map(i => i.value);
    const selectedTimes = [
        document.getElementById('manageTime1').value,
        document.getElementById('manageTime2').value,
        document.getElementById('manageTime3').value
    ].filter((t, i) => {
        if (i === 0) return true;
        if (i === 1) return freq === '2_day' || freq === '3_day';
        if (i === 2) return freq === '3_day';
        return false;
    });

    const showIncludedOnly = document.getElementById('manageShowIncludedOnly') ? document.getElementById('manageShowIncludedOnly').checked : false;

    let includedCount = 0;

    // Create a working copy of contacts
    let workingContacts = contacts.map(c => {
        // Check if included (matches the filter criteria in the Create Schedule box)
        let isIncluded = false;

        if (c.freq === freq) {
            const contactTimes = c.times || (c.time ? [c.time] : []);
            // Matches if ANY of the selected times are in the contact's times
            const matchesTime = selectedTimes.some(t => contactTimes.includes(t));

            if (freq === 'daily' || freq === '2_day' || freq === '3_day') {
                isIncluded = matchesTime;
            } else if (freq === 'weekly') {
                const cDays = c.days || (c.day ? [c.day] : []);
                // Matches if ANY of the selected days are in the contact's days AND time matches
                const matchesDay = selectedWeekly.some(d => cDays.includes(d));
                if (matchesDay && matchesTime) isIncluded = true;
            } else if (freq === 'monthly') {
                const cDates = c.monthDays || (c.monthDay ? [c.monthDay] : []);
                // Matches if ANY of the selected dates are in the contact's dates AND time matches
                const matchesDate = selectedMonthly.some(d => cDates.includes(d));
                if (matchesDate && matchesTime) isIncluded = true;
            }
        }

        if (isIncluded) includedCount++;

        return { ...c, _isIncluded: isIncluded };
    });

    // Filter if needed
    if (showIncludedOnly) {
        workingContacts = workingContacts.filter(c => c._isIncluded);
    }

    // Apply sorting based on manageSortMode
    workingContacts.sort((a, b) => {
        if (manageSortMode === 'asc') return a.name.localeCompare(b.name);
        if (manageSortMode === 'desc') return b.name.localeCompare(a.name);

        if (manageSortMode === 'day') {
            const getDayVal = (c) => {
                if (c.freq !== 'weekly') return 999;
                const d = c.days && c.days[0] ? parseInt(c.days[0]) : (c.day ? parseInt(c.day) : 99);
                return d === 0 ? 7 : d;
            };
            const valA = getDayVal(a);
            const valB = getDayVal(b);
            if (valA !== valB) return valA - valB;
            return a.name.localeCompare(b.name);
        }

        if (manageSortMode === 'date') {
            const getDateVal = (c) => {
                if (c.freq !== 'monthly') return 999;
                return c.monthDays && c.monthDays[0] ? parseInt(c.monthDays[0]) : (c.monthDay ? parseInt(c.monthDay) : 99);
            };
            const valA = getDateVal(a);
            const valB = getDateVal(b);
            if (valA !== valB) return valA - valB;
            return a.name.localeCompare(b.name);
        }

        return a.name.localeCompare(b.name);
    });

    // Render based on view mode
    if (manageViewMode === 'all') {
        // Flat list view
        workingContacts.forEach(c => {
            list.appendChild(createManageContactItem(c));
        });
    } else if (manageViewMode === 'by_day') {
        // Group by day of week
        const daysMap = { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' };
        const dayOrder = ['1', '2', '3', '4', '5', '6', '0']; // Mon-Sun

        const grouped = {};
        dayOrder.forEach(d => grouped[d] = []);
        grouped['other'] = []; // For non-weekly contacts

        workingContacts.forEach(c => {
            if (c.freq === 'weekly') {
                const cDays = c.days || (c.day ? [c.day] : []);
                cDays.forEach(d => {
                    if (grouped[d]) grouped[d].push(c);
                });
            } else {
                grouped['other'].push(c);
            }
        });

        // Render each group
        dayOrder.forEach(dayKey => {
            if (grouped[dayKey].length > 0) {
                const header = document.createElement('div');
                header.style.cssText = 'padding: 10px 15px; background: var(--wa-bg); font-weight: 600; font-size: 14px; color: var(--wa-text-secondary); border-bottom: 1px solid var(--wa-border);';
                header.textContent = `${daysMap[dayKey]} (${grouped[dayKey].length})`;
                list.appendChild(header);

                grouped[dayKey].forEach(c => {
                    list.appendChild(createManageContactItem(c));
                });
            }
        });

        // Other contacts (non-weekly)
        if (grouped['other'].length > 0) {
            const header = document.createElement('div');
            header.style.cssText = 'padding: 10px 15px; background: var(--wa-bg); font-weight: 600; font-size: 14px; color: var(--wa-text-secondary); border-bottom: 1px solid var(--wa-border);';
            header.textContent = `Other Frequencies (${grouped['other'].length})`;
            list.appendChild(header);

            grouped['other'].forEach(c => {
                list.appendChild(createManageContactItem(c));
            });
        }
    } else if (manageViewMode === 'by_date') {
        // Group by date of month
        const grouped = {};
        for (let i = 1; i <= 31; i++) {
            grouped[i.toString()] = [];
        }
        grouped['other'] = []; // For non-monthly contacts

        workingContacts.forEach(c => {
            if (c.freq === 'monthly') {
                const cDates = c.monthDays || (c.monthDay ? [c.monthDay] : []);
                cDates.forEach(d => {
                    if (grouped[d]) grouped[d].push(c);
                });
            } else {
                grouped['other'].push(c);
            }
        });

        // Render each group (only non-empty)
        for (let i = 1; i <= 31; i++) {
            const dateKey = i.toString();
            if (grouped[dateKey].length > 0) {
                const header = document.createElement('div');
                header.style.cssText = 'padding: 10px 15px; background: var(--wa-bg); font-weight: 600; font-size: 14px; color: var(--wa-text-secondary); border-bottom: 1px solid var(--wa-border);';
                const suffix = i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th';
                header.textContent = `${i}${suffix} of Month (${grouped[dateKey].length})`;
                list.appendChild(header);

                grouped[dateKey].forEach(c => {
                    list.appendChild(createManageContactItem(c));
                });
            }
        }

        // Other contacts (non-monthly)
        if (grouped['other'].length > 0) {
            const header = document.createElement('div');
            header.style.cssText = 'padding: 10px 15px; background: var(--wa-bg); font-weight: 600; font-size: 14px; color: var(--wa-text-secondary); border-bottom: 1px solid var(--wa-border);';
            header.textContent = `Other Frequencies (${grouped['other'].length})`;
            list.appendChild(header);

            grouped['other'].forEach(c => {
                list.appendChild(createManageContactItem(c));
            });
        }
    }

    document.getElementById('manageIncludedCount').textContent = includedCount;
}

// Helper function to create a manage contact item
function createManageContactItem(c) {
    const isSelected = manageSelection.includes(c.id);
    const isIncluded = c._isIncluded || false;

    const div = document.createElement('div');
    div.className = 'manage-list-item';
    div.onclick = (e) => {
        if (e.target.type !== 'checkbox' && !e.target.closest('.action-btn')) {
            const cb = div.querySelector('input');
            cb.checked = !cb.checked;
            toggleManageSelection(c.id);
        }
    };

    div.innerHTML = `
        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleManageSelection('${c.id}')" style="width: 18px; height: 18px; accent-color: var(--wa-green);">
        <div class="contact-img" style="width: 40px; height: 40px; min-width: 40px; min-height: 40px;">
            <img src="${c.img || defaultAvatars[0]}">
        </div>
        <div class="contact-info">
            <div class="contact-name" style="font-size: 15px;">${c.name}</div>
            <div class="contact-schedule">${formatSchedule(c)}</div>
        </div>
        <div class="contact-actions" style="margin-left: auto; display: flex; align-items: center; gap: 4px;">
            ${isIncluded ? '<span class="manage-tag included">Included</span>' : ''}
            <button class="action-btn" title="Open Chat" onclick="openMessageModal('${c.phone}', '${c.id}', ''); event.stopPropagation();">
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
            </button>
            <button class="action-btn" title="Forward to WhatsApp" onclick="openWhatsApp('${c.phone}', 'audio', '', '${c.id}', ''); event.stopPropagation();">
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.21c.28-.26.36-.65.25-1C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1zM19 12h2c0-4.97-4.03-9-9-9v2c3.87 0 7 3.13 7 7zm-4 0h2c0-2.76-2.24-5-5-5v2c1.66 0 3 1.34 3 3z"/></svg>
            </button>
            <button class="action-btn" title="Edit" onclick="editContact('${c.id}'); event.stopPropagation();">
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            <button class="action-btn" title="Delete" onclick="deleteContact('${c.id}'); event.stopPropagation();">
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
            </button>
        </div>
    `;
    return div;
}

// Add Listener for the new checkbox
const manageShowIncludedOnly = document.getElementById('manageShowIncludedOnly');
if (manageShowIncludedOnly) {
    manageShowIncludedOnly.addEventListener('change', renderManageList);
}


function toggleManageSelection(id) {
    if (manageSelection.includes(id)) {
        manageSelection = manageSelection.filter(sid => sid !== id);
    } else {
        manageSelection.push(id);
    }
}

document.getElementById('applyScheduleBtn').addEventListener('click', () => {
    if (manageSelection.length === 0) {
        alert('Please select contacts to update.');
        return;
    }

    const freq = manageFreq.value;

    // Collect Weekly Days
    const weeklySelects = document.querySelectorAll('.manage-weekly-day-select');
    const selectedDays = Array.from(weeklySelects).map(s => s.value);

    // Collect Monthly Dates
    const monthlyInputs = document.querySelectorAll('.manage-monthly-date-input');
    const selectedDates = Array.from(monthlyInputs).map(i => i.value);

    // Collect all active times based on frequency
    const times = [
        document.getElementById('manageTime1').value,
        document.getElementById('manageTime2').value,
        document.getElementById('manageTime3').value
    ].filter((t, i) => {
        if (i === 0) return true;
        if (i === 1) return freq === '2_day' || freq === '3_day';
        if (i === 2) return freq === '3_day';
        return false;
    });

    if (!confirm(`Apply this schedule to ${manageSelection.length} contacts? This will replace their existing schedules.`)) return;

    contacts.forEach(c => {
        if (!manageSelection.includes(c.id)) return;

        // Overwrite always (as requested: "remove old day or dates")
        c.freq = freq;
        c.times = [...times];

        if (freq === 'weekly') {
            c.days = selectedDays.length > 0 ? selectedDays : ['1'];
            c.monthDays = []; // Clear other type
        } else if (freq === 'monthly') {
            c.monthDays = selectedDates.length > 0 ? selectedDates : ['1'];
            c.days = []; // Clear other type
        } else {
            // Daily etc
            c.days = [];
            c.monthDays = [];
        }
    });

    saveContacts();
    renderManageList();
    alert('Schedule updated!');
    manageSelection = []; // Clear selection? Or keep?
    // Keep selection for ease of multiple edits? Defaults to keep is safer UI wise maybe.
    // Re-render will check boxes if id in list.
});
let deferredPrompt;
const installAppBtn = document.getElementById('installApp');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installAppBtn.style.display = 'flex';
});

installAppBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            installAppBtn.style.display = 'none';
            deferredPrompt = null;
        }
    }
});

window.addEventListener('appinstalled', () => {
    installAppBtn.style.display = 'none';
    deferredPrompt = null;
});
// --- Settings & Menu Actions ---
document.getElementById('refreshApp').addEventListener('click', () => {
    // Perform a hard refresh. 
    // Most modern browsers will refetch assets if location.reload() is called, 
    // but we can also try to force it via service worker update if needed.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => {
                registration.update();
            });
            window.location.reload();
        });
    } else {
        window.location.reload();
    }
});

document.getElementById('exportData').addEventListener('click', () => {
    if (contacts.length === 0) return alert('No contacts to export.');
    const csvRows = [
        'id,name,phone,freq,day,time',
        ...contacts.map(c => [c.id, c.name, c.phone, c.freq, c.day, c.time].join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp_contacts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
});

// --- Import Logic ---
const importFile = document.getElementById('importFile');
const importPreview = document.getElementById('importPreview');
const importConfirmContainer = document.getElementById('importConfirmContainer');
let tempImportedContacts = [];

importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        file.name.endsWith('.csv') ? parseCSV(event.target.result) : parseVCF(event.target.result);
    };
    reader.readAsText(file);
});

function parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return alert('File is empty.');

    const imported = [];
    const splitLine = (l) => l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.trim().replace(/^"|"$/g, ''));

    // Header detection
    let startIndex = 0;
    const firstLine = splitLine(lines[0]);
    const hasHeader = firstLine.some(f => /name|phone|contact|tel/i.test(f));
    if (hasHeader) startIndex = 1;

    for (let i = startIndex; i < lines.length; i++) {
        const p = splitLine(lines[i]);
        if (p.length >= 2) {
            // Find which column is most likely the phone number (at least 7 digits)
            let phoneIdx = -1;
            for (let j = 0; j < p.length; j++) {
                if (p[j].replace(/\D/g, '').length >= 7) {
                    phoneIdx = j;
                    break;
                }
            }

            if (phoneIdx !== -1) {
                let phone = p[phoneIdx];
                // Combine other columns for the name
                let otherCols = p.filter((_, idx) => idx !== phoneIdx).filter(val => val.length > 0);
                let name = otherCols.length > 0 ? otherCols.join(' ') : 'Unknown';

                imported.push({
                    id: 'import_' + Date.now() + '_' + i,
                    name: name.substring(0, 50),
                    phone: phone.replace(/\D/g, ''),
                    freq: 'daily',
                    time: '10:00', // Default time
                    times: ['10:00'],
                    lastActed: Date.now(),
                    img: defaultAvatars[Math.floor(Math.random() * 20)],
                    days: [],
                    monthDays: []
                });
            }
        }
    }

    if (imported.length === 0) {
        alert('No valid contacts found in CSV. Expected format: Name, Phone (or Phone, Name)');
    } else {
        showImportPreview(imported);
    }
}

function parseVCF(content) {
    const imported = content.split('BEGIN:VCARD').filter(v => v.trim()).map((vcard, index) => {
        const nm = vcard.match(/FN:(.*)/) || vcard.match(/N:(.*)/);
        const tl = vcard.match(/TEL.*:(.*)/);
        if (nm && tl) {
            let name = nm[1].trim().replace(/;/g, ' ').trim();
            return {
                id: 'import_vcf_' + Date.now() + '_' + index,
                name: name || 'Unknown',
                phone: tl[1].trim().replace(/\D/g, ''),
                freq: 'daily',
                time: '10:00',
                times: ['10:00'],
                lastActed: Date.now(),
                img: defaultAvatars[Math.floor(Math.random() * 20)],
                days: [],
                monthDays: []
            };
        }
        return null;
    }).filter(x => x);

    if (imported.length === 0) {
        alert('No valid contacts found in VCF file.');
    } else {
        showImportPreview(imported);
    }
}

function showImportPreview(imported) {
    tempImportedContacts = imported;
    importPreview.innerHTML = '<h3 style="padding: 15px;">Preview (Top 10)</h3>';
    imported.slice(0, 10).forEach(c => importPreview.appendChild(createContactCard(c, false)));
    importConfirmContainer.style.display = 'block';
}

document.getElementById('saveImported').addEventListener('click', () => {
    contacts = [...contacts, ...tempImportedContacts];
    saveContacts();
    alert(`Imported ${tempImportedContacts.length} contacts!`);
    importPreview.innerHTML = '';
    importConfirmContainer.style.display = 'none';
    setActiveTab('contacts');
});

// --- Bulk Messaging Logic ---
function toggleSelectEntryById(id, time) {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;

    const entry = {
        id: id,
        time: time,
        phone: contact.phone,
        name: contact.name
    };

    const index = selectedEntries.findIndex(e => e.id === id && e.time === time);
    if (index === -1) {
        selectedEntries.push(entry);
    } else {
        selectedEntries.splice(index, 1);
    }
    updateBulkBar();
    setActiveTab(currentTab);
}

function toggleSelectEntry(contact) {
    toggleSelectEntryById(contact.id, contact._displayTime);
}

function updateBulkBar() {
    const bar = document.getElementById('bulkActionBar');
    const countSpan = document.getElementById('selectedCount');
    countSpan.textContent = selectedEntries.length;
    bar.style.display = selectedEntries.length > 0 ? 'flex' : 'none';
}

function selectAll() {
    let containerId = '';
    if (currentTab === 'dashboard') containerId = 'dashboardList';
    else if (currentTab === 'contacts') containerId = 'contactsList';
    else return;

    const cards = document.querySelectorAll(`#${containerId} .contact-card`);
    let changed = false;

    cards.forEach(card => {
        const id = card.dataset.id;
        const time = card.dataset.time; // This comes as string from DOM ('Time' or '')

        // Normalize time (already empty string if undefined usually, but DOM uses empty string for '')
        const timeCheck = time || '';

        // Check if already selected
        const exists = selectedEntries.some(e => e.id === id && (e.time || '') === timeCheck);

        if (!exists) {
            // Need name/phone to prevent null references in other functions
            // It's safer to get from dataset which we added
            selectedEntries.push({
                id: id,
                time: timeCheck,
                phone: card.dataset.phone || '',
                name: card.dataset.name || ''
            });
            changed = true;
        }
    });

    if (changed) {
        updateBulkBar();
        setActiveTab(currentTab);
    }
}

function clearSelection() {
    selectedEntries = [];
    updateBulkBar();
    setActiveTab(currentTab);
}

function deleteSelectedEntries() {
    if (selectedEntries.length === 0) return;

    const count = new Set(selectedEntries.map(e => e.id)).size;
    if (confirm(`Are you sure you want to delete ${count} selected contact(s)?`)) {
        const idsToDelete = new Set(selectedEntries.map(e => e.id));
        contacts = contacts.filter(c => !idsToDelete.has(c.id));
        saveContacts();
        clearSelection();
        alert(`Deleted ${count} contact(s).`);
    }
}

// Bulk Modal & Sequential Sender
let bulkQueue = [];
let bulkMessageTextGlobal = '';

function openBulkMessageModal() {
    document.getElementById('bulkMessageModal').style.display = 'flex';
    document.getElementById('bulkTotal').textContent = selectedEntries.length;
    document.getElementById('bulkMessageText').value = '';

    document.getElementById('bulkMessageInputGroup').style.display = 'block';
    document.getElementById('bulkInitialBtns').style.display = 'flex';
    document.getElementById('bulkSendingStatus').style.display = 'none';
    document.getElementById('bulkFinishedBtns').style.display = 'none';
    document.getElementById('bulkProgressInfo').textContent = `Ready to send to ${selectedEntries.length} contacts.`;
}

function closeBulkMessageModal() {
    document.getElementById('bulkMessageModal').style.display = 'none';
    bulkQueue = [];
}

function startBulkSend() {
    bulkMessageTextGlobal = document.getElementById('bulkMessageText').value.trim();
    if (!bulkMessageTextGlobal) {
        alert('Please type a message.');
        return;
    }

    bulkQueue = [...selectedEntries];

    document.getElementById('bulkMessageInputGroup').style.display = 'none';
    document.getElementById('bulkInitialBtns').style.display = 'none';
    document.getElementById('bulkSendingStatus').style.display = 'block';

    sendNextInQueue();
}

function sendNextInQueue() {
    if (bulkQueue.length === 0) {
        finishBulkSend();
        return;
    }

    const current = bulkQueue[0];
    document.getElementById('bulkCurrentContactName').textContent = current.name;
    document.getElementById('bulkProgressInfo').textContent = `Progress: ${selectedEntries.length - bulkQueue.length + 1} / ${selectedEntries.length}`;

    openWhatsApp(current.phone, 'text', bulkMessageTextGlobal, current.id, current.time);

    bulkQueue.shift();

    if (bulkQueue.length === 0) {
        document.getElementById('btnSendNext').textContent = 'Finish';
    } else {
        document.getElementById('btnSendNext').textContent = 'Send Next Contact';
    }
}

function finishBulkSend() {
    document.getElementById('bulkSendingStatus').style.display = 'none';
    document.getElementById('bulkFinishedBtns').style.display = 'flex';
    document.getElementById('bulkProgressInfo').textContent = 'All messages sent!';
    clearSelection();
}

// Initial Load
initAvatarGallery();
renderDashboard();
document.getElementById('themeToggle').textContent = theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';

// --- Bulk Edit Logic ---
const bulkEditModal = document.getElementById('bulkEditModal');
const bulkEditForm = document.getElementById('bulkEditForm');
const bulkFreq = document.getElementById('bulkFreq');
const bulkImgInput = document.getElementById('bulkImg');
const bulkPreviewImg = document.getElementById('bulkPreviewImg');
const bulkNoImgRaw = document.getElementById('bulkNoImgRaw');

function openBulkEditModal() {
    if (selectedEntries.length === 0) return alert('No contacts selected.');

    document.getElementById('bulkEditCount').textContent = selectedEntries.length;
    bulkEditForm.reset();
    clearBulkAvatar();

    // Hide dynamic fields initially
    document.getElementById('bulkWeeklyOptions').style.display = 'none';
    document.getElementById('bulkMonthlyOptions').style.display = 'none';
    document.getElementById('bulkTime2Group').style.display = 'none';
    document.getElementById('bulkTime3Group').style.display = 'none';
    document.getElementById('bulkWeeklyDaysContainer').innerHTML = '';
    document.getElementById('bulkMonthlyDaysContainer').innerHTML = '';

    bulkEditModal.style.display = 'flex';
}

function closeBulkEditModal() {
    bulkEditModal.style.display = 'none';
}

// Bulk Avatar Logic
document.getElementById('btnBulkSelectAvatar').addEventListener('click', () => {
    // Pick random one for simplicity as per plan
    const randomAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];
    setBulkAvatar(randomAvatar);
});

function setBulkAvatar(url) {
    bulkImgInput.value = url;
    bulkPreviewImg.src = url;
    bulkPreviewImg.style.display = 'block';
    bulkNoImgRaw.style.display = 'none';
}

function clearBulkAvatar() {
    bulkImgInput.value = '';
    bulkPreviewImg.src = '';
    bulkPreviewImg.style.display = 'none';
    bulkNoImgRaw.style.display = 'block';
}

// Bulk Frequency Logic
bulkFreq.addEventListener('change', () => {
    const freq = bulkFreq.value;
    const weeklyOpts = document.getElementById('bulkWeeklyOptions');
    const monthlyOpts = document.getElementById('bulkMonthlyOptions');

    weeklyOpts.style.display = freq === 'weekly' ? 'block' : 'none';
    monthlyOpts.style.display = freq === 'monthly' ? 'block' : 'none';

    document.getElementById('bulkTime2Group').style.display = (freq === '2_day' || freq === '3_day') ? 'block' : 'none';
    document.getElementById('bulkTime3Group').style.display = freq === '3_day' ? 'block' : 'none';

    // Auto-add one field if empty
    if (freq === 'weekly' && document.getElementById('bulkWeeklyDaysContainer').children.length === 0) {
        addBulkWeeklyDay();
    }
    if (freq === 'monthly' && document.getElementById('bulkMonthlyDaysContainer').children.length === 0) {
        addBulkMonthlyDay();
    }
});

document.getElementById('addBulkWeeklyDayBtn').addEventListener('click', () => addBulkWeeklyDay());
document.getElementById('addBulkMonthlyDayBtn').addEventListener('click', () => addBulkMonthlyDay());

function addBulkWeeklyDay() {
    const container = document.getElementById('bulkWeeklyDaysContainer');
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.style.display = 'flex';
    div.style.gap = '10px';
    div.style.marginBottom = '5px';
    div.innerHTML = `
        <button type="button" class="btn-remove-small" onclick="this.parentElement.remove()" style="background: var(--wa-red); color: white; border: none; border-radius: 4px; padding: 0 10px;">×</button>
        <select class="bulk-weekly-day-select" style="flex: 1;">
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
            <option value="0">Sunday</option>
        </select>
    `;
    container.appendChild(div);
}

function addBulkMonthlyDay() {
    const container = document.getElementById('bulkMonthlyDaysContainer');
    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.style.display = 'flex';
    div.style.gap = '10px';
    div.style.marginBottom = '5px';
    div.innerHTML = `
        <button type="button" class="btn-remove-small" onclick="this.parentElement.remove()" style="background: var(--wa-red); color: white; border: none; border-radius: 4px; padding: 0 10px;">×</button>
        <input type="number" class="bulk-monthly-date-input" min="1" max="31" value="1" style="flex: 1;">
    `;
    container.appendChild(div);
}

// Bulk Save
bulkEditForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const newName = document.getElementById('bulkName').value.trim();
    const newImg = bulkImgInput.value;
    const newFreq = bulkFreq.value;

    const newTime1 = document.getElementById('bulkTime1').value;
    const newTime2 = document.getElementById('bulkTime2').value;
    const newTime3 = document.getElementById('bulkTime3').value;

    let newDays = [];
    let newMonthDays = [];

    if (newFreq === 'weekly') {
        document.querySelectorAll('.bulk-weekly-day-select').forEach(s => newDays.push(s.value));
    }
    if (newFreq === 'monthly') {
        document.querySelectorAll('.bulk-monthly-date-input').forEach(i => newMonthDays.push(i.value));
    }

    const idsToUpdate = new Set(selectedEntries.map(e => e.id));
    let updatedCount = 0;

    contacts.forEach(c => {
        if (idsToUpdate.has(c.id)) {
            updatedCount++;

            if (newName) c.name = newName;
            if (newImg) c.img = newImg;

            if (newFreq) {
                c.freq = newFreq;
                if (newFreq === 'weekly') c.days = newDays;
                if (newFreq === 'monthly') c.monthDays = newMonthDays;
            }

            let currentTimes = c.times || [c.time];

            if (newTime1) currentTimes[0] = newTime1;
            if (newTime2) currentTimes[1] = newTime2;
            if (newTime3) currentTimes[2] = newTime3;

            const freqToCheck = newFreq || c.freq;

            c.times = currentTimes.filter((t, i) => {
                if (i === 0) return true;
                if (i === 1) return freqToCheck === '2_day' || freqToCheck === '3_day';
                if (i === 2) return freqToCheck === '3_day';
                return false;
            });
            c.time = c.times[0];
        }
    });

    saveContacts();
    closeBulkEditModal();
    clearSelection();
    alert(`Updated ${updatedCount} contacts.`);
});

// --- Drag to Scroll for Status Filters ---
function initDragScroll() {
    const scrollContainers = document.querySelectorAll('.status-filters');

    scrollContainers.forEach(container => {
        let isDown = false;
        let startX;
        let scrollLeft;
        let hasDragged = false;

        container.addEventListener('mousedown', (e) => {
            isDown = true;
            container.style.cursor = 'grabbing';
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
            hasDragged = false;
        });

        container.addEventListener('mouseleave', () => {
            isDown = false;
            container.style.cursor = 'default';
        });

        container.addEventListener('mouseup', () => {
            isDown = false;
            container.style.cursor = 'default';
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 2; // Scroll speed multiplier
            if (Math.abs(walk) > 2) {
                hasDragged = true;
            }
            container.scrollLeft = scrollLeft - walk;
            e.preventDefault();
        });

        // Prevent clicking buttons if dragged
        container.addEventListener('click', (e) => {
            if (hasDragged) {
                e.stopImmediatePropagation();
                e.preventDefault();
            }
        }, true);
    });
}

// Initialize
initDragScroll();
