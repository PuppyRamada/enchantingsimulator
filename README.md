# KANO Enchantment Simulator

A web-based simulator for enchanting and customizing equipment, inspired by OSRS and KANO game mechanics.

## Features

- **Item Selection**: Browse and select items by equipment slot (Head, Cape, Neck, Weapon, Body, Shield, Legs, Hands, Feet, Ring, Ammo)
- **Enchantment System**: Apply up to 3 enchantments to items using different orb types
- **Orb Actions**: Use Annulment, Annexing, Turmoil, and Faltering Orbs to add, remove, reroll, or change enchantments
- **Seed System**: Copy and share a seed string to instantly load or share your current item, slot, orbs, and enchantments
- **Target Creature Toggles**: Enable special toggles for Saradomin, Bandos, Zamorak, Armadyl, Dragon, and Spider to see how enchantments interact with these targets
- **Responsive UI**: Works on desktop and mobile devices

## How to Use

1. **Select an Item**
   - Use the slot buttons at the top to choose an equipment slot (e.g., Weapon, Head, Body, etc.)
   - Browse or search for an item in the list and click to select it

2. **Apply Enchantments**
   - Use the orb buttons (Annulment, Annexing, Turmoil, Faltering) to add, remove, or reroll enchantments on the selected item
   - Up to 3 enchantments can be active at once
   - The current enchantments are shown in the details panel
   - The orb action log records your recent orb actions

3. **Share or Load a Seed**
   - At the top of the page, use the Seed input to copy your current setup as a string
   - Paste a seed string and click "Load Seed" to instantly load a shared setup
   - The seed includes item, slot, orb counts, and enchantments

4. **Target Creature Toggles**
   - In the details panel, use the checkboxes to toggle target creature types (Saradomin, Bandos, Zamorak, Armadyl, Dragon, Spider)
   - Some enchantments have special effects when these toggles are enabled

5. **Equipment Stats & DPS**
   - (Currently Disabled) The equipment stats and DPS calculation panels are hidden for now. These features will be re-enabled in a future update.

## Running Locally

1. Clone or download the repository
2. Start a local HTTP server in the project directory (for example, with Python):
   ```
   python -m http.server 8000
   ```
3. Open your browser and go to `http://localhost:8000`
4. Use the simulator directly in your browser

## Technical Details

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Data**: JSON-based item and enchantment databases
- **No backend required**: All logic runs in the browser

## Contributing

Contributions are welcome! Ideas for new enchantments, UI improvements, or additional features can be submitted via pull request or issue.

## Credits

Inspired by OSRS and KANO game mechanics. Special thanks to the OSRS Wiki and community for reference formulas and item data. 