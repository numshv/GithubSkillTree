const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createSkillTreeSVG } = require('./SVGGenerator');

async function retryRequest(fn, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.log(`  Attempt ${i + 1}/${retries} failed: ${error.message}`);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
    }
}

let ROADMAP_CACHE = new Map();

const ROADMAP_MAPPING = {
    'HTML': ['frontend'],
    'CSS': ['frontend'],
    'JavaScript': ['frontend', 'backend', 'javascript', 'react', 'nodejs', 'vue', 'angular'],
    'TypeScript': ['frontend', 'backend', 'typescript', 'react', 'nodejs', 'angular'],
    'Python': ['backend', 'python', 'django', 'flask', 'fastapi', 'ai-data-scientist'],
    'Java': ['backend', 'java', 'spring-boot'],
    'Go': ['backend', 'golang'],
    'Rust': ['backend', 'rust'],
    'PHP': ['backend', 'php', 'laravel'],
    'Ruby': ['backend', 'ruby'],
    'C#': ['backend', 'csharp', 'aspnet-core'],
    'C++': ['backend', 'cpp'],
    'Swift': ['mobile', 'ios', 'swift'],
    'Kotlin': ['mobile', 'android', 'kotlin'],
    'Dart': ['mobile', 'flutter'],
    'R': ['ai-data-scientist', 'data-analyst'],
    'SQL': ['backend', 'postgresql-dba', 'sql'],
    'Shell': ['devops', 'linux'],
    'docker': ['devops', 'docker'],
    'kubernetes': ['devops', 'kubernetes'],
    'react': ['frontend', 'react', 'react-native'],
    'vue': ['frontend', 'vue'],
    'angular': ['frontend', 'angular'],
    'django': ['backend', 'python', 'django'],
    'flask': ['backend', 'python', 'flask'],
    'spring': ['backend', 'java', 'spring-boot'],
    'laravel': ['backend', 'php', 'laravel'],
    'mongodb': ['backend', 'mongodb'],
    'postgresql': ['backend', 'postgresql-dba'],
    'aws': ['devops', 'aws'],
    'azure': ['devops'],
    'gcp': ['devops'],
};

