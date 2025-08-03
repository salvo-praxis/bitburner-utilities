/** @param {NS} ns */
export async function main(ns) {
  // Color scheme
  const colors = {
    info: '\u001b[36m',    // Cyan
    success: '\u001b[32m', // Green
    warning: '\u001b[33m', // Yellow
    error: '\u001b[31m',   // Red
    neutral: '\u001b[35m', // Magenta
    reset: '\u001b[0m'     // Reset
  };

  // Check for Singularity API
  if (!ns.singularity || typeof ns.singularity.getOwnedAugmentations !== 'function') {
    ns.tprint(`${colors.error}ERROR: Singularity API not available.${colors.reset}`);
    return;
  }

  // Parse flags
  const flags = ns.flags([
    ['mode', 'summary'],
    ['branch', ''],
    ['log', false],
    ['help', false]
  ]);

  let mode = flags.mode.toLowerCase();
  if (flags.help || mode === 'help') {
    showHelp(ns, colors);
    return;
  }

  // Get current multipliers
  const player = ns.getPlayer();
  const currentMults = { ...player.mults };

  // Get installed and queued augmentations
  const installed = ns.singularity.getOwnedAugmentations(false);
  const allOwned = ns.singularity.getOwnedAugmentations(true);
  const queued = allOwned.filter(aug => !installed.includes(aug));

  // Compute projected multipliers
  const projectedMults = { ...currentMults };
  for (let aug of queued) {
    const stats = ns.singularity.getAugmentationStats(aug);
    for (let key in stats) {
      if (projectedMults.hasOwnProperty(key)) {
        projectedMults[key] *= stats[key];
      }
    }
  }

  // Output buffer
  let output = [];

  // Handle modes
  switch (mode) {
    case 'summary':
      addSummary(output, currentMults, projectedMults, installed, queued, ns, colors);
      break;
    case 'stats':
      if (!flags.branch) {
        output.push(`${colors.error}ERROR: --branch required for stats mode.${colors.reset}`);
        break;
      }
      const branch = flags.branch.toLowerCase();
      if (!branches.hasOwnProperty(branch)) {
        output.push(`${colors.error}ERROR: Invalid branch '${branch}'.${colors.reset}`);
        break;
      }
      addBranch(output, branch, currentMults, projectedMults, ns, colors);
      break;
    case 'queued':
      addQueued(output, queued, ns, colors);
      break;
    case 'installed':
      addInstalled(output, installed, flags.branch.toLowerCase(), ns, colors);
      break;
    case 'suggested':
      output.push(`${colors.warning}Suggested mode not implemented yet.${colors.reset}`);
      break;
    default:
      output.push(`${colors.error}Invalid mode: '${mode}'.${colors.reset}`);
  }

  // Print buffered output
  ns.tprint(output.join('\n'));

  // Log if requested (sanitized)
  if (flags.log) {
    const plainOutput = output.map(line => line.replace(/\u001b\[\d+m/g, ''));
    ns.write('/logs/augs_log.txt', plainOutput.join('\n'), 'w');
  }
}

// Stat branches
const branches = {
  hacking: ['hacking', 'hacking_exp', 'hacking_chance', 'hacking_speed', 'hacking_money', 'hacking_grow'],
  combat: ['strength', 'defense', 'dexterity', 'agility', 'strength_exp', 'defense_exp', 'dexterity_exp', 'agility_exp'],
  char: ['charisma', 'charisma_exp'],
  company: ['company_rep', 'faction_rep', 'work_money'],
  hacknet: ['hacknet_node_money', 'hacknet_node_purchase_cost', 'hacknet_node_level_cost', 'hacknet_node_ram_cost', 'hacknet_node_core_cost'],
  crime: ['crime_success', 'crime_money'],
  bladeburner: ['bladeburner_max_stamina', 'bladeburner_stamina_gain', 'bladeburner_analysis', 'bladeburner_success_chance'],
  exp: ['hacking_exp', 'strength_exp', 'defense_exp', 'dexterity_exp', 'agility_exp', 'charisma_exp']
};

// Branch display names
const branchDisplayNames = {
  hacking: 'HACKING',
  combat: 'COMBAT',
  char: 'CHARISMA',
  company: 'COMPANY',
  hacknet: 'HACKNET',
  crime: 'CRIME',
  bladeburner: 'BLADEBURNER',
  exp: 'EXPERIENCE'
};

// Get human-readable display name for stat
function getDisplayName(stat) {
  let name = stat.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  name = name.replace(' Exp', ' Experience');
  name = name.replace(' Rep', ' Reputation');
  name = name.replace(' Grow', ' Growth');
  return name;
}

// Help function
function showHelp(ns, colors) {
  const helpText = [
    `${colors.info}Usage:${colors.reset}`,
    'run augs.js --mode <mode> [--branch <branch>] [--log] [--help]',
    '',
    `${colors.info}Modes:${colors.reset}`,
    '- summary: Full stats report for all branches (default)',
    '- stats: Stats for a single branch (requires --branch)',
    '- queued: List queued augmentations',
    '- installed: List installed augmentations (optional --branch to filter by affected branch)',
    '- suggested: Suggested augmentations (TBD)',
    '- help: This message',
    '',
    `${colors.info}Branches:${colors.reset} ${Object.keys(branches).join(', ')}`,
    '',
    `${colors.info}Options:${colors.reset}`,
    '--log: Export output to /logs/augs_log.txt (sanitized)',
    '--help: Display this help message'
  ];
  ns.tprint(helpText.join('\n'));
}

// Add summary for all branches
function addSummary(output, current, projected, installed, queued, ns, colors) {
  output.push('');
  output.push('');
  output.push(`${colors.info}=== Augmentation Stats Summary ===${colors.reset}`);
  for (let branch in branches) {
    addBranch(output, branch, current, projected, ns, colors);
  }
  output.push('');
  const installedStr = installed.length === 0 ? ' (None)' : '';
  output.push(`Installed Augmentations (${installed.length}):${installedStr}`);
  const queuedStr = queued.length === 0 ? ' (None)' : '';
  output.push(`Queued Augmentations (${queued.length}):${queuedStr}`);
  output.push('');
}

// Add stats for a single branch
function addBranch(output, branch, current, projected, ns, colors) {
  const displayHeader = (branchDisplayNames[branch] || branch.toUpperCase()) + ' STATS';
  output.push(`\n${colors.info}${displayHeader}${colors.reset}`);

  const stats = branches[branch];
  const maxStatLen = Math.max(...stats.map(stat => getDisplayName(stat).length));

  // Header
  const statHeader = 'Stat'.padEnd(maxStatLen + 2);
  const currHeader = 'Current'.padEnd(10);
  const projHeader = 'Projected'.padEnd(10);
  const deltaHeader = 'Δ%'.padEnd(8);
  output.push(`${colors.neutral}${statHeader}${currHeader}${projHeader}${deltaHeader}${colors.reset}`);

  // Data rows
  for (let stat of stats) {
    const displayName = getDisplayName(stat);
    const curr = current[stat] ?? 1;
    const proj = projected[stat] ?? 1;
    const change = (curr !== 0) ? (proj / curr - 1) * 100 : 0;
    const deltaStr = ((change >= 0 ? '+' : '') + change.toFixed(2) + '%').padEnd(8);

    const higherBetter = !stat.includes('_cost');
    const isImprovement = (higherBetter && proj > curr) || (!higherBetter && proj < curr);
    let color = colors.reset;
    if (proj !== curr) {
      color = isImprovement ? colors.success : colors.error;
    }

    const currStr = curr.toFixed(3).padEnd(10);
    const projStr = proj.toFixed(3).padEnd(10);
    const line = displayName.padEnd(maxStatLen + 2) +
                 currStr +
                 `${color}${projStr}${colors.reset}` +
                 `${color}${deltaStr}${colors.reset}`;
    output.push(line);
  }
}

// Add queued augmentations
function addQueued(output, queued, ns, colors) {
  output.push(`${colors.info}=== Queued Augmentations ===${colors.reset}`);
  if (queued.length === 0) {
    output.push(`${colors.warning}No queued augmentations.${colors.reset}`);
    return;
  }
  for (let aug of queued) {
    output.push(`\n${colors.success}${aug}${colors.reset}`);
    const stats = ns.singularity.getAugmentationStats(aug);
    const statKeys = Object.keys(stats);
    if (statKeys.length === 0) {
      output.push('  No stats modifiers.');
      continue;
    }
    const maxKeyLen = Math.max(...statKeys.map(k => getDisplayName(k).length));
    for (let key of statKeys) {
      const val = stats[key];
      const higherBetter = !key.includes('_cost');
      let color = colors.reset;
      if ((higherBetter && val > 1) || (!higherBetter && val < 1)) {
        color = colors.success;
      } else if ((higherBetter && val < 1) || (!higherBetter && val > 1)) {
        color = colors.error;
      }
      const line = `  ${getDisplayName(key).padEnd(maxKeyLen + 2)}${color}${val.toFixed(3)}${colors.reset}`;
      output.push(line);
    }
  }
}

// Add installed augmentations
function addInstalled(output, installed, branch, ns, colors) {
  let header = '=== Installed Augmentations ===';
  let filtered = installed;
  let noAugsMessage = 'No installed augmentations.';
  if (branch) {
    if (!branches.hasOwnProperty(branch)) {
      output.push(`${colors.error}ERROR: Invalid branch '${branch}'.${colors.reset}`);
      return;
    }
    filtered = [];
    for (let aug of installed) {
      const stats = ns.singularity.getAugmentationStats(aug);
      let affects = false;
      for (let key of branches[branch]) {
        if (stats[key] && stats[key] !== 1) {
          affects = true;
          break;
        }
      }
      if (affects) filtered.push(aug);
    }
    header = `=== Installed Augmentations affecting ${branch} branch ===`;
    noAugsMessage = `No installed augmentations affecting ${branch} branch.`;
  }
  output.push(`${colors.info}${header}${colors.reset}`);
  if (filtered.length === 0) {
    output.push(`${colors.warning}${noAugsMessage}${colors.reset}`);
    return;
  }
  filtered.sort();
  for (let aug of filtered) {
    output.push(`${colors.success}- ${aug}${colors.reset}`);
  }
}