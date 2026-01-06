const express = require('express');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Manus API 基础 URL
const MANUS_API_BASE = 'https://api.manus.im/v1';

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 文件上传配置
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB 限制
});

// 创建 uploads 目录
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// ==================== API 路由 ====================

// 创建任务
app.post('/api/create-task', async (req, res) => {
    try {
        const { api_key, prompt, task_id, agent_profile, task_mode, attachments } = req.body;
        
        if (!api_key) {
            return res.status(400).json({ error: '缺少 API Key' });
        }
        
        if (!prompt) {
            return res.status(400).json({ error: '缺少消息内容' });
        }

        // 构建请求体
        const requestBody = {
            prompt: prompt,
            agent_profile: agent_profile || 'manus-1.6-max',
            task_mode: task_mode || 'agent'
        };

        // 如果有 task_id，添加到请求体
        if (task_id) {
            requestBody.task_id = task_id;
        }

        // 如果有附件，添加到请求体
        if (attachments && attachments.length > 0) {
            requestBody.attachments = attachments;
        }

        console.log('Creating task with:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(`${MANUS_API_BASE}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${api_key}`
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Manus API error:', data);
            return res.status(response.status).json({ 
                error: data.error?.message || data.message || '创建任务失败' 
            });
        }

        console.log('Task created:', data.id);
        res.json(data);
        
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: error.message || '服务器错误' });
    }
});

// 获取任务详情
app.post('/api/get-task/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { api_key } = req.body;
        
        if (!api_key) {
            return res.status(400).json({ error: '缺少 API Key' });
        }

        console.log('Getting task:', taskId);

        const response = await fetch(`${MANUS_API_BASE}/tasks/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${api_key}`
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Manus API error:', data);
            return res.status(response.status).json({ 
                error: data.error?.message || data.message || '获取任务失败' 
            });
        }

        res.json(data);
        
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ error: error.message || '服务器错误' });
    }
});

// 上传文件
app.post('/api/upload-file', upload.single('file'), async (req, res) => {
    try {
        const { api_key } = req.body;
        const file = req.file;
        
        if (!api_key) {
            return res.status(400).json({ error: '缺少 API Key' });
        }
        
        if (!file) {
            return res.status(400).json({ error: '缺少文件' });
        }

        console.log('Uploading file:', file.originalname);

        // 创建 FormData
        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path), {
            filename: file.originalname,
            contentType: file.mimetype
        });

        const response = await fetch(`${MANUS_API_BASE}/files`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${api_key}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        // 清理临时文件
        fs.unlink(file.path, (err) => {
            if (err) console.error('Failed to delete temp file:', err);
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Manus API error:', data);
            return res.status(response.status).json({ 
                error: data.error?.message || data.message || '上传文件失败' 
            });
        }

        console.log('File uploaded:', data.id);
        res.json({
            file_id: data.id,
            filename: file.originalname
        });
        
    } catch (error) {
        console.error('Upload file error:', error);
        res.status(500).json({ error: error.message || '服务器错误' });
    }
});

// 获取文件列表
app.post('/api/list-files', async (req, res) => {
    try {
        const { api_key } = req.body;
        
        if (!api_key) {
            return res.status(400).json({ error: '缺少 API Key' });
        }

        console.log('Listing files...');

        const response = await fetch(`${MANUS_API_BASE}/files`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${api_key}`
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Manus API error:', data);
            return res.status(response.status).json({ 
                error: data.error?.message || data.message || '获取文件列表失败' 
            });
        }

        res.json(data);
        
    } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({ error: error.message || '服务器错误' });
    }
});

// 删除文件
app.delete('/api/delete-file/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const { api_key } = req.body;
        
        if (!api_key) {
            return res.status(400).json({ error: '缺少 API Key' });
        }

        console.log('Deleting file:', fileId);

        const response = await fetch(`${MANUS_API_BASE}/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${api_key}`
            }
        });

        if (!response.ok) {
            const data = await response.json();
            console.error('Manus API error:', data);
            return res.status(response.status).json({ 
                error: data.error?.message || data.message || '删除文件失败' 
            });
        }

        res.json({ success: true });
        
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: error.message || '服务器错误' });
    }
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 所有其他路由返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 Manus API Client server running on port ${PORT}`);
    console.log(`📡 API proxy endpoint: http://localhost:${PORT}/api`);
    console.log(`🌐 Web interface: http://localhost:${PORT}`);
});
