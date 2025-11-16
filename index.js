require('dotenv').config(); 
const express = require('express');
const { generateSkillTree } = require('./SkillLogic'); 

const app = express();
const PORT = 3000;


app.get('/api/skilltree', async (req, res) => {
    const username = req.query.username;

    if (!username) {
        return res.status(400).send('Harap sertakan parameter username, cth: /api/skilltree?username=namapengguna');
    }

    try {
        const svgCode = await generateSkillTree(username);
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=7200'); 
        res.send(svgCode);

    } catch (error) {
        console.error('Error generating skill tree:', error.message);
        res.status(500).setHeader('Content-Type', 'image/svg+xml');
        res.send(`<svg width="300" height="100" viewBox="0 0 300 100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#fee2e2"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14" fill="#ef4444">
            ERROR: ${error.message}
          </text>
        </svg>`);
    }
});

app.listen(PORT, () => {
    console.log(`Skill Tree Generator API berjalan di http://localhost:${PORT}`);
    console.log(`Coba: http://localhost:${PORT}/api/skilltree?username=YOUR_GITHUB_USERNAME`);
});