function loadRoadmapOnDemand(roadmapName) {
    if (ROADMAP_CACHE.has(roadmapName)) {
        return ROADMAP_CACHE.get(roadmapName);
    }
    
    try {
        const filePath = path.join(__dirname, 'roadmap_data', `${roadmapName}.json`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        ROADMAP_CACHE.set(roadmapName, data);
        console.log(`Loaded ${roadmapName}.json`);
        return data;
    } catch (err) {
        return null;
    }
}

function determineRelevantRoadmaps(languageStats, allText) {
    const relevantRoadmaps = new Set(['frontend', 'backend']); 
    
    // Check detected languages
    Object.keys(languageStats).forEach(lang => {
        if (ROADMAP_MAPPING[lang]) {
            ROADMAP_MAPPING[lang].forEach(roadmap => relevantRoadmaps.add(roadmap));
        }
    });
    
    // Check technologies in text
    Object.keys(ROADMAP_MAPPING).forEach(tech => {
        if (allText.includes(tech.toLowerCase())) {
            ROADMAP_MAPPING[tech].forEach(roadmap => relevantRoadmaps.add(roadmap));
        }
    });
    
    return Array.from(relevantRoadmaps);
}

function buildTreeFromRoadmaps(relevantRoadmaps) {
    const tree = new Map();
    
    console.log(`Loading ${relevantRoadmaps.length} relevant roadmaps...`);
    
    // Load only relevant roadmaps
    relevantRoadmaps.forEach(roadmapName => {
        const roadmap = loadRoadmapOnDemand(roadmapName);
        if (!roadmap || !roadmap.nodes) return;
        
        roadmap.nodes.forEach(node => {
            // Skip non-skill nodes
            if (['section', 'vertical', 'horizontal', 'paragraph', 'button', 'legend', 'title', 'label'].includes(node.type)) {
                return;
            }
            
            const label = node.label || node.id;
            const keywords = node.keywords || [];
            const category = node.category || 'general';
            
            if (!tree.has(label)) {
                tree.set(label, {
                    label: label,
                    keywords: keywords,
                    category: category,
                    parent: null,
                    children: [],
                    level: 0,
                    type: node.type,
                    roadmap: roadmapName
                });
            }
        });
        
        if (roadmap.edges) {
            roadmap.edges.forEach(edge => {
                const parentNode = findNodeById(roadmap.nodes, edge.source);
                const childNode = findNodeById(roadmap.nodes, edge.target);
                
                if (parentNode && childNode) {
                    const parentLabel = parentNode.label || parentNode.id;
                    const childLabel = childNode.label || childNode.id;
                    
                    const parent = tree.get(parentLabel);
                    const child = tree.get(childLabel);
                    
                    if (parent && child) {
                        if (!parent.children.includes(childLabel)) {
                            parent.children.push(childLabel);
                        }
                        child.parent = parentLabel;
                        child.level = (parent.level || 0) + 1;
                    }
                }
            });
        }
    });
    
    return tree;
}

function findNodeById(nodes, id) {
    return nodes.find(n => n.id === id);
}

async function generateSkillTree(username) {
    try {
        const githubData = await fetchGitHubData(username);
        const skillTreeData = buildSkillTree(githubData);
        const svgCode = createSkillTreeSVG(skillTreeData, username);
        
        return svgCode;
    } catch (error) {
        throw new Error(`Failed to generate skill tree: ${error.message}`);
    }
}

async function fetchGitHubData(username) {
    const token = process.env.GITHUB_TOKEN;
    const headers = {
        'User-Agent': 'GitHub-Skill-Tree-Generator',
        'Accept': 'application/vnd.github.v3+json'
    };
    
    if (token) {
        headers['Authorization'] = `token ${token}`;
    }

    const axiosConfig = {
        headers,
        timeout: 30000,
        family: 4
    };

    try {
        console.log(`\nFetching data for user: ${username}`);
        
        const userResponse = await retryRequest(() => 
            axios.get(`https://api.github.com/users/${username}`, axiosConfig)
        );
        const user = userResponse.data;
        console.log(`✓ User found: ${user.login} (${user.public_repos} public repos)`);

        console.log(`Fetching repositories...`);
        const reposResponse = await retryRequest(() => 
            axios.get(
                `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, 
                axiosConfig
            )
        );
        const repos = reposResponse.data;
        console.log(`Found ${repos.length} repositories`);

        if (repos.length === 0) {
            return {
                user: {
                    username: user.login,
                    name: user.name,
                    followers: user.followers,
                    public_repos: user.public_repos,
                    created_at: user.created_at
                },
                repos: []
            };
        }

        console.log(`Analyzing repositories...`);
        
        const BATCH_SIZE = 5;
        const REPO_LIMIT = Math.min(repos.length, 30);
        const repoDetails = [];
        
        for (let i = 0; i < REPO_LIMIT; i += BATCH_SIZE) {
            const batch = repos.slice(i, Math.min(i + BATCH_SIZE, REPO_LIMIT));
            console.log(`  Processing repos ${i + 1}-${Math.min(i + BATCH_SIZE, REPO_LIMIT)}/${REPO_LIMIT}...`);
            
            const batchResults = await Promise.allSettled(
                batch.map(async (repo) => {
                    try {
                        const langResponse = await retryRequest(
                            () => axios.get(repo.languages_url, {
                                ...axiosConfig,
                                timeout: 10000
                            }),
                            2,
                            500
                        );
                        
                        return {
                            name: repo.name,
                            languages: langResponse.data,
                            stars: repo.stargazers_count,
                            forks: repo.forks_count,
                            topics: repo.topics || [],
                            description: repo.description || ''
                        };
                    } catch (err) {
                        return {
                            name: repo.name,
                            languages: {},
                            stars: repo.stargazers_count,
                            topics: repo.topics || [],
                            description: repo.description || ''
                        };
                    }
                })
            );
            
            batchResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    repoDetails.push(result.value);
                }
            });
            
            if (i + BATCH_SIZE < REPO_LIMIT) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        const validRepos = repoDetails.filter(r => r !== null);
        console.log(`Successfully analyzed ${validRepos.length} repositories\n`);

        return {
            user: {
                username: user.login,
                name: user.name,
                followers: user.followers,
                public_repos: user.public_repos,
                created_at: user.created_at
            },
            repos: validRepos
        };

    } catch (error) {
        if (error.response && error.response.status === 404) {
            throw new Error(`User '${username}' not found`);
        }
        throw new Error(`GitHub API error: ${error.message}`);
    }
}

function buildSkillTree(data) {
    console.log(`\nBuilding skill tree...`);
    
    if (!data.repos || data.repos.length === 0) {
        console.log(` No repository data available`);
        return createMinimalTree(data);
    }

    // Prepare search data
    const allText = data.repos.map(r => 
        `${r.name} ${r.description} ${r.topics.join(' ')}`
    ).join(' ').toLowerCase();

    const languageStats = {};
    data.repos.forEach(repo => {
        Object.entries(repo.languages || {}).forEach(([lang, bytes]) => {
            languageStats[lang] = (languageStats[lang] || 0) + bytes;
        });
    });

    console.log(` Detected languages: ${Object.keys(languageStats).join(', ')}`);

    // Determine which roadmaps to load
    const relevantRoadmaps = determineRelevantRoadmaps(languageStats, allText);
    
    // Build tree from only relevant roadmaps
    const skillTree = buildTreeFromRoadmaps(relevantRoadmaps);
    console.log(` Built tree with ${skillTree.size} skills from ${relevantRoadmaps.length} roadmaps`);
    
    const detectedSkills = new Map();

    console.log(` Matching skills to your repos...`);

    // Match skills from tree to user's repos
    let matchCount = 0;
    skillTree.forEach((skill, label) => {
        const isMatch = detectSkillInRepos(skill, allText, languageStats, data.repos);
        
        if (isMatch) {
            matchCount++;
            const repoCount = countReposWithSkill(skill, data.repos, allText, languageStats);
            const level = calculateSkillLevel(repoCount, skill.level);
            
            detectedSkills.set(label, {
                name: label,
                level: level,
                category: skill.category,
                parent: skill.parent,
                icon: skill.icon,
                repoCount: repoCount,
                treeLevel: skill.level,
                children: skill.children
            });
        }
    });

    console.log(`Detected ${matchCount} matching skills`);

    addParentSkills(detectedSkills, skillTree);

    const finalSkills = Array.from(detectedSkills.values())
        .sort((a, b) => {
            if (a.treeLevel !== b.treeLevel) {
                return a.treeLevel - b.treeLevel;
            }
            return b.level - a.level;
        });

    console.log(`Final skill tree: ${finalSkills.length} nodes`);
    console.log(`Loaded roadmaps: ${relevantRoadmaps.join(', ')}\n`);
    
    return finalSkills;
}

function detectSkillInRepos(skill, allText, languageStats, repos) {
    const keywordMatch = skill.keywords.some(keyword => 
        allText.includes(keyword.toLowerCase())
    );
    
    if (keywordMatch) return true;
    if (allText.includes(skill.label.toLowerCase())) return true;
    if (languageStats[skill.label]) return true;
    
    const topicMatch = repos.some(repo => 
        repo.topics.some(topic => 
            skill.keywords.includes(topic.toLowerCase()) ||
            topic.toLowerCase().includes(skill.label.toLowerCase())
        )
    );
    
    return topicMatch;
}

function countReposWithSkill(skill, repos, allText, languageStats) {
    let count = 0;
    
    repos.forEach(repo => {
        const repoText = `${repo.name} ${repo.description} ${repo.topics.join(' ')}`.toLowerCase();
        const repoLangs = Object.keys(repo.languages || {});
        const hasKeyword = skill.keywords.some(k => repoText.includes(k.toLowerCase()));
        const hasLabel = repoText.includes(skill.label.toLowerCase());
        const hasLang = repoLangs.includes(skill.label);
        
        if (hasKeyword || hasLabel || hasLang) {
            count++;
        }
    });
    
    return count;
}

function calculateSkillLevel(repoCount, treeLevel) {
    let level = 0;
    if (repoCount >= 5) level = 5;
    else if (repoCount >= 3) level = 4;
    else if (repoCount >= 2) level = 3;
    else if (repoCount >= 1) level = 2;
    else level = 1;
    
    if (treeLevel >= 2 && repoCount < 2) {
        level = Math.max(1, level - 1);
    }
    
    return level;
}

function addParentSkills(detectedSkills, skillTree) {
    const detected = Array.from(detectedSkills.keys());
    
    detected.forEach(skillName => {
        const skill = detectedSkills.get(skillName);
        
        let currentParent = skill.parent;
        while (currentParent && !detectedSkills.has(currentParent)) {
            const parentSkill = skillTree.get(currentParent);
            
            if (parentSkill) {
                detectedSkills.set(currentParent, {
                    name: currentParent,
                    level: Math.max(1, skill.level - 1),
                    category: parentSkill.category,
                    parent: parentSkill.parent,
                    icon: parentSkill.icon,
                    repoCount: 0,
                    treeLevel: parentSkill.level,
                    children: parentSkill.children,
                    inferred: true 
                });
                
                currentParent = parentSkill.parent;
            } else {
                break;
            }
        }
    });
}

function createMinimalTree(data) {
    const accountAge = calculateAccountAge(data.user.created_at);
    
    return [{
        name: 'GitHub Profile',
        level: 3,
        category: 'meta',
        parent: null,
        icon: '👤',
        repoCount: data.user.public_repos,
        treeLevel: 0
    }, {
        name: 'Experience',
        level: Math.min(5, Math.ceil(accountAge / 2)),
        category: 'meta',
        parent: 'GitHub Profile',
        icon: '⭐',
        repoCount: 0,
        treeLevel: 1
    }];
}

function calculateAccountAge(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);
    return diffYears;
}

module.exports = {
    generateSkillTree,
    fetchGitHubData,
    buildSkillTree
};