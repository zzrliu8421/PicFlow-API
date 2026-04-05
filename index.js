const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 配置常量
const BASE_DIR = process.cwd();
const CONVERTED_IMAGES_DIR = path.join(BASE_DIR, 'converted');
const DEFAULT_IMAGE_COUNT = 1;
const MAX_IMAGES_PER_REQUEST = 50;
const API_VERSION = '3.0';

// CORS中间件
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// 静态文件服务
app.use('/converted', express.static(path.join(BASE_DIR, 'converted')));

// 设备检测函数
function isMobile(userAgent) {
  const useragent_commentsblock = userAgent.match(/\(.*?\)/)?.[0] || '';
  
  function CheckSubstrs(substrs, text) {
    for (const substr of substrs) {
      if (text.includes(substr)) {
        return true;
      }
    }
    return false;
  }
  
  const mobile_os_list = [
    'Google Wireless Transcoder', 'Windows CE', 'WindowsCE', 'Symbian', 'Android', 
    'armv6l', 'armv5', 'Mobile', 'CentOS', 'mowser', 'AvantGo', 'Opera Mobi', 
    'J2ME/MIDP', 'Smartphone', 'Go.Web', 'Palm', 'iPAQ'
  ];
  
  const mobile_token_list = [
    'Profile/MIDP', 'Configuration/CLDC-', '160×160', '176×220', '240×240', 
    '240×320', '320×240', 'UP.Browser', 'UP.Link', 'SymbianOS', 'PalmOS', 
    'PocketPC', 'SonyEricsson', 'Nokia', 'BlackBerry', 'Vodafone', 'BenQ', 
    'Novarra-Vision', 'Iris', 'NetFront', 'HTC_', 'Xda_', 'SAMSUNG-SGH', 
    'Wapaka', 'DoCoMo', 'iPhone', 'iPod'
  ];
  
  return CheckSubstrs(mobile_os_list, useragent_commentsblock) || 
         CheckSubstrs(mobile_token_list, userAgent);
}

// 智能格式检测函数
function detectOptimalFormat(userAgent) {
  // 检测是否支持AVIF
  if (userAgent.includes('Chrome/')) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    if (match && parseInt(match[1]) >= 85) {
      return 'avif';
    }
  }
  
  // 检测Firefox对AVIF的支持
  if (userAgent.includes('Firefox/')) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    if (match && parseInt(match[1]) >= 93) {
      return 'avif';
    }
  }
  
  // 检测是否支持WebP
  if (userAgent.includes('Chrome') || 
      userAgent.includes('Opera') || 
      userAgent.includes('Edge') ||
      userAgent.includes('Firefox') ||
      (userAgent.includes('Safari') && userAgent.includes('Version/14'))) {
    return 'webp';
  }
  
  // 默认返回JPEG
  return 'jpeg';
}

// 获取转换后的图片URL
function getConvertedImageUrl(originalImage, targetFormat, siteUrl) {
  const filename = path.parse(originalImage.filename).name;
  const deviceType = originalImage.type;
  
  // 构建转换后的文件路径
  const convertedPath = path.join(CONVERTED_IMAGES_DIR, deviceType, targetFormat, `${filename}.${targetFormat}`);
  const convertedUrl = `${siteUrl}/converted/${deviceType}/${targetFormat}/${filename}.${targetFormat}`;
  
  // 检查转换后的文件是否存在
  if (fs.existsSync(convertedPath)) {
    return {
      url: convertedUrl,
      path: convertedPath,
      format: targetFormat,
      converted: true,
      size: fs.statSync(convertedPath).size
    };
  }
  
  // 如果转换后的文件不存在，返回原始文件
  return {
    url: originalImage.url,
    path: originalImage.path || '',
    format: originalImage.extension,
    converted: false,
    size: originalImage.size || 0
  };
}

// 获取图片
function getImages(type, count, external, imageFormat, siteUrl) {
  // 外链模式
  if (external) {
    return getExternalImages(type, count);
  }
  
  // 获取所有图片文件
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'];
  const images = [];
  
  // 只扫描 converted 目录
  const convertedBaseDir = path.join(BASE_DIR, 'converted', type);
  if (fs.existsSync(convertedBaseDir)) {
    // 如果没有指定格式或者是auto，扫描所有格式
    const formats = ['jpeg', 'webp', 'avif'];
    
    for (const format of formats) {
      const formatDir = path.join(convertedBaseDir, format);
      if (fs.existsSync(formatDir)) {
        const files = fs.readdirSync(formatDir);
        for (const file of files) {
          if (file === '.' || file === '..') continue;
          
          const filePath = path.join(formatDir, file);
          if (fs.statSync(filePath).isFile()) {
            const extension = path.extname(file).toLowerCase().substring(1);
            if (allowedExtensions.includes(extension)) {
              images.push({
                filename: file,
                path: filePath,
                url: `${siteUrl}/converted/${type}/${format}/${file}`,
                extension: extension,
                type: type,
                size: fs.statSync(filePath).size,
                source: 'converted',
                format: format
              });
            }
          }
        }
      }
    }
  }
  
  if (images.length === 0) {
    const message = '没有找到转换后的图片，请检查 converted 目录';
    return {
      success: false,
      message: message,
      images: [],
      total_available: 0
    };
  }
  
  // 根据 imageFormat 参数过滤图片
  if (imageFormat !== 'auto' && ['jpeg', 'webp', 'avif'].includes(imageFormat)) {
    // 过滤出指定格式的图片
    const filteredImages = images.filter(image => 
      image.format === imageFormat
    );
    if (filteredImages.length === 0) {
      const message = `没有找到 ${imageFormat} 格式的图片`;
      return {
        success: false,
        message: message,
        images: [],
        total_available: 0
      };
    }
    return {
      success: true,
      images: filteredImages,
      total_available: filteredImages.length
    };
  }
  
  // 随机选择图片
  const shuffled = [...images].sort(() => 0.5 - Math.random());
  const selectedImages = shuffled.slice(0, count);
  
  return {
    success: true,
    images: selectedImages,
    total_available: images.length
  };
}

