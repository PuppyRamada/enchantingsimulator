document.addEventListener('DOMContentLoaded', () => {
    console.log('Running new script version 1.1...');
    // --- Constants and State ---
    const API_BASE_URL = 'https://www.osrsbox.com/osrsbox-db/items-icons/';
    const SLOT_MAP = {
        'HEAD': 'head', 'CAPE': 'cape', 'NECK': 'neck', 'WEAPON': 'weapon',
        'BODY': 'body', 'SHIELD': 'shield', 'LEGS': 'legs', 'HANDS': 'hands',
        'FEET': 'feet', 'RING': 'ring'
    };
    const ITEMS_PER_PAGE = 50;

    let allItems = [];
    let allEnchantments = [];
    
    const state = {
        selectedItem: null,
        activeEnchantments: [],
        detailsViewMode: 'current', // 'current' or 'all'
        selectedSlot: 'head',
        currentPage: 0,
        searchTerm: '',
        orbCounts: { annul: 0, annex: 0, turmoil: 0, falter: 0 },
    };

    // --- DOM Element Cache ---
    const dom = {
        loader: document.getElementById('loader'),
        mainContent: document.getElementById('main-content'),
        slotButtonsContainer: document.getElementById('slot-buttons-container'),
        itemGrid: document.getElementById('item-grid'),
        paginationContainer: document.getElementById('pagination-container'),
        searchBar: document.getElementById('search-bar'),
        detailsPanel: document.getElementById('details-panel'),
        detailsPlaceholder: document.getElementById('details-placeholder'),
        detailsContent: document.getElementById('details-content'),
        detailsItemName: document.getElementById('details-item-name'),
        detailsItemIcon: document.getElementById('details-item-icon'),
        orbsContainer: document.getElementById('orbs-container'),
        enchantmentsTitle: document.getElementById('enchantments-title'),
        enchantmentList: document.getElementById('enchantment-list'),
    };

    // --- Initialization ---
    async function init() {
        try {
            const [itemsResponse, enchantmentsResponse] = await Promise.all([
                fetch('items.json'),
                fetch('enchantments.json')
            ]);
            
            if (!itemsResponse.ok || !enchantmentsResponse.ok) {
                throw new Error('Network response was not ok.');
            }

            allItems = Object.values(await itemsResponse.json());
            allEnchantments = await enchantmentsResponse.json();

            // Pre-process enchantments to add a baseName for family-checking
            allEnchantments.forEach(ench => {
                ench.baseName = ench.name.replace(/ (I|II|III|IV|V)$/, '').trim();
            });

            setupEventListeners();
            renderAll();
        } catch (error) {
            console.error('Error loading game data:', error);
            const mainContent = document.querySelector('.main-content');
            if(mainContent) {
                mainContent.innerHTML = `<p class="error" style="color: var(--error-color); text-align: center;">Error loading game data. Please try refreshing the page.</p>`;
            }
        }
    }
    
    // --- Event Listeners ---
    function setupEventListeners() {
        dom.slotButtonsContainer.addEventListener('click', handleSlotSelection);
        dom.searchBar.addEventListener('input', handleSearch);
        dom.prevPageButton.addEventListener('click', () => changePage(-1));
        dom.nextPageButton.addEventListener('click', () => changePage(1));
        dom.itemList.addEventListener('click', handleItemSelection);
        dom.enchantmentsTitle.addEventListener('click', toggleEnchantmentView);
        dom.orbsContainer.addEventListener('click', handleOrbApplication);
    }
    
    // --- Event Handlers ---
    function handleSlotSelection(e) {
        if (e.target.matches('.slot-button')) {
            state.selectedSlot = e.target.dataset.slot;
            state.currentPage = 0;
            state.searchTerm = '';
            dom.searchBar.value = '';
            renderAll();
        }
    }
    
    function handleSearch(e) {
        state.searchTerm = e.target.value.toLowerCase();
        state.currentPage = 0;
        renderItems();
        renderPagination();
    }

    function handleItemSelection(e) {
        const itemElement = e.target.closest('.item');
        if (itemElement) {
            const itemId = parseInt(itemElement.dataset.itemId, 10);
            state.selectedItem = allItems.find(item => item.id === itemId) || null;
            state.activeEnchantments = [];
            state.detailsViewMode = 'current';
            state.orbCounts = { annul: 0, annex: 0, turmoil: 0, falter: 0 };
            
            // Visually mark selected item
            document.querySelectorAll('.item.selected').forEach(el => el.classList.remove('selected'));
            itemElement.classList.add('selected');

            renderDetailsPanel();
        }
    }
    
    function handleOrbApplication(e) {
        if (e.target.matches('.orb-button')) {
            applyOrb(e.target.dataset.orbId);
        }
    }

    function changePage(direction) {
        state.currentPage += direction;
        renderItems();
        renderPagination();
    }
    
    function toggleEnchantmentView() {
        state.detailsViewMode = state.detailsViewMode === 'current' ? 'all' : 'current';
        renderDetailsPanel();
    }

    // --- Rendering ---
    function renderAll() {
        renderSlotButtons();
        renderItems();
        renderPagination();
        renderOrbs();
        renderDetailsPanel();
    }

    function renderSlotButtons() {
        dom.slotButtonsContainer.innerHTML = '';
        for (const key in SLOT_MAP) {
            const slot = SLOT_MAP[key];
            const button = document.createElement('button');
            button.textContent = key;
            button.dataset.slot = slot;
            button.className = `slot-button ${state.selectedSlot === slot ? 'active' : ''}`;
            dom.slotButtonsContainer.appendChild(button);
        }
    }

    function getFilteredItems() {
        return allItems
            .filter(item => item.equipable_by_player && item.equipment?.slot === state.selectedSlot)
            .filter(item => !state.searchTerm || item.name.toLowerCase().includes(state.searchTerm));
    }

    function renderItems() {
        dom.itemList.innerHTML = '';
        const filteredItems = getFilteredItems();
        const paginatedItems = filteredItems.slice(
            state.currentPage * ITEMS_PER_PAGE,
            (state.currentPage + 1) * ITEMS_PER_PAGE
        );

        if (paginatedItems.length === 0) {
            dom.itemList.innerHTML = '<p>No items found.</p>';
        } else {
            const fragment = document.createDocumentFragment();
            paginatedItems.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'item';
                itemEl.dataset.itemId = item.id;
                const iconUrl = `${API_BASE_URL}${item.id}.png`;
                itemEl.innerHTML = `<img src="${iconUrl}" alt="${item.name}"><span>${item.name}</span>`;
                fragment.appendChild(itemEl);
            });
            dom.itemList.appendChild(fragment);
        }
    }
    
    function renderPagination() {
        const filteredItems = getFilteredItems();
        const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
        state.currentPage = Math.max(0, Math.min(state.currentPage, totalPages - 1));

        dom.pageIndicator.textContent = `Page ${state.currentPage + 1} of ${totalPages || 1}`;
        dom.prevPageButton.disabled = state.currentPage === 0;
        dom.nextPageButton.disabled = state.currentPage >= totalPages - 1;

        const startNum = filteredItems.length > 0 ? (state.currentPage * ITEMS_PER_PAGE) + 1 : 0;
        const endNum = Math.min((state.currentPage + 1) * ITEMS_PER_PAGE, filteredItems.length);
        dom.itemListHeader.textContent = `Items (${startNum}-${endNum} of ${filteredItems.length})`;
    }

    function renderOrbs() {
        dom.orbsContainer.innerHTML = '';
        if (!state.selectedItem) return;

        ORBS.forEach(orb => {
            const wrapper = document.createElement('div');
            wrapper.className = 'orb-button-wrapper';

            const button = document.createElement('button');
            button.id = `${orb.id}-orb`;
            button.className = 'orb-button';
            button.dataset.orbId = orb.id;
            button.title = orb.name;
            
            const img = document.createElement('img');
            img.src = orb.icon;
            img.alt = orb.name;
            button.appendChild(img);

            const count = document.createElement('div');
            count.className = 'orb-count-value';
            count.id = `${orb.id}-orb-count`;
            count.textContent = state.orbCounts[orb.id] || 0;

            wrapper.appendChild(button);
            wrapper.appendChild(count);
            dom.orbsContainer.appendChild(wrapper);
        });
    }

    function renderOrbCounters() {
        if (!state.selectedItem) return;

        for (const orbId in state.orbCounts) {
            const countElement = document.getElementById(`${orbId}-orb-count`);
            if (countElement) {
                countElement.textContent = state.orbCounts[orbId];
            }
        }
    }

    function renderDetailsPanel() {
        if (!state.selectedItem) {
            dom.detailsPlaceholder.classList.remove('hidden');
            dom.detailsContent.classList.add('hidden');
            return;
        }

        dom.detailsPlaceholder.classList.add('hidden');
        dom.detailsContent.classList.remove('hidden');

        dom.detailsItemName.textContent = state.selectedItem.name;
        dom.detailsItemIcon.src = `${API_BASE_URL}${state.selectedItem.id}.png`;
        dom.detailsItemIcon.alt = state.selectedItem.name;

        renderOrbCounters();

        const itemSlotKey = Object.keys(SLOT_MAP).find(key => SLOT_MAP[key] === state.selectedItem.equipment.slot);
        
        let enchantmentsToDisplay = [];
        if (state.detailsViewMode === 'all') {
            dom.enchantmentsTitle.textContent = `Available Enchantments (Click to show current)`;
            // To show all, we group by baseName and show the highest tier available for the slot
            const groupedEnchants = allEnchantments
                .filter(e => e.slots.includes(itemSlotKey))
                .reduce((acc, ench) => {
                    if (!acc[ench.baseName] || acc[ench.baseName].tier < ench.tier) {
                        acc[ench.baseName] = ench;
                    }
                    return acc;
                }, {});
            enchantmentsToDisplay = Object.values(groupedEnchants);

        } else {
            dom.enchantmentsTitle.textContent = 'Current Enchantments (Click to show all)';
            enchantmentsToDisplay = state.activeEnchantments;
        }
        
        const romanNumerals = ["", " I", " II", " III", " IV", " V"];
        dom.enchantmentList.innerHTML = '';
        if (enchantmentsToDisplay.length > 0) {
            const fragment = document.createDocumentFragment();
            enchantmentsToDisplay.forEach(ench => {
                const li = document.createElement('li');
                const tierDisplay = romanNumerals[ench.tier] || '';
                
                li.innerHTML = `
                    <div class="enchant-name">${ench.baseName}${tierDisplay}</div>
                    <div class="enchant-desc">${ench.description}</div>
                `;
                fragment.appendChild(li);
            });
            dom.enchantmentList.appendChild(fragment);
        } else {
            dom.enchantmentList.innerHTML = '<li>No enchantments to show.</li>';
        }
    }

    // --- Logic ---
    function applyOrb(orbId) {
        if (!state.selectedItem) return;

        const itemSlotKey = Object.keys(SLOT_MAP).find(key => SLOT_MAP[key] === state.selectedItem.equipment.slot);
        if (!itemSlotKey) return;

        // --- Store previous state for comparison
        const previousEnchantmentCount = state.activeEnchantments.length;
        const previousEnchantments = JSON.stringify(state.activeEnchantments);

        // Helper function to get a random enchantment tier from a specific family (by baseName)
        const getRandomTier = (baseName) => {
            const family = allEnchantments.filter(e => e.baseName === baseName && e.slots.includes(itemSlotKey));
            return family.length > 0 ? family[Math.floor(Math.random() * family.length)] : null;
        };

        switch (orbId) {
            case 'annul': // Remove a random enchantment
                if (state.activeEnchantments.length > 0) {
                    const randomIndex = Math.floor(Math.random() * state.activeEnchantments.length);
                    state.activeEnchantments.splice(randomIndex, 1);
                }
                break;

            case 'annex': // Add a new random enchantment (of a random tier)
                if (state.activeEnchantments.length < 3) {
                    const currentEnchantBaseNames = state.activeEnchantments.map(e => e.baseName);
                    
                    const possibleBaseNames = [...new Set(allEnchantments
                        .filter(e => e.slots.includes(itemSlotKey) && !currentEnchantBaseNames.includes(e.baseName))
                        .map(e => e.baseName)
                    )];

                    if (possibleBaseNames.length > 0) {
                        const randomBaseName = possibleBaseNames[Math.floor(Math.random() * possibleBaseNames.length)];
                        const newEnchantment = getRandomTier(randomBaseName);
                        if (newEnchantment) {
                            state.activeEnchantments.push(newEnchantment);
                        }
                    }
                }
                break;

            case 'turmoil': // Reroll all enchantments with new unique families
                state.activeEnchantments = [];
                const availableBaseNames = [...new Set(allEnchantments
                    .filter(e => e.slots.includes(itemSlotKey))
                    .map(e => e.baseName)
                )];
                
                for (let i = 0; i < 3 && availableBaseNames.length > 0; i++) {
                    const nameIndex = Math.floor(Math.random() * availableBaseNames.length);
                    const baseName = availableBaseNames.splice(nameIndex, 1)[0];
                    const newEnchantment = getRandomTier(baseName);
                    if (newEnchantment) {
                        state.activeEnchantments.push(newEnchantment);
                    }
                }
                break;

            case 'falter': // Reroll tiers of existing enchantments
                state.activeEnchantments = state.activeEnchantments.map(activeEnch => {
                    return getRandomTier(activeEnch.baseName) || activeEnch;
                });
                break;
        }

        // --- Check if a change occurred and increment counter
        const hasChanged = previousEnchantmentCount !== state.activeEnchantments.length ||
                           previousEnchantments !== JSON.stringify(state.activeEnchantments);

        if (hasChanged) {
            state.orbCounts[orbId]++;
            renderOrbCounters();
        }

        renderDetailsPanel();
    }

    // --- Startup ---
    init();
}); 

