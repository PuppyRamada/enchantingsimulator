document.addEventListener('DOMContentLoaded', () => {
    console.log('Running new script version 1.1...');
    // --- Constants and State ---
    const API_BASE_URL = 'https://kano.gg/assets/images/items_hd/';
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
        orbCounts: {
            annul: 0,
            annex: 0,
            turmoil: 0,
            falter: 0
        }
    };

    // --- DOM Element Cache ---
    const dom = {
        slotButtonsContainer: document.getElementById('slot-buttons'),
        itemListHeader: document.getElementById('item-list-header'),
        itemList: document.getElementById('item-list'),
        searchBar: document.getElementById('search-bar'),
        prevPageButton: document.getElementById('prev-page'),
        nextPageButton: document.getElementById('next-page'),
        pageIndicator: document.getElementById('page-indicator'),
        detailsPanel: document.getElementById('details-panel'),
        detailsPlaceholder: document.getElementById('details-placeholder'),
        detailsContent: document.getElementById('details-content'),
        detailsItemName: document.getElementById('details-item-name'),
        detailsItemIcon: document.getElementById('details-item-icon'),
        orbsContainer: document.getElementById('orbs-container'),
        enchantmentsTitle: document.getElementById('enchantments-title'),
        enchantmentList: document.getElementById('enchantment-list'),
        actionLog: document.getElementById('action-log'),
    };

    // Check if all required DOM elements are found
    const missingElements = Object.entries(dom).filter(([name, element]) => !element).map(([name]) => name);
    if (missingElements.length > 0) {
        console.error('Missing DOM elements:', missingElements);
        throw new Error(`Required DOM elements not found: ${missingElements.join(', ')}`);
    }

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
        if (dom.slotButtonsContainer) {
            dom.slotButtonsContainer.addEventListener('click', handleSlotSelection);
        }
        if (dom.searchBar) {
            dom.searchBar.addEventListener('input', handleSearch);
        }
        if (dom.prevPageButton) {
            dom.prevPageButton.addEventListener('click', () => changePage(-1));
        }
        if (dom.nextPageButton) {
            dom.nextPageButton.addEventListener('click', () => changePage(1));
        }
        if (dom.itemList) {
            dom.itemList.addEventListener('click', handleItemSelection);
        }
        if (dom.enchantmentsTitle) {
            dom.enchantmentsTitle.addEventListener('click', toggleEnchantmentView);
        }
        if (dom.orbsContainer) {
            dom.orbsContainer.addEventListener('click', handleOrbApplication);
        }
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
            
            // Reset orb counters when changing items
            state.orbCounts = {
                annul: 0,
                annex: 0,
                turmoil: 0,
                falter: 0
            };
            
            // Visually mark selected item
            document.querySelectorAll('.item.selected').forEach(el => el.classList.remove('selected'));
            itemElement.classList.add('selected');

            renderDetailsPanel();
            renderOrbs(); // Re-render orbs to update counters
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
        if (!dom.slotButtonsContainer) return;
        
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
        if (!dom.itemList) return;
        
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
        if (!dom.pageIndicator || !dom.prevPageButton || !dom.nextPageButton || !dom.itemListHeader) return;
        
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
        const orbs = [
            { name: 'Annulment', id: 'annul' },
            { name: 'Annexing', id: 'annex' },
            { name: 'Turmoil', id: 'turmoil' },
            { name: 'Faltering', id: 'falter' },
        ];
        orbs.forEach(orb => {
            const orbContainer = document.createElement('div');
            orbContainer.className = 'orb-container';
            
            const button = document.createElement('button');
            button.textContent = orb.name;
            button.dataset.orbId = orb.id;
            button.className = 'orb-button';
            
            const counter = document.createElement('div');
            counter.className = 'orb-counter';
            counter.textContent = `Used: ${state.orbCounts[orb.id]}`;
            
            orbContainer.appendChild(button);
            orbContainer.appendChild(counter);
            dom.orbsContainer.appendChild(orbContainer);
        });
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

    // --- Action Logging ---
    function addActionLogEntry(type, message, details = '') {
        if (!dom.actionLog) return;
        
        const entry = document.createElement('div');
        entry.className = `action-log-entry ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        const romanNumerals = ["", " I", " II", " III", " IV", " V"];
        
        entry.innerHTML = `
            <div class="action-log-timestamp">${timestamp}</div>
            <div class="action-log-message">${message}</div>
            ${details ? `<div class="action-log-details">${details}</div>` : ''}
        `;
        
        dom.actionLog.insertBefore(entry, dom.actionLog.firstChild);
        
        // Keep only the last 10 entries
        const entries = dom.actionLog.querySelectorAll('.action-log-entry');
        if (entries.length > 10) {
            entries[entries.length - 1].remove();
        }
    }

    function getEnchantmentDisplayName(enchantment) {
        const romanNumerals = ["", " I", " II", " III", " IV", " V"];
        return `${enchantment.baseName}${romanNumerals[enchantment.tier] || ''}`;
    }

    // --- Logic ---
    function applyOrb(orbId) {
        if (!state.selectedItem) return;

        // Increment orb counter
        state.orbCounts[orbId]++;

        const itemSlotKey = Object.keys(SLOT_MAP).find(key => SLOT_MAP[key] === state.selectedItem.equipment.slot);
        if (!itemSlotKey) return;

        // Helper function to get a random enchantment tier from a specific family (by baseName)
        const getRandomTier = (baseName) => {
            const family = allEnchantments.filter(e => e.baseName === baseName && e.slots.includes(itemSlotKey));
            return family.length > 0 ? family[Math.floor(Math.random() * family.length)] : null;
        };

        switch (orbId) {
            case 'annul': // Remove a random enchantment with tier prioritization
                if (state.activeEnchantments.length > 0) {
                    // Group enchantments by their base name to check for higher tiers
                    const enchantmentGroups = {};
                    state.activeEnchantments.forEach(ench => {
                        if (!enchantmentGroups[ench.baseName]) {
                            enchantmentGroups[ench.baseName] = [];
                        }
                        enchantmentGroups[ench.baseName].push(ench);
                    });

                    // Find enchantments that have higher tiers available
                    const enchantmentsWithHigherTiers = [];
                    const enchantmentsWithoutHigherTiers = [];

                    Object.entries(enchantmentGroups).forEach(([baseName, enchants]) => {
                        const currentTier = Math.max(...enchants.map(e => e.tier));
                        const availableHigherTiers = allEnchantments
                            .filter(e => e.baseName === baseName && 
                                       e.slots.includes(itemSlotKey) && 
                                       e.tier > currentTier);
                        
                        if (availableHigherTiers.length > 0) {
                            enchantmentsWithHigherTiers.push(...enchants);
                        } else {
                            enchantmentsWithoutHigherTiers.push(...enchants);
                        }
                    });

                    let targetEnchantments = [];
                    let logDetails = '';
                    
                    // If there are enchantments with higher tiers available, prioritize them
                    if (enchantmentsWithHigherTiers.length > 0) {
                        targetEnchantments = enchantmentsWithHigherTiers;
                        logDetails = `Prioritized enchantments with higher tiers available (${enchantmentsWithHigherTiers.length} enchantments)`;
                    } else if (enchantmentsWithoutHigherTiers.length > 0) {
                        // If no higher tiers exist, prioritize lower tiers with 70% chance
                        const randomRoll = Math.random();
                        if (randomRoll < 0.7) {
                            // Sort by tier (ascending) to prioritize lower tiers
                            enchantmentsWithoutHigherTiers.sort((a, b) => a.tier - b.tier);
                            targetEnchantments = enchantmentsWithoutHigherTiers;
                            logDetails = `No higher tiers available - prioritized lower tiers (70% chance) - Rolled: ${(randomRoll * 100).toFixed(1)}%`;
                        } else {
                            // 30% chance to select randomly from all enchantments
                            targetEnchantments = state.activeEnchantments;
                            logDetails = `⚠️ UNLUCKY! No higher tiers available - random selection (30% chance) - Rolled: ${(randomRoll * 100).toFixed(1)}%`;
                        }
                    } else {
                        // Fallback to all enchantments if something goes wrong
                        targetEnchantments = state.activeEnchantments;
                        logDetails = `Fallback to random selection`;
                    }

                    // Remove a random enchantment from the target group
                    if (targetEnchantments.length > 0) {
                        const randomIndex = Math.floor(Math.random() * targetEnchantments.length);
                        const enchantmentToRemove = targetEnchantments[randomIndex];
                        const removeIndex = state.activeEnchantments.findIndex(e => 
                            e.name === enchantmentToRemove.name && e.tier === enchantmentToRemove.tier
                        );
                        if (removeIndex !== -1) {
                            const removedEnchantment = state.activeEnchantments[removeIndex];
                            state.activeEnchantments.splice(removeIndex, 1);
                            
                            // Check if this was an unlucky removal (higher tier when lower tiers exist)
                            const wasUnlucky = enchantmentsWithoutHigherTiers.length > 0 && 
                                              enchantmentsWithoutHigherTiers.some(e => e.tier < removedEnchantment.tier) &&
                                              targetEnchantments === state.activeEnchantments;
                            
                            const logType = wasUnlucky ? 'removed-unlucky' : 'removed';
                            const logMessage = wasUnlucky ? 
                                `⚠️ UNLUCKY! Removed ${getEnchantmentDisplayName(removedEnchantment)} (higher tier)` :
                                `Removed ${getEnchantmentDisplayName(removedEnchantment)}`;
                            
                            addActionLogEntry(logType, logMessage, logDetails);
                        }
                    }
                } else {
                    addActionLogEntry('removed', 'No enchantments to remove', 'Item has no active enchantments');
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
                        const randomBaseNameIndex = Math.floor(Math.random() * possibleBaseNames.length);
                        const randomBaseName = possibleBaseNames[randomBaseNameIndex];
                        const baseNameChance = ((1 / possibleBaseNames.length) * 100).toFixed(1);
                        
                        const family = allEnchantments.filter(e => e.baseName === randomBaseName && e.slots.includes(itemSlotKey));
                        const randomTierIndex = Math.floor(Math.random() * family.length);
                        const newEnchantment = family[randomTierIndex];
                        const tierChance = ((1 / family.length) * 100).toFixed(1);
                        
                        if (newEnchantment) {
                            state.activeEnchantments.push(newEnchantment);
                            addActionLogEntry('added', 
                                `Added ${getEnchantmentDisplayName(newEnchantment)}`, 
                                `Family selection: ${baseNameChance}% (${randomBaseNameIndex + 1}/${possibleBaseNames.length}) | Tier selection: ${tierChance}% (${randomTierIndex + 1}/${family.length})`
                            );
                        }
                    } else {
                        addActionLogEntry('added', 'No new enchantments available', 'All enchantment families are already applied');
                    }
                } else {
                    addActionLogEntry('added', 'Cannot add more enchantments', 'Item already has maximum of 3 enchantments');
                }
                break;

            case 'turmoil': // Reroll all enchantments with new unique families
                const oldEnchantments = [...state.activeEnchantments];
                state.activeEnchantments = [];
                const availableBaseNames = [...new Set(allEnchantments
                    .filter(e => e.slots.includes(itemSlotKey))
                    .map(e => e.baseName)
                )];
                
                const newEnchantments = [];
                const selectionDetails = [];
                for (let i = 0; i < 3 && availableBaseNames.length > 0; i++) {
                    const nameIndex = Math.floor(Math.random() * availableBaseNames.length);
                    const baseName = availableBaseNames.splice(nameIndex, 1)[0];
                    const baseNameChance = ((1 / (availableBaseNames.length + 1)) * 100).toFixed(1);
                    
                    const family = allEnchantments.filter(e => e.baseName === baseName && e.slots.includes(itemSlotKey));
                    const randomTierIndex = Math.floor(Math.random() * family.length);
                    const newEnchantment = family[randomTierIndex];
                    const tierChance = ((1 / family.length) * 100).toFixed(1);
                    
                    if (newEnchantment) {
                        state.activeEnchantments.push(newEnchantment);
                        newEnchantments.push(newEnchantment);
                        selectionDetails.push(`${baseName}: ${baseNameChance}% family, ${tierChance}% tier`);
                    }
                }
                
                const oldNames = oldEnchantments.map(e => getEnchantmentDisplayName(e)).join(', ');
                const newNames = newEnchantments.map(e => getEnchantmentDisplayName(e)).join(', ');
                
                addActionLogEntry('changed', 
                    `Rerolled all enchantments`, 
                    `Removed: ${oldNames || 'None'} → Added: ${newNames || 'None'} | Selection chances: ${selectionDetails.join(' | ')}`
                );
                break;

            case 'falter': // Reroll tiers of existing enchantments
                const tierChanges = [];
                const tierSelectionDetails = [];
                state.activeEnchantments = state.activeEnchantments.map(activeEnch => {
                    const oldTier = activeEnch.tier;
                    const family = allEnchantments.filter(e => e.baseName === activeEnch.baseName && e.slots.includes(itemSlotKey));
                    const randomTierIndex = Math.floor(Math.random() * family.length);
                    const newEnchantment = family[randomTierIndex];
                    const newTier = newEnchantment.tier;
                    const tierChance = ((1 / family.length) * 100).toFixed(1);
                    
                    tierSelectionDetails.push(`${activeEnch.baseName}: ${tierChance}% (${randomTierIndex + 1}/${family.length})`);
                    
                    if (oldTier !== newTier) {
                        tierChanges.push(`${activeEnch.baseName}: ${oldTier} → ${newTier}`);
                    }
                    
                    return newEnchantment;
                });
                
                if (tierChanges.length > 0) {
                    addActionLogEntry('changed', 
                        `Rerolled enchantment tiers`, 
                        `Changes: ${tierChanges.join(', ')} | Selection chances: ${tierSelectionDetails.join(' | ')}`
                    );
                } else {
                    addActionLogEntry('changed', 
                        `Rerolled enchantment tiers`, 
                        `No tier changes occurred | Selection chances: ${tierSelectionDetails.join(' | ')}`
                    );
                }
                break;
        }
        renderDetailsPanel();
        renderOrbs(); // Update orb counters display
    }

    // --- Startup ---
    init();
}); 