// 外链模式图片获取函数
function getExternalImages(type, count) {
  const linkFile = path.join(BASE_DIR, `${type}.txt`);
  
  if (!fs.existsSync(linkFile)) {
    return {
      success: false,
      message: `外链文件不存在: ${type}.txt`,
      images: [],
      total_available: 0
    };
  }
  
  // 读取链接文件
  const links = fs.readFileSync(linkFile, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  const images = [];
  
  links.forEach((link, index) => {
    const fileName = `external_${index + 1}`;
    
    images.push({
      filename: fileName,
      url: link,
      extension: 'external',
      type: type,
      size: 0,
      external: true
    });
  });
  
  if (images.length === 0) {
    return {
      success: false,
      message: '外链文件中没有有效的链接',
      images: [],
      total_available: 0
    };
  }
  
  // 随机选择图片
  const shuffled = [...images].sort(() => 0.5 - Math.random());
  const selectedImages = shuffled.slice(0, count);
  
  return {
    success: true,
    images: selectedImages,
    total_available: images.length
  };
}

// API路由
app.get('/api/v2', (req, res) => {
  try {
    // 获取参数
    const count = Math.max(1, Math.min(MAX_IMAGES_PER_REQUEST, parseInt(req.query.count) || DEFAULT_IMAGE_COUNT));
    const format = req.query.format || 'json';
    let type = req.query.type || '';
    const imageFormat = req.query.img_format || 'auto';
    const returnType = req.query.return || 'json';
    const external = req.query.external === 'true' || req.query.external === '1';
    const userAgent = req.headers['user-agent'] || '';
    
    // 构建siteUrl
    const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
    const host = req.headers['host'] || 'localhost:3000';
    const siteUrl = `${protocol}://${host}`;
    
    // 如果没有指定type参数，则自动检测设备类型
    if (!type) {
      type = isMobile(userAgent) ? 'pe' : 'pc';
    }
    
    // 使用内置函数获取图片
    const result = getImages(type, count, external, imageFormat, siteUrl);
    
    if (!result.success) {
      const response = {
        success: false,
        message: result.message,
        count: 0,
        images: []
      };
      res.status(200).json(response);
      return;
    }
    
    let selectedImages = result.images;
    const totalImages = result.total_available;
    
    // 如果只要一张图片且返回类型是重定向，直接重定向
    if (count === 1 && returnType === 'redirect') {
      const image = selectedImages[0];
      
      // 智能格式处理
      if (imageFormat === 'auto') {
        const optimalFormat = detectOptimalFormat(userAgent);
        const convertedImage = getConvertedImageUrl(image, optimalFormat, siteUrl);
        res.redirect(302, convertedImage.url);
        return;
      } else if (imageFormat !== 'original' && ['jpeg', 'webp', 'avif'].includes(imageFormat)) {
        const convertedImage = getConvertedImageUrl(image, imageFormat, siteUrl);
        res.redirect(302, convertedImage.url);
        return;
      } else {
        res.redirect(302, image.url);
        return;
      }
    }
    
    // 智能格式处理（外链模式不支持格式转换）
    if (!external) {
      if (imageFormat === 'auto') {
        const optimalFormat = detectOptimalFormat(userAgent);
        
        // 为每个图片应用智能格式
        selectedImages = selectedImages.map(image => {
          const convertedImage = getConvertedImageUrl(image, optimalFormat, siteUrl);
          return {
            ...image,
            url: convertedImage.url,
            format: convertedImage.format,
            converted: convertedImage.converted,
            optimal_format: optimalFormat,
            size: convertedImage.size > 0 ? convertedImage.size : image.size
          };
        });
      } else if (imageFormat !== 'original' && ['jpeg', 'webp', 'avif'].includes(imageFormat)) {
        // 指定格式处理
        selectedImages = selectedImages.map(image => {
          const convertedImage = getConvertedImageUrl(image, imageFormat, siteUrl);
          return {
            ...image,
            url: convertedImage.url,
            format: convertedImage.format,
            converted: convertedImage.converted,
            requested_format: imageFormat,
            size: convertedImage.size > 0 ? convertedImage.size : image.size
          };
        });
      }
    } else {
      // 外链模式：为每个图片添加外链标记
      selectedImages = selectedImages.map(image => ({
        ...image,
        format: 'external',
        converted: false,
        external_mode: true
      }));
    }
    
    // 根据格式返回数据
    if (format === 'text' || format === 'url') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      const urls = selectedImages.map(image => image.url).join('\n');
      res.status(200).send(urls);
    } else {
      // JSON格式 (默认)
      const response = {
        success: true,
        count: selectedImages.length,
        type: type,
        mode: 'random',
        total_available: totalImages,
        timestamp: Math.floor(Date.now() / 1000),
        api_version: API_VERSION,
        image_format: imageFormat,
        return_type: returnType,
        external_mode: external,
        user_agent: userAgent,
        images: selectedImages
      };
      
      if (imageFormat === 'auto') {
        response.detected_format = detectOptimalFormat(userAgent);
      }
      
      res.status(200).json(response);
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      count: 0,
      images: []
    });
  }
});

