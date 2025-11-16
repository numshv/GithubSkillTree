function createSkillTreeSVG(skillTreeData) {
    // DUMMY SVG
    let svgContent = skillTreeData.map((skill, index) => {
        const x = 50;
        const y = 30 + (index * 40);
        return `<rect x="${x}" y="${y}" width="150" height="30" rx="5" fill="#38bdf8"/>
                <text x="${x + 75}" y="${y + 15}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="white">
                    ${skill.name} (Lv ${skill.level})
                </text>`;
    }).join('');

    const width = 250;
    const height = 40 + (skillTreeData.length * 40);

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
            .background { fill: #f0f4f8; }
        </style>
        <rect width="100%" height="100%" class="background"/>
        ${svgContent}
        <text x="10" y="20" font-size="14" fill="#1e293b">Skill Tree (Dummy)</text>
    </svg>`;
}

module.exports = {
    createSkillTreeSVG
};