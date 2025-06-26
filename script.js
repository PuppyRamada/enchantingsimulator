document.addEventListener('DOMContentLoaded', () => {
    console.log('Running new script version 1.3...');
    // --- Constants and State ---
    const API_BASE_URL = 'https://kano.gg/assets/images/items_hd/';
    const SLOT_MAP = {
        'HEAD': 'head', 'CAPE': 'cape', 'NECK': 'neck', 'WEAPON': 'weapon',
        'BODY': 'body', 'SHIELD': 'shield', 'LEGS': 'legs', 'HANDS': 'hands',
        'FEET': 'feet', 'RING': 'ring'
    };
    const ITEMS_PER_PAGE = 50;

    // DPS Calculation Constants (based on OSRS mechanics)
    const DPS_CONSTANTS = {
        BASE_ATTACK_SPEED: 2.4, // seconds per attack
        BASE_ACCURACY: 0.5, // 50% base accuracy
        BASE_STRENGTH: 1, // base strength multiplier
        CRITICAL_HIT_CHANCE: 0.05, // 5% base critical hit chance
        CRITICAL_HIT_MULTIPLIER: 1.2, // 20% more damage on crits
        DEFENCE_REDUCTION: 0.1, // 10% damage reduction per defence point
        MAX_DEFENCE_REDUCTION: 0.8 // maximum 80% damage reduction
    };

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
        },
        // Combat configuration
        combatConfig: {
            // Now completely empty or only keep if needed for other UI
        }
    };

    // Add state for target toggles
    const targetState = {
        saradomin: false,
        bandos: false,
        zamorak: false,
        armadyl: false,
        dragon: false,
        spider: false
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
        // Equipment stats elements
        statAttack: document.getElementById('stat-attack'),
        statStrength: document.getElementById('stat-strength'),
        statDefence: document.getElementById('stat-defence'),
        statMagic: document.getElementById('stat-magic'),
        statRanged: document.getElementById('stat-ranged'),
        dpsAccuracy: document.getElementById('dps-accuracy'),
        dpsMaxhit: document.getElementById('dps-maxhit'),
        dpsValue: document.getElementById('dps-value'),
        dpsSpeed: document.getElementById('dps-speed'),
        // Combat configuration elements
        maxCombatCheckbox: document.getElementById('max-combat'),
        superCombatCheckbox: document.getElementById('super-combat'),
        magicPotionCheckbox: document.getElementById('magic-potion'),
        rangingPotionCheckbox: document.getElementById('ranging-potion'),
        divinePotionCheckbox: document.getElementById('divine-potion')
    };

    // Check if all required DOM elements are found
    const missingElements = Object.entries(dom).filter(([name, element]) => !element).map(([name]) => name);
    if (missingElements.length > 0) {
        console.error('Missing DOM elements:', missingElements);
        // Don't throw error for missing elements, just log them
        console.warn('Some elements may not be available yet');
    }

    // Debug: Check if combat config elements are found
    console.log('Combat config elements found:', {
        maxCombat: !!dom.maxCombatCheckbox,
        superCombat: !!dom.superCombatCheckbox,
        magicPotion: !!dom.magicPotionCheckbox,
        rangingPotion: !!dom.rangingPotionCheckbox,
        divinePotion: !!dom.divinePotionCheckbox
    });

    // Enhanced seed system UI
    if (!document.getElementById('seed-input')) {
        const seedDiv = document.createElement('div');
        seedDiv.style.margin = '10px 0';
        seedDiv.innerHTML = `
            <label>Seed: <input id="seed-input" type="text" style="width:400px;" placeholder="Paste or copy seed here..."></label>
            <button id="seed-load-btn">Load Seed</button>
            <button id="seed-copy-btn">Copy Seed</button>
        `;
        document.body.prepend(seedDiv);
    }

    function getCurrentSeed() {
        // Format: itemName|slot|orbCounts|EFFECT_TYPE1:TIER1,EFFECT_TYPE2:TIER2,...
        const item = state.selectedItem;
        if (!item) return '';
        const itemName = item.name || '';
        const slot = state.selectedSlot || '';
        const orbCounts = state.orbCounts || {};
        const orbStr = Object.entries(orbCounts).map(([k, v]) => `${k}:${v}`).join(',');
        const enchStr = (state.activeEnchantments || []).map(e => `${e.effect_type}:${e.tier}`).join(',');
        return `${itemName}|${slot}|${orbStr}|${enchStr}`;
    }

    function loadSeed(seed) {
        // Format: itemName|slot|orbCounts|EFFECT_TYPE1:TIER1,EFFECT_TYPE2:TIER2,...
        if (!seed) return;
        const [itemPart, slotPart, orbPart, enchPart] = seed.split('|');
        // Find item by name (case-insensitive, partial match allowed)
        const item = allItems.find(i => i.name && i.name.toLowerCase().includes((itemPart || '').toLowerCase()));
        if (!item) {
            console.warn('[SEED] No item found for', itemPart);
            return;
        }
        state.selectedItem = item;
        if (slotPart) state.selectedSlot = slotPart;
        // Parse orbCounts
        if (orbPart) {
            orbPart.split(',').forEach(pair => {
                const [k, v] = pair.split(':');
                if (k && v !== undefined) state.orbCounts[k] = Number(v);
            });
        }
        // Parse enchantments
        const enchArr = (enchPart || '').split(',').map(s => {
            const [type, tier] = s.split(':');
            return allEnchantments.find(e => e.effect_type === type && e.tier === Number(tier));
        }).filter(Boolean);
        state.activeEnchantments = enchArr;
        console.log('[SEED] Loaded item from seed:', item, 'Slot:', slotPart, 'Orbs:', state.orbCounts, 'Enchantments:', enchArr);
        updateEquipmentDisplay();
        renderDetailsPanel();
        // Update seed input to reflect canonical seed
        setTimeout(() => {
            const seedInput = document.getElementById('seed-input');
            if (seedInput) seedInput.value = getCurrentSeed();
        }, 100);
    }

    // Add event listeners for seed input/copy
    setTimeout(() => {
        const seedInput = document.getElementById('seed-input');
        const seedBtn = document.getElementById('seed-load-btn');
        const copyBtn = document.getElementById('seed-copy-btn');
        if (seedInput && seedBtn) {
            seedBtn.onclick = () => loadSeed(seedInput.value);
        }
        if (seedInput && copyBtn) {
            copyBtn.onclick = () => {
                seedInput.select();
                document.execCommand('copy');
            };
        }
    }, 500);

    // Update seed input whenever state changes
    function updateSeedInput() {
        const seedInput = document.getElementById('seed-input');
        if (seedInput) seedInput.value = getCurrentSeed();
    }

    // --- DPS Calculation Functions ---
    function calculateBaseStats() {
        return {
            attack: 99,
            strength: 99,
            defence: 99,
            magic: 99,
            ranged: 99
        };
    }

    function calculateEquipmentStats(item, enchantments = []) {
        // Get base stats from combat configuration
        const baseStats = calculateBaseStats();
        
        // Get stats from the equipment object
        const equipment = item.equipment || {};
        const equipmentStats = {
            attack: (equipment.attack_stab || 0) + (equipment.attack_slash || 0) + (equipment.attack_crush || 0) + (equipment.attack_magic || 0) + (equipment.attack_ranged || 0),
            strength: equipment.melee_strength || 0,
            defence: (equipment.defence_stab || 0) + (equipment.defence_slash || 0) + (equipment.defence_crush || 0) + (equipment.defence_magic || 0) + (equipment.defence_ranged || 0),
            magic: equipment.magic_damage || 0,
            ranged: equipment.ranged_strength || 0
        };

        // Apply enchantment bonuses
        const enchantmentBonuses = calculateEnchantmentBonuses(enchantments);
        
        return {
            attack: baseStats.attack + equipmentStats.attack + enchantmentBonuses.attack,
            strength: baseStats.strength + equipmentStats.strength + enchantmentBonuses.strength,
            defence: baseStats.defence + equipmentStats.defence + enchantmentBonuses.defence,
            magic: baseStats.magic + equipmentStats.magic + enchantmentBonuses.magic,
            ranged: baseStats.ranged + equipmentStats.ranged + enchantmentBonuses.ranged
        };
    }

    function calculateEnchantmentBonuses(enchantments) {
        const bonuses = { attack: 0, strength: 0, defence: 0, magic: 0, ranged: 0 };
        let dpsEffects = {
            critChance: 0,
            critMultiplier: 0,
            doubleHitChance: 0,
            damageMultiplier: 1,
            accuracyMultiplier: 1
        };
        let accuracyAndDamageBuff = 0;
        // Debug: log all enchantments being processed
        console.log('[ENCH DEBUG] Processing enchantments:', enchantments.map(e => ({effect_type: e.effect_type, tier: e.tier, name: e.name})));
        enchantments.forEach(ench => {
            switch(ench.effect_type) {
                case 'REINFORCED':
                    // Defence bonus
                    if (ench.tier === 1) bonuses.defence += 20;
                    else if (ench.tier === 2) bonuses.defence += 25;
                    else if (ench.tier === 3) bonuses.defence += 30;
                    break;
                case 'CRITICAL_STRIKE':
                    // Crit chance
                    if (ench.tier === 1) dpsEffects.critChance += 0.05;
                    else if (ench.tier === 2) dpsEffects.critChance += 0.07;
                    else if (ench.tier === 3) dpsEffects.critChance += 0.10;
                    break;
                case 'CRITICAL_STRIKE_DAMAGE':
                    // Crit multiplier
                    if (ench.tier === 1) dpsEffects.critMultiplier += 0.20;
                    else if (ench.tier === 2) dpsEffects.critMultiplier += 0.25;
                    else if (ench.tier === 3) dpsEffects.critMultiplier += 0.30;
                    break;
                case 'DOUBLE_TAP':
                    // Double hit chance
                    if (ench.tier === 1) dpsEffects.doubleHitChance += 0.05;
                    else if (ench.tier === 2) dpsEffects.doubleHitChance += 0.10;
                    else if (ench.tier === 3) dpsEffects.doubleHitChance += 0.15;
                    break;
                case 'NERFS':
                    // Smack Down/Zamorak's Curse: chance to deal 1.5x damage
                    if (ench.name.includes('Smack Down') || ench.name.includes("Zamorak's Curse")) {
                        dpsEffects.damageMultiplier += 0.5 * (ench.tier === 1 ? 0.05 : ench.tier === 2 ? 0.10 : 0.15);
                    }
                    break;
                case 'MASTER_SLAYER':
                case 'DRAGON_SLAYER':
                case 'ARMADYL_ARCHER':
                case 'BANDOS_BERSERKER':
                case 'ZAMORAK_ZEALOT':
                case 'SPIDER_SQUASHER':
                    // 2/3/5% accuracy and damage vs specific monsters (not implemented, placeholder)
                    break;
                case 'RISKING_IT_ALL':
                    // 0.25% more damage per missing HP, max 25% (not implemented, placeholder)
                    break;
                case 'STAND_YOUR_GROUND':
                    // 1% more damage per tick standing still, max 5% (not implemented, placeholder)
                    break;
                case 'BENDER':
                case 'FIRE_ASPECT':
                case 'SPLINTER_BLITZ':
                case 'MEDUSA':
                case 'WRETCHED':
                case 'LIFE_STEAL':
                case 'EXECUTIONER':
                case 'VENOMOUS':
                case 'BLOCK_DAMAGE':
                case 'FEATHERWEIGHT':
                case 'INCREASED_LUCK':
                case 'LUCKY_LOOTER':
                case 'LOOTING':
                case 'PRAYER':
                case 'UTILITY':
                case 'SPECIAL_ATTACK':
                case 'SEAWORLD':
                case 'BLACKSMITH':
                case 'SHIELDCRASH':
                case 'HOLY_GRACE':
                case 'LAST_RECALL':
                case 'PRAY_BY_HUNGER':
                    // Not directly stat/DPS affecting, placeholder
                    break;
                case 'ARMADYL_ARCHER':
                    if (targetState.armadyl || targetState.saradomin) {
                        if (ench.tier === 1) accuracyAndDamageBuff += 0.02;
                        else if (ench.tier === 2) accuracyAndDamageBuff += 0.03;
                        else if (ench.tier === 3) accuracyAndDamageBuff += 0.05;
                    }
                    break;
                case 'BANDOS_BERSERKER':
                    if (targetState.bandos) {
                        if (ench.tier === 1) accuracyAndDamageBuff += 0.02;
                        else if (ench.tier === 2) accuracyAndDamageBuff += 0.03;
                        else if (ench.tier === 3) accuracyAndDamageBuff += 0.05;
                    }
                    break;
                case 'ZAMORAK_ZEALOT':
                    if (targetState.zamorak) {
                        if (ench.tier === 1) accuracyAndDamageBuff += 0.02;
                        else if (ench.tier === 2) accuracyAndDamageBuff += 0.03;
                        else if (ench.tier === 3) accuracyAndDamageBuff += 0.05;
                    }
                    break;
                case 'DRAGON_SLAYER':
                    if (targetState.dragon) {
                        if (ench.tier === 1) accuracyAndDamageBuff += 0.02;
                        else if (ench.tier === 2) accuracyAndDamageBuff += 0.03;
                        else if (ench.tier === 3) accuracyAndDamageBuff += 0.05;
                    }
                    break;
                case 'SPIDER_SQUASHER':
                    if (targetState.spider) {
                        if (ench.tier === 1) accuracyAndDamageBuff += 0.02;
                        else if (ench.tier === 2) accuracyAndDamageBuff += 0.03;
                        else if (ench.tier === 3) accuracyAndDamageBuff += 0.05;
                    }
                    break;
                // Add more as needed
            }
        });
        if (accuracyAndDamageBuff > 0) {
            dpsEffects.accuracyMultiplier *= (1 + accuracyAndDamageBuff);
            dpsEffects.damageMultiplier *= (1 + accuracyAndDamageBuff);
        }
        // Debug: log computed buffs
        console.log('[ENCH DEBUG] accuracyAndDamageBuff:', accuracyAndDamageBuff, 'dpsEffects:', dpsEffects, 'bonuses:', bonuses);
        bonuses.dpsEffects = dpsEffects;
        return bonuses;
    }

    function calculateDPS(stats, enchantments = []) {
        // OSRS Max Hit calculation (simplified but accurate)
        const baseStats = calculateBaseStats();
        const equipment = state.selectedItem?.equipment || {};
        const strengthLevel = baseStats.strength;
        const strengthBonus = equipment.melee_strength || 0;
        const effectiveStrength = strengthLevel + 8;
        const maxHit = Math.floor(0.5 + (effectiveStrength * (strengthBonus + 64)) / 640);
        const attackLevel = baseStats.attack;
        const attackBonus = (equipment.attack_stab || 0) + (equipment.attack_slash || 0) + (equipment.attack_crush || 0) + (equipment.attack_magic || 0) + (equipment.attack_ranged || 0);
        const effectiveAttack = attackLevel + 8;
        const attackRoll = effectiveAttack * (attackBonus + 64);
        const targetDefence = 99;
        const targetDefenceBonus = 0;
        const defenceRoll = (targetDefence + 9) * (targetDefenceBonus + 64);
        let accuracy;
        if (attackRoll > defenceRoll) {
            accuracy = 1 - (defenceRoll + 2) / (2 * (attackRoll + 1));
        } else {
            accuracy = attackRoll / (2 * (defenceRoll + 1));
        }
        // Gather DPS effects from enchantments
        const enchantmentBonuses = calculateEnchantmentBonuses(enchantments);
        let criticalChance = 0.05 + (enchantmentBonuses.dpsEffects?.critChance || 0);
        let criticalMultiplier = 1.2 + (enchantmentBonuses.dpsEffects?.critMultiplier || 0);
        let doubleHitChance = enchantmentBonuses.dpsEffects?.doubleHitChance || 0;
        let damageMultiplier = enchantmentBonuses.dpsEffects?.damageMultiplier || 1;
        let accuracyMultiplier = enchantmentBonuses.dpsEffects?.accuracyMultiplier || 1;
        // Apply accuracy multiplier
        accuracy = Math.min(1, accuracy * accuracyMultiplier);
        // Calculate average damage per hit
        const normalDamage = maxHit / 2;
        const criticalDamage = maxHit * criticalMultiplier / 2;
        let averageDamage = (normalDamage * (1 - criticalChance)) + (criticalDamage * criticalChance);
        // Apply double hit chance (e.g. Slice and Dice)
        if (doubleHitChance > 0) {
            averageDamage = averageDamage * (1 - doubleHitChance) + (averageDamage * 2) * doubleHitChance;
        }
        // Apply global damage multiplier
        averageDamage *= damageMultiplier;
        // Calculate DPS
        const dps = (averageDamage * accuracy) / DPS_CONSTANTS.BASE_ATTACK_SPEED;
        return {
            accuracy: accuracy,
            maxHit: maxHit,
            dps: dps,
            attackSpeed: DPS_CONSTANTS.BASE_ATTACK_SPEED,
            criticalChance: criticalChance,
            criticalMultiplier: criticalMultiplier,
            doubleHitChance: doubleHitChance,
            damageMultiplier: damageMultiplier,
            effectiveStrength: effectiveStrength,
            effectiveAttack: effectiveAttack,
            attackRoll: attackRoll,
            defenceRoll: defenceRoll
        };
    }

    function updateEquipmentDisplay() {
        console.log('updateEquipmentDisplay called');
        console.log('Selected item:', state.selectedItem);
        
        if (!state.selectedItem) {
            console.log('No selected item, returning');
            return;
        }
        
        const stats = calculateEquipmentStats(state.selectedItem, state.activeEnchantments);
        const dps = calculateDPS(stats, state.activeEnchantments);
        
        console.log('Calculated stats:', stats);
        console.log('Calculated DPS:', dps);
        
        // Update stat displays
        dom.statAttack.textContent = stats.attack;
        dom.statStrength.textContent = stats.strength;
        dom.statDefence.textContent = stats.defence;
        dom.statMagic.textContent = stats.magic;
        dom.statRanged.textContent = stats.ranged;
        
        // Update DPS displays
        dom.dpsAccuracy.textContent = `${(dps.accuracy * 100).toFixed(1)}%`;
        dom.dpsMaxhit.textContent = dps.maxHit;
        dom.dpsValue.textContent = dps.dps.toFixed(2);
        dom.dpsSpeed.textContent = `${dps.attackSpeed}s`;
        
        // Add visual indicators for stat changes
        updateStatColors(stats);
        
        console.log('Equipment display updated successfully');
        updateSeedInput();
    }

    function updateStatColors(stats) {
        // Compare with base stats (without enchantments) to show changes
        const baseStats = calculateBaseStats();
        const equipment = state.selectedItem?.equipment || {};
        const equipmentStats = {
            attack: (equipment.attack_stab || 0) + (equipment.attack_slash || 0) + (equipment.attack_crush || 0) + (equipment.attack_magic || 0) + (equipment.attack_ranged || 0),
            strength: equipment.melee_strength || 0,
            defence: (equipment.defence_stab || 0) + (equipment.defence_slash || 0) + (equipment.defence_crush || 0) + (equipment.defence_magic || 0) + (equipment.defence_ranged || 0),
            magic: equipment.magic_damage || 0,
            ranged: equipment.ranged_strength || 0
        };
        
        const baseTotalStats = {
            attack: baseStats.attack + equipmentStats.attack,
            strength: baseStats.strength + equipmentStats.strength,
            defence: baseStats.defence + equipmentStats.defence,
            magic: baseStats.magic + equipmentStats.magic,
            ranged: baseStats.ranged + equipmentStats.ranged
        };
        
        const statElements = [
            { element: dom.statAttack, current: stats.attack, base: baseTotalStats.attack },
            { element: dom.statStrength, current: stats.strength, base: baseTotalStats.strength },
            { element: dom.statDefence, current: stats.defence, base: baseTotalStats.defence },
            { element: dom.statMagic, current: stats.magic, base: baseTotalStats.magic },
            { element: dom.statRanged, current: stats.ranged, base: baseTotalStats.ranged }
        ];
        
        statElements.forEach(({ element, current, base }) => {
            element.classList.remove('positive', 'negative', 'neutral');
            if (current > base) {
                element.classList.add('positive');
            } else if (current < base) {
                element.classList.add('negative');
            } else {
                element.classList.add('neutral');
            }
        });
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
        
        // Combat configuration event listeners
        if (dom.maxCombatCheckbox) {
            dom.maxCombatCheckbox.addEventListener('change', handleCombatConfigChange);
        }
        if (dom.superCombatCheckbox) {
            dom.superCombatCheckbox.addEventListener('change', handleCombatConfigChange);
        }
        if (dom.magicPotionCheckbox) {
            dom.magicPotionCheckbox.addEventListener('change', handleCombatConfigChange);
        }
        if (dom.rangingPotionCheckbox) {
            dom.rangingPotionCheckbox.addEventListener('change', handleCombatConfigChange);
        }
        if (dom.divinePotionCheckbox) {
            dom.divinePotionCheckbox.addEventListener('change', handleCombatConfigChange);
        }

        // Add listeners for only the common strength boost checkboxes
        const boostIds = [
            'boost-strength-cape',
            'boost-strength-potion',
            'boost-super-strength',
            'boost-zamorak-brew',
            'boost-super-combat',
            'boost-divine-super-combat',
            'boost-smelling-salts',
            'boost-overload',
            'boost-dragon-battleaxe'
        ];
        boostIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.checked = false;
                el.addEventListener('change', (e) => {
                    state.combatConfig[
                        id.replace(/-([a-z])/g, (m, c) => c.toUpperCase())
                    ] = e.target.checked;
                    updateEquipmentDisplay();
                });
            }
        });

        // Add listeners for target toggles
        [
            ['target-saradomin', 'saradomin'],
            ['target-bandos', 'bandos'],
            ['target-zamorak', 'zamorak'],
            ['target-armadyl', 'armadyl'],
            ['target-dragon', 'dragon'],
            ['target-spider', 'spider']
        ].forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) {
                el.checked = false;
                el.addEventListener('change', (e) => {
                    targetState[key] = e.target.checked;
                    updateEquipmentDisplay();
                });
            }
        });
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
            updateEquipmentDisplay(); // Update equipment stats display
        }
    }
    
    function handleOrbApplication(e) {
        if (e.target.matches('.orb-button')) {
            applyOrb(e.target.dataset.orbId);
        }
    }

    function handleCombatConfigChange(e) {
        console.log('Combat config changed:', e.target.id, e.target.checked);
        
        const checkbox = e.target;
        // Fix the config key conversion - handle both 'max-combat' and 'maxCombat' formats
        let configKey = checkbox.id;
        if (configKey === 'max-combat') configKey = 'maxCombat';
        if (configKey === 'super-combat') configKey = 'superCombat';
        if (configKey === 'magic-potion') configKey = 'magicPotion';
        if (configKey === 'ranging-potion') configKey = 'rangingPotion';
        if (configKey === 'divine-potion') configKey = 'divinePotion';
        
        console.log('Config key:', configKey);
        console.log('Previous state:', state.combatConfig[configKey]);
        
        // Update state
        state.combatConfig[configKey] = checkbox.checked;
        
        console.log('New state:', state.combatConfig);
        console.log('Base stats will be:', calculateBaseStats());
        
        // Update equipment display to reflect new stats
        updateEquipmentDisplay();
        
        console.log('Equipment display updated');
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
        console.log('Filtering items for slot:', state.selectedSlot);
        console.log('Total items loaded:', allItems.length);
        
        const equipableItems = allItems.filter(item => item.equipable_by_player);
        console.log('Equipable items:', equipableItems.length);
        
        const slotItems = equipableItems.filter(item => item.equipment?.slot === state.selectedSlot);
        console.log(`Items for slot '${state.selectedSlot}':`, slotItems.length);
        
        if (slotItems.length > 0) {
            console.log('Sample items for this slot:', slotItems.slice(0, 3).map(item => ({ id: item.id, name: item.name, slot: item.equipment?.slot })));
        }
        
        const filteredItems = slotItems.filter(item => !state.searchTerm || item.name.toLowerCase().includes(state.searchTerm));
        console.log('After search filter:', filteredItems.length);
        
        return filteredItems;
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

    // Add this helper to check if the selected item is a weapon (melee, ranged, or magic)
    function isAttackWeaponSelected() {
        return state.selectedItem && state.selectedItem.equipment &&
            (state.selectedItem.equipment.slot === 'weapon' || state.selectedItem.equipment.slot === '2h');
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

        // Show/hide equipment stats and DPS panel based on weapon type
        const dpsPanel = document.querySelector('.equipment-stats');
        const combatConfigPanel = document.querySelector('.config-grid');
        if (dpsPanel) dpsPanel.style.display = isAttackWeaponSelected() ? '' : 'none';
        if (combatConfigPanel) combatConfigPanel.style.display = isAttackWeaponSelected() ? '' : 'none';

        // Update equipment display
        if (isAttackWeaponSelected()) {
            updateEquipmentDisplay();
        }

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
                        const maxTier = Math.max(...enchants.map(e => e.tier));
                        const availableHigherTiers = allEnchantments.filter(e => 
                            e.baseName === baseName && 
                            e.slots.includes(itemSlotKey) && 
                            e.tier > maxTier
                        );
                        
                        if (availableHigherTiers.length > 0) {
                            enchantmentsWithHigherTiers.push(...enchants);
                        } else {
                            enchantmentsWithoutHigherTiers.push(...enchants);
                        }
                    });

                    // Prioritize removing enchantments with higher tiers available
                    const enchantmentsToConsider = enchantmentsWithHigherTiers.length > 0 
                        ? enchantmentsWithHigherTiers 
                        : enchantmentsWithoutHigherTiers;

                    const randomIndex = Math.floor(Math.random() * enchantmentsToConsider.length);
                    const removedEnchantment = enchantmentsToConsider[randomIndex];
                    const removalChance = ((1 / enchantmentsToConsider.length) * 100).toFixed(1);
                    
                    state.activeEnchantments = state.activeEnchantments.filter(e => e !== removedEnchantment);
                    
                    addActionLogEntry('removed', 
                        `Removed ${getEnchantmentDisplayName(removedEnchantment)}`, 
                        `Selection chance: ${removalChance}% (${randomIndex + 1}/${enchantmentsToConsider.length})`
                    );
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

        // Update displays after orb application
        renderDetailsPanel();
        renderOrbs();
        updateEquipmentDisplay();
    }

    // Initialize the application
    init();
}); 