// 首页
app.get('/', (req, res) => {
  const serverInfo = {
    version: '3.0',
    status: '运行中',
    api: '/api/v2',
    features: [
      '设备自动检测',
      '智能图片格式优化',
      '多格式支持 (JPEG, WebP, AVIF)',
      '外链模式',
      'JSON/Text 格式输出',
      '重定向支持'
    ]
  };

  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PicFlow API</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
          color: #333;
          text-align: center;
          margin-bottom: 30px;
        }
        .status {
          text-align: center;
          color: #28a745;
          font-size: 18px;
          margin-bottom: 20px;
        }
        .info-section,
        .features-section,
        .api-examples {
          margin: 30px 0;
        }
        h2 {
          color: #555;
          margin-bottom: 15px;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #eee;
        }
        .info-item:last-child {
          border-bottom: none;
        }
        .label {
          font-weight: bold;
          color: #555;
        }
        .value {
          color: #777;
        }
        .features-list {
          list-style: none;
          padding: 0;
        }
        .features-list li {
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        .features-list li:last-child {
          border-bottom: none;
        }
        .api-examples {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 5px;
        }
        .example {
          margin: 15px 0;
        }
        code {
          background: #e9ecef;
          padding: 8px 12px;
          border-radius: 4px;
          display: block;
          margin-bottom: 5px;
          font-family: 'Courier New', monospace;
        }
        p {
          margin: 5px 0 0 0;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>PicFlow API</h1>
        <div class="status">✅ ${serverInfo.status}</div>
        
        <div class="info-section">
          <h2>API 信息</h2>
          <div class="info-item">
            <span class="label">版本</span>
            <span class="value">${serverInfo.version}</span>
          </div>
          <div class="info-item">
            <span class="label">API 端点</span>
            <span class="value">${serverInfo.api}</span>
          </div>
        </div>

        <div class="features-section">
          <h2>功能特性</h2>
          <ul class="features-list">
            ${serverInfo.features.map(feature => `<li>${feature}</li>`).join('')}
          </ul>
        </div>

        <div class="api-examples">
          <h2>使用示例</h2>
          <div class="example">
            <code>GET ${serverInfo.api}?count=5</code>
            <p>获取5张随机图片</p>
          </div>
          <div class="example">
            <code>GET ${serverInfo.api}?type=pe&format=webp</code>
            <p>获取移动端WebP格式图片</p>
          </div>
          <div class="example">
            <code>GET ${serverInfo.api}?external=true</code>
            <p>使用外链模式</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// 直接返回图片的路由
app.get('/image', (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    
    // 构建siteUrl
    const protocol = req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
    const host = req.headers['host'] || 'localhost:3000';
    const siteUrl = `${protocol}://${host}`;
    
    // 自动检测设备类型
    const type = isMobile(userAgent) ? 'pe' : 'pc';
    
    // 智能检测最佳格式
    const optimalFormat = detectOptimalFormat(userAgent);
    
    // 获取图片列表
    const result = getImages(type, 1, false, 'auto', siteUrl);
    
    if (!result.success || result.images.length === 0) {
      res.status(404).send('No image found');
      return;
    }
    
    // 选择第一张图片
    const image = result.images[0];
    
    // 获取最佳格式的图片
    const convertedImage = getConvertedImageUrl(image, optimalFormat, siteUrl);
    
    // 直接读取并返回图片文件
    if (fs.existsSync(convertedImage.path)) {
      const contentType = {
        'jpeg': 'image/jpeg',
        'webp': 'image/webp',
        'avif': 'image/avif'
      }[convertedImage.format] || 'image/jpeg';
      
      res.setHeader('Content-Type', contentType);
      res.sendFile(convertedImage.path);
    } else {
      // 如果转换后的文件不存在，返回原始文件
      if (image.path && fs.existsSync(image.path)) {
        const contentType = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'avif': 'image/avif'
        }[image.extension] || 'image/jpeg';
        
        res.setHeader('Content-Type', contentType);
        res.sendFile(image.path);
      } else {
        res.status(404).send('Image not found');
      }
    }
  } catch (error) {
    console.error('Image Error:', error);
    res.status(500).send('Internal server error');
  }
});

// 404处理
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
