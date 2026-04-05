import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// 配置常量
const BASE_DIR = process.cwd();
const CONVERTED_IMAGES_DIR = path.join(BASE_DIR, 'converted');
const DEFAULT_IMAGE_COUNT = 1;
const MAX_IMAGES_PER_REQUEST = 50;
const API_VERSION = '3.0';

// 设备检测函数
function isMobile(userAgent: string): boolean {
  const useragent_commentsblock = userAgent.match(/\(.*?\)/)?.[0] || '';
  
  function CheckSubstrs(substrs: string[], text: string): boolean {
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
function detectOptimalFormat(userAgent: string): string {
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
function getConvertedImageUrl(originalImage: any, targetFormat: string, siteUrl: string): any {
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

// 图片类型定义
interface Image {
  filename: string;
  path?: string;
  url: string;
  extension: string;
  type: string;
  size: number;
  source?: string;
  format?: string;
  external?: boolean;
  converted?: boolean;
  optimal_format?: string;
  requested_format?: string;
  external_mode?: boolean;
}

// 获取图片
function getImages(type: string, count: number, external: boolean, imageFormat: string, siteUrl: string): any {
  // 外链模式
  if (external) {
    return getExternalImages(type, count);
  }
  
  // 获取所有图片文件
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'];
  const images: Image[] = [];
  
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
function getExternalImages(type: string, count: number): any {
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
  
  const images: Image[] = [];
  
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

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 获取参数
    const count = Math.max(1, Math.min(MAX_IMAGES_PER_REQUEST, parseInt(req.query.count as string) || DEFAULT_IMAGE_COUNT));
    const format = (req.query.format as string) || 'json';
    let type = (req.query.type as string) || '';
    const imageFormat = (req.query.img_format as string) || 'auto';
    const returnType = (req.query.return as string) || 'json';
    const external = (req.query.external as string) === 'true' || (req.query.external as string) === '1';
    const userAgent = req.headers['user-agent'] as string || '';
    
    // 构建siteUrl
    const protocol = req.headers['x-forwarded-proto'] as string || 'http';
    const host = req.headers['host'] as string || 'localhost:3000';
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
    
    let selectedImages: Image[] = result.images;
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
      const response: any = {
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
}
