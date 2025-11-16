function createSkillTreeSVG(skillTreeData, username) {
    const width = 800;
    const padding = 40;
    const nodeWidth = 160;
    const nodeHeight = 50;
    const verticalGap = 20;
    const horizontalGap = 30;

    // Group skills by category - FIXED to match SkillLogic.js categories
    const categories = {
        language: skillTreeData.filter(s => s.category === 'language'),
        frontend: skillTreeData.filter(s => s.category === 'frontend'),
        backend: skillTreeData.filter(s => s.category === 'backend'),
        mobile: skillTreeData.filter(s => s.category === 'mobile'),
        database: skillTreeData.filter(s => s.category === 'database'),
        'ai-ml': skillTreeData.filter(s => s.category === 'ai-ml'),
        devops: skillTreeData.filter(s => s.category === 'devops'),
        testing: skillTreeData.filter(s => s.category === 'testing'),
        styling: skillTreeData.filter(s => s.category === 'styling'),
        state: skillTreeData.filter(s => s.category === 'state'),
        'build-tool': skillTreeData.filter(s => s.category === 'build-tool'),
        api: skillTreeData.filter(s => s.category === 'api'),
        web3: skillTreeData.filter(s => s.category === 'web3'),
        'game-dev': skillTreeData.filter(s => s.category === 'game-dev'),
        tool: skillTreeData.filter(s => s.category === 'tool'),
        meta: skillTreeData.filter(s => s.category === 'meta')
    };

    // Calculate layout - dynamically arrange all categories
    let currentY = padding + 60;
    const layout = [];
    
    // Order of categories to display
    const categoryOrder = [
        'language',
        'frontend', 
        'backend',
        'mobile',
        'database',
        'ai-ml',
        'devops',
        'testing',
        'styling',
        'state',
        'build-tool',
        'api',
        'web3',
        'game-dev',
        'tool',
        'meta'
    ];

    categoryOrder.forEach(category => {
        const skills = categories[category];
        if (skills && skills.length > 0) {
            skills.forEach((skill, idx) => {
                const x = padding + (idx % 4) * (nodeWidth + horizontalGap);
                const y = currentY + Math.floor(idx / 4) * (nodeHeight + verticalGap);
                layout.push({ ...skill, x, y });
            });
            
            // Add spacing after each category
            currentY += Math.ceil(skills.length / 4) * (nodeHeight + verticalGap) + 40;
        }
    });

    const height = currentY;

    // Generate connections (parent-child relationships)
    const connections = [];
    layout.forEach(skill => {
        if (skill.parent) {
            const parent = layout.find(s => s.name === skill.parent);
            if (parent) {
                connections.push({
                    from: { x: parent.x + nodeWidth / 2, y: parent.y + nodeHeight },
                    to: { x: skill.x + nodeWidth / 2, y: skill.y }
                });
            }
        }
    });

    // Generate SVG
    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f093fb;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f5576c;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#4facfe;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#00f2fe;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#43e97b;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#38f9d7;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="grad5" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#fa709a;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#fee140;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="grad6" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#a8edea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#fed6e3;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="grad7" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ff9a9e;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#fad0c4;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="grad8" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#fbc2eb;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#a6c1ee;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
    </defs>
    
    <style>
        .background { fill: #0f172a; }
        .title { fill: #f1f5f9; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; }
        .subtitle { fill: #94a3b8; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 400; }
        .skill-text { fill: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 600; }
        .skill-level { fill: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 400; font-size: 11px; }
        .connection { stroke: #475569; stroke-width: 2; fill: none; opacity: 0.4; }
        .node { filter: url(#shadow); cursor: pointer; transition: all 0.3s; }
        .icon { font-size: 20px; }
    </style>
    
    <!-- Background -->
    <rect width="100%" height="100%" class="background"/>
    
    <!-- Header -->
    <text x="${width / 2}" y="30" class="title" text-anchor="middle" font-size="24">
        ${username}'s Skill Tree
    </text>
    <text x="${width / 2}" y="50" class="subtitle" text-anchor="middle" font-size="14">
        Based on GitHub Activity • ${skillTreeData.length} Skills Detected
    </text>
    
    <!-- Connections -->
    ${connections.map(conn => `
    <path class="connection" d="M ${conn.from.x} ${conn.from.y} Q ${conn.from.x} ${(conn.from.y + conn.to.y) / 2}, ${conn.to.x} ${conn.to.y}"/>
    `).join('')}
    
    <!-- Skill Nodes -->`;

    layout.forEach(skill => {
        const gradient = getGradientForCategory(skill.category);
        const levelColor = getLevelColor(skill.level);
        
        svg += `
    <g class="node">
        <!-- Node background -->
        <rect x="${skill.x}" y="${skill.y}" width="${nodeWidth}" height="${nodeHeight}" 
              rx="8" fill="url(#${gradient})" opacity="0.9"/>
        
        <!-- Level indicator -->
        <rect x="${skill.x + 5}" y="${skill.y + 5}" width="${(nodeWidth - 10) * (skill.level / 5)}" height="4" 
              rx="2" fill="${levelColor}" opacity="0.8"/>
        
        <!-- Icon -->
        <text x="${skill.x + 12}" y="${skill.y + 30}" class="icon" dominant-baseline="middle">
            ${skill.icon}
        </text>
        
        <!-- Skill name -->
        <text x="${skill.x + 38}" y="${skill.y + 24}" class="skill-text" font-size="13">
            ${truncateText(skill.name, 15)}
        </text>
        
        <!-- Level -->
        <text x="${skill.x + 38}" y="${skill.y + 38}" class="skill-level">
            Level ${skill.level}/5 ${skill.percentage ? `• ${skill.percentage}%` : ''}
        </text>
        
        <!-- Level stars -->
        <text x="${skill.x + nodeWidth - 35}" y="${skill.y + 30}" font-size="10" fill="#fbbf24">
            ${'⭐'.repeat(skill.level)}
        </text>
    </g>`;
    });

    svg += `
    
    <!-- Footer -->
    <text x="${width / 2}" y="${height - 15}" class="subtitle" text-anchor="middle" font-size="11">
        Generated by GitHub Skill Tree • github.com/${username}
    </text>
</svg>`;

    return svg;
}

function getGradientForCategory(category) {
    const gradients = {
        'language': 'grad1',      // Purple
        'frontend': 'grad2',       // Pink-Red
        'backend': 'grad3',        // Blue-Cyan
        'mobile': 'grad6',         // Teal-Pink
        'database': 'grad4',       // Green
        'ai-ml': 'grad8',          // Purple-Blue
        'devops': 'grad3',         // Blue
        'testing': 'grad7',        // Pink
        'styling': 'grad2',        // Pink
        'state': 'grad6',          // Teal
        'build-tool': 'grad4',     // Green
        'api': 'grad3',            // Blue
        'web3': 'grad1',           // Purple
        'game-dev': 'grad5',       // Orange-Yellow
        'tool': 'grad4',           // Green
        'meta': 'grad5'            // Orange-Yellow
    };
    return gradients[category] || 'grad4';
}

function getLevelColor(level) {
    const colors = {
        1: '#ef4444',  // Red
        2: '#f97316',  // Orange
        3: '#eab308',  // Yellow
        4: '#22c55e',  // Green
        5: '#3b82f6'   // Blue
    };
    return colors[level] || '#6b7280';
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 2) + '..';
}

module.exports = {
    createSkillTreeSVG
};