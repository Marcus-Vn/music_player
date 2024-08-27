// server.js (Back-end)
require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 3000;

// Servir arquivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/data', (req, res) => {
    const clientID = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;

    res.json({ 
        message: 'Sucesso!', 
        clientID: clientID,
        clientSecret: clientSecret
    });

});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
