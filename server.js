const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();

app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

let items = [];
let nextId = 1;

app.get('/api/items', (req, res) => {
    res.json({ items, nextId });
});

app.post('/api/items', (req, res) => {
    const newItem = { id: nextId++, ...req.body };
    items.push(newItem);
    res.json(newItem);
});

app.delete('/api/items/:id', (req, res) => {
    items = items.filter(item => item.id !== parseInt(req.params.id));
    res.status(204).send();
});

app.put('/api/items/:id', (req, res) => {
    const updatedItem = { id: parseInt(req.params.id), ...req.body };
    items = items.map(item => (item.id === updatedItem.id ? updatedItem : item));
    res.json(updatedItem);
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
