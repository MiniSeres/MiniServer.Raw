const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

function generateId() {
return crypto.randomBytes(8).toString('hex');
}

app.post('/api/create', (req, res) => {
const { title, tags, content } = req.body;
if (!title || !content) {
return res.status(400).json({ error: 'Thiếu title hoặc content' });
}
const id = generateId();
const data = {
id,
title: title.trim(),
tags: tags ? tags.trim() : '',
content: content.trim(),
created: Date.now(),
updated: Date.now()
};
const filePath = path.join(DATA_DIR, id + '.json');
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
res.json({ id, link: `/raw/${id}` });
});

app.get('/raw/:id', (req, res) => {
const id = req.params.id;
const filePath = path.join(DATA_DIR, id + '.json');
if (!fs.existsSync(filePath)) {
return res.status(404).send('❌ Script không tồn tại');
}
try {
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
res.setHeader('Content-Type', 'text/plain; charset=utf-8');
res.send(data.content);
} catch(err) {
res.status(500).send('❌ Lỗi đọc file');
}
});

app.get('/api/:id', (req, res) => {
const id = req.params.id;
const filePath = path.join(DATA_DIR, id + '.json');
if (!fs.existsSync(filePath)) {
return res.status(404).json({ error: 'Không tìm thấy' });
}
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
res.json(data);
});

app.delete('/api/:id', (req, res) => {
const id = req.params.id;
const filePath = path.join(DATA_DIR, id + '.json');
if (!fs.existsSync(filePath)) {
return res.status(404).json({ error: 'Không tìm thấy' });
}
fs.unlinkSync(filePath);
res.json({ success: true });
});

app.get('/', (req, res) => {
res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
console.log(`✅ RawScript running at http://localhost:${PORT}`);
console.log(`📌 Tạo script tại http://localhost:${PORT}`);
console.log(`🔗 Raw link: http://localhost:${PORT}/raw/{id}`);
});
