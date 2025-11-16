// skill-logic.js

const axios = require('axios');
const { createSkillTreeSVG } = require('./SVGGenerator'); // Akan kita buat nanti

async function generateSkillTree(username) {
    const githubData = await fetchGitHubData(username);
    const skillTreeData = applyRules(githubData);
    const svgCode = createSkillTreeSVG(skillTreeData);
    
    return svgCode;
}


async function fetchGitHubData(username) {
    // DUMMY DATA
    console.log(`Mengambil data untuk: ${username}`);
    return {
        repos: [
            { name: 'project-js', language: 'JavaScript', commits: 50 },
            { name: 'data-py', language: 'Python', commits: 15 },
        ],
        followers: 10
    };
}

function applyRules(data) {
    // DUMMY DATA 
    return [
        { name: 'JavaScript', level: 2, parent: null },
        { name: 'Python', level: 1, parent: 'JavaScript' },
        { name: 'API Design', level: 3, parent: 'JavaScript' },
    ];
}

module.exports = {
    generateSkillTree
};