function createSkillTreeSVG(skillTreeData, username) {
    const width = 800; 
    const paddingHorizontal = 60; 
    const paddingTop = 340;        
    const paddingBottom = 80;     

    const nodeWidth = 110; 
    const nodeHeight = 40;
    const centerNodeWidth = 220;
    const centerNodeHeight = 50;
    
    const initialRadius = 170; 
    const ringSpacing = 160; 
    
    const centerPoint = { 
        x: width / 2, 
        y: paddingTop + centerNodeHeight / 2 
    };
    
    const rotationCenter = centerPoint; 

    const filteredSkillData = skillTreeData.filter(skill => {
        return skill.category.toLowerCase() !== 'label';
    });

    const categoryGroups = {};
    filteredSkillData.forEach(skill => {
        if (skill.category !== 'meta') {
            const cat = skill.category.toLowerCase();
            if (!categoryGroups[cat]) {
                categoryGroups[cat] = [];
            }
            categoryGroups[cat].push(skill);
        }
    });
    
    const categories = Object.keys(categoryGroups).sort();
    
    const centerNode = {
        name: `${username}'s SKILLS`,
        category: 'meta',
        x: centerPoint.x - centerNodeWidth / 2,
        y: centerPoint.y - centerNodeHeight / 2, 
        nodeWidth: centerNodeWidth,
        nodeHeight: centerNodeHeight,
        type: 'center',
        center: { x: centerPoint.x, y: centerPoint.y }
    };

    const layout = [centerNode];
    const connections = [];

    const numCategories = categories.length;
    const angleStep = (2 * Math.PI) / numCategories;
    const startAngleOffset = numCategories % 2 === 0 ? angleStep / 2 : 0; 

    categories.forEach((category, catIndex) => {
        const skills = categoryGroups[category];
        if (skills.length === 0) return;

        const angle = (angleStep * catIndex) + startAngleOffset - (Math.PI / 2);
        
        const categoryNode = {
            name: category.toUpperCase().replace(/-/g, ' '),
            category: category,
            parent: centerNode.name,
            x: rotationCenter.x + initialRadius * Math.cos(angle) - nodeWidth / 2,
            y: rotationCenter.y + initialRadius * Math.sin(angle) - nodeHeight / 2,
            nodeWidth: nodeWidth,
            nodeHeight: nodeHeight,
            type: 'category',
            center: { 
                x: rotationCenter.x + initialRadius * Math.cos(angle), 
                y: rotationCenter.y + initialRadius * Math.sin(angle) 
            }
        };
        layout.push(categoryNode);

        connections.push({
            from: centerNode.center, 
            to: categoryNode.center
        });
        
        const displaySkills = skills.slice(0, 3); 
        const radiusL2 = initialRadius + ringSpacing;
        
        const arcSpan = angleStep * 0.7;
        const startAngle = angle - (arcSpan / 2);
        const skillAngleStep = displaySkills.length > 1 ? arcSpan / (displaySkills.length - 1) : 0;

        displaySkills.forEach((skill, idx) => {
            const skillAngle = displaySkills.length === 1 
                ? angle 
                : startAngle + (idx * skillAngleStep);
            
            const skillNode = {
                ...skill,
                x: rotationCenter.x + radiusL2 * Math.cos(skillAngle) - nodeWidth / 2,
                y: rotationCenter.y + radiusL2 * Math.sin(skillAngle) - nodeHeight / 2,
                nodeWidth: nodeWidth,
                nodeHeight: nodeHeight,
                type: 'skill',
                center: {
                    x: rotationCenter.x + radiusL2 * Math.cos(skillAngle),
                    y: rotationCenter.y + radiusL2 * Math.sin(skillAngle)
                }
            };
            layout.push(skillNode);

            connections.push({
                from: categoryNode.center,
                to: skillNode.center
            });
        });
    });

    const maxY = Math.max(...layout.map(node => node.y + node.nodeHeight));
    const finalHeight = Math.max(500, maxY + paddingBottom); 
    
    function getHexagonPath(x, y, w, h) {
        const side = w / 2;
        const halfH = h / 2;
        return `M ${x + side * 0.25} ${y} L ${x + side * 1.75} ${y} L ${x + w} ${y + halfH} L ${x + side * 1.75} ${y + h} L ${x + side * 0.25} ${y + h} L ${x} ${y + halfH} Z`;
    }
    
    function getRectPath(x, y, w, h, radius = 8) {
        return `M ${x + radius} ${y} L ${x + w - radius} ${y} Q ${x + w} ${y} ${x + w} ${y + radius} L ${x + w} ${y + h - radius} Q ${x + w} ${y + h} ${x + w - radius} ${y + h} L ${x + radius} ${y + h} Q ${x} ${y + h} ${x} ${y + h - radius} L ${x} ${y + radius} Q ${x} ${y} ${x + radius} ${y} Z`;
    }

    function getSolidColorForCategory(category) {
        const colors = {
            'language': '#3b82f6', 'programming-language': '#3b82f6', 'frontend': '#ec4899', 'backend': '#10b981', 'framework': '#8b5cf6', 'database': '#f59e0b', 'testing': '#06b6d4', 'devops': '#ef4444', 'cloud': '#6366f1', 'mobile': '#f97316', 'tools': '#14b8a6', 'security': '#dc2626', 'data-science': '#8b5cf6', 'subtopic': '#64748b', 'topic': '#475569', 'api': '#0ea5e9', 'general': '#6b7280', 'meta': '#475569', 'label': '#475569'
        };
        return colors[category.toLowerCase()] || '#6b7280';
    }
    
    function getBorderColor(category) {
        return getSolidColorForCategory(category);
    }
    
    function truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 2) + '..';
    }

    let svg = `<svg width="${width}" height="${finalHeight}" viewBox="0 0 ${width} ${finalHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/></filter>
    </defs>
    
    <style>
        .background { fill: #0a0e1a; }
        .title-text { fill: #e2e8f0; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 16px; }
        .subtitle { fill: #64748b; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 400; font-size: 11px; }
        .skill-text { fill: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 600; font-size: 11px; }
        .center-text { fill: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; font-size: 18px; }
        .skill-level { fill: #cbd5e1; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; }
        .connection { stroke: #334155; stroke-width: 1.5; fill: none; opacity: 0.5; }
        .node { filter: url(#shadow); }
    </style>
    
    <rect width="100%" height="100%" class="background"/>

    ${connections.map(conn => `<line class="connection" x1="${conn.from.x}" y1="${conn.from.y}" x2="${conn.to.x}" y2="${conn.to.y}"/>`).join('')}
    
    ${layout.map(node => {
        const isCenter = node.type === 'center';
        const isCategory = node.type === 'category';
        const pathData = isCenter ? getRectPath(node.x, node.y, node.nodeWidth, node.nodeHeight, 8) : getHexagonPath(node.x, node.y, node.nodeWidth, node.nodeHeight);
        const fillColor = isCenter ? '#1e293b' : getSolidColorForCategory(node.category);
        const textX = node.x + node.nodeWidth / 2;
        const textY = node.y + node.nodeHeight / 2;
        
        let levelIndicator = '';
        if (!isCenter && !isCategory && node.level) {
            const stars = '★'.repeat(node.level) + '☆'.repeat(5 - node.level);
            levelIndicator = `<text x="${textX}" y="${textY + 12}" class="skill-level" text-anchor="middle" dominant-baseline="middle">${stars}</text>`;
        }
        
        return `
    <g class="node">
        <path d="${pathData}" fill="${fillColor}" stroke="${getBorderColor(node.category)}" stroke-width="1.5" opacity="0.95"/>
        <text x="${textX}" y="${textY - (levelIndicator ? 6 : 0)}" class="${isCenter ? 'center-text' : 'skill-text'}" text-anchor="middle" dominant-baseline="middle">${truncateText(node.name, isCenter ? 25 : 13)}</text>
        ${levelIndicator}
    </g>`;
    }).join('')}
    <text x="${width / 2}" y="${finalHeight - 35}" class="title-text" text-anchor="middle">GitHub Skill Tree Visualization</text>
    <text x="${width / 2}" y="${finalHeight - 15}" class="subtitle" text-anchor="middle">Generated by GitHub Skill Tree • Total Nodes: ${layout.length} • @${username}</text>
</svg>`;

    return svg;
}

module.exports = {
    createSkillTreeSVG
};