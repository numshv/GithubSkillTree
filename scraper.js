#!/usr/bin/env node
/**
 * Enhanced Roadmap.sh Scraper
 * Comprehensive scraper for all Role-based Roadmaps
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Complete list of Role-based Roadmaps from roadmap.sh
const ROLE_BASED_ROADMAPS = [
    // Core Development
    'frontend',
    'backend',
    'full-stack',
    'devops',
    'software-architect',
    'software-design-architecture',
    
    // Mobile Development
    'android',
    'ios',
    'react-native',
    'flutter',
    
    // Programming Languages
    'python',
    'java',
    'javascript',
    'typescript',
    'golang',
    'rust',
    'cpp',
    'csharp',
    'php',
    'ruby',
    'scala',
    'kotlin',
    'swift',
    
    // Frameworks & Libraries
    'react',
    'vue',
    'angular',
    'nodejs',
    'spring-boot',
    'laravel',
    'aspnet-core',
    'nestjs',
    'nextjs',
    
    // Databases
    'postgresql-dba',
    'mongodb',
    'sql',
    
    // DevOps & Cloud
    'docker',
    'kubernetes',
    'linux',
    'aws',
    'terraform',
    'ansible',
    
    // AI & Data
    'ai-data-scientist',
    'mlops',
    'data-analyst',
    'prompt-engineering',
    'ai-engineer',
    
    // Security & Testing
    'cyber-security',
    'qa',
    'api-security',
    
    // Specialized
    'blockchain',
    'game-developer',
    'ux-design',
    'technical-writer',
    'product-manager',
    'engineering-manager',
    'system-design',
    'computer-science',
    'datastructures-and-algorithms',
    'design-system',
    'code-review',
    'git-github',
    'graphql',
    'api-design',
    'server-side-game-developer'
];

const OUTPUT_DIR = 'roadmap_data';
const CACHE_FILE = path.join(OUTPUT_DIR, '.cache.json');
const MAX_RETRIES = 3;
const CONCURRENT_LIMIT = 5;

// Color codes for better logging
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

class RoadmapScraper {
    constructor() {
        this.cache = {};
        this.stats = {
            successful: 0,
            failed: 0,
            cached: 0,
            total: ROLE_BASED_ROADMAPS.length
        };
    }

    async loadCache() {
        try {
            const data = await fs.readFile(CACHE_FILE, 'utf-8');
            this.cache = JSON.parse(data);
            console.log(`${colors.cyan}📦 Loaded cache with ${Object.keys(this.cache).length} entries${colors.reset}`);
        } catch (error) {
            this.cache = {};
        }
    }

    async saveCache() {
        await fs.writeFile(CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    async scrapeRoadmap(roadmapName, retry = 0) {
        // Check cache first (skip if older than 7 days)
        if (this.cache[roadmapName]) {
            const cacheAge = Date.now() - new Date(this.cache[roadmapName].cachedAt).getTime();
            if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
                this.stats.cached++;
                this.log(`💾 Using cached data for ${roadmapName}`, 'cyan');
                return this.cache[roadmapName].data;
            }
        }

        this.log(`🔄 Scraping ${roadmapName}... (attempt ${retry + 1}/${MAX_RETRIES})`, 'blue');

        // Try multiple URL patterns and methods
        const strategies = [
            // Strategy 1: Direct JSON from GitHub (most reliable)
            async () => {
                const url = `https://raw.githubusercontent.com/kamranahmedse/developer-roadmap/master/src/data/roadmaps/${roadmapName}/${roadmapName}.json`;
                const response = await axios.get(url, { timeout: 15000 });
                return response.data;
            },
            
            // Strategy 2: Public folder
            async () => {
                const url = `https://raw.githubusercontent.com/kamranahmedse/developer-roadmap/master/public/roadmaps/${roadmapName}/${roadmapName}.json`;
                const response = await axios.get(url, { timeout: 15000 });
                return response.data;
            },
            
            // Strategy 3: Roadmap.sh API
            async () => {
                const url = `https://roadmap.sh/api/roadmaps/${roadmapName}`;
                const response = await axios.get(url, { 
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json'
                    }
                });
                return response.data;
            },

            // Strategy 4: Try with content.json
            async () => {
                const url = `https://raw.githubusercontent.com/kamranahmedse/developer-roadmap/master/src/data/roadmaps/${roadmapName}/content.json`;
                const response = await axios.get(url, { timeout: 15000 });
                return response.data;
            }
        ];

        for (const strategy of strategies) {
            try {
                const data = await strategy();
                if (data && (data.nodes || data.content || Array.isArray(data))) {
                    const parsed = this.parseRoadmapData(roadmapName, data);
                    
                    // Cache successful result
                    this.cache[roadmapName] = {
                        data: parsed,
                        cachedAt: new Date().toISOString()
                    };
                    
                    this.stats.successful++;
                    this.log(`✅ Successfully scraped ${roadmapName} (${parsed.nodes.length} nodes)`, 'green');
                    return parsed;
                }
            } catch (error) {
                // Try next strategy
                continue;
            }
        }

        // Retry logic
        if (retry < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000 * (retry + 1)));
            return this.scrapeRoadmap(roadmapName, retry + 1);
        }

        this.stats.failed++;
        this.log(`❌ Failed to scrape ${roadmapName}`, 'red');
        return null;
    }

    parseRoadmapData(name, data) {
        const nodes = [];
        const edges = [];
        let rawNodes = [];

        // Handle different data structures
        if (data.nodes && Array.isArray(data.nodes)) {
            rawNodes = data.nodes;
        } else if (Array.isArray(data)) {
            rawNodes = data;
        } else if (data.content) {
            rawNodes = this.extractNodesFromContent(data.content);
        }

        // Parse nodes
        rawNodes.forEach(node => {
            const label = this.extractLabel(node);
            const description = this.extractDescription(node);
            
            const parsedNode = {
                id: node.id || node.key || this.generateId(label),
                type: node.type || 'node',
                label: label,
                description: description,
                category: this.categorize(label, description, node),
                position: node.position || node.pos || {},
                keywords: this.generateKeywords(label, description),
                metadata: {
                    style: node.style || {},
                    required: node.required || false,
                    difficulty: this.estimateDifficulty(node)
                }
            };
            
            nodes.push(parsedNode);
        });

        // Parse edges/connections
        if (data.edges && Array.isArray(data.edges)) {
            data.edges.forEach(edge => {
                edges.push({
                    source: edge.source || edge.from,
                    target: edge.target || edge.to,
                    type: edge.type || 'default'
                });
            });
        }

        // Generate statistics
        const categories = this.analyzeCategories(nodes);
        const skills = this.extractSkills(nodes);

        return {
            name,
            title: this.formatTitle(name),
            nodes,
            edges,
            categories,
            skills,
            metadata: {
                totalNodes: nodes.length,
                totalEdges: edges.length,
                source: 'roadmap.sh',
                scrapedAt: new Date().toISOString(),
                version: '2.0'
            }
        };
    }

    extractNodesFromContent(content) {
        const nodes = [];
        const traverse = (obj, prefix = '') => {
            if (Array.isArray(obj)) {
                obj.forEach((item, idx) => traverse(item, `${prefix}[${idx}]`));
            } else if (obj && typeof obj === 'object') {
                if (obj.label || obj.title || obj.name) {
                    nodes.push(obj);
                }
                Object.values(obj).forEach(value => traverse(value, prefix));
            }
        };
        traverse(content);
        return nodes;
    }

    extractLabel(node) {
        return node.label || 
               node.data?.label || 
               node.title || 
               node.name || 
               node.text || 
               node.id || 
               'Unknown';
    }

    extractDescription(node) {
        return node.description || 
               node.data?.description || 
               node.desc || 
               node.content || 
               '';
    }

    generateId(label) {
        return label.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    categorize(label, description, node) {
        const text = `${label} ${description}`.toLowerCase();
        const type = (node.type || '').toLowerCase();

        const categoryRules = {
            'programming-language': [
                'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c++', 
                'c#', 'php', 'ruby', 'kotlin', 'swift', 'scala', 'language'
            ],
            'framework': [
                'react', 'vue', 'angular', 'flask', 'spring', 'express',
                'laravel', 'asp.net', 'rails', 'fastapi', 'framework', 'library'
            ],
            'database': [
                'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 
                'cassandra', 'database', 'db', 'orm'
            ],
            'devops': [
                'docker', 'kubernetes', 'ci/cd', 'jenkins', 'github actions',
                'gitlab ci', 'deployment', 'pipeline', 'devops'
            ],
            'cloud': [
                'aws', 'azure', 'gcp', 'cloud', 'serverless', 'lambda', 'ec2'
            ],
            'testing': [
                'test', 'jest', 'mocha', 'cypress', 'selenium', 'junit', 'testing'
            ],
            'security': [
                'security', 'authentication', 'authorization', 'oauth', 'jwt', 
                'encryption', 'ssl', 'tls'
            ],
            'frontend': [
                'html', 'css', 'dom', 'browser', 'webpack', 'vite', 'frontend',
                'ui', 'ux'
            ],
            'backend': [
                'api', 'rest', 'graphql', 'microservices', 'backend', 'server'
            ],
            'mobile': [
                'android', 'ios', 'mobile', 'react native', 'flutter'
            ],
            'data-science': [
                'machine learning', 'ai', 'data science', 'analytics', 'ml',
                'tensorflow', 'pytorch', 'numpy', 'pandas'
            ],
            'tools': [
                'git', 'npm', 'yarn', 'webpack', 'babel', 'eslint', 'tool'
            ]
        };

        for (const [category, keywords] of Object.entries(categoryRules)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return category;
            }
        }

        // Fallback: use node type or default
        return type || 'concept';
    }

    estimateDifficulty(node) {
        const label = this.extractLabel(node).toLowerCase();
        const advanced = ['kubernetes', 'microservices', 'system design', 'architecture', 'advanced'];
        const intermediate = ['api', 'database', 'framework', 'testing'];
        
        if (advanced.some(term => label.includes(term))) return 'advanced';
        if (intermediate.some(term => label.includes(term))) return 'intermediate';
        return 'beginner';
    }

    generateKeywords(label, description) {
        const text = `${label} ${description}`.toLowerCase();
        const words = text.match(/\b\w+\b/g) || [];
        
        const stopwords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that'
        ]);
        
        const keywords = words
            .filter(w => !stopwords.has(w) && w.length > 2)
            .filter((v, i, a) => a.indexOf(v) === i)
            .slice(0, 15);
        
        return keywords;
    }

    analyzeCategories(nodes) {
        const categoryCount = {};
        nodes.forEach(node => {
            categoryCount[node.category] = (categoryCount[node.category] || 0) + 1;
        });
        
        return Object.entries(categoryCount)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }

    extractSkills(nodes) {
        return nodes
            .filter(node => node.category !== 'concept')
            .map(node => ({
                name: node.label,
                category: node.category,
                difficulty: node.metadata.difficulty,
                keywords: node.keywords.slice(0, 5)
            }))
            .slice(0, 50); // Top 50 skills
    }

    formatTitle(name) {
        return name
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    async scrapeAll() {
        console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}`);
        console.log(`${colors.cyan}🚀 Starting Enhanced Roadmap.sh Scraper${colors.reset}`);
        console.log(`${colors.cyan}📊 Total roadmaps to scrape: ${ROLE_BASED_ROADMAPS.length}${colors.reset}`);
        console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);

        // Create output directory
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        await this.loadCache();

        const results = {};
        const startTime = Date.now();

        // Process in batches with concurrency limit
        for (let i = 0; i < ROLE_BASED_ROADMAPS.length; i += CONCURRENT_LIMIT) {
            const batch = ROLE_BASED_ROADMAPS.slice(i, i + CONCURRENT_LIMIT);
            const progress = Math.round((i / ROLE_BASED_ROADMAPS.length) * 100);
            
            console.log(`\n${colors.yellow}📦 Processing batch ${Math.floor(i / CONCURRENT_LIMIT) + 1}/${Math.ceil(ROLE_BASED_ROADMAPS.length / CONCURRENT_LIMIT)} (${progress}%)${colors.reset}`);
            
            const promises = batch.map(roadmap => this.scrapeRoadmap(roadmap));
            const batchResults = await Promise.all(promises);
            
            // Save individual files
            for (let j = 0; j < batchResults.length; j++) {
                const data = batchResults[j];
                const roadmap = batch[j];
                
                if (data) {
                    results[roadmap] = data;
                    const filename = path.join(OUTPUT_DIR, `${roadmap}.json`);
                    await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf-8');
                }
            }
            
            // Save cache periodically
            await this.saveCache();
            
            // Rate limiting
            if (i + CONCURRENT_LIMIT < ROLE_BASED_ROADMAPS.length) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        // Save combined file
        const combinedFile = path.join(OUTPUT_DIR, 'all_roadmaps.json');
        await fs.writeFile(combinedFile, JSON.stringify(results, null, 2), 'utf-8');

        // Create master index
        const index = {
            roadmaps: Object.keys(results).sort(),
            totalRoadmaps: Object.keys(results).length,
            scrapedAt: new Date().toISOString(),
            version: '2.0',
            summary: Object.entries(results)
                .map(([key, data]) => ({
                    name: key,
                    title: data.title,
                    nodes: data.metadata.totalNodes,
                    edges: data.metadata.totalEdges,
                    topCategories: data.categories.slice(0, 3)
                }))
                .sort((a, b) => b.nodes - a.nodes)
        };

        const indexFile = path.join(OUTPUT_DIR, 'index.json');
        await fs.writeFile(indexFile, JSON.stringify(index, null, 2), 'utf-8');

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        // Print final statistics
        console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
        console.log(`${colors.green}✅ Successfully scraped: ${this.stats.successful}${colors.reset}`);
        console.log(`${colors.cyan}💾 Used cached data: ${this.stats.cached}${colors.reset}`);
        console.log(`${colors.red}❌ Failed: ${this.stats.failed}${colors.reset}`);
        console.log(`${colors.blue}⏱️  Duration: ${duration}s${colors.reset}`);
        console.log(`${colors.yellow}📁 Data saved to: ${OUTPUT_DIR}/${colors.reset}`);
        console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);

        return results;
    }
}

// Run if called directly
if (require.main === module) {
    const scraper = new RoadmapScraper();
    scraper.scrapeAll()
        .then(() => {
            console.log(`${colors.green}✨ Scraping complete!${colors.reset}`);
            process.exit(0);
        })
        .catch(error => {
            console.error(`${colors.red}❌ Fatal error: ${error.message}${colors.reset}`);
            console.error(error.stack);
            process.exit(1);
        });
}

module.exports = {
    RoadmapScraper,
    ROLE_BASED_ROADMAPS
};