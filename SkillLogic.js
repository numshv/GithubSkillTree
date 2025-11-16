const axios = require('axios');
const { createSkillTreeSVG } = require('./SVGGenerator');

// Add request retry wrapper
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

async function generateSkillTree(username) {
    try {
        const githubData = await fetchGitHubData(username);
        const skillTreeData = applyRules(githubData);
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

    // Axios config with extended timeout for slow connections
    const axiosConfig = {
        headers,
        timeout: 30000, // 30 seconds
        family: 4 // Force IPv4
    };

    try {
        console.log(`\n🔍 Fetching data for user: ${username}`);
        
        // Step 1: Fetch user info
        const userResponse = await retryRequest(() => 
            axios.get(`https://api.github.com/users/${username}`, axiosConfig)
        );
        const user = userResponse.data;
        console.log(`✓ User found: ${user.login} (${user.public_repos} public repos)`);

        // Step 2: Fetch repositories
        console.log(`📦 Fetching repositories...`);
        const reposResponse = await retryRequest(() => 
            axios.get(
                `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, 
                axiosConfig
            )
        );
        const repos = reposResponse.data;
        console.log(`✓ Found ${repos.length} repositories`);

        if (repos.length === 0) {
            console.log(`⚠ No public repositories found`);
            return {
                user: {
                    username: user.login,
                    name: user.name,
                    followers: user.followers,
                    following: user.following,
                    public_repos: user.public_repos,
                    created_at: user.created_at,
                    bio: user.bio || ''
                },
                repos: []
            };
        }

        // Step 3: Fetch languages for repos (with better error handling)
        console.log(`🔬 Analyzing repositories (this may take a while with slow connection)...`);
        
        // Process in smaller batches for slow connections
        const BATCH_SIZE = 5;
        const REPO_LIMIT = Math.min(repos.length, 30);
        const repoDetails = [];
        
        for (let i = 0; i < REPO_LIMIT; i += BATCH_SIZE) {
            const batch = repos.slice(i, Math.min(i + BATCH_SIZE, REPO_LIMIT));
            console.log(`  Processing repos ${i + 1}-${Math.min(i + BATCH_SIZE, REPO_LIMIT)}/${REPO_LIMIT}...`);
            
            const batchResults = await Promise.allSettled(
                batch.map(async (repo) => {
                    try {
                        // Try to fetch languages with retry
                        const langResponse = await retryRequest(
                            () => axios.get(repo.languages_url, {
                                ...axiosConfig,
                                timeout: 10000 // Shorter timeout per repo
                            }),
                            2, // Only 2 retries per repo
                            500 // Shorter delay
                        );
                        
                        return {
                            name: repo.name,
                            languages: langResponse.data,
                            stars: repo.stargazers_count,
                            forks: repo.forks_count,
                            size: repo.size,
                            created_at: repo.created_at,
                            updated_at: repo.updated_at,
                            topics: repo.topics || [],
                            description: repo.description || '',
                            has_issues: repo.has_issues,
                            open_issues: repo.open_issues_count
                        };
                    } catch (err) {
                        // Fallback: create basic repo info without languages
                        console.log(`    ⚠ ${repo.name}: Using fallback (${err.message})`);
                        return {
                            name: repo.name,
                            languages: {},
                            stars: repo.stargazers_count,
                            forks: repo.forks_count,
                            size: repo.size,
                            created_at: repo.created_at,
                            updated_at: repo.updated_at,
                            topics: repo.topics || [],
                            description: repo.description || '',
                            has_issues: repo.has_issues,
                            open_issues: repo.open_issues_count
                        };
                    }
                })
            );
            
            // Add successful results
            batchResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    repoDetails.push(result.value);
                }
            });
            
            // Small delay between batches for slow connections
            if (i + BATCH_SIZE < REPO_LIMIT) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        const validRepos = repoDetails.filter(r => r !== null);
        console.log(`✓ Successfully analyzed ${validRepos.length} repositories`);
        
        // Count repos with language data
        const reposWithLangs = validRepos.filter(r => Object.keys(r.languages).length > 0).length;
        console.log(`✓ ${reposWithLangs} repos have language data\n`);

        return {
            user: {
                username: user.login,
                name: user.name,
                followers: user.followers,
                following: user.following,
                public_repos: user.public_repos,
                created_at: user.created_at,
                bio: user.bio || ''
            },
            repos: validRepos
        };

    } catch (error) {
        if (error.response && error.response.status === 404) {
            throw new Error(`User '${username}' not found`);
        }
        if (error.code === 'ENOTFOUND') {
            throw new Error(`Cannot connect to GitHub API. Please check your internet connection.`);
        }
        if (error.code === 'ETIMEDOUT') {
            throw new Error(`Connection timeout. Your internet connection might be too slow.`);
        }
        throw new Error(`GitHub API error: ${error.message}`);
    }
}

// ============================================
// COMPREHENSIVE SKILL RULES
// Based on roadmap.sh and real-world tech stacks
// ============================================

const SKILL_RULES = {
    // ===== PROGRAMMING LANGUAGES =====
    languages: {
        'JavaScript': { weight: 1.0, category: 'language', icon: '⚡', tier: 'core' },
        'TypeScript': { weight: 1.3, category: 'language', icon: '🔷', parent: 'JavaScript', tier: 'advanced' },
        'Python': { weight: 1.0, category: 'language', icon: '🐍', tier: 'core' },
        'Java': { weight: 1.0, category: 'language', icon: '☕', tier: 'core' },
        'C++': { weight: 1.2, category: 'language', icon: '⚙️', tier: 'advanced' },
        'C': { weight: 1.1, category: 'language', icon: '🔧', tier: 'core' },
        'C#': { weight: 1.0, category: 'language', icon: '🎮', tier: 'core' },
        'Go': { weight: 1.2, category: 'language', icon: '🔷', tier: 'modern' },
        'Rust': { weight: 1.4, category: 'language', icon: '🦀', tier: 'modern' },
        'Ruby': { weight: 1.0, category: 'language', icon: '💎', tier: 'core' },
        'PHP': { weight: 0.9, category: 'language', icon: '🐘', tier: 'core' },
        'Swift': { weight: 1.1, category: 'language', icon: '🍎', tier: 'mobile' },
        'Kotlin': { weight: 1.1, category: 'language', icon: '🤖', tier: 'mobile' },
        'Dart': { weight: 1.0, category: 'language', icon: '🎯', tier: 'mobile' },
        'Scala': { weight: 1.2, category: 'language', icon: '🎭', tier: 'advanced' },
        'R': { weight: 1.0, category: 'language', icon: '📊', tier: 'data' },
        'Elixir': { weight: 1.3, category: 'language', icon: '💧', tier: 'modern' },
        'Lua': { weight: 0.9, category: 'language', icon: '🌙', tier: 'niche' },
        'Shell': { weight: 0.8, category: 'language', icon: '🖥️', tier: 'tool' },
        'PowerShell': { weight: 0.8, category: 'language', icon: '💻', tier: 'tool' },
        'HTML': { weight: 0.6, category: 'language', icon: '📄', tier: 'markup' },
        'CSS': { weight: 0.6, category: 'language', icon: '🎨', tier: 'markup' },
        'SCSS': { weight: 0.7, category: 'language', icon: '🎨', parent: 'CSS', tier: 'markup' },
    },

    // ===== FRONTEND FRAMEWORKS =====
    frontendFrameworks: {
        'React': { keywords: ['react', 'react-dom', 'reactjs', 'jsx'], parent: 'JavaScript', icon: '⚛️', tier: 'major' },
        'Next.js': { keywords: ['nextjs', 'next.js', 'next'], parent: 'React', icon: '▲', tier: 'meta-framework' },
        'Vue': { keywords: ['vue', 'vuejs', 'vue.js'], parent: 'JavaScript', icon: '💚', tier: 'major' },
        'Nuxt': { keywords: ['nuxt', 'nuxtjs'], parent: 'Vue', icon: '💚', tier: 'meta-framework' },
        'Angular': { keywords: ['angular', '@angular'], parent: 'TypeScript', icon: '🅰️', tier: 'major' },
        'Svelte': { keywords: ['svelte', 'sveltekit'], parent: 'JavaScript', icon: '🔥', tier: 'modern' },
        'SolidJS': { keywords: ['solid-js', 'solidjs'], parent: 'JavaScript', icon: '💠', tier: 'modern' },
        'Qwik': { keywords: ['qwik'], parent: 'JavaScript', icon: '⚡', tier: 'modern' },
        'Astro': { keywords: ['astro'], parent: 'JavaScript', icon: '🚀', tier: 'modern' },
        'Remix': { keywords: ['remix'], parent: 'React', icon: '💿', tier: 'meta-framework' },
    },

    // ===== BACKEND FRAMEWORKS =====
    backendFrameworks: {
        'Node.js': { keywords: ['nodejs', 'node', 'node.js'], parent: 'JavaScript', icon: '🟢', tier: 'runtime' },
        'Express': { keywords: ['express', 'expressjs'], parent: 'Node.js', icon: '🚂', tier: 'framework' },
        'NestJS': { keywords: ['nestjs', 'nest'], parent: 'TypeScript', icon: '🦅', tier: 'framework' },
        'Fastify': { keywords: ['fastify'], parent: 'Node.js', icon: '⚡', tier: 'framework' },
        'Django': { keywords: ['django'], parent: 'Python', icon: '🎸', tier: 'framework' },
        'Flask': { keywords: ['flask'], parent: 'Python', icon: '🧪', tier: 'framework' },
        'FastAPI': { keywords: ['fastapi'], parent: 'Python', icon: '⚡', tier: 'framework' },
        'Spring Boot': { keywords: ['spring-boot', 'spring', 'springboot'], parent: 'Java', icon: '🍃', tier: 'framework' },
        'Laravel': { keywords: ['laravel'], parent: 'PHP', icon: '🔺', tier: 'framework' },
        'Symfony': { keywords: ['symfony'], parent: 'PHP', icon: '🎼', tier: 'framework' },
        'Ruby on Rails': { keywords: ['rails', 'ruby-on-rails'], parent: 'Ruby', icon: '🚂', tier: 'framework' },
        'ASP.NET': { keywords: ['aspnet', 'asp.net', 'dotnet'], parent: 'C#', icon: '🔷', tier: 'framework' },
        'Gin': { keywords: ['gin-gonic', 'gin'], parent: 'Go', icon: '🍸', tier: 'framework' },
        'Fiber': { keywords: ['fiber'], parent: 'Go', icon: '⚡', tier: 'framework' },
        'Actix': { keywords: ['actix', 'actix-web'], parent: 'Rust', icon: '🦀', tier: 'framework' },
    },

    // ===== MOBILE DEVELOPMENT =====
    mobile: {
        'React Native': { keywords: ['react-native', 'reactnative'], parent: 'React', icon: '📱', tier: 'framework' },
        'Flutter': { keywords: ['flutter'], parent: 'Dart', icon: '🦋', tier: 'framework' },
        'Expo': { keywords: ['expo'], parent: 'React Native', icon: '⚛️', tier: 'tool' },
        'Android Native': { keywords: ['android'], parent: 'Kotlin', icon: '🤖', tier: 'platform' },
        'iOS Native': { keywords: ['ios', 'swift', 'swiftui'], parent: 'Swift', icon: '🍎', tier: 'platform' },
        'Ionic': { keywords: ['ionic'], parent: 'Angular', icon: '⚡', tier: 'framework' },
    },

    // ===== DATABASES =====
    databases: {
        'PostgreSQL': { keywords: ['postgresql', 'postgres', 'psql'], parent: null, icon: '🐘', tier: 'sql' },
        'MySQL': { keywords: ['mysql'], parent: null, icon: '🐬', tier: 'sql' },
        'MongoDB': { keywords: ['mongodb', 'mongo'], parent: null, icon: '🍃', tier: 'nosql' },
        'Redis': { keywords: ['redis'], parent: null, icon: '🔴', tier: 'cache' },
        'SQLite': { keywords: ['sqlite'], parent: null, icon: '💾', tier: 'sql' },
        'Cassandra': { keywords: ['cassandra'], parent: null, icon: '💍', tier: 'nosql' },
        'CouchDB': { keywords: ['couchdb'], parent: null, icon: '🛋️', tier: 'nosql' },
        'Elasticsearch': { keywords: ['elasticsearch', 'elastic'], parent: null, icon: '🔍', tier: 'search' },
        'Neo4j': { keywords: ['neo4j'], parent: null, icon: '🕸️', tier: 'graph' },
        'Firebase': { keywords: ['firebase', 'firestore'], parent: null, icon: '🔥', tier: 'baas' },
        'Supabase': { keywords: ['supabase'], parent: 'PostgreSQL', icon: '⚡', tier: 'baas' },
    },

    // ===== AI & MACHINE LEARNING =====
    aiMl: {
        'TensorFlow': { keywords: ['tensorflow', 'tf'], parent: 'Python', icon: '🧠', tier: 'framework' },
        'PyTorch': { keywords: ['pytorch', 'torch'], parent: 'Python', icon: '🔥', tier: 'framework' },
        'Keras': { keywords: ['keras'], parent: 'TensorFlow', icon: '🧠', tier: 'library' },
        'Scikit-learn': { keywords: ['sklearn', 'scikit-learn'], parent: 'Python', icon: '📊', tier: 'library' },
        'Pandas': { keywords: ['pandas'], parent: 'Python', icon: '🐼', tier: 'library' },
        'NumPy': { keywords: ['numpy'], parent: 'Python', icon: '🔢', tier: 'library' },
        'OpenCV': { keywords: ['opencv', 'cv2'], parent: 'Python', icon: '👁️', tier: 'library' },
        'Hugging Face': { keywords: ['transformers', 'huggingface'], parent: 'Python', icon: '🤗', tier: 'library' },
        'LangChain': { keywords: ['langchain'], parent: 'Python', icon: '🦜', tier: 'library' },
    },

    // ===== DEVOPS & CLOUD =====
    devops: {
        'Docker': { keywords: ['docker', 'dockerfile', 'docker-compose'], parent: null, icon: '🐳', tier: 'container' },
        'Kubernetes': { keywords: ['kubernetes', 'k8s', 'kubectl'], parent: 'Docker', icon: '☸️', tier: 'orchestration' },
        'AWS': { keywords: ['aws', 'amazon-web-services', 'ec2', 's3', 'lambda'], parent: null, icon: '☁️', tier: 'cloud' },
        'Azure': { keywords: ['azure', 'microsoft-azure'], parent: null, icon: '☁️', tier: 'cloud' },
        'GCP': { keywords: ['gcp', 'google-cloud', 'cloud-platform'], parent: null, icon: '☁️', tier: 'cloud' },
        'Terraform': { keywords: ['terraform', 'tf'], parent: null, icon: '🏗️', tier: 'iac' },
        'Ansible': { keywords: ['ansible'], parent: null, icon: '📜', tier: 'automation' },
        'Jenkins': { keywords: ['jenkins'], parent: null, icon: '👷', tier: 'ci-cd' },
        'GitHub Actions': { keywords: ['github-actions', 'actions', 'workflow'], parent: null, icon: '⚙️', tier: 'ci-cd' },
        'GitLab CI': { keywords: ['gitlab-ci', 'gitlab'], parent: null, icon: '🦊', tier: 'ci-cd' },
        'CircleCI': { keywords: ['circleci'], parent: null, icon: '⭕', tier: 'ci-cd' },
    },

    // ===== TESTING =====
    testing: {
        'Jest': { keywords: ['jest'], parent: 'JavaScript', icon: '🃏', tier: 'unit' },
        'Vitest': { keywords: ['vitest'], parent: 'JavaScript', icon: '⚡', tier: 'unit' },
        'Mocha': { keywords: ['mocha'], parent: 'JavaScript', icon: '☕', tier: 'unit' },
        'Cypress': { keywords: ['cypress'], parent: 'JavaScript', icon: '🌲', tier: 'e2e' },
        'Playwright': { keywords: ['playwright'], parent: 'JavaScript', icon: '🎭', tier: 'e2e' },
        'Selenium': { keywords: ['selenium'], parent: null, icon: '🔬', tier: 'e2e' },
        'Pytest': { keywords: ['pytest'], parent: 'Python', icon: '🧪', tier: 'unit' },
        'JUnit': { keywords: ['junit'], parent: 'Java', icon: '☕', tier: 'unit' },
        'Testing Library': { keywords: ['testing-library', '@testing-library'], parent: 'React', icon: '🐙', tier: 'integration' },
    },

    // ===== STYLING & UI =====
    styling: {
        'Tailwind CSS': { keywords: ['tailwind', 'tailwindcss'], parent: 'CSS', icon: '💨', tier: 'utility' },
        'Bootstrap': { keywords: ['bootstrap'], parent: 'CSS', icon: '🅱️', tier: 'framework' },
        'Material-UI': { keywords: ['mui', 'material-ui', '@mui'], parent: 'React', icon: '🎨', tier: 'component' },
        'Chakra UI': { keywords: ['chakra-ui', '@chakra-ui'], parent: 'React', icon: '⚡', tier: 'component' },
        'Ant Design': { keywords: ['antd', 'ant-design'], parent: 'React', icon: '🐜', tier: 'component' },
        'Styled Components': { keywords: ['styled-components'], parent: 'React', icon: '💅', tier: 'css-in-js' },
        'Emotion': { keywords: ['emotion', '@emotion'], parent: 'React', icon: '👩‍🎤', tier: 'css-in-js' },
        'Sass': { keywords: ['sass', 'scss'], parent: 'CSS', icon: '💅', tier: 'preprocessor' },
    },

    // ===== STATE MANAGEMENT =====
    stateManagement: {
        'Redux': { keywords: ['redux', '@reduxjs'], parent: 'React', icon: '🔄', tier: 'library' },
        'MobX': { keywords: ['mobx'], parent: 'React', icon: '🦸', tier: 'library' },
        'Zustand': { keywords: ['zustand'], parent: 'React', icon: '🐻', tier: 'library' },
        'Recoil': { keywords: ['recoil'], parent: 'React', icon: '⚛️', tier: 'library' },
        'Jotai': { keywords: ['jotai'], parent: 'React', icon: '👻', tier: 'library' },
        'Pinia': { keywords: ['pinia'], parent: 'Vue', icon: '🍍', tier: 'library' },
        'Vuex': { keywords: ['vuex'], parent: 'Vue', icon: '💚', tier: 'library' },
    },

    // ===== BUILD TOOLS =====
    buildTools: {
        'Webpack': { keywords: ['webpack'], parent: 'JavaScript', icon: '📦', tier: 'bundler' },
        'Vite': { keywords: ['vite', 'vitejs'], parent: 'JavaScript', icon: '⚡', tier: 'bundler' },
        'Rollup': { keywords: ['rollup'], parent: 'JavaScript', icon: '📦', tier: 'bundler' },
        'Parcel': { keywords: ['parcel'], parent: 'JavaScript', icon: '📦', tier: 'bundler' },
        'esbuild': { keywords: ['esbuild'], parent: 'JavaScript', icon: '⚡', tier: 'bundler' },
        'Turbopack': { keywords: ['turbopack'], parent: 'JavaScript', icon: '⚡', tier: 'bundler' },
        'Babel': { keywords: ['babel', '@babel'], parent: 'JavaScript', icon: '🗼', tier: 'transpiler' },
    },

    // ===== API & PROTOCOLS =====
    apiProtocols: {
        'REST API': { keywords: ['rest', 'restful', 'rest-api'], parent: null, icon: '🔌', tier: 'protocol' },
        'GraphQL': { keywords: ['graphql', 'apollo'], parent: null, icon: '◼️', tier: 'protocol' },
        'tRPC': { keywords: ['trpc'], parent: 'TypeScript', icon: '🔷', tier: 'protocol' },
        'gRPC': { keywords: ['grpc'], parent: null, icon: '📡', tier: 'protocol' },
        'WebSocket': { keywords: ['websocket', 'socket.io'], parent: null, icon: '🔌', tier: 'protocol' },
    },

    // ===== WEB3 & BLOCKCHAIN =====
    web3: {
        'Solidity': { keywords: ['solidity'], parent: null, icon: '⛓️', tier: 'language' },
        'Ethers.js': { keywords: ['ethers', 'ethersjs'], parent: 'JavaScript', icon: '⛓️', tier: 'library' },
        'Web3.js': { keywords: ['web3', 'web3js'], parent: 'JavaScript', icon: '⛓️', tier: 'library' },
        'Hardhat': { keywords: ['hardhat'], parent: 'Solidity', icon: '⛏️', tier: 'tool' },
        'Truffle': { keywords: ['truffle'], parent: 'Solidity', icon: '🍄', tier: 'tool' },
    },

    // ===== GAME DEVELOPMENT =====
    gameDev: {
        'Unity': { keywords: ['unity', 'unity3d'], parent: 'C#', icon: '🎮', tier: 'engine' },
        'Unreal Engine': { keywords: ['unreal', 'ue4', 'ue5'], parent: 'C++', icon: '🎮', tier: 'engine' },
        'Godot': { keywords: ['godot'], parent: null, icon: '🎮', tier: 'engine' },
        'Three.js': { keywords: ['three', 'threejs', 'three.js'], parent: 'JavaScript', icon: '🎲', tier: 'library' },
        'Phaser': { keywords: ['phaser'], parent: 'JavaScript', icon: '🎮', tier: 'library' },
    },

    // ===== OTHER TOOLS =====
    tools: {
        'Git': { keywords: ['git', 'github', 'gitlab', 'gitflow'], parent: null, icon: '📚', tier: 'vcs' },
        'npm': { keywords: ['npm', 'package.json'], parent: 'Node.js', icon: '📦', tier: 'package-manager' },
        'Yarn': { keywords: ['yarn', 'yarn.lock'], parent: 'Node.js', icon: '📦', tier: 'package-manager' },
        'pnpm': { keywords: ['pnpm'], parent: 'Node.js', icon: '📦', tier: 'package-manager' },
        'ESLint': { keywords: ['eslint'], parent: 'JavaScript', icon: '🔍', tier: 'linter' },
        'Prettier': { keywords: ['prettier'], parent: 'JavaScript', icon: '💅', tier: 'formatter' },
    }
};

function applyRules(data) {
    const skills = new Map();
    
    console.log(`\n📊 Analyzing skills...`);
    
    // Check if we have any repo data
    if (!data.repos || data.repos.length === 0) {
        console.log(`⚠ No repository data available. Showing meta skills only.`);
        addMetaSkills(data, skills);
        return Array.from(skills.values());
    }
    
    const allText = getAllRepoText(data.repos);

    // 1. Analyze Languages (from actual code)
    console.log(`  🔤 Detecting languages...`);
    analyzeLanguages(data.repos, skills);

    // 2. Detect all tech categories
    console.log(`  🔧 Detecting frameworks and tools...`);
    detectTechnology(allText, SKILL_RULES.frontendFrameworks, 'frontend', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.backendFrameworks, 'backend', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.mobile, 'mobile', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.databases, 'database', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.aiMl, 'ai-ml', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.devops, 'devops', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.testing, 'testing', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.styling, 'styling', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.stateManagement, 'state', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.buildTools, 'build-tool', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.apiProtocols, 'api', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.web3, 'web3', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.gameDev, 'game-dev', skills, data.repos);
    detectTechnology(allText, SKILL_RULES.tools, 'tool', skills, data.repos);

    // 3. Add meta skills
    console.log(`  ⭐ Adding meta skills...`);
    addMetaSkills(data, skills);
    
    const finalSkills = Array.from(skills.values())
        .filter(s => s.level > 0)
        .sort((a, b) => b.level - a.level);
    
    console.log(`✓ Detected ${finalSkills.length} skills total\n`);
    
    return finalSkills;
}

function getAllRepoText(repos) {
    return repos.map(r => 
        `${r.name} ${r.description} ${r.topics.join(' ')}`
    ).join(' ').toLowerCase();
}

function analyzeLanguages(repos, skills) {
    const languageStats = {};
    let totalReposWithLangs = 0;
    
    repos.forEach(repo => {
        if (repo.languages && Object.keys(repo.languages).length > 0) {
            totalReposWithLangs++;
            Object.entries(repo.languages).forEach(([lang, bytes]) => {
                languageStats[lang] = (languageStats[lang] || 0) + bytes;
            });
        }
    });

    if (totalReposWithLangs === 0) {
        console.log(`    ⚠ No language data found in repositories`);
        return;
    }

    const totalBytes = Object.values(languageStats).reduce((a, b) => a + b, 0);
    let langCount = 0;
    
    Object.entries(languageStats).forEach(([lang, bytes]) => {
        const rule = SKILL_RULES.languages[lang];
        if (rule) {
            const percentage = (bytes / totalBytes) * 100;
            const level = calculateLevel(percentage, rule.weight);
            
            if (level > 0) {
                langCount++;
                skills.set(lang, {
                    name: lang,
                    level: level,
                    category: 'language',
                    parent: rule.parent || null,
                    icon: rule.icon,
                    percentage: percentage.toFixed(1),
                    tier: rule.tier
                });
            }
        }
    });
    
    console.log(`    ✓ Found ${langCount} programming languages`);
}

function detectTechnology(allText, ruleSet, category, skills, repos) {
    let techCount = 0;
    
    Object.entries(ruleSet).forEach(([tech, rule]) => {
        const matches = rule.keywords.filter(keyword => allText.includes(keyword));
        if (matches.length > 0) {
            const repoCount = repos.filter(r => {
                const text = `${r.name} ${r.description} ${r.topics.join(' ')}`.toLowerCase();
                return rule.keywords.some(k => text.includes(k));
            }).length;

            const level = Math.min(5, Math.ceil(repoCount / 1.5) + 1);
            
            techCount++;
            skills.set(tech, {
                name: tech,
                level: level,
                category: category,
                parent: rule.parent || null,
                icon: rule.icon,
                repos: repoCount,
                tier: rule.tier
            });
        }
    });
    
    if (techCount > 0) {
        console.log(`    ✓ Found ${techCount} ${category} technologies`);
    }
}

function addMetaSkills(data, skills) {
    const accountAge = calculateAccountAge(data.user.created_at);
    const totalRepos = data.user.public_repos;
    const followers = data.user.followers;

    if (totalRepos > 10) {
        skills.set('Portfolio', {
            name: 'Portfolio',
            level: Math.min(5, Math.ceil(totalRepos / 8)),
            category: 'meta',
            parent: null,
            icon: '📦',
            repos: totalRepos
        });
    }

    if (followers > 5) {
        skills.set('Community', {
            name: 'Community',
            level: Math.min(5, Math.ceil(followers / 10)),
            category: 'meta',
            parent: null,
            icon: '👥',
            followers: followers
        });
    }

    if (accountAge > 1) {
        skills.set('Experience', {
            name: 'Experience',
            level: Math.min(5, Math.ceil(accountAge / 2)),
            category: 'meta',
            parent: null,
            icon: '⭐',
            years: accountAge.toFixed(1)
        });
    }
}

function calculateLevel(percentage, weight = 1.0) {
    const adjusted = percentage * weight;
    if (adjusted >= 30) return 5;
    if (adjusted >= 20) return 4;
    if (adjusted >= 10) return 3;
    if (adjusted >= 5) return 2;
    if (adjusted >= 1) return 1;
    return 0;
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
    applyRules,
    SKILL_RULES
};